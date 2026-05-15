from datetime import UTC, datetime
from types import SimpleNamespace

from apps.api.routers.topics import _topic_dict


class FakeExecuteResult:
	def __init__(self, value):
		self.value = value

	def scalar_one_or_none(self):
		return self.value


class FakeSession:
	def __init__(self, last_run):
		self.last_run = last_run

	def scalar(self, statement):
		return 0

	def execute(self, statement):
		return FakeExecuteResult(self.last_run)


def test_topic_dict_includes_last_fetch_run_failure_details() -> None:
	topic = SimpleNamespace(
		id="topic-1",
		name="Base",
		query="cat:cs.AI",
		category_id=None,
		category_ids="cs.AI",
		enabled=True,
		max_results_per_run=20,
		retry_limit=2,
		schedule_frequency="daily",
		schedule_time_utc=21,
		enable_date_filter=False,
		date_filter_days=7,
		date_range_start=None,
		date_range_end=None,
		fetch_mode="quantity",
	)
	last_run = SimpleNamespace(
		run_at=datetime(2026, 5, 14, 9, 0, tzinfo=UTC),
		paper_count=0,
		status="failed",
		error_message="HTTP 429",
	)

	data = _topic_dict(topic, FakeSession(last_run))

	assert data["last_run_status"] == "failed"
	assert data["last_run_error"] == "HTTP 429"
