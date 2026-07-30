import { queryRssDom } from "./dom.js";

export function createRssFeature({
  storageKey,
  defaultFeedUrls,
  createUuid,
  loadStoredJson,
  saveStoredJson,
  showToast,
  toastDurationMs,
  apiFetch,
  ApiError,
  syncUi,
  syncNewsNotificationSettings,
  setActiveRssPanel
}) {
  const dom = queryRssDom();
  const initialState = loadRssFeedsState();
  const state = {
    feeds: initialState.feeds,
    activeFeedId: initialState.activeFeedId,
    isRefreshing: false
  };
  const RSS_REFRESH_REQUEST_EVENT = "city-app:rss-refresh-request";
  const RSS_REFRESH_COMPLETE_EVENT = "city-app:rss-refresh-complete";

  function loadRssFeedsState() {
    const storedValue = loadStoredJson(storageKey, null);
    const hasStoredFeedCollection =
      storedValue && typeof storedValue === "object" && Array.isArray(storedValue.feeds);
    const legacyFeed =
      hasStoredFeedCollection
        ? null
        : normalizeRssFeed(storedValue);
    const feeds = hasStoredFeedCollection
      ? storedValue.feeds.map(normalizeRssFeed).filter((feed) => feed.url)
      : legacyFeed && legacyFeed.url
        ? [legacyFeed]
        : defaultFeedUrls.map((url) => normalizeRssFeed({
            url,
            status: "Default feed source"
          }));
    const activeFeedId = storedValue && typeof storedValue === "object" && typeof storedValue.activeFeedId === "string"
      ? storedValue.activeFeedId
      : "all";
    const dedupedFeeds = dedupeRssFeeds(feeds);
    const normalizedActiveFeedId =
      activeFeedId === "all" || dedupedFeeds.some((feed) => feed.id === activeFeedId)
        ? activeFeedId
        : "all";

    if (
      hasStoredFeedCollection &&
      dedupedFeeds.length !== feeds.length
    ) {
      saveStoredJson(storageKey, {
        feeds: dedupedFeeds,
        activeFeedId: normalizedActiveFeedId
      });
    }

    return {
      feeds: dedupedFeeds,
      activeFeedId: normalizedActiveFeedId
    };
  }

  function normalizeRssFeed(feed) {
    const payload = feed && typeof feed === "object" ? feed : {};
    return {
      id: typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : createUuid(),
      url: typeof payload.url === "string" && payload.url.trim() ? payload.url.trim() : "",
      title: typeof payload.title === "string" ? payload.title.trim() : "",
      description: typeof payload.description === "string" ? payload.description.trim() : "",
      status: typeof payload.status === "string" ? payload.status.trim() : "",
      refreshedAt: typeof payload.refreshedAt === "string" ? payload.refreshedAt : null,
      siteUrl: typeof payload.siteUrl === "string" ? payload.siteUrl.trim() : "",
      items: Array.isArray(payload.items)
        ? payload.items
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              title: typeof item.title === "string" ? item.title.trim() : "",
              url: typeof item.url === "string" ? item.url.trim() : "",
              summary: typeof item.summary === "string" ? item.summary.trim() : "",
              publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : "",
              sourceName: typeof item.sourceName === "string" ? item.sourceName.trim() : "",
              commentsUrl: typeof item.commentsUrl === "string" ? item.commentsUrl.trim() : ""
            }))
            .slice(0, 25)
        : []
    };
  }

  function dedupeRssFeeds(feeds) {
    const seen = new Set();
    return feeds.filter((feed) => {
      const key = String(feed.url || "").trim().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function saveState() {
    saveStoredJson(storageKey, {
      feeds: state.feeds,
      activeFeedId: state.activeFeedId
    });
    if (typeof syncNewsNotificationSettings === "function") {
      void syncNewsNotificationSettings(getSnapshot());
    }
  }

  function setActiveFeed(nextFeedId) {
    if (nextFeedId !== "all" && !state.feeds.some((feed) => feed.id === nextFeedId)) {
      return;
    }

    state.activeFeedId = nextFeedId || "all";
    saveState();
    syncFeatureUi();
  }

  function addFeedSource() {
    if (!dom.feedUrlInput) {
      return;
    }

    const nextUrl = dom.feedUrlInput.value.trim();
    if (!nextUrl) {
      showToast("Feed URL needed", "Paste an RSS or Atom feed URL first.", toastDurationMs);
      return;
    }

    const normalizedUrl = nextUrl.toLowerCase();
    const existingFeed = state.feeds.find((feed) => feed.url.toLowerCase() === normalizedUrl);
    if (existingFeed) {
      state.activeFeedId = existingFeed.id;
      saveState();
      syncUi();
      showToast("Feed already saved", "Switched to the existing source.", toastDurationMs);
      return;
    }

    const nextFeed = normalizeRssFeed({
      url: nextUrl,
      status: "Feed source saved"
    });
    state.feeds = dedupeRssFeeds([...state.feeds, nextFeed]);
    state.activeFeedId = nextFeed.id;
    saveState();
    dom.feedUrlInput.value = "";
    syncUi();
    showToast("Feed added", "Your RSS source is ready to refresh.", toastDurationMs);
  }

  function removeFeedSource(feedId) {
    const feed = state.feeds.find((entry) => entry.id === feedId);
    if (!feed) {
      return;
    }

    state.feeds = state.feeds.filter((entry) => entry.id !== feedId);
    if (state.activeFeedId === feedId) {
      state.activeFeedId = "all";
    }
    saveState();
    syncUi();
    showToast("Feed removed", `${feed.title || feed.url} was removed.`, toastDurationMs);
  }

  function shouldRefreshOnOpen() {
    if (state.feeds.length === 0) {
      return false;
    }

    if (state.activeFeedId === "all") {
      return state.feeds.some((feed) => feed.items.length === 0);
    }

    const activeFeed = state.feeds.find((feed) => feed.id === state.activeFeedId);
    return Boolean(activeFeed && activeFeed.items.length === 0);
  }

  async function refresh({ silent = false, feedId = null } = {}) {
    const feedsToRefresh =
      feedId
        ? state.feeds.filter((feed) => feed.id === feedId)
        : state.activeFeedId === "all"
          ? state.feeds
          : state.feeds.filter((feed) => feed.id === state.activeFeedId);
    if (feedsToRefresh.length === 0) {
      if (!silent) {
        showToast("Feed URL needed", "Add at least one RSS or Atom feed first.", toastDurationMs);
      }
      return;
    }

    state.isRefreshing = true;
    syncUi();

    try {
      const refreshedFeeds = [];
      const failedFeeds = [];

      for (const feed of feedsToRefresh) {
        try {
          const payload = await apiFetch(`/api/rss/feed?url=${encodeURIComponent(feed.url)}`);
          refreshedFeeds.push(
            normalizeRssFeed({
              ...feed,
              url: payload.feedUrl || feed.url,
              title: payload.title || "",
              description: payload.description || "",
              status: payload.status || "Feed loaded",
              refreshedAt: payload.refreshedAt || new Date().toISOString(),
              siteUrl: payload.siteUrl || "",
              items: Array.isArray(payload.items) ? payload.items : []
            })
          );
        } catch (error) {
          const message = error instanceof ApiError
            ? error.payload?.error || "The RSS feed could not be loaded."
            : "The RSS feed could not be loaded.";
          failedFeeds.push({ ...feed, status: message });
        }
      }

      const refreshedById = new Map([
        ...refreshedFeeds.map((feed) => [feed.id, feed]),
        ...failedFeeds.map((feed) => [feed.id, feed])
      ]);
      state.feeds = state.feeds.map((feed) => refreshedById.get(feed.id) || feed);
      saveState();
      syncUi();

      if (refreshedFeeds.length === 0) {
        throw new Error(failedFeeds[0]?.status || "The RSS feeds could not be loaded.");
      }

      if (!silent) {
        const itemCount = refreshedFeeds.reduce((sum, feed) => sum + feed.items.length, 0);
        const failureSuffix =
          failedFeeds.length > 0 ? ` ${failedFeeds.length} feed${failedFeeds.length === 1 ? "" : "s"} failed.` : "";
        showToast(
          "RSS refreshed",
          `Loaded ${itemCount} entries across ${refreshedFeeds.length} ${refreshedFeeds.length === 1 ? "feed" : "feeds"}.${failureSuffix}`,
          toastDurationMs
        );
      }
    } catch (error) {
      const message = error instanceof ApiError
        ? error.payload?.error || "The RSS feed could not be loaded."
        : error instanceof Error && error.message
          ? error.message
          : "The RSS feed could not be loaded.";
      const targetIds = new Set(feedsToRefresh.map((feed) => feed.id));
      state.feeds = state.feeds.map((feed) => (
        targetIds.has(feed.id)
          ? {
              ...feed,
              status: message
            }
          : feed
      ));
      saveState();
      syncUi();
      if (!silent) {
        showToast("RSS refresh failed", message, toastDurationMs);
      }
    } finally {
      state.isRefreshing = false;
      syncUi();
    }
  }

  function bindEvents() {
    const handleRefreshRequest = async () => {
      try {
        await refresh({ silent: true });
      } finally {
        window.dispatchEvent(new CustomEvent(RSS_REFRESH_COMPLETE_EVENT));
      }
    };

    if (dom.saveButton) {
      dom.saveButton.addEventListener("click", addFeedSource);
    }

    if (dom.refreshButton) {
      dom.refreshButton.addEventListener("click", () => {
        void refresh();
      });
    }

    if (dom.feedUrlInput) {
      dom.feedUrlInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        addFeedSource();
        void refresh({ silent: true });
      });
    }

    if (dom.viewSwitcher) {
      dom.viewSwitcher.addEventListener("click", (event) => {
        const button = event.target instanceof Element ? event.target.closest("[data-rss-feed-select]") : null;
        if (!button) {
          return;
        }

        setActiveFeed(button.dataset.rssFeedSelect || "all");
      });
    }

    dom.panelLinks.forEach((button) => {
      button.addEventListener("click", () => {
        const nextPanel = button.dataset.rssPanelLink || "root";
        setActiveRssPanel(nextPanel);
      });
    });

    dom.panelBackButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setActiveRssPanel("root");
      });
    });

    if (dom.sourcesList) {
      dom.sourcesList.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
          return;
        }

        const selectButton = target.closest("[data-rss-feed-select]");
        if (selectButton) {
          setActiveFeed(selectButton.dataset.rssFeedSelect || "all");
          return;
        }

        const refreshButton = target.closest("[data-rss-feed-refresh]");
        if (refreshButton) {
          void refresh({
            feedId: refreshButton.dataset.rssFeedRefresh || null
          });
          return;
        }

        const removeButton = target.closest("[data-rss-feed-remove]");
        if (removeButton) {
          removeFeedSource(removeButton.dataset.rssFeedRemove || "");
        }
      });
    }

    window.addEventListener(RSS_REFRESH_REQUEST_EVENT, handleRefreshRequest);
  }

  function syncFeatureUi() {
    if (typeof syncUi === "function") {
      syncUi(getSnapshot());
    }
  }

  function getViewportInputs() {
    return [dom.feedUrlInput].filter(Boolean);
  }

  function getDesktopSnapshot() {
    const activeFeed = state.feeds.find((feed) => feed.id === state.activeFeedId) || null;
    const mergedItems = state.feeds
      .flatMap((feed) =>
        (feed.items || []).map((item) => ({
          ...item,
          feedId: feed.id,
          sourceName: item.sourceName || feed.title || feed.url
        }))
      )
      .sort((left, right) => String(right.publishedAt || "").localeCompare(String(left.publishedAt || "")))
      .slice(0, 8);

    return {
      feeds: state.feeds.map((feed) => ({
        id: feed.id,
        title: feed.title,
        url: feed.url,
        status: feed.status,
        refreshedAt: feed.refreshedAt,
        itemCount: Array.isArray(feed.items) ? feed.items.length : 0
      })),
      activeFeedId: state.activeFeedId,
      activeFeed: activeFeed
        ? {
            id: activeFeed.id,
            title: activeFeed.title,
            url: activeFeed.url,
            status: activeFeed.status,
            refreshedAt: activeFeed.refreshedAt,
            itemCount: Array.isArray(activeFeed.items) ? activeFeed.items.length : 0
          }
        : null,
      mergedItems
    };
  }

  function getSnapshot() {
    return {
      feeds: state.feeds.map((feed) => ({
        ...feed,
        items: Array.isArray(feed.items)
          ? feed.items.map((item) => ({ ...item }))
          : []
      })),
      activeFeedId: state.activeFeedId,
      isRefreshing: state.isRefreshing
    };
  }

  function getBackupSnapshot() {
    return getSnapshot();
  }

  function restoreBackupSnapshot(snapshot) {
    const payload = snapshot && typeof snapshot === "object" ? snapshot : {};
    const feeds = Array.isArray(payload.feeds)
      ? dedupeRssFeeds(payload.feeds.map(normalizeRssFeed).filter((feed) => feed.url))
      : [];
    const nextActiveFeedId =
      typeof payload.activeFeedId === "string"
        && (payload.activeFeedId === "all" || feeds.some((feed) => feed.id === payload.activeFeedId))
        ? payload.activeFeedId
        : "all";

    state.feeds = feeds;
    state.activeFeedId = nextActiveFeedId;
    state.isRefreshing = false;
    saveState();
    syncFeatureUi();
  }

  return {
    bindEvents,
    getDesktopSnapshot,
    getBackupSnapshot,
    getSnapshot,
    getViewportInputs,
    hasFeeds() {
      return state.feeds.length > 0;
    },
    restoreBackupSnapshot,
    syncUi: syncFeatureUi,
    shouldRefreshOnOpen,
    isRefreshing() {
      return state.isRefreshing;
    },
    refresh
  };
}
