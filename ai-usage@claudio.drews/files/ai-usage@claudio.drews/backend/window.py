#!/usr/bin/env python3
"""Janela GTK3 do Cinnamon AI Usage.

Mostra os serviços e métricas emitidos pelo coletor, conforme docs/contract.md.
Somente leitura: não acessa credenciais, não fala com a rede e não grava cache.
A coleta é feita por subprocesso (sem shell) e nunca bloqueia o GTK.

Uso: python3 window.py [--demo]
"""

from __future__ import annotations

import json
import locale
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import gi

gi.require_version("Gtk", "3.0")

from gi.repository import Gio, GLib, Gtk, GdkPixbuf  # noqa: E402

import i18n  # noqa: E402

APP_ID = "claudio.drews.CinnamonAIUsage"

COLLECTOR_NAME = "collector.py"
COLLECT_TIMEOUT_SECONDS = 50  # timeout global de coleta (contrato)
UI_WATCHDOG_SECONDS = 60  # watchdog da interface (contrato)

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
import collector  # noqa: E402  (mesma pasta: aviso de leitura antiga, junto do contrato)

COLLECTOR_PATH = BACKEND_DIR / COLLECTOR_NAME
CREDENTIALS_WINDOW = BACKEND_DIR / "credentials_window.py"
ICON_PATH = BACKEND_DIR.parent / "assets" / "robot-head-symbolic.svg"
ICON_SIZE = 28
WINDOW_ICON_SIZE = 128
FALLBACK_ICON_NAME = "utilities-system-monitor"
NEUTRAL_ICON_COLOR = "#999999"


def _icon_color(widget):
    """Cor de frente do tema, para desenhar o ícone simbólico do robô como o painel faz."""
    try:
        contexto = widget.get_style_context()
    except AttributeError:
        return None
    for nome in ("theme_fg_color", "theme_text_color"):
        try:
            found, color = contexto.lookup_color(nome)
        except (AttributeError, TypeError):
            continue
        if found and color is not None:
            return "#%02x%02x%02x" % (round(color.red * 255), round(color.green * 255),
                                      round(color.blue * 255))
    return None


def header_icon_pixbuf(widget, path=ICON_PATH, size=ICON_SIZE):
    """Ícone do cabeçalho com a cor da interface.

    O SVG é symbolic (``fill: currentColor``) e o ``GdkPixbuf`` não resolve ``currentColor``:
    rasteriza em preto puro, que quase desaparece no cabeçalho escuro. Aqui a cor de frente do
    tema é aplicada no próprio texto do SVG antes de carregar.

    Sem carregador de SVG (pacote ``librsvg2-common`` ausente), devolve ``None``: quem chamou
    usa um ícone do tema e a janela abre de qualquer forma — antes, a falta do pacote derrubava
    a janela inteira na construção.
    """
    try:
        svg = Path(path).read_text()
    except OSError:
        return None
    svg = svg.replace("currentColor", _icon_color(widget) or NEUTRAL_ICON_COLOR)
    loader = GdkPixbuf.PixbufLoader()
    try:
        loader.write(svg.encode())
        loader.close()
        pixbuf = loader.get_pixbuf()
    except GLib.Error:
        return None
    if pixbuf is None:
        return None
    return pixbuf.scale_simple(size, size, GdkPixbuf.InterpType.BILINEAR)


# Assinatura de status aceita pelo contrato. O rótulo de cada status nasce dentro de
# `status_text()`, em `_()`: o idioma só é resolvido em `main()` e um literal traduzido
# aqui no módulo sairia sempre em inglês.
# Status sem leitura: vão para o expander "Sem leitura".
# `stale` NÃO entra aqui: é leitura anterior preservada após falha e deve aparecer
# na lista principal com o último valor, marcada com aviso (contrato).
NO_READING_STATUSES = ("unavailable", "unconfigured", "error", "disabled")


# --------------------------------------------------------------------------
# Formatação (texto público, no idioma em vigor)
# --------------------------------------------------------------------------


def escape(text) -> str:
    """Escapa texto público antes de entrar em markup Pango."""
    return GLib.markup_escape_text(str(text))


