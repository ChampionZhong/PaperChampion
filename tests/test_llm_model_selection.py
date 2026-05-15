from contextlib import contextmanager
from types import SimpleNamespace
from uuid import uuid4

from packages.ai import cost_guard as cost_guard_module
from packages.ai import pipelines as pipelines_module
from packages.ai.cost_guard import CostGuardService
from packages.ai.pipelines import PaperPipelines
from packages.integrations.llm_client import LLMResult


class FakePaperRepository:
	def __init__(self, session) -> None:
		pass

	def get_by_id(self, paper_id):
		return SimpleNamespace(
			id=paper_id,
			title="Test Paper",
			abstract="Test abstract",
			arxiv_id="2501.00001",
			pdf_path="/tmp/test.pdf",
			metadata_json={},
		)

	def update_read_status(self, paper_id, status) -> None:
		pass


class FakeAnalysisRepository:
	def __init__(self, session) -> None:
		pass

	def upsert_skim(self, paper_id, skim) -> None:
		pass


class FakePipelineRunRepository:
	def __init__(self, session) -> None:
		pass

	def start(self, stage, paper_id=None):
		return SimpleNamespace(id=uuid4())

	def finish(self, run_id, elapsed_ms=None) -> None:
		pass

	def fail(self, run_id, error_message) -> None:
		pass


class FakePromptTraceRepository:
	def __init__(self, session) -> None:
		pass

	def create(self, **kwargs) -> None:
		pass


class FakeLLM:
	provider = "openai"

	def __init__(self) -> None:
		self.completed_with_model = None

	def model_for_stage(self, stage: str) -> str:
		models = {
			"skim": "gemini-3-flash-preview-thinking",
			"fallback": "gpt-5-mini",
		}
		return models[stage]

	def complete_json(self, prompt, stage, model_override=None):
		self.completed_with_model = model_override
		return LLMResult(
			content="{}",
			parsed_json={},
			input_tokens=1,
			output_tokens=1,
			input_cost_usd=0.0,
			output_cost_usd=0.0,
			total_cost_usd=0.0,
		)


def test_skim_uses_active_llm_config_as_cost_guard_default(monkeypatch) -> None:
	captured = {}

	@contextmanager
	def fake_session_scope():
		yield object()

	class FakeCostGuardService:
		def __init__(self, session, llm) -> None:
			pass

		def choose_model(self, *, stage, prompt, default_model):
			captured["stage"] = stage
			captured["default_model"] = default_model
			return SimpleNamespace(chosen_model=default_model)

	monkeypatch.setattr(pipelines_module, "session_scope", fake_session_scope)
	monkeypatch.setattr(pipelines_module, "PaperRepository", FakePaperRepository)
	monkeypatch.setattr(pipelines_module, "AnalysisRepository", FakeAnalysisRepository)
	monkeypatch.setattr(pipelines_module, "PipelineRunRepository", FakePipelineRunRepository)
	monkeypatch.setattr(pipelines_module, "PromptTraceRepository", FakePromptTraceRepository)
	monkeypatch.setattr(pipelines_module, "CostGuardService", FakeCostGuardService)

	pipeline = PaperPipelines.__new__(PaperPipelines)
	pipeline.settings = SimpleNamespace(llm_model_skim="glm-4.7")
	pipeline.llm = FakeLLM()
	pipeline._build_skim_structured = lambda abstract, content, parsed: SimpleNamespace(
		keywords=[],
		title_zh=None,
		abstract_zh=None,
	)

	pipeline.skim(uuid4())

	assert captured == {
		"stage": "skim",
		"default_model": "gemini-3-flash-preview-thinking",
	}
	assert pipeline.llm.completed_with_model == "gemini-3-flash-preview-thinking"


def test_cost_guard_uses_active_fallback_model(monkeypatch) -> None:
	class FakeSettings:
		cost_guard_enabled = True
		per_call_budget_usd = 0.01
		daily_budget_usd = 0.0
		llm_model_fallback = "glm-4.7"

	class FakePromptTraceRepo:
		def __init__(self, session) -> None:
			pass

		def summarize_costs(self, days):
			return {"total_cost_usd": 0.0}

	class FakeCostLLM:
		def model_for_stage(self, stage: str) -> str:
			assert stage == "fallback"
			return "gpt-5-mini"

		def estimate_cost(self, *, model, input_tokens, output_tokens):
			if model == "gemini-3-flash-preview-thinking":
				return 0.0, 0.0, 0.02
			if model == "gpt-5-mini":
				return 0.0, 0.0, 0.005
			raise AssertionError(f"Unexpected model: {model}")

	monkeypatch.setattr(cost_guard_module, "get_settings", lambda: FakeSettings())
	monkeypatch.setattr(cost_guard_module, "PromptTraceRepository", FakePromptTraceRepo)

	decision = CostGuardService(
		session=object(),
		llm=FakeCostLLM(),
	).choose_model(
		stage="skim",
		prompt="x" * 100,
		default_model="gemini-3-flash-preview-thinking",
	)

	assert decision.chosen_model == "gpt-5-mini"
	assert "fallback=gpt-5-mini" in decision.note
