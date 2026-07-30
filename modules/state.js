import { getScopedLocalStorageItem, setScopedLocalStorageItem } from "./storage-scope.js";

export function createDefaultState() {
  return {
    tasks: [],
    alerts: {
      enabled: true,
      nextAlertAt: null,
      testPushEnabled: false,
      nextTestPushAt: null
    },
    outlook: {
      email: "",
      icsUrl: "",
      syncMode: "outlook-to-today",
      autoSyncEnabled: false,
      configured: false,
      lastSyncAt: null,
      lastSyncResult: null
    },
    monzo: {
      accountId: "",
      accountIds: [],
      accountDescription: "",
      configured: false,
      provider: "",
      connectionProvider: "",
      connectionStatus: "",
      institutionId: "",
      institutionName: "",
      requisitionId: "",
      providerId: "",
      accessToken: "",
      refreshToken: "",
      tokenType: "",
      tokenExpiresAt: null,
      redirectUri: "",
      consentExpiresAt: null,
      scopes: [],
      balanceAmountMinor: null,
      balanceCurrency: "",
      lastSyncAt: null,
      lastSyncResult: null
    },
    banking: {
      accountId: "",
      accountIds: [],
      accountDescription: "",
      configured: false,
      provider: "",
      connectionProvider: "",
      connectionStatus: "",
      institutionId: "",
      institutionName: "",
      requisitionId: "",
      providerId: "",
      accessToken: "",
      refreshToken: "",
      tokenType: "",
      tokenExpiresAt: null,
      redirectUri: "",
      consentExpiresAt: null,
      scopes: [],
      balanceAmountMinor: null,
      balanceCurrency: "",
      lastSyncAt: null,
      lastSyncResult: null
    }
  };
}

