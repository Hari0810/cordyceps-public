export function createBooksState(activeBookId) {
  return {
    books: [],
    activeBookId,
    dbPromise: null,
    initializePromise: null,
    activePdfDocument: null,
    activeEpubBook: null,
    activeEpubRendition: null,
    epubScriptPromise: null,
    pdfModulePromise: null,
    pdfViewerUrls: new Map(),
    view: "library"
  };
}
