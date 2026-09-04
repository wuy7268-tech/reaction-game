"""Cluster play sessions with k-means and attach readable labels."""

from __future__ import annotations

from statistics import median

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from sessions import SESSION_GAP_MINUTES, build_session_summaries

FEATURE_KEYS = (
    "average_ms",
    "best_ms",
    "consistency_ms",
    "attempts",
    "accuracy_percent",
)

DEFAULT_K = 3


def _fill_features(session: dict) -> list[float]:
    """Turn a session summary into a numeric feature vector."""
    consistency = session.get("consistency_ms")
    if consistency is None:
        consistency = 0.0

    accuracy = session.get("accuracy_percent")
    if accuracy is None:
        # No Stroop rounds in this sitting — treat as neutral mid accuracy.
        accuracy = 50.0

    return [
        float(session["average_ms"]),
        float(session["best_ms"]),
        float(consistency),
        float(session["attempts"]),
        float(accuracy),
    ]


def _choose_k(n_sessions: int, requested_k: int = DEFAULT_K) -> int:
    if n_sessions < 2:
        return 0
    return max(1, min(requested_k, n_sessions))


def _medians(feature_matrix: np.ndarray) -> dict[str, float]:
    return {
        key: float(median(feature_matrix[:, index]))
        for index, key in enumerate(FEATURE_KEYS)
    }


def label_from_centroid(centroid: dict[str, float], centers: dict[str, float]) -> str:
    """
    Build a short human-readable label by comparing this cluster
    to the median session profile.
    """
    fast = centroid["average_ms"] < centers["average_ms"]
    consistent = centroid["consistency_ms"] < centers["consistency_ms"]
    accurate = centroid["accuracy_percent"] >= centers["accuracy_percent"]

    if fast and consistent and accurate:
        return "fast, steady, and accurate"
    if fast and consistent:
        return "fast and consistent"
    if fast and not consistent:
        return "fast but inconsistent"
    if not fast and consistent and accurate:
        return "careful and accurate"
    if not fast and consistent:
        return "slow but steady"
    if accurate:
        return "accurate but slower"
    return "slower and uneven"


def cluster_sessions(
    sessions: list[dict],
    n_clusters: int = DEFAULT_K,
) -> dict:
    """
    Scale session features, run k-means, and return labeled groups.
    """
    if not sessions:
        return {
            "n_clusters": 0,
            "features_used": list(FEATURE_KEYS),
            "groups": [],
            "sessions": [],
        }

    matrix = np.array([_fill_features(session) for session in sessions], dtype=float)
    k = _choose_k(len(sessions), n_clusters)
    if k == 0:
        # Not enough sittings to cluster. Still attach required label fields so
        # the /insights response validates (otherwise FastAPI returns 500 and
        # the browser can surface it as "couldn't reach the server").
        return {
            "n_clusters": 0,
            "features_used": list(FEATURE_KEYS),
            "scaled": True,
            "groups": [],
            "sessions": [
                {
                    **session,
                    "cluster_id": 0,
                    "label": "needs more sittings",
                }
                for session in sessions
            ],
        }

    scaler = StandardScaler()
    scaled = scaler.fit_transform(matrix)

    model = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = model.fit_predict(scaled)

    # Centroids back in original units for readable labeling.
    raw_centers = scaler.inverse_transform(model.cluster_centers_)
    center_medians = _medians(matrix)

    groups = []
    for cluster_id in range(k):
        centroid = {
            key: round(float(raw_centers[cluster_id][index]), 1)
            for index, key in enumerate(FEATURE_KEYS)
        }
        member_indexes = [i for i, label in enumerate(labels) if label == cluster_id]
        groups.append(
            {
                "cluster_id": cluster_id,
                "label": label_from_centroid(centroid, center_medians),
                "size": len(member_indexes),
                "centroid": centroid,
                "session_ids": [
                    sessions[index]["session_id"] for index in member_indexes
                ],
            }
        )

    # Stable order: largest groups first, then by cluster id.
    groups.sort(key=lambda group: (-group["size"], group["cluster_id"]))

    labeled_sessions = []
    label_by_cluster = {group["cluster_id"]: group["label"] for group in groups}
    for index, session in enumerate(sessions):
        cluster_id = int(labels[index])
        labeled_sessions.append(
            {
                **session,
                "cluster_id": cluster_id,
                "label": label_by_cluster[cluster_id],
            }
        )

    return {
        "n_clusters": k,
        "features_used": list(FEATURE_KEYS),
        "scaled": True,
        "groups": groups,
        "sessions": labeled_sessions,
    }


def build_insights(
    scores: list[dict],
    gap_minutes: int = SESSION_GAP_MINUTES,
    n_clusters: int = DEFAULT_K,
) -> dict:
    sessions = build_session_summaries(scores, gap_minutes=gap_minutes)
    return cluster_sessions(sessions, n_clusters=n_clusters)