def parse_timestamp(value):
    """Converte ISO 8601 (com 'Z' ou offset) em datetime com fuso. None se inválido."""
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    if raw.endswith(("Z", "z")):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def to_local(moment):
    return moment.astimezone() if moment is not None else None


def format_datetime(value) -> str:
    """Data e hora no idioma em vigor (`i18n.datetime_text`, não `strftime` literal)."""
    return i18n.datetime_text(to_local(parse_timestamp(value)))


def format_duration(seconds: float) -> str:
    """Duração curta e legível: '42 min', '3 h', '2 dias'."""
    return i18n.duration(seconds)


def format_relative(value) -> str:
    """'há 3 h' para um instante do passado."""
    return i18n.relative(parse_timestamp(value))


def format_number(value, decimals: int = 2) -> str:
    return i18n.number(value, decimals)


def format_money(value, currency) -> str:
    return i18n.money(value, currency)


def format_percent(used_percent) -> str:
    """Percentual ausente é null no contrato: nunca exibir como zero."""
    if used_percent is None:
        return i18n.percent(None)
    number = i18n.number(used_percent, 1)
    if number == i18n._("unavailable"):
        return i18n.percent(None)
    return i18n._f(i18n._("{percent}% used"), percent=number)


def status_text(status: str) -> str:
    key = (status or "").strip().lower()
    labels = {
        "ok": i18n._("OK"),
        "stale": i18n._("Stale"),
        "unavailable": i18n._("Unavailable"),
        "unconfigured": i18n._("Not configured"),
        "error": i18n._("Error"),
        "disabled": i18n._("Disabled"),
    }
    return labels.get(key) or (i18n._("Undefined") if not key else key)


def service_has_reading(service: dict) -> bool:
    """Um serviço tem leitura quando o status permite e há métrica utilizável."""
    status = (service.get("status") or "").strip().lower()
    if status in NO_READING_STATUSES:
        return False
    metrics = service.get("metrics")
    return isinstance(metrics, list) and len(metrics) > 0


def recency_text(service: dict) -> str:
    """Recência aproximada, sempre explícita quanto à natureza do dado."""
    last_used = service.get("last_used_at")
    basis = (service.get("recency_basis") or "unknown").strip().lower()
    if not isinstance(last_used, str) or not last_used.strip():
        return i18n._("Last use: unknown (the first reading has no history)")
    relative = format_relative(last_used)
    descriptions = {
        "observed_change": i18n._("approximate, inferred from the change in consumption"),
        "reported": i18n._("reported by the source"),
        "unknown": i18n._("approximate, the origin of the date is unknown"),
    }
    description = descriptions.get(basis, descriptions["unknown"])
    return i18n._f(i18n._("Last use: {relative} ({description})"),
                   relative=relative, description=description)


def reset_text(metric: dict) -> str:
    reset_at = metric.get("reset_at")
    moment = parse_timestamp(reset_at)
    if moment is None:
        return ""
    remaining = (moment - datetime.now(timezone.utc)).total_seconds()
    relative = (i18n._f(i18n._("in {duration}"), duration=format_duration(remaining))
                if remaining > 0 else i18n._("awaiting update"))
    template = (i18n._("Renews {datetime} ({relative})") if metric.get("kind") == "balance"
                else i18n._("Resets {datetime} ({relative})"))
    return i18n._f(template, datetime=format_datetime(reset_at), relative=relative)


def window_text(metric: dict) -> str:
    seconds = metric.get("window_seconds")
    if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or seconds <= 0:
        return ""
    return i18n._f(i18n._("Window: {duration}"), duration=format_duration(seconds))


def window_extra(metric: dict, label: str = "") -> str:
    """Duração da janela para a linha de detalhes, quando o rótulo ainda não a diz.

    O contrato traz `window_seconds`; sem isto a duração só aparecia quando o próprio rótulo
    da origem a mencionava ("Janela de 5 h") e sumia em rótulos como "Janela móvel".
    """
    text = window_text(metric)
    if not text:
        return ""
    seconds = metric.get("window_seconds")
    if isinstance(seconds, bool) or not isinstance(seconds, (int, float)):
        return text
    duration = format_duration(seconds)
    return "" if duration and duration in label else text


