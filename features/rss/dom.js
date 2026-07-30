export function queryRssDom() {
  return {
    feedUrlInput: document.querySelector("#rss-feed-url-input"),
    saveButton: document.querySelector("#save-rss-feed-button"),
    refreshButton: document.querySelector("#refresh-rss-feed-button"),
    panelLinks: document.querySelectorAll("[data-rss-panel-link]"),
    panelBackButtons: document.querySelectorAll("[data-rss-panel-back]"),
    viewSwitcher: document.querySelector("#rss-view-switcher"),
    sourcesList: document.querySelector("#rss-sources-list"),
    statusValue: document.querySelector("#rss-status-value"),
    updatedValue: document.querySelector("#rss-updated-value"),
    feedTitle: document.querySelector("#rss-feed-title"),
    feedDescription: document.querySelector("#rss-feed-description"),
    sourcesEmptyState: document.querySelector("#rss-sources-empty-state"),
    emptyState: document.querySelector("#rss-empty-state")
  };
}
