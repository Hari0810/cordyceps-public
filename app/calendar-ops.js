/**
 * Calendar operations — state ownership, drag/resize, event editor.
 *
 * Owns `calendarEvents`, `calendarStartDate`, `calendarSelectedDate`, and
 * `calendarDraftEvent` as ES module live bindings. App.js reads them via live
 * binding and can update `calendarEvents` / `calendarDraftEvent` via the
 * exported setters (used by backup restore and account-state sync paths).
 *
 * App.js-owned dependencies (syncFeatureUi, scheduleAccountClientStateSync)
 * are injected once at boot via `bindCalendarOpsCallbacks`.
 *
 * Dependencies (direct imports):
 *   saveStoredJson, createUuid   — ../modules/state.js
 *   showToast                    — ../modules/ui.js
 *   calendarGrid, calendarDateInput — ../modules/dom.js
 *   date utilities + loader      — ./calendar.js
 */

import { saveStoredJson, createUuid } from "../modules/state.js";
import { showToast } from "../modules/ui.js";
import { calendarGrid, calendarDateInput } from "../modules/dom.js";
import {
  CALENDAR_EVENTS_STORAGE_KEY,
  loadCalendarEvents,
  addDays,
  startOfDay,
  getStartOfWeekMonday,
  formatDateInputValue,
  parseDateInputValue,
  formatCalendarDraftTime,
  formatCalendarDialogTime,
  parseCalendarDialogTime,
  setCalendarEventTime
} from "./calendar.js";

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

const CALENDAR_DAYS_VISIBLE = 7;
const CALENDAR_SLOT_MINUTES = 30;
const CALENDAR_DRAG_HOLD_MS = 520;
const CALENDAR_DRAG_CANCEL_DISTANCE_PX = 18;
const TOAST_DURATION_MS = 5000;

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _scheduleSync = () => {};
let _syncUI = () => {};
let _persistFeatureState = () => {};

/**
 * Inject app.js-owned dependencies. Must be called once at boot before any
 * calendar event handlers fire.
 *
 * @param {object} callbacks
 * @param {() => void} callbacks.scheduleSync
 * @param {() => void} callbacks.syncUI
 */
export function bindCalendarOpsCallbacks(callbacks) {
  _scheduleSync = callbacks.scheduleSync ?? _scheduleSync;
  _syncUI = callbacks.syncUI ?? _syncUI;
  _persistFeatureState = callbacks.persistFeatureState ?? _persistFeatureState;
}

// ---------------------------------------------------------------------------
// Local utilities (duplicated from app.js — can't import without circular dep)
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isCalendarDailySelectorMode() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 820px)").matches;
}

function triggerCalendarHaptic(pattern = 8) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // Haptics are best-effort and unsupported on some browsers.
  }
}

// ---------------------------------------------------------------------------
// Mutable state — live bindings owned by this module
// ---------------------------------------------------------------------------

export let calendarEvents = loadCalendarEvents();
export let calendarStartDate = getStartOfWeekMonday(new Date());
export let calendarSelectedDate = startOfDay(new Date());
export let calendarDraftEvent = null;

// Internal drag/resize/editor state — not exported

let calendarDrag = null;
let calendarPendingDrag = null;
let calendarResize = null;
let calendarMoveEvent = null;
let calendarPendingMove = null;
let calendarSuppressClickUntil = 0;
let calendarEditorEventId = null;
let calendarEditorIsNewEvent = false;

// ---------------------------------------------------------------------------
// Setters (for backup restore and account-state sync in app.js)
// ---------------------------------------------------------------------------

export function setCalendarEvents(events) {
  calendarEvents = events;
}

