#!/usr/bin/env python3
"""
Synchronizes the GDGoC UHU Cyber theme assets (CSS, JS, Bridge, Favicons) into
the live CTFd instance via the official CTFd REST API (/api/v1/configs).

Runs automatically in GitHub Actions after deploying static assets to GitHub Pages,
using `?v=<short_sha>` cache-busting so every `git push` updates the live CTFd site
immediately without touching `/admin` manually.

If the CTFd server already uses the full server-mounted `gdgoc-cyber` Jinja theme,
the script skips injecting the `core` bridge so nothing is duplicated.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request


def wait_for_pages_asset(url: str, timeout_s: int = 45) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "GDGoC-CTFd-Sync/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(3)
    return False


def build_theme_header(pages_base: str, version: str) -> str:
    base = pages_base.rstrip("/")
    static = f"{base}/static"
    v = f"?v={version}" if version else ""
    return "\n".join([
        f"<!-- GDGoC UHU Cyber Theme · Auto-synced from GDGoC-UHU-CTFd ({version or 'latest'}) -->",
        '<meta name="theme-color" content="#05070F">',
        f'<link rel="icon" type="image/png" sizes="32x32" href="{static}/img/favicon-32x32.png{v}">',
        f'<link rel="icon" type="image/png" sizes="192x192" href="{static}/img/favicon-192x192.png{v}">',
        f'<link rel="icon" type="image/svg+xml" href="{static}/img/favicon.svg{v}">',
        f'<link rel="apple-touch-icon" href="{static}/img/apple-touch-icon.png{v}">',
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Display:wght@400;500;700&family=Google+Sans+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Orbitron:wght@600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap">',
        f'<link rel="stylesheet" href="{static}/css/gdgoc-cyber.css{v}">',
        f'<script>window.GDGOC_ASSET_BASE={json.dumps(static)};window.GDGOC_ASSET_VER={json.dumps(version)};</script>',
        f'<script src="{static}/js/gdgoc-cyber-bridge.js{v}"></script>',
        f'<script src="{static}/js/gdgoc-cyber.js{v}"></script>',
    ])


def api_request(base_url: str, token: str, path: str, method: str = "GET", payload=None):
    url = base_url.rstrip("/") + path
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Token {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "GDGoC-CTFd-Sync/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def main() -> int:
    ctfd_url = os.environ.get("CTFD_URL", "").strip()
    token = os.environ.get("CTFD_API_TOKEN", "").strip()
    pages_base = os.environ.get("PAGES_BASE_URL", "https://arixlariel.github.io/GDGoC-UHU-CTFd").strip()
    version = os.environ.get("ASSET_VERSION", "").strip()[:8]

    if not ctfd_url or not token:
        print("Skipping live CTFd sync: CTFD_URL or CTFD_API_TOKEN secret is not configured.")
        return 0

    # Verify GitHub Pages is serving the newly built assets before pointing live CTFd to them
    probe_urls = [
        f"{pages_base.rstrip('/')}/static/css/gdgoc-cyber.css?v={version}",
        f"{pages_base.rstrip('/')}/static/js/gdgoc-cyber-bridge.js?v={version}",
        f"{pages_base.rstrip('/')}/static/js/gdgoc-cyber.js?v={version}",
    ]
    for probe in probe_urls:
        if not wait_for_pages_asset(probe):
            print(f"ERROR: Asset not reachable on GitHub Pages: {probe}", file=sys.stderr)
            return 1

    try:
        _, cfg_resp = api_request(ctfd_url, token, "/api/v1/configs", method="GET")
    except urllib.error.HTTPError as e:
        print(f"ERROR: Failed to read CTFd configs (HTTP {e.code})", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"ERROR: Could not reach CTFd API: {e}", file=sys.stderr)
        return 1

    configs = {c["key"]: c["value"] for c in cfg_resp.get("data", [])}
    active_theme = configs.get("ctf_theme", "")
    print(f"Connected to CTFd ({ctfd_url}). Active theme: {active_theme!r}")

    if active_theme == "gdgoc-cyber":
        print("Server already runs native `gdgoc-cyber` theme — skipping `core` bridge injection.")
        return 0

    new_header = build_theme_header(pages_base, version)
    if configs.get("theme_header") == new_header:
        print("Live CTFd theme_header is already up to date.")
        return 0

    try:
        status, res = api_request(
            ctfd_url,
            token,
            "/api/v1/configs",
            method="PATCH",
            payload={"theme_header": new_header},
        )
    except urllib.error.HTTPError as e:
        print(f"ERROR: Failed to update CTFd theme_header (HTTP {e.code})", file=sys.stderr)
        return 1

    if status == 200 and res.get("success"):
        print(f"Successfully synced GDGoC Cyber theme (version {version or 'latest'}) to {ctfd_url}!")
        return 0

    print(f"ERROR: Unexpected response updating theme_header: {res}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
