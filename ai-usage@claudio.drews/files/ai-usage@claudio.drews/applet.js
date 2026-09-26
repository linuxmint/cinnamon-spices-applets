/* Cinnamon AI Usage — native CJS/St frontend; see docs/contract.md and docs/i18n.md. */
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const Clutter = imports.gi.Clutter;

const WARNING_COLOR = '#e5a50a';
const CRITICAL_COLOR = '#e01b24';

// Texto visível nasce aqui com msgid em inglês; a tradução vive em
// locale/<idioma>/LC_MESSAGES/ai-usage@claudio.drews.mo.
//
// O catálogo é lido pelo próprio applet, e não por Gettext.dgettext: o processo do shell
// é compartilhado e trocar o locale dele para atender a preferência de uma instância
// mexeria no resto do painel. Aqui, cada idioma tem a sua tabela, e o idioma resolvido
// governa texto e formatação do painel — que é o que a preferência promete.
let _uuid = null;
let _appletPath = null;
let _language = 'en';
const _catalogs = {};

function _(text) {
    const table = catalogFor(_language);
    return (table && typeof table.singles[text] === 'string') ? table.singles[text] : text;
}

// Plural do catálogo: o .mo guarda as formas separadas por NUL, e a forma escolhida segue a
// expressão `Plural-Forms` do cabeçalho do catálogo, espelhada aqui em backend/i18n.py
// (`LANGUAGES[code]["plural"]`). Em pt_BR a expressão é `plural=(n > 1)`: zero é singular,
// e um `n === 1` genérico devolveria o plural em "0 dia" — divergência que só aparece no
// dia em que o painel mostrar uma frase com plural.
const PLURAL_INDEX = {
    pt_BR: n => (n > 1 ? 1 : 0),
    en: n => (n === 1 ? 0 : 1),
};

function _n(singular, plural, n) {
    const forms = (catalogFor(_language) || {plurals: {}}).plurals[singular];
    const index = (PLURAL_INDEX[_language] || PLURAL_INDEX.en)(Number(n));
    if (!forms || !forms.length) return index === 0 ? singular : plural;
    return forms[index] !== undefined ? forms[index] : forms[0];
}

// Valor de marcador de um registro que veio do cache: texto entra como veio; **número cru** é
// escrito pela tabela do idioma (`1,5` em pt_BR, `1.5` em inglês) e trecho com identificador é
// resolvido aqui. É a mesma regra de `i18n.arg_text` no backend — guardar o número formatado
// prendia a leitura ao idioma da coleta ("Janela de 1,5 h" numa tela em inglês).
function _argValue(value) {
    if (typeof value === 'number' && isFinite(value))
        return formatNumber(value, Number.isInteger(value) ? 0 : 1, _language);
    if (Array.isArray(value)) {
        const parts = value.map(_argValue).filter(part => part);
        return parts.length ? ' ' + parts.join(' ') : '';
    }
    if (value && typeof value === 'object') {
        const trecho = _recordText(value, 'id', 'args', 'text');
        // Trecho sem texto gravado e sem entrada no catálogo cai no próprio msgid: um trecho da
        // nota nunca desaparece da frase em silêncio (é a mesma regra de `i18n.arg_text`).
        return trecho || (typeof value.id === 'string' ? _f(value.id, value.args) : '');
    }
    return value === undefined || value === null ? '' : String(value);
}

function _f(text, values) {
    return text.replace(/\{(\w+)\}/g, (whole, name) =>
        Object.prototype.hasOwnProperty.call(values || {}, name) ? _argValue(values[name]) : whole);
}

// Texto que veio do cache: o identificador (msgid) manda, e o texto gravado é só o recurso
// de quem não tem catálogo. Uma leitura de ontem aparece no idioma de hoje; em inglês, o
// identificador já é a frase.
function _recordText(record, idField, argsField, textField) {
    if (!record) return '';
    const ident = record[idField];
    if (typeof ident === 'string' && ident) {
        const table = catalogFor(_language);
        if (!table) return _f(ident, record[argsField]);
        const translated = table.singles[ident];
        if (typeof translated === 'string') return _f(translated, record[argsField]);
    }
    const text = record[textField];
    return typeof text === 'string' ? text : '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dataHome() {
    return GLib.getenv('XDG_DATA_HOME') ||
        GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share']);
}

