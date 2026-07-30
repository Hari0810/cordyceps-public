/**
 * Todo swipe-to-complete / pin and task animation state.
 *
 * Owns `swipeGesture`, `enteringTaskIds/Timers`, `completingTaskIds/Timers`.
 * App.js reads `enteringTaskIds` and `completingTaskIds` directly via live
 * exports for publishAppBridgeState.
 *
 * App.js-owned dependencies are injected via `bindTodoSwipeCallbacks`.
 *
 * Dependencies (direct imports): none — all injected.
 */

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

const SWIPE_COMPLETE_THRESHOLD_PX = 96;
const SWIPE_PIN_THRESHOLD_PX = 88;
const SWIPE_LOCK_THRESHOLD_PX = 12;
const LONG_PRESS_EDIT_MS = 560;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _getTodos = () => [];
let _isDemoRuntimeMode = () => false;
let _seedDemoServerState = () => {};
let _performDemoMutation = () => {};
let _performQueuedMutation = async () => {};
let _render = () => {};

/**
 * Inject app.js-owned dependencies. Must be called once at boot.
 *
 * @param {object} callbacks
 * @param {() => any[]}  callbacks.getTodos
 * @param {() => boolean} callbacks.isDemoRuntimeMode
 * @param {() => void}   callbacks.seedDemoServerState
 * @param {(mutation: object) => void} callbacks.performDemoMutation
 * @param {(mutation: object) => Promise<void>} callbacks.performQueuedMutation
 * @param {() => void}   callbacks.render
 */
export function bindTodoSwipeCallbacks(callbacks) {
  _getTodos = callbacks.getTodos ?? _getTodos;
  _isDemoRuntimeMode = callbacks.isDemoRuntimeMode ?? _isDemoRuntimeMode;
  _seedDemoServerState = callbacks.seedDemoServerState ?? _seedDemoServerState;
  _performDemoMutation = callbacks.performDemoMutation ?? _performDemoMutation;
  _performQueuedMutation = callbacks.performQueuedMutation ?? _performQueuedMutation;
  _render = callbacks.render ?? _render;
}

// ---------------------------------------------------------------------------
// Module-owned state
// ---------------------------------------------------------------------------

let swipeGesture = null;
export const enteringTaskIds = new Set();
const enteringTaskTimers = new Map();
export const completingTaskIds = new Set();
const completingTaskTimers = new Map();

/** Returns true if a swipe gesture is in progress (used by page-swipe module). */
export function isSwipeGestureActive() {
  return Boolean(swipeGesture);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resetSwipeItem(item) {
  item.style.transform = "";
  item.classList.remove("is-pressing", "is-swiping", "is-swiping-delete", "is-swiping-pin");
}

export function animateTaskRemoval(item) {
  resetSwipeItem(item);
  item.classList.add("is-removing");

  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      item.removeEventListener("animationend", finish);
      resolve();
    };

    item.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, 240);
  });
}

function clearLongPressTimer(gesture) {
  if (!gesture?.longPressTimer) {
    return;
  }

  window.clearTimeout(gesture.longPressTimer);
  gesture.longPressTimer = null;
}

async function editTaskFromLongPress(gesture) {
  clearLongPressTimer(gesture);
  swipeGesture = null;
  resetSwipeItem(gesture.item);

  const todos = _getTodos();
  let todo = todos.find((entry) => entry.id === gesture.id);
  if (!todo && _isDemoRuntimeMode()) {
    _seedDemoServerState();
    todo = _getTodos().find((entry) => entry.id === gesture.id);
  }
  if (!todo || todo.completed) {
    return;
  }

  const nextText = window.prompt("Edit task", todo.text || "");
  if (nextText === null) {
    return;
  }

  const text = nextText.trim();
  if (!text || text === todo.text) {
    return;
  }

  const mutation = {
    kind: "task.update",
    taskId: gesture.id,
    changes: { text },
    request: {
      url: `/api/tasks/${gesture.id}`,
      options: {
        method: "PATCH",
        body: JSON.stringify({ text })
      }
    }
  };

  if (_isDemoRuntimeMode()) {
    _performDemoMutation(mutation);
    return;
  }

  await _performQueuedMutation(mutation);
}

