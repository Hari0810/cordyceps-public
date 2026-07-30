"""Current-affairs source ingestion and symbolic graph building.

Owner: web/src/features/thendral/ + serve.py /api/current-affairs/* routes
"""

from __future__ import annotations

from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import json
import re
from typing import Any
from urllib.parse import quote, urlparse

from .rss import fetch_rss_feed, fetch_safe_url_bytes
from .utils import compact_text, isoformat

HTTP_USER_AGENT = "Mozilla/5.0 (compatible; CordycepsCurrentAffairs/1.0; +https://cordyceps.app)"
MAX_TOPICS = 12
MAX_EDGES = 20
MAX_SUBTOPICS_PER_TOPIC = 4
MAX_GRAPH_DEPTH = 3
MAX_CHILDREN_PER_NODE = 4
MAX_DOCS_PER_SOURCE = 10
MAX_REDDIT_BYTES = 800_000
MAX_WIKIPEDIA_BYTES = 800_000
MAX_WIKIPEDIA_SUMMARY_CACHE = 96
DEFAULT_FETCH_TIMEOUT = 20

SOURCE_ORDER = ["news", "blogs", "companies", "reddit", "wikipedia", "x"]
FAMILY_COLORS = {
    "news": "#5b8dee",
    "blogs": "#8b5cf6",
    "companies": "#14b8a6",
    "reddit": "#f97316",
    "wikipedia": "#3dba7c",
    "x": "#111827",
}

NEWS_SOURCES: tuple[dict[str, Any], ...] = (
    {
        "id": "bbc-world",
        "label": "BBC World",
        "family": "news",
        "description": "BBC World headlines",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "topicHints": ["world", "geopolitics"],
    },
    {
        "id": "bbc-politics",
        "label": "BBC Politics",
        "family": "news",
        "description": "BBC UK politics feed",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://feeds.bbci.co.uk/news/politics/rss.xml",
        "topicHints": ["politics", "government"],
    },
    {
        "id": "npr-news",
        "label": "NPR News",
        "family": "news",
        "description": "NPR national and global headlines",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://feeds.npr.org/1001/rss.xml",
        "topicHints": ["news", "public life"],
    },
    {
        "id": "guardian-world",
        "label": "The Guardian World",
        "family": "news",
        "description": "The Guardian world feed",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://www.theguardian.com/world/rss",
        "topicHints": ["world", "culture"],
    },
    {
        "id": "verge-tech",
        "label": "The Verge",
        "family": "news",
        "description": "Technology and internet culture",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://www.theverge.com/rss/index.xml",
        "topicHints": ["technology", "internet culture"],
    },
)

REDDIT_SOURCES: tuple[dict[str, Any], ...] = (
    {
        "id": "reddit-news",
        "label": "r/news",
        "family": "reddit",
        "description": "Reddit /r/news newest posts",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://old.reddit.com/r/news/.rss",
        "topicHints": ["news"],
    },
    {
        "id": "reddit-worldnews",
        "label": "r/worldnews",
        "family": "reddit",
        "description": "Reddit /r/worldnews newest posts",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://old.reddit.com/r/worldnews/.rss",
        "topicHints": ["world news"],
    },
    {
        "id": "reddit-politics",
        "label": "r/politics",
        "family": "reddit",
        "description": "Reddit /r/politics newest posts",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://old.reddit.com/r/politics/.rss",
        "topicHints": ["politics", "government"],
    },
    {
        "id": "reddit-technology",
        "label": "r/technology",
        "family": "reddit",
        "description": "Reddit /r/technology newest posts",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://old.reddit.com/r/technology/.rss",
        "topicHints": ["technology"],
    },
    {
        "id": "reddit-entertainment",
        "label": "r/entertainment",
        "family": "reddit",
        "description": "Reddit /r/entertainment newest posts",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://old.reddit.com/r/entertainment/.rss",
        "topicHints": ["culture", "entertainment"],
    },
)

BLOG_SOURCES: tuple[dict[str, Any], ...] = (
    {
        "id": "blog-stratechery",
        "label": "Stratechery",
        "family": "blogs",
        "description": "Technology, markets, and media analysis from Ben Thompson.",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://stratechery.com/feed/",
        "topicHints": ["technology", "markets", "media"],
    },
    {
        "id": "blog-benedict-evans",
        "label": "Benedict Evans",
        "family": "blogs",
        "description": "Technology, business, and internet-platform essays.",
        "defaultEnabled": False,
        "kind": "rss",
        "feedUrl": "https://www.ben-evans.com/benedictevans?format=rss",
        "topicHints": ["technology", "business", "internet"],
    },
    {
        "id": "blog-daring-fireball",
        "label": "Daring Fireball",
        "family": "blogs",
        "description": "Apple, technology, media, and internet-culture commentary.",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://daringfireball.net/feeds/main",
        "topicHints": ["apple", "technology", "media"],
    },
    {
        "id": "blog-simon-willison",
        "label": "Simon Willison",
        "family": "blogs",
        "description": "AI, software, open source, and web platform commentary.",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://simonwillison.net/atom/everything/",
        "topicHints": ["ai", "software", "open source"],
    },
    {
        "id": "blog-kottke",
        "label": "kottke.org",
        "family": "blogs",
        "description": "Independent culture, internet, design, and current-events links.",
        "defaultEnabled": False,
        "kind": "rss",
        "feedUrl": "https://kottke.org/index.xml",
        "topicHints": ["culture", "internet", "design"],
    },
    {
        "id": "blog-pragmatic-engineer",
        "label": "The Pragmatic Engineer",
        "family": "blogs",
        "description": "Software-industry, company, and engineering-organization commentary.",
        "defaultEnabled": False,
        "kind": "rss",
        "feedUrl": "https://blog.pragmaticengineer.com/rss/",
        "topicHints": ["software", "companies", "engineering"],
    },
)

COMPANY_SOURCES: tuple[dict[str, Any], ...] = (
    {
        "id": "company-google-keyword",
        "label": "Google: The Keyword",
        "family": "companies",
        "description": "Official Google product and company announcements.",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://blog.google/rss/",
        "topicHints": ["google", "company announcements"],
    },
    {
        "id": "company-apple-newsroom",
        "label": "Apple Newsroom",
        "family": "companies",
        "description": "Official Apple newsroom announcements and updates.",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://www.apple.com/newsroom/rss-feed.rss",
        "topicHints": ["apple", "company announcements"],
    },
    {
        "id": "company-meta-newsroom",
        "label": "Meta Newsroom",
        "family": "companies",
        "description": "Official Meta company-news announcements.",
        "defaultEnabled": True,
        "kind": "rss",
        "feedUrl": "https://about.fb.com/news/category/company-news/feed/",
        "topicHints": ["meta", "company announcements"],
    },
    {
        "id": "company-github-blog",
        "label": "GitHub Blog",
        "family": "companies",
        "description": "Official GitHub product, platform, and policy updates.",
        "defaultEnabled": False,
        "kind": "rss",
        "feedUrl": "https://github.blog/feed/",
        "topicHints": ["github", "software"],
    },
    {
        "id": "company-nvidia-blog",
        "label": "NVIDIA Blog",
        "family": "companies",
        "description": "Official NVIDIA AI, research, and platform announcements.",
        "defaultEnabled": False,
        "kind": "rss",
        "feedUrl": "https://blogs.nvidia.com/feed/",
        "topicHints": ["nvidia", "ai", "hardware"],
    },
    {
        "id": "company-spotify-newsroom",
        "label": "Spotify Newsroom",
        "family": "companies",
        "description": "Official Spotify product, business, and culture announcements.",
        "defaultEnabled": False,
        "kind": "rss",
        "feedUrl": "https://newsroom.spotify.com/feed/",
        "topicHints": ["spotify", "media", "culture"],
    },
)

WIKIPEDIA_SOURCES: tuple[dict[str, Any], ...] = (
    {
        "id": "wikipedia-top-read",
        "label": "Wikipedia Top Read",
        "family": "wikipedia",
        "description": "Most-read English Wikipedia articles from the latest available day",
        "defaultEnabled": True,
        "kind": "wikipedia-top-read",
        "topicHints": ["wikipedia", "attention"],
    },
    {
        "id": "wikipedia-recent-changes",
        "label": "Wikipedia Recent Changes",
        "family": "wikipedia",
        "description": "Recently updated English Wikipedia article pages",
        "defaultEnabled": True,
        "kind": "wikipedia-recent-changes",
        "feedUrl": "https://en.wikipedia.org/w/index.php?title=Special:RecentChanges&feed=rss",
        "topicHints": ["wikipedia", "recent updates"],
    },
)

DISABLED_SOURCES: tuple[dict[str, Any], ...] = (
    {
        "id": "x-latest",
        "label": "X",
        "family": "x",
        "description": "Official X latest-post signal",
        "defaultEnabled": False,
        "kind": "x",
        "available": False,
        "reason": "Official X API access is not configured in this build.",
        "topicHints": ["social"],
    },
)

SOURCE_REGISTRY: tuple[dict[str, Any], ...] = (
    *NEWS_SOURCES,
    *BLOG_SOURCES,
    *COMPANY_SOURCES,
    *REDDIT_SOURCES,
    *WIKIPEDIA_SOURCES,
    *DISABLED_SOURCES,
)

TOPIC_STOPWORDS = {
    "a", "about", "after", "all", "amid", "an", "and", "another", "any", "are", "as",
    "at", "back", "be", "because", "been", "before", "being", "big", "but", "by",
    "can", "city", "day", "days", "dead", "died", "dies", "do", "during", "first",
    "for", "former", "from", "gets", "has", "have", "killed", "last", "loses", "many",
    "next", "several", "some", "three", "two", "wins",
    "he", "her", "his", "how", "if", "in", "into", "is", "it", "its", "just", "latest",
    "may", "more", "most", "new", "news", "now", "of", "on", "one", "or", "over", "people",
    "says", "say", "still", "than", "that", "the", "their", "them", "there", "these",
    "they", "this", "to", "today", "top", "up", "was", "week", "what", "when", "where",
    "we", "which", "who", "why", "will", "with", "world", "you", "your",
}

