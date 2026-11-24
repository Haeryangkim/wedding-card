"""maplestory.io 내려받기 도우미 — 디스크 캐시(art/msref/raw/) + 재시도.

서버가 느리고 자주 500/502 를 내므로 모든 요청은 여러 번 다시 시도하고, 성공한 응답만 캐시에 남긴다.
요청에는 아이템 번호 말고는 아무 정보도 싣지 않는다 (User-Agent 도 일반 이름).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
BASE = "https://maplestory.io/api"
REGION = "GMS"
VERSION = "210.1.1"
UA = "msref-asset-builder/1.0"
CONCURRENCY = 4


def _cache_path(kind: str, key: str, ext: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", key).strip("_")
    if len(safe) > 120:
        safe = safe[:80] + "_" + hashlib.sha1(key.encode()).hexdigest()[:16]
    d = os.path.join(RAW, kind)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, safe + ext)


def fetch(url: str, kind: str, key: str, ext: str, tries: int = 14, timeout: int = 60, quiet: bool = False) -> bytes | None:
    """GET url (cached). 404 는 None. 그 밖의 실패는 재시도 뒤 예외."""
    path = _cache_path(kind, key, ext)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    miss = path + ".404"
    if os.path.exists(miss):
        return None
    last: Exception | None = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
            if ext == ".json":
                json.loads(data)  # 잘린 응답은 버린다
            elif ext == ".png" and not data.startswith(b"\x89PNG"):
                raise ValueError("not a png")
            tmp = path + ".tmp%d" % os.getpid()
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, path)
            return data
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                with open(miss, "w") as f:
                    f.write(str(e.code))
                return None
            last = e
        except Exception as e:  # noqa: BLE001 - 타임아웃·끊김·잘린 JSON 모두 재시도
            last = e
        time.sleep(min(8.0, 0.6 * (attempt + 1)))
    if not quiet:
        print("FAILED", url[:140], last)
    raise RuntimeError(f"fetch failed: {url[:160]}: {last}")


def api(path: str) -> str:
    return f"{BASE}/{REGION}/{VERSION}/{path}"


def item_json(item_id: int) -> dict | None:
    data = fetch(api(f"item/{item_id}"), "item", str(item_id), ".json")
    return json.loads(data) if data else None


def wz(path: str) -> dict | None:
    """WZ 노드 하나 (children / type / value)."""
    data = fetch(f"{BASE}/wz/{REGION}/{VERSION}/{path}", "wz", path, ".json", tries=20, timeout=40)
    return json.loads(data) if data else None


def search(term: str, count: int = 200) -> list[dict]:
    q = urllib.parse.urlencode({"searchFor": term, "count": count})
    data = fetch(api(f"item?{q}"), "search", term, ".json")
    return json.loads(data) if data else []


def zmap() -> list[str]:
    data = fetch(api("zmap"), "meta", "zmap", ".json")
    return json.loads(data)


def render_url(item_ids: list[int], action: str, frame: int, resize: int = 1) -> str:
    items = ",".join(
        urllib.parse.quote(json.dumps({"itemId": i, "version": VERSION}, separators=(",", ":")), safe="")
        for i in item_ids
    )
    return f"{BASE}/character/{items}/{action}/{frame}?resize={resize}"


def render(item_ids: list[int], action: str, frame: int, resize: int = 1) -> bytes | None:
    """API 가 직접 조합한 캐릭터 PNG (검증용 정답)."""
    key = "-".join(str(i) for i in item_ids) + f"_{action}_{frame}_x{resize}"
    return fetch(render_url(item_ids, action, frame, resize), "render", key, ".png", tries=10, timeout=90)


def pmap(fn, items, workers: int = CONCURRENCY):
    with ThreadPoolExecutor(max_workers=workers) as ex:
        return list(ex.map(fn, items))
