export function loadStoredActivePage(storageKey, validPages, fallbackPage = "dashboard") {
  const storedPage = window.localStorage.getItem(storageKey);
  if (!storedPage) {
    return fallbackPage;
  }

  return validPages.has(storedPage) ? storedPage : fallbackPage;
}

export function applyActivePageChange({
  nextPage,
  topLevelPages,
  currentPage,
  hasAnimatedPageTransition,
  beforePageChange,
  applyPageStates,
  syncPageChrome,
  storageKey
}) {
  if (!topLevelPages.has(nextPage)) {
    return {
      activePage: currentPage,
      hasAnimatedPageTransition
    };
  }

  if (nextPage === currentPage) {
    syncPageChrome(currentPage);
    return {
      activePage: currentPage,
      hasAnimatedPageTransition
    };
  }

  beforePageChange?.(currentPage, nextPage);
  window.localStorage.setItem(storageKey, nextPage);
  applyPageStates(currentPage, nextPage, hasAnimatedPageTransition);
  syncPageChrome(nextPage);

  return {
    activePage: nextPage,
    hasAnimatedPageTransition: true
  };
}

export function applySettingsPanelChange({
  nextPanel,
  validPanels,
  currentPanel,
  activePage,
  syncSettingsPanelUi,
  syncPageChrome
}) {
  if (!validPanels.has(nextPanel)) {
    return currentPanel;
  }

  document.body.dataset.activeSettingsPanel = nextPanel;
  syncSettingsPanelUi(nextPanel);
  syncPageChrome(activePage);
  return nextPanel;
}

export function applyRssPanelChange({
  nextPanel,
  validPanels,
  currentPanel,
  activePage,
  syncRssPanelUi,
  syncPageChrome
}) {
  if (!validPanels.has(nextPanel)) {
    return currentPanel;
  }

  document.body.dataset.activeRssPanel = nextPanel;
  syncRssPanelUi(nextPanel);
  syncPageChrome(activePage);
  return nextPanel;
}
