const PENDING_WRITE_STATE_KEY = "__cordycepsPendingWriteState";

function getPendingWriteState() {
  const existing = globalThis[PENDING_WRITE_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing;
  }
  const created = {
    pendingWriteFlushers: new Map(),
    lifecycleInstalled: false,
    activeFlushPromise: null,
  };
  globalThis[PENDING_WRITE_STATE_KEY] = created;
  return created;
}

const pendingWriteState = getPendingWriteState();

export function registerPendingWriteFlusher(key, flusher) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || typeof flusher !== "function") {
    return () => {};
  }

  pendingWriteState.pendingWriteFlushers.set(normalizedKey, flusher);
  return () => {
    if (pendingWriteState.pendingWriteFlushers.get(normalizedKey) === flusher) {
      pendingWriteState.pendingWriteFlushers.delete(normalizedKey);
    }
  };
}

export async function flushPendingWrites(reason = "manual", { strict = false } = {}) {
  if (pendingWriteState.activeFlushPromise) {
    return pendingWriteState.activeFlushPromise;
  }

  const flushers = Array.from(pendingWriteState.pendingWriteFlushers.values());
  pendingWriteState.activeFlushPromise = Promise.allSettled(
    flushers.map((flusher) => {
      try {
        return Promise.resolve(flusher({ reason }));
      } catch (error) {
        return Promise.reject(error);
      }
    })
  ).then((results) => {
    if (strict) {
      const failedResult = results.find((result) => result.status === "rejected");
      if (failedResult && failedResult.status === "rejected") {
        throw failedResult.reason instanceof Error
          ? failedResult.reason
          : new Error("Cordyceps could not finish saving local changes.");
      }
    }
  });

  try {
    await pendingWriteState.activeFlushPromise;
  } finally {
    pendingWriteState.activeFlushPromise = null;
  }
}

function requestPendingWriteFlush(reason) {
  void flushPendingWrites(reason).catch(() => {});
}

export function installPendingWriteFlushLifecycle() {
  if (pendingWriteState.lifecycleInstalled || typeof window === "undefined") {
    return;
  }

  pendingWriteState.lifecycleInstalled = true;
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        requestPendingWriteFlush("visibility-hidden");
      }
    });
  }
  window.addEventListener("pagehide", () => {
    requestPendingWriteFlush("pagehide");
  });
  window.addEventListener("beforeunload", () => {
    requestPendingWriteFlush("beforeunload");
  });
}
