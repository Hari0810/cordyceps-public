/**
 * Backup import/export handlers.
 *
 * App.js-owned dependencies are injected via `bindBackupIoCallbacks`.
 *
 * Dependencies (direct imports):
 *   showToast                                         — ../modules/ui.js
 *   collectBackupManifest, downloadBackupManifest,
 *   describeBackupManifest, readBackupFile,
 *   restoreBackupManifest                             — ./backup.js
 *   setBackupStatus                                   — ./backup-helpers.js
 *   exportAppBackupButton, importAppBackupButton,
 *   importAppBackupFileInput                          — ../modules/dom.js
 */

import { showToast } from "../modules/ui.js";
import {
  collectBackupManifest,
  describeBackupManifest,
  downloadBackupManifest,
  readBackupFile,
  restoreBackupManifest,
} from "./backup.js";
import { setBackupStatus } from "./backup-helpers.js";
import {
  exportAppBackupButton,
  importAppBackupButton,
  importAppBackupFileInput,
} from "../modules/dom.js";
import { getLocalWorkspace } from "../modules/storage-scope.js";

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

const TOAST_DURATION_MS = 5000;
const EXPORT_BACKUP_BUTTON_SELECTOR = "#export-app-backup";
const IMPORT_BACKUP_BUTTON_SELECTOR = "#import-app-backup";
const IMPORT_BACKUP_FILE_SELECTOR = "#import-app-backup-file";

function findElement(selector, fallback) {
  return fallback?.isConnected ? fallback : document.querySelector(selector);
}

function getExportBackupButton() {
  return findElement(EXPORT_BACKUP_BUTTON_SELECTOR, exportAppBackupButton);
}

function getImportBackupButton() {
  return findElement(IMPORT_BACKUP_BUTTON_SELECTOR, importAppBackupButton);
}

function getImportBackupFileInput() {
  return findElement(IMPORT_BACKUP_FILE_SELECTOR, importAppBackupFileInput);
}

function formatBackupTimestamp(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getVaultBridge() {
  const vault = window.__cityVault;
  if (!vault?.encrypt || !vault?.decrypt) {
    throw new Error("Local backup tools are unavailable in this browser.");
  }
  return vault;
}

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _getAppVersion = () => "";
let _getBackupRegistry = () => [];
let _resetMutationState = () => {};
let _syncUI = () => {};

/**
 * Inject app.js-owned dependencies. Must be called once at boot.
 *
 * @param {object} callbacks
 * @param {() => string}         callbacks.getAppVersion
 * @param {() => Array}          callbacks.getBackupRegistry
 * @param {() => void}           callbacks.resetMutationState
 * @param {() => void}           callbacks.syncUI
 */
export function bindBackupIoCallbacks(callbacks) {
  _getAppVersion = callbacks.getAppVersion ?? _getAppVersion;
  _getBackupRegistry = callbacks.getBackupRegistry ?? _getBackupRegistry;
  _resetMutationState = callbacks.resetMutationState ?? _resetMutationState;
  _syncUI = callbacks.syncUI ?? _syncUI;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleBackupExport() {
  const exportButton = getExportBackupButton();
  if (exportButton) {
    exportButton.disabled = true;
  }

  setBackupStatus("Preparing backup...");

  try {
    const manifest = await collectBackupManifest({
      appVersion: _getAppVersion(),
      adapters: _getBackupRegistry(),
      metadata: {
        workspaceId: getLocalWorkspace().workspaceId,
        portability: "manual-export",
        encryptedByDefault: false,
      }
    });
    const vault = getVaultBridge();
    const vaultStatus = typeof vault.status === "function" ? vault.status() : null;
    const encryptor =
      vaultStatus?.protectionEnabled === true && typeof vault.encrypt === "function"
        ? vault.encrypt
        : undefined;
    await downloadBackupManifest(manifest, {
      prefix: "cordyceps-backup",
      encryptor,
    });
    const summary = describeBackupManifest(manifest);
    setBackupStatus(`Backup exported with ${summary.sectionKeys.length} sections on ${formatBackupTimestamp(summary.exportedAt) || "just now"}.`);
    showToast("Backup exported", "Backup downloaded.", TOAST_DURATION_MS);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The backup could not be created.";
    setBackupStatus(message);
    showToast("Backup failed", message, TOAST_DURATION_MS);
  } finally {
    if (exportButton) {
      exportButton.disabled = false;
    }
  }
}

export async function handleBackupFileSelection(event) {
  const input = event.target instanceof HTMLInputElement ? event.target : getImportBackupFileInput();
  const file = input?.files?.[0] || null;
  if (!file) {
    return;
  }

  const importButton = getImportBackupButton();
  if (importButton) {
    importButton.disabled = true;
  }

  setBackupStatus(`Reading ${file.name}...`);

  try {
    const vault = getVaultBridge();
    const manifest = await readBackupFile(file, {
      decryptor: vault.decrypt
    });
    const summary = describeBackupManifest(manifest);
    const confirmed = window.confirm(
      [
        "Restore this backup?",
        `Exported: ${summary.exportedAt}`,
        `Sections: ${summary.sectionKeys.join(", ") || "none"}`,
        "",
        "This will replace current app-managed data.",
        "Vault secrets, app-lock credentials, and downloaded offline model files are not included."
      ].join("\n")
    );

    if (!confirmed) {
      setBackupStatus("Backup restore cancelled.");
      return;
    }

    setBackupStatus("Restoring backup...");
    _resetMutationState();

    const result = await restoreBackupManifest({
      manifest,
      adapters: _getBackupRegistry()
    });

    _syncUI();

    const errorsLabel = result.errors.length > 0
      ? ` ${result.errors.length} section${result.errors.length === 1 ? "" : "s"} failed.`
      : "";
    setBackupStatus(`Backup restored.${errorsLabel}`);

    if (result.errors.length > 0) {
      showToast("Backup restored with issues", result.errors.map((entry) => `${entry.sectionKey}: ${entry.message}`).join(" "), TOAST_DURATION_MS);
    } else {
      showToast("Backup restored", "Reloading the app to apply all restored data.", TOAST_DURATION_MS);
    }

    window.setTimeout(() => {
      window.location.reload();
    }, 450);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The backup file could not be restored.";
    setBackupStatus(message);
    showToast("Restore failed", message, TOAST_DURATION_MS);
  } finally {
    if (input) {
      input.value = "";
    }
    if (importButton) {
      importButton.disabled = false;
    }
  }
}
