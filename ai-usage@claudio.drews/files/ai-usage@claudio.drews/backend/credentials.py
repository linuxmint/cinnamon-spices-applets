"""Resolução de credenciais do Cinnamon AI Usage.

Ordem por variável, sempre sem shell e sem servidor de credenciais obrigatório:

1. cofre do sistema (Secret Service / gnome-keyring), onde a janela "Credenciais" grava o que a
   pessoa digita;
2. arquivo NOME=VALOR indicado em ``config.json`` pela chave ``credentials_path`` (qualquer
   caminho: ~/.env, ~/.config/secrets.env, o que a pessoa usar);
3. variáveis de ambiente herdadas do processo.

O arquivo de token OAuth em JSON (``token_files`` em ``config.json``) cobre logins que não são
chave de API, como o token do Nous Portal.

Nenhuma função devolve valor dentro de mensagem de erro, e nada é impresso ou registrado.
"""

from __future__ import annotations

import json
import os
import re
import shlex
from pathlib import Path

import i18n

SCHEMA_NAME = "claudio.drews.CinnamonAIUsage"
KEYRING_LABEL = "Cinnamon AI Usage"

# Variáveis aceitas por serviço, na ordem de preferência.
SERVICE_KEYS = {
    "openrouter": ("OPENROUTER_API_KEY",),
    "deepseek": ("DEEPSEEK_API_KEY",),
    "opencode": ("OPENCODE_GO_API_KEY", "OPENCODE_API_KEY"),
    "grok": ("XAI_MANAGEMENT_API_KEY", "XAI_MANAGEMENT_KEY"),
    "nous": ("NOUS_PORTAL_TOKEN",),
    "codex": (),
    "antigravity": (),
}

# Dados não secretos que costumam acompanhar a credencial (time, projeto, conta).
SERVICE_SETTINGS = {
    "grok": ("XAI_TEAM_ID",),
}

# Serviços que aceitam token OAuth vindo de arquivo JSON, em vez de chave digitada.
TOKEN_SERVICES = ("nous",)

ASSIGNMENT = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


def _value_and_comment(raw):
    """Valor e comentário, com a mesma regra do shell para ``#``.

    O ``#`` só começa comentário no início da linha ou depois de espaço; colado ao valor (como
    em ``KEY=sk-abc#def``) ele faz parte do valor, e as aspas protegem o ``#`` que estiver
    dentro delas. O leitor anterior usava ``shlex`` com comentários e cortava o resto do valor
    em silêncio — chave de API com ``#`` virava chave errada.
    """
    out, index, quote = [], 0, None
    while index < len(raw):
        char = raw[index]
        if quote:
            if quote == "\"" and char == "\\" and index + 1 < len(raw):
                out.append(char); out.append(raw[index + 1]); index += 2; continue
            if char == quote:
                quote = None
            out.append(char); index += 1; continue
        if char in ("'", "\""):
            quote = char; out.append(char); index += 1; continue
        if char == "#" and (index == 0 or raw[index - 1] in " \t"):
            break
        out.append(char); index += 1
    return "".join(out).strip()


def parse_assignments(text, discarded=None):
    """Extrai NOME=VALOR de um arquivo de credenciais, sem executar shell.

    Sem aspas, o valor é usado exatamente como veio (espaços internos inclusive). Com aspas,
    valem as regras do shell — inclusive escape — e só um valor único é aceito. Linhas
    descartadas entram em ``discarded`` como (nome, motivo), para a interface poder dizer por
    que um serviço continua não configurado em vez de mostrar "não configurado" sem causa.
    O motivo nasce em ``_()``: ele é mostrado na janela de credenciais, no idioma em vigor.
    """
    values = {}
    for line in (text or "").splitlines():
        match = ASSIGNMENT.match(line)
        if not match:
            continue
        name, raw = match.group(1), match.group(2)
        value = _value_and_comment(raw)
        if not value:
            continue
        if value[0] in ("'", "\""):
            try:
                parts = shlex.split(value, comments=False, posix=True)
            except ValueError:
                _discard(discarded, name, i18n._("unterminated quotes"))
                continue
            if len(parts) != 1:
                _discard(discarded, name, i18n._("more than one value inside quotes"))
                continue
            values[name] = parts[0]
        else:
            values[name] = value
    return values


