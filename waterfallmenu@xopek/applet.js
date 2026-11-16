// Waterfall Menu — апплет для Cinnamon.
// Каскадное меню: полоса слева, закреплённые программы, Программы / Документы /
// Настройка / Поиск / Справка / Выполнить / Завершение работы, строка поиска внизу.
// Цвета, рамка и шрифт читаются из текущей темы Cinnamon.

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const AppFavorites = imports.ui.appFavorites;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;
const DocInfo = imports.misc.docInfo;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Pango = imports.gi.Pango;
const Cairo = imports.cairo;

// настоящее дерево меню (cinnamon-applications.menu) — оно меняется «Редактором меню»
let CMenu = null;
try {
    CMenu = imports.gi.CMenu;
} catch (e) {
    CMenu = null;
}

// ---------------------------------------------------------------- строки ---
const LOC = (() => {
    try {
        return GLib.get_language_names()[0].toLowerCase().startsWith('ru') ? 'ru' : 'en';
    } catch (e) {
        return 'en';
    }
})();

// [en, ru]
const S = {
    search: ['Search', 'Поиск'],
    search_hint: ['Search', 'Поиск'],
    no_results: ['No results', 'Ничего не найдено'],
    empty: ['(Empty)', '(Пусто)'],
    other: ['Other', 'Прочие'],
    programs: ['Programs', 'Программы'],
    documents: ['Documents', 'Документы'],
    settings: ['Settings', 'Настройка'],
    help_support: ['Help and Support', 'Справка и поддержка'],
    run: ['Run...', 'Выполнить...'],
    shutdown_dots: ['Shut Down...', 'Завершение работы...'],
    find_files: ['Files or Folders...', 'Файлы и папки...'],
    control_panel: ['Control Panel', 'Панель управления'],
    home: ['Home Folder', 'Домашняя папка'],
    computer: ['Computer', 'Компьютер'],
    network_places: ['Network', 'Сеть'],
    shutdown: ['Shut Down', 'Выключить компьютер'],
    restart: ['Restart', 'Перезагрузить'],
    sleep: ['Sleep', 'Спящий режим'],
    lock: ['Lock Screen', 'Заблокировать экран'],
    logoff: ['Log Off', 'Завершить сеанс'],
    edit_menu: ['Edit menu', 'Редактировать меню'],
    ctx_open: ['Open', 'Открыть'],
    ctx_add_panel: ['Add to panel', 'Добавить на панель'],
    ctx_add_desktop: ['Add to desktop', 'Добавить на рабочий стол'],
    ctx_add_fav: ['Add to favorites', 'Добавить в избранное'],
    ctx_remove_fav: ['Remove from favorites', 'Убрать из избранного'],
    ctx_uninstall: ['Uninstall', 'Удалить'],
    ctx_properties: ['Properties', 'Свойства'],
};

function T(key) {
    let e = S[key];
    return e ? (LOC === 'ru' ? e[1] : e[0]) : key;
}

function pick(pair) {
    return LOC === 'ru' ? pair[1] : pair[0];
}

// Категории приложений (порядок = приоритет): [id, [en, ru]]
const CATS = [
    ['Network', ['Internet', 'Интернет']],
    ['Office', ['Office', 'Офис']],
    ['Graphics', ['Graphics', 'Графика']],
    ['AudioVideo', ['Sound & Video', 'Звук и видео']],
    ['Development', ['Programming', 'Программирование']],
    ['Game', ['Games', 'Игры']],
    ['Education', ['Education', 'Образование']],
    ['Science', ['Science', 'Наука']],
    ['Settings', ['Preferences', 'Настройки']],
    ['System', ['System Tools', 'Система']],
    ['Utility', ['Accessories', 'Стандартные']],
];

// Специальные папки: [ключ GLib, [en, ru], значок]
const DIRS = [
    ['DIRECTORY_DOCUMENTS', ['My Documents', 'Мои документы'], 'folder-documents'],
    ['DIRECTORY_DESKTOP', ['Desktop', 'Рабочий стол'], 'user-desktop'],
    ['DIRECTORY_DOWNLOAD', ['Downloads', 'Загрузки'], 'folder-download'],
    ['DIRECTORY_PICTURES', ['Pictures', 'Изображения'], 'folder-pictures'],
    ['DIRECTORY_MUSIC', ['Music', 'Музыка'], 'folder-music'],
    ['DIRECTORY_VIDEOS', ['Videos', 'Видео'], 'folder-videos'],
];

// Модули «Параметров системы» Cinnamon: [id, [en, ru], значок]
const MODULES = [
    ['applets', ['Applets', 'Апплеты'], 'cs-applets'],
    ['desklets', ['Desklets', 'Десклеты'], 'cs-desklets'],
    ['extensions', ['Extensions', 'Расширения'], 'cs-extensions'],
    ['themes', ['Themes', 'Темы'], 'cs-themes'],
    ['backgrounds', ['Backgrounds', 'Фоны рабочего стола'], 'cs-backgrounds'],
    ['effects', ['Effects', 'Эффекты'], 'cs-effects'],
    ['fonts', ['Fonts', 'Шрифты'], 'cs-fonts'],
    ['panel', ['Panel', 'Панель'], 'cs-panel'],
    ['general', ['General', 'Общие'], 'cs-general'],
    ['hotcorner', ['Hot Corners', 'Активные углы'], 'cs-overview'],
    ['windows', ['Windows', 'Окна'], 'cs-windows'],
    ['workspaces', ['Workspaces', 'Рабочие области'], 'cs-workspaces'],
    ['display', ['Display', 'Дисплей'], 'cs-display'],
    ['keyboard', ['Keyboard', 'Клавиатура'], 'cs-keyboard'],
    ['mouse', ['Mouse and Touchpad', 'Мышь и сенсорная панель'], 'cs-mouse'],
    ['sound', ['Sound', 'Звук'], 'cs-sound'],
    ['power', ['Power Management', 'Управление питанием'], 'cs-power'],
    ['network', ['Network', 'Сеть'], 'cs-network'],
    ['bluetooth', ['Bluetooth', 'Bluetooth'], 'cs-bluetooth'],
    ['printers', ['Printers', 'Принтеры'], 'cs-printer'],
    ['notifications', ['Notifications', 'Уведомления'], 'cs-notifications'],
    ['calendar', ['Date & Time', 'Дата и время'], 'cs-date-time'],
    ['region', ['Languages', 'Язык и регион'], 'cs-language'],
    ['startup', ['Startup Applications', 'Автозапуск программ'], 'cs-startup-programs'],
    ['screensaver', ['Screensaver', 'Экранная заставка'], 'cs-screensaver'],
    ['privacy', ['Privacy', 'Конфиденциальность'], 'cs-privacy'],
    ['user', ['Account Details', 'Учётная запись'], 'cs-user'],
    ['color', ['Color', 'Цвет'], 'cs-color'],
    ['info', ['System Info', 'Информация о системе'], 'cs-info'],
    ['default', ['Preferred Applications', 'Приложения по умолчанию'], 'cs-default-applications'],
    ['actions', ['Actions', 'Действия'], 'cs-actions'],
];

const WORD_SPLIT = /[\s\-_.\/()]+/;
const SCROLL_RESET = 'padding: 0; margin: 0; border: none; background-color: transparent;';

// ---------------------------------------------------------------- утилиты ---
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(v, Math.max(lo, hi)));
}

function openUri(uri) {
    try {
        Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context(0, -1));
    } catch (e) {
        global.logError(e);
    }
}

function launchApp(info) {
    try {
        let app = Cinnamon.AppSystem.get_default().lookup_app(info.get_id());
        if (app) {
            app.open_new_window(-1);
            return;
        }
    } catch (e) { /* запасной путь ниже */ }
    try {
        info.launch([], global.create_app_launch_context(0, -1));
    } catch (e) {
        global.logError(e);
    }
}

// Запуск программы без оболочки (argv): команда — массив или строка из статических слов
function spawn(cmd) {
    try {
        Util.spawn(Array.isArray(cmd) ? cmd : cmd.split(' '));
    } catch (e) {
        global.logError(e);
    }
}

// Есть ли значок в теме (lookup_icon проверяет и дополнительные папки значков)
function themeHasIcon(name) {
    try {
        return !!Gtk.IconTheme.get_default().lookup_icon(name, 16, 0);
    } catch (e) {
        return false;
    }
}

