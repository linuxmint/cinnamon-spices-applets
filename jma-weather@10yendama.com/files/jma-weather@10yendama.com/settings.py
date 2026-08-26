#!/usr/bin/python3
from __future__ import annotations

import json
import sys
import threading
from pathlib import Path

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gtk

APPLET_DIR = Path(__file__).resolve().parent
TOOLS_DIR = APPLET_DIR / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from location_catalog import (  # noqa: E402
    PREFECTURES,
    UUID,
    LocationCatalog,
    Municipality,
    SettingsStore,
    fetch_forecast_temp_area,
    geocode_municipality,
    load_catalog,
    parse_invocation,
)


class SettingsWindow(Gtk.Window):
    def __init__(self, store: SettingsStore):
        super().__init__(title="JMA Weather Japan — 設定")
        self.store = store
        self.catalog: LocationCatalog | None = None
        self.municipalities: list[Municipality] = []
        self.selected_municipality: Municipality | None = None
        self.lookup_generation = 0
        self.lookup_pending = True
        self.save_in_progress = False

        self.set_default_size(700, 600)
        self.set_border_width(12)
        self.connect("destroy", Gtk.main_quit)

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.add(outer)
        self.notebook = Gtk.Notebook()
        outer.pack_start(self.notebook, True, True, 0)

        self._build_location_page()
        self._build_display_page()
        self._build_notifications_page()
        self._build_links_page()

        footer = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        footer.set_halign(Gtk.Align.END)
        cancel = Gtk.Button(label="キャンセル")
        cancel.connect("clicked", lambda _button: self.destroy())
        self.save_button = Gtk.Button(label="保存")
        self.save_button.get_style_context().add_class("suggested-action")
        self.save_button.connect("clicked", self._save)
        footer.pack_start(cancel, False, False, 0)
        footer.pack_start(self.save_button, False, False, 0)
        outer.pack_start(footer, False, False, 0)
        self._update_save_sensitivity()

        self._load_catalog_async(False)

    def _page_grid(self) -> Gtk.Grid:
        grid = Gtk.Grid(column_spacing=12, row_spacing=10)
        grid.set_border_width(12)
        grid.set_hexpand(True)
        return grid

    def _attach(self, grid: Gtk.Grid, row: int, label: str, widget: Gtk.Widget) -> None:
        title = Gtk.Label(label=label, xalign=0)
        title.set_hexpand(False)
        widget.set_hexpand(True)
        grid.attach(title, 0, row, 1, 1)
        grid.attach(widget, 1, row, 1, 1)

    def _build_location_page(self) -> None:
        grid = self._page_grid()
        self.notebook.append_page(grid, Gtk.Label(label="地域"))

        intro = Gtk.Label(
            label="都道府県と市区町村を選ぶと、気象庁コード・予報エリア・緯度経度を自動設定します。",
            xalign=0,
        )
        intro.set_line_wrap(True)
        grid.attach(intro, 0, 0, 2, 1)

        self.prefecture_combo = Gtk.ComboBoxText()
        self.prefecture_combo.append("", "選択してください")
        for code, name in PREFECTURES:
            self.prefecture_combo.append(code, name)
        self.prefecture_combo.connect("changed", self._prefecture_changed)
        self._attach(grid, 1, "都道府県", self.prefecture_combo)

        self.city_combo = Gtk.ComboBoxText()
        self.city_combo.append("", "先に都道府県を選択してください")
        self.city_combo.set_sensitive(False)
        self.city_combo.connect("changed", self._city_changed)
        self._attach(grid, 2, "市区町村", self.city_combo)

        self.area_code_label = Gtk.Label(xalign=0)
        self.area_name_label = Gtk.Label(xalign=0)
        self.temp_area_label = Gtk.Label(xalign=0)
        self._attach(grid, 3, "気象庁コード", self.area_code_label)
        self._attach(grid, 4, "予報エリア", self.area_name_label)
        self._attach(grid, 5, "気温地点", self.temp_area_label)

        separator = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        grid.attach(separator, 0, 6, 2, 1)

        self.custom_coords = Gtk.CheckButton(label="緯度・経度を手動指定する")
        self.custom_coords.set_active(bool(self.store.get("custom-coordinates", False)))
        self.custom_coords.connect("toggled", self._custom_coords_toggled)
        grid.attach(self.custom_coords, 0, 7, 2, 1)

        self.latitude_entry = Gtk.Entry()
        self.latitude_entry.set_text(str(self.store.get("latitude", "35.6689")))
        self.latitude_entry.connect("changed", lambda _entry: self._update_save_sensitivity())
        self.longitude_entry = Gtk.Entry()
        self.longitude_entry.set_text(str(self.store.get("longitude", "139.4777")))
        self.longitude_entry.connect("changed", lambda _entry: self._update_save_sensitivity())
        self._attach(grid, 8, "緯度", self.latitude_entry)
        self._attach(grid, 9, "経度", self.longitude_entry)
        self._custom_coords_toggled(self.custom_coords)

        actions = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        refresh = Gtk.Button(label="地域一覧を再取得")
        refresh.connect("clicked", lambda _button: self._load_catalog_async(True))
        actions.pack_start(refresh, False, False, 0)
        grid.attach(actions, 0, 10, 2, 1)

        self.location_status = Gtk.Label(label="地域一覧を読み込んでいます…", xalign=0)
        self.location_status.set_line_wrap(True)
        grid.attach(self.location_status, 0, 11, 2, 1)

    def _build_display_page(self) -> None:
        grid = self._page_grid()
        self.notebook.append_page(grid, Gtk.Label(label="表示"))

        self.panel_mode = Gtk.ComboBoxText()
        for key, name in (("icon", "アイコンのみ"), ("temperature", "アイコン＋気温"), ("full", "アイコン＋気温＋降水確率")):
            self.panel_mode.append(key, name)
        self.panel_mode.set_active_id(str(self.store.get("panel-mode", "full")))
        self._attach(grid, 0, "パネル表示", self.panel_mode)

        self.hourly_count = Gtk.SpinButton.new_with_range(3, 12, 1)
        self.hourly_count.set_value(float(self.store.get("hourly-count", 8)))
        self._attach(grid, 1, "表示する時間別予報", self.hourly_count)

        self.current_icon_size = Gtk.SpinButton.new_with_range(32, 64, 2)
        self.current_icon_size.set_value(float(self.store.get("current-icon-size", 44)))
        self._attach(grid, 2, "現在天気アイコン（px）", self.current_icon_size)

        self.forecast_icon_size = Gtk.SpinButton.new_with_range(16, 40, 2)
        self.forecast_icon_size.set_value(float(self.store.get("forecast-icon-size", 24)))
        self._attach(grid, 3, "時間別・週間アイコン（px）", self.forecast_icon_size)

        self.update_interval = Gtk.SpinButton.new_with_range(10, 180, 5)
        self.update_interval.set_value(float(self.store.get("update-interval", 30)))
        self._attach(grid, 4, "自動更新間隔（分）", self.update_interval)

    def _build_notifications_page(self) -> None:
        grid = self._page_grid()
        self.notebook.append_page(grid, Gtk.Label(label="通知"))

        self.rain_notification = Gtk.Switch(active=bool(self.store.get("rain-notification", True)))
        self.rain_threshold = Gtk.SpinButton.new_with_range(10, 100, 10)
        self.rain_threshold.set_value(float(self.store.get("rain-threshold", 60)))
        self.heat_notification = Gtk.Switch(active=bool(self.store.get("heat-notification", True)))
        self.heat_threshold = Gtk.SpinButton.new_with_range(28, 42, 1)
        self.heat_threshold.set_value(float(self.store.get("heat-threshold", 35)))
        self.uv_notification = Gtk.Switch(active=bool(self.store.get("uv-notification", False)))
        self.uv_threshold = Gtk.SpinButton.new_with_range(3, 11, 1)
        self.uv_threshold.set_value(float(self.store.get("uv-threshold", 8)))

        self._attach(grid, 0, "雨予報を通知", self.rain_notification)
        self._attach(grid, 1, "雨通知のしきい値（%）", self.rain_threshold)
        self._attach(grid, 2, "高温を通知", self.heat_notification)
        self._attach(grid, 3, "高温通知のしきい値（℃）", self.heat_threshold)
        self._attach(grid, 4, "強い紫外線を通知", self.uv_notification)
        self._attach(grid, 5, "UV通知のしきい値", self.uv_threshold)

    def _build_links_page(self) -> None:
        grid = self._page_grid()
        self.notebook.append_page(grid, Gtk.Label(label="外部リンク"))
        self.details_url = Gtk.Entry()
        self.details_url.set_text(str(self.store.get("details-url", "")))
        self.radar_url = Gtk.Entry()
        self.radar_url.set_text(str(self.store.get("radar-url", "")))
        self._attach(grid, 0, "詳しい予報URL", self.details_url)
        self._attach(grid, 1, "雨雲レーダーURL", self.radar_url)

    def _load_catalog_async(self, force_refresh: bool) -> None:
        self.lookup_pending = True
        self._update_save_sensitivity()
        self.location_status.set_text("地域一覧を読み込んでいます…")
        self.prefecture_combo.set_sensitive(False)
        self.city_combo.set_sensitive(False)

        def worker() -> None:
            try:
                catalog, source = load_catalog(APPLET_DIR, force_refresh)
                GLib.idle_add(self._catalog_loaded, catalog, source, None)
            except Exception as error:
                GLib.idle_add(self._catalog_loaded, None, "", str(error))

        threading.Thread(target=worker, daemon=True).start()

    def _catalog_loaded(self, catalog: LocationCatalog | None, source: str, error: str | None) -> bool:
        if error or catalog is None:
            self.lookup_pending = False
            self.location_status.set_text(f"地域一覧を読み込めませんでした: {error}")
            self._update_save_sensitivity()
            return False

        self.catalog = catalog
        self.prefecture_combo.set_sensitive(True)
        source_text = {"network": "気象庁から取得", "cache": "キャッシュ", "fallback": "内蔵の最小データ"}.get(source, source)
        self.location_status.set_text(f"地域一覧: {source_text}")

        municipality_code = str(self.store.get("selected-municipality-code", ""))
        item = catalog.municipality(municipality_code) if municipality_code else None
        if item is None:
            item = catalog.find_legacy(
                str(self.store.get("display-name", "")),
                str(self.store.get("jma-area-code", "")),
            )
        if item:
            self.prefecture_combo.set_active_id(item.prefecture_code)
            GLib.idle_add(self._select_city, item.code)
        else:
            self.lookup_pending = False
            self._update_save_sensitivity()
        return False

    def _prefecture_changed(self, _combo: Gtk.ComboBoxText) -> None:
        if not self.catalog:
            return
        self.lookup_generation += 1
        self.lookup_pending = False
        self.selected_municipality = None
        self.area_code_label.set_text("")
        self.area_name_label.set_text("")
        self.temp_area_label.set_text("")
        pref_code = self.prefecture_combo.get_active_id() or ""
        self.city_combo.remove_all()
        self.municipalities = []
        if not pref_code:
            self.city_combo.append("", "先に都道府県を選択してください")
            self.city_combo.set_sensitive(False)
            self._update_save_sensitivity()
            return

        self.municipalities = self.catalog.municipalities(pref_code)
        self.city_combo.append("", "選択してください")
        for item in self.municipalities:
            label = item.name
            duplicates = sum(1 for other in self.municipalities if other.name == item.name)
            if duplicates > 1:
                label = f"{item.name}（{item.class15_name}）"
            self.city_combo.append(item.code, label)
        self.city_combo.set_sensitive(True)
        self.city_combo.set_active_id("")
        self._update_save_sensitivity()

    def _select_city(self, code: str) -> bool:
        self.city_combo.set_active_id(code)
        return False

    def _city_changed(self, _combo: Gtk.ComboBoxText) -> None:
        code = self.city_combo.get_active_id() or ""
        self.selected_municipality = next((item for item in self.municipalities if item.code == code), None)
        if not self.selected_municipality:
            self.lookup_generation += 1
            self.lookup_pending = False
            self._update_save_sensitivity()
            return

        item = self.selected_municipality
        self.area_code_label.set_text(item.office_code)
        self.area_name_label.set_text(item.class10_name)
        self.temp_area_label.set_text("取得中…")
        self.location_status.set_text("気温地点と緯度経度を自動取得しています…")
        self.lookup_pending = True
        if not self.custom_coords.get_active():
            # Never allow the previous city's coordinates to leak into a new
            # automatic location selection while the lookup is in flight.
            self.latitude_entry.set_text("")
            self.longitude_entry.set_text("")
        self._update_save_sensitivity()
        self.lookup_generation += 1
        generation = self.lookup_generation

        def worker() -> None:
            temp_area = ""
            coords = None
            messages = []
            try:
                temp_area = fetch_forecast_temp_area(item)
            except Exception as error:
                messages.append(f"気温地点: {error}")
            try:
                aliases = [temp_area] if temp_area else []
                coords = geocode_municipality(item, aliases)
                if coords is None:
                    messages.append("座標: 自動取得できませんでした")
            except Exception as error:
                messages.append(f"座標: {error}")
            GLib.idle_add(self._lookup_finished, generation, temp_area, coords, messages)

        threading.Thread(target=worker, daemon=True).start()

    def _lookup_finished(self, generation: int, temp_area: str, coords, messages: list[str]) -> bool:
        if generation != self.lookup_generation or not self.selected_municipality:
            return False
        self.temp_area_label.set_text(temp_area or "自動判定できませんでした")
        if not self.custom_coords.get_active():
            if coords:
                self.latitude_entry.set_text(f"{coords[0]:.6f}")
                self.longitude_entry.set_text(f"{coords[1]:.6f}")
            else:
                self.latitude_entry.set_text("")
                self.longitude_entry.set_text("")
        if messages:
            self.location_status.set_text(" / ".join(messages) + "。必要なら座標を手動指定してください。")
        else:
            self.location_status.set_text("地域情報を自動設定しました。")
        self.lookup_pending = False
        self._update_save_sensitivity()
        return False

    def _custom_coords_toggled(self, button: Gtk.CheckButton) -> None:
        enabled = button.get_active()
        self.latitude_entry.set_sensitive(enabled)
        self.longitude_entry.set_sensitive(enabled)

        if (
            not enabled
            and self.selected_municipality is not None
            and not self.lookup_pending
        ):
            # Returning to automatic mode must replace any manually entered
            # coordinates with coordinates resolved for the selected city.
            self._city_changed(self.city_combo)
            return

        self._update_save_sensitivity()

    def _update_save_sensitivity(self) -> None:
        if not hasattr(self, "save_button"):
            return
        has_coordinates = bool(
            self.latitude_entry.get_text().strip()
            and self.longitude_entry.get_text().strip()
        )
        has_location = self.selected_municipality is not None or self.catalog is None
        self.save_button.set_sensitive(
            not self.save_in_progress
            and not self.lookup_pending
            and has_location
            and has_coordinates
        )

    def _save(self, _button: Gtk.Button) -> None:
        if self.save_in_progress:
            return
        self.save_in_progress = True
        self.save_button.set_sensitive(False)
        try:
            latitude = float(self.latitude_entry.get_text().strip())
            longitude = float(self.longitude_entry.get_text().strip())
            if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                raise ValueError("緯度・経度の範囲が正しくありません")
            if self.selected_municipality:
                item = self.selected_municipality
                self.store.set("selected-prefecture-code", item.prefecture_code)
                self.store.set("selected-municipality-code", item.code)
                self.store.set("display-name", item.name)
                self.store.set("jma-area-code", item.office_code)
                self.store.set("jma-area-name", item.class10_name)
                temp_name = self.temp_area_label.get_text().strip()
                if temp_name and "取得" not in temp_name and "判定" not in temp_name:
                    self.store.set("jma-temp-area-name", temp_name)
                else:
                    # Never retain a temperature point from the previously
                    # selected municipality. JmaProvider can resolve a matching
                    # point from display-name when this value is empty.
                    self.store.set("jma-temp-area-name", "")
            self.store.set("custom-coordinates", self.custom_coords.get_active())
            self.store.set("latitude", f"{latitude:.6f}")
            self.store.set("longitude", f"{longitude:.6f}")
            self.store.set("location-settings-version", 3)

            self.store.set("panel-mode", self.panel_mode.get_active_id() or "full")
            self.store.set("hourly-count", int(self.hourly_count.get_value()))
            self.store.set("current-icon-size", int(self.current_icon_size.get_value()))
            self.store.set("forecast-icon-size", int(self.forecast_icon_size.get_value()))
            self.store.set("update-interval", int(self.update_interval.get_value()))
            self.store.set("rain-notification", self.rain_notification.get_active())
            self.store.set("rain-threshold", int(self.rain_threshold.get_value()))
            self.store.set("heat-notification", self.heat_notification.get_active())
            self.store.set("heat-threshold", int(self.heat_threshold.get_value()))
            self.store.set("uv-notification", self.uv_notification.get_active())
            self.store.set("uv-threshold", int(self.uv_threshold.get_value()))
            self.store.set("details-url", self.details_url.get_text().strip())
            self.store.set("radar-url", self.radar_url.get_text().strip())
            self.store.save()

            # Closing the window must never depend on network or D-Bus. The
            # applet monitors its settings directory and reloads this file.
            self.hide()
            self.destroy()
        except Exception as error:
            dialog = Gtk.MessageDialog(
                transient_for=self,
                flags=0,
                message_type=Gtk.MessageType.ERROR,
                buttons=Gtk.ButtonsType.CLOSE,
                text="設定を保存できませんでした",
            )
            dialog.format_secondary_text(str(error))
            dialog.run()
            dialog.destroy()
            self.save_in_progress = False
            self._update_save_sensitivity()


def main() -> int:
    instance_id, explicit_path = parse_invocation(sys.argv[1:])
    store = SettingsStore(APPLET_DIR, instance_id, explicit_path)
    window = SettingsWindow(store)
    window.show_all()
    Gtk.main()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
