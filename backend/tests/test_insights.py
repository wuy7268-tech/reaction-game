from fastapi.testclient import TestClient

import main
from insights import cluster_sessions, label_from_centroid


def _insert_score(conn, *, ms, game, created_at, correct=None):
    conn.execute(
        """
        INSERT INTO scores (ms, game, created_at, correct)
        VALUES (?, ?, ?, ?)
        """,
        (ms, game, created_at, None if correct is None else int(correct)),
    )


def test_insights_endpoint_clusters_sessions(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test_scores.db")
    main.init_db()

    with main.get_db() as conn:
        # Three sittings, spaced more than 30 minutes apart.
        for hour, ms in ((10, 220), (11, 230), (12, 210)):
            _insert_score(
                conn,
                ms=ms,
                game="reaction",
                created_at=f"2026-08-01 {hour}:00:00",
            )
            _insert_score(
                conn,
                ms=ms + 500,
                game="stroop",
                created_at=f"2026-08-01 {hour}:01:00",
                correct=True,
            )

        for hour, ms in ((14, 520), (15, 540), (16, 510)):
            _insert_score(
                conn,
                ms=ms,
                game="reaction",
                created_at=f"2026-08-01 {hour}:00:00",
            )
            _insert_score(
                conn,
                ms=ms + 200,
                game="stroop",
                created_at=f"2026-08-01 {hour}:01:00",
                correct=False,
            )

        for hour, ms in ((18, 250), (19, 260)):
            _insert_score(
                conn,
                ms=ms,
                game="reaction",
                created_at=f"2026-08-01 {hour}:00:00",
            )
            _insert_score(
                conn,
                ms=900,
                game="stroop",
                created_at=f"2026-08-01 {hour}:01:00",
                correct=True,
            )

    with TestClient(main.app) as client:
        response = client.get("/insights", params={"k": 3})

    assert response.status_code == 200
    body = response.json()
    assert body["scaled"] is True
    assert body["n_clusters"] == 3
    assert len(body["groups"]) == 3
    assert all(group["label"] for group in body["groups"])
    assert all(group["size"] >= 1 for group in body["groups"])
    assert set(body["features_used"]) == {
        "average_ms",
        "best_ms",
        "consistency_ms",
        "attempts",
        "accuracy_percent",
    }
    assert len(body["sessions"]) == 8
    assert all("label" in session and "cluster_id" in session for session in body["sessions"])


def test_label_fast_but_inconsistent():
    centroid = {
        "average_ms": 200,
        "best_ms": 160,
        "consistency_ms": 120,
        "attempts": 20,
        "accuracy_percent": 70,
    }
    centers = {
        "average_ms": 400,
        "best_ms": 250,
        "consistency_ms": 60,
        "attempts": 20,
        "accuracy_percent": 75,
    }
    assert label_from_centroid(centroid, centers) == "fast but inconsistent"


def test_cluster_sessions_assigns_labels():
    sessions = [
        {
            "session_id": 1,
            "started_at": "2026-08-01 10:00:00",
            "ended_at": "2026-08-01 10:10:00",
            "attempts": 20,
            "average_ms": 220,
            "best_ms": 180,
            "consistency_ms": 25,
            "stroop_attempts": 8,
            "accuracy_percent": 90,
            "game_counts": {"reaction": 12, "stroop": 8},
        },
        {
            "session_id": 2,
            "started_at": "2026-08-02 10:00:00",
            "ended_at": "2026-08-02 10:10:00",
            "attempts": 18,
            "average_ms": 240,
            "best_ms": 190,
            "consistency_ms": 110,
            "stroop_attempts": 8,
            "accuracy_percent": 70,
            "game_counts": {"reaction": 10, "stroop": 8},
        },
        {
            "session_id": 3,
            "started_at": "2026-08-03 10:00:00",
            "ended_at": "2026-08-03 10:10:00",
            "attempts": 22,
            "average_ms": 520,
            "best_ms": 400,
            "consistency_ms": 40,
            "stroop_attempts": 10,
            "accuracy_percent": 85,
            "game_counts": {"reaction": 12, "stroop": 10},
        },
        {
            "session_id": 4,
            "started_at": "2026-08-04 10:00:00",
            "ended_at": "2026-08-04 10:10:00",
            "attempts": 16,
            "average_ms": 500,
            "best_ms": 390,
            "consistency_ms": 35,
            "stroop_attempts": 8,
            "accuracy_percent": 88,
            "game_counts": {"reaction": 8, "stroop": 8},
        },
        {
            "session_id": 5,
            "started_at": "2026-08-05 10:00:00",
            "ended_at": "2026-08-05 10:10:00",
            "attempts": 19,
            "average_ms": 230,
            "best_ms": 175,
            "consistency_ms": 95,
            "stroop_attempts": 9,
            "accuracy_percent": 65,
            "game_counts": {"reaction": 10, "stroop": 9},
        },
        {
            "session_id": 6,
            "started_at": "2026-08-06 10:00:00",
            "ended_at": "2026-08-06 10:10:00",
            "attempts": 21,
            "average_ms": 510,
            "best_ms": 410,
            "consistency_ms": 45,
            "stroop_attempts": 10,
            "accuracy_percent": 80,
            "game_counts": {"reaction": 11, "stroop": 10},
        },
    ]

    result = cluster_sessions(sessions, n_clusters=3)

    assert result["scaled"] is True
    assert result["n_clusters"] == 3
    assert len(result["groups"]) == 3
    assert all(group["label"] for group in result["groups"])
    assert all("cluster_id" in session and "label" in session for session in result["sessions"])
    assert set(result["features_used"]) == {
        "average_ms",
        "best_ms",
        "consistency_ms",
        "attempts",
        "accuracy_percent",
    }
