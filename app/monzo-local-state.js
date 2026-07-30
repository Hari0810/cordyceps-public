/**
 * Monzo local state helpers and the resolveOptionButton utility.
 *
 * Pure storage helpers; no mutable state is owned here. App.js owns
 * `monzoView` and `monzoExpenses` and passes them via injected callbacks.
 *
 * Dependencies (direct imports):
 *   saveStoredJson, loadStoredJson — ../modules/state.js
 */

import { saveStoredJson, loadStoredJson } from "../modules/state.js";

const MONZO_LOCAL_STORAGE_KEY = "today.todo.monzo-local.v1";

let _scheduleSync = () => {};
let _getMonzoView = () => "list";
let _getMonzoExpenses = () => [];

export function bindMonzoLocalCallbacks(callbacks) {
  _scheduleSync = callbacks.scheduleSync ?? _scheduleSync;
  _getMonzoView = callbacks.getMonzoView ?? _getMonzoView;
  _getMonzoExpenses = callbacks.getMonzoExpenses ?? _getMonzoExpenses;
}

export function loadMonzoLocalState() {
  const storedValue = loadStoredJson(MONZO_LOCAL_STORAGE_KEY, null);
  const storedView = typeof storedValue?.view === "string" ? storedValue.view : "list";
  return {
    view: ["list", "weekly", "type", "big"].includes(storedView) ? storedView : "list",
    expenses: Array.isArray(storedValue?.expenses) ? storedValue.expenses : []
  };
}

export function persistMonzoLocalState() {
  saveStoredJson(MONZO_LOCAL_STORAGE_KEY, {
    view: _getMonzoView(),
    expenses: _getMonzoExpenses()
  });
  _scheduleSync();
}

export function resolveOptionButton(container, event, selector) {
  const directButton = event.target instanceof Element ? event.target.closest(selector) : null;
  if (directButton && container.contains(directButton)) {
    return directButton;
  }

  const candidates = Array.from(container.querySelectorAll(selector));
  if (candidates.length === 0) {
    return null;
  }

  const { clientX, clientY } = event;
  if (typeof clientX !== "number" || typeof clientY !== "number") {
    return candidates[0];
  }

  for (const button of candidates) {
    const rect = button.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return button;
    }
  }

  let nearestButton = candidates[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  candidates.forEach((button) => {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestButton = button;
    }
  });

  return nearestButton;
}
