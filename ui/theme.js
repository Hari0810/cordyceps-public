import {
  accentOptionButtons,
  appleStatusBarMeta,
  clearUiCustomBackgroundButton,
  modeOptionButtons,
  fontOptionButtons,
  saveUiCustomBackgroundButton,
  themeColorMeta,
  themeOptionButtons,
  uiAccentStatus,
  uiCustomBackgroundInput,
  uiCustomBackgroundRow,
  uiCustomBackgroundStatus,
  uiCustomCardTransparencyInput,
  uiCustomCardTransparencyRow,
  uiCustomCardTransparencyStatus,
  uiCustomTransparencyInput,
  uiCustomTransparencyRow,
  uiCustomTransparencyStatus,
  uiGlassStatus,
  uiGlassToggle,
  uiFontStatus,
  uiModeStatus,
  uiThemeStatus
} from "../modules/dom.js";

const CYBRLAND_ACCENTS = {
  mint: {
    label: "Neo Mint",
    darkThemeColor: "#09171e",
    lightThemeColor: "#ebfffb"
  },
  aqua: {
    label: "Aqua Grid",
    darkThemeColor: "#081723",
    lightThemeColor: "#eef9ff"
  },
  sunset: {
    label: "Sunset",
    darkThemeColor: "#1a1210",
    lightThemeColor: "#fff3ec"
  },
  violet: {
    label: "Violet",
    darkThemeColor: "#121222",
    lightThemeColor: "#f5f1ff"
  },
  bloodmoon: {
    label: "Blood Moon",
    darkThemeColor: "#19070b",
    lightThemeColor: "#fff0f3"
  },
  lime: {
    label: "Volt Lime",
    darkThemeColor: "#081806",
    lightThemeColor: "#f2ffe8"
  },
  fuchsia: {
    label: "Hot Fuchsia",
    darkThemeColor: "#1d0717",
    lightThemeColor: "#fff0fb"
  },
  ion: {
    label: "Ion Blue",
    darkThemeColor: "#061624",
    lightThemeColor: "#eef8ff"
  },
  solar: {
    label: "Solar Yellow",
    darkThemeColor: "#171306",
    lightThemeColor: "#fffbe8"
  },
  hyperred: {
    label: "Hyper Red",
    darkThemeColor: "#1c0505",
    lightThemeColor: "#fff0ed"
  },
  tropic: {
    label: "Tropic Fuse",
    darkThemeColor: "#061915",
    lightThemeColor: "#effff4"
  },
  arcade: {
    label: "Arcade Pop",
    darkThemeColor: "#16081d",
    lightThemeColor: "#fdf1ff"
  },
  aurora: {
    label: "Aurora Pulse",
    darkThemeColor: "#071719",
    lightThemeColor: "#effffc"
  },
  candy: {
    label: "Candy Signal",
    darkThemeColor: "#1c0a10",
    lightThemeColor: "#fff3f4"
  },
  prism: {
    label: "Prism Drive",
    darkThemeColor: "#0b1020",
    lightThemeColor: "#f4f8ff"
  },
  obsidian: {
    label: "Obsidian Dusk",
    darkThemeColor: "#0b0d12",
    lightThemeColor: "#f1f4f8"
  },
  dracula: {
    label: "Dracula",
    darkThemeColor: "#171423",
    lightThemeColor: "#f7f2ff"
  },
  winter: {
    label: "Winter Is Coming",
    darkThemeColor: "#07131f",
    lightThemeColor: "#eef8ff"
  }
};

const IOS_SERIF_FONT_FAMILY = '"Lyon Text", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "EB Garamond", "Libre Baskerville", Georgia, "Times New Roman", serif';
const NON_IOS_SERIF_FONT_FAMILY = '"EB Garamond", "Lyon Text", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "Libre Baskerville", Georgia, "Times New Roman", serif';
const FONT_FAMILIES = {
  rounded: 'ui-rounded, "SF Pro Rounded", "Avenir Next", "Trebuchet MS", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
  system: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
  glass: '"Inter", "Aptos", "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: NON_IOS_SERIF_FONT_FAMILY,
  cormorant: '"Lusitana", "Iowan Old Style", "Palatino Linotype", Georgia, serif',
  mono: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
};
const FONT_LABELS = {
  rounded: "Rounded",
  system: "System",
  glass: "Glass",
  serif: "Serif",
  cormorant: "Cormorant",
  mono: "Mono"
};

function isApplePlatform() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

function resolveFontFamily(font) {
  if (font === "serif") {
    return isApplePlatform() ? IOS_SERIF_FONT_FAMILY : NON_IOS_SERIF_FONT_FAMILY;
  }
  return FONT_FAMILIES[font];
}