export function setCalendarDraftEvent(draft) {
  calendarDraftEvent = draft;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function saveCalendarEvents() {
  saveStoredJson(CALENDAR_EVENTS_STORAGE_KEY, calendarEvents);
  _scheduleSync();
  void Promise.resolve(_persistFeatureState()).catch(() => {});
}

function normalizeCalendarEventKind(kind, fallbackEvent = null) {
  if (kind === "social") {
    return "social";
  }

  if (kind === "deadline") {
    return "deadline";
  }

  if (fallbackEvent?.category === "social") {
    return "social";
  }

  if (fallbackEvent?.isDeadline || fallbackEvent?.category === "deadline") {
    return "deadline";
  }

  return "default";
}

function buildCalendarEventDateTime(dayDate, minute) {
  const nextDate = new Date(dayDate);
  nextDate.setHours(0, minute, 0, 0);
  return nextDate.toISOString();
}

function getCalendarEventUpdatedAt() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Navigation handlers
// ---------------------------------------------------------------------------

export function handleCalendarPreviousRange() {
  if (isCalendarDailySelectorMode()) {
    calendarSelectedDate = addDays(calendarSelectedDate, -1);
    calendarStartDate = getStartOfWeekMonday(calendarSelectedDate);
  } else {
    calendarStartDate = addDays(calendarStartDate, -CALENDAR_DAYS_VISIBLE);
    calendarSelectedDate = calendarStartDate;
  }
  _syncUI();
}

export function handleCalendarNextRange() {
  if (isCalendarDailySelectorMode()) {
    calendarSelectedDate = addDays(calendarSelectedDate, 1);
    calendarStartDate = getStartOfWeekMonday(calendarSelectedDate);
  } else {
    calendarStartDate = addDays(calendarStartDate, CALENDAR_DAYS_VISIBLE);
    calendarSelectedDate = calendarStartDate;
  }
  _syncUI();
}

export function handleCalendarDateChange() {
  if (!calendarDateInput?.value) {
    return;
  }

  const parsed = parseDateInputValue(calendarDateInput.value);
  if (!parsed) {
    return;
  }

  calendarSelectedDate = parsed;
  calendarStartDate = getStartOfWeekMonday(parsed);
  _syncUI();
}

export function setCalendarSelectedDate(nextDate) {
  const parsed = nextDate instanceof Date
    ? startOfDay(nextDate)
    : parseDateInputValue(String(nextDate || ""));
  if (!parsed) {
    return;
  }

  calendarSelectedDate = parsed;
  calendarStartDate = getStartOfWeekMonday(parsed);
  _syncUI();
}

// ---------------------------------------------------------------------------
// Pointer / drag handlers
// ---------------------------------------------------------------------------

export function handleCalendarPointerDown(event) {
  const surface = event.target instanceof Element ? event.target.closest(".calendar-day-surface") : null;
  if (!(surface instanceof HTMLElement) || event.button !== 0) {
    return;
  }

  const resizeHandle = event.target instanceof Element ? event.target.closest(".calendar-event-resize-handle") : null;
  if (resizeHandle instanceof HTMLElement) {
    const eventNode = resizeHandle.closest(".calendar-event");
    const direction = resizeHandle.dataset.resizeDirection === "start" ? "start" : "end";
    if (eventNode instanceof HTMLElement) {
      activateCalendarResize({
        pointerId: event.pointerId,
        surface,
        eventNode,
        direction
      });
      event.preventDefault();
    }
    return;
  }

  if (event.target instanceof Element && event.target.closest(".calendar-event")) {
    const eventNode = event.target.closest(".calendar-event");
    const eventId = eventNode.dataset.eventId;

    if (eventId) {
      const existingEvent = calendarEvents.find((entry) => entry.id === eventId);
      if (existingEvent) {
        const dayIndex = Number(surface.dataset.dayIndex);
        const start = new Date(existingEvent.start);
        const end = new Date(existingEvent.end);
        const startMinute = start.getHours() * 60 + start.getMinutes();
        const endMinute = end.getHours() * 60 + end.getMinutes();
        const minute = getCalendarMinuteFromSurface(surface, event.clientY);

        calendarPendingMove = {
          pointerId: event.pointerId,
          surface,
          eventId,
          eventNode,
          dayIndex,
          title: existingEvent.title || "New event",
          originalStartMinute: startMinute,
          originalEndMinute: endMinute,
          anchorMinute: minute,
          startClientX: event.clientX,
          startClientY: event.clientY
        };
      }
    }
    return;
  }

  const dayIndex = Number(surface.dataset.dayIndex);
  if (!Number.isFinite(dayIndex)) {
    return;
  }

  const minute = getCalendarMinuteFromSurface(surface, event.clientY);
  if (shouldDelayCalendarDrag(event)) {
    clearCalendarPendingDrag();
    calendarPendingDrag = {
      pointerId: event.pointerId,
      dayIndex,
      surface,
      anchorMinute: minute,
      startClientX: event.clientX,
      startClientY: event.clientY,
      pointerType: event.pointerType,
      timerId: window.setTimeout(() => {
        if (!calendarPendingDrag || calendarPendingDrag.pointerId !== event.pointerId) {
          return;
        }

        activateCalendarDrag(calendarPendingDrag);
        clearCalendarPendingDrag({ keepActiveDrag: true });
      }, CALENDAR_DRAG_HOLD_MS)
    };
    return;
  }

  activateCalendarDrag({
    pointerId: event.pointerId,
    dayIndex,
    surface,
    anchorMinute: minute,
    pointerType: event.pointerType
  });
  event.preventDefault();
}

function activateCalendarDrag(dragState) {
  calendarDrag = {
    pointerId: dragState.pointerId,
    dayIndex: dragState.dayIndex,
    surface: dragState.surface,
    anchorMinute: dragState.anchorMinute
  };
  calendarDraftEvent = {
    dayIndex: dragState.dayIndex,
    startMinute: dragState.anchorMinute,
    endMinute: Math.min(24 * 60, dragState.anchorMinute + CALENDAR_SLOT_MINUTES)
  };
  dragState.surface.setPointerCapture?.(dragState.pointerId);
  if (dragState.pointerType && dragState.pointerType !== "mouse") {
    triggerCalendarHaptic(10);
  }
  syncCalendarDraftSurface();
}

function activateCalendarResize({ pointerId, surface, eventNode, direction }) {
  const eventId = eventNode.dataset.eventId;
  if (!eventId) {
    return;
  }

  const existingEvent = calendarEvents.find((entry) => entry.id === eventId);
  if (!existingEvent) {
    return;
  }

  const dayIndex = Number(surface.dataset.dayIndex);
  const start = new Date(existingEvent.start);
  const end = new Date(existingEvent.end);
  const startMinute = start.getHours() * 60 + start.getMinutes();
  const endMinute = end.getHours() * 60 + end.getMinutes();
  calendarResize = {
    pointerId,
    surface,
    eventId,
    dayIndex,
    direction,
    title: existingEvent.title || "New event",
    originalStartMinute: startMinute,
    originalEndMinute: endMinute
  };
  calendarDraftEvent = {
    dayIndex,
    startMinute,
    endMinute,
    title: existingEvent.title || "New event"
  };
  surface.setPointerCapture?.(pointerId);
  syncCalendarDraftSurface();
}

export function handleCalendarPointerMove(event) {
  if (calendarPendingMove?.pointerId === event.pointerId) {
    const distance = Math.hypot(
      event.clientX - calendarPendingMove.startClientX,
      event.clientY - calendarPendingMove.startClientY
    );
    if (distance > CALENDAR_DRAG_CANCEL_DISTANCE_PX) {
      calendarMoveEvent = calendarPendingMove;
      calendarPendingMove = null;
      calendarMoveEvent.surface.setPointerCapture?.(calendarMoveEvent.pointerId);
      calendarMoveEvent.eventNode.style.opacity = "0.5";

      calendarDraftEvent = {
        dayIndex: calendarMoveEvent.dayIndex,
        startMinute: calendarMoveEvent.originalStartMinute,
        endMinute: calendarMoveEvent.originalEndMinute,
        title: calendarMoveEvent.title
      };
    } else {
      return;
    }
  }

  if (calendarMoveEvent && calendarMoveEvent.pointerId === event.pointerId) {
    const minute = getCalendarMinuteFromSurface(calendarMoveEvent.surface, event.clientY);
    const minuteDelta = minute - calendarMoveEvent.anchorMinute;
    const duration = calendarMoveEvent.originalEndMinute - calendarMoveEvent.originalStartMinute;

    let nextStartMinute = calendarMoveEvent.originalStartMinute + minuteDelta;
    let nextEndMinute = nextStartMinute + duration;

    if (nextStartMinute < 0) {
      nextStartMinute = 0;
      nextEndMinute = duration;
    } else if (nextEndMinute > 24 * 60) {
      nextEndMinute = 24 * 60;
      nextStartMinute = nextEndMinute - duration;
    }

    const snappedStart = Math.floor(nextStartMinute / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_MINUTES;
    const snappedEnd = snappedStart + duration;

    calendarDraftEvent = {
      dayIndex: calendarMoveEvent.dayIndex,
      startMinute: snappedStart,
      endMinute: snappedEnd,
      title: calendarMoveEvent.title
    };
    syncCalendarDraftSurface();
    event.preventDefault();
    return;
  }

  if (calendarPendingDrag?.pointerId === event.pointerId) {
    const distance = Math.hypot(
      event.clientX - calendarPendingDrag.startClientX,
      event.clientY - calendarPendingDrag.startClientY
    );
    if (distance > CALENDAR_DRAG_CANCEL_DISTANCE_PX) {
      clearCalendarPendingDrag();
    }
    return;
  }

  if (calendarResize && calendarResize.pointerId === event.pointerId) {
    const minute = getCalendarMinuteFromSurface(calendarResize.surface, event.clientY);
    if (calendarResize.direction === "start") {
      const nextStartMinute = Math.max(
        0,
        Math.min(minute, calendarResize.originalEndMinute - CALENDAR_SLOT_MINUTES)
      );
      calendarDraftEvent = {
        dayIndex: calendarResize.dayIndex,
        startMinute: nextStartMinute,
        endMinute: calendarResize.originalEndMinute,
        title: calendarResize.title
      };
    } else {
      const nextEndMinute = Math.min(
        24 * 60,
        Math.max(minute + CALENDAR_SLOT_MINUTES, calendarResize.originalStartMinute + CALENDAR_SLOT_MINUTES)
      );
      calendarDraftEvent = {
        dayIndex: calendarResize.dayIndex,
        startMinute: calendarResize.originalStartMinute,
        endMinute: nextEndMinute,
        title: calendarResize.title
      };
    }
    syncCalendarDraftSurface();
    event.preventDefault();
    return;
  }

  if (!calendarDrag || calendarDrag.pointerId !== event.pointerId) {
    return;
  }

  const minute = getCalendarMinuteFromSurface(calendarDrag.surface, event.clientY);
  const startMinute = Math.min(calendarDrag.anchorMinute, minute);
  const endMinute = Math.max(calendarDrag.anchorMinute + CALENDAR_SLOT_MINUTES, minute + CALENDAR_SLOT_MINUTES);
  calendarDraftEvent = {
    dayIndex: calendarDrag.dayIndex,
    startMinute,
    endMinute: Math.min(24 * 60, endMinute)
  };
  syncCalendarDraftSurface();
  event.preventDefault();
}

export function handleCalendarPointerUp(event) {
  if (calendarPendingMove?.pointerId === event.pointerId) {
    const { eventNode, eventId } = calendarPendingMove;
    calendarPendingMove = null;
    if (eventNode instanceof HTMLElement && eventId && eventNode.dataset.eventReadOnly !== "true") {
      event.preventDefault();
      openCalendarEventEditor(eventNode, eventId);
      calendarSuppressClickUntil = window.performance.now() + 280;
    } else if (eventNode instanceof HTMLElement && eventNode.dataset.eventReadOnly === "true") {
      event.preventDefault();
      showToast("Outlook event", "Imported Outlook events are read-only right now.", TOAST_DURATION_MS);
      calendarSuppressClickUntil = window.performance.now() + 280;
    }
    return;
  }

  if (calendarMoveEvent && calendarMoveEvent.pointerId === event.pointerId) {
    finalizeCalendarMove();
    return;
  }

  if (calendarPendingDrag?.pointerId === event.pointerId) {
    clearCalendarPendingDrag();
    return;
  }

  if (calendarResize && calendarResize.pointerId === event.pointerId) {
    finalizeCalendarResize();
    return;
  }

  if (!calendarDrag || calendarDrag.pointerId !== event.pointerId) {
    return;
  }

  finalizeCalendarDrag();
}

export function cancelCalendarDrag() {
  clearCalendarPendingDrag();
  releaseCalendarPointerCapture();
  calendarDrag = null;
  calendarResize = null;
  if (calendarMoveEvent && calendarMoveEvent.eventNode) {
    calendarMoveEvent.eventNode.style.opacity = "";
  }
  calendarMoveEvent = null;
  calendarPendingMove = null;
  calendarDraftEvent = null;
  syncCalendarDraftSurface();
}

function clearCalendarPendingDrag(options = {}) {
  if (calendarPendingDrag?.timerId) {
    window.clearTimeout(calendarPendingDrag.timerId);
  }

  calendarPendingDrag = null;

  if (!options.keepActiveDrag) {
    syncCalendarDraftSurface();
  }
}

function finalizeCalendarDrag() {
  if (!calendarDraftEvent) {
    calendarDrag = null;
    return;
  }

  const dayDate = addDays(calendarStartDate, calendarDraftEvent.dayIndex);
  createCalendarEventRecord({
    date: dayDate,
    startMinute: calendarDraftEvent.startMinute,
    endMinute: calendarDraftEvent.endMinute,
    title: "New event",
    kind: "default"
  });
  triggerCalendarHaptic([8, 24, 8]);
  releaseCalendarPointerCapture();
  calendarDrag = null;
  calendarDraftEvent = null;
}

function releaseCalendarPointerCapture() {
  const activePointerState = calendarDrag || calendarResize || calendarMoveEvent;
  if (!activePointerState?.surface || activePointerState.pointerId == null) {
    return;
  }

  try {
    if (activePointerState.surface.hasPointerCapture?.(activePointerState.pointerId)) {
      activePointerState.surface.releasePointerCapture(activePointerState.pointerId);
    }
  } catch {
    // Ignore stale pointer-capture errors when the gesture ends mid-layout change.
  }
}

function finalizeCalendarResize() {
  if (!calendarResize || !calendarDraftEvent) {
    calendarResize = null;
    calendarDraftEvent = null;
    return;
  }

  const { eventId } = calendarResize;
  calendarEvents = calendarEvents.map((entry) => {
    if (entry.id !== eventId) {
      return entry;
    }

    const start = new Date(entry.start);
    start.setHours(0, calendarDraftEvent.startMinute, 0, 0);
    const end = new Date(entry.end);
    end.setHours(0, calendarDraftEvent.endMinute, 0, 0);
    return {
      ...entry,
      start: start.toISOString(),
      end: end.toISOString(),
      updatedAt: getCalendarEventUpdatedAt()
    };
  });
  saveCalendarEvents();
  calendarSuppressClickUntil = window.performance.now() + 280;
  releaseCalendarPointerCapture();
  calendarResize = null;
  calendarDraftEvent = null;
  _syncUI();
}

function finalizeCalendarMove() {
  if (!calendarMoveEvent || !calendarDraftEvent) {
    if (calendarMoveEvent && calendarMoveEvent.eventNode) {
      calendarMoveEvent.eventNode.style.opacity = "";
    }
    calendarMoveEvent = null;
    calendarDraftEvent = null;
    return;
  }

  const { eventId } = calendarMoveEvent;
  if (calendarMoveEvent.originalStartMinute !== calendarDraftEvent.startMinute) {
    calendarEvents = calendarEvents.map((entry) => {
      if (entry.id !== eventId) {
        return entry;
      }

      const start = new Date(entry.start);
      start.setHours(0, calendarDraftEvent.startMinute, 0, 0);
      const end = new Date(entry.end);
      end.setHours(0, calendarDraftEvent.endMinute, 0, 0);
      return {
        ...entry,
        start: start.toISOString(),
        end: end.toISOString(),
        updatedAt: getCalendarEventUpdatedAt()
      };
    }).sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
    saveCalendarEvents();
    calendarSuppressClickUntil = window.performance.now() + 280;
  }

  releaseCalendarPointerCapture();
  calendarMoveEvent.eventNode.style.opacity = "";
  calendarMoveEvent = null;
  calendarDraftEvent = null;
  _syncUI();
}

function shouldDelayCalendarDrag(event) {
  return event.pointerType !== "mouse";
}

function syncCalendarDraftSurface() {
  const draftNodes = calendarGrid?.querySelectorAll(".calendar-event-draft");
  draftNodes?.forEach((node) => node.remove());

  if (!calendarDraftEvent || !calendarGrid) {
    return;
  }

  const surface = calendarGrid.querySelector(
    `.calendar-day-surface[data-day-index="${calendarDraftEvent.dayIndex}"]`
  );
  if (!(surface instanceof HTMLElement)) {
    return;
  }

  const draftNode = document.createElement("div");
  draftNode.className = "calendar-event calendar-event-draft";
  draftNode.style.top = `${(calendarDraftEvent.startMinute / 60) * 64}px`;
  draftNode.style.height = `${Math.max(28, ((calendarDraftEvent.endMinute - calendarDraftEvent.startMinute) / 60) * 64)}px`;
  draftNode.innerHTML = `<span class="calendar-event-title">${escapeHtml(calendarDraftEvent.title || "New event")}</span><span class="calendar-event-time">${formatCalendarDraftTime(calendarDraftEvent.startMinute, calendarDraftEvent.endMinute)}</span>`;
  surface.append(draftNode);
}

function getCalendarMinuteFromSurface(surface, clientY) {
  const rect = surface.getBoundingClientRect();
  const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top));
  const rawMinute = (relativeY / rect.height) * 24 * 60;
  const snapped = Math.floor(rawMinute / CALENDAR_SLOT_MINUTES) * CALENDAR_SLOT_MINUTES;
  return Math.max(0, Math.min(24 * 60 - CALENDAR_SLOT_MINUTES, snapped));
}

