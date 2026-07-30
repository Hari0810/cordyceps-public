const WORKSPACE_STORAGE_KEY = "cordyceps.workspace.v1";
const WORKSPACE_KEY_PREFIX = "cordyceps.workspace.";
const WORKSPACE_VERSION = 1;
const WORKSPACE_ID_BYTES = 16;

function getStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function randomWorkspaceId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  const bytes = new Uint8Array(WORKSPACE_ID_BYTES);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeWorkspaceRecord(value) {
  const record = value && typeof value === "object" ? value : {};
  const workspaceId = String(record.workspaceId || "").trim() || randomWorkspaceId();
  return {
    version: WORKSPACE_VERSION,
    workspaceId,
    createdAt: typeof record.createdAt === "string" && record.createdAt
      ? record.createdAt
      : new Date().toISOString(),
    vaultVersion: Number(record.vaultVersion || 1),
    backupVersion: Number(record.backupVersion || 1),
  };
}

export function getLocalWorkspace() {
  const storage = getStorage();
  if (!storage) {
    return normalizeWorkspaceRecord(null);
  }
  let parsed = null;
  try {
    const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const workspace = normalizeWorkspaceRecord(parsed);
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Workspace identity should not make reads fail in private/limited storage modes.
  }
  return workspace;
}

export function getAuthStorageScope() {
  return getLocalWorkspace().workspaceId;
}

function findWorkspaceScopedValue(storage, rawKey, currentScopedKey) {
  const suffix = `.${rawKey}`;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      key &&
      key !== currentScopedKey &&
      key.startsWith(WORKSPACE_KEY_PREFIX) &&
      key.endsWith(suffix)
    ) {
      const value = storage.getItem(key);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}

export function scopeStorageKey(key) {
  const rawKey = String(key || "").trim();
  if (!rawKey || rawKey === WORKSPACE_STORAGE_KEY || rawKey.startsWith(WORKSPACE_KEY_PREFIX)) {
    return rawKey;
  }
  const scopedKey = `${WORKSPACE_KEY_PREFIX}${getAuthStorageScope()}.${rawKey}`;
  const storage = getStorage();
  if (storage) {
    try {
      if (storage.getItem(scopedKey) === null) {
        const legacyValue = storage.getItem(rawKey) ?? findWorkspaceScopedValue(storage, rawKey, scopedKey);
        if (legacyValue !== null) {
          storage.setItem(scopedKey, legacyValue);
        }
      }
    } catch {
      // Scoping should remain best-effort when browser storage is restricted.
    }
  }
  return scopedKey;
}

export function getScopedLocalStorageItem(key) {
  const scopedKey = scopeStorageKey(key);
  const value = window.localStorage.getItem(scopedKey);
  if (value !== null) {
    return value;
  }
  const rawKey = String(key || "").trim();
  return window.localStorage.getItem(rawKey) ?? findWorkspaceScopedValue(window.localStorage, rawKey, scopedKey);
}

export function setScopedLocalStorageItem(key, value) {
  window.localStorage.setItem(scopeStorageKey(key), value);
}

export function removeScopedLocalStorageItem(key) {
  window.localStorage.removeItem(scopeStorageKey(key));
  window.localStorage.removeItem(String(key || "").trim());
}
