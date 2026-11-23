#!/usr/bin/env python3
"""Idioma da interface: catálogo gettext, resolução de idioma e formatação.

O código fala inglês: todo texto que a pessoa lê nasce em ``_()`` com msgid em
inglês e a tradução vive em ``locale/<idioma>/LC_MESSAGES/ai-usage@claudio.drews.mo``
(ver ``docs/i18n.md``). Sem catálogo para o idioma resolvido, a interface sai em
inglês — nunca em um idioma que catálogo nenhum cobre.

Números e datas não passam por ``locale.setlocale``: a tabela ``LANGUAGES`` traz o
separador decimal e o formato de cada idioma. O processo herda o ``LC_ALL`` da
sessão e ``strftime('%b')`` devolveria o nome do mês no idioma do ambiente, não no
idioma da interface — ou seja, um mês em português numa frase em inglês.

A janela e o applet herdam o idioma do ambiente (``LANGUAGE`` > ``LC_ALL`` >
``LC_MESSAGES`` > ``LANG``) e a configuração ``language`` do applet sobrepõe a
herança: quem sobrepõe exporta ``LANGUAGE`` para o processo filho, de modo que
coleta, janela de uso e janela de credenciais concordem. É por isso que a
resolução mora aqui e não no chamador.
"""

from __future__ import annotations

import gettext as _gettext
import os
from datetime import datetime
from pathlib import Path

DOMAIN = "ai-usage@claudio.drews"
FALLBACK = "en"

# Cada idioma traz o que o texto precisa: nome para a interface de preferências,
# separador decimal, formato de data/hora, ordem do valor monetário e os nomes de
# mês para o inglês (o português usa data numérica e não precisa deles).
LANGUAGES = {
    "pt_BR": {
        "name": "Português (Brasil)",
        "decimal": ",",
        "datetime": "%d/%m/%Y %H:%M",
        "time": "%H:%M",
        "money": "{value} {currency}",
        "months": (),
        # Forma plural: índice da forma em `msgstr[n]`. Tem de ser a mesma regra do
        # `Plural-Forms` do catálogo compilado — em pt_BR, `plural=(n > 1)`, então zero é
        # singular. Vive aqui porque o painel não tem gettext e escolhe a forma em código;
        # o teste compara esta tabela com o cabeçalho do .po.
        "plural": lambda n: 0 if n <= 1 else 1,
    },
    "en": {
        "name": "English",
        "decimal": ".",
        "datetime": None,  # montado com os nomes de mês, sem depender do ambiente
        "time": None,
        "money": "{currency} {value}",
        "months": ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"),
        "plural": lambda n: 0 if n == 1 else 1,
    },
}

# Grafias aceitas no ambiente e na configuração, todas resolvidas para a chave de
# LANGUAGES. 'C' e 'POSIX' são o ambiente sem tradução: caem no msgid (inglês).
ALIASES = {
    "pt": "pt_BR", "pt_br": "pt_BR", "pt_pt": "pt_BR",
    "en": "en", "en_us": "en", "en_gb": "en", "c": "en", "posix": "en",
}

_catalogs = {}
_state = {"code": FALLBACK}


def catalog_dirs() -> list:
    """Onde procurar catálogo, na ordem: fonte, dados do usuário, sistema.

    A primeira entrada é a pasta ``locale/`` do próprio projeto (e da cópia
    instalada, que fica ao lado de ``backend/``): é o que faz a instalação por
    ``install.py`` funcionar sem nada em ``~/.local/share/locale``. O applet
    depende da segunda: o shell liga o domínio do xlet a ``~/.local/share/locale``
    (``appletManager.js``) e não há como apontá-lo para outro lugar.
    """
    dirs = [Path(__file__).resolve().parent.parent / "locale"]
    data_home = Path(os.environ.get("XDG_DATA_HOME") or (Path.home() / ".local/share"))
    dirs.append(data_home / "locale")
    dirs.append(Path("/usr/share/locale"))
    return dirs


def catalog_file(code: str):
    for base in catalog_dirs():
        candidate = base / code / "LC_MESSAGES" / (DOMAIN + ".mo")
        if candidate.is_file():
            return candidate
    return None


