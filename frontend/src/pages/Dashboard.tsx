/**
 * Dashboard — system overview.
 *
 * Editorial Lab refresh: PageHeader + hairline section cards + module-accent
 * stat tiles. No gradient backgrounds, no decorative shadows. Module dot
 * accents replace the per-card colored backgrounds from the previous design.
 *
 * @author Bamzc
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
	Activity,
	ArrowUpRight,
	BarChart3,
	BookOpen,
	Cpu,
	FileText,
	Loader2,
	RefreshCw,
	Sparkles,
	XCircle,
	Zap,
} from "lucide-react";
import { Button, Dot } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { StatCardSkeleton } from "@/components/Skeleton";
import { useGlobalTasks } from "@/contexts/GlobalTaskContext";
import { metricsApi, pipelineApi, systemApi, todayApi, type TodaySummary } from "@/services/api";
import { formatDuration, timeAgo, cn } from "@/lib/utils";
import type { ModuleKey } from "@/lib/tokens";
import type { CostMetrics, PipelineRun, SystemStatus } from "@/types";

const STAGE_LABELS: Record<string, string> = {
	skim: "粗读分析",
	deep_dive: "深度精读",
	deep: "深度精读",
	rag: "RAG 问答",
	reasoning_chain: "推理链分析",
	vision_figure: "图表解读",
	vision: "视觉模型",
	agent_chat: "Agent 对话",
	embed: "向量化",
	embedding: "向量化",
	graph_evolution: "演化分析",
	graph_survey: "综述生成",
	graph_research_gaps: "研究空白",
	graph_timeline: "时间线分析",
	graph_citation_tree: "引用树分析",
	graph_quality: "质量评估",
	wiki_paper: "论文 Wiki",
	wiki_outline: "Wiki 大纲",
	wiki_section: "Wiki 章节",
	wiki_overview: "Wiki 概述",
	keyword_suggest: "关键词建议",
	pdf_reader_ai: "PDF 阅读助手",
	daily_brief: "研究简报",
	translate: "标题翻译",
};

const PIPELINE_LABELS: Record<string, string> = {
	skim: "粗读分析",
	deep_dive: "深度精读",
	embed_paper: "向量化",
	ingest_arxiv: "arXiv 收集",
	ingest_arxiv_with_ids: "订阅收集",
	daily_brief: "每日简报",
	daily_graph_maintenance: "图维护",
};

function fmtTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

export default function Dashboard() {
	const navigate = useNavigate();
	const { activeTasks, hasRunning } = useGlobalTasks();
	const [status, setStatus] = useState<SystemStatus | null>(null);
	const [costs, setCosts] = useState<CostMetrics | null>(null);
	const [runs, setRuns] = useState<PipelineRun[]>([]);
	const [today, setToday] = useState<TodaySummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [s, c, r, t] = await Promise.all([
				systemApi.status(),
				metricsApi.costs(7),
				pipelineApi.runs(10),
				todayApi.summary().catch(() => null),
			]);
			setStatus(s);
			setCosts(c);
			setRuns(r.items);
			setToday(t);
		} catch (err) {
			setError(err instanceof Error ? err.message : "加载失败");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	if (loading) return <StatCardSkeleton />;

	if (error) {
		return (
			<div className="flex flex-col items-center py-20">
				<div className="rounded-2xl bg-error-light p-6">
					<XCircle className="mx-auto h-10 w-10 text-error" />
				</div>
				<p className="mt-4 text-sm text-error">{error}</p>
				<Button variant="secondary" className="mt-4" onClick={loadData}>
					重试
				</Button>
			</div>
		);
	}

	const isHealthy = status?.health?.status === "ok";
	const todayNew = today?.today_new ?? 0;
	const weekNew = today?.week_new ?? 0;
	const totalPapers = today?.total_papers ?? (status?.counts?.papers_latest_200 ?? 0);

	const headerActions = (
		<>
			{hasRunning && (
				<span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-[11.5px] font-medium text-primary-strong">
					<Loader2 className="h-3 w-3 animate-spin" />
					{activeTasks.length} 个任务运行中
				</span>
			)}
			<span
				className={cn(
					"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium",
					isHealthy ? "bg-success-light text-success" : "bg-error-light text-error",
				)}
			>
				<span
					className={cn(
						"h-1.5 w-1.5 rounded-full",
						isHealthy ? "bg-success" : "bg-error",
					)}
				/>
				{isHealthy ? "系统正常" : "系统异常"}
			</span>
			<Button
				variant="secondary"
				size="sm"
				iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
				onClick={loadData}
			>
				刷新
			</Button>
		</>
	);

	return (
		<div className="animate-fade-in">
			<PageHeader
				title="Dashboard"
				subtitle="系统总览与运行状态"
				module="dashboard"
				actions={headerActions}
			/>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatTile
					module="papers"
					label="今日新增"
					value={todayNew}
					sub={`本周 ${weekNew} 篇`}
					onClick={() => navigate("/papers")}
				/>
				<StatTile
					module="brief"
					label="论文总量"
					value={totalPapers}
					sub={`${status?.counts?.enabled_topics ?? 0} 个订阅`}
					onClick={() => navigate("/papers")}
				/>
				<StatTile
					module="graph"
					label="Pipeline"
					value={status?.counts?.runs_latest_50 ?? 0}
					sub={`${status?.counts?.failed_runs_latest_50 ?? 0} 个失败`}
					onClick={() => navigate("/pipelines")}
				/>
				<StatTile
					module="wiki"
					label="7 日 Token"
					value={fmtTokens(
						(costs?.input_tokens ?? 0) + (costs?.output_tokens ?? 0),
					)}
					sub={`${costs?.calls ?? 0} 次调用`}
				/>
			</div>

			{/* Quick-info row — running tasks + recommendations side-by-side,
			   sits directly under the 4 stat tiles and shares their width */}
			{((hasRunning && activeTasks.length > 0) ||
				(today && today.recommendations.length > 0)) && (
				<div className="mt-4 grid gap-4 lg:grid-cols-2">
					{hasRunning && activeTasks.length > 0 && (
						<Section
							title="运行中"
							icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}
						>
							<div className="space-y-3">
								{activeTasks.slice(0, 3).map((task) => (
									<div
										key={task.task_id}
										className="rounded-md border border-border-light bg-page px-3 py-2.5"
									>
										<div className="mb-1.5 flex items-center justify-between gap-2">
											<h4 className="flex-1 truncate text-[12px] font-medium text-ink">
												{task.title}
											</h4>
											<span className="text-[10.5px] tabular-nums font-semibold text-primary-strong">
												{task.progress_pct}%
											</span>
										</div>
										<div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-border">
											<div
												className="h-full rounded-full bg-primary transition-[width] duration-normal ease-standard"
												style={{ width: `${task.progress_pct}%` }}
											/>
										</div>
										<p className="truncate text-[10.5px] text-ink-secondary">
											{task.message}
										</p>
									</div>
								))}
								{activeTasks.length > 3 && (
									<p className="text-center text-[10.5px] text-ink-tertiary">
										还有 {activeTasks.length - 3} 个任务…
									</p>
								)}
							</div>
						</Section>
					)}

					{today && today.recommendations.length > 0 && (
						<Section
							title="推荐阅读"
							icon={<Sparkles className="h-3.5 w-3.5" />}
						>
							<ul className="-mx-2 space-y-0.5">
								{today.recommendations.slice(0, 4).map((rec) => (
									<li key={rec.id}>
										<button
											onClick={() => navigate(`/papers/${rec.id}`)}
											className="group flex w-full items-baseline gap-3 rounded-md px-2 py-2 text-left transition-colors duration-fast hover:bg-hover"
										>
											<span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-tertiary">
												{Math.round(rec.similarity * 100)}%
											</span>
											<span className="flex-1 truncate text-[12.5px] text-ink group-hover:text-primary-strong">
												{rec.title_zh || rec.title}
											</span>
										</button>
									</li>
								))}
							</ul>
						</Section>
					)}
				</div>
			)}

			{/* Main analysis row — both panels full-width, aligned to
			   the 4 stat tiles above */}
			<div className="mt-4 space-y-4">
				<Section
					title="Token 用量分析"
					icon={<BarChart3 className="h-3.5 w-3.5" />}
				>
					{costs && costs.by_stage.length > 0 ? (
						<TokenAnalysis costs={costs} />
					) : (
						<EmptyHint icon={<BarChart3 />} text="暂无 Token 数据" />
					)}
				</Section>

				<Section
					title="最近活动"
					icon={<Activity className="h-3.5 w-3.5" />}
				>
					{runs.length > 0 ? (
						<RecentRuns runs={runs} onOpen={() => navigate("/pipelines")} />
					) : (
						<EmptyHint
							icon={<Activity />}
							text="暂无活动记录"
							hint="运行任务后会在这里显示"
						/>
					)}
				</Section>
			</div>
		</div>
	);
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface StatTileProps {
	module: ModuleKey;
	label: string;
	value: string | number;
	sub: string;
	onClick?: () => void;
}

