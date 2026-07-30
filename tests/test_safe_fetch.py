import socket
import unittest
from unittest import mock

from api import rss


class FakeResponse:
    def __init__(
        self,
        url: str,
        *,
        status_code: int = 200,
        headers: dict[str, str] | None = None,
        body: bytes = b"",
        encoding: str = "utf-8",
    ) -> None:
        self.url = url
        self.status_code = status_code
        self.headers = {str(key).lower(): str(value) for key, value in (headers or {}).items()}
        self.encoding = encoding
        self._body = body
        self.closed = False

    @property
    def is_redirect(self) -> bool:
        return self.status_code in {301, 302, 303, 307, 308} and "location" in self.headers

    @property
    def is_permanent_redirect(self) -> bool:
        return self.status_code in {301, 308} and "location" in self.headers

    def iter_content(self, chunk_size: int = 65536):
        for index in range(0, len(self._body), chunk_size):
            yield self._body[index:index + chunk_size]

    def close(self) -> None:
        self.closed = True


def _safe_addrinfo(host: str, *_args, **_kwargs):
    safe_hosts = {
        "example.com": "93.184.216.34",
        "cdn.example.com": "93.184.216.35",
    }
    if host in safe_hosts:
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (safe_hosts[host], 0))]
    if host == "127.0.0.1":
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))]
    raise socket.gaierror(host)


class SafeFetchTests(unittest.TestCase):
    @mock.patch("api.rss.socket.getaddrinfo")
    def test_validate_safe_url_rejects_any_private_resolution(self, mock_getaddrinfo: mock.Mock) -> None:
        mock_getaddrinfo.return_value = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0)),
        ]

        with self.assertRaisesRegex(ValueError, "private or reserved"):
            rss._validate_safe_url("https://example.com/feed.xml")

    @mock.patch("api.rss.requests.get")
    @mock.patch("api.rss.socket.getaddrinfo", side_effect=_safe_addrinfo)
    def test_fetch_safe_url_bytes_revalidates_redirect_targets(
        self,
        _mock_getaddrinfo: mock.Mock,
        mock_requests_get: mock.Mock,
    ) -> None:
        mock_requests_get.return_value = FakeResponse(
            "https://example.com/feed.xml",
            status_code=302,
            headers={"location": "http://127.0.0.1/private"},
        )

        with self.assertRaisesRegex(ValueError, "private or reserved"):
            rss.fetch_safe_url_bytes(
                "https://example.com/feed.xml",
                max_bytes=1024,
                label="feed",
            )

        self.assertEqual(mock_requests_get.call_count, 1)

    @mock.patch("api.rss.requests.get")
    @mock.patch("api.rss.socket.getaddrinfo", side_effect=_safe_addrinfo)
    def test_fetch_safe_url_bytes_follows_safe_redirects(
        self,
        _mock_getaddrinfo: mock.Mock,
        mock_requests_get: mock.Mock,
    ) -> None:
        mock_requests_get.side_effect = [
            FakeResponse(
                "https://example.com/feed.xml",
                status_code=302,
                headers={"location": "https://cdn.example.com/feed.xml"},
            ),
            FakeResponse(
                "https://cdn.example.com/feed.xml",
                status_code=200,
                headers={"content-type": "application/xml"},
                body=b"<rss><channel><title>Feed</title></channel></rss>",
            ),
        ]

        fetched = rss.fetch_safe_url_bytes(
            "https://example.com/feed.xml",
            max_bytes=2048,
            label="feed",
        )

        self.assertEqual(fetched.url, "https://cdn.example.com/feed.xml")
        self.assertEqual(fetched.content_type, "application/xml")
        self.assertIn(b"<rss>", fetched.body)
        self.assertEqual(mock_requests_get.call_count, 2)

    @mock.patch("api.rss.requests.get")
    @mock.patch("api.rss.socket.getaddrinfo", side_effect=_safe_addrinfo)
    def test_fetch_safe_url_bytes_rejects_oversized_payloads(
        self,
        _mock_getaddrinfo: mock.Mock,
        mock_requests_get: mock.Mock,
    ) -> None:
        mock_requests_get.return_value = FakeResponse(
            "https://example.com/feed.xml",
            status_code=200,
            headers={"content-length": "4096"},
            body=b"ok",
        )

        with self.assertRaisesRegex(RuntimeError, "too large"):
            rss.fetch_safe_url_bytes(
                "https://example.com/feed.xml",
                max_bytes=1024,
                label="feed",
            )


if __name__ == "__main__":
    unittest.main()
