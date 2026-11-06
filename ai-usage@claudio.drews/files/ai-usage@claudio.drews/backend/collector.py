#!/usr/bin/env python3
"""Bounded, concurrent read-only collection with a private atomic cache."""
from __future__ import annotations

import argparse
import copy
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
from datetime import datetime

import i18n
from providers import SERVICES, collect_provider, diagnose, number, service, stamp, metric, read_json

# Identificador do aviso de leitura vencida. É o msgid: fica gravado no snapshot junto do
# texto, e é por ele que a interface (e o `stale_warning`) sabe o que aconteceu sem depender
# do idioma em que a leitura foi feita.
PENDING_MESSAGE_ID = i18n.N_("Last reading available; refresh pending.")

# Identificador do aviso de coleta pulada. Ele não fica no cache, mas é exibido pelo painel e
# pela janela: sem identificador, o aviso sairia no idioma da coleta numa apresentação em outro.
SKIPPED_MESSAGE_ID = i18n.N_("Refresh skipped: a collection is already running; "
                             "the values are the last reading.")

# Texto que versões anteriores **gravaram no cache**, antes de existir identificador: é a
# tradução pt_BR deste mesmo msgid, e por isso sai do catálogo em vez de ficar escrita aqui —
# nenhum idioma pode ter prosa fixa no código. Não é texto de interface: serve só para
# classificar um snapshot antigo que já está no disco de quem atualiza (`stale_warning`).
LEGACY_PENDING_TEXT = i18n._t(PENDING_MESSAGE_ID, "pt_BR")


def paths():
    cache = Path(os.environ.get("XDG_CACHE_HOME", str(Path.home()/".cache"))) / "cinnamon-ai-usage"
    config = Path(os.environ.get("XDG_CONFIG_HOME", str(Path.home()/".config"))) / "cinnamon-ai-usage/config.json"
    return cache, config


def timestamp(value):
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except (AttributeError, ValueError, OverflowError):
        return 0


def empty_snapshot(message_id=i18n.N_("No reading available; refresh to query.")):
    """Snapshot sem leitura. ``message_id`` é o msgid; o texto sai no idioma da coleta e o
    identificador fica no registro, porque este snapshot também é gravado em cache."""
    return {"schema_version": 1, "generated_at": None,
            "services": [service(k, "unavailable", message_id=message_id) for k in SERVICES]}


def valid_snapshot(data):
    return isinstance(data, dict) and data.get("schema_version") == 1 and isinstance(data.get("services"), list)


def load_snapshot(path):
    data = read_json(path)
    return data if valid_snapshot(data) else empty_snapshot()


def effective_ttl(config, ttl_override=None):
    """TTL em vigor: o da consulta, senão o da configuração, senão 120 s (contrato 30–3600)."""
    ttl = number(ttl_override) or number((config or {}).get("refresh_seconds")) or 120
    return max(30, min(3600, ttl))


def stale_read(snapshot, ttl=120):
    """Leitura vencida pelo intervalo.

    O aviso vai com identificador fixo: o texto é o que a interface mostra hoje, e o
    ``stale_reason`` continua sendo o que decide o cartão — nada aqui se apoia no texto.
    """
    snapshot = copy.deepcopy(snapshot)
    for item in snapshot["services"]:
        if item.get("status") == "ok" and time.time()-timestamp(item.get("read_at")) > ttl:
            item["status"] = "stale"
            item["message"] = i18n._(PENDING_MESSAGE_ID)
            item["message_id"] = PENDING_MESSAGE_ID
            item["message_args"] = {}
            # Motivo estruturado: leitura vencida é diferente de leitura preservada após falha, e
            # a janela não pode afirmar falha onde só houve intervalo cumprido.
            item["stale_reason"] = "pending"
    return snapshot


def previous_metrics(previous):
    """Métricas da leitura anterior, indexadas por **todos** os ids que elas já tiveram.

    O id de uma métrica pode ter mudado de forma entre versões (o do Antigravity saía do rótulo
    traduzido). Aceitar os ids que a métrica declara em ``id_aliases`` é o que mantém a comparação
    com o histórico já gravado: sem isso o primeiro snapshot depois da correção pareceria trazer
    métricas novas, e um aumento de consumo real passaria em silêncio.
    """
    index = {}
    for metric in previous.get("metrics", []):
        for key in [metric.get("id")] + list(metric.get("id_aliases") or []):
            if key:
                index.setdefault(key, metric)
    return index