// Onde o catálogo pode estar, na ordem em que o Cinnamon procura: a cópia que o
// instalador põe junto do applet (fonte e instalado são a mesma pasta), depois o
// diretório de dados do usuário — que é o que o shell liga ao domínio do xlet — e por
// fim o sistema.
function catalogPaths(code) {
    if (!_uuid || !_appletPath) return [];
    const relative = ['LC_MESSAGES', _uuid + '.mo'];
    return [
        GLib.build_filenamev([_appletPath, 'locale', code].concat(relative)),
        GLib.build_filenamev([_appletPath, '..', 'locale', code].concat(relative)),
        GLib.build_filenamev([dataHome(), 'locale', code].concat(relative)),
        GLib.build_filenamev(['/usr/share/locale', code].concat(relative)),
    ];
}

// .mo em memória: cabeçalho (magic, contagem, tabelas) e as strings separadas por NUL.
// É o mesmo formato que o gettext do Python e o shell leem; nenhum arquivo intermediário
// precisa existir só para o painel.
//
// As strings são separadas nos bytes antes de decodificar: `ByteArray.toString` para no
// primeiro NUL, e uma entrada de plural é exatamente "singular\0plural" — decodificar a
// fatia inteira de uma vez devolveria só o singular, sem erro nenhum.
function parseMo(path) {
    try {
        // Leitura síncrona de propósito: é um arquivo local de poucos KB, lido uma vez por
        // idioma e guardado em `_catalogs`. Os rótulos do painel são montados string a
        // string, no desenho, onde não há como esperar um callback; assíncrono obrigaria a
        // adiar todo texto até o catálogo chegar. Idioma sem catálogo — o caso comum — é o
        // arquivo ausente, que custa só a exceção tratada logo abaixo.
        const [ok, bytes] = GLib.file_get_contents(path);
        if (!ok || !bytes || bytes.length < 28) return null;
        return parseMoBytes(bytes, new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    } catch (error) {
        // Arquivo ausente ou ilegível: em GJS `file_get_contents` lança. Sem catálogo o
        // idioma não vale e a interface sai em inglês, que é o combinado.
        return null;
    }
}

function parseMoBytes(bytes, view) {
    const magic = view.getUint32(0, true);
    const little = magic === 0x950412de;
    if (!little && magic !== 0xde120495) return null;
    const segments = (at, length) => {
        const slice = bytes.subarray(at, at + length);
        const parts = [];
        let from = 0;
        for (let i = 0; i < slice.length; i++) {
            if (slice[i] === 0) {
                parts.push(ByteArray.toString(slice.subarray(from, i)));
                from = i + 1;
            }
        }
        parts.push(ByteArray.toString(slice.subarray(from)));
        return parts;
    };
    const read = (offset) => {
        const length = view.getUint32(offset, little);
        const at = view.getUint32(offset + 4, little);
        return segments(at, length);
    };
    const table = {singles: {}, plurals: {}};
    const count = view.getUint32(8, little);
    const originals = view.getUint32(12, little);
    const translations = view.getUint32(16, little);
    for (let i = 0; i < count; i++) {
        const ids = read(originals + i * 8);
        if (!ids[0]) continue;                      // cabeçalho: Plural-Forms e afins
        const forms = read(translations + i * 8);
        if (ids.length > 1) table.plurals[ids[0]] = forms;
        else table.singles[ids[0]] = forms[0];
    }
    return table;
}

function catalogFor(code) {
    if (!(code in _catalogs)) {
        let table = null;
        for (const path of catalogPaths(code)) {
            // Sem pré-teste de existência: `file_test` é um stat síncrono, e `parseMo` já
            // devolve null para caminho ausente ou ilegível — a checagem só repetia o que a
            // leitura faz de qualquer forma.
            table = parseMo(path);
            if (table) break;
        }
        _catalogs[code] = table;
    }
    return _catalogs[code];
}

// O catálogo tem de existir para o idioma valer: pedir francês sem catálogo
// francês não pode deixar a interface pela metade.
function hasCatalog(code) {
    return catalogFor(code) !== null;
}

function normalizeTag(tag) {
    if (typeof tag !== 'string') return '';
    const code = tag.split('.')[0].split('@')[0].replace('-', '_').toLowerCase();
    if (['pt', 'pt_br', 'pt_pt'].indexOf(code) >= 0) return 'pt_BR';
    if (['en', 'en_us', 'en_gb', 'c', 'posix'].indexOf(code) >= 0) return 'en';
    return '';
}

// Idioma da sessão, na ordem do gettext: `LANGUAGE` manda sozinho (lista separada por ':');
// sem ela, vale a primeira variável definida entre LC_ALL, LC_MESSAGES e LANG. `GLib`
// .get_language_names() segue a regra dele e num ambiente misto (LANGUAGE=fr_FR com
// LC_ALL=pt_BR) devolvia só francês, enquanto o backend — que lia todas as variáveis —
// respondia português: painel e janela em idiomas diferentes, cada um "certo".
function envCandidates() {
    const language = GLib.getenv('LANGUAGE');
    if (language && language.trim()) return language.split(':').filter(part => part.trim());
    for (const name of ['LC_ALL', 'LC_MESSAGES', 'LANG']) {
        const value = GLib.getenv(name);
        if (value && value.trim()) return [value];
    }
    return [];
}

function resolveLanguage(requested) {
    // Pedido explícito vence o ambiente sempre: `auto`/vazio seguem a sessão; qualquer outro
    // valor, ainda que sem catálogo, cai no inglês — nunca no idioma de quem estava logado.
    if (typeof requested === 'string' && requested.trim()) {
        const wanted = normalizeTag(requested);
        return (wanted === 'en' || (wanted && hasCatalog(wanted))) ? wanted : 'en';
    }
    for (const name of envCandidates()) {
        const code = normalizeTag(name);
        if (code && (code === 'en' || hasCatalog(code))) return code;
    }
    return 'en';
}

// Número e data sem Intl e sem setlocale: separador e formato vêm da tabela do
// idioma, iguais aos de backend/i18n.py, para painel e janela mostrarem o mesmo
// (o processo herda o locale da sessão e um mês sairia no idioma errado).
function formatNumber(value, decimals, lang) {
    const text = Number(value).toFixed(decimals);
    return lang === 'pt_BR' ? text.replace('.', ',') : text;
}
function formatPercent(value, lang) { return formatNumber(value, 1, lang) + '%'; }
function formatMoney(value, currency, lang) {
    const text = formatNumber(value, 2, lang);
    if (!currency) return text;
    return lang === 'pt_BR' ? text + ' ' + currency : currency + ' ' + text;
}
function formatTime(moment, lang) {
    const hour = moment.getHours();
    const minute = String(moment.getMinutes()).padStart(2, '0');
    if (lang === 'pt_BR') return String(hour).padStart(2, '0') + ':' + minute;
    return (hour % 12 || 12) + ':' + minute + ' ' + (hour < 12 ? 'AM' : 'PM');
}
function formatDateTime(moment, lang) {
    if (lang === 'pt_BR') {
        const day = String(moment.getDate()).padStart(2, '0');
        return day + '/' + String(moment.getMonth() + 1).padStart(2, '0') + '/' +
            moment.getFullYear() + ' ' + formatTime(moment, lang);
    }
    return MONTHS[moment.getMonth()] + ' ' + moment.getDate() + ', ' +
        moment.getFullYear() + ' ' + formatTime(moment, lang);
}

class AIUsageApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this._stopped = false;
        this._snapshot = null;
        this._error = null;
        this._proc = null;
        this._loop = 0;
        this._ageLoop = 0;
        this._click = 0;
        this._watchdog = 0;
        this._killTimer = 0;
        this._instance = instanceId;
        this._uuid = metadata.uuid;
        this._backend = GLib.build_filenamev([metadata.path, 'backend']);
        if (!GLib.file_test(this._backend, GLib.FileTest.IS_DIR))
            this._backend = GLib.build_filenamev([metadata.path, '..', 'backend']);
        this._assets = GLib.build_filenamev([this._backend, '..', 'assets']);
        // Ícone simbólico: herda a cor do tema e recebe a cor de alerta pela cota mais alta.
        this.set_applet_icon_symbolic_path(GLib.build_filenamev([this._assets, 'robot-head-symbolic.svg']));
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this._menuManager.addMenu(this.menu);
        this._doubleClickMs = 400;
        try {
            const mouse = new Gio.Settings({schema_id: 'org.cinnamon.desktop.peripherals.mouse'});
            this._doubleClickMs = Math.max(100, Math.min(1500, mouse.get_int('double-click')));
        } catch (error) { /* use conventional fallback */ }
        this._ready = false;
        this._language = 'en';
        this._languageOverride = null;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind('collect-enabled', 'collectEnabled', () => this._configure());
        this.settings.bind('collect-interval', 'collectInterval', () => this._configure());
        this.settings.bind('language', 'language', () => this._configure());
        this._ready = true;
        this._configure();
    }

    // 'auto' segue o idioma da sessão; um idioma fixado na configuração passa a
    // valer também para os processos filhos (coleta, janela de uso, credenciais).
    _applyLanguage() {
        const wanted = this.language && this.language !== 'auto' ? this.language : null;
        this._languageOverride = wanted;
        this._language = resolveLanguage(wanted);
        // O texto do painel segue a preferência desta instância (o catálogo é lido por
        // idioma, não pelo locale do processo). O xlet aceita uma instância só
        // (max-instances: 1 em metadata.json); com duas, o texto seria o da última que
        // aplicou o idioma — a formatação já é por instância.
        _language = this._language;
    }

    _configure() {
        if (!this._ready || this._stopped) return;
        this._applyLanguage();
        if (this._loop) Mainloop.source_remove(this._loop);
        this._loop = 0;
        if (this.collectEnabled) {
            this._collect(false);
            this._loop = Mainloop.timeout_add_seconds(Math.max(30, this.collectInterval || 120), () => {
                this._collect(false);
                return GLib.SOURCE_CONTINUE;
            });
        } else if (!this._snapshot) this._collect(false, true);
        // A idade da leitura é reavaliada mesmo com a coleta pausada — e a pausa é justamente
        // quando nada mais reavalia: sem este laço, uma cota de uma hora atrás continuava "ok",
        // mantinha o ícone vermelho e não recebia aviso de leitura antiga.
        if (this._ageLoop) Mainloop.source_remove(this._ageLoop);
        this._ageLoop = Mainloop.timeout_add_seconds(60, () => {
            this._refreshIcon();
            return GLib.SOURCE_CONTINUE;
        });
        this._refreshIcon();
    }

    on_applet_clicked(event) {
        if (this._stopped) return;
        // Keyboard activation opens immediately. Pointer clicks wait for the second click.
        if (event && event.type() === Clutter.EventType.KEY_PRESS) {
            this._toggleMenu();
            return;
        }
        if (this._click) {
            Mainloop.source_remove(this._click);
            this._click = 0;
            this._openWindow();
        } else {
            this._click = Mainloop.timeout_add(this._doubleClickMs, () => {
                this._click = 0;
                this._toggleMenu();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _toggleMenu() {
        if (!this.menu.isOpen) this._renderMenu();
        this.menu.toggle();
    }

    _collect(force, readOnly = false) {
        if (this._stopped || this._proc) return;
        if (!force && !readOnly && !this.collectEnabled) return;
        const argv = ['/usr/bin/python3', GLib.build_filenamev([this._backend, 'collector.py']),
                      readOnly ? 'read' : 'collect'];
        if (!readOnly) argv.push('--ttl', String(Math.max(30, this.collectInterval || 120)));
        if (force) argv.push('--force');
        let proc;
        try {
            proc = this._spawn(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (error) {
            this._error = _('Could not start the collector.');
            this._refreshIcon();
            return;
        }
        this._proc = proc;
        this._refreshIcon();
        let timedOut = false;
        this._watchdog = Mainloop.timeout_add_seconds(50, () => {
            this._watchdog = 0;
            timedOut = true;
            proc.send_signal(15);
            this._killTimer = Mainloop.timeout_add_seconds(3, () => {
                this._killTimer = 0;
                if (this._proc === proc) proc.force_exit();
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
        proc.communicate_utf8_async(null, null, (p, result) => {
            if (this._proc !== p) return;
            this._proc = null;
            for (const name of ['_watchdog', '_killTimer']) {
                if (this[name]) Mainloop.source_remove(this[name]);
                this[name] = 0;
            }
            if (this._stopped) return;
            try {
                const [ok, stdout] = p.communicate_utf8_finish(result);
                if (!ok || !p.get_successful() || timedOut) throw new Error();
                const snapshot = JSON.parse(stdout);
                if (snapshot.schema_version !== 1 || !Array.isArray(snapshot.services)) throw new Error();
                this._snapshot = snapshot;
                this._error = null;
            } catch (error) {
                this._error = timedOut ? _('Collection timed out.') : _('Could not read the collector output.');
            }
            this._refreshIcon();
            // Intentionally do not reorder/rebuild while the pointer is inside the menu.
        });
    }

    _quotas(services) {
        const agora = Date.now();
        return services.filter(s => s.status === 'ok' && !this._aged(s, agora)).flatMap(s =>
            (s.metrics || []).filter(m => m.kind === 'quota' && Number.isFinite(m.used_percent))
                .map(m => ({service: s.label || s.id, metric: m})))
            .sort((a, b) => b.metric.used_percent - a.metric.used_percent);
    }

    // Limite de idade para exibir uma leitura como atual: o intervalo configurado mais um minuto,
    // para o ciclo de coleta seguinte chegar sem a cor do ícone piscar a cada rodada.
    _readingLimit() {
        return (Math.max(30, this.collectInterval || 120) + 60) * 1000;
    }

    // Leitura vencida por tempo, mesmo com status ok: o applet não confia só no status, porque
    // nada reavalia a idade quando a coleta está pausada.
    _aged(service, agora) {
        if (service.status !== 'ok') return false;
        agora = agora || Date.now();
        const quando = Date.parse(service.read_at);
        if (!Number.isFinite(quando)) return true;   // ok sem horário não é dado em que confiar
        return (agora - quando) > this._readingLimit();
    }

    _agedServices() {
        const agora = Date.now();
        const services = (this._snapshot && this._snapshot.services) || [];
        return services.filter(s => s.status === 'stale' || this._aged(s, agora));
    }

    _paintIcon(highest) {
        if (!this._applet_icon) return;
        const color = highest >= 90 ? CRITICAL_COLOR : highest >= 70 ? WARNING_COLOR : null;
        // Sem cor de alerta o ícone simbólico volta à cor do tema: estilo nulo, nunca
        // string vazia — o parser do St avisa com buffer vazio.
        try {
            this._applet_icon.set_style(color ? `color: ${color};` : null);
        } catch (error) { /* tema sem suporte a cor de ícone */ }
    }

    _refreshIcon() {
        if (this._stopped) return;
        const services = this._snapshot ? this._snapshot.services : [];
        const agora = Date.now();
        const quotas = this._quotas(services);
        const highest = quotas.length ? quotas[0].metric.used_percent : 0;
        this._paintIcon(highest);
        const lines = [_('AI usage')];
        for (const service of services.filter(s => s.status !== 'disabled')) {
            const metrics = service.metrics || [];
            const quota = metrics.filter(m => m.kind === 'quota' && Number.isFinite(m.used_percent))
                .sort((a, b) => b.used_percent - a.used_percent)[0];
            const money = metrics.find(m => Number.isFinite(m.value));
            let detail;
            if (quota) detail = _f(_('{label}: {percent} used'),
                                   {label: this._metricLabel(quota),
                                    percent: formatPercent(quota.used_percent, this._language)});
            else if (money) detail = _f(_('{label}: {money}'),
                                        {label: this._metricLabel(money),
                                         money: formatMoney(money.value, money.currency, this._language)});
            else detail = {unconfigured: _('Not configured'), unavailable: _('Unavailable'),
                          error: _('Reading failed')}[service.status] || _('No reading');
            if (metrics.length && (service.status !== 'ok' || this._aged(service, agora)))
                detail += _(' (stale reading)');
            lines.push(`${service.label || service.id} — ${detail}`);
        }
        if (!services.length) lines.push(_('Waiting for the first reading…'));
        if (highest >= 70) lines.push(`\n${highest >= 90 ? _('Critical quota') : _('Attention')}: ${quotas[0].service} · ${this._metricLabel(quotas[0].metric)}`);
        const generated = this._snapshot && this._snapshot.generated_at;
        if (generated && Number.isFinite(Date.parse(generated)))
            lines.push('\n' + _f(_('Last collection: {time}'),
                                 {time: formatTime(new Date(generated), this._language)}));
        if (!this.collectEnabled) lines.push(_('Automatic collection paused'));
        if (this._proc) lines.push(_('Updating…'));
        if (this._error) lines.push(this._error);
        if (this._notice()) lines.push(this._notice());
        const comFalha = this._byStatus('error');
        if (comFalha.length) lines.push(_f(_('Reading failed: {services}'), {services: this._list(comFalha)}));
        const antigas = this._agedServices().map(s => s.label || s.id);
        if (antigas.length) lines.push(_f(_('Stale reading: {services}'), {services: this._list(antigas)}));
        lines.push('\n' + _('Click: recent · double-click: all'));
        this.set_applet_tooltip(lines.join('\n'));
    }

    _hasReading(service) {
        return ['ok', 'stale'].includes(service.status) ||
            (Array.isArray(service.metrics) && service.metrics.length > 0);
    }

    // Aviso público do coletor (por exemplo, coleta pulada por já haver outra em andamento).
    // Também é texto do cache: o identificador manda, e o texto gravado é o recurso de quem não
    // tem catálogo — o aviso de uma coleta em português aparece em inglês no painel em inglês.
    _notice() {
        const aviso = _recordText(this._snapshot, 'notice_id', 'notice_args', 'notice');
        return aviso ? aviso : null;
    }

    // Indicador de erro separado de cota: nomeia quem falhou, sem tocar na cor da cota.
    _byStatus(...statuses) {
        const services = (this._snapshot && this._snapshot.services) || [];
        return services.filter(s => statuses.includes(s.status)).map(s => s.label || s.id);
    }

    _list(names, limit = 3) {
        if (names.length <= limit) return names.join(', ');
        return names.slice(0, limit).join(', ') + ' ' +
            _f(_('and {count} more'), {count: names.length - limit});
    }

    _lastUsed(service) {
        return typeof service.last_used_at === 'string' && Number.isFinite(Date.parse(service.last_used_at))
            ? Date.parse(service.last_used_at) : null;
    }

    // Até cinco linhas: primeiro as com uso observado, depois as de leitura mais recente.
    _recent() {
        if (!this._snapshot) return [];
        const services = this._snapshot.services.filter(s => s && s.status !== 'disabled' && this._hasReading(s));
        const used = services.filter(s => this._lastUsed(s) !== null)
            .sort((a, b) => this._lastUsed(b) - this._lastUsed(a));
        const rest = services.filter(s => this._lastUsed(s) === null)
            .sort((a, b) => (Date.parse(b.read_at) || 0) - (Date.parse(a.read_at) || 0));
        return used.concat(rest).slice(0, 5);
    }

    _note(label, styleClass) {
        const item = new PopupMenu.PopupMenuItem(label, {reactive: false});
        item.label.add_style_class_name(styleClass || 'ai-usage-menu-note');
        this.menu.addMenuItem(item);
    }

    _renderMenu() {
        this.menu.removeAll();
        this._note(_('Five most recent · estimated usage'));
        if (!this.collectEnabled) this._note(_('Automatic collection paused'));
        if (this._proc) this._note(_('Updating… Reopen to see the new reading.'));
        if (this._notice()) this._note(this._notice());
        if (this._error) this._note(this._error + ' ' + _('Last values preserved.'));
        const comFalha = this._byStatus('error');
        if (comFalha.length) this._note(_f(_('Reading failed: {services}'), {services: this._list(comFalha)}),
                                        'ai-usage-menu-error');
        const antigas = this._agedServices().map(s => s.label || s.id);
        if (antigas.length) this._note(_f(_('Stale reading: {services}'), {services: this._list(antigas)}));
        const recent = this._recent();
        if (!recent.length) this._note(_('No reading yet; use Update or See all.'));
        for (const service of recent) this._serviceRow(service);
        const pending = (this._snapshot ? this._snapshot.services : [])
            .filter(s => ['unconfigured', 'unavailable'].includes(s.status)).length;
        if (pending) this._note(_f(_('{count} service(s) without a reading; see Credentials…'), {count: pending}));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._action(_('See all services…'), () => this._openWindow());
        this._action(_('Update'), () => this._collect(true));
        this._action(_('Credentials…'), () => this._openCredentials());
        this._action(_('Settings…'), () => {
            Gio.Subprocess.new(['xlet-settings', 'applet', this._uuid, '-i', String(this._instance)],
                               Gio.SubprocessFlags.NONE);
        });
    }

    _action(label, callback) {
        const item = new PopupMenu.PopupMenuItem(label);
        item.connect('activate', () => {
            try { callback(); } catch (error) { this._error = _('Could not run the action.'); this._refreshIcon(); }
        });
        this.menu.addMenuItem(item);
    }

    // Rótulo de uma métrica que veio do cache: o identificador manda, e o texto gravado é
    // só o recurso de quem não tem catálogo. Sem rótulo nem identificador, sobra o id.
    _metricLabel(metric) {
        return _recordText(metric, 'label_id', 'label_args', 'label') || (metric && metric.id) || '';
    }

    _serviceRow(service) {
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        const box = new St.BoxLayout({vertical: true, style_class: 'ai-usage-service', width: 310});
        box.add_actor(new St.Label({text: service.label || service.id}));
        const metrics = service.metrics || [];
        // Most limiting quota first, with its actual label, not a fabricated common window.
        const quotas = metrics.filter(m => m.kind === 'quota' && Number.isFinite(m.used_percent));
        quotas.sort((a,b) => b.used_percent - a.used_percent);
        const m = quotas[0] || metrics[0];
        if (m && m.kind === 'quota' && Number.isFinite(m.used_percent)) {
            const value = Math.max(0, Math.min(100, m.used_percent));
            box.add_actor(new St.Label({text: _f(_('{label}: {percent} used'),
                {label: this._metricLabel(m), percent: formatPercent(value, this._language)}),
                                       style_class: 'ai-usage-service-note'}));
            const track = new St.Bin({style_class: 'ai-usage-bar-track', width: 290, height: 5,
                                      x_fill: false, x_align: St.Align.START});
            if (value > 0) {
                const fill = new St.Bin({height: 5, width: 290 * value / 100,
                    style_class: value >= 90 ? 'ai-usage-bar-fill-critical' :
                                 value >= 70 ? 'ai-usage-bar-fill-warning' : 'ai-usage-bar-fill'});
                track.set_child(fill);
                // Themes and display scaling may allocate more than the requested width.
                track.connect('notify::allocation', () => {
                    fill.set_width(track.get_width() * value / 100);
                });
            }
            box.add_actor(track);
        } else if (m && Number.isFinite(m.value)) {
            box.add_actor(new St.Label({text: _f(_('{label}: {money}'),
                {label: this._metricLabel(m), money: formatMoney(m.value, m.currency, this._language)}),
                                       style_class: 'ai-usage-service-note'}));
        }
        if (service.status !== 'ok') box.add_actor(new St.Label({text: service.status === 'stale' ?
            _('Stale reading — see details') : _('No current reading'), style_class: 'ai-usage-service-note'}));
        else if (this._lastUsed(service) === null)
            box.add_actor(new St.Label({text: _('No observed use since installation'),
                                       style_class: 'ai-usage-service-note'}));
        item.addActor(box, {expand: true, span: -1});
        this.menu.addMenuItem(item);
    }

    _openWindow() {
        this.menu.close();
        this._runBackend('window.py', _('Could not open the window.'));
    }

    _openCredentials() {
        this.menu.close();
        this._runBackend('credentials_window.py', _('Could not open the credentials.'));
    }

    // Com idioma fixado na configuração, o processo filho recebe LANGUAGE: a coleta,
    // a janela de uso e a de credenciais têm de falar o mesmo idioma do painel.
    _spawn(argv, flags) {
        if (!this._languageOverride) return Gio.Subprocess.new(argv, flags);
        const launcher = new Gio.SubprocessLauncher({flags: flags});
        launcher.setenv('LANGUAGE', this._languageOverride, true);
        return launcher.spawnv(argv);
    }

    _runBackend(script, errorMessage) {
        try {
            this._spawn(['/usr/bin/python3', GLib.build_filenamev([this._backend, script])],
                        Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (error) { this._error = errorMessage; this._refreshIcon(); }
    }

    on_applet_removed_from_panel() {
        this._stopped = true;
        for (const name of ['_click', '_loop', '_ageLoop', '_watchdog', '_killTimer']) {
            if (this[name]) Mainloop.source_remove(this[name]);
            this[name] = 0;
        }
        if (this._proc) this._proc.send_signal(15);
        this.settings.finalize();
        this.menu.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    _uuid = metadata.uuid;   // o domínio gettext do xlet é o próprio uuid
    _appletPath = metadata.path;
    return new AIUsageApplet(metadata, orientation, panelHeight, instanceId);
}