function recentTimestamp(info) {
    try {
        let t = info.get_modified();
        if (typeof t === 'number') return t;
        if (t && typeof t.to_unix === 'function') return t.to_unix();
    } catch (e) { /* ignore */ }
    return 0;
}

// Недавние документы. Сначала — DocManager Cinnamon (кэшированный отсортированный список),
// если он пуст или недоступен — напрямую кэш Cinnamon.DocSystem (тот же источник).
function getRecent(limit) {
    let out = [];
    try {
        let dm = typeof DocInfo.getDocManager === 'function' ? DocInfo.getDocManager() : new DocInfo.DocManager();
        let infos = dm.getTimestampOrderedInfos();
        for (let i of infos.slice(0, limit)) {
            let name = i.name || (i.recentInfo ? i.recentInfo.get_display_name() : '');
            let gicon = i.gicon || null;
            if (!gicon) {
                try { gicon = Gio.content_type_get_icon(i.mimeType); } catch (e) { /* ignore */ }
            }
            out.push({
                name: name,
                gicon: gicon,
                open: () => {
                    try {
                        i.launch(-1);
                    } catch (e) {
                        openUri(i.uri);
                    }
                },
            });
        }
    } catch (e) {
        global.logError(e);
    }
    if (out.length) return out;

    try {
        let docSystem = Cinnamon.DocSystem.get_default();
        let infos = docSystem.get_all().slice();
        infos.sort((a, b) => recentTimestamp(b) - recentTimestamp(a));
        for (let i of infos.slice(0, limit)) {
            let gicon = null;
            try { gicon = Gio.content_type_get_icon(i.get_mime_type()); } catch (e) { /* ignore */ }
            let uri = i.get_uri();
            out.push({
                name: i.get_display_name(),
                gicon: gicon,
                open: () => {
                    try {
                        docSystem.open(i, -1);
                    } catch (e) {
                        openUri(uri);
                    }
                },
            });
        }
    } catch (e) {
        global.logError(e);
    }
    return out;
}

// Менеджер недавних документов Cinnamon наполняется не мгновенно: создаём его
// заранее, при запуске апплета, чтобы список был готов к первому открытию меню.
function warmUpRecent() {
    try {
        if (typeof DocInfo.getDocManager === 'function') DocInfo.getDocManager();
    } catch (e) { /* ignore */ }
    try {
        Cinnamon.DocSystem.get_default();
    } catch (e) { /* ignore */ }
}

function dirUri(key) {
    let path = GLib.get_user_special_dir(GLib.UserDirectory[key]);
    return path ? Gio.File.new_for_path(path).get_uri() : null;
}

function appDescription(app) {
    try {
        let d = app.get_description();
        return d ? d : null;
    } catch (e) {
        return null;
    }
}

function spawnArgv(argv) {
    spawn(argv);
}

// Cinnamon.App -> Gio.DesktopAppInfo
function appInfoOf(app) {
    try {
        let info = app.get_app_info();
        if (info) return info;
    } catch (e) { /* ignore */ }
    try {
        return Gio.DesktopAppInfo.new(app.get_id());
    } catch (e) {
        return null;
    }
}

function osName() {
    try {
        let n = GLib.get_os_info('PRETTY_NAME') || GLib.get_os_info('NAME');
        if (n) return n.length > 30 ? n.slice(0, 30) : n;
    } catch (e) { /* ignore */ }
    return 'Cinnamon';
}

// ------------------------------------------------------ цвета из темы ---
function mkColor(r, g, b, a) {
    return {red: r, green: g, blue: b, alpha: a === undefined ? 255 : a};
}

function rgba(c, mul) {
    let a = (c.alpha / 255) * (mul === undefined ? 1 : mul);
    return 'rgba(' + Math.round(c.red) + ',' + Math.round(c.green) + ',' + Math.round(c.blue) + ',' + a.toFixed(3) + ')';
}

function luminance(c) {
    return 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue;
}

// Читает из текущей темы цвет фона/рамки меню, цвет текста, шрифт и цвет выделения.
// Для этого создаются невидимые «пробные» актёры с теми же CSS-классами,
// что использует встроенное меню Cinnamon.
function readTheme(probeMenu) {
    let sf = 1;
    try {
        sf = St.ThemeContext.get_for_stage(global.stage).scale_factor || 1;
    } catch (e) { sf = 1; }
    let col = (c) => mkColor(c.red, c.green, c.blue, c.alpha);

    let t = {
        fg: mkColor(0, 0, 0), font: '',
        panelBg: null, panelBorder: null, panelBw: 1, panelRadius: 0,
        selBg: null, selFg: null, selBorder: null, selRadius: 0,
    };
    let probes = [];
    let addProbe = (a) => {
        a.opacity = 0;
        a.reactive = false;
        Main.uiGroup.add_child(a);
        probes.push(a);
        return a;
    };

    // текст и шрифт
    try {
        let box = addProbe(new St.BoxLayout({style_class: 'menu-application-button'}));
        let label = new St.Label({text: 'Ag', style_class: 'menu-application-button-label'});
        box.add_child(label);
        let ln = label.get_theme_node();
        t.fg = col(ln.get_foreground_color());
        try {
            let fd = ln.get_font();
            let fam = fd.get_family();
            let size = fd.get_size() / Pango.SCALE;
            if (fam) t.font += 'font-family: "' + fam.split(',')[0].trim() + '";';
            if (size > 0)
                t.font += 'font-size: ' + (fd.get_size_is_absolute() ? (size / sf) + 'px' : size + 'pt') + ';';
        } catch (e) { /* шрифт по умолчанию */ }
    } catch (e) {
        global.logError(e);
    }

    // выделенная строка
    try {
        let sel = addProbe(new St.BoxLayout({
            style_class: 'menu-application-button menu-application-button-selected'}));
        let sn = sel.get_theme_node();
        let bg = sn.get_background_color();
        let fg = sn.get_foreground_color();
        let bd = sn.get_border_color(St.Side.TOP);
        t.selRadius = Math.max(0, Math.round(sn.get_border_radius(St.Corner.TOPLEFT) / sf));
        if (bg.alpha < 20) {
            let alt = addProbe(new St.BoxLayout({style_class: 'popup-menu-item'}));
            alt.add_style_pseudo_class('active');
            try { alt.ensure_style(); } catch (e) { /* ignore */ }
            let an = alt.get_theme_node();
            let abg = an.get_background_color();
            if (abg.alpha >= 20) {
                bg = abg;
                fg = an.get_foreground_color();
                bd = an.get_border_color(St.Side.TOP);
            }
        }
        if (bg.alpha >= 20) {
            t.selBg = col(bg);
            t.selFg = col(fg);
            if (bd.alpha >= 20) t.selBorder = col(bd);
        }
    } catch (e) {
        global.logError(e);
    }

    // фон и рамка самого меню (рисуются «указателем» всплывающего меню)
    try {
        let nodes = [];
        try { nodes.push(probeMenu.actor.get_theme_node()); } catch (e) { /* ignore */ }
        try { nodes.push(probeMenu.box.get_theme_node()); } catch (e) { /* ignore */ }
        for (let n of nodes) {
            let c = n.get_color('-arrow-background-color');
            if (c.alpha < 10) c = n.get_background_color();
            if (c.alpha < 10) continue;
            t.panelBg = col(c);
            try {
                let b = n.get_color('-arrow-border-color');
                if (b.alpha >= 10) t.panelBorder = col(b);
                t.panelBw = Math.max(0, Math.round(n.get_length('-arrow-border-width') / sf));
                t.panelRadius = Math.max(0, Math.round(n.get_length('-arrow-border-radius') / sf));
            } catch (e) { /* ignore */ }
            break;
        }
    } catch (e) {
        global.logError(e);
    }

    // стеклянная заливка из картинок темы (border-image у .menu-background)
    t.glass = false;
    try {
        let g = addProbe(new St.BoxLayout({style_class: 'menu-background'}));
        t.glass = !!g.get_theme_node().get_border_image();
    } catch (e) {
        t.glass = false;
    }

    probes.forEach((p) => { try { p.destroy(); } catch (e) { /* ignore */ } });

    // запасные значения, если тема ничего не сообщила
    let darkText = luminance(t.fg) < 128;
    if (!t.panelBg) t.panelBg = darkText ? mkColor(242, 242, 242) : mkColor(40, 40, 40);
    if (!t.panelBorder) t.panelBorder = mkColor(t.fg.red, t.fg.green, t.fg.blue, 70);
    if (!t.selBg) t.selBg = mkColor(t.fg.red, t.fg.green, t.fg.blue, 45);
    if (!t.selFg) t.selFg = t.fg;
    if (!t.selBorder) t.selBorder = mkColor(t.selBg.red, t.selBg.green, t.selBg.blue, Math.min(255, t.selBg.alpha + 60));
    return t;
}

