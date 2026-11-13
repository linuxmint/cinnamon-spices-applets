// CotaBar — Cinnamon applet showing how much of each AI's usage limit is used.
// It only reads the JSON written by cotabar-coletor; it never sees a token.
// (Comentários do código em português.)

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

const PASTA_USUARIO = GLib.build_filenamev([GLib.get_user_cache_dir(), "cotabar"]);
const PASTAS_FONTES = [PASTA_USUARIO, "/var/lib/cotabar"];
const COLETOR_SISTEMA = "/usr/local/bin/cotabar-coletor";

// Cor de cada IA (anel) e letra no meio.
const MARCA = {
    claude:  { cor: [0.85, 0.47, 0.34], letra: "C" },
    agy:     { cor: [0.30, 0.55, 0.96], letra: "A" },
    codex:   { cor: [0.20, 0.72, 0.56], letra: "X" },
    copilot: { cor: [0.62, 0.48, 0.92], letra: "P" },
};
const ORDEM = ["claude", "agy", "codex", "copilot"];
const PESO_ESTADO = { ok: 3, erro: 1, ausente: 0 };

// ------------------------------------------------------------ idiomas
// Chave = inglês. Só o que muda por idioma; o resto cai no inglês.
const TEXTOS = {
    pt: {
        "CotaBar — AI usage limits": "CotaBar — uso das cotas de IA",
        "CotaBar — no data yet": "CotaBar — nenhum dado ainda",
        "Outer ring: week/month · inner: hours/day": "Anel de fora: semana/mês · de dentro: horas/dia",
        "no data": "sem dados",
        "No readings yet. Check that cotabar-coletor is installed.": "Nenhuma leitura ainda. Confira se o cotabar-coletor está instalado.",
        "Not found on this machine": "Não encontrado nesta máquina",
        "Last good reading %s — ": "Última leitura boa %s — ",
        "Refresh now": "Atualizar agora",
        "resets %s": "reinicia %s",
        "in %s": "em %s",
        "never": "nunca", "now": "agora", "%s ago": "há %s",
        "hours": "horas", "day": "dia", "week": "semana", "month": "mês",
        "Hours": "Horas", "Day": "Dia", "Week": "Semana", "Month": "Mês",
        "Session": "Sessão", "Extra usage": "Uso extra", "Premium requests": "Premium",
        "Chat": "Chat", "Completions": "Autocompletar", "Credits": "Créditos",
        "%s of %s left": "%s de %s restantes",
        "Session expired — use the tool once to renew it": "Sessão vencida — use a ferramenta uma vez para renovar",
        "Too many requests — trying again later": "Muitas consultas — tentando de novo depois",
        "Server error (%s)": "Erro do servidor (%s)",
        "No connection": "Sem conexão",
        "Invalid response": "Resposta inválida",
        "Could not read the credentials": "Não consegui ler as credenciais",
        "Token expired — use %s once to renew it": "Token vencido — use o %s uma vez para renovar",
        "No limits reported": "Nenhum limite informado",
        "Internal error": "Erro interno",
        "educational": "educacional", "free": "grátis", "personal": "pessoal",
        "letters": "H horas · D dia · S semana · M mês",
    },
    es: {
        "CotaBar — AI usage limits": "CotaBar — uso de las cuotas de IA",
        "CotaBar — no data yet": "CotaBar — aún no hay datos",
        "Outer ring: week/month · inner: hours/day": "Anillo exterior: semana/mes · interior: horas/día",
        "no data": "sin datos",
        "No readings yet. Check that cotabar-coletor is installed.": "Aún no hay lecturas. Revisa que cotabar-coletor esté instalado.",
        "Not found on this machine": "No se encontró en este equipo",
        "Last good reading %s — ": "Última lectura buena %s — ",
        "Refresh now": "Actualizar ahora",
        "resets %s": "se reinicia %s",
        "in %s": "en %s",
        "never": "nunca", "now": "ahora", "%s ago": "hace %s",
        "hours": "horas", "day": "día", "week": "semana", "month": "mes",
        "Hours": "Horas", "Day": "Día", "Week": "Semana", "Month": "Mes",
        "Session": "Sesión", "Extra usage": "Uso extra", "Premium requests": "Premium",
        "Chat": "Chat", "Completions": "Autocompletado", "Credits": "Créditos",
        "%s of %s left": "quedan %s de %s",
        "Session expired — use the tool once to renew it": "Sesión vencida — usa la herramienta una vez para renovarla",
        "Too many requests — trying again later": "Demasiadas consultas — se reintenta más tarde",
        "Server error (%s)": "Error del servidor (%s)",
        "No connection": "Sin conexión",
        "Invalid response": "Respuesta inválida",
        "Could not read the credentials": "No se pudieron leer las credenciales",
        "Token expired — use %s once to renew it": "Token vencido — usa %s una vez para renovarlo",
        "No limits reported": "No se informaron límites",
        "Internal error": "Error interno",
        "educational": "educativo", "free": "gratis", "personal": "personal",
        "letters": "H horas · D día · S semana · M mes",
    },
    en: {
        "letters": "H hours · D day · W week · M month",
    },
};
// Letra do período na barra: em inglês semana é W.
const LETRAS = { en: { H: "H", D: "D", S: "W", M: "M" } };
const DIAS = {
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    pt: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
    es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
};

