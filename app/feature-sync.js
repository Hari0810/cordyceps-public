const APP_BRIDGE_STATE_EVENT = "city-app:state";
const APP_BRIDGE_STORE_KEY = "__CITY_APP_BRIDGE__";

export function buildSyncUiState({
  mutationQueue,
  syncIssues,
  isServerReachable,
  isSyncInFlight
}) {
  return {
    mutationQueue,
    syncIssues,
    isServerReachable,
    isSyncInFlight
  };
}

export function buildAppBridgeState({
  activePage,
  activeFilter,
  activeSettingsPanel,
  activeRssPanel,
  isDesktopWeb,
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
  calendarEvents,
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
  uiCustomBackground,
  uiCustomTransparency,
  uiCustomCardTransparency,
  syncUiState
}) {
  return {
    activePage,
    activeFilter,
    activeSettingsPanel,
    activeRssPanel,
    isDesktopWeb,
    enteringTaskIds: Array.from(enteringTaskIds || []),
    completingTaskIds: Array.from(completingTaskIds || []),
    todos: Array.isArray(todos) ? todos.map((todo) => ({ ...todo })) : [],
    notes: notesFeature.getSnapshot ? notesFeature.getSnapshot() : {
      entries: [],
      activeEntryId: null,
      activeEntry: null,
      mode: "lite",
      view: "list",
      rendered: false,
      encryptedModeAvailable: false,
      encryptedVault: {
        available: false,
        configured: false,
        unlocked: false,
        folderPath: "",
        noteCount: 0,
        statusMessage: "Vault locked."
      }
    },
    books: booksFeature.getSnapshot ? booksFeature.getSnapshot() : {
      view: "library",
      activeBookId: "",
      activeBook: null,
      books: []
    },
    habits: Array.isArray(habits) ? habits.map((habit) => ({ ...habit })) : [],
    longTermGoals: Array.isArray(longTermGoals)
      ? longTermGoals.map((goal) => ({
          ...goal,
          subgoals: Array.isArray(goal.subgoals) ? goal.subgoals.map((subgoal) => ({ ...subgoal })) : []
        }))
      : [],
    monzo: {
      state: {
        ...monzoState
      },
      expenses: Array.isArray(monzoExpenses) ? monzoExpenses.map((expense) => ({ ...expense })) : [],
      view: monzoView
    },
    banking: {
      state: {
        ...monzoState,
        provider: monzoState?.provider || monzoState?.connectionProvider || ""
      },
      expenses: Array.isArray(monzoExpenses) ? monzoExpenses.map((expense) => ({ ...expense })) : [],
      view: monzoView
    },
    rss: rssFeature.getSnapshot ? rssFeature.getSnapshot() : {
      feeds: [],
      activeFeedId: "all",
      isRefreshing: false
    },
    calendar: {
      startDate: calendarStartDate instanceof Date
        ? calendarStartDate.toISOString()
        : new Date(calendarStartDate || Date.now()).toISOString(),
      selectedDate: calendarSelectedDate instanceof Date
        ? calendarSelectedDate.toISOString()
        : new Date(calendarSelectedDate || calendarStartDate || Date.now()).toISOString(),
      events: Array.isArray(calendarEvents) ? calendarEvents.map((event) => ({ ...event })) : [],
      draftEvent: calendarDraftEvent ? { ...calendarDraftEvent } : null
    },
    settings: {
      alertState: { ...alertState },
      outlookState: { ...outlookState },
      monzoState: { ...monzoState },
      bankingState: {
        ...monzoState,
        provider: monzoState?.provider || monzoState?.connectionProvider || ""
      },
      pushSupported,
      pushEnabled: Boolean(pushSubscription),
      uiTheme,
      uiMode,
      uiAccent,
      uiFont,
      liquidGlassEnabled,
      uiCustomBackground,
      uiCustomTransparency,
      uiCustomCardTransparency,
      syncUiState: {
        mutationQueue: Array.isArray(syncUiState?.mutationQueue) ? [...syncUiState.mutationQueue] : [],
        syncIssues: Array.isArray(syncUiState?.syncIssues) ? syncUiState.syncIssues.map((issue) => ({ ...issue })) : [],
        isServerReachable: syncUiState?.isServerReachable !== false,
        isSyncInFlight: syncUiState?.isSyncInFlight === true
      }
    }
  };
}

function getAppBridgeStore() {
  if (typeof window === "undefined") {
    return {
      snapshot: null,
      updatedAt: 0
    };
  }

  if (!window[APP_BRIDGE_STORE_KEY] || typeof window[APP_BRIDGE_STORE_KEY] !== "object") {
    window[APP_BRIDGE_STORE_KEY] = {
      snapshot: null,
      updatedAt: 0
    };
  }

  return window[APP_BRIDGE_STORE_KEY];
}

export function readAppBridgeState() {
  return getAppBridgeStore().snapshot || null;
}

export function publishAppBridgeState(options) {
  const snapshot = buildAppBridgeState(options);
  const store = getAppBridgeStore();
  store.snapshot = snapshot;
  store.updatedAt = Date.now();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(APP_BRIDGE_STATE_EVENT, {
      detail: snapshot
    }));
  }

  return snapshot;
}
