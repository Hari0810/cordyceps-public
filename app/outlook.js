/**
 * Outlook calendar sync — settings handlers, sync loop, refresh.
 *
 * App.js-owned dependencies are injected via `bindOutlookCallbacks`.
 *
 * Dependencies (direct imports):
 *   ApiError, apiFetch                                — ../modules/api.js
 *   showToast                                         — ../modules/ui.js
 *   outlookEmailInput, outlookIcsUrlInput,
 *   saveOutlookSettingsButton, outlookAutoSyncToggle  — ../modules/dom.js
 */

import { ApiError, apiFetch } from "../modules/api.js";
import { showToast } from "../modules/ui.js";
import {
  outlookAutoSyncToggle,
  outlookEmailInput,
  outlookIcsUrlInput,
  saveOutlookSettingsButton,
} from "../modules/dom.js";

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

const TOAST_DURATION_MS = 5000;

// ---------------------------------------------------------------------------
// Module-local state
// ---------------------------------------------------------------------------

let importedOutlookEvents = [];
let isOutlookCalendarSyncInFlight = false;
let lastOutlookCalendarSyncAt = 0;

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _getOutlookState = () => ({});
let _setServerState = () => {};
let _syncUI = () => {};
let _isDemoRuntimeMode = () => false;
let _clearDemoSyncState = () => {};
let _getOutlookCalendarSyncIntervalMs = () => 60000;

/**
 * Inject app.js-owned dependencies. Must be called once at boot.
 *
 * @param {object} callbacks
 * @param {() => object}        callbacks.getOutlookState
 * @param {(state: object) => void} callbacks.setServerState
 * @param {() => void}          callbacks.syncUI
 * @param {() => boolean}       callbacks.isDemoRuntimeMode
 * @param {() => void}          callbacks.clearDemoSyncState
 * @param {() => number}        callbacks.getOutlookCalendarSyncIntervalMs
 */
export function bindOutlookCallbacks(callbacks) {
  _getOutlookState = callbacks.getOutlookState ?? _getOutlookState;
  _setServerState = callbacks.setServerState ?? _setServerState;
  _syncUI = callbacks.syncUI ?? _syncUI;
  _isDemoRuntimeMode = callbacks.isDemoRuntimeMode ?? _isDemoRuntimeMode;
  _clearDemoSyncState = callbacks.clearDemoSyncState ?? _clearDemoSyncState;
  _getOutlookCalendarSyncIntervalMs = callbacks.getOutlookCalendarSyncIntervalMs ?? _getOutlookCalendarSyncIntervalMs;
}

// ---------------------------------------------------------------------------
// Exports for app.js consumption
// ---------------------------------------------------------------------------

export function getImportedOutlookEvents() {
  return importedOutlookEvents;
}

export function resetOutlookSyncState() {
  importedOutlookEvents = [];
  lastOutlookCalendarSyncAt = 0;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleOutlookSettingsSave() {
  const nextEmail = outlookEmailInput?.value.trim() || "";
  const nextIcsUrl = outlookIcsUrlInput?.value.trim() || "";
  const nextSyncMode = "outlook-to-today";

  if (!nextEmail || !nextIcsUrl) {
    showToast("Outlook details needed", "Enter both the Microsoft account email and the Outlook .ics link.", TOAST_DURATION_MS);
    return;
  }

  saveOutlookSettingsButton.disabled = true;

  try {
    const state = await apiFetch("/api/outlook/settings", {
      method: "POST",
      body: JSON.stringify({
        email: nextEmail,
        icsUrl: nextIcsUrl,
        syncMode: nextSyncMode
      })
    });
    _setServerState(state);
    await refreshOutlookCalendar({ force: true, silent: false });
    showToast("Outlook saved", "The Outlook calendar sync settings were saved.", TOAST_DURATION_MS);
  } catch {
    showToast("Outlook unavailable", "The Outlook sync settings could not be saved.", TOAST_DURATION_MS);
  } finally {
    saveOutlookSettingsButton.disabled = false;
  }
}

export async function handleOutlookAutoSyncToggle() {
  const outlookState = _getOutlookState();
  const nextEnabled = !outlookState.autoSyncEnabled;

  if (!outlookState.email || !outlookState.icsUrl) {
    showToast("Outlook not ready", "Save the Outlook account and .ics link first.", TOAST_DURATION_MS);
    return;
  }

  outlookAutoSyncToggle.disabled = true;

  try {
    const state = await apiFetch("/api/outlook/settings", {
      method: "POST",
      body: JSON.stringify({
        autoSyncEnabled: nextEnabled
      })
    });
    _setServerState(state);
    showToast(
      nextEnabled ? "Outlook auto sync on" : "Outlook auto sync off",
      nextEnabled
        ? "Today will keep importing Outlook events from the ICS feed while the app is open."
        : "The Outlook calendar sync loop has been disabled.",
      TOAST_DURATION_MS
    );
    if (nextEnabled) {
      await refreshOutlookCalendar({ force: true, silent: false });
    }
  } catch {
    showToast("Outlook unavailable", "The Outlook automatic sync setting could not be updated.", TOAST_DURATION_MS);
  } finally {
    _syncUI();
  }
}

export function startOutlookCalendarSyncLoop() {
  window.setInterval(() => {
    if (_isDemoRuntimeMode()) {
      return;
    }
    if (document.visibilityState !== "visible") {
      return;
    }

    void refreshOutlookCalendar({ silent: true });
  }, _getOutlookCalendarSyncIntervalMs());
}

export async function refreshOutlookCalendar({ force = false, silent = true } = {}) {
  if (_isDemoRuntimeMode()) {
    _clearDemoSyncState();
    return;
  }

  const outlookState = _getOutlookState();

  if (!outlookState.icsUrl) {
    if (importedOutlookEvents.length > 0) {
      importedOutlookEvents = [];
      _syncUI();
    }
    return;
  }
  if (!force && !outlookState.autoSyncEnabled) {
    return;
  }

  const now = Date.now();
  if (isOutlookCalendarSyncInFlight) {
    return;
  }
  if (!force && now - lastOutlookCalendarSyncAt < _getOutlookCalendarSyncIntervalMs()) {
    return;
  }

  isOutlookCalendarSyncInFlight = true;
  try {
    const query = force ? "?force=1" : "";
    const payload = await apiFetch(`/api/outlook/calendar${query}`);
    importedOutlookEvents = Array.isArray(payload?.events) ? payload.events : [];
    lastOutlookCalendarSyncAt = Date.now();
    if (payload?.state) {
      _setServerState(payload.state);
    } else {
      _syncUI();
    }
  } catch (error) {
    if (!silent) {
      showToast(
        "Outlook unavailable",
        getApiErrorMessage(error, "The Outlook ICS feed could not be loaded."),
        TOAST_DURATION_MS
      );
    }
  } finally {
    isOutlookCalendarSyncInFlight = false;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getApiErrorMessage(error, fallbackMessage) {
  if (error instanceof ApiError) {
    if (typeof error.payload?.error === "string" && error.payload.error.trim()) {
      return error.payload.error.trim();
    }

    if (typeof error.message === "string" && error.message.trim()) {
      return error.message.trim();
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}
