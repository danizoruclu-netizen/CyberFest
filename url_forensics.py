"""Server-side URL checks: structural heuristics + optional safe network lookups."""
from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from .scoring import clamp, score_signals, signal

BRANDS = (
    "google", "facebook", "instagram", "microsoft", "apple", "paypal", "amazon", "netflix",
    "whatsapp", "telegram", "twitter", "linkedin", "ebay", "icloud", "github", "youtube",
    "discord", "spotify", "binance", "coinbase", "dropbox", "adobe", "bank", "gov",
)
ABUSED = {"tk", "ml", "ga", "cf", "gq", "top", "xyz", "click", "loan", "work", "bid", "stream", "download"}
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "buff.ly", "cutt.ly", "rebrand.ly"}


def _distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _network(url: str, host: str) -> tuple[list[str], int | None, str | None]:
    redirects: list[str] = []
    age: int | None = None
    registrar: str | None = None
    opener = urllib.request.build_opener(NoRedirect)
    current = url
    try:
        for _ in range(5):
            req = urllib.request.Request(current, method="GET", headers={"User-Agent": "TruthGuardBot/1.0"})
            with opener.open(req, timeout=4) as res:
                location = res.headers.get("Location")
                if not location:
                    break
                nxt = urllib.parse.urljoin(current, location)
                nhost = (urlparse(nxt).hostname or "").lower()
                from .security import is_public_host
                if not is_public_host(nhost):
                    break
                redirects.append(nxt)
                current = nxt
    except Exception:
        pass

    try:
        req = urllib.request.Request(f"https://rdap.org/domain/{host}", headers={"Accept": "application/rdap+json", "User-Agent": "TruthGuardBot/1.0"})
        with urllib.request.urlopen(req, timeout=4) as res:
            body = json.loads(res.read().decode("utf-8", "ignore"))
        for event in body.get("events", []):
            if event.get("eventAction") == "registration":
                date = datetime.fromisoformat(event["eventDate"].replace("Z", "+00:00"))
                age = max(0, (datetime.now(timezone.utc) - date).days)
                break
        for entity in body.get("entities", []):
            roles = entity.get("roles", [])
            if "registrar" in roles and entity.get("vcardArray"):
                for item in entity["vcardArray"][1]:
                    if item[0] == "fn" and item[3]:
                        registrar = str(item[3])
                        break
            if registrar:
                break
    except urllib.error.HTTPError as e:
        e.close()
    except Exception:
        pass
    return redirects, age, registrar


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def analyze_url(raw: str, normalized: str) -> dict[str, Any]:
    parsed = urlparse(normalized)
    host = parsed.hostname.lower()
    labels = host.replace("www.", "").split(".")
    label = labels[-2] if len(labels) > 1 else labels[0]
    tld = labels[-1] if labels else ""
    low = normalized.lower()
    signals: list[dict] = []

    if any(ord(c) > 127 for c in raw) or host.startswith("xn--"):
        signals.append(signal("Internationalised / encoded domain", "The domain contains non-Latin or punycode characters. Lookalike domains can use Cyrillic or Greek letters.", "high", "negative"))
    if parsed.username or parsed.password or "@" in raw:
        signals.append(signal("Credentials in URL", "The part before @ is only user info and can hide the real destination.", "high", "negative"))
    import re
    if re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host):
        signals.append(signal("Bare IP address", "The link points directly to an IP address instead of a named domain.", "high", "negative"))

    parts = [p for p in label.split("-") if p]
    lookalike = next((brand for brand in BRANDS for p in parts if p != brand and _distance(p, brand) <= (2 if len(brand) > 6 else 1)), None)
    if lookalike:
        signals.append(signal(f"Possible lookalike of {lookalike}", f'"{label}" contains a part very close to "{lookalike}" but not identical.', "high", "negative"))
    elif any(f"{b}-" in host or f"-{b}" in host for b in BRANDS):
        signals.append(signal("Brand name combined with extra words", "Well-known brand names next to hyphens are often used to imitate official sites.", "medium", "negative"))

    if parsed.scheme == "http":
        signals.append(signal("Unencrypted connection", "The link uses HTTP, not HTTPS.", "medium", "negative"))
    else:
        signals.append(signal("HTTPS connection", "The link uses HTTPS.", "low", "positive"))
    if parsed.port and str(parsed.port) not in ("80", "443"):
        signals.append(signal("Unusual port", f"The URL uses port {parsed.port}.", "medium", "negative"))
    if host in SHORTENERS:
        signals.append(signal("URL shortener", "Short links hide the final destination.", "medium", "negative"))
    if tld in ABUSED:
        signals.append(signal("Frequently abused top-level domain", f".{tld} domains are cheap and often used for short-lived phishing sites.", "medium", "negative"))
    if re.search(r"(login|verify|secure|account|update|confirm|password|signin|billing|claim|urgent|limited)", low):
        signals.append(signal("Credential or urgency wording", "Words like login, verify, secure or urgent are common in phishing links.", "medium", "negative"))
    if host.count("-") >= 2:
        signals.append(signal("Many hyphens in domain", "Hyphen-heavy domains are often used to mimic a trusted brand.", "low", "negative"))
    if any(c.isdigit() for c in label):
        signals.append(signal("Digits in domain name", "Numbers replacing letters are a common typosquatting trick.", "low", "negative"))
    if len(normalized) > 120:
        signals.append(signal("Long URL", f"This address is {len(normalized)} characters long.", "low", "negative"))
    if "%2f" in low or "//" in low[8:]:
        signals.append(signal("Obfuscated path", "Encoded slashes or doubled slashes can confuse link parsers.", "low", "negative"))

    redirects, age, registrar = _network(normalized, host)
    if redirects:
        signals.append(signal("Redirect chain observed", f"{len(redirects)} redirect(s) were followed before reaching the final page.", "medium", "negative"))
    if age is not None:
        signals.append(signal("Domain age measured", f"Registered {age} days ago (RDAP).", "low", "positive" if age > 365 else "negative"))

    score = int(round(clamp(score_signals(signals, 88), 8, 96)))
    risk = "low" if score >= 70 else "medium" if score >= 40 else "high"
    summary = "\n".join([
        f"{len(signals)} URL properties measured. {sum(1 for s in signals if s['severity'] != 'low' and s['impact'] == 'negative')} raised more than a low-level concern.",
        *[f"• {s['label']}: {s['description']}" for s in signals],
    ])
    return {
        "trustScore": score,
        "risk": risk,
        "phishingIndicators": [{"label": s["label"], "description": s["description"], "severity": s["severity"]} for s in signals if s["impact"] == "negative" and s["severity"] != "low"],
        "warnings": [{"label": s["label"], "description": s["description"], "severity": s["severity"]} for s in signals],
        "domain": {
            "name": host,
            "registrar": registrar,
            "ageDays": age,
            "country": tld.upper() if len(tld) == 2 else None,
            "https": parsed.scheme == "https",
        },
        "redirects": redirects,
        "summary": summary,
    }
