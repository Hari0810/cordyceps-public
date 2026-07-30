/**
 * Monzo settings handlers — save token/account, refresh expenses.
 *
 * App.js-owned dependencies are injected via `bindMonzoSettingsCallbacks`.
 *
 * Dependencies (direct imports):
 *   apiFetch                                          — ../modules/api.js
 *   showToast                                         — ../modules/ui.js
 *   monzoAccessTokenInput, monzoAccountIdInput,
 *   saveMonzoSettingsButton, refreshMonzoExpensesButton — ../modules/dom.js
 */

import { apiFetch } from "../modules/api.js";
import { showToast } from "../modules/ui.js";
import {
  monzoAccessTokenInput,
  monzoAccountIdInput,
  saveMonzoSettingsButton,
  refreshMonzoExpensesButton,
  trueLayerConnectButtons,
} from "../modules/dom.js";

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

const TOAST_DURATION_MS = 5000;
const TRUELAYER_OAUTH_STATE_KEY = "cordyceps.truelayer.oauth.state.v1";
const TRUELAYER_REDIRECT_URI_KEY = "cordyceps.truelayer.redirect-uri.v1";

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _getMonzoState = () => ({});
let _setMonzoState = () => {};
let _getMonzoExpenses = () => [];
let _setMonzoExpenses = () => {};
let _setServerState = async () => {};
let _syncUI = () => {};

function rememberTrueLayerOAuth(payload) {
  try {
    if (payload?.state) {
      window.sessionStorage.setItem(TRUELAYER_OAUTH_STATE_KEY, String(payload.state));
    }
    if (payload?.redirectUri) {
      window.sessionStorage.setItem(TRUELAYER_REDIRECT_URI_KEY, String(payload.redirectUri));
    }
  } catch {}
}

function consumeRememberedTrueLayerOAuth() {
  try {
    const state = window.sessionStorage.getItem(TRUELAYER_OAUTH_STATE_KEY) || "";
    const redirectUri = window.sessionStorage.getItem(TRUELAYER_REDIRECT_URI_KEY) || "";
    window.sessionStorage.removeItem(TRUELAYER_OAUTH_STATE_KEY);
    window.sessionStorage.removeItem(TRUELAYER_REDIRECT_URI_KEY);
    return { state, redirectUri };
  } catch {
    return { state: "", redirectUri: "" };
  }
}

