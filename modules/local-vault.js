import { flushPendingWrites } from "./pending-writes.js";

const VAULT_METADATA_KEY = "cordyceps.vault.metadata.v1";
const VAULT_VERSION = 1;
const RECORD_VERSION = 1;
const APP_LOCK_VERSION = 2;
const DEFAULT_KDF = "PBKDF2-SHA256";
const DEFAULT_ITERATIONS = 310000;
const AES_ALG = "AES-GCM";
const PLAINTEXT_ALG = "PLAINTEXT";
const NONCE_BYTES = 12;
const INACTIVITY_LOCK_MS = 10 * 60 * 1000;
const BACKGROUND_LOCK_MS = 60 * 1000;
const APP_LOCK_PRF_LABEL = "cordyceps-local-vault-app-lock";
const VAULT_RUNTIME_STATE_KEY = "__cordycepsVaultRuntimeState";
const WEBAUTHN_FOCUS_TIMEOUT_MS = 10_000;
const LOCAL_VAULT_PROTECTION_ENABLED = false;
const SENSITIVE_LOCAL_STORAGE_PATTERNS = [
  "today.todo.habits",
  "today.todo.long-term-goals",
  "today.todo.calendar",
  "today.todo.notes",
  "today.todo.monzo",
  // Only intercept keys that have a durable mirror and a lock-aware write
  // path today. Otherwise the guard turns restart persistence into
  // session-only volatile state.
  "today.rituals.v2",
  "today.tamil.v1",
  "monzo.budget.v1",
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getVaultRuntimeState() {
  const existing = globalThis[VAULT_RUNTIME_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing;
  }
  const created = {
    activeKey: null,
    lifecycleInstalled: false,
    storageGuardInstalled: false,
    inactivityTimer: null,
    backgroundTimer: null,
    purposeKeys: new Map(),
    purposeInactivityTimers: new Map(),
    purposeUnlockPromises: new Map(),
    volatileSensitiveStorage: new Map(),
    interactiveUnlockPromise: null,
  };
  globalThis[VAULT_RUNTIME_STATE_KEY] = created;
  return created;
}

const vaultRuntimeState = getVaultRuntimeState();
const purposeKeys = vaultRuntimeState.purposeKeys;
const purposeInactivityTimers = vaultRuntimeState.purposeInactivityTimers;
const purposeUnlockPromises = vaultRuntimeState.purposeUnlockPromises;
const volatileSensitiveStorage = vaultRuntimeState.volatileSensitiveStorage;

function getCrypto() {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef?.subtle || typeof cryptoRef.getRandomValues !== "function") {
    throw new Error("Cordyceps vault requires Web Crypto.");
  }
  return cryptoRef;
}

function getStorage() {
  if (!globalThis.localStorage) {
    throw new Error("Cordyceps vault requires localStorage for vault metadata.");
  }
  return globalThis.localStorage;
}

