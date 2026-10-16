#!/usr/bin/env python3
"""Sync only application source from the official public template. Never touch deployment config."""
import os, pathlib, urllib.request, io, zipfile, shutil

UPSTREAM = "fkhzh945/qr-smart-link-cloudflare-template"
BASE = pathlib.Path(__file__).resolve().parents[1]
ALLOWED_DIRS = ("admin/src", "worker/src", "migrations")
ALLOWED_FILES = ("admin/index.html",)
if os.environ.get("GITHUB_REPOSITORY") == UPSTREAM:
    print("Upstream repository: skipping self-update")
    raise SystemExit(0)

url = f"https://api.github.com/repos/{UPSTREAM}/zipball/main"
headers = {"User-Agent": "QR-Smart-Link-Lite-Updater", "Accept": "application/vnd.github+json"}
with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
    payload = response.read(15 * 1024 * 1024 + 1)
if len(payload) > 15 * 1024 * 1024:
    raise SystemExit("Upstream package too large")
with zipfile.ZipFile(io.BytesIO(payload)) as archive:
    members = archive.namelist()
    prefix = members[0].split("/")[0] + "/"
    for folder in ALLOWED_DIRS:
        target = BASE / folder
        target.mkdir(parents=True, exist_ok=True)
        remote_names = set()
        for path in members:
            if not path.startswith(prefix + folder + "/") or path.endswith("/"):
                continue
            suffix = path[len(prefix + folder + "/"):]
            if ".." in pathlib.PurePosixPath(suffix).parts:
                raise SystemExit("Unsafe path")
            remote_names.add(suffix)
            dest = target / suffix
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(archive.read(path))
        for local in target.rglob("*"):
            if local.is_file() and local.relative_to(target).as_posix() not in remote_names:
                local.unlink()
    for filename in ALLOWED_FILES:
        item = prefix + filename
        if item in members:
            (BASE / filename).write_bytes(archive.read(item))
print("Application sources synchronized. Deployment configs, secrets and database bindings untouched.")
