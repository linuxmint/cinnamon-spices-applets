#!/usr/bin/env python3
"""Location catalog and Cinnamon settings helpers for JMA Weather Japan."""

from __future__ import annotations

import json
import os
import tempfile
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

UUID = "jma-weather@10yendama.com"
AREA_URL = "https://www.jma.go.jp/bosai/common/const/area.json"
FORECAST_URL = "https://www.jma.go.jp/bosai/forecast/data/forecast/{area_code}.json"
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
USER_AGENT = "JMA-Weather-Cinnamon/3.1.1"

# JMA publishes these two forecast areas inside a neighbouring source file.
# Requesting the area code directly returns HTTP 404.
FORECAST_SOURCE_ALIASES = {
    "014030": "014100",  # 十勝地方 -> 釧路・根室・十勝地方 source
    "460040": "460100",  # 奄美地方 -> 鹿児島県 source
}

PREFECTURES = [
    ("01", "北海道"), ("02", "青森県"), ("03", "岩手県"), ("04", "宮城県"),
    ("05", "秋田県"), ("06", "山形県"), ("07", "福島県"), ("08", "茨城県"),
    ("09", "栃木県"), ("10", "群馬県"), ("11", "埼玉県"), ("12", "千葉県"),
    ("13", "東京都"), ("14", "神奈川県"), ("15", "新潟県"), ("16", "富山県"),
    ("17", "石川県"), ("18", "福井県"), ("19", "山梨県"), ("20", "長野県"),
    ("21", "岐阜県"), ("22", "静岡県"), ("23", "愛知県"), ("24", "三重県"),
    ("25", "滋賀県"), ("26", "京都府"), ("27", "大阪府"), ("28", "兵庫県"),
    ("29", "奈良県"), ("30", "和歌山県"), ("31", "鳥取県"), ("32", "島根県"),
    ("33", "岡山県"), ("34", "広島県"), ("35", "山口県"), ("36", "徳島県"),
    ("37", "香川県"), ("38", "愛媛県"), ("39", "高知県"), ("40", "福岡県"),
    ("41", "佐賀県"), ("42", "長崎県"), ("43", "熊本県"), ("44", "大分県"),
    ("45", "宮崎県"), ("46", "鹿児島県"), ("47", "沖縄県"),
]
PREFECTURE_NAMES = dict(PREFECTURES)


@dataclass(frozen=True)
class Municipality:
    code: str
    name: str
    en_name: str
    prefecture_code: str
    prefecture_name: str
    office_code: str
    office_name: str
    class10_code: str
    class10_name: str
    class15_code: str
    class15_name: str
    latitude: float | None = None
    longitude: float | None = None


