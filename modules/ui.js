import {
  calendarDateInput,
  calendarGrid,
  calendarNextButton,
  calendarPrevButton,
  calendarRangeLabel,
  backToTasksButton,
  appleStatusBarMeta,
  emptyState,
  filterButtons,
  notificationButton,
  notificationPushValue,
  notificationStatus,
  habitAddButton,
  habitNameInput,
  habitSubmitButton,
  habitsAddForm,
  habitsBestStreakValue,
  habitsCompletedTodayValue,
  habitsEmptyState,
  habitsList,
  habitsTotalValue,
  monzoAccessTokenInput,
  monzoAccountSummary,
  monzoAccountIdInput,
  monzoAuthenticatedValue,
  monzoEmptyState,
  monzoWeekly,
  monzoType,
  monzoExpensesList,
  monzoStatusValue,
  openTasksButton,
  monzoViewButtons,
  openCalendarButton,
  openBooksButton,
  openDashboardButton,
  openMonzoButton,
  openHabitsButton,
  openNotesButton,
  openRssButton,
  openSettingsButton,
  pages,
  pagesByName,
  randomAlertStatus,
  randomAlertToggle,
  rssPanels,
  settingsPanels,
  outlookAutoSyncStatus,
  outlookAutoSyncToggle,
  outlookIcsUrlInput,
  outlookEmailInput,
  outlookStatusValue,
  outlookSyncModeSelect,
  syncBanner,
  syncIssuesRow,
  syncIssuesValue,
  syncStatusValue,
  taskCount,
  themeColorMeta,
  accentOptionButtons,
  modeOptionButtons,
  themeOptionButtons,
  testPushStatus,
  testPushToggle,
  toastStack,
  todoList,
  clearUiCustomBackgroundButton,
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
  uiModeStatus,
  saveUiCustomBackgroundButton,
  uiThemeStatus
} from "./dom.js";
const SHELL_STATE_EVENT = "city-shell:state";
import { getEmptyStateMessage, getFilteredTodos } from "./state.js";
const CALENDAR_HOUR_HEIGHT = 64;
const CALENDAR_DAYS_VISIBLE = 7;
const PAGE_TRANSITION_ORDER = [
  "dashboard",
  "tasks",
  "calendar",
  "notes",
  "books",
  "habits",
  "pomodoro",
  "spotify",
  "mycelia",
  "thendral",
  "monzo",
  "rss",
  "settings"
];

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
const DEFAULT_EMAIL_RECIPIENT_FALLBACK = "Not set";
const IOS_STANDALONE_VIEWPORT_PROMOTION_MIN_GAP = 20;
const IOS_STANDALONE_VIEWPORT_WIDTH_TOLERANCE = 4;
const MONZO_MOCK_EXPENSES = [
  {
    id: "mock-monzo-1",
    merchantName: "Pret A Manger",
    description: "Lunch",
    amountMinor: 895,
    currency: "GBP",
    created: "2026-03-22T12:15:00Z",
    settled: "2026-03-22T12:15:00Z",
    category: "eating_out"
  },
  {
    id: "mock-monzo-2",
    merchantName: "Tesco",
    description: "Groceries",
    amountMinor: 3240,
    currency: "GBP",
    created: "2026-03-21T18:40:00Z",
    settled: "2026-03-21T18:40:00Z",
    category: "groceries"
  },
  {
    id: "mock-monzo-3",
    merchantName: "TfL",
    description: "Tube",
    amountMinor: 280,
    currency: "GBP",
    created: "2026-03-21T08:05:00Z",
    settled: "2026-03-21T08:05:00Z",
    category: "transport"
  },
  {
    id: "mock-monzo-4",
    merchantName: "Vue",
    description: "Cinema",
    amountMinor: 1399,
    currency: "GBP",
    created: "2026-03-20T20:10:00Z",
    settled: "2026-03-20T20:10:00Z",
    category: "entertainment"
  },
  {
    id: "mock-monzo-5",
    merchantName: "Amazon",
    description: "Household",
    amountMinor: 2199,
    currency: "GBP",
    created: "2026-03-19T09:30:00Z",
    settled: "2026-03-19T09:30:00Z",
    category: "shopping"
  }
];
const MONZO_BIG_PURCHASE_THRESHOLD_MINOR = 1500;

let lockedKeyboardViewportHeight = null;
let lockedKeyboardScrollTop = 0;

function getKeyboardScrollTargets() {
  return Array.from(
    document.querySelectorAll(".task-list-region, .settings-page, .notes-page, .habits-page, .pomodoro-page, .spotify-page, .mycelia-page, .thendral-page, .calendar-page, .monzo-page, .rss-page")
  );
}

function restoreKeyboardScrollPosition() {
  if (!(document.body?.dataset.keyboardOpen === "true" && isIosLikeDevice() && isStandaloneApp())) {
    return;
  }

  window.scrollTo(0, 0);
  const scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    scrollingElement.scrollTop = 0;
  }

  getKeyboardScrollTargets().forEach((element) => {
    element.scrollTop = Math.min(element.scrollTop, lockedKeyboardScrollTop);
  });
}

function scheduleKeyboardScrollRestore() {
  restoreKeyboardScrollPosition();
  window.requestAnimationFrame(restoreKeyboardScrollPosition);
  window.setTimeout(restoreKeyboardScrollPosition, 0);
  window.setTimeout(restoreKeyboardScrollPosition, 120);
  window.setTimeout(restoreKeyboardScrollPosition, 260);
}

function syncKeyboardOffset() {
  if (!(document.body?.dataset.keyboardOpen === "true" && isIosLikeDevice() && isStandaloneApp())) {
    document.documentElement.style.setProperty("--keyboard-offset", "0px");
    return;
  }

  const viewport = window.visualViewport;
  if (!viewport) {
    document.documentElement.style.setProperty("--keyboard-offset", "0px");
    return;
  }

  const keyboardOffset = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
  document.documentElement.style.setProperty("--keyboard-offset", `${Math.round(keyboardOffset)}px`);
}

