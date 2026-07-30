import { ApiError, apiFetch } from "./modules/api.js";
import { initializeShell } from "./app/bootstrap.js";
import {
  base64PayloadToBlob,
  blobToBase64Payload,
  collectBackupManifest,
  createBackupRegistry,
  describeBackupManifest,
  downloadBackupManifest,
  readBackupFile,
  restoreBackupManifest
} from "./app/backup.js";
import {
  applyActivePageChange,
  applyRssPanelChange,
  applySettingsPanelChange,
  loadStoredActivePage
} from "./app/navigation.js";
import { buildSyncUiState, publishAppBridgeState as publishRuntimeAppBridgeState, readAppBridgeState } from "./app/feature-sync.js";
import { createPageButtonRegistry } from "./app/pages.js";
import {
  CALENDAR_EVENTS_STORAGE_KEY,
  loadCalendarEvents,
} from "./app/calendar.js";
import {
  cloneLongTermGoal,
  createHabitEntry,
  createLongTermGoal,
  createLongTermSubgoal,
  formatGoalTimeframeParts,
  loadLongTermGoals,
  normalizeGoalTimeframe,
  normalizeGoalTimeframeParts,
  normalizeGoalTimeframeUnit,
  normalizeGoalTimeframeValue,
  normalizeHabit,
  normalizeLongTermGoal,
  normalizeLongTermSubgoal,
  parseGoalTimeframeParts,
} from "./app/habits.js";
import {
  bindGoalCallbacks,
  getLongTermGoalById,
  handleGoalAddSubmit,
  handleGoalsListChange,
  handleGoalsListClick,
  handleGoalsListSubmit,
  LONG_TERM_GOALS_DELETED_IDS_KEY,
  LONG_TERM_GOALS_STORAGE_KEY,
  longTermGoals,
  removeLongTermGoal,
  setLongTermGoals,
} from "./app/goals.js";
import {
  bindCalendarOpsCallbacks,
  calendarDraftEvent,
  calendarEvents,
  calendarSelectedDate,
  calendarStartDate,
  cancelCalendarDrag,
  closeCalendarEventEditor,
  createCalendarEventFromComposer,
  handleCalendarDateChange,
  handleCalendarEventClick,
  handleCalendarEventEditorSubmit,
  handleCalendarNextRange,
  handleCalendarPointerDown,
  handleCalendarPointerMove,
  handleCalendarPointerUp,
  handleCalendarPreviousRange,
  openCalendarEventEditor,
  setCalendarDraftEvent,
  setCalendarEvents,
} from "./app/calendar-ops.js";
import {
  bindSwipeGestureCallbacks,
  bindPageSwipeNavigation,
  reloadApp,
} from "./app/swipe-gestures.js";
import {
  bindHabitsOpsCallbacks,
  computeHabitCurrentStreak,
  habits,
  handleHabitAddSubmit,
  handleHabitsListClick,
  HABITS_DELETED_IDS_KEY,
  HABITS_STORAGE_KEY,
  removeHabit,
  saveHabits,
  setHabits,
  setHabitGoal,
  toggleHabitCompletion,
} from "./app/habits-ops.js";
import {
  bindMonzoLocalCallbacks,
  loadMonzoLocalState,
  persistMonzoLocalState,
  resolveOptionButton,
} from "./app/monzo-local-state.js";
import {
  bindTodoSwipeCallbacks,
  clearTaskCompletingState,
  completingTaskIds,
  enteringTaskIds,
  finishSwipeGesture,
  handleTodoPointerDown,
  handleTodoPointerMove,
  isSwipeGestureActive,
  markTaskAsCompleting,
  markTaskAsEntering,
} from "./app/todo-swipe.js";
import {
  bindMonzoSettingsCallbacks,
  consumeBankingStartupStatus,
  handleBankingCsvImport,
  handleBankingDisconnect,
  handleEnableBankingConnect,
  handleEnableBankingInstitutionLoad,
  handleMonzoSettingsSave,
  handleTrueLayerMonzoConnect,
  refreshMonzoExpenses,
} from "./app/monzo-settings.js";
import {
  bindBackupHelperCallbacks,
  buildServerBackupSection,
  collectBooksBackupSection,
  decodeBooksBackupSection,
  restoreMonzoLocalBackupSection,
  restoreUiBackupSection,
  setBackupStatus,
} from "./app/backup-helpers.js";
import {
  bindBackupIoCallbacks,
  handleBackupExport,
  handleBackupFileSelection,
} from "./app/backup-io.js";
import {
  clearLocalDataBackupSection,
  collectLocalDataBackupSection,
  restoreLocalDataBackupSection,
} from "./app/backup-local-data.js";
import {
  bindPushAlertsCallbacks,
  claimAlerts,
  handleNotificationToggle,
  handleRandomAlertToggle,
  handleTestPushToggle,
  handleUrgentNotificationTestToggle,
  startAlertClaimLoop,
  syncPushSubscription,
} from "./app/push-alerts.js";
import {
  bindOutlookCallbacks,
  getImportedOutlookEvents,
  handleOutlookAutoSyncToggle,
  handleOutlookSettingsSave,
  refreshOutlookCalendar,
  resetOutlookSyncState,
  startOutlookCalendarSyncLoop,
} from "./app/outlook.js";
import {
  bindTaskHandlerCallbacks,
  clearCompletedTasks,
  handleAddTaskSubmit,
  handleImportSubmit,
  handleTodoInputKeyDown,
  handleTodoListClick,
} from "./app/task-handlers.js";
import { createBooksFeature } from "./features/books/index.js";
import { createNotesFeature } from "./features/notes/index.js";
import { createRssFeature } from "./features/rss/index.js";
import { syncRssNewsNotificationSettings } from "./features/rss/news-notifications.js";
import {
  backToTasksButton,
  clearCompletedSettingsButton,
  desktopMailboxComposeButton,
  dismissSyncIssuesButton,
  importLocalHelperButton,
  calendarDateInput,
  calendarGrid,
  calendarNextButton,
  calendarPrevButton,
  filterButtons,
  monzoAccessTokenInput,
  monzoViewButtons,
  monzoAccountIdInput,
  openBooksButton,
  openCalendarButton,
  openDashboardButton,
  openMonzoButton,
  openHabitsButton,
  openNotesButton,
  openProjectsButton,
  openTasksButton,
  openRssButton,
  openSettingsButton,
  outlookAutoSyncToggle,
  outlookIcsUrlInput,
  outlookEmailInput,
  outlookSyncModeSelect,
  randomAlertToggle,
  settingsPanelBackButtons,
  settingsPanelLinks,
  reloadAppButton,
  saveMonzoSettingsButton,
  saveOutlookSettingsButton,
  scheduleFormatter,
  refreshMonzoExpensesButton,
  trueLayerConnectButtons,
  accentPickers,
  accentOptionButtons,
  fontOptionButtons,
  modeOptionButtons,
  uiGlassToggle,
  uiFontStatus,
  uiCustomBackgroundInput,
  uiCustomCardTransparencyInput,
  uiCustomTransparencyInput,
  saveUiCustomBackgroundButton,
  clearUiCustomBackgroundButton,
  taskListRegion,
  themeSwitchers,
  themeOptionButtons,
  testPushToggle,
  habitAddButton,
  habitNameInput,
  habitSubmitButton,
  habitsAddForm,
  habitsBestStreakValue,
  habitsCompletedTodayValue,
  habitsEmptyState,
  habitsList,
  habitsTotalValue,
  goalsAddForm,
  goalsList,
} from "./modules/dom.js";
import {
  applyMutationToState,
  buildSyncIssueMessage,
  cloneState,
  createDefaultState,
  createUuid,
  getStateSignature,
  loadStoredJson,
  normalizeState,
  saveStoredJson,
  getFilteredTodos
} from "./modules/state.js";
import {
  getLocalAppStateStorageStatus,
  getLocalFeatureStateStorageStatus,
  getLocalVaultStatusSnapshot,
  readLocalAppState,
  readLocalBudgetState,
  readLocalDailyTimeline,
  writeLocalAppState,
  readLocalFeatureState,
  readLocalPlanDay,
  readLocalRitualsState,
  readLocalVerbatimState,
  readLocalMetadata,
  writeLocalBudgetState,
  writeLocalDailyTimeline,
  writeLocalFeatureState,
  writeLocalMetadata,
  writeLocalPlanDay,
  writeLocalRitualsState,
  writeLocalVerbatimState,
  writeNotificationSnapshot
} from "./modules/local-store.js";
import { ensureLocalVaultUnlocked } from "./modules/local-vault.js";
import {
  flushPendingWrites,
  installPendingWriteFlushLifecycle,
  registerPendingWriteFlusher,
} from "./modules/pending-writes.js";
import {
  getScopedLocalStorageItem,
  removeScopedLocalStorageItem,
  scopeStorageKey,
  setScopedLocalStorageItem
} from "./modules/storage-scope.js";
import {
  applyPageStates,
  bindWindowFrameSync,
  getAdjacentPageName,
  showToast,
  syncNotificationUi,
  syncPageChrome,
  syncRssPanelUi,
  syncSettingsPanelUi,
  syncSyncStatusUi,
  syncTestPushUi
} from "./modules/ui.js";
import {
  DEFAULT_UI_CUSTOM_BACKGROUND,
  DEFAULT_UI_CUSTOM_CARD_TRANSPARENCY,
  DEFAULT_UI_CUSTOM_TRANSPARENCY,
  defaultUiModeForTheme,
  isSelectableUiMode,
  cordycepsUnderlayEnabled,
  liquidGlassEnabled,
  selectUiAccent,
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
  uiAccent,
  uiCustomBackground,
  uiCustomCardTransparency,
  uiCustomTransparency,
  uiFont,
  uiMode,
  uiTheme,
} from "./app/ui-theme.js";
import { registerServiceWorker } from "./modules/push.js";

installPendingWriteFlushLifecycle();

const TOAST_DURATION_MS = 5000;
const LOCAL_ALERT_CLAIM_INTERVAL_MS = 30000;
const REMOTE_ALERT_CLAIM_INTERVAL_MS = 90000;
const LOCAL_DEV_RELOAD_INTERVAL_MS = 1000;
const REMOTE_DEV_RELOAD_INTERVAL_MS = 5000;
const LOCAL_STATE_SYNC_INTERVAL_MS = 5000;
const REMOTE_STATE_SYNC_INTERVAL_MS = 15000;
const SERVER_SYNC_FAILURE_LIMIT = 3;
const SERVER_SYNC_PAUSE_MS = 60000;
const ACCOUNT_CLIENT_SYNC_PAUSE_MS = 30000;
const OUTLOOK_CALENDAR_SYNC_INTERVAL_MS = 60 * 1000;
const SETTINGS_PANELS = new Set(["root", "notifications", "appearance", "sync", "app", "import"]);
const APP_BUILD_ID = "20260324-112";
const NOTES_STORAGE_KEY = "today.todo.notes.v1";
const NOTES_MODE_STORAGE_KEY = "today.todo.notes.mode.v1";
const BOOKS_ACTIVE_BOOK_STORAGE_KEY = "today.todo.books.active-book.v1";
const RSS_FEED_STORAGE_KEY = "today.todo.rss-feed.v1";
const PLAN_STORAGE_KEY = "today.plan-your-day.v1";
const PLAN_BLOCK_REMINDER_MINUTES_KEY = "today.plan-your-day.block-reminder-minutes.v1";
const BOOKS_DB_NAME = "today.todo.books.v1";
const BOOKS_DB_VERSION = 1;
const BOOKS_STORE_NAME = "books";
const DEFAULT_RSS_FEED_URLS = [
  "https://hnrss.org/frontpage",
  "https://feeds.bbci.co.uk/news/rss.xml?edition=uk"
];
const APP_STATE_STORAGE_KEY = "today.todo.cached-state.v1";
const FIRST_RUN_PLACEHOLDERS_STORAGE_KEY = "today.todo.first-run-placeholders.v1";
const STARTER_DATA_QUERY_PARAM = "starterData";
const STARTER_DATA_QUERY_VALUE = "1";
const ACTIVE_PAGE_STORAGE_KEY = "today.todo.active-page.v1";
const MUTATION_QUEUE_STORAGE_KEY = "today.todo.mutation-queue.v1";
const SYNC_ISSUES_STORAGE_KEY = "today.todo.sync-issues.v1";
const DANGER_MODE_STORAGE_KEY = "today.todo.danger-mode.v1";
const DANGER_MODE_LEGACY_DEADLINES_STORAGE_KEY = "today.todo.danger-mode.deadlines.v1";
const DANGER_MODE_CYCLE_DEADLINE_STORAGE_KEY = "today.todo.danger-mode.cycle-deadline.v1";
const DANGER_MODE_DESTROYED_TASK_IDS_KEY = "today.todo.danger-mode.destroyed-task-ids.v1";
const DANGER_MODE_EVENT = "city-tasks:danger-mode-change";
const DANGER_MODE_DESTROY_AFTER_MS = 24 * 60 * 60 * 1000;
const OFFLINE_MIGRATION_COMPLETE_KEY = "offlineMigration.v1.complete";
const OFFLINE_MIGRATION_STATUS_KEY = "offlineMigration.v1.status";
const LEGACY_SCOPED_STORAGE_PREFIX = "cordyceps.workspace.";
const LEGACY_DAILY_TIMELINE_STORAGE_PREFIX = "today.daily.timeline.v1.";
const TEST_PUSH_INTERVAL_SECONDS = 10;
const SHELL_STATE_EVENT = "city-shell:state";
const SHELL_NAVIGATION_EVENT = "city-shell:navigate";
const NOTES_OPEN_DAILY_EVENT = "city-notes:open-daily";
const APP_RUNTIME_READY_EVENT = "city-app:runtime-ready";
const APP_SOFT_REFRESH_REQUEST_EVENT = "city-app:soft-refresh-request";
const APP_SOFT_REFRESH_COMPLETE_EVENT = "city-app:soft-refresh-complete";
const TOP_LEVEL_PAGES = new Set([
  "dashboard",
  "tasks",
  "settings",
  "notes",
  "books",
  "habits",
  "pomodoro",
  "flashcards",
  "spotify",
  "mycelia",
  "thendral",
  "calendar",
  "monzo",
  "housework",
  "daily",
  "rss",
  "plan-your-day"
]);

