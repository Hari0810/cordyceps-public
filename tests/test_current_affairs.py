import unittest
from unittest import mock

from api import current_affairs


class CurrentAffairsTests(unittest.TestCase):
    def setUp(self) -> None:
        current_affairs._WIKIPEDIA_SUMMARY_CACHE.clear()

    def _topic_profile(
        self,
        key: str,
        label: str,
        topic_class: str,
        *,
        score: float,
        doc_ids: list[str],
        source_families: list[str],
        domain_count: int,
        support_phrases: list[str] | None = None,
    ) -> dict[str, object]:
        phrases = support_phrases or []
        return {
            "key": key,
            "label": label,
            "topicClass": topic_class,
            "alternateLabels": [],
            "supportPhrases": phrases,
            "notes": f"{len(doc_ids)} items",
            "explanation": f"{label} coverage",
            "score": score,
            "sourceFamilies": source_families,
            "sourceCount": len(doc_ids),
            "sourceFamilyCount": len(source_families),
            "domainCount": domain_count,
            "evidenceIds": doc_ids[:8],
            "docIds": doc_ids,
        }

    def _document(
        self,
        doc_id: str,
        title: str,
        source_family: str,
        published_at: str,
    ) -> dict[str, object]:
        return {
            "id": doc_id,
            "sourceId": doc_id,
            "sourceName": doc_id,
            "sourceFamily": source_family,
            "title": title,
            "url": f"https://example.com/{doc_id}",
            "excerpt": "",
            "publishedAt": published_at,
            "author": "",
            "tags": [],
            "language": "en",
            "weight": 1.0,
            "engagement": {},
            "rawTopicHints": [],
        }

    def test_fetch_current_affairs_graph_dedupes_repeated_errors(self) -> None:
        sources = (
            {
                "id": "source-a",
                "label": "Source A",
                "family": "news",
                "description": "Source A",
                "defaultEnabled": True,
                "available": True,
                "kind": "rss",
            },
            {
                "id": "source-b",
                "label": "Source B",
                "family": "reddit",
                "description": "Source B",
                "defaultEnabled": True,
                "available": True,
                "kind": "rss",
            },
            {
                "id": "source-x",
                "label": "Source X",
                "family": "x",
                "description": "Source X",
                "defaultEnabled": False,
                "available": False,
                "kind": "x",
                "reason": "Official X API access is not configured in this build.",
            },
        )

        def raise_reddit_error(_source: dict[str, object]) -> list[dict[str, object]]:
            raise RuntimeError("The Reddit listing request failed with status 403.")

        with mock.patch.object(current_affairs, "SOURCE_REGISTRY", sources):
            with mock.patch("api.current_affairs._fetch_source_documents", side_effect=raise_reddit_error):
                payload = current_affairs.fetch_current_affairs_graph(["source-a", "source-b", "source-x"])

        self.assertEqual(
            payload["warnings"],
            ["The Reddit listing request failed with status 403. (2 sources)"],
        )
        disabled_source = next(item for item in payload["sources"] if item["id"] == "source-x")
        self.assertEqual(disabled_source["status"], "disabled")
        self.assertEqual(disabled_source["error"], "")
        self.assertEqual(
            disabled_source["reason"],
            "Official X API access is not configured in this build.",
        )

    def test_fetch_wikipedia_top_read_falls_back_when_summary_fails(self) -> None:
        source = {
            "id": "wikipedia-top-read",
            "label": "Wikipedia Top Read",
            "family": "wikipedia",
            "topicHints": ["wikipedia", "attention"],
        }
        top_read_payload = {
            "items": [{
                "articles": [{
                    "article": "Guthuk",
                    "views": 321,
                    "rank": 5,
                }],
            }],
        }

        def fake_fetch_json(url: str, _label: str, _max_bytes: int) -> dict[str, object]:
            if "metrics/pageviews/top" in url:
                return top_read_payload
            raise RuntimeError("Wikipedia summary for Guthuk request failed with status 429.")

        with mock.patch("api.current_affairs._fetch_json", side_effect=fake_fetch_json):
            documents = current_affairs._fetch_wikipedia_top_read(source)

        self.assertEqual(len(documents), 1)
        document = documents[0]
        self.assertEqual(document["title"], "Guthuk")
        self.assertEqual(document["url"], "https://en.wikipedia.org/wiki/Guthuk")
        self.assertIn("Popular on Wikipedia right now.", document["excerpt"])
        self.assertEqual(document["engagement"]["rank"], 5)
        self.assertEqual(document["engagement"]["views"], 321)

    def test_fetch_wikipedia_recent_changes_falls_back_to_feed_metadata(self) -> None:
        source = {
            "id": "wikipedia-recent-changes",
            "label": "Wikipedia Recent Changes",
            "family": "wikipedia",
            "feedUrl": "https://en.wikipedia.org/w/index.php?title=Special:RecentChanges&feed=rss",
            "topicHints": ["wikipedia", "recent updates"],
        }
        feed = {
            "items": [{
                "title": "Guthuk",
                "url": "https://en.wikipedia.org/wiki/Guthuk",
                "summary": "Recent edits expanded the article.",
                "publishedAt": "2026-05-30T09:00:00Z",
            }],
        }

        with mock.patch("api.current_affairs.fetch_rss_feed", return_value=feed):
            with mock.patch(
                "api.current_affairs._fetch_wikipedia_summary",
                side_effect=RuntimeError("Wikipedia summary for Guthuk request failed with status 429."),
            ):
                documents = current_affairs._fetch_wikipedia_recent_changes(source)

        self.assertEqual(len(documents), 1)
        document = documents[0]
        self.assertEqual(document["title"], "Guthuk")
        self.assertEqual(document["url"], "https://en.wikipedia.org/wiki/Guthuk")
        self.assertIn("Recent edits expanded the article.", document["excerpt"])

    def test_fetch_wikipedia_summary_uses_cache(self) -> None:
        payload = {
            "title": "Guthuk",
            "extract": "Guthuk is a settlement in South Sudan.",
            "description": "village in South Sudan",
            "content_urls": {
                "desktop": {
                    "page": "https://en.wikipedia.org/wiki/Guthuk",
                },
            },
        }

        with mock.patch("api.current_affairs._fetch_json", return_value=payload) as mock_fetch_json:
            first = current_affairs._fetch_wikipedia_summary("Guthuk")
            second = current_affairs._fetch_wikipedia_summary("Guthuk")

        self.assertEqual(mock_fetch_json.call_count, 1)
        self.assertEqual(first["title"], "Guthuk")
        self.assertEqual(first, second)

    def test_plan_selected_topic_hierarchy_synthesizes_technology_parent(self) -> None:
        selected_topics = [
            (
                "ai",
                15.2,
                {},
                self._topic_profile(
                    "ai",
                    "AI",
                    "theme",
                    score=15.2,
                    doc_ids=["doc-1", "doc-2", "doc-3", "doc-4", "doc-5"],
                    source_families=["news", "blogs", "companies"],
                    domain_count=4,
                    support_phrases=["developer stack", "model releases"],
                ),
            ),
            (
                "apple",
                11.6,
                {},
                self._topic_profile(
                    "apple",
                    "Apple",
                    "entity",
                    score=11.6,
                    doc_ids=["doc-1", "doc-2"],
                    source_families=["news", "blogs"],
                    domain_count=2,
                    support_phrases=["WWDC", "App Store"],
                ),
            ),
            (
                "google",
                11.1,
                {},
                self._topic_profile(
                    "google",
                    "Google",
                    "entity",
                    score=11.1,
                    doc_ids=["doc-3", "doc-4"],
                    source_families=["news", "companies"],
                    domain_count=2,
                    support_phrases=["Gemini", "developer tools"],
                ),
            ),
            (
                "meta",
                10.8,
                {},
                self._topic_profile(
                    "meta",
                    "Meta",
                    "entity",
                    score=10.8,
                    doc_ids=["doc-4", "doc-5"],
                    source_families=["news", "companies"],
                    domain_count=2,
                    support_phrases=["social platforms", "AI models"],
                ),
            ),
        ]
        selected_profiles = {
            key: profile
            for key, _score, _bucket, profile in selected_topics
        }
        selected_scores = {
            key: score
            for key, score, _bucket, _profile in selected_topics
        }

        root_node_specs, assigned_children_by_parent = current_affairs._plan_selected_topic_hierarchy(
            selected_topics,
            selected_profiles,
            selected_scores,
        )

        root_keys = {node_spec["key"] for node_spec in root_node_specs}
        self.assertIn("branch:technology", root_keys)
        self.assertNotIn("apple", root_keys)
        self.assertNotIn("google", root_keys)
        self.assertNotIn("meta", root_keys)
        self.assertNotIn("ai", root_keys)
        self.assertEqual(
            set(assigned_children_by_parent["branch:technology"]),
            {"ai", "apple", "google", "meta"},
        )

    def test_build_graph_payload_keeps_company_topics_under_technology(self) -> None:
        documents = [
            self._document("apple-news", "Apple platform moves", "news", "2026-06-03T20:00:00Z"),
            self._document("apple-companies", "Apple platform moves", "companies", "2026-06-03T19:00:00Z"),
            self._document("meta-companies", "Meta AI push", "companies", "2026-06-03T18:00:00Z"),
            self._document("meta-blogs", "Meta AI push", "blogs", "2026-06-03T17:00:00Z"),
            self._document("google-news", "Google Gemini developer tools", "news", "2026-06-03T16:00:00Z"),
            self._document("google-blogs", "Google Gemini developer tools", "blogs", "2026-06-03T15:00:00Z"),
            self._document("openai-blogs", "OpenAI agents API stack", "blogs", "2026-06-03T14:00:00Z"),
            self._document("openai-reddit", "OpenAI agents API stack", "reddit", "2026-06-03T13:00:00Z"),
            self._document("policy-news", "Policy pressure on platforms", "news", "2026-06-03T12:00:00Z"),
            self._document("policy-reddit", "Policy pressure on platforms", "reddit", "2026-06-03T11:00:00Z"),
        ]
        candidates = {
            "apple-news": [
                {"key": "apple", "label": "Apple", "origin": "title-entity", "topicClass": "entity"},
                {"key": "software", "label": "Software", "origin": "hint", "topicClass": "theme"},
            ],
            "apple-companies": [
                {"key": "apple", "label": "Apple", "origin": "title-entity", "topicClass": "entity"},
                {"key": "software", "label": "Software", "origin": "hint", "topicClass": "theme"},
            ],
            "meta-companies": [
                {"key": "meta", "label": "Meta", "origin": "title-entity", "topicClass": "entity"},
                {"key": "ai", "label": "AI", "origin": "hint", "topicClass": "theme"},
            ],
            "meta-blogs": [
                {"key": "meta", "label": "Meta", "origin": "title-entity", "topicClass": "entity"},
                {"key": "ai", "label": "AI", "origin": "hint", "topicClass": "theme"},
            ],
            "google-news": [
                {"key": "google", "label": "Google", "origin": "title-entity", "topicClass": "entity"},
                {"key": "developer", "label": "Developer", "origin": "hint", "topicClass": "theme"},
            ],
            "google-blogs": [
                {"key": "google", "label": "Google", "origin": "title-entity", "topicClass": "entity"},
                {"key": "developer", "label": "Developer", "origin": "hint", "topicClass": "theme"},
            ],
            "openai-blogs": [
                {"key": "openai", "label": "OpenAI", "origin": "title-entity", "topicClass": "entity"},
                {"key": "agents", "label": "Agents", "origin": "hint", "topicClass": "theme"},
                {"key": "api", "label": "API", "origin": "hint", "topicClass": "theme"},
            ],
            "openai-reddit": [
                {"key": "openai", "label": "OpenAI", "origin": "title-entity", "topicClass": "entity"},
                {"key": "agents", "label": "Agents", "origin": "hint", "topicClass": "theme"},
                {"key": "api", "label": "API", "origin": "hint", "topicClass": "theme"},
            ],
            "policy-news": [
                {"key": "policy", "label": "Policy", "origin": "hint", "topicClass": "story"},
                {"key": "regulation", "label": "Regulation", "origin": "hint", "topicClass": "story"},
            ],
            "policy-reddit": [
                {"key": "policy", "label": "Policy", "origin": "hint", "topicClass": "story"},
                {"key": "regulation", "label": "Regulation", "origin": "hint", "topicClass": "story"},
            ],
        }

        with mock.patch("api.current_affairs._extract_topic_candidates", side_effect=lambda document: candidates[document["id"]]):
            graph = current_affairs._build_graph_payload(documents, "2026-06-03T20:55:00Z")

        root_nodes = [node for node in graph["nodes"] if not node.get("parentId")]
        root_ids = {node["id"] for node in root_nodes}
        self.assertEqual(root_ids, {"topic:branch:technology", "topic:policy"})

        child_parent_by_label = {
            node["label"]: node.get("parentId")
            for node in graph["nodes"]
            if node.get("parentId")
        }
        self.assertEqual(child_parent_by_label["Apple"], "topic:branch:technology")
        self.assertEqual(child_parent_by_label["Meta"], "topic:branch:technology")
        self.assertEqual(child_parent_by_label["Google"], "topic:branch:technology")
        self.assertEqual(child_parent_by_label["OpenAI"], "topic:branch:technology")
        self.assertNotIn("topic:branch:media", root_ids)
        self.assertNotIn("topic:branch:business", root_ids)


if __name__ == "__main__":
    unittest.main()
