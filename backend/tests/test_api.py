from fastapi.testclient import TestClient
import main


def test_health(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test_scores.db")
    main.init_db()

    with TestClient(main.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_save_and_list_scores(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test_scores.db")
    main.init_db()

    with TestClient(main.app) as client:
        created = client.post(
            "/scores",
            json={"ms": 250, "game": "reaction"},
        )
        assert created.status_code == 200
        body = created.json()
        assert body["ms"] == 250
        assert body["game"] == "reaction"
        assert body["created_at"]

        listed = client.get("/scores", params={"game": "reaction"})
        assert listed.status_code == 200
        scores = listed.json()
        assert len(scores) == 1
        assert scores[0]["ms"] == 250


def test_stats_per_game(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test_scores.db")
    main.init_db()

    with TestClient(main.app) as client:
        client.post("/scores", json={"ms": 200, "game": "reaction"})
        client.post("/scores", json={"ms": 300, "game": "reaction"})
        client.post(
            "/scores",
            json={"ms": 900, "game": "stroop", "correct": True},
        )

        response = client.get("/stats")
        assert response.status_code == 200
        stats = {item["game"]: item for item in response.json()}

        assert stats["reaction"]["attempts"] == 2
        assert stats["reaction"]["best_ms"] == 200
        assert stats["reaction"]["average_ms"] == 250.0
        assert stats["stroop"]["attempts"] == 1
        assert stats["stroop"]["best_ms"] == 900
