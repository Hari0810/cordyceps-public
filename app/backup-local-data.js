import { base64PayloadToBlob, blobToBase64Payload } from "./backup.js";
import { getLocalWorkspace, scopeStorageKey } from "../modules/storage-scope.js";

const LOCAL_DATA_SCHEMA_VERSION = 1;
const BACKUP_VALUE_TYPE_KEY = "__cordycepsBackupValueType";
const BACKUP_VALUE_BLOB = "blob";
const BACKUP_VALUE_DATE = "date";
const WORKSPACE_KEY_PREFIX = "cordyceps.workspace.";

const LOCAL_STORAGE_EXACT_KEYS = new Set([
  "city.starter-data-seen.v1",
  "dashboard.legacy",
  "navbar.legacy",
  "monzo.budget.v1",
  "cordyceps.verbatim.summary.v1",
  "cordyceps.mycelia.webllm.autoload.v1",
]);

const LOCAL_STORAGE_PREFIXES = [
  "today.",
  "energy.tracker.",
  "hyphae.",
  "city.shell.",
];

const LOCAL_STORAGE_EXCLUDED_KEYS = new Set([
  "cordyceps.vault.metadata.v1",
  "today.mycelia.webllm.loadAttempt.v1",
  "today.todo.mutation-queue.v1",
  "today.todo.sync-issues.v1",
]);

const LOCAL_STORAGE_EXCLUDED_PREFIXES = [
  "cordyceps-",
  "offlineMigration.",
];