function StatTile({ module, label, value, sub, onClick }: StatTileProps) {
	const interactive = !!onClick;
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!interactive}
			className={cn(
				"group flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-surface p-5 text-left",
				"transition-[border-color,box-shadow,background-color] duration-fast ease-standard",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
				interactive
					? "cursor-pointer hover:border-border-strong hover:shadow-xs"
					: "cursor-default",
			)}
		>
			<div className="flex w-full items-center justify-between">
				<div className="flex items-center gap-2">
					<Dot module={module} size={6} />
					<span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-tertiary">
						{label}
					</span>
				</div>
				{interactive && (
					<ArrowUpRight className="h-3.5 w-3.5 text-ink-tertiary opacity-0 transition-opacity duration-fast group-hover:opacity-100" />
				)}
			</div>
			<p className="mt-3 font-display text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">
				{value}
			</p>
			<p className="mt-1.5 text-[12px] text-ink-secondary">{sub}</p>
		</button>
	);
}

interface SectionProps {
	title: string;
	icon?: ReactNode;
	children: ReactNode;
	action?: ReactNode;
}

function Section({ title, icon, children, action }: SectionProps) {
	return (
		<section className="overflow-hidden rounded-xl border border-border bg-surface">
			<header className="flex items-center justify-between gap-3 border-b border-border-light px-5 py-3">
				<div className="flex items-center gap-2 text-ink-tertiary">
					{icon}
					<h3 className="text-[11px] font-semibold uppercase tracking-[0.10em] text-ink">
						{title}
					</h3>
				</div>
				{action}
			</header>
			<div className="px-5 py-4">{children}</div>
		</section>
	);
}

