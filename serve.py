from __future__ import annotations

import argparse
import concurrent.futures
import csv
import email
import functools
import hashlib
import imaplib
import ipaddress
import io
import json
import mimetypes
import os
import queue
import random
import re
import requests
import signal
import smtplib
import socket
import subprocess
import sys
import threading
import time
import traceback
import uuid
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import getaddresses, parseaddr, parsedate_to_datetime
from html import unescape
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import base64
import secrets
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Jsonb
    from psycopg_pool import ConnectionPool
except ModuleNotFoundError:
    psycopg = None
    dict_row = None
    Jsonb = None
    ConnectionPool = None
try:
    from pywebpush import WebPushException, webpush
except ModuleNotFoundError:
    WebPushException = Exception
    webpush = None


ROOT = Path(__file__).resolve().parent


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_local_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return

    try:
        lines = env_path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        clean_key = key.strip()
        if not clean_key or clean_key in os.environ:
            continue
        clean_value = value.strip()
        if len(clean_value) >= 2 and clean_value[0] == clean_value[-1] and clean_value[0] in {"'", '"'}:
            clean_value = clean_value[1:-1]
        os.environ[clean_key] = clean_value


load_local_env()

# Domain modules — imported after load_local_env() so env vars are available
from api.utils import utc_now, isoformat, parse_iso8601, parse_hhmm, compact_text, decode_mime_header, html_to_text  # noqa: E402
from api.rss import (  # noqa: E402
    parse_feed_datetime, xml_local_name, xml_find_child, xml_child_text, xml_entry_link,
    extract_html_title, extract_readable_article_text, _validate_safe_url, _safe_feed_url,
    parse_rss_feed, fetch_rss_feed, fetch_rss_article, fetch_safe_url_bytes,
)
from api.ics import (  # noqa: E402
    WINDOWS_TZID_FALLBACKS, get_timezone, local_date_key, resolve_ics_timezone,
    unfold_ics_lines, parse_ics_property, parse_ics_datetime, build_ics_event_payload,
    parse_ics_events, format_local_date, next_daily_occurrence,
)
from api.current_affairs import (  # noqa: E402
    fetch_current_affairs_graph,
    list_current_affairs_sources,
)

DEFAULT_WEB_DIR = ROOT / "web" / "dist"
WEB_DIR = DEFAULT_WEB_DIR if DEFAULT_WEB_DIR.exists() else ROOT
DATA_DIR = ROOT / "data"
STATE_FILE = DATA_DIR / "state.json"
USER_DATA_DIR = DATA_DIR / "users"
AUTH_USERS_FILE = DATA_DIR / "auth_users.json"
AUTH_SESSIONS_FILE = DATA_DIR / "auth_sessions.json"
VAPID_PRIVATE_KEY_FILE = DATA_DIR / "vapid_private_key.pem"
LOCAL_PUSH_STATE_FILE = DATA_DIR / "local_push_state.json"
LOCAL_PUSH_STATE_FILE_PREFIX = "local_push_state-"
LOCAL_BANKING_STATE_FILE_PREFIX = "local_banking_state-"
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
MIN_RANDOM_ALERT_SECONDS = 60 * 60
MAX_RANDOM_ALERT_SECONDS = 3 * 60 * 60
TEST_PUSH_INTERVAL_SECONDS = 10
EMAIL_RETRY_DELAY_SECONDS = 10 * 60
URGENT_ALERT_INTERVAL_SECONDS = 60 * 60
RSS_NEWS_DEFAULT_TIMES = ("08:00", "13:00", "18:00")
RSS_NEWS_SLOT_GRACE_SECONDS = 90 * 60
RSS_NEWS_MAX_FEEDS = 12
RSS_NEWS_RECENT_ITEM_LIMIT = 80
NOTIFICATION_SCHEDULER_MAX_REMINDERS = 256
NOTIFICATION_REMINDER_KINDS = {
    "urgent-summary",
    "urgent-task",
    "ritual-start",
    "reflection",
    "event-reminder",
    "event-final",
    "goal-reminder",
    "verbatim",
}
SCHEDULER_POLL_SECONDS = 1
DEV_RELOAD_POLL_SECONDS = 1
AUTH_FLOW_TTL_SECONDS = 5 * 60
SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
SESSION_TOUCH_SAVE_INTERVAL_SECONDS = 60
AUTH_SCHEMA_VERSION = 1
SESSION_COOKIE_NAME = "cordy_session"
APP_NAME = "Cordyceps"
CORDYCEPS_MODE = os.environ.get("CORDYCEPS_MODE", "local_pwa").strip().lower() or "local_pwa"
LOCAL_PWA_MODE = CORDYCEPS_MODE == "local_pwa"
CORDYCEPS_RELEASE = _env_flag("CORDYCEPS_RELEASE")
ALLOW_LEGACY_SERVER_STATE = _env_flag("CORDYCEPS_ALLOW_LEGACY_SERVER_STATE")
ENABLE_RSS_HELPER = True
ENABLE_OUTLOOK_HELPER = _env_flag("CORDYCEPS_ENABLE_OUTLOOK_HELPER")
ENABLE_BANKING_HELPER = _env_flag("CORDYCEPS_ENABLE_BANKING_HELPER")
LEGACY_PUBLIC_OAUTH_TOKEN_EXCHANGE_REQUESTED = _env_flag("CORDYCEPS_ENABLE_PUBLIC_OAUTH_TOKEN_EXCHANGE")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:todo@example.com")
DEFAULT_EMAIL_RECIPIENT = os.environ.get("DEFAULT_EMAIL_RECIPIENT", "").strip()
DEFAULT_EMAIL_TIMEZONE = "Europe/London"
DEFAULT_EMAIL_SEND_TIME = "18:00"
MONZO_API_BASE = "https://api.monzo.com"
MONZO_ACCOUNTS_URL = f"{MONZO_API_BASE}/accounts"
MONZO_TRANSACTIONS_URL = f"{MONZO_API_BASE}/transactions"
TRUELAYER_AUTH_URL = "https://auth.truelayer.com/"
TRUELAYER_TOKEN_URL = "https://auth.truelayer.com/connect/token"
TRUELAYER_DATA_API_BASE = "https://api.truelayer.com/data/v1"
TRUELAYER_CLIENT_ID = os.environ.get("TRUELAYER_CLIENT_ID", "").strip()
TRUELAYER_CLIENT_SECRET = os.environ.get("TRUELAYER_CLIENT_SECRET", "").strip()
TRUELAYER_REDIRECT_URI = os.environ.get("TRUELAYER_REDIRECT_URI", "").strip()
TRUELAYER_DATA_SCOPES = os.environ.get(
    "TRUELAYER_DATA_SCOPES",
    "accounts balance transactions offline_access",
).strip()
TRUELAYER_PROVIDERS = os.environ.get("TRUELAYER_PROVIDERS", "ob-monzo").strip() or "ob-monzo"
TRUELAYER_MONZO_PROVIDER_ID = os.environ.get("TRUELAYER_MONZO_PROVIDER_ID", "ob-monzo").strip() or "ob-monzo"
TRUELAYER_TRANSACTION_SYNC_DAYS = int(os.environ.get("TRUELAYER_TRANSACTION_SYNC_DAYS", "30") or "30")
ENABLE_BANKING_API_BASE = "https://api.enablebanking.com"
ENABLE_BANKING_APP_ID = os.environ.get("ENABLE_BANKING_APP_ID", "").strip()
ENABLE_BANKING_PRIVATE_KEY_PATH = os.environ.get("ENABLE_BANKING_PRIVATE_KEY_PATH", "").strip()
ENABLE_BANKING_PRIVATE_KEY = os.environ.get("ENABLE_BANKING_PRIVATE_KEY", "").strip()
ENABLE_BANKING_ENV = os.environ.get("ENABLE_BANKING_ENV", "sandbox").strip().lower() or "sandbox"
ENABLE_BANKING_REDIRECT_URI = os.environ.get("ENABLE_BANKING_REDIRECT_URI", "").strip()
ENABLE_BANKING_ACCESS_DAYS = int(os.environ.get("ENABLE_BANKING_ACCESS_DAYS", "90") or "90")
ENABLE_BANKING_TRANSACTION_SYNC_DAYS = int(os.environ.get("ENABLE_BANKING_TRANSACTION_SYNC_DAYS", "90") or "90")
RSS_FETCH_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
RSS_ARTICLE_MAX_BYTES = 1_000_000
RSS_ARTICLE_TEXT_LIMIT = 12000
ZEN_QUOTES_TODAY_URL = "https://zenquotes.io/api/today"
ZEN_QUOTES_MAX_BYTES = 8192
ZEN_QUOTES_FALLBACK = {
    "q": "Small steady choices compound into a quieter day.",
    "a": APP_NAME,
}


def normalize_notification_reminders(value: Any) -> dict[str, Any]:
    items = value.get("items") if isinstance(value, dict) else value
    if not isinstance(items, list):
        items = []

    reminders: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        reminder_id = str(item.get("id") or "").strip()
        kind = str(item.get("kind") or "").strip()
        due_at = parse_iso8601(item.get("dueAt"))
        if not reminder_id or reminder_id in seen_ids or kind not in NOTIFICATION_REMINDER_KINDS or due_at is None:
            continue

        url = str(item.get("url") or "/?page=tasks").strip() or "/?page=tasks"
        if not url.startswith("/"):
            url = "/?page=tasks"

        ref_id = str(item.get("refId") or "").strip() or None
        reminder_minutes_raw = item.get("reminderMinutes")
        try:
            reminder_minutes = max(0, min(180, int(reminder_minutes_raw)))
        except (TypeError, ValueError):
            reminder_minutes = None
        title = compact_text(str(item.get("title") or ""), 80) or None
        body = compact_text(str(item.get("body") or ""), 220) or None
        tag = compact_text(str(item.get("tag") or ""), 120) or None

        reminders.append({
            "id": reminder_id,
            "kind": kind,
            "dueAt": isoformat(due_at),
            "url": url,
            "refId": ref_id,
            "reminderMinutes": reminder_minutes,
            "urgent": item.get("urgent") is True,
            "title": title,
            "body": body,
            "tag": tag,
        })
        seen_ids.add(reminder_id)
        if len(reminders) >= NOTIFICATION_SCHEDULER_MAX_REMINDERS:
            break

    reminders.sort(key=lambda reminder: parse_iso8601(reminder.get("dueAt")) or float("inf"))
    return {"items": reminders}


def build_notification_scheduler_payload(reminder: dict[str, Any], now: float) -> dict[str, Any]:
    kind = str(reminder.get("kind") or "generic-reminder")
    title = str(reminder.get("title") or "").strip() or {
        "urgent-summary": "Urgent tasks",
        "urgent-task": "Urgent task",
        "ritual-start": "Ritual",
        "reflection": "Reflection",
        "event-reminder": "Event reminder",
        "event-final": "Event reminder",
        "goal-reminder": "Goal reminder",
        "verbatim": "Verbatim",
    }.get(kind, APP_NAME)
    body = str(reminder.get("body") or "").strip() or {
        "urgent-summary": "You still have urgent tasks left.",
        "urgent-task": "One urgent task still needs attention.",
        "ritual-start": "Your ritual starts now.",
        "reflection": "Take a moment to reflect on today.",
        "event-reminder": "Your event starts soon.",
        "event-final": "Your event starts in a minute.",
        "goal-reminder": "Remember what you want.",
        "verbatim": "You haven't finished your daily translations yet.",
    }.get(kind, "Check Cordyceps.")

    payload_data = {
        "url": str(reminder.get("url") or "/?page=tasks"),
        "kind": kind,
        "sentAt": isoformat(now),
    }
    ref_id = str(reminder.get("refId") or "").strip()
    if ref_id:
        payload_data["refId"] = ref_id
    if reminder.get("reminderMinutes") is not None:
        payload_data["reminderMinutes"] = reminder.get("reminderMinutes")

    return {
        "title": title,
        "body": body,
        "tag": str(reminder.get("tag") or "").strip() or f"cordyceps-{kind}-{str(reminder.get('id') or kind)[-48:]}",
        "urgent": reminder.get("urgent") is True,
        "data": payload_data,
    }


def split_due_notification_reminders(value: Any, now: float) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    normalized = normalize_notification_reminders(value)
    due: list[dict[str, Any]] = []
    pending: list[dict[str, Any]] = []
    for reminder in normalized["items"]:
        due_at = parse_iso8601(reminder.get("dueAt"))
        if due_at is not None and due_at <= now:
            due.append(reminder)
        else:
            pending.append(reminder)
    return due, {"items": pending}


WORD_OF_THE_DAY_URL = "https://api.wotd.site/query"
LEARNING_API_MAX_BYTES = 16_384
WIKIPEDIA_EXTRACTS_URL = "https://en.wikipedia.org/w/api.php"
DAILY_WORD_FALLBACK = {
    "kind": "word",
    "label": "Word of the day",
    "title": "lucid",
    "body": "Clear, easy to understand, or able to think clearly.",
    "source": "Cordyceps fallback",
}
DAILY_CONCEPTS = (
    {
        "title": "Opportunity Cost",
        "fallback": "The value of what you give up when choosing something else.",
        "category": "Economics",
    },
    {
        "title": "Confirmation Bias",
        "fallback": "The tendency to favor evidence that supports what you already believe.",
        "category": "Cognitive bias",
    },
    {
        "title": "Falsifiability",
        "fallback": "The idea that a scientific claim should be testable in a way that could prove it wrong.",
        "category": "Scientific principle",
    },
    {
        "title": "Burden of Proof",
        "fallback": "The obligation to provide evidence for a claim rather than expecting others to disprove it.",
        "category": "Logic",
    },
    {
        "title": "Categorical Imperative",
        "fallback": "Kant's principle that you should act only by rules you could will everyone to follow.",
        "category": "Philosophy",
    },
    {
        "title": "Sunk Cost Fallacy",
        "fallback": "Continuing something because of what you already invested, even when future value is poor.",
        "category": "Logical fallacy",
    },
    {
        "title": "Comparative Advantage",
        "fallback": "The ability to produce something at a lower opportunity cost than someone else.",
        "category": "Economics",
    },
    {
        "title": "Entropy",
        "fallback": "A measure of disorder or how spread out energy has become in a system.",
        "category": "Scientific principle",
    },
    {
        "title": "Steelman Argument",
        "fallback": "Responding to the strongest version of an opposing view rather than the weakest one.",
        "category": "Reasoning",
    },
    {
        "title": "Availability Heuristic",
        "fallback": "Judging likelihood by how easily examples come to mind.",
        "category": "Cognitive bias",
    },
    {
        "title": "Pareto Principle",
        "fallback": "The pattern where a small share of causes often produces a large share of results.",
        "category": "Economics",
    },
    {
        "title": "Occam's Razor",
        "fallback": "Prefer the simpler explanation when competing explanations fit the evidence equally well.",
        "category": "Philosophy",
    },
)
DAILY_CONCEPT_FALLBACK = {
    "kind": "concept",
    "label": "Concept of the day",
    "title": "Opportunity Cost",
    "body": "The value of what you give up when choosing something else.",
    "source": "Cordyceps fallback",
}


def _daily_learning_date_key() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _daily_learning_created_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def _daily_learning_pick_concept() -> dict[str, str]:
    start = datetime(2026, 1, 1, tzinfo=timezone.utc).date()
    today = datetime.now(timezone.utc).date()
    index = max(0, (today - start).days) % len(DAILY_CONCEPTS)
    return DAILY_CONCEPTS[index]


def _learning_fallback(payload: dict[str, str], reason: Exception | str) -> dict[str, Any]:
    return {
        **payload,
        "id": f"{payload['kind']}-{_daily_learning_date_key()}",
        "createdAt": _daily_learning_created_at(),
        "fallback": True,
        "reason": compact_text(str(reason), 160),
    }


def _first_text_value(*values: Any) -> str:
    for value in values:
        if isinstance(value, str):
            text = compact_text(value, 220)
            if text:
                return text
        if isinstance(value, list):
            for item in value:
                if isinstance(item, str):
                    text = compact_text(item, 220)
                    if text:
                        return text
                if isinstance(item, dict):
                    text = _first_text_value(
                        item.get("definition"),
                        item.get("meaning"),
                        item.get("text"),
                        item.get("description"),
                    )
                    if text:
                        return text
    return ""


def normalize_word_of_the_day_payload(payload: Any) -> dict[str, str]:
    if not isinstance(payload, dict):
        raise ValueError("Word of the Day returned an invalid payload.")
    title = _first_text_value(
        payload.get("word"),
        payload.get("title"),
        payload.get("term"),
        payload.get("name"),
    )
    body = _first_text_value(
        payload.get("definition"),
        payload.get("definitions"),
        payload.get("meaning"),
        payload.get("meanings"),
        payload.get("description"),
    )
    if not title or not body:
        raise ValueError("Word of the Day returned an empty word or definition.")
    return {
        "kind": "word",
        "id": f"word-{_daily_learning_date_key()}",
        "label": "Word of the day",
        "title": title[:80],
        "body": body[:220],
        "source": "Word of the Day",
        "createdAt": _daily_learning_created_at(),
    }


def fetch_wikipedia_concept_extract(concept: dict[str, str]) -> str:
    response = requests.get(
        WIKIPEDIA_EXTRACTS_URL,
        params={
            "action": "query",
            "format": "json",
            "prop": "extracts",
            "exintro": "1",
            "explaintext": "1",
            "exsentences": "1",
            "redirects": "1",
            "titles": concept["title"],
        },
        headers={"Accept": "application/json", "User-Agent": APP_NAME},
        timeout=5,
    )
    response.raise_for_status()
    if len(response.content or b"") > LEARNING_API_MAX_BYTES:
        raise ValueError("Wikipedia returned an oversized payload.")
    payload = response.json()
    pages = payload.get("query", {}).get("pages", {}) if isinstance(payload, dict) else {}
    if not isinstance(pages, dict):
        raise ValueError("Wikipedia returned an invalid payload.")
    for page in pages.values():
        if isinstance(page, dict):
            extract = compact_text(str(page.get("extract") or ""), 220)
            if extract:
                return extract
    raise ValueError("Wikipedia returned an empty concept extract.")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.environ.get("SMTP_FROM", "").strip()
IMAP_HOST = os.environ.get("IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.environ.get("IMAP_PORT", "993"))
IMAP_USERNAME = os.environ.get("IMAP_USERNAME", SMTP_USERNAME).strip()
IMAP_PASSWORD = os.environ.get("IMAP_PASSWORD", SMTP_PASSWORD).strip()
QUICKMAIL_MAX_LENGTH = 140
QUICKMAIL_SUBJECT_MAX_LENGTH = 200
QUICKMAIL_MAILBOX_FETCH_LIMIT = 24
QUICKMAIL_GOOGLE_CLIENT_ID = os.environ.get("QUICKMAIL_GOOGLE_CLIENT_ID", "").strip()
QUICKMAIL_GOOGLE_CLIENT_SECRET = os.environ.get("QUICKMAIL_GOOGLE_CLIENT_SECRET", "").strip()
QUICKMAIL_GOOGLE_REDIRECT_URI = os.environ.get("QUICKMAIL_GOOGLE_REDIRECT_URI", "").strip()
QUICKMAIL_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
QUICKMAIL_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
QUICKMAIL_GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
QUICKMAIL_GOOGLE_SCOPES = (
    "https://www.googleapis.com/auth/gmail.readonly "
    "https://www.googleapis.com/auth/gmail.send"
)
QUICKMAIL_MICROSOFT_CLIENT_ID = os.environ.get("QUICKMAIL_MICROSOFT_CLIENT_ID", "").strip()
QUICKMAIL_MICROSOFT_CLIENT_SECRET = os.environ.get("QUICKMAIL_MICROSOFT_CLIENT_SECRET", "").strip()
QUICKMAIL_MICROSOFT_TENANT = os.environ.get("QUICKMAIL_MICROSOFT_TENANT", "consumers").strip() or "consumers"
QUICKMAIL_MICROSOFT_REDIRECT_URI = os.environ.get("QUICKMAIL_MICROSOFT_REDIRECT_URI", "").strip()
QUICKMAIL_MICROSOFT_SCOPES = "offline_access Mail.Read Mail.Send User.Read"
MICROSOFT_GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
OUTLOOK_ICS_FETCH_TIMEOUT_SECONDS = 20
OUTLOOK_ICS_CACHE_TTL_SECONDS = 5 * 60
OUTLOOK_ICS_MAX_BYTES = 1_000_000
# ---------------------------------------------------------------------------
# Auth OAuth / Magic link
# ---------------------------------------------------------------------------
AUTH_GOOGLE_CLIENT_ID = os.environ.get("AUTH_GOOGLE_CLIENT_ID", "").strip()
AUTH_GOOGLE_CLIENT_SECRET = os.environ.get("AUTH_GOOGLE_CLIENT_SECRET", "").strip()
AUTH_GOOGLE_REDIRECT_URI = os.environ.get("AUTH_GOOGLE_REDIRECT_URI", "").strip()
AUTH_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
AUTH_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
AUTH_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
AUTH_GOOGLE_SCOPES = "openid email profile"

AUTH_MICROSOFT_CLIENT_ID = os.environ.get("AUTH_MICROSOFT_CLIENT_ID", "").strip()
AUTH_MICROSOFT_CLIENT_SECRET = os.environ.get("AUTH_MICROSOFT_CLIENT_SECRET", "").strip()
AUTH_MICROSOFT_TENANT = os.environ.get("AUTH_MICROSOFT_TENANT", "common").strip() or "common"
AUTH_MICROSOFT_REDIRECT_URI = os.environ.get("AUTH_MICROSOFT_REDIRECT_URI", "").strip()
AUTH_MICROSOFT_SCOPES = "openid email profile User.Read"

NOTES_ENCRYPTION_KEY_HEX = os.environ.get("NOTES_ENCRYPTION_KEY", "").strip()
BANKING_TOKEN_ENCRYPTION_KEY_HEX = os.environ.get("BANKING_TOKEN_ENCRYPTION_KEY", "").strip()
REQUIRE_SERVER_KEYS = _env_flag(
    "CORDYCEPS_REQUIRE_SERVER_KEYS",
    default=CORDYCEPS_RELEASE or not LOCAL_PWA_MODE,
)
MAGIC_LINK_TTL_SECONDS = 15 * 60
OAUTH_STATE_TTL_SECONDS = 10 * 60

MAX_REQUEST_BODY_BYTES = 4 * 1024 * 1024  # 4 MB
TRUST_PROXY = False  # Set to True at startup via --trust-proxy flag
OUTLOOK_ICS_USER_AGENT = "CordycepsOutlookICS/1.0"
SERVER_VERSION = str(time.time_ns())
WATCH_ROOTS: tuple[Path, ...] = ()
WATCH_FILES = (ROOT / "serve.py",)
IGNORED_WATCH_DIRS = {"__pycache__", ".git", "node_modules", "data", "target"}

OUTLOOK_HELPER_ROUTE_PATHS = {
    "/api/outlook/calendar",
    "/api/outlook/settings",
}
BANKING_HELPER_ROUTE_PATHS = {
    "/api/banking/truelayer/callback",
    "/api/banking/enable/callback",
    "/api/banking/truelayer/start",
    "/api/banking/enable/institutions",
    "/api/banking/enable/start",
    "/api/banking/sync",
    "/api/banking/import/csv",
    "/api/banking/disconnect",
    "/api/monzo/settings",
    "/api/monzo/expenses",
    "/api/integrations/monzo/expenses",
    "/api/integrations/monzo/truelayer/expenses",
    "/api/integrations/monzo/truelayer/token",
    "/api/integrations/monzo/truelayer/account",
}


def _validate_release_configuration() -> None:
    if not LOCAL_PWA_MODE and not ALLOW_LEGACY_SERVER_STATE:
        raise RuntimeError(
            "Cordyceps now defaults to the local-first local_pwa release path. "
            "Set CORDYCEPS_ALLOW_LEGACY_SERVER_STATE=1 only for legacy/dev server-state mode."
        )

    if CORDYCEPS_RELEASE and ALLOW_LEGACY_SERVER_STATE:
        raise RuntimeError(
            "CORDYCEPS_ALLOW_LEGACY_SERVER_STATE is not allowed in release mode."
        )

    if LEGACY_PUBLIC_OAUTH_TOKEN_EXCHANGE_REQUESTED:
        raise RuntimeError(
            "CORDYCEPS_ENABLE_PUBLIC_OAUTH_TOKEN_EXCHANGE has been removed. "
            "Remove the env var instead of enabling the old public OAuth broker."
        )

    if not REQUIRE_SERVER_KEYS:
        return

    if not LOCAL_PWA_MODE and not NOTES_ENCRYPTION_KEY_HEX:
        raise RuntimeError(
            "NOTES_ENCRYPTION_KEY is required when server-side personal storage remains enabled."
        )

    if ENABLE_BANKING_HELPER and not (BANKING_TOKEN_ENCRYPTION_KEY_HEX or NOTES_ENCRYPTION_KEY_HEX):
        raise RuntimeError(
            "BANKING_TOKEN_ENCRYPTION_KEY or NOTES_ENCRYPTION_KEY is required when the banking helper is enabled."
        )


_validate_release_configuration()

mimetypes.add_type("application/manifest+json", ".webmanifest")


class MonzoApiError(RuntimeError):
    pass


class TrueLayerApiError(RuntimeError):
    pass


class EnableBankingApiError(RuntimeError):
    pass


class AuthError(RuntimeError):
    pass


class MonzoClient:
    def __init__(self, access_token: str) -> None:
        self._access_token = access_token.strip()
        self._session = requests.Session()

    def _request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        headers = {"Authorization": f"Bearer {self._access_token}"}
        response = self._session.request(method, url, headers=headers, timeout=20, **kwargs)
        if response.status_code >= 400:
            raise MonzoApiError(f"Monzo request failed with status {response.status_code}.")
        return response

    def list_accounts(self) -> list[dict[str, Any]]:
        response = self._request("GET", MONZO_ACCOUNTS_URL, params={"account_type": "uk_retail"})
        payload = response.json()
        accounts = payload.get("accounts") if isinstance(payload, dict) else None
        if not isinstance(accounts, list):
            raise MonzoApiError("Unexpected Monzo accounts response.")
        return [account for account in accounts if isinstance(account, dict)]

    def list_transactions(self, account_id: str, *, since: str, limit: int = 100) -> list[dict[str, Any]]:
        response = self._request(
            "GET",
            MONZO_TRANSACTIONS_URL,
            params={
                "account_id": account_id,
                "since": since,
                "limit": str(limit),
            },
        )
        payload = response.json()
        transactions = payload.get("transactions") if isinstance(payload, dict) else None
        if not isinstance(transactions, list):
            raise MonzoApiError("Unexpected Monzo transactions response.")
        return [transaction for transaction in transactions if isinstance(transaction, dict)]


class TrueLayerClient:
    def __init__(self) -> None:
        self._session = requests.Session()

    def _token_request(self, data: dict[str, str]) -> dict[str, Any]:
        if not TRUELAYER_CLIENT_ID:
            raise TrueLayerApiError("TrueLayer is missing TRUELAYER_CLIENT_ID on this server.")
        if not TRUELAYER_CLIENT_SECRET:
            raise TrueLayerApiError("TrueLayer is missing TRUELAYER_CLIENT_SECRET on this server.")

        response = self._session.post(TRUELAYER_TOKEN_URL, data=data, timeout=20)
        try:
            payload = response.json()
        except ValueError as exc:
            raise TrueLayerApiError("TrueLayer returned an unreadable token response.") from exc

        if response.status_code >= 400:
            message = ""
            if isinstance(payload, dict):
                message = str(payload.get("error_description") or payload.get("error") or "").strip()
            raise TrueLayerApiError(message or f"TrueLayer token request failed with status {response.status_code}.")

        if not isinstance(payload, dict):
            raise TrueLayerApiError("TrueLayer returned an unexpected token response.")
        return payload

    def exchange_code(self, *, code: str, redirect_uri: str) -> dict[str, Any]:
        return self._token_request({
            "grant_type": "authorization_code",
            "client_id": TRUELAYER_CLIENT_ID,
            "client_secret": TRUELAYER_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "code": code,
        })

    def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        return self._token_request({
            "grant_type": "refresh_token",
            "client_id": TRUELAYER_CLIENT_ID,
            "client_secret": TRUELAYER_CLIENT_SECRET,
            "refresh_token": refresh_token,
        })

    def _data_request(self, access_token: str, path: str, *, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
        response = self._session.get(
            f"{TRUELAYER_DATA_API_BASE}{path}",
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            timeout=20,
        )
        try:
            payload = response.json()
        except ValueError as exc:
            raise TrueLayerApiError("TrueLayer returned an unreadable data response.") from exc

        if response.status_code >= 400:
            message = ""
            if isinstance(payload, dict):
                errors = payload.get("errors")
                if isinstance(errors, list) and errors:
                    first_error = errors[0]
                    if isinstance(first_error, dict):
                        message = str(first_error.get("message") or first_error.get("title") or "").strip()
                message = message or str(payload.get("error_description") or payload.get("error") or "").strip()
            raise TrueLayerApiError(message or f"TrueLayer data request failed with status {response.status_code}.")

        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, list):
            raise TrueLayerApiError("TrueLayer returned an unexpected data response.")
        return [item for item in results if isinstance(item, dict)]

    def list_accounts(self, access_token: str) -> list[dict[str, Any]]:
        return self._data_request(access_token, "/accounts")

    def get_account_balance(self, access_token: str, account_id: str) -> list[dict[str, Any]]:
        account_path = quote(account_id, safe="")
        return self._data_request(access_token, f"/accounts/{account_path}/balance")

    def list_account_transactions(
        self,
        access_token: str,
        account_id: str,
        *,
        from_date: str,
        to_date: str,
    ) -> list[dict[str, Any]]:
        account_path = quote(account_id, safe="")
        return self._data_request(
            access_token,
            f"/accounts/{account_path}/transactions",
            params={"from": from_date, "to": to_date},
        )


class EnableBankingClient:
    def __init__(self) -> None:
        self._session = requests.Session()

    @staticmethod
    def _ensure_configured() -> None:
        if not ENABLE_BANKING_APP_ID:
            raise EnableBankingApiError("Enable Banking is missing ENABLE_BANKING_APP_ID on this server.")
        if not ENABLE_BANKING_PRIVATE_KEY and not ENABLE_BANKING_PRIVATE_KEY_PATH:
            raise EnableBankingApiError(
                "Enable Banking needs ENABLE_BANKING_PRIVATE_KEY or ENABLE_BANKING_PRIVATE_KEY_PATH on this server."
            )

    @staticmethod
    def _load_private_key() -> Any:
        EnableBankingClient._ensure_configured()
        if ENABLE_BANKING_PRIVATE_KEY:
            key_bytes = ENABLE_BANKING_PRIVATE_KEY.replace("\\n", "\n").encode("utf-8")
        else:
            try:
                key_bytes = Path(ENABLE_BANKING_PRIVATE_KEY_PATH).read_bytes()
            except OSError as exc:
                raise EnableBankingApiError("Enable Banking private key file could not be read.") from exc
        try:
            return serialization.load_pem_private_key(key_bytes, password=None)
        except Exception as exc:
            raise EnableBankingApiError("Enable Banking private key is not a readable PEM RSA key.") from exc

    @staticmethod
    def _json_b64(payload: dict[str, Any]) -> str:
        encoded = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        return b64url(encoded)

    def _jwt(self) -> str:
        now = int(time.time())
        header = {"typ": "JWT", "alg": "RS256", "kid": ENABLE_BANKING_APP_ID}
        body = {
            "iss": "enablebanking.com",
            "aud": "api.enablebanking.com",
            "iat": now,
            "exp": now + 3600,
        }
        signing_input = f"{self._json_b64(header)}.{self._json_b64(body)}".encode("ascii")
        private_key = self._load_private_key()
        signature = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
        return f"{signing_input.decode('ascii')}.{b64url(signature)}"

    @staticmethod
    def _error_message(payload: Any, fallback: str) -> str:
        if isinstance(payload, dict):
            errors = payload.get("errors")
            if isinstance(errors, list) and errors:
                first = errors[0]
                if isinstance(first, dict):
                    value = first.get("message") or first.get("detail") or first.get("title")
                    if value:
                        return str(value).strip()
            for key in ("message", "detail", "error_description", "error", "title"):
                value = payload.get(key)
                if value:
                    return str(value).strip()
        return fallback

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
    ) -> Any:
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self._jwt()}",
        }
        url = f"{ENABLE_BANKING_API_BASE}{path}"
        response = self._session.request(method, url, headers=headers, json=json_body, params=params, timeout=25)
        if response.status_code == HTTPStatus.NO_CONTENT:
            return {}
        try:
            payload = response.json()
        except ValueError as exc:
            raise EnableBankingApiError("Enable Banking returned an unreadable response.") from exc
        if response.status_code >= 400:
            message = self._error_message(payload, f"Enable Banking request failed with status {response.status_code}.")
            raise EnableBankingApiError(message)
        return payload

    def list_aspsps(self, country: str) -> list[dict[str, Any]]:
        clean_country = (country.strip().upper()[:2] or "GB")
        payload = self._request("GET", "/aspsps", params={"country": clean_country})
        aspsps = payload.get("aspsps") if isinstance(payload, dict) else None
        if not isinstance(aspsps, list):
            raise EnableBankingApiError("Enable Banking returned an unexpected ASPSP list.")
        return [item for item in aspsps if isinstance(item, dict)]

    def start_auth(
        self,
        *,
        aspsp_name: str,
        aspsp_country: str,
        redirect_uri: str,
        state: str,
    ) -> dict[str, Any]:
        clean_name = aspsp_name.strip()
        clean_country = aspsp_country.strip().upper()[:2] or "GB"
        if not clean_name:
            raise EnableBankingApiError("Choose a bank before connecting.")
        valid_until = datetime.now(timezone.utc) + timedelta(days=max(1, ENABLE_BANKING_ACCESS_DAYS))
        payload = self._request(
            "POST",
            "/auth",
            json_body={
                "access": {"valid_until": valid_until.isoformat()},
                "aspsp": {"name": clean_name, "country": clean_country},
                "state": state,
                "redirect_url": redirect_uri,
                "psu_type": "personal",
            },
        )
        if not isinstance(payload, dict):
            raise EnableBankingApiError("Enable Banking returned an unexpected authorisation response.")
        return payload

    def create_session(self, code: str) -> dict[str, Any]:
        clean_code = code.strip()
        if not clean_code:
            raise EnableBankingApiError("Enable Banking callback did not include an authorisation code.")
        payload = self._request("POST", "/sessions", json_body={"code": clean_code})
        if not isinstance(payload, dict):
            raise EnableBankingApiError("Enable Banking returned an unexpected session response.")
        return payload

    def get_account_balances(self, account_id: str) -> dict[str, Any]:
        account_path = quote(account_id.strip(), safe="")
        payload = self._request("GET", f"/accounts/{account_path}/balances")
        if not isinstance(payload, dict):
            raise EnableBankingApiError("Enable Banking returned an unexpected account balances response.")
        return payload

    def get_account_transactions(
        self,
        account_id: str,
        *,
        continuation_key: str = "",
    ) -> dict[str, Any]:
        account_path = quote(account_id.strip(), safe="")
        params = {"continuation_key": continuation_key} if continuation_key else None
        payload = self._request("GET", f"/accounts/{account_path}/transactions", params=params)
        if not isinstance(payload, dict):
            raise EnableBankingApiError("Enable Banking returned an unexpected transactions response.")
        return payload

    def delete_session(self, session_id: str) -> None:
        clean_session_id = session_id.strip()
        if not clean_session_id:
            return
        session_path = quote(clean_session_id, safe="")
        self._request("DELETE", f"/sessions/{session_path}")