const INDEXED_DB_SCHEMAS = [
  {
    name: "cordyceps.local.v1",
    version: 1,
    scoped: false,
    stores: [
      { name: "records", keyPath: null },
    ],
  },
  {
    name: "cordyceps.local.notes.v1",
    version: 1,
    scoped: false,
    stores: [
      { name: "records", keyPath: null },
    ],
  },
  {
    name: "cordyceps.mycelia-memory.v1",
    version: 1,
    scoped: true,
    stores: [
      {
        name: "events",
        keyPath: "id",
        indexes: [
          { name: "dateKey", keyPath: "dateKey", options: { unique: false } },
          { name: "dateCompleted", keyPath: "dateCompleted", options: { unique: false } },
        ],
      },
      {
        name: "sessions",
        keyPath: "id",
        indexes: [
          { name: "dateKey", keyPath: "dateKey", options: { unique: false } },
          { name: "endedAt", keyPath: "endedAt", options: { unique: false } },
        ],
      },
      {
        name: "insights",
        keyPath: "id",
        indexes: [
          { name: "dateKey", keyPath: "dateKey", options: { unique: false } },
          { name: "generatedAt", keyPath: "generatedAt", options: { unique: false } },
        ],
      },
      { name: "settings", keyPath: "id" },
    ],
  },
  {
    name: "cordy-projects",
    version: 2,
    scoped: true,
    stores: [
      {
        name: "notes",
        keyPath: "id",
        indexes: [
          { name: "parentId", keyPath: "parentId", options: { unique: false } },
          { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
        ],
      },
      {
        name: "attachments",
        keyPath: "id",
        indexes: [
          { name: "noteId", keyPath: "noteId", options: { unique: false } },
        ],
      },
      {
        name: "signals",
        keyPath: "id",
        indexes: [
          { name: "projectId", keyPath: "projectId", options: { unique: false } },
          { name: "sourceNoteId", keyPath: "sourceNoteId", options: { unique: false } },
          { name: "status", keyPath: "status", options: { unique: false } },
          { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
        ],
      },
    ],
  },
];

function getLocalStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function getIndexedDb() {
  return typeof window !== "undefined" ? window.indexedDB : null;
}

function resolveDbName(schema) {
  return schema.scoped ? scopeStorageKey(schema.name) : schema.name;
}

function resolveDbNameCandidates(schema) {
  const primaryName = resolveDbName(schema);
  if (schema.scoped && primaryName !== schema.name) {
    return [primaryName, schema.name];
  }
  return [primaryName];
}

async function getKnownIndexedDbVersion(dbName) {
  const indexedDb = getIndexedDb();
  if (!indexedDb || typeof indexedDb.databases !== "function") {
    return null;
  }
  try {
    const databases = await indexedDb.databases();
    const match = databases.find((database) => database?.name === dbName);
    const version = Number(match?.version);
    return Number.isFinite(version) && version > 0 ? version : null;
  } catch {
    return null;
  }
}

function shouldIncludeLocalStorageKey(key) {
  const storageKey = String(key || "");
  if (!storageKey || LOCAL_STORAGE_EXCLUDED_KEYS.has(storageKey)) {
    return false;
  }
  if (LOCAL_STORAGE_EXCLUDED_PREFIXES.some((prefix) => storageKey.startsWith(prefix))) {
    return false;
  }
  return LOCAL_STORAGE_EXACT_KEYS.has(storageKey)
    || LOCAL_STORAGE_PREFIXES.some((prefix) => storageKey.startsWith(prefix));
}

function getWorkspaceScopedLocalStorageKey(storageKey) {
  if (!storageKey.startsWith(WORKSPACE_KEY_PREFIX)) {
    return null;
  }
  const remainder = storageKey.slice(WORKSPACE_KEY_PREFIX.length);
  const separatorIndex = remainder.indexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }
  const rawKey = remainder.slice(separatorIndex + 1);
  return shouldIncludeLocalStorageKey(rawKey) ? rawKey : null;
}

function getBackupLocalStorageKey(storageKey) {
  const key = String(storageKey || "");
  if (shouldIncludeLocalStorageKey(key)) {
    return key;
  }
  return getWorkspaceScopedLocalStorageKey(key);
}

function getLocalStorageEntryPriority(storageKey, logicalKey, currentScopedPrefix) {
  if (storageKey === `${currentScopedPrefix}${logicalKey}`) {
    return 3;
  }
  if (storageKey.startsWith(WORKSPACE_KEY_PREFIX)) {
    return 2;
  }
  return 1;
}

function collectLocalStorageEntries() {
  const storage = getLocalStorage();
  if (!storage) {
    return [];
  }

  const currentScopedPrefix = `${WORKSPACE_KEY_PREFIX}${getLocalWorkspace().workspaceId}.`;
  const entriesByKey = new Map();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    const logicalKey = getBackupLocalStorageKey(key);
    if (!logicalKey) {
      continue;
    }
    const priority = getLocalStorageEntryPriority(key, logicalKey, currentScopedPrefix);
    const existing = entriesByKey.get(logicalKey);
    if (existing && existing.priority >= priority) {
      continue;
    }
    entriesByKey.set(logicalKey, {
      key: logicalKey,
      value: storage.getItem(key),
      priority,
    });
  }
  return Array.from(entriesByKey.values())
    .map(({ key, value }) => ({ key, value }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function clearIncludedLocalStorageEntries() {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (getBackupLocalStorageKey(key)) {
      keys.push(key);
    }
  }
  keys.forEach((key) => storage.removeItem(key));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("IndexedDB request failed.")));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("IndexedDB transaction aborted.")));
    transaction.addEventListener("error", () => reject(transaction.error || new Error("IndexedDB transaction failed.")));
  });
}

function getStoreSchema(schema, storeName) {
  return schema.stores.find((store) => store.name === storeName) || null;
}

function normalizeIndexes(indexes) {
  return Array.isArray(indexes) ? indexes : [];
}