TOPIC_BLACKLIST = {
    "breaking news",
    "latest news",
    "reddit",
    "wikipedia",
    "world news",
    "january", "february", "march", "april", "june", "july",
    "august", "september", "october", "november", "december",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
}

TOPIC_ALIAS = {
    "u s": "us",
    "u s a": "us",
    "usa": "us",
    "united states": "us",
    "united states of america": "us",
    "white house": "the white house",
    "elon s": "elon",
    "artificial intelligence": "ai",
    "company news": "company announcements",
    "company updates": "company announcements",
    "company newsroom": "company announcements",
}

CANONICAL_TOPIC_LABELS = {
    "ai": "AI",
    "us": "U.S.",
    "uk": "U.K.",
    "eu": "EU",
    "apple": "Apple",
    "google": "Google",
    "meta": "Meta",
    "github": "GitHub",
    "nvidia": "NVIDIA",
    "openai": "OpenAI",
    "bbc": "BBC",
    "npr": "NPR",
    "trump": "Trump",
    "the white house": "The White House",
    "x": "X",
}

KNOWN_ENTITY_KEYS = {
    "apple",
    "google",
    "meta",
    "github",
    "nvidia",
    "openai",
    "spotify",
    "tesla",
    "trump",
    "elon",
    "the white house",
    "bbc",
    "npr",
    "wikipedia",
}

KNOWN_THEME_KEYS = {
    "ai",
    "politics",
    "government",
    "economy",
    "business",
    "markets",
    "trade",
    "software",
    "technology",
    "internet",
    "culture",
    "entertainment",
    "media",
    "sports",
    "climate",
    "health",
    "science",
    "war",
    "geopolitics",
    "education",
    "policy",
    "entertainment",
    "internet culture",
    "open source",
}

SOURCE_BURST_KEYS = {
    "company announcements",
    "recent updates",
    "world news",
    "latest news",
    "breaking news",
    "attention",
}

GENERIC_TOPIC_KEYS = {
    "american",
    "app",
    "apps",
    "attention",
    "boy",
    "business",
    "society",
    "company announcements",
    "culture",
    "design",
    "engineering",
    "girl",
    "hardware",
    "home",
    "internet",
    "latest",
    "live",
    "man",
    "markets",
    "media",
    "people",
    "photos",
    "public life",
    "recent updates",
    "software",
    "technology",
    "update",
    "us",
    "video",
    "watch",
    "woman",
    "world",
    "year",
}

GENERIC_DEMONYMS = {
    "american",
    "british",
    "canadian",
    "chinese",
    "european",
    "french",
    "german",
    "indian",
    "israeli",
    "japanese",
    "palestinian",
    "russian",
    "ukrainian",
}

STORY_HINT_WORDS = {
    "coverage",
    "deal",
    "election",
    "launch",
    "lawsuit",
    "plan",
    "policy",
    "rollout",
    "summit",
    "tariff",
    "trial",
    "vote",
}

AI_STACK_KEYS = {
    "ai",
    "apple",
    "developer",
    "gemini",
    "github",
    "google",
    "meta",
    "nvidia",
    "openai",
    "software",
}

COMPANY_ENTITY_KEYS = {
    "apple",
    "google",
    "meta",
    "github",
    "nvidia",
    "spotify",
    "tesla",
}

PREFERRED_PARENT_TOPIC_KEYS = {
    "apple": {"technology", "ai", "software", "internet", "business", "media"},
    "google": {"technology", "ai", "software", "internet", "business"},
    "meta": {"technology", "ai", "software", "internet", "media"},
    "github": {"software", "open source", "ai", "technology"},
    "nvidia": {"ai", "hardware", "technology", "business"},
    "openai": {"ai", "software", "technology"},
    "spotify": {"media", "culture", "technology"},
    "tesla": {"technology", "business", "markets"},
    "trump": {"politics", "government", "policy"},
    "the white house": {"politics", "government", "policy"},
}

BRANCH_HINTS = {
    "technology": {
        "software", "internet", "hardware", "platform", "platforms", "devices",
        "developer", "developers", "app store", "wwdc", "google io", "consumer tech",
    },
    "ai": {
        "artificial intelligence", "agent", "agents", "llm", "llms", "model",
        "models", "chatgpt", "gemini", "copilot", "developer stack", "api",
    },
    "policy": {
        "policy", "regulation", "regulatory", "rules", "lawmakers", "antitrust",
        "tariff", "compliance", "standards", "legal",
    },
    "politics": {
        "politics", "government", "election", "campaign", "white house", "congress",
        "senate", "president", "vote",
    },
    "government": {
        "government", "white house", "federal", "state", "agency", "agencies",
        "regulators", "regulator",
    },
    "business": {
        "business", "earnings", "finance", "company", "companies", "trade",
        "economy", "merger", "acquisition",
    },
    "markets": {
        "markets", "stocks", "investors", "shares", "wall street",
    },
    "media": {
        "media", "streaming", "social", "press", "journalism", "music", "video",
    },
    "culture": {
        "culture", "entertainment", "film", "tv", "music", "design",
    },
    "science": {
        "science", "research", "study", "studies", "lab", "labs",
    },
    "health": {
        "health", "medical", "medicine", "disease", "hospital", "hospitals",
    },
    "open source": {
        "open source", "oss", "github", "repository", "repositories",
    },
}
BRANCH_PARENT_KEYS = {
    "ai": "technology",
    "software": "technology",
    "internet": "technology",
    "hardware": "technology",
    "open source": "technology",
    "markets": "business",
    "government": "politics",
}
BRANCH_KEYS = sorted({
    *BRANCH_HINTS.keys(),
    *{
        parent_key
        for parent_keys in PREFERRED_PARENT_TOPIC_KEYS.values()
        for parent_key in parent_keys
    },
})
BRANCH_MIN_ASSIGNMENT_SCORE = 2.0
BRANCH_MIN_SYNTHETIC_MEMBERS = 2
BRANCH_MIN_SYNTHETIC_GROUP_SCORE = 5.2

CAPITALIZED_PHRASE_RE = re.compile(
    r"\b(?:[A-Z]{2,}|[A-Z][a-z]+)(?:\s+(?:[A-Z]{2,}|[A-Z][a-z]+)){0,2}\b"
)
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'/-]{2,}")
_WIKIPEDIA_SUMMARY_CACHE: dict[str, dict[str, str]] = {}
_WIKIPEDIA_SUMMARY_BACKOFF_UNTIL: datetime | None = None


def list_current_affairs_sources() -> dict[str, Any]:
    return {
        "sources": [_serialize_source_descriptor(source) for source in SOURCE_REGISTRY],
        "generatedAt": isoformat(),
    }


def fetch_current_affairs_graph(
    enabled_source_ids: list[str] | tuple[str, ...] | set[str] | None = None,
) -> dict[str, Any]:
    enabled_sources = _resolve_enabled_sources(enabled_source_ids)
    fetched_at = isoformat()
    runtime_sources: list[dict[str, Any]] = []
    all_documents: list[dict[str, Any]] = []

    fetchable_sources = [source for source in enabled_sources if source.get("available", True)]
    if not fetchable_sources:
        return {
            "generatedAt": fetched_at,
            "sources": [_serialize_runtime_source(source, "disabled", 0, fetched_at, None) for source in enabled_sources],
            "documents": [],
            "graph": _empty_graph(fetched_at),
            "warnings": ["No current-affairs sources are enabled."],
        }

    with ThreadPoolExecutor(max_workers=min(6, len(fetchable_sources))) as executor:
        future_map = {
            executor.submit(_fetch_source_documents, source): source
            for source in fetchable_sources
        }
        for future in as_completed(future_map):
            source = future_map[future]
            try:
                documents = future.result()
                runtime_sources.append(
                    _serialize_runtime_source(source, "ready", len(documents), fetched_at, None)
                )
                all_documents.extend(documents)
            except Exception as exc:  # pragma: no cover - defensive surface
                runtime_sources.append(
                    _serialize_runtime_source(source, "error", 0, fetched_at, str(exc))
                )

    # Preserve disabled/unavailable sources in the response for UI toggles.
    known_runtime_ids = {item["id"] for item in runtime_sources}
    for source in enabled_sources:
        if source["id"] in known_runtime_ids:
            continue
        runtime_sources.append(
            _serialize_runtime_source(
                source,
                "disabled" if not source.get("available", True) else "idle",
                0,
                fetched_at,
                None,
            )
        )

    all_documents.sort(
        key=lambda document: (
            str(document.get("publishedAt") or ""),
            str(document.get("sourceFamily") or ""),
            str(document.get("title") or ""),
        ),
        reverse=True,
    )

    graph = _build_graph_payload(all_documents, fetched_at)
    sorted_sources = sorted(
        runtime_sources,
        key=lambda item: SOURCE_ORDER.index(item["family"]) if item["family"] in SOURCE_ORDER else len(SOURCE_ORDER),
    )
    warnings = _summarize_warning_messages(sorted_sources)
    return {
        "generatedAt": fetched_at,
        "sources": sorted_sources,
        "documents": all_documents,
        "graph": graph,
        "warnings": warnings[:6],
    }


def _serialize_source_descriptor(source: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": source["id"],
        "label": source["label"],
        "family": source["family"],
        "description": source["description"],
        "defaultEnabled": bool(source.get("defaultEnabled", True)),
        "available": bool(source.get("available", True)),
        "reason": str(source.get("reason") or ""),
        "color": FAMILY_COLORS.get(source["family"], "#8a8f99"),
    }


def _serialize_runtime_source(
    source: dict[str, Any],
    status: str,
    item_count: int,
    fetched_at: str,
    error: str | None,
) -> dict[str, Any]:
    payload = _serialize_source_descriptor(source)
    payload.update({
        "status": status,
        "itemCount": int(item_count),
        "lastFetchedAt": fetched_at,
        "error": compact_text(error or "", 220),
    })
    return payload