def _enable_banking_account_ids(session: dict[str, Any]) -> list[str]:
    raw_accounts = session.get("accounts")
    if not isinstance(raw_accounts, list):
        return []
    account_ids: list[str] = []
    for item in raw_accounts:
        if isinstance(item, dict):
            account_id = str(item.get("uid") or item.get("id") or item.get("account_id") or "").strip()
        else:
            account_id = str(item or "").strip()
        if account_id:
            account_ids.append(account_id)
    return account_ids


def _extract_enable_banking_balance(payload: dict[str, Any]) -> tuple[int | None, str]:
    balances = payload.get("balances") if isinstance(payload, dict) else None
    if not isinstance(balances, list) or not balances:
        return None, ""
    preferred = balances[0]
    for item in balances:
        if isinstance(item, dict) and str(item.get("name") or item.get("balance_type") or "").lower() in {"interimavailable", "closingavailable", "available"}:
            preferred = item
            break
    if not isinstance(preferred, dict):
        return None, ""
    amount_payload = preferred.get("balance_amount") or preferred.get("amount")
    if isinstance(amount_payload, dict):
        raw_amount = amount_payload.get("amount")
        currency = str(amount_payload.get("currency") or "").strip().upper()
    else:
        raw_amount = amount_payload
        currency = str(preferred.get("currency") or "").strip().upper()
    try:
        amount = float(raw_amount or 0)
    except (TypeError, ValueError):
        return None, ""
    return int(round(amount * 100)), currency


def _normalize_enable_banking_expense(transaction: dict[str, Any], account_id: str) -> dict[str, Any] | None:
    amount_payload = transaction.get("transaction_amount") or transaction.get("amount")
    if isinstance(amount_payload, dict):
        raw_amount = amount_payload.get("amount")
        currency = str(amount_payload.get("currency") or "GBP").strip().upper() or "GBP"
    else:
        raw_amount = amount_payload
        currency = str(transaction.get("currency") or "GBP").strip().upper() or "GBP"
    try:
        amount = float(raw_amount or 0)
    except (TypeError, ValueError):
        return None
    indicator = str(transaction.get("credit_debit_indicator") or "").strip().upper()
    if indicator == "CRDT" or (amount >= 0 and indicator != "DBIT"):
        return None

    remittance = transaction.get("remittance_information")
    if isinstance(remittance, list):
        remittance_text = " ".join(str(item).strip() for item in remittance if str(item or "").strip())
    else:
        remittance_text = str(remittance or "").strip()
    creditor = transaction.get("creditor") if isinstance(transaction.get("creditor"), dict) else {}
    debtor = transaction.get("debtor") if isinstance(transaction.get("debtor"), dict) else {}
    merchant_name = str(creditor.get("name") or debtor.get("name") or "").strip()
    description = str(
        remittance_text
        or transaction.get("note")
        or transaction.get("entry_reference")
        or merchant_name
        or ""
    ).strip()
    bank_code = transaction.get("bank_transaction_code")
    if isinstance(bank_code, dict):
        category = str(bank_code.get("description") or bank_code.get("code") or "").strip()
    else:
        category = str(bank_code or transaction.get("merchant_category_code") or "").strip()
    created = str(
        transaction.get("booking_date")
        or transaction.get("value_date")
        or transaction.get("transaction_date")
        or ""
    ).strip() or None
    settled = str(transaction.get("value_date") or transaction.get("booking_date") or created or "").strip() or None
    transaction_id = str(transaction.get("transaction_id") or "").strip()
    if not transaction_id:
        transaction_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"enable-banking:{account_id}:{created}:{description}:{amount}"))
    return {
        "id": transaction_id,
        "source": "enable-banking",
        "accountId": account_id,
        "merchantName": merchant_name,
        "description": description,
        "amountMinor": abs(int(round(amount * 100))),
        "currency": currency,
        "created": created,
        "settled": settled,
        "category": category or None,
        "rawProviderCategory": category or None,
    }


def _normalize_csv_expenses(csv_text: str) -> list[dict[str, Any]]:
    if not csv_text.strip():
        raise ValueError("CSV text is required.")
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        raise ValueError("CSV must include a header row.")

    def pick(row: dict[str, Any], *names: str) -> str:
        lookup = {str(key or "").strip().lower(): str(value or "").strip() for key, value in row.items()}
        for name in names:
            value = lookup.get(name.lower())
            if value:
                return value
        return ""

    expenses: list[dict[str, Any]] = []
    for index, row in enumerate(reader):
        amount_text = pick(row, "amount", "amount gbp", "value", "transaction amount", "paid out", "debit")
        if not amount_text:
            continue
        amount_text = amount_text.replace("£", "").replace(",", "").strip()
        try:
            amount = float(amount_text)
        except ValueError:
            continue
        if amount == 0:
            continue
        description = pick(row, "description", "name", "transaction", "details", "memo", "reference")
        merchant_name = pick(row, "merchant", "merchant name", "payee", "counterparty")
        created = pick(row, "created", "date", "transaction date", "booking date", "settled")
        settled = pick(row, "settled", "value date", "date") or created
        currency = pick(row, "currency", "ccy") or "GBP"
        category = pick(row, "category", "type", "classification")
        expense_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"csv:{index}:{created}:{merchant_name}:{description}:{amount}"))
        expenses.append({
            "id": expense_id,
            "source": "csv",
            "accountId": "csv-import",
            "merchantName": merchant_name,
            "description": description,
            "amountMinor": abs(int(round(amount * 100))),
            "currency": currency.strip().upper() or "GBP",
            "created": created or None,
            "settled": settled or None,
            "category": category or None,
            "rawProviderCategory": category or None,
        })
    expenses.sort(key=lambda item: item.get("settled") or item.get("created") or "", reverse=True)
    return expenses


# utc_now, isoformat → api/utils.py


# parse_iso8601, parse_hhmm → api/utils.py
# parse_feed_datetime, xml_*, compact_text, decode_mime_header, html_to_text → api/rss.py / api/utils.py


# extract_html_title, extract_readable_article_text, fetch_rss_article,
# _validate_safe_url, _safe_feed_url, parse_rss_feed, fetch_rss_feed → api/rss.py






# get_timezone, local_date_key, WINDOWS_TZID_FALLBACKS, resolve_ics_timezone,
# unfold_ics_lines, parse_ics_property, parse_ics_datetime, build_ics_event_payload,
# parse_ics_events, format_local_date, next_daily_occurrence → api/ics.py


def generate_vapid_private_key() -> ec.EllipticCurvePrivateKey:
    return ec.generate_private_key(ec.SECP256R1())


def load_vapid_private_key() -> ec.EllipticCurvePrivateKey:
    if not VAPID_PRIVATE_KEY_FILE.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        private_key = generate_vapid_private_key()
        pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        VAPID_PRIVATE_KEY_FILE.write_bytes(pem)
        return private_key

    return serialization.load_pem_private_key(
        VAPID_PRIVATE_KEY_FILE.read_bytes(),
        password=None,
    )


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(value: str) -> bytes | None:
    try:
        padding = "=" * ((4 - (len(value) % 4)) % 4)
        return base64.urlsafe_b64decode(value + padding)
    except (ValueError, base64.binascii.Error):
        return None


def today_key_not_completed(completions: Any, day_key: str) -> bool:
    return not (isinstance(completions, list) and day_key in {str(item) for item in completions})


# ---------------------------------------------------------------------------
# Notes encryption helpers
# ---------------------------------------------------------------------------

_notes_key_cache: bytes | None = None


def _notes_key() -> bytes:
    global _notes_key_cache, NOTES_ENCRYPTION_KEY_HEX
    if _notes_key_cache is not None:
        return _notes_key_cache
    if not NOTES_ENCRYPTION_KEY_HEX:
        if REQUIRE_SERVER_KEYS:
            raise RuntimeError(
                "NOTES_ENCRYPTION_KEY is required for this Cordyceps server configuration."
            )
        generated = os.urandom(32)
        NOTES_ENCRYPTION_KEY_HEX = generated.hex()
        print(
            f"WARNING: NOTES_ENCRYPTION_KEY not set — generated ephemeral key. "
            f"Notes will be unreadable after restart. Add to .env:\n"
            f"  NOTES_ENCRYPTION_KEY={NOTES_ENCRYPTION_KEY_HEX}",
            file=sys.stderr, flush=True,
        )
        _notes_key_cache = generated
        return generated
    raw = bytes.fromhex(NOTES_ENCRYPTION_KEY_HEX)
    if len(raw) != 32:
        raise RuntimeError("NOTES_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes).")
    _notes_key_cache = raw
    return raw


def _encrypt_field(plaintext: str) -> str:
    key = _notes_key()
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def _decrypt_field(value: str) -> str:
    key = _notes_key()
    raw = base64.b64decode(value)
    return AESGCM(key).decrypt(raw[:12], raw[12:], None).decode("utf-8")


_banking_token_key_cache: bytes | None = None


def _banking_token_key() -> bytes:
    global _banking_token_key_cache, BANKING_TOKEN_ENCRYPTION_KEY_HEX
    if _banking_token_key_cache is not None:
        return _banking_token_key_cache
    if BANKING_TOKEN_ENCRYPTION_KEY_HEX:
        raw = bytes.fromhex(BANKING_TOKEN_ENCRYPTION_KEY_HEX)
        if len(raw) != 32:
            raise RuntimeError("BANKING_TOKEN_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes).")
        _banking_token_key_cache = raw
        return raw
    if NOTES_ENCRYPTION_KEY_HEX:
        _banking_token_key_cache = _notes_key()
        return _banking_token_key_cache

    if REQUIRE_SERVER_KEYS:
        raise RuntimeError(
            "BANKING_TOKEN_ENCRYPTION_KEY or NOTES_ENCRYPTION_KEY is required for this Cordyceps server configuration."
        )

    generated = os.urandom(32)
    BANKING_TOKEN_ENCRYPTION_KEY_HEX = generated.hex()
    print(
        f"WARNING: BANKING_TOKEN_ENCRYPTION_KEY not set - generated ephemeral key. "
        f"Banking tokens will be unreadable after restart. Add to .env:\n"
        f"  BANKING_TOKEN_ENCRYPTION_KEY={BANKING_TOKEN_ENCRYPTION_KEY_HEX}",
        file=sys.stderr, flush=True,
    )
    _banking_token_key_cache = generated
    return generated


def _encrypt_banking_token(plaintext: str) -> str:
    if not plaintext:
        return ""
    key = _banking_token_key()
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def _decrypt_banking_token(value: str) -> str:
    if not value:
        return ""
    key = _banking_token_key()
    raw = base64.b64decode(value)
    return AESGCM(key).decrypt(raw[:12], raw[12:], None).decode("utf-8")


def _parse_jwt_payload(token: str) -> dict[str, Any]:
    parts = str(token or "").split(".")
    if len(parts) < 2:
        raise ValueError("Invalid JWT.")
    padding = "=" * ((4 - len(parts[1]) % 4) % 4)
    payload = json.loads(base64.urlsafe_b64decode(parts[1] + padding))
    return payload if isinstance(payload, dict) else {}

def _username_slug(value: str) -> str:
    local = value.split("@")[0] if "@" in value else value
    slug = re.sub(r"[^a-z0-9]+", ".", local.lower()).strip(".")
    return slug[:20] or "user"


def _send_magic_link_email(recipient: str, link: str) -> bool:
    """Send the magic link email. Returns True if sent via email, False if SMTP is not configured."""
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        # No SMTP configured — print the link to the console so it can be used manually.
        print(
            f"\n{'='*60}\n[MAGIC LINK] No SMTP configured. Use this link to sign in:\n"
            f"  To: {recipient}\n  {link}\n{'='*60}\n",
            file=sys.stderr, flush=True,
        )
        return False
    msg = EmailMessage()
    msg["Subject"] = f"Sign in to {APP_NAME}"
    msg["From"] = SMTP_FROM or SMTP_USERNAME
    msg["To"] = recipient
    msg.set_content(
        f"Click the link below to sign in to {APP_NAME}.\n\n{link}\n\n"
        "This link expires in 15 minutes. If you did not request this, you can ignore this email."
    )
    msg.add_alternative(
        f'<p>Click below to sign in to <strong>{APP_NAME}</strong>.</p>'
        f'<p><a href="{link}" style="background:#000;color:#fff;padding:12px 24px;'
        f'text-decoration:none;border-radius:6px;display:inline-block;font-family:sans-serif">'
        f'Sign in to {APP_NAME}</a></p>'
        f'<p style="color:#888;font-size:12px">Link expires in 15 minutes.</p>',
        subtype="html",
    )
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
    return True


def public_key_to_b64(private_key: ec.EllipticCurvePrivateKey) -> str:
    public_key = private_key.public_key()
    numbers = public_key.public_numbers()
    raw = b"\x04" + numbers.x.to_bytes(32, "big") + numbers.y.to_bytes(32, "big")
    return b64url(raw)


VAPID_PRIVATE_KEY = load_vapid_private_key()
VAPID_PUBLIC_KEY = public_key_to_b64(VAPID_PRIVATE_KEY)


SCHEMA_VERSION = 2

# ---------------------------------------------------------------------------
# Server-Sent Events (SSE) connection registry
# ---------------------------------------------------------------------------
# Maps user_id → list of Queue objects (one per open /api/events connection).
# When state is saved for a user, all queues for that user receive a ping so
# the client knows to re-fetch /api/state immediately.

_SSE_REGISTRY: dict[str, list["queue.Queue[str]"]] = {}
_SSE_REGISTRY_LOCK = threading.Lock()


def _sse_register(user_id: str) -> "queue.Queue[str]":
    q: "queue.Queue[str]" = queue.Queue(maxsize=8)
    with _SSE_REGISTRY_LOCK:
        _SSE_REGISTRY.setdefault(user_id, []).append(q)
    return q


def _sse_unregister(user_id: str, q: "queue.Queue[str]") -> None:
    with _SSE_REGISTRY_LOCK:
        bucket = _SSE_REGISTRY.get(user_id)
        if bucket is not None:
            try:
                bucket.remove(q)
            except ValueError:
                pass
            if not bucket:
                del _SSE_REGISTRY[user_id]


def _sse_notify(user_id: str) -> None:
    """Push a 'state-changed' ping to every open SSE connection for user_id."""
    with _SSE_REGISTRY_LOCK:
        queues = list(_SSE_REGISTRY.get(user_id, []))
    for q in queues:
        try:
            q.put_nowait("state-changed")
        except queue.Full:
            pass  # client is slow; skip rather than block