export function loadStoredJson(key, fallbackValue) {
  try {
    const raw = getScopedLocalStorageItem(key);
    if (!raw) {
      return fallbackValue;
    }

    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

export function saveStoredJson(key, value) {
  try {
    setScopedLocalStorageItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures so the app remains usable in private or restricted modes.
  }
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function normalizeState(state) {
  const base = createDefaultState();
  const nextState = state && typeof state === "object" ? state : {};
  return {
    tasks: Array.isArray(nextState.tasks) ? nextState.tasks : base.tasks,
    alerts: {
      ...base.alerts,
      ...(nextState.alerts && typeof nextState.alerts === "object" ? nextState.alerts : {})
    },
    outlook: {
      ...base.outlook,
      ...(nextState.outlook && typeof nextState.outlook === "object"
        ? nextState.outlook
        : {})
    },
    monzo: {
      ...base.monzo,
      ...(nextState.monzo && typeof nextState.monzo === "object"
        ? nextState.monzo
        : {})
    },
    banking: {
      ...base.banking,
      ...(nextState.banking && typeof nextState.banking === "object"
        ? nextState.banking
        : nextState.monzo && typeof nextState.monzo === "object"
          ? nextState.monzo
          : {})
    }
  };
}

export function applyMutationToState(state, mutation, testPushIntervalSeconds) {
  if (!mutation || typeof mutation !== "object") {
    return;
  }

  if (mutation.kind === "task.add") {
    state.tasks = [mutation.task, ...state.tasks.filter((task) => task.id !== mutation.task.id)];
    return;
  }

  if (mutation.kind === "task.update") {
    state.tasks = state.tasks.map((task) => {
      if (task.id !== mutation.taskId) {
        return task;
      }

      const nextTask = { ...task, ...mutation.changes };
      if (Object.prototype.hasOwnProperty.call(mutation.changes, "completed")) {
        nextTask.completedAt = mutation.changes.completed
          ? mutation.completedAt || nextTask.completedAt || new Date().toISOString()
          : null;
      }
      return nextTask;
    });
    return;
  }

  if (mutation.kind === "task.delete") {
    state.tasks = state.tasks.filter((task) => task.id !== mutation.taskId);
    return;
  }

  if (mutation.kind === "task.clearCompleted") {
    state.tasks = state.tasks.filter((task) => !task.completed);
    return;
  }

  if (mutation.kind === "alerts.toggle") {
    state.alerts.enabled = mutation.enabled;
    if (!mutation.enabled) {
      state.alerts.nextAlertAt = null;
    }
    return;
  }

  if (mutation.kind === "alerts.testPushToggle") {
    state.alerts.testPushEnabled = mutation.enabled;
    state.alerts.nextTestPushAt = mutation.enabled
      ? new Date(Date.now() + testPushIntervalSeconds * 1000).toISOString()
      : null;
    return;
  }

  if (mutation.kind === "outlook.settings") {
    state.outlook = {
      ...state.outlook,
      ...mutation.changes
    };
    return;
  }
}

export function buildSyncIssueMessage(issue) {
  if (!issue || typeof issue !== "object") {
    return "A local data issue needs attention.";
  }

  if (issue.kind === "task.update") {
    return "Skipped a task edit because the task no longer exists locally.";
  }

  if (issue.kind === "task.delete") {
    return "A task delete could not find its local task, so it was treated as already resolved.";
  }

  return issue.message || "A local data issue needs attention.";
}

export function getStateSignature(state) {
  return JSON.stringify({
    tasks: Array.isArray(state?.tasks) ? state.tasks : [],
    alerts: {
      enabled: state?.alerts?.enabled !== false,
      nextAlertAt: typeof state?.alerts?.nextAlertAt === "string" ? state.alerts.nextAlertAt : null,
      testPushEnabled: state?.alerts?.testPushEnabled === true,
      nextTestPushAt: typeof state?.alerts?.nextTestPushAt === "string" ? state.alerts.nextTestPushAt : null
    },
    outlook: {
      email: typeof state?.outlook?.email === "string" ? state.outlook.email : null,
      icsUrl:
        typeof state?.outlook?.icsUrl === "string"
          ? state.outlook.icsUrl
          : typeof state?.outlook?.calendarId === "string"
            ? state.outlook.calendarId
            : null,
      syncMode:
        typeof state?.outlook?.syncMode === "string" ? state.outlook.syncMode : null,
      configured: state?.outlook?.configured === true,
      autoSyncEnabled: state?.outlook?.autoSyncEnabled === true,
      lastSyncAt:
        typeof state?.outlook?.lastSyncAt === "string" ? state.outlook.lastSyncAt : null,
      lastSyncResult:
        typeof state?.outlook?.lastSyncResult === "string" ? state.outlook.lastSyncResult : null
    },
    monzo: {
      accountId:
        typeof state?.monzo?.accountId === "string" ? state.monzo.accountId : null,
      accountDescription:
        typeof state?.monzo?.accountDescription === "string"
          ? state.monzo.accountDescription
          : null,
      configured: state?.monzo?.configured === true,
      connectionProvider:
        typeof state?.monzo?.connectionProvider === "string" ? state.monzo.connectionProvider : null,
      connectionStatus:
        typeof state?.monzo?.connectionStatus === "string" ? state.monzo.connectionStatus : null,
      providerId:
        typeof state?.monzo?.providerId === "string" ? state.monzo.providerId : null,
      accessToken:
        typeof state?.monzo?.accessToken === "string" ? state.monzo.accessToken : null,
      refreshToken:
        typeof state?.monzo?.refreshToken === "string" ? state.monzo.refreshToken : null,
      tokenType:
        typeof state?.monzo?.tokenType === "string" ? state.monzo.tokenType : null,
      tokenExpiresAt:
        typeof state?.monzo?.tokenExpiresAt === "string" ? state.monzo.tokenExpiresAt : null,
      redirectUri:
        typeof state?.monzo?.redirectUri === "string" ? state.monzo.redirectUri : null,
      consentExpiresAt:
        typeof state?.monzo?.consentExpiresAt === "string" ? state.monzo.consentExpiresAt : null,
      scopes:
        Array.isArray(state?.monzo?.scopes) ? state.monzo.scopes : [],
      balanceAmountMinor:
        typeof state?.monzo?.balanceAmountMinor === "number" ? state.monzo.balanceAmountMinor : null,
      balanceCurrency:
        typeof state?.monzo?.balanceCurrency === "string" ? state.monzo.balanceCurrency : null,
      lastSyncAt:
        typeof state?.monzo?.lastSyncAt === "string" ? state.monzo.lastSyncAt : null,
      lastSyncResult:
        typeof state?.monzo?.lastSyncResult === "string" ? state.monzo.lastSyncResult : null
    }
  });
}

function getPriorityRank(priority) {
  if (priority === "urgent") return 0;
  if (priority === "important") return 1;
  return 2;
}

export function getFilteredTodos(todos, activeFilter) {
  const sortedTodos = [...todos].sort((left, right) => {
    if (Boolean(left.completed) !== Boolean(right.completed)) {
      return left.completed ? 1 : -1;
    }

    const priorityDifference = getPriorityRank(left.priority) - getPriorityRank(right.priority);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    if (Boolean(left.pinned) !== Boolean(right.pinned)) {
      return left.pinned ? -1 : 1;
    }

    return 0;
  });

  if (activeFilter === "active") {
    return sortedTodos.filter((todo) => !todo.completed);
  }

  if (activeFilter === "completed") {
    return sortedTodos.filter((todo) => todo.completed);
  }

  return sortedTodos;
}

export function getEmptyStateMessage(activeFilter) {
  if (activeFilter === "active") {
    return "No active tasks. Everything is caught up.";
  }

  if (activeFilter === "completed") {
    return "No completed tasks yet.";
  }

  return "Nothing here yet. Add your first task.";
}

export function createUuid() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  // Fallback for environments without randomUUID: use getRandomValues for entropy.
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant bits
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
