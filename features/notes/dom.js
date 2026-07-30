export function queryNotesDom() {
  return {
    primaryButton: document.querySelector("#create-note-button"),
    liteModeButton: document.querySelector("#notes-mode-lite"),
    encryptedModeButton: document.querySelector("#notes-mode-encrypted"),
    list: document.querySelector("#notes-list"),
    listView: document.querySelector("#notes-list-view"),
    editorView: document.querySelector("#notes-editor-view"),
    encryptedView: document.querySelector("#notes-encrypted-view"),
    encryptedTitle: document.querySelector("#notes-encrypted-title"),
    encryptedCopy: document.querySelector("#notes-encrypted-copy"),
    encryptedPath: document.querySelector("#notes-encrypted-path"),
    encryptedStatus: document.querySelector("#notes-encrypted-status"),
    encryptedPassphrase: document.querySelector("#notes-encrypted-passphrase"),
    encryptedChoose: document.querySelector("#notes-encrypted-choose"),
    encryptedAction: document.querySelector("#notes-encrypted-action"),
    encryptedLock: document.querySelector("#notes-encrypted-lock"),
    emptyState: document.querySelector("#notes-empty-state"),
    renderButton: document.querySelector("#note-render-button"),
    titleInput: document.querySelector("#note-title-input"),
    bodyInput: document.querySelector("#note-body-input"),
    renderedView: document.querySelector("#note-rendered-view")
  };
}
