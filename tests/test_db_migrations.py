from sqlalchemy import text

from packages.storage.db import engine, run_migrations


def test_run_migrations_adds_image_path_to_image_analyses() -> None:
	run_migrations()

	with engine.connect() as conn:
		columns = [
			row[1]
			for row in conn.execute(text("PRAGMA table_info(image_analyses)")).fetchall()
		]

	assert "image_path" in columns
