"""Read-only provider adapters. No inference, token refresh or billing mutations."""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import re
import selectors
import shutil
import ssl
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from urllib.request import Request, build_opener, HTTPSHandler, HTTPRedirectHandler, ProxyHandler
from urllib.error import HTTPError, URLError

import credentials
import i18n

SERVICES = {
    "codex": "Codex", "claude": "Claude Code", "antigravity": "Antigravity",
    "grok": "Grok / xAI", "nous": "Nous Portal", "opencode": "OpenCode Go",
    "deepseek": "DeepSeek", "openrouter": "OpenRouter", "meta": "Meta AI (Muse Code)",
}

# A assinatura do Claude Code é lida por uma rota de leitura (GET /api/oauth/usage), a mesma
# que a própria CLI usa no comando /usage. Nada aqui é inferência: o rascunho que pedia uma
# resposta em /v1/messages apenas para raspar cabeçalhos de limite consumiria a cota que o
# applet exibe, e por isso foi recusado. A rota não é documentada pela Anthropic, então o
# conector impõe intervalo mínimo próprio e degrada em vez de adivinhar.
CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
CLAUDE_BETA = "oauth-2025-04-20"
CLAUDE_MIN_INTERVAL = 300

# A assinatura da Meta só é legível pela chamada que emite credencial do Muse Code; ela é
# idempotente (verificado em 26/09/2026: mesma api_key devolvida e auth.json intacto), mas
# não há documentação de limite de uso, então o conector impõe intervalo mínimo próprio.
META_KEY_URL = "https://api.meta.ai/muse-code/key"
META_MIN_INTERVAL = 900

# Texto de uma falha sem mensagem própria. O vocabulário do estado (`stale_reason`) e o texto
# mostrado à pessoa vêm daqui, para a leitura reaproveitada de uma tentativa falha não aparecer
# como "atualização pendente".
QUOTA_FAILURE_MESSAGE = i18n.N_(
    "Failed to query the service; the previous reading is kept.")

# Nota pública de um serviço: a frase fixa é o msgid e os trechos que dependem da resposta entram
# em ``{details}``. A nota fica no cache do contrato, então o que se grava é o identificador — o
# texto gravado é só o recurso de quem não tem catálogo (docs/i18n.md).
META_NOTE_ID = i18n.N_("Application subscription; not API usage billing.{details}")
CLAUDE_NOTE_ID = i18n.N_("Claude Code subscription; not API usage billing. Connector not verified "
                         "on a real account.{details}")


class Unavailable(Exception):
    """Serviço indisponível.

    ``message`` é o **msgid** em inglês e ``args`` os valores brutos que preenchem os
    marcadores: quem transforma isso em texto é a emissão (``collect_provider``), que
    grava o texto no idioma da coleta e o msgid ao lado — o texto traduzido que fica no
    cache não pode ser a única forma de uma frase existir (docs/i18n.md).
    """
    def __init__(self, message, status="unavailable", args=None):
        super().__init__(message)
        self.status = status
        # ``message_args`` e não ``args``: ``Exception.args`` é do próprio Python e
        # sobrescrevê-lo com um dict confunde quem lê o erro e as ferramentas.
        self.message_args = dict(args or {})


def number(value):
    if isinstance(value, bool):
        return None
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError, OverflowError):
        return None


def stamp(value=None):
    if value is None:
        return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    try:
        if isinstance(value, str) and not value.isdigit():
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                # Antes a data sem fuso era descartada em silêncio e o campo desaparecia sem
                # rastro. A convenção do projeto é UTC em tudo que sai daqui, então a data sem
                # fuso é lida como UTC — regra declarada no contrato, não adivinhação.
                dt = dt.replace(tzinfo=timezone.utc)
        else:
            n = float(value)
            if n > 1e12:
                n /= 1000
            dt = datetime.fromtimestamp(n, timezone.utc)
        return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def text(value, default="", limit=100):
    return re.sub(r"[\x00-\x1f\x7f]", " ", str(value or default))[:limit]


def window_hours(minutes):
    """Horas de uma janela, como **número cru**.

    Nada de formato aqui. O valor entra no marcador e quem o escreve é a apresentação, com a
    tabela do idioma em vigor (`i18n.arg_text`): formatar na coleta gravava ``1,5`` no cache e a
    mesma leitura aparecia como "Window of 1,5 h" numa apresentação em inglês — o número já
    escrito num idioma dentro de uma frase em outro (docs/i18n.md, "Textos que ficam no cache").
    """
    return float(minutes) / 60


def note_part(message_id, args=None):
    """Trecho opcional de uma nota: identificador, valores **crus** e o texto da coleta ao lado.

    A nota fica no cache, e o que fica no cache se exibe pelo identificador: guardar a frase já
    montada prenderia a nota ao idioma da coleta. Cada trecho é um registro como qualquer outro —
    ``id`` é o msgid, ``args`` os valores crus, ``text`` o recurso de quem não tem catálogo.
    """
    args = dict(args or {})
    return {"id": message_id, "args": args,
            "text": text(i18n._f(i18n._(message_id), **args), limit=200)}


def metric(id_, label="", kind="", *, label_id=None, label_args=None, aliases=None,
           percent=None, value=None, currency=None, window=None, reset=None):
    """Métrica de um serviço.

    ``label_id`` é o msgid do rótulo e ``label_args`` os valores dos marcadores. Passando
    o msgid, o rótulo sai traduzido no idioma da coleta **e** o identificador segue junto
    no registro: os rótulos ficam no cache, e a interface precisa poder reescrevê-los no
    idioma em vigor sem recolher nada (docs/i18n.md).

    ``aliases`` são ids que esta métrica já teve em leituras **gravadas** antes de o id técnico
    deixar de depender do rótulo: a comparação com o histórico os aceita, e sem eles a primeira
    coleta depois da correção apareceria como métrica nova, sem mudança de consumo.
    """
    p = number(percent)
    result = {"id": id_, "label": text(label), "kind": kind,
              "used_percent": max(0, min(100, p)) if p is not None else None,
              "value": number(value), "currency": currency,
              "window_seconds": window, "reset_at": stamp(reset) if reset else None}
    if label_id is not None:
        args = dict(label_args or {})
        result["label"] = text(i18n._f(i18n._(label_id), **args))
        result["label_id"] = label_id
        result["label_args"] = args
    if aliases:
        result["id_aliases"] = list(aliases)
    return result