// ---------------------------------------------------------------------------
// Event editor
// ---------------------------------------------------------------------------

function positionCalendarEventEditor(anchorEl) {
  const panel = document.getElementById("calendar-event-editor");
  if (!panel) {
    return;
  }

  panel.style.transform = "";

  if (anchorEl instanceof HTMLElement) {
    const r = anchorEl.getBoundingClientRect();
    const width = 300;
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    let top = r.bottom + 8;
    const estHeight = 240;
    if (top + estHeight > window.innerHeight - 12) {
      top = Math.max(12, r.top - estHeight - 8);
    }
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.width = `${width}px`;
    panel.classList.remove("calendar-event-editor--centered");
  } else {
    panel.style.left = "50%";
    panel.style.top = "50%";
    panel.style.width = "min(320px, calc(100vw - 24px))";
    panel.style.transform = "translate(-50%, -50%)";
    panel.classList.add("calendar-event-editor--centered");
  }
}

export function closeCalendarEventEditor() {
  const removedDraftEventId = calendarEditorIsNewEvent ? calendarEditorEventId : null;
  const panel = document.getElementById("calendar-event-editor");
  if (panel) {
    panel.hidden = true;
  }
  document.removeEventListener("pointerdown", handleCalendarEditorOutsidePointerDown, true);
  document.removeEventListener("keydown", handleCalendarEditorEscapeKey, true);
  calendarEditorEventId = null;
  calendarEditorIsNewEvent = false;

  if (removedDraftEventId) {
    calendarEvents = calendarEvents.filter((entry) => entry.id !== removedDraftEventId);
    saveCalendarEvents();
    _syncUI();
  }
}

