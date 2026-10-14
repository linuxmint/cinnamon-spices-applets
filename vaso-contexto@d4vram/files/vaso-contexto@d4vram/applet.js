// Applet de Cinnamon: un vaso en el panel que se llena con el contexto de Claude Code.
// No calcula nada: cada pocos segundos ejecuta `vaso.py --json` y pinta lo que devuelve.
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;

const REFRESH_SECONDS = 10;
// Mismos colores que las variables --ok/--watch/--compact/--new de index.html.
const COLORS = { ok: '#3a9fe0', watch: '#1fa896', compact: '#d9932a', new: '#d8503f' };
const RANK = { ok: 0, watch: 1, compact: 2, new: 3 };
const GLASS = 'M3 1H13L11.5 15H4.5Z';

const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n);

class VasoApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // Instalado desde Cinnamon Spices, vaso.py viaja dentro de la carpeta del applet
        // (lo copia cinnamon/empaquetar.sh). En desarrollo el applet es un enlace simbólico
        // a esta carpeta del proyecto y vaso.py está dos niveles más arriba. Las comillas
        // protegen los espacios de la ruta ("Vaso de contexto").
        const bundled = GLib.build_filenamev([metadata.path, 'vaso.py']);
        this.script = GLib.shell_quote(GLib.file_test(bundled, GLib.FileTest.EXISTS)
            ? bundled : GLib.build_filenamev([metadata.path, '..', '..', 'vaso.py']));
        this.iconDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'vaso-contexto']);
        GLib.mkdir_with_parents(this.iconDir, 0o755);
        this.level = null;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Líneas de solo lectura del desplegable; se rellenan en cada refresco.
        // No usamos `reactive: false`: Cinnamon lo trata como "desactivado" y atenúa el texto
        // hasta hacerlo ilegible. Quitamos solo el resaltado y la acción al pulsar.
        this.rows = {};
        for (const key of ['session', 'advice', 'text', 'extras', 'stats']) {
            const item = new PopupMenu.PopupMenuItem('', { hover: false, activate: false });
            item.label.clutter_text.line_wrap = true;
            item.label.set_style('max-width: 24em;' + (key === 'advice' ? ' font-weight: bold;' : ''));
            this.menu.addMenuItem(item);
            this.rows[key] = item;
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('Abrir página completa', () => Util.spawnCommandLine(`python3 ${this.script}`));

        this.set_applet_label('…');
        this.setIcon(0, 'ok');
        this.refresh();
        this.timer = Mainloop.timeout_add_seconds(REFRESH_SECONDS, () => { this.refresh(); return true; });
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this.timer) Mainloop.source_remove(this.timer);
    }

    // El icono es un SVG generado al vuelo: un archivo por combinación de nivel y color.
    // El nombre distinto evita que Cinnamon reutilice la imagen anterior que tiene en caché.
    setIcon(pct, level) {
        const step = Math.min(20, Math.round(pct * 20));
        const path = GLib.build_filenamev([this.iconDir, `vaso-${level}-${step}.svg`]);
        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
            GLib.file_set_contents(path,
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">` +
                `<defs><clipPath id="c"><path d="${GLASS}"/></clipPath></defs>` +
                `<rect clip-path="url(#c)" x="0" y="${15 - 14 * step / 20}" width="16" height="16" fill="${COLORS[level]}"/>` +
                `<path d="${GLASS}" fill="none" stroke="#9aa7b5" stroke-width="1.2" stroke-linejoin="round"/></svg>`);
        }
        this.set_applet_icon_path(path);
    }

    refresh() {
        Util.spawnCommandLineAsyncIO(`python3 ${this.script} --json`, (stdout, stderr) => {
            let s;
            try {
                s = JSON.parse(stdout);
                if (s.error) throw new Error(s.error);
            } catch (e) {
                this.set_applet_label('–');
                this.set_applet_tooltip('Vaso de contexto: ' + (stderr.trim() || e.message));
                return;
            }
            this.render(s);
        });
    }

    render(s) {
        const pct = Math.round(s.pct * 100);
        const a = s.advice;
        this.set_applet_label(pct + '%');
        this.setIcon(s.pct, a.level);
        this.set_applet_tooltip(`${a.title} · ${fmt(s.used)} de ${fmt(s.limit)} tokens`);

        this.rows.session.label.set_text(s.title);
        this.rows.advice.label.set_text(`${pct}% · ${a.title}`);
        this.rows.text.label.set_text(a.text);
        this.rows.extras.label.set_text(a.extras.join('\n'));
        this.rows.extras.actor.visible = a.extras.length > 0;
        this.rows.stats.label.set_text(
            `${fmt(s.used)} de ${fmt(s.limit)} tokens · ${s.turns} turnos\n` +
            `+${fmt(s.growth)} por turno` +
            (s.turns_left == null ? '' : ` · ≈ ${s.turns_left} ${s.turns_left === 1 ? 'turno' : 'turnos'} de margen`) +
            `\n${s.compactions} compactaciones · caché ${s.cache_pct}%`);

        // Avisar solo al subir a "compacta ya" o "sesión nueva", no en cada refresco.
        if (this.level !== null && RANK[a.level] > RANK[this.level] && RANK[a.level] >= RANK.compact)
            Main.notify(`Vaso de contexto: ${a.title}`, a.text);
        this.level = a.level;
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new VasoApplet(metadata, orientation, panelHeight, instanceId);
}
