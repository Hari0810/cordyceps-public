"""Shared low-level utilities used across api/ modules and serve.py."""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from email.header import decode_header, make_header
from html import unescape
from typing import Any


def utc_now() -> float:
    return time.time()


def isoformat(timestamp: float | None = None) -> str:
    if timestamp is None:
        timestamp = utc_now()
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso8601(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
    except ValueError:
        return None


def parse_hhmm(value: str | None) -> tuple[int, int] | None:
    if not isinstance(value, str):
        return None
    try:
        hour_text, minute_text = value.strip().split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
    except (ValueError, AttributeError):
        return None
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return hour, minute


def compact_text(value: str | None, limit: int = 280) -> str:
    text = unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def decode_mime_header(value: str | None) -> str:
    clean = str(value or "").strip()
    if not clean:
        return ""
    try:
        return str(make_header(decode_header(clean))).strip()
    except (ValueError, TypeError):
        return clean


def html_to_text(value: str | None, limit: int = 12000) -> str:
    text = unescape(str(value or ""))
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p\s*>", "\n\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "..."
