"""Server-side text heuristics for headlines, claims and articles."""
from __future__ import annotations

import re
from typing import Any

from .scoring import clamp, score_signals, signal
from .url_forensics import analyze_url

CLICKBAIT = (
    "you won't believe", "shocking", "breaking", "urgent", "they don't want you to know",
    "secret", "exposed", "leaked", "100%", "guaranteed", "miracle", "banned",
    "what happens next", "nobody is talking about", "must see", "act now", "before it's too late",
)
EMOTIONAL = ("outrageous", "terrifying", "amazing", "disgusting", "evil", "corrupt", "traitor", "hero", "catastrophe", "scam", "war", "collapse", "shocking", "secret")
ABSOLUTES = ("always", "never", "everyone", "nobody", "all of", "proven", "definitely", "completely", "totally")
SOURCE = re.compile(r"\b(according to|said|reported by|study|research|published|source|official|data from|survey|statement|document)", re.I)


def analyze_text(text: str, article_url: str | None = None) -> dict[str, Any]:
    clean = text.strip()
    words = clean.split()
    sentences = [s for s in re.split(r"[.!?]+", clean) if len(s.strip()) > 3]
    long_words = [w for w in words if re.search(r"[A-Za-z]{3,}", w)]
    caps = sum(1 for w in long_words if w == w.upper())
    upper_ratio = round(caps / len(long_words) * 100) if long_words else 0
    bangs = clean.count("!")
    questions = clean.count("?")
    sources = len(SOURCE.findall(clean))
    low = clean.lower()
    signals: list[dict] = []

    if len(words) < 12:
        signals.append(signal("Very short text", f"Only {len(words)} words were supplied.", "medium", "negative"))
    else:
        signals.append(signal("Enough text to inspect", f"{len(words)} words across {len(sentences)} sentence(s).", "low", "positive"))
    bait = [p for p in CLICKBAIT if p in low]
    if bait:
        signals.append(signal("Clickbait / urgency wording", f"Found: {', '.join(bait[:4])}.", "high", "negative"))
    if upper_ratio >= 30 and len(long_words) >= 5:
        signals.append(signal("Excessive capital letters", f"{upper_ratio}% of words are in ALL CAPS.", "medium", "negative"))
    if bangs >= 3:
        signals.append(signal("Excessive punctuation", f"{bangs} exclamation marks in {len(words)} words.", "medium" if bangs >= 4 else "low", "negative"))
    emotional = [w for w in EMOTIONAL if w in low]
    if len(emotional) >= 2:
        signals.append(signal("Emotionally charged language", f"Found: {', '.join(emotional[:4])}.", "medium", "negative"))
    absolutes = [w for w in ABSOLUTES if w in low]
    if len(absolutes) >= 2:
        signals.append(signal("Absolute claims", f"Found: {', '.join(absolutes[:4])}.", "low", "negative"))
    if len(words) >= 25 and sources == 0:
        signals.append(signal("No source or attribution", "No attribution phrase was found in a text of this length.", "medium", "negative"))
    elif sources:
        signals.append(signal("Source language present", f"{sources} attribution phrase(s) found.", "low", "positive"))
    if re.search(r"\b\d+(\.\d+)?\s*(%|percent|million|billion|people|cases|dead)\b", clean, re.I) and sources == 0:
        signals.append(signal("Unsourced numeric claim", "Specific figures appear without attribution.", "low", "negative"))
    if len(words) > 25:
        freq: dict[str, int] = {}
        for w in words:
            k = re.sub(r"[^a-z0-9]", "", w.lower())
            if len(k) > 3:
                freq[k] = freq.get(k, 0) + 1
        if freq:
            word, n = max(freq.items(), key=lambda kv: kv[1])
            if n >= 5:
                signals.append(signal("Heavy repetition", f'"{word}" appears {n} times.', "low", "negative"))
    if questions >= 2 and len(words) < 40:
        signals.append(signal("Rhetorical question headline", "Multiple question marks in a short text.", "low", "negative"))

    link_findings: list[dict] = []
    if article_url and article_url.strip():
        raw = article_url.strip()
        normalized = raw if re.match(r"^[a-z][a-z0-9+.-]*://", raw, re.I) else f"https://{raw}"
        try:
            result = analyze_url(raw, normalized)
            link_findings = result["warnings"]
            signals.append(signal("Article link checked", f"{len(link_findings)} URL-level observations recorded.", "low", "neutral"))
        except Exception:
            signals.append(signal("Article link could not be parsed", "The link was not analysed.", "low", "negative"))

    score = int(round(clamp(score_signals(signals, 82), 6, 96)))
    verdict = "likely_reliable" if score >= 70 else "mixed" if score >= 45 else "high_risk"
    summary = "\n".join([
        f"{len(words)} words and {len(sentences)} sentence(s) analysed; {len(signals)} signals measured.",
        *[f"• {s['label']}: {s['description']}" for s in signals],
    ])
    return {
        "credibilityScore": score,
        "verdict": verdict,
        "signals": [{"label": s["label"], "description": s["description"], "severity": s["severity"]} for s in signals],
        "stats": {
            "words": len(words),
            "sentences": len(sentences),
            "uppercaseRatio": upper_ratio,
            "exclamations": bangs,
            "questions": questions,
            "sourceMentions": sources,
        },
        "summary": summary,
        "linkFindings": link_findings,
    }
