import {
  getScopedLocalStorageItem,
  removeScopedLocalStorageItem,
  scopeStorageKey,
  setScopedLocalStorageItem
} from "../../modules/storage-scope.js";

export function loadActiveBookId(storageKey) {
  const storedValue = getScopedLocalStorageItem(storageKey);
  return typeof storedValue === "string" && storedValue.trim() ? storedValue : null;
}

export function saveActiveBookId(storageKey, bookId) {
  if (bookId) {
    setScopedLocalStorageItem(storageKey, bookId);
    return;
  }

  removeScopedLocalStorageItem(storageKey);
}

export function inferBookFormat(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (normalizedValue.endsWith(".epub") || normalizedValue.includes("epub")) {
    return "epub";
  }

  return "pdf";
}

export function createBookTitleFromFileName(fileName) {
  const trimmed = String(fileName || "").trim();
  if (!trimmed) {
    return "Untitled book";
  }

  return trimmed.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled book";
}

export function clampBookProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(1, number));
}

export function formatBookProgress(value) {
  return `${Math.round(clampBookProgress(value) * 100)}% read`;
}

export function formatBookMeta(book) {
  const parts = [String(book.format || "pdf").toUpperCase()];
  const progressLabel = formatBookProgress(book.progress);
  if (progressLabel) {
    parts.push(progressLabel.replace(" read", ""));
  }
  return parts.join(" • ");
}

export function normalizeBookRecord(record, createUuid) {
  const payload = record && typeof record === "object" ? record : {};
  const fileName = typeof payload.fileName === "string" ? payload.fileName : "";
  const format = inferBookFormat(fileName || String(payload.format || ""));
  return {
    id: String(payload.id || createUuid()),
    title: typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : createBookTitleFromFileName(fileName),
    author: typeof payload.author === "string" ? payload.author.trim() : "",
    format,
    fileName,
    size: Number.isFinite(payload.size) ? Number(payload.size) : 0,
    importedAt: typeof payload.importedAt === "string" ? payload.importedAt : new Date().toISOString(),
    lastOpenedAt: typeof payload.lastOpenedAt === "string" ? payload.lastOpenedAt : null,
    progress: clampBookProgress(payload.progress),
    coverImage: typeof payload.coverImage === "string" ? payload.coverImage : "",
    readerState: payload.readerState && typeof payload.readerState === "object" ? payload.readerState : {},
    blob: payload.blob instanceof Blob ? payload.blob : null
  };
}

export function sortBooksLibrary(entries) {
  return [...entries].sort((left, right) => {
    const rightSortKey = right.lastOpenedAt || right.importedAt || "";
    const leftSortKey = left.lastOpenedAt || left.importedAt || "";
    return String(rightSortKey).localeCompare(String(leftSortKey));
  });
}

export function createBooksStorage({ state, dbName, dbVersion, storeName }) {
  function openBooksDb() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("IndexedDB unavailable"));
    }

    if (!state.dbPromise) {
      state.dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(scopeStorageKey(dbName), dbVersion);

        request.addEventListener("upgradeneeded", () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        });
        request.addEventListener("success", () => resolve(request.result));
        request.addEventListener("error", () => reject(request.error || new Error("Books DB unavailable")));
      });
    }

    return state.dbPromise;
  }

  async function getAllBooksFromDb() {
    const db = await openBooksDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.addEventListener("success", () => resolve(Array.isArray(request.result) ? request.result : []));
      request.addEventListener("error", () => reject(request.error || new Error("Books load failed")));
    });
  }

  async function putBookRecord(record) {
    const db = await openBooksDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(record);
      request.addEventListener("success", () => resolve());
      request.addEventListener("error", () => reject(request.error || new Error("Book save failed")));
    });
  }

  async function deleteBookRecord(bookId) {
    const db = await openBooksDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(bookId);
      request.addEventListener("success", () => resolve());
      request.addEventListener("error", () => reject(request.error || new Error("Book delete failed")));
    });
  }

  async function clearAllBookRecords() {
    const db = await openBooksDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.addEventListener("success", () => resolve());
      request.addEventListener("error", () => reject(request.error || new Error("Books clear failed")));
    });
  }

  return {
    getAllBooksFromDb,
    putBookRecord,
    deleteBookRecord,
    clearAllBookRecords
  };
}