// ---------------------------------------------------------------------------
// Pointer handlers
// ---------------------------------------------------------------------------

export function handleTodoPointerDown(event) {
  const target =
    event.target instanceof HTMLElement ? event.target : event.target?.parentElement;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (event.button !== 0) {
    return;
  }

  if (target.closest(".check-button") || target.closest(".priority-button")) {
    return;
  }

  const item = target.closest(".todo-item");
  if (!(item instanceof HTMLElement)) {
    return;
  }

  const { id } = item.dataset;
  if (!id) {
    return;
  }

  const todos = _getTodos();
  let todo = todos.find((entry) => entry.id === id);
  if (!todo && _isDemoRuntimeMode()) {
    _seedDemoServerState();
    todo = _getTodos().find((entry) => entry.id === id);
  }
  if (todo?.completed) {
    return;
  }

  swipeGesture = {
    pointerId: event.pointerId,
    item,
    id,
    startX: event.clientX,
    startY: event.clientY,
    deltaX: 0,
    axisLocked: null,
    isSwiping: false,
    didLongPress: false,
    longPressTimer: null
  };
  item.classList.add("is-pressing");
  swipeGesture.longPressTimer = window.setTimeout(() => {
    if (!swipeGesture || swipeGesture.pointerId !== event.pointerId) {
      return;
    }

    swipeGesture.didLongPress = true;
    void editTaskFromLongPress(swipeGesture);
  }, LONG_PRESS_EDIT_MS);
}

export function handleTodoPointerMove(event) {
  if (!swipeGesture || swipeGesture.pointerId !== event.pointerId) {
    return;
  }

  const todos = _getTodos();
  let todo = todos.find((entry) => entry.id === swipeGesture.id);
  if (!todo && _isDemoRuntimeMode()) {
    _seedDemoServerState();
    todo = todos.find((entry) => entry.id === swipeGesture.id);
  }
  const allowPinSwipe = Boolean(todo) && !todo.completed;

  const deltaX = event.clientX - swipeGesture.startX;
  const deltaY = event.clientY - swipeGesture.startY;
  swipeGesture.deltaX = deltaX;

  if (
    Math.hypot(deltaX, deltaY) > LONG_PRESS_MOVE_TOLERANCE_PX
  ) {
    clearLongPressTimer(swipeGesture);
    swipeGesture.item.classList.remove("is-pressing");
  }

  if (!swipeGesture.axisLocked) {
    if (
      Math.abs(deltaX) < SWIPE_LOCK_THRESHOLD_PX &&
      Math.abs(deltaY) < SWIPE_LOCK_THRESHOLD_PX
    ) {
      return;
    }

    swipeGesture.axisLocked = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
    if (swipeGesture.axisLocked === "x") {
      swipeGesture.item.setPointerCapture(event.pointerId);
    }
  }

  if (swipeGesture.axisLocked !== "x") {
    resetSwipeItem(swipeGesture.item);
    return;
  }

  swipeGesture.isSwiping = deltaX !== 0;
  const maxRightSwipe = allowPinSwipe ? SWIPE_PIN_THRESHOLD_PX : 0;
  const translateX = Math.max(-SWIPE_COMPLETE_THRESHOLD_PX, Math.min(deltaX, maxRightSwipe));
  swipeGesture.item.style.transform = `translate3d(${translateX}px, 0, 0)`;
  swipeGesture.item.classList.toggle("is-swiping", translateX !== 0);
  swipeGesture.item.classList.toggle("is-swiping-delete", translateX < 0);
  swipeGesture.item.classList.toggle("is-swiping-pin", allowPinSwipe && translateX > 0);
  event.preventDefault();
}

