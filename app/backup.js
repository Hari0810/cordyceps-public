export const BACKUP_SCHEMA_VERSION = 1;
const ENCRYPTED_BACKUP_FORMAT = "cordyceps-encrypted-backup";

function normalizeAdapter(adapter) {
  if (!adapter || typeof adapter !== "object" || !adapter.sectionKey) {
    throw new Error("Backup adapters must include a sectionKey.");
  }

  return {
    sectionKey: String(adapter.sectionKey),
    collectBackupSection: typeof adapter.collectBackupSection === "function"
      ? adapter.collectBackupSection
      : async () => null,
    restoreBackupSection: typeof adapter.restoreBackupSection === "function"
      ? adapter.restoreBackupSection
      : async () => {},
    clearSection: typeof adapter.clearSection === "function"
      ? adapter.clearSection
      : null
  };
}

export function createBackupRegistry(adapters) {
  const entries = Array.isArray(adapters) ? adapters.map(normalizeAdapter) : [];
  return new Map(entries.map((adapter) => [adapter.sectionKey, adapter]));
}

export async function collectBackupManifest({ appVersion = null, adapters, metadata = {} } = {}) {
  const registry = adapters instanceof Map ? adapters : createBackupRegistry(adapters);
  const sections = {};

  for (const adapter of registry.values()) {
    const payload = await adapter.collectBackupSection();
    if (payload !== undefined) {
      sections[adapter.sectionKey] = payload;
    }
  }

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: typeof appVersion === "string" && appVersion.trim() ? appVersion.trim() : null,
    metadata: metadata && typeof metadata === "object" ? { ...metadata } : {},
    sections
  };
}

export function validateBackupManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Backup file must contain an object.");
  }

  if (Number(manifest.schemaVersion) !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version: ${String(manifest.schemaVersion || "unknown")}.`);
  }

  if (typeof manifest.exportedAt !== "string" || !manifest.exportedAt.trim()) {
    throw new Error("Backup file is missing exportedAt.");
  }

  if (!manifest.sections || typeof manifest.sections !== "object" || Array.isArray(manifest.sections)) {
    throw new Error("Backup file is missing sections.");
  }

  return manifest;
}

function isEncryptedBackupWrapper(parsed) {
  return (
    parsed !== null &&
    typeof parsed === "object" &&
    parsed.encrypted === true &&
    typeof parsed.payload === "string"
  );
}

export async function readBackupFile(file, { decryptor } = {}) {
  if (!(file instanceof File)) {
    throw new Error("Select a backup file first.");
  }

  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }

  if (isEncryptedBackupWrapper(parsed)) {
    if (typeof decryptor !== "function") {
      throw new Error("This backup uses the older protected format. Unlock it locally first, then try restoring again.");
    }
    let decrypted;
    try {
      decrypted = await decryptor(parsed.payload);
    } catch {
      throw new Error("Backup decryption failed. Make sure you are using the same previous passphrase that protected this backup.");
    }
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Decrypted backup content is not valid JSON.");
    }
  }

  return validateBackupManifest(parsed);
}

export async function restoreBackupManifest({ manifest, adapters } = {}) {
  const validatedManifest = validateBackupManifest(manifest);
  const registry = adapters instanceof Map ? adapters : createBackupRegistry(adapters);
  const result = {
    cleared: [],
    restored: [],
    skipped: [],
    errors: []
  };

  for (const adapter of registry.values()) {
    if (!adapter.clearSection) {
      continue;
    }

    try {
      await adapter.clearSection();
      result.cleared.push(adapter.sectionKey);
    } catch (error) {
      result.errors.push({
        sectionKey: adapter.sectionKey,
        stage: "clear",
        message: error instanceof Error ? error.message : "Section could not be cleared."
      });
    }
  }

  for (const [sectionKey, sectionValue] of Object.entries(validatedManifest.sections)) {
    const adapter = registry.get(sectionKey);
    if (!adapter) {
      result.skipped.push(sectionKey);
      continue;
    }

    try {
      await adapter.restoreBackupSection(sectionValue);
      result.restored.push(sectionKey);
    } catch (error) {
      result.errors.push({
        sectionKey,
        stage: "restore",
        message: error instanceof Error ? error.message : "Section could not be restored."
      });
    }
  }

  return result;
}

function toSafeBase64(value) {
  return btoa(value);
}

function fromSafeBase64(value) {
  return atob(value);
}

export async function blobToBase64Payload(blob) {
  if (!(blob instanceof Blob)) {
    return null;
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return {
    mimeType: blob.type || "application/octet-stream",
    size: blob.size,
    data: toSafeBase64(binary)
  };
}

export function base64PayloadToBlob(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.data !== "string") {
    return null;
  }

  const binary = fromSafeBase64(payload.data);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], {
    type: typeof payload.mimeType === "string" && payload.mimeType.trim()
      ? payload.mimeType
      : "application/octet-stream"
  });
}

export function createBackupFileName(prefix = "cordyceps-backup") {
  const safePrefix = String(prefix || "backup").trim() || "backup";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safePrefix}-${stamp}.json`;
}

export async function downloadBackupManifest(manifest, { prefix = "cordyceps-backup", encryptor } = {}) {
  const validatedManifest = validateBackupManifest(manifest);
  if (typeof encryptor !== "function") {
    const fileContent = JSON.stringify(validatedManifest, null, 2);
    const blob = new Blob([fileContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createBackupFileName(prefix);
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    return;
  }

  const json = JSON.stringify(validatedManifest, null, 2);
  const encryptedPayload = await encryptor(json);
  const wrapper = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    format: ENCRYPTED_BACKUP_FORMAT,
    exportedAt: validatedManifest.exportedAt,
    appVersion: validatedManifest.appVersion || null,
    workspaceId: typeof validatedManifest.metadata?.workspaceId === "string"
      ? validatedManifest.metadata.workspaceId
      : null,
    encrypted: true,
    encryption: {
      kind: "local-vault",
      alg: "AES-GCM",
      payloadEncoding: "json-string-envelope",
    },
    payload: encryptedPayload,
  };
  const fileContent = JSON.stringify(wrapper, null, 2);

  const blob = new Blob([fileContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = createBackupFileName(`${prefix}-enc`);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function describeBackupManifest(manifest) {
  const validatedManifest = validateBackupManifest(manifest);
  return {
    exportedAt: validatedManifest.exportedAt,
    appVersion: validatedManifest.appVersion || null,
    sectionKeys: Object.keys(validatedManifest.sections || {})
  };
}
