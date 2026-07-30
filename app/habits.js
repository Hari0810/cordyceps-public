/**
 * Habits & Long-term Goals — pure utility functions.
 *
 * This module contains stateless helpers extracted from app.js:
 *   - normalizers (normalizeHabit, normalizeLongTermGoal, …)
 *   - formatters / parsers (formatHabitDateKey, parseGoalTimeframeParts, …)
 *   - factory functions (createHabitEntry, createLongTermGoal, …)
 *   - storage loaders (loadHabits, loadLongTermGoals — read-only)
 *
 * None of these functions read or write module-level state from app.js.
 * State-mutating handlers (saveHabits, toggleHabitCompletion, …) and
 * DOM event handlers stay in app.js until the state-sharing model is
 * resolved in a later extraction PR.
 *
 * Dependencies: createUuid, loadStoredJson from ../modules/state.js
 */

import { createUuid, loadStoredJson } from "../modules/state.js";

// ---------------------------------------------------------------------------
// Habits — normalisation helpers
// ---------------------------------------------------------------------------

export function normalizeHabitCompletions(completions) {
  return Array.isArray(completions)
    ? completions
      .map((value) => String(value || "").trim())
      .filter((value, index, values) => value && values.indexOf(value) === index)
    : [];
}

export function normalizeHabitEstimatedMinutes(value) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) ? Math.min(240, Math.max(1, numeric)) : 15;
}

export function normalizeHabit(habit) {
  const payload = habit && typeof habit === "object" ? habit : {};
  const goalId = typeof payload.goalId === "string" ? payload.goalId.trim() : "";
  return {
    id: String(payload.id || createUuid()),
    name: String(payload.name || payload.title || "").trim(),
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString(),
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
    completions: normalizeHabitCompletions(payload.completions),
    count: Math.max(0, Number(payload.count || 0)),
    estimatedMinutes: normalizeHabitEstimatedMinutes(payload.estimatedMinutes),
    goalId: goalId || null
  };
}

// ---------------------------------------------------------------------------
// Habits — date key helpers
// ---------------------------------------------------------------------------

