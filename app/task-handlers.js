/**
 * Task CRUD handlers — add, import, complete, prioritize, clear completed.
 *
 * App.js-owned dependencies are injected via `bindTaskHandlerCallbacks`.
 *
 * Dependencies (direct imports):
 *   createUuid                                        — ../modules/state.js
 *   showToast, syncSyncStatusUi                       — ../modules/ui.js
 *   markTaskAsEntering, markTaskAsCompleting,
 *   clearTaskCompletingState                          — ./todo-swipe.js
 */

import { createUuid } from "../modules/state.js";
import { showToast, syncSyncStatusUi } from "../modules/ui.js";
import {
  animateTaskRemoval,
  clearTaskCompletingState,
  markTaskAsCompleting,
  markTaskAsEntering,
} from "./todo-swipe.js";

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

const TOAST_DURATION_MS = 5000;
const HOME_PAGE = "dashboard";

function readFormInput(form, selector) {
  const directMatch = form?.querySelector(selector);
  if (directMatch instanceof HTMLInputElement || directMatch instanceof HTMLTextAreaElement) {
    return directMatch;
  }

  const globalMatch = document.querySelector(selector);
  if (globalMatch instanceof HTMLInputElement || globalMatch instanceof HTMLTextAreaElement) {
    return globalMatch;
  }

  return null;
}

function readTodoFormInput(event) {
  const form = event?.currentTarget instanceof HTMLFormElement
    ? event.currentTarget
    : document.querySelector("#todo-form");
  return {
    form: form instanceof HTMLFormElement ? form : null,
    input: readFormInput(form, "#todo-input"),
  };
}

function readImportFormInput(event) {
  const form = event?.currentTarget instanceof HTMLFormElement
    ? event.currentTarget
    : document.querySelector("#import-form");
  return {
    form: form instanceof HTMLFormElement ? form : null,
    input: readFormInput(form, "#import-input"),
  };
}

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _getTodos = () => [];
let _isDemoRuntimeMode = () => false;
let _performDemoMutation = () => {};
let _seedDemoServerState = () => {};
let _performQueuedMutation = async () => {};
let _getSyncUiState = () => ({});
let _setActivePage = () => {};

/**
 * Inject app.js-owned dependencies. Must be called once at boot.
 *
 * @param {object} callbacks
 */
export function bindTaskHandlerCallbacks(callbacks) {
  _getTodos = callbacks.getTodos ?? _getTodos;
  _isDemoRuntimeMode = callbacks.isDemoRuntimeMode ?? _isDemoRuntimeMode;
  _performDemoMutation = callbacks.performDemoMutation ?? _performDemoMutation;
  _seedDemoServerState = callbacks.seedDemoServerState ?? _seedDemoServerState;
  _performQueuedMutation = callbacks.performQueuedMutation ?? _performQueuedMutation;
  _getSyncUiState = callbacks.getSyncUiState ?? _getSyncUiState;
  _setActivePage = callbacks.setActivePage ?? _setActivePage;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleAddTaskSubmit(event) {
  event.preventDefault();

  const { input } = readTodoFormInput(event);
  const value = input?.value.trim() || "";
  if (!value) {
    return;
  }

  const taskId = createUuid();
  const createdAt = new Date().toISOString();
  const mutation = {
    kind: "task.add",
    task: {
      id: taskId,
      text: value,
      completed: false,
      pinned: false,
      priority: "none",
      createdAt,
      completedAt: null
    },
    request: {
      url: "/api/tasks",
      options: {
        method: "POST",
        body: JSON.stringify({ id: taskId, text: value })
      }
    }
  };

  markTaskAsEntering(taskId);
  input.value = "";
  if (_isDemoRuntimeMode()) {
    _performDemoMutation(mutation);
    return;
  }

  try {
    await _performQueuedMutation(mutation);
  } catch {
    syncSyncStatusUi(_getSyncUiState());
    showToast("Task saved", "This task was saved on this device.", TOAST_DURATION_MS);
  }
}

export function handleTodoInputKeyDown(event) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }

  const form = event.target instanceof HTMLInputElement
    ? event.target.closest("form")
    : null;
  event.preventDefault();
  if (form instanceof HTMLFormElement && typeof form.requestSubmit === "function") {
    form.requestSubmit();
    return;
  }

  form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