class LocationCatalog:
    def __init__(self, payload: dict[str, Any]):
        self.payload = payload
        self.offices = payload.get("offices", {})
        self.class10s = payload.get("class10s", {})
        self.class15s = payload.get("class15s", {})
        self.class20s = payload.get("class20s", {})
        if not self.class20s:
            raise ValueError("JMA area catalog has no class20s section")

    def _ancestor(self, code: str, target: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
        seen: set[str] = set()
        current = code
        while current and current not in seen:
            seen.add(current)
            if current in target:
                return current, target[current]
            node = (
                self.class20s.get(current)
                or self.class15s.get(current)
                or self.class10s.get(current)
                or self.offices.get(current)
            )
            if not node:
                return None
            current = str(node.get("parent", ""))
        return None

    def municipality(self, code: str) -> Municipality | None:
        node = self.class20s.get(code)
        if not node:
            return None

        class15_ref = self._ancestor(str(node.get("parent", "")), self.class15s)
        class10_ref = self._ancestor(str(node.get("parent", "")), self.class10s)
        office_ref = self._ancestor(str(node.get("parent", "")), self.offices)
        if not class10_ref or not office_ref:
            return None

        class15_code, class15 = class15_ref or ("", {})
        class10_code, class10 = class10_ref
        office_code, office = office_ref
        pref_code = code[:2]

        return Municipality(
            code=code,
            name=str(node.get("name", code)),
            en_name=str(node.get("enName", "")),
            prefecture_code=pref_code,
            prefecture_name=PREFECTURE_NAMES.get(pref_code, pref_code),
            office_code=office_code,
            office_name=str(office.get("name", office_code)),
            class10_code=class10_code,
            class10_name=str(class10.get("name", class10_code)),
            class15_code=class15_code,
            class15_name=str(class15.get("name", class15_code)),
            latitude=_optional_float(node.get("lat")),
            longitude=_optional_float(node.get("lon")),
        )

    def municipalities(self, prefecture_code: str) -> list[Municipality]:
        result = []
        for code in sorted(self.class20s):
            if not code.startswith(prefecture_code):
                continue
            item = self.municipality(code)
            if item:
                result.append(item)
        return sorted(result, key=lambda item: (item.name, item.class15_name, item.code))

    def find_legacy(self, display_name: str, office_code: str) -> Municipality | None:
        normalized = _normalize_place_name(display_name)
        candidates: list[Municipality] = []
        for code in self.class20s:
            item = self.municipality(code)
            if not item:
                continue
            if office_code and item.office_code != office_code:
                continue
            if _normalize_place_name(item.name) == normalized:
                return item
            if normalized and normalized in _normalize_place_name(item.name):
                candidates.append(item)
        return candidates[0] if candidates else None


class SettingsStore:
    def __init__(self, applet_dir: Path, instance_id: str | None = None, explicit_path: Path | None = None):
        self.applet_dir = applet_dir
        self.schema_path = applet_dir / "settings-schema.json"
        self.schema = _read_json(self.schema_path)
        self.instance_id = instance_id or "0"
        self.path = explicit_path or self._discover_path()
        self.data = self._load()

    def _discover_path(self) -> Path:
        # Cinnamon stores current xlet settings under XDG_CONFIG_HOME. The old
        # ~/.cinnamon/configs path is used only when that legacy file exists
        # and the current-path file does not, matching Cinnamon's own loader.
        xdg_config_home = Path(
            os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config"))
        ).expanduser()
        current_base = xdg_config_home / "cinnamon" / "spices" / UUID
        legacy_base = Path.home() / ".cinnamon" / "configs" / UUID

        current_exact = current_base / f"{self.instance_id}.json"
        legacy_exact = legacy_base / f"{self.instance_id}.json"

        if current_exact.exists():
            return current_exact
        if legacy_exact.exists():
            return legacy_exact

        # When an exact instance ID was supplied, create the file in the
        # current Cinnamon location instead of silently writing instance 0.
        if self.instance_id not in ("", "0"):
            return current_exact

        current_existing = sorted(current_base.glob("*.json")) if current_base.exists() else []
        if current_existing:
            return current_existing[0]

        legacy_existing = sorted(legacy_base.glob("*.json")) if legacy_base.exists() else []
        if legacy_existing:
            return legacy_existing[0]

        return current_exact

    def _load(self) -> dict[str, Any]:
        if self.path.exists():
            try:
                data = _read_json(self.path)
                if isinstance(data, dict):
                    return data
            except (OSError, json.JSONDecodeError):
                pass
        data: dict[str, Any] = {}
        for key, spec in self.schema.items():
            if not isinstance(spec, dict) or "default" not in spec:
                continue
            data[key] = dict(spec)
            data[key]["value"] = spec["default"]
        return data

    def get(self, key: str, fallback: Any = None) -> Any:
        value = self.data.get(key, fallback)
        if isinstance(value, dict) and "value" in value:
            return value["value"]
        return value

    def set(self, key: str, value: Any) -> None:
        existing = self.data.get(key)
        if isinstance(existing, dict):
            existing["value"] = value
            return
        spec = self.schema.get(key)
        if isinstance(spec, dict):
            entry = dict(spec)
            entry["value"] = value
            self.data[key] = entry
        else:
            self.data[key] = value

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=f".{self.path.name}.", dir=self.path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(self.data, handle, ensure_ascii=False, indent=4)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, self.path)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)


def fetch_json(url: str, timeout: int = 20) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def load_catalog(applet_dir: Path, force_refresh: bool = False) -> tuple[LocationCatalog, str]:
    cache = Path.home() / ".cache" / "jma-weather-cinnamon" / "area.json"
    if not force_refresh and cache.exists():
        try:
            return LocationCatalog(_read_json(cache)), "cache"
        except (OSError, ValueError, json.JSONDecodeError):
            pass

    try:
        payload = fetch_json(AREA_URL)
        cache.parent.mkdir(parents=True, exist_ok=True)
        _write_json_atomic(cache, payload)
        return LocationCatalog(payload), "network"
    except Exception:
        fallback = applet_dir / "data" / "area-fallback.json"
        return LocationCatalog(_read_json(fallback)), "fallback"


