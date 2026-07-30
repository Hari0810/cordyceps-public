function safeUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : "#";
}

function getVisibleRssItems(feeds, activeFeedId) {
  const sourceFeeds =
    activeFeedId === "all"
      ? feeds
      : feeds.filter((feed) => feed.id === activeFeedId);

  return sourceFeeds
    .flatMap((feed) =>
      (Array.isArray(feed.items) ? feed.items : []).map((item) => ({
        ...item,
        sourceName: item.sourceName || feed.title || shortenRssUrl(feed.url),
        siteUrl: feed.siteUrl || ""
      }))
    )
    .sort((left, right) => {
      const leftTime = Date.parse(left.publishedAt || "") || 0;
      const rightTime = Date.parse(right.publishedAt || "") || 0;
      return rightTime - leftTime;
    });
}

function getLatestRssRefresh(feeds, activeFeedId) {
  const sourceFeeds =
    activeFeedId === "all"
      ? feeds
      : feeds.filter((feed) => feed.id === activeFeedId);
  const timestamps = sourceFeeds
    .map((feed) => Date.parse(feed.refreshedAt || ""))
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);
  if (timestamps.length === 0) {
    return null;
  }
  return new Date(Math.max(...timestamps)).toISOString();
}

function shortenRssUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url || "Feed";
  }
}