export async function handleImportSubmit(event) {
  event.preventDefault();

  const { input } = readImportFormInput(event);
  const value = input?.value.trim() || "";
  if (!value) {
    showToast("Nothing to import", "Paste one or more lines first.", TOAST_DURATION_MS);
    return;
  }

  try {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      showToast("Nothing to import", "Paste one or more lines first.", TOAST_DURATION_MS);
      return;
    }

    for (const line of lines) {
      const taskId = createUuid();
      const createdAt = new Date().toISOString();
      markTaskAsEntering(taskId);
      await _performQueuedMutation({
        kind: "task.add",
        task: {
          id: taskId,
          text: line,
          completed: false,
          pinned: false,
          priority: "none",
          createdAt,
          completedAt: null
        },
        request: {
          url: "/api/tasks",
          options: {
            method: "POST",
            body: JSON.stringify({ id: taskId, text: line })
          }
        }
      });
    }

    if (input) {
      input.value = "";
    }
    _setActivePage(HOME_PAGE);
    showToast("Tasks imported", "Each non-empty line was added as a task.", TOAST_DURATION_MS);
  } catch {
    showToast("Import failed", "The pasted task list could not be imported.", TOAST_DURATION_MS);
  }
}

export async function clearCompletedTasks() {
  await _performQueuedMutation({
    kind: "task.clearCompleted",
    request: {
      url: "/api/tasks/clear-completed",
      options: {
        method: "POST"
      }
    }
  });
}

export async function handleTodoListClick(event) {
  const target =
    event.target instanceof HTMLElement ? event.target : event.target?.parentElement;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const item = target.closest("[data-id]");
  if (!item) {
    return;
  }

  const { id } = item.dataset;
  if (!id) {
    return;
  }

  const checkButton = target.closest(".check-button");
  if (checkButton) {
    let todo = _getTodos().find((entry) => entry.id === id);
    if (!todo && _isDemoRuntimeMode()) {
      _seedDemoServerState();
      todo = _getTodos().find((entry) => entry.id === id);
    }
    if (!todo) {
      return;
    }

    const willComplete = !todo.completed;
    if (willComplete) {
      markTaskAsCompleting(id);
      await animateTaskRemoval(item);
    } else {
      clearTaskCompletingState(id);
    }

    if (_isDemoRuntimeMode()) {
      _performDemoMutation({
        kind: "task.update",
        taskId: id,
        changes: { completed: willComplete },
        completedAt: willComplete ? new Date().toISOString() : null,
        request: { url: `/api/tasks/${id}`, options: { method: "PATCH", body: JSON.stringify({ completed: willComplete }) } }
      });
      return;
    }

    await _performQueuedMutation({
      kind: "task.update",
      taskId: id,
      changes: { completed: willComplete },
      completedAt: willComplete ? new Date().toISOString() : null,
      request: {
        url: `/api/tasks/${id}`,
        options: {
          method: "PATCH",
          body: JSON.stringify({ completed: willComplete })
        }
      }
    });
    return;
  }

  const priorityButton = target.closest(".priority-button");
  if (priorityButton) {
    let todo = _getTodos().find((entry) => entry.id === id);
    if (!todo && _isDemoRuntimeMode()) {
      _seedDemoServerState();
      todo = _getTodos().find((entry) => entry.id === id);
    }
    if (!todo) {
      return;
    }
    if (todo.completed) {
      return;
    }

    const requestedPriority = priorityButton.dataset.priority === "important" || priorityButton.dataset.priority === "urgent"
      ? priorityButton.dataset.priority
      : "none";
    const nextPriority = todo.priority === requestedPriority ? "none" : requestedPriority;

    if (_isDemoRuntimeMode()) {
      _performDemoMutation({
        kind: "task.update",
        taskId: id,
        changes: { priority: nextPriority },
        request: { url: `/api/tasks/${id}`, options: { method: "PATCH", body: JSON.stringify({ priority: nextPriority }) } }
      });
      return;
    }

    await _performQueuedMutation({
      kind: "task.update",
      taskId: id,
      changes: { priority: nextPriority },
      request: {
        url: `/api/tasks/${id}`,
        options: {
          method: "PATCH",
          body: JSON.stringify({ priority: nextPriority })
        }
      }
    });
    return;
  }
}