def _discard(discarded, name, reason):
    if discarded is not None:
        discarded.append((name, reason))


def read_file(path, discarded=None):
    if not path:
        return {}
    try:
        return parse_assignments(Path(path).expanduser().read_text(), discarded)
    except OSError:
        return {}


def _secret_module():
    """Importa o vínculo Secret sem exigir que exista na máquina.

    O namespace declara versão "1" (arquivo Secret-1.typelib); pedir "1.0" falha.
    """
    try:
        import gi

        gi.require_version("Secret", "1")
        from gi.repository import Secret

        return Secret
    except Exception:
        return None


def _service(Secret):
    """Serviço sem prompt e sem carregar coleções: cofre travado responde "sem valor"."""
    try:
        return Secret.Service.get_sync(Secret.ServiceFlags.NONE, None)
    except Exception:
        return None


def _schema(Secret):
    return Secret.Schema.new(SCHEMA_NAME, Secret.SchemaFlags.NONE,
                             {"nome": Secret.SchemaAttributeType.STRING})


def keyring_available():
    Secret = _secret_module()
    if Secret is None:
        return False
    return _service(Secret) is not None


def keyring_get(name):
    Secret = _secret_module()
    if Secret is None:
        return None
    if _service(Secret) is None:
        return None
    try:
        found = Secret.password_lookup_sync(_schema(Secret), {"nome": name}, None)
    except Exception:
        return None
    return found or None


def keyring_set(name, value, label=""):
    Secret = _secret_module()
    if Secret is None or _service(Secret) is None:
        raise RuntimeError(i18n._("System keyring unavailable."))
    stored_label = i18n._f(i18n._("{app} — {label}"), app=KEYRING_LABEL, label=label or name)
    Secret.password_store_sync(_schema(Secret), {"nome": name},
                               Secret.COLLECTION_DEFAULT,
                               stored_label, value, None)


def keyring_delete(name):
    Secret = _secret_module()
    if Secret is None or _service(Secret) is None:
        raise RuntimeError(i18n._("System keyring unavailable."))
    try:
        return bool(Secret.password_clear_sync(_schema(Secret), {"nome": name}, None))
    except Exception:
        return False


def keyring_names():
    """Nomes já guardados no cofre (o cofre é a fonte; a leitura por nome é sempre ao vivo)."""
    Secret = _secret_module()
    if Secret is None:
        return set()
    try:
        service = Secret.Service.get_sync(Secret.ServiceFlags.LOAD_COLLECTIONS, None)
    except Exception:
        return set()
    if service is None:
        return set()
    names = set()
    try:
        for item in service.get_collections() or []:
            if item.get_locked():
                continue
            for stored in item.get_items() or []:
                attributes = stored.get_attributes() or {}
                nome = attributes.get("nome")
                if nome:
                    names.add(str(nome))
    except Exception:
        return names
    return names


def token_from_json(path):
    """Primeiro access_token encontrado no JSON, em qualquer nível."""
    try:
        data = json.loads(Path(path).expanduser().read_text())
    except (OSError, ValueError):
        return None
    stack = [data]
    while stack:
        current = stack.pop(0)
        if isinstance(current, dict):
            for key, value in current.items():
                if key in ("access_token", "accessToken") and isinstance(value, str) and value:
                    return value
                if isinstance(value, (dict, list)):
                    stack.append(value)
        elif isinstance(current, list):
            stack.extend(item for item in current if isinstance(item, (dict, list)))
    return None


