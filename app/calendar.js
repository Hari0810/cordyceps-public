/**
 * Calendar — pure date/time utilities and storage loader.
 *
 * Extracted from app.js. These functions have no dependency on module-level
 * state — they only operate on the Date API and, for the loader, localStorage
 * via loadStoredJson.
 *
 * State-mutating calendar functions (saveCalendarEvents, drag/resize handlers,
 * event editor, calendarStartDate mutations) remain in app.js until the full
 * calendar state ownership is resolved in a later extraction PR.
 *
 * Dependencies: createUuid, loadStoredJson from ../modules/state.js
 */

import { createUuid, loadStoredJson } from "../modules/state.js";

// Storage key exported so app.js can use it in saveCalendarEvents / backups.
export const CALENDAR_EVENTS_STORAGE_KEY = "today.todo.calendar-events.v1";

// ---------------------------------------------------------------------------
// Date arithmetic
// ---------------------------------------------------------------------------

export function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function getStartOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return startOfDay(d);
}

export function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return startOfDay(nextDate);
}

// ---------------------------------------------------------------------------
// Date input value helpers (used by the calendar event editor)
// ---------------------------------------------------------------------------

export function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInputValue(value) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return startOfDay(parsed);
}

// ---------------------------------------------------------------------------
// Calendar time display formatters
// ---------------------------------------------------------------------------

export function formatCalendarEventTime(start, end) {
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function formatCalendarDraftTime(startMinute, endMinute) {
  const start = new Date();
  start.setHours(0, startMinute, 0, 0);
  const end = new Date();
  end.setHours(0, endMinute, 0, 0);
  return formatCalendarEventTime(start, end);
}

export function formatCalendarDialogTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function parseCalendarDialogTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) || !Number.isInteger(minutes) ||
    hours < 0 || hours > 23 || minutes < 0 || minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

export function setCalendarEventTime(isoValue, minutesFromMidnight) {
  const nextDate = new Date(isoValue);
  nextDate.setHours(0, minutesFromMidnight, 0, 0);
  return nextDate.toISOString();
}

// ---------------------------------------------------------------------------
// Storage loader (read-only — no module-level state mutation)
// ---------------------------------------------------------------------------

export function loadCalendarEvents() {
  const storedEvents = loadStoredJson(CALENDAR_EVENTS_STORAGE_KEY, []);
  if (!Array.isArray(storedEvents)) {
    return [];
  }

  return storedEvents
    .map((event) => ({
      id: String(event?.id || createUuid()),
      title: String(event?.title || "New event"),
      start: typeof event?.start === "string" ? event.start : new Date().toISOString(),
      end: typeof event?.end === "string" ? event.end : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      isDeadline: Boolean(event?.isDeadline),
      parentId: event?.parentId ? String(event.parentId) : null,
      ...(event?.category ? { category: String(event.category) } : {}),
      ...(event?.updatedAt ? { updatedAt: String(event.updatedAt) } : {}),
      ...(event?.source ? { source: String(event.source) } : {}),
      ...(event?.readOnly != null ? { readOnly: Boolean(event.readOnly) } : {})
    }))
    .filter((event) => new Date(event.end).getTime() > new Date(event.start).getTime())
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
}
