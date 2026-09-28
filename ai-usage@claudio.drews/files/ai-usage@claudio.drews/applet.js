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
const _catalogs = {};      // code -> tabela | null, depois da leitura concluída
const _catalogLoads = {};  // code -> {waiters} enquanto a leitura assíncrona está em curso

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
// A leitura do catálogo é assíncrona porque o applet roda dentro do processo do shell:
// `Gio.File.load_contents_async()` devolve o controle ao laço principal e a tabela é aplicada
// quando a resposta chega. A leitura síncrona que existia aqui segurava o painel pelo tempo de
// abrir e ler o arquivo — alguns KB num disco local custam pouco (medido nesta máquina: 0,26 ms
// no primeiro caminho, 0,03 a 0,09 ms num caminho ausente), mas o custo não é garantido em toda
// máquina: pasta pessoal em montagem de rede, armazenamento lento ou sistema de arquivos em
// espaço de usuário têm espera que o applet não controla. O scanner de padrões da loja do
// Cinnamon avisa exatamente nesse ponto (`sync_file_get_contents`).
//
// O que não muda: nenhuma frase é traduzida durante o desenho. `_()` consulta só a tabela que já
// está em memória — a leitura acontece uma vez, na resolução do idioma, e a apresentação anterior
// fica como está até a nova chegar.
function loadCatalog(code, cancellable, callback) {
    const emAndamento = _catalogLoads[code];
    if (emAndamento) {
        // Leitura em curso não é catálogo ausente: quem pedir o mesmo idioma agora espera a mesma
        // resposta, em vez de disparar uma segunda leitura e concluir que não há catálogo.
        emAndamento.waiters.push(callback);
        return;
    }
    const estado = {waiters: [callback]};
    _catalogLoads[code] = estado;
    const caminhos = catalogPaths(code);
    const terminar = (table) => {
        if (_catalogLoads[code] === estado) delete _catalogLoads[code];
        _catalogs[code] = table;      // fica em memória, inclusive o "não há catálogo"
        let falha = null;
        for (const espera of estado.waiters) {
            try { espera(table); } catch (error) { falha = falha || error; }
        }
        // O erro de um consumidor não impede os outros de receber a tabela, mas não some.
        if (falha) throw falha;
    };
    const proximo = () => {
        const caminho = caminhos.shift();
        if (!caminho) { terminar(null); return; }
        Gio.File.new_for_path(caminho).load_contents_async(cancellable, (fonte, resultado) => {
            let table = null;
            try {
                const [ok, bytes] = fonte.load_contents_finish(resultado);
                if (ok && bytes && bytes.length >= 28)
                    table = parseMoBytes(bytes, new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
            } catch (error) {
                // Em GJS o `*_finish` de arquivo ausente lança (Gio.IOErrorEnum) em vez de devolver
                // [false, null]; arquivo ilegível ou .mo corrompido devolve tabela nula pelo parser.
                // Nos dois casos o caminho seguinte ainda pode ter o catálogo — e nenhum deles pode
                // derrubar o painel: sem catálogo o idioma não vale e a interface sai em inglês.
                table = null;
                // Instância removida: sondar os caminhos restantes não serve a ninguém.
                if (cancellable && typeof cancellable.is_cancelled === 'function' && cancellable.is_cancelled()) {
                    terminar(null);
                    return;
                }
            }
            if (table) terminar(table); else proximo();
        });
    };
    proximo();
}

// As strings são separadas nos bytes antes de decodificar: `ByteArray.toString` para no
// primeiro NUL, e uma entrada de plural é exatamente "singular\0plural" — decodificar a
// fatia inteira de uma vez devolveria só o singular, sem erro nenhum.
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

// Só memória: quem chama é o desenho, e o desenho não pode tocar no disco. Quem lê é
// `loadCatalog`, uma vez por idioma, na resolução — e o resultado fica aqui, inclusive o
// "não há catálogo".
function catalogFor(code) {
    return code in _catalogs ? _catalogs[code] : null;
}

// O catálogo tem de existir para o idioma valer: pedir francês sem catálogo francês não pode
// deixar a interface pela metade. Só memória — ausência em disco é conclusão de `loadCatalog`,
// nunca deste teste, que não pode voltar a ser uma leitura síncrona disfarçada.
function hasCatalog(code) {
    return catalogFor(code) !== null;
}

// Já perguntamos ao disco por este idioma — a resposta pode ter sido "não há". Distinguir isto
// de "ainda não perguntei" evita repetir quatro leituras a cada troca de configuração para
// chegar à mesma conclusão. O preço é conhecido: um catálogo instalado com o painel já rodando
// só é visto na próxima sessão do Cinnamon.
function catalogoConhecido(code) {
    return code in _catalogs;
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

// Mesma política de antes, agora com a leitura do catálogo fora do caminho: pedido explícito
// vence o ambiente sempre; `auto`/vazio seguem a sessão; qualquer valor sem catálogo cai no
// inglês — nunca no idioma de quem estava logado. O inglês é o msgid, então acerta sem tocar no
// disco; idioma já lido acerta na hora, em memória; só o idioma ainda não lido espera a resposta
// assíncrona.
function resolveLanguageAsync(requested, cancellable, callback) {
    const candidatos = [];
    if (typeof requested === 'string' && requested.trim()) {
        const wanted = normalizeTag(requested);
        if (wanted) candidatos.push(wanted);
    } else {
        for (const name of envCandidates()) {
            const code = normalizeTag(name);
            if (code) candidatos.push(code);
        }
    }
    candidatos.push('en');
    const tentar = () => {
        const code = candidatos.shift();
        if (code === undefined) { callback('en'); return; }
        if (code === 'en' || hasCatalog(code)) { callback(code); return; }
        // Ausência já concluída não volta ao disco: sem isto, cada troca de configuração
        // repetiria as quatro leituras para terminar em inglês outra vez.
        if (catalogoConhecido(code)) { tentar(); return; }
        loadCatalog(code, cancellable, (table) => {
            if (table) callback(code); else tentar();
        });
    };
    tentar();
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
        this._path = metadata.path;
        // Backend e assets dependem de consultar o sistema de arquivos, e a consulta é assíncrona:
        // nascem nulos e `_resolveBackend()` os preenche, seta o ícone e libera o que depende do
        // backend. `_cancellable` desarma a resposta tardia quando o applet sai do painel.
        this._backend = null;
        this._assets = null;
        this._cancellable = new Gio.Cancellable();
        this._langGen = 0;
        this._languageResolved = false;
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
        this._resolveBackend();
    }

    // Duas formas de instalação, as mesmas que o projeto já suporta: `backend` ao lado do
    // applet.js (instalação pelo instalador ou pela loja) e um nível acima (applet carregado
    // direto da árvore de código). A consulta é assíncrona porque o applet roda no processo do
    // shell — o `stat` síncrono que existia aqui segurava o painel pelo tempo do sistema de
    // arquivos, e o scanner de padrões da loja avisa nesse ponto (`sync_file_test`).
    //
    // Diretório ausente e erro de permissão têm tratamentos distintos: ausente faz tentar o outro
    // layout; permissão não, porque o caminho existe e o problema é outro — cair para o irmão
    // esconderia o motivo. Até a resposta chegar, o backend é nulo e as ações que dependem dele
    // não spawnam nada (`_configure`, `_collect` e `_runBackend` têm essa guarda).
    _resolveBackend() {
        const candidatos = [
            GLib.build_filenamev([this._path, 'backend']),
            GLib.build_filenamev([this._path, '..', 'backend']),
        ];
        const tentar = () => {
            const caminho = candidatos.shift();
            if (!caminho) {
                this._error = _('Could not find the applet backend.');
                this._refreshIcon();
                return;
            }
            Gio.File.new_for_path(caminho).query_info_async(
                'standard::type', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, this._cancellable,
                (fonte, resultado) => {
                    if (this._stopped) return;
                    let pasta = false;
                    try {
                        pasta = fonte.query_info_finish(resultado).get_file_type() === Gio.FileType.DIRECTORY;
                    } catch (error) {
                        const ausente = typeof error.matches === 'function' &&
                            error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND);
                        if (!ausente) {
                            this._error = _('Could not find the applet backend.');
                            this._refreshIcon();
                            return;
                        }
                    }
                    if (!pasta) { tentar(); return; }
                    this._backend = caminho;
                    this._assets = GLib.build_filenamev([caminho, '..', 'assets']);
                    // Ícone simbólico: herda a cor do tema e recebe a cor de alerta pela cota mais
                    // alta. Só depois disto o caminho do ícone é conhecido.
                    this.set_applet_icon_symbolic_path(
                        GLib.build_filenamev([this._assets, 'robot-head-symbolic.svg']));
                    this._configure();
                    this._refreshIcon();
                });
        };
        tentar();
    }

    // 'auto' segue o idioma da sessão; um idioma fixado na configuração passa a
    // valer também para os processos filhos (coleta, janela de uso, credenciais).
    _applyLanguage() {
        const wanted = this.language && this.language !== 'auto' ? this.language : null;
        this._languageOverride = wanted;
        // O texto do painel segue a preferência desta instância (o catálogo é lido por
        // idioma, não pelo locale do processo). O xlet aceita uma instância só
        // (max-instances: 1 em metadata.json); com duas, o texto seria o da última que
        // aplicou o idioma — a formatação já é por instância.
        //
        // A leitura do catálogo é assíncrona: até a resposta chegar vale o idioma anterior, e a
        // geração descarta resposta de uma escolha já superada — trocar de idioma duas vezes
        // depressa não pode terminar com o texto da primeira.
        const geracao = ++this._langGen;
        resolveLanguageAsync(wanted, this._cancellable, (code) => {
            if (this._stopped || geracao !== this._langGen) return;
            this._language = code;
            _language = code;
            this._languageResolved = true;
            this._refreshIcon();
        });
    }

    _configure() {
        if (!this._ready || this._stopped) return;
        this._applyLanguage();
        // Sem backend resolvido não há caminho de coletor a montar: a descoberta assíncrona chama
        // `_configure()` de novo quando termina, e até lá um clique não spawna caminho inválido.
        if (!this._backend) return;
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
        if (this._stopped || this._proc || !this._backend) return;
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
        // O primeiro desenho espera o idioma resolver: com sessão pt_BR e catálogo lido de forma
        // assíncrona, desenhar antes disto mostraria um quadro de inglês.
        if (!this._languageResolved) return;
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
        const comFalha = this._failedServices();
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

    // Uma falha com leitura preservada também é erro; intervalo vencido não é.
    _failedServices() {
        const services = (this._snapshot && this._snapshot.services) || [];
        return services.filter(s => s.status === 'error' ||
            (s.status === 'stale' && s.stale_reason === 'failure')).map(s => s.label || s.id);
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
        const comFalha = this._failedServices();
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
        if (!this._backend) return;   // backend ainda em descoberta: nada de caminho inválido
        try {
            this._spawn(['/usr/bin/python3', GLib.build_filenamev([this._backend, script])],
                        Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (error) { this._error = errorMessage; this._refreshIcon(); }
    }

    on_applet_removed_from_panel() {
        this._stopped = true;
        // Resposta tardia de leitura de catálogo ou de descoberta do backend não pode tocar
        // interface destruída nem manter operação viva.
        this._cancellable.cancel();
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