def available() -> list:
    """Idiomas com catálogo de fato instalado, na ordem de LANGUAGES."""
    return [code for code in LANGUAGES if catalog_file(code) is not None]


def normalize(tag) -> str:
    if not isinstance(tag, str):
        return ""
    tag = tag.strip().split(".")[0].split("@")[0].replace("-", "_")
    return ALIASES.get(tag.lower(), "")


def env_candidates() -> list:
    """Idiomas que o ambiente pede, na ordem do gettext, já normalizados para a chave interna.

    `LANGUAGE` manda sozinho: quando está definida, o gettext **ignora** LC_ALL, LC_MESSAGES
    e LANG. Sem ela, vale a primeira variável definida entre LC_ALL, LC_MESSAGES e LANG.
    É a regra do GNU gettext — a mesma que o GLib usa no shell do Cinnamon e a que o
    `gettext` do Python segue —, então painel, janelas e tela de preferências concordam no
    mesmo ambiente. Antes isto percorria as quatro variáveis juntando candidatos, e num
    ambiente misto (LANGUAGE=fr_FR com LC_ALL=pt_BR) o backend respondia português enquanto
    o painel respondia inglês: o mesmo usuário, dois idiomas, cada um numa janela.

    Idioma sem catálogo nesta casa sai da lista (vira string vazia ao normalizar): um idioma
    que não sabemos falar não pode ser a resposta, e também não pode liberar o LC_ALL logo
    abaixo — quem foi pedido foi ele.
    """
    language = os.environ.get("LANGUAGE", "")
    if language.strip():
        parts = [part for part in language.split(":") if part.strip()]
    else:
        parts = []
        for name in ("LC_ALL", "LC_MESSAGES", "LANG"):
            value = os.environ.get(name, "")
            if value.strip():
                parts = [value]
                break
    return [code for code in (normalize(part) for part in parts) if code]


def resolve(explicit=None) -> str:
    """Idioma em vigor: pedido explícito, senão ambiente, senão inglês.

    Um idioma só vale se houver catálogo ou se for o próprio inglês (msgid). Pedido
    explícito que não se pode honrar cai no inglês — nunca no idioma do ambiente:
    quem fixa 'fr' no painel e não tem catálogo francês vê inglês, não a língua de
    quem estava logado por acaso.
    """
    if isinstance(explicit, str) and explicit.strip():
        requested = explicit.strip()
        if requested.lower() in ("auto", "system", "default"):
            return _from_environment()
        wanted = normalize(requested)
        return wanted if wanted == FALLBACK or (wanted and catalog_file(wanted)) else FALLBACK
    return _from_environment()


def _from_environment() -> str:
    for code in env_candidates():
        if code == FALLBACK or catalog_file(code):
            return code
    return FALLBACK


def _load(code: str):
    """Catálogo compilado do idioma, ou None (e aí o texto é o próprio msgid).

    Memoizado: o ``.mo`` não muda durante a execução e a resolução é consultada a
    cada número formatado.
    """
    if code == FALLBACK:
        return None
    if code not in _catalogs:
        catalog = None
        for base in catalog_dirs():
            try:
                catalog = _gettext.translation(DOMAIN, localedir=str(base),
                                               languages=[code], fallback=False)
                break
            except OSError:
                catalog = None
        _catalogs[code] = catalog
    return _catalogs[code]


def activate(code=None) -> str:
    """Fixa o idioma do processo e carrega o catálogo. Idempotente."""
    _state["code"] = resolve(code)
    return _state["code"]


def language() -> str:
    return _state["code"]


def _t(text: str, code=None) -> str:
    """Traduz para o idioma pedido (ou para o em vigor), sem mexer no idioma em vigor."""
    catalog = _load(code or _state["code"])
    return catalog.gettext(text) if catalog is not None else text


def _(text: str) -> str:
    return _t(text)


def N_(text: str) -> str:
    """Marcador de msgid: devolve o texto intacto, e só existe para o xgettext extrair.

    Texto que o usuário lê passa por ``_()`` no momento de mostrar. Texto que **fica
    guardado** (mensagem e rótulo que vão para o cache do contrato) é o contrário: ali
    grava-se o msgid, não a tradução, e a tradução acontece na apresentação. ``N_()`` é a
    convenção do gettext para dizer "isto é um msgid, não traduza agora" — sem ela o
    xgettext não enxerga a string e a frase some do catálogo sem erro nenhum.
    """
    return text


