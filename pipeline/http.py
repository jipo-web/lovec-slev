"""Polite HTTP client shared by all sources (one connection pool, delay, retries)."""
from __future__ import annotations

import time
from pathlib import Path

import httpx

from .config import REQUEST_DELAY_S, TIMEOUT_S, USER_AGENT

_client: httpx.Client | None = None
_last_request = 0.0


def client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            headers={"User-Agent": USER_AGENT, "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.5"},
            timeout=TIMEOUT_S,
            follow_redirects=True,
        )
    return _client


def _throttle() -> None:
    global _last_request
    wait = REQUEST_DELAY_S - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    _last_request = time.monotonic()


def get(url: str, *, retries: int = 3, **kw) -> httpx.Response:
    last: Exception | None = None
    for attempt in range(retries):
        _throttle()
        try:
            r = client().get(url, **kw)
            if r.status_code in (429, 500, 502, 503, 504):
                raise httpx.HTTPStatusError(f"{r.status_code} for {url}", request=r.request, response=r)
            r.raise_for_status()
            return r
        except (httpx.HTTPError, httpx.TransportError) as e:  # pragma: no cover - network
            last = e
            time.sleep(2 ** attempt)
    assert last is not None
    raise last


def get_json(url: str, **kw):
    return get(url, **kw).json()


def get_text(url: str, **kw) -> str:
    return get(url, **kw).text


def download(url: str, dest: Path, *, skip_existing: bool = True) -> Path:
    """Stream a file to disk; returns dest. Existing files are not re-downloaded."""
    if skip_existing and dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    _throttle()
    with client().stream("GET", url) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_bytes(1 << 16):
                f.write(chunk)
    tmp.replace(dest)
    return dest
