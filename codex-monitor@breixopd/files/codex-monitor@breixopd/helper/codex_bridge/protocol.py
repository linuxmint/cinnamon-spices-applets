"""Validated JSONL command protocol exposed to the Cinnamon applet."""

from __future__ import annotations

import uuid

from .remote import RemoteDaemonStuckError


def _error(request_id, code, message, *, retryable=False):
    return {
        "id": request_id,
        "ok": False,
        "error": {"code": code, "message": message, "retryable": retryable},
    }


class CommandRouter:
    def __init__(self, service):
        self.service = service

    def handle(self, request):
        request_id = request.get("id") if isinstance(request, dict) else None
        if not isinstance(request_id, str) or not request_id or len(request_id) > 128:
            return _error(None, "INVALID_REQUEST", "Invalid request identifier")

        action = request.get("action")
        params = request.get("params", {})
        if not isinstance(params, dict):
            return _error(request_id, "INVALID_PARAMS", "Invalid action parameters")

        try:
            if action == "snapshot":
                if params:
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid snapshot parameters"
                    )
                data = self.service.snapshot()
            elif action == "sessions":
                if set(params) - {"limit"}:
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid session-list parameters"
                    )
                limit = params.get("limit", 12)
                if (
                    not isinstance(limit, int)
                    or isinstance(limit, bool)
                    or not 1 <= limit <= 50
                ):
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid session-list parameters"
                    )
                data = self.service.sessions(limit)
            elif action == "open_codex":
                if params:
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid Codex launch parameters"
                    )
                data = self.service.open_codex()
            elif action == "open_session":
                if set(params) - {"threadId", "cwd"}:
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid session launch parameters",
                    )
                thread_id = params.get("threadId")
                cwd = params.get("cwd")
                if not self._valid_uuid(thread_id) or not self._valid_optional_path(cwd):
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid session launch parameters",
                    )
                data = self.service.open_session(thread_id, cwd)
            elif action == "consume_reset":
                if set(params) - {"creditId", "idempotencyKey", "confirmed"}:
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid reset-credit parameters",
                    )
                credit_id = params.get("creditId")
                idempotency_key = params.get("idempotencyKey")
                if not self._valid_credit_id(credit_id) or not self._valid_uuid(
                    idempotency_key
                ):
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid reset-credit parameters"
                    )
                if params.get("confirmed") is not True:
                    return _error(
                        request_id,
                        "CONFIRMATION_REQUIRED",
                        "Explicit confirmation is required",
                    )
                data = self.service.consume_reset(credit_id, idempotency_key)
            elif action == "remote_status":
                if params:
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid Remote Control status parameters",
                    )
                data = self.service.remote_status()
            elif action == "remote_start":
                if set(params) != {"confirmed"} and params.get("confirmed") is True:
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid Remote Control start parameters",
                    )
                if params.get("confirmed") is not True:
                    return _error(
                        request_id,
                        "CONFIRMATION_REQUIRED",
                        "Explicit confirmation is required",
                    )
                data = self.service.remote_start()
            elif action == "remote_stop":
                if set(params) != {"confirmed"} and params.get("confirmed") is True:
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid Remote Control stop parameters",
                    )
                if params.get("confirmed") is not True:
                    return _error(
                        request_id,
                        "CONFIRMATION_REQUIRED",
                        "Explicit confirmation is required",
                    )
                data = self.service.remote_stop()
            elif action == "remote_repair":
                if set(params) != {"confirmed"}:
                    if params.get("confirmed") is not True:
                        return _error(
                            request_id,
                            "CONFIRMATION_REQUIRED",
                            "Explicit confirmation is required",
                        )
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid Remote Control repair parameters",
                    )
                if params.get("confirmed") is not True:
                    return _error(
                        request_id,
                        "CONFIRMATION_REQUIRED",
                        "Explicit confirmation is required",
                    )
                data = self.service.remote_repair()
            elif action == "remote_pair_start":
                if params:
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid pairing parameters"
                    )
                data = self.service.remote_pair_start()
            elif action == "remote_pair_status":
                if set(params) - {"pairingCode", "manualPairingCode"}:
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid pairing parameters"
                    )
                pairing_code = params.get("pairingCode")
                manual_code = params.get("manualPairingCode")
                if (
                    not self._valid_optional_string(pairing_code, 4096)
                    or not self._valid_optional_string(manual_code, 256)
                    or pairing_code is None
                    and manual_code is None
                ):
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid pairing parameters"
                    )
                data = self.service.remote_pair_status(pairing_code, manual_code)
            elif action == "remote_clients":
                if set(params) != {"environmentId"}:
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid Remote Control environment",
                    )
                environment_id = params.get("environmentId")
                if not self._valid_bounded_string(environment_id, 256):
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid Remote Control environment",
                    )
                data = self.service.remote_clients(environment_id)
            elif action == "remote_revoke":
                if set(params) - {"environmentId", "clientId", "confirmed"}:
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid Remote Control client",
                    )
                environment_id = params.get("environmentId")
                client_id = params.get("clientId")
                if not self._valid_bounded_string(
                    environment_id, 256
                ) or not self._valid_bounded_string(client_id, 256):
                    return _error(
                        request_id,
                        "INVALID_PARAMS",
                        "Invalid Remote Control client",
                    )
                if params.get("confirmed") is not True:
                    return _error(
                        request_id,
                        "CONFIRMATION_REQUIRED",
                        "Explicit confirmation is required",
                    )
                data = self.service.remote_revoke(environment_id, client_id)
            elif action == "update_status":
                if params:
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid update parameters"
                    )
                data = self.service.update_status()
            elif action == "update_check":
                if set(params) - {"force"} or (
                    "force" in params and not isinstance(params["force"], bool)
                ):
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid update parameters"
                    )
                data = self.service.update_check(params.get("force", False))
            elif action == "update_start":
                if set(params) != {"confirmed"}:
                    if params.get("confirmed") is not True:
                        return _error(
                            request_id,
                            "CONFIRMATION_REQUIRED",
                            "Explicit confirmation is required",
                        )
                    return _error(
                        request_id, "INVALID_PARAMS", "Invalid update parameters"
                    )
                if params.get("confirmed") is not True:
                    return _error(
                        request_id,
                        "CONFIRMATION_REQUIRED",
                        "Explicit confirmation is required",
                    )
                data = self.service.update_start()
            else:
                return _error(
                    request_id,
                    "INVALID_ACTION",
                    "Unsupported Codex Monitor action",
                )
        except RemoteDaemonStuckError:
            return _error(
                request_id,
                "REMOTE_DAEMON_STUCK",
                "Codex Remote background service is stuck",
            )
        except TimeoutError:
            return _error(
                request_id, "CODEX_TIMEOUT", "Codex did not respond", retryable=True
            )
        except RuntimeError:
            return _error(
                request_id, "CODEX_ERROR", "Codex request failed", retryable=True
            )
        return {"id": request_id, "ok": True, "data": data}

    @staticmethod
    def _valid_credit_id(value):
        return isinstance(value, str) and 0 < len(value) <= 256

    @staticmethod
    def _valid_uuid(value):
        if not isinstance(value, str):
            return False
        try:
            return str(uuid.UUID(value)) == value.lower()
        except (ValueError, AttributeError):
            return False

    @staticmethod
    def _valid_optional_path(value):
        return value is None or isinstance(value, str) and len(value) <= 4096

    @staticmethod
    def _valid_bounded_string(value, maximum):
        return isinstance(value, str) and 0 < len(value) <= maximum

    @classmethod
    def _valid_optional_string(cls, value, maximum):
        return value is None or cls._valid_bounded_string(value, maximum)