def service(id_, status="ok", message="", source="", metrics=None, identity=None, *,
            message_id=None, message_args=None,
            source_id=None, source_args=None):
    """Serviço do contrato.

    Com ``message_id`` (o msgid em inglês) e ``message_args``, o ``message`` é o texto no
    idioma da coleta e os dois campos são gravados ao lado — é o que permite a leitura
    reaproveitada do cache aparecer no idioma em vigor, seja ele qual for.

    A origem segue a mesma regra: ``source_id`` é o msgid da frase de origem, ``source`` o texto
    no idioma da coleta e ``source_args`` os valores crus. A janela mostra a origem pelo
    identificador, então "OpenRouter · chave" não fica preso numa apresentação inglesa.
    """
    result = {"id": id_, "label": SERVICES[id_], "status": status, "message": message,
              "source": source, "read_at": stamp() if status == "ok" else None,
              "last_used_at": None, "recency_basis": "unknown", "metrics": metrics or []}
    if message_id is not None:
        args = dict(message_args or {})
        result["message"] = text(i18n._f(i18n._(message_id), **args), limit=200)
        result["message_id"] = message_id
        result["message_args"] = args
    if source_id is not None:
        args = dict(source_args or {})
        result["source"] = text(i18n._f(i18n._(source_id), **args))
        result["source_id"] = source_id
        result["source_args"] = args
    if identity:
        # Private cache baseline discriminator; the identifier itself is never persisted.
        result["_identity"] = hashlib.sha256(str(identity).encode()).hexdigest()
    return result


def read_json(path):
    try:
        with Path(path).open() as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def require_key(name, config=None):
    """Valor da variável pelo cofre, arquivo indicado ou ambiente."""
    value = credentials.resolve([name], config).get(name)
    if not value:
        raise Unavailable(i18n.N_("Credentials not configured."), "unconfigured")
    return value


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Unavailable(i18n.N_("Unexpected redirect; consultation interrupted."), "error")


VERSION = "0.2.0"  # mesma versão de applet/metadata.json (o teste confere)


def request(url, token=None, data=None, headers=None, local=False, timeout=8):
    # Caller URLs are fixed trusted endpoints; never follow redirects with credentials.
    h = {"Accept": "application/json", "User-Agent": f"cinnamon-ai-usage/{VERSION}"}
    if token:
        h["Authorization"] = "Bearer " + token
    h.update(headers or {})
    body = json.dumps(data).encode() if data is not None else None
    if body is not None:
        h["Content-Type"] = "application/json"
    handlers = [NoRedirect()]
    if local:
        if not re.match(r"^https?://127\.0\.0\.1:[0-9]+/", url):
            raise ValueError("Loopback only")
        handlers += [ProxyHandler({}), HTTPSHandler(context=ssl._create_unverified_context())]
    try:
        with build_opener(*handlers).open(Request(url, data=body, headers=h), timeout=timeout) as response:
            raw = response.read(2_000_001)
            if len(raw) > 2_000_000:
                raise Unavailable(i18n.N_("Response larger than the allowed limit."), "error")
            return json.loads(raw)
    except HTTPError as e:
        # O msgid é o identificador da falha: o texto sai no idioma da coleta e o identificador
        # fica ao lado, para a leitura reaproveitada reaparecer no idioma em vigor (docs/i18n.md).
        messages = {401: i18n.N_("Login expired or credentials refused."),
                    403: i18n.N_("Consultation access refused (HTTP 403)."),
                    404: i18n.N_("Usage source not found (HTTP 404)."),
                    429: i18n.N_("Consultation limit reached; wait for the next update.")}
        raise Unavailable(messages.get(e.code) or i18n.N_("Consultation failed (HTTP {code})."),
                          "error", {"code": e.code}) from None
    except (URLError, TimeoutError, OSError):
        raise Unavailable(i18n.N_("Could not query the service; check the connection."),
                          "error") from None
    except (ValueError, TypeError):
        raise Unavailable(i18n.N_("Unrecognized response format."), "error") from None


def parse_codex(payload):
    buckets = payload.get("rateLimitsByLimitId")
    if not isinstance(buckets, dict) or not buckets:
        buckets = {"codex": payload.get("rateLimits", {})}
    out = []
    for bucket_id, bucket in buckets.items():
        if not isinstance(bucket, dict):
            continue
        for key in ("primary", "secondary"):
            part = bucket.get(key)
            if not isinstance(part, dict) or number(part.get("usedPercent")) is None:
                continue
            minutes = number(part.get("windowDurationMins"))
            window = int(minutes * 60) if minutes and minutes > 0 else None
            label_id, label_args = i18n.N_("Quota"), {}
            if minutes:
                label_id = i18n.N_("Window of {hours} h")
                label_args = {"hours": window_hours(minutes)}
            if len(buckets) > 1:
                # O nome do balde é dado da resposta e entra **cru**, como argumento: texto já
                # traduzido dentro de um argumento ficaria no idioma da coleta quando a interface
                # estivesse em outro. Por isso a frase que junta os dois é um msgid próprio.
                name = text(bucket.get("limitName") or bucket_id)
                if minutes:
                    label_id = i18n.N_("{name} · {hours} h window")
                    label_args = {"name": name, "hours": window_hours(minutes)}
                else:
                    label_id, label_args = i18n.N_("{name} · quota"), {"name": name}
            out.append(metric(f"{bucket_id}:{key}", label_id=label_id, label_args=label_args,
                              kind="quota", percent=part["usedPercent"],
                              window=window, reset=part.get("resetsAt")))
    return out


