import { renderMarkdownToHtml, queueMathTypeset } from "../shared/markdown.js";
import { buildNoteExcerpt } from "./storage.js";

export function syncNotesUi(dom, state, getActiveNote) {
  if (
    !dom.list ||
    !dom.titleInput ||
    !dom.bodyInput ||
    !dom.renderedView ||
    !dom.renderButton ||
    !dom.emptyState ||
    !dom.listView ||
    !dom.editorView
  ) {
    return;
  }

  const activeNote = getActiveNote();
  const encryptedMode = state.mode === "encrypted";
  const encryptedUnlocked = state.encryptedVault?.unlocked === true;
  const showEncryptedSetup = encryptedMode && !encryptedUnlocked;

  dom.list.innerHTML = "";
  dom.emptyState.hidden = state.entries.length > 0;
  dom.listView.hidden = showEncryptedSetup || state.view === "editor";
  dom.editorView.hidden = showEncryptedSetup || state.view !== "editor";
  if (dom.encryptedView) {
    dom.encryptedView.hidden = !encryptedMode;
  }

  if (dom.primaryButton) {
    dom.primaryButton.textContent = showEncryptedSetup
      ? "Unlock vault"
      : state.view === "editor"
        ? "Back to list"
        : "New note";
    dom.primaryButton.setAttribute(
      "aria-label",
      encryptedMode
        ? "Unlock encrypted notes vault"
        : state.view === "editor"
          ? "Back to notes list"
          : "Create a new note"
    );
  }

  if (dom.liteModeButton) {
    dom.liteModeButton.classList.toggle("is-active", state.mode === "lite");
    dom.liteModeButton.setAttribute("aria-selected", String(state.mode === "lite"));
  }

  if (dom.encryptedModeButton) {
    const encryptedAvailable = state.encryptedModeAvailable === true;
    dom.encryptedModeButton.classList.toggle("is-active", encryptedMode);
    dom.encryptedModeButton.setAttribute("aria-selected", String(encryptedMode));
    dom.encryptedModeButton.disabled = !encryptedAvailable;
    dom.encryptedModeButton.title = encryptedAvailable ? "" : "Encrypted notes are desktop-only";
  }

  if (dom.encryptedTitle) {
    dom.encryptedTitle.textContent = state.encryptedModeAvailable
      ? "Encrypted notes"
      : "Encrypted notes unavailable";
  }

  if (dom.encryptedCopy) {
    dom.encryptedCopy.textContent = state.encryptedModeAvailable
      ? "Desktop vault mode will store encrypted markdown notes in a local folder."
      : "Encrypted notes are disabled on the web build. Use Lite notes here.";
  }

  if (dom.encryptedPath) {
    dom.encryptedPath.textContent = state.encryptedVault?.folderPath
      ? `Folder: ${state.encryptedVault.folderPath}`
      : "No folder selected.";
  }

  if (dom.encryptedStatus) {
    dom.encryptedStatus.textContent = state.encryptedVault?.statusMessage || "Vault locked.";
  }

  if (dom.encryptedPassphrase) {
    dom.encryptedPassphrase.disabled = !state.encryptedModeAvailable;
    dom.encryptedPassphrase.hidden = !showEncryptedSetup;
  }

  if (dom.encryptedChoose) {
    dom.encryptedChoose.hidden = !showEncryptedSetup;
    dom.encryptedChoose.disabled = !state.encryptedModeAvailable;
  }

  if (dom.encryptedAction) {
    dom.encryptedAction.hidden = !showEncryptedSetup;
    dom.encryptedAction.disabled = !state.encryptedModeAvailable;
    dom.encryptedAction.textContent = state.encryptedModeAvailable ? "Unlock vault" : "Desktop only";
  }

  if (dom.encryptedLock) {
    dom.encryptedLock.hidden = !encryptedUnlocked;
    dom.encryptedLock.disabled = !encryptedUnlocked;
  }

  state.entries.forEach((note) => {
    const button = document.createElement("button");
    button.className = `note-list-item${note.id === activeNote?.id ? " is-active" : ""}`;
    button.type = "button";
    button.dataset.noteId = note.id;

    const title = document.createElement("span");
    title.className = "note-list-title";
    title.textContent = note.title?.trim() || "Untitled note";

    const excerpt = document.createElement("span");
    excerpt.className = "note-list-excerpt";
    excerpt.textContent = buildNoteExcerpt(note.body || "");

    button.append(title, excerpt);
    dom.list.append(button);
  });

  dom.titleInput.disabled = !activeNote;
  dom.bodyInput.disabled = !activeNote;
  dom.renderButton.hidden = encryptedMode || state.view !== "editor";
  dom.renderButton.textContent = state.rendered ? "Edit" : "Render";
  dom.renderButton.setAttribute(
    "aria-label",
    state.rendered ? "Return to editing mode" : "Render markdown note"
  );

  if (!activeNote) {
    dom.titleInput.value = "";
    dom.bodyInput.value = "";
    dom.bodyInput.hidden = false;
    dom.renderedView.hidden = true;
    dom.renderedView.innerHTML = "";
    return;
  }

  const shouldSyncTitleValue =
    document.activeElement !== dom.titleInput || dom.titleInput.dataset.noteId !== activeNote.id;
  if (shouldSyncTitleValue) {
    dom.titleInput.value = activeNote.title || "";
  }
  dom.titleInput.dataset.noteId = activeNote.id;

  const shouldSyncBodyValue =
    document.activeElement !== dom.bodyInput || dom.bodyInput.dataset.noteId !== activeNote.id;
  if (shouldSyncBodyValue) {
    dom.bodyInput.value = activeNote.body || "";
  }
  dom.bodyInput.dataset.noteId = activeNote.id;
  dom.bodyInput.hidden = state.rendered;
  dom.renderedView.hidden = !state.rendered;
  dom.renderedView.innerHTML = renderMarkdownToHtml(activeNote.body || "");
  queueMathTypeset(dom.renderedView, state.rendered);
}

export function bindNotesEvents(dom, handlers) {
  if (dom.primaryButton) {
    dom.primaryButton.addEventListener("click", handlers.handlePrimaryAction);
  }
  if (dom.liteModeButton) {
    dom.liteModeButton.addEventListener("click", handlers.handleLiteMode);
  }
  if (dom.encryptedModeButton) {
    dom.encryptedModeButton.addEventListener("click", handlers.handleEncryptedMode);
  }
  if (dom.list) {
    dom.list.addEventListener("click", handlers.handleListClick);
  }
  if (dom.renderButton) {
    dom.renderButton.addEventListener("click", handlers.handleRenderToggle);
  }
  if (dom.titleInput) {
    dom.titleInput.addEventListener("input", handlers.handleTitleInput);
  }
  if (dom.bodyInput) {
    dom.bodyInput.addEventListener("input", handlers.handleBodyInput);
  }
  if (dom.encryptedAction) {
    dom.encryptedAction.addEventListener("click", handlers.handleEncryptedAction);
  }
  if (dom.encryptedChoose) {
    dom.encryptedChoose.addEventListener("click", handlers.handleEncryptedChoose);
  }
  if (dom.encryptedLock) {
    dom.encryptedLock.addEventListener("click", handlers.handleEncryptedLock);
  }
}
