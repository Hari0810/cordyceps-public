/**
 * Push notification, alert toggling, and alert claim loop handlers.
 *
 * App.js-owned dependencies are injected via `bindPushAlertsCallbacks`.
 *
 * Dependencies (direct imports):
 *   apiFetch                                          — ../modules/api.js
 *   showToast, syncSyncStatusUi                       — ../modules/ui.js
 *   disablePushAlerts, enablePushAlerts,
 *   syncPushSubscription as loadPushSubscription      — ../modules/push.js
 */

import { apiFetch } from "../modules/api.js";
import { showToast, syncSyncStatusUi } from "../modules/ui.js";
import {
  disablePushAlerts,
  enablePushAlerts,
  syncPushSubscription as loadPushSubscription,
} from "../modules/push.js";

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

const TOAST_DURATION_MS = 5000;
const URGENT_NOTIFICATION_ICON = "./icons/icon-urgent-192.png?v=20260505-red-cordy";

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _getAlertState = () => ({});
let _setAlertState = () => {};
let _getPushSupported = () => false;
let _getPushSubscription = () => null;
let _setPushSubscription = () => {};
let _getServiceWorkerRegistration = () => null;
let _getPushConfig = () => null;
let _setPushConfig = () => {};
let _isDemoRuntimeMode = () => false;
let _clearDemoSyncState = () => {};
let _isServerSyncPaused = () => false;
let _markServerSyncSuccess = () => {};
let _markServerSyncFailure = () => {};
let _getSyncUiState = () => ({});
let _performQueuedMutation = async () => {};
let _getAlertClaimIntervalMs = () => 30000;
let _syncUI = () => {};

/**
 * Inject app.js-owned dependencies. Must be called once at boot.
 *
 * @param {object} callbacks
 */
