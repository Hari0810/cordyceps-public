/**
 * Habits operations — state ownership, CRUD, streak computation, event handlers.
 *
 * Owns `habits` as an ES module live binding. App.js reads it directly (live
 * binding) and updates it via `setHabits` (used by backup restore and
 * account-state sync paths).
 *
 * App.js-owned dependencies (syncFeatureUi, scheduleAccountClientStateSync,
 * setActivePage) are injected once at boot via `bindHabitsOpsCallbacks`.
 *
 * Dependencies (direct imports):
 *   saveStoredJson, loadStoredJson     — ../modules/state.js
 *   showToast                          — ../modules/ui.js
 *   habitNameInput                     — ../modules/dom.js
 *   formatHabitDateKey, normalizeHabitCompletions,
 *   createHabitEntry, parseHabitDateKey, loadHabits — ./habits.js
 *   addDays, startOfDay                — ./calendar.js
 *   longTermGoals                      — ./goals.js
 */

import { saveStoredJson, loadStoredJson } from "../modules/state.js";
import { showToast } from "../modules/ui.js";
import { habitNameInput } from "../modules/dom.js";
import {
  formatHabitDateKey,
  normalizeHabitCompletions,
  createHabitEntry,
  parseHabitDateKey,
  loadHabits
} from "./habits.js";
import { addDays, startOfDay } from "./calendar.js";
import { longTermGoals } from "./goals.js";

// ---------------------------------------------------------------------------
// Storage keys (exported so backup registry and applyAccountClientState can use them)
// ---------------------------------------------------------------------------

export const HABITS_STORAGE_KEY = "today.todo.habits.v1";
export const HABITS_DELETED_IDS_KEY = "today.todo.habits.deleted.v1";

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

const TOAST_DURATION_MS = 5000;

// ---------------------------------------------------------------------------
// Injected callbacks
// ---------------------------------------------------------------------------

let _scheduleSync = () => {};
let _syncUI = () => {};
let _setActivePage = () => {};

/**
 * Inject app.js-owned dependencies. Must be called once at boot.
 *
 * @param {object} callbacks
 * @param {() => void} callbacks.scheduleSync
 * @param {() => void} callbacks.syncUI
 * @param {(page: string) => void} callbacks.setActivePage
 */
export function bindHabitsOpsCallbacks(callbacks) {
  _scheduleSync = callbacks.scheduleSync ?? _scheduleSync;
  _syncUI = callbacks.syncUI ?? _syncUI;
  _setActivePage = callbacks.setActivePage ?? _setActivePage;
}

// ---------------------------------------------------------------------------
// Mutable state — live binding owned by this module
// ---------------------------------------------------------------------------

export let habits = loadHabits();

export function setHabits(next) {
  habits = next;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export function saveHabits() {
  saveStoredJson(HABITS_STORAGE_KEY, habits);
  _scheduleSync();
}

// ---------------------------------------------------------------------------
// Streak computation
// ---------------------------------------------------------------------------

export function computeHabitCurrentStreak(habit) {
  const completionKeys = Array.isArray(habit?.completions) ? [...habit.completions].sort().reverse() : [];
  let streak = 0;
  let cursor = startOfDay(new Date());
  for (const key of completionKeys) {
    const completedDate = parseHabitDateKey(key);
    if (!completedDate) {
      continue;
    }

    if (completedDate.getTime() === cursor.getTime()) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }

    if (streak === 0 && completedDate.getTime() === addDays(cursor, -1).getTime()) {
      streak += 1;
      cursor = addDays(completedDate, -1);
    }
    break;
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getHabitById(habitId) {
  return habits.find((habit) => habit.id === habitId) || null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function toggleHabitCompletion(habitId) {
  const habit = getHabitById(habitId);
  if (!habit) {
    return;
  }

  const todayKey = formatHabitDateKey(new Date());
  const completions = normalizeHabitCompletions(habit.completions);
  const completedToday = completions.includes(todayKey);
  const nextCompletions = completedToday
    ? completions.filter((entry) => entry !== todayKey)
    : [todayKey, ...completions];

  habits = habits
    .map((entry) =>
      entry.id === habitId
        ? {
          ...entry,
          completions: nextCompletions,
          updatedAt: new Date().toISOString()
        }
        : entry
    )
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));

  saveHabits();
  _syncUI();
}

export function adjustHabitCount(habitId, delta) {
  const habit = getHabitById(habitId);
  if (!habit) {
    return;
  }

  const nextCount = Math.max(0, Number(habit.count || 0) + Number(delta || 0));
  habits = habits
    .map((entry) =>
      entry.id === habitId
        ? {
          ...entry,
          count: nextCount,
          updatedAt: new Date().toISOString()
        }
        : entry
    )
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));

  saveHabits();
  _syncUI();
}

