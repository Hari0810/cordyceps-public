/**
 * Long-term Goals — state ownership and all goal operations.
 *
 * This module owns the `longTermGoals` mutable array via ES module live
 * bindings. External callers (app.js backup/sync code) read the live binding
 * directly and update it via setLongTermGoals(). App.js-internal dependencies
 * (scheduleSync, syncUI, habits accessors, setHabitGoal, setActivePage) are
 * injected once at boot via bindGoalCallbacks().
 *
 * Dependencies:
 *   saveStoredJson, loadStoredJson  — ../modules/state.js
 *   showToast                       — ../modules/ui.js
 *   goalTitleInput, etc.            — ../modules/dom.js
 *   createLongTermGoal, etc.        — ./habits.js
 */

import { saveStoredJson, loadStoredJson } from "../modules/state.js";
import { showToast } from "../modules/ui.js";
import {
  goalTitleInput,
  goalTimeframeValueInput,
  goalTimeframeUnitInput
} from "../modules/dom.js";
import {
  cloneLongTermGoal,
  createLongTermGoal,
  createLongTermSubgoal,
  normalizeLongTermGoal
} from "./habits.js";

// ---------------------------------------------------------------------------
// Storage keys (exported so app.js backup/sync code can import them)
// ---------------------------------------------------------------------------

export const LONG_TERM_GOALS_STORAGE_KEY = "today.todo.long-term-goals.v1";
export const LONG_TERM_GOALS_DELETED_IDS_KEY = "today.todo.long-term-goals.deleted.v1";

// ---------------------------------------------------------------------------
// Mutable state — live binding owned by this module
// ---------------------------------------------------------------------------

export let longTermGoals = [];

/** Called by app.js to overwrite the live binding (backup/sync paths). */
export function setLongTermGoals(goals) {
  longTermGoals = goals;
}

// ---------------------------------------------------------------------------
// Injected callbacks (resolved at boot via bindGoalCallbacks)
// ---------------------------------------------------------------------------

let _scheduleSync = () => {};
let _syncUI = () => {};
let _toastDurationMs = 5000;
let _getHabits = () => [];
let _setHabits = () => {};
let _saveHabits = () => {};
let _setHabitGoal = () => {};
let _setActivePage = () => {};

/**
 * Inject app.js-owned dependencies. Must be called once during app boot,
 * before any goal event handlers fire.
 *
 * @param {object} callbacks
 * @param {() => void}      callbacks.scheduleSync   — scheduleAccountClientStateSync
 * @param {() => void}      callbacks.syncUI         — syncFeatureUi
 * @param {number}          callbacks.toastDurationMs
 * @param {() => object[]}  callbacks.getHabits      — () => habits
 * @param {(h: object[]) => void} callbacks.setHabits — (next) => { habits = next }
 * @param {() => void}      callbacks.saveHabits
 * @param {(habitId: string, goalId: string|null) => void} callbacks.setHabitGoal
 * @param {(page: string) => void} callbacks.setActivePage
 */