export function bindPushAlertsCallbacks(callbacks) {
  _getAlertState = callbacks.getAlertState ?? _getAlertState;
  _setAlertState = callbacks.setAlertState ?? _setAlertState;
  _getPushSupported = callbacks.getPushSupported ?? _getPushSupported;
  _getPushSubscription = callbacks.getPushSubscription ?? _getPushSubscription;
  _setPushSubscription = callbacks.setPushSubscription ?? _setPushSubscription;
  _getServiceWorkerRegistration = callbacks.getServiceWorkerRegistration ?? _getServiceWorkerRegistration;
  _getPushConfig = callbacks.getPushConfig ?? _getPushConfig;
  _setPushConfig = callbacks.setPushConfig ?? _setPushConfig;
  _isDemoRuntimeMode = callbacks.isDemoRuntimeMode ?? _isDemoRuntimeMode;
  _clearDemoSyncState = callbacks.clearDemoSyncState ?? _clearDemoSyncState;
  _isServerSyncPaused = callbacks.isServerSyncPaused ?? _isServerSyncPaused;
  _markServerSyncSuccess = callbacks.markServerSyncSuccess ?? _markServerSyncSuccess;
  _markServerSyncFailure = callbacks.markServerSyncFailure ?? _markServerSyncFailure;
  _getSyncUiState = callbacks.getSyncUiState ?? _getSyncUiState;
  _performQueuedMutation = callbacks.performQueuedMutation ?? _performQueuedMutation;
  _getAlertClaimIntervalMs = callbacks.getAlertClaimIntervalMs ?? _getAlertClaimIntervalMs;
  _syncUI = callbacks.syncUI ?? _syncUI;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleRandomAlertToggle() {
  const alertState = _getAlertState();
  const nextEnabled = !alertState.enabled;
  await _performQueuedMutation({
    kind: "alerts.toggle",
    enabled: nextEnabled,
    request: {
      url: "/api/alerts/toggle",
      options: {
        method: "POST",
        body: JSON.stringify({ enabled: nextEnabled })
      }
    }
  });

  const synced = await syncServerAlertSetting("/api/alerts/toggle", nextEnabled);
  if (_getAlertState().enabled) {
    showToast(
      "Random alerts on",
      synced
        ? "The backend will keep scheduling generic reminders every 1 to 3 hours."
        : "Saved locally, but the server scheduler could not be updated.",
      TOAST_DURATION_MS
    );
    return;
  }

  showToast(
    "Random alerts off",
    synced
      ? "The reminder scheduler is paused until you turn it back on."
      : "Saved locally, but the server scheduler could not be updated.",
    TOAST_DURATION_MS
  );
}

export async function handleTestPushToggle() {
  const alertState = _getAlertState();
  const nextEnabled = !alertState.testPushEnabled;
  const previousState = { ...alertState };

  _setAlertState({
    ...alertState,
    testPushEnabled: nextEnabled,
    nextTestPushAt: null
  });
  _syncUI();

  try {
    await _performQueuedMutation({
      kind: "alerts.testPushToggle",
      enabled: nextEnabled,
      request: {
        url: "/api/alerts/test-push-toggle",
        options: {
          method: "POST",
          body: JSON.stringify({ enabled: nextEnabled })
        }
      }
    });
    await syncServerAlertSetting("/api/alerts/test-push-toggle", nextEnabled, { throwOnError: true });

    if (_getAlertState().testPushEnabled) {
      showToast("Test push on", "The push scheduler will send a generic notification every 10 seconds.", TOAST_DURATION_MS);
      return;
    }

    showToast("Test push off", "The 10 second test push loop has been disabled.", TOAST_DURATION_MS);
  } catch {
    await _performQueuedMutation({
      kind: "alerts.testPushToggle",
      enabled: previousState.testPushEnabled
    });
    _setAlertState(previousState);
    _syncUI();
    showToast("Test push unavailable", "The test push setting could not be updated.", TOAST_DURATION_MS);
  }
}

export async function handleNotificationToggle() {
  const pushSupported = _getPushSupported();
  const serviceWorkerRegistration = _getServiceWorkerRegistration();

  if (!pushSupported || !serviceWorkerRegistration) {
    showToast("Push unavailable", "This browser does not support web push for this app.", TOAST_DURATION_MS);
    return;
  }

  const subscribeEndpoint = "/api/push/subscribe";
  const unsubscribeEndpoint = "/api/push/unsubscribe";

  let pushSubscription = _getPushSubscription();
  if (pushSubscription) {
    pushSubscription = await disablePushAlerts(
      pushSubscription,
      apiFetch,
      (title, message) => showToast(title, message, TOAST_DURATION_MS),
      unsubscribeEndpoint
    );
    _setPushSubscription(pushSubscription);
    _syncUI();
    return;
  }

  try {
    const result = await enablePushAlerts({
      serviceWorkerRegistration,
      pushSupported,
      pushConfig: _getPushConfig(),
      apiFetch,
      showToast: (title, message) => showToast(title, message, TOAST_DURATION_MS),
      subscribeEndpoint,
    });
    _setPushSubscription(result.pushSubscription);
    _setPushConfig(result.pushConfig);
    await syncServerAlertSettings({ silent: true });
  } catch {
    showToast("Push unavailable", "Web Push could not be enabled on this device.", TOAST_DURATION_MS);
  }

  _syncUI();
}

export async function handleUrgentNotificationTestToggle(event) {
  const toggle = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const urgentTestPushStatus = document.querySelector("#urgent-test-push-status");
  const previousStatus = urgentTestPushStatus?.textContent || "Sends one urgent-style notification";

  if (toggle) {
    toggle.setAttribute("aria-checked", "true");
    toggle.disabled = true;
  }
  if (urgentTestPushStatus) {
    urgentTestPushStatus.textContent = "Sending urgent test...";
  }

  try {
    const serviceWorkerRegistration = _getServiceWorkerRegistration();
    if (!serviceWorkerRegistration || !("Notification" in window)) {
      showToast("Urgent test unavailable", "This browser cannot show service worker notifications.", TOAST_DURATION_MS);
      return;
    }

    if (Notification.permission === "denied") {
      showToast("Push blocked", "Allow notifications in your browser settings to test urgent notifications.", TOAST_DURATION_MS);
      return;
    }

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showToast("Permission needed", "Allow notifications to test the urgent notification style.", TOAST_DURATION_MS);
        return;
      }
    }

    const baseUrl = window.location.href;
    const urgentIconUrl = new URL(URGENT_NOTIFICATION_ICON, baseUrl).href;
    if ("setAppBadge" in navigator) {
      try {
        await navigator.setAppBadge(1);
      } catch {
        // App badging is best-effort and may be blocked by platform settings.
      }
    }

    await serviceWorkerRegistration.showNotification("Urgent: test", {
      body: "Urgent notification test from Cordyceps.",
      tag: "cordyceps-urgent-test",
      icon: urgentIconUrl,
      badge: urgentIconUrl,
      data: {
        url: "/?page=tasks",
        kind: "urgent-test"
      },
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200, 100, 400]
    });

    if (urgentTestPushStatus) {
      urgentTestPushStatus.textContent = "Urgent test sent";
    }
    showToast("Urgent test sent", "Look for the dark red Cordyceps notification icon.", TOAST_DURATION_MS);
  } catch {
    if (urgentTestPushStatus) {
      urgentTestPushStatus.textContent = "Urgent test failed";
    }
    showToast("Urgent test failed", "The browser could not show the urgent notification.", TOAST_DURATION_MS);
  } finally {
    window.setTimeout(() => {
      if (toggle) {
        toggle.setAttribute("aria-checked", "false");
        toggle.disabled = false;
      }
      const nextUrgentTestPushStatus = document.querySelector("#urgent-test-push-status");
      if (nextUrgentTestPushStatus) {
        nextUrgentTestPushStatus.textContent = previousStatus;
      }
    }, 1500);
  }
}