let IDIOMA = "en";

function idiomaDoSistema() {
    for (const nome of GLib.get_language_names()) {
        const base = nome.split(/[_.@]/)[0].toLowerCase();
        if (TEXTOS[base]) return base;
    }
    return "en";
}

function t(chave, ...args) {
    let s = (TEXTOS[IDIOMA] && TEXTOS[IDIOMA][chave]) || chave;
    for (const a of args) s = s.replace("%s", a);
    return s;
}

const tr = t;  // para funções que já usam "t" como variável local

function letraPeriodo(p) {
    return (LETRAS[IDIOMA] && LETRAS[IDIOMA][p]) || p;
}

const FERRAMENTA = { claude: "Claude Code", agy: "agy", codex: "Codex", copilot: "gh" };

function fmtErro(p) {
    switch (p.erro_codigo) {
    case "auth": return t("Session expired — use the tool once to renew it");
    case "rate": return t("Too many requests — trying again later");
    case "http": return t("Server error (%s)", (p.erro || "").replace(/^HTTP /, ""));
    case "net": return t("No connection");
    case "invalid": return t("Invalid response");
    case "read": return t("Could not read the credentials");
    case "expired": return t("Token expired — use %s once to renew it", FERRAMENTA[p.id] || p.nome);
    case "nolimits": return t("No limits reported");
    case "internal": return t("Internal error");
    default: return p.erro || t("Internal error");  // coletor antigo
    }
}

const NOME_TIPO = { session: "Session", extra: "Extra usage", premium: "Premium requests",
                    chat: "Chat", completions: "Completions", credits: "Credits" };
const NOME_PERIODO = { H: "hours", D: "day", S: "week", M: "month" };

function versaoAntiga(v, minima) {
    const p = String(v || "0").split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < minima.length; i++) {
        if ((p[i] || 0) !== minima[i]) return (p[i] || 0) < minima[i];
    }
    return false;
}

// Rótulo de uma janela no idioma escolhido, ex.: "Gemini · semana", "Sessão · 5 h".
function rotulo(j, versaoColetor) {
    // Coletor antes da 0.3 não manda grupo/horas: usa o rótulo pronto dele.
    if (!j.periodo || versaoAntiga(versaoColetor, [0, 3])) return j.rotulo || "";
    // Leitura velha reaproveitada pelo coletor novo também não tem grupo.
    if (!j.grupo && !j.tipo_limite && j.rotulo && j.rotulo.indexOf(" · ") >= 0) return j.rotulo;
    const per = j.periodo === "H" && j.horas ? `${j.horas} h` : t(NOME_PERIODO[j.periodo] || "week");
    const nome = j.tipo_limite ? t(NOME_TIPO[j.tipo_limite] || j.tipo_limite) : j.grupo;
    if (nome) return `${nome} · ${per}`;
    return per.charAt(0).toUpperCase() + per.slice(1);
}

