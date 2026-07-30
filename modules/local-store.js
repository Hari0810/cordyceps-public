import {
  decryptLocalValue,
  encryptLocalValue,
  getLocalVaultStatus,
  isLocalVaultProtectionEnabled,
  installCityVaultBridge,
  isEncryptedEnvelope,
  lockLocalVault,
  unlockLocalVault,
} from "./local-vault.js";

const DB_NAME = "cordyceps.local.v1";
const DB_VERSION = 1;
const STORE_NAME = "records";

const APP_STATE_KEY = "app-state";
const FEATURE_STATE_KEY = "feature-state";
const META_KEY = "metadata";
const NOTIFICATION_SNAPSHOT_KEY = "notification-snapshot";
const PLAN_DAY_KEY = "plan-your-day";
const VERBATIM_STATE_KEY = "verbatim-state";
const FEATURE_RECORD_PREFIX = "feature:";
const PROJECTS_STATE_KEY = `${FEATURE_RECORD_PREFIX}projects`;
const MYCELIA_MEMORY_STATE_KEY = `${FEATURE_RECORD_PREFIX}mycelia-memory`;
const THENDRAL_STATE_KEY = `${FEATURE_RECORD_PREFIX}thendral`;
const TENDRIL_STATE_KEY = `${FEATURE_RECORD_PREFIX}tendril`;
const HYPHAE_STATE_KEY = `${FEATURE_RECORD_PREFIX}hyphae`;
const BUDGET_STATE_KEY = `${FEATURE_RECORD_PREFIX}budget`;
const ENERGY_TRACKER_RECORD_PREFIX = `${FEATURE_RECORD_PREFIX}energy-tracker:`;
const RITUALS_STATE_KEY = `${FEATURE_RECORD_PREFIX}rituals`;
const HABIT_META_KEY = `${FEATURE_RECORD_PREFIX}habit-meta`;
const CALENDAR_STATE_KEY = `${FEATURE_RECORD_PREFIX}calendar`;
const DAILY_TIMELINE_PREFIX = `${FEATURE_RECORD_PREFIX}daily-timeline:`;
const SENSITIVE_RECORD_KEYS = new Set([
  APP_STATE_KEY,
  FEATURE_STATE_KEY,
  NOTIFICATION_SNAPSHOT_KEY,
  PLAN_DAY_KEY,
  VERBATIM_STATE_KEY,
  PROJECTS_STATE_KEY,
  MYCELIA_MEMORY_STATE_KEY,
  THENDRAL_STATE_KEY,
  TENDRIL_STATE_KEY,
  HYPHAE_STATE_KEY,
  BUDGET_STATE_KEY,
  RITUALS_STATE_KEY,
  HABIT_META_KEY,
  CALENDAR_STATE_KEY,
]);
const SENSITIVE_RECORD_PREFIXES = [
  ENERGY_TRACKER_RECORD_PREFIX,
  DAILY_TIMELINE_PREFIX,
];

let dbPromise = null;

installCityVaultBridge();

function openDb() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed."));
  });

  return dbPromise;
}

function isSensitiveRecordKey(key) {
  return SENSITIVE_RECORD_KEYS.has(key) || SENSITIVE_RECORD_PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function readRecordRaw(key, fallbackValue = null) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result === undefined ? fallbackValue : request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB read failed."));
    });
  } catch {
    return fallbackValue;
  }
}

async function writeRecordRaw(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed."));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted."));
    });
    return true;
  } catch {
    return false;
  }
}

async function deleteRecordRaw(key) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB delete failed."));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB delete aborted."));
    });
    return true;
  } catch {
    return false;
  }
}