const HOME_PAGE = "dashboard";
const REMOTE_HOSTNAME_PATTERN = /\.(devtunnels\.ms|trycloudflare\.com)$/i;
const startupParams = new URLSearchParams(window.location.search);
const startupPage = startupParams.get("page");

let todos = [];
let activeFilter = "active";
let activePage = TOP_LEVEL_PAGES.has(startupPage)
  ? startupPage
  : loadStoredActivePage(ACTIVE_PAGE_STORAGE_KEY, TOP_LEVEL_PAGES, HOME_PAGE);
let activeSettingsPanel = "root";
let activeRssPanel = "root";
let alertState = {
  enabled: true,
  nextAlertAt: null,
  testPushEnabled: false,
  nextTestPushAt: null
};
let outlookState = {
  email: "",
  icsUrl: "",
  syncMode: "outlook-to-today",
  configured: false,
  autoSyncEnabled: false,
  lastSyncAt: null,
  lastSyncResult: null
};
let monzoState = {
  accountId: "",
  accountDescription: "",
  configured: false,
  lastSyncAt: null,
  lastSyncResult: null
};
const monzoLocalState = loadMonzoLocalState();
let monzoExpenses = monzoLocalState.expenses;
let monzoView = monzoLocalState.view;
let booksFeatureInitialized = false;
let accountBooksSectionLoaded = false;
let accountBooksSectionApplied = false;
let preservedAccountBooksSection = createEmptyAccountClientState().books;
let serviceWorkerRegistration = null;
let pushSubscription = null;
let pushSupported = false;
let pushConfig = null;
let devServerVersion = null;
let hasAnimatedPageTransition = true;
let lastStateSignature = "";
let hasReloadedForServiceWorkerUpdate = false;
let serverState = createDefaultState();
let mutationQueue = [];
let syncIssues = [];
let isServerReachable = true;
let isSyncInFlight = false;
let isStateSyncInFlight = false;
let serverSyncFailureCount = 0;
let serverSyncPausedUntil = 0;
let hasRequestedInitialRssRefresh = false;
let dangerModeTimer = null;
let pendingCoreStateWrite = Promise.resolve();
let localCoreStateLocked = false;
document.body.dataset.activeSettingsPanel = activeSettingsPanel;
document.body.dataset.activeRssPanel = activeRssPanel;
let notes = [];
setLongTermGoals(loadLongTermGoals());
bindGoalCallbacks({
  scheduleSync: () => scheduleAccountClientStateSync(),
  syncUI: () => syncFeatureUi(),
  toastDurationMs: TOAST_DURATION_MS,
  getHabits: () => habits,
  setHabits: (next) => setHabits(next),
  saveHabits: () => saveHabits(),
  setHabitGoal: (habitId, goalId) => setHabitGoal(habitId, goalId),
  setActivePage: (page) => setActivePage(page)
});
bindCalendarOpsCallbacks({
  scheduleSync: () => scheduleAccountClientStateSync(),
  syncUI: () => syncFeatureUi(),
  persistFeatureState: () => persistAccountClientStateImmediately()
});
bindSwipeGestureCallbacks({
  getActivePage: () => activePage,
  setActivePage: (page) => setActivePage(page),
  onPageEntry: (page) => pageButtonRegistry.handlePageEntry(page),
  canStartPageSwipeRegistry: () => pageButtonRegistry.canStartPageSwipe(),
  getSwipeGestureActive: () => isSwipeGestureActive()
});
bindHabitsOpsCallbacks({
  scheduleSync: () => scheduleAccountClientStateSync(),
  syncUI: () => syncFeatureUi(),
  setActivePage: (page) => setActivePage(page)
});
bindMonzoLocalCallbacks({
  scheduleSync: () => scheduleAccountClientStateSync(),
  getMonzoView: () => monzoView,
  getMonzoExpenses: () => monzoExpenses
});
bindTodoSwipeCallbacks({
  getTodos: () => todos,
  isDemoRuntimeMode: () => false,
  seedDemoServerState: () => seedDemoServerState(),
  performDemoMutation: (mutation) => {
    applyMutationToState(serverState, mutation, TEST_PUSH_INTERVAL_SECONDS);
    persistLocalCoreState();
    rebuildAppState();
  },
  performQueuedMutation: (mutation) => performQueuedMutation(mutation),
  render: () => render()
});
bindMonzoSettingsCallbacks({
  getMonzoState: () => monzoState,
  setMonzoState: (next) => {
    monzoState = { ...monzoState, ...(next && typeof next === "object" ? next : {}) };
    serverState = normalizeState({ ...serverState, monzo: monzoState, banking: monzoState });
    persistLocalCoreState();
  },
  getMonzoExpenses: () => monzoExpenses,
  setMonzoExpenses: (next) => { monzoExpenses = next; },
  setServerState: (state) => setServerState(state),
  syncUI: () => syncFeatureUi()
});
bindBackupHelperCallbacks({
  getTodos: () => todos,
  getAlertState: () => alertState,
  getOutlookState: () => outlookState,
  getMonzoState: () => monzoState,
  getBooksFeature: () => booksFeature,
  getMonzoView: () => monzoView,
  setMonzoView: (next) => { monzoView = next; },
  setMonzoExpenses: (next) => { monzoExpenses = next; }
});
bindBackupIoCallbacks({
  getAppVersion: () => APP_BUILD_ID,
  getBackupRegistry: () => backupRegistry,
  resetMutationState: () => {
    mutationQueue = [];
    syncIssues = [];
    saveStoredJson(MUTATION_QUEUE_STORAGE_KEY, mutationQueue);
    saveStoredJson(SYNC_ISSUES_STORAGE_KEY, syncIssues);
  },
  syncUI: () => syncFeatureUi()
});
bindPushAlertsCallbacks({
  getAlertState: () => alertState,
  setAlertState: (next) => { alertState = next; },
  getPushSupported: () => pushSupported,
  getPushSubscription: () => pushSubscription,
  setPushSubscription: (next) => { pushSubscription = next; },
  getServiceWorkerRegistration: () => serviceWorkerRegistration,
  getPushConfig: () => pushConfig,
  setPushConfig: (next) => { pushConfig = next; },
  isDemoRuntimeMode: () => false,
  clearDemoSyncState: () => clearDemoSyncState(),
  isServerSyncPaused: () => isServerSyncPaused(),
  setIsServerReachable: (v) => { isServerReachable = v; },
  markServerSyncSuccess: () => markServerSyncSuccess(),
  markServerSyncFailure: () => markServerSyncFailure(),
  setServerState: (state) => setServerState(state),
  getSyncUiState: () => getSyncUiState(),
  performQueuedMutation: (mutation) => performQueuedMutation(mutation),
  getAlertClaimIntervalMs: () => getAlertClaimIntervalMs(),
  syncUI: () => syncFeatureUi()
});
bindOutlookCallbacks({
  getOutlookState: () => outlookState,
  setServerState: (state) => setServerState(state),
  syncUI: () => syncFeatureUi(),
  isDemoRuntimeMode: () => false,
  clearDemoSyncState: () => clearDemoSyncState(),
  getOutlookCalendarSyncIntervalMs: () => OUTLOOK_CALENDAR_SYNC_INTERVAL_MS
});
bindTaskHandlerCallbacks({
  getTodos: () => todos,
  isDemoRuntimeMode: () => false,
  performDemoMutation: (mutation) => {
    applyMutationToState(serverState, mutation, TEST_PUSH_INTERVAL_SECONDS);
    persistLocalCoreState();
    rebuildAppState();
  },
  seedDemoServerState: () => seedDemoServerState(),
  performQueuedMutation: (mutation) => performQueuedMutation(mutation),
  enqueueMutation: (mutation) => enqueueMutation(mutation),
  processMutationQueue: () => processMutationQueue(),
  getMutationQueueLength: () => mutationQueue.length,
  isServerReachable: () => isServerReachable,
  isServerSyncPaused: () => isServerSyncPaused(),
  setIsServerReachable: (v) => { isServerReachable = v; },
  getSyncUiState: () => getSyncUiState(),
  setActivePage: (page) => setActivePage(page)
});
let featureBridgeReady = false;
let accountClientStateSyncHandle = null;
let accountClientStateSyncPromise = null;
let accountClientStateLoaded = false;
let runtimeReadySignaled = false;
let isApplyingAccountClientState = false;
let lastAccountClientStateSignature = "";
let accountClientStateSyncPausedUntil = 0;

function signalRuntimeReady() {
  if (runtimeReadySignaled) {
    return;
  }
  runtimeReadySignaled = true;
  window.__cordyAccountStateLoaded = true;
  window.dispatchEvent(new CustomEvent(APP_RUNTIME_READY_EVENT, {
    detail: { readyAt: new Date().toISOString() }
  }));
}
const booksFeature = createBooksFeature({
  storageKey: BOOKS_ACTIVE_BOOK_STORAGE_KEY,
  dbName: BOOKS_DB_NAME,
  dbVersion: BOOKS_DB_VERSION,
  storeName: BOOKS_STORE_NAME,
  createUuid,
  toast: showToast,
  toastDurationMs: TOAST_DURATION_MS,
  setActivePage,
  onStateChange() {
    if (featureBridgeReady) {
      syncFeatureUi();
      scheduleAccountClientStateSync();
    }
  }
});
const notesFeature = createNotesFeature({
  storageKey: NOTES_STORAGE_KEY,
  modeStorageKey: NOTES_MODE_STORAGE_KEY,
  createUuid,
  loadStoredJson,
  saveStoredJson,
  setActivePage,
  encryptedModeAvailable: true,
  showToast,
  toastDurationMs: TOAST_DURATION_MS,
  onStateChange(snapshot, options = {}) {
    notes = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
    if (featureBridgeReady) {
      syncFeatureUi();
      scheduleAccountClientStateSync();
    }
  }
});
const rssFeature = createRssFeature({
  storageKey: RSS_FEED_STORAGE_KEY,
  defaultFeedUrls: DEFAULT_RSS_FEED_URLS,
  createUuid,
  loadStoredJson,
  saveStoredJson,
  showToast,
  toastDurationMs: TOAST_DURATION_MS,
  apiFetch,
  ApiError,
  syncUi: () => {
    syncFeatureUi();
    scheduleAccountClientStateSync();
  },
  syncNewsNotificationSettings: (snapshot) => syncRssNewsNotificationSettings(snapshot),
  setActiveRssPanel
});
void syncRssNewsNotificationSettings(rssFeature.getSnapshot());
const pageButtonRegistry = createPageButtonRegistry({
  buttons: {
    openBooksButton,
    openCalendarButton,
    openDashboardButton,
    openMonzoButton,
    openHabitsButton,
    openNotesButton,
    openProjectsButton,
    openTasksButton,
    openRssButton,
    openSettingsButton
  },
  getActivePage: () => activePage,
  getActiveSettingsPanel: () => activeSettingsPanel,
  getActiveRssPanel: () => activeRssPanel,
  setActivePage,
  setActiveSettingsPanel,
  setActiveRssPanel,
  booksFeature,
  notesFeature,
  monzo: {
    isConfigured() {
      return monzoState.configured;
    },
    isEmpty() {
      return monzoExpenses.length === 0;
    },
    refresh(options) {
      return refreshMonzoExpenses(options);
    }
  },
  rss: rssFeature
});
featureBridgeReady = true;
window.__cityRssPanel = {
  setActivePanel(panel) {
    setActiveRssPanel(panel);
  }
};