def detected_change(previous, current):
    if previous.get("_identity") != current.get("_identity"):
        return False
    before = previous_metrics(previous)
    for m in current.get("metrics", []):
        old = before.get(m["id"])
        if old is None:
            old = next((before[alias] for alias in (m.get("id_aliases") or [])
                        if alias in before), None)
        if not old or (old.get("kind"), old.get("currency"), old.get("window_seconds")) != (
                m.get("kind"), m.get("currency"), m.get("window_seconds")):
            continue
        if m["kind"] == "quota":
            if m.get("reset_at") != old.get("reset_at"):
                continue
            a, b = number(old.get("used_percent")), number(m.get("used_percent"))
            changed = a is not None and b is not None and b > a + 1e-6
        else:
            a, b = number(old.get("value")), number(m.get("value"))
            changed = a is not None and b is not None and (
                b < a - 1e-6 if m["kind"] == "balance" else b > a + 1e-6)
        if changed:
            return True
    return False


def merge_history(current, previous):
    previous = previous or {}
    if current["status"] != "ok":
        if current["status"] != "disabled" and previous.get("metrics"):
            # Preserve data timestamp and source: an error is not a new measurement.
            result = copy.deepcopy(previous)
            result.update(status="stale", message=current["message"], stale_reason="failure")
            # O texto vem da coleta nova, então o identificador dela é que vale: manter o da
            # leitura anterior ao lado de um texto novo faria a interface traduzir a frase
            # errada. Sem identificador, o campo some em vez de mentir.
            for campo in ("message_id", "message_args"):
                if campo in current:
                    result[campo] = current[campo]
                else:
                    result.pop(campo, None)
            return result
        return current
    if previous.get("_identity") == current.get("_identity"):
        current["last_used_at"] = previous.get("last_used_at")
        current["recency_basis"] = previous.get("recency_basis", "unknown")
        if detected_change(previous, current):
            current["last_used_at"] = current["read_at"]
            current["recency_basis"] = "observed_change"
    return current


def stale_warning(service):
    """Aviso de leitura antiga conforme o motivo real.

    Leitura vencida pelo intervalo não é falha: antes, todo cartão ``stale`` recebia "a
    atualização mais recente deste serviço falhou", inclusive quando o coletor havia dito apenas
    "atualização pendente". Vive aqui, junto do contrato, para poder ser testado sem GTK.

    O motivo vem do campo estruturado ``stale_reason``, nunca do texto: o texto é tradução, e
    tradução não é dado. Snapshots antigos, anteriores ao campo, são deduzidos pelo
    identificador; os anteriores ao identificador, pelo texto que só eles têm — a leitura
    antiga gravada em português, que é a tradução pt_BR do ``PENDING_MESSAGE_ID``
    (``LEGACY_PENDING_TEXT``), buscada no catálogo e não escrita no código.
    """
    motivo = (service.get("stale_reason") or "").strip().lower()
    if not motivo:
        ident = service.get("message_id")
        if ident == PENDING_MESSAGE_ID:
            motivo = "pending"
        elif not ident:
            texto = service.get("message") or ""
            motivo = "pending" if LEGACY_PENDING_TEXT and LEGACY_PENDING_TEXT in texto else "failure"
    if motivo == "pending":
        return i18n._("Previous reading data: the refresh interval has passed and this "
                      "service has not been read again yet.")
    return i18n._("Previous reading data: the most recent refresh of this service failed.")


def save_atomic(path, snapshot):
    fd, name = tempfile.mkstemp(prefix=".snapshot-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(snapshot, f, ensure_ascii=False, allow_nan=False)
            f.flush(); os.fsync(f.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)


def worker(id_):
    """Corpo do worker: consulta **um** serviço e devolve o veredito dele em JSON.

    É a mesma função que roda no processo filho e a que um harness pode rodar no próprio
    processo, depois de trocar as dependências externas por fixtures.
    """
    return collect_provider(id_, read_json(paths()[1]))


def launch_worker(id_):
    """Lança o worker de um serviço em processo próprio e devolve o processo.

    Ponto único de criação de processo na coleta. O filho herda ambiente e sistema de
    arquivos — é justamente esse acesso ao mundo real que um harness de evidência precisa
    poder cortar, substituindo esta função por uma que roda o corpo do worker no lugar, com
    credencial, rede e tabela de processos trocadas por fixtures.
    """
    return subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "worker", id_],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            start_new_session=True)