async function readRecord(key, fallbackValue = null) {
  const storedValue = await readRecordRaw(key, fallbackValue);
  if (!isSensitiveRecordKey(key) || storedValue == null || storedValue === fallbackValue) {
    return storedValue;
  }
  if (isEncryptedEnvelope(storedValue)) {
    try {
      return await decryptLocalValue(storedValue);
    } catch {
      return fallbackValue;
    }
  }
  if (!isLocalVaultProtectionEnabled()) {
    return storedValue;
  }
  const vaultStatus = getLocalVaultStatus();
  if (vaultStatus.configured && !vaultStatus.unlocked) {
    return fallbackValue;
  }
  if (!vaultStatus.configured) {
    return storedValue;
  }
  try {
    await writeRecordRaw(key, await encryptLocalValue(storedValue));
  } catch {
    return fallbackValue;
  }
  return storedValue;
}

async function writeRecord(key, value) {
  if (!isSensitiveRecordKey(key)) {
    return writeRecordRaw(key, value);
  }
  if (!isLocalVaultProtectionEnabled()) {
    return writeRecordRaw(key, value);
  }
  const vaultStatus = getLocalVaultStatus();
  if (!vaultStatus.configured) {
    return writeRecordRaw(key, value);
  }
  try {
    return writeRecordRaw(key, await encryptLocalValue(value));
  } catch {
    return false;
  }
}

function deleteRecord(key) {
  return deleteRecordRaw(key);
}

async function listRecordKeysByPrefix(prefix) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).openKeyCursor();
      const keys = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(keys);
          return;
        }
        if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
          keys.push(cursor.key);
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error("IndexedDB key cursor failed."));
    });
  } catch {
    return [];
  }
}

export function getLocalStoreKeys() {
  return {
    APP_STATE_KEY,
    FEATURE_STATE_KEY,
    META_KEY,
    NOTIFICATION_SNAPSHOT_KEY,
    PLAN_DAY_KEY,
    VERBATIM_STATE_KEY,
    PROJECTS_STATE_KEY,
    MYCELIA_MEMORY_STATE_KEY,
    THENDRAL_STATE_KEY,
    TENDRIL_STATE_KEY,
    HYPHAE_STATE_KEY,
    BUDGET_STATE_KEY,
    ENERGY_TRACKER_RECORD_PREFIX,
    RITUALS_STATE_KEY,
    HABIT_META_KEY,
    CALENDAR_STATE_KEY,
    DAILY_TIMELINE_PREFIX,
  };
}

export function readLocalAppState(fallbackValue = null) {
  return readRecord(APP_STATE_KEY, fallbackValue);
}

export function writeLocalAppState(value) {
  return writeRecord(APP_STATE_KEY, value);
}

export async function getLocalAppStateStorageStatus() {
  const storedValue = await readRecordRaw(APP_STATE_KEY, undefined);
  return {
    exists: storedValue !== undefined,
    encrypted: isEncryptedEnvelope(storedValue)
  };
}

export function readLocalFeatureState(fallbackValue = null) {
  return readRecord(FEATURE_STATE_KEY, fallbackValue);
}

export function writeLocalFeatureState(value) {
  return writeRecord(FEATURE_STATE_KEY, value);
}

export async function getLocalFeatureStateStorageStatus() {
  const storedValue = await readRecordRaw(FEATURE_STATE_KEY, undefined);
  return {
    exists: storedValue !== undefined,
    encrypted: isEncryptedEnvelope(storedValue)
  };
}

export function readLocalMetadata(fallbackValue = {}) {
  return readRecordRaw(META_KEY, fallbackValue);
}

export async function writeLocalMetadata(value) {
  const previous = await readLocalMetadata({});
  return writeRecordRaw(META_KEY, {
    ...(previous && typeof previous === "object" ? previous : {}),
    ...(value && typeof value === "object" ? value : {})
  });
}

export function readNotificationSnapshot(fallbackValue = null) {
  return readRecord(NOTIFICATION_SNAPSHOT_KEY, fallbackValue);
}

export function writeNotificationSnapshot(value) {
  return writeRecord(NOTIFICATION_SNAPSHOT_KEY, value);
}

export function readLocalPlanDay(fallbackValue = null) {
  return readRecord(PLAN_DAY_KEY, fallbackValue);
}

export function writeLocalPlanDay(value) {
  return writeRecord(PLAN_DAY_KEY, value);
}

