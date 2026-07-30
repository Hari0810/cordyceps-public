export function loadNotesEntries(storageKey, loadStoredJson, createUuid) {
  const storedEntries = loadStoredJson(storageKey, []);
  if (!Array.isArray(storedEntries)) {
    return [];
  }

  return storedEntries
    .map((entry) => ({
      id: String(entry?.id || createUuid()),
      title: String(entry?.title || ""),
      body: String(entry?.body || ""),
      updatedAt: typeof entry?.updatedAt === "string" ? entry.updatedAt : new Date().toISOString()
    }))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

export function saveNotesEntries(storageKey, saveStoredJson, entries) {
  saveStoredJson(storageKey, entries);
}

export function createEmptyNote(createUuid) {
  return {
    id: createUuid(),
    title: "",
    body: "",
    updatedAt: new Date().toISOString()
  };
}

export function sortNotesEntries(entries) {
  return [...entries].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

export function buildNoteExcerpt(body) {
  return String(body || "").trim().replace(/\s+/g, " ").slice(0, 120) || "No content yet";
}