function shouldProtectLocalStorageKey(key) {
  const storageKey = String(key || "");
  return SENSITIVE_LOCAL_STORAGE_PATTERNS.some((pattern) => storageKey.includes(pattern));
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

function toBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBase64Url(bytes) {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return fromBase64(padded);
}

function coerceBytes(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function concatBytes(...chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + (chunk?.byteLength || 0), 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    if (!chunk?.byteLength) {
      return;
    }
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return bytes;
}

function getStoredAppLockCredentialId(appLock) {
  if (!appLock?.credentialId && !appLock?.credentialIdUrl) {
    return null;
  }
  return appLock.credentialIdUrl ? fromBase64Url(appLock.credentialIdUrl) : fromBase64(appLock.credentialId);
}

function getStoredAppLockCredentialIdUrl(appLock) {
  if (typeof appLock?.credentialIdUrl === "string" && appLock.credentialIdUrl) {
    return appLock.credentialIdUrl;
  }
  const credentialId = getStoredAppLockCredentialId(appLock);
  return credentialId ? toBase64Url(credentialId) : "";
}

function isAppLockBiometricUnlockEnabled(appLock) {
  return Boolean(appLock?.credentialId && appLock?.prfSalt && appLock?.passphraseEnvelope);
}

function dispatchVaultEvent(type) {
  try {
    const detail = getLocalVaultStatus();
    globalThis.dispatchEvent?.(new CustomEvent(type, { detail }));
    const cityEventType = {
      "cordyceps:vault-unlocked": "city-vault:unlocked",
      "cordyceps:vault-locked": "city-vault:locked",
      "cordyceps:vault-unlock-required": "city-vault:unlock-required",
    }[type];
    if (cityEventType) {
      globalThis.dispatchEvent?.(new CustomEvent(cityEventType, { detail }));
    }
  } catch {}
}

function normalizePurpose(purpose) {
  return String(purpose || "app-data").trim() || "app-data";
}

function getPurposeVaultStatus(purpose) {
  const normalizedPurpose = normalizePurpose(purpose);
  return {
    ...getLocalVaultStatus(),
    purpose: normalizedPurpose,
    unlocked: purposeKeys.has(normalizedPurpose),
  };
}

function dispatchPurposeVaultEvent(type, purpose) {
  try {
    globalThis.dispatchEvent?.(new CustomEvent(type, { detail: getPurposeVaultStatus(purpose) }));
  } catch {}
}

function normalizePassphrase(passphrase) {
  return String(passphrase || "");
}

function readVaultMetadata() {
  try {
    const raw = getStorage().getItem(VAULT_METADATA_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeVaultMetadata(metadata) {
  getStorage().setItem(VAULT_METADATA_KEY, JSON.stringify(metadata));
}

function updateVaultMetadata(patch) {
  const metadata = readVaultMetadata();
  if (!metadata) {
    throw new Error("Cordyceps vault is not configured.");
  }
  const nextMetadata = {
    ...metadata,
    ...(patch && typeof patch === "object" ? patch : {}),
  };
  writeVaultMetadata(nextMetadata);
  return nextMetadata;
}

async function deriveKey(passphrase, salt, iterations) {
  const cryptoRef = getCrypto();
  const baseKey = await cryptoRef.subtle.importKey(
    "raw",
    encoder.encode(normalizePassphrase(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return cryptoRef.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    baseKey,
    { name: AES_ALG, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptTextWithKey(key, text) {
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = await getCrypto().subtle.encrypt(
    { name: AES_ALG, iv: nonce },
    key,
    encoder.encode(String(text))
  );
  return {
    version: RECORD_VERSION,
    alg: AES_ALG,
    nonce: toBase64(nonce),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  };
}

async function decryptTextWithKey(key, envelope) {
  if (!isAesEnvelope(envelope)) {
    throw new Error("Invalid encrypted Cordyceps vault record.");
  }
  const plaintext = await getCrypto().subtle.decrypt(
    { name: AES_ALG, iv: fromBase64(envelope.nonce) },
    key,
    fromBase64(envelope.ciphertext)
  );
  return decoder.decode(plaintext);
}

function parseEnvelope(value) {
  if (isEncryptedEnvelope(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return isEncryptedEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function promptForPassphrase(metadata, purpose = "") {
  if (typeof globalThis.prompt !== "function") {
    return "";
  }
  if (!metadata && !LOCAL_VAULT_PROTECTION_ENABLED) {
    return "";
  }
  const purposeLabel = normalizePurpose(purpose);
  const purposeCopy = purpose
    ? `\n\nThis unlocks only the older protected ${purposeLabel} on this install. It does not unlock Journal or notes.`
    : "";
  const guidance = metadata
    ? "Use the previous passphrase you saved when this data was protected."
    : "Save this in your password manager. Cordyceps cannot recover encrypted data if you lose it.";
  const title = metadata
    ? "Unlock older protected local data."
    : "Create your Cordyceps vault passphrase.";
  return globalThis.prompt(`${title}\n\n${guidance}${purposeCopy}`) || "";
}

async function requestUnlockFromCustomUi({ metadata, purpose = "", submit }) {
  const requestUnlock = globalThis.window?.__cordycepsVaultPrompt?.requestUnlock;
  if (typeof requestUnlock !== "function") {
    return null;
  }
  return requestUnlock({
    configured: Boolean(metadata),
    purpose: purpose ? normalizePurpose(purpose) : "",
    submit,
  });
}

function promptForAppLockEnrollmentPassphrase() {
  if (typeof globalThis.prompt !== "function") {
    return "";
  }
  return globalThis.prompt(
    "Confirm your Cordyceps vault passphrase to enable WebAuthn unlock on this device.\n\n" +
    "Cordyceps will keep an encrypted local unlock copy protected by this device passkey. Your saved vault passphrase is still the recovery key."
  ) || "";
}

function confirmVaultSafety(message) {
  if (typeof globalThis.confirm !== "function") {
    return true;
  }
  return globalThis.confirm(message);
}

export function isEncryptedEnvelope(value) {
  return isAesEnvelope(value) || isPlaintextEnvelope(value);
}

function isAesEnvelope(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.version === RECORD_VERSION &&
      value.alg === AES_ALG &&
      typeof value.nonce === "string" &&
      typeof value.ciphertext === "string"
  );
}

function isPlaintextEnvelope(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.version === RECORD_VERSION &&
      value.alg === PLAINTEXT_ALG &&
      typeof value.plaintext === "string"
  );
}

function buildPlaintextEnvelope(text) {
  return {
    version: RECORD_VERSION,
    alg: PLAINTEXT_ALG,
    plaintext: String(text ?? ""),
    updatedAt: new Date().toISOString(),
  };
}

export function isLocalVaultProtectionEnabled() {
  return LOCAL_VAULT_PROTECTION_ENABLED;
}

export function hasLocalVault() {
  return Boolean(readVaultMetadata());
}

export function isLocalVaultUnlocked() {
  return Boolean(vaultRuntimeState.activeKey);
}

export function isLocalVaultUnlockedFor(purpose) {
  return purposeKeys.has(normalizePurpose(purpose));
}

export function getLocalVaultStatus() {
  const metadata = readVaultMetadata();
  return {
    configured: Boolean(metadata),
    unlocked: Boolean(vaultRuntimeState.activeKey),
    protectionEnabled: LOCAL_VAULT_PROTECTION_ENABLED,
    appLockEnabled: Boolean(metadata?.appLock?.credentialId),
    webAuthnUnlockEnabled: isAppLockBiometricUnlockEnabled(metadata?.appLock),
    version: metadata?.version ?? null,
    kdf: metadata?.kdf ?? null,
    iterations: metadata?.iterations ?? null,
    createdAt: metadata?.createdAt ?? null,
  };
}

export function isLocalAppLockEnabled() {
  return Boolean(readVaultMetadata()?.appLock?.credentialId);
}

function isLocalAppLockSupported() {
  return Boolean(globalThis.navigator?.credentials?.create && globalThis.navigator?.credentials?.get);
}

function getLocalAppLockLabel() {
  const platform = String(globalThis.navigator?.platform || "");
  const userAgent = String(globalThis.navigator?.userAgent || "");
  const isApple = /Mac|iPhone|iPad|iPod/u.test(platform) || /iPhone|iPad|Macintosh/u.test(userAgent);
  return isApple ? "Face ID / Touch ID passkey" : "device passkey";
}

function isWebAuthnDocumentReady() {
  const documentRef = globalThis.document;
  if (!documentRef) {
    return true;
  }
  if (documentRef.visibilityState === "hidden") {
    return false;
  }
  return typeof documentRef.hasFocus !== "function" || documentRef.hasFocus();
}

async function waitForWebAuthnDocumentFocus(timeoutMs = WEBAUTHN_FOCUS_TIMEOUT_MS) {
  if (isWebAuthnDocumentReady()) {
    return true;
  }
  if (!globalThis.window || !globalThis.document) {
    return false;
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      globalThis.window?.removeEventListener?.("focus", handleStateChange);
      globalThis.window?.removeEventListener?.("pageshow", handleStateChange);
      globalThis.document?.removeEventListener?.("visibilitychange", handleStateChange);
      if (timeoutId !== null) {
        globalThis.clearTimeout?.(timeoutId);
      }
    };

    const settle = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const handleStateChange = () => {
      if (isWebAuthnDocumentReady()) {
        settle(true);
      }
    };

    globalThis.window.addEventListener("focus", handleStateChange);
    globalThis.window.addEventListener("pageshow", handleStateChange);
    globalThis.document.addEventListener("visibilitychange", handleStateChange);
    timeoutId = globalThis.setTimeout?.(() => {
      settle(isWebAuthnDocumentReady());
    }, timeoutMs) ?? null;
  });
}

export async function getLocalAppLockStatus() {
  if (!LOCAL_VAULT_PROTECTION_ENABLED) {
    return {
      available: false,
      enabled: false,
      appLockCreated: false,
      label: getLocalAppLockLabel(),
    };
  }
  const metadata = readVaultMetadata();
  return {
    available: isLocalAppLockSupported(),
    enabled: isAppLockBiometricUnlockEnabled(metadata?.appLock),
    appLockCreated: Boolean(metadata?.appLock?.credentialId),
    label: getLocalAppLockLabel(),
  };
}

async function deriveAppLockEnvelopeKey(secretBytes) {
  const normalizedSecret = coerceBytes(secretBytes);
  if (!normalizedSecret?.byteLength) {
    throw new Error("Passkey unlock could not derive a device secret.");
  }
  const digest = await getCrypto().subtle.digest(
    "SHA-256",
    concatBytes(encoder.encode(APP_LOCK_PRF_LABEL), normalizedSecret)
  );
  return getCrypto().subtle.importKey("raw", digest, { name: AES_ALG, length: 256 }, false, ["encrypt", "decrypt"]);
}

async function requestLocalAppLockAssertion(appLock, { prfSalt = null } = {}) {
  const credentialId = getStoredAppLockCredentialId(appLock);
  if (!credentialId) {
    return null;
  }
  if (!globalThis.navigator?.credentials?.get) {
    return null;
  }
  const documentReady = await waitForWebAuthnDocumentFocus();
  if (!documentReady) {
    return null;
  }
  const publicKey = {
    challenge: randomBytes(32),
    allowCredentials: [
      {
        type: "public-key",
        id: credentialId,
      },
    ],
    userVerification: "required",
    timeout: 60_000,
  };
  if (prfSalt?.byteLength) {
    publicKey.extensions = {
      prf: {
        evalByCredential: {
          [getStoredAppLockCredentialIdUrl(appLock)]: {
            first: prfSalt,
          },
        },
      },
    };
  }
  try {
    return await globalThis.navigator.credentials.get({ publicKey });
  } catch (error) {
    if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
      return null;
    }
    throw error;
  }
}

async function readAppLockPrfSecret(appLock) {
  const prfSalt = typeof appLock?.prfSalt === "string" && appLock.prfSalt ? fromBase64(appLock.prfSalt) : null;
  if (!prfSalt?.byteLength) {
    return null;
  }
  const assertion = await requestLocalAppLockAssertion(appLock, { prfSalt });
  if (!assertion?.getClientExtensionResults) {
    return null;
  }
  const prfSecret = coerceBytes(assertion.getClientExtensionResults()?.prf?.results?.first);
  return prfSecret?.byteLength ? prfSecret : null;
}

async function unlockLocalVaultWithAppLock(metadata) {
  const appLock = metadata?.appLock;
  if (!isAppLockBiometricUnlockEnabled(appLock)) {
    return false;
  }
  try {
    const prfSecret = await readAppLockPrfSecret(appLock);
    if (!prfSecret) {
      return false;
    }
    const unlockKey = await deriveAppLockEnvelopeKey(prfSecret);
    const passphrase = await decryptTextWithKey(unlockKey, appLock.passphraseEnvelope);
    await unlockLocalVault(passphrase);
    return true;
  } catch {
    return false;
  }
}

export async function enableLocalAppLock() {
  if (!LOCAL_VAULT_PROTECTION_ENABLED) {
    throw new Error("Local password protection is disabled in this build.");
  }
  const metadata = readVaultMetadata();
  if (!metadata) {
    throw new Error("Create the Cordyceps vault before enabling app lock.");
  }
  if (!globalThis.navigator?.credentials?.create) {
    throw new Error("This browser does not support passkey app lock.");
  }
  const confirmed = confirmVaultSafety(
    "Before creating a Cordyceps passkey app lock, save your vault passphrase in your password manager.\n\n" +
    "The passkey helps unlock this device, but it is not a recovery key. If you lose the vault passphrase, Cordyceps cannot recover encrypted local data."
  );
  if (!confirmed) {
    throw new Error("Passkey app lock was not created. Save your vault passphrase first, then try again.");
  }
  const passphrase = promptForAppLockEnrollmentPassphrase();
  if (!passphrase) {
    throw new Error("Vault passphrase is required to enable WebAuthn unlock.");
  }
  await deriveVerifiedVaultKey(passphrase, metadata);
  const documentReady = await waitForWebAuthnDocumentFocus();
  if (!documentReady) {
    throw new Error(`Bring Cordyceps to the foreground before setting up ${getLocalAppLockLabel()}.`);
  }
  const userId = randomBytes(16);
  const credential = await globalThis.navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Cordyceps" },
      user: {
        id: userId,
        name: "cordyceps-local-vault",
        displayName: "Cordyceps Local Vault",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60_000,
      attestation: "none",
      extensions: {
        prf: {},
      },
    },
  });
  if (!credential?.rawId) {
    throw new Error("Passkey app lock was not created.");
  }
  const credentialId = new Uint8Array(credential.rawId);
  const prfSalt = randomBytes(32);
  const prfAssertion = await requestLocalAppLockAssertion(
    {
      credentialId: toBase64(credentialId),
      credentialIdUrl: toBase64Url(credentialId),
    },
    { prfSalt },
  );
  const prfSecret = coerceBytes(prfAssertion?.getClientExtensionResults?.()?.prf?.results?.first);
  if (!prfSecret) {
    throw new Error("This browser created a passkey, but it could not enable PRF-based WebAuthn unlock for the vault.");
  }
  const unlockKey = await deriveAppLockEnvelopeKey(prfSecret);
  const passphraseEnvelope = await encryptTextWithKey(unlockKey, passphrase);
  updateVaultMetadata({
    appLock: {
      version: APP_LOCK_VERSION,
      credentialId: toBase64(credentialId),
      credentialIdUrl: toBase64Url(credentialId),
      userId: toBase64(userId),
      prfSalt: toBase64(prfSalt),
      passphraseEnvelope,
      createdAt: new Date().toISOString(),
    },
  });
  return getLocalVaultStatus();
}

export async function verifyLocalAppLock() {
  const appLock = readVaultMetadata()?.appLock;
  if (!appLock?.credentialId) {
    return true;
  }
  const assertion = await requestLocalAppLockAssertion(appLock);
  return Boolean(assertion);
}

export async function setupLocalVault(passphrase) {
  const normalizedPassphrase = normalizePassphrase(passphrase);
  if (normalizedPassphrase.length < 8) {
    throw new Error("Vault passphrase must be at least 8 characters.");
  }
  const salt = randomBytes(16);
  const key = await deriveKey(normalizedPassphrase, salt, DEFAULT_ITERATIONS);
  const encryptedVerifier = await encryptTextWithKey(
    key,
    JSON.stringify({ version: VAULT_VERSION, purpose: "cordyceps-vault-verifier" })
  );
  const metadata = {
    version: VAULT_VERSION,
    kdf: DEFAULT_KDF,
    salt: toBase64(salt),
    iterations: DEFAULT_ITERATIONS,
    encryptedVerifier,
    createdAt: new Date().toISOString(),
  };
  writeVaultMetadata(metadata);
  vaultRuntimeState.activeKey = key;
  scheduleInactivityLock();
  dispatchVaultEvent("cordyceps:vault-unlocked");
  return getLocalVaultStatus();
}

async function deriveVerifiedVaultKey(passphrase, metadata) {
  if (!metadata) {
    throw new Error("Cordyceps vault is not configured.");
  }
  if (metadata.kdf !== DEFAULT_KDF || metadata.version !== VAULT_VERSION) {
    throw new Error("Unsupported Cordyceps vault format.");
  }
  const key = await deriveKey(
    normalizePassphrase(passphrase),
    fromBase64(metadata.salt),
    Number(metadata.iterations || DEFAULT_ITERATIONS)
  );
  const verifier = JSON.parse(await decryptTextWithKey(key, metadata.encryptedVerifier));
  if (verifier?.purpose !== "cordyceps-vault-verifier") {
    throw new Error("Invalid Cordyceps vault verifier.");
  }
  return key;
}

async function setupLocalVaultForPurpose(passphrase, purpose) {
  const normalizedPassphrase = normalizePassphrase(passphrase);
  if (normalizedPassphrase.length < 8) {
    throw new Error("Vault passphrase must be at least 8 characters.");
  }
  const normalizedPurpose = normalizePurpose(purpose);
  const salt = randomBytes(16);
  const key = await deriveKey(normalizedPassphrase, salt, DEFAULT_ITERATIONS);
  const encryptedVerifier = await encryptTextWithKey(
    key,
    JSON.stringify({ version: VAULT_VERSION, purpose: "cordyceps-vault-verifier" })
  );
  const metadata = {
    version: VAULT_VERSION,
    kdf: DEFAULT_KDF,
    salt: toBase64(salt),
    iterations: DEFAULT_ITERATIONS,
    encryptedVerifier,
    createdAt: new Date().toISOString(),
  };
  writeVaultMetadata(metadata);
  purposeKeys.set(normalizedPurpose, key);
  schedulePurposeInactivityLock(normalizedPurpose);
  dispatchPurposeVaultEvent("city-vault:purpose-unlocked", normalizedPurpose);
  return getPurposeVaultStatus(normalizedPurpose);
}

export async function unlockLocalVault(passphrase) {
  const metadata = readVaultMetadata();
  if (!metadata) {
    return setupLocalVault(passphrase);
  }
  const key = await deriveVerifiedVaultKey(passphrase, metadata);
  vaultRuntimeState.activeKey = key;
  scheduleInactivityLock();
  dispatchVaultEvent("cordyceps:vault-unlocked");
  return getLocalVaultStatus();
}

export function lockLocalVault() {
  vaultRuntimeState.activeKey = null;
  if (vaultRuntimeState.inactivityTimer !== null) {
    globalThis.clearTimeout?.(vaultRuntimeState.inactivityTimer);
    vaultRuntimeState.inactivityTimer = null;
  }
  if (vaultRuntimeState.backgroundTimer !== null) {
    globalThis.clearTimeout?.(vaultRuntimeState.backgroundTimer);
    vaultRuntimeState.backgroundTimer = null;
  }
  dispatchVaultEvent("cordyceps:vault-locked");
}

export function lockLocalVaultPurpose(purpose) {
  const normalizedPurpose = normalizePurpose(purpose);
  purposeKeys.delete(normalizedPurpose);
  const timer = purposeInactivityTimers.get(normalizedPurpose);
  if (timer !== undefined) {
    globalThis.clearTimeout?.(timer);
    purposeInactivityTimers.delete(normalizedPurpose);
  }
  dispatchPurposeVaultEvent("city-vault:purpose-locked", normalizedPurpose);
}

function lockAllLocalVaultPurposes() {
  Array.from(purposeKeys.keys()).forEach((purpose) => lockLocalVaultPurpose(purpose));
}

function scheduleInactivityLock() {
  if (!vaultRuntimeState.activeKey || !globalThis.setTimeout) {
    return;
  }
  if (vaultRuntimeState.inactivityTimer !== null) {
    globalThis.clearTimeout(vaultRuntimeState.inactivityTimer);
  }
  vaultRuntimeState.inactivityTimer = globalThis.setTimeout(() => {
    lockLocalVault();
  }, INACTIVITY_LOCK_MS);
}

function schedulePurposeInactivityLock(purpose) {
  const normalizedPurpose = normalizePurpose(purpose);
  if (!purposeKeys.has(normalizedPurpose) || !globalThis.setTimeout) {
    return;
  }
  const existingTimer = purposeInactivityTimers.get(normalizedPurpose);
  if (existingTimer !== undefined) {
    globalThis.clearTimeout(existingTimer);
  }
  purposeInactivityTimers.set(
    normalizedPurpose,
    globalThis.setTimeout(() => {
      lockLocalVaultPurpose(normalizedPurpose);
    }, INACTIVITY_LOCK_MS)
  );
}

function scheduleAllPurposeInactivityLocks() {
  Array.from(purposeKeys.keys()).forEach((purpose) => schedulePurposeInactivityLock(purpose));
}

function installVaultLifecycleLocks() {
  if (vaultRuntimeState.lifecycleInstalled || !globalThis.window) {
    return;
  }
  vaultRuntimeState.lifecycleInstalled = true;
  const resetActivity = () => {
    scheduleInactivityLock();
    scheduleAllPurposeInactivityLocks();
  };
  ["pointerdown", "keydown", "touchstart", "visibilitychange"].forEach((eventName) => {
    globalThis.window.addEventListener(eventName, resetActivity, { passive: true });
  });
  globalThis.window.addEventListener("visibilitychange", () => {
    if (!vaultRuntimeState.activeKey && purposeKeys.size === 0) {
      return;
    }
    if (document.visibilityState === "hidden") {
      vaultRuntimeState.backgroundTimer = globalThis.setTimeout(() => {
        lockLocalVault();
        lockAllLocalVaultPurposes();
      }, BACKGROUND_LOCK_MS);
    } else if (vaultRuntimeState.backgroundTimer !== null) {
      globalThis.clearTimeout(vaultRuntimeState.backgroundTimer);
      vaultRuntimeState.backgroundTimer = null;
    }
  });
  globalThis.window.addEventListener("pagehide", () => {
    void flushPendingWrites("pagehide").catch(() => {});
  });
  globalThis.window.addEventListener("beforeunload", () => {
    void flushPendingWrites("beforeunload").catch(() => {});
  });
}

async function requireActiveVaultKey({ interactive = false } = {}) {
  const activeKey = vaultRuntimeState.activeKey;
  if (activeKey) {
    scheduleInactivityLock();
    return activeKey;
  }

  const unlocked = await ensureLocalVaultUnlocked({ interactive });
  if (!unlocked || !vaultRuntimeState.activeKey) {
    throw new Error("Older protected local data is locked.");
  }
  scheduleInactivityLock();
  return vaultRuntimeState.activeKey;
}

function installSensitiveLocalStorageGuard() {
  if (vaultRuntimeState.storageGuardInstalled || !globalThis.localStorage) {
    return;
  }
  const storage = globalThis.localStorage;
  const prototype = Object.getPrototypeOf(storage);
  if (!prototype?.getItem || !prototype?.setItem || !prototype?.removeItem) {
    return;
  }
  vaultRuntimeState.storageGuardInstalled = true;
  const originalGetItem = prototype.getItem;
  const originalSetItem = prototype.setItem;
  const originalRemoveItem = prototype.removeItem;
  prototype.getItem = function guardedGetItem(key) {
    if (this === storage && shouldProtectLocalStorageKey(key)) {
      const normalizedKey = String(key);
      if (volatileSensitiveStorage.has(normalizedKey)) {
        return volatileSensitiveStorage.get(normalizedKey);
      }
      // Preserve read compatibility for pre-hardening durable keys so legacy
      // data can be migrated into the new encrypted mirrors on first access.
      return originalGetItem.call(this, normalizedKey);
    }
    return originalGetItem.call(this, key);
  };
  prototype.setItem = function guardedSetItem(key, value) {
    if (this === storage && shouldProtectLocalStorageKey(key)) {
      volatileSensitiveStorage.set(String(key), String(value));
      originalRemoveItem.call(this, key);
      return undefined;
    }
    return originalSetItem.call(this, key, value);
  };
  prototype.removeItem = function guardedRemoveItem(key) {
    if (this === storage && shouldProtectLocalStorageKey(key)) {
      volatileSensitiveStorage.delete(String(key));
    }
    return originalRemoveItem.call(this, key);
  };
}

export async function ensureLocalVaultUnlocked({ interactive = false } = {}) {
  if (vaultRuntimeState.activeKey) {
    return true;
  }
  const metadata = readVaultMetadata();
  if (!LOCAL_VAULT_PROTECTION_ENABLED && !metadata) {
    return true;
  }
  if (!interactive) {
    dispatchVaultEvent("cordyceps:vault-unlock-required");
    return false;
  }
  if (vaultRuntimeState.interactiveUnlockPromise) {
    return vaultRuntimeState.interactiveUnlockPromise;
  }

  vaultRuntimeState.interactiveUnlockPromise = runInteractiveVaultUnlock(metadata);
  try {
    return await vaultRuntimeState.interactiveUnlockPromise;
  } finally {
    vaultRuntimeState.interactiveUnlockPromise = null;
  }
}

async function runInteractiveVaultUnlock(metadata) {
  if (metadata?.appLock?.credentialId) {
    const unlockedWithAppLock = await unlockLocalVaultWithAppLock(metadata);
    if (unlockedWithAppLock) {
      return true;
    }
  }
  const unlockedWithCustomUi = await requestUnlockFromCustomUi({
    metadata,
    submit: async (passphrase) => {
      if (metadata) {
        await unlockLocalVault(passphrase);
      } else {
        throw new Error("Local password protection is disabled in this build.");
      }
    },
  });
  if (typeof unlockedWithCustomUi === "boolean") {
    return unlockedWithCustomUi;
  }
  const passphrase = promptForPassphrase(metadata);
  if (!passphrase) {
    return false;
  }
  if (metadata) {
    await unlockLocalVault(passphrase);
  } else {
    return false;
  }
  return true;
}

export async function ensureLocalVaultUnlockedFor(purpose, { interactive = true } = {}) {
  const normalizedPurpose = normalizePurpose(purpose);
  if (purposeKeys.has(normalizedPurpose)) {
    schedulePurposeInactivityLock(normalizedPurpose);
    return true;
  }
  const metadata = readVaultMetadata();
  if (!LOCAL_VAULT_PROTECTION_ENABLED && !metadata) {
    return true;
  }
  if (!interactive) {
    dispatchPurposeVaultEvent("city-vault:purpose-unlock-required", normalizedPurpose);
    return false;
  }
  const pendingPurposeUnlock = purposeUnlockPromises.get(normalizedPurpose);
  if (pendingPurposeUnlock) {
    return pendingPurposeUnlock;
  }

  const purposeUnlockPromise = runInteractivePurposeVaultUnlock(normalizedPurpose, metadata);
  purposeUnlockPromises.set(normalizedPurpose, purposeUnlockPromise);
  try {
    return await purposeUnlockPromise;
  } finally {
    purposeUnlockPromises.delete(normalizedPurpose);
  }
}

async function runInteractivePurposeVaultUnlock(normalizedPurpose, metadata) {
  if (metadata?.appLock?.credentialId) {
    const unlockedWithAppLock = await unlockLocalVaultWithAppLock(metadata);
    if (unlockedWithAppLock && vaultRuntimeState.activeKey) {
      purposeKeys.set(normalizedPurpose, vaultRuntimeState.activeKey);
      schedulePurposeInactivityLock(normalizedPurpose);
      dispatchPurposeVaultEvent("city-vault:purpose-unlocked", normalizedPurpose);
      return true;
    }
  }
  const unlockedWithCustomUi = await requestUnlockFromCustomUi({
    metadata,
    purpose: normalizedPurpose,
    submit: async (passphrase) => {
      if (metadata) {
        const key = await deriveVerifiedVaultKey(passphrase, metadata);
        purposeKeys.set(normalizedPurpose, key);
        schedulePurposeInactivityLock(normalizedPurpose);
        dispatchPurposeVaultEvent("city-vault:purpose-unlocked", normalizedPurpose);
        return;
      }
      throw new Error("Local password protection is disabled in this build.");
    },
  });
  if (typeof unlockedWithCustomUi === "boolean") {
    return unlockedWithCustomUi;
  }
  const passphrase = promptForPassphrase(metadata, normalizedPurpose);
  if (!passphrase) {
    return false;
  }
  if (metadata) {
    const key = await deriveVerifiedVaultKey(passphrase, metadata);
    purposeKeys.set(normalizedPurpose, key);
    schedulePurposeInactivityLock(normalizedPurpose);
    dispatchPurposeVaultEvent("city-vault:purpose-unlocked", normalizedPurpose);
  } else {
    return false;
  }
  return true;
}

export async function encryptLocalValue(value) {
  if (!LOCAL_VAULT_PROTECTION_ENABLED) {
    return buildPlaintextEnvelope(JSON.stringify(value));
  }
  const activeKey = await requireActiveVaultKey({ interactive: false });
  return encryptTextWithKey(activeKey, JSON.stringify(value));
}

export async function decryptLocalValue(envelope) {
  const parsedEnvelope = parseEnvelope(envelope);
  if (!parsedEnvelope) {
    return envelope;
  }
  if (isPlaintextEnvelope(parsedEnvelope)) {
    return JSON.parse(parsedEnvelope.plaintext);
  }
  const activeKey = await requireActiveVaultKey({ interactive: !LOCAL_VAULT_PROTECTION_ENABLED });
  return JSON.parse(await decryptTextWithKey(activeKey, parsedEnvelope));
}

export async function encryptLocalString(value) {
  if (!LOCAL_VAULT_PROTECTION_ENABLED) {
    return String(value || "");
  }
  const activeKey = await requireActiveVaultKey({ interactive: true });
  return JSON.stringify(await encryptTextWithKey(activeKey, String(value || "")));
}

export async function decryptLocalString(value) {
  const envelope = parseEnvelope(value);
  if (!envelope) {
    if (!LOCAL_VAULT_PROTECTION_ENABLED) {
      return String(value || "");
    }
    throw new Error("Invalid encrypted Cordyceps vault payload.");
  }
  if (isPlaintextEnvelope(envelope)) {
    return envelope.plaintext;
  }
  const activeKey = await requireActiveVaultKey({ interactive: true });
  return decryptTextWithKey(activeKey, envelope);
}

export async function encryptLocalStringFor(purpose, value) {
  if (!LOCAL_VAULT_PROTECTION_ENABLED) {
    return String(value || "");
  }
  const normalizedPurpose = normalizePurpose(purpose);
  const unlocked = await ensureLocalVaultUnlockedFor(normalizedPurpose, { interactive: false });
  const key = purposeKeys.get(normalizedPurpose);
  if (!unlocked || !key) {
    throw new Error("Older protected local data is locked for this purpose.");
  }
  schedulePurposeInactivityLock(normalizedPurpose);
  return JSON.stringify(await encryptTextWithKey(key, String(value || "")));
}

export async function decryptLocalStringFor(purpose, value) {
  const normalizedPurpose = normalizePurpose(purpose);
  const envelope = parseEnvelope(value);
  if (!envelope) {
    if (!LOCAL_VAULT_PROTECTION_ENABLED) {
      return String(value || "");
    }
    throw new Error("Invalid encrypted Cordyceps vault payload.");
  }
  if (isPlaintextEnvelope(envelope)) {
    return envelope.plaintext;
  }
  const unlocked = await ensureLocalVaultUnlockedFor(normalizedPurpose, { interactive: false });
  const key = purposeKeys.get(normalizedPurpose);
  if (!unlocked || !key) {
    throw new Error("Older protected local data is locked for this purpose.");
  }
  schedulePurposeInactivityLock(normalizedPurpose);
  return decryptTextWithKey(key, envelope);
}

export function installCityVaultBridge() {
  if (!globalThis.window) {
    return;
  }
  installSensitiveLocalStorageGuard();
  installVaultLifecycleLocks();
  globalThis.window.__cityVault = {
    isUnlocked: isLocalVaultUnlocked,
    isUnlockedFor: isLocalVaultUnlockedFor,
    lock: lockLocalVault,
    lockPurpose: lockLocalVaultPurpose,
    status: getLocalVaultStatus,
    unlock: unlockLocalVault,
    ensureUnlockedFor: ensureLocalVaultUnlockedFor,
    appLockStatus: getLocalAppLockStatus,
    enableAppLock: enableLocalAppLock,
    verifyAppLock: verifyLocalAppLock,
    isAppLockEnabled: isLocalAppLockEnabled,
    encrypt: encryptLocalString,
    decrypt: decryptLocalString,
    encryptFor: encryptLocalStringFor,
    decryptFor: decryptLocalStringFor,
  };
}
