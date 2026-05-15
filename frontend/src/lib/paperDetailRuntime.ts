export type RuntimeFigureAnalysisItem = {
	id?: string;
	page_number: number;
	image_index?: number;
	image_type: string;
	caption: string;
	description: string;
	image_url?: string | null;
	has_image?: boolean;
};

export type TaskStartResponse = {
	task_id: string;
	status?: string;
	message?: string;
};

export type AutoAnalysisTask =
	| "downloadPdf"
	| "skim"
	| "deep"
	| "figures"
	| "reasoning"
	| "embed";

export type AutoAnalysisState = {
	hasPdf: boolean;
	canDownloadPdf: boolean;
	hasSkim: boolean;
	hasDeep: boolean;
	hasFigures: boolean;
	hasReasoning: boolean;
	hasEmbedding: boolean;
};

export type AutoAnalysisPlan = {
	ready: AutoAnalysisTask[];
	afterPdf: AutoAnalysisTask[];
	blocked: AutoAnalysisTask[];
};

export type SavedSkimSource = {
	summary_md?: string | null;
	skim_score?: number | null;
	key_insights?: Record<string, unknown> | null;
};

export type StructuredSkimReport = {
	one_liner: string;
	innovations: string[];
	relevance_score: number;
};

export type StructuredDeepDiveReport = {
	method_summary: string;
	experiments_summary: string;
	ablation_summary: string;
	reviewer_risks: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
	if (typeof value === "string") {
		return value;
	}
	if (value == null) {
		return fallback;
	}
	return String(value);
}

function asNumber(value: unknown, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeFigureItems(items: unknown): RuntimeFigureAnalysisItem[] {
	if (!Array.isArray(items)) {
		return [];
	}

	const normalized: RuntimeFigureAnalysisItem[] = [];
	items.forEach((raw, index) => {
		const item = asRecord(raw);
		if (!item) {
			return;
		}
		const imageType = asString(item.image_type, "figure").trim() || "figure";
		normalized.push({
			id: typeof item.id === "string" ? item.id : undefined,
			page_number: asNumber(item.page_number, 0),
			image_index: asNumber(item.image_index, index),
			image_type: imageType,
			caption: asString(item.caption),
			description: asString(item.description),
			image_url: typeof item.image_url === "string" ? item.image_url : null,
			has_image: Boolean(item.has_image),
		});
	});
	return normalized;
}

export function normalizeReviewerRisks(risks: unknown): string[] {
	if (Array.isArray(risks)) {
		return risks
			.map((risk) => asString(risk).trim())
			.filter(Boolean);
	}
	const singleRisk = asString(risks).trim();
	return singleRisk ? [singleRisk] : [];
}

export function isTaskStartResponse(value: unknown): value is TaskStartResponse {
	const item = asRecord(value);
	return typeof item?.task_id === "string" && !Array.isArray(item.items);
}

export function planAutoAnalysis(state: AutoAnalysisState): AutoAnalysisPlan {
	const ready: AutoAnalysisTask[] = [];
	const afterPdf: AutoAnalysisTask[] = [];
	const blocked: AutoAnalysisTask[] = [];

	if (!state.hasPdf && state.canDownloadPdf) {
		ready.push("downloadPdf");
	}
	if (!state.hasSkim) {
		ready.push("skim");
	}
	if (!state.hasPdf && !state.hasEmbedding) {
		ready.push("embed");
	}

	const pdfTasks: Array<[AutoAnalysisTask, boolean]> = [
		["deep", state.hasDeep],
		["figures", state.hasFigures],
		["reasoning", state.hasReasoning],
	];
	pdfTasks.forEach(([task, isDone]) => {
		if (isDone) {
			return;
		}
		if (state.hasPdf) {
			ready.push(task);
			return;
		}
		if (state.canDownloadPdf) {
			afterPdf.push(task);
			return;
		}
		blocked.push(task);
	});

	if (state.hasPdf && !state.hasEmbedding) {
		ready.push("embed");
	}

	return { ready, afterPdf, blocked };
}

function stripBulletPrefix(line: string): string {
	return line
		.replace(/^\s*[-*]\s+/, "")
		.replace(/^\s*\d+\.\s+/, "")
		.trim();
}

function parseLabeledLine(markdown: string, labels: string[]): string {
	const lines = markdown.split(/\r?\n/);
	for (const rawLine of lines) {
		const line = stripBulletPrefix(rawLine);
		for (const label of labels) {
			if (line.toLowerCase().startsWith(label.toLowerCase())) {
				return line.slice(label.length).replace(/^[:：]\s*/, "").trim();
			}
		}
	}
	return "";
}

function parseBulletsAfterHeading(markdown: string, labels: string[]): string[] {
	const lines = markdown.split(/\r?\n/);
	const items: string[] = [];
	let collecting = false;
	for (const rawLine of lines) {
		const line = rawLine.trim();
		const normalized = stripBulletPrefix(line).replace(/[:：]\s*$/, "");
		if (labels.some((label) => normalized.toLowerCase() === label.toLowerCase())) {
			collecting = true;
			continue;
		}
		if (!collecting) {
			continue;
		}
		if (/^\s*[-*]\s+/.test(rawLine)) {
			const item = stripBulletPrefix(rawLine);
			if (item) items.push(item);
			continue;
		}
		if (line && !/^\s/.test(rawLine)) {
			break;
		}
	}
	return items;
}

function getStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.map((item) => asString(item).trim()).filter(Boolean)
		: [];
}

export function parseSavedSkimReport(source: SavedSkimSource | null | undefined): StructuredSkimReport | null {
	const markdown = source?.summary_md ?? "";
	if (!markdown.trim()) {
		return null;
	}
	const insights = source?.key_insights ?? {};
	const insightInnovations = getStringArray(insights.skim_innovations);
	const markdownInnovations = parseBulletsAfterHeading(markdown, ["Innovations", "创新点"]);
	return {
		one_liner: parseLabeledLine(markdown, ["One-liner", "一句话"]),
		innovations: insightInnovations.length > 0 ? insightInnovations : markdownInnovations,
		relevance_score: typeof source?.skim_score === "number" ? source.skim_score : 0,
	};
}

function sectionPattern(title: string): RegExp {
	return new RegExp(`^#{1,3}\\s*${title}\\s*$`, "im");
}

function extractSection(markdown: string, titles: string[]): string {
	const matches = titles
		.map((title) => {
			const match = sectionPattern(title).exec(markdown);
			return match ? { index: match.index, length: match[0].length } : null;
		})
		.filter((item): item is { index: number; length: number } => item !== null)
		.sort((left, right) => left.index - right.index);
	if (matches.length === 0) {
		return "";
	}
	const start = matches[0].index + matches[0].length;
	const rest = markdown.slice(start);
	const nextHeading = rest.search(/^#{1,3}\s+\S.*$/m);
	return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
}

export function parseSavedDeepDiveReport(markdown: string | null | undefined): StructuredDeepDiveReport | null {
	if (!markdown?.trim()) {
		return null;
	}
	const risksMarkdown = extractSection(markdown, ["Reviewer Risks", "审稿风险"]);
	const reviewerRisks = risksMarkdown
		.split(/\r?\n/)
		.map(stripBulletPrefix)
		.filter(Boolean);
	return {
		method_summary: extractSection(markdown, ["Method", "方法论", "方法"]),
		experiments_summary: extractSection(markdown, ["Experiments", "实验结果", "实验"]),
		ablation_summary: extractSection(markdown, ["Ablation", "消融实验", "消融"]),
		reviewer_risks: reviewerRisks,
	};
}
