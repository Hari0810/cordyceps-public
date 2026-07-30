import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
HELPER_ENV_VARS = {
    "CORDYCEPS_ENABLE_OUTLOOK_HELPER",
    "CORDYCEPS_ENABLE_BANKING_HELPER",
}


def read_helper_flags(extra_env: dict[str, str] | None = None) -> dict[str, bool]:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_root = Path(tmpdir)
        shutil.copy2(REPO_ROOT / "serve.py", tmp_root / "serve.py")
        shutil.copytree(REPO_ROOT / "api", tmp_root / "api", ignore=shutil.ignore_patterns("__pycache__"))

        env = {key: value for key, value in os.environ.items() if key not in HELPER_ENV_VARS}
        if extra_env:
            env.update(extra_env)

        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json, serve; "
                    "print(json.dumps({"
                    "'rss': serve.ENABLE_RSS_HELPER, "
                    "'outlook': serve.ENABLE_OUTLOOK_HELPER, "
                    "'banking': serve.ENABLE_BANKING_HELPER"
                    "}))"
                ),
            ],
            cwd=tmp_root,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)


class HelperEnvDefaultTests(unittest.TestCase):
    def test_new_install_defaults_enable_only_rss_helper(self) -> None:
        flags = read_helper_flags()

        self.assertTrue(flags["rss"])
        self.assertFalse(flags["outlook"])
        self.assertFalse(flags["banking"])


if __name__ == "__main__":
    unittest.main()