def codex(config=None):
    executable = shutil.which("codex")
    if not executable:
        raise Unavailable(i18n.N_("Codex CLI not found."), "unconfigured")
    auth = read_json(Path(os.environ.get("CODEX_HOME", str(Path.home()/'.codex'))) / "auth.json")
    identity = (auth.get("tokens") or {}).get("account_id") or "codex-local"
    p = subprocess.Popen([executable, "app-server"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL)
    selector = selectors.DefaultSelector()
    selector.register(p.stdout, selectors.EVENT_READ)
    buffer = b""
    deadline = time.monotonic() + 20

    def send(obj):
        p.stdin.write((json.dumps(obj) + "\n").encode()); p.stdin.flush()

    def receive(id_):
        nonlocal buffer
        while time.monotonic() < deadline:
            while b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                if obj.get("id") == id_:
                    if "error" in obj:
                        raise Unavailable(
                            i18n.N_("Codex did not provide quotas; check the CLI login."), "error")
                    return obj.get("result", {})
            if not selector.select(max(0, deadline-time.monotonic())):
                break
            chunk = os.read(p.stdout.fileno(), 65536)
            if not chunk:
                break
            buffer += chunk
            if len(buffer) > 2_000_000:
                break
        raise Unavailable(i18n.N_("Timeout querying Codex."), "error")

    try:
        send({"id": 1, "method": "initialize", "params": {
            "clientInfo": {"name": "cinnamon-ai-usage", "version": VERSION}}})
        receive(1)
        send({"method": "initialized"})
        send({"id": 2, "method": "account/rateLimits/read"})
        metrics = parse_codex(receive(2))
    finally:
        selector.close()
        p.terminate()
        try:
            p.wait(timeout=2)
        except subprocess.TimeoutExpired:
            p.kill(); p.wait()
        p.stdin.close(); p.stdout.close()
    if not metrics:
        raise Unavailable(i18n.N_("The current login did not return Codex quotas."))
    return service("codex", source_id=i18n.N_("Codex app-server"), metrics=metrics,
                   identity=identity)


def parse_openrouter(payload):
    d = payload.get("data", {})
    out = []
    limit, remaining = number(d.get("limit")), number(d.get("limit_remaining"))
    if limit is not None and limit > 0 and remaining is not None:
        # A data de reset é dado da resposta: entra como argumento do msgid, nunca dentro dele.
        if d.get("limit_reset"):
            out.append(metric("limit", label_id=i18n.N_("Key limit ({reset})"),
                              label_args={"reset": text(d["limit_reset"])}, kind="quota",
                              percent=100*(limit-remaining)/limit))
        else:
            out.append(metric("limit", label_id=i18n.N_("Key limit"), kind="quota",
                              percent=100*(limit-remaining)/limit))
    for k, label_id in (("usage_monthly", i18n.N_("Monthly spend")),
                        ("usage", i18n.N_("Cumulative key spend"))):
        if number(d.get(k)) is not None:
            out.append(metric(k, label_id=label_id, kind="spend", value=d[k], currency="USD"))
    return out


def openrouter(config=None):
    key = require_key("OPENROUTER_API_KEY", config)
    return service("openrouter", source_id=i18n.N_("OpenRouter · key"), identity=key,
                   metrics=parse_openrouter(request("https://openrouter.ai/api/v1/key", key)))


def parse_deepseek(payload):
    return [metric("balance:"+str(d.get("currency")), label_id=i18n.N_("Available balance"),
                   kind="balance", value=d["total_balance"], currency=d.get("currency"))
            for d in payload.get("balance_infos", []) if number(d.get("total_balance")) is not None
            and d.get("currency") in ("USD", "CNY")]


def deepseek(config=None):
    key = require_key("DEEPSEEK_API_KEY", config)
    return service("deepseek", source_id=i18n.N_("DeepSeek · balance"), identity=key,
                   metrics=parse_deepseek(request("https://api.deepseek.com/user/balance", key)))


def parse_nous(payload):
    """Saldos do Nous. Rollover e recarga impedem inferir percentual mensal."""
    access = payload.get("paid_service_access") or {}
    total = number(access.get("total_usable_credits"))
    plan_balance = number(access.get("subscription_credits_remaining"))
    purchased = number(access.get("purchased_credits_remaining"))
    out = []
    if total is not None:
        out.append(metric("total_usable_credits", label_id=i18n.N_("Total available balance"),
                          kind="balance", value=total, currency="USD"))
    # Saldo do plano igual ao total é a mesma informação: uma linha só.
    if plan_balance is not None and (total is None or plan_balance != total):
        out.append(metric("subscription_credits_remaining", label_id=i18n.N_("Plan balance"),
                          kind="balance", value=plan_balance, currency="USD"))
    if purchased:
        out.append(metric("purchased_credits_remaining", label_id=i18n.N_("Prepaid credit balance"),
                          kind="balance", value=purchased, currency="USD"))
    period_end = (payload.get("subscription") or {}).get("current_period_end")
    if period_end:
        for item in out:
            if item["id"] in ("total_usable_credits", "subscription_credits_remaining"):
                item["reset_at"] = stamp(period_end)
    return out


def nous(config=None):
    token = credentials.service_value("nous", config) or credentials.oauth_token("nous", config)
    if not token:
        raise Unavailable(i18n.N_("Nous Portal token not configured."), "unconfigured")
    payload = request("https://portal.nousresearch.com/api/oauth/account", token)
    return service("nous", source_id=i18n.N_("Nous Portal · OAuth token"),
                   metrics=parse_nous(payload),
                   identity=(payload.get("organisation") or {}).get("id"))


def parse_go(payload):
    out = []
    # Observed read-only endpoint, 2026-09-25; no undocumented fields guessed as zeros.
    usage = payload.get("usage") or {}
    for key, label_id, seconds in (("rolling", i18n.N_("Rolling window"), None),
                                   ("weekly", i18n.N_("Week"), 604800),
                                   ("monthly", i18n.N_("Month"), None)):
        part = usage.get(key)
        if not isinstance(part, dict):
            continue
        pct = number(part.get("percent"))
        if pct is not None:
            out.append(metric(key, label_id=label_id, kind="quota", percent=pct, window=seconds,
                              reset=part.get("resetsAt")))
    return out


def opencode(config=None):
    token = credentials.service_value("opencode", config)
    if not token:
        raise Unavailable(i18n.N_("OpenCode Go key not configured."), "unconfigured")
    payload = request("https://opencode.ai/zen/go/v1/usage", token)
    metrics = parse_go(payload)
    if not metrics:
        raise Unavailable(i18n.N_("Go response without recognized quotas; experimental connector."))
    return service("opencode", source_id=i18n.N_("OpenCode Go · usage (experimental)"),
                   metrics=metrics, identity=token)


def parse_grok(payload):
    """Saldo pré-pago e, quando já houve consumo, quanto do crédito foi usado.

    ``total.val`` vem com o sinal invertido: recarga entra como valor negativo no razão e o total
    é a soma das mudanças, de modo que o crédito disponível é o módulo desse total (conferido em
    resposta real: recarga negativa, total negativo, mesmo valor absoluto). O denominador do
    percentual são os créditos concedidos — a soma das recargas — porque a chave não traz teto
    próprio; a métrica só aparece quando existe consumo, para não encher o menu de barra em zero.
    """
    total = number((payload.get("total") or {}).get("val"))
    if total is None:
        raise Unavailable(i18n.N_("Unrecognized xAI balance."))
    concedidos = usados = 0.0
    for mudanca in payload.get("changes") or []:
        valor = number((mudanca.get("amount") or {}).get("val"))
        if valor is None:
            continue
        concedidos += -valor if valor < 0 else 0.0
        usados += valor if valor > 0 else 0.0
    metrics = [metric("balance", label_id=i18n.N_("API prepaid balance"), kind="balance",
                      value=-total / 100, currency="USD")]
    if concedidos > 0 and usados > 0:
        metrics.append(metric("credits_used", label_id=i18n.N_("Prepaid credits used"),
                              kind="quota", percent=100 * usados / concedidos,
                              value=usados / 100, currency="USD"))
    return metrics


def grok(config):
    key = credentials.service_value("grok", config)
    if not key:
        raise Unavailable(i18n.N_("xAI management key not configured."), "unconfigured")
    team = (config.get("grok") or {}).get("team_id") or credentials.setting_value("grok", config) or ""
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", str(team)):
        raise Unavailable(i18n.N_("Set grok.team_id in the configuration or XAI_TEAM_ID together "
                                  "with the credentials to query the xAI API."), "unconfigured")
    payload = request(f"https://management-api.x.ai/v1/billing/teams/{team}/prepaid/balance", key)
    return service("grok",
                   source_id=i18n.N_(
                       "xAI Management API · does not include the Grok subscription"),
                   message_id=i18n.N_("xAI records prepaid credits as a negative value in total.val; "
                                      "the displayed balance is the available credit."),
                   identity=team, metrics=parse_grok(payload))


def parse_antigravity(payload):
    """Cotas do Antigravity: créditos do plano primeiro, depois fração por modelo.

    Os modelos vêm em ``clientModelConfigs`` com o nome em ``label``; só entram os que
    informam ``remainingFraction`` (a família Gemini do plano Pro informa apenas resetTime,
    e ausência de fração não vira zero).
    """
    user = payload.get("userStatus") or payload
    out = []
    plan = user.get("planStatus") or {}
    info = plan.get("planInfo") or {}
    for key, label_id in (("Prompt", i18n.N_("Prompt credits")), ("Flow", i18n.N_("Flow credits"))):
        total = number(info.get(f"monthly{key}Credits"))
        remaining = number(plan.get(f"available{key}Credits"))
        if total and total > 0 and remaining is not None:
            out.append(metric(key.lower(), label_id=label_id, kind="quota",
                              percent=100 * (1 - remaining / total)))
    configs = (user.get("cascadeModelConfigData") or {}).get("clientModelConfigs") or []
    for index, config in enumerate(configs):
        quota = config.get("quotaInfo") or {}
        fraction = number(quota.get("remainingFraction"))
        if fraction is None or not 0 <= fraction <= 1:
            continue
        name = (config.get("label") or config.get("modelLabel")
                or (config.get("modelOrAlias") or {}).get("model"))
        # Nome de modelo é dado do serviço; sem nome, o rótulo é texto nosso e vai com
        # identificador, porque rótulo fica no cache e é exibido pelo identificador.
        tem_nome = bool(name)
        label = text(name, i18n._f(i18n._("Model {number}"), number=index + 1))
        # O id técnico **não** sai do rótulo: rótulo é texto e muda com o idioma, enquanto o id é
        # o que decide o que é a mesma métrica entre duas leituras (`detected_change`). Antes,
        # sem nome de modelo, a mesma cota era `model:Modelo 1` em português e `model:Model 1` em
        # inglês: trocar o idioma escondia o aumento de consumo. O id vem do dado bruto da
        # configuração e, sem ele, da posição do modelo na resposta.
        bruto = text((config.get("modelOrAlias") or {}).get("model"), "")
        rotulo = text(name, "")
        out.append(metric("model:" + (bruto or rotulo or str(index + 1)), label, "quota",
                          percent=(1 - fraction) * 100,
                          reset=quota.get("resetTime"),
                          label_id=None if tem_nome else i18n.N_("Model {number}"),
                          label_args=None if tem_nome else {"number": index + 1},
                          aliases=(legacy_named_model_ids(rotulo, bruto) if tem_nome
                                   else legacy_model_ids(index + 1))))
    return out


def legacy_model_ids(numero):
    """Ids que este projeto **já gravou** para um modelo sem nome, em cada idioma do catálogo.

    Enquanto o id saía do rótulo, o mesmo modelo virava ``model:Modelo 1`` em pt_BR e
    ``model:Model 1`` em inglês. Eles seguem em ``id_aliases`` para a primeira leitura depois da
    correção continuar sendo comparada com o histórico que já está no disco de quem atualiza — os
    ids vêm do catálogo (não escritos à mão), então acompanham qualquer idioma que ele traduza.
    """
    msgid = i18n.N_("Model {number}")
    return ["model:" + i18n._f(i18n._t(msgid, code), number=numero) for code in i18n.LANGUAGES]


def legacy_named_model_ids(rotulo, bruto):
    """Ids que este projeto **já gravou** para um modelo nomeado, quando o rótulo virava id.

    Modelo com nome também teve o id montado do rótulo (``model:Display Model``) enquanto o dado
    bruto da resposta traz outro nome (``model:backend-model``): o id saía do rótulo, que é o
    primeiro campo não vazio entre ``label``, ``modelLabel`` e ``modelOrAlias.model``. Aqui o
    rótulo do serviço é dado da resposta — não texto traduzido —, então o id antigo é o próprio
    rótulo, e é ele que entra em ``id_aliases`` para a comparação com o histórico já no disco.
    """
    if not rotulo or "model:" + rotulo == "model:" + bruto:
        return None
    return ["model:" + rotulo]


def local_server_processes():
    """Processos deste usuário que podem hospedar o servidor local do Antigravity.

    Devolve ``(pid, opções)`` na ordem em que os processos aparecem, lendo só os argumentos
    em memória — o token CSRF nunca é impresso. É o único ponto do conector que olha a tabela
    de processos da máquina; fica numa função para um harness de evidência poder substituí-la
    e obter uma coleta determinística, sem depender de haver uma IDE aberta.
    """
    for directory in Path("/proc").glob("[0-9]*"):
        try:
            if directory.stat().st_uid != os.getuid():
                continue
            args = directory.joinpath("cmdline").read_bytes().decode(errors="replace").split("\0")
            if not args or "language_server" not in args[0] or "antigravity" not in " ".join(args).lower():
                continue
            opts = {}
            for i, arg in enumerate(args):
                if arg.startswith("--"):
                    k, sep, val = arg.partition("=")
                    opts[k] = val if sep else (args[i+1] if i+1 < len(args) else "")
            yield directory.name, opts
        except OSError:
            continue


def antigravity(config=None):
    # Read only this user's process arguments in memory; never print CSRF tokens.
    candidate = None
    for pid, opts in local_server_processes():
        if opts.get("--csrf_token"):
            candidate = (pid, opts); break
    if not candidate:
        raise Unavailable(i18n.N_("Open Antigravity to consult the local quotas."))
    pid, opts = candidate
    ports = set()
    if shutil.which("ss"):
        result = subprocess.run(["ss", "-tlnpH"], capture_output=True, text=True, timeout=3)
        for line in result.stdout.splitlines():
            if re.search(r"pid="+pid+r"\b", line):
                parts = line.split()
                if len(parts)>3:
                    port = parts[3].rsplit(":",1)[-1]
                    if port.isdigit(): ports.add(int(port))
    if opts.get("--extension_server_port", "").isdigit():
        ports.add(int(opts["--extension_server_port"]))
    headers = {"X-Codeium-Csrf-Token": opts["--csrf_token"], "Connect-Protocol-Version": "1"}
    body = {"metadata": {"ideName": "antigravity", "extensionName": "antigravity", "locale": "pt-BR", "ideVersion": "unknown"}}
    deadline = time.monotonic()+18
    for port in sorted(ports)[:6]:
        for scheme in ("https", "http"):
            if time.monotonic() > deadline:
                break
            base = f"{scheme}://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/"
            try:
                request(base+"GetUnleashData", data={}, headers=headers, local=True, timeout=1)
            except Unavailable:
                continue
            for method in ("GetUserStatus", "GetCommandModelConfigs"):
                try:
                    metrics = parse_antigravity(request(base+method, data=body, headers=headers, local=True, timeout=3))
                    if metrics:
                        return service("antigravity",
                                       source_id=i18n.N_("Antigravity · local server (experimental)"),
                                       metrics=metrics, identity="antigravity:"+pid)
                except Unavailable:
                    continue
    raise Unavailable(i18n.N_("Local server found, but it did not return recognized quotas."))


def meta_login_path(config=None):
    """Arquivo de login do Muse Code, na mesma ordem que o próprio cliente usa.

    O cliente resolve ``$MUSE_AUTH_PATH`` e, sem ele, ``$XDG_CONFIG_HOME/muse/auth.json`` ou
    ``$HOME/.config/muse/auth.json`` (regra lida no script do launcher dentro do binário).
    ``token_files.meta`` na configuração tem precedência sobre tudo.
    """
    declared = ((config or {}).get("token_files") or {}).get("meta")
    if declared:
        return Path(os.path.expanduser(str(declared)))
    if os.environ.get("MUSE_AUTH_PATH"):
        return Path(os.path.expanduser(os.environ["MUSE_AUTH_PATH"]))
    base = os.environ.get("XDG_CONFIG_HOME") or str(Path.home()/".config")
    return Path(base)/"muse"/"auth.json"


def meta_interval(config=None):
    """Intervalo mínimo entre chamadas de assinatura, em segundos (300 s a 24 h)."""
    value = number(((config or {}).get("meta") or {}).get("min_interval_seconds"))
    return max(300, min(86400, value)) if value else META_MIN_INTERVAL


def quota_cache_path(name):
    cache = os.environ.get("XDG_CACHE_HOME") or str(Path.home()/".cache")
    return Path(cache)/"cinnamon-ai-usage"/f"{name}.json"


def quota_cache(name, identity):
    """Conteúdo do cache privado do serviço, quando for da mesma conta."""
    data = read_json(quota_cache_path(name))
    if not isinstance(data, dict) or data.get("identity") != identity:
        return None
    return data


def quota_age(value):
    """Idade, em segundos, de um carimbo ISO; ``None`` quando o valor não serve."""
    if not isinstance(value, str):
        return None
    try:
        return (datetime.now(timezone.utc)
                - datetime.fromisoformat(value.replace("Z", "+00:00"))).total_seconds()
    except ValueError:
        return None


def quota_reuse(name, interval, identity):
    """Leitura anterior reaproveitável, com o desfecho da última tentativa.

    Devolve ``{"read_at", "metrics", "failure"}`` quando existe leitura boa da mesma conta
    dentro do intervalo mínimo; ``failure`` é a mensagem da última tentativa malsucedida, ou
    ``None`` quando a última tentativa terminou bem. Devolve ``None`` quando não há leitura a
    reaproveitar (ou o intervalo já passou).

    A validade é medida pela última **tentativa**, não só pela última leitura boa: depois de um
    erro (HTTP 429, por exemplo) a tentativa fica registrada e o intervalo mínimo continua
    valendo. Antes, uma tentativa falha não atualizava o controle, e a coleta automática repetia
    a chamada a cada dois minutos — agravando exatamente o bloqueio que o intervalo evita.
    """
    data = quota_cache(name, identity)
    if not data:
        return None
    metrics, read_at = data.get("metrics"), data.get("read_at")
    if not isinstance(metrics, list) or not metrics or not isinstance(read_at, str):
        return None
    age = quota_age(data.get("attempted_at") or read_at)
    if age is None or age >= interval:
        return None
    falha, falha_id, falha_args = None, None, {}
    if data.get("attempt_status") == "failure":
        # O desfecho da última tentativa sobrevive à leitura reaproveitada: sem ele, o coletor
        # classificava a leitura preservada como "atualização pendente" e a falha desaparecia
        # da tela sem o serviço ter voltado. O texto sai traduzido no idioma da coleta e o
        # msgid vai junto, porque quem mostrar isso amanhã pode estar em outro idioma.
        falha = text(data.get("attempt_message"), i18n._(QUOTA_FAILURE_MESSAGE), 200)
        falha_id = data.get("attempt_message_id") or None
        falha_args = data.get("attempt_message_args")
        if not isinstance(falha_args, dict):
            falha_args = {}
    return {"read_at": read_at, "metrics": metrics, "failure": falha,
            "failure_id": falha_id, "failure_args": falha_args}


def quota_read_cache(name, interval, identity):
    """Leitura anterior do serviço, se for da mesma conta e ainda válida."""
    cached = quota_reuse(name, interval, identity)
    return (cached["read_at"], cached["metrics"]) if cached else None


def quota_attempt_recent(name, interval, identity):
    """True quando já houve tentativa dentro do intervalo (mesmo sem leitura boa)."""
    data = quota_cache(name, identity)
    if not data:
        return False
    age = quota_age(data.get("attempted_at") or data.get("read_at"))
    return age is not None and age < interval


def _write_quota_cache(name, identity, read_at, metrics, attempted_at, attempt_status,
                       attempt_message, attempt_message_id=None, attempt_message_args=None):
    path = quota_cache_path(name)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        os.chmod(path.parent, 0o700)
        fd, temp = tempfile.mkstemp(prefix=f".{name}-", dir=path.parent)
        with os.fdopen(fd, "w") as f:
            json.dump({"read_at": read_at, "identity": identity, "metrics": metrics,
                       "attempted_at": attempted_at, "attempt_status": attempt_status,
                       "attempt_message": attempt_message,
                       "attempt_message_id": attempt_message_id,
                       "attempt_message_args": attempt_message_args}, f)
            f.flush(); os.fsync(f.fileno())
        os.chmod(temp, 0o600)
        os.replace(temp, path)
    except OSError:
        pass


def quota_mark_attempt(name, identity):
    """Carimba a tentativa antes da chamada, preservando a última leitura boa.

    É este carimbo que faz o intervalo mínimo valer depois de falhas: sem ele, três tentativas
    seguidas produziam três chamadas. O desfecho fica ``pending`` até a chamada responder; é
    ``quota_mark_failure`` que registra a falha.
    """
    data = quota_cache(name, identity) or {}
    metrics = data.get("metrics") if isinstance(data.get("metrics"), list) else []
    read_at = data.get("read_at") if isinstance(data.get("read_at"), str) else None
    _write_quota_cache(name, identity, read_at, metrics, stamp(), "pending", None)


def quota_mark_failure(name, identity, message, message_args=None):
    """Registra o desfecho malsucedido da tentativa, sem apagar a última leitura boa.

    Sem este registro, a etapa seguinte reaproveitava a leitura anterior como ``ok`` e o
    coletor a reclassificava como leitura vencida — a falha saía da tela sem o serviço ter
    voltado a responder. ``message`` é o msgid: o texto é gravado traduzido, e o
    identificador fica ao lado para a leitura reaproveitada poder reaparecer em outro idioma.
    """
    data = quota_cache(name, identity) or {}
    metrics = data.get("metrics") if isinstance(data.get("metrics"), list) else []
    read_at = data.get("read_at") if isinstance(data.get("read_at"), str) else None
    ident = text(message, QUOTA_FAILURE_MESSAGE, 200) or QUOTA_FAILURE_MESSAGE
    args = dict(message_args or {})
    _write_quota_cache(name, identity, read_at, metrics, stamp(), "failure",
                       text(i18n._f(i18n._(ident), **args), limit=200),
                       attempt_message_id=ident, attempt_message_args=args)


def quota_reused_service(name, cached, source_id, identity, message=None, message_id=None):
    """Serviço a partir da leitura reaproveitada, com o estado real da última tentativa.

    O texto veio do cache, então vai com o identificador: a interface reescreve no idioma em
    vigor em vez de repetir a frase no idioma em que a leitura foi feita.
    """
    if cached.get("failure"):
        result = service(name, "stale", source_id=source_id, metrics=cached["metrics"],
                         identity=identity, message=cached["failure"],
                         message_id=cached.get("failure_id") or None,
                         message_args=cached.get("failure_args") or None)
        result["stale_reason"] = "failure"
    else:
        result = service(name, source_id=source_id, metrics=cached["metrics"], identity=identity,
                         message_id=message_id)
        if message_id is None:
            result["message"] = text(message or "", limit=200)
    # Horário real da leitura: frescor não se inventa.
    result["read_at"] = cached["read_at"]
    return result


def quota_write_cache(name, identity, read_at, metrics):
    """Guarda a última leitura em arquivo privado; só o digest da conta, nunca o token."""
    _write_quota_cache(name, identity, read_at, metrics, stamp(), "ok", None)


def quota_deferred(interval):
    """Erro honesto para a consulta adiada pelo intervalo mínimo, sem repetir a chamada."""
    minutos = max(1, round(interval/60))
    return Unavailable(
        i18n.N_("Consultation deferred: there was already an attempt in the last {minutes} min "
                "and the minimum interval between calls has not passed yet; the previous reading "
                "is kept."), "unavailable", {"minutes": minutos})


def meta_cache_path():
    return quota_cache_path("meta")


def meta_read_cache(config, identity):
    """Leitura anterior da assinatura, reaproveitável dentro do intervalo mínimo."""
    return quota_reuse("meta", meta_interval(config), identity)


def meta_write_cache(identity, read_at, metrics):
    quota_write_cache("meta", identity, read_at, metrics)


def parse_meta(payload):
    """As duas janelas da assinatura Muse Code.

    ``subs_usage.window`` traz ``used_percent`` inteiro, ``window_duration_mins`` e
    ``resets_at`` em epoch; ``weekly`` traz ``used_percent`` e ``resets_at``. A Meta avisa que
    o percentual pode passar de 100: a barra vai até 100 e a nota do serviço informa o valor
    relatado. Percentual ausente não vira zero, e nada aqui é teto de cobrança por uso — é a
    assinatura do aplicativo.
    """
    usage = payload.get("subs_usage") or {}
    out = []
    window = usage.get("window") or {}
    percent = number(window.get("used_percent"))
    if percent is not None:
        minutes = number(window.get("window_duration_mins"))
        label_id, label_args = i18n.N_("Current window"), {}
        if minutes:
            label_id, label_args = i18n.N_("Window of {hours} h"), {"hours": window_hours(minutes)}
        out.append(metric("janela", label_id=label_id, label_args=label_args, kind="quota",
                          percent=percent,
                          window=int(minutes*60) if minutes and minutes > 0 else None,
                          reset=window.get("resets_at")))
    weekly = usage.get("weekly") or {}
    percent = number(weekly.get("used_percent"))
    if percent is not None:
        out.append(metric("semanal", label_id=i18n.N_("Week"), kind="quota", percent=percent,
                          window=604800, reset=weekly.get("resets_at")))
    return out


def meta_note_args(payload):
    """Trechos opcionais da nota da assinatura, como **dados**.

    Plano e aviso de percentual acima de 100% existem ou não conforme a resposta, então cada um é
    um trecho com identificador próprio dentro de ``{details}``, com os valores **crus** ao lado:
    o plano é dado do serviço e o percentual é número cru, escrito pelo idioma em vigor na hora de
    mostrar. Montar a frase já traduzida aqui prendia a nota ao idioma da coleta — a mesma leitura
    exibida em inglês mostrava "Plano: Pro. A Meta relatou 125,5% de uso" (docs/i18n.md).
    """
    usage = payload.get("subs_usage") or {}
    partes = []
    plano = text(payload.get("subs_tier_name"), "")
    if plano:
        partes.append(note_part(i18n.N_("Plan: {plan}."), {"plan": plano}))
    relatado = [number((usage.get(k) or {}).get("used_percent")) for k in ("window", "weekly")]
    acima = [p for p in relatado if p is not None and p > 100]
    if acima:
        partes.append(note_part(
            i18n.N_("Meta reported {percent}% usage; the applet bar stops at 100%."),
            {"percent": max(acima)}))
    return {"details": partes}


def meta_message(payload):
    """Nota pública do serviço no idioma em vigor: plano, aviso acima de 100% e origem do dado.

    É o texto (recurso de quem não tem catálogo nenhum); o identificador da mesma frase é
    ``META_NOTE_ID``, e é ele que fica no registro, ao lado do texto.
    """
    return i18n._f(i18n._(META_NOTE_ID), **meta_note_args(payload))


def meta(config=None):
    config = config or {}
    path = meta_login_path(config)
    token = credentials.oauth_token("meta", {"token_files": {"meta": str(path)}})
    if not token:
        raise Unavailable(i18n.N_("Muse Code login not found; run `muse login` to read the Meta "
                                  "subscription."), "unconfigured")
    identity = hashlib.sha256(token.encode()).hexdigest()
    source_id = i18n.N_("Muse Code · Meta subscription")
    interval = meta_interval(config)
    cached = meta_read_cache(config, identity)
    if cached:
        return quota_reused_service(
            "meta", cached, source_id, identity,
            message_id=i18n.N_("Reading reused; the subscription is queried respecting a "
                               "minimum interval between calls."))
    if quota_attempt_recent("meta", interval, identity):
        # A tentativa anterior (mesmo sem leitura boa) ainda está dentro do intervalo: não
        # repetir a chamada é o ponto do intervalo mínimo.
        raise quota_deferred(interval)
    quota_mark_attempt("meta", identity)
    try:
        payload = request(META_KEY_URL, token, data={}, headers={"x-client-id": "tbh:tui"})
    except Unavailable as error:
        quota_mark_failure("meta", identity, str(error),
                           getattr(error, "message_args", None))
        raise
    read_at = stamp()
    metrics = parse_meta(payload)
    if not metrics:
        # Mesma regra do Claude: resposta sem os percentuais é tentativa falha registrada, e não
        # uma leitura boa que reaparece como "atualização pendente" na rodada seguinte.
        erro = Unavailable(i18n.N_("Meta answered without the subscription percentages; run "
                                   "`diag meta` and report the result on GitHub to adjust the "
                                   "connector."), "error")
        quota_mark_failure("meta", identity, str(erro),
                           getattr(erro, "message_args", None))
        raise erro
    meta_write_cache(identity, read_at, metrics)
    # O texto é o recurso de quem não tem catálogo; o identificador é o que a interface usa, e os
    # dois seguem no registro (docs/i18n.md).
    return service("meta", source_id=source_id, metrics=metrics, identity=identity,
                   message=meta_message(payload), message_id=META_NOTE_ID,
                   message_args=meta_note_args(payload))


def claude_login_path(config=None):
    """Arquivo de credenciais do Claude Code, na ordem publicada pela Anthropic.

    ``token_files.claude`` na configuração tem precedência; depois ``$CLAUDE_CONFIG_DIR`` +
    ``/.credentials.json`` (usado por quem roda mais de uma conta) e por fim
    ``~/.claude/.credentials.json``. No macOS o login vive no Keychain e não é lido aqui.
    """
    declared = ((config or {}).get("token_files") or {}).get("claude")
    if declared:
        return Path(os.path.expanduser(str(declared)))
    base = os.environ.get("CLAUDE_CONFIG_DIR")
    if base:
        return Path(os.path.expanduser(base))/".credentials.json"
    return Path.home()/".claude"/".credentials.json"


def claude_interval(config=None):
    """Intervalo mínimo entre consultas de assinatura, em segundos (120 s a 24 h)."""
    value = number(((config or {}).get("claude") or {}).get("min_interval_seconds"))
    return max(120, min(86400, value)) if value else CLAUDE_MIN_INTERVAL


# Janelas conhecidas da assinatura, por tipo: identificador do contrato, msgid do rótulo,
# argumentos do rótulo e duração em segundos. O rótulo vai por identificador porque fica no cache.
CLAUDE_WINDOWS = {"session": ("janela", i18n.N_("Window of {hours} h"), {"hours": 5}, 18000),
                  "weekly_all": ("semanal", i18n.N_("Week"), {}, 604800),
                  # A janela por modelo monta o próprio rótulo (``Week · {model}``); este é a
                  # mesma janela sem o modelo.
                  "weekly_scoped": ("semanal:", i18n.N_("Week"), {}, 604800)}

# Objetos planos da resposta, com a janela de cada tipo.
CLAUDE_FLAT_WINDOWS = (("five_hour", "session"), ("seven_day", "weekly_all"))


def parse_claude(payload):
    """As janelas da assinatura do Claude Code, em duas formas conhecidas.

    A resposta traz os objetos planos ``five_hour`` e ``seven_day`` (que passaram a vir nulos)
    e a lista ``limits``, em que cada entrada se descreve com ``kind``, ``percent`` e
    ``resets_at`` — a forma viva segundo os projetos que acompanham a CLI. Só entra o que vem
    com percentual numérico: entrada desconhecida é ignorada, nunca convertida em zero. O
    percentual é usado como veio, na escala 0–100 relatada pela Anthropic; a escala observada
    aparece no diagnóstico, e um valor fracionário seria sub-relatado, não inflado.
    """
    found = {}
    for key, kind in CLAUDE_FLAT_WINDOWS:
        part = payload.get(key)
        if isinstance(part, dict) and number(part.get("utilization")) is not None:
            id_, label_id, label_args, window = CLAUDE_WINDOWS[kind]
            found[id_] = metric(id_, label_id=label_id, label_args=label_args, kind="quota",
                                percent=part["utilization"], window=window,
                                reset=part.get("resets_at"))
    for entry in payload.get("limits") or []:
        if not isinstance(entry, dict):
            continue
        kind = str(entry.get("kind") or "").lower()
        percent = number(entry.get("percent") if number(entry.get("percent")) is not None
                         else entry.get("utilization"))
        if not kind or percent is None or kind not in CLAUDE_WINDOWS:
            continue
        id_, label_id, label_args, window = CLAUDE_WINDOWS[kind]
        if kind == "weekly_scoped":
            model = text(((entry.get("scope") or {}).get("model") or {}).get("display_name"), "")
            if not model:
                continue  # janela por modelo sem nome: não inventar rótulo
            id_, window = f"semanal:{model}", 604800
            # O nome do modelo é dado; a frase que o junta à janela é msgid, e o modelo, argumento.
            label_id, label_args = i18n.N_("Week · {model}"), {"model": model}
        found[id_] = metric(id_, label_id=label_id, label_args=label_args, kind="quota",
                            percent=percent, window=window, reset=entry.get("resets_at"))
    return list(found.values())


def claude_note_args(oauth):
    """Trechos opcionais da nota: plano e tier do login, como dados e por identificador."""
    plano = text(oauth.get("subscriptionType"), "") if isinstance(oauth, dict) else ""
    tier = text(oauth.get("rateLimitTier"), "") if isinstance(oauth, dict) else ""
    if plano and tier:
        partes = [note_part(i18n.N_("Plan: {plan} · {tier}."), {"plan": plano, "tier": tier})]
    elif plano or tier:
        partes = [note_part(i18n.N_("Plan: {plan}."), {"plan": plano or tier})]
    else:
        partes = []
    return {"details": partes}


def claude_message(payload, oauth):
    """Nota pública do serviço no idioma em vigor: o que é a assinatura, plano e origem.

    O identificador da mesma frase é ``CLAUDE_NOTE_ID``; é ele que fica no registro.
    """
    return i18n._f(i18n._(CLAUDE_NOTE_ID), **claude_note_args(oauth))


def claude(config=None):
    config = config or {}
    path = claude_login_path(config)
    oauth = read_json(path).get("claudeAiOauth")
    oauth = oauth if isinstance(oauth, dict) else {}
    token = credentials.oauth_token("claude", {"token_files": {"claude": str(path)}})
    if not token:
        raise Unavailable(i18n.N_("Claude Code login not found; run `claude` and use /login."),
                          "unconfigured")
    # O token vale cerca de uma hora e é a própria CLI que o renova; o applet nunca renova
    # credencial, então um token vencido vira aviso, e não uma consulta condenada a falhar.
    expires = number(oauth.get("expiresAt"))
    if expires:
        segundos = expires/1000 if expires > 1e11 else expires
        if segundos < time.time():
            raise Unavailable(i18n.N_("Claude Code token expired; run `claude` to renew the "
                                      "session (the applet does not renew credentials)."),
                              "unconfigured")
    identity = hashlib.sha256(token.encode()).hexdigest()
    source_id = i18n.N_("Claude Code · subscription (not verified)")
    interval = claude_interval(config)
    cached = quota_reuse("claude", interval, identity)
    if cached:
        return quota_reused_service(
            "claude", cached, source_id, identity,
            message_id=i18n.N_("Reading reused; the route is queried respecting a minimum "
                               "interval between calls."))
    if quota_attempt_recent("claude", interval, identity):
        raise quota_deferred(interval)
    quota_mark_attempt("claude", identity)
    try:
        payload = request(CLAUDE_USAGE_URL, token, headers={"anthropic-beta": CLAUDE_BETA})
        read_at = stamp()
        metrics = parse_claude(payload)
        if not metrics:
            raise Unavailable(i18n.N_("Response without the expected windows; run `diag claude` "
                                      "and report the result on GitHub to adjust the connector."))
    except Unavailable as error:
        quota_mark_failure("claude", identity, str(error),
                           getattr(error, "message_args", None))
        raise
    quota_write_cache("claude", identity, read_at, metrics)
    return service("claude", source_id=source_id, metrics=metrics, identity=identity,
                   message=claude_message(payload, oauth), message_id=CLAUDE_NOTE_ID,
                   message_args=claude_note_args(oauth))


def describe(payload, depth=0):
    """Estrutura da resposta para diagnóstico: nomes de campos, tipos e faixa dos números.

    Nenhum valor sai daqui. O que interessa relatar é o nome do campo e se o número vem em
    0–1 ou em 0–100, a única ambiguidade capaz de estragar o percentual; texto e data são
    classificados sem reproduzir conteúdo.
    """
    if depth > 3:
        return i18n._("…")
    if isinstance(payload, dict):
        return {str(k): describe(v, depth + 1) for k, v in list(payload.items())[:40]}
    if isinstance(payload, list):
        return [describe(payload[0], depth + 1)] if payload else []
    if isinstance(payload, bool) or payload is None:
        return type(payload).__name__
    if isinstance(payload, (int, float)):
        value = float(payload)
        if value < 0:
            return i18n._("negative number")
        if value <= 1:
            return i18n._("number between 0 and 1")
        return i18n._("number between 1 and 100") if value <= 100 else i18n._("number above 100")
    if isinstance(payload, str) and re.match(r"^\d{4}-\d{2}-\d{2}T", payload):
        return i18n._("text (date and time)")
    return i18n._("text")


def claude_diag(config=None):
    """Diagnóstico do conector Claude Code, para relatar em issue sem vazar nada."""
    config = config or {}
    declared = ((config or {}).get("token_files") or {}).get("claude")
    origem = (i18n._("configuration") if declared else
              "CLAUDE_CONFIG_DIR" if os.environ.get("CLAUDE_CONFIG_DIR") else i18n._("default"))
    path = claude_login_path(config)
    report = {"origem_do_caminho": origem, "arquivo_existe": path.exists()}
    token = credentials.oauth_token("claude", {"token_files": {"claude": str(path)}})
    if not token:
        report["credencial"] = i18n._("not found")
        return report
    report["credencial"] = i18n._("found")
    oauth = read_json(path).get("claudeAiOauth")
    report["campos_do_login"] = sorted(oauth.keys()) if isinstance(oauth, dict) else []
    try:
        payload = request(CLAUDE_USAGE_URL, token, headers={"anthropic-beta": CLAUDE_BETA})
    except Unavailable as e:
        report["consulta"] = i18n._f(i18n._(str(e)), **(getattr(e, "message_args", None) or {}))
        return report
    report["consulta"] = i18n._("ok")
    report["estrutura"] = describe(payload)
    report["janelas_reconhecidas"] = [m["id"] for m in parse_claude(payload)]
    return report


META_PERCENT_FIELDS = (("subs_usage", "window", "used_percent"),
                       ("subs_usage", "weekly", "used_percent"))


def meta_fields(payload):
    """Onde cada campo esperado aparece e de que tipo — sem reproduzir valor algum.

    ``describe`` devolve a faixa de um número, nunca o número; aqui a pergunta é outra: o
    caminho que o conector procura existe nesta resposta? É isso que separa "a resposta não traz
    os percentuais" de "o campo mudou de nome ou de tipo", e é o que o relato de issue precisa
    dizer para o conector ser ajustável sem adivinhação.
    """
    achados = {}
    for caminho in META_PERCENT_FIELDS:
        atual, achado = payload, True
        for chave in caminho:
            if isinstance(atual, dict) and chave in atual:
                atual = atual[chave]
            else:
                achado = False
                break
        achados[".".join(caminho)] = (i18n._("absent") if not achado else
                                      i18n._("null") if atual is None else describe(atual))
    return achados


def meta_diag(config=None):
    """Diagnóstico do conector da assinatura da Meta, para relatar em issue sem vazar nada.

    Sem credencial não há consulta, e o relatório diz isso em vez de virar erro de rede. Com
    credencial, a consulta é a mesma rota da coleta e o relatório traz nomes de campos, tipos e
    faixa dos números — nunca valores, identificadores de conta ou caminhos desta máquina.
    """
    config = config or {}
    declared = ((config or {}).get("token_files") or {}).get("meta")
    origem = (i18n._("configuration") if declared else
              "MUSE_AUTH_PATH" if os.environ.get("MUSE_AUTH_PATH") else i18n._("default"))
    path = meta_login_path(config)
    report = {"origem_do_caminho": origem, "arquivo_existe": path.exists()}
    token = credentials.oauth_token("meta", {"token_files": {"meta": str(path)}})
    if not token:
        report["credencial"] = i18n._("not found")
        return report
    report["credencial"] = i18n._("found")
    login = read_json(path)
    report["campos_do_login"] = sorted(login.keys()) if isinstance(login, dict) else []
    try:
        payload = request(META_KEY_URL, token, data={}, headers={"x-client-id": "tbh:tui"})
    except Unavailable as e:
        report["consulta"] = i18n._f(i18n._(str(e)), **(getattr(e, "message_args", None) or {}))
        return report
    report["consulta"] = i18n._("ok")
    report["estrutura"] = describe(payload)
    report["campos_esperados"] = meta_fields(payload)
    report["janelas_reconhecidas"] = [m["id"] for m in parse_meta(payload)]
    return report


DIAGNOSTICS = {"claude": claude_diag, "meta": meta_diag}


def diagnose(id_, config=None):
    """Diagnóstico sanitizado de um serviço; há relatório apenas para quem declara um."""
    fn = DIAGNOSTICS.get(id_)
    if fn is None:
        return {"diagnostico": i18n._("no diagnostic for this service")}
    try:
        return fn(config)
    except Unavailable as e:
        return {"erro": i18n._f(i18n._(str(e)), **(getattr(e, "message_args", None) or {}))}
    except Exception:
        return {"erro": i18n._("unexpected failure in the diagnostic")}


def collect_provider(id_, config=None):
    config = config or {}
    try:
        result = globals()[id_](config)
        if not result["metrics"]:
            raise Unavailable(i18n.N_("Source did not return recognized usage metrics."))
        return result
    except Unavailable as e:
        # O identificador é o próprio msgid: um caminho só, para as 23 origens de erro
        # herdarem a tradução correta em vez de cada uma montar o texto por conta própria.
        return service(id_, e.status, message_id=str(e), message_args=e.message_args)
    except Exception:
        return service(id_, "error", message_id=i18n.N_(
            "Failed to read the service data; try refreshing."))
