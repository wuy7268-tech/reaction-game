from sessions import build_session_summaries, group_into_sessions


def test_group_into_sessions_by_30_minute_gap():
    scores = [
        {"id": 1, "ms": 200, "game": "reaction", "created_at": "2026-08-01 10:00:00", "correct": None},
        {"id": 2, "ms": 210, "game": "reaction", "created_at": "2026-08-01 10:05:00", "correct": None},
        # 40-minute gap → new session
        {"id": 3, "ms": 220, "game": "reaction", "created_at": "2026-08-01 10:45:00", "correct": None},
        {"id": 4, "ms": 800, "game": "stroop", "created_at": "2026-08-01 10:50:00", "correct": True},
    ]

    sessions = group_into_sessions(scores, gap_minutes=30)

    assert len(sessions) == 2
    assert [s["id"] for s in sessions[0]] == [1, 2]
    assert [s["id"] for s in sessions[1]] == [3, 4]


def test_session_summary_metrics():
    scores = [
        {"id": 1, "ms": 200, "game": "reaction", "created_at": "2026-08-01 18:00:00", "correct": None},
        {"id": 2, "ms": 300, "game": "reaction", "created_at": "2026-08-01 18:01:00", "correct": None},
        {"id": 3, "ms": 900, "game": "stroop", "created_at": "2026-08-01 18:02:00", "correct": True},
        {"id": 4, "ms": 700, "game": "stroop", "created_at": "2026-08-01 18:03:00", "correct": False},
    ]

    summaries = build_session_summaries(scores, gap_minutes=30)

    assert len(summaries) == 1
    summary = summaries[0]
    assert summary["session_id"] == 1
    assert summary["attempts"] == 4
    assert summary["average_ms"] == 525.0
    assert summary["best_ms"] == 200
    assert summary["consistency_ms"] is not None
    assert summary["stroop_attempts"] == 2
    assert summary["accuracy_percent"] == 50.0
    assert summary["game_counts"] == {"reaction": 2, "stroop": 2}