function getStandaloneIosScreenSize() {
  const screenValues = [
    window.screen?.width || 0,
    window.screen?.height || 0,
    window.screen?.availWidth || 0,
    window.screen?.availHeight || 0,
  ].filter((value) => Number.isFinite(value) && value > 0);
  if (screenValues.length === 0) {
    return { width: 0, height: 0 };
  }

  const portrait = window.matchMedia?.("(orientation: portrait)")?.matches ?? (window.innerHeight >= window.innerWidth);
  return {
    width: portrait ? Math.min(...screenValues) : Math.max(...screenValues),
    height: portrait ? Math.max(...screenValues) : Math.min(...screenValues)
  };
}

function resolveStandaloneIosViewportHeight(viewportHeight, keyboardOpen) {
  if (keyboardOpen || !(isIosLikeDevice() && isStandaloneApp())) {
    return viewportHeight;
  }

  const screenSize = getStandaloneIosScreenSize();
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const missingHeight = screenSize.height - viewportHeight;
  const fullWidthViewport = Math.abs(screenSize.width - viewportWidth) <= IOS_STANDALONE_VIEWPORT_WIDTH_TOLERANCE;
  // iPhone PWAs can report a stale or safe-area-short visual viewport on launch.
  return fullWidthViewport && missingHeight > IOS_STANDALONE_VIEWPORT_PROMOTION_MIN_GAP
    ? screenSize.height
    : viewportHeight;
}

export function syncViewportHeight() {
  const shouldUseStandaloneIosViewport = isIosLikeDevice() && isStandaloneApp();
  const shouldLockKeyboardViewport =
    document.body?.dataset.keyboardOpen === "true" && shouldUseStandaloneIosViewport;
  const visualViewportHeight = window.visualViewport?.height || window.innerHeight;
  const resolvedStandaloneViewportHeight = resolveStandaloneIosViewportHeight(
    visualViewportHeight,
    shouldLockKeyboardViewport
  );
  const viewportHeight = shouldLockKeyboardViewport
    ? lockedKeyboardViewportHeight || window.innerHeight
    : shouldUseStandaloneIosViewport
      ? resolvedStandaloneViewportHeight
    : document.body?.dataset.keyboardOpen === "true"
      ? visualViewportHeight
      : null;
  const supportsDynamicViewport = window.CSS?.supports?.("height", "100dvh") === true;
  document.documentElement.style.setProperty(
    "--app-height",
    viewportHeight === null
      ? supportsDynamicViewport ? "100dvh" : `${Math.round(visualViewportHeight)}px`
      : `${Math.round(viewportHeight)}px`
  );
  syncKeyboardOffset();
}

function settleViewportHeight() {
  window.requestAnimationFrame?.(() => {
    syncViewportHeight();
    window.requestAnimationFrame?.(syncViewportHeight);
  });
  [60, 180, 360, 720, 1200, 1800].forEach((delay) => window.setTimeout(syncViewportHeight, delay));
}

export function bindViewportHeightSync(inputElements) {
  const fields = Array.isArray(inputElements)
    ? inputElements.filter(Boolean)
    : [inputElements].filter(Boolean);

  window.addEventListener("resize", syncViewportHeight);
  window.addEventListener("orientationchange", syncViewportHeight);
  settleViewportHeight();

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      syncViewportHeight();
      restoreKeyboardScrollPosition();
    });
    window.visualViewport.addEventListener("scroll", () => {
      syncViewportHeight();
      restoreKeyboardScrollPosition();
    });
  }

  fields.forEach((field) => {
    field.addEventListener("focus", () => {
      if (isIosLikeDevice() && isStandaloneApp()) {
        lockedKeyboardViewportHeight = window.visualViewport?.height || window.innerHeight;
        lockedKeyboardScrollTop = Math.max(
          0,
          ...getKeyboardScrollTargets().map((element) => element.scrollTop || 0)
        );
        document.body.dataset.keyboardOpen = "true";
        scheduleKeyboardScrollRestore();
      }
      window.requestAnimationFrame(syncViewportHeight);
    });

    field.addEventListener("blur", () => {
      window.setTimeout(() => {
        const activeElement = document.activeElement;
        if (activeElement && fields.includes(activeElement)) {
          return;
        }

        delete document.body.dataset.keyboardOpen;
        lockedKeyboardViewportHeight = null;
        lockedKeyboardScrollTop = 0;
        syncViewportHeight();
        window.scrollTo(0, 0);
      }, 50);
    });
  });
}

export function bindWindowFrameSync() {
  const hasOverlayApi = typeof window !== "undefined" && "windowControlsOverlay" in window.navigator;
  const overlayMedia = window.matchMedia?.("(display-mode: window-controls-overlay)");

  const syncWindowFrame = () => {
    const overlayActive = Boolean(
      overlayMedia?.matches || (hasOverlayApi && window.navigator.windowControlsOverlay?.visible)
    );
    document.body.dataset.desktopWindowFrame = overlayActive ? "overlay" : "default";

    const titlebarHeight = hasOverlayApi
      ? window.navigator.windowControlsOverlay?.getTitlebarAreaRect?.().height || 0
      : 0;
    document.documentElement.style.setProperty(
      "--desktop-titlebar-height",
      `${Math.max(0, Math.round(titlebarHeight))}px`
    );
  };

  syncWindowFrame();

  if (overlayMedia?.addEventListener) {
    overlayMedia.addEventListener("change", syncWindowFrame);
  } else if (overlayMedia?.addListener) {
    overlayMedia.addListener(syncWindowFrame);
  }

  if (hasOverlayApi && window.navigator.windowControlsOverlay?.addEventListener) {
    window.navigator.windowControlsOverlay.addEventListener("geometrychange", syncWindowFrame);
  }

  window.addEventListener("resize", syncWindowFrame);
}

