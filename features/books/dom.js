export function queryBooksDom() {
  const page = document.querySelector("#books-page");
  return {
    page,
    pageTitle: document.querySelector("#books-page-title"),
    importButton: document.querySelector("#books-import-button"),
    fileInput: document.querySelector("#books-file-input"),
    libraryGroup: document.querySelector("#books-library-group"),
    libraryList: document.querySelector("#books-library-list"),
    emptyState: document.querySelector("#books-empty-state"),
    readerGroup: document.querySelector("#books-reader-group"),
    readerSurface: document.querySelector("#books-reader-surface"),
    readerEmptyState: document.querySelector("#books-reader-empty-state"),
    readerControls: document.querySelector("#books-reader-controls"),
    readerProgress: document.querySelector("#books-reader-progress"),
    backButton: document.querySelector("#books-library-back-button"),
    prevButton: document.querySelector("#books-prev-button"),
    nextButton: document.querySelector("#books-next-button")
  };
}
