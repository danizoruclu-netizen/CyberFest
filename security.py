"""Upload and network safety guards."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile

MAX_IMAGE = 20 * 1024 * 1024
MAX_VIDEO = 500 * 1024 * 1024

MAGIC = {
    "image": [
        (b"\xff\xd8\xff", "jpeg"),
        (b"\x89PNG\r\n\x1a\n", "png"),
        (b"RIFF", "webp"),
    ],
    "video": [
        (b"\x00\x00\x00\x18ftypmp42", "mp4"),
        (b"\x00\x00\x00\x1cftypisom", "mp4"),
        (b"\x00\x00\x00\x14ftyp", "mp4"),
        (b"\x00\x00\x00\x0cftyp", "mov"),
    ],
}


def sniff_format(head: bytes, kind: str) -> str | None:
    for magic, name in MAGIC[kind]:
        if head.startswith(magic):
            if name == "webp" and head[8:12] == b"WEBP":
                return "webp"
            if name == "webp":
                continue
            return name
    if kind == "video" and head[4:8] == b"ftyp":
        return "mp4"
    return None


async def read_upload(file: UploadFile, kind: str, max_bytes: int) -> tuple[bytes, str]:
    head = await file.read(64)
    await file.seek(0)
    fmt = sniff_format(head, kind)
    if fmt is None:
        raise HTTPException(415, f"The uploaded file is not a recognised {kind} (magic-byte check failed).")
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"File exceeds the {max_bytes // (1024 * 1024)} MB limit.")
    if not data:
        raise HTTPException(400, "The file is empty.")
    return data, fmt


def is_public_host(host: str) -> bool:
    """DNS-resolve and reject private, loopback, link-local or reserved targets (SSRF guard)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    if not infos:
        return False
    for info in infos:
        addr = ipaddress.ip_address(info[4][0])
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved or addr.is_multicast:
            return False
        if isinstance(addr, ipaddress.IPv6Address) and (addr.is_site_local or addr.ipv4_mapped and addr.ipv4_mapped.is_private):
            return False
    return True


def safe_url(url: str) -> str:
    """Validate the URL *shape* only. Network access is guarded at connect time
    in url_forensics._network via is_public_host, so structural checks still work
    on an offline machine."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Only http:// and https:// addresses are accepted.")
    if not (parsed.hostname or "").strip():
        raise HTTPException(400, "A hostname is required.")
    return url