def python_executable() -> str:
    """python3 do PATH, como no contrato; cai para o interpretador atual."""
    return shutil.which("python3") or sys.executable


# --------------------------------------------------------------------------
# Coleta assíncrona
# --------------------------------------------------------------------------


class CollectorResult:
    def __init__(self, ok, snapshot=None, error=None, timed_out=False):
        self.ok = ok
        self.snapshot = snapshot
        self.error = error
        self.timed_out = timed_out


class CollectorClient:
    """Executa `collector.py` em subprocesso sem shell, fora do laço do GTK."""

    def __init__(self):
        self._proc = None
        self._cancellable = None
        self._timeout_id = 0
        self._on_done = None
        self._state = "idle"

    @property
    def busy(self) -> bool:
        return self._state == "running"

    def start(self, args, on_done) -> bool:
        """args é a lista de argumentos do coletor, por exemplo ['collect', '--force']."""
        if self.busy:
            return False
        if not COLLECTOR_PATH.is_file():
            on_done(
                CollectorResult(
                    False,
                    error=i18n._f(i18n._("Collector not found at {path}."),
                                  path=COLLECTOR_PATH),
                )
            )
            return False

        argv = [python_executable(), str(COLLECTOR_PATH), *args]
        try:
            self._proc = Gio.Subprocess.new(
                argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            )
        except GLib.Error as exc:
            self._proc = None
            on_done(CollectorResult(
                False,
                error=i18n._f(i18n._("Could not start the collector: {error}"),
                              error=exc.message)))
            return False

        self._on_done = on_done
        self._state = "running"
        self._timed_out = False
        self._cancellable = Gio.Cancellable()
        self._timeout_id = GLib.timeout_add_seconds(
            COLLECT_TIMEOUT_SECONDS, self._on_collect_timeout
        )
        self._proc.communicate_utf8_async(None, self._cancellable, self._on_communicate)
        return True

    def cancel(self):
        """Encerra a coleta em andamento (fechamento da janela)."""
        self._remove_timeout()
        self._state = "idle"
        proc, self._proc = self._proc, None
        self._on_done = None
        if self._cancellable is not None:
            self._cancellable.cancel()
            self._cancellable = None
        if proc is not None:
            try:
                proc.send_signal(15)
            except GLib.Error:
                pass

    # -- internos ---------------------------------------------------------

    def _remove_timeout(self):
        if self._timeout_id:
            GLib.source_remove(self._timeout_id)
            self._timeout_id = 0

    def _on_collect_timeout(self):
        self._timeout_id = 0
        self._timed_out = True
        if self._proc is not None:
            try:
                self._proc.send_signal(15)
            except GLib.Error:
                pass
        return GLib.SOURCE_REMOVE

    def _finish(self, result: CollectorResult):
        self._remove_timeout()
        self._state = "idle"
        self._cancellable = None
        callback, self._on_done = self._on_done, None
        if callback is not None:
            callback(result)

    def _on_communicate(self, _source, result, _user_data=None):
        proc, self._proc = self._proc, None
        if proc is None or self._on_done is None:  # cancelado durante a coleta
            return
        timed_out = self._timed_out
        try:
            success, stdout, stderr = proc.communicate_utf8_finish(result)
        except GLib.Error as exc:
            self._finish(CollectorResult(
                False,
                error=i18n._f(i18n._("Could not read the collector output: {error}"),
                              error=exc.message)))
            return

        if timed_out:
            self._finish(
                CollectorResult(
                    False,
                    error=i18n._f(i18n._("Collection timed out after {seconds} seconds."),
                                  seconds=COLLECT_TIMEOUT_SECONDS),
                    timed_out=True,
                )
            )
            return

        if not success or not proc.get_successful():
            code = proc.get_exit_status()
            detail = ""
            for line in (stderr or "").strip().splitlines():
                if line.strip():
                    detail = line.strip()[:200]
                    break
            message = i18n._f(i18n._("Collector exited with error (code {code})."), code=code)
            if detail:
                message += " " + detail
            self._finish(CollectorResult(False, error=message))
            return

        try:
            snapshot = json.loads(stdout or "")
        except (json.JSONDecodeError, TypeError):
            self._finish(CollectorResult(
                False, error=i18n._("Collector response is not valid JSON.")))
            return

        services = snapshot.get("services") if isinstance(snapshot, dict) else None
        if not isinstance(services, list) or snapshot.get("schema_version") != 1:
            self._finish(CollectorResult(
                False, error=i18n._("Collector response is outside the contract.")))
            return

        self._finish(CollectorResult(True, snapshot=snapshot))