export function renderApp({
  todos,
  activeFilter,
  activePage,
  hasAnimatedPageTransition,
  enteringTaskIds = new Set(),
  completingTaskIds = new Set()
}) {
  todoList.innerHTML = "";

  const filteredTodos = getFilteredTodos(todos, activeFilter);
  todoList.classList.remove("todo-list-priority-board");

  filteredTodos.forEach((todo) => {
    todoList.append(createTodoListItem(todo, enteringTaskIds, completingTaskIds));
  });

  const completedCount = todos.filter((todo) => todo.completed).length;
  const remainingCount = todos.length - completedCount;
  const taskLabel = remainingCount === 1 ? "task" : "tasks";

  taskCount.textContent = `${remainingCount} ${taskLabel} left`;
  emptyState.textContent = getEmptyStateMessage(activeFilter);
  emptyState.hidden = filteredTodos.length > 0;
  syncPageUi({ todos, activePage, hasAnimatedPageTransition });

  filterButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === activeFilter);
  });
}

function createTodoListItem(todo, enteringTaskIds, completingTaskIds) {
  const item = document.createElement("li");
  const priorityClass =
    todo.priority === "important" ? " priority-orange" : todo.priority === "urgent" ? " priority-red" : "";
  item.className = `todo-item${todo.completed ? " completed" : ""}${todo.pinned ? " pinned" : ""}${priorityClass}`;
  item.dataset.id = todo.id;
  if (enteringTaskIds.has(todo.id)) {
    item.classList.add("is-entering");
  }
  if (todo.completed && completingTaskIds.has(todo.id)) {
    item.classList.add("is-completing");
  }

  const checkbox = document.createElement("button");
  checkbox.className = "check-button";
  checkbox.type = "button";
  checkbox.setAttribute(
    "aria-label",
    todo.completed ? `Mark ${todo.text} as incomplete` : `Mark ${todo.text} as complete`
  );

  const copy = document.createElement("div");
  copy.className = "todo-copy";

  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = todo.text;

  const actions = document.createElement("div");
  actions.className = "priority-actions";

  if (!todo.completed) {
    const importantButton = document.createElement("button");
    importantButton.className = `priority-button priority-button-orange${todo.priority === "important" ? " is-active" : ""}`;
    importantButton.type = "button";
    importantButton.dataset.priority = "important";
    importantButton.innerHTML = '<span class="priority-dot" aria-hidden="true"></span>';
    importantButton.setAttribute(
      "aria-label",
      todo.priority === "important" ? `Clear important priority for ${todo.text}` : `Mark ${todo.text} as important`
    );

    const urgentButton = document.createElement("button");
    urgentButton.className = `priority-button priority-button-red${todo.priority === "urgent" ? " is-active" : ""}`;
    urgentButton.type = "button";
    urgentButton.dataset.priority = "urgent";
    urgentButton.innerHTML = '<span class="priority-dot" aria-hidden="true"></span>';
    urgentButton.setAttribute(
      "aria-label",
      todo.priority === "urgent" ? `Clear urgent priority for ${todo.text}` : `Mark ${todo.text} as urgent`
    );

    actions.append(importantButton, urgentButton);
  }

  if (todo.pinned) {
    const pin = document.createElement("span");
    pin.className = "todo-pin";
    pin.setAttribute("aria-hidden", "true");
    pin.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M8.25 5.5C8.25 4.53 9.03 3.75 10 3.75H14C14.97 3.75 15.75 4.53 15.75 5.5C15.75 6.47 14.97 7.25 14 7.25H10C9.03 7.25 8.25 6.47 8.25 5.5Z" fill="currentColor"/><path d="M12 7.25V13.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/><path d="M7.75 9.25H16.25L14.5 13.5H9.5L7.75 9.25Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/><path d="M12 13.5V20.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/><path d="M10.75 20.25H13.25" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>';
    actions.append(pin);
  }

  copy.append(text);
  item.append(checkbox, copy);
  if (actions.childElementCount > 0) {
    item.append(actions);
  }

  return item;
}

export function syncPageUi({ todos, activePage, hasAnimatedPageTransition }) {
  syncPageChrome(todos, activePage);
  applyPageStates(activePage, activePage, hasAnimatedPageTransition);
}

export function syncPageChrome(todos, activePage) {
  const hasCompletedTasks = todos.some((todo) => todo.completed);
  const activeSettingsPanel = document.body?.dataset.activeSettingsPanel || "root";
  const activeRssPanel = document.body?.dataset.activeRssPanel || "root";
  const booksView = document.querySelector("#books-page")?.dataset.booksView || "library";
  const isSettingsSubpage = activePage === "settings" && activeSettingsPanel !== "root";
  const isRssSubpage = activePage === "rss" && activeRssPanel !== "root";
  const isBooksReader = activePage === "books" && booksView === "reader";
  window.dispatchEvent(new CustomEvent(SHELL_STATE_EVENT, {
    detail: {
      activePage,
      activeSettingsPanel,
      activeRssPanel,
      backButtonHidden: activePage === "tasks" || activePage === "dashboard",
      backButtonLabel: isSettingsSubpage ? "Settings" : isRssSubpage ? "RSS Feed" : isBooksReader ? "Books" : "Back",
      backButtonAriaLabel:
        isSettingsSubpage
          ? "Back to settings"
          : isRssSubpage
            ? "Back to RSS feed"
            : isBooksReader
              ? "Back to books library"
              : "Back home",
      navButtonAriaLabels: {
        dashboard: activePage === "dashboard" ? "Dashboard" : "Open dashboard",
        tasks: activePage === "tasks" ? "Tasks page" : "Open tasks",
        calendar: activePage === "calendar" ? "Back home" : "Open calendar",
        notes: activePage === "notes" ? "Back home" : "Open notes",
        books: activePage === "books" ? "Back home" : "Open books",
        habits: activePage === "habits" ? "Back home" : "Open habits",
        monzo: activePage === "monzo" ? "Back home" : "Open Budget",
        rss: activePage === "rss"
          ? isRssSubpage
            ? "Back to RSS feed"
            : "Back home"
          : "Open RSS feed",
        settings: activePage === "settings"
          ? isSettingsSubpage
            ? "Back to settings"
            : "Back home"
          : "Open settings"
      }
    }
  }));

  const clearCompletedSettingsButton = document.querySelector("#clear-completed-settings");
  if (clearCompletedSettingsButton) {
    clearCompletedSettingsButton.hidden = !hasCompletedTasks;
  }
}