export function applyUiTheme(
  uiTheme,
  uiAccent = "mint",
  uiMode = "translucence",
  liquidGlassEnabled = false,
  customBackground = "",
  customTransparency = 72,
  customCardTransparency = 72,
  uiFont = "rounded",
  cordycepsUnderlayEnabled = false
) {
  document.body.dataset.uiTheme = uiTheme;
  document.body.dataset.uiAccent = uiAccent;
  document.body.dataset.uiMode = uiMode;
  document.body.dataset.uiGlass = liquidGlassEnabled ? "on" : "off";
  document.body.dataset.uiCustomBackground = customBackground ? "on" : "off";
  document.body.dataset.cordycepsUnderlay = cordycepsUnderlayEnabled ? "on" : "off";
  document.body.dataset.uiFont = ["rounded", "system", "glass", "serif", "cormorant", "mono"].includes(uiFont) ? uiFont : "rounded";
  document.documentElement.dataset.cordycepsUnderlay = document.body.dataset.cordycepsUnderlay;
  document.documentElement.dataset.uiFont = document.body.dataset.uiFont;
  document.body.style.setProperty("--app-font-family", resolveFontFamily(document.body.dataset.uiFont) || FONT_FAMILIES.rounded);
  document.documentElement.style.setProperty("--app-font-family", resolveFontFamily(document.body.dataset.uiFont) || FONT_FAMILIES.rounded);

  const accent = CYBRLAND_ACCENTS[uiAccent] || CYBRLAND_ACCENTS.mint;
  const isDarkLikeMode =
    uiMode === "dark" || uiMode === "translucence-2" || uiMode === "translucence-custom";
  const computedStyles = window.getComputedStyle(document.body);
  const iosStatusBackground = computedStyles.getPropertyValue("--ios-status-bg").trim();
  const fallbackThemeColor = uiTheme === "cybrland"
    ? isDarkLikeMode
      ? accent.darkThemeColor
      : accent.lightThemeColor
    : isDarkLikeMode
      ? "#111216"
      : "#f2f2f7";
  const themeColor = iosStatusBackground || fallbackThemeColor;
  const rootBackground = computedStyles.getPropertyValue("--bg").trim() || themeColor;
  const customBackgroundCss = customBackground
    ? `url("${customBackground.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`
    : "none";
  const maxTransparency = 140;
  const clampedTransparency = Number.isFinite(customTransparency)
    ? Math.max(0, Math.min(maxTransparency, customTransparency))
    : 72;
  const transparencyRatio = clampedTransparency / maxTransparency;
  const clampedCardTransparency = Number.isFinite(customCardTransparency)
    ? Math.max(0, Math.min(maxTransparency, customCardTransparency))
    : 72;
  const isCustomMode = uiMode === "translucence-custom";
  const cardTransparencySource = liquidGlassEnabled && isCustomMode ? 58 : clampedCardTransparency;
  const cardTransparencyRatio = cardTransparencySource / maxTransparency;

  document.documentElement.style.setProperty("--custom-translucence-background-image", customBackgroundCss);
  document.documentElement.dataset.uiCustomBackground = customBackground ? "on" : "off";
  document.documentElement.style.setProperty("--custom-translucence-blur", `${Math.round(transparencyRatio * 16)}px`);
  document.documentElement.style.setProperty("--custom-translucence-scale", String((1 + transparencyRatio * 0.05).toFixed(3)));
  document.documentElement.style.setProperty("--custom-shell-overlay-top", String((0.68 - transparencyRatio * 0.54).toFixed(3)));
  document.documentElement.style.setProperty("--custom-shell-overlay-bottom", String((0.82 - transparencyRatio * 0.5).toFixed(3)));
  document.documentElement.style.setProperty("--custom-surface-top-alpha", String((0.96 - cardTransparencyRatio * 0.9).toFixed(3)));
  document.documentElement.style.setProperty("--custom-surface-bottom-alpha", String((0.92 - cardTransparencyRatio * 0.88).toFixed(3)));
  document.documentElement.style.setProperty("--custom-border-alpha", String((0.22 - cardTransparencyRatio * 0.14).toFixed(3)));
  document.documentElement.style.setProperty("--custom-glass-blur", `${Math.round(cardTransparencyRatio * 28)}px`);
  document.documentElement.style.setProperty("--custom-card-highlight-alpha", String((0.26 - cardTransparencyRatio * 0.18).toFixed(3)));
  document.documentElement.style.setProperty("--custom-card-shadow-alpha", String((0.1 - cardTransparencyRatio * 0.05).toFixed(3)));
  document.documentElement.style.setProperty("--custom-separator-alpha", String((0.18 - cardTransparencyRatio * 0.11).toFixed(3)));
  document.documentElement.style.setProperty(
    "--custom-refraction-ring-alpha",
    liquidGlassEnabled
      ? String((0.22 - cardTransparencyRatio * 0.1).toFixed(3))
      : String((0.08 - cardTransparencyRatio * 0.04).toFixed(3))
  );
  document.documentElement.style.setProperty(
    "--custom-refraction-highlight-alpha",
    liquidGlassEnabled
      ? String((0.34 - cardTransparencyRatio * 0.16).toFixed(3))
      : String((0.12 - cardTransparencyRatio * 0.06).toFixed(3))
  );
  document.documentElement.style.setProperty(
    "--custom-refraction-blur",
    `${Math.round(cardTransparencyRatio * 28 + (liquidGlassEnabled ? 8 : 0))}px`
  );
  document.documentElement.style.setProperty(
    "--custom-refraction-saturation",
    liquidGlassEnabled ? "136%" : "118%"
  );

  if (uiThemeStatus) {
    uiThemeStatus.textContent = uiTheme === "cybrland" ? "CYBRLAND UI" : "Apple-style UI";
  }

  if (uiModeStatus) {
    uiModeStatus.textContent =
      uiMode === "dark"
        ? "Dark"
        : uiMode === "translucence-2"
          ? "Translucence 2"
        : uiMode === "translucence-custom"
          ? "Translucence Custom"
        : uiMode === "translucence"
          ? "Translucence"
          : "Light";
  }

  if (uiCustomBackgroundRow) {
    uiCustomBackgroundRow.hidden = false;
    uiCustomBackgroundRow.classList.toggle("is-disabled", !isCustomMode);
  }

  if (uiCustomTransparencyRow) {
    uiCustomTransparencyRow.hidden = false;
    uiCustomTransparencyRow.classList.toggle("is-disabled", !isCustomMode);
  }

  if (uiCustomCardTransparencyRow) {
    uiCustomCardTransparencyRow.hidden = false;
    uiCustomCardTransparencyRow.classList.toggle("is-disabled", !isCustomMode || liquidGlassEnabled);
  }

  if (uiCustomBackgroundStatus) {
    uiCustomBackgroundStatus.textContent = customBackground
      ? "Custom image saved for Translucence Custom mode"
      : "Add an image URL for Translucence Custom mode";
  }

  if (uiCustomBackgroundInput && document.activeElement !== uiCustomBackgroundInput) {
    uiCustomBackgroundInput.value = customBackground;
  }
  if (uiCustomBackgroundInput) {
    uiCustomBackgroundInput.disabled = uiMode !== "translucence-custom";
  }

  if (uiCustomTransparencyStatus) {
    uiCustomTransparencyStatus.textContent = `${clampedTransparency}% transparency`;
  }

  if (uiCustomTransparencyInput && document.activeElement !== uiCustomTransparencyInput) {
    uiCustomTransparencyInput.value = String(clampedTransparency);
  }
  if (uiCustomTransparencyInput) {
    uiCustomTransparencyInput.disabled = uiMode !== "translucence-custom";
  }

  if (uiCustomCardTransparencyStatus) {
    uiCustomCardTransparencyStatus.textContent =
      isCustomMode && liquidGlassEnabled
        ? "Overridden by Edge Refraction"
        : `${clampedCardTransparency}% transparency`;
  }

  if (uiCustomCardTransparencyInput && document.activeElement !== uiCustomCardTransparencyInput) {
    uiCustomCardTransparencyInput.value = String(clampedCardTransparency);
  }
  if (uiCustomCardTransparencyInput) {
    uiCustomCardTransparencyInput.disabled = !isCustomMode || liquidGlassEnabled;
  }

  if (uiAccentStatus) {
    uiAccentStatus.textContent = accent.label;
  }

  if (uiGlassStatus) {
    uiGlassStatus.textContent = liquidGlassEnabled ? "On" : "Off";
  }

  if (uiFontStatus) {
    uiFontStatus.textContent = FONT_LABELS[document.body.dataset.uiFont] || FONT_LABELS.rounded;
  }

  themeOptionButtons.forEach((button) => {
    const isActive = button.dataset.uiTheme === uiTheme;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  modeOptionButtons.forEach((button) => {
    const isActive = button.dataset.uiMode === uiMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  fontOptionButtons.forEach((button) => {
    const isActive = button.dataset.uiFont === document.body.dataset.uiFont;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  if (uiGlassToggle) {
    uiGlassToggle.setAttribute("aria-checked", String(liquidGlassEnabled));
  }

  if (saveUiCustomBackgroundButton) {
    saveUiCustomBackgroundButton.disabled = uiMode !== "translucence-custom";
  }

  if (clearUiCustomBackgroundButton) {
    clearUiCustomBackgroundButton.disabled = uiMode !== "translucence-custom" || !customBackground;
  }

  const liveAccentOptionButtons = document.querySelectorAll("[data-ui-accent]");
  const accentButtons = liveAccentOptionButtons.length > 0 ? liveAccentOptionButtons : accentOptionButtons;
  accentButtons.forEach((button) => {
    const isActive = button.dataset.uiAccent === uiAccent;
    button.classList.toggle("is-active", isActive);
    button.disabled = false;
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", themeColor);
  }

  if (appleStatusBarMeta) {
    appleStatusBarMeta.setAttribute(
      "content",
      isDarkLikeMode ? "black-translucent" : "default"
    );
  }

  document.documentElement.style.backgroundColor = rootBackground;
  document.body.style.backgroundColor = rootBackground;
}