export function setHabitEstimatedMinutes(habitId, estimatedMinutes) {
  const habit = getHabitById(habitId);
  if (!habit) {
    return;
  }

  const nextMinutes = Math.min(240, Math.max(1, Math.round(Number(estimatedMinutes || habit.estimatedMinutes || 15))));
  if (Number(habit.estimatedMinutes || 15) === nextMinutes) {
    return;
  }

  habits = habits
    .map((entry) =>
      entry.id === habitId
        ? {
          ...entry,
          estimatedMinutes: nextMinutes,
          updatedAt: new Date().toISOString()
        }
        : entry
    )
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));

  saveHabits();
  _syncUI();
}

export function adjustHabitEstimatedMinutes(habitId, delta) {
  const habit = getHabitById(habitId);
  if (!habit) {
    return;
  }

  setHabitEstimatedMinutes(habitId, Number(habit.estimatedMinutes || 15) + Number(delta || 0));
}

export function removeHabit(habitId) {
  const nextHabits = habits.filter((habit) => habit.id !== habitId);
  if (nextHabits.length === habits.length) {
    return;
  }

  const deletedIds = new Set(loadStoredJson(HABITS_DELETED_IDS_KEY, []));
  deletedIds.add(habitId);
  saveStoredJson(HABITS_DELETED_IDS_KEY, [...deletedIds]);

  habits = nextHabits;
  saveHabits();
  _syncUI();
}

export function setHabitGoal(habitId, goalId) {
  const habit = getHabitById(habitId);
  if (!habit) {
    return;
  }

  const nextGoalId = longTermGoals.some((goal) => goal.id === goalId) ? goalId : null;
  habits = habits
    .map((entry) => entry.id === habitId
      ? {
          ...entry,
          goalId: nextGoalId,
          updatedAt: new Date().toISOString()
        }
      : entry
    )
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  saveHabits();
  _syncUI();
}

export function updateHabitDetails(habitId, updates) {
  const habit = getHabitById(habitId);
  if (!habit) {
    return;
  }

  const nextName = typeof updates?.name === "string" ? updates.name.trim() : "";
  if (!nextName) {
    return;
  }

  const nextEstimatedMinutes = Math.min(240, Math.max(1, Math.round(Number(updates?.estimatedMinutes || habit.estimatedMinutes || 15))));
  const rawGoalId = typeof updates?.goalId === "string" ? updates.goalId : "";
  const nextGoalId = rawGoalId && longTermGoals.some((goal) => goal.id === rawGoalId) ? rawGoalId : null;

  habits = habits
    .map((entry) => entry.id === habitId
      ? {
          ...entry,
          name: nextName,
          goalId: nextGoalId,
          estimatedMinutes: nextEstimatedMinutes,
          updatedAt: new Date().toISOString()
        }
      : entry
    )
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));

  saveHabits();
  _syncUI();
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

export function handleHabitAddSubmit(event) {
  event.preventDefault();
  const name = habitNameInput?.value.trim() || "";
  if (!name) {
    showToast("Habit name needed", "Enter a habit name first.", TOAST_DURATION_MS);
    return;
  }

  const estimatedMinutesInput = document.getElementById("habit-minutes-input");
  const estimatedMinutes = estimatedMinutesInput instanceof HTMLInputElement
    ? Number(estimatedMinutesInput.value || 15)
    : 15;

  const habit = createHabitEntry(name, estimatedMinutes);
  const goalSelect = document.getElementById("habit-goal-select");
  if (goalSelect instanceof HTMLSelectElement && goalSelect.value) {
    habit.goalId = goalSelect.value;
    goalSelect.value = "";
  }
  habits = [habit, ...habits];
  saveHabits();
  _syncUI();
  habitNameInput.value = "";
  if (estimatedMinutesInput instanceof HTMLInputElement) {
    estimatedMinutesInput.value = "15";
  }
  _setActivePage("habits");
  window.requestAnimationFrame(() => {
    habitNameInput?.focus();
  });
}

export function handleHabitsListClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }

  const completeButton = target.closest("[data-habit-complete]");
  if (completeButton instanceof HTMLElement) {
    toggleHabitCompletion(completeButton.dataset.habitComplete || "");
    return;
  }

  const countButton = target.closest("[data-habit-count]");
  if (countButton instanceof HTMLElement) {
    adjustHabitCount(
      countButton.dataset.habitCount || "",
      Number(countButton.dataset.habitCountDelta || 0)
    );
    return;
  }

  const minutesButton = target.closest("[data-habit-minutes]");
  if (minutesButton instanceof HTMLElement) {
    adjustHabitEstimatedMinutes(
      minutesButton.dataset.habitMinutes || "",
      Number(minutesButton.dataset.habitMinutesDelta || 0)
    );
    return;
  }

  const removeButton = target.closest("[data-habit-remove]");
  if (removeButton instanceof HTMLElement) {
    removeHabit(removeButton.dataset.habitRemove || "");
  }
}
