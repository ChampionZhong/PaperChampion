import httpx
import pytest

from packages.integrations import arxiv_client as arxiv_module


class FakeRateLimitedClient:
	is_closed = False

	def get(self, url, params=None):
		request = httpx.Request("GET", url)
		return httpx.Response(429, request=request)


def test_fetch_latest_reports_rate_limit_retry_progress(monkeypatch) -> None:
	client = arxiv_module.ArxivClient()
	client._client = FakeRateLimitedClient()
	sleep_seconds: list[int] = []
	progress_messages: list[str] = []

	monkeypatch.setattr(arxiv_module, "acquire_api", lambda *args, **kwargs: True)
	monkeypatch.setattr(arxiv_module, "release_api", lambda *args, **kwargs: None)
	monkeypatch.setattr(arxiv_module, "record_rate_limit_error", lambda *args, **kwargs: None)
	monkeypatch.setattr(arxiv_module.time, "sleep", lambda seconds: sleep_seconds.append(seconds))

	with pytest.raises(httpx.HTTPStatusError):
		client.fetch_latest(
			query="cat:cs.AI",
			max_results=1,
			progress_callback=progress_messages.append,
		)

	assert sleep_seconds[0] == 30
	assert any("ArXiv rate limit" in message and "30s" in message for message in progress_messages)