const backupRegistry = createBackupRegistry([
  {
    sectionKey: "serverState",
    collectBackupSection: async () => buildServerBackupSection(),
    restoreBackupSection: async (section) => {
      setServerState(section);
    }
  },
  {
    sectionKey: "notes",
    collectBackupSection: async () => notesFeature.getBackupSnapshot ? notesFeature.getBackupSnapshot() : null,
    clearSection: async () => {
      notesFeature.restoreBackupSnapshot?.({
        mode: "lite",
        activeEntryId: null,
        liteEntries: []
      });
    },
    restoreBackupSection: async (section) => {
      notesFeature.restoreBackupSnapshot?.(section);
    }
  },
  {
    sectionKey: "habits",
    collectBackupSection: async () => ({ items: Array.isArray(habits) ? habits.map((habit) => ({ ...habit })) : [] }),
    clearSection: async () => {
      setHabits([]);
      saveHabits();
    },
    restoreBackupSection: async (section) => {
      setHabits(Array.isArray(section?.items) ? section.items : []);
      saveHabits();
    }
  },
  {
    sectionKey: "longTermGoals",
    collectBackupSection: async () => ({
      items: Array.isArray(longTermGoals) ? longTermGoals.map((goal) => cloneLongTermGoal(goal)) : [],
      deletedIds: loadStoredJson(LONG_TERM_GOALS_DELETED_IDS_KEY, []).map((id) => String(id || "")).filter(Boolean)
    }),
    clearSection: async () => {
      setLongTermGoals([]);
      saveStoredJson(LONG_TERM_GOALS_STORAGE_KEY, []);
      saveStoredJson(LONG_TERM_GOALS_DELETED_IDS_KEY, []);
    },
    restoreBackupSection: async (section) => {
      const deletedGoalIds = Array.isArray(section?.deletedIds)
        ? section.deletedIds.map((id) => String(id || "")).filter(Boolean)
        : [];
      setLongTermGoals(
        Array.isArray(section?.items)
          ? section.items
            .map(normalizeLongTermGoal)
            .filter((goal) => goal.title && !deletedGoalIds.includes(goal.id))
          : []
      );
      saveStoredJson(LONG_TERM_GOALS_STORAGE_KEY, longTermGoals);
      saveStoredJson(LONG_TERM_GOALS_DELETED_IDS_KEY, deletedGoalIds);
    }
  },
  {
    sectionKey: "calendar",
    collectBackupSection: async () => ({ events: Array.isArray(calendarEvents) ? calendarEvents.map((event) => ({ ...event })) : [] }),
    clearSection: async () => {
      setCalendarEvents([]);
      setCalendarDraftEvent(null);
      saveStoredJson(CALENDAR_EVENTS_STORAGE_KEY, calendarEvents);
    },
    restoreBackupSection: async (section) => {
      setCalendarEvents(Array.isArray(section?.events) ? section.events : []);
      setCalendarDraftEvent(null);
      saveStoredJson(CALENDAR_EVENTS_STORAGE_KEY, calendarEvents);
    }
  },
  {
    sectionKey: "books",
    collectBackupSection: async () => {
      await ensureBooksFeatureInitialized();
      return collectBooksBackupSection();
    },
    clearSection: async () => {
      await ensureBooksFeatureInitialized();
      await booksFeature.clearLibrary?.();
    },
    restoreBackupSection: async (section) => {
      await ensureBooksFeatureInitialized();
      await booksFeature.restoreBackupSnapshot?.(decodeBooksBackupSection(section));
    }
  },
  {
    sectionKey: "rss",
    collectBackupSection: async () => rssFeature.getBackupSnapshot ? rssFeature.getBackupSnapshot() : null,
    clearSection: async () => {
      rssFeature.restoreBackupSnapshot?.({
        feeds: [],
        activeFeedId: "all"
      });
    },
    restoreBackupSection: async (section) => {
      rssFeature.restoreBackupSnapshot?.(section);
    }
  },
  {
    sectionKey: "monzoLocal",
    collectBackupSection: async () => ({
      view: monzoView,
      expenses: Array.isArray(monzoExpenses) ? monzoExpenses.map((expense) => ({ ...expense })) : []
    }),
    clearSection: async () => {
      restoreMonzoLocalBackupSection({
        view: "list",
        expenses: []
      });
    },
    restoreBackupSection: async (section) => {
      restoreMonzoLocalBackupSection(section);
    }
  },
  {
    sectionKey: "uiPreferences",
    collectBackupSection: async () => ({
      uiTheme,
      uiMode,
      uiAccent,
      uiFont,
      liquidGlassEnabled,
      cordycepsUnderlayEnabled,
      uiCustomBackground,
      uiCustomTransparency,
      uiCustomCardTransparency
    }),
    clearSection: async () => {
      restoreUiBackupSection({
        uiTheme: "cybrland",
        uiMode: defaultUiModeForTheme("cybrland"),
        uiAccent: "aqua",
        uiFont: "serif",
        liquidGlassEnabled: false,
        cordycepsUnderlayEnabled: false,
        uiCustomBackground: DEFAULT_UI_CUSTOM_BACKGROUND,
        uiCustomTransparency: DEFAULT_UI_CUSTOM_TRANSPARENCY,
        uiCustomCardTransparency: DEFAULT_UI_CUSTOM_CARD_TRANSPARENCY
      });
    },
    restoreBackupSection: async (section) => {
      restoreUiBackupSection(section);
    }
  },
  {
    sectionKey: "localData",
    collectBackupSection: async () => collectLocalDataBackupSection(),
    clearSection: async () => {
      await clearLocalDataBackupSection();
    },
    restoreBackupSection: async (section) => {
      await restoreLocalDataBackupSection(section);
    }
  }
]);

function createEmptyAccountClientState() {
  return {
    notes: {
      mode: "lite",
      activeEntryId: null,
      liteEntries: []
    },
    habits: {
      items: [],
      deletedIds: []
    },
    longTermGoals: {
      items: [],
      deletedIds: []
    },
    calendar: {
      events: []
    },
    books: {
      activeBookId: "",
      books: []
    },
    rss: {
      feeds: [],
      activeFeedId: "all"
    },
    monzoLocal: {
      view: "list",
      expenses: []
    }
  };
}

function hasMeaningfulAccountClientState(payload) {
  return JSON.stringify(payload || {}) !== JSON.stringify(createEmptyAccountClientState());
}

function hasMeaningfulCoreState(payload) {
  return getStateSignature(normalizeState(payload)) !== getStateSignature(createDefaultState());
}

function hasDurableAccountClientStateData(payload) {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    Object.keys(payload).length > 0 &&
    hasMeaningfulAccountClientState(payload)
  );
}

function hasMeaningfulLegacyStorageValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function readLegacyScopedJsonValue(rawKey) {
  try {
    const raw = getScopedLocalStorageItem(rawKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getLegacyScopedLogicalKey(storageKey, rawPrefix) {
  if (!storageKey || !storageKey.startsWith(LEGACY_SCOPED_STORAGE_PREFIX)) {
    return null;
  }
  const remainder = storageKey.slice(LEGACY_SCOPED_STORAGE_PREFIX.length);
  const separatorIndex = remainder.indexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }
  const logicalKey = remainder.slice(separatorIndex + 1);
  return logicalKey.startsWith(rawPrefix) ? logicalKey : null;
}

function collectLegacyScopedJsonEntries(rawPrefix) {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const currentScopedPrefix = scopeStorageKey(rawPrefix);
  const entriesByLogicalKey = new Map();

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey) {
      continue;
    }

    const logicalKey = storageKey.startsWith(rawPrefix)
      ? storageKey
      : getLegacyScopedLogicalKey(storageKey, rawPrefix);
    if (!logicalKey) {
      continue;
    }

    const priority = storageKey === `${currentScopedPrefix}${logicalKey.slice(rawPrefix.length)}`
      ? 3
      : storageKey.startsWith(LEGACY_SCOPED_STORAGE_PREFIX)
        ? 2
        : 1;
    const existing = entriesByLogicalKey.get(logicalKey);
    if (existing && existing.priority >= priority) {
      continue;
    }

    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (!rawValue) {
        continue;
      }
      entriesByLogicalKey.set(logicalKey, {
        priority,
        value: JSON.parse(rawValue),
      });
    } catch {
      // Ignore malformed legacy entries during opportunistic migration.
    }
  }

  return Array.from(entriesByLogicalKey.entries())
    .map(([logicalKey, entry]) => ({ logicalKey, value: entry.value }))
    .sort((left, right) => left.logicalKey.localeCompare(right.logicalKey));
}

async function migrateLegacyExactSensitiveStore(rawKey, readDurableValue, writeDurableValue) {
  const legacyValue = readLegacyScopedJsonValue(rawKey);
  if (!hasMeaningfulLegacyStorageValue(legacyValue)) {
    return false;
  }

  const durableValue = await readDurableValue(null);
  if (hasMeaningfulLegacyStorageValue(durableValue)) {
    return false;
  }

  return writeDurableValue(legacyValue);
}

async function migrateLegacyDailyTimelineToDurableStore() {
  const legacyEntries = collectLegacyScopedJsonEntries(LEGACY_DAILY_TIMELINE_STORAGE_PREFIX);
  let migrated = false;

  for (const { logicalKey, value } of legacyEntries) {
    if (!hasMeaningfulLegacyStorageValue(value)) {
      continue;
    }
    const dateKey = logicalKey.slice(LEGACY_DAILY_TIMELINE_STORAGE_PREFIX.length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      continue;
    }
    const durableValue = await readLocalDailyTimeline(dateKey, null);
    if (hasMeaningfulLegacyStorageValue(durableValue)) {
      continue;
    }
    migrated = (await writeLocalDailyTimeline(dateKey, value)) || migrated;
  }

  return migrated;
}

async function migrateLegacyProtectedStorageToDurableStores() {
  const vaultStatus = getLocalVaultStatusSnapshot();
  if (!vaultStatus.unlocked) {
    return { migrated: false, skipped: true };
  }

  let migrated = false;

  const legacyState = loadStoredJson(APP_STATE_STORAGE_KEY, null);
  if (legacyState) {
    const appStateStatus = await getLocalAppStateStorageStatus();
    if (!appStateStatus.exists) {
      migrated = (await writeLocalAppState(legacyState)) || migrated;
    }
  }

  const durableFeatureState = await readLocalFeatureState(null);
  const legacyFeatureState = await buildAccountClientState();
  if (
    hasMeaningfulAccountClientState(legacyFeatureState) &&
    !hasDurableAccountClientStateData(durableFeatureState)
  ) {
    migrated = (await writeLocalFeatureState(legacyFeatureState)) || migrated;
  }

  migrated = (await migrateLegacyExactSensitiveStore(
    PLAN_STORAGE_KEY,
    readLocalPlanDay,
    writeLocalPlanDay
  )) || migrated;
  migrated = (await migrateLegacyExactSensitiveStore(
    "today.rituals.v2",
    readLocalRitualsState,
    writeLocalRitualsState
  )) || migrated;
  migrated = (await migrateLegacyExactSensitiveStore(
    "today.tamil.v1",
    readLocalVerbatimState,
    writeLocalVerbatimState
  )) || migrated;
  migrated = (await migrateLegacyExactSensitiveStore(
    "monzo.budget.v1",
    readLocalBudgetState,
    writeLocalBudgetState
  )) || migrated;
  migrated = (await migrateLegacyDailyTimelineToDurableStore()) || migrated;

  return { migrated, skipped: false };
}

function normalizeAccountCalendarEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const start = typeof event.start === "string" ? event.start : "";
  const end = typeof event.end === "string" ? event.end : "";
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!start || !end || !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return null;
  }

  return {
    id: String(event.id || createUuid()),
    title: String(event.title || "New event"),
    start,
    end,
    isDeadline: Boolean(event.isDeadline || event.category === "deadline"),
    parentId: event.parentId ? String(event.parentId) : null,
    ...(event.category ? { category: String(event.category) } : {}),
    ...(event.updatedAt ? { updatedAt: String(event.updatedAt) } : {}),
    ...(event.source ? { source: String(event.source) } : {}),
    ...(event.readOnly != null ? { readOnly: Boolean(event.readOnly) } : {})
  };
}