function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatRssPublishedAt(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

export function renderRssUi(dom, rssFeeds, activeFeedId, isRefreshing) {
  if (
    !dom.feedUrlInput ||
    !dom.statusValue ||
    !dom.updatedValue ||
    !dom.feedTitle ||
    !dom.feedDescription ||
    !dom.viewSwitcher ||
    !dom.sourcesList ||
    !dom.sourcesEmptyState ||
    !dom.itemsList ||
    !dom.emptyState
  ) {
    return;
  }

  const feeds = Array.isArray(rssFeeds) ? rssFeeds : [];
  const activeFeed =
    activeFeedId && activeFeedId !== "all"
      ? feeds.find((feed) => feed.id === activeFeedId) || null
      : null;
  const items = getVisibleRssItems(feeds, activeFeedId);
  const latestRefresh = getLatestRssRefresh(feeds, activeFeedId);
  const shouldUpdateUrl =
    document.activeElement !== dom.feedUrlInput || !dom.feedUrlInput.value.trim();

  if (shouldUpdateUrl) {
    dom.feedUrlInput.value = "";
  }

  dom.viewSwitcher.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.className = `filter-button${activeFeedId === "all" ? " is-active" : ""}`;
  allButton.type = "button";
  allButton.dataset.rssFeedSelect = "all";
  allButton.textContent = "All feeds";
  dom.viewSwitcher.append(allButton);

  feeds.forEach((feed) => {
    const button = document.createElement("button");
    button.className = `filter-button${feed.id === activeFeedId ? " is-active" : ""}`;
    button.type = "button";
    button.dataset.rssFeedSelect = feed.id;
    button.textContent = feed.title || shortenRssUrl(feed.url);
    dom.viewSwitcher.append(button);
  });

  dom.statusValue.textContent = isRefreshing
    ? "Refreshing feed..."
    : activeFeed
      ? activeFeed.status || "Ready to refresh this feed."
      : feeds.length > 0
        ? `Tracking ${feeds.length} feeds.`
        : "Enter a feed URL to get started.";
  dom.updatedValue.textContent = latestRefresh
    ? formatTimestamp(latestRefresh)
    : "Never";
  dom.feedTitle.textContent = activeFeed
    ? activeFeed.title || shortenRssUrl(activeFeed.url)
    : feeds.length > 0
      ? "All feeds"
      : "No feed selected";
  dom.feedDescription.textContent = activeFeed
    ? activeFeed.description || activeFeed.url || "This feed has no description yet."
    : feeds.length > 0
      ? "Latest entries from every saved feed, merged into one timeline."
      : "Paste an RSS or Atom feed URL, add it, and refresh to load the latest entries.";

  dom.sourcesList.innerHTML = "";
  dom.sourcesEmptyState.hidden = feeds.length > 0;

  feeds.forEach((feed) => {
    const item = document.createElement("article");
    item.className = `rss-source-item${feed.id === activeFeedId ? " is-active" : ""}`;

    const copy = document.createElement("div");
    copy.className = "rss-source-copy";

    const title = document.createElement("p");
    title.className = "rss-source-title";
    title.textContent = feed.title || shortenRssUrl(feed.url);

    const meta = document.createElement("p");
    meta.className = "rss-source-meta";
    meta.textContent = [feed.url, feed.refreshedAt ? `Updated ${formatTimestamp(feed.refreshedAt)}` : ""]
      .filter(Boolean)
      .join(" • ");

    copy.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "rss-source-actions";

    const openButton = document.createElement("button");
    openButton.className = `setting-action-button setting-action-button-secondary${feed.id === activeFeedId ? " is-active" : ""}`;
    openButton.type = "button";
    openButton.dataset.rssFeedSelect = feed.id;
    openButton.textContent = feed.id === activeFeedId ? "Viewing" : "View";

    const refreshButton = document.createElement("button");
    refreshButton.className = "setting-action-button setting-action-button-secondary";
    refreshButton.type = "button";
    refreshButton.dataset.rssFeedRefresh = feed.id;
    refreshButton.textContent = "Refresh";

    const removeButton = document.createElement("button");
    removeButton.className = "setting-action-button setting-action-button-secondary rss-remove-button";
    removeButton.type = "button";
    removeButton.dataset.rssFeedRemove = feed.id;
    removeButton.textContent = "Remove";

    actions.append(openButton, refreshButton, removeButton);
    item.append(copy, actions);
    dom.sourcesList.append(item);
  });

  dom.itemsList.innerHTML = "";
  dom.emptyState.hidden = items.length > 0;

  items.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "rss-item";

    const link = document.createElement("div");
    link.className = "rss-item-link";

    const title = document.createElement("p");
    title.className = "rss-item-title";
    
    // Make the title itself a link
    const titleLink = document.createElement("a");
    titleLink.href = safeUrl(entry.url || entry.siteUrl);
    titleLink.target = "_blank";
    titleLink.rel = "noreferrer noopener";
    titleLink.textContent = entry.title || "Untitled article";
    titleLink.style.color = "inherit";
    titleLink.style.textDecoration = "none";
    
    title.appendChild(titleLink);

    const meta = document.createElement("p");
    meta.className = "rss-item-meta";
    meta.textContent = [entry.sourceName || "Feed", formatRssPublishedAt(entry.publishedAt)]
      .filter(Boolean)
      .join(" • ");

    if (entry.commentsUrl) {
      meta.textContent += " • ";
      const commentLink = document.createElement("a");
      commentLink.className = "rss-item-comments-link";
      commentLink.href = safeUrl(entry.commentsUrl);
      commentLink.target = "_blank";
      commentLink.rel = "noreferrer noopener";
      commentLink.textContent = "Comments";
      commentLink.addEventListener("click", (e) => e.stopPropagation());
      meta.append(commentLink);
    }

    const summary = document.createElement("p");
    summary.className = "rss-item-summary";
    summary.textContent = entry.summary || "Open article";

    const readerButton = document.createElement("button");
    readerButton.className = "rss-reader-button";
    readerButton.type = "button";
    readerButton.dataset.rssReaderUrl = safeUrl(entry.url || entry.siteUrl);
    readerButton.dataset.rssReaderTitle = entry.title || "Untitled article";
    readerButton.dataset.rssReaderSummary = entry.summary || "";
    readerButton.textContent = "Lazy read";

    link.append(title, meta, summary, readerButton);
    item.append(link);
    dom.itemsList.append(item);
  });
}
