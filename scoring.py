"""Deterministic scoring shared by every analyzer."""
from __future__ import annotations

from typing import Literal

Impact = Literal["positive", "negative", "neutral"]
Severity = Literal["low", "medium", "high"]


def clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def score_signals(signals: list[dict], base: int = 72) -> int:
    score = float(base)
    for s in signals:
        weight = 26 if s["severity"] == "high" else 11 if s["severity"] == "medium" else 4
        score += -weight if s["impact"] == "negative" else weight if s["impact"] == "positive" else 0
    return int(round(clamp(score, 6, 96)))


def signal(label: str, description: str, severity: Severity, impact: Impact) -> dict:
    return {"label": label, "description": description, "severity": severity, "impact": impact}


def confidence_for(count: int, cap: int = 86) -> int:
    return int(round(clamp(56 + count * 5, 50, cap)))


def uncertainty_for(confidence: int) -> int:
    return int(round(clamp(112 - confidence, 30, 90)))
