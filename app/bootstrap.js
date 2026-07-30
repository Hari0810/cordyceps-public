import { bindViewportHeightSync, syncViewportHeight } from "../modules/ui.js";
import { applyUiTheme } from "../ui/theme.js";

const SHELL_STATE_EVENT = "city-shell:state";

function syncWebDesktopMode() {
  const isDesktopViewport = window.matchMedia?.("(min-width: 1180px)")?.matches;
  const enabled = Boolean(isDesktopViewport);
  document.body.dataset.webDesktop = enabled ? "true" : "false";
  window.dispatchEvent(new CustomEvent(SHELL_STATE_EVENT, {
    detail: {
      isDesktopWeb: enabled
    }
  }));

  document.querySelectorAll(".content-stack.page .page-heading").forEach((heading) => {
    if (heading instanceof HTMLElement) {
      const page = heading.closest(".content-stack.page");
      const keepVisible = page?.dataset.page === "dashboard";
      heading.style.display = enabled && !keepVisible ? "none" : "";
    }
  });
}

export function initializeShell({
  themeState,
  viewportInputs = [],
  startup
}) {
  syncViewportHeight();
  syncWebDesktopMode();
  applyUiTheme(
    themeState.uiTheme,
    themeState.uiAccent,
    themeState.uiMode,
    themeState.liquidGlassEnabled,
    themeState.uiCustomBackground,
    themeState.uiCustomTransparency,
    themeState.uiCustomCardTransparency,
    themeState.uiFont,
    themeState.cordycepsUnderlayEnabled
  );

  if (typeof startup === "function") {
    startup();
  }

  bindViewportHeightSync(viewportInputs);
  window.addEventListener("resize", syncWebDesktopMode);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncWebDesktopMode();
    }
  });
}