function detalhe(j) {
    if (j.total) return t("%s of %s left", String(Math.round(j.restante || 0)), String(Math.round(j.total)));
    return j.detalhe || "";
}

// Leitura assíncrona: o painel nunca espera disco.
function lerTexto(caminho) {
    return new Promise(resolve => {
        Gio.File.new_for_path(caminho).load_contents_async(null, (arquivo, res) => {
            try {
                const [, bytes] = arquivo.load_contents_finish(res);
                resolve(ByteArray.toString(bytes));
            } catch (e) {
                resolve(null);
            }
        });
    });
}

function listarJson(pasta) {
    return new Promise(resolve => {
        const dir = Gio.File.new_for_path(pasta);
        dir.enumerate_children_async("standard::name", Gio.FileQueryInfoFlags.NONE,
                                     GLib.PRIORITY_DEFAULT_IDLE, null, (d, res) => {
            let en;
            try {
                en = d.enumerate_children_finish(res);
            } catch (e) {
                resolve([]);  // pasta ainda não existe
                return;
            }
            en.next_files_async(100, GLib.PRIORITY_DEFAULT_IDLE, null, (e2, res2) => {
                let infos = [];
                try { infos = e2.next_files_finish(res2); } catch (e) { /* vazio */ }
                en.close_async(GLib.PRIORITY_DEFAULT_IDLE, null, null);
                resolve(infos.map(i => i.get_name())
                    .filter(n => n.endsWith(".json") && !n.startsWith("."))
                    .map(n => GLib.build_filenamev([pasta, n])));
            });
        });
    });
}

function tempo(iso) {
    const t = iso ? Date.parse(iso) : NaN;
    return isNaN(t) ? 0 : t;
}

// Leitura com mais de 30 min perde para uma mais nova de outra fonte.
const VELHA_MS = 30 * 60 * 1000;

function peso(p) {
    let v = (PESO_ESTADO[p.estado] || 0) + (p.janelas && p.janelas.length ? 1 : 0);
    if (Date.now() - tempo(p.lido_em) > VELHA_MS) v -= 4;
    return v;
}

// Junta os provedores de todos os arquivos: vence a leitura boa e recente, depois a mais nova.
async function juntar(lerUsuario) {
    const melhor = {};
    for (const pasta of PASTAS_FONTES) {
        if (pasta === PASTA_USUARIO && !lerUsuario) continue;
        for (const arq of await listarJson(pasta)) {
            let dados;
            try { dados = JSON.parse((await lerTexto(arq)) || "null"); } catch (e) { continue; }
            if (!dados || !Array.isArray(dados.provedores)) continue;
            for (const p of dados.provedores) {
                p._coletor = dados.coletor;
                const atual = melhor[p.id];
                const pesoNovo = peso(p);
                const pesoAtual = atual ? peso(atual) : -99;
                if (pesoNovo > pesoAtual || (pesoNovo === pesoAtual && tempo(p.lido_em) > tempo(atual.lido_em))) {
                    melhor[p.id] = p;
                }
            }
        }
    }
    return ORDEM.filter(id => melhor[id]).map(id => melhor[id])
        .concat(Object.keys(melhor).filter(id => ORDEM.indexOf(id) < 0).map(id => melhor[id]));
}

// A janela mais apertada de cada tipo (é a que vai travar primeiro).
function maior(janelas, tipo) {
    let m = null;
    for (const j of janelas || []) {
        if (j.tipo === tipo && (m === null || j.usado > m.usado)) m = j;
    }
    return m;
}

function periodo(j) {
    if (j.periodo) return j.periodo;
    return j.tipo === "curta" ? "H" : "S";  // JSON de coletor antigo
}

function escapar(t) {
    return GLib.markup_escape_text(String(t), -1);
}

// Item de menu só de leitura, sem o cinza de "desativado" que o Cinnamon põe.
function itemFixo() {
    const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    item.actor.remove_style_pseudo_class("insensitive");
    return item;
}