# --------------------------------------------------------------------------
# Janela
# --------------------------------------------------------------------------


class UsageWindow(Gtk.ApplicationWindow):
    def __init__(self, application: Gtk.Application, demo: bool = False):
        super().__init__(
            application=application,
            title=i18n._("AI usage"),
            default_width=560,
            default_height=680,
        )
        self.demo = bool(demo)
        self.collector = CollectorClient()
        self._watchdog_id = 0
        self._snapshot = None
        self._last_update = None

        header = Gtk.HeaderBar(show_close_button=True)
        header.set_title(i18n._("AI usage"))
        header.set_subtitle(i18n._("Monitored AI services"))
        icon = header_icon_pixbuf(header)
        if icon is not None:
            header.pack_start(Gtk.Image.new_from_pixbuf(icon))
            window_icon = header_icon_pixbuf(header, size=WINDOW_ICON_SIZE)
            if window_icon is not None:
                self.set_icon(window_icon)
        else:
            # Sem SVG legível (librsvg2-common ausente): ícone do tema no lugar, sem quebrar.
            fallback = Gtk.Image.new_from_icon_name(FALLBACK_ICON_NAME, Gtk.IconSize.BUTTON)
            fallback.set_tooltip_text(
                i18n._("For the project robot, install the librsvg2-common package")
            )
            header.pack_start(fallback)
        self.refresh_button = Gtk.Button.new_from_icon_name("view-refresh", Gtk.IconSize.BUTTON)
        self.refresh_button.set_tooltip_text(i18n._("Update now (forces a new collection)"))
        self.refresh_button.connect("clicked", self._on_refresh_clicked)
        header.pack_end(self.refresh_button)
        self.credentials_button = Gtk.Button(label=i18n._("Credentials…"))
        self.credentials_button.set_tooltip_text(
            i18n._("API keys and file paths: kept in the system keyring")
        )
        self.credentials_button.connect("clicked", self._on_credentials_clicked)
        header.pack_end(self.credentials_button)
        self.spinner = Gtk.Spinner()
        header.pack_start(self.spinner)
        self.set_titlebar(header)
        header.show_all()

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.add(root)

        self.error_bar = Gtk.InfoBar(message_type=Gtk.MessageType.ERROR, show_close_button=True)
        self.error_bar.set_revealed(False)
        self.error_label = self._info_bar_label(self.error_bar)
        self.error_bar.connect("response", lambda bar, _resp: bar.set_revealed(False))
        root.pack_start(self.error_bar, False, False, 0)

        self.demo_bar = Gtk.InfoBar(message_type=Gtk.MessageType.INFO)
        self.demo_bar.set_revealed(False)
        self._info_bar_label(self.demo_bar).set_text(
            i18n._("Demo — made-up values, without changing your history.")
        )
        root.pack_start(self.demo_bar, False, False, 0)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_vexpand(True)
        self.content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        self.content.set_border_width(12)
        scrolled.add(self.content)
        root.pack_start(scrolled, True, True, 0)

        self.connect("destroy", self._on_destroy)

        if self.demo:
            self.demo_bar.set_revealed(True)

        self._show_placeholder(i18n._("Loading service data…"))
        root.show_all()
        self.refresh_button.grab_focus()
        # Primeira abertura: usa o cache se ainda estiver no TTL (sem --force).
        self._start_collection(["demo"] if self.demo else ["collect"])

    # -- construção auxiliar ---------------------------------------------

    @staticmethod
    def _info_bar_label(bar: Gtk.InfoBar) -> Gtk.Label:
        label = Gtk.Label(xalign=0)
        label.set_line_wrap(True)
        label.set_selectable(False)
        bar.get_content_area().add(label)
        bar.show_all()
        return label

    def _clear_content(self):
        for child in self.content.get_children():
            self.content.remove(child)
            child.destroy()

    def _show_placeholder(self, text: str):
        self._clear_content()
        label = Gtk.Label(label=text, xalign=0)
        label.get_style_context().add_class("dim-label")
        self.content.pack_start(label, False, False, 0)
        self.content.show_all()

    def _add_line(self, box: Gtk.Box, text: str, markup: bool = False, dim: bool = False):
        label = Gtk.Label(xalign=0)
        label.set_line_wrap(True)
        label.set_selectable(True)
        if markup:
            label.set_markup(text)
        else:
            label.set_text(text)
        if dim:
            label.get_style_context().add_class("dim-label")
        box.pack_start(label, False, False, 0)
        return label

    # -- coleta -----------------------------------------------------------

    def _start_collection(self, args):
        if self.collector.busy:
            return
        self.refresh_button.set_sensitive(False)
        self.spinner.start()
        self._watchdog_id = GLib.timeout_add_seconds(UI_WATCHDOG_SECONDS, self._on_watchdog)
        self.collector.start(args, self._on_collection_done)

    def _on_watchdog(self):
        self._watchdog_id = 0
        if self.collector.busy:
            self._show_placeholder(i18n._f(
                i18n._("The collection is taking longer than expected. "
                       "The collector is stopped after {seconds} seconds."),
                seconds=COLLECT_TIMEOUT_SECONDS,
            ))
        return GLib.SOURCE_REMOVE

    def _clear_watchdog(self):
        if self._watchdog_id:
            GLib.source_remove(self._watchdog_id)
            self._watchdog_id = 0

    def _on_collection_done(self, result: CollectorResult):
        self._clear_watchdog()
        self.spinner.stop()
        self.refresh_button.set_sensitive(True)
        if result.ok:
            self.error_bar.set_revealed(False)
            self._snapshot = result.snapshot
            self._last_update = datetime.now(timezone.utc)
            self._render_snapshot(result.snapshot)
        else:
            self.error_label.set_text(
                i18n._f(i18n._("Collection error: {error}"), error=result.error))
            self.error_bar.set_revealed(True)
            if self._snapshot is None:
                self._show_placeholder(i18n._("No data to show while the collection fails."))
            else:
                self._render_snapshot(self._snapshot, stale_notice=result.error)

    def _on_refresh_clicked(self, _button):
        # Força nova coleta apenas a pedido do usuário (contrato).
        self._start_collection(["demo"] if self.demo else ["collect", "--force"])

    def _on_credentials_clicked(self, _button):
        # A janela de credenciais é um processo separado; esta janela não lê segredo algum.
        try:
            Gio.Subprocess.new(
                [python_executable(), str(CREDENTIALS_WINDOW)],
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE,
            )
        except GLib.Error as exc:
            self.error_label.set_text(
                i18n._f(i18n._("Error opening the credentials: {error}"), error=exc.message))
            self.error_bar.set_revealed(True)

    def _on_destroy(self, _widget=None):
        self._clear_watchdog()
        self.collector.cancel()
        return False

    # -- desenho ----------------------------------------------------------

    def _render_snapshot(self, snapshot: dict, stale_notice: str = None):
        self._clear_content()

        services = [s for s in snapshot.get("services", []) if isinstance(s, dict)]
        readable = [s for s in services if service_has_reading(s)]
        without_reading = [s for s in services if not service_has_reading(s)]

        if not services:
            self._add_line(self.content, i18n._("The collector returned no services."), dim=True)

        for service in readable:
            self.content.pack_start(self._build_service_card(service), False, False, 0)

        if without_reading:
            expander = Gtk.Expander()
            count = len(without_reading)
            expander.set_label(i18n._f(
                i18n._n("No reading ({count} service)", "No reading ({count} services)", count),
                count=count,
            ))
            inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
            inner.set_border_width(8)
            expander.add(inner)
            for service in without_reading:
                inner.pack_start(self._build_service_card(service), False, False, 0)
            self.content.pack_start(expander, False, False, 0)

        if readable and stale_notice:
            notice = Gtk.Label(xalign=0)
            notice.set_line_wrap(True)
            notice.set_text(i18n._f(
                i18n._("Showing the last known reading; the most recent collection failed: "
                       "{reason}"),
                reason=stale_notice,
            ))
            self.content.pack_start(notice, False, False, 0)

        # Coleta pulada porque já havia outra em andamento: avise, sem tratá-la como falha.
        # Aviso do momento, jamais gravado no cache: quando houver identificador, ele manda
        # sobre o texto que veio na coleta (docs/i18n.md, "Textos que ficam no cache").
        skip_notice = i18n.record_text(snapshot, "notice_id", "notice_args", "notice")
        if skip_notice.strip():
            self._add_line(self.content, skip_notice)

        self.content.pack_start(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL), False, False, 0)
        generated = snapshot.get("generated_at")
        footer = i18n._f(i18n._("Collection from {datetime} ({relative})"),
                         datetime=format_datetime(generated),
                         relative=format_relative(generated))
        if self._last_update is not None:
            footer += i18n._f(i18n._(" · shown at {time}"),
                              time=i18n.time_text(to_local(self._last_update)))
        if self.demo:
            footer += i18n._(" · demo data")
        self._add_line(self.content, footer, dim=True)

        self.content.show_all()

    def _build_service_card(self, service: dict) -> Gtk.Frame:
        frame = Gtk.Frame()
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        box.set_border_width(10)
        frame.add(box)

        header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        # `label` do serviço é o nome público do provedor (Codex, Grok, …), não texto
        # traduzível: o contrato não lhe dá identificador. Só o recurso vazio é nosso.
        label = service.get("label") or service.get("id") or i18n._("Service")
        name = Gtk.Label(xalign=0)
        name.set_markup(f"<b>{escape(label)}</b>")
        header.pack_start(name, True, True, 0)
        status = Gtk.Label(xalign=1)
        status.set_markup(f"<small>{escape(status_text(service.get('status')))}</small>")
        status.get_style_context().add_class("dim-label")
        header.pack_end(status, False, False, 0)
        box.pack_start(header, False, False, 0)

        # A origem também é texto do cache: o identificador manda, e o texto gravado é o recurso
        # de quem não tem catálogo — "OpenRouter · chave" numa leitura feita em português aparece
        # "OpenRouter · key" numa janela em inglês, sem recolher nada.
        source = i18n.record_text(service, "source_id", "source_args", "source")
        details = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
        if isinstance(source, str) and source.strip():
            self._add_line(details, i18n._f(i18n._("Source: {source}"), source=source), dim=True)

        read_at = service.get("read_at")
        relative = format_relative(read_at)
        if relative:
            read_line = i18n._f(i18n._("Reading: {datetime} ({relative})"),
                                datetime=format_datetime(read_at), relative=relative)
        else:
            read_line = i18n._f(i18n._("Reading: {datetime}"), datetime=format_datetime(read_at))
        self._add_line(details, read_line, dim=True)
        self._add_line(details, recency_text(service), dim=True)

        if (service.get("status") or "").strip().lower() == "stale":
            # Leitura anterior preservada: o texto segue o motivo real (vencimento de intervalo
            # não é falha). A decisão mora no coletor, junto do contrato, e tem teste próprio.
            warning = Gtk.Label(xalign=0)
            warning.set_line_wrap(True)
            warning.set_text(collector.stale_warning(service))
            box.pack_start(warning, False, False, 0)

        # Texto do cache: quem manda é o identificador (o msgid), não o texto gravado no
        # idioma da coleta antiga (docs/i18n.md, "Textos que ficam no cache").
        message = i18n.record_text(service)
        if message.strip():
            self._add_line(box, message, dim=True)

        metrics = service.get("metrics")
        if isinstance(metrics, list) and metrics:
            box.pack_start(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL), False, False, 0)
            for metric in metrics:
                if isinstance(metric, dict):
                    box.pack_start(self._build_metric_row(metric), False, False, 0)

        expander = Gtk.Expander(label=i18n._("Reading details"))
        expander.add(details)
        box.pack_start(expander, False, False, 0)

        return frame

    def _build_metric_row(self, metric: dict) -> Gtk.Box:
        row = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        kind = (metric.get("kind") or "").strip().lower()
        label = (i18n.record_text(metric, "label_id", "label_args", "label")
                 or metric.get("id") or i18n._("Metric"))
        if kind == "quota":
            used_percent = metric.get("used_percent")
            self._add_line(row, i18n._f(i18n._("{label} · {percent}"),
                                        label=label, percent=format_percent(used_percent)))
            if used_percent is not None and isinstance(used_percent, (int, float)) and not isinstance(used_percent, bool):
                # Barra somente para quota; valor ausente não vira barra cheia nem zero.
                fraction = max(0.0, min(1.0, float(used_percent) / 100.0))
                bar = Gtk.ProgressBar()
                bar.set_fraction(fraction)
                bar.set_show_text(False)
                bar.set_tooltip_text(i18n._f(i18n._("{percent}% of the quota used"),
                                             percent=i18n.number(used_percent, 1)))
                row.pack_start(bar, False, False, 0)
            extras = [part for part in (window_extra(metric, label), reset_text(metric)) if part]
            if len(extras) == 2:
                self._add_line(row, i18n._f(i18n._("{window} · {reset}"),
                                           window=extras[0], reset=extras[1]), dim=True)
            elif extras:
                self._add_line(row, extras[0], dim=True)
        elif kind == "balance":
            self._add_line(row, i18n._f(i18n._("{label}: {money}"), label=label,
                                        money=format_money(metric.get("value"),
                                                           metric.get("currency"))))
            if reset_text(metric):
                self._add_line(row, reset_text(metric), dim=True)
        elif kind == "spend":
            self._add_line(row, i18n._f(i18n._("{label}: {money}"), label=label,
                                        money=format_money(metric.get("value"),
                                                           metric.get("currency"))))
        else:
            value = metric.get("value")
            if value is None:
                self._add_line(row, i18n._("No value reported."), dim=True)
            else:
                self._add_line(row, format_money(value, metric.get("currency")))

        return row