def forecast_source_code(area_code: str) -> str:
    code = str(area_code or "").strip()
    return FORECAST_SOURCE_ALIASES.get(code, code)


def fetch_forecast_temp_area(municipality: Municipality) -> str:
    source_code = forecast_source_code(municipality.office_code)
    data = fetch_json(FORECAST_URL.format(area_code=source_code))
    if not isinstance(data, list) or not data:
        return ""
    series = data[0].get("timeSeries", [])
    temp_series = series[2] if len(series) > 2 else {}
    areas = temp_series.get("areas", [])
    names = [str(item.get("area", {}).get("name", "")) for item in areas]
    names = [name for name in names if name]
    if not names:
        return ""

    city = _normalize_place_name(municipality.name)
    class10 = _normalize_place_name(municipality.class10_name)
    for name in names:
        normalized = _normalize_place_name(name)
        if normalized and (normalized in city or normalized in class10):
            return name
    return names[0]


def geocode_municipality(
    municipality: Municipality,
    aliases: Iterable[str] = (),
) -> tuple[float, float] | None:
    if municipality.latitude is not None and municipality.longitude is not None:
        return municipality.latitude, municipality.longitude

    queries = _geocoding_queries(municipality, aliases)

    for name in queries:
        params = urllib.parse.urlencode({
            "name": name,
            "count": 20,
            "language": "ja",
            "format": "json",
            "countryCode": "JP",
        })
        payload = fetch_json(f"{GEOCODING_URL}?{params}")
        results = payload.get("results", []) if isinstance(payload, dict) else []
        if not results:
            continue

        def score(item: dict[str, Any]) -> tuple[int, int, int]:
            result_name = _normalize_place_name(str(item.get("name", "")))
            exact_city = result_name == _normalize_place_name(municipality.name)
            exact_query = result_name == _normalize_place_name(name)
            admin1 = str(item.get("admin1", ""))
            same_pref = (
                municipality.prefecture_name in admin1
                or municipality.prefecture_name.rstrip("都道府県") in admin1
            )
            return int(same_pref), int(exact_city), int(exact_query)

        best = max(results, key=score)
        lat = _optional_float(best.get("latitude"))
        lon = _optional_float(best.get("longitude"))
        if lat is not None and lon is not None:
            return lat, lon
    return None


def _geocoding_queries(
    municipality: Municipality,
    aliases: Iterable[str] = (),
) -> list[str]:
    values = [*aliases, municipality.name]
    stripped = _strip_municipality_suffix(municipality.name)
    if stripped:
        values.append(stripped)
    if municipality.en_name:
        values.append(municipality.en_name)

    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        value = str(value or "").strip()
        if not value:
            continue
        for query in (value, f"{value} {municipality.prefecture_name}"):
            normalized = _normalize_place_name(query).lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            result.append(query)
    return result


def _strip_municipality_suffix(value: str) -> str:
    result = str(value or "").strip()
    for suffix in ("市", "区", "町", "村"):
        if result.endswith(suffix) and len(result) > len(suffix):
            return result[:-len(suffix)]
    return result


def parse_invocation(argv: Iterable[str]) -> tuple[str | None, Path | None]:
    args = list(argv)
    explicit_path = None
    instance_id = None
    for index, arg in enumerate(args):
        if arg == "--instance" and index + 1 < len(args):
            instance_id = args[index + 1]
        elif arg == "--config" and index + 1 < len(args):
            explicit_path = Path(args[index + 1]).expanduser()
        elif arg.endswith(".json") and Path(arg).expanduser().exists():
            explicit_path = Path(arg).expanduser()
        elif arg.isdigit():
            instance_id = arg
    return instance_id, explicit_path


def _normalize_place_name(value: str) -> str:
    return value.replace(" ", "").replace("　", "").strip()


def _optional_float(value: Any) -> float | None:
    try:
        result = float(value)
        return result if result == result else None
    except (TypeError, ValueError):
        return None


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            handle.write("\n")
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