function shouldUseIncomingAccountCalendarEvent(existingEvent, incomingEvent) {
  if (!existingEvent) {
    return true;
  }

  const existingUpdatedAt = Date.parse(existingEvent.updatedAt || "");
  const incomingUpdatedAt = Date.parse(incomingEvent.updatedAt || "");
  const hasExistingUpdatedAt = Number.isFinite(existingUpdatedAt);
  const hasIncomingUpdatedAt = Number.isFinite(incomingUpdatedAt);
  if (hasExistingUpdatedAt && hasIncomingUpdatedAt) {
    return incomingUpdatedAt >= existingUpdatedAt;
  }
  if (hasIncomingUpdatedAt) {
    return true;
  }
  if (hasExistingUpdatedAt) {
    return !areAccountCalendarEventsEquivalent(existingEvent, incomingEvent);
  }

  return true;
}

function getAccountCalendarEventMergeSignature(event) {
  if (!event || typeof event !== "object") {
    return "";
  }

  return JSON.stringify({
    title: String(event.title || "New event"),
    start: typeof event.start === "string" ? event.start : "",
    end: typeof event.end === "string" ? event.end : "",
    isDeadline: Boolean(event.isDeadline || event.category === "deadline"),
    parentId: event.parentId ? String(event.parentId) : null,
    category: event.category ? String(event.category) : "default",
    source: event.source ? String(event.source) : "",
    readOnly: event.readOnly === true
  });
}

function areAccountCalendarEventsEquivalent(leftEvent, rightEvent) {
  return getAccountCalendarEventMergeSignature(leftEvent) === getAccountCalendarEventMergeSignature(rightEvent);
}

function mergeAccountCalendarEvents(...eventLists) {
  const eventsById = new Map();
  for (const eventList of eventLists) {
    if (!Array.isArray(eventList)) {
      continue;
    }

    for (const rawEvent of eventList) {
      const event = normalizeAccountCalendarEvent(rawEvent);
      if (!event) {
        continue;
      }

      const existing = eventsById.get(event.id);
      if (shouldUseIncomingAccountCalendarEvent(existing, event)) {
        eventsById.set(event.id, event);
      }
    }
  }

  return Array.from(eventsById.values())
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
}

function getPreservedAccountBooksSection() {
  return preservedAccountBooksSection && typeof preservedAccountBooksSection === "object"
    ? preservedAccountBooksSection
    : createEmptyAccountClientState().books;
}

async function collectBooksAccountClientSection() {
  if (!booksFeatureInitialized) {
    return getPreservedAccountBooksSection();
  }

  return collectBooksBackupSection();
}

async function buildAccountClientState() {
  return {
    notes: notesFeature.getBackupSnapshot ? notesFeature.getBackupSnapshot() : createEmptyAccountClientState().notes,
    habits: {
      items: Array.isArray(habits) ? habits.map((habit) => ({ ...habit })) : [],
      deletedIds: loadStoredJson(HABITS_DELETED_IDS_KEY, []).map((id) => String(id || "")).filter(Boolean)
    },
    longTermGoals: {
      items: Array.isArray(longTermGoals) ? longTermGoals.map((goal) => cloneLongTermGoal(goal)) : [],
      deletedIds: loadStoredJson(LONG_TERM_GOALS_DELETED_IDS_KEY, []).map((id) => String(id || "")).filter(Boolean)
    },
    calendar: { events: Array.isArray(calendarEvents) ? calendarEvents.map((event) => ({ ...event })) : [] },
    books: await collectBooksAccountClientSection(),
    rss: rssFeature.getBackupSnapshot ? rssFeature.getBackupSnapshot() : createEmptyAccountClientState().rss,
    monzoLocal: {
      view: monzoView,
      expenses: Array.isArray(monzoExpenses) ? monzoExpenses.map((expense) => ({ ...expense })) : []
    }
  };
}

function shouldRestoreBooksFromAccountState(payload, decodedBooksSection) {
  const hasBooksSection = Boolean(payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "books"));
  const incomingBooksCount = Array.isArray(decodedBooksSection?.books) ? decodedBooksSection.books.length : 0;
  const localSnapshot = booksFeature.getBackupSnapshot ? booksFeature.getBackupSnapshot() : { books: [] };
  const localBooksCount = Array.isArray(localSnapshot.books) ? localSnapshot.books.length : 0;

  return localBooksCount === 0 || (hasBooksSection && incomingBooksCount > 0);
}

function setPreservedAccountBooksSection(section) {
  preservedAccountBooksSection = section && typeof section === "object"
    ? section
    : createEmptyAccountClientState().books;
  accountBooksSectionLoaded = true;
  accountBooksSectionApplied = false;
}

async function applyPreservedAccountBooksSection(payload) {
  if (!booksFeatureInitialized || !accountBooksSectionLoaded || accountBooksSectionApplied) {
    return false;
  }

  const decodedBooksSection = decodeBooksBackupSection(getPreservedAccountBooksSection());
  let shouldSyncLocalState = false;
  if (shouldRestoreBooksFromAccountState(payload, decodedBooksSection)) {
    await booksFeature.restoreBackupSnapshot?.(decodedBooksSection);
  } else {
    shouldSyncLocalState = true;
  }
  accountBooksSectionApplied = true;
  return shouldSyncLocalState;
}

function shouldRestoreRssFromAccountState(payload) {
  const hasRssSection = Boolean(
    payload
    && typeof payload === "object"
    && Object.prototype.hasOwnProperty.call(payload, "rss")
  );
  return hasRssSection || !rssFeature.hasFeeds?.();
}

function shouldRestoreNotesFromAccountState(payload) {
  const hasNotesSection = Boolean(
    payload
    && typeof payload === "object"
    && Object.prototype.hasOwnProperty.call(payload, "notes")
  );
  if (hasNotesSection) {
    return true;
  }

  const localNotesSnapshot = notesFeature.getBackupSnapshot
    ? notesFeature.getBackupSnapshot()
    : createEmptyAccountClientState().notes;
  const hasLiteEntries = Array.isArray(localNotesSnapshot?.liteEntries) && localNotesSnapshot.liteEntries.length > 0;
  const usesEncryptedMode = localNotesSnapshot?.mode === "encrypted";
  return !hasLiteEntries && !usesEncryptedMode;
}

function shouldRestoreMonzoLocalFromAccountState(payload) {
  const hasMonzoLocalSection = Boolean(
    payload
    && typeof payload === "object"
    && Object.prototype.hasOwnProperty.call(payload, "monzoLocal")
  );
  if (hasMonzoLocalSection) {
    return true;
  }

  return monzoView === "list" && (!Array.isArray(monzoExpenses) || monzoExpenses.length === 0);
}

async function applyAccountClientState(payload) {
  const nextState = payload && typeof payload === "object" ? payload : createEmptyAccountClientState();
  let shouldSyncLocalState = false;
  isApplyingAccountClientState = true;
  try {
    if (shouldRestoreNotesFromAccountState(payload)) {
      notesFeature.restoreBackupSnapshot?.(nextState.notes);
    } else {
      shouldSyncLocalState = true;
    }
    const serverDeletedHabitIds = Array.isArray(nextState?.habits?.deletedIds)
      ? nextState.habits.deletedIds.map((id) => String(id || "")).filter(Boolean)
      : [];
    const localDeletedHabitIds = loadStoredJson(HABITS_DELETED_IDS_KEY, []).map((id) => String(id || "")).filter(Boolean);
    const deletedHabitIds = new Set([...serverDeletedHabitIds, ...localDeletedHabitIds]);
    const serverHabits = Array.isArray(nextState?.habits?.items)
      ? nextState.habits.items.map(normalizeHabit).filter((h) => h.name)
      : [];
    if (serverHabits.length > 0 || habits.length === 0) {
      const habitMap = new Map();
      for (const h of serverHabits) {
        if (!deletedHabitIds.has(h.id)) {
          habitMap.set(h.id, h);
        }
      }
      for (const h of habits) {
        if (deletedHabitIds.has(h.id)) {
          continue;
        }
        const existing = habitMap.get(h.id);
        if (!existing || String(h.updatedAt) > String(existing.updatedAt)) {
          habitMap.set(h.id, h);
        }
      }
      setHabits(Array.from(habitMap.values()));
    }
    const serverDeletedGoalIds = Array.isArray(nextState?.longTermGoals?.deletedIds)
      ? nextState.longTermGoals.deletedIds.map((id) => String(id || "")).filter(Boolean)
      : [];
    const localDeletedGoalIds = loadStoredJson(LONG_TERM_GOALS_DELETED_IDS_KEY, []).map((id) => String(id || "")).filter(Boolean);
    const deletedGoalIds = new Set([...serverDeletedGoalIds, ...localDeletedGoalIds]);
    const rawNextGoals = Array.isArray(nextState?.longTermGoals?.items)
      ? nextState.longTermGoals.items
      : Array.isArray(nextState?.habits?.goals)
        ? nextState.habits.goals
        : [];
    const serverGoals = rawNextGoals.map(normalizeLongTermGoal).filter((g) => g.title);
    if (serverGoals.length > 0 || longTermGoals.length === 0) {
      const goalMap = new Map();
      for (const g of serverGoals) {
        if (!deletedGoalIds.has(g.id)) {
          goalMap.set(g.id, g);
        }
      }
      for (const g of longTermGoals) {
        if (deletedGoalIds.has(g.id)) {
          continue;
        }
        const existing = goalMap.get(g.id);
        if (!existing || String(g.updatedAt) > String(existing.updatedAt)) {
          goalMap.set(g.id, g);
        }
      }
      setLongTermGoals(Array.from(goalMap.values()));
    }
    saveStoredJson(HABITS_STORAGE_KEY, habits);
    saveStoredJson(HABITS_DELETED_IDS_KEY, [...deletedHabitIds]);
    saveStoredJson(LONG_TERM_GOALS_STORAGE_KEY, longTermGoals);
    saveStoredJson(LONG_TERM_GOALS_DELETED_IDS_KEY, [...deletedGoalIds]);
    const mergedCalendarEvents = mergeAccountCalendarEvents(
      nextState?.calendar?.events,
      loadCalendarEvents(),
      calendarEvents
    );
    const incomingCalendarCount = Array.isArray(nextState?.calendar?.events) ? nextState.calendar.events.length : 0;
    if (mergedCalendarEvents.length > incomingCalendarCount) {
      shouldSyncLocalState = true;
    }
    setCalendarEvents(mergedCalendarEvents);
    setCalendarDraftEvent(null);
    saveStoredJson(CALENDAR_EVENTS_STORAGE_KEY, calendarEvents);
    setPreservedAccountBooksSection(nextState.books);
    if (await applyPreservedAccountBooksSection(payload)) {
      shouldSyncLocalState = true;
    }
    if (shouldRestoreRssFromAccountState(payload)) {
      rssFeature.restoreBackupSnapshot?.(nextState.rss);
    } else {
      shouldSyncLocalState = true;
    }
    if (shouldRestoreMonzoLocalFromAccountState(payload)) {
      restoreMonzoLocalBackupSection(nextState.monzoLocal);
    } else {
      shouldSyncLocalState = true;
    }
    syncFeatureUi();
  } finally {
    isApplyingAccountClientState = false;
  }

  return shouldSyncLocalState;
}

