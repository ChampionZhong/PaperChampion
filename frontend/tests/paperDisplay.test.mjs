import assert from "node:assert/strict";
import test from "node:test";

import { getExpandedAbstractText } from "../src/lib/paperDisplay.ts";

test("uses translated abstract after skim when available", () => {
	const paper = {
		read_status: "skimmed",
		abstract: "Original English abstract.",
		abstract_zh: "粗读后的中文摘要。",
	};

	assert.equal(getExpandedAbstractText(paper), "粗读后的中文摘要。");
});

test("keeps original abstract before skim", () => {
	const paper = {
		read_status: "unread",
		abstract: "Original English abstract.",
		abstract_zh: "中文摘要不应显示。",
	};

	assert.equal(getExpandedAbstractText(paper), "Original English abstract.");
});

test("falls back to original abstract when translated abstract is missing", () => {
	const paper = {
		read_status: "deep_read",
		abstract: "Original English abstract.",
		abstract_zh: "  ",
	};

	assert.equal(getExpandedAbstractText(paper), "Original English abstract.");
});
