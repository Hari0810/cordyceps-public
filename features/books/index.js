import { queryBooksDom } from "./dom.js";
import { createBooksState } from "./state.js";
import {
  createBookTitleFromFileName,
  createBooksStorage,
  inferBookFormat,
  loadActiveBookId,
  normalizeBookRecord,
  saveActiveBookId,
  sortBooksLibrary
} from "./storage.js";
import { bindBooksEvents } from "./view.js";

const EPUB_SCRIPT_URL = new URL("../../vendor/epubjs/epub.min.js", import.meta.url).toString();
const PDFJS_MODULE_URL = new URL("../../vendor/pdfjs/pdf.min.mjs", import.meta.url).toString();
const PDFJS_WORKER_URL = new URL("../../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).toString();

function prefersNativeIosPdfViewer() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isAppleMobileDevice = /iPad|iPhone|iPod/.test(userAgent)
    || (platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return isAppleMobileDevice;
}

export function createBooksFeature({
  storageKey,
  dbName,
  dbVersion,
  storeName,
  createUuid,
  toast,
  toastDurationMs,
  setActivePage,
  onStateChange
}) {
  const dom = queryBooksDom();
  const state = createBooksState(loadActiveBookId(storageKey));
  const storage = createBooksStorage({ state, dbName, dbVersion, storeName });

  function emitChange(options = {}) {
    if (typeof onStateChange !== "function") {
      return;
    }

    onStateChange(getSnapshot(), options);
  }

  function syncUi(options = {}) {
    emitChange(options);
  }

  async function generatePdfCoverImage(book) {
    if (!book?.blob) {
      return "";
    }

    let loadingTask = null;
    let pdfDocument = null;
    try {
      const pdfjs = await ensurePdfModule();
      const data = new Uint8Array(await book.blob.arrayBuffer());
      loadingTask = pdfjs.getDocument({ data });
      pdfDocument = await loadingTask.promise;
      const firstPage = await pdfDocument.getPage(1);
      const baseViewport = firstPage.getViewport({ scale: 1 });
      const scale = 360 / Math.max(baseViewport.width, 1);
      const viewport = firstPage.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        return "";
      }

      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await firstPage.render({ canvasContext: context, viewport }).promise;
      const coverImage = canvas.toDataURL("image/jpeg", 0.86);
      return coverImage;
    } catch (error) {
      console.warn("Unable to generate PDF cover image.", error);
      return "";
    } finally {
      await pdfDocument?.destroy?.();
      loadingTask?.destroy?.();
    }
  }

  async function ensureBookCoverImage(book) {
    if (!book || book.format !== "pdf" || book.coverImage) {
      return;
    }

    const coverImage = await generatePdfCoverImage(book);
    if (!coverImage) {
      return;
    }

    await persistBookPatch(book.id, {
      coverImage
    });
  }

  async function hydrateMissingBookCovers() {
    const pdfBooksMissingCovers = state.books.filter((book) => book.format === "pdf" && !book.coverImage);
    for (const book of pdfBooksMissingCovers) {
      await ensureBookCoverImage(book);
    }
  }

  async function initialize() {
    if (state.initializePromise) {
      return state.initializePromise;
    }

    state.initializePromise = (async () => {
      try {
        const records = await storage.getAllBooksFromDb();
        state.books = sortBooksLibrary(records.map((record) => normalizeBookRecord(record, createUuid)).filter((book) => book.blob));
        if (state.activeBookId && state.books.some((book) => book.id === state.activeBookId)) {
          syncUi();
          return;
        }

        if (state.activeBookId) {
          state.activeBookId = "";
          saveActiveBookId(storageKey, "");
        }

        syncUi();
        void hydrateMissingBookCovers();
      } catch (error) {
        console.error(error);
        syncUi();
      }
    })();

    return state.initializePromise;
  }

  async function handleFileSelection() {
    const files = Array.from(dom.fileInput?.files || []);
    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      await importBookFile(file);
    }

    if (dom.fileInput) {
      dom.fileInput.value = "";
    }
  }

  async function importBookFile(file) {
    const format = inferBookFormat(file.name || file.type || "");
    if (!["pdf", "epub"].includes(format)) {
      toast("Unsupported book", "Import a PDF or EPUB file.", toastDurationMs);
      return;
    }

    const now = new Date().toISOString();
    const record = normalizeBookRecord({
      id: createUuid(),
      title: createBookTitleFromFileName(file.name),
      author: "",
      format,
      fileName: file.name,
      size: file.size,
      importedAt: now,
      lastOpenedAt: now,
      progress: 0,
      readerState: format === "pdf" ? { page: 1, totalPages: 0 } : {},
      blob: new Blob([await file.arrayBuffer()], { type: file.type || (format === "pdf" ? "application/pdf" : "application/epub+zip") })
    }, createUuid);

    await storage.putBookRecord(record);
    state.books = sortBooksLibrary([record, ...state.books.filter((entry) => entry.id !== record.id)]);
    state.activeBookId = record.id;
    saveActiveBookId(storageKey, state.activeBookId);
    setActivePage("books");
    if (record.format === "pdf") {
      void ensureBookCoverImage(record);
    }
    await openBook(record.id, { preservePage: false });
  }

  function openPdfInNativeViewer(book) {
    if (!book?.blob || typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }

    const previousUrl = state.pdfViewerUrls.get(book.id);
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    const url = URL.createObjectURL(book.blob);
    state.pdfViewerUrls.set(book.id, url);

    const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (openedWindow) {
      return true;
    }

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.append(link);
    link.click();
    link.remove();
    return true;
  }

  async function openBook(bookId, { preservePage = true } = {}) {
    const book = state.books.find((entry) => entry.id === bookId);
    if (!book || !book.blob || !dom.readerSurface) {
      return;
    }

    if (book.format === "pdf" && prefersNativeIosPdfViewer()) {
      state.activeBookId = book.id;
      saveActiveBookId(storageKey, state.activeBookId);
      state.view = "library";
      syncUi();
      if (openPdfInNativeViewer(book)) {
        void persistBookPatch(book.id, {
          lastOpenedAt: new Date().toISOString()
        });
        toast("Opened in viewer", "PDFs open in the native iPhone/iPad viewer.", toastDurationMs);
      }
      return;
    }

    await releaseActiveBook();
    state.activeBookId = book.id;
    saveActiveBookId(storageKey, state.activeBookId);
    state.view = "reader";
    syncUi();

    if (book.format === "epub") {
      await renderEpubBook(book, { preservePage });
    } else {
      await renderPdfBook(book, { preservePage });
    }
  }

  async function releaseActiveBook() {
    if (state.activeEpubRendition?.destroy) {
      state.activeEpubRendition.destroy();
    }
    if (state.activeEpubBook?.destroy) {
      state.activeEpubBook.destroy();
    }

    state.activePdfDocument = null;
    state.activeEpubRendition = null;
    state.activeEpubBook = null;
    if (dom.readerSurface) {
      dom.readerSurface.innerHTML = "";
    }
  }

  async function ensurePdfModule() {
    if (!state.pdfModulePromise) {
      state.pdfModulePromise = import(/* @vite-ignore */ PDFJS_MODULE_URL).then((module) => {
        module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return module;
      });
    }

    return state.pdfModulePromise;
  }

  async function ensureEpubRuntime() {
    if (typeof window.ePub === "function") {
      return window.ePub;
    }

    if (!state.epubScriptPromise) {
      state.epubScriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-epub-loader="dynamic"]');
        if (existingScript instanceof HTMLScriptElement) {
          if (typeof window.ePub === "function") {
            resolve(window.ePub);
            return;
          }

          existingScript.addEventListener("load", () => resolve(window.ePub), { once: true });
          existingScript.addEventListener("error", () => reject(new Error("EPUB support failed to load.")), { once: true });
          return;
        }

        const script = document.createElement("script");
        script.src = EPUB_SCRIPT_URL;
        script.async = true;
        script.dataset.epubLoader = "dynamic";
        script.addEventListener("load", () => {
          if (typeof window.ePub === "function") {
            resolve(window.ePub);
            return;
          }

          reject(new Error("EPUB support did not initialize."));
        }, { once: true });
        script.addEventListener("error", () => reject(new Error("EPUB support failed to load.")), { once: true });
        document.head.append(script);
      }).catch((error) => {
        state.epubScriptPromise = null;
        throw error;
      });
    }

    return state.epubScriptPromise;
  }

  async function renderPdfBook(book, { preservePage } = {}) {
    const pdfjs = await ensurePdfModule();
    const data = new Uint8Array(await book.blob.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data });
    state.activePdfDocument = await loadingTask.promise;
    const currentPage = preservePage
      ? Math.max(1, Math.min(state.activePdfDocument.numPages, Number(book.readerState?.page) || 1))
      : 1;
    await renderPdfPage(currentPage);
    await persistBookPatch(book.id, {
      lastOpenedAt: new Date().toISOString(),
      readerState: {
        ...(book.readerState || {}),
        page: currentPage,
        totalPages: state.activePdfDocument.numPages
      },
      progress: state.activePdfDocument.numPages > 1 ? (currentPage - 1) / (state.activePdfDocument.numPages - 1) : 1
    });
  }

  async function renderPdfPage(pageNumber) {
    if (!state.activePdfDocument || !dom.readerSurface) {
      return;
    }

    const page = await state.activePdfDocument.getPage(pageNumber);
    const surfaceWidth = Math.max(dom.readerSurface.clientWidth - 8, 280);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = surfaceWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = "books-reader-frame";
    if (!context) {
      return;
    }

    await page.render({ canvasContext: context, viewport }).promise;
    dom.readerSurface.innerHTML = "";
    dom.readerSurface.append(canvas);

    const activeBook = state.books.find((entry) => entry.id === state.activeBookId);
    if (!activeBook) {
      return;
    }

    const totalPages = state.activePdfDocument.numPages;
    const progress = totalPages > 1 ? (pageNumber - 1) / (totalPages - 1) : 1;
    await persistBookPatch(activeBook.id, {
      lastOpenedAt: new Date().toISOString(),
      progress,
      readerState: {
        ...(activeBook.readerState || {}),
        page: pageNumber,
        totalPages
      }
    });
  }

  async function renderEpubBook(book, { preservePage } = {}) {
    try {
      await ensureEpubRuntime();
    } catch {
      toast("Reader unavailable", "EPUB support did not finish loading.", toastDurationMs);
      return;
    }

    if (!dom.readerSurface) {
      return;
    }

    const container = document.createElement("div");
    container.className = "books-reader-epub";
    dom.readerSurface.innerHTML = "";
    dom.readerSurface.append(container);

    state.activeEpubBook = window.ePub(book.blob);
    state.activeEpubRendition = state.activeEpubBook.renderTo(container, {
      width: "100%",
      height: "420px",
      spread: "none"
    });

    const metadata = await state.activeEpubBook.loaded.metadata.catch(() => null);
    if (metadata && (metadata.title || metadata.creator)) {
      await persistBookPatch(book.id, {
        title: metadata.title || book.title,
        author: metadata.creator || book.author
      });
    }

    await state.activeEpubBook.ready;
    await state.activeEpubBook.locations.generate(1600).catch(() => null);
    state.activeEpubRendition.on("relocated", (location) => {
      const percentage = state.activeEpubBook?.locations?.percentageFromCfi?.(location?.start?.cfi || "") || 0;
      void persistBookPatch(book.id, {
        lastOpenedAt: new Date().toISOString(),
        progress: percentage,
        readerState: {
          ...(state.books.find((entry) => entry.id === book.id)?.readerState || {}),
          location: location?.start?.cfi || null
        }
      });
    });

    const location = preservePage ? book.readerState?.location : null;
    await state.activeEpubRendition.display(location || undefined);
    await persistBookPatch(book.id, {
      lastOpenedAt: new Date().toISOString()
    });
  }

  async function stepActiveBook(direction) {
    const activeBook = state.books.find((entry) => entry.id === state.activeBookId);
    if (!activeBook) {
      return;
    }

    if (activeBook.format === "epub") {
      if (!state.activeEpubRendition) {
        return;
      }

      await (direction < 0 ? state.activeEpubRendition.prev() : state.activeEpubRendition.next());
      return;
    }

    if (!state.activePdfDocument) {
      return;
    }

    const currentPage = Number(activeBook.readerState?.page) || 1;
    const nextPage = Math.max(1, Math.min(state.activePdfDocument.numPages, currentPage + direction));
    if (nextPage === currentPage) {
      return;
    }

    await renderPdfPage(nextPage);
  }

  async function persistBookPatch(bookId, changes) {
    const index = state.books.findIndex((entry) => entry.id === bookId);
    if (index === -1) {
      return;
    }

    const nextRecord = normalizeBookRecord({
      ...state.books[index],
      ...changes,
      readerState: {
        ...(state.books[index].readerState || {}),
        ...(changes.readerState || {})
      }
    }, createUuid);
    state.books = sortBooksLibrary([
      nextRecord,
      ...state.books.filter((entry) => entry.id !== bookId)
    ]);
    syncUi();
    await storage.putBookRecord(nextRecord);
  }

  function renameBook(bookId) {
    const book = state.books.find((entry) => entry.id === bookId);
    if (!book) {
      return;
    }

    const nextTitle = window.prompt("Rename book", book.title || "Untitled book");
    if (typeof nextTitle !== "string") {
      return;
    }

    const trimmedTitle = nextTitle.trim();
    if (!trimmedTitle || trimmedTitle === book.title) {
      return;
    }

    void persistBookPatch(book.id, {
      title: trimmedTitle
    });
  }

  async function removeBook(bookId) {
    const book = state.books.find((entry) => entry.id === bookId);
    if (!book) {
      return;
    }

    const confirmed = window.confirm(`Remove "${book.title || "Untitled book"}" from your library?`);
    if (!confirmed) {
      return;
    }

    if (state.pdfViewerUrls.has(book.id)) {
      URL.revokeObjectURL(state.pdfViewerUrls.get(book.id));
      state.pdfViewerUrls.delete(book.id);
    }

    if (state.activeBookId === book.id) {
      await releaseActiveBook();
      state.view = "library";
      state.activeBookId = "";
      saveActiveBookId(storageKey, "");
    }

    state.books = state.books.filter((entry) => entry.id !== book.id);
    syncUi();
    await storage.deleteBookRecord(book.id);
  }

  function getBackupSnapshot() {
    return {
      activeBookId: state.activeBookId || "",
      books: state.books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        format: book.format,
        fileName: book.fileName,
        size: book.size,
        importedAt: book.importedAt,
        lastOpenedAt: book.lastOpenedAt,
        progress: book.progress,
        coverImage: book.coverImage || "",
        readerState: book.readerState && typeof book.readerState === "object"
          ? { ...book.readerState }
          : {},
        blob: book.blob instanceof Blob ? book.blob : null
      }))
    };
  }

  async function clearLibrary() {
    state.pdfViewerUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    state.pdfViewerUrls.clear();
    await releaseActiveBook();
    state.books = [];
    state.activeBookId = "";
    state.view = "library";
    saveActiveBookId(storageKey, "");
    syncUi();
    await storage.clearAllBookRecords();
  }

  async function restoreBackupSnapshot(snapshot) {
    const payload = snapshot && typeof snapshot === "object" ? snapshot : {};
    const records = Array.isArray(payload.books)
      ? payload.books
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => normalizeBookRecord(entry, createUuid))
        .filter((entry) => entry.blob instanceof Blob)
      : [];

    await clearLibrary();

    for (const record of records) {
      await storage.putBookRecord(record);
    }

    state.books = sortBooksLibrary(records);
    state.activeBookId =
      typeof payload.activeBookId === "string" && state.books.some((book) => book.id === payload.activeBookId)
        ? payload.activeBookId
        : "";
    state.view = "library";
    saveActiveBookId(storageKey, state.activeBookId);
    syncUi();
    void hydrateMissingBookCovers();
  }

  function bindEvents() {
    bindBooksEvents(dom, {
      handleFileSelection,
      openBook,
      renameBook,
      removeBook,
      showLibrary,
      stepActiveBook
    });
  }

  function showLibrary() {
    state.view = "library";
    syncUi();
  }

  function isReaderOpen() {
    return state.view === "reader" && state.books.some((entry) => entry.id === state.activeBookId);
  }

  function getDesktopSnapshot() {
    const activeBook = state.books.find((entry) => entry.id === state.activeBookId) || state.books[0] || null;
    return {
      view: state.view,
      books: state.books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        format: book.format,
        progress: book.progress,
        importedAt: book.importedAt,
        lastOpenedAt: book.lastOpenedAt,
        coverImage: book.coverImage || ""
      })),
      activeBook: activeBook
        ? {
            id: activeBook.id,
            title: activeBook.title,
            author: activeBook.author,
            format: activeBook.format,
            progress: activeBook.progress,
            importedAt: activeBook.importedAt,
            lastOpenedAt: activeBook.lastOpenedAt,
            coverImage: activeBook.coverImage || ""
          }
        : null
    };
  }

  function getSnapshot() {
    const activeBook = state.books.find((entry) => entry.id === state.activeBookId) || null;
    return {
      view: state.view,
      activeBookId: state.activeBookId || "",
      activeBook: activeBook
        ? {
            id: activeBook.id,
            title: activeBook.title,
            author: activeBook.author,
            format: activeBook.format,
            importedAt: activeBook.importedAt,
            lastOpenedAt: activeBook.lastOpenedAt,
            progress: activeBook.progress,
            coverImage: activeBook.coverImage || ""
          }
        : null,
      books: state.books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        format: book.format,
        importedAt: book.importedAt,
        lastOpenedAt: book.lastOpenedAt,
        progress: book.progress,
        coverImage: book.coverImage || ""
      }))
    };
  }

  return {
    bindEvents,
    clearLibrary,
    getDesktopSnapshot,
    getBackupSnapshot,
    getSnapshot,
    initialize,
    isReaderOpen,
    restoreBackupSnapshot,
    showLibrary,
    syncUi
  };
}