function handleCalendarEditorOutsidePointerDown(event) {
  const panel = document.getElementById("calendar-event-editor");
  if (!panel || panel.hidden) {
    return;
  }
  if (event.target instanceof Node && panel.contains(event.target)) {
    return;
  }
  closeCalendarEventEditor();
}

function handleCalendarEditorEscapeKey(event) {
  if (event.key !== "Escape") {
    return;
  }
  const panel = document.getElementById("calendar-event-editor");
  if (!panel || panel.hidden) {
    return;
  }
  event.preventDefault();
  closeCalendarEventEditor();
}

export function openCalendarEventEditor(anchorEl, eventId) {
  const currentEvent = calendarEvents.find((entry) => entry.id === eventId);
  if (!currentEvent) {
    return;
  }

  const panel = document.getElementById("calendar-event-editor");
  const titleInput = document.getElementById("calendar-event-editor-title");
  const dateInput = document.getElementById("calendar-event-editor-date");
  const startInput = document.getElementById("calendar-event-editor-start");
  const endInput = document.getElementById("calendar-event-editor-end");
  if (!panel || !titleInput || !dateInput || !startInput || !endInput) {
    return;
  }

  calendarEditorEventId = eventId;
  titleInput.value = currentEvent.title || "";
  const startDate = new Date(currentEvent.start);
  const endDate = new Date(currentEvent.end);
  dateInput.value = formatDateInputValue(startDate);
  startInput.value = formatCalendarDialogTime(startDate);
  endInput.value = formatCalendarDialogTime(endDate);

  const deadlineCheckbox = document.getElementById("calendar-event-editor-deadline");
  const parentSelect = document.getElementById("calendar-event-editor-parent");
  const parentWrapper = document.getElementById("calendar-event-editor-parent-wrapper");

  if (deadlineCheckbox) {
    deadlineCheckbox.checked = currentEvent.isDeadline || false;
    deadlineCheckbox.onchange = () => {
      if (parentWrapper) {
        parentWrapper.style.display = deadlineCheckbox.checked ? "none" : "";
        if (deadlineCheckbox.checked && parentSelect) {
          parentSelect.value = "";
        }
      }
    };
  }

  if (parentSelect) {
    parentSelect.innerHTML = '<option value="">None</option>';
    const deadlines = calendarEvents.filter(e => e.isDeadline && e.id !== eventId);
    deadlines.forEach(d => {
      const option = document.createElement("option");
      option.value = d.id;
      option.textContent = d.title || "Untitled Deadline";
      parentSelect.append(option);
    });
    parentSelect.value = currentEvent.parentId || "";
  }

  if (parentWrapper) {
    parentWrapper.style.display = currentEvent.isDeadline ? "none" : "";
  }

  panel.hidden = false;
  positionCalendarEventEditor(anchorEl);
  document.addEventListener("keydown", handleCalendarEditorEscapeKey, true);
  window.requestAnimationFrame(() => {
    document.addEventListener("pointerdown", handleCalendarEditorOutsidePointerDown, true);
  });
  window.requestAnimationFrame(() => {
    titleInput.focus();
    titleInput.select();
  });
}

