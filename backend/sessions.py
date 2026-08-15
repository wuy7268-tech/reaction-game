"""Group scores into play sessions and compute per-session stats."""

from __future__ import annotations

from datetime import datetime
from statistics import mean, pstdev

SESSION_GAP_MINUTES = 30
SQLITE_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"


def parse_created_at(value: str) -> datetime:
    return datetime.strptime(value, SQLITE_TIME_FORMAT)


def group_into_sessions(
    scores: list[dict],
    gap_minutes: int = SESSION_GAP_MINUTES,
) -> list[list[dict]]:
    """
    Split scores into sessions by timestamp gaps.

    Scores should be ordered oldest → newest.
    A gap larger than `gap_minutes` starts a new session.
    """
    if not scores:
        return []

    ordered = sorted(scores, key=lambda s: (s["created_at"], s.get("id", 0)))
    sessions: list[list[dict]] = []
    current: list[dict] = [ordered[0]]

    gap_seconds = gap_minutes * 60
    for score in ordered[1:]:
        previous_time = parse_created_at(current[-1]["created_at"])
        current_time = parse_created_at(score["created_at"])
        if (current_time - previous_time).total_seconds() > gap_seconds:
            sessions.append(current)
            current = [score]
        else:
            current.append(score)

    sessions.append(current)
    return sessions


def summarize_session(session_index: int, scores: list[dict]) -> dict:
    times = [score["ms"] for score in scores]
    stroop_scores = [score for score in scores if score["game"] == "stroop"]
    correct_count = sum(
        1 for score in stroop_scores if score.get("correct") is True
    )

    accuracy = None
    if stroop_scores:
        accuracy = round((correct_count / len(stroop_scores)) * 100, 1)

    consistency = None
    if len(times) >= 2:
        # Population stdev in ms — lower means more consistent.
        consistency = round(pstdev(times), 1)

    return {
        "session_id": session_index,
        "started_at": scores[0]["created_at"],
        "ended_at": scores[-1]["created_at"],
        "attempts": len(scores),
        "average_ms": round(mean(times), 1),
        "best_ms": min(times),
        "consistency_ms": consistency,
        "stroop_attempts": len(stroop_scores),
        "accuracy_percent": accuracy,
        "game_counts": {
            "reaction": sum(1 for s in scores if s["game"] == "reaction"),
            "stroop": len(stroop_scores),
        },
    }


def build_session_summaries(
    scores: list[dict],
    gap_minutes: int = SESSION_GAP_MINUTES,
) -> list[dict]:
    sessions = group_into_sessions(scores, gap_minutes=gap_minutes)
    return [
        summarize_session(index + 1, session)
        for index, session in enumerate(sessions)
    ]
