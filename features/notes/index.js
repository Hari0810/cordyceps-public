import { queryNotesDom } from "./dom.js";
import {
  createEmptyNote,
  loadNotesEntries,
  saveNotesEntries,
  sortNotesEntries
} from "./storage.js";
import { bindNotesEvents } from "./view.js";

export function createNotesFeature({
  storageKey,
  modeStorageKey,
  createUuid,
  loadStoredJson,
  saveStoredJson,
  setActivePage,
  onStateChange,
  encryptedModeAvailable = false,
  showToast,
  toastDurationMs = 5000
}) {
  const dom = queryNotesDom();
  const storedMode = loadStoredJson(modeStorageKey, "lite");
  const state = {
    liteEntries: loadNotesEntries(storageKey, loadStoredJson, createUuid),
    activeEntryId: null,
    mode: encryptedModeAvailable && storedMode === "encrypted" ? "encrypted" : "lite",
    encryptedModeAvailable,
    // Web vault: available=false routes React to WebEncryptedNotes component.
    // That component manages its own vault state independently.
    encryptedVault: {
      available: false,
      configured: false,
      unlocked: false,
      folderPath: "",
      noteCount: 0,
      statusMessage: ""
    },
    view: "list",
    rendered: false
  };

  syncSelection();

  function getCurrentEntries() {
    return state.mode === "encrypted" ? [] : state.liteEntries;
  }

  function emitChange(options = {}) {
    if (typeof onStateChange !== "function") {
      return;
    }
    onStateChange(getSnapshot(), options);
  }

  function saveLiteEntries(options = {}) {
    saveNotesEntries(storageKey, saveStoredJson, state.liteEntries);
    emitChange({ entriesChanged: true, ...options });
  }

  function persistMode() {
    saveStoredJson(modeStorageKey, state.mode);
  }

  function syncSelection() {
    if (state.mode === "encrypted") {
      state.activeEntryId = null;
      return;
    }
    if (!state.liteEntries.some((entry) => entry.id === state.activeEntryId)) {
      state.activeEntryId = state.liteEntries[0]?.id || null;
    }
  }

  function getActiveNote() {
    if (state.mode === "encrypted") return null;
    return state.liteEntries.find((entry) => entry.id === state.activeEntryId) || null;
  }

  function syncUi(options = {}) {
    emitChange(options);
  }

  function focusTitleInput() {
    window.requestAnimationFrame(() => {
      dom.titleInput?.focus();
    });
  }

  function updateNote(noteId, changes) {
    if (state.mode === "encrypted") return; // WebEncryptedNotes manages saves

    const updatedAt = new Date().toISOString();
    const nextEntries = state.liteEntries.map((note) =>
      note.id === noteId ? { ...note, ...changes, updatedAt } : note
    );
    state.liteEntries = sortNotesEntries(nextEntries);
    syncSelection();
    saveLiteEntries({ entriesChanged: true });
  }

  async function createNote() {
    if (state.mode === "encrypted") return; // WebEncryptedNotes manages note creation

    const note = createEmptyNote(createUuid);
    state.liteEntries = [note, ...state.liteEntries];
    state.activeEntryId = note.id;
    state.view = "editor";
    state.rendered = false;
    saveLiteEntries({ entriesChanged: true });
    syncUi({ entriesChanged: true });
    setActivePage("notes");
    focusTitleInput();
  }

  function openOrCreateNote({ title = "", body = "" } = {}) {
    if (state.mode === "encrypted") return null;

    const normalizedTitle = String(title || "");
    const existing = state.liteEntries.find((entry) => entry.title.trim() === normalizedTitle.trim());
    if (existing) {
      openNote(existing.id);
      return existing;
    }

    const note = {
      id: createUuid(),
      title: normalizedTitle,
      body: String(body || ""),
      updatedAt: new Date().toISOString()
    };
    state.liteEntries = [note, ...state.liteEntries];
    state.activeEntryId = note.id;
    state.view = "editor";
    state.rendered = false;
    saveLiteEntries({ entriesChanged: true });
    syncUi({ entriesChanged: true });
    setActivePage("notes");
    window.requestAnimationFrame(() => {
      dom.bodyInput?.focus();
    });
    return note;
  }

  function openNote(noteId) {
    if (!noteId || noteId === state.activeEntryId) {
      state.view = "editor";
      state.rendered = false;
      syncUi();
      focusTitleInput();
      return;
    }

    state.activeEntryId = noteId;
    state.view = "editor";
    state.rendered = false;
    syncUi();
    focusTitleInput();
  }

  async function handlePrimaryAction() {
    if (state.mode === "encrypted") return; // WebEncryptedNotes manages its own actions

    if (state.view === "editor") {
      resetView();
      return;
    }

    await createNote();
  }

  function handleListClick(event) {
    const button = event.target instanceof Element ? event.target.closest("[data-note-id]") : null;
    if (!(button instanceof HTMLElement)) {
      return;
    }
    openNote(button.dataset.noteId || "");
  }

  function handleRenderToggle() {
    if (state.view !== "editor") return;
    state.rendered = !state.rendered;
    syncUi();
  }

  function handleTitleInput() {
    const activeNote = getActiveNote();
    if (!activeNote || !dom.titleInput) return;
    updateNote(activeNote.id, { title: dom.titleInput.value });
  }

  function handleBodyInput() {
    const activeNote = getActiveNote();
    if (!activeNote || !dom.bodyInput) return;
    updateNote(activeNote.id, { body: dom.bodyInput.value });
  }

  function bindEvents() {
    bindNotesEvents(dom, {
      handlePrimaryAction,
      handleLiteMode: () => {
        state.mode = "lite";
        state.view = "list";
        state.rendered = false;
        persistMode();
        syncSelection();
        syncUi();
      },
      handleEncryptedMode: () => {
        if (!encryptedModeAvailable) return;
        state.mode = "encrypted";
        state.view = "list";
        state.rendered = false;
        state.activeEntryId = null;
        persistMode();
        syncUi();
      },
      handleListClick,
      handleRenderToggle,
      handleTitleInput,
      handleBodyInput,
      handleEncryptedAction: () => {},
      handleEncryptedChoose: () => {},
      handleEncryptedLock: () => {}
    });
  }

  function resetView() {
    state.view = "list";
    state.rendered = false;
    syncUi();
  }

  function getViewportInputs() {
    return [dom.titleInput, dom.bodyInput].filter(Boolean);
  }

  function getSnapshot() {
    const entries = getCurrentEntries();
    const activeEntry = getActiveNote();
    return {
      entries,
      activeEntryId: state.activeEntryId,
      activeEntry,
      mode: state.mode,
      view: state.view,
      rendered: state.rendered,
      encryptedModeAvailable: state.encryptedModeAvailable,
      encryptedVault: { ...state.encryptedVault }
    };
  }

  function getBackupSnapshot() {
    return {
      mode: state.mode,
      activeEntryId: state.mode === "lite" ? state.activeEntryId : null,
      liteEntries: state.liteEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        body: entry.body,
        updatedAt: entry.updatedAt
      })),
      encryptedVault: {
        available: false,
        configured: false,
        noteCount: 0,
        statusMessage: ""
      }
    };
  }

  function normalizeBackupNoteEntries(entries) {
    return sortNotesEntries(
      Array.isArray(entries)
        ? entries
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => ({
            id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : createUuid(),
            title: typeof entry.title === "string" ? entry.title : "",
            body: typeof entry.body === "string" ? entry.body : "",
            updatedAt:
              typeof entry.updatedAt === "string" && entry.updatedAt.trim()
                ? entry.updatedAt
                : new Date().toISOString()
          }))
        : []
    );
  }

  function restoreBackupSnapshot(snapshot) {
    const payload = snapshot && typeof snapshot === "object" ? snapshot : {};
    state.liteEntries = normalizeBackupNoteEntries(payload.liteEntries);
    state.mode = encryptedModeAvailable && payload.mode === "encrypted" ? "encrypted" : "lite";
    persistMode();
    saveLiteEntries();
    state.view = "list";
    state.rendered = false;
    state.activeEntryId = state.mode === "lite"
      ? (state.liteEntries.some((e) => e.id === payload.activeEntryId) ? payload.activeEntryId : state.liteEntries[0]?.id || null)
      : null;
    syncUi({ entriesChanged: true });
  }

  syncUi();
  emitChange();

  return {
    bindEvents,
    getBackupSnapshot,
    getSnapshot,
    getViewportInputs,
    openOrCreateNote,
    resetView,
    restoreBackupSnapshot,
    syncUi
  };
}
