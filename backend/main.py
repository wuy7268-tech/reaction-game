from contextlib import contextmanager
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sqlite3

DB_PATH = Path(__file__).with_name("scores.db")

app = FastAPI(title="Reaction Game API")

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


class ScoreIn(BaseModel):
    ms: int = Field(..., ge=1, le=60_000, description="Reaction time in milliseconds")


class ScoreOut(BaseModel):
    id: int
    ms: int
    created_at: str


class ClearOut(BaseModel):
    deleted: int


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ms INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/scores", response_model=ScoreOut)
def save_score(score: ScoreIn):
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO scores (ms) VALUES (?) RETURNING id, ms, created_at",
            (score.ms,),
        )
        row = cursor.fetchone()
    return ScoreOut(id=row["id"], ms=row["ms"], created_at=row["created_at"])


@app.get("/scores", response_model=list[ScoreOut])
def list_scores(limit: int = Query(10, ge=1, le=50)):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, ms, created_at
            FROM scores
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        ScoreOut(id=row["id"], ms=row["ms"], created_at=row["created_at"])
        for row in rows
    ]


@app.delete("/scores", response_model=ClearOut)
def clear_scores():
    """Extra endpoint: wipe all saved scores."""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM scores")
        deleted = cursor.rowcount
    return ClearOut(deleted=deleted)
