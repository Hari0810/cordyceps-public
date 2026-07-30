"""ICS/iCalendar parsing and timezone helpers.

Owner: serve.py /api/outlook/calendar route + email scheduler
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .utils import isoformat, parse_hhmm, utc_now

WINDOWS_TZID_FALLBACKS: dict[str, str] = {
    "GMT Standard Time": "Europe/London",
    "UTC": "UTC",
    "W. Europe Standard Time": "Europe/Berlin",
    "Central Europe Standard Time": "Europe/Budapest",
    "Eastern Standard Time": "America/New_York",
    "Central Standard Time": "America/Chicago",
    "Mountain Standard Time": "America/Denver",
    "Pacific Standard Time": "America/Los_Angeles",
}


# ---------------------------------------------------------------------------
# Timezone helpers
# ---------------------------------------------------------------------------

def get_timezone(name: str | None) -> ZoneInfo | None:
    if not isinstance(name, str) or not name.strip():
        return None
    try:
        return ZoneInfo(name.strip())
    except ZoneInfoNotFoundError:
        return None


def local_date_key(timestamp: float, timezone_name: str) -> str:
    timezone_info = get_timezone(timezone_name) or ZoneInfo("UTC")
    return (
        datetime.fromtimestamp(timestamp, tz=timezone.utc)
        .astimezone(timezone_info)
        .strftime("%Y-%m-%d")
    )


def resolve_ics_timezone(name: str | None, fallback_name: str | None = None) -> timezone | ZoneInfo:
    for candidate in (name, fallback_name):
        timezone_info = get_timezone(candidate)
        if timezone_info is not None:
            return timezone_info
        mapped = WINDOWS_TZID_FALLBACKS.get(str(candidate or "").strip())
        timezone_info = get_timezone(mapped)
        if timezone_info is not None:
            return timezone_info
    return timezone.utc


def format_local_date(timestamp: float, timezone_name: str) -> str:
    timezone_info = get_timezone(timezone_name) or ZoneInfo("UTC")
    local_time = datetime.fromtimestamp(timestamp, tz=timezone.utc).astimezone(timezone_info)
    return f"{local_time.strftime('%A')}, {local_time.day} {local_time.strftime('%B %Y')}"


def next_daily_occurrence(send_time: str, timezone_name: str, timestamp: float | None = None) -> str | None:
    parsed_time = parse_hhmm(send_time)
    timezone_info = get_timezone(timezone_name)
    if parsed_time is None or timezone_info is None:
        return None
    now_timestamp = utc_now() if timestamp is None else timestamp
    local_now = datetime.fromtimestamp(now_timestamp, tz=timezone.utc).astimezone(timezone_info)
    candidate = local_now.replace(
        hour=parsed_time[0],
        minute=parsed_time[1],
        second=0,
        microsecond=0,
    )
    if candidate <= local_now:
        candidate += timedelta(days=1)
    return isoformat(candidate.astimezone(timezone.utc).timestamp())


# ---------------------------------------------------------------------------
# ICS parsing
# ---------------------------------------------------------------------------

def unfold_ics_lines(text: str) -> list[str]:
    raw_lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    lines: list[str] = []
    for raw_line in raw_lines:
        if raw_line.startswith((" ", "\t")) and lines:
            lines[-1] += raw_line[1:]
        else:
            lines.append(raw_line)
    return lines


def parse_ics_property(line: str) -> tuple[str, dict[str, str], str] | None:
    if ":" not in line:
        return None
    key_part, value = line.split(":", 1)
    fragments = key_part.split(";")
    name = fragments[0].strip().upper()
    params: dict[str, str] = {}
    for fragment in fragments[1:]:
        if "=" not in fragment:
            continue
        param_name, param_value = fragment.split("=", 1)
        params[param_name.strip().upper()] = param_value.strip().strip('"')
    return name, params, value.strip()


def parse_ics_datetime(
    value: str,
    params: dict[str, str],
    *,
    default_timezone_name: str | None = None,
) -> tuple[datetime, bool] | None:
    clean_value = str(value or "").strip()
    if not clean_value:
        return None
    value_type = params.get("VALUE", "").upper()
    is_date = value_type == "DATE" or re.fullmatch(r"\d{8}", clean_value) is not None
    if is_date:
        try:
            parsed = datetime.strptime(clean_value[:8], "%Y%m%d")
        except ValueError:
            return None
        timezone_info = resolve_ics_timezone(default_timezone_name)
        return parsed.replace(tzinfo=timezone_info), True
    if clean_value.endswith("Z"):
        formats = ("%Y%m%dT%H%M%SZ", "%Y%m%dT%H%MZ")
        timezone_info: timezone | ZoneInfo = timezone.utc
    else:
        formats = ("%Y%m%dT%H%M%S", "%Y%m%dT%H%M")
        timezone_info = resolve_ics_timezone(params.get("TZID"), default_timezone_name)
    parsed_dt: datetime | None = None
    for fmt in formats:
        try:
            parsed_dt = datetime.strptime(clean_value, fmt)
            break
        except ValueError:
            continue
    if parsed_dt is None:
        return None
    return parsed_dt.replace(tzinfo=timezone_info), False


def build_ics_event_payload(
    component: dict[str, tuple[dict[str, str], str]],
    *,
    default_timezone_name: str | None = None,
) -> dict[str, Any] | None:
    start_entry = component.get("DTSTART")
    if not start_entry:
        return None
    start_parsed = parse_ics_datetime(start_entry[1], start_entry[0], default_timezone_name=default_timezone_name)
    if start_parsed is None:
        return None
    start_dt, start_is_all_day = start_parsed
    end_entry = component.get("DTEND")
    if end_entry:
        end_parsed = parse_ics_datetime(end_entry[1], end_entry[0], default_timezone_name=default_timezone_name)
        if end_parsed is None:
            return None
        end_dt, _ = end_parsed
    elif start_is_all_day:
        end_dt = start_dt + timedelta(days=1)
    else:
        end_dt = start_dt + timedelta(minutes=30)
    if end_dt <= start_dt:
        end_dt = start_dt + (timedelta(days=1) if start_is_all_day else timedelta(minutes=30))
    uid = component.get("UID", ({}, ""))[1].strip()
    title = component.get("SUMMARY", ({}, ""))[1].strip() or "Outlook event"
    identifier = uid or f"{title}:{start_dt.isoformat()}"
    return {
        "id": f"outlook:{identifier}",
        "title": title,
        "start": start_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end": end_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "outlook",
        "readOnly": True,
    }


def parse_ics_events(text: str) -> list[dict[str, Any]]:
    default_timezone_name: str | None = None
    events: list[dict[str, Any]] = []
    current_component: dict[str, tuple[dict[str, str], str]] | None = None
    for line in unfold_ics_lines(text):
        if not line:
            continue
        parsed_property = parse_ics_property(line)
        if current_component is None and parsed_property and parsed_property[0] == "X-WR-TIMEZONE":
            default_timezone_name = parsed_property[2]
            continue
        upper_line = line.upper()
        if upper_line == "BEGIN:VEVENT":
            current_component = {}
            continue
        if upper_line == "END:VEVENT":
            if current_component is not None:
                payload = build_ics_event_payload(current_component, default_timezone_name=default_timezone_name)
                if payload is not None:
                    events.append(payload)
            current_component = None
            continue
        if current_component is None or parsed_property is None:
            continue
        name, params, value = parsed_property
        if name in {"UID", "SUMMARY", "DTSTART", "DTEND"} and name not in current_component:
            current_component[name] = (params, value)
    return sorted(events, key=lambda event: (event["start"], event["end"], event["title"]))
