"""
Seed realistic multi-session sample scores for Week 4.

Usage (from project root):
  .venv/bin/python backend/seed_sample_data.py
  .venv/bin/python backend/seed_sample_data.py --reset
"""

from __future__ import annotations

import argparse
import random
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main

RANDOM_SEED = 42


def insert_score(
    conn: sqlite3.Connection,
    *,
    ms: int,
    game: str,
    created_at: datetime,
    correct: bool | None,
) -> None:
    correct_value = None if correct is None else int(correct)
    conn.execute(
        """
        INSERT INTO scores (ms, game, created_at, correct)
        VALUES (?, ?, ?, ?)
        """,
        (
            ms,
            game,
            created_at.strftime("%Y-%m-%d %H:%M:%S"),
            correct_value,
        ),
    )


def build_sessions(now: datetime) -> list[tuple[datetime, int, int]]:
    """
    Return (session_start, reaction_count, stroop_count) for each sitting.

    Spreads ~10 sittings across several days with enough scores for clustering.
    """
    plan = [
        (0, 18, 12),
        (1, 16, 14),
        (2, 20, 10),
        (3, 15, 15),
        (5, 22, 12),
        (6, 14, 16),
        (8, 18, 14),
        (9, 16, 12),
        (11, 20, 15),
        (12, 17, 13),
    ]
    sessions = []
    for day_offset, reaction_n, stroop_n in plan:
        # Afternoon / evening sittings at slightly different hours.
        hour = 14 + (day_offset % 5)
        start = (now - timedelta(days=day_offset)).replace(
            hour=hour,
            minute=10 + (day_offset % 3) * 7,
            second=0,
            microsecond=0,
        )
        sessions.append((start, reaction_n, stroop_n))
    # Oldest first so ids grow with time.
    sessions.sort(key=lambda item: item[0])
    return sessions


def generate_scores(conn: sqlite3.Connection) -> int:
    random.seed(RANDOM_SEED)
    now = datetime.now().replace(microsecond=0)
    total = 0

    for session_start, reaction_n, stroop_n in build_sessions(now):
        cursor = session_start

        # Reaction block: improving slightly within a sitting.
        base_reaction = random.randint(230, 310)
        for i in range(reaction_n):
            cursor += timedelta(seconds=random.randint(8, 25))
            noise = random.randint(-35, 45)
            trend = -i  # tiny improvement across the sitting
            ms = max(160, base_reaction + noise + trend)
            insert_score(
                conn,
                ms=ms,
                game="reaction",
                created_at=cursor,
                correct=None,
            )
            total += 1

        # Short pause inside the same session (< 30 minutes).
        cursor += timedelta(minutes=random.randint(2, 6))

        # Stroop block: slower times, mixed accuracy.
        base_stroop = random.randint(650, 950)
        for i in range(stroop_n):
            cursor += timedelta(seconds=random.randint(10, 30))
            noise = random.randint(-80, 120)
            ms = max(350, base_stroop + noise - i)
            correct = random.random() > 0.22  # ~78% accuracy
            insert_score(
                conn,
                ms=ms,
                game="stroop",
                created_at=cursor,
                correct=correct,
            )
            total += 1

    return total


def main_cli() -> None:
    parser = argparse.ArgumentParser(description="Seed multi-session sample scores")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing scores before inserting sample data",
    )
    args = parser.parse_args()

    main.init_db()
    with main.get_db() as conn:
        if args.reset:
            conn.execute("DELETE FROM scores")
        inserted = generate_scores(conn)

    print(f"Inserted {inserted} sample scores into {main.DB_PATH}")
    print("Tip: GET /sessions to see session summaries.")


if __name__ == "__main__":
    main_cli()