function tokenExpiresAt(payload) {
  const expiresIn = Number(payload?.expires_in || 3600);
  const seconds = Number.isFinite(expiresIn) ? Math.max(60, expiresIn) : 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function tokenScopes(payload) {
  const rawScopes = payload?.scope || payload?.scopes || "";
  if (Array.isArray(rawScopes)) {
    return rawScopes.map((scope) => String(scope || "").trim()).filter(Boolean);
  }
  return String(rawScopes || "").split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
}

async function finishTrueLayerConnection(params) {
  const code = params.get("banking_code") || "";
  const returnedState = params.get("banking_state") || "";
  const remembered = consumeRememberedTrueLayerOAuth();
  if (!code || !returnedState || !remembered.redirectUri || remembered.state !== returnedState) {
    showToast("TrueLayer could not finish", "The banking connection state did not match this session.", TOAST_DURATION_MS);
    return;
  }

  try {
    const tokenPayload = await apiFetch("/api/integrations/monzo/truelayer/token", {
      method: "POST",
      body: JSON.stringify({
        grantType: "authorization_code",
        code,
        redirectUri: remembered.redirectUri
      })
    });
    const accessToken = String(tokenPayload?.access_token || "").trim();
    const refreshToken = String(tokenPayload?.refresh_token || "").trim();
    if (!accessToken || !refreshToken) {
      throw new Error("TrueLayer did not return the expected local tokens.");
    }
    const accountPayload = await apiFetch("/api/integrations/monzo/truelayer/account", {
      method: "POST",
      body: JSON.stringify({ accessToken })
    });
    const nextMonzo = {
      ..._getMonzoState(),
      ...(accountPayload?.monzo && typeof accountPayload.monzo === "object" ? accountPayload.monzo : {}),
      accessToken,
      refreshToken,
      tokenType: String(tokenPayload?.token_type || "Bearer"),
      tokenExpiresAt: tokenExpiresAt(tokenPayload),
      redirectUri: remembered.redirectUri,
      scopes: tokenScopes(tokenPayload),
      consentExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      configured: true
    };
    _setMonzoState(nextMonzo);
    _setMonzoExpenses([]);
    _syncUI();
    showToast("Monzo connected", "TrueLayer tokens are stored in the encrypted local vault.", TOAST_DURATION_MS);
    await refreshMonzoExpenses({ silent: true });
  } catch (error) {
    const message = error?.payload?.error || error?.message || "The TrueLayer connection could not be completed.";
    showToast("TrueLayer unavailable", message, TOAST_DURATION_MS);
  }
}

async function ensureFreshMonzoConnection(monzoState) {
  if (monzoState?.connectionProvider !== "truelayer") {
    return monzoState;
  }
  const expiresAt = Date.parse(monzoState.tokenExpiresAt || "");
  if (monzoState.accessToken && (!Number.isFinite(expiresAt) || expiresAt > Date.now() + 90_000)) {
    return monzoState;
  }
  if (!monzoState.refreshToken) {
    return monzoState;
  }
  const tokenPayload = await apiFetch("/api/integrations/monzo/truelayer/token", {
    method: "POST",
    body: JSON.stringify({
      grantType: "refresh_token",
      refreshToken: monzoState.refreshToken
    })
  });
  const nextMonzo = {
    ...monzoState,
    accessToken: String(tokenPayload?.access_token || "").trim() || monzoState.accessToken,
    refreshToken: String(tokenPayload?.refresh_token || "").trim() || monzoState.refreshToken,
    tokenType: String(tokenPayload?.token_type || monzoState.tokenType || "Bearer"),
    tokenExpiresAt: tokenExpiresAt(tokenPayload),
    scopes: tokenScopes(tokenPayload).length ? tokenScopes(tokenPayload) : monzoState.scopes
  };
  _setMonzoState(nextMonzo);
  return nextMonzo;
}

/**
 * Inject app.js-owned dependencies. Must be called once at boot.
 *
 * @param {object} callbacks
 * @param {() => object}              callbacks.getMonzoState
 * @param {(next: object) => void}    callbacks.setMonzoState
 * @param {() => Array}               callbacks.getMonzoExpenses
 * @param {(next: Array) => void}     callbacks.setMonzoExpenses
 * @param {(state: object) => void}   callbacks.setServerState
 * @param {() => void}                callbacks.syncUI
 */
export function bindMonzoSettingsCallbacks(callbacks) {
  _getMonzoState = callbacks.getMonzoState ?? _getMonzoState;
  _setMonzoState = callbacks.setMonzoState ?? _setMonzoState;
  _getMonzoExpenses = callbacks.getMonzoExpenses ?? _getMonzoExpenses;
  _setMonzoExpenses = callbacks.setMonzoExpenses ?? _setMonzoExpenses;
  _setServerState = callbacks.setServerState ?? _setServerState;
  _syncUI = callbacks.syncUI ?? _syncUI;
}

export function consumeBankingStartupStatus() {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const bankingStatus = params.get("banking");
  const bankingError = params.get("banking_error");
  if (!bankingStatus && !bankingError) {
    return;
  }

  if (bankingStatus === "truelayer_connected") {
    showToast(
      "Monzo connected",
      "TrueLayer is connected. Loading recent spending now.",
      TOAST_DURATION_MS
    );
    refreshMonzoExpenses({ silent: true });
  } else if (bankingStatus === "truelayer_authorized") {
    showToast(
      "Monzo approved",
      "TrueLayer returned successfully. Finishing local token storage now.",
      TOAST_DURATION_MS
    );
    void finishTrueLayerConnection(params);
  } else if (bankingStatus === "enable_banking_connected") {
    showToast(
      "Bank connected",
      "Enable Banking is connected. Syncing recent spending now.",
      TOAST_DURATION_MS
    );
    refreshMonzoExpenses({ silent: true, force: true });
  } else if (bankingError) {
    showToast("Banking returned an error", bankingError, TOAST_DURATION_MS);
  }

  params.delete("banking");
  params.delete("banking_error");
  params.delete("banking_code");
  params.delete("banking_state");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleMonzoSettingsSave() {
  const accessToken = monzoAccessTokenInput?.value.trim() || "";
  const accountId = monzoAccountIdInput?.value.trim() || "";

  if (!accessToken) {
    showToast("Monzo token needed", "Enter a Monzo access token first.", TOAST_DURATION_MS);
    return;
  }

  if (saveMonzoSettingsButton) {
    saveMonzoSettingsButton.disabled = true;
  }

  try {
    const payload = await apiFetch("/api/monzo/settings", {
      method: "POST",
      body: JSON.stringify({
        accessToken,
        accountId: accountId || null
      })
    });
    _setMonzoState({
      ..._getMonzoState(),
      ...(payload?.monzo && typeof payload.monzo === "object" ? payload.monzo : {}),
      accessToken,
      refreshToken: "",
      tokenType: "Bearer",
      tokenExpiresAt: null,
      configured: true
    });
    _setMonzoExpenses([]);
    if (monzoAccessTokenInput) {
      monzoAccessTokenInput.value = "";
    }
    showToast("Monzo connected", "Your Monzo account is ready for recent expense loading in this helper session.", TOAST_DURATION_MS);
    await refreshMonzoExpenses({ silent: true });
  } catch {
    showToast("Monzo unavailable", "The Monzo token or account could not be verified.", TOAST_DURATION_MS);
  } finally {
    if (saveMonzoSettingsButton) {
      saveMonzoSettingsButton.disabled = false;
    }
  }
}

export async function handleTrueLayerMonzoConnect() {
  trueLayerConnectButtons.forEach((button) => {
    button.disabled = true;
  });

  try {
    const payload = await apiFetch("/api/banking/truelayer/start", {
      method: "POST",
      body: JSON.stringify({ provider: "monzo" })
    });
    const authUrl = typeof payload?.authUrl === "string" ? payload.authUrl : "";
    if (!authUrl) {
      throw new Error("TrueLayer did not return an authentication link.");
    }
    rememberTrueLayerOAuth(payload);
    showToast("Opening TrueLayer", "Approve read-only Monzo access, then you will return to Cordyceps.", TOAST_DURATION_MS);
    window.location.assign(authUrl);
  } catch (error) {
    const message =
      error?.payload?.error ||
      error?.message ||
      "TrueLayer could not be started. Check the server configuration.";
    showToast("TrueLayer unavailable", message, TOAST_DURATION_MS);
  } finally {
    trueLayerConnectButtons.forEach((button) => {
      button.disabled = false;
    });
  }
}

export async function handleEnableBankingInstitutionLoad() {
  const countrySelect = document.querySelector("#banking-country-select");
  const institutionSelect = document.querySelector("#banking-institution-select");
  const loadButton = document.querySelector("#banking-load-institutions");
  const country = countrySelect?.value || "gb";
  if (loadButton) {
    loadButton.disabled = true;
  }
  try {
    const payload = await apiFetch("/api/banking/enable/institutions", {
      method: "POST",
      body: JSON.stringify({ country })
    });
    const institutions = Array.isArray(payload?.institutions) ? payload.institutions : [];
    if (institutionSelect) {
      institutionSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = institutions.length ? "Choose a bank" : "No banks returned";
      institutionSelect.append(placeholder);
      institutions.forEach((institution) => {
        const option = document.createElement("option");
        option.value = String(institution.id || "");
        option.textContent = String(institution.name || institution.id || "Bank");
        option.dataset.institutionName = String(institution.name || "");
        institutionSelect.append(option);
      });
    }
    showToast("Banks loaded", `Found ${institutions.length} supported banks.`, TOAST_DURATION_MS);
  } catch (error) {
    const message =
      error?.payload?.error ||
      error?.message ||
      "Set ENABLE_BANKING_APP_ID and an Enable Banking private key on the server to enable bank sync.";
    showToast("Enable Banking setup needed", message, TOAST_DURATION_MS);
  } finally {
    if (loadButton) {
      loadButton.disabled = false;
    }
  }
}

export async function handleEnableBankingConnect() {
  const institutionSelect = document.querySelector("#banking-institution-select");
  const connectButtons = document.querySelectorAll("[data-enable-banking-connect]");
  const institutionId = institutionSelect?.value || "";
  const selectedOption = institutionSelect?.selectedOptions?.[0];
  const institutionName = selectedOption?.dataset?.institutionName || selectedOption?.textContent || "";
  const countrySelect = document.querySelector("#banking-country-select");
  const aspspCountry = countrySelect?.value || "gb";
  if (!institutionId) {
    showToast("Choose a bank", "Load banks and choose one before connecting.", TOAST_DURATION_MS);
    return;
  }
  connectButtons.forEach((button) => {
    button.disabled = true;
  });
  try {
    const payload = await apiFetch("/api/banking/enable/start", {
      method: "POST",
      body: JSON.stringify({ institutionId, institutionName, aspspName: institutionName || institutionId, aspspCountry })
    });
    const authUrl = typeof payload?.authUrl === "string" ? payload.authUrl : "";
    if (!authUrl) {
      throw new Error("Enable Banking did not return an authentication link.");
    }
    showToast("Opening bank login", "Approve read-only access, then you will return to Cordyceps.", TOAST_DURATION_MS);
    window.location.assign(authUrl);
  } catch (error) {
    const message =
      error?.payload?.error ||
      error?.message ||
      "Set ENABLE_BANKING_APP_ID and an Enable Banking private key on the server to enable bank sync.";
    showToast("Enable Banking unavailable", message, TOAST_DURATION_MS);
  } finally {
    connectButtons.forEach((button) => {
      button.disabled = false;
    });
  }
}

export async function handleBankingCsvImport() {
  const csvInput = document.querySelector("#banking-csv-input");
  const importButton = document.querySelector("#banking-csv-import");
  const csvText = csvInput?.value || "";
  if (!csvText.trim()) {
    showToast("CSV needed", "Paste a bank CSV export first.", TOAST_DURATION_MS);
    return;
  }
  if (importButton) {
    importButton.disabled = true;
  }
  try {
    const payload = await apiFetch("/api/banking/import/csv", {
      method: "POST",
      body: JSON.stringify({ csvText })
    });
    _setMonzoExpenses(Array.isArray(payload?.expenses) ? payload.expenses : []);
    if (payload?.banking || payload?.monzo) {
      _setMonzoState({
        ..._getMonzoState(),
        ...(payload.banking || payload.monzo),
        configured: true
      });
    }
    _syncUI();
    showToast("CSV imported", `Loaded ${_getMonzoExpenses().length} transactions.`, TOAST_DURATION_MS);
  } catch (error) {
    showToast("CSV import failed", error?.payload?.error || error?.message || "The CSV could not be read.", TOAST_DURATION_MS);
  } finally {
    if (importButton) {
      importButton.disabled = false;
    }
  }
}

export async function handleBankingDisconnect() {
  try {
    const payload = await apiFetch("/api/banking/disconnect", { method: "POST" });
    _setMonzoExpenses([]);
    _setMonzoState({
      ...(payload?.banking || payload?.monzo || {}),
      accessToken: "",
      refreshToken: "",
      tokenType: "",
      tokenExpiresAt: null,
      redirectUri: "",
      configured: false
    });
    _syncUI();
    showToast("Banking disconnected", "Budget settings remain on this device.", TOAST_DURATION_MS);
  } catch (error) {
    showToast("Disconnect failed", error?.payload?.error || error?.message || "Banking could not be disconnected.", TOAST_DURATION_MS);
  }
}

export async function refreshMonzoExpenses({ silent, force = false }) {
  let monzoState = _getMonzoState();
  const provider = monzoState.provider || monzoState.connectionProvider || "";

  if (!monzoState.configured && !force) {
    if (!silent) {
      showToast("Banking not ready", "Connect read-only bank data or import CSV first.", TOAST_DURATION_MS);
    }
    return;
  }

  if (provider === "csv" && !force) {
    if (!silent) {
      showToast("CSV is loaded", "Import a newer CSV when you want to refresh spending.", TOAST_DURATION_MS);
    }
    return;
  }

  if (refreshMonzoExpensesButton) {
    refreshMonzoExpensesButton.disabled = true;
  }

  try {
    let payload;
    if (provider === "enable-banking" || force) {
      payload = await apiFetch("/api/banking/sync", { method: "POST" });
    } else {
      monzoState = await ensureFreshMonzoConnection(monzoState);
      if (!monzoState.accessToken) {
        throw new Error("Legacy banking token is missing.");
      }
      payload = await apiFetch("/api/monzo/expenses", {
        method: "POST",
        body: JSON.stringify({
          accessToken: monzoState.accessToken,
          accountId: monzoState.accountId,
          connectionProvider: monzoState.connectionProvider
        })
      });
    }
    _setMonzoExpenses(Array.isArray(payload?.expenses) ? payload.expenses : []);
    const nextBanking = payload?.banking || payload?.monzo;
    if (nextBanking) {
      _setMonzoState({
        ...monzoState,
        ...nextBanking,
        accessToken: monzoState.accessToken,
        refreshToken: monzoState.refreshToken,
        tokenType: monzoState.tokenType,
        tokenExpiresAt: monzoState.tokenExpiresAt,
        redirectUri: monzoState.redirectUri,
        scopes: monzoState.scopes,
        configured: nextBanking.configured === true
      });
    }
    _syncUI();
    if (!silent) {
      showToast("Banking synced", `Loaded ${_getMonzoExpenses().length} recent transactions.`, TOAST_DURATION_MS);
    }
  } catch (error) {
    if (!silent) {
      showToast("Banking sync failed", error?.payload?.error || error?.message || "The recent transactions could not be loaded.", TOAST_DURATION_MS);
    }
  } finally {
    if (refreshMonzoExpensesButton) {
      refreshMonzoExpensesButton.disabled = false;
    }
  }
}