async function decryptClientStatePayload(raw) {
  if (raw && typeof raw === "object" && typeof raw._encrypted === "string") {
    const vault = window.__cityVault;
    if (!vault?.isUnlocked()) {
      return null; // vault locked — caller should apply empty state and wait for unlock
    }
    try {
      const json = await vault.decrypt(raw._encrypted);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  return raw; // plaintext (legacy or unencrypted)
}

async function loadAccountClientState() {
  const storageStatus = await getLocalFeatureStateStorageStatus();
  const vaultStatus = getLocalVaultStatusSnapshot();
  const hasLockedEncryptedState =
    storageStatus.exists &&
    storageStatus.encrypted &&
    vaultStatus.configured &&
    !vaultStatus.unlocked;

  if (hasLockedEncryptedState) {
    lastAccountClientStateSignature = "";
    accountClientStateLoaded = true;
    return;
  }

  const raw = await readLocalFeatureState(null);
  const payload = await decryptClientStatePayload(raw);
  if (payload && typeof payload === "object" && Object.keys(payload).length > 0) {
    const shouldSyncLocalState = await applyAccountClientState(payload);
    const mergedPayload = await buildAccountClientState();
    const mergedSignature = JSON.stringify(mergedPayload);
    const remoteSignature = JSON.stringify(payload);
    const needsResync = shouldSyncLocalState || mergedSignature !== remoteSignature;
    lastAccountClientStateSignature = needsResync ? "" : mergedSignature;
    accountClientStateLoaded = true;
    if (needsResync || pendingAccountClientStateSync) {
      pendingAccountClientStateSync = false;
      await syncAccountClientState();
    }
  } else {
    const localPayload = await buildAccountClientState();
    if (hasMeaningfulAccountClientState(localPayload) || pendingAccountClientStateSync) {
      lastAccountClientStateSignature = "";
      pendingAccountClientStateSync = false;
      await syncAccountClientState();
    } else {
      lastAccountClientStateSignature = JSON.stringify(localPayload);
    }
    accountClientStateLoaded = true;
  }
}

let pendingAccountClientStateSync = false;

async function persistAccountClientStatePayload(payload, signature) {
  const saved = await writeLocalFeatureState(payload);
  if (!saved) {
    pendingAccountClientStateSync = true;
    return false;
  }
  accountClientStateSyncPausedUntil = 0;
  lastAccountClientStateSignature = signature;
  return true;
}

async function persistAccountClientStateImmediately() {
  if (!featureBridgeReady || isApplyingAccountClientState || !accountClientStateLoaded) {
    pendingAccountClientStateSync = true;
    return;
  }
  if (isAccountClientStateSyncPaused()) {
    return;
  }

  const payload = await buildAccountClientState();
  const signature = JSON.stringify(payload);
  await persistAccountClientStatePayload(payload, signature);
}

function scheduleAccountClientStateSync() {
  if (!featureBridgeReady || isApplyingAccountClientState || !accountClientStateLoaded) {
    // Queue for after load completes so mutations made during init are not lost.
    pendingAccountClientStateSync = true;
    return;
  }
  if (isAccountClientStateSyncPaused()) {
    return;
  }
  if (accountClientStateSyncHandle !== null) {
    window.clearTimeout(accountClientStateSyncHandle);
  }
  accountClientStateSyncHandle = window.setTimeout(() => {
    accountClientStateSyncHandle = null;
    void syncAccountClientState();
  }, 400);
}

async function flushAccountClientState() {
  if (accountClientStateSyncHandle !== null) {
    window.clearTimeout(accountClientStateSyncHandle);
    accountClientStateSyncHandle = null;
  }

  if (accountClientStateSyncPromise) {
    await accountClientStateSyncPromise;
    return;
  }

  if (!featureBridgeReady || isApplyingAccountClientState || !accountClientStateLoaded) {
    return;
  }
  if (isAccountClientStateSyncPaused()) {
    return;
  }

  await syncAccountClientState();
}

async function syncAccountClientState() {
  if (isApplyingAccountClientState || !accountClientStateLoaded) {
    return;
  }
  if (isAccountClientStateSyncPaused()) {
    return;
  }
  if (accountClientStateSyncPromise) {
    return accountClientStateSyncPromise;
  }

  accountClientStateSyncPromise = (async () => {
    const payload = await buildAccountClientState();
    const signature = JSON.stringify(payload);
    if (signature === lastAccountClientStateSignature) {
      return;
    }
    await persistAccountClientStatePayload(payload, signature);
  })().finally(() => {
    accountClientStateSyncPromise = null;
  });

  return accountClientStateSyncPromise;
}

async function importFromLocalHelper({ force = false } = {}) {
  const metadata = await readLocalMetadata({});
  if (!force && metadata?.[OFFLINE_MIGRATION_COMPLETE_KEY] === true) {
    return { imported: false, skipped: true };
  }

  let imported = false;
  try {
    const helperState = await apiFetch("/api/state");
    if (helperState && typeof helperState === "object" && hasMeaningfulCoreState(helperState)) {
      setServerState(helperState);
      imported = true;
    }
  } catch {
    // The local helper is optional; unavailable helper imports are silent.
  }

  try {
    const helperFeatureState = await apiFetch("/api/client-state");
    const payload = await decryptClientStatePayload(helperFeatureState);
    if (payload && typeof payload === "object" && Object.keys(payload).length > 0) {
      await applyAccountClientState(payload);
      await writeLocalFeatureState(await buildAccountClientState());
      imported = true;
    }
  } catch {
    // The local helper is optional; unavailable helper imports are silent.
  }

  await writeLocalMetadata({
    [OFFLINE_MIGRATION_COMPLETE_KEY]: true,
    [OFFLINE_MIGRATION_STATUS_KEY]: {
      imported,
      completedAt: new Date().toISOString()
    }
  });

  return { imported, skipped: false };
}

initializeShell({
  themeState: {
    uiTheme,
    uiAccent,
    uiFont,
    uiMode,
    liquidGlassEnabled,
    cordycepsUnderlayEnabled,
    uiCustomBackground,
    uiCustomTransparency,
    uiCustomCardTransparency
  },
  startup() {
    runtimeReadySignaled = false;
    window.__cordyAccountStateLoaded = false;
    hydrateCachedState();
    render();
    syncRssPanelUi(activeRssPanel);
    syncSettingsPanelUi(activeSettingsPanel);
    syncFeatureUi();
    if (activePage === "books") {
      void ensureBooksFeatureInitialized();
    }
    maybeRefreshRssOnAppLoad();
    initializeApp();
  },
  viewportInputs: [
    document.querySelector("#todo-input"),
    monzoAccessTokenInput,
    monzoAccountIdInput,
    habitNameInput,
    ...notesFeature.getViewportInputs(),
    ...rssFeature.getViewportInputs()
  ]
});
bindWindowFrameSync();
startDevReloadLoop();
startStateSyncLoop();
startOutlookCalendarSyncLoop();
bindPageSwipeNavigation();
bindConnectivitySync();
bindEvents();
bindVaultEvents();
startSseSync();

function isRemoteSession() {
  const { hostname, protocol } = window.location;
  return protocol === "https:" && hostname !== "localhost" && hostname !== "127.0.0.1"
    || REMOTE_HOSTNAME_PATTERN.test(hostname);
}

function isLocalDevShell() {
  const { hostname, protocol } = window.location;
  return protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
}

function isBuiltAssetShell() {
  return Array.from(document.scripts).some((script) => {
    try {
      return new URL(script.src, window.location.href).pathname.startsWith("/assets/");
    } catch {
      return false;
    }
  });
}

function shouldDisableServiceWorkersForLocalDev() {
  return isLocalDevShell() && !isBuiltAssetShell();
}

function getStateSyncIntervalMs() {
  return isRemoteSession() ? REMOTE_STATE_SYNC_INTERVAL_MS : LOCAL_STATE_SYNC_INTERVAL_MS;
}

function getDevReloadIntervalMs() {
  return isRemoteSession() ? REMOTE_DEV_RELOAD_INTERVAL_MS : LOCAL_DEV_RELOAD_INTERVAL_MS;
}

function getAlertClaimIntervalMs() {
  return isRemoteSession() ? REMOTE_ALERT_CLAIM_INTERVAL_MS : LOCAL_ALERT_CLAIM_INTERVAL_MS;
}

function isServerSyncPaused() {
  return Date.now() < serverSyncPausedUntil;
}

function markServerSyncSuccess() {
  serverSyncFailureCount = 0;
  serverSyncPausedUntil = 0;
}

function markServerSyncFailure() {
  serverSyncFailureCount += 1;
  if (serverSyncFailureCount >= SERVER_SYNC_FAILURE_LIMIT) {
    serverSyncPausedUntil = Date.now() + SERVER_SYNC_PAUSE_MS;
  }
}

function isAccountClientStateSyncPaused() {
  return Date.now() < accountClientStateSyncPausedUntil;
}

function bindVaultEvents() {
  window.addEventListener("city-vault:unlocked", () => {
    void migrateLegacyProtectedStorageToDurableStores().finally(() => {
      void hydrateLocalState().then(() => {
        render();
        syncFeatureUi();
      });
      // Vault just unlocked — re-fetch client state so encrypted habits/calendar/etc. are decrypted.
      if (accountClientStateLoaded) {
        accountClientStateLoaded = false;
        void loadAccountClientState();
      }
    });
  });
}

async function ensureCoreStateWritable({ interactive = false } = {}) {
  const vaultStatus = getLocalVaultStatusSnapshot();
  if (vaultStatus.configured && !vaultStatus.unlocked) {
    if (!interactive) {
      return false;
    }
    const unlocked = await ensureLocalVaultUnlocked({ interactive: true });
    if (!unlocked) {
      showToast(
        "Unlock required",
        "Unlock older protected task data once before changing tasks.",
        TOAST_DURATION_MS
      );
      return false;
    }
  }

  if (!localCoreStateLocked) {
    return true;
  }

  try {
    await hydrateLocalState();
    render();
    syncFeatureUi();
    return !localCoreStateLocked;
  } catch {
    showToast(
      "Local data locked",
      "Unlock older protected task data once to load saved tasks before editing them.",
      TOAST_DURATION_MS
    );
    return false;
  }
}

function maybeRefreshRssOnAppLoad() {
  if (hasRequestedInitialRssRefresh || !rssFeature.hasFeeds?.() || rssFeature.isRefreshing?.()) {
    return;
  }

  hasRequestedInitialRssRefresh = true;
  void rssFeature.refresh({ silent: true });
}

async function handleAppSoftRefreshRequest(event) {
  const detail = event instanceof CustomEvent ? event.detail : null;
  const source = detail && typeof detail === "object" && typeof detail.source === "string"
    ? detail.source
    : "app";

  try {
    try {
      await hydrateLocalState();
    } catch {
      hydrateCachedState();
    }

    render();
    syncFeatureUi();

    const backgroundTasks = [];

    if (rssFeature.hasFeeds?.() && !rssFeature.isRefreshing?.()) {
      backgroundTasks.push(rssFeature.refresh({ silent: true }));
    }

    backgroundTasks.push(refreshOutlookCalendar({ silent: true }));
    backgroundTasks.push(processMutationQueue());

    await Promise.allSettled(backgroundTasks);

    if (source === "dashboard") {
      showToast("Refresh complete", "Dashboard state, connected data, and update status were checked.", 2600);
    }
  } finally {
    window.dispatchEvent(new CustomEvent(APP_SOFT_REFRESH_COMPLETE_EVENT, {
      detail: { source, refreshedAt: new Date().toISOString() }
    }));
  }
}

function handleNotesOpenDailyRequest(event) {
  const detail = event instanceof CustomEvent ? event.detail : null;
  if (!detail || typeof detail !== "object") {
    return;
  }

  const title = typeof detail.title === "string" ? detail.title : "";
  if (!title.trim()) {
    return;
  }

  notesFeature.openOrCreateNote({
    title,
    body: typeof detail.body === "string" ? detail.body : ""
  });
}

function handleDesktopContextAction(action, id, anchorEl) {
  if (!action) {
    return;
  }

  if (action === "dashboard-jump" && id && TOP_LEVEL_PAGES.has(id)) {
    pageButtonRegistry.handleNavigationRequest(id);
    return;
  }

  if (action === "calendar-event" && id) {
    const calendarEvent = getDisplayCalendarEventById(id);
    if (!calendarEvent) {
      return;
    }
    if (activePage !== "calendar") {
      setActivePage("calendar");
    }
    if (calendarEvent.readOnly) {
      showToast("Outlook event", "Imported Outlook events are read-only right now.", TOAST_DURATION_MS);
      return;
    }
    openCalendarEventEditor(anchorEl instanceof HTMLElement ? anchorEl : null, id);
    return;
  }

  if (action === "rss-feed" && id) {
    if (activePage !== "rss") {
      setActivePage("rss");
    }
    const button = document.querySelector(`[data-rss-feed-select="${CSS.escape(id)}"]`);
    if (button instanceof HTMLElement) {
      button.click();
    }
    return;
  }

  if (action === "notes-note" && id) {
    if (activePage !== "notes") {
      setActivePage("notes");
    }
    const button = document.querySelector(`[data-note-id="${CSS.escape(id)}"]`);
    if (button instanceof HTMLElement) {
      button.click();
    }
    return;
  }

  if (action === "books-book" && id) {
    if (activePage !== "books") {
      setActivePage("books");
    }
    const button = document.querySelector(`[data-book-open="${CSS.escape(id)}"]`);
    if (button instanceof HTMLElement) {
      button.click();
    }
    return;
  }

  if (action === "settings-link" && id) {
    if (activePage !== "settings") {
      setActivePage("settings");
    }
    const button = document.querySelector(`[data-settings-panel-link="${CSS.escape(id)}"]`);
    if (button instanceof HTMLElement) {
      button.click();
    }
  }
}

function handleShellNavigationRequest(event) {
  const detail = event instanceof CustomEvent ? event.detail : null;
  if (!detail || typeof detail !== "object") {
    return;
  }

  if (detail.type === "back") {
    pageButtonRegistry.handleBackNavigation();
    syncPageChrome(todos, activePage);
    return;
  }

  if (detail.type === "page") {
    pageButtonRegistry.handleNavigationRequest(detail.page);
    return;
  }

  if (detail.type === "desktop-context-action") {
    handleDesktopContextAction(detail.action || "", detail.id || "", null);
  }
}

function bindEvents() {
  window.addEventListener(SHELL_NAVIGATION_EVENT, handleShellNavigationRequest);
  window.addEventListener(NOTES_OPEN_DAILY_EVENT, handleNotesOpenDailyRequest);
  window.addEventListener(APP_SOFT_REFRESH_REQUEST_EVENT, (event) => {
    void handleAppSoftRefreshRequest(event);
  });
  window.addEventListener("city-app:calendar-reload", () => {
    setCalendarEvents(loadCalendarEvents());
    syncFeatureUi();
    scheduleAccountClientStateSync();
  });
  document.addEventListener("submit", (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form) {
      return;
    }
    if (form.id === "todo-form") {
      void handleAddTaskSubmit(event);
      return;
    }
    if (form.id === "import-form") {
      void handleImportSubmit(event);
    }
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== "todo-input") {
      return;
    }
    handleTodoInputKeyDown(event);
  });

  if (clearCompletedSettingsButton) {
    clearCompletedSettingsButton.addEventListener("click", clearCompletedTasks);
  }

  if (dismissSyncIssuesButton) {
    dismissSyncIssuesButton.addEventListener("click", () => {
      syncIssues = [];
      saveStoredJson(SYNC_ISSUES_STORAGE_KEY, syncIssues);
      syncSyncStatusUi(getSyncUiState());
    });
  }

  if (importLocalHelperButton) {
    importLocalHelperButton.addEventListener("click", () => {
      importLocalHelperButton.disabled = true;
      void importFromLocalHelper({ force: true })
        .then((result) => {
          toast(
            result.imported ? "Import complete" : "Nothing to import",
            result.imported
              ? "Local helper data was copied onto this device."
              : "No local helper state was available."
          );
        })
        .catch(() => {
          toast("Import unavailable", "The local helper could not be reached.");
        })
        .finally(() => {
          importLocalHelperButton.disabled = false;
        });
    });
  }

  if (reloadAppButton) {
    reloadAppButton.addEventListener("click", () => {
      reloadApp({ beforeReload: () => flushPendingWrites("manual-reload", { strict: true }) });
    });
  }


  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }

    if (target.closest("#export-app-backup")) {
      event.preventDefault();
      void handleBackupExport();
      return;
    }

    if (target.closest("#import-app-backup")) {
      event.preventDefault();
      document.querySelector("#import-app-backup-file")?.click();
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== "import-app-backup-file") {
      return;
    }

    void handleBackupFileSelection(event);
  });

  settingsPanelLinks.forEach((button) => {
    button.addEventListener("click", () => {
      const nextPanel = button.dataset.settingsPanelLink || "root";
      setActiveSettingsPanel(nextPanel);
    });
  });

  settingsPanelBackButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveSettingsPanel("root");
    });
  });
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "active";
      render();
    });
  });

  booksFeature.bindEvents();
  notesFeature.bindEvents();
  rssFeature.bindEvents();

  themeSwitchers.forEach((switcher) => {
    switcher.addEventListener("click", (event) => {
      const themeButton = resolveOptionButton(switcher, event, "[data-ui-theme]");
      if (themeButton) {
        const nextTheme = themeButton.dataset.uiTheme;
        if (!UI_THEMES.has(nextTheme) || nextTheme === uiTheme) {
          return;
        }

        setUiTheme(nextTheme);
        return;
      }

      const modeButton = resolveOptionButton(switcher, event, "[data-ui-mode]");
      if (modeButton) {
        if (modeButton.disabled || modeButton.getAttribute("aria-disabled") === "true") {
          return;
        }

        const nextMode = modeButton.dataset.uiMode;
        if (!isSelectableUiMode(nextMode) || nextMode === uiMode) {
          return;
        }

        setUiMode(nextMode);
        return;
      }

      const fontButton = resolveOptionButton(switcher, event, "[data-ui-font]");
      if (!fontButton) {
        return;
      }

      const nextFont = fontButton.dataset.uiFont;
      if (!UI_FONTS.has(nextFont) || nextFont === uiFont) {
        return;
      }

      setUiFont(nextFont);
    });
  });

  if (uiGlassToggle) {
    uiGlassToggle.addEventListener("click", () => {
      setLiquidGlassEnabled(!liquidGlassEnabled);
    });
  }

  if (saveUiCustomBackgroundButton) {
    saveUiCustomBackgroundButton.addEventListener("click", () => {
      setUiCustomBackground(uiCustomBackgroundInput?.value || "");
    });
  }

  if (clearUiCustomBackgroundButton) {
    clearUiCustomBackgroundButton.addEventListener("click", () => {
      setUiCustomBackground("");
    });
  }

  if (uiCustomBackgroundInput) {
    uiCustomBackgroundInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      setUiCustomBackground(uiCustomBackgroundInput.value);
    });
  }

  if (uiCustomTransparencyInput) {
    uiCustomTransparencyInput.addEventListener("input", () => {
      setUiCustomTransparency(uiCustomTransparencyInput.value);
    });
  }

  if (uiCustomCardTransparencyInput) {
    uiCustomCardTransparencyInput.addEventListener("input", () => {
      setUiCustomCardTransparency(uiCustomCardTransparencyInput.value);
    });
  }

  accentPickers.forEach((picker) => {
    picker.addEventListener("click", (event) => {
      const accentButton = resolveOptionButton(picker, event, "[data-ui-accent]");
      if (!accentButton) {
        return;
      }

      selectUiAccent(accentButton.dataset.uiAccent);
    });
  });

  document.addEventListener("click", (event) => {
    const accentButton = event.target instanceof Element ? event.target.closest("[data-ui-accent]") : null;
    if (!accentButton || accentButton.closest(".accent-picker") === null) {
      return;
    }

    selectUiAccent(accentButton.dataset.uiAccent);
  });

  if (randomAlertToggle) {
    randomAlertToggle.addEventListener("click", handleRandomAlertToggle);
  }

  if (testPushToggle) {
    testPushToggle.addEventListener("click", handleTestPushToggle);
  }

  document.addEventListener("click", (event) => {
    const urgentTestToggle = event.target instanceof Element
      ? event.target.closest("#urgent-test-push-toggle")
      : null;
    if (!urgentTestToggle) {
      return;
    }

    event.preventDefault();
    void handleUrgentNotificationTestToggle({ currentTarget: urgentTestToggle });
  });

  if (habitsAddForm) {
    habitsAddForm.addEventListener("submit", handleHabitAddSubmit);
  }
  if (habitAddButton) {
    habitAddButton.addEventListener("click", () => {
      if (activePage !== "habits") {
        setActivePage("habits");
        return;
      }
      habitNameInput?.focus();
    });
  }
  if (habitsList) {
    habitsList.addEventListener("click", handleHabitsListClick);
  }
  if (goalsAddForm) {
    goalsAddForm.addEventListener("submit", handleGoalAddSubmit);
  }
  if (goalsList) {
    goalsList.addEventListener("click", handleGoalsListClick);
    goalsList.addEventListener("change", handleGoalsListChange);
    goalsList.addEventListener("submit", handleGoalsListSubmit);
  }
  if (calendarPrevButton) {
    calendarPrevButton.addEventListener("click", handleCalendarPreviousRange);
  }
  if (calendarNextButton) {
    calendarNextButton.addEventListener("click", handleCalendarNextRange);
  }
  if (calendarDateInput) {
    calendarDateInput.addEventListener("change", handleCalendarDateChange);
  }
  if (calendarGrid) {
    calendarGrid.addEventListener("pointerdown", handleCalendarPointerDown);
    calendarGrid.addEventListener("pointermove", handleCalendarPointerMove);
    calendarGrid.addEventListener("pointerup", handleCalendarPointerUp);
    calendarGrid.addEventListener("pointercancel", cancelCalendarDrag);
    calendarGrid.addEventListener("click", handleCalendarEventClick);
  }

  const calendarEventEditorForm = document.querySelector("#calendar-event-editor-form");
  const calendarEventEditorCancel = document.querySelector("#calendar-event-editor-cancel");
  const calendarMobileAddEventButton = document.querySelector("#calendar-mobile-add-event");
  const calendarMobileAddDeadlineButton = document.querySelector("#calendar-mobile-add-deadline");
  if (calendarEventEditorForm) {
    calendarEventEditorForm.addEventListener("submit", handleCalendarEventEditorSubmit);
  }
  if (calendarEventEditorCancel) {
    calendarEventEditorCancel.addEventListener("click", () => {
      closeCalendarEventEditor();
    });
  }
  if (calendarMobileAddEventButton) {
    calendarMobileAddEventButton.addEventListener("click", () => {
      createCalendarEventFromComposer({ isDeadline: false });
    });
  }
  if (calendarMobileAddDeadlineButton) {
    calendarMobileAddDeadlineButton.addEventListener("click", () => {
      createCalendarEventFromComposer({ isDeadline: true });
    });
  }

  document.addEventListener("click", (event) => {
    const notificationToggle = event.target instanceof Element
      ? event.target.closest("#notification-button")
      : null;
    if (!notificationToggle) {
      return;
    }

    event.preventDefault();
    void handleNotificationToggle();
  });

  if (saveMonzoSettingsButton) {
    saveMonzoSettingsButton.addEventListener("click", handleMonzoSettingsSave);
  }

  trueLayerConnectButtons.forEach((button) => {
    button.addEventListener("click", handleTrueLayerMonzoConnect);
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    if (target.closest("#banking-load-institutions")) {
      void handleEnableBankingInstitutionLoad();
      return;
    }
    if (target.closest("[data-enable-banking-connect]")) {
      void handleEnableBankingConnect();
      return;
    }
    if (target.closest("#banking-csv-import")) {
      void handleBankingCsvImport();
      return;
    }
    if (target.closest("#banking-disconnect")) {
      void handleBankingDisconnect();
    }
  });

  if (refreshMonzoExpensesButton) {
    refreshMonzoExpensesButton.addEventListener("click", () => {
      void refreshMonzoExpenses({ silent: false });
    });
  }

  monzoViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.monzoView;
      if (
        nextView !== "list"
        && nextView !== "weekly"
        && nextView !== "type"
        && nextView !== "big"
      ) {
        return;
      }
      monzoView = nextView;
      persistMonzoLocalState();
      syncFeatureUi();
    });
  });

  if (saveOutlookSettingsButton) {
    saveOutlookSettingsButton.addEventListener("click", handleOutlookSettingsSave);
  }

  if (outlookAutoSyncToggle) {
    outlookAutoSyncToggle.addEventListener("click", handleOutlookAutoSyncToggle);
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#todo-list")) {
      return;
    }
    void handleTodoListClick(event);
  });
  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#todo-list")) {
      return;
    }
    handleTodoPointerDown(event);
  });
  document.addEventListener("pointermove", handleTodoPointerMove);
  document.addEventListener("pointerup", (event) => {
    void finishSwipeGesture(event.pointerId);
  });
  document.addEventListener("pointercancel", (event) => {
    void finishSwipeGesture(event.pointerId);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncViewportHeight();
      void claimAlerts();
      void loadState().catch(() => {});
      void syncPushSubscription();
    }
  });
}