export function createCalendarEventFromComposer({ isDeadline = false } = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visibleStart = new Date(calendarStartDate);
  visibleStart.setHours(0, 0, 0, 0);
  const visibleEnd = addDays(visibleStart, CALENDAR_DAYS_VISIBLE);
  const selectedDate = startOfDay(calendarSelectedDate || calendarStartDate);
  const baseDate = selectedDate >= visibleStart && selectedDate < visibleEnd
    ? selectedDate
    : today >= visibleStart && today < visibleEnd
      ? today
      : visibleStart;
  const start = new Date(baseDate);
  const end = new Date(baseDate);

  if (isDeadline) {
    start.setHours(17, 0, 0, 0);
    end.setHours(17, 30, 0, 0);
  } else {
    start.setHours(9, 0, 0, 0);
    end.setHours(10, 0, 0, 0);
  }

  const eventId = createCalendarEventRecord({
    date: baseDate,
    startMinute: start.getHours() * 60 + start.getMinutes(),
    endMinute: end.getHours() * 60 + end.getMinutes(),
    title: isDeadline ? "New deadline" : "New event",
    kind: isDeadline ? "deadline" : "default"
  });
  const newEvent = calendarEvents.find((entry) => entry.id === eventId);
  if (!newEvent) {
    return;
  }
  openCalendarEventEditor(null, newEvent.id);
  calendarEditorIsNewEvent = true;
}