def _summarize_warning_messages(runtime_sources: list[dict[str, Any]]) -> list[str]:
    counts: Counter[str] = Counter()
    ordered_messages: list[str] = []
    for source in runtime_sources:
        if source.get("status") != "error":
            continue
        message = compact_text(str(source.get("error") or ""), 220)
        if not message:
            continue
        if message not in counts:
            ordered_messages.append(message)
        counts[message] += 1
    return [
        f"{message} ({counts[message]} sources)" if counts[message] > 1 else message
        for message in ordered_messages
    ]


def _resolve_enabled_sources(enabled_source_ids: list[str] | tuple[str, ...] | set[str] | None) -> list[dict[str, Any]]:
    requested = {
        str(item).strip()
        for item in (enabled_source_ids or [])
        if str(item).strip()
    }
    if not requested:
        return [
            dict(source)
            for source in SOURCE_REGISTRY
            if source.get("defaultEnabled", True) or not source.get("available", True)
        ]
    allowed = {source["id"] for source in SOURCE_REGISTRY}
    return [dict(source) for source in SOURCE_REGISTRY if source["id"] in requested and source["id"] in allowed]


def _fetch_source_documents(source: dict[str, Any]) -> list[dict[str, Any]]:
    kind = str(source.get("kind") or "").strip()
    if kind == "rss":
        return _fetch_rss_source(source)
    if kind == "reddit":
        return _fetch_reddit_source(source)
    if kind == "wikipedia-top-read":
        return _fetch_wikipedia_top_read(source)
    if kind == "wikipedia-recent-changes":
        return _fetch_wikipedia_recent_changes(source)
    raise RuntimeError(f"Unsupported source kind: {kind or 'unknown'}.")


def _fetch_rss_source(source: dict[str, Any]) -> list[dict[str, Any]]:
    feed = fetch_rss_feed(str(source.get("feedUrl") or ""))
    topic_hints = [str(item).strip() for item in source.get("topicHints", []) if str(item).strip()]
    documents: list[dict[str, Any]] = []
    for index, item in enumerate(feed.get("items") or []):
        if index >= MAX_DOCS_PER_SOURCE:
            break
        title = compact_text(str(item.get("title") or "Untitled article"), 160)
        url = str(item.get("url") or "").strip()
        if not title or not url:
            continue
        excerpt = compact_text(str(item.get("summary") or ""), 280)
        documents.append({
            "id": f"{source['id']}::{index}::{_slugify(title)[:48]}",
            "sourceId": source["id"],
            "sourceName": source["label"],
            "sourceFamily": source["family"],
            "title": title,
            "url": url,
            "excerpt": excerpt,
            "publishedAt": str(item.get("publishedAt") or "") or isoformat(),
            "author": "",
            "tags": topic_hints,
            "language": "en",
            "weight": 1.0,
            "engagement": {},
            "rawTopicHints": topic_hints,
        })
    return documents


def _fetch_reddit_source(source: dict[str, Any]) -> list[dict[str, Any]]:
    listing_url = str(source.get("listingUrl") or "").strip()
    fetched = fetch_safe_url_bytes(
        listing_url,
        headers={
            "User-Agent": HTTP_USER_AGENT,
            "Accept": "application/json",
        },
        timeout=DEFAULT_FETCH_TIMEOUT,
        max_bytes=MAX_REDDIT_BYTES,
        label="Reddit listing",
    )
    try:
        payload = json.loads(fetched.body.decode(fetched.encoding or "utf-8", errors="replace"))
    except json.JSONDecodeError as exc:
        raise RuntimeError("Reddit returned invalid JSON.") from exc

    children = (((payload or {}).get("data") or {}).get("children") or []) if isinstance(payload, dict) else []
    documents: list[dict[str, Any]] = []
    for index, child in enumerate(children):
        if index >= MAX_DOCS_PER_SOURCE or not isinstance(child, dict):
            break
        post = child.get("data") if isinstance(child.get("data"), dict) else {}
        title = compact_text(str(post.get("title") or "Untitled Reddit post"), 160)
        permalink = str(post.get("permalink") or "").strip()
        if not title or not permalink:
            continue
        created_utc = post.get("created_utc")
        published_at = isoformat(float(created_utc)) if isinstance(created_utc, (int, float)) else isoformat()
        subreddit = str(post.get("subreddit_name_prefixed") or post.get("subreddit") or source["label"]).strip()
        external_url = str(post.get("url") or "").strip()
        engagement = {
            "score": int(post.get("score") or 0),
            "comments": int(post.get("num_comments") or 0),
        }
        excerpt_bits = [
            compact_text(str(post.get("selftext") or ""), 180),
            f"{engagement['score']} score",
            f"{engagement['comments']} comments",
        ]
        excerpt = compact_text(" · ".join(bit for bit in excerpt_bits if bit), 280)
        documents.append({
            "id": f"{source['id']}::{post.get('id') or index}",
            "sourceId": source["id"],
            "sourceName": source["label"],
            "sourceFamily": source["family"],
            "title": title,
            "url": f"https://www.reddit.com{permalink}",
            "excerpt": excerpt,
            "publishedAt": published_at,
            "author": str(post.get("author") or ""),
            "tags": [subreddit],
            "language": "en",
            "weight": 1.0 + min(3.0, max(0.0, engagement["score"]) / 800.0),
            "engagement": {**engagement, "externalUrl": external_url},
            "rawTopicHints": [subreddit, *source.get("topicHints", [])],
        })
    return documents


def _fetch_wikipedia_top_read(source: dict[str, Any]) -> list[dict[str, Any]]:
    payload = None
    for days_back in range(1, 4):
        date = datetime.now(timezone.utc) - timedelta(days=days_back)
        url = (
            "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/"
            f"en.wikipedia/all-access/{date.year}/{date.month:02d}/{date.day:02d}"
        )
        try:
            payload = _fetch_json(url, "Wikimedia top-read feed", MAX_WIKIPEDIA_BYTES)
            break
        except RuntimeError:
            continue
    if not isinstance(payload, dict):
        raise RuntimeError("Wikimedia top-read data is unavailable.")

    articles = (
        ((((payload.get("items") or [None])[0]) or {}).get("articles") or [])
        if isinstance(payload, dict)
        else []
    )
    documents: list[dict[str, Any]] = []
    for article in articles:
        if len(documents) >= MAX_DOCS_PER_SOURCE or not isinstance(article, dict):
            break
        title = str(article.get("article") or "").replace("_", " ").strip()
        if not _is_wikipedia_article_title(title):
            continue
        rank = int(article.get("rank") or 0)
        views = int(article.get("views") or 0)
        try:
            summary = _fetch_wikipedia_summary(title)
        except RuntimeError:
            fallback_bits = ["Popular on Wikipedia right now."]
            if rank:
                fallback_bits.append(f"Rank {rank}.")
            if views:
                fallback_bits.append(f"{views} views.")
            summary = _fallback_wikipedia_summary(
                title,
                excerpt=" ".join(fallback_bits),
            )
        documents.append({
            "id": f"{source['id']}::{_slugify(title)[:56]}",
            "sourceId": source["id"],
            "sourceName": source["label"],
            "sourceFamily": source["family"],
            "title": summary["title"],
            "url": summary["url"],
            "excerpt": summary["excerpt"],
            "publishedAt": isoformat(),
            "author": "",
            "tags": [summary["description"]] if summary["description"] else [],
            "language": "en",
            "weight": 1.0 + min(3.0, float(views) / 250_000.0),
            "engagement": {
                "views": views,
                "rank": rank,
            },
            "rawTopicHints": [*source.get("topicHints", []), summary["description"]],
        })
    return documents


def _fetch_wikipedia_recent_changes(source: dict[str, Any]) -> list[dict[str, Any]]:
    feed = fetch_rss_feed(str(source.get("feedUrl") or ""))
    seen_titles: set[str] = set()
    documents: list[dict[str, Any]] = []
    for item in feed.get("items") or []:
        if len(documents) >= MAX_DOCS_PER_SOURCE:
            break
        title = compact_text(str(item.get("title") or ""), 160)
        if not _is_wikipedia_article_title(title):
            continue
        normalized_title = title.lower()
        if normalized_title in seen_titles:
            continue
        seen_titles.add(normalized_title)
        item_url = str(item.get("url") or "").strip()
        item_excerpt = compact_text(str(item.get("summary") or ""), 280)
        try:
            summary = _fetch_wikipedia_summary(title)
        except RuntimeError:
            summary = _fallback_wikipedia_summary(title, excerpt=item_excerpt, url=item_url)
        documents.append({
            "id": f"{source['id']}::{_slugify(title)[:56]}",
            "sourceId": source["id"],
            "sourceName": source["label"],
            "sourceFamily": source["family"],
            "title": summary["title"],
            "url": summary["url"],
            "excerpt": compact_text(summary["excerpt"] or item_excerpt, 280),
            "publishedAt": str(item.get("publishedAt") or "") or isoformat(),
            "author": "",
            "tags": [summary["description"]] if summary["description"] else [],
            "language": "en",
            "weight": 1.0,
            "engagement": {},
            "rawTopicHints": [*source.get("topicHints", []), summary["description"]],
        })
    return documents


def _fetch_wikipedia_summary(title: str) -> dict[str, str]:
    global _WIKIPEDIA_SUMMARY_BACKOFF_UNTIL
    normalized_title = title.replace(" ", "_")
    cached = _WIKIPEDIA_SUMMARY_CACHE.get(normalized_title)
    if cached is not None:
        return dict(cached)
    now = datetime.now(timezone.utc)
    if _WIKIPEDIA_SUMMARY_BACKOFF_UNTIL and now < _WIKIPEDIA_SUMMARY_BACKOFF_UNTIL:
        raise RuntimeError("Wikipedia summaries are temporarily rate-limited.")
    try:
        payload = _fetch_json(
            f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(normalized_title, safe='')}",
            f"Wikipedia summary for {title}",
            MAX_WIKIPEDIA_BYTES,
        )
    except RuntimeError as exc:
        if "status 429" in str(exc):
            _WIKIPEDIA_SUMMARY_BACKOFF_UNTIL = now + timedelta(minutes=15)
            raise RuntimeError("Wikipedia summaries are temporarily rate-limited.") from exc
        raise
    if not isinstance(payload, dict):
        raise RuntimeError(f"Wikipedia summary for {title} was invalid.")
    _WIKIPEDIA_SUMMARY_BACKOFF_UNTIL = None
    extract = compact_text(str(payload.get("extract") or ""), 280)
    description = compact_text(str(payload.get("description") or ""), 100)
    page_url = (
        (((payload.get("content_urls") or {}).get("desktop") or {}).get("page"))
        if isinstance(payload.get("content_urls"), dict)
        else ""
    )
    summary = {
        "title": compact_text(str(payload.get("title") or title), 160),
        "excerpt": extract,
        "description": description,
        "url": str(page_url or f"https://en.wikipedia.org/wiki/{quote(normalized_title, safe='')}"),
    }
    _remember_wikipedia_summary(normalized_title, summary)
    return dict(summary)