function EmptyHint({
	icon,
	text,
	hint,
}: {
	icon: ReactNode;
	text: string;
	hint?: string;
}) {
	return (
		<div className="flex flex-col items-center py-10 text-center">
			<span className="mb-3 text-ink-tertiary [&_svg]:h-8 [&_svg]:w-8">{icon}</span>
			<p className="text-[13px] text-ink-secondary">{text}</p>
			{hint && <p className="mt-1 text-[11px] text-ink-tertiary">{hint}</p>}
		</div>
	);
}

function TokenAnalysis({ costs }: { costs: CostMetrics }) {
	const totalIn = costs.input_tokens ?? 0;
	const totalOut = costs.output_tokens ?? 0;
	const sortedStages = [...costs.by_stage].sort((a, b) => {
		const totalA = (a.input_tokens ?? 0) + (a.output_tokens ?? 0);
		const totalB = (b.input_tokens ?? 0) + (b.output_tokens ?? 0);
		return totalB - totalA;
	});
	const maxStage = Math.max(
		...sortedStages.map((x) => (x.input_tokens ?? 0) + (x.output_tokens ?? 0)),
		1,
	);
	return (
		<div className="space-y-5">
			<div className="grid grid-cols-3 gap-3">
				{[
					{ label: "总 Token", value: fmtTokens(totalIn + totalOut), tone: "text-ink" },
					{ label: "输入", value: fmtTokens(totalIn), tone: "text-info" },
					{ label: "输出", value: fmtTokens(totalOut), tone: "text-warning" },
				].map((s) => (
					<div
						key={s.label}
						className="rounded-md border border-border-light bg-page px-3 py-3 text-center"
					>
						<p className={cn("font-display text-[20px] font-semibold tabular-nums leading-none", s.tone)}>
							{s.value}
						</p>
						<p className="mt-1.5 text-[10.5px] uppercase tracking-wider text-ink-tertiary">
							{s.label}
						</p>
					</div>
				))}
			</div>

			<div className="space-y-3">
				<p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-ink-tertiary">
					按阶段 · 按 Token 用量降序
				</p>
				{sortedStages.map((s) => {
					const stageTotal = (s.input_tokens ?? 0) + (s.output_tokens ?? 0);
					const inputPct = ((s.input_tokens ?? 0) / maxStage) * 100;
					const outputPct = ((s.output_tokens ?? 0) / maxStage) * 100;
					return (
						<div key={s.stage}>
							<div className="mb-1 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Zap className="h-3 w-3 text-ink-tertiary" />
									<span className="text-[13px] text-ink">
										{STAGE_LABELS[s.stage] || s.stage}
									</span>
								</div>
								<div className="flex items-baseline gap-2 font-mono">
									<span className="text-[13px] font-semibold tabular-nums text-ink">
										{fmtTokens(stageTotal)}
									</span>
									<span className="text-[10px] text-ink-tertiary">
										{s.calls} 次
									</span>
								</div>
							</div>
							<div className="flex h-1.5 w-full overflow-hidden rounded-full bg-page">
								<div
									className="h-full bg-info/70"
									style={{ width: `${Math.max(inputPct, 0.5)}%` }}
								/>
								<div
									className="h-full bg-warning/70"
									style={{ width: `${Math.max(outputPct, 0.5)}%` }}
								/>
							</div>
						</div>
					);
				})}
				<div className="flex items-center gap-4 text-[10px] text-ink-tertiary">
					<span className="flex items-center gap-1">
						<span className="inline-block h-1.5 w-1.5 rounded-full bg-info/70" />
						输入
					</span>
					<span className="flex items-center gap-1">
						<span className="inline-block h-1.5 w-1.5 rounded-full bg-warning/70" />
						输出
					</span>
				</div>
			</div>
		</div>
	);
}

