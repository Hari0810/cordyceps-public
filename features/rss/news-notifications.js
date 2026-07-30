const STORAGE_KEY = "today.rss.news-notifications.v1";
const DEFAULT_SETTINGS = {
  enabled: false,
  frequency: 3,
  times: ["08:00", "13:00", "18:00"],
};

function isValidTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function readRssNewsNotificationSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const payload = raw ? JSON.parse(raw) : {};
    const frequency = Number.parseInt(payload.frequency, 10);
    const times = Array.isArray(payload.times)
      ? payload.times.filter(isValidTime)
      : [];
    return {
      enabled: payload.enabled === true,
      frequency: Number.isFinite(frequency) ? Math.max(1, Math.min(6, frequency)) : DEFAULT_SETTINGS.frequency,
      times: normalizeRssNewsNotificationTimes(times),
    };
  } catch {
    return { ...DEFAULT_SETTINGS, times: [...DEFAULT_SETTINGS.times] };
  }
}

export function writeRssNewsNotificationSettings(settings) {
  const nextSettings = normalizeRssNewsNotificationSettings(settings);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
  } catch {
    // Settings persistence is best effort.
  }
  return nextSettings;
}

export function normalizeRssNewsNotificationSettings(settings) {
  const payload = settings && typeof settings === "object" ? settings : {};
  const frequency = Number.parseInt(payload.frequency, 10);
  return {
    enabled: payload.enabled === true,
    frequency: Number.isFinite(frequency) ? Math.max(1, Math.min(6, frequency)) : DEFAULT_SETTINGS.frequency,
    times: normalizeRssNewsNotificationTimes(Array.isArray(payload.times) ? payload.times : DEFAULT_SETTINGS.times),
  };
}

export function normalizeRssNewsNotificationTimes(times) {
  const validTimes = times.filter(isValidTime);
  const merged = validTimes.length > 0 ? validTimes : DEFAULT_SETTINGS.times;
  return [...merged].sort();
}

export function getRssNewsFeedUrls(snapshot) {
  return (Array.isArray(snapshot?.feeds) ? snapshot.feeds : [])
    .map((feed) => String(feed?.url || "").trim())
    .filter(Boolean);
}

export async function syncRssNewsNotificationSettings(snapshot) {
  const settings = readRssNewsNotificationSettings();
  const feedUrls = getRssNewsFeedUrls(snapshot);
  try {
    await fetch("/api/rss-news-notifications/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: settings.enabled,
        frequency: settings.frequency,
        times: settings.times,
        feedUrls,
      }),
    });
  } catch {
    // The helper/server may be offline; RSS notification scheduling is optional.
  }
}