export function createCalendarEventRecord({
  date,
  startMinute,
  endMinute,
  title = "New event",
  kind = "default",
  parentId = null
}) {
  const dayDate = startOfDay(date instanceof Date ? date : new Date(date));
  const eventKind = normalizeCalendarEventKind(kind);
  const newEvent = {
    id: createUuid(),
    title,
    start: buildCalendarEventDateTime(dayDate, startMinute),
    end: buildCalendarEventDateTime(dayDate, endMinute),
    isDeadline: eventKind === "deadline",
    category: eventKind,
    parentId: eventKind === "deadline" ? null : parentId,
    updatedAt: getCalendarEventUpdatedAt()
  };

  calendarEvents = [...calendarEvents, newEvent].sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
  calendarSelectedDate = dayDate;
  calendarStartDate = getStartOfWeekMonday(dayDate);
  saveCalendarEvents();
  _syncUI();
  return newEvent.id;
}

export function updateCalendarEventRecord({
  eventId,
  title,
  date,
  startMinute,
  endMinute,
  kind,
  parentId = null
}) {
  const existingEvent = calendarEvents.find((entry) => entry.id === eventId);
  if (!existingEvent) {
    return false;
  }

  const dayDate = startOfDay(date instanceof Date ? date : new Date(date));
  const eventKind = normalizeCalendarEventKind(kind, existingEvent);
  const nextTitle = String(title || existingEvent.title || "New event").trim() || "New event";

  calendarEvents = calendarEvents
    .map((entry) =>
      entry.id === eventId
        ? {
            ...entry,
            title: nextTitle,
            start: buildCalendarEventDateTime(dayDate, startMinute),
            end: buildCalendarEventDateTime(dayDate, endMinute),
            isDeadline: eventKind === "deadline",
            category: eventKind,
            parentId: eventKind === "deadline" ? null : parentId,
            updatedAt: getCalendarEventUpdatedAt()
          }
        : entry
    )
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
  calendarSelectedDate = dayDate;
  calendarStartDate = getStartOfWeekMonday(dayDate);
  saveCalendarEvents();
  _syncUI();
  return true;
}