// ---------------------------------------------------------------------------
// Swipe gesture finish
// ---------------------------------------------------------------------------

export async function finishSwipeGesture(pointerId) {
  if (!swipeGesture || swipeGesture.pointerId !== pointerId) {
    return;
  }

  const gesture = swipeGesture;
  swipeGesture = null;
  clearLongPressTimer(gesture);

  if (gesture.didLongPress || !gesture.isSwiping) {
    resetSwipeItem(gesture.item);
    return;
  }

  if (gesture.deltaX <= -SWIPE_COMPLETE_THRESHOLD_PX) {
    const todos = _getTodos();
    let todo = todos.find((entry) => entry.id === gesture.id);
    if (!todo && _isDemoRuntimeMode()) {
      _seedDemoServerState();
      todo = _getTodos().find((entry) => entry.id === gesture.id);
    }
    if (!todo || todo.completed) {
      resetSwipeItem(gesture.item);
      return;
    }

    markTaskAsCompleting(gesture.id);
    await animateTaskRemoval(gesture.item);
    if (_isDemoRuntimeMode()) {
      _performDemoMutation({
        kind: "task.update",
        taskId: gesture.id,
        changes: { completed: true },
        completedAt: new Date().toISOString(),
        request: { url: `/api/tasks/${gesture.id}`, options: { method: "PATCH", body: JSON.stringify({ completed: true }) } }
      });
      return;
    }
    await _performQueuedMutation({
      kind: "task.update",
      taskId: gesture.id,
      changes: { completed: true },
      completedAt: new Date().toISOString(),
      request: {
        url: `/api/tasks/${gesture.id}`,
        options: {
          method: "PATCH",
          body: JSON.stringify({ completed: true })
        }
      }
    });
    return;
  }

  if (gesture.deltaX >= SWIPE_PIN_THRESHOLD_PX) {
    const todos = _getTodos();
    let todo = todos.find((entry) => entry.id === gesture.id);
    if (!todo && _isDemoRuntimeMode()) {
      _seedDemoServerState();
      todo = todos.find((entry) => entry.id === gesture.id);
    }
    resetSwipeItem(gesture.item);
    if (!todo || todo.completed) {
      return;
    }

    if (_isDemoRuntimeMode()) {
      _performDemoMutation({
        kind: "task.update",
        taskId: gesture.id,
        changes: { pinned: !todo.pinned },
        request: {
          url: `/api/tasks/${gesture.id}`,
          options: { method: "PATCH", body: JSON.stringify({ pinned: !todo.pinned }) }
        }
      });
      return;
    }

    await _performQueuedMutation({
      kind: "task.update",
      taskId: gesture.id,
      changes: { pinned: !todo.pinned },
      request: {
        url: `/api/tasks/${gesture.id}`,
        options: {
          method: "PATCH",
          body: JSON.stringify({ pinned: !todo.pinned })
        }
      }
    });
    return;
  }

  resetSwipeItem(gesture.item);
}

// ---------------------------------------------------------------------------
// Task animation state
// ---------------------------------------------------------------------------

export function markTaskAsEntering(taskId) {
  enteringTaskIds.add(taskId);
  const existingTimer = enteringTaskTimers.get(taskId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timer = window.setTimeout(() => {
    enteringTaskIds.delete(taskId);
    enteringTaskTimers.delete(taskId);
  }, 520);
  enteringTaskTimers.set(taskId, timer);
}

export function markTaskAsCompleting(taskId) {
  completingTaskIds.add(taskId);
  const existingTimer = completingTaskTimers.get(taskId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timer = window.setTimeout(() => {
    clearTaskCompletingState(taskId);
  }, 560);

  completingTaskTimers.set(taskId, timer);
}

export function clearTaskCompletingState(taskId) {
  const existingTimer = completingTaskTimers.get(taskId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
    completingTaskTimers.delete(taskId);
  }

  if (!completingTaskIds.has(taskId)) {
    return;
  }

  completingTaskIds.delete(taskId);
  _render();
}
