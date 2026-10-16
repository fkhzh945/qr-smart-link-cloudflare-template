#!/usr/bin/env python3
"""Offline safety checks for the downstream update allowlist."""
import io
import os
import pathlib
import runpy
import tempfile
import unittest
import unittest.mock as mock
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SYNC = ROOT / "scripts" / "sync-upstream.py"


def archive_bytes():
    blob = io.BytesIO()
    with zipfile.ZipFile(blob, "w") as z:
        prefix = "upstream-main/"
        z.writestr(prefix + "admin/src/i18n.js", "export const LANGUAGES = 10;\n")
        z.writestr(prefix + "worker/src/index.js", "// new API\n")
        z.writestr(prefix + "migrations/0001_initial.sql", "SELECT 1;\n")
        z.writestr(prefix + "admin/index.html", "<div>updated</div>")
        z.writestr(prefix + "wrangler.jsonc", '{"database_id":"ATTACK"}')
        z.writestr(prefix + ".dev.vars", "SENSITIVE=ATTACK")
    return blob.getvalue()


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


class SyncSafetyTest(unittest.TestCase):
    def test_only_allowlisted_paths_change(self):
        source = SYNC.read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / "scripts").mkdir()
            (root / "scripts" / "sync-upstream.py").write_text(source, encoding="utf-8")
            (root / "wrangler.jsonc").write_text('{"database_id":"PRESERVE"}')
            (root / ".dev.vars").write_text("SENSITIVE=PRESERVE")
            (root / "admin/src").mkdir(parents=True)
            (root / "admin/src/obsolete.js").write_text("old")
            with mock.patch.dict(os.environ, {"GITHUB_REPOSITORY": "customer/my-qr-app"}):
                with mock.patch("urllib.request.urlopen", return_value=Response(archive_bytes())):
                    runpy.run_path(str(root / "scripts/sync-upstream.py"), run_name="__main__")
            self.assertEqual((root / "wrangler.jsonc").read_text(), '{"database_id":"PRESERVE"}')
            self.assertEqual((root / ".dev.vars").read_text(), "SENSITIVE=PRESERVE")
            self.assertFalse((root / "admin/src/obsolete.js").exists())
            self.assertIn("LANGUAGES = 10", (root / "admin/src/i18n.js").read_text())
            self.assertEqual((root / "admin/index.html").read_text(), "<div>updated</div>")
            self.assertIn("SELECT 1", (root / "migrations/0001_initial.sql").read_text())


if __name__ == "__main__":
    unittest.main()