export function updateCalendarEventTimeRange({
  eventId,
  date,
  startMinute,
  endMinute
}) {
  const existingEvent = calendarEvents.find((entry) => entry.id === eventId);
  if (!existingEvent) {
    return false;
  }

  return updateCalendarEventRecord({
    eventId,
    title: existingEvent.title,
    date,
    startMinute,
    endMinute,
    kind: normalizeCalendarEventKind(existingEvent.category, existingEvent),
    parentId: existingEvent.parentId || null
  });
}

export function handleCalendarEventEditorSubmit(event) {
  event.preventDefault();
  const eventId = calendarEditorEventId;
  if (!eventId) {
    return;
  }

  const titleInput = document.getElementById("calendar-event-editor-title");
  const dateInput = document.getElementById("calendar-event-editor-date");
  const startInput = document.getElementById("calendar-event-editor-start");
  const endInput = document.getElementById("calendar-event-editor-end");
  const nextDate = parseDateInputValue(dateInput?.value || "");
  const nextTitle = titleInput?.value?.trim() || "New event";
  const nextStartMinutes = parseCalendarDialogTime(startInput?.value || "");
  const nextEndMinutes = parseCalendarDialogTime(endInput?.value || "");
  if (
    !nextDate ||
    nextStartMinutes == null ||
    nextEndMinutes == null ||
    nextEndMinutes <= nextStartMinutes
  ) {
    showToast("Invalid event", "Use a valid date and make sure the end is after the start.", TOAST_DURATION_MS);
    return;
  }

  const deadlineCheckbox = document.getElementById("calendar-event-editor-deadline");
  const parentSelect = document.getElementById("calendar-event-editor-parent");
  const isDeadline = deadlineCheckbox?.checked || false;
  const parentId = !isDeadline && parentSelect?.value ? parentSelect.value : null;

  calendarEvents = calendarEvents.map((entry) =>
    entry.id === eventId
      ? {
        ...entry,
        title: nextTitle,
        start: setCalendarEventTime(nextDate.toISOString(), nextStartMinutes),
        end: setCalendarEventTime(nextDate.toISOString(), nextEndMinutes),
        isDeadline,
        category: isDeadline ? "deadline" : entry.category === "social" ? "social" : "default",
        parentId,
        updatedAt: getCalendarEventUpdatedAt()
      }
      : entry
  );
  saveCalendarEvents();
  calendarEditorIsNewEvent = false;
  closeCalendarEventEditor();
  _syncUI();
}

export function handleCalendarEventClick(event) {
  if (window.performance.now() < calendarSuppressClickUntil) {
    return;
  }

  if (event.target instanceof Element && event.target.closest(".calendar-event-resize-handle")) {
    return;
  }

  const eventNode = event.target instanceof Element ? event.target.closest(".calendar-event") : null;
  if (!(eventNode instanceof HTMLElement) || eventNode.classList.contains("calendar-event-draft")) {
    return;
  }

  if (eventNode.dataset.eventReadOnly === "true") {
    event.preventDefault();
    showToast("Outlook event", "Imported Outlook events are read-only right now.", TOAST_DURATION_MS);
    return;
  }

  const eventId = eventNode.dataset.eventId;
  if (!eventId || !calendarEvents.some((entry) => entry.id === eventId)) {
    return;
  }

  event.preventDefault();
  openCalendarEventEditor(eventNode, eventId);
}