function ensureStoreSchema(db, upgradeTransaction, storeSchema) {
  const options = {};
  if (storeSchema.keyPath !== null && storeSchema.keyPath !== undefined) {
    options.keyPath = storeSchema.keyPath;
  }
  if (storeSchema.autoIncrement === true) {
    options.autoIncrement = true;
  }

  const store = db.objectStoreNames.contains(storeSchema.name)
    ? upgradeTransaction.objectStore(storeSchema.name)
    : db.createObjectStore(storeSchema.name, options);

  normalizeIndexes(storeSchema.indexes).forEach((index) => {
    if (!store.indexNames.contains(index.name)) {
      store.createIndex(index.name, index.keyPath, index.options || {});
    }
  });
}

async function openExistingIndexedDb(schema) {
  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    return null;
  }

  const dbNames = resolveDbNameCandidates(schema);
  let dbName = dbNames[0];
  if (typeof indexedDb.databases === "function") {
    try {
      const databases = await indexedDb.databases();
      dbName = dbNames.find((candidateName) => (
        databases.some((database) => database?.name === candidateName)
      ));
      if (!dbName) {
        return null;
      }
    } catch {
      // Fall through to opening by name when database enumeration is blocked.
    }
  }

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(dbName);
    request.addEventListener("upgradeneeded", () => {
      request.transaction?.abort();
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => {
      if (request.error?.name === "AbortError") {
        resolve(null);
        return;
      }
      reject(request.error || new Error(`Could not open ${schema.name}.`));
    });
  });
}

async function openIndexedDbForRestore(schema) {
  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    return Promise.resolve(null);
  }

  const dbName = resolveDbName(schema);
  const existingVersion = await getKnownIndexedDbVersion(dbName);
  const restoreVersion = Math.max(schema.version, existingVersion || schema.version);

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(dbName, restoreVersion);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      schema.stores.forEach((storeSchema) => ensureStoreSchema(db, request.transaction, storeSchema));
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error(`Could not open ${schema.name}.`)));
  });
}

async function encodeBackupValue(value, seen = new WeakSet()) {
  if (value instanceof Blob) {
    return {
      [BACKUP_VALUE_TYPE_KEY]: BACKUP_VALUE_BLOB,
      payload: await blobToBase64Payload(value),
    };
  }

  if (value instanceof Date) {
    return {
      [BACKUP_VALUE_TYPE_KEY]: BACKUP_VALUE_DATE,
      value: value.toISOString(),
    };
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return null;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => encodeBackupValue(item, seen)));
  }

  const output = {};
  for (const [key, entryValue] of Object.entries(value)) {
    output[key] = await encodeBackupValue(entryValue, seen);
  }
  return output;
}

function decodeBackupValue(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value[BACKUP_VALUE_TYPE_KEY] === BACKUP_VALUE_BLOB) {
    return base64PayloadToBlob(value.payload);
  }

  if (value[BACKUP_VALUE_TYPE_KEY] === BACKUP_VALUE_DATE) {
    return new Date(value.value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => decodeBackupValue(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, decodeBackupValue(entryValue)])
  );
}

async function collectStoreRecords(db, schema, storeSchema) {
  if (!db.objectStoreNames.contains(storeSchema.name)) {
    return {
      name: storeSchema.name,
      keyPath: storeSchema.keyPath ?? null,
      records: [],
    };
  }

  const transaction = db.transaction(storeSchema.name, "readonly");
  const store = transaction.objectStore(storeSchema.name);
  const done = transactionDone(transaction);
  const [keys, values] = await Promise.all([
    requestToPromise(store.getAllKeys()),
    requestToPromise(store.getAll()),
  ]);
  await done;

  const records = [];
  for (let index = 0; index < values.length; index += 1) {
    records.push({
      key: keys[index],
      value: await encodeBackupValue(values[index]),
    });
  }

  return {
    name: storeSchema.name,
    keyPath: storeSchema.keyPath ?? null,
    records,
  };
}

