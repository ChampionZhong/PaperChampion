from contextlib import contextmanager
from types import SimpleNamespace
from uuid import uuid4

import pytest

from packages.ai import pipelines as pipelines_module
from packages.ai.pipelines import PaperPipelines
from packages.ai.prompts import build_deep_prompt


def test_deep_prompt_does_not_include_copyable_placeholders() -> None:
	prompt = build_deep_prompt(
		"Negation Neglect",
		"Paper content about negation neglect experiments.",
	)

	assert '"method_summary":"方法总结"' not in prompt
	assert '"experiments_summary":"实验总结"' not in prompt
	assert '"ablation_summary":"消融实验总结"' not in prompt
	assert "风险点1" not in prompt
	assert "风险点2" not in prompt


def test_deep_structured_rejects_placeholder_json() -> None:
	placeholder = {
		"method_summary": "方法总结",
		"experiments_summary": "实验总结",
		"ablation_summary": "消融实验总结",
		"reviewer_risks": ["风险点1", "风险"],
	}

	with pytest.raises(ValueError, match="placeholder"):
		PaperPipelines._build_deep_structured("{}", placeholder)


def test_deep_dive_fails_before_llm_when_pdf_text_is_too_short(monkeypatch) -> None:
	paper_id = uuid4()
	run_state = {}

	@contextmanager
	def fake_session_scope():
		yield object()

	class FakePaperRepository:
		def __init__(self, session) -> None:
			pass

		def get_by_id(self, requested_id):
			assert requested_id == paper_id
			return SimpleNamespace(
				id=paper_id,
				title="Short PDF Paper",
				arxiv_id="2605.00001v1",
				pdf_path="/tmp/short.pdf",
				metadata_json={},
			)

		def update_read_status(self, requested_id, status) -> None:
			raise AssertionError("read status should not be updated")

	class FakeAnalysisRepository:
		def __init__(self, session) -> None:
			pass

		def upsert_deep_dive(self, requested_id, deep) -> None:
			raise AssertionError("deep report should not be saved")

	class FakePipelineRunRepository:
		def __init__(self, session) -> None:
			pass

		def start(self, stage, paper_id=None):
			run_state["stage"] = stage
			return SimpleNamespace(id=uuid4())

		def finish(self, run_id, elapsed_ms=None) -> None:
			raise AssertionError("run should not finish successfully")

		def fail(self, run_id, error_message) -> None:
			run_state["failed_error"] = error_message

	class FakePromptTraceRepository:
		def __init__(self, session) -> None:
			pass

		def create(self, **kwargs) -> None:
			raise AssertionError("prompt trace should not be created")

	class FakeLLM:
		def model_for_stage(self, stage: str) -> str:
			return "gemini-3.1-pro-preview-thinking"

		def complete_json(self, *args, **kwargs):
			raise AssertionError("LLM should not be called for short PDF text")

	monkeypatch.setattr(pipelines_module, "session_scope", fake_session_scope)
	monkeypatch.setattr(pipelines_module, "PaperRepository", FakePaperRepository)
	monkeypatch.setattr(pipelines_module, "AnalysisRepository", FakeAnalysisRepository)
	monkeypatch.setattr(pipelines_module, "PipelineRunRepository", FakePipelineRunRepository)
	monkeypatch.setattr(pipelines_module, "PromptTraceRepository", FakePromptTraceRepository)

	pipeline = PaperPipelines.__new__(PaperPipelines)
	pipeline.llm = FakeLLM()
	pipeline.vision = SimpleNamespace(
		extract_page_descriptions=lambda pdf_path: "vision context",
	)
	pipeline.pdf_extractor = SimpleNamespace(
		extract_text=lambda pdf_path, max_pages: "too short",
	)

	with pytest.raises(ValueError, match="PDF text extraction"):
		pipeline.deep_dive(paper_id)

	assert run_state["stage"] == "deep_dive"
	assert "PDF text extraction" in run_state["failed_error"]