export function syncSettingsPanelUi(activePanel) {
  settingsPanels.forEach((panel) => {
    const isActive = (panel.dataset.settingsPanel || "root") === activePanel;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });
}

export function syncRssPanelUi(activePanel) {
  rssPanels.forEach((panel) => {
    const isActive = (panel.dataset.rssPanel || "root") === activePanel;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });
}

function getPageIndex(pageName) {
  const orderedIndex = PAGE_TRANSITION_ORDER.indexOf(pageName);
  if (orderedIndex !== -1) {
    return orderedIndex;
  }

  const domOrder = Array.from(pages, (page) => page.dataset.page || "");
  return domOrder.indexOf(pageName);
}

export function getAdjacentPageName(pageName, direction) {
  const pageIndex = getPageIndex(pageName);
  if (pageIndex === -1) {
    return null;
  }

  return PAGE_TRANSITION_ORDER[pageIndex + direction] || null;
}

export function applyPageStates(previousPageName, nextPageName, animate) {
  const previousPage = pagesByName[previousPageName];
  const nextPage = pagesByName[nextPageName];
  const previousIndex = getPageIndex(previousPageName);
  const nextIndex = getPageIndex(nextPageName);
  const movingForward = previousIndex !== -1 && nextIndex !== -1 ? nextIndex > previousIndex : true;
  const getStaticPageState = (pageName) => {
    const pageIndex = getPageIndex(pageName);
    return pageIndex < nextIndex ? "before" : "after";
  };

  pages.forEach((page) => {
    page.setAttribute("aria-hidden", "true");
  });

  if (!previousPage || !nextPage) {
    return;
  }

  if (!animate || previousPageName === nextPageName) {
    pages.forEach((page) => {
      const state = page.dataset.page === nextPageName
        ? "active"
        : getStaticPageState(page.dataset.page || "");
      page.dataset.pageState = state;
      page.setAttribute("aria-hidden", String(page.dataset.page !== nextPageName));
    });
    return;
  }

  pages.forEach((page) => {
    const pageName = page.dataset.page || "";
    if (pageName === previousPageName || pageName === nextPageName) {
      return;
    }

    page.dataset.pageState = getStaticPageState(pageName);
    page.setAttribute("aria-hidden", "true");
  });

  previousPage.dataset.pageState = "active";
  previousPage.setAttribute("aria-hidden", "false");
  nextPage.dataset.pageState = movingForward ? "after" : "before";
  nextPage.setAttribute("aria-hidden", "false");

  window.requestAnimationFrame(() => {
    previousPage.dataset.pageState = movingForward ? "before" : "after";
    nextPage.dataset.pageState = "active";
    nextPage.setAttribute("aria-hidden", "false");
  });

  window.setTimeout(() => {
    pages.forEach((page) => {
      const state = page.dataset.page === nextPageName
        ? "active"
        : getStaticPageState(page.dataset.page || "");
      page.dataset.pageState = state;
      page.setAttribute("aria-hidden", String(page.dataset.page !== nextPageName));
    });
  }, 340);
}

export function syncCalendarUi(calendarState) {
  if (!calendarGrid || !calendarDateInput || !calendarRangeLabel) {
    return;
  }

  const { events = [], startDate, draftEvent = null } = calendarState;
  const visibleStart = startOfDay(startDate || new Date());
  const visibleDays = Array.from({ length: CALENDAR_DAYS_VISIBLE }, (_, index) => addDays(visibleStart, index));
  const visibleEnd = addDays(visibleStart, CALENDAR_DAYS_VISIBLE);

  calendarDateInput.value = formatDateInputValue(visibleStart);
  calendarRangeLabel.textContent = `${formatCalendarRange(visibleStart)} - ${formatCalendarRange(addDays(visibleEnd, -1))}`;

  if (calendarPrevButton) {
    calendarPrevButton.setAttribute("aria-label", "Show previous week");
  }
  if (calendarNextButton) {
    calendarNextButton.setAttribute("aria-label", "Show next week");
  }

  calendarGrid.innerHTML = "";

  const headerRow = document.createElement("div");
  headerRow.className = "calendar-header-row";
  const spacer = document.createElement("div");
  spacer.className = "calendar-time-spacer";
  headerRow.append(spacer);

  visibleDays.forEach((day) => {
    const header = document.createElement("div");
    header.className = "calendar-day-header";
    header.innerHTML = `<span class="calendar-day-name">${formatCalendarDayName(day)}</span><span class="calendar-day-date">${formatCalendarDayDate(day)}</span>`;
    headerRow.append(header);
  });

  const scrollArea = document.createElement("div");
  scrollArea.className = "calendar-scroll-area";

  const timeColumn = document.createElement("div");
  timeColumn.className = "calendar-time-column";
  for (let hour = 0; hour < 24; hour += 1) {
    const slot = document.createElement("div");
    slot.className = "calendar-time-slot";
    slot.textContent = formatCalendarHour(hour);
    timeColumn.append(slot);
  }
  scrollArea.append(timeColumn);

  const daysWrap = document.createElement("div");
  daysWrap.className = "calendar-days-wrap";
  const visibleEvents = events.filter((event) => {
    const eventStart = new Date(event.start);
    return eventStart >= visibleStart && eventStart < visibleEnd;
  });

  visibleDays.forEach((day, dayIndex) => {
    const column = document.createElement("div");
    column.className = "calendar-day-column";

    const surface = document.createElement("div");
    surface.className = "calendar-day-surface";
    surface.dataset.dayIndex = String(dayIndex);

    for (let hour = 0; hour < 24; hour += 1) {
      const line = document.createElement("div");
      line.className = "calendar-hour-line";
      surface.append(line);
    }

    visibleEvents
      .filter((event) => isSameDay(new Date(event.start), day))
      .forEach((event) => {
        surface.append(createCalendarEventNode(event));
      });

    if (draftEvent && draftEvent.dayIndex === dayIndex) {
      surface.append(createCalendarDraftNode(draftEvent));
    }

    column.append(surface);
    daysWrap.append(column);
  });

  scrollArea.append(daysWrap);
  calendarGrid.append(headerRow, scrollArea);
}