function clearDemoSyncState() {
  isServerReachable = true;
  isSyncInFlight = false;
  isStateSyncInFlight = false;
  serverSyncFailureCount = 0;
  serverSyncPausedUntil = 0;
  accountClientStateSyncPausedUntil = 0;
  mutationQueue = [];
  syncIssues = [];
  saveStoredJson(MUTATION_QUEUE_STORAGE_KEY, mutationQueue);
  saveStoredJson(SYNC_ISSUES_STORAGE_KEY, syncIssues);
  syncSyncStatusUi(getSyncUiState());
}

function seedDemoServerState() {
  if (serverState.tasks.length > 0 && todos.length > 0) {
    return;
  }
  const bridgeState = readAppBridgeState();
  const bridgeTodos = Array.isArray(bridgeState?.todos) ? bridgeState.todos : [];
  if (bridgeTodos.length > 0 && serverState.tasks.length === 0) {
    serverState.tasks = bridgeTodos.map((t) => {
      const priority = t.priority === "orange"
        ? "important"
        : t.priority === "red"
          ? "urgent"
          : t.priority;
      return {
      id: t.id,
      text: t.text || "",
      completed: t.completed === true,
      pinned: t.pinned === true,
      priority: priority === "important" || priority === "urgent" ? priority : "none",
      createdAt: t.createdAt || new Date().toISOString(),
      completedAt: t.completedAt || null
      };
    });
    persistLocalCoreState();
  }
  rebuildAppState();
}

