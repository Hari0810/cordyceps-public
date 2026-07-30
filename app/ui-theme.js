/**
 * UI Theme — state ownership, loaders, and setters.
 *
 * Owns all UI theme/appearance state as ES module live bindings. App.js reads
 * them directly (live binding) for `initializeShell` and backup sections, and
 * calls the exported setters to update them.
 *
 * No callback injection is needed — the only external dependency is
 * `applyUiTheme` from ../ui/theme.js, which is a pure DOM-mutating function.
 *
 * Dependencies: applyUiTheme — ../ui/theme.js
 */

import { applyUiTheme } from "../ui/theme.js";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

export const UI_THEME_STORAGE_KEY = "today.todo.ui-theme.v1";
export const UI_MODE_STORAGE_KEY = "today.todo.ui-mode.v1";
export const UI_ACCENT_STORAGE_KEY = "today.todo.ui-accent.v1";
export const UI_FONT_STORAGE_KEY = "today.todo.ui-font.v1";
export const UI_GLASS_STORAGE_KEY = "today.todo.ui-glass.v1";
export const CORDYCEPS_UNDERLAY_STORAGE_KEY = "today.todo.cordyceps-underlay.v1";
export const UI_CUSTOM_BACKGROUND_STORAGE_KEY = "today.todo.ui-custom-background.v1";
export const UI_CUSTOM_TRANSPARENCY_STORAGE_KEY = "today.todo.ui-custom-transparency.v1";
export const UI_CUSTOM_CARD_TRANSPARENCY_STORAGE_KEY = "today.todo.ui-custom-card-transparency.v1";

// ---------------------------------------------------------------------------
// Defaults and value sets
// ---------------------------------------------------------------------------

export const DEFAULT_UI_CUSTOM_BACKGROUND =
  "https://w0.peakpx.com/wallpaper/104/235/HD-wallpaper-night-city-building-cyberpunk-sci-fi-futuristic.jpg";
export const DEFAULT_UI_CUSTOM_TRANSPARENCY = 72;
export const DEFAULT_UI_CUSTOM_CARD_TRANSPARENCY = 72;
export const MAX_UI_CUSTOM_TRANSPARENCY = 140;

export const UI_THEMES = new Set(["apple", "cybrland"]);
export const UI_FONTS = new Set(["rounded", "system", "glass", "serif", "mono"]);
export const UI_MODES = new Set(["light", "dark", "translucence", "translucence-2", "translucence-custom"]);
export const DISABLED_UI_MODES = new Set(["light", "translucence-custom"]);
export const UI_ACCENTS = new Set([
  "mint",
  "aqua",
  "sunset",
  "violet",
  "bloodmoon",
  "lime",
  "fuchsia",
  "ion",
  "solar",
  "hyperred",
  "tropic",
  "arcade",
  "aurora",
  "candy",
  "prism",
  "obsidian",
  "dracula",
  "winter"
]);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function defaultUiModeForTheme(theme) {
  return theme === "cybrland" ? "translucence-2" : "dark";
}

export function isSelectableUiMode(mode) {
  return UI_MODES.has(mode) && !DISABLED_UI_MODES.has(mode);
}

// ---------------------------------------------------------------------------
// Loaders (pure — read localStorage, no side effects)
// ---------------------------------------------------------------------------

export function loadUiTheme() {
  const storedTheme = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
  return UI_THEMES.has(storedTheme) ? storedTheme : "cybrland";
}

export function loadUiMode(theme) {
  const storedMode = window.localStorage.getItem(UI_MODE_STORAGE_KEY);
  if (isSelectableUiMode(storedMode)) {
    return storedMode;
  }
  return defaultUiModeForTheme(theme);
}

export function loadUiAccent() {
  const storedAccent = window.localStorage.getItem(UI_ACCENT_STORAGE_KEY);
  return UI_ACCENTS.has(storedAccent) ? storedAccent : "mint";
}

export function loadUiFont() {
  const storedFont = window.localStorage.getItem(UI_FONT_STORAGE_KEY);
  return UI_FONTS.has(storedFont) ? storedFont : "serif";
}

export function loadLiquidGlassEnabled() {
  return window.localStorage.getItem(UI_GLASS_STORAGE_KEY) !== "off";
}

export function loadCordycepsUnderlayEnabled() {
  return window.localStorage.getItem(CORDYCEPS_UNDERLAY_STORAGE_KEY) === "on";
}

export function loadUiCustomBackground() {
  return String(
    window.localStorage.getItem(UI_CUSTOM_BACKGROUND_STORAGE_KEY) || DEFAULT_UI_CUSTOM_BACKGROUND
  ).trim();
}

export function loadUiCustomTransparency() {
  const storedValue = Number.parseInt(
    window.localStorage.getItem(UI_CUSTOM_TRANSPARENCY_STORAGE_KEY) || String(DEFAULT_UI_CUSTOM_TRANSPARENCY),
    10
  );
  if (!Number.isFinite(storedValue)) {
    return DEFAULT_UI_CUSTOM_TRANSPARENCY;
  }
  return Math.max(0, Math.min(MAX_UI_CUSTOM_TRANSPARENCY, storedValue));
}