export function syncHabitsUi(habits) {
  if (
    !habitsList ||
    !habitsEmptyState ||
    !habitsTotalValue ||
    !habitsCompletedTodayValue ||
    !habitsBestStreakValue
  ) {
    return;
  }

  const items = Array.isArray(habits) ? habits : [];
  const todayKey = formatHabitDateKey(new Date());
  let completedTodayCount = 0;
  let bestStreak = 0;

  habitsList.innerHTML = "";
  habitsEmptyState.hidden = items.length > 0;
  habitsTotalValue.textContent = String(items.length);

  items.forEach((habit) => {
    const streaks = computeHabitStreaks(habit, todayKey);
    if (streaks.completedToday) {
      completedTodayCount += 1;
    }
    bestStreak = Math.max(bestStreak, streaks.currentStreak, streaks.bestStreak);

    const item = document.createElement("article");
    item.className = `habit-item${streaks.completedToday ? " is-completed" : ""}`;

    const copy = document.createElement("div");
    copy.className = "habit-copy";

    const title = document.createElement("p");
    title.className = "habit-title";
    title.textContent = habit.name || "Untitled habit";

    const meta = document.createElement("p");
    meta.className = "habit-meta";
    meta.textContent = [
      `${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"} streak`,
      `${streaks.bestStreak} best`,
      streaks.completedToday ? "Completed today" : "Not completed today"
    ].join(" • ");

    copy.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "habit-actions";

    const stepper = document.createElement("div");
    stepper.className = "habit-count-stepper";
    stepper.setAttribute("aria-label", `${habit.name || "Habit"} count`);

    const decrement = document.createElement("button");
    decrement.className = "habit-count-button";
    decrement.type = "button";
    decrement.dataset.habitCount = habit.id;
    decrement.dataset.habitCountDelta = "-1";
    decrement.setAttribute("aria-label", `Decrease ${habit.name || "habit"} count`);
    decrement.textContent = "-";

    const count = document.createElement("span");
    count.className = "habit-count-value";
    count.textContent = String(Math.max(0, Number(habit.count || 0)));

    const increment = document.createElement("button");
    increment.className = "habit-count-button";
    increment.type = "button";
    increment.dataset.habitCount = habit.id;
    increment.dataset.habitCountDelta = "1";
    increment.setAttribute("aria-label", `Increase ${habit.name || "habit"} count`);
    increment.textContent = "+";

    stepper.append(decrement, count, increment);

    const toggle = document.createElement("button");
    toggle.className = `setting-action-button${streaks.completedToday ? " setting-action-button-secondary habit-toggle-button is-active" : " habit-toggle-button"}`;
    toggle.type = "button";
    toggle.dataset.habitComplete = habit.id;
    toggle.textContent = streaks.completedToday ? "Undo today" : "Mark today";

    const remove = document.createElement("button");
    remove.className = "setting-action-button setting-action-button-secondary habit-remove-button";
    remove.type = "button";
    remove.dataset.habitRemove = habit.id;
    remove.textContent = "Delete";

    actions.append(stepper, toggle, remove);
    item.append(copy, actions);
    habitsList.append(item);
  });

  habitsCompletedTodayValue.textContent = String(completedTodayCount);
  habitsBestStreakValue.textContent = `${bestStreak} day${bestStreak === 1 ? "" : "s"}`;

  if (habitNameInput) {
    habitNameInput.placeholder = items.length > 0 ? "Keep going..." : "Read 10 pages";
  }
  if (habitSubmitButton) {
    habitSubmitButton.disabled = false;
  }
  if (habitAddButton) {
    habitAddButton.textContent = "Add habit";
  }
  if (habitsAddForm) {
    habitsAddForm.dataset.habitsCount = String(items.length);
  }
}

function computeHabitStreaks(habit, todayKey) {
  const completions = new Set(normalizeHabitCompletions(habit?.completions));
  const completedToday = completions.has(todayKey);

  let currentStreak = 0;
  if (completedToday) {
    let cursor = parseHabitDateKey(todayKey);
    while (cursor && completions.has(formatHabitDateKey(cursor))) {
      currentStreak += 1;
      cursor = addDays(cursor, -1);
    }
  }

  let bestStreak = 0;
  let run = 0;
  const sortedDates = Array.from(completions)
    .map((value) => parseHabitDateKey(value))
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());

  let previousKey = "";
  sortedDates.forEach((date) => {
    const key = formatHabitDateKey(date);
    if (!previousKey) {
      run = 1;
    } else {
      const previousDate = parseHabitDateKey(previousKey);
      const expected = addDays(previousDate, 1);
      run = formatHabitDateKey(expected) === key ? run + 1 : 1;
    }
    bestStreak = Math.max(bestStreak, run);
    previousKey = key;
  });

  return { currentStreak, bestStreak, completedToday };
}