const PLANOS = { free_educational_quota: "educational", free_limited_copilot: "free", consumer: "personal" };

function fmtPlano(plano) {
    if (!plano) return "";
    const s = String(plano);
    if (PLANOS[s]) return t(PLANOS[s]);
    return s.replace(/_quota$/, "").replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
}

function fmtPct(v) {
    return v === null || v === undefined ? "–" : Math.round(v) + "%";
}

function fmtReinicio(iso) {
    const t = tempo(iso);
    if (!t) return "";
    const agora = Date.now();
    let s = Math.max(0, Math.round((t - agora) / 1000));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60);
    const falta = d > 0 ? `${d} d ${h} h` : (h > 0 ? `${h} h ${m} min` : `${m} min`);
    const dt = new Date(t);
    const hora = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
    const hoje = new Date(agora).toDateString() === dt.toDateString();
    const data = IDIOMA === "en" ? `${dt.getMonth() + 1}/${dt.getDate()}` : `${dt.getDate()}/${dt.getMonth() + 1}`;
    const quando = hoje ? hora : (d >= 6 ? data : `${(DIAS[IDIOMA] || DIAS.en)[dt.getDay()]} ${hora}`);
    return `${tr("in %s", falta)} · ${quando}`;
}

function fmtHaQuanto(iso) {
    const t = tempo(iso);
    if (!t) return tr("never");
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return tr("now");
    if (min < 60) return tr("%s ago", `${min} min`);
    const h = Math.round(min / 60);
    return tr("%s ago", h < 48 ? `${h} h` : `${Math.round(h / 24)} d`);
}

function classeNivel(v) {
    if (v === null || v === undefined) return "";
    if (v >= 95) return " cotabar-critico";
    if (v >= 80) return " cotabar-alto";
    return "";
}

// Anel duplo: de fora = janela longa (semana/mês), de dentro = curta (5 h/dia).
class Anel {
    constructor(id, tamanho) {
        this.id = id;
        this.longa = null;
        this.curta = null;
        this.apagado = false;
        const marca = MARCA[id] || { cor: [0.7, 0.7, 0.7], letra: id.charAt(0).toUpperCase() };
        this.cor = marca.cor;

        this.actor = new St.Widget({ layout_manager: new Clutter.BinLayout(), style_class: "cotabar-anel" });
        this.area = new St.DrawingArea({ width: tamanho, height: tamanho });
        this.area.connect("repaint", (a) => this._pintar(a));
        this.letra = new St.Label({ text: marca.letra, style_class: "cotabar-letra",
                                    x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER });
        this.actor.add_child(this.area);
        this.actor.add_child(this.letra);
    }

    definir(curta, longa, apagado) {
        this.curta = curta;
        this.longa = longa;
        this.apagado = apagado;
        this.letra.opacity = apagado ? 110 : 255;
        this.area.queue_repaint();
    }

    _pintar(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        const fg = this.letra.get_theme_node().get_foreground_color();
        const cx = w / 2, cy = h / 2;
        const esp = Math.max(2, Math.round(w / 10));
        const rFora = Math.min(w, h) / 2 - esp / 2 - 0.5;
        const rDentro = rFora - esp - 1.5;
        const inicio = -Math.PI / 2;
        const [r, g, b] = this.cor;
        const alfa = this.apagado ? 0.45 : 1;

        cr.setLineWidth(esp);
        cr.setLineCap(1); // redondo

        for (const [raio, valor] of [[rFora, this.longa], [rDentro, this.curta]]) {
            cr.setSourceRGBA(fg.red / 255, fg.green / 255, fg.blue / 255, 0.16);
            cr.arc(cx, cy, raio, 0, 2 * Math.PI);
            cr.stroke();
            if (valor !== null && valor > 0) {
                cr.setSourceRGBA(r, g, b, alfa * (raio === rFora ? 1 : 0.8));
                cr.arc(cx, cy, raio, inicio, inicio + 2 * Math.PI * Math.min(1, valor / 100));
                cr.stroke();
            }
        }
        cr.$dispose();
    }
}

class CotaBarApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.metadata = metadata;
        this.orientation = orientation;
        this.provedores = [];
        this.aneis = {};
        this.rodando = false;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("coletar", "coletar", () => { this._reagendar(true); this._ler(); });
        for (const id of ORDEM) {
            this.settings.bind("ia-" + id, "ia_" + id, () => { this._coletar(); this._ler(); });
        }
        this.settings.bind("letra-periodo", "letraPeriodo", () => this._desenhar());
        this.settings.bind("idioma", "idioma", () => { this._aplicarIdioma(); this._desenhar(); });
        this._aplicarIdioma();
        this.settings.bind("intervalo", "intervalo", () => this._reagendar(false));
        this.settings.bind("mostrar", "mostrar", () => this._desenhar());
        this.settings.bind("ocultar-ausentes", "ocultarAusentes", () => this._desenhar());

        const vertical = orientation === St.Side.LEFT || orientation === St.Side.RIGHT;
        this.caixa = new St.BoxLayout({ vertical, style_class: "cotabar-caixa" });
        this.actor.add_child(this.caixa);
        this.set_applet_tooltip(t("CotaBar — AI usage limits"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.connect("open-state-changed", (m, aberto) => { if (aberto) this._montarMenu(); });

        this._tamanho = Math.max(16, Math.min(28, panelHeight - 9));
        this._ler();
        this._reagendar(true);
        this._loopLeitura = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, 30, () => {
            this._ler();
            return GLib.SOURCE_CONTINUE;
        });
    }


    _aplicarIdioma() {
        IDIOMA = this.idioma && this.idioma !== "auto" ? this.idioma : idiomaDoSistema();
    }

    // ------------------------------------------------------------ coleta

    _caminhoColetor() {
        if (GLib.file_test(COLETOR_SISTEMA, GLib.FileTest.IS_EXECUTABLE)) return COLETOR_SISTEMA;
        return GLib.build_filenamev([this.metadata.path, "cotabar-coletor"]);
    }

    _reagendar(agora) {
        if (this._loopColeta) {
            GLib.source_remove(this._loopColeta);
            this._loopColeta = null;
        }
        const seg = Math.max(2, this.intervalo || 5) * 60;
        this._loopColeta = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, seg, () => {
            this._coletar();
            return GLib.SOURCE_CONTINUE;
        });
        if (agora) this._coletar();
    }

    _ligados() {
        return ORDEM.filter(id => this["ia_" + id]);
    }

    _coletar() {
        if (!this.coletar) return;
        if (this.rodando) {
            this._pendente = true;  // roda de novo assim que a atual acabar
            return;
        }
        const lista = this._ligados().join(",");
        if (!lista) return;
        GLib.mkdir_with_parents(PASTA_USUARIO, 0o755);
        // --saida/--provedores: aceitos por todas as versões do coletor.
        const argv = ["python3", "-I", this._caminhoColetor(),
                      "--saida", GLib.build_filenamev([PASTA_USUARIO, "usuario.json"]),
                      "--provedores", lista];
        try {
            const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_PIPE);
            this.rodando = true;
            proc.communicate_utf8_async(null, null, (p, res) => {
                this.rodando = false;
                if (this._removido) return;
                try {
                    const [, , err] = p.communicate_utf8_finish(res);
                    if (!p.get_successful() && err) global.logError("CotaBar: " + err.trim());
                } catch (e) {
                    global.logError("CotaBar: " + e.message);
                }
                this._ler();
                if (this._pendente) {
                    this._pendente = false;
                    this._coletar();
                }
            });
        } catch (e) {
            this.rodando = false;
            global.logError("CotaBar: could not run the collector: " + e.message);
        }
    }

    _atualizarTudo() {
        // O serviço root (se houver) roda no timer dele; aqui coleta o do usuário e relê tudo.
        this._coletar();
        this._ler();
    }

    // ------------------------------------------------------------ barra

    _ler() {
        if (this._lendo) {
            this._releitura = true;
            return;
        }
        this._lendo = true;
        juntar(this.coletar).then(provedores => {
            this._lendo = false;
            if (this._removido) return;
            this.provedores = provedores;
            this._desenhar();
            if (this.menu.isOpen) this._montarMenu();
            if (this._releitura) {
                this._releitura = false;
                this._ler();
            }
        }).catch(e => {
            this._lendo = false;
            global.logError("CotaBar: " + e);
        });
    }

    _visiveis() {
        return this.provedores.filter(p => (ORDEM.indexOf(p.id) < 0 || this["ia_" + p.id]) &&
                                           !(this.ocultarAusentes && p.estado === "ausente"));
    }

    _desenhar() {
        const vis = this._visiveis();
        const ids = vis.map(p => p.id).join(",");
        if (ids !== this._ids) {
            this.caixa.destroy_all_children();
            this._vazio = null;
            this.aneis = {};
            this.textos = {};
            for (const p of vis) {
                const item = new St.BoxLayout({ style_class: "cotabar-item" });
                const anel = new Anel(p.id, this._tamanho);
                const texto = new St.Label({ style_class: "cotabar-numeros", y_align: Clutter.ActorAlign.CENTER });
                item.add_child(anel.actor);
                item.add_child(texto);
                this.caixa.add_child(item);
                this.aneis[p.id] = anel;
                this.textos[p.id] = texto;
            }
            this._ids = ids;
        }
        if (!vis.length) {
            if (!this._vazio) {
                this._vazio = new St.Label({ text: "IA –", style_class: "cotabar-numeros", y_align: Clutter.ActorAlign.CENTER });
                this.caixa.add_child(this._vazio);
            }
        } else if (this._vazio) {
            this._vazio.destroy();
            this._vazio = null;
        }

        const dicas = [];
        for (const p of vis) {
            const curta = maior(p.janelas, "curta");
            const longa = maior(p.janelas, "longa");
            const apagado = p.estado !== "ok";
            this.aneis[p.id].definir(curta ? curta.usado : null, longa ? longa.usado : null, apagado);

            let mostra;
            if (this.mostrar === "curta") mostra = [curta || longa];
            else if (this.mostrar === "longa") mostra = [longa || curta];
            else if (this.mostrar === "nada") mostra = [];
            else mostra = curta && longa ? [curta, longa] : [curta || longa];
            mostra = mostra.filter(Boolean);
            if (this.mostrar !== "nada" && !mostra.length) mostra = [null];

            const num = this.textos[p.id];
            num.visible = mostra.length > 0;
            const linhas = mostra.map(j => {
                if (!j) return "–";
                const letra = this.letraPeriodo ? `<span size="smaller" alpha="65%"> ${letraPeriodo(periodo(j))}</span>` : "";
                return escapar(fmtPct(j.usado)) + letra;
            });
            num.clutter_text.set_markup(linhas.join("\n"));
            const topo = Math.max(curta ? curta.usado : 0, longa ? longa.usado : 0);
            num.style_class = "cotabar-numeros" + (linhas.length > 1 ? " cotabar-duas" : "") + classeNivel(topo) + (apagado ? " cotabar-apagado" : "");

            const partes = [curta, longa].filter(Boolean).map(j => `${fmtPct(j.usado)} ${t(NOME_PERIODO[periodo(j)] || "")}`.trim());
            dicas.push(`${p.nome}: ${partes.join(" · ") || t("no data")}${p.estado === "erro" ? " (" + fmtErro(p) + ")" : ""}`);
        }
        this.set_applet_tooltip(dicas.length ? dicas.join("\n") + "\n" + t("Outer ring: week/month · inner: hours/day") + "\n" + t("letters") : t("CotaBar — no data yet"));
    }

    // ------------------------------------------------------------ menu

    _montarMenu() {
        this.menu.removeAll();
        const vis = this._visiveis();
        if (!vis.length) {
            this.menu.addMenuItem(this._linhaTexto(t("No readings yet. Check that cotabar-coletor is installed."), "cotabar-aviso"));
        }
        vis.forEach((p, i) => {
            if (i > 0) this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addMenuItem(this._cabecalho(p));
            if (p.estado === "ausente") {
                this.menu.addMenuItem(this._linhaTexto(t("Not found on this machine"), "cotabar-aviso"));
                return;
            }
            if (p.erro || p.erro_codigo) {
                this.menu.addMenuItem(this._linhaTexto((p.desatualizado ? t("Last good reading %s — ", fmtHaQuanto(p.lido_em_ok)) : "") + fmtErro(p), "cotabar-aviso"));
            }
            const ordenadas = (p.janelas || []).slice().sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "curta" ? -1 : 1));
            for (const j of ordenadas) this.menu.addMenuItem(this._linhaJanela(p, j));
        });
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const atualizar = new PopupMenu.PopupIconMenuItem(t("Refresh now"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
        atualizar.connect("activate", () => this._atualizarTudo());
        this.menu.addMenuItem(atualizar);
    }

    _cabecalho(p) {
        const item = itemFixo();
        const caixa = new St.BoxLayout({ style_class: "cotabar-cab", x_expand: true });
        const cor = (MARCA[p.id] || { cor: [0.7, 0.7, 0.7] }).cor.map(c => Math.round(c * 255)).join(",");
        caixa.add_child(new St.Widget({ style_class: "cotabar-ponto", style: `background-color: rgb(${cor});`, y_align: Clutter.ActorAlign.CENTER }));
        caixa.add_child(new St.Label({ text: p.nome, style_class: "cotabar-nome", y_align: Clutter.ActorAlign.CENTER }));
        if (p.plano) caixa.add_child(new St.Label({ text: fmtPlano(p.plano), style_class: "cotabar-plano", y_align: Clutter.ActorAlign.CENTER }));
        caixa.add_child(new St.Widget({ x_expand: true }));
        caixa.add_child(new St.Label({ text: fmtHaQuanto(p.lido_em_ok || p.lido_em), style_class: "cotabar-quando", y_align: Clutter.ActorAlign.CENTER }));
        item.addActor(caixa, { expand: true, span: -1 });
        return item;
    }

    _linhaTexto(texto, classe) {
        const item = itemFixo();
        item.addActor(new St.Label({ text: texto, style_class: classe }), { expand: true, span: -1 });
        return item;
    }

    _linhaJanela(p, j) {
        const item = itemFixo();
        const linha = new St.BoxLayout({ vertical: true, style_class: "cotabar-janela", x_expand: true });

        const topo = new St.BoxLayout({ x_expand: true });
        topo.add_child(new St.Label({ text: rotulo(j, p._coletor), style_class: "cotabar-rotulo" }));
        topo.add_child(new St.Widget({ x_expand: true }));
        topo.add_child(new St.Label({ text: fmtPct(j.usado), style_class: "cotabar-pct" + classeNivel(j.usado) }));
        linha.add_child(topo);

        const LARGURA = 260;
        const trilho = new St.Widget({ style_class: "cotabar-trilho", width: LARGURA });
        const cor = (MARCA[p.id] || { cor: [0.7, 0.7, 0.7] }).cor.map(c => Math.round(c * 255)).join(",");
        const fim = Math.max(0, Math.min(1, j.usado / 100));
        if (fim > 0) {
            trilho.add_child(new St.Widget({ style_class: "cotabar-cheio",
                                             style: `background-color: rgb(${cor});`,
                                             width: Math.max(4, Math.round(LARGURA * fim)) }));
        }
        linha.add_child(trilho);

        const pe = [detalhe(j), j.reinicia ? t("resets %s", fmtReinicio(j.reinicia)) : null].filter(Boolean).join(" · ");
        if (pe) linha.add_child(new St.Label({ text: pe, style_class: "cotabar-pe" }));
        item.addActor(linha, { expand: true, span: -1 });
        return item;
    }

    abrirGithub() {
        Gio.AppInfo.launch_default_for_uri(this.metadata.url || "https://github.com/Davicjc/cotabar", null);
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._removido = true;
        for (const k of ["_loopColeta", "_loopLeitura"]) {
            if (this[k]) {
                GLib.source_remove(this[k]);
                this[k] = null;
            }
        }
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new CotaBarApplet(metadata, orientation, panelHeight, instanceId);
}