class UsageApplication(Gtk.Application):
    """Instância única; aceita --demo pelo parser de opções do GTK."""

    def __init__(self, unique: bool = True, demo: bool = False):
        flags = Gio.ApplicationFlags.HANDLES_COMMAND_LINE
        if not unique:
            flags |= Gio.ApplicationFlags.NON_UNIQUE
        super().__init__(
            application_id=APP_ID + (".Demo" if demo else ""),
            flags=flags,
            inactivity_timeout=60_000,
        )
        self.demo = demo
        self._window = None
        self.add_main_option(
            "demo",
            ord("d"),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.NONE,
            i18n._("Shows demo data (a simulation; it does not write the cache)"),
            None,
        )

    # O parser local precisa aceitar --demo sem erro antes do registro.
    def do_handle_local_options(self, options):
        if options.contains("demo"):
            self.demo = True
        return -1

    def do_command_line(self, command_line):
        self.activate()
        return 0

    def do_activate(self):
        if self._window is None:
            self._window = UsageWindow(application=self, demo=self.demo)
            self._window.connect("destroy", self._on_window_destroyed)
        self._window.present()

    def _on_window_destroyed(self, _window):
        self._window = None
        self.quit()


def main(argv=None) -> int:
    argv = list(sys.argv if argv is None else argv)
    i18n.activate()
    try:
        locale.setlocale(locale.LC_ALL, "")
    except locale.Error:
        pass  # mantém o locale do ambiente, sem falhar a janela

    demo = "--demo" in argv or "-d" in argv
    app = UsageApplication(demo=demo)
    try:
        app.register(None)
    except GLib.Error as exc:
        print(
            i18n._f(i18n._("Warning: single instance unavailable ({reason}); "
                           "opening without registration."), reason=exc.message),
            file=sys.stderr,
        )
        app = UsageApplication(unique=False, demo=demo)
        return app.run(argv)
    return app.run(argv)


if __name__ == "__main__":
    sys.exit(main())