function normalizeHabitCompletions(completions) {
  return Array.isArray(completions)
    ? completions
      .map((value) => String(value || "").trim())
      .filter((value, index, values) => value && values.indexOf(value) === index)
    : [];
}

function formatHabitDateKey(date) {
  const nextDate = date instanceof Date ? date : new Date(date);
  const year = nextDate.getFullYear();
  const month = `${nextDate.getMonth() + 1}`.padStart(2, "0");
  const day = `${nextDate.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseHabitDateKey(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function syncMonzoUi(monzoState, expenses = [], monzoView = "list") {
  if (!monzoStatusValue || !monzoExpensesList || !monzoEmptyState || !monzoWeekly || !monzoType) {
    return;
  }

  const effectiveExpenses =
    Array.isArray(expenses) && expenses.length > 0
      ? expenses
      : (!monzoState.configured ? MONZO_MOCK_EXPENSES : []);

  if (!monzoState.configured) {
    monzoStatusValue.textContent = "Connect read-only bank data or import CSV. Showing demo spending.";
  } else if (monzoState.lastSyncResult) {
    monzoStatusValue.textContent = monzoState.lastSyncResult;
  } else if (monzoState.accountDescription) {
    monzoStatusValue.textContent =
      monzoState.connectionProvider === "truelayer"
        ? `Connected to ${monzoState.accountDescription} through legacy TrueLayer`
        : `Connected to ${monzoState.accountDescription}`;
  } else {
    monzoStatusValue.textContent = "Connected";
  }

  if (monzoAccountIdInput) {
    const shouldUpdateAccountId =
      document.activeElement !== monzoAccountIdInput || !monzoAccountIdInput.value.trim();
    if (shouldUpdateAccountId) {
      monzoAccountIdInput.value = monzoState.accountId || "";
    }
  }

  if (monzoAccessTokenInput && monzoState.configured) {
    monzoAccessTokenInput.placeholder = "Access token loaded for this helper session";
  }

  if (monzoAuthenticatedValue) {
    monzoAuthenticatedValue.textContent = monzoState.configured ? "Yes" : "No";
  }

  if (monzoAccountSummary) {
    const balanceText =
      typeof monzoState.balanceAmountMinor === "number"
        ? ` - balance ${formatMonzoExpenseAmount(monzoState.balanceAmountMinor, monzoState.balanceCurrency || "GBP")}`
        : "";
    const sourceText =
      monzoState.connectionProvider === "truelayer" && monzoState.accountDescription
        ? `${monzoState.accountDescription} via legacy TrueLayer`
        : monzoState.accountDescription || "Demo spending preview";
    monzoAccountSummary.textContent = `${sourceText}${balanceText}`;
  }

  const activeMonzoView =
    monzoView === "weekly" || monzoView === "type" || monzoView === "big"
      ? monzoView
      : "list";

  monzoViewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.monzoView === activeMonzoView);
  });

  monzoExpensesList.innerHTML = "";
  monzoWeekly.innerHTML = "";
  monzoType.innerHTML = "";

  const hasExpenses = Array.isArray(effectiveExpenses) && effectiveExpenses.length > 0;

  const showingList = activeMonzoView === "list";
  const showingWeekly = activeMonzoView === "weekly";
  const showingType = activeMonzoView === "type";
  const showingBig = activeMonzoView === "big";

  monzoExpensesList.hidden = (!showingList && !showingBig);
  monzoWeekly.hidden = !showingWeekly;
  monzoType.hidden = !showingType;
  monzoEmptyState.hidden = hasExpenses;

  let listExpenses = effectiveExpenses;
  if (showingBig) {
    listExpenses = effectiveExpenses.filter((expense) => Number(expense.amountMinor || 0) > MONZO_BIG_PURCHASE_THRESHOLD_MINOR);
  }

  listExpenses.forEach((expense) => {
    const item = document.createElement("li");
    item.className = "monzo-expense-item";

    const amount = formatMonzoExpenseAmount(expense.amountMinor, expense.currency);
    const created = formatMonzoExpenseDate(expense.created || expense.settled);

    item.innerHTML = `
      <div class="monzo-expense-copy">
        <p class="monzo-expense-title">${escapeHtml(expense.merchantName || expense.description || "Expense")}</p>
        <p class="monzo-expense-meta">${escapeHtml(created)}${expense.category ? ` • ${escapeHtml(expense.category)}` : ""}</p>
      </div>
      <p class="monzo-expense-amount">${escapeHtml(amount)}</p>
    `;
    monzoExpensesList.append(item);
  });

  if (hasExpenses && showingWeekly) {
    renderMonzoWeekly(effectiveExpenses, monzoWeekly);
  } else if (hasExpenses && showingType) {
    renderMonzoType(effectiveExpenses, monzoType);
  }
}

function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function createCalendarEventNode(event) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const startMinute = start.getHours() * 60 + start.getMinutes();
  const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60000);
  const isReadOnly = event.readOnly === true || event.source === "outlook";

  const node = document.createElement("button");
  node.className = "calendar-event";
  if (event.isDeadline) {
    node.className += " calendar-event-deadline";
  } else if (event.parentId) {
    node.className += " calendar-event-subevent";
  }
  if (isReadOnly) {
    node.className += " calendar-event-imported";
  }

  node.type = "button";
  node.dataset.eventId = event.id;
  node.dataset.eventReadOnly = String(isReadOnly);
  node.dataset.eventSource = String(event.source || "");
  node.style.top = `${(startMinute / 60) * CALENDAR_HOUR_HEIGHT}px`;
  node.style.height = `${Math.max(28, (durationMinutes / 60) * CALENDAR_HOUR_HEIGHT)}px`;
  node.innerHTML = isReadOnly
    ? `
      <span class="calendar-event-title">${escapeHtml(event.title || "New event")}</span>
      <span class="calendar-event-time">${formatCalendarEventTime(start, end)}</span>
      <span class="calendar-event-time">Outlook</span>
    `
    : `
      <span class="calendar-event-resize-handle calendar-event-resize-handle-start" data-resize-direction="start" aria-hidden="true"></span>
      <span class="calendar-event-title">${escapeHtml(event.title || "New event")}</span>
      <span class="calendar-event-time">${formatCalendarEventTime(start, end)}</span>
      <span class="calendar-event-resize-handle calendar-event-resize-handle-end" data-resize-direction="end" aria-hidden="true"></span>
    `;
  return node;
}

function createCalendarDraftNode(draftEvent) {
  const node = document.createElement("div");
  node.className = "calendar-event calendar-event-draft";
  node.style.top = `${(draftEvent.startMinute / 60) * CALENDAR_HOUR_HEIGHT}px`;
  node.style.height = `${Math.max(28, ((draftEvent.endMinute - draftEvent.startMinute) / 60) * CALENDAR_HOUR_HEIGHT)}px`;
  node.innerHTML = `<span class="calendar-event-title">${escapeHtml(draftEvent.title || "New event")}</span><span class="calendar-event-time">${formatCalendarDraftTime(draftEvent.startMinute, draftEvent.endMinute)}</span>`;
  return node;
}

function formatCalendarHour(hour) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(date);
}

function formatCalendarDayName(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function formatCalendarDayDate(date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatCalendarRange(date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatCalendarEventTime(start, end) {
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatCalendarDraftTime(startMinute, endMinute) {
  const start = new Date();
  start.setHours(0, startMinute, 0, 0);
  const end = new Date();
  end.setHours(0, endMinute, 0, 0);
  return formatCalendarEventTime(start, end);
}

function formatMonzoExpenseAmount(amountMinor, currency) {
  const amount = Number(amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "GBP"
    }).format(amount);
  } catch {
    return `${currency || "GBP"} ${amount.toFixed(2)}`;
  }
}

function formatMonzoExpenseDate(value) {
  const parsed = new Date(value || Date.now());
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function renderMonzoType(expenses, root) {
  const totals = new Map();
  expenses.forEach((expense) => {
    const key = expense.category || "uncategorised";
    totals.set(key, (totals.get(key) || 0) + Number(expense.amountMinor || 0));
  });

  const entries = Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);
  const maxAmount = entries[0]?.[1] || 1;

  entries.forEach(([category, amountMinor]) => {
    const row = document.createElement("div");
    row.className = "monzo-graph-row";

    const label = document.createElement("div");
    label.className = "monzo-graph-label";
    label.textContent = category.replaceAll("_", " ");

    const track = document.createElement("div");
    track.className = "monzo-graph-track";

    const bar = document.createElement("div");
    bar.className = "monzo-graph-bar";
    bar.style.width = `${Math.max(10, (Math.abs(amountMinor) / Math.abs(maxAmount)) * 100)}%`;
    track.append(bar);

    const value = document.createElement("div");
    value.className = "monzo-graph-value";
    value.textContent = formatMonzoExpenseAmount(amountMinor, expenses[0]?.currency || "GBP");

    row.append(label, track, value);
    root.append(row);
  });
}

function renderMonzoWeekly(expenses, root) {
  const totals = new Map();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  days.forEach(day => totals.set(day, 0));

  expenses.forEach((expense) => {
    const date = new Date(expense.created || expense.settled);
    const dayName = days[date.getDay()];
    totals.set(dayName, totals.get(dayName) + Number(expense.amountMinor || 0));
  });

  const entries = Array.from(totals.entries());
  const amounts = entries.map(e => Math.abs(e[1]));
  const maxAmount = Math.max(1, ...amounts);

  entries.forEach(([dayName, amountMinor]) => {
    const row = document.createElement("div");
    row.className = "monzo-graph-row";

    const label = document.createElement("div");
    label.className = "monzo-graph-label";
    label.textContent = dayName;

    const track = document.createElement("div");
    track.className = "monzo-graph-track";

    const bar = document.createElement("div");
    bar.className = "monzo-graph-bar";
    bar.style.width = `${Math.max(2, (Math.abs(amountMinor) / maxAmount) * 100)}%`;
    track.append(bar);

    const value = document.createElement("div");
    value.className = "monzo-graph-value";
    value.textContent = formatMonzoExpenseAmount(amountMinor, expenses[0]?.currency || "GBP");

    row.append(label, track, value);
    root.append(row);
  });
}

export function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function getStartOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return startOfDay(d);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function syncRandomAlertUi(alertState, todos, scheduleFormatter) {
  randomAlertToggle.setAttribute("aria-checked", String(alertState.enabled));

  if (!alertState.enabled) {
    randomAlertStatus.textContent = "Disabled";
    return;
  }

  if (!todos.some((todo) => !todo.completed)) {
    randomAlertStatus.textContent = "Enabled, waiting for an active task";
    return;
  }

  if (!alertState.nextAlertAt) {
    randomAlertStatus.textContent = "Enabled every 1 to 3 hours";
    return;
  }

  randomAlertStatus.textContent = `Next prompt scheduled around ${scheduleFormatter.format(new Date(alertState.nextAlertAt))}`;
}

function syncDraftableInput(input, nextValue) {
  const normalizedValue = nextValue || "";
  const currentValue = input.value;
  const lastSyncedValue = input.dataset.syncedValue || "";

  if (currentValue === normalizedValue) {
    input.dataset.syncedValue = normalizedValue;
    return;
  }

  const hasUnsavedChanges = currentValue !== lastSyncedValue;
  if (document.activeElement === input || hasUnsavedChanges) {
    return;
  }

  input.value = normalizedValue;
  input.dataset.syncedValue = normalizedValue;
}

export function syncOutlookUi(outlookState) {
  if (outlookStatusValue) {
    if (!outlookState.email || !outlookState.icsUrl) {
      outlookStatusValue.textContent = "Not configured";
    } else if (outlookState.lastSyncResult) {
      outlookStatusValue.textContent = outlookState.lastSyncResult;
    } else {
      outlookStatusValue.textContent = "Configuration saved for Outlook calendar sync";
    }
  }

  if (outlookEmailInput) {
    syncDraftableInput(outlookEmailInput, outlookState.email || "");
  }

  if (outlookIcsUrlInput) {
    syncDraftableInput(outlookIcsUrlInput, outlookState.icsUrl || "");
  }

  if (outlookSyncModeSelect) {
    outlookSyncModeSelect.value = outlookState.syncMode || "outlook-to-today";
  }

  if (outlookAutoSyncToggle) {
    outlookAutoSyncToggle.setAttribute("aria-checked", String(outlookState.autoSyncEnabled));
    outlookAutoSyncToggle.disabled = !outlookState.email || !outlookState.icsUrl;
  }

  if (outlookAutoSyncStatus) {
    if (!outlookState.email || !outlookState.icsUrl) {
      outlookAutoSyncStatus.textContent = "Save the Outlook calendar settings first";
    } else if (outlookState.autoSyncEnabled) {
      outlookAutoSyncStatus.textContent = "On while the app imports the Outlook ICS feed";
    } else {
      outlookAutoSyncStatus.textContent = "Off";
    }
  }
}

export function syncTestPushUi(alertState, pushSubscription, scheduleFormatter) {
  if (!testPushToggle || !testPushStatus) {
    return;
  }

  testPushToggle.setAttribute("aria-checked", String(alertState.testPushEnabled));

  if (!alertState.testPushEnabled) {
    testPushStatus.textContent = "Disabled";
    return;
  }

  if (!pushSubscription) {
    testPushStatus.textContent = "Enabled every 10 seconds, awaiting Web Push";
    return;
  }

  if (!alertState.nextTestPushAt) {
    testPushStatus.textContent = "Enabled every 10 seconds";
    return;
  }

  testPushStatus.textContent = `Enabled, next push around ${scheduleFormatter.format(new Date(alertState.nextTestPushAt))}`;
}

export function syncNotificationUi({ pushSubscription, pushSupported }) {
  const ui = getNotificationUiElements();
  if (!ui.button) {
    return;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    if (ui.status) ui.status.textContent = "Unavailable on this browser";
    if (ui.pushValue) ui.pushValue.textContent = "Not supported";
    ui.button.setAttribute("aria-checked", "false");
    ui.button.disabled = true;
    return;
  }

  if (isIosLikeDevice() && !isStandaloneApp()) {
    if (ui.status) ui.status.textContent = "Install to Home Screen first";
    if (ui.pushValue) ui.pushValue.textContent = "Install to Home Screen first";
    ui.button.setAttribute("aria-checked", "false");
    ui.button.disabled = true;
    return;
  }

  if (Notification.permission === "denied") {
    if (ui.status) ui.status.textContent = "Blocked in browser settings";
    if (ui.pushValue) ui.pushValue.textContent = "Blocked in browser settings";
    ui.button.setAttribute("aria-checked", "false");
    ui.button.disabled = true;
    return;
  }

  if (pushSubscription) {
    if (ui.status) ui.status.textContent = "Enabled";
    if (ui.pushValue) ui.pushValue.textContent = "Enabled";
    ui.button.setAttribute("aria-checked", "true");
    ui.button.disabled = false;
    return;
  }

  const unavailable = !pushSupported;
  if (ui.status) ui.status.textContent = pushSupported ? "In-app popups only" : "Unavailable on this browser";
  if (ui.pushValue) ui.pushValue.textContent = pushSupported ? "Not enabled" : "Not supported";
  ui.button.setAttribute("aria-checked", "false");
  ui.button.disabled = unavailable;
}

function getNotificationUiElements() {
  return {
    status: document.querySelector("#notification-status") || notificationStatus,
    button: document.querySelector("#notification-button") || notificationButton,
    pushValue: document.querySelector("#notification-push-value") || notificationPushValue
  };
}

export { applyUiTheme } from "../ui/theme.js";

export function syncSyncStatusUi({ mutationQueue, syncIssues, isServerReachable, isSyncInFlight }) {
  const queuedCount = mutationQueue.length;
  const issueCount = syncIssues.length;
  let bannerMessage = "";
  let bannerState = "online";
  let statusMessage = "Stored on this device";

  void queuedCount;
  void isServerReachable;
  void isSyncInFlight;

  if (issueCount > 0) {
    bannerMessage = `${issueCount} local data issue${issueCount === 1 ? "" : "s"} need review.`;
    bannerState = "issues";
  }

  if (syncBanner) {
    syncBanner.hidden = !bannerMessage;
    syncBanner.textContent = bannerMessage;
    syncBanner.dataset.syncState = bannerState;
  }

  if (syncStatusValue) {
    syncStatusValue.textContent = statusMessage;
  }

  if (syncIssuesRow) {
    syncIssuesRow.hidden = issueCount === 0;
  }

  if (syncIssuesValue) {
    syncIssuesValue.textContent = issueCount === 0
      ? "No local data issues"
      : syncIssues.map((issue) => issue.message).join(" ");
  }
}

export function showToast(title, message, toastDurationMs) {
  const toast = document.createElement("article");
  toast.className = "toast";

  const heading = document.createElement("strong");
  heading.className = "toast-title";
  heading.textContent = title;

  const copy = document.createElement("p");
  copy.className = "toast-copy";
  copy.textContent = message;

  toast.append(heading, copy);
  toastStack.append(toast);

  const dismissToast = () => {
    if (!toast.isConnected || toast.classList.contains("is-hiding")) {
      return;
    }

    toast.classList.add("is-hiding");
    window.setTimeout(() => toast.remove(), 220);
  };

  toast.addEventListener("click", dismissToast);

  window.setTimeout(dismissToast, toastDurationMs);
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosLikeDevice() {
  const ua = window.navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}