function RecentRuns({
	runs,
	onOpen,
}: {
	runs: PipelineRun[];
	onOpen: () => void;
}) {
	return (
		<ul className="-mx-2 space-y-0.5">
			{runs.map((run, index) => (
				<li key={run.id}>
					<button
						type="button"
						onClick={onOpen}
						className="group flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-fast hover:bg-hover"
					>
						<span className="w-5 shrink-0 text-right font-mono text-[10px] tabular-nums text-ink-tertiary">
							{index + 1}
						</span>
						<StatusDot status={run.status} />
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<p className="truncate text-[13px] font-medium text-ink">
									{PIPELINE_LABELS[run.pipeline_name] || run.pipeline_name}
								</p>
								{run.elapsed_ms != null && (
									<span className="shrink-0 font-mono text-[10px] text-ink-tertiary">
										{formatDuration(run.elapsed_ms)}
									</span>
								)}
							</div>
							<div className="flex items-center gap-2 text-[10.5px] text-ink-tertiary">
								<span>{timeAgo(run.created_at)}</span>
								{run.error_message && (
									<span className="truncate text-error">{run.error_message}</span>
								)}
							</div>
						</div>
					</button>
				</li>
			))}
		</ul>
	);
}

function StatusDot({ status }: { status: string }) {
	const map: Record<string, string> = {
		succeeded: "bg-success",
		running: "bg-info status-running",
		pending: "bg-warning",
		failed: "bg-error",
	};
	return (
		<span
			className={cn(
				"h-2 w-2 shrink-0 rounded-full",
				map[status] || "bg-ink-tertiary",
			)}
		/>
	);
}