export function bindGoalCallbacks(callbacks) {
  _scheduleSync = callbacks.scheduleSync ?? _scheduleSync;
  _syncUI = callbacks.syncUI ?? _syncUI;
  _toastDurationMs = callbacks.toastDurationMs ?? _toastDurationMs;
  _getHabits = callbacks.getHabits ?? _getHabits;
  _setHabits = callbacks.setHabits ?? _setHabits;
  _saveHabits = callbacks.saveHabits ?? _saveHabits;
  _setHabitGoal = callbacks.setHabitGoal ?? _setHabitGoal;
  _setActivePage = callbacks.setActivePage ?? _setActivePage;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function saveLongTermGoals() {
  saveStoredJson(LONG_TERM_GOALS_STORAGE_KEY, longTermGoals);
  _scheduleSync();
}

// ---------------------------------------------------------------------------
// Goal queries
// ---------------------------------------------------------------------------

export function getLongTermGoalById(goalId) {
  return longTermGoals.find((goal) => goal.id === goalId) || null;
}

// ---------------------------------------------------------------------------
// Goal mutations
// ---------------------------------------------------------------------------

export function addLongTermSubgoal(goalId, title, timeframe) {
  const goal = getLongTermGoalById(goalId);
  if (!goal || !String(title || "").trim()) {
    return;
  }

  const timestamp = new Date().toISOString();
  const subgoal = createLongTermSubgoal(title, timeframe);
  longTermGoals = longTermGoals
    .map((entry) => entry.id === goalId
      ? {
          ...entry,
          subgoals: [...(Array.isArray(entry.subgoals) ? entry.subgoals : []), subgoal],
          updatedAt: timestamp
        }
      : entry
    )
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  saveLongTermGoals();
  _syncUI();
}

export function toggleLongTermSubgoal(goalId, subgoalId) {
  const goal = getLongTermGoalById(goalId);
  if (!goal) {
    return;
  }

  const timestamp = new Date().toISOString();
  longTermGoals = longTermGoals.map((entry) => entry.id === goalId
    ? {
        ...entry,
        updatedAt: timestamp,
        subgoals: (Array.isArray(entry.subgoals) ? entry.subgoals : []).map((subgoal) => subgoal.id === subgoalId
          ? {
              ...subgoal,
              completed: !subgoal.completed,
              updatedAt: timestamp
            }
          : subgoal
        )
      }
    : entry
  );
  saveLongTermGoals();
  _syncUI();
}

export function removeLongTermSubgoal(goalId, subgoalId) {
  const goal = getLongTermGoalById(goalId);
  if (!goal) {
    return;
  }

  const timestamp = new Date().toISOString();
  longTermGoals = longTermGoals.map((entry) => entry.id === goalId
    ? {
        ...entry,
        updatedAt: timestamp,
        subgoals: (Array.isArray(entry.subgoals) ? entry.subgoals : []).filter((subgoal) => subgoal.id !== subgoalId)
      }
    : entry
  );
  saveLongTermGoals();
  _syncUI();
}

export function removeLongTermGoal(goalId) {
  const nextGoals = longTermGoals.filter((goal) => goal.id !== goalId);
  if (nextGoals.length === longTermGoals.length) {
    return;
  }

  const deletedIds = new Set(
    loadStoredJson(LONG_TERM_GOALS_DELETED_IDS_KEY, [])
      .map((id) => String(id || ""))
      .filter(Boolean)
  );
  deletedIds.add(goalId);
  saveStoredJson(LONG_TERM_GOALS_DELETED_IDS_KEY, [...deletedIds]);

  longTermGoals = nextGoals;

  // Also clear the goalId from any habits that referenced this goal.
  const nextHabits = _getHabits().map((habit) =>
    habit.goalId === goalId
      ? { ...habit, goalId: null, updatedAt: new Date().toISOString() }
      : habit
  );
  _setHabits(nextHabits);
  _saveHabits();

  saveLongTermGoals();
  _syncUI();
}

export function addLongTermGoal(title, timeframeValue = "1", timeframeUnit = "year", options = {}) {
  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) {
    showToast("Goal title needed", "Enter a long-term goal first.", _toastDurationMs);
    return null;
  }

  const goal = createLongTermGoal(normalizedTitle, timeframeValue, timeframeUnit);
  longTermGoals = [goal, ...longTermGoals];
  saveLongTermGoals();
  _syncUI();
  if (goalTitleInput) {
    goalTitleInput.value = "";
  }
  if (goalTimeframeValueInput) {
    goalTimeframeValueInput.value = "1";
  }
  if (goalTimeframeUnitInput) {
    goalTimeframeUnitInput.value = "year";
  }

  const shouldSetActivePage = options.setActivePage !== false;
  if (shouldSetActivePage) {
    _setActivePage("long-term-goals");
  }
  if (options.focusInput !== false) {
    window.requestAnimationFrame(() => {
      goalTitleInput?.focus();
    });
  }

  return goal;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

export function handleGoalAddSubmit(event) {
  event.preventDefault();
  const form = event.target instanceof HTMLFormElement ? event.target : goalsAddForm;
  const title = goalTitleInput?.value.trim() || "";
  const timeframeValue = goalTimeframeValueInput?.value || "1";
  const timeframeUnit = goalTimeframeUnitInput?.value || "year";
  addLongTermGoal(title, timeframeValue, timeframeUnit, {
    setActivePage: form?.dataset.setActivePage !== "false",
    focusInput: form?.dataset.focusInput !== "false"
  });
}

export function handleGoalsListClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }

  const subgoalToggle = target.closest("[data-goal-subgoal-toggle]");
  if (subgoalToggle instanceof HTMLElement) {
    toggleLongTermSubgoal(
      subgoalToggle.dataset.goalId || "",
      subgoalToggle.dataset.goalSubgoalToggle || ""
    );
    return;
  }

  const subgoalRemove = target.closest("[data-goal-subgoal-remove]");
  if (subgoalRemove instanceof HTMLElement) {
    removeLongTermSubgoal(
      subgoalRemove.dataset.goalId || "",
      subgoalRemove.dataset.goalSubgoalRemove || ""
    );
    return;
  }

  const goalRemove = target.closest("[data-goal-remove]");
  if (goalRemove instanceof HTMLElement) {
    removeLongTermGoal(goalRemove.dataset.goalRemove || "");
    return;
  }

  const habitUnlink = target.closest("[data-goal-habit-unlink]");
  if (habitUnlink instanceof HTMLElement) {
    _setHabitGoal(habitUnlink.dataset.goalHabitUnlink || "", null);
    return;
  }

  const habitPick = target.closest("[data-goal-habit-pick]");
  if (habitPick instanceof HTMLElement) {
    const habitId = habitPick.dataset.goalHabitPick || "";
    const goalId = habitPick.dataset.goalId || "";
    if (habitId && goalId) {
      _setHabitGoal(habitId, goalId);
    }
  }
}

export function handleGoalsListChange(event) {
  const select = event.target instanceof Element
    ? event.target.closest("[data-goal-habit-link]")
    : null;
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const habitId = select.value;
  if (!habitId) {
    return;
  }

  _setHabitGoal(habitId, select.dataset.goalHabitLink || "");
  select.value = "";
}

export function handleGoalsListSubmit(event) {
  const form = event.target instanceof Element
    ? event.target.closest("[data-goal-subgoal-form]")
    : null;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();
  const titleInput = form.querySelector("[data-goal-subgoal-title]");
  const timeframeInput = form.querySelector("[data-goal-subgoal-timeframe]");
  const title = titleInput instanceof HTMLInputElement ? titleInput.value.trim() : "";
  const timeframe = timeframeInput instanceof HTMLInputElement ? timeframeInput.value.trim() : "";
  if (!title) {
    showToast("Subgoal title needed", "Enter a smaller goal first.", _toastDurationMs);
    return;
  }

  addLongTermSubgoal(form.dataset.goalId || "", title, timeframe);
}
