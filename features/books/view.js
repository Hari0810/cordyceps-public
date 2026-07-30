import { formatBookMeta, formatBookProgress } from "./storage.js";

export function syncBooksUi(dom, state) {
  const activeBook = state.books.find((entry) => entry.id === state.activeBookId) || null;
  const showReader = state.view === "reader" && Boolean(activeBook);

  if (dom.page) {
    dom.page.dataset.booksView = showReader ? "reader" : "library";
  }

  if (dom.pageTitle) {
    dom.pageTitle.textContent = showReader && activeBook ? activeBook.title : "Books";
  }

  if (dom.libraryList) {
    dom.libraryList.innerHTML = "";
    state.books.forEach((book) => {
      const title = document.createElement("span");
      title.className = "books-book-title";
      title.textContent = book.title;

      const meta = document.createElement("span");
      meta.className = "books-book-meta";
      meta.textContent = formatBookMeta(book);

      const copy = document.createElement("span");
      copy.className = "books-book-copy";
      copy.append(title, meta);

      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "books-book-button";
      if (book.id === state.activeBookId) {
        openButton.classList.add("is-active");
      }
      openButton.dataset.bookOpen = book.id;
      openButton.append(copy);

      const renameButton = document.createElement("button");
      renameButton.type = "button";
      renameButton.className = "books-item-action";
      renameButton.dataset.bookRename = book.id;
      renameButton.textContent = "Rename";

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "books-item-action books-item-action-danger";
      removeButton.dataset.bookRemove = book.id;
      removeButton.textContent = "Remove";

      const actions = document.createElement("span");
      actions.className = "books-item-actions";
      actions.append(renameButton, removeButton);

      const item = document.createElement("div");
      item.className = "books-library-row";
      item.append(openButton, actions);
      dom.libraryList.append(item);
    });
  }

  if (dom.emptyState) {
    dom.emptyState.hidden = state.books.length > 0;
  }

  if (dom.importButton) {
    dom.importButton.hidden = showReader;
  }

  if (dom.libraryGroup) {
    dom.libraryGroup.hidden = showReader;
  }

  if (dom.readerGroup) {
    dom.readerGroup.hidden = !showReader;
  }

  if (dom.readerEmptyState) {
    dom.readerEmptyState.hidden = showReader;
  }

  if (dom.readerSurface) {
    dom.readerSurface.hidden = !showReader;
  }

  if (dom.readerControls) {
    dom.readerControls.hidden = !showReader;
  }

  if (dom.readerProgress) {
    dom.readerProgress.textContent = showReader && activeBook ? formatBookProgress(activeBook.progress) : "0% read";
  }

  if (dom.backButton) {
    dom.backButton.disabled = !showReader || !activeBook;
  }

  if (dom.prevButton) {
    dom.prevButton.disabled = !showReader || !activeBook;
  }

  if (dom.nextButton) {
    dom.nextButton.disabled = !showReader || !activeBook;
  }
}

export function bindBooksEvents(dom, handlers) {
  if (dom.importButton) {
    dom.importButton.addEventListener("click", () => {
      dom.fileInput?.click();
    });
  }

  if (dom.fileInput) {
    dom.fileInput.addEventListener("change", () => {
      void handlers.handleFileSelection();
    });
  }

  if (dom.page) {
    dom.page.addEventListener("click", (event) => {
      const renameTarget = event.target instanceof Element ? event.target.closest("[data-book-rename]") : null;
      if (renameTarget instanceof HTMLElement) {
        handlers.renameBook(renameTarget.dataset.bookRename || "");
        return;
      }

      const removeTarget = event.target instanceof Element ? event.target.closest("[data-book-remove]") : null;
      if (removeTarget instanceof HTMLElement) {
        void handlers.removeBook(removeTarget.dataset.bookRemove || "");
        return;
      }

      const target = event.target instanceof Element ? event.target.closest("[data-book-open]") : null;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      void handlers.openBook(target.dataset.bookOpen || "");
    });
  }

  if (dom.backButton) {
    dom.backButton.addEventListener("click", () => {
      handlers.showLibrary();
    });
  }

  if (dom.prevButton) {
    dom.prevButton.addEventListener("click", () => {
      void handlers.stepActiveBook(-1);
    });
  }

  if (dom.nextButton) {
    dom.nextButton.addEventListener("click", () => {
      void handlers.stepActiveBook(1);
    });
  }
}