def sources(config=None):
    """Fontes não secretas em uso, para mensagem de estado na interface."""
    config = config or {}
    return {"cofre": keyring_available(), "arquivo": bool(config.get("credentials_path")),
            "token": {name: bool((config.get("token_files") or {}).get(name)) for name in TOKEN_SERVICES}}


def resolve(names, config=None):
    """Valores disponíveis para ``names``, seguindo cofre, arquivo e ambiente."""
    config = config or {}
    wanted = list(names)
    found = {}
    for name in wanted:
        value = keyring_get(name)
        if value:
            found[name] = value
    missing = [name for name in wanted if name not in found]
    if missing:
        file_values = read_file(config.get("credentials_path"))
        for name in missing:
            if file_values.get(name):
                found[name] = file_values[name]
    for name in wanted:
        if name not in found and os.environ.get(name):
            found[name] = os.environ[name]
    return found


def value_source(names, config=None):
    """Camada que forneceria o valor para ``names``, e o próprio valor.

    Fonte única da precedência: o cofre vence em **qualquer** um dos nomes aceitos, e só então
    o arquivo indicado, e só então o ambiente. Quem lê o valor (``service_value``) e quem apenas
    informa a origem (janela de credenciais) consultam esta função — antes a janela checava
    cofre, arquivo e ambiente de um nome antes de passar ao próximo e dizia "do arquivo
    indicado" enquanto a coleta usava a chave guardada no cofre de um alias.
    """
    names = [name for name in names if name]
    for name in names:
        value = keyring_get(name)
        if value:
            return "cofre", value
    file_values = read_file((config or {}).get("credentials_path"))
    for name in names:
        if file_values.get(name):
            return "arquivo", file_values[name]
    for name in names:
        value = os.environ.get(name)
        if value:
            return "ambiente", value
    return None, None


SOURCE_LABELS = {"cofre": i18n.N_("stored in the system keyring"),
                 "arquivo": i18n.N_("from the indicated file"),
                 "ambiente": i18n.N_("from the environment variable")}

NOT_CONFIGURED = i18n.N_("not configured")


def source_label(names, config=None):
    """Rótulo público da origem do valor, sem revelar o valor.

    A tabela guarda o **msgid** (``N_()``) e a tradução acontece aqui, na hora de mostrar: com
    ``_()`` no valor da tabela, o rótulo sairia no idioma de quem importou o módulo — a janela
    de credenciais abriria em inglês num applet em português.
    """
    layer, _value = value_source(names, config)
    return i18n._(SOURCE_LABELS.get(layer or "", NOT_CONFIGURED))


def service_value(service, config=None):
    """Primeiro valor disponível entre as variáveis do serviço, ou None.

    A ordem é a de ``value_source``: o cofre vem antes, em **qualquer** um dos nomes aceitos —
    quem digitou a chave na janela de Credenciais espera que ela valha, e não que um alias
    antigo do arquivo ou do ambiente vença. Antes, salvar ``XAI_MANAGEMENT_KEY`` não substituía
    a ``XAI_MANAGEMENT_API_KEY`` que o backend preferia — a interface dizia "guardado no cofre"
    e a coleta usava a chave velha.
    """
    names = SERVICE_KEYS.get(service, ())
    if not names:
        return None
    return value_source(names, config)[1]


def setting_value(service, config=None):
    """Primeiro valor disponível entre as variáveis não secretas do serviço, ou None.

    Mesma ordem de ``value_source``: configuração própria tem precedência no chamador, e aqui
    vale cofre, arquivo e ambiente, nessa ordem.
    """
    names = SERVICE_SETTINGS.get(service, ())
    if not names:
        return None
    return value_source(names, config)[1]


def oauth_token(service, config=None):
    """Token OAuth de arquivo indicado na configuração, se houver."""
    path = (config or {}).get("token_files", {}).get(service)
    return token_from_json(path) if path else None