export function startAlertClaimLoop() {
  window.setInterval(() => {
    void claimAlerts();
  }, _getAlertClaimIntervalMs());
}

export async function claimAlerts() {
  if (_isDemoRuntimeMode()) {
    _clearDemoSyncState();
    return;
  }
  if (_isServerSyncPaused()) {
    return;
  }

  try {
    const payload = await apiFetch("/api/alerts/claim");
    _markServerSyncSuccess();
    const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];

    alerts.forEach((alert) => {
      showToast("Task prompt", alert.text, TOAST_DURATION_MS);
    });
  } catch {
    _markServerSyncFailure();
    syncSyncStatusUi(_getSyncUiState());
  }
}

export async function syncPushSubscription() {
  const subscription = await loadPushSubscription(
    _getServiceWorkerRegistration(),
    _getPushSupported()
  );
  _setPushSubscription(subscription);
  if (subscription) {
    await registerServerPushSubscription(subscription);
  }
  await syncServerAlertSettings({ silent: true });
  _syncUI();
}

export async function syncServerAlertSettings({ silent = false } = {}) {
  const alertState = _getAlertState();
  const results = await Promise.allSettled([
    syncServerAlertSetting("/api/alerts/toggle", alertState.enabled),
    syncServerAlertSetting("/api/alerts/test-push-toggle", alertState.testPushEnabled),
  ]);
  const synced = results.every((result) => result.status === "fulfilled" && result.value === true);
  if (!synced && !silent) {
    showToast("Notifications offline", "Local settings were saved, but the server scheduler could not be updated.", TOAST_DURATION_MS);
  }
  return synced;
}

async function registerServerPushSubscription(pushSubscription) {
  try {
    await apiFetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: pushSubscription.toJSON() })
    });
    _markServerSyncSuccess();
    return true;
  } catch {
    _markServerSyncFailure();
    syncSyncStatusUi(_getSyncUiState());
    return false;
  }
}

async function syncServerAlertSetting(url, enabled, { throwOnError = false } = {}) {
  try {
    await apiFetch(url, {
      method: "POST",
      body: JSON.stringify({ enabled: Boolean(enabled) })
    });
    _markServerSyncSuccess();
    return true;
  } catch (error) {
    _markServerSyncFailure();
    syncSyncStatusUi(_getSyncUiState());
    if (throwOnError) {
      throw error;
    }
    return false;
  }
}
