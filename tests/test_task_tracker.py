import time

from packages.domain.task_tracker import TaskTracker


def test_submit_marks_failed_result_dict_as_failed() -> None:
	tracker = TaskTracker()

	def fail_without_raising(progress_callback=None):
		return {"status": "failed", "error": "rate limited", "run_id": "run-1"}

	task_id = tracker.submit(
		task_type="fetch",
		title="Fetch topic",
		fn=fail_without_raising,
		total=1,
	)

	deadline = time.time() + 2
	task = None
	while time.time() < deadline:
		task = tracker.get_task(task_id)
		if task and task["finished"]:
			break
		time.sleep(0.01)

	assert task is not None
	assert task["finished"] is True
	assert task["success"] is False
	assert task["error"] == "rate limited"
	assert tracker.get_result(task_id)["run_id"] == "run-1"