class PostgresBackend:
    def __init__(self, database_url: str) -> None:
        if psycopg is None or ConnectionPool is None:
            raise RuntimeError("Install psycopg and psycopg_pool to use the PostgreSQL backend.")
        if not database_url:
            raise RuntimeError("DATABASE_URL must be set to use the PostgreSQL backend.")
        self._pool = ConnectionPool(
            database_url,
            min_size=2,
            max_size=10,
            kwargs={"row_factory": dict_row},
        )
        try:
            self._ensure_schema()
        except psycopg.OperationalError as exc:
            self._pool.close()
            raise RuntimeError(
                f"Cannot connect to PostgreSQL — check DATABASE_URL and that the server is running: {exc}"
            ) from exc

    def _ensure_schema(self) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS app_metadata (
                    key text PRIMARY KEY,
                    value jsonb NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_users (
                    id text PRIMARY KEY,
                    username text NOT NULL UNIQUE,
                    created_at text NOT NULL,
                    credentials jsonb NOT NULL DEFAULT '[]',
                    email text UNIQUE,
                    provider text,
                    provider_id text,
                    display_name text
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    id text PRIMARY KEY,
                    user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
                    created_at text NOT NULL,
                    last_seen_at text NOT NULL,
                    expires_at text NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_states (
                    user_id text PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
                    state jsonb NOT NULL,
                    updated_at text NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS oauth_states (
                    state text PRIMARY KEY,
                    provider text NOT NULL,
                    created_at text NOT NULL,
                    expires_at text NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS magic_link_tokens (
                    token text PRIMARY KEY,
                    email text NOT NULL,
                    created_at text NOT NULL,
                    expires_at text NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS notes (
                    user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
                    note_id text NOT NULL,
                    title_enc text NOT NULL,
                    body_enc text NOT NULL,
                    updated_at text NOT NULL,
                    PRIMARY KEY (user_id, note_id)
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes (user_id)")
            conn.commit()
        self._migrate()

    def _get_schema_version(self, conn: psycopg.Connection) -> int:
        row = conn.execute(
            "SELECT value FROM app_metadata WHERE key = 'schema_version'"
        ).fetchone()
        if row is None:
            return 0
        val = row["value"]
        return int(val) if isinstance(val, (int, float)) else 0

    def _set_schema_version(self, conn: psycopg.Connection, version: int) -> None:
        conn.execute(
            """
            INSERT INTO app_metadata (key, value)
            VALUES ('schema_version', %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            """,
            (Jsonb(version),),
        )

    def _migrate(self) -> None:
        with self._pool.connection() as conn:
            # Always run idempotent column additions regardless of recorded version,
            # so a schema_version bump that ran before the ALTER TABLE still catches up.
            conn.execute("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email text")
            conn.execute("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS provider text")
            conn.execute("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS provider_id text")
            conn.execute("ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS display_name text")
            conn.execute(
                """
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'auth_users_email_key'
                    ) THEN
                        ALTER TABLE auth_users ADD CONSTRAINT auth_users_email_key UNIQUE (email);
                    END IF;
                END $$
                """
            )
            self._set_schema_version(conn, SCHEMA_VERSION)
            conn.commit()

    def auth_users_exist(self) -> bool:
        with self._pool.connection() as conn:
            row = conn.execute("SELECT EXISTS (SELECT 1 FROM auth_users) AS has_rows").fetchone()
            return bool(row and row["has_rows"])

    def load_users_payload(self) -> dict[str, Any]:
        with self._pool.connection() as conn:
            metadata = conn.execute(
                "SELECT value FROM app_metadata WHERE key = %s",
                ("legacyOwnerUserId",),
            ).fetchone()
            rows = conn.execute(
                """
                SELECT id, username, created_at, email, provider, provider_id, display_name
                FROM auth_users
                ORDER BY created_at ASC, username ASC
                """
            ).fetchall()
        return {
            "schemaVersion": AUTH_SCHEMA_VERSION,
            "legacyOwnerUserId": metadata["value"] if metadata else None,
            "users": [
                {
                    "id": row["id"],
                    "username": row["username"],
                    "email": row["email"],
                    "provider": row["provider"],
                    "providerId": row["provider_id"],
                    "displayName": row["display_name"],
                    "createdAt": row["created_at"],
                }
                for row in rows
            ],
        }

    def save_users_payload(self, payload: dict[str, Any]) -> None:
        users = payload.get("users", []) if isinstance(payload, dict) else []
        valid_users = [user for user in users if isinstance(user, dict) and user.get("id")]
        user_ids = [str(user["id"]) for user in valid_users]
        with self._pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO app_metadata (key, value)
                VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """,
                ("legacyOwnerUserId", Jsonb(payload.get("legacyOwnerUserId"))),
            )
            if valid_users:
                with conn.cursor() as cur:
                    cur.executemany(
                        """
                        INSERT INTO auth_users (id, username, created_at, credentials, email, provider, provider_id, display_name)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            username = EXCLUDED.username,
                            created_at = EXCLUDED.created_at,
                            email = EXCLUDED.email,
                            provider = EXCLUDED.provider,
                            provider_id = EXCLUDED.provider_id,
                            display_name = EXCLUDED.display_name
                        """,
                        [
                            (
                                str(user["id"]),
                                str(user["username"]),
                                str(user["createdAt"]),
                                Jsonb([]),
                                user.get("email"),
                                user.get("provider"),
                                user.get("providerId"),
                                user.get("displayName"),
                            )
                            for user in valid_users
                        ],
                    )
            if user_ids:
                conn.execute("DELETE FROM auth_users WHERE id <> ALL(%s)", (user_ids,))
            else:
                conn.execute("DELETE FROM auth_users")
            conn.commit()

    def create_user(
        self,
        user_id: str,
        username: str,
        email: str | None,
        provider: str,
        provider_id: str | None,
        display_name: str | None,
    ) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO auth_users (id, username, created_at, credentials, email, provider, provider_id, display_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, username, isoformat(), Jsonb([]), email, provider, provider_id, display_name),
            )
            conn.commit()

    def find_user_by_provider(self, provider: str, provider_id: str) -> dict[str, Any] | None:
        with self._pool.connection() as conn:
            row = conn.execute(
                """
                SELECT id, username, email, provider, provider_id, display_name, created_at
                FROM auth_users WHERE provider = %s AND provider_id = %s
                """,
                (provider, provider_id),
            ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"], "username": row["username"], "email": row["email"],
            "provider": row["provider"], "providerId": row["provider_id"],
            "displayName": row["display_name"], "createdAt": row["created_at"],
        }

    def find_user_by_email(self, email: str) -> dict[str, Any] | None:
        with self._pool.connection() as conn:
            row = conn.execute(
                """
                SELECT id, username, email, provider, provider_id, display_name, created_at
                FROM auth_users WHERE email = %s
                """,
                (email.lower().strip(),),
            ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"], "username": row["username"], "email": row["email"],
            "provider": row["provider"], "providerId": row["provider_id"],
            "displayName": row["display_name"], "createdAt": row["created_at"],
        }

    def find_user_by_username(self, username: str) -> bool:
        with self._pool.connection() as conn:
            row = conn.execute(
                "SELECT 1 FROM auth_users WHERE username = %s", (username,)
            ).fetchone()
        return row is not None

    def create_oauth_state(self, state: str, provider: str) -> None:
        expires_at = isoformat(utc_now() + OAUTH_STATE_TTL_SECONDS)
        with self._pool.connection() as conn:
            conn.execute(
                "INSERT INTO oauth_states (state, provider, created_at, expires_at) VALUES (%s, %s, %s, %s)",
                (state, provider, isoformat(), expires_at),
            )
            conn.execute("DELETE FROM oauth_states WHERE expires_at < %s", (isoformat(),))
            conn.commit()

    def consume_oauth_state(self, state: str) -> dict[str, Any] | None:
        with self._pool.connection() as conn:
            row = conn.execute(
                "SELECT provider, expires_at FROM oauth_states WHERE state = %s", (state,)
            ).fetchone()
            conn.execute("DELETE FROM oauth_states WHERE state = %s", (state,))
            conn.commit()
        if not row:
            return None
        if (parse_iso8601(row["expires_at"]) or 0) < utc_now():
            return None
        return {"provider": row["provider"]}

    def create_magic_link_token(self, token: str, email: str) -> None:
        expires_at = isoformat(utc_now() + MAGIC_LINK_TTL_SECONDS)
        with self._pool.connection() as conn:
            conn.execute(
                "INSERT INTO magic_link_tokens (token, email, created_at, expires_at) VALUES (%s, %s, %s, %s)",
                (token, email.lower().strip(), isoformat(), expires_at),
            )
            conn.execute("DELETE FROM magic_link_tokens WHERE expires_at < %s", (isoformat(),))
            conn.commit()

    def consume_magic_link_token(self, token: str) -> str | None:
        with self._pool.connection() as conn:
            row = conn.execute(
                "SELECT email, expires_at FROM magic_link_tokens WHERE token = %s", (token,)
            ).fetchone()
            conn.execute("DELETE FROM magic_link_tokens WHERE token = %s", (token,))
            conn.commit()
        if not row:
            return None
        if (parse_iso8601(row["expires_at"]) or 0) < utc_now():
            return None
        return row["email"]

    def load_notes(self, user_id: str) -> list[dict[str, Any]]:
        with self._pool.connection() as conn:
            rows = conn.execute(
                "SELECT note_id, title_enc, body_enc, updated_at FROM notes WHERE user_id = %s ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        return [
            {"id": r["note_id"], "titleEnc": r["title_enc"], "bodyEnc": r["body_enc"], "updatedAt": r["updated_at"]}
            for r in rows
        ]

    def save_note(self, user_id: str, note_id: str, title_enc: str, body_enc: str) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO notes (user_id, note_id, title_enc, body_enc, updated_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id, note_id) DO UPDATE SET
                    title_enc = EXCLUDED.title_enc,
                    body_enc = EXCLUDED.body_enc,
                    updated_at = EXCLUDED.updated_at
                """,
                (user_id, note_id, title_enc, body_enc, isoformat()),
            )
            conn.commit()

    def delete_note(self, user_id: str, note_id: str) -> None:
        with self._pool.connection() as conn:
            conn.execute("DELETE FROM notes WHERE user_id = %s AND note_id = %s", (user_id, note_id))
            conn.commit()

    def load_sessions(self) -> list[dict[str, Any]]:
        with self._pool.connection() as conn:
            rows = conn.execute(
                """
                SELECT id, user_id, created_at, last_seen_at, expires_at
                FROM auth_sessions
                ORDER BY created_at ASC
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "userId": row["user_id"],
                "createdAt": row["created_at"],
                "lastSeenAt": row["last_seen_at"],
                "expiresAt": row["expires_at"],
            }
            for row in rows
        ]

    def save_sessions(self, sessions: list[dict[str, Any]]) -> None:
        valid_sessions = [
            session
            for session in sessions
            if isinstance(session, dict) and session.get("id") and session.get("userId")
        ]
        session_ids = [str(session["id"]) for session in valid_sessions]
        with self._pool.connection() as conn:
            if valid_sessions:
                with conn.cursor() as cur:
                    cur.executemany(
                        """
                        INSERT INTO auth_sessions (id, user_id, created_at, last_seen_at, expires_at)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            user_id = EXCLUDED.user_id,
                            created_at = EXCLUDED.created_at,
                            last_seen_at = EXCLUDED.last_seen_at,
                            expires_at = EXCLUDED.expires_at
                        """,
                        [
                            (
                                str(s["id"]),
                                str(s["userId"]),
                                str(s["createdAt"]),
                                str(s["lastSeenAt"]),
                                str(s["expiresAt"]),
                            )
                            for s in valid_sessions
                        ],
                    )
            if session_ids:
                conn.execute("DELETE FROM auth_sessions WHERE id <> ALL(%s)", (session_ids,))
            else:
                conn.execute("DELETE FROM auth_sessions")
            conn.commit()

    def load_user_state(self, user_id: str) -> dict[str, Any] | None:
        with self._pool.connection() as conn:
            row = conn.execute(
                "SELECT state FROM user_states WHERE user_id = %s",
                (user_id,),
            ).fetchone()
        state = row["state"] if row else None
        return state if isinstance(state, dict) else None

    def save_user_state(self, user_id: str, state: dict[str, Any]) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO user_states (user_id, state, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    state = EXCLUDED.state,
                    updated_at = EXCLUDED.updated_at
                """,
                (user_id, Jsonb(state), isoformat()),
            )
            conn.commit()

    def import_existing_json_data(self) -> None:
        """One-shot migration: import user state from legacy JSON files."""
        if self.auth_users_exist() or not AUTH_USERS_FILE.exists():
            return
        try:
            users_payload = json.loads(AUTH_USERS_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if not isinstance(users_payload, dict):
            return
        users = users_payload.get("users", [])
        if not isinstance(users, list) or not users:
            return
        # Import user records (passkey users — they cannot log in but their state is preserved)
        self.save_users_payload(users_payload)
        if AUTH_SESSIONS_FILE.exists():
            try:
                sessions_payload = json.loads(AUTH_SESSIONS_FILE.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                sessions_payload = {}
            sessions = sessions_payload.get("sessions", []) if isinstance(sessions_payload, dict) else []
            if isinstance(sessions, list):
                self.save_sessions([s for s in sessions if isinstance(s, dict)])
        for user in users:
            if not isinstance(user, dict):
                continue
            user_id = str(user.get("id") or "").strip()
            if not user_id:
                continue
            user_dir = USER_DATA_DIR / user_id
            state_file = user_dir / "state.json"
            if (
                users_payload.get("legacyOwnerUserId") == user_id
                and not state_file.exists()
                and STATE_FILE.exists()
            ):
                state_file = STATE_FILE
            if state_file.exists():
                try:
                    state = json.loads(state_file.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    state = None
                if isinstance(state, dict):
                    self.save_user_state(user_id, state)


class UserStateBackend:
    def __init__(self, postgres: PostgresBackend, user_id: str) -> None:
        self._postgres = postgres
        self._user_id = user_id

    def load(self) -> dict[str, Any] | None:
        return self._postgres.load_user_state(self._user_id)

    def save(self, state: dict[str, Any]) -> None:
        self._postgres.save_user_state(self._user_id, state)
        _sse_notify(self._user_id)


class TodoStore:
    def __init__(self, state_backend: UserStateBackend) -> None:
        self._lock = threading.Lock()
        self._state_backend = state_backend
        self._monzo_access_token: str | None = None
        self._quickmail_password: str | None = None
        self._quickmail_oauth_states: dict[str, dict[str, Any]] = {}
        self._outlook_ics_cache: list[dict[str, Any]] = []
        self._outlook_ics_cache_at = 0.0
        self._outlook_ics_cache_url = ""
        self._state = self._load_state()
        self._ensure_schedule_locked()

    def _default_state(self) -> dict[str, Any]:
        return {
            "tasks": [],
            "alerts": {
                "enabled": True,
                "nextAlertAt": None,
                "testPushEnabled": False,
                "nextTestPushAt": None,
                "nextUrgentAlertAt": None,
                "pending": [],
            },
            "outlook": {
                "email": "",
                "icsUrl": "",
                "syncMode": "outlook-to-today",
                "autoSyncEnabled": False,
                "lastSyncAt": None,
                "lastSyncResult": None,
            },
            "monzo": {
                "accountId": "",
                "accountDescription": "",
                "connectionProvider": "",
                "connectionStatus": "",
                "providerId": "",
                "accessTokenEnc": "",
                "refreshTokenEnc": "",
                "tokenExpiresAt": 0.0,
                "consentExpiresAt": None,
                "scopes": [],
                "balanceAmountMinor": None,
                "balanceCurrency": "",
                "lastSyncAt": None,
                "lastSyncResult": None,
            },
            "banking": {
                "provider": "",
                "connectionProvider": "",
                "connectionStatus": "",
                "institutionId": "",
                "institutionName": "",
                "requisitionId": "",
                "accountId": "",
                "accountIds": [],
                "accountDescription": "",
                "providerId": "",
                "accessTokenEnc": "",
                "refreshTokenEnc": "",
                "tokenExpiresAt": 0.0,
                "refreshTokenExpiresAt": 0.0,
                "consentExpiresAt": None,
                "scopes": [],
                "balanceAmountMinor": None,
                "balanceCurrency": "",
                "lastSyncAt": None,
                "lastSyncResult": None,
            },
            "quickmailAccount": {
                "email": "",
                "displayName": "",
                "imapHost": "",
                "imapPort": 993,
                "smtpHost": "",
                "smtpPort": 465,
                "authType": "",
                "oauthProvider": "",
                "accessToken": "",
                "refreshToken": "",
                "tokenExpiresAt": 0.0,
            },
            "pushSubscriptions": [],
            "planBlockReminder": {
                "nextBlock": None,
                "lastSentKey": None,
            },
            "rssNewsNotifications": {
                "enabled": False,
                "frequency": 3,
                "times": list(RSS_NEWS_DEFAULT_TIMES),
                "feedUrls": [],
                "lastSentSlotKey": None,
                "sentItemKeys": [],
            },
            "notificationReminders": {
                "items": [],
            },
            "clientState": {},
        }

    def _load_state(self) -> dict[str, Any]:
        loaded = self._state_backend.load()
        if not isinstance(loaded, dict):
            return self._default_state()

        tasks = loaded.get("tasks", [])
        alerts = loaded.get("alerts", {})
        outlook = loaded.get("outlook", {})
        monzo = loaded.get("monzo", {})
        banking = loaded.get("banking", {})
        quickmail_account = loaded.get("quickmailAccount", {})
        subscriptions = loaded.get("pushSubscriptions", [])
        plan_block_reminder = loaded.get("planBlockReminder", {})
        rss_news_notifications = loaded.get("rssNewsNotifications", {})
        notification_reminders = loaded.get("notificationReminders", {})
        client_state = loaded.get("clientState", {})
        if not isinstance(plan_block_reminder, dict):
            plan_block_reminder = {}

        return {
            "tasks": [self._normalize_task(task) for task in tasks if isinstance(task, dict)],
            "alerts": {
                "enabled": alerts.get("enabled", True) is not False,
                "nextAlertAt": self._normalize_iso(alerts.get("nextAlertAt")),
                "testPushEnabled": alerts.get("testPushEnabled", False) is True,
                "nextTestPushAt": self._normalize_iso(alerts.get("nextTestPushAt")),
                "nextUrgentAlertAt": self._normalize_iso(alerts.get("nextUrgentAlertAt")),
                "pending": [
                    self._normalize_alert(alert)
                    for alert in alerts.get("pending", [])
                    if isinstance(alert, dict)
                ],
            },
            "outlook": self._normalize_outlook_settings(outlook),
            "monzo": self._normalize_monzo_settings(monzo),
            "banking": self._normalize_banking_settings(banking, legacy_monzo=monzo),
            "quickmailAccount": self._normalize_quickmail_account(quickmail_account),
            "pushSubscriptions": [
                self._normalize_subscription(item)
                for item in subscriptions
                if self._is_valid_subscription(item)
            ],
            "planBlockReminder": {
                "nextBlock": self._normalize_plan_block_reminder(plan_block_reminder.get("nextBlock")),
                "lastSentKey": str(plan_block_reminder.get("lastSentKey") or "") or None,
            },
            "rssNewsNotifications": self._normalize_rss_news_notifications(rss_news_notifications),
            "notificationReminders": normalize_notification_reminders(notification_reminders),
            "clientState": self._normalize_json_value(client_state, default={}),
        }

    def _save_state_locked(self) -> None:
        self._state_backend.save(self._state)

    def _normalize_json_value(self, value: Any, *, default: Any = None) -> Any:
        if value is None:
            return default
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, list):
            return [self._normalize_json_value(item) for item in value]
        if isinstance(value, dict):
            normalized: dict[str, Any] = {}
            for key, item in value.items():
                clean_key = str(key or "").strip()
                if not clean_key:
                    continue
                normalized[clean_key] = self._normalize_json_value(item)
            return normalized
        return default

    def _normalize_task_priority(self, value: Any) -> str:
        priority = str(value or "none").strip().lower()
        if priority == "orange":
            return "important"
        if priority == "red":
            return "urgent"
        if priority not in {"none", "important", "urgent"}:
            return "none"
        return priority

    def _normalize_task(self, task: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(task.get("id") or uuid.uuid4()),
            "text": str(task.get("text") or "").strip(),
            "completed": bool(task.get("completed")),
            "pinned": bool(task.get("pinned")),
            "priority": self._normalize_task_priority(task.get("priority")),
            "createdAt": self._normalize_iso(task.get("createdAt")) or isoformat(),
            "completedAt": self._normalize_iso(task.get("completedAt")),
            "updatedAt": self._normalize_iso(task.get("updatedAt")) or isoformat(),
            "externalSource": str(task.get("externalSource") or "").strip() or None,
            "externalId": str(task.get("externalId") or "").strip() or None,
        }

    def _normalize_outlook_settings(self, outlook: Any) -> dict[str, Any]:
        payload = outlook if isinstance(outlook, dict) else {}
        sync_mode = str(payload.get("syncMode") or "outlook-to-today").strip() or "outlook-to-today"
        if sync_mode not in {"two-way", "today-to-outlook", "outlook-to-today"}:
            sync_mode = "outlook-to-today"
        ics_url = str(payload.get("icsUrl") or payload.get("calendarId") or "").strip()
        return {
            "email": str(payload.get("email") or "").strip(),
            "icsUrl": ics_url,
            "syncMode": sync_mode,
            "autoSyncEnabled": payload.get("autoSyncEnabled", False) is True,
            "lastSyncAt": self._normalize_iso(payload.get("lastSyncAt")),
            "lastSyncResult": str(payload.get("lastSyncResult") or "").strip() or None,
        }

    def _normalize_monzo_settings(self, monzo: Any) -> dict[str, Any]:
        payload = monzo if isinstance(monzo, dict) else {}
        connection_provider = str(payload.get("connectionProvider") or payload.get("provider") or "").strip().lower()
        if connection_provider not in {"", "monzo-developer", "truelayer", "enable-banking"}:
            connection_provider = ""
        try:
            token_expires_at = float(payload.get("tokenExpiresAt") or 0)
        except (TypeError, ValueError):
            token_expires_at = 0.0
        raw_scopes = payload.get("scopes")
        if isinstance(raw_scopes, str):
            scopes = [scope for scope in raw_scopes.split() if scope]
        elif isinstance(raw_scopes, list):
            scopes = [str(scope).strip() for scope in raw_scopes if str(scope or "").strip()]
        else:
            scopes = []
        raw_balance_minor = payload.get("balanceAmountMinor")
        try:
            balance_amount_minor = int(raw_balance_minor) if raw_balance_minor is not None else None
        except (TypeError, ValueError):
            balance_amount_minor = None
        return {
            "accountId": str(payload.get("accountId") or "").strip(),
            "accountDescription": str(payload.get("accountDescription") or "").strip(),
            "connectionProvider": connection_provider,
            "connectionStatus": str(payload.get("connectionStatus") or "").strip() or None,
            "providerId": str(payload.get("providerId") or "").strip(),
            "accessTokenEnc": str(payload.get("accessTokenEnc") or "").strip(),
            "refreshTokenEnc": str(payload.get("refreshTokenEnc") or "").strip(),
            "tokenExpiresAt": token_expires_at,
            "consentExpiresAt": self._normalize_iso(payload.get("consentExpiresAt")),
            "scopes": scopes,
            "balanceAmountMinor": balance_amount_minor,
            "balanceCurrency": str(payload.get("balanceCurrency") or "").strip().upper(),
            "lastSyncAt": self._normalize_iso(payload.get("lastSyncAt")),
            "lastSyncResult": str(payload.get("lastSyncResult") or "").strip() or None,
        }

    def _normalize_banking_settings(self, banking: Any, *, legacy_monzo: Any = None) -> dict[str, Any]:
        payload = banking if isinstance(banking, dict) else {}
        if not payload and isinstance(legacy_monzo, dict):
            payload = legacy_monzo
        provider = str(payload.get("provider") or payload.get("connectionProvider") or "").strip().lower()
        supported_providers = {"", "enable-banking", "truelayer", "monzo-developer", "csv"}
        previous_provider_removed = bool(provider and provider not in supported_providers)
        if previous_provider_removed:
            provider = ""
        if provider not in supported_providers:
            provider = ""
        try:
            token_expires_at = float(payload.get("tokenExpiresAt") or 0)
        except (TypeError, ValueError):
            token_expires_at = 0.0
        try:
            refresh_token_expires_at = float(payload.get("refreshTokenExpiresAt") or 0)
        except (TypeError, ValueError):
            refresh_token_expires_at = 0.0
        raw_scopes = payload.get("scopes")
        if isinstance(raw_scopes, str):
            scopes = [scope for scope in raw_scopes.split() if scope]
        elif isinstance(raw_scopes, list):
            scopes = [str(scope).strip() for scope in raw_scopes if str(scope or "").strip()]
        else:
            scopes = []
        raw_account_ids = payload.get("accountIds")
        if isinstance(raw_account_ids, list):
            account_ids = [str(account_id).strip() for account_id in raw_account_ids if str(account_id or "").strip()]
        else:
            single_account_id = str(payload.get("accountId") or "").strip()
            account_ids = [single_account_id] if single_account_id else []
        raw_balance_minor = payload.get("balanceAmountMinor")
        try:
            balance_amount_minor = int(raw_balance_minor) if raw_balance_minor is not None else None
        except (TypeError, ValueError):
            balance_amount_minor = None
        if previous_provider_removed:
            account_ids = []
        account_id = "" if previous_provider_removed else str(payload.get("accountId") or "").strip() or (account_ids[0] if account_ids else "")
        return {
            "provider": provider,
            "connectionProvider": provider,
            "connectionStatus": "needs-reconnect" if previous_provider_removed else str(payload.get("connectionStatus") or "").strip() or None,
            "institutionId": str(payload.get("institutionId") or payload.get("providerId") or "").strip(),
            "institutionName": str(payload.get("institutionName") or "").strip(),
            "requisitionId": str(payload.get("requisitionId") or "").strip(),
            "sessionId": "" if previous_provider_removed else str(payload.get("sessionId") or payload.get("session_id") or "").strip(),
            "aspspName": str(payload.get("aspspName") or payload.get("institutionName") or "").strip(),
            "aspspCountry": str(payload.get("aspspCountry") or "").strip().upper()[:2],
            "accountId": account_id,
            "accountIds": account_ids,
            "accountDescription": str(payload.get("accountDescription") or "").strip(),
            "providerId": str(payload.get("providerId") or payload.get("institutionId") or "").strip(),
            "accessTokenEnc": "" if previous_provider_removed else str(payload.get("accessTokenEnc") or "").strip(),
            "refreshTokenEnc": "" if previous_provider_removed else str(payload.get("refreshTokenEnc") or "").strip(),
            "tokenExpiresAt": token_expires_at,
            "refreshTokenExpiresAt": refresh_token_expires_at,
            "consentExpiresAt": self._normalize_iso(payload.get("consentExpiresAt")),
            "scopes": scopes,
            "balanceAmountMinor": balance_amount_minor,
            "balanceCurrency": str(payload.get("balanceCurrency") or "").strip().upper(),
            "lastSyncAt": self._normalize_iso(payload.get("lastSyncAt")),
            "lastSyncResult": (
                "Previous bank-sync provider is no longer supported. Connect with Enable Banking or import CSV."
                if previous_provider_removed
                else str(payload.get("lastSyncResult") or "").strip() or None
            ),
        }

    def _normalize_quickmail_account(self, account: Any) -> dict[str, Any]:
        payload = account if isinstance(account, dict) else {}
        imap_port = int(payload.get("imapPort") or 993)
        smtp_port = int(payload.get("smtpPort") or 465)
        auth_type = str(payload.get("authType") or "").strip().lower()
        if auth_type not in {"", "password", "oauth"}:
            auth_type = ""
        oauth_provider = str(payload.get("oauthProvider") or payload.get("provider") or "").strip().lower()
        if oauth_provider not in {"", "google", "microsoft"}:
            oauth_provider = ""
        try:
            token_expires_at = float(payload.get("tokenExpiresAt") or 0)
        except (TypeError, ValueError):
            token_expires_at = 0.0
        return {
            "email": str(payload.get("email") or "").strip(),
            "displayName": str(payload.get("displayName") or "").strip(),
            "imapHost": str(payload.get("imapHost") or "").strip(),
            "imapPort": imap_port if 1 <= imap_port <= 65535 else 993,
            "smtpHost": str(payload.get("smtpHost") or "").strip(),
            "smtpPort": smtp_port if 1 <= smtp_port <= 65535 else 465,
            "authType": auth_type,
            "oauthProvider": oauth_provider,
            "accessToken": str(payload.get("accessToken") or "").strip(),
            "refreshToken": str(payload.get("refreshToken") or "").strip(),
            "tokenExpiresAt": token_expires_at,
        }

    def _normalize_alert(self, alert: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(alert.get("id") or uuid.uuid4()),
            "taskId": str(alert.get("taskId") or ""),
            "text": str(alert.get("text") or "").strip(),
            "scheduledAt": self._normalize_iso(alert.get("scheduledAt")) or isoformat(),
        }

    def _normalize_subscription(self, subscription: dict[str, Any]) -> dict[str, Any]:
        return {
            "endpoint": str(subscription.get("endpoint") or ""),
            "expirationTime": subscription.get("expirationTime"),
            "keys": {
                "p256dh": str(subscription.get("keys", {}).get("p256dh") or ""),
                "auth": str(subscription.get("keys", {}).get("auth") or ""),
            },
        }

    def _normalize_plan_block_reminder(self, value: Any) -> dict[str, Any] | None:
        if not isinstance(value, dict):
            return None
        start_at = self._normalize_iso(value.get("startAt"))
        reminder_at = self._normalize_iso(value.get("reminderAt"))
        label = str(value.get("label") or "").strip()
        if not start_at or not reminder_at or not label:
            return None
        try:
            reminder_minutes = max(0, min(120, int(value.get("reminderMinutes"))))
        except (TypeError, ValueError):
            reminder_minutes = 15
        return {
            "id": str(value.get("id") or "next"),
            "label": label,
            "sourceType": str(value.get("sourceType") or "block"),
            "startAt": start_at,
            "reminderAt": reminder_at,
            "reminderMinutes": reminder_minutes,
        }

    def _normalize_rss_news_notifications(self, value: Any) -> dict[str, Any]:
        payload = value if isinstance(value, dict) else {}
        try:
            frequency = max(1, min(6, int(payload.get("frequency", 3))))
        except (TypeError, ValueError):
            frequency = 3
        times = [
            str(item).strip()
            for item in (payload.get("times") if isinstance(payload.get("times"), list) else list(RSS_NEWS_DEFAULT_TIMES))
            if isinstance(item, str) and parse_hhmm(item.strip()) is not None
        ]
        if not times:
            times = list(RSS_NEWS_DEFAULT_TIMES)
        feed_urls = []
        for url in payload.get("feedUrls") if isinstance(payload.get("feedUrls"), list) else []:
            clean_url = str(url or "").strip()
            parsed = urlparse(clean_url)
            if parsed.scheme in {"http", "https"} and parsed.netloc and clean_url not in feed_urls:
                feed_urls.append(clean_url)
            if len(feed_urls) >= RSS_NEWS_MAX_FEEDS:
                break
        sent_item_keys = [
            str(item or "").strip()
            for item in payload.get("sentItemKeys", [])
            if str(item or "").strip()
        ][:RSS_NEWS_RECENT_ITEM_LIMIT]
        return {
            "enabled": payload.get("enabled", False) is True,
            "frequency": frequency,
            "times": sorted(set(times))[:6],
            "feedUrls": feed_urls,
            "lastSentSlotKey": str(payload.get("lastSentSlotKey") or "") or None,
            "sentItemKeys": sent_item_keys,
        }

    def _normalize_iso(self, value: str | None) -> str | None:
        parsed = parse_iso8601(value)
        return isoformat(parsed) if parsed is not None else None

    def _is_valid_subscription(self, subscription: Any) -> bool:
        if not isinstance(subscription, dict):
            return False

        keys = subscription.get("keys")
        p256dh = keys.get("p256dh") if isinstance(keys, dict) else None
        auth = keys.get("auth") if isinstance(keys, dict) else None
        p256dh_raw = b64url_decode(p256dh) if isinstance(p256dh, str) else None
        auth_raw = b64url_decode(auth) if isinstance(auth, str) else None
        return (
            isinstance(subscription.get("endpoint"), str)
            and isinstance(keys, dict)
            and isinstance(p256dh, str)
            and isinstance(auth, str)
            and p256dh_raw is not None
            and len(p256dh_raw) == 65
            and auth_raw is not None
            and len(auth_raw) == 16
        )

    def get_state(self) -> dict[str, Any]:
        with self._lock:
            return self._state_response_locked()

    def get_client_state(self) -> dict[str, Any]:
        with self._lock:
            return self._normalize_json_value(self._state.get("clientState", {}), default={})

    def update_client_state(self, payload: Any) -> dict[str, Any]:
        with self._lock:
            self._state["clientState"] = self._normalize_json_value(payload, default={})
            self._save_state_locked()
            return self._normalize_json_value(self._state["clientState"], default={})

    def import_backup_state(self, payload: Any) -> dict[str, Any]:
        state_payload = payload if isinstance(payload, dict) else {}
        tasks = state_payload.get("tasks", [])
        alerts = state_payload.get("alerts", {})
        outlook = state_payload.get("outlook", {})
        monzo = state_payload.get("monzo", {})

        with self._lock:
            push_subscriptions = list(self._state.get("pushSubscriptions", []))
            plan_block_reminder = dict(self._state.get("planBlockReminder", {}))
            rss_news_notifications = dict(self._state.get("rssNewsNotifications", {}))
            notification_reminders = dict(self._state.get("notificationReminders", {}))
            client_state = self._state.get("clientState", {})
            quickmail_account = self._state.get("quickmailAccount", {})
            self._monzo_access_token = None
            self._outlook_ics_cache = []
            self._outlook_ics_cache_at = 0.0
            self._outlook_ics_cache_url = ""
            self._state = {
                "tasks": [self._normalize_task(task) for task in tasks if isinstance(task, dict)],
                "alerts": {
                    "enabled": alerts.get("enabled", True) is not False,
                    "nextAlertAt": self._normalize_iso(alerts.get("nextAlertAt")),
                    "testPushEnabled": alerts.get("testPushEnabled", False) is True,
                    "nextTestPushAt": self._normalize_iso(alerts.get("nextTestPushAt")),
                    "nextUrgentAlertAt": None,
                    "pending": [],
                },
                "outlook": self._normalize_outlook_settings(outlook),
                "monzo": self._normalize_monzo_settings(monzo),
                "quickmailAccount": self._normalize_quickmail_account(quickmail_account),
                "pushSubscriptions": push_subscriptions,
                "planBlockReminder": {
                    "nextBlock": self._normalize_plan_block_reminder(plan_block_reminder.get("nextBlock")),
                    "lastSentKey": str(plan_block_reminder.get("lastSentKey") or "") or None,
                },
                "rssNewsNotifications": self._normalize_rss_news_notifications(rss_news_notifications),
                "notificationReminders": normalize_notification_reminders(notification_reminders),
                "clientState": self._normalize_json_value(client_state, default={}),
            }
            self._ensure_schedule_locked()
            self._save_state_locked()
            return self._state_response_locked()

    def get_push_config(self) -> dict[str, str]:
        return {"publicKey": VAPID_PUBLIC_KEY}

    def add_task(
        self,
        text: str,
        *,
        task_id: str | None = None,
        external_source: str | None = None,
        external_id: str | None = None,
    ) -> dict[str, Any]:
        clean = text.strip()
        if not clean:
            raise ValueError("Task text is required")

        with self._lock:
            now = isoformat()
            task = {
                "id": str(task_id or uuid.uuid4()),
                "text": clean,
                "completed": False,
                "pinned": False,
                "priority": "none",
                "createdAt": now,
                "completedAt": None,
                "updatedAt": now,
                "externalSource": external_source,
                "externalId": external_id,
            }
            self._state["tasks"].insert(0, task)
            self._ensure_schedule_locked()
            self._save_state_locked()
            return self._state_response_locked()

    def import_tasks(self, text: str) -> dict[str, Any]:
        lines = [line.strip() for line in text.splitlines()]
        tasks_to_add = [line for line in lines if line]
        if not tasks_to_add:
            raise ValueError("At least one task is required")

        with self._lock:
            new_tasks = [
                {
                    "id": str(uuid.uuid4()),
                    "text": task_text,
                    "completed": False,
                    "pinned": False,
                    "priority": "none",
                    "createdAt": isoformat(),
                    "completedAt": None,
                    "updatedAt": isoformat(),
                    "externalSource": None,
                    "externalId": None,
                }
                for task_text in tasks_to_add
            ]
            self._state["tasks"] = new_tasks + self._state["tasks"]
            self._ensure_schedule_locked()
            self._save_state_locked()
            return self._state_response_locked()

    def update_task(
        self,
        task_id: str,
        *,
        completed: bool | None = None,
        pinned: bool | None = None,
        priority: str | None = None,
        text: str | None = None,
    ) -> dict[str, Any] | None:
        with self._lock:
            for task in self._state["tasks"]:
                if task["id"] == task_id:
                    if text is not None:
                        task["text"] = text
                    if completed is not None:
                        next_completed = bool(completed)
                        if next_completed and not task["completed"]:
                            task["completedAt"] = isoformat()
                        elif not next_completed:
                            task["completedAt"] = None
                        task["completed"] = next_completed
                    if pinned is not None:
                        task["pinned"] = bool(pinned)
                    if priority is not None:
                        task["priority"] = self._normalize_task_priority(priority)
                    task["updatedAt"] = isoformat()
                    self._ensure_schedule_locked()
                    self._save_state_locked()
                    return self._state_response_locked()

        return None

    def delete_task(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            self._state["tasks"] = [
                task for task in self._state["tasks"] if task["id"] != task_id
            ]
            self._state["alerts"]["pending"] = [
                alert
                for alert in self._state["alerts"]["pending"]
                if alert["taskId"] != task_id
            ]
            self._ensure_schedule_locked()
            self._save_state_locked()
            return self._state_response_locked()

    def clear_completed(self) -> dict[str, Any]:
        with self._lock:
            completed_tasks = [
                task for task in self._state["tasks"] if task.get("completed")
            ]
            completed_ids = {task["id"] for task in completed_tasks}
            self._state["tasks"] = [
                task for task in self._state["tasks"] if not task.get("completed")
            ]
            self._state["alerts"]["pending"] = [
                alert
                for alert in self._state["alerts"]["pending"]
                if alert["taskId"] not in completed_ids
            ]
            self._ensure_schedule_locked()
            self._save_state_locked()
            return self._state_response_locked()

    def set_alerts_enabled(self, enabled: bool) -> dict[str, Any]:
        with self._lock:
            self._state["alerts"]["enabled"] = bool(enabled)
            if enabled:
                self._ensure_schedule_locked(force=True)
            else:
                self._state["alerts"]["nextAlertAt"] = None
            self._save_state_locked()
            return self._state_response_locked()

    def set_test_push_enabled(self, enabled: bool) -> dict[str, Any]:
        with self._lock:
            self._state["alerts"]["testPushEnabled"] = bool(enabled)
            self._state["alerts"]["nextTestPushAt"] = (
                isoformat(utc_now() + TEST_PUSH_INTERVAL_SECONDS)
                if enabled
                else None
            )
            self._save_state_locked()
            return self._state_response_locked()

    def set_plan_block_reminder(self, next_block: Any) -> dict[str, Any]:
        with self._lock:
            self._state["planBlockReminder"] = {
                "nextBlock": self._normalize_plan_block_reminder(next_block),
                "lastSentKey": None,
            }
            self._save_state_locked()
            return self._state_response_locked()

    def update_rss_news_notification_settings(
        self,
        *,
        enabled: Any = None,
        frequency: Any = None,
        times: Any = None,
        feed_urls: Any = None,
    ) -> dict[str, Any]:
        with self._lock:
            current = dict(self._state.get("rssNewsNotifications", {}))
            if enabled is not None:
                current["enabled"] = enabled is True
            if frequency is not None:
                current["frequency"] = frequency
            if times is not None:
                current["times"] = times
            if feed_urls is not None:
                current["feedUrls"] = feed_urls
            current.setdefault("lastSentSlotKey", self._state["rssNewsNotifications"].get("lastSentSlotKey"))
            current.setdefault("sentItemKeys", self._state["rssNewsNotifications"].get("sentItemKeys", []))
            self._state["rssNewsNotifications"] = self._normalize_rss_news_notifications(current)
            self._save_state_locked()
            return self._state_response_locked()

    def update_notification_reminders(self, reminders: Any) -> dict[str, Any]:
        with self._lock:
            self._state["notificationReminders"] = normalize_notification_reminders(reminders)
            self._save_state_locked()
            return self._state_response_locked()

    def update_outlook_settings(
        self,
        *,
        email: str | None = None,
        ics_url: str | None = None,
        sync_mode: str | None = None,
        auto_sync_enabled: bool | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            outlook = self._state["outlook"]
            if email is not None:
                outlook["email"] = email.strip()
            if ics_url is not None:
                cleaned_url = ics_url.strip()
                outlook["icsUrl"] = cleaned_url
                self._outlook_ics_cache = []
                self._outlook_ics_cache_at = 0.0
                self._outlook_ics_cache_url = cleaned_url
            if sync_mode is not None:
                clean_mode = sync_mode.strip()
                if clean_mode in {"two-way", "today-to-outlook", "outlook-to-today"}:
                    outlook["syncMode"] = clean_mode
            if auto_sync_enabled is not None:
                outlook["autoSyncEnabled"] = bool(auto_sync_enabled)
            if outlook["email"] and outlook["icsUrl"] and not outlook["lastSyncResult"]:
                outlook["lastSyncResult"] = "Configuration saved. Waiting for the first Outlook ICS import."
            self._save_state_locked()
            return self._state_response_locked()

    def get_outlook_calendar_events(self, *, force: bool = False) -> dict[str, Any]:
        with self._lock:
            ics_url = str(self._state["outlook"]["icsUrl"] or "").strip()
            cached_events = list(self._outlook_ics_cache)
            cache_age = utc_now() - self._outlook_ics_cache_at
            cached_url = self._outlook_ics_cache_url

        if not ics_url:
            return {"events": [], "cached": True, "state": self.get_state()}

        if not force and cached_events and cached_url == ics_url and cache_age < OUTLOOK_ICS_CACHE_TTL_SECONDS:
            return {"events": cached_events, "cached": True, "state": self.get_state()}

        parsed_ics = urlparse(ics_url)
        if parsed_ics.scheme not in {"http", "https"}:
            with self._lock:
                self._state["outlook"]["lastSyncResult"] = "ICS URL must use http or https."
                self._save_state_locked()
            return {"events": [], "cached": False, "state": self.get_state()}
        try:
            _validate_safe_url(ics_url)
        except ValueError as exc:
            with self._lock:
                self._state["outlook"]["lastSyncResult"] = f"ICS URL rejected: {exc}"
                self._save_state_locked()
            return {"events": [], "cached": False, "state": self.get_state()}

        try:
            fetched = fetch_safe_url_bytes(
                ics_url,
                headers={
                    "User-Agent": OUTLOOK_ICS_USER_AGENT,
                    "Accept": "text/calendar, text/plain;q=0.9, */*;q=0.8",
                },
                timeout=OUTLOOK_ICS_FETCH_TIMEOUT_SECONDS,
                max_bytes=OUTLOOK_ICS_MAX_BYTES,
                label="Outlook ICS calendar",
            )
        except ValueError as exc:
            with self._lock:
                self._state["outlook"]["lastSyncResult"] = f"ICS URL rejected: {exc}"
                self._save_state_locked()
            return {"events": [], "cached": False, "state": self.get_state()}
        except RuntimeError as exc:
            with self._lock:
                self._state["outlook"]["lastSyncResult"] = "Outlook ICS import failed."
                self._save_state_locked()
            raise RuntimeError(str(exc)) from exc

        try:
            events = parse_ics_events(fetched.body.decode(fetched.encoding, errors="replace"))
        except Exception as exc:
            with self._lock:
                self._state["outlook"]["lastSyncResult"] = "Outlook ICS import returned invalid calendar data."
                self._save_state_locked()
            raise RuntimeError("The Outlook ICS data could not be parsed.") from exc
        now_iso = isoformat()
        with self._lock:
            self._outlook_ics_cache = events
            self._outlook_ics_cache_at = utc_now()
            self._outlook_ics_cache_url = ics_url
            self._state["outlook"]["lastSyncAt"] = now_iso
            self._state["outlook"]["lastSyncResult"] = (
                f"Imported {len(events)} Outlook event{'s' if len(events) != 1 else ''} from ICS."
            )
            self._save_state_locked()
            state = self._state_response_locked()

        return {
            "events": events,
            "cached": False,
            "state": state,
        }

    def update_monzo_settings(
        self,
        *,
        access_token: str,
        account_id: str | None = None,
    ) -> dict[str, Any]:
        client = MonzoClient(access_token)
        accounts = client.list_accounts()
        if not accounts:
            raise MonzoApiError("No Monzo current accounts were returned for this token.")

        selected_account: dict[str, Any] | None = None
        clean_account_id = (account_id or "").strip()
        if clean_account_id:
            selected_account = next(
                (account for account in accounts if str(account.get("id") or "").strip() == clean_account_id),
                None,
            )
            if selected_account is None:
                raise MonzoApiError("The provided Monzo account ID was not found for this token.")
        else:
            selected_account = accounts[0]

        with self._lock:
            self._monzo_access_token = access_token.strip()
            monzo = self._state["monzo"]
            monzo["accountId"] = str(selected_account.get("id") or "").strip()
            monzo["accountDescription"] = str(selected_account.get("description") or "").strip()
            monzo["connectionProvider"] = "monzo-developer"
            monzo["connectionStatus"] = "connected"
            monzo["providerId"] = ""
            monzo["accessTokenEnc"] = ""
            monzo["refreshTokenEnc"] = ""
            monzo["tokenExpiresAt"] = 0.0
            monzo["consentExpiresAt"] = None
            monzo["scopes"] = []
            monzo["balanceAmountMinor"] = None
            monzo["balanceCurrency"] = ""
            monzo["lastSyncResult"] = "Connected. Recent expenses are ready to load."
            self._save_state_locked()
            return self._state_response_locked()

    @staticmethod
    def _truelayer_token_scopes(payload: dict[str, Any]) -> list[str]:
        raw_scopes = payload.get("scope") or payload.get("scopes") or TRUELAYER_DATA_SCOPES
        if isinstance(raw_scopes, list):
            return [str(scope).strip() for scope in raw_scopes if str(scope or "").strip()]
        return [scope for scope in str(raw_scopes or "").split() if scope]

    @staticmethod
    def _truelayer_token_expires_at(payload: dict[str, Any]) -> float:
        try:
            expires_in = float(payload.get("expires_in") or 3600)
        except (TypeError, ValueError):
            expires_in = 3600
        return utc_now() + max(60, expires_in)

    @staticmethod
    def _coerce_number(value: Any) -> float | None:
        if value is None:
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if number != number:
            return None
        return number

    @staticmethod
    def _amount_to_minor(value: float | None) -> int | None:
        if value is None:
            return None
        return int(round(value * 100))

    @staticmethod
    def _copy_banking_to_monzo_locked(banking: dict[str, Any], monzo: dict[str, Any]) -> None:
        monzo["accountId"] = str(banking.get("accountId") or "")
        monzo["accountDescription"] = str(banking.get("accountDescription") or banking.get("aspspName") or banking.get("institutionName") or "")
        monzo["connectionProvider"] = str(banking.get("provider") or banking.get("connectionProvider") or "")
        monzo["connectionStatus"] = str(banking.get("connectionStatus") or "")
        monzo["providerId"] = str(banking.get("providerId") or banking.get("institutionId") or "")
        monzo["accessTokenEnc"] = str(banking.get("accessTokenEnc") or "")
        monzo["refreshTokenEnc"] = str(banking.get("refreshTokenEnc") or "")
        monzo["tokenExpiresAt"] = float(banking.get("tokenExpiresAt") or 0)
        monzo["consentExpiresAt"] = banking.get("consentExpiresAt")
        monzo["scopes"] = list(banking.get("scopes") or [])
        monzo["balanceAmountMinor"] = banking.get("balanceAmountMinor")
        monzo["balanceCurrency"] = str(banking.get("balanceCurrency") or "")
        monzo["lastSyncAt"] = banking.get("lastSyncAt")
        monzo["lastSyncResult"] = banking.get("lastSyncResult")

    def _is_enable_banking_configured_locked(self, banking: dict[str, Any]) -> bool:
        return bool(
            banking.get("provider") == "enable-banking"
            and banking.get("sessionId")
            and banking.get("accountIds")
        )

    @staticmethod
    def _truelayer_account_description(account: dict[str, Any]) -> str:
        display_name = str(account.get("display_name") or "").strip()
        account_type = str(account.get("account_type") or "").strip().replace("_", " ").title()
        currency = str(account.get("currency") or "").strip().upper()
        parts = [display_name or "Monzo account"]
        details = " ".join(part for part in (account_type, currency) if part)
        if details:
            parts.append(details)
        return " - ".join(parts)

    @staticmethod
    def _truelayer_provider_id(account: dict[str, Any]) -> str:
        provider = account.get("provider")
        if isinstance(provider, dict):
            provider_id = str(provider.get("provider_id") or "").strip()
            if provider_id:
                return provider_id
        return str(account.get("provider_id") or "").strip()

    def _select_truelayer_account(self, accounts: list[dict[str, Any]]) -> dict[str, Any]:
        if not accounts:
            raise TrueLayerApiError("TrueLayer did not return any Monzo accounts.")

        def is_monzo_account(account: dict[str, Any]) -> bool:
            provider = account.get("provider")
            provider_id = self._truelayer_provider_id(account).lower()
            provider_name = ""
            if isinstance(provider, dict):
                provider_name = str(provider.get("display_name") or "").strip().lower()
            return "monzo" in provider_id or "monzo" in provider_name

        transaction_accounts = [
            account
            for account in accounts
            if str(account.get("account_type") or "").strip().upper() in {"TRANSACTION", "BUSINESS_TRANSACTION"}
        ]
        for account in transaction_accounts or accounts:
            if is_monzo_account(account):
                return account
        return (transaction_accounts or accounts)[0]

    def _extract_truelayer_balance(self, balances: list[dict[str, Any]]) -> tuple[int | None, str]:
        if not balances:
            return None, ""
        balance = balances[0]
        amount = self._coerce_number(balance.get("available"))
        if amount is None:
            amount = self._coerce_number(balance.get("current"))
        currency = str(balance.get("currency") or "").strip().upper()
        return self._amount_to_minor(amount), currency

    def _normalize_truelayer_expense(self, transaction: dict[str, Any]) -> dict[str, Any] | None:
        amount = self._coerce_number(transaction.get("amount"))
        if amount is None or amount == 0:
            return None
        transaction_type = str(transaction.get("transaction_type") or "").strip().lower()
        if amount > 0 and transaction_type not in {"debit", "card_payment", "purchase"}:
            return None

        metadata = transaction.get("meta")
        if not isinstance(metadata, dict):
            metadata = {}
        description = str(
            transaction.get("description")
            or transaction.get("transaction_information")
            or metadata.get("transaction_information")
            or ""
        ).strip()
        merchant_name = str(transaction.get("merchant_name") or metadata.get("merchant_name") or "").strip()
        category = str(
            transaction.get("transaction_category")
            or transaction.get("category")
            or metadata.get("provider_transaction_category")
            or ""
        ).strip() or None
        created = str(
            transaction.get("timestamp")
            or transaction.get("booking_date_time")
            or transaction.get("booking_date")
            or transaction.get("value_date")
            or ""
        ).strip() or None
        settled = str(transaction.get("booking_date") or transaction.get("value_date") or created or "").strip() or None
        currency = str(transaction.get("currency") or "").strip().upper() or "GBP"

        return {
            "id": str(transaction.get("transaction_id") or transaction.get("id") or uuid.uuid4()),
            "description": description,
            "merchantName": merchant_name,
            "amountMinor": abs(self._amount_to_minor(amount) or 0),
            "currency": currency,
            "created": created,
            "settled": settled,
            "category": category,
        }

    def _get_truelayer_access_token(self) -> str:
        with self._lock:
            monzo = self._state["monzo"]
            if not self._is_truelayer_monzo_configured_locked(monzo):
                raise TrueLayerApiError("Monzo is not connected through TrueLayer yet.")
            access_token_enc = str(monzo.get("accessTokenEnc") or "")
            refresh_token_enc = str(monzo.get("refreshTokenEnc") or "")
            token_expires_at = float(monzo.get("tokenExpiresAt") or 0)

        if access_token_enc and token_expires_at > utc_now() + 90:
            try:
                access_token = _decrypt_banking_token(access_token_enc)
            except Exception as exc:
                raise TrueLayerApiError("Stored TrueLayer access token could not be read.") from exc
            if access_token:
                return access_token

        try:
            refresh_token = _decrypt_banking_token(refresh_token_enc)
        except Exception as exc:
            raise TrueLayerApiError("Stored TrueLayer refresh token could not be read.") from exc
        if not refresh_token:
            raise TrueLayerApiError("TrueLayer refresh token is missing. Reconnect Monzo.")

        payload = TrueLayerClient().refresh_access_token(refresh_token)
        access_token = str(payload.get("access_token") or "").strip()
        if not access_token:
            raise TrueLayerApiError("TrueLayer did not return an access token.")
        next_refresh_token = str(payload.get("refresh_token") or "").strip() or refresh_token
        token_expires_at = self._truelayer_token_expires_at(payload)
        access_token_enc = _encrypt_banking_token(access_token)
        refresh_token_enc = _encrypt_banking_token(next_refresh_token)

        with self._lock:
            monzo = self._state["monzo"]
            monzo["accessTokenEnc"] = access_token_enc
            monzo["refreshTokenEnc"] = refresh_token_enc
            monzo["tokenExpiresAt"] = token_expires_at
            monzo["connectionStatus"] = "connected"
            monzo["scopes"] = self._truelayer_token_scopes(payload) or monzo.get("scopes") or []
            self._save_state_locked()

        return access_token

    def connect_truelayer_monzo(self, *, code: str, redirect_uri: str) -> dict[str, Any]:
        client = TrueLayerClient()
        payload = client.exchange_code(code=code, redirect_uri=redirect_uri)
        access_token = str(payload.get("access_token") or "").strip()
        refresh_token = str(payload.get("refresh_token") or "").strip()
        if not access_token:
            raise TrueLayerApiError("TrueLayer did not return an access token.")
        if not refresh_token:
            raise TrueLayerApiError("TrueLayer did not return a refresh token. Confirm offline_access is enabled.")

        accounts = client.list_accounts(access_token)
        selected_account = self._select_truelayer_account(accounts)
        account_id = str(selected_account.get("account_id") or "").strip()
        if not account_id:
            raise TrueLayerApiError("TrueLayer returned a Monzo account without an account_id.")

        balance_amount_minor: int | None = None
        balance_currency = ""
        try:
            balance_amount_minor, balance_currency = self._extract_truelayer_balance(
                client.get_account_balance(access_token, account_id)
            )
        except TrueLayerApiError:
            balance_amount_minor = None
            balance_currency = str(selected_account.get("currency") or "").strip().upper()

        with self._lock:
            self._monzo_access_token = None
            monzo = self._state["monzo"]
            monzo["accountId"] = account_id
            monzo["accountDescription"] = self._truelayer_account_description(selected_account)
            monzo["connectionProvider"] = "truelayer"
            monzo["connectionStatus"] = "connected"
            monzo["providerId"] = self._truelayer_provider_id(selected_account) or TRUELAYER_MONZO_PROVIDER_ID
            monzo["accessTokenEnc"] = _encrypt_banking_token(access_token)
            monzo["refreshTokenEnc"] = _encrypt_banking_token(refresh_token)
            monzo["tokenExpiresAt"] = self._truelayer_token_expires_at(payload)
            monzo["consentExpiresAt"] = isoformat(utc_now() + (90 * 24 * 60 * 60))
            monzo["scopes"] = self._truelayer_token_scopes(payload)
            monzo["balanceAmountMinor"] = balance_amount_minor
            monzo["balanceCurrency"] = balance_currency or str(selected_account.get("currency") or "").strip().upper()
            monzo["lastSyncAt"] = None
            monzo["lastSyncResult"] = "Connected via TrueLayer. Refresh recent spending to load transactions."
            self._save_state_locked()
            return self._state_response_locked()

    def _get_recent_truelayer_expenses(self, *, access_token: str, account_id: str, limit: int) -> list[dict[str, Any]]:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=max(1, TRUELAYER_TRANSACTION_SYNC_DAYS))
        transactions = TrueLayerClient().list_account_transactions(
            access_token,
            account_id,
            from_date=start.date().isoformat(),
            to_date=now.date().isoformat(),
        )
        expenses = []
        for transaction in transactions:
            expense = self._normalize_truelayer_expense(transaction)
            if expense is not None:
                expenses.append(expense)
        expenses.sort(key=lambda item: item.get("settled") or item.get("created") or "", reverse=True)
        return expenses[:limit]

    def get_recent_monzo_expenses(self, limit: int = 25) -> dict[str, Any]:
        with self._lock:
            access_token = self._monzo_access_token
            monzo = self._state["monzo"]
            account_id = monzo["accountId"]
            is_truelayer = self._is_truelayer_monzo_configured_locked(monzo)

        if is_truelayer and account_id:
            access_token = self._get_truelayer_access_token()
            expenses = self._get_recent_truelayer_expenses(
                access_token=access_token,
                account_id=account_id,
                limit=limit,
            )
            balance_amount_minor: int | None = None
            balance_currency = ""
            try:
                balance_amount_minor, balance_currency = self._extract_truelayer_balance(
                    TrueLayerClient().get_account_balance(access_token, account_id)
                )
            except TrueLayerApiError:
                pass

            with self._lock:
                monzo = self._state["monzo"]
                if balance_amount_minor is not None:
                    monzo["balanceAmountMinor"] = balance_amount_minor
                    monzo["balanceCurrency"] = balance_currency or monzo.get("balanceCurrency") or "GBP"
                monzo["connectionStatus"] = "connected"
                monzo["lastSyncAt"] = isoformat()
                monzo["lastSyncResult"] = f"Loaded {len(expenses)} recent expenses from TrueLayer."
                self._save_state_locked()
                monzo_response = self._monzo_response_locked()

            return {"expenses": expenses, "monzo": monzo_response}

        if not access_token or not account_id:
            raise MonzoApiError("Monzo access token and account must be configured first.")

        since = isoformat(utc_now() - (30 * 24 * 60 * 60))
        client = MonzoClient(access_token)
        transactions = client.list_transactions(account_id, since=since, limit=max(limit * 3, 60))

        expenses = []
        for transaction in transactions:
            amount = int(transaction.get("amount") or 0)
            if amount >= 0 or transaction.get("is_load") is True or transaction.get("decline_reason"):
                continue

            merchant = transaction.get("merchant")
            merchant_name = ""
            if isinstance(merchant, dict):
                merchant_name = str(merchant.get("name") or "").strip()

            expenses.append(
                {
                    "id": str(transaction.get("id") or uuid.uuid4()),
                    "description": str(transaction.get("description") or "").strip(),
                    "merchantName": merchant_name,
                    "amountMinor": abs(amount),
                    "currency": str(transaction.get("currency") or "GBP").strip() or "GBP",
                    "created": str(transaction.get("created") or "").strip() or None,
                    "settled": str(transaction.get("settled") or "").strip() or None,
                    "category": str(transaction.get("category") or "").strip() or None,
                }
            )

        expenses.sort(key=lambda item: item.get("settled") or item.get("created") or "", reverse=True)
        expenses = expenses[:limit]

        with self._lock:
            self._state["monzo"]["lastSyncAt"] = isoformat()
            self._state["monzo"]["lastSyncResult"] = f"Loaded {len(expenses)} recent expenses."
            self._save_state_locked()
            monzo = self._monzo_response_locked()

        return {"expenses": expenses, "monzo": monzo}

    def list_enable_banking_institutions(self, country: str = "gb") -> dict[str, Any]:
        institutions = EnableBankingClient().list_aspsps(country or "gb")
        return {
            "institutions": [
                {
                    "id": str(item.get("name") or item.get("id") or "").strip(),
                    "name": str(item.get("name") or "").strip(),
                    "bic": str(item.get("bic") or item.get("bic_fi") or "").strip(),
                    "logo": str(item.get("logo") or item.get("logo_url") or "").strip(),
                    "countries": item.get("countries") if isinstance(item.get("countries"), list) else [country.upper()[:2]],
                    "maximumConsentValidity": str(item.get("maximum_consent_validity") or "").strip(),
                }
                for item in institutions
                if str(item.get("name") or item.get("id") or "").strip()
            ],
            "provider": "enable-banking",
            "environment": ENABLE_BANKING_ENV,
        }

    def start_enable_banking_connection(
        self,
        *,
        aspsp_name: str,
        aspsp_country: str,
        redirect_uri: str,
        reference: str,
    ) -> dict[str, Any]:
        clean_aspsp_name = aspsp_name.strip()
        clean_aspsp_country = aspsp_country.strip().upper()[:2] or "GB"
        client = EnableBankingClient()
        auth = client.start_auth(
            aspsp_name=clean_aspsp_name,
            aspsp_country=clean_aspsp_country,
            redirect_uri=redirect_uri,
            state=reference,
        )
        auth_url = str(auth.get("url") or auth.get("redirect_url") or "").strip()
        if not auth_url:
            raise EnableBankingApiError("Enable Banking did not return a bank authentication link.")

        with self._lock:
            banking = self._state["banking"]
            banking.update({
                "provider": "enable-banking",
                "connectionProvider": "enable-banking",
                "connectionStatus": "pending",
                "institutionId": clean_aspsp_name,
                "institutionName": clean_aspsp_name,
                "requisitionId": "",
                "sessionId": "",
                "aspspName": clean_aspsp_name,
                "aspspCountry": clean_aspsp_country,
                "accountIds": [],
                "accountId": "",
                "accountDescription": clean_aspsp_name or "Bank account",
                "providerId": clean_aspsp_name,
                "accessTokenEnc": "",
                "refreshTokenEnc": "",
                "tokenExpiresAt": 0.0,
                "refreshTokenExpiresAt": 0.0,
                "consentExpiresAt": isoformat(utc_now() + max(1, ENABLE_BANKING_ACCESS_DAYS) * 24 * 60 * 60),
                "scopes": ["balances", "details", "transactions"],
                "lastSyncAt": None,
                "lastSyncResult": "Bank authentication is pending.",
            })
            self._copy_banking_to_monzo_locked(banking, self._state["monzo"])
            self._save_state_locked()

        return {
            "authUrl": auth_url,
            "provider": "enable-banking",
            "environment": ENABLE_BANKING_ENV,
            "institutionId": clean_aspsp_name,
            "institutionName": clean_aspsp_name,
            "aspspName": clean_aspsp_name,
            "aspspCountry": clean_aspsp_country,
            "redirectUri": redirect_uri,
            "state": reference,
        }

    def complete_enable_banking_connection(self, code: str) -> dict[str, Any]:
        with self._lock:
            banking = self._state["banking"]
            aspsp_name = str(banking.get("aspspName") or banking.get("institutionName") or "").strip()
            aspsp_country = str(banking.get("aspspCountry") or "").strip().upper()[:2]
        client = EnableBankingClient()
        session = client.create_session(code)
        session_id = str(session.get("session_id") or session.get("id") or "").strip()
        account_ids = _enable_banking_account_ids(session)
        if not session_id:
            raise EnableBankingApiError("Enable Banking returned no usable session ID.")
        if not account_ids:
            raise EnableBankingApiError("No bank accounts have been linked yet.")

        account_description = aspsp_name or "Bank account"
        balance_amount_minor: int | None = None
        balance_currency = ""
        try:
            balance_amount_minor, balance_currency = _extract_enable_banking_balance(
                client.get_account_balances(account_ids[0])
            )
        except EnableBankingApiError:
            pass

        with self._lock:
            banking = self._state["banking"]
            banking["provider"] = "enable-banking"
            banking["connectionProvider"] = "enable-banking"
            banking["connectionStatus"] = "connected"
            banking["sessionId"] = session_id
            banking["aspspName"] = aspsp_name
            banking["aspspCountry"] = aspsp_country
            banking["accountIds"] = account_ids
            banking["accountId"] = account_ids[0]
            banking["accountDescription"] = account_description
            banking["balanceAmountMinor"] = balance_amount_minor
            banking["balanceCurrency"] = balance_currency
            banking["lastSyncAt"] = None
            banking["lastSyncResult"] = "Connected via Enable Banking. Sync recent spending when ready."
            self._copy_banking_to_monzo_locked(banking, self._state["monzo"])
            self._save_state_locked()
            return self._state_response_locked()

    def get_recent_banking_transactions(self, limit: int = 25) -> dict[str, Any]:
        with self._lock:
            banking = self._state["banking"]
            provider = str(banking.get("provider") or banking.get("connectionProvider") or "").strip()
            account_ids = list(banking.get("accountIds") or [])

        if provider != "enable-banking":
            legacy = self.get_recent_monzo_expenses(limit=limit)
            with self._lock:
                return {
                    **legacy,
                    "banking": self._banking_response_locked(),
                }

        if not account_ids:
            raise EnableBankingApiError("No Enable Banking accounts are connected yet.")
        client = EnableBankingClient()
        expenses: list[dict[str, Any]] = []
        balance_amount_minor: int | None = None
        balance_currency = ""
        for account_id in account_ids:
            continuation_key = ""
            for _ in range(10):
                try:
                    transaction_payload = client.get_account_transactions(str(account_id), continuation_key=continuation_key)
                except EnableBankingApiError:
                    break
                transactions = transaction_payload.get("transactions") if isinstance(transaction_payload, dict) else []
                if isinstance(transactions, list):
                    for transaction in transactions:
                        if isinstance(transaction, dict):
                            expense = _normalize_enable_banking_expense(transaction, str(account_id))
                            if expense is not None:
                                expenses.append(expense)
                continuation_key = str(transaction_payload.get("continuation_key") or "").strip()
                if not continuation_key:
                    break
            if balance_amount_minor is None:
                try:
                    balance_amount_minor, balance_currency = _extract_enable_banking_balance(
                        client.get_account_balances(str(account_id))
                    )
                except EnableBankingApiError:
                    pass

        expenses.sort(key=lambda item: item.get("settled") or item.get("created") or "", reverse=True)
        expenses = expenses[:limit]
        with self._lock:
            banking = self._state["banking"]
            if balance_amount_minor is not None:
                banking["balanceAmountMinor"] = balance_amount_minor
                banking["balanceCurrency"] = balance_currency or banking.get("balanceCurrency") or "GBP"
            banking["connectionStatus"] = "connected"
            banking["lastSyncAt"] = isoformat()
            banking["lastSyncResult"] = f"Loaded {len(expenses)} recent transactions from Enable Banking."
            self._copy_banking_to_monzo_locked(banking, self._state["monzo"])
            self._save_state_locked()
            banking_response = self._banking_response_locked()
            monzo_response = self._monzo_response_locked()
        return {"expenses": expenses, "banking": banking_response, "monzo": monzo_response}

    def import_banking_csv(self, csv_text: str, limit: int = 200) -> dict[str, Any]:
        expenses = _normalize_csv_expenses(csv_text)[:limit]
        with self._lock:
            banking = self._state["banking"]
            banking["provider"] = banking.get("provider") or "csv"
            banking["connectionProvider"] = banking.get("connectionProvider") or banking["provider"]
            banking["connectionStatus"] = "csv-imported"
            banking["lastSyncAt"] = isoformat()
            banking["lastSyncResult"] = f"Imported {len(expenses)} transactions from CSV."
            self._copy_banking_to_monzo_locked(banking, self._state["monzo"])
            self._save_state_locked()
            return {"expenses": expenses, "banking": self._banking_response_locked(), "monzo": self._monzo_response_locked()}

    def disconnect_banking(self) -> dict[str, Any]:
        session_id = ""
        with self._lock:
            banking = self._state["banking"]
            if str(banking.get("provider") or "") == "enable-banking":
                session_id = str(banking.get("sessionId") or "").strip()
        if session_id:
            try:
                EnableBankingClient().delete_session(session_id)
            except EnableBankingApiError:
                pass
        with self._lock:
            empty = self._normalize_banking_settings({})
            self._state["banking"] = empty
            self._state["monzo"] = self._normalize_monzo_settings({})
            self._monzo_access_token = None
            self._save_state_locked()
            return self._state_response_locked()

    def claim_alerts(self) -> dict[str, Any]:
        with self._lock:
            alerts = list(self._state["alerts"]["pending"])
            self._state["alerts"]["pending"] = []
            self._save_state_locked()
            return {"alerts": alerts}

    def add_subscription(self, subscription: dict[str, Any]) -> dict[str, bool]:
        if not self._is_valid_subscription(subscription):
            raise ValueError("Invalid push subscription")

        normalized = self._normalize_subscription(subscription)
        with self._lock:
            self._state["pushSubscriptions"] = [
                item
                for item in self._state["pushSubscriptions"]
                if item["endpoint"] != normalized["endpoint"]
            ]
            self._state["pushSubscriptions"].append(normalized)
            self._save_state_locked()

        return {"ok": True}

    def remove_subscription(self, endpoint: str) -> dict[str, bool]:
        with self._lock:
            self._state["pushSubscriptions"] = [
                item
                for item in self._state["pushSubscriptions"]
                if item["endpoint"] != endpoint
            ]
            self._save_state_locked()

        return {"ok": True}

    def _rss_news_due_slot_locked(self, now: float) -> str | None:
        settings = self._state["rssNewsNotifications"]
        if not settings["enabled"] or not settings["feedUrls"]:
            return None
        local_now = datetime.fromtimestamp(now, timezone.utc).astimezone(get_timezone(DEFAULT_EMAIL_TIMEZONE) or timezone.utc)
        day_key = local_now.strftime("%Y-%m-%d")
        active_times = settings["times"][: settings["frequency"]]
        for time_value in active_times:
            parsed_time = parse_hhmm(time_value)
            if parsed_time is None:
                continue
            hour, minute = parsed_time
            slot_at = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            age_seconds = (local_now - slot_at).total_seconds()
            slot_key = f"{day_key}:{time_value}"
            if 0 <= age_seconds <= RSS_NEWS_SLOT_GRACE_SECONDS and settings.get("lastSentSlotKey") != slot_key:
                return slot_key
        return None

    def _build_rss_news_push_payload(self, slot_key: str) -> dict[str, Any] | None:
        with self._lock:
            settings = self._state["rssNewsNotifications"]
            feed_urls = list(settings["feedUrls"])
            sent_item_keys = set(settings.get("sentItemKeys", []))

        candidates: list[dict[str, Any]] = []
        for feed_url in feed_urls:
            try:
                feed = fetch_rss_feed(feed_url)
            except Exception as exc:
                print(f"RSS news notification feed failed: url={feed_url} error={exc}", file=sys.stderr, flush=True)
                continue
            source_name = str(feed.get("title") or urlparse(feed_url).netloc or "RSS").strip()
            for item in feed.get("items", []):
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title") or "").strip()
                item_url = str(item.get("url") or "").strip()
                if not title:
                    continue
                published_at = parse_iso8601(item.get("publishedAt")) or 0
                item_key = item_url or f"{source_name}:{title}"
                candidates.append({
                    "title": title,
                    "url": item_url,
                    "sourceName": str(item.get("sourceName") or source_name).strip() or source_name,
                    "publishedAt": published_at,
                    "itemKey": item_key,
                })

        if not candidates:
            return None

        candidates.sort(key=lambda item: item["publishedAt"], reverse=True)
        selected = next((item for item in candidates if item["itemKey"] not in sent_item_keys), candidates[0])
        with self._lock:
            settings = self._state["rssNewsNotifications"]
            recent_keys = [selected["itemKey"], *settings.get("sentItemKeys", [])]
            settings["sentItemKeys"] = list(dict.fromkeys(recent_keys))[:RSS_NEWS_RECENT_ITEM_LIMIT]
            settings["lastSentSlotKey"] = slot_key
            self._save_state_locked()

        return {
            "title": "Latest news",
            "body": f"{selected['sourceName']}: {selected['title']}",
            "tag": f"cordyceps-rss-news-{slot_key}",
            "data": {
                "url": selected["url"] or "/?page=rss",
                "kind": "rss-news",
                "sentAt": isoformat(utc_now()),
            },
        }

    def tick(self) -> None:
        alert_payload: dict[str, Any] | None = None
        test_push_payload: dict[str, Any] | None = None
        plan_block_payload: dict[str, Any] | None = None
        rss_news_slot_key: str | None = None
        notification_scheduler_payloads: list[dict[str, Any]] = []
        with self._lock:
            alerts_state = self._state["alerts"]
            plan_block_reminder = self._state["planBlockReminder"]
            now = utc_now()
            rss_news_slot_key = self._rss_news_due_slot_locked(now)
            due_notification_reminders = self._pop_due_notification_reminders_locked(now)
            notification_scheduler_payloads = [
                build_notification_scheduler_payload(reminder, now)
                for reminder in due_notification_reminders
            ]

            if alerts_state["testPushEnabled"]:
                next_test_push_at = parse_iso8601(alerts_state["nextTestPushAt"])
                if next_test_push_at is None or next_test_push_at <= now:
                    test_push_payload = {
                        "title": "Test notification",
                        "body": "This is a 10 second test push from Today.",
                        "tag": "todo-test-push",
                        "data": {
                            "url": "/",
                            "kind": "test-push",
                            "sentAt": isoformat(now),
                        },
                    }
                    alerts_state["nextTestPushAt"] = isoformat(now + TEST_PUSH_INTERVAL_SECONDS)
                    self._save_state_locked()

            if not alerts_state["enabled"]:
                pass
            else:
                next_alert_at = parse_iso8601(alerts_state["nextAlertAt"])

                if not next_alert_at or next_alert_at <= now:
                    candidates = self._active_tasks_locked()
                    if not candidates:
                        alerts_state["nextAlertAt"] = None
                        self._save_state_locked()
                    else:
                        task = random.choice(candidates)
                        alert_payload = {
                            "id": str(uuid.uuid4()),
                            "taskId": task["id"],
                            "text": task["text"],
                            "scheduledAt": isoformat(now),
                        }
                        alerts_state["pending"].append(alert_payload)
                        self._ensure_schedule_locked(force=True)
                        self._save_state_locked()

            next_block = plan_block_reminder.get("nextBlock")
            if isinstance(next_block, dict):
                reminder_at = parse_iso8601(next_block.get("reminderAt"))
                start_at = parse_iso8601(next_block.get("startAt"))
                sent_key = f"{next_block.get('id')}:{next_block.get('startAt')}:{next_block.get('reminderMinutes')}"
                if (
                    reminder_at is not None
                    and start_at is not None
                    and reminder_at <= now
                    and start_at > now
                    and plan_block_reminder.get("lastSentKey") != sent_key
                ):
                    plan_block_payload = {
                        "title": "Plan block soon",
                        "body": f"{next_block['label']} starts soon.",
                        "tag": f"cordyceps-plan-block-{next_block.get('id') or 'next'}",
                        "data": {
                            "url": "/?page=plan-your-day",
                            "kind": "plan-block-reminder",
                            "sentAt": isoformat(now),
                        },
                    }
                    plan_block_reminder["lastSentKey"] = sent_key
                    self._save_state_locked()

        if test_push_payload is not None:
            self._dispatch_push_message(test_push_payload)

        if alert_payload is not None:
            self._dispatch_push_message(
                {
                    "title": "Task prompt",
                    "body": alert_payload["text"],
                    "tag": f"todo-random-alert-{alert_payload['id']}",
                    "data": {
                        "taskId": alert_payload["taskId"],
                        "scheduledAt": alert_payload["scheduledAt"],
                        "url": "/",
                    },
                }
            )

        if plan_block_payload is not None:
            self._dispatch_push_message(plan_block_payload)

        for payload in notification_scheduler_payloads:
            self._dispatch_push_message(payload)

        if rss_news_slot_key is not None:
            rss_news_payload = self._build_rss_news_push_payload(rss_news_slot_key)
            if rss_news_payload is not None:
                self._dispatch_push_message(rss_news_payload)

    def send_quickmail(self, recipient: str, body: str) -> dict[str, Any]:
        clean_recipient = recipient.strip()
        clean_body = body.strip()
        if not clean_recipient or "@" not in clean_recipient or "." not in clean_recipient:
            raise RuntimeError("Recipient must be a valid email address.")
        if not clean_body:
            raise RuntimeError("Message body cannot be empty.")
        if len(clean_body) > QUICKMAIL_MAX_LENGTH:
            raise RuntimeError(f"QuickMail messages must stay under {QUICKMAIL_MAX_LENGTH} characters.")

        if not self._send_smtp_email(clean_body, clean_body, clean_recipient):
            raise RuntimeError("The QuickMail message could not be sent.")
        return {"ok": True, "recipient": clean_recipient}

    def send_quickmail_email(self, recipient: str, subject: str, body: str) -> dict[str, Any]:
        clean_recipient = recipient.strip()
        clean_subject = subject.strip()
        clean_body = body.strip()
        if not clean_recipient or "@" not in clean_recipient or "." not in clean_recipient:
            raise RuntimeError("Recipient must be a valid email address.")
        if not clean_subject:
            raise RuntimeError("Subject cannot be empty.")
        if len(clean_subject) > QUICKMAIL_SUBJECT_MAX_LENGTH:
            raise RuntimeError(f"Email subject must stay under {QUICKMAIL_SUBJECT_MAX_LENGTH} characters.")
        if not clean_body:
            raise RuntimeError("Email body cannot be empty.")

        if not self._send_smtp_email(clean_subject, clean_body, clean_recipient):
            raise RuntimeError("The email could not be sent.")
        return {"ok": True, "recipient": clean_recipient, "subject": clean_subject}

    def update_quickmail_account(
        self,
        *,
        email: str,
        password: str,
        imap_host: str,
        imap_port: int,
        smtp_host: str,
        smtp_port: int,
        display_name: str,
    ) -> dict[str, Any]:
        with self._lock:
            self._state["quickmailAccount"] = self._normalize_quickmail_account({
                "email": email,
                "displayName": display_name,
                "imapHost": imap_host,
                "imapPort": imap_port,
                "smtpHost": smtp_host,
                "smtpPort": smtp_port,
                "authType": "password",
            })
            self._quickmail_password = password or None
            self._save_state_locked()
            return self._state_response_locked()

    def remove_quickmail_account(self) -> dict[str, Any]:
        with self._lock:
            self._state["quickmailAccount"] = self._normalize_quickmail_account({})
            self._quickmail_password = None
            self._save_state_locked()
            return self._state_response_locked()

    def get_quickmail_account_status(self) -> dict[str, Any]:
        with self._lock:
            account = self._state["quickmailAccount"]
            return {
                "email": account["email"],
                "displayName": account["displayName"],
                "imapHost": account["imapHost"],
                "imapPort": account["imapPort"],
                "smtpHost": account["smtpHost"],
                "smtpPort": account["smtpPort"],
                "configured": self._is_quickmail_account_configured_locked(account),
                "authType": account["authType"],
                "oauthProvider": account["oauthProvider"],
                "oauthProviders": {
                    "google": bool(QUICKMAIL_GOOGLE_CLIENT_ID),
                    "microsoft": bool(QUICKMAIL_MICROSOFT_CLIENT_ID),
                },
            }

    def _is_quickmail_account_configured_locked(self, account: dict[str, Any]) -> bool:
        if account["authType"] == "oauth":
            return bool(account["email"] and account["oauthProvider"] and account["refreshToken"])
        return bool(account["email"] and self._quickmail_password)

    def build_quickmail_oauth_start_url(self, provider: str, origin: str) -> dict[str, Any]:
        normalized_provider = str(provider or "").strip().lower()
        clean_origin = str(origin or "").strip().rstrip("/")
        state = b64url(os.urandom(18))

        if normalized_provider == "google":
            if not QUICKMAIL_GOOGLE_CLIENT_ID:
                raise RuntimeError("Google OAuth is missing QUICKMAIL_GOOGLE_CLIENT_ID. Add it to .env and restart the server.")
            if not QUICKMAIL_GOOGLE_CLIENT_SECRET:
                raise RuntimeError("Google OAuth is missing QUICKMAIL_GOOGLE_CLIENT_SECRET. Add it to .env and restart the server.")
            redirect_uri = QUICKMAIL_GOOGLE_REDIRECT_URI or f"{clean_origin}/api/quickmail/oauth/callback/google"
            with self._lock:
                self._quickmail_oauth_states[state] = {
                    "provider": "google",
                    "redirectUri": redirect_uri,
                    "createdAt": time.time(),
                }
            query = urlencode({
                "client_id": QUICKMAIL_GOOGLE_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": QUICKMAIL_GOOGLE_SCOPES,
                "access_type": "offline",
                "prompt": "consent",
                "state": state,
            })
            return {
                "provider": "google",
                "authorizationUrl": f"{QUICKMAIL_GOOGLE_AUTH_URL}?{query}",
                "state": state,
            }

        if normalized_provider == "microsoft":
            if not QUICKMAIL_MICROSOFT_CLIENT_ID:
                raise RuntimeError("Microsoft OAuth is missing QUICKMAIL_MICROSOFT_CLIENT_ID. Add it to .env and restart the server.")
            if not QUICKMAIL_MICROSOFT_CLIENT_SECRET:
                raise RuntimeError("Microsoft OAuth is missing QUICKMAIL_MICROSOFT_CLIENT_SECRET. Add it to .env and restart the server.")
            redirect_uri = QUICKMAIL_MICROSOFT_REDIRECT_URI or f"{clean_origin}/api/quickmail/oauth/callback/microsoft"
            tenant = re.sub(r"[^A-Za-z0-9_.-]", "", QUICKMAIL_MICROSOFT_TENANT) or "consumers"
            with self._lock:
                self._quickmail_oauth_states[state] = {
                    "provider": "microsoft",
                    "redirectUri": redirect_uri,
                    "createdAt": time.time(),
                }
            query = urlencode({
                "client_id": QUICKMAIL_MICROSOFT_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "response_mode": "query",
                "scope": QUICKMAIL_MICROSOFT_SCOPES,
                "state": state,
            })
            return {
                "provider": "microsoft",
                "authorizationUrl": f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?{query}",
                "state": state,
            }

        raise RuntimeError("QuickMail OAuth provider must be google or microsoft.")

    def complete_quickmail_oauth(self, provider: str, code: str, state: str) -> dict[str, Any]:
        normalized_provider = str(provider or "").strip().lower()
        clean_code = str(code or "").strip()
        clean_state = str(state or "").strip()
        if normalized_provider not in {"google", "microsoft"}:
            raise RuntimeError("QuickMail OAuth provider must be google or microsoft.")
        if not clean_code or not clean_state:
            raise RuntimeError("OAuth callback was missing a code or state.")

        with self._lock:
            flow = self._quickmail_oauth_states.pop(clean_state, None)

        if not flow or flow.get("provider") != normalized_provider:
            raise RuntimeError("OAuth state is invalid or expired.")
        if time.time() - float(flow.get("createdAt") or 0) > AUTH_FLOW_TTL_SECONDS:
            raise RuntimeError("OAuth state expired. Start the connection again.")

        redirect_uri = str(flow.get("redirectUri") or "").strip()
        if normalized_provider == "google":
            token_payload = self._exchange_google_quickmail_code(clean_code, redirect_uri)
            access_token = str(token_payload.get("access_token") or "").strip()
            refresh_token = str(token_payload.get("refresh_token") or "").strip()
            if not access_token or not refresh_token:
                raise RuntimeError("Google did not return the required OAuth tokens.")
            profile = self._fetch_google_quickmail_profile(access_token)
            email_address = str(profile.get("emailAddress") or "").strip()
            display_name = email_address
        else:
            token_payload = self._exchange_microsoft_quickmail_code(clean_code, redirect_uri)
            access_token = str(token_payload.get("access_token") or "").strip()
            refresh_token = str(token_payload.get("refresh_token") or "").strip()
            if not access_token or not refresh_token:
                raise RuntimeError("Microsoft did not return the required OAuth tokens.")
            profile = self._fetch_microsoft_quickmail_profile(access_token)
            email_address = str(profile.get("mail") or profile.get("userPrincipalName") or "").strip()
            display_name = str(profile.get("displayName") or email_address).strip()

        if not email_address:
            raise RuntimeError("OAuth provider did not return an email address.")

        expires_at = time.time() + max(60, int(token_payload.get("expires_in") or 3600))
        with self._lock:
            self._state["quickmailAccount"] = self._normalize_quickmail_account({
                "email": email_address,
                "displayName": display_name,
                "authType": "oauth",
                "oauthProvider": normalized_provider,
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "tokenExpiresAt": expires_at,
            })
            self._quickmail_password = None
            self._save_state_locked()
            return self._state_response_locked()

    def _exchange_google_quickmail_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        payload = {
            "client_id": QUICKMAIL_GOOGLE_CLIENT_ID,
            "client_secret": QUICKMAIL_GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }
        return self._post_quickmail_token(QUICKMAIL_GOOGLE_TOKEN_URL, payload, "Google")

    def _exchange_microsoft_quickmail_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        tenant = re.sub(r"[^A-Za-z0-9_.-]", "", QUICKMAIL_MICROSOFT_TENANT) or "consumers"
        payload = {
            "client_id": QUICKMAIL_MICROSOFT_CLIENT_ID,
            "client_secret": QUICKMAIL_MICROSOFT_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
            "scope": QUICKMAIL_MICROSOFT_SCOPES,
        }
        return self._post_quickmail_token(
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            payload,
            "Microsoft",
        )

    def _post_quickmail_token(self, url: str, payload: dict[str, str], provider_label: str) -> dict[str, Any]:
        try:
            response = requests.post(url, data=payload, timeout=20)
            data = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise RuntimeError(f"{provider_label} OAuth token request failed.") from exc
        if response.status_code >= 400:
            error_description = str(data.get("error_description") or data.get("error") or "").strip()
            raise RuntimeError(error_description or f"{provider_label} OAuth token request was rejected.")
        return data if isinstance(data, dict) else {}

    def _fetch_google_quickmail_profile(self, access_token: str) -> dict[str, Any]:
        return self._quickmail_api_get(
            f"{QUICKMAIL_GMAIL_API_BASE}/users/me/profile",
            access_token,
            "Google profile request failed.",
        )

    def _fetch_microsoft_quickmail_profile(self, access_token: str) -> dict[str, Any]:
        return self._quickmail_api_get(
            f"{MICROSOFT_GRAPH_API_BASE}/me?$select=displayName,mail,userPrincipalName",
            access_token,
            "Microsoft profile request failed.",
        )

    def _quickmail_api_get(self, url: str, access_token: str, error_message: str) -> dict[str, Any]:
        try:
            response = requests.get(url, headers={"Authorization": f"Bearer {access_token}"}, timeout=20)
            data = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise RuntimeError(error_message) from exc
        if response.status_code >= 400:
            raise RuntimeError(str(data.get("error_description") or data.get("error", {}).get("message") or error_message))
        return data if isinstance(data, dict) else {}

    def _quickmail_oauth_access_token(self, account: dict[str, Any]) -> str:
        access_token = str(account.get("accessToken") or "").strip()
        expires_at = float(account.get("tokenExpiresAt") or 0)
        if access_token and expires_at > time.time() + 90:
            return access_token

        provider = str(account.get("oauthProvider") or "").strip()
        refresh_token = str(account.get("refreshToken") or "").strip()
        if not provider or not refresh_token:
            raise RuntimeError("QuickMail OAuth account is not connected.")

        if provider == "google":
            token_payload = self._refresh_google_quickmail_token(refresh_token)
        elif provider == "microsoft":
            token_payload = self._refresh_microsoft_quickmail_token(refresh_token)
        else:
            raise RuntimeError("Unsupported QuickMail OAuth provider.")

        next_access_token = str(token_payload.get("access_token") or "").strip()
        next_refresh_token = str(token_payload.get("refresh_token") or refresh_token).strip()
        if not next_access_token:
            raise RuntimeError("OAuth token refresh did not return an access token.")
        next_expires_at = time.time() + max(60, int(token_payload.get("expires_in") or 3600))

        with self._lock:
            stored = self._state["quickmailAccount"]
            if stored.get("authType") == "oauth" and stored.get("refreshToken") == refresh_token:
                stored["accessToken"] = next_access_token
                stored["refreshToken"] = next_refresh_token
                stored["tokenExpiresAt"] = next_expires_at
                self._save_state_locked()

        return next_access_token

    def _refresh_google_quickmail_token(self, refresh_token: str) -> dict[str, Any]:
        payload = {
            "client_id": QUICKMAIL_GOOGLE_CLIENT_ID,
            "client_secret": QUICKMAIL_GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        return self._post_quickmail_token(QUICKMAIL_GOOGLE_TOKEN_URL, payload, "Google")

    def _refresh_microsoft_quickmail_token(self, refresh_token: str) -> dict[str, Any]:
        tenant = re.sub(r"[^A-Za-z0-9_.-]", "", QUICKMAIL_MICROSOFT_TENANT) or "consumers"
        payload = {
            "client_id": QUICKMAIL_MICROSOFT_CLIENT_ID,
            "client_secret": QUICKMAIL_MICROSOFT_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": QUICKMAIL_MICROSOFT_SCOPES,
        }
        return self._post_quickmail_token(
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            payload,
            "Microsoft",
        )

    def list_quickmail_mailbox(self, folder: str = "all", limit: int = QUICKMAIL_MAILBOX_FETCH_LIMIT) -> dict[str, Any]:
        normalized_folder = str(folder or "all").strip().lower() or "all"
        if normalized_folder not in {"all", "inbox", "sent"}:
            raise RuntimeError("QuickMail mailbox folder must be all, inbox, or sent.")

        message_limit = max(1, min(60, int(limit)))

        with self._lock:
            stored = self._state["quickmailAccount"]
            imap_host = stored["imapHost"] or IMAP_HOST
            imap_port = stored["imapPort"] or IMAP_PORT
            imap_user = stored["email"] or IMAP_USERNAME
            imap_pass = self._quickmail_password or IMAP_PASSWORD
            oauth_account = dict(stored) if stored.get("authType") == "oauth" else None

        if oauth_account is not None:
            provider = str(oauth_account.get("oauthProvider") or "")
            access_token = self._quickmail_oauth_access_token(oauth_account)
            if provider == "google":
                return self._list_google_quickmail_mailbox(oauth_account, access_token, normalized_folder, message_limit)
            if provider == "microsoft":
                return self._list_microsoft_quickmail_mailbox(oauth_account, access_token, normalized_folder, message_limit)
            raise RuntimeError("Unsupported QuickMail OAuth provider.")

        if not imap_user or not imap_pass:
            return {
                "ok": True,
                "folder": normalized_folder,
                "fetchedAt": isoformat(),
                "messages": self._build_demo_quickmail_messages(normalized_folder, message_limit),
                "demo": True,
                "configured": False,
                "accountEmail": "",
            }

        messages: list[dict[str, Any]] = []
        try:
            with imaplib.IMAP4_SSL(imap_host, imap_port) as mailbox:
                mailbox.login(imap_user, imap_pass)
                mailbox_names = self._list_imap_mailboxes(mailbox)
                inbox_name = self._resolve_imap_mailbox(mailbox_names, "inbox") or "INBOX"
                sent_name = self._resolve_imap_mailbox(mailbox_names, "sent")

                targets: list[tuple[str, str]] = []
                if normalized_folder in {"all", "inbox"}:
                    targets.append(("inbox", inbox_name))
                if normalized_folder in {"all", "sent"}:
                    if not sent_name:
                        raise RuntimeError("Could not locate the Sent mailbox for this account.")
                    targets.append(("sent", sent_name))

                per_folder_limit = message_limit if normalized_folder != "all" else max(8, message_limit // max(len(targets), 1) + 6)
                for folder_name, mailbox_name in targets:
                    messages.extend(self._fetch_imap_messages(mailbox, mailbox_name, folder_name, per_folder_limit))
        except RuntimeError:
            raise
        except Exception as exc:
            raise RuntimeError("Mailbox could not be reached with the current IMAP settings.") from exc

        messages.sort(key=lambda item: item.get("receivedAt") or "", reverse=True)
        trimmed_messages = messages[:message_limit]
        return {
            "ok": True,
            "folder": normalized_folder,
            "fetchedAt": isoformat(),
            "messages": trimmed_messages,
            "demo": False,
            "configured": True,
            "accountEmail": imap_user,
        }

    def _list_google_quickmail_mailbox(
        self,
        account: dict[str, Any],
        access_token: str,
        folder: str,
        limit: int,
    ) -> dict[str, Any]:
        label_ids = []
        if folder == "inbox":
            label_ids = ["INBOX"]
        elif folder == "sent":
            label_ids = ["SENT"]

        params: dict[str, Any] = {"maxResults": limit}
        if label_ids:
            params["labelIds"] = label_ids
        list_url = f"{QUICKMAIL_GMAIL_API_BASE}/users/me/messages?{urlencode(params, doseq=True)}"
        payload = self._quickmail_api_get(list_url, access_token, "Gmail messages request failed.")
        message_refs = payload.get("messages") if isinstance(payload.get("messages"), list) else []
        messages = []
        for item in message_refs[:limit]:
            message_id = str(item.get("id") or "").strip() if isinstance(item, dict) else ""
            if not message_id:
                continue
            detail = self._quickmail_api_get(
                f"{QUICKMAIL_GMAIL_API_BASE}/users/me/messages/{message_id}?format=full",
                access_token,
                "Gmail message request failed.",
            )
            serialized = self._serialize_gmail_message(detail)
            if folder == "all" or serialized["folder"] == folder:
                messages.append(serialized)

        return {
            "ok": True,
            "folder": folder,
            "fetchedAt": isoformat(),
            "messages": messages[:limit],
            "demo": False,
            "configured": True,
            "accountEmail": str(account.get("email") or ""),
        }

    def _serialize_gmail_message(self, message: dict[str, Any]) -> dict[str, Any]:
        headers = {
            str(header.get("name") or "").lower(): str(header.get("value") or "")
            for header in message.get("payload", {}).get("headers", [])
            if isinstance(header, dict)
        }
        from_name, from_email = parseaddr(headers.get("from", ""))
        to_entries = [
            {"name": name.strip(), "email": address.strip()}
            for name, address in getaddresses([headers.get("to", "")])
            if address.strip()
        ]
        to_label = ", ".join(entry["name"] or entry["email"] for entry in to_entries)
        label_ids = set(message.get("labelIds") if isinstance(message.get("labelIds"), list) else [])
        folder = "sent" if "SENT" in label_ids else "inbox"
        body_parts = self._extract_gmail_body_parts(message.get("payload", {}))
        body_fields = self._build_quickmail_body_fields(
            body_parts.get("text", ""),
            body_parts.get("html", ""),
            str(message.get("snippet") or ""),
        )
        timestamp = self._parse_email_timestamp(headers.get("date")) or (int(message.get("internalDate") or 0) / 1000)
        return {
            "id": str(message.get("id") or ""),
            "folder": folder,
            "uid": str(message.get("id") or ""),
            "subject": headers.get("subject") or "(No subject)",
            "preview": compact_text(body_fields["bodyText"] or str(message.get("snippet") or ""), 180),
            **body_fields,
            "fromName": from_name.strip(),
            "fromEmail": from_email.strip(),
            "to": to_entries,
            "toLabel": to_label,
            "counterparty": to_label if folder == "sent" else (from_name.strip() or from_email.strip() or "Unknown sender"),
            "receivedAt": isoformat(timestamp) if timestamp else "",
            "unread": "UNREAD" in label_ids,
        }

    def _build_quickmail_body_fields(self, body_text: str, body_html: str, fallback: str = "") -> dict[str, str]:
        clean_html = str(body_html or "").strip()
        clean_text = compact_text(str(body_text or ""), 12000)
        if not clean_text and clean_html:
            clean_text = html_to_text(clean_html, 12000)
        if not clean_text:
            clean_text = compact_text(str(fallback or ""), 12000)
        return {
            "body": clean_text,
            "bodyText": clean_text,
            "bodyHtml": clean_html,
            "bodyContentType": "html" if clean_html else "text",
        }

    def _extract_gmail_body_parts(self, payload: dict[str, Any]) -> dict[str, str]:
        body_parts = {"text": "", "html": ""}

        def visit(part: dict[str, Any]) -> None:
            if not isinstance(part, dict):
                return
            headers = {
                str(header.get("name") or "").lower(): str(header.get("value") or "")
                for header in part.get("headers", [])
                if isinstance(header, dict)
            }
            if "attachment" in str(headers.get("content-disposition") or "").lower():
                return
            for child in part.get("parts") if isinstance(part.get("parts"), list) else []:
                visit(child)

            mime_type = str(part.get("mimeType") or "").lower()
            if mime_type not in {"text/plain", "text/html"}:
                return
            key = "html" if mime_type == "text/html" else "text"
            if body_parts[key]:
                return
            data = str(part.get("body", {}).get("data") or "")
            decoded = b64url_decode(data)
            if decoded:
                body_parts[key] = decoded.decode("utf-8", errors="replace").strip()

        parts = payload.get("parts") if isinstance(payload.get("parts"), list) else []
        for candidate in parts or [payload]:
            visit(candidate)
        return body_parts

    def _list_microsoft_quickmail_mailbox(
        self,
        account: dict[str, Any],
        access_token: str,
        folder: str,
        limit: int,
    ) -> dict[str, Any]:
        targets = []
        if folder in {"all", "inbox"}:
            targets.append(("inbox", "inbox"))
        if folder in {"all", "sent"}:
            targets.append(("sent", "sentitems"))
        per_folder_limit = limit if folder != "all" else max(8, limit // max(len(targets), 1) + 6)
        messages = []
        select = "id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead,sentDateTime"
        for folder_name, folder_id in targets:
            url = (
                f"{MICROSOFT_GRAPH_API_BASE}/me/mailFolders/{folder_id}/messages?"
                f"{urlencode({'$top': per_folder_limit, '$orderby': 'receivedDateTime desc', '$select': select})}"
            )
            payload = self._quickmail_api_get(url, access_token, "Microsoft messages request failed.")
            for message in payload.get("value", []) if isinstance(payload.get("value"), list) else []:
                if isinstance(message, dict):
                    messages.append(self._serialize_microsoft_message(message, folder_name))

        messages.sort(key=lambda item: item.get("receivedAt") or "", reverse=True)
        return {
            "ok": True,
            "folder": folder,
            "fetchedAt": isoformat(),
            "messages": messages[:limit],
            "demo": False,
            "configured": True,
            "accountEmail": str(account.get("email") or ""),
        }

    def _serialize_microsoft_message(self, message: dict[str, Any], folder: str) -> dict[str, Any]:
        from_payload = message.get("from", {}).get("emailAddress", {}) if isinstance(message.get("from"), dict) else {}
        from_name = str(from_payload.get("name") or "").strip()
        from_email = str(from_payload.get("address") or "").strip()
        to_entries = []
        for item in message.get("toRecipients", []) if isinstance(message.get("toRecipients"), list) else []:
            address = item.get("emailAddress", {}) if isinstance(item, dict) else {}
            email_address = str(address.get("address") or "").strip()
            if email_address:
                to_entries.append({"name": str(address.get("name") or "").strip(), "email": email_address})
        to_label = ", ".join(entry["name"] or entry["email"] for entry in to_entries)
        body_payload = message.get("body", {}) if isinstance(message.get("body"), dict) else {}
        body_content = str(body_payload.get("content") or "")
        body_content_type = str(body_payload.get("contentType") or "").lower()
        body_html = body_content if body_content_type == "html" else ""
        body_text = html_to_text(body_content, 12000) if body_html else compact_text(unescape(body_content), 12000)
        body_fields = self._build_quickmail_body_fields(body_text, body_html, str(message.get("bodyPreview") or ""))
        received_at = str(message.get("sentDateTime") if folder == "sent" else message.get("receivedDateTime") or "").strip()
        return {
            "id": str(message.get("id") or ""),
            "folder": folder,
            "uid": str(message.get("id") or ""),
            "subject": str(message.get("subject") or "(No subject)").strip() or "(No subject)",
            "preview": compact_text(str(message.get("bodyPreview") or body_fields["bodyText"]), 180),
            **body_fields,
            "fromName": from_name,
            "fromEmail": from_email,
            "to": to_entries,
            "toLabel": to_label,
            "counterparty": to_label if folder == "sent" else (from_name or from_email or "Unknown sender"),
            "receivedAt": received_at,
            "unread": not bool(message.get("isRead")),
        }

    def _build_demo_quickmail_messages(self, folder: str, limit: int) -> list[dict[str, Any]]:
        now = utc_now()
        demo_messages = [
            {
                "id": "demo-inbox-1",
                "folder": "inbox",
                "subject": "Design review moved to 11:30",
                "preview": "The product walkthrough slipped by half an hour. Bring the desktop shell mockups.",
                "body": (
                    "Hi,\n\n"
                    "The design review has moved to 11:30 this morning.\n"
                    "Please bring the latest desktop shell mockups and the updated QuickMail mailbox flow.\n\n"
                    "Thanks."
                ),
                "fromName": "Maya Chen",
                "fromEmail": "maya.chen@example.com",
                "to": [{"name": "You", "email": "you@example.com"}],
                "toLabel": "You",
                "counterparty": "Maya Chen",
                "receivedAt": isoformat(now - 35 * 60),
                "unread": True,
            },
            {
                "id": "demo-inbox-2",
                "folder": "inbox",
                "subject": "Reading list for this week",
                "preview": "Three good pieces on lightweight PMF loops, agentic tooling, and note-taking UX.",
                "body": (
                    "Here are the three links I mentioned:\n"
                    "1. Lightweight PMF loops\n"
                    "2. Safer agent handoff patterns\n"
                    "3. Designing notes apps that stay fast under load"
                ),
                "fromName": "Noah Patel",
                "fromEmail": "noah.patel@example.com",
                "to": [{"name": "You", "email": "you@example.com"}],
                "toLabel": "You",
                "counterparty": "Noah Patel",
                "receivedAt": isoformat(now - 3 * 60 * 60),
                "unread": False,
            },
            {
                "id": "demo-inbox-3",
                "folder": "inbox",
                "subject": "Hackaday: tiny e-paper desk board",
                "preview": "This build might be a nice fit for the ambient dashboard direction you were sketching.",
                "body": (
                    "Saw this Hackaday post and thought of your desktop dashboard ideas.\n"
                    "The e-paper board keeps context visible without turning into notification soup."
                ),
                "fromName": "Ari",
                "fromEmail": "ari@example.com",
                "to": [{"name": "You", "email": "you@example.com"}],
                "toLabel": "You",
                "counterparty": "Ari",
                "receivedAt": isoformat(now - 26 * 60 * 60),
                "unread": False,
            },
            {
                "id": "demo-sent-1",
                "folder": "sent",
                "subject": "Re: desktop shell follow-up",
                "preview": "I’ve kept the dock-driven layout and moved the contextual navigation into the side rail.",
                "body": (
                    "I’ve kept the dock-driven layout and moved the contextual navigation into the side rail.\n"
                    "That feels closer to the single-focus desktop flow we wanted."
                ),
                "fromName": "You",
                "fromEmail": "you@example.com",
                "to": [{"name": "Maya Chen", "email": "maya.chen@example.com"}],
                "toLabel": "Maya Chen",
                "counterparty": "Maya Chen",
                "receivedAt": isoformat(now - 2 * 60 * 60),
                "unread": False,
            },
            {
                "id": "demo-sent-2",
                "folder": "sent",
                "subject": "Book import looks good now",
                "preview": "Reader mode is using the full canvas height and the library stays out of the way.",
                "body": (
                    "Reader mode is using the full canvas height now and the library stays out of the way.\n"
                    "The remaining tweak is probably just a little more polish on the top chrome."
                ),
                "fromName": "You",
                "fromEmail": "you@example.com",
                "to": [{"name": "Noah Patel", "email": "noah.patel@example.com"}],
                "toLabel": "Noah Patel",
                "counterparty": "Noah Patel",
                "receivedAt": isoformat(now - 9 * 60 * 60),
                "unread": False,
            },
        ]

        visible = [
            message for message in demo_messages
            if folder == "all" or message["folder"] == folder
        ]
        visible.sort(key=lambda item: item.get("receivedAt") or "", reverse=True)
        return visible[:limit]

    def _list_imap_mailboxes(self, mailbox: imaplib.IMAP4_SSL) -> list[str]:
        status, payload = mailbox.list()
        if status != "OK" or not isinstance(payload, list):
            return []

        names: list[str] = []
        for item in payload:
            if not item:
                continue

            if isinstance(item, bytes):
                text = item.decode("utf-8", errors="replace")
            else:
                text = str(item)

            match = re.search(r'"([^"]+)"\s*$', text)
            if match:
                names.append(match.group(1))
                continue

            tail = text.rsplit(" ", 1)[-1].strip()
            if tail:
                names.append(tail.strip('"'))

        return names

    def _resolve_imap_mailbox(self, mailbox_names: list[str], kind: str) -> str | None:
        if kind == "inbox":
            for name in mailbox_names:
                if name.upper() == "INBOX":
                    return name
            return None

        sent_candidates: list[tuple[int, str]] = []
        for name in mailbox_names:
            lowered = name.lower()
            if "sent" not in lowered:
                continue

            score = 0
            if lowered.endswith("sent mail"):
                score += 4
            if lowered.endswith("sent items"):
                score += 3
            if "[gmail]" in lowered:
                score += 2
            if lowered == "sent":
                score += 1
            sent_candidates.append((score, name))

        if not sent_candidates:
            return None

        sent_candidates.sort(key=lambda item: item[0], reverse=True)
        return sent_candidates[0][1]

    def _fetch_imap_messages(
        self,
        mailbox: imaplib.IMAP4_SSL,
        mailbox_name: str,
        folder_name: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        status, _ = mailbox.select(f'"{mailbox_name}"', readonly=True)
        if status != "OK":
            return []

        status, payload = mailbox.uid("search", None, "ALL")
        if status != "OK" or not payload or not payload[0]:
            return []

        raw_uids = payload[0].split()
        messages: list[dict[str, Any]] = []
        for raw_uid in reversed(raw_uids[-limit:]):
            fetch_status, fetched_payload = mailbox.uid("fetch", raw_uid, "(BODY.PEEK[] FLAGS)")
            if fetch_status != "OK" or not isinstance(fetched_payload, list):
                continue

            raw_message = b""
            flags_blob = ""
            for part in fetched_payload:
                if not part:
                    continue
                if isinstance(part, tuple):
                    if part[1]:
                        raw_message = part[1]
                    if isinstance(part[0], bytes):
                        flags_blob = part[0].decode("utf-8", errors="replace")
                elif isinstance(part, bytes):
                    flags_blob = part.decode("utf-8", errors="replace")

            if not raw_message:
                continue

            try:
                parsed_message = email.message_from_bytes(raw_message)
            except ValueError:
                continue

            unread = "\\Seen" not in flags_blob
            messages.append(self._serialize_imap_message(parsed_message, folder_name, raw_uid.decode("ascii", errors="ignore"), unread))

        return messages

    def _serialize_imap_message(
        self,
        message: email.message.Message,
        folder_name: str,
        uid: str,
        unread: bool,
    ) -> dict[str, Any]:
        subject = decode_mime_header(message.get("Subject")) or "(No subject)"
        from_name, from_email = parseaddr(decode_mime_header(message.get("From")))
        to_entries = [
            {
                "name": name.strip(),
                "email": address.strip(),
            }
            for name, address in getaddresses(message.get_all("To", []))
            if address.strip()
        ]
        to_label = ", ".join(
            entry["name"] or entry["email"]
            for entry in to_entries[:3]
        )
        body_parts = self._extract_email_body_parts(message)
        body_fields = self._build_quickmail_body_fields(
            body_parts.get("text", ""),
            body_parts.get("html", ""),
        )
        timestamp = self._parse_email_timestamp(message.get("Date"))
        counterparty = to_label if folder_name == "sent" else (from_name.strip() or from_email.strip() or "Unknown sender")

        return {
            "id": b64url(f"{folder_name}:{uid}".encode("utf-8")),
            "folder": folder_name,
            "uid": uid,
            "subject": subject,
            "preview": compact_text(body_fields["bodyText"], 180),
            **body_fields,
            "fromName": from_name.strip(),
            "fromEmail": from_email.strip(),
            "to": to_entries,
            "toLabel": to_label,
            "counterparty": counterparty,
            "receivedAt": isoformat(timestamp) if timestamp is not None else "",
            "unread": unread,
        }

    def _extract_email_body_parts(self, message: email.message.Message) -> dict[str, str]:
        body_parts = {"text": "", "html": ""}
        if message.is_multipart():
            parts = message.walk()
        else:
            parts = [message]

        for part in parts:
            disposition = str(part.get("Content-Disposition") or "").lower()
            if "attachment" in disposition:
                continue

            content_type = part.get_content_type().lower()
            if content_type not in {"text/plain", "text/html"}:
                continue

            payload = part.get_payload(decode=True)
            charset = part.get_content_charset() or "utf-8"
            if payload is None:
                content = str(part.get_payload() or "")
            else:
                try:
                    content = payload.decode(charset, errors="replace")
                except LookupError:
                    content = payload.decode("utf-8", errors="replace")

            if content_type == "text/plain":
                cleaned = compact_text(content, 12000)
                if cleaned and not body_parts["text"]:
                    body_parts["text"] = cleaned
            elif content and not body_parts["html"]:
                body_parts["html"] = content.strip()

        return body_parts

    def _parse_email_timestamp(self, value: str | None) -> float | None:
        clean = str(value or "").strip()
        if not clean:
            return None

        try:
            parsed = parsedate_to_datetime(clean)
        except (TypeError, ValueError, IndexError, OverflowError):
            return None

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).timestamp()

    def _send_smtp_email(self, subject: str, body: str, recipient: str) -> bool:
        with self._lock:
            stored = self._state["quickmailAccount"]
            oauth_account = dict(stored) if stored.get("authType") == "oauth" else None
            smtp_host = stored["smtpHost"] or SMTP_HOST
            smtp_port = stored["smtpPort"] or SMTP_PORT
            smtp_user = stored["email"] or SMTP_USERNAME
            smtp_pass = self._quickmail_password or SMTP_PASSWORD
            smtp_from = stored["displayName"] or smtp_user

        if oauth_account is not None:
            return self._send_quickmail_oauth_email(oauth_account, subject, body, recipient)

        if not smtp_user or not smtp_pass:
            print("Email send failed: no SMTP credentials configured", file=sys.stderr, flush=True)
            return False

        message = EmailMessage()
        message["From"] = smtp_from
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)

        try:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as smtp:
                smtp.login(smtp_user, smtp_pass)
                smtp.send_message(message)
            print(f"Email delivered: recipient={recipient} subject={subject}", file=sys.stderr, flush=True)
            return True
        except Exception as exc:
            print(
                f"Email failed: recipient={recipient} error={exc}",
                file=sys.stderr,
                flush=True,
            )
            return False

    def _send_quickmail_oauth_email(self, account: dict[str, Any], subject: str, body: str, recipient: str) -> bool:
        provider = str(account.get("oauthProvider") or "").strip()
        access_token = self._quickmail_oauth_access_token(account)
        if provider == "google":
            return self._send_google_quickmail_email(account, access_token, subject, body, recipient)
        if provider == "microsoft":
            return self._send_microsoft_quickmail_email(access_token, subject, body, recipient)
        return False

    def _send_google_quickmail_email(
        self,
        account: dict[str, Any],
        access_token: str,
        subject: str,
        body: str,
        recipient: str,
    ) -> bool:
        message = EmailMessage()
        message["From"] = str(account.get("email") or "")
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        try:
            response = requests.post(
                f"{QUICKMAIL_GMAIL_API_BASE}/users/me/messages/send",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json={"raw": b64url(message.as_bytes())},
                timeout=20,
            )
            if response.status_code >= 400:
                print(f"Gmail send failed: {response.text}", file=sys.stderr, flush=True)
                return False
            return True
        except requests.RequestException as exc:
            print(f"Gmail send failed: {exc}", file=sys.stderr, flush=True)
            return False

    def _send_microsoft_quickmail_email(self, access_token: str, subject: str, body: str, recipient: str) -> bool:
        payload = {
            "message": {
                "subject": subject,
                "body": {"contentType": "Text", "content": body},
                "toRecipients": [{"emailAddress": {"address": recipient}}],
            },
            "saveToSentItems": True,
        }
        try:
            response = requests.post(
                f"{MICROSOFT_GRAPH_API_BASE}/me/sendMail",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json=payload,
                timeout=20,
            )
            if response.status_code >= 400:
                print(f"Microsoft send failed: {response.text}", file=sys.stderr, flush=True)
                return False
            return True
        except requests.RequestException as exc:
            print(f"Microsoft send failed: {exc}", file=sys.stderr, flush=True)
            return False

    def _dispatch_push_message(self, payload: dict[str, Any]) -> None:
        subscriptions = self._snapshot_subscriptions()
        if not subscriptions:
            print("Push skipped: no subscriptions registered", file=sys.stderr, flush=True)
            return

        invalid_endpoints: list[str] = []
        encoded_payload = json.dumps(payload)

        for subscription in subscriptions:
            endpoint = subscription["endpoint"]
            host = urlparse(endpoint).netloc or endpoint
            try:
                webpush(
                    subscription_info=subscription,
                    data=encoded_payload,
                    vapid_private_key=str(VAPID_PRIVATE_KEY_FILE),
                    vapid_claims={"sub": VAPID_SUBJECT},
                )
                print(
                    f"Push delivered: host={host} tag={payload.get('tag', '')}",
                    file=sys.stderr,
                    flush=True,
                )
            except WebPushException as exc:
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                print(
                    f"Push failed: host={host} status={status_code} error={exc}",
                    file=sys.stderr,
                    flush=True,
                )
                if status_code in {400, 404, 410} or "Invalid p256dh key specified" in str(exc):
                    invalid_endpoints.append(endpoint)
                    print(
                        f"Push subscription removed: host={host}",
                        file=sys.stderr,
                        flush=True,
                    )

        if invalid_endpoints:
            with self._lock:
                self._state["pushSubscriptions"] = [
                    item
                    for item in self._state["pushSubscriptions"]
                    if item["endpoint"] not in invalid_endpoints
                ]
                self._save_state_locked()

    def _snapshot_subscriptions(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._state["pushSubscriptions"])

    def _is_truelayer_monzo_configured_locked(self, monzo: dict[str, Any]) -> bool:
        return bool(
            monzo.get("connectionProvider") == "truelayer"
            and monzo.get("accountId")
            and monzo.get("refreshTokenEnc")
        )

    def _monzo_response_locked(self) -> dict[str, Any]:
        monzo = self._state["monzo"]
        developer_configured = bool(monzo.get("accountId") and self._monzo_access_token)
        truelayer_configured = self._is_truelayer_monzo_configured_locked(monzo)
        enable_banking_configured = (
            monzo.get("connectionProvider") == "enable-banking"
            and monzo.get("accountId")
        )
        connection_provider = str(monzo.get("connectionProvider") or "").strip()
        if not connection_provider and developer_configured:
            connection_provider = "monzo-developer"
        return {
            "accountId": monzo["accountId"],
            "accountDescription": monzo["accountDescription"],
            "configured": developer_configured or truelayer_configured or enable_banking_configured,
            "connectionProvider": connection_provider,
            "connectionStatus": monzo.get("connectionStatus") or ("connected" if truelayer_configured or enable_banking_configured else ""),
            "providerId": monzo.get("providerId") or "",
            "consentExpiresAt": monzo.get("consentExpiresAt"),
            "scopes": list(monzo.get("scopes") or []),
            "balanceAmountMinor": monzo.get("balanceAmountMinor"),
            "balanceCurrency": monzo.get("balanceCurrency") or "",
            "lastSyncAt": monzo["lastSyncAt"],
            "lastSyncResult": monzo["lastSyncResult"],
        }

    def _banking_response_locked(self) -> dict[str, Any]:
        banking = self._state.get("banking")
        if not isinstance(banking, dict):
            banking = self._normalize_banking_settings({})
        monzo = self._monzo_response_locked()
        provider = str(banking.get("provider") or banking.get("connectionProvider") or "").strip()
        enable_banking_configured = self._is_enable_banking_configured_locked(banking)
        csv_configured = provider == "csv" and bool(banking.get("lastSyncAt") or banking.get("lastSyncResult"))
        legacy_configured = monzo.get("configured") and not enable_banking_configured
        if legacy_configured and not provider:
            provider = str(monzo.get("connectionProvider") or "").strip()
        account_ids = banking.get("accountIds")
        if not isinstance(account_ids, list) or not account_ids:
            account_ids = [monzo.get("accountId")] if monzo.get("accountId") else []
        return {
            "provider": provider,
            "connectionProvider": provider,
            "connectionStatus": banking.get("connectionStatus") or monzo.get("connectionStatus") or "",
            "configured": bool(enable_banking_configured or csv_configured or legacy_configured),
            "institutionId": banking.get("institutionId") or banking.get("providerId") or "",
            "institutionName": banking.get("institutionName") or "",
            "requisitionId": banking.get("requisitionId") or "",
            "sessionId": banking.get("sessionId") or "",
            "aspspName": banking.get("aspspName") or banking.get("institutionName") or "",
            "aspspCountry": banking.get("aspspCountry") or "",
            "accountId": banking.get("accountId") or monzo.get("accountId") or "",
            "accountIds": list(account_ids),
            "accountDescription": banking.get("accountDescription") or monzo.get("accountDescription") or "",
            "providerId": banking.get("providerId") or monzo.get("providerId") or "",
            "consentExpiresAt": banking.get("consentExpiresAt") or monzo.get("consentExpiresAt"),
            "scopes": list(banking.get("scopes") or monzo.get("scopes") or []),
            "balanceAmountMinor": banking.get("balanceAmountMinor")
            if banking.get("balanceAmountMinor") is not None
            else monzo.get("balanceAmountMinor"),
            "balanceCurrency": banking.get("balanceCurrency") or monzo.get("balanceCurrency") or "",
            "lastSyncAt": banking.get("lastSyncAt") or monzo.get("lastSyncAt"),
            "lastSyncResult": banking.get("lastSyncResult") or monzo.get("lastSyncResult"),
        }

    def _state_response_locked(self) -> dict[str, Any]:
        return {
            "tasks": list(self._state["tasks"]),
            "alerts": {
                "enabled": self._state["alerts"]["enabled"],
                "nextAlertAt": self._state["alerts"]["nextAlertAt"],
                "testPushEnabled": self._state["alerts"]["testPushEnabled"],
                "nextTestPushAt": self._state["alerts"]["nextTestPushAt"],
                "nextUrgentAlertAt": self._state["alerts"].get("nextUrgentAlertAt"),
            },
            "planBlockReminder": {
                "nextBlock": self._state["planBlockReminder"]["nextBlock"],
                "lastSentKey": self._state["planBlockReminder"]["lastSentKey"],
            },
            "rssNewsNotifications": {
                "enabled": self._state["rssNewsNotifications"]["enabled"],
                "frequency": self._state["rssNewsNotifications"]["frequency"],
                "times": list(self._state["rssNewsNotifications"]["times"]),
                "feedUrls": list(self._state["rssNewsNotifications"]["feedUrls"]),
                "lastSentSlotKey": self._state["rssNewsNotifications"]["lastSentSlotKey"],
            },
            "notificationReminders": {
                "count": len(self._state.get("notificationReminders", {}).get("items", [])),
            },
            "outlook": {
                "email": self._state["outlook"]["email"],
                "icsUrl": self._state["outlook"]["icsUrl"],
                "syncMode": self._state["outlook"]["syncMode"],
                "configured": bool(self._state["outlook"]["email"] and self._state["outlook"]["icsUrl"]),
                "autoSyncEnabled": self._state["outlook"]["autoSyncEnabled"],
                "lastSyncAt": self._state["outlook"]["lastSyncAt"],
                "lastSyncResult": self._state["outlook"]["lastSyncResult"],
            },
            "monzo": self._monzo_response_locked(),
            "banking": self._banking_response_locked(),
            "quickmailAccount": {
                "email": self._state["quickmailAccount"]["email"],
                "displayName": self._state["quickmailAccount"]["displayName"],
                "imapHost": self._state["quickmailAccount"]["imapHost"],
                "imapPort": self._state["quickmailAccount"]["imapPort"],
                "smtpHost": self._state["quickmailAccount"]["smtpHost"],
                "smtpPort": self._state["quickmailAccount"]["smtpPort"],
                "authType": self._state["quickmailAccount"]["authType"],
                "oauthProvider": self._state["quickmailAccount"]["oauthProvider"],
                "configured": self._is_quickmail_account_configured_locked(self._state["quickmailAccount"]),
            },
        }

    def _active_tasks_locked(self) -> list[dict[str, Any]]:
        return [
            task
            for task in self._state["tasks"]
            if not task.get("completed") and task.get("text")
        ]

    def _urgent_tasks_locked(self) -> list[dict[str, Any]]:
        return [
            task
            for task in self._state["tasks"]
            if not task.get("completed") and task.get("text") and task.get("priority") == "urgent"
        ]

    def _pop_due_notification_reminders_locked(self, now: float) -> list[dict[str, Any]]:
        due_reminders, pending_state = split_due_notification_reminders(
            self._state.get("notificationReminders"),
            now,
        )
        if len(pending_state["items"]) != len(self._state.get("notificationReminders", {}).get("items", [])):
            self._state["notificationReminders"] = pending_state
            self._save_state_locked()
        return due_reminders

    def _sorted_active_tasks_locked(self) -> list[dict[str, Any]]:
        return sorted(
            self._active_tasks_locked(),
            key=lambda task: (
                0 if task.get("pinned") else 1,
            ),
        )

    def _ensure_schedule_locked(self, force: bool = False) -> None:
        alerts = self._state["alerts"]
        if not alerts["enabled"]:
            alerts["nextAlertAt"] = None
            return

        if not self._active_tasks_locked():
            alerts["nextAlertAt"] = None
            return

        if alerts["nextAlertAt"] and not force:
            return

        delay = random.randint(MIN_RANDOM_ALERT_SECONDS, MAX_RANDOM_ALERT_SECONDS)
        alerts["nextAlertAt"] = isoformat(utc_now() + delay)


class AppStoreManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._postgres = PostgresBackend(DATABASE_URL)
        self._postgres.import_existing_json_data()
        self._users_payload = self._load_users_payload()
        self._sessions = self._load_sessions()
        self._stores: dict[str, TodoStore] = {}

    def _default_users_payload(self) -> dict[str, Any]:
        return {
            "schemaVersion": AUTH_SCHEMA_VERSION,
            "legacyOwnerUserId": None,
            "users": [],
        }

    def _default_sessions_payload(self) -> dict[str, Any]:
        return {
            "schemaVersion": AUTH_SCHEMA_VERSION,
            "sessions": [],
        }

    def _load_users_payload(self) -> dict[str, Any]:
        loaded = self._postgres.load_users_payload()

        users = loaded.get("users", []) if isinstance(loaded, dict) else []
        return {
            "schemaVersion": AUTH_SCHEMA_VERSION,
            "legacyOwnerUserId": str(loaded.get("legacyOwnerUserId") or "").strip() or None
            if isinstance(loaded, dict)
            else None,
            "users": [
                self._normalize_user_record(user)
                for user in users
                if isinstance(user, dict)
            ],
        }

    def _load_sessions(self) -> list[dict[str, Any]]:
        sessions = self._postgres.load_sessions()
        return [
            self._normalize_session_record(session)
            for session in sessions
            if isinstance(session, dict)
        ]

    def _save_users_locked(self) -> None:
        self._postgres.save_users_payload(self._users_payload)

    def _save_sessions_locked(self) -> None:
        self._postgres.save_sessions(self._sessions)

    def _normalize_iso(self, value: str | None) -> str | None:
        parsed = parse_iso8601(value)
        return isoformat(parsed) if parsed is not None else None

    def _normalize_user_record(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw_username = str(payload.get("username") or "").strip()
        username = raw_username if raw_username else _username_slug(
            str(payload.get("email") or payload.get("providerId") or "user")
        )
        return {
            "id": str(payload.get("id") or uuid.uuid4()),
            "username": username or "user",
            "email": str(payload.get("email") or "").strip() or None,
            "provider": str(payload.get("provider") or "").strip() or None,
            "providerId": str(payload.get("providerId") or "").strip() or None,
            "displayName": str(payload.get("displayName") or "").strip() or None,
            "createdAt": self._normalize_iso(payload.get("createdAt")) or isoformat(),
        }

    def _normalize_session_record(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(payload.get("id") or b64url(os.urandom(24))),
            "userId": str(payload.get("userId") or "").strip(),
            "createdAt": self._normalize_iso(payload.get("createdAt")) or isoformat(),
            "lastSeenAt": self._normalize_iso(payload.get("lastSeenAt")) or isoformat(),
            "expiresAt": self._normalize_iso(payload.get("expiresAt"))
            or isoformat(utc_now() + SESSION_TTL_SECONDS),
        }

    def _generate_username_locked(self, base: str) -> str:
        slug = _username_slug(base)
        candidate = slug
        for _ in range(10):
            if not self._find_user_by_username_locked(candidate) and not self._postgres.find_user_by_username(candidate):
                return candidate
            suffix = b64url(os.urandom(2))[:3]
            candidate = f"{slug[:16]}.{suffix}"
        return f"user.{b64url(os.urandom(4))[:5]}"

    def find_or_create_oauth_user(
        self,
        *,
        provider: str,
        provider_id: str,
        email: str | None,
        display_name: str | None,
    ) -> dict[str, Any]:
        user = self._postgres.find_user_by_provider(provider, provider_id)
        if user:
            return user
        if email:
            user = self._postgres.find_user_by_email(email.lower().strip())
            if user:
                return user
        with self._lock:
            username = self._generate_username_locked(email or display_name or provider_id or "user")
        user_id = str(uuid.uuid4())
        self._postgres.create_user(
            user_id=user_id,
            username=username,
            email=email.lower().strip() if email else None,
            provider=provider,
            provider_id=provider_id,
            display_name=display_name,
        )
        return {
            "id": user_id, "username": username, "email": email,
            "provider": provider, "providerId": provider_id,
            "displayName": display_name, "createdAt": isoformat(),
        }

    def find_or_create_magic_link_user(self, email: str) -> dict[str, Any]:
        clean = email.lower().strip()
        user = self._postgres.find_user_by_email(clean)
        if user:
            return user
        with self._lock:
            username = self._generate_username_locked(clean)
        user_id = str(uuid.uuid4())
        self._postgres.create_user(
            user_id=user_id, username=username, email=clean,
            provider="magic_link", provider_id=clean, display_name=None,
        )
        return {
            "id": user_id, "username": username, "email": clean,
            "provider": "magic_link", "providerId": clean,
            "displayName": None, "createdAt": isoformat(),
        }

    def login_with_oauth_user(self, user_record: dict[str, Any]) -> str:
        with self._lock:
            if not self._find_user_by_id_locked(user_record["id"]):
                normalized = self._normalize_user_record(user_record)
                self._users_payload["users"].append(normalized)
                # create_user already committed the record to Postgres — no need
                # to call _save_users_locked(), which would run a destructive
                # DELETE on auth_users for any users not currently in memory.
            self._ensure_store_locked(user_record["id"])
            session = self._create_session_locked(user_record["id"])
        return session["id"]

    def create_oauth_state(self, provider: str) -> str:
        state = b64url(os.urandom(24))
        self._postgres.create_oauth_state(state, provider)
        return state

    def verify_oauth_state(self, state: str) -> str | None:
        result = self._postgres.consume_oauth_state(state)
        return result["provider"] if result else None

    def send_magic_link(self, email: str, verify_url: str) -> str | None:
        """Returns the sign-in link when SMTP is not configured, None when email was sent."""
        token = b64url(os.urandom(32))
        self._postgres.create_magic_link_token(token, email)
        link = f"{verify_url}?token={token}"
        sent = _send_magic_link_email(email, link)
        return None if sent else link

    def verify_magic_link(self, token: str) -> str | None:
        email = self._postgres.consume_magic_link_token(token)
        if not email:
            return None
        user_record = self.find_or_create_magic_link_user(email)
        return self.login_with_oauth_user(user_record)

    def get_notes(self, user_id: str) -> list[dict[str, Any]]:
        raw = self._postgres.load_notes(user_id)
        result = []
        for n in raw:
            try:
                result.append({
                    "id": n["id"],
                    "title": _decrypt_field(n["titleEnc"]),
                    "body": _decrypt_field(n["bodyEnc"]),
                    "updatedAt": n["updatedAt"],
                })
            except Exception:
                result.append({"id": n["id"], "title": "(error)", "body": "", "updatedAt": n["updatedAt"]})
        return result

    def save_note(self, user_id: str, note_id: str, title: str, body: str) -> dict[str, Any]:
        title_enc = _encrypt_field(title[:512])
        body_enc = _encrypt_field(body[:65536])
        updated_at = isoformat()
        self._postgres.save_note(user_id, note_id, title_enc, body_enc)
        return {"id": note_id, "title": title, "body": body, "updatedAt": updated_at}

    def delete_note(self, user_id: str, note_id: str) -> None:
        self._postgres.delete_note(user_id, note_id)

    def _ensure_store_locked(self, user_id: str) -> TodoStore:
        store = self._stores.get(user_id)
        if store is None:
            store = TodoStore(UserStateBackend(self._postgres, user_id))
            with store._lock:
                store._save_state_locked()
            self._stores[user_id] = store
        return store

    def get_user_store(self, user_id: str) -> TodoStore:
        with self._lock:
            if not self._find_user_by_id_locked(user_id):
                raise AuthError("User account not found.")
            return self._ensure_store_locked(user_id)

    def find_user_store_by_username(self, username: str) -> TodoStore | None:
        """Return the TodoStore for the user with the given username (case-insensitive), or None."""
        needle = username.lower()
        with self._lock:
            user = next(
                (u for u in self._users_payload["users"] if str(u.get("username") or "").lower() == needle),
                None,
            )
            if user is None:
                return None
            return self._ensure_store_locked(user["id"])

    def login_demo(self) -> tuple[str, dict[str, Any]] | None:
        """Create a session for the demo account. Returns (session_id, public_user) or None."""
        needle = "demo"
        with self._lock:
            user = next(
                (u for u in self._users_payload["users"] if str(u.get("username") or "").lower() == needle),
                None,
            )
            if user is None:
                return None
            self._ensure_store_locked(user["id"])
            session = self._create_session_locked(user["id"])
            public_user = self._public_user_payload_locked(user)
        return session["id"], public_user

    def ensure_local_account(self) -> dict[str, Any]:
        """Create the single local app user if it does not exist."""
        needle = "local"
        # Check in-memory first (case-insensitive)
        with self._lock:
            existing = next(
                (u for u in self._users_payload["users"] if str(u.get("username") or "").lower() == needle),
                None,
            )
            if existing:
                self._ensure_store_locked(existing["id"])
                return self._public_user_payload_locked(existing)

        # Not in memory — check Postgres (case-insensitive)
        with self._postgres._pool.connection() as conn:
            row = conn.execute(
                "SELECT id, username, email, provider, provider_id, display_name, created_at "
                "FROM auth_users WHERE lower(username) = %s",
                (needle,),
            ).fetchone()

        if row:
            user_record = {
                "id": row["id"],
                "username": row["username"],
                "email": row["email"],
                "provider": row["provider"],
                "providerId": row["provider_id"],
                "displayName": row["display_name"],
                "createdAt": row["created_at"],
            }
        else:
            user_id = str(uuid.uuid4())
            self._postgres.create_user(
                user_id=user_id,
                username="local",
                email=None,
                provider="local",
                provider_id="local",
                display_name="Local",
            )
            user_record = {
                "id": user_id,
                "username": "local",
                "email": None,
                "provider": "local",
                "providerId": "local",
                "displayName": "Local",
                "createdAt": isoformat(),
            }
            print(f"[local] Created local app user with id={user_id}", flush=True)

        with self._lock:
            # Reload from Postgres to pick up any changes, then add to memory
            self._users_payload = self._load_users_payload()
            # Ensure store exists
            norm = self._normalize_user_record(user_record)
            if not self._find_user_by_id_locked(norm["id"]):
                self._users_payload["users"].append(norm)
            self._ensure_store_locked(norm["id"])
            return self._public_user_payload_locked(norm)

    def get_push_config(self) -> dict[str, str]:
        return {"publicKey": VAPID_PUBLIC_KEY}

    def _find_user_by_id_locked(self, user_id: str) -> dict[str, Any] | None:
        for user in self._users_payload["users"]:
            if user["id"] == user_id:
                return user
        return None

    def _find_user_by_username_locked(self, username: str) -> dict[str, Any] | None:
        for user in self._users_payload["users"]:
            if user["username"] == username:
                return user
        return None

    def _purge_expired_sessions_locked(self) -> None:
        now = utc_now()
        next_sessions: list[dict[str, Any]] = []
        changed = False
        for session in self._sessions:
            expires_at = parse_iso8601(session.get("expiresAt"))
            if expires_at is None or expires_at <= now:
                changed = True
                continue
            next_sessions.append(session)
        if changed:
            self._sessions = next_sessions
            self._save_sessions_locked()

    def _create_session_locked(self, user_id: str) -> dict[str, Any]:
        session = {
            "id": b64url(os.urandom(32)),
            "userId": user_id,
            "createdAt": isoformat(),
            "lastSeenAt": isoformat(),
            "expiresAt": isoformat(utc_now() + SESSION_TTL_SECONDS),
        }
        self._sessions = [
            existing
            for existing in self._sessions
            if existing.get("id") != session["id"]
        ]
        self._sessions.append(session)
        self._save_sessions_locked()
        return session

    def _public_user_payload_locked(self, user: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": user["id"],
            "username": user["username"],
            "displayName": user.get("displayName") or user["username"],
            "email": user.get("email"),
            "createdAt": user["createdAt"],
        }

    def get_session(self, session_id: str | None) -> dict[str, Any]:
        if not session_id:
            return {"authenticated": False}

        with self._lock:
            self._purge_expired_sessions_locked()
            session = next((item for item in self._sessions if item["id"] == session_id), None)
            if not session:
                return {"authenticated": False}
            user = self._find_user_by_id_locked(session["userId"])
            if not user:
                self._sessions = [item for item in self._sessions if item["id"] != session_id]
                self._save_sessions_locked()
                return {"authenticated": False}
            now = utc_now()
            expires_at = parse_iso8601(session.get("expiresAt")) or 0
            last_seen_at = parse_iso8601(session.get("lastSeenAt")) or 0
            session["lastSeenAt"] = isoformat(now)
            session["expiresAt"] = isoformat(now + SESSION_TTL_SECONDS)
            if (
                now - last_seen_at >= SESSION_TOUCH_SAVE_INTERVAL_SECONDS
                or expires_at - now <= SESSION_TOUCH_SAVE_INTERVAL_SECONDS
            ):
                self._save_sessions_locked()
            return {
                "authenticated": True,
                "user": self._public_user_payload_locked(user),
            }

    def logout(self, session_id: str | None) -> None:
        if not session_id:
            return
        with self._lock:
            self._sessions = [item for item in self._sessions if item["id"] != session_id]
            self._save_sessions_locked()

    def tick(self) -> None:
        with self._lock:
            user_ids = [str(user["id"]) for user in self._users_payload["users"]]
            stores = [self._ensure_store_locked(user_id) for user_id in user_ids]
        for store in stores:
            store.tick()


def _normalize_scope_origin(origin: str) -> str:
    try:
        parsed = urlparse(str(origin or "").strip())
    except Exception:
        return ""
    scheme = parsed.scheme.lower().strip()
    netloc = parsed.netloc.lower().strip()
    if not scheme or not netloc:
        return ""
    return f"{scheme}://{netloc}"


def _scoped_state_id(scope_origin: str) -> str:
    normalized = _normalize_scope_origin(scope_origin)
    if not normalized:
        raise ValueError("A valid origin is required for scoped helper state.")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]


class LocalPushStore:
    def __init__(self, state_file: Path, *, scope_origin: str = "") -> None:
        self._lock = threading.Lock()
        self._state_file = state_file
        self._scope_origin = _normalize_scope_origin(scope_origin)
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state = self._load_state()

    def _default_state(self) -> dict[str, Any]:
        return {
            "schemaVersion": 2,
            "scopeOrigin": self._scope_origin or None,
            "alerts": {
                "enabled": True,
                "nextAlertAt": None,
                "testPushEnabled": False,
                "nextTestPushAt": None,
            },
            "planBlockReminder": {
                "nextBlock": None,
                "lastSentKey": None,
            },
            "rssNewsNotifications": {
                "enabled": False,
                "frequency": 3,
                "times": list(RSS_NEWS_DEFAULT_TIMES),
                "feedUrls": [],
                "lastSentSlotKey": None,
                "sentItemKeys": [],
            },
            "notificationReminders": {
                "items": [],
            },
            "pushSubscriptions": [],
        }

    def _load_state(self) -> dict[str, Any]:
        if not self._state_file.exists():
            return self._default_state()

        try:
            loaded = json.loads(self._state_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return self._default_state()

        if not isinstance(loaded, dict):
            return self._default_state()

        alerts = loaded.get("alerts", {})
        plan_block_reminder = loaded.get("planBlockReminder", {})
        rss_news_notifications = loaded.get("rssNewsNotifications", {})
        notification_reminders = loaded.get("notificationReminders", {})
        subscriptions = loaded.get("pushSubscriptions", [])
        if not isinstance(alerts, dict):
            alerts = {}
        if not isinstance(plan_block_reminder, dict):
            plan_block_reminder = {}
        if not isinstance(subscriptions, list):
            subscriptions = []
        scope_origin = _normalize_scope_origin(loaded.get("scopeOrigin") or self._scope_origin)
        self._scope_origin = scope_origin

        return {
            "schemaVersion": 2,
            "scopeOrigin": scope_origin or None,
            "alerts": {
                "enabled": alerts.get("enabled", True) is not False,
                "nextAlertAt": self._normalize_iso(alerts.get("nextAlertAt")),
                "testPushEnabled": alerts.get("testPushEnabled", False) is True,
                "nextTestPushAt": self._normalize_iso(alerts.get("nextTestPushAt")),
            },
            "planBlockReminder": {
                "nextBlock": self._normalize_plan_block_reminder(plan_block_reminder.get("nextBlock")),
                "lastSentKey": str(plan_block_reminder.get("lastSentKey") or "") or None,
            },
            "rssNewsNotifications": self._normalize_rss_news_notifications(rss_news_notifications),
            "notificationReminders": normalize_notification_reminders(notification_reminders),
            "pushSubscriptions": [
                self._normalize_subscription(item)
                for item in subscriptions
                if self._is_valid_subscription(item)
            ],
        }

    def _save_state_locked(self) -> None:
        self._state["schemaVersion"] = 2
        self._state["scopeOrigin"] = self._scope_origin or None
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._state_file.with_suffix(".json.tmp")
        temp_path.write_text(json.dumps(self._state, indent=2), encoding="utf-8")
        temp_path.replace(self._state_file)

    def relocate(self, state_file: Path, *, scope_origin: str) -> None:
        normalized_scope = _normalize_scope_origin(scope_origin)
        with self._lock:
            old_state_file = self._state_file
            self._state_file = state_file
            self._scope_origin = normalized_scope
            self._save_state_locked()
            if old_state_file != state_file and old_state_file.exists():
                try:
                    old_state_file.unlink()
                except OSError:
                    pass

    def _state_response_locked(self) -> dict[str, Any]:
        return {
            "alerts": {
                "enabled": self._state["alerts"]["enabled"],
                "nextAlertAt": self._state["alerts"]["nextAlertAt"],
                "testPushEnabled": self._state["alerts"]["testPushEnabled"],
                "nextTestPushAt": self._state["alerts"]["nextTestPushAt"],
            },
            "planBlockReminder": {
                "nextBlock": self._state["planBlockReminder"]["nextBlock"],
                "lastSentKey": self._state["planBlockReminder"]["lastSentKey"],
            },
            "rssNewsNotifications": {
                "enabled": self._state["rssNewsNotifications"]["enabled"],
                "frequency": self._state["rssNewsNotifications"]["frequency"],
                "times": list(self._state["rssNewsNotifications"]["times"]),
                "feedUrls": list(self._state["rssNewsNotifications"]["feedUrls"]),
                "lastSentSlotKey": self._state["rssNewsNotifications"]["lastSentSlotKey"],
            },
            "notificationReminders": {
                "count": len(self._state.get("notificationReminders", {}).get("items", [])),
            },
            "subscriptionCount": len(self._state["pushSubscriptions"]),
        }

    def _normalize_iso(self, value: str | None) -> str | None:
        parsed = parse_iso8601(value)
        return isoformat(parsed) if parsed is not None else None

    def _normalize_subscription(self, subscription: dict[str, Any]) -> dict[str, Any]:
        return {
            "endpoint": str(subscription.get("endpoint") or ""),
            "expirationTime": subscription.get("expirationTime"),
            "keys": {
                "p256dh": str(subscription.get("keys", {}).get("p256dh") or ""),
                "auth": str(subscription.get("keys", {}).get("auth") or ""),
            },
        }

    def _normalize_plan_block_reminder(self, value: Any) -> dict[str, Any] | None:
        if not isinstance(value, dict):
            return None
        start_at = self._normalize_iso(value.get("startAt"))
        reminder_at = self._normalize_iso(value.get("reminderAt"))
        label = str(value.get("label") or "").strip()
        if not start_at or not reminder_at or not label:
            return None
        reminder_minutes = value.get("reminderMinutes")
        try:
            reminder_minutes = max(0, min(120, int(reminder_minutes)))
        except (TypeError, ValueError):
            reminder_minutes = 15
        return {
            "id": str(value.get("id") or "next"),
            "label": label,
            "sourceType": str(value.get("sourceType") or "block"),
            "startAt": start_at,
            "reminderAt": reminder_at,
            "reminderMinutes": reminder_minutes,
        }

    def _normalize_rss_news_notifications(self, value: Any) -> dict[str, Any]:
        payload = value if isinstance(value, dict) else {}
        try:
            frequency = max(1, min(6, int(payload.get("frequency", 3))))
        except (TypeError, ValueError):
            frequency = 3
        times = [
            str(item).strip()
            for item in (payload.get("times") if isinstance(payload.get("times"), list) else list(RSS_NEWS_DEFAULT_TIMES))
            if isinstance(item, str) and parse_hhmm(item.strip()) is not None
        ]
        if not times:
            times = list(RSS_NEWS_DEFAULT_TIMES)
        feed_urls = []
        for url in payload.get("feedUrls") if isinstance(payload.get("feedUrls"), list) else []:
            clean_url = str(url or "").strip()
            parsed = urlparse(clean_url)
            if parsed.scheme in {"http", "https"} and parsed.netloc and clean_url not in feed_urls:
                feed_urls.append(clean_url)
            if len(feed_urls) >= RSS_NEWS_MAX_FEEDS:
                break
        sent_item_keys = [
            str(item or "").strip()
            for item in payload.get("sentItemKeys", [])
            if str(item or "").strip()
        ][:RSS_NEWS_RECENT_ITEM_LIMIT]
        return {
            "enabled": payload.get("enabled", False) is True,
            "frequency": frequency,
            "times": sorted(set(times))[:6],
            "feedUrls": feed_urls,
            "lastSentSlotKey": str(payload.get("lastSentSlotKey") or "") or None,
            "sentItemKeys": sent_item_keys,
        }

    def _is_valid_subscription(self, subscription: Any) -> bool:
        if not isinstance(subscription, dict):
            return False

        keys = subscription.get("keys")
        p256dh = keys.get("p256dh") if isinstance(keys, dict) else None
        auth = keys.get("auth") if isinstance(keys, dict) else None
        p256dh_raw = b64url_decode(p256dh) if isinstance(p256dh, str) else None
        auth_raw = b64url_decode(auth) if isinstance(auth, str) else None
        return (
            isinstance(subscription.get("endpoint"), str)
            and isinstance(keys, dict)
            and isinstance(p256dh, str)
            and isinstance(auth, str)
            and p256dh_raw is not None
            and len(p256dh_raw) == 65
            and auth_raw is not None
            and len(auth_raw) == 16
        )

    def get_push_config(self) -> dict[str, str]:
        return {"publicKey": VAPID_PUBLIC_KEY}

    def claim_alerts(self) -> dict[str, list[Any]]:
        return {"alerts": []}

    def add_subscription(self, subscription: dict[str, Any]) -> dict[str, Any]:
        if not self._is_valid_subscription(subscription):
            raise ValueError("Invalid push subscription")

        normalized = self._normalize_subscription(subscription)
        with self._lock:
            self._state["pushSubscriptions"] = [
                item
                for item in self._state["pushSubscriptions"]
                if item["endpoint"] != normalized["endpoint"]
            ]
            self._state["pushSubscriptions"].append(normalized)
            self._save_state_locked()
            return self._state_response_locked()

    def remove_subscription(self, endpoint: str) -> dict[str, Any]:
        with self._lock:
            self._state["pushSubscriptions"] = [
                item
                for item in self._state["pushSubscriptions"]
                if item["endpoint"] != endpoint
            ]
            self._save_state_locked()
            return self._state_response_locked()

    def set_alerts_enabled(self, enabled: bool) -> dict[str, Any]:
        with self._lock:
            self._state["alerts"]["enabled"] = bool(enabled)
            if enabled:
                self._ensure_alert_schedule_locked(force=True)
            else:
                self._state["alerts"]["nextAlertAt"] = None
            self._save_state_locked()
            return self._state_response_locked()

    def set_test_push_enabled(self, enabled: bool) -> dict[str, Any]:
        with self._lock:
            self._state["alerts"]["testPushEnabled"] = bool(enabled)
            self._state["alerts"]["nextTestPushAt"] = (
                isoformat(utc_now() + TEST_PUSH_INTERVAL_SECONDS)
                if enabled
                else None
            )
            self._save_state_locked()
            return self._state_response_locked()

    def set_plan_block_reminder(self, next_block: Any) -> dict[str, Any]:
        with self._lock:
            self._state["planBlockReminder"]["nextBlock"] = self._normalize_plan_block_reminder(next_block)
            if self._state["planBlockReminder"]["nextBlock"] is None:
                self._state["planBlockReminder"]["lastSentKey"] = None
            self._save_state_locked()
            return self._state_response_locked()

    def update_rss_news_notification_settings(
        self,
        *,
        enabled: Any = None,
        frequency: Any = None,
        times: Any = None,
        feed_urls: Any = None,
    ) -> dict[str, Any]:
        with self._lock:
            current = dict(self._state.get("rssNewsNotifications", {}))
            if enabled is not None:
                current["enabled"] = enabled is True
            if frequency is not None:
                current["frequency"] = frequency
            if times is not None:
                current["times"] = times
            if feed_urls is not None:
                current["feedUrls"] = feed_urls
            current.setdefault("lastSentSlotKey", self._state["rssNewsNotifications"].get("lastSentSlotKey"))
            current.setdefault("sentItemKeys", self._state["rssNewsNotifications"].get("sentItemKeys", []))
            self._state["rssNewsNotifications"] = self._normalize_rss_news_notifications(current)
            self._save_state_locked()
            return self._state_response_locked()

    def update_notification_reminders(self, reminders: Any) -> dict[str, Any]:
        with self._lock:
            self._state["notificationReminders"] = normalize_notification_reminders(reminders)
            self._save_state_locked()
            return self._state_response_locked()

    def _pop_due_notification_reminders_locked(self, now: float) -> list[dict[str, Any]]:
        due_reminders, pending_state = split_due_notification_reminders(
            self._state.get("notificationReminders"),
            now,
        )
        if len(pending_state["items"]) != len(self._state.get("notificationReminders", {}).get("items", [])):
            self._state["notificationReminders"] = pending_state
            self._save_state_locked()
        return due_reminders

    def _rss_news_due_slot_locked(self, now: float) -> str | None:
        settings = self._state["rssNewsNotifications"]
        if not settings["enabled"] or not settings["feedUrls"]:
            return None
        local_now = datetime.fromtimestamp(now, timezone.utc).astimezone(get_timezone(DEFAULT_EMAIL_TIMEZONE) or timezone.utc)
        day_key = local_now.strftime("%Y-%m-%d")
        for time_value in settings["times"][: settings["frequency"]]:
            parsed_time = parse_hhmm(time_value)
            if parsed_time is None:
                continue
            hour, minute = parsed_time
            slot_at = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            age_seconds = (local_now - slot_at).total_seconds()
            slot_key = f"{day_key}:{time_value}"
            if 0 <= age_seconds <= RSS_NEWS_SLOT_GRACE_SECONDS and settings.get("lastSentSlotKey") != slot_key:
                return slot_key
        return None

    def _build_rss_news_push_payload(self, slot_key: str) -> dict[str, Any] | None:
        with self._lock:
            settings = self._state["rssNewsNotifications"]
            feed_urls = list(settings["feedUrls"])
            sent_item_keys = set(settings.get("sentItemKeys", []))

        candidates: list[dict[str, Any]] = []
        for feed_url in feed_urls:
            try:
                feed = fetch_rss_feed(feed_url)
            except Exception as exc:
                print(f"RSS news notification feed failed: url={feed_url} error={exc}", file=sys.stderr, flush=True)
                continue
            source_name = str(feed.get("title") or urlparse(feed_url).netloc or "RSS").strip()
            for item in feed.get("items", []):
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title") or "").strip()
                item_url = str(item.get("url") or "").strip()
                if not title:
                    continue
                candidates.append({
                    "title": title,
                    "url": item_url,
                    "sourceName": str(item.get("sourceName") or source_name).strip() or source_name,
                    "publishedAt": parse_iso8601(item.get("publishedAt")) or 0,
                    "itemKey": item_url or f"{source_name}:{title}",
                })

        if not candidates:
            return None

        candidates.sort(key=lambda item: item["publishedAt"], reverse=True)
        selected = next((item for item in candidates if item["itemKey"] not in sent_item_keys), candidates[0])
        with self._lock:
            settings = self._state["rssNewsNotifications"]
            recent_keys = [selected["itemKey"], *settings.get("sentItemKeys", [])]
            settings["sentItemKeys"] = list(dict.fromkeys(recent_keys))[:RSS_NEWS_RECENT_ITEM_LIMIT]
            settings["lastSentSlotKey"] = slot_key
            self._save_state_locked()

        return {
            "title": "Latest news",
            "body": f"{selected['sourceName']}: {selected['title']}",
            "tag": f"cordyceps-rss-news-{slot_key}",
            "data": {
                "url": selected["url"] or "/?page=rss",
                "kind": "rss-news",
                "sentAt": isoformat(utc_now()),
            },
        }

    def tick(self) -> None:
        alert_payload: dict[str, Any] | None = None
        test_push_payload: dict[str, Any] | None = None
        plan_block_payload: dict[str, Any] | None = None
        rss_news_slot_key: str | None = None
        notification_scheduler_payloads: list[dict[str, Any]] = []
        with self._lock:
            alerts = self._state["alerts"]
            plan_block_reminder = self._state["planBlockReminder"]
            now = utc_now()
            rss_news_slot_key = self._rss_news_due_slot_locked(now)
            due_notification_reminders = self._pop_due_notification_reminders_locked(now)
            notification_scheduler_payloads = [
                build_notification_scheduler_payload(reminder, now)
                for reminder in due_notification_reminders
            ]

            if alerts["testPushEnabled"]:
                next_test_push_at = parse_iso8601(alerts["nextTestPushAt"])
                if next_test_push_at is None or next_test_push_at <= now:
                    test_push_payload = {
                        "title": "Test notification",
                        "body": "This is a 10 second test push from Cordyceps.",
                        "tag": "cordyceps-test-push",
                        "data": {
                            "url": "/?page=tasks",
                            "kind": "test-push",
                            "sentAt": isoformat(now),
                        },
                    }
                    alerts["nextTestPushAt"] = isoformat(now + TEST_PUSH_INTERVAL_SECONDS)
                    self._save_state_locked()

            if alerts["enabled"]:
                next_alert_at = parse_iso8601(alerts["nextAlertAt"])
                if next_alert_at is None:
                    self._ensure_alert_schedule_locked(force=True)
                    self._save_state_locked()
                elif next_alert_at <= now:
                    alert_payload = {
                        "title": APP_NAME,
                        "body": "Check Cordyceps.",
                        "tag": "cordyceps-background-reminder",
                        "data": {
                            "url": "/?page=tasks",
                            "kind": "generic-reminder",
                            "sentAt": isoformat(now),
                        },
                    }
                    self._ensure_alert_schedule_locked(force=True)
                    self._save_state_locked()

            next_block = plan_block_reminder.get("nextBlock")
            if isinstance(next_block, dict):
                reminder_at = parse_iso8601(next_block.get("reminderAt"))
                start_at = parse_iso8601(next_block.get("startAt"))
                sent_key = f"{next_block.get('id')}:{next_block.get('startAt')}:{next_block.get('reminderMinutes')}"
                if (
                    reminder_at is not None
                    and start_at is not None
                    and reminder_at <= now
                    and start_at > now
                    and plan_block_reminder.get("lastSentKey") != sent_key
                ):
                    plan_block_payload = {
                        "title": "Plan block soon",
                        "body": f"{next_block['label']} starts soon.",
                        "tag": f"cordyceps-plan-block-{next_block.get('id') or 'next'}",
                        "data": {
                            "url": "/?page=plan-your-day",
                            "kind": "plan-block-reminder",
                            "sentAt": isoformat(now),
                        },
                    }
                    plan_block_reminder["lastSentKey"] = sent_key
                    self._save_state_locked()

        if test_push_payload is not None:
            self._dispatch_push_message(test_push_payload)

        if alert_payload is not None:
            self._dispatch_push_message(alert_payload)

        if plan_block_payload is not None:
            self._dispatch_push_message(plan_block_payload)

        for payload in notification_scheduler_payloads:
            self._dispatch_push_message(payload)

        if rss_news_slot_key is not None:
            rss_news_payload = self._build_rss_news_push_payload(rss_news_slot_key)
            if rss_news_payload is not None:
                self._dispatch_push_message(rss_news_payload)

    def _ensure_alert_schedule_locked(self, force: bool = False) -> None:
        alerts = self._state["alerts"]
        if not alerts["enabled"]:
            alerts["nextAlertAt"] = None
            return
        if alerts["nextAlertAt"] and not force:
            return
        delay = random.randint(MIN_RANDOM_ALERT_SECONDS, MAX_RANDOM_ALERT_SECONDS)
        alerts["nextAlertAt"] = isoformat(utc_now() + delay)

    def _dispatch_push_message(self, payload: dict[str, Any]) -> None:
        subscriptions = self._snapshot_subscriptions()
        if not subscriptions:
            print("Push skipped: no local subscriptions registered", file=sys.stderr, flush=True)
            return
        if webpush is None:
            print("Push skipped: pywebpush is not installed", file=sys.stderr, flush=True)
            return

        invalid_endpoints: list[str] = []
        encoded_payload = json.dumps(payload)

        for subscription in subscriptions:
            endpoint = subscription["endpoint"]
            host = urlparse(endpoint).netloc or endpoint
            try:
                webpush(
                    subscription_info=subscription,
                    data=encoded_payload,
                    vapid_private_key=str(VAPID_PRIVATE_KEY_FILE),
                    vapid_claims={"sub": VAPID_SUBJECT},
                )
                print(
                    f"Local push delivered: host={host} tag={payload.get('tag', '')}",
                    file=sys.stderr,
                    flush=True,
                )
            except WebPushException as exc:
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                print(
                    f"Local push failed: host={host} status={status_code} error={exc}",
                    file=sys.stderr,
                    flush=True,
                )
                if status_code in {400, 404, 410} or "Invalid p256dh key specified" in str(exc):
                    invalid_endpoints.append(endpoint)

        if invalid_endpoints:
            with self._lock:
                self._state["pushSubscriptions"] = [
                    item
                    for item in self._state["pushSubscriptions"]
                    if item["endpoint"] not in invalid_endpoints
                ]
                self._save_state_locked()

    def _snapshot_subscriptions(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._state["pushSubscriptions"])


class LocalPushStoreRegistry:
    def __init__(self, data_dir: Path = DATA_DIR) -> None:
        self._lock = threading.Lock()
        self._data_dir = data_dir
        self._legacy_state_file = data_dir / LOCAL_PUSH_STATE_FILE.name
        self._stores: dict[str, LocalPushStore] = {}
        self._load_existing_stores()

    def _load_existing_stores(self) -> None:
        self._data_dir.mkdir(parents=True, exist_ok=True)
        scoped_paths = sorted(self._data_dir.glob(f"{LOCAL_PUSH_STATE_FILE_PREFIX}*.json"))
        with self._lock:
            for path in scoped_paths:
                scope_id = path.stem.removeprefix(LOCAL_PUSH_STATE_FILE_PREFIX)
                if scope_id:
                    self._stores[scope_id] = LocalPushStore(path)
            if not self._stores and self._legacy_state_file.exists():
                self._stores["legacy"] = LocalPushStore(self._legacy_state_file)

    def _state_file_for_scope_id(self, scope_id: str) -> Path:
        return self._data_dir / f"{LOCAL_PUSH_STATE_FILE_PREFIX}{scope_id}.json"

    def get_store(self, scope_origin: str) -> LocalPushStore:
        normalized_scope = _normalize_scope_origin(scope_origin)
        scope_id = _scoped_state_id(normalized_scope)
        with self._lock:
            existing = self._stores.get(scope_id)
            if existing is not None:
                return existing
            legacy_store = self._stores.pop("legacy", None)
            if legacy_store is not None:
                legacy_store.relocate(self._state_file_for_scope_id(scope_id), scope_origin=normalized_scope)
                self._stores[scope_id] = legacy_store
                return legacy_store
            store = LocalPushStore(self._state_file_for_scope_id(scope_id), scope_origin=normalized_scope)
            self._stores[scope_id] = store
            return store

    def tick(self) -> None:
        with self._lock:
            stores = list(self._stores.values())
        for store in stores:
            store.tick()


def _default_local_banking_state(scope_origin: str = "") -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "scopeOrigin": _normalize_scope_origin(scope_origin) or None,
        "provider": "",
        "connectionProvider": "",
        "connectionStatus": "",
        "institutionId": "",
        "institutionName": "",
        "requisitionId": "",
        "sessionId": "",
        "aspspName": "",
        "aspspCountry": "",
        "accountId": "",
        "accountIds": [],
        "accountDescription": "",
        "providerId": "",
        "accessTokenEnc": "",
        "refreshTokenEnc": "",
        "tokenExpiresAt": 0.0,
        "refreshTokenExpiresAt": 0.0,
        "consentExpiresAt": None,
        "scopes": [],
        "balanceAmountMinor": None,
        "balanceCurrency": "",
        "lastSyncAt": None,
        "lastSyncResult": None,
        "pendingState": "",
    }


class LocalBankingStore:
    def __init__(self, state_file: Path, *, scope_origin: str = "") -> None:
        self._lock = threading.Lock()
        self._state_file = state_file
        self._scope_origin = _normalize_scope_origin(scope_origin)
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state = self._load_state()

    def _default_state(self) -> dict[str, Any]:
        return _default_local_banking_state(self._scope_origin)

    def _normalize_optional_text(self, value: Any) -> str | None:
        clean_value = str(value or "").strip()
        return clean_value or None

    def _normalize_state(self, loaded: Any) -> dict[str, Any]:
        payload = loaded if isinstance(loaded, dict) else {}
        state = _default_local_banking_state(payload.get("scopeOrigin") or self._scope_origin)
        state["provider"] = str(payload.get("provider") or "").strip()
        state["connectionProvider"] = str(payload.get("connectionProvider") or "").strip()
        state["connectionStatus"] = str(payload.get("connectionStatus") or "").strip()
        state["institutionId"] = str(payload.get("institutionId") or "").strip()
        state["institutionName"] = str(payload.get("institutionName") or "").strip()
        state["requisitionId"] = str(payload.get("requisitionId") or "").strip()
        state["sessionId"] = str(payload.get("sessionId") or "").strip()
        state["aspspName"] = str(payload.get("aspspName") or "").strip()
        state["aspspCountry"] = str(payload.get("aspspCountry") or "").strip()
        state["accountId"] = str(payload.get("accountId") or "").strip()
        state["accountIds"] = [
            str(item).strip()
            for item in payload.get("accountIds")
            if str(item).strip()
        ] if isinstance(payload.get("accountIds"), list) else []
        state["accountDescription"] = str(payload.get("accountDescription") or "").strip()
        state["providerId"] = str(payload.get("providerId") or "").strip()
        state["accessTokenEnc"] = str(payload.get("accessTokenEnc") or "").strip()
        state["refreshTokenEnc"] = str(payload.get("refreshTokenEnc") or "").strip()
        try:
            state["tokenExpiresAt"] = float(payload.get("tokenExpiresAt") or 0.0)
        except (TypeError, ValueError):
            state["tokenExpiresAt"] = 0.0
        try:
            state["refreshTokenExpiresAt"] = float(payload.get("refreshTokenExpiresAt") or 0.0)
        except (TypeError, ValueError):
            state["refreshTokenExpiresAt"] = 0.0
        state["consentExpiresAt"] = self._normalize_optional_text(payload.get("consentExpiresAt"))
        state["scopes"] = [
            str(item).strip()
            for item in payload.get("scopes")
            if str(item).strip()
        ] if isinstance(payload.get("scopes"), list) else []
        balance_amount_minor = payload.get("balanceAmountMinor")
        if balance_amount_minor is None or isinstance(balance_amount_minor, bool):
            state["balanceAmountMinor"] = None
        else:
            try:
                state["balanceAmountMinor"] = int(balance_amount_minor)
            except (TypeError, ValueError):
                state["balanceAmountMinor"] = None
        state["balanceCurrency"] = str(payload.get("balanceCurrency") or "").strip()
        state["lastSyncAt"] = self._normalize_optional_text(payload.get("lastSyncAt"))
        state["lastSyncResult"] = self._normalize_optional_text(payload.get("lastSyncResult"))
        state["pendingState"] = str(payload.get("pendingState") or "").strip()
        self._scope_origin = _normalize_scope_origin(state.get("scopeOrigin") or self._scope_origin)
        state["scopeOrigin"] = self._scope_origin or None
        return state

    def _load_state(self) -> dict[str, Any]:
        if not self._state_file.exists():
            return self._default_state()
        try:
            loaded = json.loads(self._state_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return self._default_state()
        return self._normalize_state(loaded)

    def _save_state_locked(self) -> None:
        self._state["schemaVersion"] = 1
        self._state["scopeOrigin"] = self._scope_origin or None
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._state_file.with_suffix(".json.tmp")
        temp_path.write_text(json.dumps(self._state, indent=2), encoding="utf-8")
        temp_path.replace(self._state_file)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            snapshot = dict(self._state)
            snapshot["accountIds"] = list(self._state.get("accountIds") or [])
            snapshot["scopes"] = list(self._state.get("scopes") or [])
            return snapshot

    def update(self, updates: dict[str, Any]) -> None:
        with self._lock:
            merged = dict(self._state)
            merged.update(updates)
            self._state = self._normalize_state(merged)
            self._save_state_locked()

    def reset(self) -> None:
        with self._lock:
            self._state = self._default_state()
            self._save_state_locked()


class LocalBankingStoreRegistry:
    def __init__(self, data_dir: Path = DATA_DIR) -> None:
        self._lock = threading.Lock()
        self._data_dir = data_dir
        self._stores: dict[str, LocalBankingStore] = {}
        self._data_dir.mkdir(parents=True, exist_ok=True)

    def _state_file_for_scope_id(self, scope_id: str) -> Path:
        return self._data_dir / f"{LOCAL_BANKING_STATE_FILE_PREFIX}{scope_id}.json"

    def get_store(self, scope_origin: str) -> LocalBankingStore:
        normalized_scope = _normalize_scope_origin(scope_origin)
        scope_id = _scoped_state_id(normalized_scope)
        with self._lock:
            existing = self._stores.get(scope_id)
            if existing is not None:
                return existing
            store = LocalBankingStore(self._state_file_for_scope_id(scope_id), scope_origin=normalized_scope)
            self._stores[scope_id] = store
            return store


STORE = None if LOCAL_PWA_MODE else AppStoreManager()
if STORE is not None:
    STORE.ensure_local_account()
LOCAL_PUSH_REGISTRY = LocalPushStoreRegistry() if LOCAL_PWA_MODE else None
LOCAL_BANKING_REGISTRY = LocalBankingStoreRegistry() if LOCAL_PWA_MODE else None


class SchedulerThread(threading.Thread):
    def __init__(self) -> None:
        super().__init__(daemon=True)
        self._stop_event = threading.Event()

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        while not self._stop_event.wait(SCHEDULER_POLL_SECONDS):
            if STORE is not None:
                STORE.tick()
            if LOCAL_PUSH_REGISTRY is not None:
                LOCAL_PUSH_REGISTRY.tick()


_AUTH_ATTEMPTS: dict[str, list[float]] = {}
_AUTH_ATTEMPTS_LOCK = threading.Lock()
_AUTH_RATE_WINDOW = 60.0   # seconds
_AUTH_RATE_MAX = 15        # attempts per IP per window


def _check_auth_rate_limit(ip: str) -> bool:
    now = time.monotonic()
    cutoff = now - _AUTH_RATE_WINDOW
    with _AUTH_ATTEMPTS_LOCK:
        bucket = _AUTH_ATTEMPTS.setdefault(ip, [])
        bucket[:] = [t for t in bucket if t > cutoff]
        if len(bucket) >= _AUTH_RATE_MAX:
            return False
        bucket.append(now)
        return True

class AppHandler(SimpleHTTPRequestHandler):
    _PRIVATE_STATIC_DIRS = {
        ".git",
        ".pytest_cache",
        ".venv",
        "__pycache__",
        "data",
        "htmlcov",
        "playwright-report",
        "test-results",
        "tests",
        "venv",
    }
    _PRIVATE_STATIC_SUFFIXES = (
        ".db",
        ".key",
        ".log",
        ".pem",
        ".py",
        ".pyc",
        ".pyo",
        ".sqlite",
        ".sqlite3",
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self._pending_set_cookies: list[str] = []
        super().__init__(*args, **kwargs)

    def _is_private_static_path(self, path: str) -> bool:
        parsed_path = unquote(urlparse(path).path).replace("\\", "/")
        parts = [part for part in parsed_path.split("/") if part]
        if not parts:
            return False
        if any(part.startswith(".") and part != ".well-known" for part in parts):
            return True
        if parts[0] in self._PRIVATE_STATIC_DIRS:
            return True
        return parts[-1].lower().endswith(self._PRIVATE_STATIC_SUFFIXES)

    def send_head(self):  # type: ignore[override]
        if self._is_private_static_path(self.path):
            self.send_error(HTTPStatus.NOT_FOUND)
            return None
        return super().send_head()

    def end_headers(self) -> None:
        for cookie_value in self._pending_set_cookies:
            self.send_header("Set-Cookie", cookie_value)
        if self.path.endswith("sw.js"):
            self.send_header("Cache-Control", "no-cache")
        elif (
            self.path == "/"
            or self.path.endswith(".html")
            or self.path.endswith(".js")
            or self.path.endswith(".css")
        ):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        elif self.path.endswith(".png") or self.path.endswith(".ico"):
            self.send_header("Cache-Control", "no-cache")
        elif self.path.endswith(".webmanifest"):
            self.send_header("Cache-Control", "public, max-age=3600")
        elif self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")

        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header(
            "Content-Security-Policy",
            (
                "default-src 'self'; "
                "script-src 'self' 'wasm-unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob: https:; "
                "connect-src 'self' https://oauth2.googleapis.com https://gmail.googleapis.com https://www.googleapis.com https://login.microsoftonline.com https://graph.microsoft.com; "
                "font-src 'self' data:; "
                "worker-src 'self' blob:; "
                "frame-ancestors 'none'"
            ),
        )
        super().end_headers()

    def _request_scheme(self) -> str:
        if TRUST_PROXY:
            forwarded_proto = str(self.headers.get("X-Forwarded-Proto") or "").strip().lower()
            if forwarded_proto in {"http", "https"}:
                return forwarded_proto
        host = self._request_host()
        if (
            host.startswith("localhost")
            or host.startswith("127.0.0.1")
            or host.startswith("0.0.0.0")
            or host.startswith("[::]")
            or host.startswith("::")
        ):
            return "http"
        return "https"

    def _report_auth_exception(self, message: str, exc: Exception) -> None:
        print(message, file=sys.stderr, flush=True)
        traceback.print_exception(exc, file=sys.stderr)
        self._send_json({"error": message}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def _request_host(self) -> str:
        if TRUST_PROXY:
            forwarded_host = str(self.headers.get("X-Forwarded-Host") or "").strip()
            if forwarded_host:
                return forwarded_host
        host = str(self.headers.get("Host") or "").strip()
        return host or "localhost"

    @staticmethod
    def _split_host_port(host: str) -> tuple[str, str]:
        clean_host = str(host or "").strip()
        if not clean_host:
            return "localhost", ""
        if clean_host.startswith("[") and "]" in clean_host:
            host_name, _, remainder = clean_host[1:].partition("]")
            port = remainder.removeprefix(":")
            return host_name, port
        host_name, separator, port = clean_host.partition(":")
        if separator and port.isdigit():
            return host_name, port
        return clean_host, ""

    def _origin_hostname(self) -> str | None:
        origin = str(self.headers.get("Origin") or "").strip()
        if not origin:
            return None
        try:
            return str(urlparse(origin).hostname or "").strip() or None
        except ValueError:
            return None

    def _canonical_request_host(self) -> str:
        host_name, port = self._split_host_port(self._request_host())
        canonical_host = "localhost" if host_name in {"0.0.0.0", "::"} else host_name
        if not port:
            return canonical_host
        return f"[{canonical_host}]:{port}" if ":" in canonical_host else f"{canonical_host}:{port}"

    def _request_origin(self) -> str:
        origin = str(self.headers.get("Origin") or "").strip()
        if origin:
            return origin
        return f"{self._request_scheme()}://{self._canonical_request_host()}"

    def _redirect_to(self, url: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", url)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _redirect_bind_host_if_needed(self) -> bool:
        parsed = urlparse(self.path)
        host_name, port = self._split_host_port(self._request_host())
        if host_name not in {"0.0.0.0", "::"}:
            return False
        target_host = f"localhost:{port}" if port else "localhost"
        target_url = f"{self._request_scheme()}://{target_host}{parsed.path}"
        if parsed.query:
            target_url = f"{target_url}?{parsed.query}"
        self.send_response(HTTPStatus.PERMANENT_REDIRECT)
        self.send_header("Location", target_url)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        return True

    def _session_cookie_value(self) -> str | None:
        cookie_header = self.headers.get("Cookie")
        if not cookie_header:
            return None
        jar = SimpleCookie()
        jar.load(cookie_header)
        morsel = jar.get(SESSION_COOKIE_NAME)
        if morsel is None:
            return None
        return str(morsel.value or "").strip() or None

    def _set_session_cookie(self, session_id: str) -> None:
        parts = [
            f"{SESSION_COOKIE_NAME}={session_id}",
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            f"Max-Age={SESSION_TTL_SECONDS}",
        ]
        if self._request_scheme() == "https":
            parts.append("Secure")
        self._pending_set_cookies.append("; ".join(parts))

    def _clear_session_cookie(self) -> None:
        parts = [
            f"{SESSION_COOKIE_NAME}=",
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            "Max-Age=0",
        ]
        if self._request_scheme() == "https":
            parts.append("Secure")
        self._pending_set_cookies.append("; ".join(parts))

    def _send_local_pwa_api_disabled(self) -> None:
        self._send_json(
            {
                "error": (
                    "Cordyceps is running in local PWA mode. "
                    "Server-side personal storage APIs are disabled."
                )
            },
            status=HTTPStatus.GONE,
        )

    def _send_helper_disabled(self, helper_name: str, env_var_name: str) -> None:
        self._send_json(
            {
                "error": (
                    f"{helper_name} is disabled on this Cordyceps server. "
                    f"Set {env_var_name}=1 to enable it."
                )
            },
            status=HTTPStatus.NOT_FOUND,
        )

    def _local_push_store(self) -> LocalPushStore:
        if LOCAL_PUSH_REGISTRY is None:
            raise RuntimeError("Local push state is not available outside local_pwa mode.")
        return LOCAL_PUSH_REGISTRY.get_store(self._request_origin())

    def _local_banking_store(self) -> LocalBankingStore:
        if LOCAL_BANKING_REGISTRY is None:
            raise RuntimeError("Local banking state is not available outside local_pwa mode.")
        return LOCAL_BANKING_REGISTRY.get_store(self._request_origin())

    def _handle_local_pwa_truelayer_callback(self, parsed) -> None:
        query = parse_qs(parsed.query)
        error = str((query.get("error") or [""])[0] or "").strip()
        params: dict[str, str] = {"page": "settings"}
        if error:
            params["banking_error"] = error
        else:
            code = str((query.get("code") or [""])[0] or "").strip()
            state = str((query.get("state") or [""])[0] or "").strip()
            if code and state:
                params.update({
                    "banking": "truelayer_authorized",
                    "banking_code": code,
                    "banking_state": state,
                })
            else:
                params["banking_error"] = "missing_code"
        self._redirect_to(f"/?{urlencode(params)}")

    def _handle_local_pwa_enable_banking_callback(self, parsed) -> None:
        query = parse_qs(parsed.query)
        error = str((query.get("error") or [""])[0] or "").strip()
        error_description = str((query.get("error_description") or [""])[0] or "").strip()
        params: dict[str, str] = {"page": "monzo"}
        if error:
            params["banking_error"] = error_description or error
        else:
            code = str((query.get("code") or [""])[0] or "").strip()
            state = str((query.get("state") or [""])[0] or "").strip()
            try:
                self._complete_stateless_enable_banking_connection(code, state)
                params["banking"] = "enable_banking_connected"
            except EnableBankingApiError as exc:
                params["banking_error"] = str(exc)
        self._redirect_to(f"/?{urlencode(params)}")

    def _truelayer_redirect_uri_allowed(self, redirect_uri: str) -> bool:
        try:
            parsed_redirect = urlparse(redirect_uri)
            parsed_origin = urlparse(self._request_origin())
        except Exception:
            return False
        same_origin = (
            parsed_redirect.scheme == parsed_origin.scheme
            and parsed_redirect.netloc == parsed_origin.netloc
            and parsed_redirect.path == "/api/banking/truelayer/callback"
        )
        configured_uri = bool(TRUELAYER_REDIRECT_URI and redirect_uri == TRUELAYER_REDIRECT_URI)
        return parsed_redirect.scheme in {"http", "https"} and (same_origin or configured_uri)

    def _enable_banking_redirect_uri(self, state: str = "") -> str:
        base = ENABLE_BANKING_REDIRECT_URI or f"{self._request_origin().rstrip('/')}/api/banking/enable/callback"
        if state:
            return f"{base}?{urlencode({'state': state})}"
        return base

    def _local_banking_response(self, bank_store: LocalBankingStore | None = None) -> dict[str, Any]:
        state = (bank_store or self._local_banking_store()).snapshot()
        provider = str(state.get("provider") or state.get("connectionProvider") or "").strip()
        account_ids = state.get("accountIds") if isinstance(state.get("accountIds"), list) else []
        configured = bool(
            (provider == "enable-banking" and state.get("sessionId") and account_ids)
            or (provider == "csv" and (state.get("lastSyncAt") or state.get("lastSyncResult")))
        )
        return {
            "provider": provider,
            "connectionProvider": provider,
            "connectionStatus": state.get("connectionStatus") or "",
            "configured": configured,
            "institutionId": state.get("institutionId") or "",
            "institutionName": state.get("institutionName") or "",
            "requisitionId": state.get("requisitionId") or "",
            "sessionId": state.get("sessionId") or "",
            "aspspName": state.get("aspspName") or state.get("institutionName") or "",
            "aspspCountry": state.get("aspspCountry") or "",
            "accountId": state.get("accountId") or (account_ids[0] if account_ids else ""),
            "accountIds": list(account_ids),
            "accountDescription": state.get("accountDescription") or state.get("institutionName") or "",
            "providerId": state.get("providerId") or state.get("institutionId") or "",
            "consentExpiresAt": state.get("consentExpiresAt"),
            "scopes": list(state.get("scopes") or []),
            "balanceAmountMinor": state.get("balanceAmountMinor"),
            "balanceCurrency": state.get("balanceCurrency") or "",
            "lastSyncAt": state.get("lastSyncAt"),
            "lastSyncResult": state.get("lastSyncResult"),
        }

    @staticmethod
    def _coerce_number(value: Any) -> float | None:
        if value is None:
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if number != number:
            return None
        return number

    @staticmethod
    def _amount_to_minor(value: float | None) -> int | None:
        if value is None:
            return None
        return int(round(value * 100))

    @staticmethod
    def _select_monzo_account(accounts: list[dict[str, Any]], account_id: str = "") -> dict[str, Any]:
        if not accounts:
            raise MonzoApiError("No Monzo current accounts were returned for this token.")
        clean_account_id = account_id.strip()
        if clean_account_id:
            selected = next(
                (account for account in accounts if str(account.get("id") or "").strip() == clean_account_id),
                None,
            )
            if selected is None:
                raise MonzoApiError("The provided Monzo account ID was not found for this token.")
            return selected
        return accounts[0]

    @staticmethod
    def _truelayer_provider_id(account: dict[str, Any]) -> str:
        provider = account.get("provider")
        if isinstance(provider, dict):
            provider_id = str(provider.get("provider_id") or "").strip()
            if provider_id:
                return provider_id
        return str(account.get("provider_id") or "").strip()

    def _select_truelayer_account(self, accounts: list[dict[str, Any]], account_id: str = "") -> dict[str, Any]:
        if not accounts:
            raise TrueLayerApiError("TrueLayer did not return any Monzo accounts.")
        clean_account_id = account_id.strip()
        if clean_account_id:
            selected = next(
                (account for account in accounts if str(account.get("account_id") or "").strip() == clean_account_id),
                None,
            )
            if selected is None:
                raise TrueLayerApiError("The provided TrueLayer account ID was not found for this token.")
            return selected

        def is_monzo_account(account: dict[str, Any]) -> bool:
            provider = account.get("provider")
            provider_id = self._truelayer_provider_id(account).lower()
            provider_name = ""
            if isinstance(provider, dict):
                provider_name = str(provider.get("display_name") or "").strip().lower()
            return "monzo" in provider_id or "monzo" in provider_name

        transaction_accounts = [
            account
            for account in accounts
            if str(account.get("account_type") or "").strip().upper() in {"TRANSACTION", "BUSINESS_TRANSACTION"}
        ]
        for account in transaction_accounts or accounts:
            if is_monzo_account(account):
                return account
        return (transaction_accounts or accounts)[0]

    def _truelayer_account_description(self, account: dict[str, Any]) -> str:
        display_name = str(account.get("display_name") or "").strip()
        account_type = str(account.get("account_type") or "").strip().replace("_", " ").title()
        currency = str(account.get("currency") or "").strip().upper()
        parts = [display_name or "Monzo account"]
        details = " ".join(part for part in (account_type, currency) if part)
        if details:
            parts.append(details)
        return " - ".join(parts)

    def _extract_truelayer_balance(self, balances: list[dict[str, Any]]) -> tuple[int | None, str]:
        if not balances:
            return None, ""
        balance = balances[0]
        amount = self._coerce_number(balance.get("available"))
        if amount is None:
            amount = self._coerce_number(balance.get("current"))
        currency = str(balance.get("currency") or "").strip().upper()
        return self._amount_to_minor(amount), currency

    def _normalize_truelayer_expense(self, transaction: dict[str, Any]) -> dict[str, Any] | None:
        amount = self._coerce_number(transaction.get("amount"))
        if amount is None or amount == 0:
            return None
        transaction_type = str(transaction.get("transaction_type") or "").strip().lower()
        if amount > 0 and transaction_type not in {"debit", "card_payment", "purchase"}:
            return None

        metadata = transaction.get("meta")
        if not isinstance(metadata, dict):
            metadata = {}
        description = str(
            transaction.get("description")
            or transaction.get("transaction_information")
            or metadata.get("transaction_information")
            or ""
        ).strip()
        merchant_name = str(transaction.get("merchant_name") or metadata.get("merchant_name") or "").strip()
        category = str(
            transaction.get("transaction_category")
            or transaction.get("category")
            or metadata.get("provider_transaction_category")
            or ""
        ).strip() or None
        created = str(
            transaction.get("timestamp")
            or transaction.get("booking_date_time")
            or transaction.get("booking_date")
            or transaction.get("value_date")
            or ""
        ).strip() or None
        settled = str(transaction.get("booking_date") or transaction.get("value_date") or created or "").strip() or None
        currency = str(transaction.get("currency") or "").strip().upper() or "GBP"

        return {
            "id": str(transaction.get("transaction_id") or transaction.get("id") or uuid.uuid4()),
            "description": description,
            "merchantName": merchant_name,
            "amountMinor": abs(self._amount_to_minor(amount) or 0),
            "currency": currency,
            "created": created,
            "settled": settled,
            "category": category,
        }

    @staticmethod
    def _normalize_monzo_expense(transaction: dict[str, Any]) -> dict[str, Any] | None:
        amount = int(transaction.get("amount") or 0)
        if amount >= 0 or transaction.get("is_load") is True or transaction.get("decline_reason"):
            return None
        merchant = transaction.get("merchant")
        merchant_name = ""
        if isinstance(merchant, dict):
            merchant_name = str(merchant.get("name") or "").strip()
        return {
            "id": str(transaction.get("id") or uuid.uuid4()),
            "description": str(transaction.get("description") or "").strip(),
            "merchantName": merchant_name,
            "amountMinor": abs(amount),
            "currency": str(transaction.get("currency") or "GBP").strip() or "GBP",
            "created": str(transaction.get("created") or "").strip() or None,
            "settled": str(transaction.get("settled") or "").strip() or None,
            "category": str(transaction.get("category") or "").strip() or None,
        }

    def _send_stateless_monzo_settings(self, body: dict[str, Any]) -> None:
        access_token = str(body.get("accessToken") or "").strip()
        account_id = str(body.get("accountId") or "").strip()
        if not access_token:
            self._send_json({"error": "accessToken is required."}, status=HTTPStatus.BAD_REQUEST)
            return
        try:
            accounts = MonzoClient(access_token).list_accounts()
            selected = self._select_monzo_account(accounts, account_id)
            self._send_json({
                "monzo": {
                    "accountId": str(selected.get("id") or "").strip(),
                    "accountDescription": str(selected.get("description") or "").strip(),
                    "configured": True,
                    "connectionProvider": "monzo-developer",
                    "connectionStatus": "connected",
                    "lastSyncResult": "Connected. Recent expenses are ready to load.",
                }
            })
        except MonzoApiError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)

    def _send_stateless_truelayer_token(self, body: dict[str, Any]) -> None:
        grant_type = str(body.get("grantType") or "authorization_code").strip()
        try:
            if grant_type == "authorization_code":
                code = str(body.get("code") or "").strip()
                redirect_uri = str(body.get("redirectUri") or "").strip()
                if not code or not redirect_uri:
                    self._send_json({"error": "code and redirectUri are required."}, status=HTTPStatus.BAD_REQUEST)
                    return
                if not self._truelayer_redirect_uri_allowed(redirect_uri):
                    self._send_json({"error": "redirectUri is not allowed."}, status=HTTPStatus.BAD_REQUEST)
                    return
                payload = TrueLayerClient().exchange_code(code=code, redirect_uri=redirect_uri)
            elif grant_type == "refresh_token":
                refresh_token = str(body.get("refreshToken") or "").strip()
                if not refresh_token:
                    self._send_json({"error": "refreshToken is required."}, status=HTTPStatus.BAD_REQUEST)
                    return
                payload = TrueLayerClient().refresh_access_token(refresh_token)
            else:
                self._send_json({"error": "Unsupported grant type."}, status=HTTPStatus.BAD_REQUEST)
                return
            self._send_json(payload)
        except TrueLayerApiError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)

    def _send_stateless_truelayer_account(self, body: dict[str, Any]) -> None:
        access_token = str(body.get("accessToken") or "").strip()
        account_id = str(body.get("accountId") or "").strip()
        if not access_token:
            self._send_json({"error": "accessToken is required."}, status=HTTPStatus.BAD_REQUEST)
            return
        try:
            client = TrueLayerClient()
            accounts = client.list_accounts(access_token)
            selected = self._select_truelayer_account(accounts, account_id)
            selected_account_id = str(selected.get("account_id") or "").strip()
            balance_amount_minor: int | None = None
            balance_currency = str(selected.get("currency") or "").strip().upper()
            if selected_account_id:
                try:
                    balance_amount_minor, balance_currency = self._extract_truelayer_balance(
                        client.get_account_balance(access_token, selected_account_id)
                    )
                except TrueLayerApiError:
                    pass
            self._send_json({
                "monzo": {
                    "accountId": selected_account_id,
                    "accountDescription": self._truelayer_account_description(selected),
                    "configured": bool(selected_account_id),
                    "connectionProvider": "truelayer",
                    "connectionStatus": "connected",
                    "providerId": self._truelayer_provider_id(selected) or TRUELAYER_MONZO_PROVIDER_ID,
                    "balanceAmountMinor": balance_amount_minor,
                    "balanceCurrency": balance_currency,
                    "lastSyncResult": "Connected via TrueLayer. Refresh recent spending to load transactions.",
                }
            })
        except TrueLayerApiError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)

    def _send_stateless_enable_banking_institutions(self, body: dict[str, Any]) -> None:
        country = str(body.get("country") or "gb").strip().upper()[:2] or "GB"
        try:
            institutions = EnableBankingClient().list_aspsps(country)
            self._send_json({
                "provider": "enable-banking",
                "environment": ENABLE_BANKING_ENV,
                "institutions": [
                    {
                        "id": str(item.get("name") or item.get("id") or "").strip(),
                        "name": str(item.get("name") or "").strip(),
                        "bic": str(item.get("bic") or item.get("bic_fi") or "").strip(),
                        "logo": str(item.get("logo") or item.get("logo_url") or "").strip(),
                        "countries": item.get("countries") if isinstance(item.get("countries"), list) else [country],
                        "maximumConsentValidity": str(item.get("maximum_consent_validity") or "").strip(),
                    }
                    for item in institutions
                    if str(item.get("name") or item.get("id") or "").strip()
                ],
            })
        except EnableBankingApiError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _send_stateless_enable_banking_start(self, body: dict[str, Any]) -> None:
        aspsp_name = str(body.get("aspspName") or body.get("institutionName") or body.get("institutionId") or "").strip()
        aspsp_country = str(body.get("aspspCountry") or body.get("country") or "GB").strip().upper()[:2] or "GB"
        if not aspsp_name:
            self._send_json({"error": "aspspName is required."}, status=HTTPStatus.BAD_REQUEST)
            return
        state = secrets.token_urlsafe(24)
        redirect_uri = self._enable_banking_redirect_uri(state)
        try:
            auth = EnableBankingClient().start_auth(
                aspsp_name=aspsp_name,
                aspsp_country=aspsp_country,
                redirect_uri=redirect_uri,
                state=state,
            )
            auth_url = str(auth.get("url") or auth.get("redirect_url") or "").strip()
            if not auth_url:
                raise EnableBankingApiError("Enable Banking did not return a bank authentication link.")
            bank_store = self._local_banking_store()
            bank_store.update({
                "provider": "enable-banking",
                "connectionProvider": "enable-banking",
                "connectionStatus": "pending",
                "institutionId": aspsp_name,
                "institutionName": aspsp_name,
                "requisitionId": "",
                "sessionId": "",
                "aspspName": aspsp_name,
                "aspspCountry": aspsp_country,
                "accountId": "",
                "accountIds": [],
                "accountDescription": aspsp_name or "Bank account",
                "providerId": aspsp_name,
                "accessTokenEnc": "",
                "refreshTokenEnc": "",
                "tokenExpiresAt": 0.0,
                "refreshTokenExpiresAt": 0.0,
                "consentExpiresAt": isoformat(utc_now() + max(1, ENABLE_BANKING_ACCESS_DAYS) * 24 * 60 * 60),
                "scopes": ["balances", "details", "transactions"],
                "lastSyncAt": None,
                "lastSyncResult": "Bank authentication is pending.",
                "pendingState": state,
            })
            self._send_json({
                "authUrl": auth_url,
                "provider": "enable-banking",
                "environment": ENABLE_BANKING_ENV,
                "institutionId": aspsp_name,
                "institutionName": aspsp_name,
                "aspspName": aspsp_name,
                "aspspCountry": aspsp_country,
                "redirectUri": redirect_uri,
                "state": state,
            })
        except EnableBankingApiError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _complete_stateless_enable_banking_connection(self, code: str, state: str = "") -> None:
        bank_store = self._local_banking_store()
        banking_state = bank_store.snapshot()
        pending_state = str(banking_state.get("pendingState") or "")
        aspsp_name = str(banking_state.get("aspspName") or banking_state.get("institutionName") or "")
        if pending_state and state and pending_state != state:
            raise EnableBankingApiError("Enable Banking callback state did not match this session.")
        client = EnableBankingClient()
        session = client.create_session(code)
        session_id = str(session.get("session_id") or session.get("id") or "").strip()
        account_ids = _enable_banking_account_ids(session)
        if not session_id:
            raise EnableBankingApiError("Enable Banking returned no usable session ID.")
        if not account_ids:
            raise EnableBankingApiError("No bank accounts have been linked yet.")
        account_description = aspsp_name or "Bank account"
        balance_amount_minor: int | None = None
        balance_currency = ""
        try:
            balance_amount_minor, balance_currency = _extract_enable_banking_balance(
                client.get_account_balances(account_ids[0])
            )
        except EnableBankingApiError:
            pass
        bank_store.update({
            "connectionStatus": "connected",
            "sessionId": session_id,
            "accountIds": account_ids,
            "accountId": account_ids[0],
            "accountDescription": account_description,
            "balanceAmountMinor": balance_amount_minor,
            "balanceCurrency": balance_currency,
            "lastSyncAt": None,
            "lastSyncResult": "Connected via Enable Banking. Sync recent spending when ready.",
            "pendingState": "",
        })

    def _send_stateless_banking_sync(self) -> None:
        bank_store = self._local_banking_store()
        banking = self._local_banking_response(bank_store)
        if banking.get("provider") != "enable-banking" or not banking.get("configured"):
            self._send_json({"error": "Banking is not connected through Enable Banking yet."}, status=HTTPStatus.BAD_REQUEST)
            return
        try:
            client = EnableBankingClient()
            expenses: list[dict[str, Any]] = []
            balance_amount_minor: int | None = None
            balance_currency = ""
            for account_id in banking.get("accountIds") or []:
                continuation_key = ""
                for _ in range(10):
                    transaction_payload = client.get_account_transactions(str(account_id), continuation_key=continuation_key)
                    transactions = transaction_payload.get("transactions") if isinstance(transaction_payload, dict) else []
                    if isinstance(transactions, list):
                        for transaction in transactions:
                            if isinstance(transaction, dict):
                                expense = _normalize_enable_banking_expense(transaction, str(account_id))
                                if expense is not None:
                                    expenses.append(expense)
                    continuation_key = str(transaction_payload.get("continuation_key") or "").strip()
                    if not continuation_key:
                        break
                if balance_amount_minor is None:
                    try:
                        balance_amount_minor, balance_currency = _extract_enable_banking_balance(
                            client.get_account_balances(str(account_id))
                        )
                    except EnableBankingApiError:
                        pass
            expenses.sort(key=lambda item: item.get("settled") or item.get("created") or "", reverse=True)
            expenses = expenses[:25]
            updates: dict[str, Any] = {
                "connectionStatus": "connected",
                "lastSyncAt": isoformat(),
                "lastSyncResult": f"Loaded {len(expenses)} recent transactions from Enable Banking.",
            }
            if balance_amount_minor is not None:
                updates["balanceAmountMinor"] = balance_amount_minor
                updates["balanceCurrency"] = balance_currency or "GBP"
            bank_store.update(updates)
            next_banking = self._local_banking_response(bank_store)
            self._send_json({"expenses": expenses, "banking": next_banking, "monzo": next_banking})
        except EnableBankingApiError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)

    def _send_stateless_banking_csv_import(self, body: dict[str, Any]) -> None:
        try:
            expenses = _normalize_csv_expenses(str(body.get("csvText") or ""))[:200]
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return
        bank_store = self._local_banking_store()
        current_state = bank_store.snapshot()
        provider = str(current_state.get("provider") or "").strip() or "csv"
        connection_provider = str(current_state.get("connectionProvider") or "").strip() or provider
        bank_store.update({
            "provider": provider,
            "connectionProvider": connection_provider,
            "connectionStatus": "csv-imported",
            "lastSyncAt": isoformat(),
            "lastSyncResult": f"Imported {len(expenses)} transactions from CSV.",
        })
        banking = self._local_banking_response(bank_store)
        self._send_json({"expenses": expenses, "banking": banking, "monzo": banking})

    def _send_stateless_banking_disconnect(self) -> None:
        bank_store = self._local_banking_store()
        session_id = str(bank_store.snapshot().get("sessionId") or "")
        if session_id:
            try:
                EnableBankingClient().delete_session(session_id)
            except EnableBankingApiError:
                pass
        bank_store.reset()
        banking = self._local_banking_response(bank_store)
        self._send_json({"banking": banking, "monzo": banking, "expenses": []})

    def _send_stateless_monzo_expenses(self, body: dict[str, Any]) -> None:
        access_token = str(body.get("accessToken") or "").strip()
        account_id = str(body.get("accountId") or "").strip()
        provider = str(body.get("connectionProvider") or "").strip().lower()
        if not access_token or not account_id:
            self._send_json({"error": "accessToken and accountId are required."}, status=HTTPStatus.BAD_REQUEST)
            return

        try:
            if provider == "truelayer":
                now = datetime.now(timezone.utc)
                start = now - timedelta(days=max(1, TRUELAYER_TRANSACTION_SYNC_DAYS))
                transactions = TrueLayerClient().list_account_transactions(
                    access_token,
                    account_id,
                    from_date=start.date().isoformat(),
                    to_date=now.date().isoformat(),
                )
                expenses = [
                    expense
                    for transaction in transactions
                    if (expense := self._normalize_truelayer_expense(transaction)) is not None
                ]
                last_sync_result = f"Loaded {len(expenses[:25])} recent expenses from TrueLayer."
            else:
                since = isoformat(utc_now() - (30 * 24 * 60 * 60))
                transactions = MonzoClient(access_token).list_transactions(account_id, since=since, limit=75)
                expenses = [
                    expense
                    for transaction in transactions
                    if (expense := self._normalize_monzo_expense(transaction)) is not None
                ]
                last_sync_result = f"Loaded {len(expenses[:25])} recent expenses."
            expenses.sort(key=lambda item: item.get("settled") or item.get("created") or "", reverse=True)
            self._send_json({
                "expenses": expenses[:25],
                "monzo": {
                    "accountId": account_id,
                    "configured": True,
                    "connectionProvider": provider or "monzo-developer",
                    "connectionStatus": "connected",
                    "lastSyncAt": isoformat(),
                    "lastSyncResult": last_sync_result,
                },
            })
        except (MonzoApiError, TrueLayerApiError) as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)

    def _require_authenticated_user(self) -> dict[str, Any] | None:
        if LOCAL_PWA_MODE:
            self._send_local_pwa_api_disabled()
            return None
        if STORE is None:
            self._send_json({"error": "Server datastore is unavailable."}, status=HTTPStatus.SERVICE_UNAVAILABLE)
            return None
        return STORE.ensure_local_account()

    def _handle_sse(self, user_id: str) -> None:
        """Stream Server-Sent Events for user_id. Blocks until client disconnects."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        q = _sse_register(user_id)
        try:
            # Initial handshake
            self.wfile.write(b"event: connected\ndata: {}\n\n")
            self.wfile.flush()
            while True:
                try:
                    event_type = q.get(timeout=20)
                    self.wfile.write(f"event: {event_type}\ndata: {{}}\n\n".encode())
                    self.wfile.flush()
                except queue.Empty:
                    # Heartbeat comment to keep proxies/iOS from closing the connection
                    self.wfile.write(b": keepalive\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            _sse_unregister(user_id, q)

    def do_GET(self) -> None:
        if self._redirect_bind_host_if_needed():
            return
        parsed = urlparse(self.path)
        if parsed.path == "/api/dev/version":
            self._send_json({"version": SERVER_VERSION})
            return

        if parsed.path == "/api/dev/demo-check":
            if LOCAL_PWA_MODE or STORE is None:
                self._send_local_pwa_api_disabled()
                return
            demo_store = STORE.find_user_store_by_username("demo")
            usernames = [str(u.get("username") or "") for u in STORE._users_payload.get("users", [])]
            if demo_store is not None:
                with demo_store._lock:
                    task_count = len(demo_store._state.get("tasks", []))
                self._send_json({"found": True, "taskCount": task_count, "allUsernames": usernames})
            else:
                self._send_json({"found": False, "allUsernames": usernames})
            return

        if parsed.path in OUTLOOK_HELPER_ROUTE_PATHS and not ENABLE_OUTLOOK_HELPER:
            self._send_helper_disabled("The Outlook helper", "CORDYCEPS_ENABLE_OUTLOOK_HELPER")
            return

        if parsed.path in BANKING_HELPER_ROUTE_PATHS and not ENABLE_BANKING_HELPER:
            self._send_helper_disabled("The banking helper", "CORDYCEPS_ENABLE_BANKING_HELPER")
            return

        if parsed.path == "/api/rss/feed":
            feed_url = parse_qs(parsed.query).get("url", [""])[0]
            try:
                self._send_json(fetch_rss_feed(feed_url))
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            except RuntimeError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/rss/article":
            article_url = parse_qs(parsed.query).get("url", [""])[0]
            article_mode = parse_qs(parsed.query).get("mode", ["reader"])[0]
            try:
                self._send_json(fetch_rss_article(article_url, mode=article_mode))
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            except RuntimeError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/current-affairs/sources":
            self._send_json(list_current_affairs_sources())
            return

        if parsed.path == "/api/current-affairs/graph":
            enabled_source_ids = [
                item.strip()
                for item in parse_qs(parsed.query).get("enabled", [""])[0].split(",")
                if item.strip()
            ]
            try:
                self._send_json(fetch_current_affairs_graph(enabled_source_ids or None))
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            except RuntimeError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/zenquotes/today":
            try:
                response = requests.get(
                    ZEN_QUOTES_TODAY_URL,
                    headers={"Accept": "application/json", "User-Agent": APP_NAME},
                    timeout=5,
                )
                response.raise_for_status()
                if len(response.content or b"") > ZEN_QUOTES_MAX_BYTES:
                    raise ValueError("ZenQuotes returned an oversized payload.")
                payload = response.json()
                item = payload[0] if isinstance(payload, list) and payload else payload
                if not isinstance(item, dict):
                    raise ValueError("ZenQuotes returned an invalid payload.")
                quote = re.sub(r"\s+", " ", str(item.get("q") or "")).strip()[:280]
                author = re.sub(r"\s+", " ", str(item.get("a") or "")).strip()[:120]
                if not quote:
                    raise ValueError("ZenQuotes returned an empty quote.")
                self._send_json({"q": quote, "a": author})
            except (requests.RequestException, ValueError, json.JSONDecodeError) as exc:
                self._send_json({**ZEN_QUOTES_FALLBACK, "fallback": True, "reason": str(exc)})
            return

        if parsed.path == "/api/learning/word/today":
            try:
                response = requests.get(
                    WORD_OF_THE_DAY_URL,
                    headers={"Accept": "application/json", "User-Agent": APP_NAME},
                    timeout=5,
                )
                response.raise_for_status()
                if len(response.content or b"") > LEARNING_API_MAX_BYTES:
                    raise ValueError("Word of the Day returned an oversized payload.")
                self._send_json(normalize_word_of_the_day_payload(response.json()))
            except (requests.RequestException, ValueError, json.JSONDecodeError) as exc:
                self._send_json(_learning_fallback(DAILY_WORD_FALLBACK, exc))
            return

        if parsed.path == "/api/learning/concept/today":
            concept = _daily_learning_pick_concept()
            try:
                extract = fetch_wikipedia_concept_extract(concept)
                self._send_json({
                    "kind": "concept",
                    "id": f"concept-{_daily_learning_date_key()}",
                    "label": "Concept of the day",
                    "title": concept["title"],
                    "body": extract[:220],
                    "source": f"Wikipedia - {concept['category']}",
                    "url": f"https://en.wikipedia.org/wiki/{quote(concept['title'].replace(' ', '_'))}",
                    "createdAt": _daily_learning_created_at(),
                })
            except (requests.RequestException, ValueError, json.JSONDecodeError) as exc:
                self._send_json(_learning_fallback({
                    "kind": "concept",
                    "label": "Concept of the day",
                    "title": concept["title"],
                    "body": concept["fallback"],
                    "source": f"Cordyceps fallback - {concept['category']}",
                    "url": f"https://en.wikipedia.org/wiki/{quote(concept['title'].replace(' ', '_'))}",
                }, exc))
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/banking/truelayer/callback":
            self._handle_local_pwa_truelayer_callback(parsed)
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/banking/enable/callback":
            self._handle_local_pwa_enable_banking_callback(parsed)
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/push/config" and LOCAL_PUSH_REGISTRY is not None:
            self._send_json(self._local_push_store().get_push_config())
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/alerts/claim" and LOCAL_PUSH_REGISTRY is not None:
            self._send_json(self._local_push_store().claim_alerts())
            return

        if LOCAL_PWA_MODE and parsed.path.startswith("/api/"):
            self._send_local_pwa_api_disabled()
            return

        # VAPID public key is not sensitive — no auth required.
        if parsed.path == "/api/push/config":
            self._send_json(STORE.get_push_config())
            return

        user = self._require_authenticated_user() if parsed.path.startswith("/api/") else None
        if parsed.path.startswith("/api/") and user is None:
            return
        user_store = STORE.get_user_store(str(user["id"])) if user else None

        if parsed.path == "/api/banking/truelayer/callback" and user_store is not None:
            query = parse_qs(parsed.query)
            error = str((query.get("error") or [""])[0] or "").strip()
            if error:
                self._redirect_to(f"/?{urlencode({'banking_error': error})}")
                return
            code = str((query.get("code") or [""])[0] or "").strip()
            state = str((query.get("state") or [""])[0] or "").strip()
            if not code or not state:
                self._redirect_to("/?banking_error=missing_code")
                return
            provider = STORE.verify_oauth_state(state) if STORE is not None else None
            if provider != "truelayer-data":
                self._redirect_to("/?banking_error=invalid_state")
                return
            redirect_uri = TRUELAYER_REDIRECT_URI or f"{self._request_origin().rstrip('/')}/api/banking/truelayer/callback"
            try:
                user_store.connect_truelayer_monzo(code=code, redirect_uri=redirect_uri)
            except TrueLayerApiError as exc:
                self._redirect_to(f"/?{urlencode({'banking_error': str(exc)})}")
                return
            self._redirect_to("/?banking=truelayer_connected")
            return

        if parsed.path == "/api/banking/enable/callback" and user_store is not None:
            query = parse_qs(parsed.query)
            error = str((query.get("error") or [""])[0] or "").strip()
            error_description = str((query.get("error_description") or [""])[0] or "").strip()
            if error:
                self._redirect_to(f"/?{urlencode({'banking_error': error_description or error})}")
                return
            code = str((query.get("code") or [""])[0] or "").strip()
            state = str((query.get("state") or query.get("ref") or [""])[0] or "").strip()
            if not code or not state:
                self._redirect_to("/?banking_error=missing_code")
                return
            provider = STORE.verify_oauth_state(state) if STORE is not None else None
            if provider != "enable-banking-accounts":
                self._redirect_to("/?banking_error=invalid_state")
                return
            try:
                user_store.complete_enable_banking_connection(code)
            except EnableBankingApiError as exc:
                self._redirect_to(f"/?{urlencode({'banking_error': str(exc)})}")
                return
            self._redirect_to("/?banking=enable_banking_connected")
            return

        if parsed.path == "/api/events" and user is not None:
            self._handle_sse(str(user["id"]))
            return

        if parsed.path == "/api/state" and user_store is not None:
            self._send_json(user_store.get_state())
            return

        if parsed.path == "/api/alerts/claim" and user_store is not None:
            self._send_json(user_store.claim_alerts())
            return

        if parsed.path == "/api/client-state" and user_store is not None:
            self._send_json(user_store.get_client_state())
            return

        if parsed.path == "/api/notes" and user is not None:
            self._send_json({"notes": STORE.get_notes(str(user["id"]))})
            return

        if parsed.path == "/api/outlook/calendar" and user_store is not None:
            force = parse_qs(parsed.query).get("force", ["0"])[0] in {"1", "true", "yes"}
            try:
                self._send_json(user_store.get_outlook_calendar_events(force=force))
            except RuntimeError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            except Exception as exc:
                print("Outlook calendar request failed unexpectedly.", file=sys.stderr, flush=True)
                traceback.print_exception(exc, file=sys.stderr)
                self._send_json(
                    {"error": "The Outlook calendar request failed unexpectedly."},
                    status=HTTPStatus.INTERNAL_SERVER_ERROR,
                )
            return

        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        body = self._read_json_body()
        if body is None:
            return

        if parsed.path in OUTLOOK_HELPER_ROUTE_PATHS and not ENABLE_OUTLOOK_HELPER:
            self._send_helper_disabled("The Outlook helper", "CORDYCEPS_ENABLE_OUTLOOK_HELPER")
            return

        if parsed.path in BANKING_HELPER_ROUTE_PATHS and not ENABLE_BANKING_HELPER:
            self._send_helper_disabled("The banking helper", "CORDYCEPS_ENABLE_BANKING_HELPER")
            return

        if parsed.path == "/api/current-affairs/refresh":
            request_body = body if isinstance(body, dict) else {}
            raw_ids = request_body.get("enabledSourceIds")
            enabled_source_ids = [
                str(item).strip()
                for item in raw_ids
                if str(item).strip()
            ] if isinstance(raw_ids, list) else None
            try:
                self._send_json(fetch_current_affairs_graph(enabled_source_ids))
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            except RuntimeError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path.startswith("/api/integrations/oauth/token/"):
            self._send_json(
                {
                    "error": (
                        "The public OAuth token exchange helper has been removed. "
                        "Cordyceps no longer exposes a generic anonymous token broker."
                    )
                },
                status=HTTPStatus.GONE,
            )
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/banking/truelayer/start":
            if not TRUELAYER_CLIENT_ID:
                self._send_json(
                    {"error": "TrueLayer is missing TRUELAYER_CLIENT_ID on this server."},
                    status=HTTPStatus.BAD_REQUEST,
                )
                return
            if not TRUELAYER_CLIENT_SECRET:
                self._send_json(
                    {"error": "TrueLayer is missing TRUELAYER_CLIENT_SECRET on this server."},
                    status=HTTPStatus.BAD_REQUEST,
                )
                return

            request_body = body if isinstance(body, dict) else {}
            requested_provider = str(request_body.get("provider") or "monzo").strip().lower()
            if requested_provider != "monzo":
                self._send_json({"error": "Only Monzo is allowed in local PWA mode."}, status=HTTPStatus.BAD_REQUEST)
                return
            redirect_uri = TRUELAYER_REDIRECT_URI or f"{self._request_origin().rstrip('/')}/api/banking/truelayer/callback"
            state = secrets.token_urlsafe(32)
            auth_params = {
                "response_type": "code",
                "client_id": TRUELAYER_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "scope": TRUELAYER_DATA_SCOPES,
                "providers": "ob-monzo",
                "provider_id": TRUELAYER_MONZO_PROVIDER_ID,
                "state": state,
            }
            self._send_json({
                "authUrl": f"{TRUELAYER_AUTH_URL}?{urlencode(auth_params)}",
                "provider": requested_provider,
                "scopes": TRUELAYER_DATA_SCOPES.split(),
                "redirectUri": redirect_uri,
                "state": state,
            })
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/banking/enable/institutions":
            self._send_stateless_enable_banking_institutions(body if isinstance(body, dict) else {})
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/banking/enable/start":
            self._send_stateless_enable_banking_start(body if isinstance(body, dict) else {})
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/banking/sync":
            self._send_stateless_banking_sync()
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/banking/import/csv":
            self._send_stateless_banking_csv_import(body if isinstance(body, dict) else {})
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/banking/disconnect":
            self._send_stateless_banking_disconnect()
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/monzo/settings":
            self._send_stateless_monzo_settings(body if isinstance(body, dict) else {})
            return

        if LOCAL_PWA_MODE and parsed.path in {
            "/api/monzo/expenses",
            "/api/integrations/monzo/expenses",
            "/api/integrations/monzo/truelayer/expenses",
        }:
            self._send_stateless_monzo_expenses(body if isinstance(body, dict) else {})
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/integrations/monzo/truelayer/token":
            self._send_stateless_truelayer_token(body if isinstance(body, dict) else {})
            return

        if LOCAL_PWA_MODE and parsed.path == "/api/integrations/monzo/truelayer/account":
            self._send_stateless_truelayer_account(body if isinstance(body, dict) else {})
            return

        local_push_body = body if isinstance(body, dict) else {}
        if LOCAL_PWA_MODE and LOCAL_PUSH_REGISTRY is not None and parsed.path == "/api/alerts/toggle":
            enabled = local_push_body.get("enabled")
            if not isinstance(enabled, bool):
                self._send_json({"error": "enabled must be a boolean"}, status=HTTPStatus.BAD_REQUEST)
                return
            self._send_json(self._local_push_store().set_alerts_enabled(enabled))
            return

        if LOCAL_PWA_MODE and LOCAL_PUSH_REGISTRY is not None and parsed.path == "/api/alerts/test-push-toggle":
            enabled = local_push_body.get("enabled")
            if not isinstance(enabled, bool):
                self._send_json({"error": "enabled must be a boolean"}, status=HTTPStatus.BAD_REQUEST)
                return
            self._send_json(self._local_push_store().set_test_push_enabled(enabled))
            return

        if LOCAL_PWA_MODE and LOCAL_PUSH_REGISTRY is not None and parsed.path == "/api/plan-block-reminder":
            self._send_json(self._local_push_store().set_plan_block_reminder(local_push_body.get("nextBlock")))
            return

        if LOCAL_PWA_MODE and LOCAL_PUSH_REGISTRY is not None and parsed.path == "/api/rss-news-notifications/settings":
            self._send_json(
                self._local_push_store().update_rss_news_notification_settings(
                    enabled=local_push_body.get("enabled"),
                    frequency=local_push_body.get("frequency"),
                    times=local_push_body.get("times"),
                    feed_urls=local_push_body.get("feedUrls"),
                )
            )
            return

        if LOCAL_PWA_MODE and LOCAL_PUSH_REGISTRY is not None and parsed.path == "/api/notification-scheduler":
            self._send_json(self._local_push_store().update_notification_reminders(local_push_body.get("reminders")))
            return

        if LOCAL_PWA_MODE and LOCAL_PUSH_REGISTRY is not None and parsed.path == "/api/push/subscribe":
            try:
                self._send_json(self._local_push_store().add_subscription(local_push_body.get("subscription")))
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        if LOCAL_PWA_MODE and LOCAL_PUSH_REGISTRY is not None and parsed.path == "/api/push/unsubscribe":
            endpoint = local_push_body.get("endpoint")
            if not isinstance(endpoint, str):
                self._send_json({"error": "Endpoint is required"}, status=HTTPStatus.BAD_REQUEST)
                return
            self._send_json(self._local_push_store().remove_subscription(endpoint))
            return

        if LOCAL_PWA_MODE and parsed.path.startswith("/api/"):
            self._send_local_pwa_api_disabled()
            return

        user = self._require_authenticated_user() if parsed.path.startswith("/api/") else None
        if parsed.path.startswith("/api/") and user is None:
            return
        user_store = STORE.get_user_store(str(user["id"])) if user else None

        if parsed.path == "/api/banking/truelayer/start" and user_store is not None:
            if not TRUELAYER_CLIENT_ID:
                self._send_json(
                    {"error": "TrueLayer is missing TRUELAYER_CLIENT_ID on this server."},
                    status=HTTPStatus.BAD_REQUEST,
                )
                return
            if not TRUELAYER_CLIENT_SECRET:
                self._send_json(
                    {"error": "TrueLayer is missing TRUELAYER_CLIENT_SECRET on this server."},
                    status=HTTPStatus.BAD_REQUEST,
                )
                return

            request_body = body if isinstance(body, dict) else {}
            requested_provider = str(request_body.get("provider") or "monzo").strip().lower()
            provider_id = TRUELAYER_MONZO_PROVIDER_ID if requested_provider == "monzo" else ""
            providers = "ob-monzo" if requested_provider == "monzo" else TRUELAYER_PROVIDERS
            redirect_uri = TRUELAYER_REDIRECT_URI or f"{self._request_origin().rstrip('/')}/api/banking/truelayer/callback"
            state = STORE.create_oauth_state("truelayer-data")
            auth_params = {
                "response_type": "code",
                "client_id": TRUELAYER_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "scope": TRUELAYER_DATA_SCOPES,
                "providers": providers,
                "state": state,
            }
            if provider_id:
                auth_params["provider_id"] = provider_id
            self._send_json({
                "authUrl": f"{TRUELAYER_AUTH_URL}?{urlencode(auth_params)}",
                "provider": requested_provider,
                "scopes": TRUELAYER_DATA_SCOPES.split(),
                "redirectUri": redirect_uri,
            })
            return

        if parsed.path == "/api/banking/enable/institutions" and user_store is not None:
            request_body = body if isinstance(body, dict) else {}
            try:
                self._send_json(user_store.list_enable_banking_institutions(str(request_body.get("country") or "gb")))
            except EnableBankingApiError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/banking/enable/start" and user_store is not None:
            request_body = body if isinstance(body, dict) else {}
            aspsp_name = str(request_body.get("aspspName") or request_body.get("institutionName") or request_body.get("institutionId") or "").strip()
            aspsp_country = str(request_body.get("aspspCountry") or request_body.get("country") or "GB").strip().upper()[:2] or "GB"
            if not aspsp_name:
                self._send_json({"error": "aspspName is required."}, status=HTTPStatus.BAD_REQUEST)
                return
            state = STORE.create_oauth_state("enable-banking-accounts")
            redirect_uri = self._enable_banking_redirect_uri(state)
            try:
                self._send_json(user_store.start_enable_banking_connection(
                    aspsp_name=aspsp_name,
                    aspsp_country=aspsp_country,
                    redirect_uri=redirect_uri,
                    reference=state,
                ))
            except EnableBankingApiError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/banking/sync" and user_store is not None:
            try:
                self._send_json(user_store.get_recent_banking_transactions())
            except (MonzoApiError, TrueLayerApiError, EnableBankingApiError) as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/banking/import/csv" and user_store is not None:
            try:
                self._send_json(user_store.import_banking_csv(str((body if isinstance(body, dict) else {}).get("csvText") or "")))
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/banking/disconnect" and user_store is not None:
            self._send_json(user_store.disconnect_banking())
            return

        if parsed.path == "/api/state/import" and user_store is not None:
            payload = body.get("state")
            if not isinstance(payload, dict):
                self._send_json({"error": "state must be an object"}, status=HTTPStatus.BAD_REQUEST)
                return

            self._send_json(user_store.import_backup_state(payload))
            return

        if parsed.path == "/api/client-state" and user_store is not None:
            payload = body.get("clientState")
            if not isinstance(payload, dict):
                self._send_json({"error": "clientState must be an object"}, status=HTTPStatus.BAD_REQUEST)
                return

            self._send_json(user_store.update_client_state(payload))
            return

        if parsed.path == "/api/notes" and user is not None:
            note_id = str(body.get("id") or "").strip()
            if not note_id:
                note_id = str(uuid.uuid4())
            title = str(body.get("title") or "").strip()
            note_body = str(body.get("body") or "")
            try:
                result = STORE.save_note(str(user["id"]), note_id, title, note_body)
                self._send_json(result, status=HTTPStatus.CREATED)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/tasks" and user_store is not None:
            try:
                task_id = body.get("id")
                if task_id is not None and not isinstance(task_id, str):
                    self._send_json({"error": "id must be a string"}, status=HTTPStatus.BAD_REQUEST)
                    return

                self._send_json(
                    user_store.add_task(str(body.get("text") or ""), task_id=task_id),
                    status=HTTPStatus.CREATED,
                )
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/tasks/import" and user_store is not None:
            try:
                self._send_json(
                    user_store.import_tasks(str(body.get("text") or "")),
                    status=HTTPStatus.CREATED,
                )
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/tasks/clear-completed" and user_store is not None:
            self._send_json(user_store.clear_completed())
            return

        if parsed.path == "/api/alerts/toggle" and user_store is not None:
            self._send_json(user_store.set_alerts_enabled(bool(body.get("enabled"))))
            return

        if parsed.path == "/api/alerts/test-push-toggle" and user_store is not None:
            self._send_json(user_store.set_test_push_enabled(bool(body.get("enabled"))))
            return

        if parsed.path == "/api/plan-block-reminder" and user_store is not None:
            self._send_json(user_store.set_plan_block_reminder(body.get("nextBlock")))
            return

        if parsed.path == "/api/rss-news-notifications/settings" and user_store is not None:
            self._send_json(
                user_store.update_rss_news_notification_settings(
                    enabled=body.get("enabled"),
                    frequency=body.get("frequency"),
                    times=body.get("times"),
                    feed_urls=body.get("feedUrls"),
                )
            )
            return

        if parsed.path == "/api/notification-scheduler" and user_store is not None:
            self._send_json(user_store.update_notification_reminders(body.get("reminders")))
            return

        if parsed.path == "/api/outlook/settings" and user_store is not None:
            email = body.get("email")
            ics_url = body.get("icsUrl")
            if ics_url is None:
                ics_url = body.get("calendarId")
            sync_mode = body.get("syncMode")
            auto_sync_enabled = body.get("autoSyncEnabled")

            if email is not None:
                if not isinstance(email, str) or not email.strip():
                    self._send_json({"error": "email must be a non-empty string"}, status=HTTPStatus.BAD_REQUEST)
                    return
                email = email.strip()

            if ics_url is not None:
                if not isinstance(ics_url, str) or not ics_url.strip():
                    self._send_json({"error": "icsUrl must be a non-empty string"}, status=HTTPStatus.BAD_REQUEST)
                    return
                ics_url = ics_url.strip()

            if sync_mode is not None:
                if not isinstance(sync_mode, str) or sync_mode.strip() not in {"two-way", "today-to-outlook", "outlook-to-today"}:
                    self._send_json({"error": "syncMode must be a valid sync direction"}, status=HTTPStatus.BAD_REQUEST)
                    return
                sync_mode = sync_mode.strip()

            if auto_sync_enabled is not None and not isinstance(auto_sync_enabled, bool):
                self._send_json({"error": "autoSyncEnabled must be a boolean"}, status=HTTPStatus.BAD_REQUEST)
                return

            if email is None and ics_url is None and sync_mode is None and auto_sync_enabled is None:
                self._send_json({"error": "email, icsUrl, syncMode, or autoSyncEnabled must be provided"}, status=HTTPStatus.BAD_REQUEST)
                return

            self._send_json(
                user_store.update_outlook_settings(
                    email=email,
                    ics_url=ics_url,
                    sync_mode=sync_mode,
                    auto_sync_enabled=auto_sync_enabled,
                )
            )
            return

        if parsed.path == "/api/monzo/settings" and user_store is not None:
            access_token = body.get("accessToken")
            account_id = body.get("accountId")

            if not isinstance(access_token, str) or not access_token.strip():
                self._send_json({"error": "accessToken must be a non-empty string"}, status=HTTPStatus.BAD_REQUEST)
                return

            if account_id is not None and not isinstance(account_id, str):
                self._send_json({"error": "accountId must be a string"}, status=HTTPStatus.BAD_REQUEST)
                return

            try:
                self._send_json(
                    user_store.update_monzo_settings(
                        access_token=access_token.strip(),
                        account_id=account_id,
                    )
                )
            except MonzoApiError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/monzo/expenses" and user_store is not None:
            try:
                self._send_json(user_store.get_recent_monzo_expenses())
            except (MonzoApiError, TrueLayerApiError) as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        if parsed.path == "/api/push/subscribe" and user_store is not None:
            try:
                self._send_json(user_store.add_subscription(body.get("subscription")))
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/push/unsubscribe" and user_store is not None:
            endpoint = body.get("endpoint")
            if not isinstance(endpoint, str):
                self._send_json({"error": "Endpoint is required"}, status=HTTPStatus.BAD_REQUEST)
                return

            self._send_json(user_store.remove_subscription(endpoint))
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/tasks/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        user = self._require_authenticated_user()
        if user is None:
            return
        user_store = STORE.get_user_store(str(user["id"]))

        task_id = parsed.path.removeprefix("/api/tasks/")
        body = self._read_json_body()
        if body is None:
            return
        completed = body.get("completed")
        pinned = body.get("pinned")
        priority = body.get("priority")
        text = body.get("text")
        if completed is not None and not isinstance(completed, bool):
            self._send_json({"error": "completed must be a boolean"}, status=HTTPStatus.BAD_REQUEST)
            return

        if pinned is not None and not isinstance(pinned, bool):
            self._send_json({"error": "pinned must be a boolean"}, status=HTTPStatus.BAD_REQUEST)
            return

        if priority is not None and priority not in {"none", "important", "urgent"}:
            self._send_json({"error": "priority must be one of none, important, or urgent"}, status=HTTPStatus.BAD_REQUEST)
            return

        if text is not None:
            text = str(text).strip()
            if not text:
                self._send_json({"error": "text is required"}, status=HTTPStatus.BAD_REQUEST)
                return

        if completed is None and pinned is None and priority is None and text is None:
            self._send_json(
                {"error": "completed, pinned, priority, or text must be provided"},
                status=HTTPStatus.BAD_REQUEST,
            )
            return

        state = user_store.update_task(task_id, completed=completed, pinned=pinned, priority=priority, text=text)
        if state is None:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        self._send_json(state)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/tasks/"):
            user = self._require_authenticated_user()
            if user is None:
                return
            user_store = STORE.get_user_store(str(user["id"]))
            task_id = parsed.path.removeprefix("/api/tasks/")
            self._send_json(user_store.delete_task(task_id))
            return

        if parsed.path.startswith("/api/notes/"):
            user = self._require_authenticated_user()
            if user is None:
                return
            note_id = parsed.path.removeprefix("/api/notes/").strip()
            if not note_id:
                self._send_json({"error": "note id is required"}, status=HTTPStatus.BAD_REQUEST)
                return
            STORE.delete_note(str(user["id"]), note_id)
            self._send_json({"ok": True})
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def _read_json_body(self) -> dict[str, Any] | None:
        length = int(self.headers.get("Content-Length") or 0)
        if length == 0:
            return {}
        if length > MAX_REQUEST_BODY_BYTES:
            self.send_error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            return None

        raw = self.rfile.read(length)
        try:
            decoded = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON body."}, status=HTTPStatus.BAD_REQUEST)
            return None

        return decoded if isinstance(decoded, dict) else {}

    def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the Todo web app.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4179)
    parser.add_argument(
        "--trust-proxy",
        action="store_true",
        default=False,
        help="Trust X-Forwarded-Proto and X-Forwarded-Host headers from a reverse proxy.",
    )
    parser.add_argument("--child", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--parent-pid", type=int, default=0, help=argparse.SUPPRESS)
    return parser.parse_args()


def _iter_watch_paths() -> list[Path]:
    paths: list[Path] = []

    for path in WATCH_FILES:
        if path.exists():
            paths.append(path)

    for root in WATCH_ROOTS:
        if not root.exists():
            continue

        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in IGNORED_WATCH_DIRS for part in path.parts):
                continue
            paths.append(path)

    return paths


def _snapshot_watch_state() -> dict[str, int]:
    state: dict[str, int] = {}
    for path in _iter_watch_paths():
        try:
            state[str(path)] = path.stat().st_mtime_ns
        except (OSError, TimeoutError):
            continue
    return state


def _start_child(args: argparse.Namespace) -> subprocess.Popen[bytes]:
    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--host",
        args.host,
        "--port",
        str(args.port),
        "--child",
        "--parent-pid",
        str(os.getpid()),
    ]
    if args.trust_proxy:
        command.append("--trust-proxy")
    return subprocess.Popen(
        command,
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
    )


def _stop_child(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return

    try:
        process.terminate()
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        try:
            process.kill()
            process.wait(timeout=2)
        except (subprocess.TimeoutExpired, ProcessLookupError, KeyboardInterrupt):
            pass
    except KeyboardInterrupt:
        try:
            process.kill()
            process.wait(timeout=2)
        except (subprocess.TimeoutExpired, ProcessLookupError, KeyboardInterrupt):
            pass
    except ProcessLookupError:
        pass


def _process_exists(pid: int) -> bool:
    if pid <= 0:
        return False

    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _install_signal_handlers() -> None:
    def _raise_keyboard_interrupt(_signum: int, _frame: Any) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGINT, _raise_keyboard_interrupt)
    for signal_name in ("SIGTERM", "SIGBREAK"):
        signum = getattr(signal, signal_name, None)
        if signum is not None:
            signal.signal(signum, _raise_keyboard_interrupt)


class ParentWatcherThread(threading.Thread):
    def __init__(self, parent_pid: int, server: ThreadingHTTPServer) -> None:
        super().__init__(daemon=True)
        self._parent_pid = parent_pid
        self._server = server
        self._stop_event = threading.Event()

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        while not self._stop_event.wait(1):
            if _process_exists(self._parent_pid):
                continue

            print(
                f"Reloader parent {self._parent_pid} exited; stopping child server.",
                file=sys.stderr,
                flush=True,
            )
            self._server.shutdown()
            return


def run_with_reloader(args: argparse.Namespace) -> None:
    watch_state = _snapshot_watch_state()
    child = _start_child(args)

    print("Watching serve.py for changes")
    print(f"Reloader parent PID {os.getpid()} managing child PID {child.pid}")

    try:
        while True:
            time.sleep(DEV_RELOAD_POLL_SECONDS)

            if child.poll() is not None:
                raise SystemExit(child.returncode or 0)

            current_state = _snapshot_watch_state()
            if current_state == watch_state:
                continue

            watch_state = current_state
            print("Change detected, reloading server...")
            _stop_child(child)
            child = _start_child(args)
            print(f"Reloader parent PID {os.getpid()} managing child PID {child.pid}")
    except KeyboardInterrupt:
        pass
    finally:
        _stop_child(child)


class ReuseAddrThreadingHTTPServer(ThreadingHTTPServer):
    """HTTP server that allows quick restarts by reusing the socket address."""
    allow_reuse_address = True
    
    def server_bind(self) -> None:
        """Bind to socket with SO_REUSEADDR set."""
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        super().server_bind()


def serve(args: argparse.Namespace) -> None:
    global TRUST_PROXY
    TRUST_PROXY = args.trust_proxy
    handler = functools.partial(AppHandler, directory=str(WEB_DIR))
    server = ReuseAddrThreadingHTTPServer((args.host, args.port), handler)
    scheduler: SchedulerThread | None = None
    parent_watcher: ParentWatcherThread | None = None
    if STORE is not None or LOCAL_PUSH_REGISTRY is not None:
        scheduler = SchedulerThread()
        scheduler.start()
    if args.parent_pid > 0:
        parent_watcher = ParentWatcherThread(args.parent_pid, server)
        parent_watcher.start()

    print(f"Serving {WEB_DIR} and API at http://localhost:{args.port} (bound to {args.host}:{args.port})")
    print(f"Cordyceps mode: {CORDYCEPS_MODE}")
    print(f"Serving child PID {os.getpid()} with reloader parent PID {args.parent_pid or 'none'}")
    print(f"VAPID public key: {VAPID_PUBLIC_KEY}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if parent_watcher is not None:
            parent_watcher.stop()
        if scheduler is not None:
            scheduler.stop()
        server.server_close()


def main() -> None:
    _install_signal_handlers()
    args = parse_args()
    if args.child:
        serve(args)
        return

    run_with_reloader(args)


if __name__ == "__main__":
    main()