def _n(singular: str, plural: str, n) -> str:
    catalog = _load(_state["code"])
    if catalog is None:
        return singular if n == 1 else plural
    return catalog.ngettext(singular, plural, n)


def arg_text(value) -> str:
    """Texto de um valor de marcador de um registro persistido, no idioma em vigor.

    Argumento guardado no cache é **dado**: quem o transforma em texto é a apresentação, e é
    aqui que isso acontece (docs/i18n.md, "Textos que ficam no cache"). Três formas:

    - **texto**: entra como veio — dado do serviço (`{name}`, `{model}`), nome de plano, ou o
      argumento que uma coleta antiga gravou já formatado, que continua legível como está;
    - **número**: quem o escreve é a tabela do idioma (`number`), sem casas decimais quando o
      valor é inteiro e com uma casa quando é fracionário — `1,5` em pt_BR, `1.5` em inglês;
    - **trecho**: ``{"id": msgid, "args": {...}, "text": texto gravado}``, resolvido como
      qualquer registro. **Lista de trechos** — a forma do marcador `{details}` — sai com os
      trechos separados por um espaço, precedida do espaço que separa o bloco da frase.
    """
    if isinstance(value, bool) or not isinstance(value, (str, int, float, list, dict)):
        return "" if value is None else str(value)
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        # Número cru: nada de formato fixo. `1,5 h` em pt_BR e `1.5 h` em inglês saem da
        # mesma leitura gravada, que é o ponto de guardar o número em vez do texto.
        return number(value, 0 if float(value).is_integer() else 1)
    if isinstance(value, list):
        parts = [arg_text(item) for item in value]
        parts = [part for part in parts if part]
        return (" " + " ".join(parts)) if parts else ""
    resolved = record_text(value, "id", "args", "text")
    if resolved:
        return resolved
    # Trecho sem texto gravado e sem entrada no catálogo cai no próprio msgid: um trecho da nota
    # nunca desaparece da frase em silêncio.
    ident = value.get("id")
    return _f(ident, **(value.get("args") or {})) if isinstance(ident, str) else ""


def _f(text: str, **values) -> str:
    """Substitui ``{nome}`` no msgid pelos valores, cada um escrito pelo idioma em vigor.

    Texto já pronto entra como veio; número cru é escrito por `arg_text` com o separador do
    idioma, e trecho com identificador é resolvido no idioma em vigor. Assim o mesmo registro
    gravado aparece inteiro em qualquer idioma — ``42,0%`` numa apresentação em português e
    ``42.0%`` numa em inglês —, sem recolher nada (docs/i18n.md).
    """
    for name, value in values.items():
        text = text.replace("{" + name + "}", arg_text(value))
    return text


def _has_entry(catalog, msgid: str) -> bool:
    """A entrada de forma única existe no catálogo compilado?

    Comparar a tradução com o msgid **não** responde isso: há tradução legítima idêntica ao
    original (`{hours} h`, nomes de idioma, siglas), e essa comparação classifica a entrada
    como ausente — a apresentação então descarta o identificador e mostra o texto gravado,
    no idioma da coleta antiga. O `_catalog` do `GNUTranslations` é o mapa msgid → msgstr
    lido do `.mo`: consultado só em leitura, e a suíte tem teste que falha se o Python
    deixar de expô-lo (é o tripé que segura esta dependência).

    Entrada com plural fica no mapa sob chave `(msgid, forma)` e por isso **não** conta:
    escolher a forma exige o número, que um registro gravado não traz — devolver sempre a
    primeira forma diria "1 dia" onde a coleta gravou "3 dias". Nesse caso o texto gravado
    é a resposta certa, e é a mesma decisão que o painel toma (`singles` no `applet.js`).
    """
    table = getattr(catalog, "_catalog", None)
    if not isinstance(table, dict):
        return False
    return msgid in table


