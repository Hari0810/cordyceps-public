import json
import tempfile
import unittest
from pathlib import Path

import serve


class LocalHelperScopeTests(unittest.TestCase):
    def test_notification_scheduler_preserves_push_copy(self) -> None:
        normalized = serve.normalize_notification_reminders({
            "items": [
                {
                    "id": "verbatim:2099-01-01",
                    "kind": "verbatim",
                    "dueAt": "2099-01-01T18:00:00Z",
                    "url": "/?page=tamil",
                    "title": "Verbatim",
                    "body": "Five translations left.",
                    "tag": "cordyceps-verbatim",
                }
            ]
        })

        self.assertEqual(len(normalized["items"]), 1)
        reminder = normalized["items"][0]
        self.assertEqual(reminder["title"], "Verbatim")
        self.assertEqual(reminder["body"], "Five translations left.")
        self.assertEqual(reminder["tag"], "cordyceps-verbatim")

        payload = serve.build_notification_scheduler_payload(reminder, serve.utc_now())

        self.assertEqual(payload["title"], "Verbatim")
        self.assertEqual(payload["body"], "Five translations left.")
        self.assertEqual(payload["tag"], "cordyceps-verbatim")
        self.assertEqual(payload["data"]["kind"], "verbatim")

    def test_push_registry_migrates_legacy_state_into_scoped_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            legacy_file = data_dir / "local_push_state.json"
            serve.LocalPushStore(legacy_file).set_alerts_enabled(False)

            registry = serve.LocalPushStoreRegistry(data_dir)
            scoped_store = registry.get_store("https://app.one")
            response = scoped_store.set_test_push_enabled(True)

            scoped_path = data_dir / f"local_push_state-{serve._scoped_state_id('https://app.one')}.json"
            stored = json.loads(scoped_path.read_text(encoding='utf-8'))

            self.assertFalse(legacy_file.exists())
            self.assertTrue(scoped_path.exists())
            self.assertTrue(response["alerts"]["testPushEnabled"])
            self.assertEqual(stored["scopeOrigin"], "https://app.one")

            other_store = registry.get_store("https://app.two")
            other_response = other_store.set_alerts_enabled(True)

            self.assertTrue(other_response["alerts"]["enabled"])
            self.assertFalse(other_response["alerts"]["testPushEnabled"])

    def test_banking_registry_persists_state_per_origin(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            registry = serve.LocalBankingStoreRegistry(data_dir)

            first_store = registry.get_store("https://app.one")
            first_store.update({
                "provider": "csv",
                "connectionProvider": "csv",
                "connectionStatus": "csv-imported",
                "lastSyncResult": "Imported 3 transactions from CSV.",
            })

            second_store = registry.get_store("https://app.two")
            self.assertEqual(second_store.snapshot()["provider"], "")

            reloaded_registry = serve.LocalBankingStoreRegistry(data_dir)
            reloaded_first = reloaded_registry.get_store("https://app.one")
            reloaded_state = reloaded_first.snapshot()

            self.assertEqual(reloaded_state["provider"], "csv")
            self.assertEqual(reloaded_state["connectionStatus"], "csv-imported")
            self.assertEqual(reloaded_state["scopeOrigin"], "https://app.one")


if __name__ == "__main__":
    unittest.main()
