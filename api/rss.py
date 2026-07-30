"""RSS/Atom feed fetching and parsing.

Owner: web/src/features/rss/ + serve.py /api/rss/* routes
"""

from __future__ import annotations

from dataclasses import dataclass
import ipaddress
import re
import socket
from datetime import timezone
from html import unescape
from typing import Any
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET

import requests
from email.utils import parsedate_to_datetime

from .utils import compact_text, html_to_text, isoformat

RSS_FETCH_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
)
RSS_FEED_MAX_BYTES = 1_000_000
RSS_ARTICLE_MAX_BYTES = 1_000_000
RSS_ARTICLE_TEXT_LIMIT = 12000
SAFE_FETCH_MAX_REDIRECTS = 4


@dataclass(frozen=True)
class SafeFetchResult:
    url: str
    content_type: str
    encoding: str
    body: bytes


# ---------------------------------------------------------------------------
# XML helpers
# ---------------------------------------------------------------------------

def xml_local_name(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def xml_find_child(node: ET.Element | None, *names: str) -> ET.Element | None:
    if node is None:
        return None
    wanted = {name.lower() for name in names}
    for child in list(node):
        if xml_local_name(child.tag).lower() in wanted:
            return child
    return None


def xml_child_text(node: ET.Element | None, *names: str) -> str:
    if node is None:
        return ""
    wanted = {name.lower() for name in names}
    for child in list(node):
        if xml_local_name(child.tag).lower() not in wanted:
            continue
        text = "".join(child.itertext()).strip()
        if text:
            return unescape(text)
    return ""


def xml_entry_link(node: ET.Element | None) -> str:
    if node is None:
        return ""
    for child in list(node):
        if xml_local_name(child.tag).lower() != "link":
            continue
        href = str(child.attrib.get("href") or "").strip()
        rel = str(child.attrib.get("rel") or "alternate").strip().lower()
        if href and rel in {"", "alternate"}:
            return href
        text = "".join(child.itertext()).strip()
        if text:
            return text
    return ""


# ---------------------------------------------------------------------------
# Text / article helpers
# ---------------------------------------------------------------------------

def extract_html_title(value: str | None) -> str:
    match = re.search(r"(?is)<title[^>]*>(.*?)</title>", str(value or ""))
    return compact_text(match.group(1), 180) if match else ""


def extract_readable_article_text(html_text: str) -> str:
    try:
        import trafilatura  # type: ignore[import-untyped]
        result = trafilatura.extract(html_text, include_links=False, include_tables=False, no_fallback=False)
        if result and len(result.strip()) > 100:
            return result[:16000].rstrip() + ("..." if len(result) > 16000 else "")
    except Exception:
        pass
    cleaned = re.sub(r"(?is)<(script|style|noscript|svg|iframe|form).*?>.*?</\1>", " ", html_text)
    cleaned = re.sub(r"(?is)<(nav|header|footer|aside)[^>]*>.*?</\1>", " ", cleaned)
    candidates: list[str] = []
    for tag in ("article", "main"):
        candidates.extend(re.findall(rf"(?is)<{tag}\b[^>]*>(.*?)</{tag}>", cleaned))
    body_match = re.search(r"(?is)<body\b[^>]*>(.*?)</body>", cleaned)
    if body_match:
        candidates.append(body_match.group(1))
    candidates.append(cleaned)
    best = ""
    for candidate in candidates:
        text = html_to_text(candidate, limit=20000)
        if len(text) > len(best):
            best = text
    return best[:16000].rstrip() + ("..." if len(best) > 16000 else "")


def parse_feed_datetime(value: str | None) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    clean = value.strip()
    try:
        parsed = parsedate_to_datetime(clean)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return isoformat(parsed.astimezone(timezone.utc).timestamp())
    except (TypeError, ValueError, IndexError, OverflowError):
        pass
    try:
        from datetime import datetime
        parsed = datetime.fromisoformat(clean.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return isoformat(parsed.astimezone(timezone.utc).timestamp())
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# URL safety
# ---------------------------------------------------------------------------

def _is_safe_public_ip(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
    )


def _resolve_public_addresses(host: str) -> tuple[str, ...]:
    try:
        results = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host '{host}'.") from exc

    addresses: set[str] = set()
    for _family, _socktype, _proto, _canonname, sockaddr in results:
        raw_ip = str(sockaddr[0] or "").split("%", 1)[0].strip()
        if not raw_ip:
            continue
        try:
            address = ipaddress.ip_address(raw_ip)
        except ValueError as exc:
            raise ValueError(f"Host '{host}' resolved to an invalid IP address.") from exc
        if not _is_safe_public_ip(address):
            raise ValueError("URL resolves to a private or reserved IP address.")
        addresses.add(address.compressed)

    if not addresses:
        raise ValueError(f"Could not resolve host '{host}'.")

    return tuple(sorted(addresses))


def _validate_safe_url(url: str) -> None:
    """Raise ValueError if the URL points to a non-public host or resolves internally."""
    parsed = urlparse(str(url or "").strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http and https URLs are allowed.")
    if not parsed.hostname:
        raise ValueError("Invalid URL: missing hostname.")
    if parsed.username or parsed.password:
        raise ValueError("URLs with embedded credentials are not allowed.")
    _resolve_public_addresses(parsed.hostname)


def _open_safe_response(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20,
    label: str = "resource",
) -> requests.Response:
    current_url = str(url or "").strip()
    for redirect_count in range(SAFE_FETCH_MAX_REDIRECTS + 1):
        _validate_safe_url(current_url)
        try:
            response = requests.get(
                current_url,
                headers=headers or {},
                timeout=timeout,
                stream=True,
                allow_redirects=False,
            )
        except requests.RequestException as exc:
            raise RuntimeError(f"The {label} could not be reached.") from exc

        if response.is_redirect or response.is_permanent_redirect:
            location = str(response.headers.get("location") or "").strip()
            response.close()
            if not location:
                raise RuntimeError(f"The {label} redirected without a target.")
            if redirect_count >= SAFE_FETCH_MAX_REDIRECTS:
                raise RuntimeError(f"The {label} redirected too many times.")
            current_url = urljoin(current_url, location)
            continue

        return response

    raise RuntimeError(f"The {label} redirected too many times.")


def fetch_safe_url_bytes(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 20,
    max_bytes: int,
    label: str = "resource",
    truncate: bool = False,
) -> SafeFetchResult:
    response = _open_safe_response(url, headers=headers, timeout=timeout, label=label)
    if response.status_code >= 400:
        response.close()
        raise RuntimeError(f"The {label} request failed with status {response.status_code}.")

    content_length_header = str(response.headers.get("content-length") or "").strip()
    if content_length_header:
        try:
            if int(content_length_header) > max_bytes and not truncate:
                response.close()
                raise RuntimeError(f"The {label} payload was too large.")
        except ValueError:
            pass

    payload = bytearray()
    try:
        for chunk in response.iter_content(chunk_size=65536):
            if not chunk:
                continue
            remaining = max_bytes - len(payload)
            if remaining <= 0:
                if truncate:
                    break
                raise RuntimeError(f"The {label} payload was too large.")
            if len(chunk) > remaining:
                if truncate:
                    payload.extend(chunk[:remaining])
                    break
                raise RuntimeError(f"The {label} payload was too large.")
            payload.extend(chunk)
    except requests.RequestException as exc:
        raise RuntimeError(f"The {label} could not be read.") from exc
    finally:
        response.close()

    return SafeFetchResult(
        url=str(response.url or url).strip(),
        content_type=str(response.headers.get("content-type") or "").lower(),
        encoding=str(response.encoding or "utf-8").strip() or "utf-8",
        body=bytes(payload),
    )


def _safe_feed_url(url: str | None) -> str:
    """Return the URL only if it uses http or https; otherwise return empty string."""
    if url and urlparse(url).scheme in {"http", "https"}:
        return url
    return ""


# ---------------------------------------------------------------------------
# Feed parsing
# ---------------------------------------------------------------------------

def parse_rss_feed(xml_text: str | bytes, source_url: str) -> dict[str, Any]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise RuntimeError("The feed returned invalid XML.") from exc

    root_name = xml_local_name(root.tag).lower()
    payload: dict[str, Any] = {
        "status": "Feed loaded",
        "feedUrl": source_url,
        "siteUrl": "",
        "title": "",
        "description": "",
        "refreshedAt": isoformat(),
        "items": [],
    }

    if root_name == "rss":
        channel = xml_find_child(root, "channel")
        payload["title"] = xml_child_text(channel, "title")
        payload["description"] = compact_text(xml_child_text(channel, "description"), 240)
        payload["siteUrl"] = xml_child_text(channel, "link")
        items = [child for child in list(channel or []) if xml_local_name(child.tag).lower() == "item"]
        for item in items[:25]:
            payload["items"].append({
                "title": xml_child_text(item, "title") or "Untitled article",
                "url": _safe_feed_url(xml_child_text(item, "link")),
                "summary": compact_text(xml_child_text(item, "description", "summary", "encoded"), 280),
                "publishedAt": parse_feed_datetime(xml_child_text(item, "pubDate", "published", "updated")),
                "sourceName": payload["title"],
                "commentsUrl": _safe_feed_url(xml_child_text(item, "comments")),
            })
        return payload

    if root_name == "feed":
        payload["title"] = xml_child_text(root, "title")
        payload["description"] = compact_text(xml_child_text(root, "subtitle"), 240)
        payload["siteUrl"] = xml_entry_link(root)
        entries = [child for child in list(root) if xml_local_name(child.tag).lower() == "entry"]
        for entry in entries[:25]:
            payload["items"].append({
                "title": xml_child_text(entry, "title") or "Untitled article",
                "url": _safe_feed_url(xml_entry_link(entry)),
                "summary": compact_text(xml_child_text(entry, "summary", "content"), 280),
                "publishedAt": parse_feed_datetime(xml_child_text(entry, "published", "updated")),
                "sourceName": payload["title"],
                "commentsUrl": _safe_feed_url(xml_child_text(entry, "comments")),
            })
        return payload

    raise RuntimeError("This URL did not return an RSS or Atom feed.")


def fetch_rss_feed(url: str) -> dict[str, Any]:
    parsed = urlparse(str(url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Enter a valid http or https feed URL.")
    fetched = fetch_safe_url_bytes(
        url,
        headers={
            "User-Agent": RSS_FETCH_USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
        timeout=20,
        max_bytes=RSS_FEED_MAX_BYTES,
        label="feed",
    )
    return parse_rss_feed(fetched.body, fetched.url)


def fetch_rss_article(url: str, mode: str = "reader") -> dict[str, Any]:
    parsed = urlparse(str(url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Enter a valid http or https article URL.")
    normalized_mode = str(mode or "reader").strip().lower()
    fetched = fetch_safe_url_bytes(
        url,
        headers={
            "User-Agent": RSS_FETCH_USER_AGENT,
            "Accept": "text/html, application/xhtml+xml, text/plain;q=0.9, */*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
        timeout=20,
        max_bytes=RSS_ARTICLE_MAX_BYTES,
        label="article",
        truncate=True,
    )
    raw_text = fetched.body.decode(fetched.encoding, errors="replace")
    if normalized_mode == "raw":
        article_text = html_to_text(raw_text, limit=RSS_ARTICLE_TEXT_LIMIT)
    else:
        article_text = (
            html_to_text(raw_text, limit=RSS_ARTICLE_TEXT_LIMIT)
            if "text/plain" in fetched.content_type
            else extract_readable_article_text(raw_text)
        )
    if not article_text:
        raise RuntimeError("The article did not contain readable text.")
    return {
        "status": "Raw text loaded" if normalized_mode == "raw" else "Article loaded",
        "url": fetched.url,
        "siteName": urlparse(fetched.url).hostname or parsed.hostname or "",
        "title": extract_html_title(raw_text),
        "text": article_text,
        "mode": "raw" if normalized_mode == "raw" else "reader",
        "fetchedAt": isoformat(),
    }