export function readLocalVerbatimState(fallbackValue = null) {
  return readRecord(VERBATIM_STATE_KEY, fallbackValue);
}

export function writeLocalVerbatimState(value) {
  return writeRecord(VERBATIM_STATE_KEY, value);
}

export function readLocalBudgetState(fallbackValue = null) {
  return readRecord(BUDGET_STATE_KEY, fallbackValue);
}

export function writeLocalBudgetState(value) {
  return writeRecord(BUDGET_STATE_KEY, value);
}

export function readLocalFeatureRecord(featureKey, fallbackValue = null) {
  return readRecord(`${FEATURE_RECORD_PREFIX}${String(featureKey || "").trim()}`, fallbackValue);
}

export function writeLocalFeatureRecord(featureKey, value) {
  return writeRecord(`${FEATURE_RECORD_PREFIX}${String(featureKey || "").trim()}`, value);
}

export function deleteLocalFeatureRecord(featureKey) {
  return deleteRecord(`${FEATURE_RECORD_PREFIX}${String(featureKey || "").trim()}`);
}

export async function listLocalFeatureRecords(featureKeyPrefix = "") {
  const prefix = `${FEATURE_RECORD_PREFIX}${String(featureKeyPrefix || "").trim()}`;
  const keys = await listRecordKeysByPrefix(prefix);
  const records = await Promise.all(keys.map(async (key) => ({
    key,
    value: await readRecord(key, null),
  })));
  return records
    .map((record) => ({
      featureKey: record.key.slice(FEATURE_RECORD_PREFIX.length),
      value: record.value,
    }))
    .filter((record) => record.featureKey);
}

export function readLocalEnergyTrackerRecord(dateKey, fallbackValue = null) {
  return readRecord(`${ENERGY_TRACKER_RECORD_PREFIX}${dateKey}`, fallbackValue);
}

export function writeLocalEnergyTrackerRecord(dateKey, value) {
  return writeRecord(`${ENERGY_TRACKER_RECORD_PREFIX}${dateKey}`, value);
}

export function deleteLocalEnergyTrackerRecord(dateKey) {
  return deleteRecord(`${ENERGY_TRACKER_RECORD_PREFIX}${dateKey}`);
}

export async function listLocalEnergyTrackerRecords() {
  const keys = await listRecordKeysByPrefix(ENERGY_TRACKER_RECORD_PREFIX);
  const records = await Promise.all(keys.map(async (key) => ({
    dateKey: key.slice(ENERGY_TRACKER_RECORD_PREFIX.length),
    value: await readRecord(key, null)
  })));
  return records.filter((record) => record.dateKey);
}

export function readLocalRitualsState(fallbackValue = null) {
  return readRecord(RITUALS_STATE_KEY, fallbackValue);
}

export function writeLocalRitualsState(value) {
  return writeRecord(RITUALS_STATE_KEY, value);
}

export function readLocalHabitMeta(fallbackValue = null) {
  return readRecord(HABIT_META_KEY, fallbackValue);
}

export function writeLocalHabitMeta(value) {
  return writeRecord(HABIT_META_KEY, value);
}

export function readLocalCalendarState(fallbackValue = null) {
  return readRecord(CALENDAR_STATE_KEY, fallbackValue);
}

export function writeLocalCalendarState(value) {
  return writeRecord(CALENDAR_STATE_KEY, value);
}

export function readLocalDailyTimeline(dateKey, fallbackValue = null) {
  return readRecord(`${DAILY_TIMELINE_PREFIX}${dateKey}`, fallbackValue);
}

export function writeLocalDailyTimeline(dateKey, value) {
  return writeRecord(`${DAILY_TIMELINE_PREFIX}${dateKey}`, value);
}

export function getLocalVaultStatusSnapshot() {
  return getLocalVaultStatus();
}

export function lockLocalStoreVault() {
  lockLocalVault();
}

export function unlockLocalStoreVault(passphrase) {
  return unlockLocalVault(passphrase);
}