// ------------------------------------------------------------- строка меню ---
class MenuRow {
    constructor(menu, spec, level) {
        this.menu = menu;
        this.spec = spec;
        this.level = level;
        this.tip = null;
        this.ctx = !!spec.ctx;

        this.actor = new St.BoxLayout({reactive: true});
        this.actor._delegate = this;

        let size = spec.iconSize || (spec.big ? menu._bigSize : 16);
        let icon = menu._makeIcon(spec, size);
        if (icon) {
            icon.y_align = Clutter.ActorAlign.CENTER;
            this.actor.add_child(icon);
        }

        this.label = new St.Label({
            text: spec.label,
            style: 'max-width: 340px;',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.actor.add_child(this.label);

        if (spec.submenu) {
            this.actor.add_child(new St.Label({
                text: '\u25B8',
                style: 'padding-left: 14px;',
                y_align: Clutter.ActorAlign.CENTER,
            }));
        }

        this.setHighlight(false);

        this.actor.connect('enter-event', () => {
            menu._onRowEnter(this);
            return Clutter.EVENT_PROPAGATE;
        });
        this.actor.connect('button-press-event', () => Clutter.EVENT_STOP);
        this.actor.connect('button-release-event', (a, ev) => {
            let b = ev.get_button();
            if (b === 1) menu._onRowClick(this);
            else if (b === 3) menu._onRowContext(this, ev.get_coords());
            return Clutter.EVENT_STOP;
        });

        if (spec.tooltip) {
            try {
                this.tip = new Tooltips.Tooltip(this.actor, spec.tooltip);
            } catch (e) {
                this.tip = null;
            }
        }
    }

    setHighlight(on) {
        this.actor.style = this.menu._rowStyle(this.spec, on, this.level);
        if (on && !this.spec.disabled && this.menu._themeSel(this.level))
            this.actor.add_style_class_name('menu-application-button-selected');
        else
            this.actor.remove_style_class_name('menu-application-button-selected');
    }

    destroyTip() {
        if (!this.tip) return;
        try { this.tip.hide(); } catch (e) { /* ignore */ }
        try { this.tip.destroy(); } catch (e) { /* ignore */ }
        this.tip = null;
    }
}

// -------------------------------------------------------------------- меню ---
class StartMenu {
    constructor(applet) {
        this.applet = applet;
        this.isOpen = false;
        this.levels = [];
        this.shield = null;
        this._modalActor = null;
        this._pending = 0;
        this._pendingLevel = -1;
        this._closedAt = 0;
        this._kbdTime = 0;
        this._focus = 0;
        this._bigSize = 32;
        this._st = null;
        this._theme = null;
        this._apps = null;
        this._cats = null;
        this._index = null;
        this.itemsBox = null;
        this.resultsScroll = null;
        this.resultsBox = null;
        this.searchEntry = null;
        this.searchText = null;
        this.resultsMode = false;
        this._mainRows = [];
        this._resultRows = [];
        this._ctx = null;
        this._treeIds = null;
    }

    toggle() {
        if (this.isOpen) this.close();
        else if (Date.now() - this._closedAt > 250) this.open();
    }

    destroy() {
        this.close();
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this._theme = readTheme(this.applet._probeMenu);
        this._st = this._computeStyles(this._theme);
        this._apps = null;
        this._cats = null;
        this._treeIds = null;
        this._index = null;
        this._focus = 0;
        this.resultsMode = false;
        this._createShield();
        this._openMain();
        this.applet.actor.add_style_pseudo_class('active');
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this._closedAt = Date.now();
        this._cancelPending();
        this._closeContext();
        if (this._modalActor) {
            try { Main.popModal(this._modalActor); } catch (e) { /* ignore */ }
            this._modalActor = null;
        }
        this._closeFrom(0);
        if (this.shield) {
            this.shield.destroy();
            this.shield = null;
        }
        this.itemsBox = this.resultsScroll = this.resultsBox = null;
        this.searchEntry = this.searchText = null;
        this._mainRows = [];
        this._resultRows = [];
        this.applet.actor.remove_style_pseudo_class('active');
    }

    // ---------------------------------------------------------------- стили
    _computeStyles(t) {
        let sel = 'background-color: ' + rgba(t.selBg) + '; border: 1px solid ' + rgba(t.selBorder) +
            '; color: ' + rgba(t.selFg) + ';';
        let base = 'border: 1px solid rgba(0,0,0,0); border-radius: ' + t.selRadius + 'px;';
        let op = parseInt(this.applet.frameOpacity, 10);
        if (isNaN(op)) op = 55;
        let frameAlpha = clamp(op, 0, 100) / 100;
        let accent = mkColor(t.selBg.red, t.selBg.green, t.selBg.blue, 255);
        let bodyBg = mkColor(t.panelBg.red, t.panelBg.green, t.panelBg.blue, Math.max(t.panelBg.alpha, 235));
        let outline = 'rgba(255,255,255,' + (luminance(t.panelBg) > 128 ? '0.85' : '0.55') + ')';
        return {
            panel: 'background-color: ' + rgba(t.panelBg) +
                '; border: ' + t.panelBw + 'px solid ' + rgba(t.panelBorder) +
                '; border-radius: ' + t.panelRadius + 'px; padding: 2px; color: ' + rgba(t.fg) + '; ' + t.font,
            row: base + ' padding: 2px 6px; spacing: 8px; min-height: 20px;',
            rowBig: base + ' padding: 3px 8px; spacing: 10px;',
            rowSel: sel,
            glass: !!t.glass,
            frame: t.glass ? 'padding: 8px 8px 8px 6px;' : (
                'background-color: ' + rgba(accent, frameAlpha) +
                '; border: 2px solid ' + outline + '; border-radius: 12px; padding: 6px; ' +
                'box-shadow: 0 6px 18px rgba(0,0,0,0.5);'),
            body: t.glass ? ('padding: 2px; ' + t.font) : (
                'background-color: ' + rgba(bodyBg) +
                '; border: ' + Math.max(1, t.panelBw) + 'px solid ' + rgba(t.panelBorder) +
                '; border-radius: 5px; padding: 2px; color: ' + rgba(t.fg) + '; ' + t.font),
            dim: rgba(t.fg, 0.5),
            sep: 'height: 1px; margin: 3px 4px; background-color: ' + rgba(t.fg, 0.25) + ';',
        };
    }

    // подсветка из темы (картинка/цвет класса menu-application-button-selected)
    _themeSel(level) {
        return level === 0 || !!this.applet.themeSelCascades;
    }

    _rowStyle(spec, on, level) {
        let st = this._st;
        let s = spec.big ? st.rowBig : st.row;
        if (spec.disabled) s += ' color: ' + st.dim + ';';
        else if (on && !this._themeSel(level)) s += ' ' + st.rowSel;
        return s;
    }

    // ------------------------------------------- «щит», фокус и мониторы
    _createShield() {
        let [w, h] = global.stage.get_size();
        this.shield = new St.Bin({reactive: true});
        this.shield.set_position(0, 0);
        this.shield.set_size(w, h);
        this.shield.connect('button-press-event', () => {
            this.close();
            return Clutter.EVENT_STOP;
        });
        // запасной путь: если фокус клавиатуры оказался на «щите»
        this.shield.connect('key-press-event', (a, ev) => this._onKeyPress(a, ev));
        Main.uiGroup.add_child(this.shield);
    }

    _getMonitor() {
        let m = null;
        try {
            m = Main.layoutManager.findMonitorForActor(this.applet.actor);
        } catch (e) { /* ignore */ }
        return m || Main.layoutManager.primaryMonitor;
    }

    // ------------------------------------------------------- главная панель
    _buildBanner() {
        let area = new St.DrawingArea({style: 'width: 28px; margin-right: 2px;'});
        let custom = this.applet.bannerText;
        let text = custom && custom.length ? custom : osName();
        area.connect('repaint', (a) => {
            let cr = a.get_context();
            let [w, h] = a.get_surface_size();
            cr.save();
            cr.translate(w - 7, h - 8);
            cr.rotate(-Math.PI / 2);
            cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
            cr.setFontSize(18);
            // мягкая тень, чтобы белый текст читался на любом фоне
            cr.setSourceRGBA(0, 0, 0, 0.45);
            cr.moveTo(1, 1);
            cr.showText(text);
            cr.setSourceRGBA(1, 1, 1, 1);
            cr.moveTo(0, 0);
            cr.showText(text);
            cr.restore();
            cr.$dispose();
        });
        return area;
    }

    _openMain() {
        let mon = this._getMonitor();
        this._bigSize = mon.height >= 800 ? 32 : 24;

        // если тема рисует меню картинками, используем её собственные классы:
        // стекло (menu-background) и светлое «тело» (menu-favorites-box)
        let frame = new St.BoxLayout({reactive: true, style: this._st.frame,
            style_class: this._st.glass ? 'menu-background' : ''});
        frame.connect('button-press-event', () => Clutter.EVENT_STOP);
        let panel = new St.BoxLayout({style: this._st.body,
            style_class: this._st.glass ? 'menu-favorites-box' : ''});
        if (this.applet.showBanner !== false)
            frame.add_child(this._buildBanner());
        frame.add_child(panel);

        let col = new St.BoxLayout({vertical: true});
        panel.add_child(col);

        this.itemsBox = new St.BoxLayout({vertical: true, style: 'min-width: 240px;'});
        let items = this._makeItems(this._mainSpecs(), 0);
        items.actors.forEach((a) => this.itemsBox.add_child(a));
        this._mainRows = items.rows;

        this.resultsScroll = new St.ScrollView({style_class: 'vfade menu-applications-box', style: SCROLL_RESET});
        this.resultsScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.resultsBox = new St.BoxLayout({vertical: true});
        this.resultsScroll.add_actor(this.resultsBox);
        this.resultsScroll.hide();

        col.add_child(this.itemsBox);
        col.add_child(this.resultsScroll);

        this.searchEntry = new St.Entry({
            name: 'menu-search-entry',
            hint_text: T('search_hint'),
            track_hover: true,
            can_focus: true,
            style: 'margin: 4px 2px 2px 2px;',
        });
        this.searchText = this.searchEntry.clutter_text;
        try {
            this._findIcon = new St.Icon({icon_name: 'edit-find', icon_type: St.IconType.SYMBOLIC,
                style_class: 'menu-search-entry-icon'});
            this._clearIcon = new St.Icon({icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC,
                style_class: 'menu-search-entry-icon'});
            this.searchEntry.set_secondary_icon(this._findIcon);
            this.searchEntry.connect('secondary-icon-clicked', () => {
                if (this.searchText && this.searchText.get_text().length)
                    this.searchText.set_text('');
            });
        } catch (e) { /* значок поиска не критичен */ }
        this.searchText.connect('text-changed', () => this._onSearchChanged());
        this.searchText.connect('key-press-event', (a, ev) => this._onKeyPress(a, ev));
        col.add_child(this.searchEntry);

        Main.uiGroup.add_child(frame);

        // область результатов поиска равна по размеру списку пунктов,
        // поэтому размер меню не «прыгает» при вводе текста
        let [, iw] = this.itemsBox.get_preferred_width(-1);
        let [, ih] = this.itemsBox.get_preferred_height(-1);
        this.resultsScroll.set_size(iw, ih);

        let [, pw] = frame.get_preferred_width(-1);
        let [, ph] = frame.get_preferred_height(pw);
        let [ax, ay] = this.applet.actor.get_transformed_position();
        let [aw, ah] = this.applet.actor.get_transformed_size();
        let x, y;
        switch (this.applet.orientation) {
            case St.Side.TOP:
                x = ax; y = ay + ah; break;
            case St.Side.LEFT:
                x = ax + aw; y = ay; break;
            case St.Side.RIGHT:
                x = ax - pw; y = ay; break;
            default: // BOTTOM
                x = ax; y = ay - ph;
        }
        x = clamp(x, mon.x, mon.x + mon.width - pw);
        y = clamp(y, mon.y, mon.y + mon.height - ph);
        frame.set_position(Math.round(x), Math.round(y));

        this.levels.push({panel: frame, x: x, y: y, w: pw, h: ph,
            rows: this._mainRows, current: null, openRow: null});

        try {
            if (Main.pushModal(frame)) this._modalActor = frame;
        } catch (e) {
            this._modalActor = null;
        }
        Mainloop.idle_add(() => {
            try { if (this.searchText) this.searchText.grab_key_focus(); } catch (e) { /* ignore */ }
            return false;
        });
    }

    // ---------------------------------------------------------- каскадные панели
    _makeItems(specs, level) {
        let actors = [];
        let rows = [];
        for (let s of specs) {
            if (s === 'sep') {
                actors.push(new St.Widget({style: this._st.sep}));
                continue;
            }
            let row = new MenuRow(this, s, level);
            actors.push(row.actor);
            rows.push(row);
        }
        return {actors: actors, rows: rows};
    }

    _openLevel(level, specs, anchor) {
        this._closeFrom(level);
        let mon = this._getMonitor();
        if (!specs.length) specs = [{label: T('empty'), disabled: true}];

        let panel = new St.BoxLayout({reactive: true, style: this._st.panel});
        panel.connect('button-press-event', () => Clutter.EVENT_STOP);
        panel.connect('enter-event', () => {
            // указатель ушёл в более глубокий каскад — отменяем отложенное переключение
            if (this._pending && level > this._pendingLevel) this._cancelPending();
            return Clutter.EVENT_PROPAGATE;
        });

        // длинные списки не растягиваем на весь экран: ограничиваем высоту
        // и включаем прокрутку (колесо мыши, полоса прокрутки, клавиши)
        // класс menu-applications-box нужен, чтобы тема нарисовала полосу прокрутки
        // меню (трек и ползунок); отступы и фон этого класса обнуляем
        let scroll = new St.ScrollView({style_class: 'menu-applications-box', style: SCROLL_RESET});
        scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        let colBox = new St.BoxLayout({vertical: true});
        scroll.add_actor(colBox);
        panel.add_child(scroll);

        let items = this._makeItems(specs, level);
        items.actors.forEach((a) => colBox.add_child(a));
        Main.uiGroup.add_child(panel);

        let maxH = Math.floor(mon.height * 0.75);
        let natH = colBox.get_preferred_height(-1)[1];
        scroll.set_height(Math.min(natH, maxH));

        let [, pw] = panel.get_preferred_width(-1);
        let [, ph] = panel.get_preferred_height(pw);
        let parent = this.levels[level - 1];
        let [, iy] = anchor.actor.get_transformed_position();
        let x = parent.x + parent.w - 4;
        let y = iy - 6;
        if (x + pw > mon.x + mon.width) x = parent.x - pw + 4;
        x = clamp(x, mon.x, mon.x + mon.width - pw);
        y = clamp(y, mon.y, mon.y + mon.height - ph);
        panel.set_position(Math.round(x), Math.round(y));

        this.levels.push({panel: panel, x: x, y: y, w: pw, h: ph,
            rows: items.rows, current: null, openRow: null, scroll: scroll});
    }

    _destroyLevel(lv) {
        (lv.rows || []).forEach((r) => r.destroyTip());
        lv.panel.destroy();
    }

    _closeFrom(n) {
        while (this.levels.length > n) {
            this._destroyLevel(this.levels.pop());
        }
        if (n > 0) {
            let parent = this.levels[n - 1];
            if (parent && parent.openRow) {
                parent.openRow = null;
                this._refresh(n - 1);
            }
        }
        if (this._focus >= this.levels.length)
            this._focus = Math.max(0, this.levels.length - 1);
    }

    _refresh(n) {
        let lv = this.levels[n];
        if (!lv) return;
        lv.rows.forEach((r) => r.setHighlight(r === lv.current || r === lv.openRow));
    }

    // ----------------------------------------------------- мышь и открытие
    _cancelPending() {
        if (this._pending) {
            Mainloop.source_remove(this._pending);
            this._pending = 0;
        }
    }

    _onRowEnter(row) {
        if (row.ctx) {
            if (this._ctx) {
                this._ctx.current = row;
                this._ctxRefresh();
            }
            return;
        }
        // пока список прокручивается клавишами, мышь не перехватывает выделение
        if (Date.now() - this._kbdTime < 250) return;
        let lv = this.levels[row.level];
        if (!lv || lv.rows.indexOf(row) < 0) return;
        lv.current = row;
        this._focus = row.level;
        this._refresh(row.level);
        this._cancelPending();
        this._pendingLevel = row.level;
        this._pending = Mainloop.timeout_add(300, () => {
            this._pending = 0;
            this._enterRow(row, false);
            return false;
        });
    }

    _enterRow(row, focusInto) {
        let lv = this.levels[row.level];
        if (!lv || lv.rows.indexOf(row) < 0) return;
        if (row.spec.submenu) {
            if (lv.openRow === row && this.levels.length > row.level + 1) {
                if (focusInto) this._focusInto(row.level + 1);
                return;
            }
            this._closeFrom(row.level + 1);
            lv.openRow = row;
            this._refresh(row.level);
            let specs = [];
            try {
                specs = row.spec.submenu();
            } catch (e) {
                global.logError(e);
            }
            this._openLevel(row.level + 1, specs, row);
            if (focusInto) this._focusInto(row.level + 1);
        } else {
            this._closeFrom(row.level + 1);
        }
    }

    _focusInto(n) {
        let lv = this.levels[n];
        if (!lv) return;
        this._focus = n;
        lv.current = lv.rows.find((r) => !r.spec.disabled) || null;
        this._refresh(n);
    }

    _onRowClick(row) {
        if (row.ctx) {
            this._ctxActivate(row);
            return;
        }
        if (row.spec.disabled) return;
        this._cancelPending();
        if (row.spec.submenu) {
            this._enterRow(row, true);
            return;
        }
        this.close();
        try {
            row.spec.action();
        } catch (e) {
            global.logError(e);
        }
    }

    // -------------------------------------------------------------- клавиатура
    _move(delta) {
        let lv = this.levels[this._focus];
        if (!lv) return;
        let rows = lv.rows.filter((r) => !r.spec.disabled);
        if (!rows.length) return;
        let i = rows.indexOf(lv.current);
        let n = i < 0 ? (delta > 0 ? 0 : rows.length - 1) : (i + delta + rows.length) % rows.length;
        this._kbdTime = Date.now();
        this._cancelPending();
        this._closeFrom(this._focus + 1);
        lv.current = rows[n];
        this._refresh(this._focus);
        let sv = lv.scroll || (this._focus === 0 && this.resultsMode ? this.resultsScroll : null);
        if (sv) this._scrollTo(rows[n].actor, sv);
    }

    _scrollTo(actor, scroll) {
        scroll = scroll || this.resultsScroll;
        this._kbdTime = Date.now();
        Mainloop.idle_add(() => {
            try {
                let adj = scroll.get_vscroll_bar().get_adjustment();
                let box = actor.get_allocation_box();
                if (box.y1 < adj.value) adj.set_value(box.y1);
                else if (box.y2 > adj.value + adj.page_size) adj.set_value(box.y2 - adj.page_size);
            } catch (e) { /* ignore */ }
            this._kbdTime = Date.now();
            return false;
        });
    }

    _closeFocusLevel() {
        if (this._focus <= 0) return false;
        let n = this._focus;
        this._cancelPending();
        this._closeFrom(n);
        this._focus = n - 1;
        this._refresh(this._focus);
        return true;
    }

    _onKeyPress(actor, event) {
        let sym = event.get_key_symbol();
        let hasText = !!(this.searchText && this.searchText.get_text().length > 0);
        if (this._ctx) return this._onCtxKey(sym);
        if (sym === Clutter.KEY_Menu ||
            (sym === Clutter.KEY_F10 && (event.get_state() & Clutter.ModifierType.SHIFT_MASK))) {
            let clv = this.levels[this._focus];
            if (clv && clv.current) this._onRowContext(clv.current, null);
            return Clutter.EVENT_STOP;
        }
        switch (sym) {
            case Clutter.KEY_Up:
                this._move(-1);
                return Clutter.EVENT_STOP;
            case Clutter.KEY_Down:
                this._move(1);
                return Clutter.EVENT_STOP;
            case Clutter.KEY_Return:
            case Clutter.KEY_KP_Enter: {
                let lv = this.levels[this._focus];
                if (lv && lv.current) this._onRowClick(lv.current);
                return Clutter.EVENT_STOP;
            }
            case Clutter.KEY_Right: {
                if (hasText) return Clutter.EVENT_PROPAGATE; // курсор в строке поиска
                let lv = this.levels[this._focus];
                if (lv && lv.current && lv.current.spec.submenu) this._enterRow(lv.current, true);
                return Clutter.EVENT_STOP;
            }
            case Clutter.KEY_Left:
                if (hasText) return Clutter.EVENT_PROPAGATE;
                this._closeFocusLevel();
                return Clutter.EVENT_STOP;
            case Clutter.KEY_Home:
            case Clutter.KEY_End: {
                if (hasText) return Clutter.EVENT_PROPAGATE;
                let lv = this.levels[this._focus];
                if (lv) {
                    let rows = lv.rows.filter((r) => !r.spec.disabled);
                    if (rows.length) {
                        this._kbdTime = Date.now();
                        this._closeFrom(this._focus + 1);
                        lv.current = sym === Clutter.KEY_Home ? rows[0] : rows[rows.length - 1];
                        this._refresh(this._focus);
                        let hsv = lv.scroll || (this._focus === 0 && this.resultsMode ? this.resultsScroll : null);
                        if (hsv) this._scrollTo(lv.current.actor, hsv);
                    }
                }
                return Clutter.EVENT_STOP;
            }
            case Clutter.KEY_Escape:
                if (hasText) this.searchText.set_text('');
                else if (!this._closeFocusLevel()) this.close();
                return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    // ------------------------------------------------------------------ поиск
    _updateSearchIcon(hasText) {
        try {
            this.searchEntry.set_secondary_icon(hasText ? this._clearIcon : this._findIcon);
        } catch (e) { /* ignore */ }
    }

    _onSearchChanged() {
        if (!this.searchText) return;
        let raw = this.searchText.get_text();
        let text = raw.trim();
        this._updateSearchIcon(raw.length > 0);
        let lv = this.levels[0];
        if (!lv) return;
        this._cancelPending();
        this._closeFrom(1);
        if (text.length) this._showResults(text);
        else this._hideResults();
    }

    _showResults(text) {
        let lv = this.levels[0];
        this._resultRows.forEach((r) => r.destroyTip());
        this.resultsBox.destroy_all_children();
        let found = this._search(text);
        let specs = found.map((e) => ({
            label: e.name, gicon: e.gicon, iconName: e.iconName, iconSize: 20, appInfo: e.info, action: e.action,
        }));
        if (!specs.length) specs = [{label: T('no_results'), disabled: true}];
        let items = this._makeItems(specs, 0);
        items.actors.forEach((a) => this.resultsBox.add_child(a));
        this._resultRows = items.rows;
        lv.rows = items.rows;
        lv.current = items.rows.find((r) => !r.spec.disabled) || null;
        lv.openRow = null;
        this.resultsMode = true;
        this._focus = 0;
        this.itemsBox.hide();
        this.resultsScroll.show();
        this._refresh(0);
        Mainloop.idle_add(() => {
            try { this.resultsScroll.get_vscroll_bar().get_adjustment().set_value(0); } catch (e) { /* ignore */ }
            return false;
        });
    }

    _hideResults() {
        let lv = this.levels[0];
        if (!this.resultsMode) return;
        this.resultsMode = false;
        this.resultsScroll.hide();
        this.itemsBox.show();
        lv.rows = this._mainRows;
        lv.current = null;
        lv.openRow = null;
        this._refresh(0);
    }

    _loadApps() {
        if (this._apps) return this._apps;
        this._apps = Gio.AppInfo.get_all().filter((a) => {
            try { return a.should_show(); } catch (e) { return false; }
        });
        return this._apps;
    }

    // Категории из системного меню (cinnamon-applications.menu): то, что вы меняете
    // в «Редакторе меню» (новые пункты и папки, скрытые пункты), попадает сюда.
    _categories() {
        if (this._cats) return this._cats;
        let cats = null;
        try {
            cats = this._treeCategories();
        } catch (e) {
            global.logError(e);
            cats = null;
        }
        if (cats && cats.length) {
            this._cats = cats;
            return cats;
        }
        this._treeIds = null;
        return this._fallbackCategories();
    }

    _treeCategories() {
        if (!CMenu) return null;
        let tree = Cinnamon.AppSystem.get_default().get_tree();
        let root = tree.get_root_directory();
        if (!root) return null;
        this._treeIds = {};
        let byName = (a, b) => a.get_name().localeCompare(b.get_name());
        let out = [];
        let it = root.iter();
        let t;
        while ((t = it.next()) !== CMenu.TreeItemType.INVALID) {
            if (t !== CMenu.TreeItemType.DIRECTORY) continue;
            let dir = it.get_directory();
            try {
                if (dir.get_is_nodisplay()) continue;
            } catch (e) { /* ignore */ }
            let apps = [];
            this._collectApps(dir, apps, {});
            if (apps.length)
                out.push({id: dir.get_menu_id() || dir.get_name(), label: dir.get_name(), apps: apps.sort(byName)});
        }
        return out;
    }

    _collectApps(dir, apps, seen) {
        let it = dir.iter();
        let t;
        while ((t = it.next()) !== CMenu.TreeItemType.INVALID) {
            if (t === CMenu.TreeItemType.ENTRY) {
                let entry = it.get_entry();
                let info = entry.get_app_info();
                if (!info) continue;
                try {
                    if (info.get_nodisplay()) continue;
                } catch (e) { /* ignore */ }
                let id = entry.get_desktop_file_id();
                if (seen[id]) continue;
                seen[id] = true;
                this._treeIds[id] = true;
                apps.push(info);
            } else if (t === CMenu.TreeItemType.DIRECTORY) {
                this._collectApps(it.get_directory(), apps, seen);
            }
        }
    }

    // Для поиска берём те же программы, что показывает системное меню
    _indexApps() {
        this._categories();
        let apps = this._loadApps();
        if (this._treeIds)
            apps = apps.filter((a) => this._treeIds[a.get_id()]);
        return apps;
    }

    _fallbackCategories() {
        let groups = {};
        let other = [];
        for (let app of this._loadApps()) {
            let raw = '';
            try {
                raw = (typeof app.get_categories === 'function' ? app.get_categories() : '') || '';
            } catch (e) { /* ignore */ }
            let list = raw.split(';');
            let cat = CATS.find((c) => list.indexOf(c[0]) >= 0);
            if (cat) (groups[cat[0]] = groups[cat[0]] || []).push(app);
            else other.push(app);
        }
        let byName = (a, b) => a.get_name().localeCompare(b.get_name());
        let out = [];
        for (let c of CATS) {
            if (groups[c[0]] && groups[c[0]].length)
                out.push({id: c[0], label: pick(c[1]), apps: groups[c[0]].sort(byName)});
        }
        if (other.length)
            out.push({id: '_other', label: T('other'), apps: other.sort(byName)});
        this._cats = out;
        return out;
    }

    _ensureIndex() {
        if (this._index) return;
        let idx = [];
        let appNames = {};
        let add = (e) => {
            e.lname = e.name.toLowerCase();
            e.words = e.lname.split(WORD_SPLIT);
            e.extra = (e.extra || '').toLowerCase();
            e.extraWords = e.extra.split(WORD_SPLIT);
            idx.push(e);
        };

        // 0 — приложения
        for (let app of this._indexApps()) {
            let name = app.get_name() || '';
            let extra = [];
            try { let g = app.get_generic_name(); if (g) extra.push(g); } catch (e) { /* ignore */ }
            try { let k = app.get_keywords(); if (k && k.length) extra.push(k.join(' ')); } catch (e) { /* ignore */ }
            try { let d = app.get_description(); if (d) extra.push(d); } catch (e) { /* ignore */ }
            appNames[name.toLowerCase()] = true;
            add({kind: 0, name: name, extra: extra.join(' '), gicon: app.get_icon(), info: app,
                action: () => launchApp(app)});
        }

        // 1 — параметры системы (если такого же приложения ещё нет)
        for (let m of MODULES) {
            let name = pick(m[1]);
            if (appNames[name.toLowerCase()]) continue;
            add({kind: 1, name: name, extra: m[1].join(' ') + ' ' + m[0], iconName: m[2],
                action: () => spawn('cinnamon-settings ' + m[0])});
        }

        // 2 — команды и места
        let cmd = (key, icon, extra, action) => add({kind: 2, name: T(key),
            extra: S[key].join(' ') + ' ' + extra, iconName: icon, action: action});
        cmd('control_panel', 'preferences-system', 'settings preferences параметры настройки',
            () => spawn('cinnamon-settings'));
        cmd('help_support', 'help-browser', 'help manual справка руководство', () => this._help());
        cmd('run', 'system-run', 'command launch запуск команда', () => this._run());
        cmd('shutdown', 'system-shutdown', 'power off poweroff turn off выключить', () => this._power('shutdown'));
        cmd('restart', 'system-reboot', 'reboot перезагрузка', () => this._power('restart'));
        cmd('sleep', 'system-suspend', 'suspend standby сон ждущий', () => this._power('sleep'));
        cmd('lock', 'system-lock-screen', 'screensaver заблокировать', () => this._power('lock'));
        cmd('logoff', 'system-log-out', 'logout sign out выйти выход', () => this._power('logoff'));
        cmd('computer', 'computer', 'мой компьютер', () => spawn('nemo computer:///'));
        cmd('network_places', 'network-workgroup', 'network places сетевое окружение',
            () => spawn('nemo network:///'));
        add({kind: 2, name: T('home'), extra: 'home user-home ~ домой', iconName: 'user-home',
            action: () => openUri(Gio.File.new_for_path(GLib.get_home_dir()).get_uri())});
        for (let d of DIRS) {
            let uri = dirUri(d[0]);
            if (uri) add({kind: 2, name: pick(d[1]), extra: d[1].join(' '), iconName: d[2],
                action: () => openUri(uri)});
        }

        // 3 — недавние файлы
        for (let r of getRecent(50)) {
            add({kind: 3, name: r.name, extra: '', gicon: r.gicon, iconName: 'text-x-generic',
                action: () => r.open()});
        }
        this._index = idx;
    }

    _search(text) {
        this._ensureIndex();
        let tokens = text.toLowerCase().split(/\s+/).filter((t) => t.length);
        if (!tokens.length) return [];
        let out = [];
        for (let e of this._index) {
            let total = 0;
            let ok = true;
            for (let t of tokens) {
                let s = 0;
                if (e.lname === t) s = 100;
                else if (e.lname.startsWith(t)) s = 80;
                else if (e.words.some((w) => w.startsWith(t))) s = 60;
                else if (e.lname.indexOf(t) >= 0) s = 40;
                else if (e.extraWords.some((w) => w.startsWith(t))) s = 25;
                else if (e.extra.indexOf(t) >= 0) s = 10;
                if (!s) { ok = false; break; }
                total += s;
            }
            if (ok) out.push({e: e, score: total / tokens.length});
        }
        out.sort((a, b) => (b.score - a.score) || (a.e.kind - b.e.kind) || a.e.name.localeCompare(b.e.name));
        return out.slice(0, 40).map((o) => o.e);
    }

    // --------------------------------------------------------- значки
    _makeIcon(spec, size) {
        if (spec.noIcon) return null;
        if (spec.softIcon && !spec.gicon && !spec.iconFn) {
            try {
                if (!themeHasIcon(spec.iconName)) return null;
            } catch (e) {
                return null;
            }
        }
        let icon = null;
        if (spec.iconFn) {
            try { icon = spec.iconFn(size); } catch (e) { icon = null; }
        }
        if (!icon) {
            if (spec.gicon) {
                icon = new St.Icon({gicon: spec.gicon, icon_size: size, icon_type: St.IconType.FULLCOLOR});
            } else {
                let name = spec.iconName || 'application-x-executable';
                try {
                    if (!themeHasIcon(name)) name = 'application-x-executable';
                } catch (e) { /* ignore */ }
                icon = new St.Icon({icon_name: name, icon_size: size, icon_type: St.IconType.FULLCOLOR});
            }
        }
        return icon;
    }

    // ---------------------------------------------------- содержимое меню
    _mainSpecs() {
        let specs = [];
        let pinned = [];
        try {
            let n = Math.max(0, parseInt(this.applet.pinnedCount, 10) || 0);
            pinned = AppFavorites.getAppFavorites().getFavorites().slice(0, n);
        } catch (e) {
            global.logError(e);
        }
        for (let app of pinned) {
            specs.push({
                label: app.get_name(), big: true,
                iconFn: (size) => app.create_icon_texture(size),
                tooltip: appDescription(app),
                appInfo: appInfoOf(app),
                action: () => app.open_new_window(-1),
            });
        }
        if (pinned.length) specs.push('sep');
        specs.push(
            {label: T('programs'), iconName: 'applications-other', big: true,
                submenu: () => this._programsSpecs()},
            {label: T('documents'), iconName: 'folder-documents', big: true,
                submenu: () => this._documentsSpecs()},
            {label: T('settings'), iconName: 'preferences-system', big: true,
                submenu: () => this._settingsSpecs()},
            {label: T('search'), iconName: 'system-search', big: true,
                submenu: () => this._findSpecs()},
            {label: T('help_support'), iconName: 'help-browser', big: true,
                action: () => this._help()},
            {label: T('run'), iconName: 'system-run', big: true,
                action: () => this._run()},
            'sep',
            {label: T('shutdown_dots'), iconName: 'system-shutdown', big: true,
                submenu: () => this._powerSpecs()}
        );
        return specs;
    }

    _programsSpecs() {
        return this._categories().map((g) => ({
            label: g.label,
            iconName: 'folder',
            submenu: () => g.apps.map((app) => ({
                label: app.get_name(),
                gicon: app.get_icon(),
                tooltip: appDescription(app),
                appInfo: app,
                action: () => launchApp(app),
            })),
        }));
    }

    _documentsSpecs() {
        let specs = [];
        for (let d of DIRS) {
            let uri = dirUri(d[0]);
            if (uri) specs.push({label: pick(d[1]), iconName: d[2], action: () => openUri(uri)});
        }
        let recent = getRecent(12);
        if (recent.length) {
            specs.push('sep');
            for (let r of recent) {
                specs.push({label: r.name, gicon: r.gicon, iconName: 'text-x-generic',
                    action: () => r.open()});
            }
        }
        return specs;
    }

    _settingsSpecs() {
        let specs = [
            {label: T('control_panel'), iconName: 'preferences-system',
                action: () => spawn('cinnamon-settings')},
            'sep',
        ];
        let mods = MODULES.slice().sort((a, b) => pick(a[1]).localeCompare(pick(b[1])));
        for (let m of mods)
            specs.push({label: pick(m[1]), iconName: m[2], action: () => spawn('cinnamon-settings ' + m[0])});
        return specs;
    }

    _findSpecs() {
        return [{
            label: T('find_files'),
            iconName: 'system-search',
            action: () => {
                // catfish — если установлен (ищем по его .desktop-файлу), иначе файловый менеджер
                let cat = Gio.DesktopAppInfo.new('catfish.desktop') ||
                    Gio.DesktopAppInfo.new('org.xfce.Catfish.desktop');
                if (cat) launchApp(cat);
                else spawn('nemo');
            },
        }];
    }

    _powerSpecs() {
        return [
            {label: T('shutdown'), iconName: 'system-shutdown', action: () => this._power('shutdown')},
            {label: T('restart'), iconName: 'system-reboot', action: () => this._power('restart')},
            {label: T('sleep'), iconName: 'system-suspend', action: () => this._power('sleep')},
            {label: T('lock'), iconName: 'system-lock-screen', action: () => this._power('lock')},
            {label: T('logoff'), iconName: 'system-log-out', action: () => this._power('logoff')},
        ];
    }

    // ---------------------------------------------------------------- команды
    // ----------------------------------------------------- контекстное меню
    _onRowContext(row, coords) {
        if (row.ctx || !row.spec.appInfo) return;
        this._cancelPending();
        this._openContext(row, coords);
    }

    _contextSpecs(info) {
        let id = info.get_id();
        let file = null;
        try { file = typeof info.get_filename === 'function' ? info.get_filename() : null; } catch (e) { file = null; }
        let favs = null;
        try { favs = AppFavorites.getAppFavorites(); } catch (e) { favs = null; }

        let specs = [{label: T('ctx_open'), iconName: 'system-run', action: () => launchApp(info)}];

        // «действия» из .desktop-файла (например, «Новое окно»)
        let actions = [];
        try { actions = typeof info.list_actions === 'function' ? info.list_actions() : []; } catch (e) { actions = []; }
        if (actions.length) {
            specs.push('sep');
            for (let a of actions) {
                let name = a;
                try { name = info.get_action_name(a) || a; } catch (e) { /* ignore */ }
                specs.push({label: name, action: () => {
                    try {
                        info.launch_action(a, global.create_app_launch_context(0, -1));
                    } catch (e) {
                        global.logError(e);
                    }
                }});
            }
        }

        specs.push('sep');
        specs.push({label: T('ctx_add_panel'), iconName: 'list-add', action: () => this._addToPanel(id)});
        if (file)
            specs.push({label: T('ctx_add_desktop'), iconName: 'user-desktop', action: () => this._addToDesktop(file)});
        if (favs) {
            let isFav = false;
            try { isFav = favs.isFavorite(id); } catch (e) { /* ignore */ }
            if (isFav) {
                specs.push({label: T('ctx_remove_fav'), iconName: 'list-remove', action: () => {
                    try { favs.removeFavorite(id); } catch (e) { global.logError(e); }
                }});
            } else {
                specs.push({label: T('ctx_add_fav'), iconName: 'starred', action: () => {
                    try { favs.addFavorite(id); } catch (e) { global.logError(e); }
                }});
            }
        }

        let tail = [];
        if (file)
            tail.push({label: T('ctx_uninstall'), iconName: 'edit-delete',
                action: () => spawnArgv(['cinnamon-remove-application', file])});
        if (file)
            tail.push({label: T('ctx_properties'), iconName: 'document-properties',
                action: () => spawnArgv(['cinnamon-desktop-editor', '-mlauncher', '-o', file])});
        if (tail.length) {
            specs.push('sep');
            tail.forEach((t) => specs.push(t));
        }
        return specs;
    }

    _openContext(row, coords) {
        this._closeContext();
        let mon = this._getMonitor();
        let specs = this._contextSpecs(row.spec.appInfo);

        // прозрачный «щит»: щелчок мимо контекстного меню закрывает только его
        let [sw, sh] = global.stage.get_size();
        let shield = new St.Bin({reactive: true});
        shield.set_position(0, 0);
        shield.set_size(sw, sh);
        shield.connect('button-press-event', () => {
            this._closeContext();
            return Clutter.EVENT_STOP;
        });
        Main.uiGroup.add_child(shield);

        let panel = new St.BoxLayout({vertical: true, reactive: true, style: this._st.panel});
        panel.connect('button-press-event', () => Clutter.EVENT_STOP);
        let items = this._makeItems(
            specs.map((s) => (s === 'sep' ? s : Object.assign({ctx: true, softIcon: true}, s))), -1);
        items.actors.forEach((a) => panel.add_child(a));
        Main.uiGroup.add_child(panel);

        let [, pw] = panel.get_preferred_width(-1);
        let [, ph] = panel.get_preferred_height(pw);
        let x, y;
        if (coords) {
            x = coords[0];
            y = coords[1];
        } else {
            let [rx, ry] = row.actor.get_transformed_position();
            let [rw, rh] = row.actor.get_transformed_size();
            x = rx + rw / 2;
            y = ry + rh / 2;
        }
        x = clamp(x, mon.x, mon.x + mon.width - pw);
        y = clamp(y, mon.y, mon.y + mon.height - ph);
        panel.set_position(Math.round(x), Math.round(y));

        this._ctx = {shield: shield, panel: panel, rows: items.rows,
            current: coords ? null : (items.rows[0] || null)};
        this._ctxRefresh();
    }

    _ctxRefresh() {
        if (!this._ctx) return;
        let c = this._ctx;
        c.rows.forEach((r) => r.setHighlight(r === c.current));
    }

    _ctxActivate(row) {
        let action = row.spec.action;
        this.close(); // закрывает и контекстное меню
        try {
            if (action) action();
        } catch (e) {
            global.logError(e);
        }
    }

    _closeContext() {
        if (!this._ctx) return;
        let c = this._ctx;
        this._ctx = null;
        try { c.panel.destroy(); } catch (e) { /* ignore */ }
        try { c.shield.destroy(); } catch (e) { /* ignore */ }
    }

    _onCtxKey(sym) {
        let c = this._ctx;
        let rows = c.rows.filter((r) => !r.spec.disabled);
        switch (sym) {
            case Clutter.KEY_Up:
            case Clutter.KEY_Down: {
                if (!rows.length) break;
                let i = rows.indexOf(c.current);
                let d = sym === Clutter.KEY_Down ? 1 : -1;
                let n = i < 0 ? (d > 0 ? 0 : rows.length - 1) : (i + d + rows.length) % rows.length;
                c.current = rows[n];
                this._ctxRefresh();
                break;
            }
            case Clutter.KEY_Return:
            case Clutter.KEY_KP_Enter:
                if (c.current) this._ctxActivate(c.current);
                break;
            case Clutter.KEY_Escape:
            case Clutter.KEY_Left:
                this._closeContext();
                break;
        }
        return Clutter.EVENT_STOP;
    }

    // «Добавить на панель» — так же, как во встроенном меню Cinnamon
    _addToPanel(id) {
        try {
            let AM = Main.AppletManager;
            if (!AM.get_role_provider_exists(AM.Roles.PANEL_LAUNCHER)) {
                let newId = global.settings.get_int('next-applet-id');
                global.settings.set_int('next-applet-id', newId + 1);
                let enabled = global.settings.get_strv('enabled-applets');
                enabled.push('panel1:right:0:panel-launchers@cinnamon.org:' + newId);
                global.settings.set_strv('enabled-applets', enabled);
            }
            let launcher = AM.get_role_provider(AM.Roles.PANEL_LAUNCHER);
            if (launcher) launcher.acceptNewLauncher(id);
        } catch (e) {
            global.logError(e);
        }
    }

    _addToDesktop(file) {
        try {
            let desktop = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
            if (!desktop) return;
            let dest = Gio.File.new_for_path(GLib.build_filenamev([desktop, GLib.path_get_basename(file)]));
            Gio.File.new_for_path(file).copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
            try { dest.set_attribute_uint32('unix::mode', 0o755, Gio.FileQueryInfoFlags.NONE, null); } catch (e) { /* ignore */ }
            try { dest.set_attribute_string('metadata::trusted', 'true', Gio.FileQueryInfoFlags.NONE, null); } catch (e) { /* ignore */ }
        } catch (e) {
            global.logError(e);
        }
    }

    _help() {
        let yelp = Gio.DesktopAppInfo.new('yelp.desktop');
        if (yelp) launchApp(yelp);
        else spawn(['xdg-open', 'https://linuxmint-user-guide.readthedocs.io/']);
    }

    _run() {
        try {
            let dlg = typeof Main.getRunDialog === 'function' ? Main.getRunDialog() : Main.runDialog;
            dlg.open();
        } catch (e) {
            global.logError(e);
        }
    }

    _power(kind) {
        this.close();
        let np = this.applet.confirmPower ? '' : ' --no-prompt';
        switch (kind) {
            case 'shutdown': spawn('cinnamon-session-quit --power-off' + np); break;
            case 'restart': spawn('cinnamon-session-quit --reboot' + np); break;
            case 'logoff': spawn('cinnamon-session-quit --logout' + np); break;
            case 'sleep': spawn('systemctl suspend'); break;
            case 'lock': spawn('cinnamon-screensaver-command --lock'); break;
        }
    }
}

// ----------------------------------------------------------------- апплет ---
class ClassicStartApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.metadata = metadata;
        this.orientation = orientation;
        this._instanceId = instance_id;

        if (typeof this.setAllowedLayout === 'function')
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        // Неоткрываемое всплывающее меню Cinnamon: из него читается оформление темы.
        this._probeMenu = new Applet.AppletPopupMenu(this, orientation);
        try {
            this._probeMenu.setCustomStyleClass('menu-background');
        } catch (e) { /* не критично */ }

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind('use-custom-icon', 'useCustomIcon', () => this._updateIconAndLabel());
        this.settings.bind('custom-icon', 'customIcon', () => this._updateIconAndLabel());
        this.settings.bind('menu-label', 'menuLabel', () => this._updateIconAndLabel());
        this.settings.bind('hotkey', 'hotkey', () => this._updateKeybinding());
        this.settings.bind('show-banner', 'showBanner');
        this.settings.bind('banner-text', 'bannerText');
        this.settings.bind('pinned-count', 'pinnedCount');
        this.settings.bind('confirm-power', 'confirmPower');
        this.settings.bind('frame-opacity', 'frameOpacity');
        this.settings.bind('theme-sel-cascades', 'themeSelCascades');

        warmUpRecent();
        this.startMenu = new StartMenu(this);
        this._buildContextMenu();
        this._updateIconAndLabel();
        this._updateKeybinding();
    }

    // Правый клик по кнопке на панели: «Редактировать меню» — как у встроенного меню
    _buildContextMenu() {
        try {
            let item = new PopupMenu.PopupIconMenuItem(T('edit_menu'), 'document-edit-symbolic',
                St.IconType.SYMBOLIC);
            item.connect('activate', () => spawn('cinnamon-menu-editor'));
            this._applet_context_menu.addMenuItem(item);
        } catch (e) {
            global.logError(e);
        }
    }

    _updateIconAndLabel() {
        let ic = this.customIcon;
        if (this.useCustomIcon && ic) {
            let symbolic = ic.indexOf('-symbolic') >= 0;
            if (GLib.path_is_absolute(ic)) {
                // файл проверяем асинхронно, чтобы не блокировать Cinnamon
                Gio.File.new_for_path(ic).query_info_async('standard::name', Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT, null, (file, res) => {
                        try {
                            file.query_info_finish(res);
                            if (symbolic) this.set_applet_icon_symbolic_path(ic);
                            else this.set_applet_icon_path(ic);
                        } catch (e) {
                            this._setThemeIcon(ic, symbolic);
                        }
                    });
            } else {
                this._setThemeIcon(ic, symbolic);
            }
        } else {
            this._setThemeIcon('start-here-symbolic', true);
        }
        let label = this.menuLabel || '';
        this.set_applet_label(label);
        this.hide_applet_label(!label);
    }

    _setThemeIcon(name, symbolic) {
        try {
            if (!themeHasIcon(name)) {
                name = 'start-here-symbolic';
                symbolic = true;
            }
            if (symbolic) this.set_applet_icon_symbolic_name(name);
            else this.set_applet_icon_name(name);
        } catch (e) {
            global.logError(e);
        }
    }

    _updateKeybinding() {
        let id = 'waterfall-menu-' + this._instanceId;
        try {
            Main.keybindingManager.removeHotKey(id);
        } catch (e) { /* ignore */ }
        if (this.hotkey)
            Main.keybindingManager.addHotKey(id, this.hotkey, () => this.startMenu.toggle());
    }

    on_applet_clicked() {
        this.startMenu.toggle();
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this.startMenu.close();
        try {
            this._probeMenu.setArrowSide(orientation);
        } catch (e) { /* ignore */ }
    }

    on_applet_removed_from_panel() {
        try {
            Main.keybindingManager.removeHotKey('waterfall-menu-' + this._instanceId);
        } catch (e) { /* ignore */ }
        this.startMenu.destroy();
        try { this._probeMenu.destroy(); } catch (e) { /* ignore */ }
        this.settings.finalize();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ClassicStartApplet(metadata, orientation, panel_height, instance_id);
}
