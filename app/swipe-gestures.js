/**
 * Swipe gestures — page swipe navigation.
 *
 * Owns `pageSwipeGesture` as internal state. App.js does not need to read it —
 * all mutations are self-contained within this module.
 *
 * App.js-owned dependencies (activePage, setActivePage, pageButtonRegistry)
 * are injected once at boot via `bindSwipeGestureCallbacks`.
 *
 * Dependencies (direct imports):
 *   getAdjacentPageName          — ../modules/ui.js
 */

import { getAdjacentPageName } from "../modules/ui.js";

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

const PAGE_SWIPE_LOCK_THRESHOLD_PX = 18;
const PAGE_SWIPE_THRESHOLD_PX = 72;

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _getActivePage = () => "";
let _setActivePage = () => {};
let _onPageEntry = () => {};
let _canStartPageSwipeRegistry = () => false;
let _getSwipeGestureActive = () => false;

/**
 * Inject app.js-owned dependencies. Must be called once at boot before any
 * gesture handlers fire.
 *
 * @param {object} callbacks
 * @param {() => string}  callbacks.getActivePage
 * @param {(page: string) => void} callbacks.setActivePage
 * @param {(page: string) => void} callbacks.onPageEntry
 * @param {() => boolean} callbacks.canStartPageSwipeRegistry
 * @param {() => boolean} callbacks.getSwipeGestureActive
 */
export function bindSwipeGestureCallbacks(callbacks) {
  _getActivePage = callbacks.getActivePage ?? _getActivePage;
  _setActivePage = callbacks.setActivePage ?? _setActivePage;
  _onPageEntry = callbacks.onPageEntry ?? _onPageEntry;
  _canStartPageSwipeRegistry = callbacks.canStartPageSwipeRegistry ?? _canStartPageSwipeRegistry;
  _getSwipeGestureActive = callbacks.getSwipeGestureActive ?? _getSwipeGestureActive;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let pageSwipeGesture = null;

export async function reloadApp({ beforeReload } = {}) {
  try {
    if (typeof beforeReload === "function") {
      await beforeReload();
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.update()));
    }
  } catch {
    // Reload should still work even if the service worker update check fails.
  } finally {
    window.location.reload();
  }
}

// ---------------------------------------------------------------------------
// Page swipe navigation
// ---------------------------------------------------------------------------

export function bindPageSwipeNavigation() {
  const pageStack = document.querySelector(".page-stack");
  if (!pageStack) {
    return;
  }

  pageStack.addEventListener("touchstart", handlePageSwipeStart, { passive: true });
  pageStack.addEventListener("touchmove", handlePageSwipeMove, { passive: false });
  pageStack.addEventListener("touchend", handlePageSwipeEnd);
  pageStack.addEventListener("touchcancel", cancelPageSwipeGesture);
}

function handlePageSwipeStart(event) {
  if (event.touches.length !== 1 || !canStartPageSwipe(event.target)) {
    pageSwipeGesture = null;
    return;
  }

  const [touch] = event.touches;
  if (!touch) {
    pageSwipeGesture = null;
    return;
  }

  pageSwipeGesture = {
    identifier: touch.identifier,
    startX: touch.clientX,
    startY: touch.clientY,
    deltaX: 0,
    deltaY: 0,
    axisLocked: null
  };
}

function handlePageSwipeMove(event) {
  if (!pageSwipeGesture) {
    return;
  }

  const touch = getTrackedTouch(event.changedTouches, pageSwipeGesture.identifier);
  if (!touch) {
    return;
  }

  pageSwipeGesture.deltaX = touch.clientX - pageSwipeGesture.startX;
  pageSwipeGesture.deltaY = touch.clientY - pageSwipeGesture.startY;

  if (!pageSwipeGesture.axisLocked) {
    if (
      Math.abs(pageSwipeGesture.deltaX) < PAGE_SWIPE_LOCK_THRESHOLD_PX &&
      Math.abs(pageSwipeGesture.deltaY) < PAGE_SWIPE_LOCK_THRESHOLD_PX
    ) {
      return;
    }

    pageSwipeGesture.axisLocked =
      Math.abs(pageSwipeGesture.deltaX) > Math.abs(pageSwipeGesture.deltaY) ? "x" : "y";
  }

  if (pageSwipeGesture.axisLocked !== "x") {
    return;
  }

  if (Math.abs(pageSwipeGesture.deltaX) <= Math.abs(pageSwipeGesture.deltaY)) {
    return;
  }

  event.preventDefault();
}

function handlePageSwipeEnd(event) {
  if (!pageSwipeGesture) {
    return;
  }

  const gesture = pageSwipeGesture;
  const touch = getTrackedTouch(event.changedTouches, gesture.identifier);
  cancelPageSwipeGesture();

  if (!touch) {
    return;
  }

  const deltaX = touch.clientX - gesture.startX;
  const deltaY = touch.clientY - gesture.startY;
  if (
    gesture.axisLocked !== "x" ||
    Math.abs(deltaX) < PAGE_SWIPE_THRESHOLD_PX ||
    Math.abs(deltaX) <= Math.abs(deltaY)
  ) {
    return;
  }

  const direction = deltaX < 0 ? 1 : -1;
  const nextPage = getAdjacentPageName(_getActivePage(), direction);
  if (!nextPage) {
    return;
  }

  handlePageSwipeNavigation(nextPage);
}

function cancelPageSwipeGesture() {
  pageSwipeGesture = null;
}

function canStartPageSwipe(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  // Top-level app-page swiping is disabled; dashboard handles its own internal paging.
  return false;

  if (!_canStartPageSwipeRegistry()) {
    return false;
  }

  if (_getSwipeGestureActive()) {
    return false;
  }

  if (document.activeElement instanceof HTMLElement && isTextEntryElement(document.activeElement)) {
    return false;
  }

  if (target.closest([
    "input",
    "textarea",
    "select",
    "button",
    "a",
    "label",
    "[contenteditable='true']",
    "[role='button']",
    ".todo-item",
    "#calendar-grid",
    ".calendar-scroll-area",
    ".calendar-event",
    ".rss-item-link"
  ].join(", "))) {
    return false;
  }

  const scrollContainer = target.closest(
    ".dashboard-page, .task-list-region, .settings-page, .notes-page, .habits-page, .pomodoro-page, .spotify-page, .mycelia-page, .hyphae-page, .thendral-page, .calendar-page, .monzo-page, .housework-page, .daily-page, .energy-tracker-page, .rss-page"
  );
  if (scrollContainer instanceof HTMLElement && scrollContainer.scrollTop > 0) {
    return false;
  }

  return true;
}

function handlePageSwipeNavigation(nextPage) {
  _onPageEntry(nextPage);
  _setActivePage(nextPage);
}

function isTextEntryElement(element) {
  return Boolean(
    element.matches("input, textarea, select") ||
    element.isContentEditable
  );
}

function getTrackedTouch(touchList, identifier) {
  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList[index];
    if (touch.identifier === identifier) {
      return touch;
    }
  }

  return null;
}