async function collectIndexedDbSection(schema) {
  const db = await openExistingIndexedDb(schema);
  if (!db) {
    return {
      name: schema.name,
      version: schema.version,
      stores: schema.stores.map((store) => ({
        name: store.name,
        keyPath: store.keyPath ?? null,
        records: [],
      })),
    };
  }

  try {
    const stores = [];
    for (const storeSchema of schema.stores) {
      stores.push(await collectStoreRecords(db, schema, storeSchema));
    }
    return {
      name: schema.name,
      version: db.version || schema.version,
      stores,
    };
  } finally {
    db.close();
  }
}

async function clearIndexedDbSchema(schema) {
  const db = await openIndexedDbForRestore(schema);
  if (!db) {
    return;
  }

  try {
    const storeNames = schema.stores
      .map((store) => store.name)
      .filter((storeName) => db.objectStoreNames.contains(storeName));
    if (storeNames.length === 0) {
      return;
    }
    const transaction = db.transaction(storeNames, "readwrite");
    const done = transactionDone(transaction);
    storeNames.forEach((storeName) => {
      transaction.objectStore(storeName).clear();
    });
    await done;
  } finally {
    db.close();
  }
}

async function restoreIndexedDbSection(schema, dbSection) {
  const db = await openIndexedDbForRestore(schema);
  if (!db) {
    return;
  }

  try {
    const stores = Array.isArray(dbSection?.stores) ? dbSection.stores : [];
    const storeNames = stores
      .map((store) => String(store?.name || ""))
      .filter((storeName) => db.objectStoreNames.contains(storeName));
    if (storeNames.length === 0) {
      return;
    }

    const transaction = db.transaction(storeNames, "readwrite");
    const done = transactionDone(transaction);
    for (const storeSection of stores) {
      const storeName = String(storeSection?.name || "");
      if (!db.objectStoreNames.contains(storeName)) {
        continue;
      }
      const storeSchema = getStoreSchema(schema, storeName);
      const store = transaction.objectStore(storeName);
      const records = Array.isArray(storeSection?.records) ? storeSection.records : [];
      for (const record of records) {
        const value = decodeBackupValue(record?.value);
        if (storeSchema?.keyPath === null || storeSchema?.keyPath === undefined) {
          if (!record || !Object.prototype.hasOwnProperty.call(record, "key")) {
            continue;
          }
          store.put(value, record?.key);
        } else {
          store.put(value);
        }
      }
    }
    await done;
  } finally {
    db.close();
  }
}

export async function collectLocalDataBackupSection() {
  const indexedDb = [];
  for (const schema of INDEXED_DB_SCHEMAS) {
    indexedDb.push(await collectIndexedDbSection(schema));
  }

  return {
    schemaVersion: LOCAL_DATA_SCHEMA_VERSION,
    localStorage: collectLocalStorageEntries(),
    indexedDb,
  };
}

export async function clearLocalDataBackupSection() {
  clearIncludedLocalStorageEntries();

  for (const schema of INDEXED_DB_SCHEMAS) {
    await clearIndexedDbSchema(schema);
  }
}

export async function restoreLocalDataBackupSection(section) {
  const payload = section && typeof section === "object" ? section : {};

  const localStorageEntries = Array.isArray(payload.localStorage) ? payload.localStorage : [];
  const storage = getLocalStorage();
  if (storage) {
    localStorageEntries.forEach((entry) => {
      const key = getBackupLocalStorageKey(typeof entry?.key === "string" ? entry.key : "");
      const value = typeof entry?.value === "string" ? entry.value : null;
      if (key && value !== null) {
        storage.setItem(key, value);
        const scopedKey = scopeStorageKey(key);
        if (scopedKey && scopedKey !== key) {
          storage.setItem(scopedKey, value);
        }
      }
    });
  }

  const dbSections = Array.isArray(payload.indexedDb) ? payload.indexedDb : [];
  for (const schema of INDEXED_DB_SCHEMAS) {
    const dbSection = dbSections.find((entry) => entry?.name === schema.name);
    if (dbSection) {
      await restoreIndexedDbSection(schema, dbSection);
    }
  }
}
