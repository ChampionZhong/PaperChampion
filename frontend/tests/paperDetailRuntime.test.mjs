import assert from "node:assert/strict";
import test from "node:test";

import {
	isTaskStartResponse,
	normalizeFigureItems,
	normalizeReviewerRisks,
	parseSavedDeepDiveReport,
	parseSavedSkimReport,
	planAutoAnalysis,
} from "../src/lib/paperDetailRuntime.ts";

test("normalizes missing figure items to an empty array", () => {
	assert.deepEqual(normalizeFigureItems(undefined), []);
	assert.deepEqual(normalizeFigureItems(null), []);
	assert.deepEqual(normalizeFigureItems({ task_id: "task-1" }), []);
});

test("normalizes malformed figure items with safe defaults", () => {
	const items = normalizeFigureItems([
		{ page_number: "3", image_type: "", description: null },
	]);

	assert.deepEqual(items, [
		{
			id: undefined,
			page_number: 3,
			image_index: 0,
			image_type: "figure",
			caption: "",
			description: "",
			image_url: null,
			has_image: false,
		},
	]);
});

test("detects async task start responses", () => {
	assert.equal(isTaskStartResponse({ task_id: "figure_analysis_123", status: "started" }), true);
	assert.equal(isTaskStartResponse({ items: [] }), false);
	assert.equal(isTaskStartResponse(null), false);
});

test("normalizes missing reviewer risks to an empty array", () => {
	assert.deepEqual(normalizeReviewerRisks(undefined), []);
	assert.deepEqual(normalizeReviewerRisks("single risk"), ["single risk"]);
	assert.deepEqual(normalizeReviewerRisks(["risk", "", 123]), ["risk", "123"]);
});

test("plans PDF download before PDF-only analysis when PDF is missing", () => {
	assert.deepEqual(
		planAutoAnalysis({
			hasPdf: false,
			canDownloadPdf: true,
			hasSkim: false,
			hasDeep: false,
			hasFigures: false,
			hasReasoning: false,
			hasEmbedding: false,
		}),
		{
			ready: ["downloadPdf", "skim", "embed"],
			afterPdf: ["deep", "figures", "reasoning"],
			blocked: [],
		},
	);
});

test("plans all missing pipelines together when PDF is already available", () => {
	assert.deepEqual(
		planAutoAnalysis({
			hasPdf: true,
			canDownloadPdf: true,
			hasSkim: false,
			hasDeep: false,
			hasFigures: false,
			hasReasoning: false,
			hasEmbedding: false,
		}),
		{
			ready: ["skim", "deep", "figures", "reasoning", "embed"],
			afterPdf: [],
			blocked: [],
		},
	);
});

test("marks PDF-only pipelines as blocked when no PDF can be obtained", () => {
	assert.deepEqual(
		planAutoAnalysis({
			hasPdf: false,
			canDownloadPdf: false,
			hasSkim: true,
			hasDeep: false,
			hasFigures: false,
			hasReasoning: false,
			hasEmbedding: true,
		}),
		{
			ready: [],
			afterPdf: [],
			blocked: ["deep", "figures", "reasoning"],
		},
	);
});

test("parses saved skim markdown back into structured display data", () => {
	assert.deepEqual(
		parseSavedSkimReport({
			summary_md: "- One-liner: A concise summary.\n- Innovations:\n  - First point\n  - Second point\n",
			skim_score: 0.8,
			key_insights: {},
		}),
		{
			one_liner: "A concise summary.",
			innovations: ["First point", "Second point"],
			relevance_score: 0.8,
		},
	);
});

test("prefers saved skim innovations from key insights", () => {
	assert.deepEqual(
		parseSavedSkimReport({
			summary_md: "- One-liner: A concise summary.\n- Innovations:\n  - Fallback point\n",
			skim_score: null,
			key_insights: { skim_innovations: ["Stored point"] },
		}),
		{
			one_liner: "A concise summary.",
			innovations: ["Stored point"],
			relevance_score: 0,
		},
	);
});

test("parses saved deep-dive markdown back into structured display data", () => {
	assert.deepEqual(
		parseSavedDeepDiveReport([
			"## Method",
			"Method details.",
			"",
			"## Experiments",
			"Experiment details.",
			"",
			"## Ablation",
			"Ablation details.",
			"",
			"## Reviewer Risks",
			"- Risk one",
			"- Risk two",
		].join("\n")),
		{
			method_summary: "Method details.",
			experiments_summary: "Experiment details.",
			ablation_summary: "Ablation details.",
			reviewer_risks: ["Risk one", "Risk two"],
		},
	);
});