async function ensureBooksFeatureInitialized() {
  await booksFeature.initialize();
  booksFeatureInitialized = true;
  const shouldSyncLocalState = await applyPreservedAccountBooksSection({ books: getPreservedAccountBooksSection() });
  if (shouldSyncLocalState && accountClientStateLoaded) {
    scheduleAccountClientStateSync();
  }
}

function getCombinedCalendarEvents() {
  return [...calendarEvents, ...getImportedOutlookEvents()]
    .filter((event) => typeof event?.start === "string" && typeof event?.end === "string")
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
}

function getDisplayCalendarEventById(eventId) {
  return getCombinedCalendarEvents().find((entry) => entry.id === eventId) || null;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hydrateCachedState() {
  if (localCoreStateLocked) {
    return;
  }
  serverState = createDefaultState();
  rebuildAppState();
}

function hasSeededFirstRunPlaceholders() {
  try {
    return getScopedLocalStorageItem(FIRST_RUN_PLACEHOLDERS_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markFirstRunPlaceholdersSeeded() {
  try {
    setScopedLocalStorageItem(FIRST_RUN_PLACEHOLDERS_STORAGE_KEY, "1");
  } catch {
    // If storage is blocked, avoid making boot dependent on starter content.
  }
}

function isStarterDataExplicitlyRequested() {
  try {
    return startupParams.get(STARTER_DATA_QUERY_PARAM) === STARTER_DATA_QUERY_VALUE;
  } catch {
    return false;
  }
}

function createPlaceholderTask(text, priority = "none", offsetMinutes = 0) {
  const timestamp = new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
  return {
    id: createUuid(),
    text,
    completed: false,
    pinned: false,
    priority,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null
  };
}

function createPlaceholderCalendarEvent(title, hour, durationMinutes) {
  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    id: createUuid(),
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    isDeadline: false,
    parentId: null
  };
}

function seedFirstRunPlaceholders(cachedState, { includeExpandedStarterContent = false } = {}) {
  if (hasSeededFirstRunPlaceholders()) {
    return cachedState;
  }

  const nextState = cachedState && typeof cachedState === "object"
    ? { ...cachedState }
    : createDefaultState();

  if (!Array.isArray(nextState.tasks) || nextState.tasks.length === 0) {
    nextState.tasks = [
      createPlaceholderTask("Buy Coffee", "urgent", -4),
      createPlaceholderTask("Email details to Bob", "urgent", -3),
      createPlaceholderTask("Apply for internships", "important", -2),
      createPlaceholderTask("Look for good RSS feeds", "none", -1)
    ];
  }

  if (!Array.isArray(habits) || habits.length === 0) {
    const pushupsHabit = createHabitEntry("50 pushups", 10);
    const appleHabit = createHabitEntry("Apple a day", 2);
    const reflectHabit = createHabitEntry("Reflect on the week past", 15);
    const starterHabits = [pushupsHabit, appleHabit, reflectHabit];
    setHabits(starterHabits);
    saveHabits();
    saveStoredJson(HABITS_DELETED_IDS_KEY, []);
    try {
      const habitMeta = { [reflectHabit.id]: { type: "specific-days", days: [0] } };
      setScopedLocalStorageItem("today.habit.meta.v1", JSON.stringify(habitMeta));
    } catch {
      // habit-meta is non-blocking starter data
    }
  }

  if (includeExpandedStarterContent && (!Array.isArray(longTermGoals) || longTermGoals.length === 0)) {
    const starterGoal = createLongTermGoal("Build a calmer weekly rhythm", 3, "month");
    starterGoal.subgoals = [
      createLongTermSubgoal("Choose one routine to protect", "1 week"),
      createLongTermSubgoal("Review progress every Friday", "1 month")
    ];
    const starterGoals = [starterGoal];
    setLongTermGoals(starterGoals);
    saveStoredJson(LONG_TERM_GOALS_STORAGE_KEY, starterGoals);
    saveStoredJson(LONG_TERM_GOALS_DELETED_IDS_KEY, []);
  }

  if (includeExpandedStarterContent && (!Array.isArray(calendarEvents) || calendarEvents.length === 0)) {
    const starterEvents = [
      createPlaceholderCalendarEvent("Placeholder focus block", 10, 60),
      createPlaceholderCalendarEvent("Plan tomorrow", 17, 30)
    ];
    setCalendarEvents(starterEvents);
    saveStoredJson(CALENDAR_EVENTS_STORAGE_KEY, starterEvents);
  }

  if (includeExpandedStarterContent) {
    const notesSnapshot = notesFeature.getBackupSnapshot();
    if (!Array.isArray(notesSnapshot.liteEntries) || notesSnapshot.liteEntries.length === 0) {
      const noteId = createUuid();
      notesFeature.restoreBackupSnapshot({
        mode: "lite",
        activeEntryId: noteId,
        liteEntries: [
          {
            id: noteId,
            title: "Welcome to Cordy",
            body: [
              "These are starter notes. Edit or delete anything here.",
              "",
              "- Capture ideas before they disappear.",
              "- Link tasks, habits, and plans as your week takes shape."
            ].join("\n"),
            updatedAt: new Date().toISOString()
          }
        ]
      });
    }
  }

  markFirstRunPlaceholdersSeeded();
  return nextState;
}

async function hydrateLocalState() {
  const indexedState = await readLocalAppState(null);
  const indexedStateStatus = indexedState ? { exists: true, encrypted: false } : await getLocalAppStateStorageStatus();
  const hasEmptyIndexedStateRecord =
    indexedState == null &&
    indexedStateStatus.exists &&
    !indexedStateStatus.encrypted;
  const vaultStatus = getLocalVaultStatusSnapshot();
  const hasLockedEncryptedState =
    !indexedState &&
    indexedStateStatus.exists &&
    indexedStateStatus.encrypted &&
    vaultStatus.configured &&
    !vaultStatus.unlocked;
  let cachedState = indexedState;
  if (hasLockedEncryptedState) {
    localCoreStateLocked = true;
    showToast(
      "Local data locked",
      "Unlock older protected task data once to load saved tasks. No saved data was overwritten.",
      TOAST_DURATION_MS
    );
    return;
  }
  let legacyState = null;
  if (!cachedState) {
    legacyState = loadStoredJson(APP_STATE_STORAGE_KEY, null);
    if (legacyState) {
      const migrated = await writeLocalAppState(legacyState);
      if (migrated) {
        removeScopedLocalStorageItem(APP_STATE_STORAGE_KEY);
      }
      cachedState = legacyState;
    }
  }
  const shouldSeedFirstRunPlaceholders = (!indexedStateStatus.exists || hasEmptyIndexedStateRecord) && !legacyState;
  cachedState = cachedState || createDefaultState();
  if (shouldSeedFirstRunPlaceholders) {
    cachedState = seedFirstRunPlaceholders(cachedState, {
      includeExpandedStarterContent: isStarterDataExplicitlyRequested()
    });
  }
  localCoreStateLocked = false;
  serverState = normalizeState(cachedState);
  applyDangerModeToState(serverState);
  persistLocalCoreState();
  rebuildAppState();
}

function readDangerModeEnabled() {
  try {
    return window.localStorage.getItem(DANGER_MODE_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function clearLegacyDangerModeDeadlines() {
  try {
    window.localStorage.removeItem(DANGER_MODE_LEGACY_DEADLINES_STORAGE_KEY);
  } catch {}
}

function readDangerModeDestroyedTaskIds() {
  const storedDestroyedIds = loadStoredJson(DANGER_MODE_DESTROYED_TASK_IDS_KEY, {});
  if (Array.isArray(storedDestroyedIds)) {
    saveDangerModeDestroyedTaskIds(new Set());
    return new Set();
  }

  if (!storedDestroyedIds || typeof storedDestroyedIds !== "object") {
    return new Set();
  }

  return new Set(Object.keys(storedDestroyedIds).map((id) => String(id || "")).filter(Boolean));
}

function saveDangerModeDestroyedTaskIds(ids) {
  const destroyedMap = {};
  ids.forEach((id) => {
    destroyedMap[id] = Date.now();
  });
  saveStoredJson(DANGER_MODE_DESTROYED_TASK_IDS_KEY, destroyedMap);
}

function readDangerModeCycleDeadline() {
  try {
    const storedDeadline = Number(window.localStorage.getItem(DANGER_MODE_CYCLE_DEADLINE_STORAGE_KEY));
    return Number.isFinite(storedDeadline) && storedDeadline > 0 ? storedDeadline : null;
  } catch {
    return null;
  }
}

function saveDangerModeCycleDeadline(deadline) {
  try {
    window.localStorage.setItem(DANGER_MODE_CYCLE_DEADLINE_STORAGE_KEY, String(deadline));
  } catch {}
}

function clearDangerModeCycleDeadline() {
  try {
    window.localStorage.removeItem(DANGER_MODE_CYCLE_DEADLINE_STORAGE_KEY);
  } catch {}
}

function ensureDangerModeCycleDeadline(now = Date.now()) {
  const existingDeadline = readDangerModeCycleDeadline();
  if (existingDeadline !== null) {
    return existingDeadline;
  }

  const deadline = now + DANGER_MODE_DESTROY_AFTER_MS;
  saveDangerModeCycleDeadline(deadline);
  return deadline;
}

function isDangerModeEligibleTask(task) {
  return Boolean(task && !task.completed && task.priority === "urgent" && task.id);
}

function scheduleDangerModeSweep(deadline = readDangerModeCycleDeadline()) {
  if (dangerModeTimer !== null) {
    window.clearTimeout(dangerModeTimer);
    dangerModeTimer = null;
  }

  if (!readDangerModeEnabled()) {
    return;
  }

  const now = Date.now();
  if (!Number.isFinite(deadline) || deadline === null) {
    return;
  }

  dangerModeTimer = window.setTimeout(() => {
    dangerModeTimer = null;
    destroyDangerModeTasks({ announce: true });
  }, Math.min(Math.max(0, deadline - now), 2147483647));
}

function applyDangerModeToState(state) {
  if (!state || !Array.isArray(state.tasks)) {
    return 0;
  }

  const destroyedIds = readDangerModeDestroyedTaskIds();
  const dangerModeEnabled = readDangerModeEnabled();
  let changed = false;
  let destroyedCount = 0;
  const now = Date.now();

  clearLegacyDangerModeDeadlines();

  if (!dangerModeEnabled) {
    clearDangerModeCycleDeadline();
    scheduleDangerModeSweep(null);
    return 0;
  }

  const deadline = ensureDangerModeCycleDeadline(now);
  if (deadline > now) {
    scheduleDangerModeSweep(deadline);
    return 0;
  }

  state.tasks.forEach((task) => {
    const taskId = String(task?.id || "");
    if (taskId && isDangerModeEligibleTask(task)) {
      destroyedIds.add(taskId);
      destroyedCount += 1;
      changed = true;
    }
  });

  if (destroyedCount > 0) {
    state.tasks = state.tasks.filter((task) => {
      const taskId = String(task?.id || "");
      return !taskId || !destroyedIds.has(taskId);
    });
    changed = true;
  }

  const nextDeadline = now + DANGER_MODE_DESTROY_AFTER_MS;
  saveDangerModeCycleDeadline(nextDeadline);

  if (changed) {
    saveDangerModeDestroyedTaskIds(destroyedIds);
  }

  scheduleDangerModeSweep(nextDeadline);

  return destroyedCount;
}

function destroyDangerModeTasks({ announce = false } = {}) {
  const destroyedCount = applyDangerModeToState(serverState);
  if (destroyedCount === 0) {
    rebuildAppState();
    return;
  }

  persistLocalCoreState();
  rebuildAppState();
  if (announce) {
    showToast(
      "Danger Mode",
      `${destroyedCount} urgent task${destroyedCount === 1 ? "" : "s"} destroyed locally.`,
      TOAST_DURATION_MS
    );
  }
}

function buildNotificationSnapshot(state = serverState) {
  const tasks = Array.isArray(state?.tasks) ? state.tasks : [];
  const urgentTasks = tasks
    .filter((task) => !task.completed && (task.priority === "urgent" || task.pinned))
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      text: task.text || "",
      priority: task.priority || "none",
      pinned: task.pinned === true
    }));

  return {
    updatedAt: new Date().toISOString(),
    urgentTasks,
    nextPlanBlock: buildNextPlanBlockNotification()
  };
}

function buildNextPlanBlockNotification() {
  try {
    const rawPlan = getScopedLocalStorageItem(PLAN_STORAGE_KEY);
    if (!rawPlan) {
      return null;
    }
    const plan = JSON.parse(rawPlan);
    if (!plan || typeof plan !== "object" || !Array.isArray(plan.placed)) {
      return null;
    }
    const reminderMinutes = normalizePlanBlockReminderMinutes(
      Number.parseInt(getScopedLocalStorageItem(PLAN_BLOCK_REMINDER_MINUTES_KEY) || "15", 10)
    );
    const now = Date.now();
    const nextBlock = plan.placed
      .filter((block) => block && typeof block.label === "string" && Number.isFinite(block.startMinute))
      .map((block) => {
        const startAt = new Date(`${plan.date}T00:00:00`);
        startAt.setMinutes(Number(block.startMinute));
        const reminderAt = new Date(startAt.getTime() - reminderMinutes * 60 * 1000);
        return { block, startAt, reminderAt };
      })
      .filter(({ startAt, reminderAt }) => startAt.getTime() > now && reminderAt.getTime() >= now)
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())[0];

    if (!nextBlock) {
      return null;
    }

    return {
      id: nextBlock.block.id || "next",
      label: nextBlock.block.label,
      sourceType: nextBlock.block.sourceType || "block",
      startAt: nextBlock.startAt.toISOString(),
      reminderAt: nextBlock.reminderAt.toISOString(),
      reminderMinutes
    };
  } catch {
    return null;
  }
}

function normalizePlanBlockReminderMinutes(value) {
  if (!Number.isFinite(value)) {
    return 15;
  }
  return Math.max(0, Math.min(120, Math.round(value)));
}

function persistLocalCoreState() {
  if (localCoreStateLocked) {
    return pendingCoreStateWrite;
  }
  const stateSnapshot = cloneState(serverState);
  const appStateWrite = writeLocalAppState(stateSnapshot).then((saved) => {
    if (saved) {
      removeScopedLocalStorageItem(APP_STATE_STORAGE_KEY);
    }
    return saved;
  });
  const notificationWrite = writeNotificationSnapshot(buildNotificationSnapshot(stateSnapshot));
  pendingCoreStateWrite = Promise.allSettled([appStateWrite, notificationWrite]).then(() => undefined);
  return pendingCoreStateWrite;
}

async function flushLocalCoreState() {
  await pendingCoreStateWrite;
  if (localCoreStateLocked) {
    return;
  }
  await persistLocalCoreState();
}

registerPendingWriteFlusher("legacy-core-state", () => flushLocalCoreState());
registerPendingWriteFlusher("account-client-state", () => flushAccountClientState());

function setServerState(state) {
  localCoreStateLocked = false;
  serverState = normalizeState(state);
  applyDangerModeToState(serverState);
  persistLocalCoreState();
  rebuildAppState();
}

function rebuildAppState() {
  const derivedState = cloneState(serverState);
  applyState(derivedState);
  syncSyncStatusUi(getSyncUiState());
}

function bindConnectivitySync() {
  window.addEventListener("online", () => {
    isServerReachable = true;
    syncSyncStatusUi(getSyncUiState());
  });

  window.addEventListener("offline", () => {
    isServerReachable = true;
    syncSyncStatusUi(getSyncUiState());
  });

  window.addEventListener(DANGER_MODE_EVENT, () => {
    if (readDangerModeEnabled()) {
      destroyDangerModeTasks({ announce: true });
    } else {
      destroyDangerModeTasks();
    }
  });
}

function appendSyncIssue(issue) {
  void issue;
  syncSyncStatusUi(getSyncUiState());
}

function persistMutationQueue() {
  mutationQueue = [];
  rebuildAppState();
}

function enqueueMutation(mutation) {
  void performQueuedMutation(mutation);
}

async function performQueuedMutation(mutation) {
  if (!mutation || typeof mutation !== "object") {
    return false;
  }

  if (!(await ensureCoreStateWritable({ interactive: true }))) {
    if (typeof mutation.taskId === "string") {
      clearTaskCompletingState(mutation.taskId);
    }
    rebuildAppState();
    syncSyncStatusUi(getSyncUiState());
    return false;
  }

  applyMutationToState(serverState, mutation, TEST_PUSH_INTERVAL_SECONDS);
  setServerState(serverState);
  return true;
}

async function processMutationQueue() {
  mutationQueue = [];
  isSyncInFlight = false;
  syncSyncStatusUi(getSyncUiState());
}

async function initializeApp() {
  try {
    const registrationPromise = shouldDisableServiceWorkersForLocalDev()
      ? disableServiceWorkersForLocalDev()
      : registerServiceWorker(APP_BUILD_ID);

    await migrateLegacyProtectedStorageToDurableStores();
    await loadState({ includeBackgroundWork: false });
    try {
      // Race against a 8-second timeout so the flag is always set even if
      // loadAccountClientState() hangs (e.g. IndexedDB unavailable in tests).
      await Promise.race([
        loadAccountClientState(),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error("Account state load timeout")), 8000))
      ]);
    } catch (error) {
      console.warn("Account client state could not be loaded. Continuing with local feature state.", error);
      accountClientStateLoaded = true;
      accountClientStateSyncPausedUntil = Date.now() + ACCOUNT_CLIENT_SYNC_PAUSE_MS;
    }
    await importFromLocalHelper();
    void runInitialBackgroundWork();
    consumeBankingStartupStatus();

    try {
      const registrationResult = await registrationPromise;
      serviceWorkerRegistration = registrationResult.serviceWorkerRegistration;
      pushSupported = registrationResult.pushSupported;
      await syncPushSubscription();
    } catch {
      serviceWorkerRegistration = null;
      pushSupported = false;
      pushSubscription = null;
    }

    startAlertClaimLoop();
  } catch {
    if (!accountClientStateLoaded) {
      accountClientStateLoaded = true;
    }

    if (todos.length === 0) {
      serverState = normalizeState(createDefaultState());
      rebuildAppState();
    }
  } finally {
    if (!accountClientStateLoaded) {
      accountClientStateLoaded = true;
    }
    signalRuntimeReady();
  }
}

