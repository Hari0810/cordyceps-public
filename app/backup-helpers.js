/**
 * Backup helper utilities — status display, section builders/restorers.
 *
 * App.js-owned dependencies are injected via `bindBackupHelperCallbacks`.
 *
 * Dependencies (direct imports):
 *   normalizeState                                    — ../modules/state.js
 *   blobToBase64Payload, base64PayloadToBlob          — ./backup.js
 *   persistMonzoLocalState                            — ./monzo-local-state.js
 *   UI_THEMES, UI_ACCENTS, UI_FONTS, isSelectableUiMode, defaultUiModeForTheme,
 *   setUiTheme, setUiAccent, setUiFont, setUiMode, setLiquidGlassEnabled,
 *   setCordycepsUnderlayEnabled,
 *   setUiCustomBackground, setUiCustomTransparency, setUiCustomCardTransparency,
 *   DEFAULT_UI_CUSTOM_BACKGROUND, DEFAULT_UI_CUSTOM_TRANSPARENCY,
 *   DEFAULT_UI_CUSTOM_CARD_TRANSPARENCY                — ./ui-theme.js
 *   backupImportExportStatus                          — ../modules/dom.js
 */

import { normalizeState } from "../modules/state.js";
import { blobToBase64Payload, base64PayloadToBlob } from "./backup.js";
import { persistMonzoLocalState } from "./monzo-local-state.js";
import {
  DEFAULT_UI_CUSTOM_BACKGROUND,
  DEFAULT_UI_CUSTOM_CARD_TRANSPARENCY,
  DEFAULT_UI_CUSTOM_TRANSPARENCY,
  defaultUiModeForTheme,
  isSelectableUiMode,
  setCordycepsUnderlayEnabled,
  setLiquidGlassEnabled,
  setUiAccent,
  setUiCustomBackground,
  setUiCustomCardTransparency,
  setUiCustomTransparency,
  setUiFont,
  setUiMode,
  setUiTheme,
  UI_ACCENTS,
  UI_FONTS,
  UI_THEMES,
} from "./ui-theme.js";
import { backupImportExportStatus } from "../modules/dom.js";

const BACKUP_STATUS_SELECTOR = "#backup-import-export-status";

function getBackupStatusElement() {
  return backupImportExportStatus?.isConnected
    ? backupImportExportStatus
    : document.querySelector(BACKUP_STATUS_SELECTOR);
}

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _getTodos = () => [];
let _getAlertState = () => ({});
let _getOutlookState = () => ({});
let _getMonzoState = () => ({});
let _getBooksFeature = () => ({});
let _getMonzoView = () => "list";
let _setMonzoView = () => {};
let _setMonzoExpenses = () => {};

/**
 * Inject app.js-owned dependencies. Must be called once at boot.
 *
 * @param {object} callbacks
 */
export function bindBackupHelperCallbacks(callbacks) {
  _getTodos = callbacks.getTodos ?? _getTodos;
  _getAlertState = callbacks.getAlertState ?? _getAlertState;
  _getOutlookState = callbacks.getOutlookState ?? _getOutlookState;
  _getMonzoState = callbacks.getMonzoState ?? _getMonzoState;
  _getBooksFeature = callbacks.getBooksFeature ?? _getBooksFeature;
  _getMonzoView = callbacks.getMonzoView ?? _getMonzoView;
  _setMonzoView = callbacks.setMonzoView ?? _setMonzoView;
  _setMonzoExpenses = callbacks.setMonzoExpenses ?? _setMonzoExpenses;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function setBackupStatus(message) {
  const statusElement = getBackupStatusElement();
  if (statusElement) {
    statusElement.textContent = message;
  }
}

export function buildServerBackupSection() {
  const todos = _getTodos();
  return normalizeState({
    tasks: Array.isArray(todos) ? todos.map((task) => ({ ...task })) : [],
    alerts: { ..._getAlertState() },
    outlook: { ..._getOutlookState() },
    monzo: { ..._getMonzoState() }
  });
}

export async function collectBooksBackupSection() {
  const booksFeature = _getBooksFeature();
  const snapshot = booksFeature.getBackupSnapshot ? booksFeature.getBackupSnapshot() : { activeBookId: "", books: [] };
  const books = [];
  for (const book of Array.isArray(snapshot.books) ? snapshot.books : []) {
    books.push({
      ...book,
      readerState: book.readerState && typeof book.readerState === "object" ? { ...book.readerState } : {},
      blob: await blobToBase64Payload(book.blob)
    });
  }

  return {
    activeBookId: typeof snapshot.activeBookId === "string" ? snapshot.activeBookId : "",
    books
  };
}

export function decodeBooksBackupSection(section) {
  const payload = section && typeof section === "object" ? section : {};
  return {
    activeBookId: typeof payload.activeBookId === "string" ? payload.activeBookId : "",
    books: Array.isArray(payload.books)
      ? payload.books.map((book) => ({
        ...book,
        blob: base64PayloadToBlob(book?.blob)
      }))
      : []
  };
}

export function restoreMonzoLocalBackupSection(section) {
  const payload = section && typeof section === "object" ? section : {};
  const nextView = typeof payload.view === "string" ? payload.view : "list";
  _setMonzoView(["list", "weekly", "type", "big"].includes(nextView) ? nextView : "list");
  _setMonzoExpenses(Array.isArray(payload.expenses) ? payload.expenses : []);
  persistMonzoLocalState();
}

export function restoreUiBackupSection(section) {
  const payload = section && typeof section === "object" ? section : {};
  const nextTheme = UI_THEMES.has(payload.uiTheme) ? payload.uiTheme : "cybrland";
  const nextAccent = UI_ACCENTS.has(payload.uiAccent) ? payload.uiAccent : "mint";
  const nextFont = UI_FONTS.has(payload.uiFont) ? payload.uiFont : "rounded";
  const nextMode = isSelectableUiMode(payload.uiMode) ? payload.uiMode : defaultUiModeForTheme(nextTheme);

  setUiTheme(nextTheme);
  setUiAccent(nextAccent);
  setUiFont(nextFont);
  setUiMode(nextMode);
  setLiquidGlassEnabled(payload.liquidGlassEnabled === true);
  setCordycepsUnderlayEnabled(payload.cordycepsUnderlayEnabled === true);
  setUiCustomBackground(typeof payload.uiCustomBackground === "string" ? payload.uiCustomBackground : DEFAULT_UI_CUSTOM_BACKGROUND);
  setUiCustomTransparency(payload.uiCustomTransparency);
  setUiCustomCardTransparency(payload.uiCustomCardTransparency);
}