export function loadUiCustomCardTransparency() {
  const storedValue = Number.parseInt(
    window.localStorage.getItem(UI_CUSTOM_CARD_TRANSPARENCY_STORAGE_KEY) || String(DEFAULT_UI_CUSTOM_CARD_TRANSPARENCY),
    10
  );
  if (!Number.isFinite(storedValue)) {
    return DEFAULT_UI_CUSTOM_CARD_TRANSPARENCY;
  }
  return Math.max(0, Math.min(MAX_UI_CUSTOM_TRANSPARENCY, storedValue));
}

// ---------------------------------------------------------------------------
// Mutable state — live bindings owned by this module
// ---------------------------------------------------------------------------

export let uiTheme = loadUiTheme();
export let uiMode = loadUiMode(uiTheme);
export let uiAccent = loadUiAccent();
export let uiFont = loadUiFont();
export let liquidGlassEnabled = loadLiquidGlassEnabled();
export let cordycepsUnderlayEnabled = loadCordycepsUnderlayEnabled();
export let uiCustomBackground = loadUiCustomBackground();
export let uiCustomTransparency = loadUiCustomTransparency();
export let uiCustomCardTransparency = loadUiCustomCardTransparency();

// Internal — tracks whether the user has ever explicitly chosen a mode.
// Used by setUiTheme to decide whether to reset the mode on theme change.
let hasExplicitUiMode = window.localStorage.getItem(UI_MODE_STORAGE_KEY) !== null;

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function reapplyTheme() {
  applyUiTheme(
    uiTheme,
    uiAccent,
    uiMode,
    liquidGlassEnabled,
    uiCustomBackground,
    uiCustomTransparency,
    uiCustomCardTransparency,
    uiFont,
    cordycepsUnderlayEnabled
  );
}

// ---------------------------------------------------------------------------
// Setters
// ---------------------------------------------------------------------------

export function setUiTheme(nextTheme) {
  uiTheme = nextTheme;
  window.localStorage.setItem(UI_THEME_STORAGE_KEY, uiTheme);
  if (!hasExplicitUiMode) {
    uiMode = defaultUiModeForTheme(uiTheme);
  }
  reapplyTheme();
}

export function setUiAccent(nextAccent) {
  uiAccent = nextAccent;
  window.localStorage.setItem(UI_ACCENT_STORAGE_KEY, uiAccent);
  reapplyTheme();
}

export function selectUiAccent(nextAccent) {
  if (!UI_ACCENTS.has(nextAccent) || (nextAccent === uiAccent && uiTheme === "cybrland")) {
    return;
  }
  if (uiTheme !== "cybrland") {
    setUiTheme("cybrland");
  }
  setUiAccent(nextAccent);
}

export function setUiFont(nextFont) {
  uiFont = UI_FONTS.has(nextFont) ? nextFont : "serif";
  window.localStorage.setItem(UI_FONT_STORAGE_KEY, uiFont);
  reapplyTheme();
}

export function setUiMode(nextMode) {
  if (!isSelectableUiMode(nextMode)) {
    return;
  }
  uiMode = nextMode;
  hasExplicitUiMode = true;
  window.localStorage.setItem(UI_MODE_STORAGE_KEY, uiMode);
  reapplyTheme();
}

export function setLiquidGlassEnabled(nextValue) {
  liquidGlassEnabled = Boolean(nextValue);
  window.localStorage.setItem(UI_GLASS_STORAGE_KEY, liquidGlassEnabled ? "on" : "off");
  reapplyTheme();
}

export function setCordycepsUnderlayEnabled(nextValue) {
  cordycepsUnderlayEnabled = Boolean(nextValue);
  window.localStorage.setItem(CORDYCEPS_UNDERLAY_STORAGE_KEY, cordycepsUnderlayEnabled ? "on" : "off");
  reapplyTheme();
}

export function setUiCustomBackground(nextValue) {
  uiCustomBackground = String(nextValue || "").trim();
  if (uiCustomBackground) {
    window.localStorage.setItem(UI_CUSTOM_BACKGROUND_STORAGE_KEY, uiCustomBackground);
  } else {
    window.localStorage.removeItem(UI_CUSTOM_BACKGROUND_STORAGE_KEY);
  }
  reapplyTheme();
}

export function setUiCustomTransparency(nextValue) {
  const numericValue = Number.parseInt(String(nextValue || ""), 10);
  uiCustomTransparency = Number.isFinite(numericValue)
    ? Math.max(0, Math.min(MAX_UI_CUSTOM_TRANSPARENCY, numericValue))
    : DEFAULT_UI_CUSTOM_TRANSPARENCY;
  window.localStorage.setItem(UI_CUSTOM_TRANSPARENCY_STORAGE_KEY, String(uiCustomTransparency));
  reapplyTheme();
}

export function setUiCustomCardTransparency(nextValue) {
  const numericValue = Number.parseInt(String(nextValue || ""), 10);
  uiCustomCardTransparency = Number.isFinite(numericValue)
    ? Math.max(0, Math.min(MAX_UI_CUSTOM_TRANSPARENCY, numericValue))
    : DEFAULT_UI_CUSTOM_CARD_TRANSPARENCY;
  window.localStorage.setItem(UI_CUSTOM_CARD_TRANSPARENCY_STORAGE_KEY, String(uiCustomCardTransparency));
  reapplyTheme();
}