def record_text(record, id_field: str = "message_id", args_field: str = "message_args",
                text_field: str = "message") -> str:
    """Texto de um registro persistido, no idioma em vigor.

    O texto que o usuário lê **não** é o que ficou gravado na coleta: o identificador
    (``message_id``/``label_id``) é o msgid em inglês, e o campo de texto é apenas o
    recurso de quem não tem catálogo. Assim uma leitura guardada em português aparece
    em português, em inglês ou em qualquer idioma com catálogo, sem recolher nada e
    sem perder histórico (docs/i18n.md, "Textos que ficam no cache").

    Devolve string vazia quando o registro não tem texto nem identificador — quem
    chama decide o que mostrar no lugar.
    """
    if not isinstance(record, dict):
        return ""
    text = record.get(text_field)
    text = text if isinstance(text, str) else ""
    ident = record.get(id_field)
    if not isinstance(ident, str) or not ident:
        return text
    catalog = _load(_state["code"])
    if catalog is None:
        # Idioma sem catálogo é o inglês, e o msgid já é o texto: a frase guardada pode
        # estar em outro idioma, então quem manda é o identificador.
        return _f(ident, **(record.get(args_field) or {}))
    if not _has_entry(catalog, ident):
        return text
    return _f(catalog.gettext(ident), **(record.get(args_field) or {}))


def _spec(code=None):
    return LANGUAGES[code or _state["code"]]


def number(value, decimals: int = 2, code=None) -> str:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return _t("unavailable", code)
    spec = _spec(code)
    text = f"{float(value):.{decimals}f}"
    if spec["decimal"] != ".":
        text = text.replace(".", spec["decimal"])
    return text


def percent(value, decimals: int = 1, code=None) -> str:
    """``42,0%``. Percentual ausente é null no contrato: nunca sai como zero."""
    if value is None:
        return _t("percentage unavailable", code)
    return number(value, decimals, code) + "%"


def money(value, currency=None, code=None) -> str:
    spec = _spec(code)
    text = number(value, 2, code)
    if text == _t("unavailable", code):
        return text
    if not currency:
        return text
    return spec["money"].format(value=text, currency=currency)


def _time_text(moment: datetime, code: str) -> str:
    spec = LANGUAGES[code]
    if spec["time"]:
        return moment.strftime(spec["time"])
    hour = moment.hour % 12 or 12
    return f"{hour}:{moment.minute:02d} {'AM' if moment.hour < 12 else 'PM'}"


def datetime_text(moment, with_time: bool = True, code=None) -> str:
    """Data (e hora) de um ``datetime`` já no fuso local.

    O inglês é montado aqui, com nome de mês próprio, em vez de ``strftime('%b')``:
    o processo pode estar com o locale da sessão em português e o mês sairia em
    português no meio de uma frase em inglês.
    """
    code = code or _state["code"]
    if not isinstance(moment, datetime):
        return _t("unknown time", code)
    spec = LANGUAGES[code]
    if spec["datetime"]:
        text = moment.strftime(spec["datetime"]) if with_time else moment.strftime("%d/%m/%Y")
        return text
    text = f"{spec['months'][moment.month - 1]} {moment.day}, {moment.year}"
    return text + (f" {_time_text(moment, code)}" if with_time else "")


def time_text(moment, code=None) -> str:
    code = code or _state["code"]
    if not isinstance(moment, datetime):
        return _t("unknown time", code)
    return _time_text(moment, code)


def duration(seconds) -> str:
    """Duração curta: ``42 min``, ``3 h``, ``2 dias``. As palavras são traduzidas."""
    try:
        seconds = max(0, int(seconds))
    except (TypeError, ValueError):
        return _("unknown duration")
    if seconds < 90:
        return _("under 2 minutes")
    minutes = seconds // 60
    if minutes < 60:
        return _f(_("{minutes} min"), minutes=minutes)
    hours = minutes // 60
    if hours < 48:
        rest = minutes % 60
        if hours < 12 and rest >= 5:
            return _f(_("{hours} h {minutes} min"), hours=hours, minutes=rest)
        return _f(_("{hours} h"), hours=hours)
    days = hours // 24
    return _f(_n("{days} day", "{days} days", days), days=days)


def relative(moment, now=None) -> str:
    """``há 3 h`` para um instante do passado; vazio quando não há instante."""
    if not isinstance(moment, datetime):
        return ""
    reference = now or datetime.now(moment.tzinfo)
    delta = (reference - moment).total_seconds()
    if delta < 0:
        return _("now")
    return _f(_("{duration} ago"), duration=duration(delta))
