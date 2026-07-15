"""High-level Codex Monitor operations."""

from __future__ import annotations

import copy
from datetime import date
import time

from .models import normalize_snapshot
from .sessions import normalize_session_list


class CodexService:
    def __init__(
        self,
        client,
        history,
        *,
        remote=None,
        launcher=None,
        updates=None,
        clock=time.time,
    ):
        self.client = client
        self.history = history
        self.remote = remote
        self.launcher = launcher
        self.updates = updates
        self.clock = clock
        self._notification_probe_complete = False

    def snapshot(self):
        captured_at = int(self.clock())
        account_response = self.client.request("account/read", {"refreshToken": False})
        limits_response = self.client.request("account/rateLimits/read")
        limits_response = self._merge_latest_rate_limits(limits_response)
        snapshot = normalize_snapshot(limits_response, captured_at=captured_at)
        snapshot["account"] = self._normalize_account(account_response.get("account"))

        token_usage = None
        activity_available = True
        try:
            token_usage = self._normalize_token_usage(
                self.client.request("account/usage/read")
            )
        except RuntimeError as error:
            if "(-32601)" not in str(error):
                raise
            activity_available = False

        snapshot["tokenUsage"] = token_usage
        snapshot["capabilities"] = {
            "activity": activity_available,
            "resetCredits": "rateLimitResetCredits" in limits_response,
        }
        if self.history is not None:
            self.history.append(snapshot, now=captured_at)
            snapshot["history"] = self.history.load(now=captured_at)
        else:
            snapshot["history"] = []
        return snapshot

    def consume_reset(self, credit_id, idempotency_key):
        return self.client.request(
            "account/rateLimitResetCredit/consume",
            {"creditId": credit_id, "idempotencyKey": idempotency_key},
        )

    def sessions(self, limit=12):
        response = self.client.request(
            "thread/list",
            {"limit": limit, "sortKey": "updated_at", "sortDirection": "desc"},
        )
        return normalize_session_list(response, limit=limit)

    def open_codex(self):
        return self._require_launcher().open_codex()

    def open_session(self, thread_id, cwd=None):
        return self._require_launcher().open_session(thread_id, cwd)

    def remote_status(self):
        return self._require_remote().status()

    def remote_start(self):
        return self._require_remote().start()

    def remote_stop(self):
        return self._require_remote().stop()

    def remote_pair_start(self):
        return self._require_remote().pair_start()

    def remote_pair_status(self, pairing_code, manual_pairing_code=None):
        return self._require_remote().pair_status(pairing_code, manual_pairing_code)

    def remote_clients(self, environment_id):
        return self._require_remote().clients(environment_id)

    def remote_revoke(self, environment_id, client_id):
        return self._require_remote().revoke(environment_id, client_id)

    def update_status(self):
        return self._require_updates().status()

    def update_check(self, force=False):
        return self._require_updates().check(force=force)

    def update_start(self):
        return self._require_updates().start()

    def _require_remote(self):
        if self.remote is None:
            raise RuntimeError("Codex remote control is unavailable")
        return self.remote

    def _require_launcher(self):
        if self.launcher is None:
            raise RuntimeError("Codex terminal launcher is unavailable")
        return self.launcher

    def _require_updates(self):
        if self.updates is None:
            raise RuntimeError("Codex update management is unavailable")
        return self.updates

    def _merge_latest_rate_limits(self, response):
        wait = getattr(self.client, "wait_for_notification", None)
        if wait is None:
            return response
        timeout = 0 if self._notification_probe_complete else 1.0
        self._notification_probe_complete = True
        params = wait("account/rateLimits/updated", timeout_seconds=timeout)
        update = params.get("rateLimits") if isinstance(params, dict) else None
        if not isinstance(update, dict):
            return response

        merged = copy.deepcopy(response)
        base = merged.get("rateLimits")
        base_id = base.get("limitId") if isinstance(base, dict) else None
        update_id = update.get("limitId")
        if update_id is None or base_id is None or update_id == base_id:
            merged["rateLimits"] = self._merge_non_null(base, update)
        buckets = merged.get("rateLimitsByLimitId")
        if isinstance(buckets, dict) and isinstance(update_id, str):
            for key, bucket in buckets.items():
                if key == update_id or (
                    isinstance(bucket, dict) and bucket.get("limitId") == update_id
                ):
                    buckets[key] = self._merge_non_null(bucket, update)
        return merged

    @classmethod
    def _merge_non_null(cls, base, update):
        result = copy.deepcopy(base) if isinstance(base, dict) else {}
        for key, value in update.items():
            if value is None:
                continue
            if isinstance(value, dict) and isinstance(result.get(key), dict):
                result[key] = cls._merge_non_null(result[key], value)
            else:
                result[key] = copy.deepcopy(value)
        return result

    @staticmethod
    def _normalize_account(account):
        if not isinstance(account, dict):
            return None
        account_type = account.get("type")
        if (
            not isinstance(account_type, str)
            or not account_type
            or len(account_type) > 64
        ):
            return None
        normalized: dict[str, object] = {"type": account_type}
        if account_type == "chatgpt":
            plan_type = account.get("planType")
            normalized["planType"] = (
                plan_type
                if isinstance(plan_type, str) and 0 < len(plan_type) <= 64
                else None
            )
        return normalized

    @staticmethod
    def _normalize_token_usage(value):
        if not isinstance(value, dict):
            return None
        buckets = []
        for raw in value.get("dailyUsageBuckets") or []:
            if not isinstance(raw, dict):
                continue
            start_date = raw.get("startDate")
            tokens = raw.get("tokens")
            if (
                not isinstance(start_date, str)
                or isinstance(tokens, bool)
                or not isinstance(tokens, (int, float))
            ):
                continue
            try:
                normalized_date = date.fromisoformat(start_date).isoformat()
                normalized_tokens = max(0, int(tokens))
            except (OverflowError, TypeError, ValueError):
                continue
            buckets.append(
                {"startDate": normalized_date, "tokens": normalized_tokens}
            )
        return {
            "summary": {},
            "dailyUsageBuckets": buckets,
        }