def collect(force=False, ttl_override=None):
    cache, config_path = paths()
    cache.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(cache, 0o700)
    path = cache/"snapshot.json"
    config = read_json(config_path)
    ttl = effective_ttl(config, ttl_override)
    lock_fd = os.open(cache/"collect.lock", os.O_CREAT | os.O_RDWR, 0o600)
    with os.fdopen(lock_fd, "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            # Outra coleta está em andamento. Isso não é falha: o snapshot sai com um aviso
            # público (``notice``) dizendo que a atualização foi ignorada, e as leituras
            # continuam sendo as últimas conhecidas. Sem o aviso, o applet e a janela não têm
            # como distinguir "pulei" de "falhei" e acabam afirmando falha que não houve.
            adiado = stale_read(load_snapshot(path), ttl)
            adiado["notice"] = i18n._(SKIPPED_MESSAGE_ID)
            adiado["notice_id"] = SKIPPED_MESSAGE_ID
            adiado["notice_args"] = {}
            return adiado
        old = load_snapshot(path)
        if not force and 0 <= time.time()-timestamp(old.get("generated_at")) < ttl:
            return stale_read(old, ttl)
        before = {s["id"]: s for s in old["services"]}
        pending, result = {}, {}
        enabled = config.get("enabled", {})
        deadline = time.monotonic()+40
        try:
            for id_ in SERVICES:
                if isinstance(enabled, dict) and enabled.get(id_) is False:
                    result[id_] = service(id_, "disabled", message_id=i18n.N_(
                        "Disabled in the configuration."))
                else:
                    pending[id_] = launch_worker(id_)
            for id_, proc in pending.items():
                try:
                    output, _ = proc.communicate(timeout=max(0.1, deadline-time.monotonic()))
                    item = json.loads(output)
                    if proc.returncode or not isinstance(item, dict) or item.get("id") != id_:
                        raise ValueError()
                    result[id_] = item
                except (subprocess.TimeoutExpired, ValueError):
                    result[id_] = service(id_, "error", message_id=i18n.N_(
                        "The query timed out or returned invalid data."))
        finally:
            for proc in pending.values():
                if proc.poll() is None:
                    # Corrida real: o worker pode terminar entre o poll e o sinal. Sem esta
                    # guarda, o ProcessLookupError sobe e a coleta inteira vira "falha ao ler
                    # configuração ou gravar o cache" — mensagem que mente sobre a causa.
                    for sig in (signal.SIGTERM, signal.SIGKILL):
                        try:
                            os.killpg(proc.pid, sig)
                        except ProcessLookupError:
                            break
                        try:
                            proc.wait(timeout=2)
                            break
                        except subprocess.TimeoutExpired:
                            continue
                if proc.stdout: proc.stdout.close()
        snapshot = {"schema_version": 1, "generated_at": stamp(),
                    "services": [merge_history(result[k], before.get(k)) for k in SERVICES]}
        # O cache guarda o estado cru (status ok com o read_at real), e a saída recebe a mesma
        # avaliação de idade que o `read` faz. Sem isto, o estado dependia do caminho: uma leitura
        # reaproveitada de dez minutos atrás saía como ok na coleta e como antiga na leitura — e
        # uma cota vencida continuava colorindo o robô.
        save_atomic(path, snapshot)
        return stale_read(snapshot, ttl)


# Forma de cada conector na demonstração. O demo não pode afirmar o que o serviço não mede:
# o Grok é pré-pago (saldo e créditos usados, sem janela de 5 h) e o OpenCode Go tem três
# janelas. Antes tudo caía no mesmo ramo e a imagem de exemplo do repositório mentia.
#
# O segundo campo é o **msgid** do rótulo (`label_id`), não o texto: rótulo entra no contrato,
# e texto que entra no contrato vai por identificador — quem mostra resolve no idioma em vigor
# sem recolher nada (docs/i18n.md, "Textos que ficam no cache").
DEMO_SHAPES = {
    "codex": [("primary", i18n.N_("5 h window"), "quota", 18000),
              ("secondary", i18n.N_("Week"), "quota", 604800)],
    "claude": [("five_hour", i18n.N_("5 h window"), "quota", 18000),
               ("seven_day", i18n.N_("Week"), "quota", 604800)],
    "meta": [("janela", i18n.N_("5 h window"), "quota", 18000),
             ("semanal", i18n.N_("Week"), "quota", 604800)],
    "opencode": [("rolling", i18n.N_("Rolling window"), "quota", None),
                 ("weekly", i18n.N_("Week"), "quota", 604800),
                 ("monthly", i18n.N_("Month"), "quota", None)],
    "antigravity": [("model:exemplo", i18n.N_("Example model"), "quota", None)],
    "grok": [("balance:USD", i18n.N_("API prepaid balance"), "balance", None),
             ("credits_used", i18n.N_("Prepaid credits used"), "quota", None)],
    "nous": [("total_usable_credits", i18n.N_("Total available balance"), "balance", None),
             ("subscription_credits_remaining", i18n.N_("Plan balance"), "balance", None)],
    "deepseek": [("balance:USD", i18n.N_("Available balance"), "balance", None)],
    "openrouter": [("usage_monthly", i18n.N_("Monthly spend"), "spend", None)],
}


def demo():
    items = []
    for i, id_ in enumerate(SERVICES):
        metrics = []
        for position, (metric_id, label_id, kind, window) in enumerate(DEMO_SHAPES.get(id_, [])):
            if kind in ("balance", "spend"):
                # Valores nitidamente sintéticos: nada que possa ter vindo de uma resposta real.
                metrics.append(metric(metric_id, kind=kind, label_id=label_id,
                                      value=5.75 + i + position, currency="USD"))
                continue
            metrics.append(metric(metric_id, kind="quota", label_id=label_id,
                                  percent=min(92, 12 + i * 7 + position * 9), window=window,
                                  reset=time.time() + window / 3 if window else None))
        item = service(id_, source_id=i18n.N_("Simulation — no real data"), metrics=metrics)
        item.update(last_used_at=stamp(time.time()-i*900), recency_basis="observed_change")
        items.append(item)
    return {"schema_version": 1, "generated_at": stamp(), "demo": True, "services": items}


def public(snapshot):
    snapshot = copy.deepcopy(snapshot)
    for item in snapshot.get("services", []):
        item.pop("_identity", None)
    return snapshot


def main():
    i18n.activate()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", nargs="?", default="collect",
                        choices=["collect", "read", "demo", "worker", "diag"])
    parser.add_argument("provider", nargs="?", choices=list(SERVICES))
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--ttl", type=int, help=i18n._("TTL for this query, in seconds"))
    args = parser.parse_args()
    if args.command == "worker":
        if not args.provider:
            parser.error(i18n._("worker requires a provider"))
        def timed_out(*_):
            raise TimeoutError()
        signal.signal(signal.SIGALRM, timed_out)
        signal.signal(signal.SIGTERM, timed_out)
        signal.alarm(30)
        result = worker(args.provider)
    elif args.command == "diag":
        if not args.provider:
            parser.error(i18n._("diag requires a provider"))
        result = diagnose(args.provider, read_json(paths()[1]))
    elif args.command == "demo":
        result = demo()
    elif args.command == "read":
        # Mesma janela de validade do collect: ler o cache com TTL fixo marcava como antiga
        # uma leitura que a configuração do applet ainda considera boa (contrato).
        result = public(stale_read(load_snapshot(paths()[0]/"snapshot.json"),
                                   effective_ttl(read_json(paths()[1]))))
    else:
        try:
            signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
            result = public(collect(args.force, args.ttl))
        except (OSError, ValueError, TypeError):
            result = empty_snapshot(message_id=i18n.N_(
                "Failed to read the configuration or write the local cache."))
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))


if __name__ == "__main__":
    main()
