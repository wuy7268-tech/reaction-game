from contextlib import asynccontextmanager, contextmanager
import os
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sqlite3

DB_PATH = Path(
    os.environ.get("SCORES_DB", Path(__file__).with_name("scores.db"))
)

GameLabel = Literal["reaction", "stroop"]


class ScoreIn(BaseModel):
    ms: int = Field(..., ge=1, le=60_000, description="Time in milliseconds")
    game: GameLabel = "reaction"
    correct: bool | None = Field(
        default=None,
        description="Whether the answer was correct (used by Stroop)",
    )


class ScoreOut(BaseModel):
    id: int
    ms: int
    game: str
    created_at: str
    correct: bool | None = None


class ClearOut(BaseModel):
    deleted: int


class GameStats(BaseModel):
    game: str
    best_ms: int | None = None
    average_ms: float | None = None
    attempts: int = 0


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _existing_columns(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("PRAGMA table_info(scores)").fetchall()
    return {row["name"] for row in rows}


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ms INTEGER NOT NULL,
                game TEXT NOT NULL DEFAULT 'reaction',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                correct INTEGER
            )
            """
        )

        # Upgrade older databases that were created before Week 3 columns.
        columns = _existing_columns(conn)
        if "game" not in columns:
            conn.execute(
                "ALTER TABLE scores ADD COLUMN game TEXT NOT NULL DEFAULT 'reaction'"
            )
        if "created_at" not in columns:
            conn.execute(
                "ALTER TABLE scores ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))"
            )
        if "correct" not in columns:
            conn.execute("ALTER TABLE scores ADD COLUMN correct INTEGER")


def row_to_score(row: sqlite3.Row) -> ScoreOut:
    correct_raw = row["correct"]
    correct = None if correct_raw is None else bool(correct_raw)
    return ScoreOut(
        id=row["id"],
        ms=row["ms"],
        game=row["game"],
        created_at=row["created_at"],
        correct=correct,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Reaction Game API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/scores", response_model=ScoreOut)
def save_score(score: ScoreIn):
    correct_value = None if score.correct is None else int(score.correct)
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO scores (ms, game, correct)
            VALUES (?, ?, ?)
            RETURNING id, ms, game, created_at, correct
            """,
            (score.ms, score.game, correct_value),
        )
        row = cursor.fetchone()
    return row_to_score(row)


@app.get("/scores", response_model=list[ScoreOut])
def list_scores(
    limit: int = Query(10, ge=1, le=100),
    game: GameLabel | None = Query(
        default=None,
        description="Filter by game label: reaction or stroop",
    ),
):
    with get_db() as conn:
        if game is None:
            rows = conn.execute(
                """
                SELECT id, ms, game, created_at, correct
                FROM scores
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, ms, game, created_at, correct
                FROM scores
                WHERE game = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (game, limit),
            ).fetchall()
    return [row_to_score(row) for row in rows]


@app.get("/stats", response_model=list[GameStats])
def get_stats():
    """Best time, average time, and attempts for each game."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT
                game,
                MIN(ms) AS best_ms,
                AVG(ms) AS average_ms,
                COUNT(*) AS attempts
            FROM scores
            GROUP BY game
            ORDER BY game
            """
        ).fetchall()

    stats_by_game = {
        row["game"]: GameStats(
            game=row["game"],
            best_ms=row["best_ms"],
            average_ms=round(row["average_ms"], 1) if row["average_ms"] is not None else None,
            attempts=row["attempts"],
        )
        for row in rows
    }

    # Always include both games so the frontend has a stable shape.
    return [
        stats_by_game.get("reaction", GameStats(game="reaction")),
        stats_by_game.get("stroop", GameStats(game="stroop")),
    ]


@app.delete("/scores", response_model=ClearOut)
def clear_scores():
    """Extra endpoint: wipe all saved scores."""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM scores")
        deleted = cursor.rowcount
    return ClearOut(deleted=deleted)