def _remember_wikipedia_summary(cache_key: str, summary: dict[str, str]) -> None:
    _WIKIPEDIA_SUMMARY_CACHE.pop(cache_key, None)
    _WIKIPEDIA_SUMMARY_CACHE[cache_key] = dict(summary)
    while len(_WIKIPEDIA_SUMMARY_CACHE) > MAX_WIKIPEDIA_SUMMARY_CACHE:
        oldest_key = next(iter(_WIKIPEDIA_SUMMARY_CACHE))
        _WIKIPEDIA_SUMMARY_CACHE.pop(oldest_key, None)


def _fallback_wikipedia_summary(
    title: str,
    *,
    excerpt: str = "",
    url: str = "",
) -> dict[str, str]:
    normalized_title = title.replace(" ", "_")
    return {
        "title": compact_text(title or "Wikipedia article", 160),
        "excerpt": compact_text(excerpt, 280),
        "description": "",
        "url": str(url or f"https://en.wikipedia.org/wiki/{quote(normalized_title, safe='')}"),
    }


def _fetch_json(url: str, label: str, max_bytes: int) -> dict[str, Any]:
    fetched = fetch_safe_url_bytes(
        url,
        headers={
            "User-Agent": HTTP_USER_AGENT,
            "Accept": "application/json",
        },
        timeout=DEFAULT_FETCH_TIMEOUT,
        max_bytes=max_bytes,
        label=label,
    )
    try:
        payload = json.loads(fetched.body.decode(fetched.encoding or "utf-8", errors="replace"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{label} returned invalid JSON.") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"{label} returned an unexpected payload.")
    return payload


def _build_graph_payload(documents: list[dict[str, Any]], generated_at: str) -> dict[str, Any]:
    if not documents:
        return _empty_graph(generated_at)

    topic_buckets: dict[str, dict[str, Any]] = {}
    document_topics: dict[str, list[str]] = {}
    document_candidates: dict[str, list[dict[str, str]]] = {}
    document_lookup = {document["id"]: document for document in documents}

    for document in documents:
        topic_candidates = _extract_topic_candidates(document)
        document_candidates[document["id"]] = topic_candidates
        topic_keys: list[str] = []
        seen_topic_keys: set[str] = set()
        domain = _extract_domain(str(document.get("url") or ""))
        for rank, candidate in enumerate(topic_candidates):
            key = candidate["key"]
            if not key or key in seen_topic_keys:
                continue
            seen_topic_keys.add(key)
            topic_keys.append(key)
            bucket = topic_buckets.setdefault(key, {
                "labels": Counter(),
                "topicClasses": Counter(),
                "supportPhrases": Counter(),
                "score": 0.0,
                "docs": set(),
                "families": set(),
                "sources": set(),
                "domains": set(),
                "latest": "",
            })
            weight = max(0.75, 3.2 - rank * 0.42)
            bucket["labels"][candidate["label"]] += weight
            bucket["topicClasses"][candidate["topicClass"]] += weight
            bucket["score"] += float(document.get("weight") or 1.0) + weight
            bucket["docs"].add(document["id"])
            bucket["families"].add(document.get("sourceFamily") or "")
            bucket["sources"].add(document.get("sourceName") or "")
            if domain:
                bucket["domains"].add(domain)
            if candidate["origin"] in {"title-entity", "title-keyword", "hint"} or " " in candidate["label"]:
                bucket["supportPhrases"][candidate["label"]] += weight
            latest = str(document.get("publishedAt") or "")
            if latest > str(bucket["latest"] or ""):
                bucket["latest"] = latest
        document_topics[document["id"]] = topic_keys

    corpus_family_count = len({
        document.get("sourceFamily") for document in documents if document.get("sourceFamily")
    })

    ranked_topics = []
    for key, bucket in topic_buckets.items():
        profile = _build_topic_profile(key, bucket, document_lookup, corpus_family_count)
        if profile is None:
            continue
        ranked_topics.append((key, profile["score"], bucket, profile))
    if not ranked_topics:
        # Low-signal corpus: fall back to best-effort topics so the graph is never
        # silently empty while documents exist.
        for key, bucket in topic_buckets.items():
            profile = _build_topic_profile(key, bucket, document_lookup, corpus_family_count, relaxed=True)
            if profile is None:
                continue
            ranked_topics.append((key, profile["score"], bucket, profile))
    ranked_topics.sort(key=lambda item: (item[1], str(item[2]["latest"] or "")), reverse=True)

    selected_topics = ranked_topics[:MAX_TOPICS]
    if not selected_topics:
        return _empty_graph(generated_at)

    selected_topic_keys = {item[0] for item in selected_topics}
    selected_profiles = {
        key: profile
        for key, _score, _bucket, profile in selected_topics
    }
    selected_scores = {
        key: score
        for key, score, _bucket, _profile in selected_topics
    }
    root_node_specs, assigned_children_by_parent = _plan_selected_topic_hierarchy(
        selected_topics,
        selected_profiles,
        selected_scores,
    )

    overview_nodes: list[dict[str, Any]] = []
    child_nodes: list[dict[str, Any]] = []
    for node_spec in root_node_specs:
        node_payload, descendants = _build_graph_tree_nodes(
            node_spec["key"],
            node_spec,
            depth=0,
            parent_id=None,
            assigned_children_by_parent=assigned_children_by_parent,
            selected_profiles=selected_profiles,
            selected_scores=selected_scores,
            selected_topic_keys=selected_topic_keys,
            document_candidates=document_candidates,
            document_lookup=document_lookup,
            ancestor_keys=set(),
        )
        overview_nodes.append(node_payload)
        child_nodes.extend(descendants)

    edge_buckets: dict[tuple[str, str], dict[str, Any]] = {}
    for document_id, topic_keys in document_topics.items():
        selected = [key for key in topic_keys if key in selected_topic_keys][:5]
        if len(selected) < 2:
            continue
        document = document_lookup[document_id]
        domain = _extract_domain(str(document.get("url") or ""))
        for left_index in range(len(selected) - 1):
            for right_index in range(left_index + 1, len(selected)):
                left_key = selected[left_index]
                right_key = selected[right_index]
                edge_key = (left_key, right_key) if left_key < right_key else (right_key, left_key)
                bucket = edge_buckets.setdefault(edge_key, {
                    "count": 0,
                    "docs": set(),
                    "families": set(),
                    "domains": set(),
                    "sharedEntities": Counter(),
                    "storyPhrases": Counter(),
                })
                bucket["count"] += 1
                bucket["docs"].add(document_id)
                bucket["families"].add(document.get("sourceFamily") or "")
                if domain:
                    bucket["domains"].add(domain)
                for candidate in document_candidates.get(document_id, []):
                    candidate_key = candidate["key"]
                    if not candidate_key or candidate_key in edge_key:
                        continue
                    if candidate["topicClass"] == "entity" and not _is_generic_topic_key(candidate_key):
                        bucket["sharedEntities"][_canonical_topic_label(candidate_key, candidate["label"])] += 1
                    elif candidate["topicClass"] == "story":
                        bucket["storyPhrases"][_canonical_topic_label(candidate_key, candidate["label"])] += 1

    edges: list[dict[str, Any]] = []
    edge_profiles: list[dict[str, Any]] = []
    for (left_key, right_key), bucket in edge_buckets.items():
        left_profile = selected_profiles.get(left_key)
        right_profile = selected_profiles.get(right_key)
        if left_profile is None or right_profile is None:
            continue
        edge_profile = _build_edge_profile(
            left_key,
            right_key,
            left_profile,
            right_profile,
            bucket,
            document_lookup,
        )
        if edge_profile is None:
            continue
        edge_profiles.append(edge_profile)
    edge_profiles.sort(
        key=lambda edge: (
            edge["confidence"],
            edge["weight"],
            len(edge["evidenceIds"]),
        ),
        reverse=True,
    )
    edges.extend(edge_profiles[:MAX_EDGES])

    summary_sources = Counter(document.get("sourceFamily") or "other" for document in documents)
    top_families = ", ".join(
        family for family, _count in summary_sources.most_common(3) if family
    ) or "current sources"
    lenses = _build_lenses(overview_nodes, edges)
    return {
        "title": f"Thendral · {datetime.now(timezone.utc).strftime('%b %d %H:%M UTC')}",
        "summary": (
            f"{len(documents)} items distilled into {len(overview_nodes)} primary branches "
            f"with {len(child_nodes)} expandable subnodes from {top_families}."
        ),
        "nodes": [*overview_nodes, *child_nodes],
        "edges": edges,
        "lenses": lenses,
        "generatedAt": generated_at,
    }


def _empty_graph(generated_at: str) -> dict[str, Any]:
    return {
        "title": "Thendral",
        "summary": "No recurring topics emerged from the latest fetch. Enable more sources or refresh again later.",
        "nodes": [],
        "edges": [],
        "lenses": [],
        "generatedAt": generated_at,
    }


def _extract_topic_candidates(document: dict[str, Any]) -> list[dict[str, str]]:
    title = str(document.get("title") or "")
    excerpt = str(document.get("excerpt") or "")
    hints = [str(item).strip() for item in document.get("rawTopicHints", []) if str(item).strip()]
    candidate_specs: list[tuple[str, str]] = []
    candidate_specs.extend((compact_text(match.group(0), 60), "title-entity") for match in list(CAPITALIZED_PHRASE_RE.finditer(title))[:4])
    candidate_specs.extend((compact_text(match.group(0), 60), "excerpt-entity") for match in list(CAPITALIZED_PHRASE_RE.finditer(excerpt))[:2])
    candidate_specs.extend((hint, "hint") for hint in hints)

    # Fall back to keyword phrases from the title if proper nouns are sparse.
    keywords = [
        word
        for word in WORD_RE.findall(title)
        if word.lower() not in TOPIC_STOPWORDS and len(word) > 2
    ]
    candidate_specs.extend((keyword, "title-keyword") for keyword in keywords[:3])
    if len(keywords) >= 2:
        candidate_specs.extend(
            (f"{keywords[index]} {keywords[index + 1]}", "title-keyword-pair")
            for index in range(min(2, len(keywords) - 1))
        )

    deduped: list[dict[str, str]] = []
    seen: set[str] = set()
    for candidate, origin in candidate_specs:
        built = _build_topic_candidate(candidate, origin)
        if built is None or built["key"] in seen:
            continue
        seen.add(built["key"])
        deduped.append(built)
    return deduped[:8]


def _build_topic_candidate(label: str, origin: str) -> dict[str, str] | None:
    cleaned = compact_text(label, 60)
    key = _normalize_topic_key(cleaned)
    if not cleaned or not key:
        return None
    return {
        "label": cleaned,
        "key": key,
        "origin": origin,
        "topicClass": _classify_candidate_label(cleaned, key, origin),
    }


def _classify_candidate_label(label: str, key: str, origin: str) -> str:
    if key in SOURCE_BURST_KEYS or "announcement" in key or key.endswith(" updates"):
        return "source-burst"
    if key in KNOWN_THEME_KEYS:
        return "theme"
    if _looks_like_story_key(key):
        return "story"
    if key in KNOWN_ENTITY_KEYS:
        return "entity"
    if label.isupper() and len(label) <= 5:
        return "theme" if key in KNOWN_THEME_KEYS else "entity"
    if CAPITALIZED_PHRASE_RE.fullmatch(label) and len(key.split()) <= 3:
        return "entity"
    if origin.startswith("title") and len(key.split()) <= 2 and not _is_generic_topic_key(key):
        return "entity"
    if origin == "hint" and not _is_generic_topic_key(key):
        return "entity"
    return "theme"


def _build_topic_profile(
    key: str,
    bucket: dict[str, Any],
    document_lookup: dict[str, dict[str, Any]],
    corpus_family_count: int = 6,
    relaxed: bool = False,
) -> dict[str, Any] | None:
    doc_ids = sorted(
        bucket["docs"],
        key=lambda doc_id: str(document_lookup[doc_id].get("publishedAt") or ""),
        reverse=True,
    )
    doc_count = len(doc_ids)
    source_families = _ordered_families(bucket["families"])
    source_family_count = len(source_families)
    source_count = len(bucket["sources"])
    domain_count = len([domain for domain in bucket["domains"] if domain])
    topic_class = (
        bucket["topicClasses"].most_common(1)[0][0]
        if bucket["topicClasses"]
        else _classify_candidate_label(key, key, "keyword")
    )
    label = _canonical_topic_label(key, bucket["labels"].most_common(1)[0][0] if bucket["labels"] else key)
    support_phrases: list[str] = []
    for raw_label, _count in bucket["supportPhrases"].most_common(12):
        phrase_key = _normalize_topic_key(raw_label)
        if not phrase_key:
            continue
        display = _canonical_topic_label(phrase_key, raw_label)
        if display == label or display in support_phrases:
            continue
        if _is_generic_topic_key(phrase_key) and len(phrase_key.split()) < 2:
            continue
        support_phrases.append(display)
    alternate_labels: list[str] = []
    for raw_label, _count in bucket["labels"].most_common(10):
        display = compact_text(raw_label, 60)
        if not display or display == label or display in alternate_labels:
            continue
        if _normalize_topic_key(display) == key:
            continue
        alternate_labels.append(display)

    if relaxed:
        if _is_generic_topic_key(key) or doc_count < 2:
            return None
    elif _should_suppress_topic(
        key,
        topic_class,
        doc_count=doc_count,
        source_family_count=source_family_count,
        domain_count=domain_count,
        support_phrases=support_phrases,
        corpus_family_count=corpus_family_count,
    ):
        return None

    total_score = (
        float(bucket["score"])
        + doc_count * 0.55
        + source_family_count * 2.15
        + domain_count * 1.35
        + source_count * 0.3
    )
    if topic_class == "entity":
        total_score += 1.6
    elif topic_class == "story":
        total_score += 0.9
    elif topic_class == "source-burst":
        total_score -= 1.4
    else:
        total_score -= 0.35
    if _is_generic_topic_key(key):
        total_score -= 2.8

    notes = f"{doc_count} items · {source_family_count} families · {_topic_class_label(topic_class)}"
    explanation = (
        f"{_topic_class_label(topic_class)} recurring across {doc_count} items "
        f"from {source_count} sources and {domain_count} domains."
    )
    if support_phrases:
        explanation += f" Repeated cues include {', '.join(support_phrases[:2])}."
    return {
        "key": key,
        "label": label,
        "topicClass": topic_class,
        "alternateLabels": alternate_labels[:4],
        "supportPhrases": support_phrases[:4],
        "notes": notes,
        "explanation": explanation,
        "score": round(total_score, 2),
        "sourceFamilies": source_families,
        "sourceCount": source_count,
        "sourceFamilyCount": source_family_count,
        "domainCount": domain_count,
        "evidenceIds": doc_ids[:8],
        "docIds": doc_ids,
    }


def _topic_profile_to_node_spec(
    key: str,
    profile: dict[str, Any],
    total_score: float,
) -> dict[str, Any]:
    return {
        "key": key,
        "id": f"topic:{key}",
        "label": profile["label"],
        "notes": profile["notes"],
        "explanation": profile["explanation"],
        "weight": round(total_score, 2),
        "sourceFamilies": profile["sourceFamilies"],
        "sourceCount": profile["sourceCount"],
        "sourceFamilyCount": profile["sourceFamilyCount"],
        "domainCount": profile["domainCount"],
        "topicClass": profile["topicClass"],
        "alternateLabels": profile["alternateLabels"],
        "supportPhrases": profile["supportPhrases"],
        "evidenceIds": profile["evidenceIds"],
        "docIds": profile["docIds"],
    }


def _plan_selected_topic_hierarchy(
    selected_topics: list[tuple[str, float, dict[str, Any], dict[str, Any]]],
    selected_profiles: dict[str, dict[str, Any]],
    selected_scores: dict[str, float],
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    ordered_topics = sorted(
        selected_topics,
        key=lambda item: (item[1], len(item[3].get("docIds") or [])),
        reverse=True,
    )
    topic_branch_scores = {
        key: _build_topic_branch_candidates(key, profile)
        for key, _score, _bucket, profile in selected_topics
    }
    explicit_branch_parents = {
        key: key
        for key, _score, _bucket, profile in selected_topics
        if key in BRANCH_KEYS and profile["topicClass"] != "entity"
    }
    parent_assignments: dict[str, str] = {}
    explicit_parent_keys = set(explicit_branch_parents.values())

    synthetic_branch_specs = _build_synthetic_branch_specs(
        ordered_topics,
        selected_profiles,
        selected_scores,
        topic_branch_scores,
        explicit_branch_parents,
        parent_assignments,
    )
    synthetic_branch_parents = {
        branch_key: spec["key"]
        for branch_key, spec in synthetic_branch_specs.items()
    }
    synthetic_parent_keys = set(synthetic_branch_parents.values())

    for child_key, _child_score, _bucket, child_profile in ordered_topics:
        if child_key in parent_assignments or child_key in synthetic_parent_keys:
            continue
        best_parent_key = ""
        best_score = 0.0
        for branch_key, parent_key in synthetic_branch_parents.items():
            if parent_key == child_key:
                continue
            branch_score = float(topic_branch_scores.get(child_key, {}).get(branch_key) or 0.0)
            if branch_score < BRANCH_MIN_ASSIGNMENT_SCORE:
                continue
            if child_profile["topicClass"] == "theme" and branch_score < 3.0:
                continue
            if branch_score > best_score:
                best_parent_key = parent_key
                best_score = branch_score
        if best_parent_key:
            parent_assignments[child_key] = best_parent_key

    for child_key, _child_score, _bucket, child_profile in ordered_topics:
        if child_key in parent_assignments or child_key in explicit_parent_keys or child_key in synthetic_parent_keys:
            continue
        best_parent_key = ""
        best_score = 0.0
        for branch_key, parent_key in explicit_branch_parents.items():
            branch_score = float(topic_branch_scores.get(child_key, {}).get(branch_key) or 0.0)
            if branch_score < BRANCH_MIN_ASSIGNMENT_SCORE:
                continue
            if child_profile["topicClass"] == "theme" and branch_score < 3.0:
                continue
            if branch_score > best_score:
                best_parent_key = parent_key
                best_score = branch_score
        if best_parent_key:
            parent_assignments[child_key] = best_parent_key

    _assign_branch_nodes_to_broader_parents(
        explicit_branch_parents,
        synthetic_branch_specs,
        parent_assignments,
    )

    fallback_assignments = _assign_selected_topic_parents(selected_topics)
    for child_key, parent_key in fallback_assignments.items():
        if child_key in parent_assignments:
            continue
        if child_key in explicit_parent_keys or child_key in synthetic_parent_keys:
            continue
        parent_assignments[child_key] = parent_key

    assigned_children_by_parent: dict[str, list[str]] = {}
    for child_key, parent_key in parent_assignments.items():
        assigned_children_by_parent.setdefault(parent_key, []).append(child_key)

    root_node_specs = [
        node_spec
        for node_spec in [
            *[
                _topic_profile_to_node_spec(key, profile, total_score)
                for key, total_score, _bucket, profile in selected_topics
            ],
            *synthetic_branch_specs.values(),
        ]
        if node_spec["key"] not in parent_assignments
    ]
    root_node_specs.sort(key=lambda item: (item["weight"], item["label"]), reverse=True)
    return root_node_specs, assigned_children_by_parent


def _build_topic_branch_candidates(
    key: str,
    profile: dict[str, Any],
) -> dict[str, float]:
    scores: Counter[str] = Counter()
    variants = {key}
    for raw_value in [profile.get("label"), *(profile.get("alternateLabels") or []), *(profile.get("supportPhrases") or [])]:
        normalized = _normalize_topic_key(str(raw_value or ""))
        if normalized:
            variants.add(normalized)

    if key in BRANCH_KEYS and profile["topicClass"] != "entity":
        scores[key] += 3.6
    if key in BRANCH_PARENT_KEYS and profile["topicClass"] != "entity":
        scores[BRANCH_PARENT_KEYS[key]] += 2.15

    for parent_key in PREFERRED_PARENT_TOPIC_KEYS.get(key, set()):
        scores[parent_key] += 2.4
    if key in COMPANY_ENTITY_KEYS:
        scores["technology"] += 1.05
    if key in AI_STACK_KEYS:
        scores["ai"] += 0.9

    for variant in variants:
        variant_words = set(variant.split())
        for branch_key in BRANCH_KEYS:
            if variant == branch_key:
                scores[branch_key] += 3.1 if profile["topicClass"] != "entity" else 1.1
                continue
            branch_hints = BRANCH_HINTS.get(branch_key, set())
            if variant in branch_hints:
                scores[branch_key] += 1.5
                continue
            hint_tokens = {token for hint in branch_hints for token in hint.split()}
            overlap = len(variant_words.intersection(hint_tokens))
            if overlap > 0:
                scores[branch_key] += 0.42 * overlap

    return {
        branch_key: round(score, 2)
        for branch_key, score in scores.items()
        if score >= 0.75
    }


def _build_synthetic_branch_specs(
    ordered_topics: list[tuple[str, float, dict[str, Any], dict[str, Any]]],
    selected_profiles: dict[str, dict[str, Any]],
    selected_scores: dict[str, float],
    topic_branch_scores: dict[str, dict[str, float]],
    explicit_branch_parents: dict[str, str],
    existing_assignments: dict[str, str],
) -> dict[str, dict[str, Any]]:
    explicit_parent_keys = set(explicit_branch_parents.values())
    branch_groups: dict[str, dict[str, Any]] = {}
    for child_key, _child_score, _bucket, child_profile in ordered_topics:
        if child_key in existing_assignments or child_key in explicit_parent_keys:
            if child_key not in BRANCH_PARENT_KEYS:
                continue
        if child_profile["topicClass"] not in {"entity", "story"} and child_key not in BRANCH_PARENT_KEYS:
            continue
        eligible_branches = [
            (branch_key, branch_score)
            for branch_key, branch_score in topic_branch_scores.get(child_key, {}).items()
            if branch_key not in explicit_branch_parents and branch_score >= BRANCH_MIN_ASSIGNMENT_SCORE
        ]
        if not eligible_branches:
            continue
        eligible_branches.sort(
            key=lambda item: (
                item[1],
                1 if item[0] in BRANCH_PARENT_KEYS else 0,
                1 if item[0] == "technology" else 0,
            ),
            reverse=True,
        )
        branch_key, branch_score = eligible_branches[0]
        group = branch_groups.setdefault(branch_key, {
            "memberScores": {},
        })
        previous_score = float(group["memberScores"].get(child_key) or 0.0)
        if branch_score > previous_score:
            group["memberScores"][child_key] = branch_score

    synthetic_specs: dict[str, dict[str, Any]] = {}
    for branch_key, group in branch_groups.items():
        member_scores = group["memberScores"]
        member_keys = [
            key
            for key, _score, _bucket, _profile in ordered_topics
            if key in member_scores
        ]
        if branch_key in BRANCH_PARENT_KEYS and not any(
            selected_profiles.get(key, {}).get("topicClass") != "entity"
            for key in member_keys
        ):
            continue
        if len(member_keys) < BRANCH_MIN_SYNTHETIC_MEMBERS:
            continue
        total_group_score = sum(
            float(member_scores[key]) + float(selected_scores.get(key) or 0.0) * 0.06
            for key in member_keys
        )
        if total_group_score < BRANCH_MIN_SYNTHETIC_GROUP_SCORE:
            continue
        synthetic_spec = _build_synthetic_branch_spec(
            branch_key,
            member_keys,
            selected_profiles,
            selected_scores,
        )
        if synthetic_spec is not None:
            synthetic_specs[branch_key] = synthetic_spec
    return synthetic_specs


def _build_synthetic_branch_spec(
    branch_key: str,
    member_keys: list[str],
    selected_profiles: dict[str, dict[str, Any]],
    selected_scores: dict[str, float],
) -> dict[str, Any] | None:
    profiles = [
        selected_profiles[key]
        for key in member_keys
        if key in selected_profiles
    ]
    if len(profiles) < BRANCH_MIN_SYNTHETIC_MEMBERS:
        return None

    doc_ids: list[str] = []
    seen_doc_ids: set[str] = set()
    families: set[str] = set()
    source_count = 0
    domain_count = 0
    member_labels: list[str] = []
    support_phrases: list[str] = []
    for member_key in member_keys:
        profile = selected_profiles.get(member_key)
        if profile is None:
            continue
        member_labels.append(profile["label"])
        families.update(profile.get("sourceFamilies") or [])
        source_count += int(profile.get("sourceCount") or 0)
        domain_count = max(domain_count, int(profile.get("domainCount") or 0))
        for doc_id in profile.get("docIds") or []:
            if doc_id in seen_doc_ids:
                continue
            seen_doc_ids.add(doc_id)
            doc_ids.append(doc_id)
        for phrase in [profile["label"], *(profile.get("supportPhrases") or [])]:
            if phrase in support_phrases:
                continue
            support_phrases.append(phrase)

    label = _canonical_topic_label(branch_key, branch_key)
    branch_weight = round(
        sum(float(selected_scores.get(member_key) or 0.0) * 0.72 for member_key in member_keys)
        + len(member_keys) * 1.2
        + len(families) * 0.8,
        2,
    )
    preview_labels = ", ".join(member_labels[:3])
    explanation = (
        f"Synthetic {_topic_class_label('theme').lower()} combining {preview_labels} "
        f"under a broader {label} branch."
    )
    if len(member_labels) > 3:
        explanation += f" Plus {len(member_labels) - 3} related subtopics."
    return {
        "key": f"branch:{branch_key}",
        "id": f"topic:branch:{branch_key}",
        "label": label,
        "notes": f"{len(member_keys)} grouped subtopics · {len(doc_ids)} items · Theme branch",
        "explanation": explanation,
        "weight": branch_weight,
        "sourceFamilies": _ordered_families(families),
        "sourceCount": max(source_count, len(doc_ids)),
        "sourceFamilyCount": len(families),
        "domainCount": domain_count,
        "topicClass": "theme",
        "alternateLabels": member_labels[:4],
        "supportPhrases": support_phrases[:4],
        "evidenceIds": doc_ids[:8],
        "docIds": doc_ids,
    }


def _assign_branch_nodes_to_broader_parents(
    explicit_branch_parents: dict[str, str],
    synthetic_branch_specs: dict[str, dict[str, Any]],
    parent_assignments: dict[str, str],
) -> None:
    available_branch_targets: dict[str, str] = {}
    for branch_key, parent_key in explicit_branch_parents.items():
        available_branch_targets.setdefault(branch_key, parent_key)
    for branch_key, node_spec in synthetic_branch_specs.items():
        available_branch_targets.setdefault(branch_key, node_spec["key"])

    candidate_node_keys = [
        *explicit_branch_parents.values(),
        *(node_spec["key"] for node_spec in synthetic_branch_specs.values()),
    ]
    for node_key in candidate_node_keys:
        if node_key in parent_assignments:
            continue
        branch_key = _hierarchy_branch_key(node_key)
        if not branch_key:
            continue
        parent_branch_key = BRANCH_PARENT_KEYS.get(branch_key)
        if not parent_branch_key:
            continue
        parent_node_key = available_branch_targets.get(parent_branch_key)
        if not parent_node_key or parent_node_key == node_key:
            continue
        parent_assignments[node_key] = parent_node_key


def _hierarchy_branch_key(key: str) -> str:
    if key.startswith("branch:"):
        return key.split(":", 1)[1].strip()
    return key if key in BRANCH_KEYS else ""


def _assign_selected_topic_parents(
    selected_topics: list[tuple[str, float, dict[str, Any], dict[str, Any]]],
) -> dict[str, str]:
    assignments: dict[str, str] = {}
    ordered_children = sorted(
        selected_topics,
        key=lambda item: (item[1], len(item[3].get("docIds") or [])),
    )
    for child_key, child_score, _bucket, child_profile in ordered_children:
        best_parent_key = ""
        best_parent_score = 0.0
        for parent_key, parent_score, _parent_bucket, parent_profile in selected_topics:
            if parent_key == child_key:
                continue
            affinity = _selected_topic_parent_affinity(
                parent_key,
                parent_profile,
                parent_score,
                child_key,
                child_profile,
                child_score,
            )
            if affinity <= best_parent_score:
                continue
            if parent_key in assignments and assignments[parent_key] == child_key:
                continue
            best_parent_key = parent_key
            best_parent_score = affinity
        if best_parent_key and best_parent_score >= 0.9:
            assignments[child_key] = best_parent_key
    return assignments


def _selected_topic_parent_affinity(
    parent_key: str,
    parent_profile: dict[str, Any],
    parent_score: float,
    child_key: str,
    child_profile: dict[str, Any],
    child_score: float,
) -> float:
    if not parent_key or not child_key or parent_key == child_key:
        return 0.0
    if parent_profile["topicClass"] == "entity" and child_profile["topicClass"] == "entity":
        return 0.0
    if parent_score <= child_score * 0.75:
        return 0.0

    parent_doc_ids = set(parent_profile.get("docIds") or [])
    child_doc_ids = set(child_profile.get("docIds") or [])
    if not parent_doc_ids or not child_doc_ids:
        return 0.0
    shared_doc_count = len(parent_doc_ids.intersection(child_doc_ids))
    if shared_doc_count < 2:
        return 0.0

    child_overlap = shared_doc_count / max(1, len(child_doc_ids))
    parent_overlap = shared_doc_count / max(1, len(parent_doc_ids))
    if child_overlap < 0.42:
        return 0.0

    score = child_overlap * 0.9 + min(0.38, parent_overlap * 0.46)
    if child_profile["topicClass"] == "entity" and parent_profile["topicClass"] in {"theme", "story"}:
        score += 0.28
    elif child_profile["topicClass"] == "story" and parent_profile["topicClass"] == "theme":
        score += 0.14
    elif parent_profile["topicClass"] == "entity":
        score -= 0.26

    if child_key in PREFERRED_PARENT_TOPIC_KEYS and parent_key in PREFERRED_PARENT_TOPIC_KEYS[child_key]:
        score += 0.34
    if set(child_profile.get("sourceFamilies") or []).issubset(set(parent_profile.get("sourceFamilies") or [])):
        score += 0.06
    if len(parent_key.split()) <= len(child_key.split()):
        score += 0.04
    return score


def _build_graph_tree_nodes(
    key: str,
    node_spec: dict[str, Any],
    *,
    depth: int,
    parent_id: str | None,
    assigned_children_by_parent: dict[str, list[str]],
    selected_profiles: dict[str, dict[str, Any]],
    selected_scores: dict[str, float],
    selected_topic_keys: set[str],
    document_candidates: dict[str, list[dict[str, str]]],
    document_lookup: dict[str, dict[str, Any]],
    ancestor_keys: set[str],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    current_ancestors = set(ancestor_keys)
    current_ancestors.add(key)
    child_specs: list[dict[str, Any]] = []

    if depth < MAX_GRAPH_DEPTH - 1:
        assigned_child_keys = assigned_children_by_parent.get(key, [])
        for child_key in assigned_child_keys:
            child_profile = selected_profiles.get(child_key)
            if child_profile is None or child_key in current_ancestors:
                continue
            child_specs.append(
                _topic_profile_to_node_spec(
                    child_key,
                    child_profile,
                    selected_scores.get(child_key, child_profile.get("score") or 0.0),
                )
            )

        if not assigned_child_keys:
            excluded_keys = set(selected_topic_keys)
            excluded_keys.update(current_ancestors)
            child_specs.extend(
                _build_topic_children(
                    key,
                    node_spec,
                    document_candidates,
                    document_lookup,
                    selected_topic_keys,
                    excluded_keys=excluded_keys,
                )
            )

    child_specs.sort(key=lambda item: (item["weight"], item["label"]), reverse=True)
    child_specs = child_specs[:MAX_CHILDREN_PER_NODE]

    node_payload = {
        "id": node_spec["id"],
        "kind": "topic" if depth == 0 else "subtopic",
        "label": node_spec["label"],
        "notes": node_spec["notes"],
        "explanation": node_spec["explanation"],
        "weight": round(float(node_spec["weight"]), 2),
        "sourceFamilies": node_spec["sourceFamilies"],
        "sourceCount": node_spec["sourceCount"],
        "sourceFamilyCount": node_spec["sourceFamilyCount"],
        "domainCount": node_spec["domainCount"],
        "topicClass": node_spec["topicClass"],
        "alternateLabels": node_spec["alternateLabels"],
        "supportPhrases": node_spec["supportPhrases"],
        "parentId": parent_id,
        "depth": depth,
        "collapsedChildCount": len(child_specs),
        "evidenceIds": node_spec["evidenceIds"],
    }

    descendants: list[dict[str, Any]] = []
    for child_spec in child_specs:
        child_payload, nested_descendants = _build_graph_tree_nodes(
            child_spec["key"],
            child_spec,
            depth=depth + 1,
            parent_id=node_spec["id"],
            assigned_children_by_parent=assigned_children_by_parent,
            selected_profiles=selected_profiles,
            selected_scores=selected_scores,
            selected_topic_keys=selected_topic_keys,
            document_candidates=document_candidates,
            document_lookup=document_lookup,
            ancestor_keys=current_ancestors,
        )
        descendants.append(child_payload)
        descendants.extend(nested_descendants)
    return node_payload, descendants


def _build_topic_children(
    parent_key: str,
    parent_profile: dict[str, Any],
    document_candidates: dict[str, list[dict[str, str]]],
    document_lookup: dict[str, dict[str, Any]],
    selected_topic_keys: set[str],
    *,
    excluded_keys: set[str] | None = None,
) -> list[dict[str, Any]]:
    child_buckets: dict[str, dict[str, Any]] = {}
    excluded = excluded_keys or set()
    for doc_id in parent_profile["docIds"]:
        document = document_lookup.get(doc_id)
        if document is None:
            continue
        domain = _extract_domain(str(document.get("url") or ""))
        for rank, candidate in enumerate(document_candidates.get(doc_id, [])):
            child_key = candidate["key"]
            if not child_key or child_key == parent_key or child_key in excluded:
                continue
            bucket = child_buckets.setdefault(child_key, {
                "labels": Counter(),
                "topicClasses": Counter(),
                "supportPhrases": Counter(),
                "score": 0.0,
                "docs": set(),
                "families": set(),
                "domains": set(),
            })
            weight = max(0.45, 2.35 - rank * 0.28)
            if child_key in selected_topic_keys:
                weight -= 0.25
            bucket["labels"][candidate["label"]] += weight
            bucket["topicClasses"][candidate["topicClass"]] += weight
            bucket["score"] += weight + float(document.get("weight") or 1.0) * 0.22
            bucket["docs"].add(doc_id)
            bucket["families"].add(document.get("sourceFamily") or "")
            if domain:
                bucket["domains"].add(domain)
            if candidate["origin"] in {"title-entity", "title-keyword"} or " " in candidate["label"]:
                bucket["supportPhrases"][candidate["label"]] += weight

    children: list[dict[str, Any]] = []
    for child_key, bucket in child_buckets.items():
        doc_ids = sorted(
            bucket["docs"],
            key=lambda doc_id: str(document_lookup[doc_id].get("publishedAt") or ""),
            reverse=True,
        )
        doc_count = len(doc_ids)
        source_families = _ordered_families(bucket["families"])
        source_family_count = len(source_families)
        domain_count = len([domain for domain in bucket["domains"] if domain])
        if _should_suppress_child_candidate(
            parent_key,
            child_key,
            doc_count=doc_count,
            source_family_count=source_family_count,
            selected_topic_keys=selected_topic_keys,
        ):
            continue
        topic_class = (
            bucket["topicClasses"].most_common(1)[0][0]
            if bucket["topicClasses"]
            else _classify_candidate_label(child_key, child_key, "keyword")
        )
        label = _canonical_topic_label(child_key, bucket["labels"].most_common(1)[0][0] if bucket["labels"] else child_key)
        support_phrases: list[str] = []
        for raw_label, _count in bucket["supportPhrases"].most_common(8):
            phrase_key = _normalize_topic_key(raw_label)
            if not phrase_key:
                continue
            display = _canonical_topic_label(phrase_key, raw_label)
            if display == label or display in support_phrases:
                continue
            support_phrases.append(display)
        weight = (
            float(bucket["score"])
            + doc_count * 0.42
            + source_family_count * 0.75
            + domain_count * 0.4
            + (0.0 if child_key not in selected_topic_keys else -0.8)
        )
        children.append({
            "key": child_key,
            "id": f"topic:{parent_key}::child:{_slugify(child_key)[:40]}",
            "label": label,
            "notes": f"{doc_count} supporting items inside {parent_profile['label']}.",
            "explanation": (
                f"Recurring inside {parent_profile['label']} across {doc_count} supporting items "
                f"and {source_family_count} source families."
            ),
            "weight": weight,
            "sourceFamilies": source_families,
            "sourceCount": doc_count,
            "sourceFamilyCount": source_family_count,
            "domainCount": domain_count,
            "topicClass": topic_class,
            "alternateLabels": [],
            "supportPhrases": support_phrases[:3],
            "evidenceIds": doc_ids[:6],
            "docIds": doc_ids,
        })
    children.sort(key=lambda item: (item["weight"], item["label"]), reverse=True)
    return children[:MAX_SUBTOPICS_PER_TOPIC]


def _build_edge_profile(
    left_key: str,
    right_key: str,
    left_profile: dict[str, Any],
    right_profile: dict[str, Any],
    bucket: dict[str, Any],
    document_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    evidence_ids = sorted(
        bucket["docs"],
        key=lambda doc_id: str(document_lookup[doc_id].get("publishedAt") or ""),
        reverse=True,
    )[:8]
    doc_count = len(bucket["docs"])
    source_family_count = len([family for family in bucket["families"] if family])
    domain_count = len([domain for domain in bucket["domains"] if domain])
    if doc_count == 0:
        return None
    shared_entities = [
        label
        for label, count in bucket["sharedEntities"].most_common(3)
        if count >= 2
    ]
    story_phrases = [
        label
        for label, count in bucket["storyPhrases"].most_common(3)
        if count >= 2
    ]

    relation_kind = "cooccurrence"
    if (
        left_profile["topicClass"] == "entity"
        or right_profile["topicClass"] == "entity"
    ) and doc_count >= 2:
        relation_kind = "shared-actor"
    elif source_family_count >= 3 and domain_count >= 3 and doc_count >= 3:
        relation_kind = "cross-source-corroboration"
    elif (shared_entities or story_phrases or left_profile["topicClass"] == "story" or right_profile["topicClass"] == "story") and doc_count >= 3:
        relation_kind = "shared-story"

    confidence = min(
        0.98,
        0.26
        + doc_count * 0.07
        + source_family_count * 0.08
        + domain_count * 0.045
        + (0.12 if relation_kind != "cooccurrence" else 0.0),
    )
    if relation_kind == "shared-actor":
        repeated_actors = shared_entities or [
            profile["label"]
            for profile in (left_profile, right_profile)
            if profile["topicClass"] == "entity"
        ]
        explanation = (
            f"Recurring actor-led link across {doc_count} shared items, {source_family_count} families, "
            f"and {domain_count} domains."
        )
        if repeated_actors:
            explanation += f" Mostly shaped by {', '.join(repeated_actors[:2])}."
    elif relation_kind == "cross-source-corroboration":
        explanation = (
            f"Corroborated across {source_family_count} source families and {domain_count} domains "
            f"through {doc_count} shared items."
        )
    elif relation_kind == "shared-story":
        explanation = f"These topics keep reappearing inside the same evolving story across {doc_count} items."
        if story_phrases:
            explanation += f" Story cues include {', '.join(story_phrases[:2])}."
    else:
        explanation = (
            f"Weak co-occurrence across {doc_count} shared items; treat this as an exploratory tie rather than a strong claim."
        )

    return {
        "id": f"edge:{left_key}:{right_key}",
        "source": f"topic:{left_key}",
        "target": f"topic:{right_key}",
        "type": relation_kind,
        "weight": round(
            doc_count
            + source_family_count * 0.65
            + domain_count * 0.28
            + (0.8 if relation_kind != "cooccurrence" else 0.0),
            2,
        ),
        "confidence": round(confidence, 2),
        "notes": explanation,
        "explanation": explanation,
        "sourceFamilyCount": source_family_count,
        "domainCount": domain_count,
        "sharedEntityLabels": shared_entities[:3],
        "evidenceIds": evidence_ids,
    }


def _build_lenses(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    node_by_id = {node["id"]: node for node in nodes}
    lenses: list[dict[str, Any]] = []

    corroboration_nodes = [
        node["id"]
        for node in nodes
        if int(node.get("sourceFamilyCount") or 0) >= 3 or int(node.get("domainCount") or 0) >= 4
    ]
    corroboration_edges = [
        edge
        for edge in edges
        if edge["type"] == "cross-source-corroboration"
        or (int(edge.get("sourceFamilyCount") or 0) >= 3 and int(edge.get("domainCount") or 0) >= 3)
    ]
    if corroboration_nodes or corroboration_edges:
        lenses.append({
            "id": "cross-family-corroboration",
            "label": "Cross-family corroboration",
            "description": "Highlights topics and links that hold up across multiple source families and domains.",
            "nodeIds": corroboration_nodes,
            "edgeIds": [edge["id"] for edge in corroboration_edges],
            "pathGroups": _build_path_groups(corroboration_edges, node_by_id),
            "defaultOff": True,
        })

    discourse_families = {"news", "blogs", "reddit"}
    company_edges = []
    company_node_ids: set[str] = set()
    for edge in edges:
        source_node = node_by_id.get(edge["source"])
        target_node = node_by_id.get(edge["target"])
        if source_node is None or target_node is None:
            continue
        source_key = _normalize_topic_key(str(source_node.get("label") or ""))
        target_key = _normalize_topic_key(str(target_node.get("label") or ""))
        source_is_company = "companies" in source_node.get("sourceFamilies", []) or source_key in COMPANY_ENTITY_KEYS
        target_is_company = "companies" in target_node.get("sourceFamilies", []) or target_key in COMPANY_ENTITY_KEYS
        source_is_discourse = discourse_families.intersection(source_node.get("sourceFamilies", []))
        target_is_discourse = discourse_families.intersection(target_node.get("sourceFamilies", []))
        if source_is_company and target_is_discourse:
            company_edges.append(edge)
            company_node_ids.update([edge["source"], edge["target"]])
        elif target_is_company and source_is_discourse:
            company_edges.append(edge)
            company_node_ids.update([edge["source"], edge["target"]])
    if company_edges:
        lenses.append({
            "id": "company-discourse-chain",
            "label": "Company to discourse chain",
            "description": "Highlights places where company signals spill into newsrooms, blogs, or Reddit discussion.",
            "nodeIds": sorted(company_node_ids),
            "edgeIds": [edge["id"] for edge in company_edges],
            "pathGroups": _build_path_groups(company_edges, node_by_id),
            "defaultOff": True,
        })

    ai_nodes = [node for node in nodes if _matches_ai_stack(node)]
    ai_node_ids = {node["id"] for node in ai_nodes}
    ai_edges = [
        edge
        for edge in edges
        if edge["source"] in ai_node_ids and edge["target"] in ai_node_ids
    ]
    if len(ai_node_ids) >= 2:
        lenses.append({
            "id": "ai-platform-stack",
            "label": "AI / platform stack",
            "description": "Highlights recurring AI, platform, and developer-ecosystem structures.",
            "nodeIds": sorted(ai_node_ids),
            "edgeIds": [edge["id"] for edge in ai_edges],
            "pathGroups": _build_path_groups(ai_edges, node_by_id),
            "defaultOff": True,
        })

    story_edges = [
        edge
        for edge in edges
        if edge["type"] in {"shared-story", "shared-actor"} and float(edge.get("confidence") or 0) >= 0.58
    ]
    if story_edges:
        story_node_ids = sorted({node_id for edge in story_edges for node_id in [edge["source"], edge["target"]]})
        lenses.append({
            "id": "single-story-cluster",
            "label": "Single-story cluster",
            "description": "Highlights denser local structures driven by one evolving story or actor.",
            "nodeIds": story_node_ids,
            "edgeIds": [edge["id"] for edge in story_edges],
            "pathGroups": _build_path_groups(story_edges, node_by_id),
            "defaultOff": True,
        })

    return lenses


def _build_path_groups(edges: list[dict[str, Any]], node_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    ordered = sorted(edges, key=lambda edge: (edge.get("confidence", 0), edge.get("weight", 0)), reverse=True)
    for edge in ordered[:6]:
        source_label = str(node_by_id.get(edge["source"], {}).get("label") or "Topic")
        target_label = str(node_by_id.get(edge["target"], {}).get("label") or "Topic")
        groups.append({
            "id": edge["id"],
            "label": f"{source_label} <-> {target_label}",
            "description": str(edge.get("notes") or ""),
            "nodeIds": [edge["source"], edge["target"]],
            "edgeIds": [edge["id"]],
        })
    return groups


def _matches_ai_stack(node: dict[str, Any]) -> bool:
    candidate_keys = {
        _normalize_topic_key(str(node.get("label") or "")),
        *(
            _normalize_topic_key(str(item or ""))
            for item in [*(node.get("supportPhrases") or []), *(node.get("alternateLabels") or [])]
        ),
    }
    return any(key in AI_STACK_KEYS for key in candidate_keys if key)


def _extract_domain(url: str) -> str:
    try:
        parsed = urlparse(url)
    except ValueError:
        return ""
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def _ordered_families(families: set[str]) -> list[str]:
    return [family for family in SOURCE_ORDER if family in families]


def _topic_class_label(topic_class: str) -> str:
    if topic_class == "entity":
        return "Entity cluster"
    if topic_class == "story":
        return "Story strand"
    if topic_class == "source-burst":
        return "Burst signal"
    return "Theme cluster"


def _canonical_topic_label(key: str, raw_label: str) -> str:
    if key in CANONICAL_TOPIC_LABELS:
        return CANONICAL_TOPIC_LABELS[key]
    cleaned = compact_text(raw_label or key, 60).strip()
    if cleaned.isupper() and len(cleaned) <= 6:
        return cleaned
    return " ".join(
        CANONICAL_TOPIC_LABELS.get(word, word.capitalize())
        for word in key.split()
    )


def _looks_like_story_key(key: str) -> bool:
    parts = set(key.split())
    return any(part in STORY_HINT_WORDS for part in parts)


def _is_generic_topic_key(key: str) -> bool:
    if not key:
        return True
    if key in TOPIC_BLACKLIST or key in GENERIC_TOPIC_KEYS or key in GENERIC_DEMONYMS:
        return True
    if key.endswith(" news") or key.endswith(" updates"):
        return True
    return False


def _should_suppress_topic(
    key: str,
    topic_class: str,
    *,
    doc_count: int,
    source_family_count: int,
    domain_count: int,
    support_phrases: list[str],
    corpus_family_count: int = 6,
) -> bool:
    # Family-diversity requirements are capped by how many families exist in the
    # corpus at all, so a single-family selection can still produce a graph.
    family_floor = min(2, max(1, corpus_family_count))
    diverse = source_family_count >= family_floor
    if doc_count < 2 and not diverse:
        return True
    if topic_class == "source-burst" and not diverse:
        return True
    if _is_generic_topic_key(key):
        if (
            doc_count < 10
            or source_family_count < min(4, max(1, corpus_family_count))
            or domain_count < (6 if corpus_family_count >= 2 else 3)
            or len(support_phrases) < 2
        ):
            return True
    if key in {"technology", "software", "culture", "media", "business", "public life", "entertainment", "open source", "internet culture"}:
        if not diverse or domain_count < 2:
            return True
    if topic_class == "entity" and not diverse and doc_count < 5:
        return True
    if topic_class == "theme" and not diverse and doc_count < 12:
        return True
    if topic_class == "theme" and len(key.split()) == 1 and doc_count < 4 and not diverse:
        return True
    if topic_class == "theme" and len(support_phrases) == 0 and doc_count < 4 and source_family_count < min(3, max(1, corpus_family_count)):
        return True
    return False


def _should_suppress_child_candidate(
    parent_key: str,
    child_key: str,
    *,
    doc_count: int,
    source_family_count: int,
    selected_topic_keys: set[str],
) -> bool:
    if not child_key or child_key == parent_key:
        return True
    if child_key in SOURCE_BURST_KEYS:
        return True
    if _is_generic_topic_key(child_key) and len(child_key.split()) < 2:
        return True
    if doc_count < 3 and source_family_count < 2:
        return True
    if child_key in selected_topic_keys and doc_count < 3 and source_family_count < 2:
        return True
    return False


def _normalize_topic_key(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
    cleaned = TOPIC_ALIAS.get(cleaned, cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned or cleaned in TOPIC_BLACKLIST:
        return ""
    if all(part in TOPIC_STOPWORDS for part in cleaned.split()):
        return ""
    return cleaned


def _is_wikipedia_article_title(title: str) -> bool:
    clean = str(title or "").strip()
    if not clean or ":" in clean:
        return False
    lowered = clean.lower()
    if lowered in {"main page", "special"}:
        return False
    return True


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")