export function formatHabitDateKey(date) {
  const nextDate = date instanceof Date ? date : new Date(date);
  const year = nextDate.getFullYear();
  const month = `${nextDate.getMonth() + 1}`.padStart(2, "0");
  const day = `${nextDate.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseHabitDateKey(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ---------------------------------------------------------------------------
// Habits — factory
// ---------------------------------------------------------------------------

export function createHabitEntry(name, estimatedMinutes = 15) {
  return {
    id: createUuid(),
    name: String(name || "").trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completions: [],
    estimatedMinutes: normalizeHabitEstimatedMinutes(estimatedMinutes),
    goalId: null
  };
}

// ---------------------------------------------------------------------------
// Long-term goals — timeframe normalisation helpers
// ---------------------------------------------------------------------------

export function normalizeGoalTimeframe(value) {
  const timeframe = String(value || "").trim();
  return timeframe || "1 year";
}

export function normalizeGoalTimeframeUnit(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text.startsWith("day")) return "day";
  if (text.startsWith("week")) return "week";
  if (text.startsWith("month")) return "month";
  return "year";
}

export function normalizeGoalTimeframeValue(value) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

export function parseGoalTimeframeParts(value, fallbackUnit = "year") {
  const text = String(value || "").trim().toLowerCase();
  const numericMatch = text.match(/(\d+(?:\.\d+)?)/);
  const timeframeValue = normalizeGoalTimeframeValue(numericMatch ? parseFloat(numericMatch[1]) : 1);
  let timeframeUnit = normalizeGoalTimeframeUnit(fallbackUnit);
  if (text.includes("day")) timeframeUnit = "day";
  else if (text.includes("week")) timeframeUnit = "week";
  else if (text.includes("month")) timeframeUnit = "month";
  else if (text.includes("year")) timeframeUnit = "year";
  return { timeframeValue, timeframeUnit };
}

export function formatGoalTimeframeParts(timeframeValue, timeframeUnit) {
  const value = normalizeGoalTimeframeValue(timeframeValue);
  const unit = normalizeGoalTimeframeUnit(timeframeUnit);
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function normalizeGoalTimeframeParts(payload) {
  const fallback = parseGoalTimeframeParts(payload?.timeframe, payload?.timeframeUnit);
  const timeframeValue = payload?.timeframeValue != null
    ? normalizeGoalTimeframeValue(payload.timeframeValue)
    : fallback.timeframeValue;
  const timeframeUnit = payload?.timeframeUnit
    ? normalizeGoalTimeframeUnit(payload.timeframeUnit)
    : fallback.timeframeUnit;
  return {
    timeframeValue,
    timeframeUnit,
    timeframe: formatGoalTimeframeParts(timeframeValue, timeframeUnit)
  };
}

// ---------------------------------------------------------------------------
// Long-term goals — normalisation helpers
// ---------------------------------------------------------------------------

export function normalizeLongTermSubgoal(subgoal) {
  const payload = subgoal && typeof subgoal === "object" ? subgoal : {};
  return {
    id: String(payload.id || createUuid()),
    title: String(payload.title || payload.name || "").trim(),
    timeframe: normalizeGoalTimeframe(payload.timeframe),
    completed: Boolean(payload.completed),
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString(),
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString()
  };
}

export function normalizeLongTermGoal(goal) {
  const payload = goal && typeof goal === "object" ? goal : {};
  const timeframeParts = normalizeGoalTimeframeParts(payload);
  return {
    id: String(payload.id || createUuid()),
    title: String(payload.title || payload.name || "").trim(),
    timeframe: timeframeParts.timeframe,
    timeframeValue: timeframeParts.timeframeValue,
    timeframeUnit: timeframeParts.timeframeUnit,
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString(),
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
    subgoals: Array.isArray(payload.subgoals)
      ? payload.subgoals.map(normalizeLongTermSubgoal).filter((subgoal) => subgoal.title)
      : []
  };
}

export function cloneLongTermGoal(goal) {
  return {
    ...goal,
    subgoals: Array.isArray(goal?.subgoals)
      ? goal.subgoals.map((subgoal) => ({ ...subgoal }))
      : []
  };
}

// ---------------------------------------------------------------------------
// Long-term goals — factory
// ---------------------------------------------------------------------------

export function createLongTermGoal(title, timeframeValue, timeframeUnit) {
  const timestamp = new Date().toISOString();
  const timeframeParts = normalizeGoalTimeframeParts({ timeframeValue, timeframeUnit });
  return {
    id: createUuid(),
    title: String(title || "").trim(),
    timeframe: timeframeParts.timeframe,
    timeframeValue: timeframeParts.timeframeValue,
    timeframeUnit: timeframeParts.timeframeUnit,
    createdAt: timestamp,
    updatedAt: timestamp,
    subgoals: []
  };
}

export function createLongTermSubgoal(title, timeframe) {
  const timestamp = new Date().toISOString();
  return {
    id: createUuid(),
    title: String(title || "").trim(),
    timeframe: normalizeGoalTimeframe(timeframe),
    completed: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

// ---------------------------------------------------------------------------
// Storage loaders (read-only — no module-level state mutation)
// ---------------------------------------------------------------------------

export function loadHabits() {
  const storedHabits = loadStoredJson("today.todo.habits.v1", []);
  if (!Array.isArray(storedHabits)) {
    return [];
  }

  return storedHabits
    .map((habit) => normalizeHabit(habit))
    .filter((habit) => habit.name)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

export function loadLongTermGoals() {
  const storedGoals = loadStoredJson("today.todo.long-term-goals.v1", []);
  const deletedGoalIds = new Set(
    loadStoredJson("today.todo.long-term-goals.deleted.v1", [])
      .map((id) => String(id || ""))
      .filter(Boolean)
  );
  if (!Array.isArray(storedGoals)) {
    return [];
  }

  return storedGoals
    .map((goal) => normalizeLongTermGoal(goal))
    .filter((goal) => goal.title && !deletedGoalIds.has(goal.id))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}
