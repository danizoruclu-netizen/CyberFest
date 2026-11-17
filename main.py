"""TruthGuard API — backend fully compatible with the frontend contract."""
from __future__ import annotations

import os
import time
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import image_forensics, text_forensics, url_forensics, video_forensics
from .security import MAX_IMAGE, MAX_VIDEO, read_upload, safe_url

APP_TITLE = "TruthGuard Analysis API"
VERSION = "1.0.0"

app = FastAPI(title=APP_TITLE, version=VERSION)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

RATE: dict[str, list[float]] = {}
RATE_LIMIT = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    hits = [t for t in RATE.get(ip, []) if now - t < 60]
    if len(hits) >= RATE_LIMIT:
        raise HTTPException(429, "Too many requests. Please try again shortly.")
    hits.append(now)
    RATE[ip] = hits
    return await call_next(request)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": APP_TITLE, "version": VERSION, "analyzers": ["image", "video", "url", "text"]}


@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)) -> dict[str, Any]:
    data, fmt = await read_upload(file, "image", MAX_IMAGE)
    return image_forensics.analyze_image(data, file.filename or "image", fmt)


@app.post("/analyze/video")
async def analyze_video(
    file: UploadFile = File(...),
    type: str = Form("video"),
    mode: str = Form("frames"),
) -> dict[str, Any]:
    data, _ = await read_upload(file, "video", MAX_VIDEO)
    return video_forensics.analyze_video(data, file.filename or "video")


class UrlRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)


@app.post("/analyze/url")
def analyze_url(body: UrlRequest) -> dict[str, Any]:
    raw = body.url.strip()
    normalized = raw if raw.lower().startswith(("http://", "https://")) else f"https://{raw}"
    return url_forensics.analyze_url(raw, safe_url(normalized))


class TextRequest(BaseModel):
    text: str = Field("", max_length=100000)
    url: str | None = Field(None, max_length=2048)


@app.post("/analyze/text")
def analyze_text(body: TextRequest) -> dict[str, Any]:
    if not body.text.strip() and not (body.url or "").strip():
        raise HTTPException(400, "Provide text, a URL, or both.")
    safe = safe_url(body.url) if (body.url or "").strip() else None
    return text_forensics.analyze_text(body.text, safe)
