import json, os
from typing import Any, Optional

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache")

def ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)

def cache_path(name: str) -> str:
    ensure_cache_dir()
    return os.path.join(CACHE_DIR, name)

def read_json(name: str) -> Optional[Any]:
    p = cache_path(name)
    if not os.path.exists(p): return None
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(name: str, data: Any):
    p = cache_path(name)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