async function disableServiceWorkersForLocalDev() {
  if (!("serviceWorker" in navigator)) {
    return {
      serviceWorkerRegistration: null,
      pushSupported: false
    };
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.map((registration) => registration.unregister()));

  return {
    serviceWorkerRegistration: null,
    pushSupported: false
  };
}

async function loadState({ includeBackgroundWork = true } = {}) {
  if (isStateSyncInFlight) {
    return;
  }

  isStateSyncInFlight = true;
  try {
    await hydrateLocalState();
    if (!includeBackgroundWork) {
      return;
    }

    await runInitialBackgroundWork();
  } finally {
    isStateSyncInFlight = false;
  }
}

async function runInitialBackgroundWork() {
  try {
    await refreshOutlookCalendar({ force: true, silent: true });
  } catch {
    // The calendar view can catch up in the background if Outlook is slow or unavailable.
  }

  try {
    await processMutationQueue();
  } catch {
    // The queued mutations stay available for the connectivity retry path.
  }

  try {
    await claimAlerts();
  } catch {
    // Alert polling will retry on the next scheduled interval.
  }

}

function startStateSyncLoop() {
  // Core state is local-first; there is no polling sync loop.
}

function startSseSync() {
  // Core state is local-first; helper events are feature-specific.
}

async function syncStateFromServer() {
  await hydrateLocalState();
}

async function startDevReloadLoop() {
  // Installed PWA versions are pinned. The dashboard version bubble owns
  // update checks and activation, so background reload polling stays disabled.
}

async function syncDevServerVersion() {
  try {
    const payload = await apiFetch("/api/dev/version");
    const nextVersion = typeof payload?.version === "string" ? payload.version : null;
    if (!nextVersion) {
      return;
    }

    devServerVersion = nextVersion;
  } catch {
    // Ignore transient errors while the dev server is restarting.
  }
}

function applyState(state) {
  todos = Array.isArray(state?.tasks) ? state.tasks : [];
  alertState = {
    enabled: state?.alerts?.enabled !== false,
    nextAlertAt: typeof state?.alerts?.nextAlertAt === "string" ? state.alerts.nextAlertAt : null,
    testPushEnabled: state?.alerts?.testPushEnabled === true,
    nextTestPushAt: typeof state?.alerts?.nextTestPushAt === "string" ? state.alerts.nextTestPushAt : null
  };
  outlookState = {
    email: typeof state?.outlook?.email === "string" ? state.outlook.email : "",
    icsUrl:
      typeof state?.outlook?.icsUrl === "string"
        ? state.outlook.icsUrl
        : typeof state?.outlook?.calendarId === "string"
          ? state.outlook.calendarId
          : "",
    syncMode: typeof state?.outlook?.syncMode === "string" ? state.outlook.syncMode : "outlook-to-today",
    configured: state?.outlook?.configured === true,
    autoSyncEnabled: state?.outlook?.autoSyncEnabled === true,
    lastSyncAt: typeof state?.outlook?.lastSyncAt === "string" ? state.outlook.lastSyncAt : null,
    lastSyncResult:
      typeof state?.outlook?.lastSyncResult === "string" ? state.outlook.lastSyncResult : null
  };
  if (!outlookState.icsUrl) {
    resetOutlookSyncState();
  }
  monzoState = normalizeState({ monzo: state?.banking || state?.monzo || {} }).monzo;
  lastStateSignature = getStateSignature(state);
  render();
  syncFeatureUi();
}

function render() {
  syncPageChrome(todos, activePage);
  applyPageStates(activePage, activePage, false);
  publishAppBridgeState();
}

function setActivePage(nextPage) {
  const nextState = applyActivePageChange({
    nextPage,
    topLevelPages: TOP_LEVEL_PAGES,
    currentPage: activePage,
    hasAnimatedPageTransition,
    applyPageStates,
    syncPageChrome(nextActivePage) {
      syncPageChrome(todos, nextActivePage);
    },
    storageKey: ACTIVE_PAGE_STORAGE_KEY
  });
  activePage = nextState.activePage;
  hasAnimatedPageTransition = nextState.hasAnimatedPageTransition;

  if (activePage === "books") {
    void ensureBooksFeatureInitialized();
  }
  if (activePage === "calendar" || activePage === "dashboard") {
    void refreshOutlookCalendar({ silent: true });
  }
  syncFeatureUi();
}

function setActiveSettingsPanel(nextPanel) {
  activeSettingsPanel = applySettingsPanelChange({
    nextPanel,
    validPanels: SETTINGS_PANELS,
    currentPanel: activeSettingsPanel,
    activePage,
    syncSettingsPanelUi,
    syncPageChrome(nextActivePage) {
      syncPageChrome(todos, nextActivePage);
    }
  });
  publishAppBridgeState();
}

function setActiveRssPanel(nextPanel) {
  activeRssPanel = applyRssPanelChange({
    nextPanel,
    validPanels: new Set(["root", "sources", "reader"]),
    currentPanel: activeRssPanel,
    activePage,
    syncRssPanelUi,
    syncPageChrome(nextActivePage) {
      syncPageChrome(todos, nextActivePage);
    }
  });
  publishAppBridgeState();
}

function syncFeatureUi() {
  const displayCalendarEvents = getCombinedCalendarEvents();
  syncTestPushUi(alertState, pushSubscription, scheduleFormatter);
  syncNotificationUi({ pushSubscription, pushSupported });
  publishAppBridgeState(displayCalendarEvents);
}

function getSyncUiState() {
  return buildSyncUiState({
    mutationQueue,
    syncIssues,
    isServerReachable,
    isSyncInFlight
  });
}

function publishAppBridgeState(displayCalendarEvents = getCombinedCalendarEvents()) {
  publishRuntimeAppBridgeState({
    activePage,
    activeFilter,
    activeSettingsPanel,
    activeRssPanel,
    isDesktopWeb: document.body?.dataset.webDesktop === "true",
    enteringTaskIds,
    completingTaskIds,
    todos,
    alertState,
    monzoState,
    monzoExpenses,
    monzoView,
    habits,
    longTermGoals,
    booksFeature,
    notesFeature,
    rssFeature,
    outlookState,
    calendarEvents: displayCalendarEvents,
    calendarStartDate,
    calendarSelectedDate,
    calendarDraftEvent,
    pushSupported,
    pushSubscription,
    uiTheme,
    uiMode,
    uiAccent,
    uiFont,
    liquidGlassEnabled,
    cordycepsUnderlayEnabled,
    uiCustomBackground,
    uiCustomTransparency,
    uiCustomCardTransparency,
    syncUiState: getSyncUiState()
  });
}

function toast(title, message) {
  showToast(title, message, TOAST_DURATION_MS);
}
