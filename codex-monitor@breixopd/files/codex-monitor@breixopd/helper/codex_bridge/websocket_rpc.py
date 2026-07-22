"""Bounded JSON-RPC transport for Codex's local Unix WebSocket channel."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import socket
import stat
import struct
import time
from typing import Any
from collections import OrderedDict

from . import __version__
from .rpc import RpcError


MAX_HANDSHAKE_BYTES = 16_384
MAX_MESSAGE_BYTES = 1_000_000
MAX_PENDING_NOTIFICATIONS = 128
MAX_UNEXPECTED_RESPONSES = 256
_WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
_MISSING = object()


class UnixSocketAppServerClient:
    """Small RFC 6455 client for the local Codex app-server control socket."""

    def __init__(self, *, socket_path, timeout_seconds=10.0, socket_factory=None):
        path = Path(socket_path).expanduser()
        if not path.is_absolute():
            raise RuntimeError("Codex control socket path was invalid")
        self.socket_path = str(path)
        self.timeout_seconds = max(0.01, float(timeout_seconds))
        self.socket_factory = socket_factory or socket.socket
        self._socket = None
        self._buffer = bytearray()
        self._next_id = 1
        self._notifications: OrderedDict[str, Any] = OrderedDict()
        self._operation_deadline = None

    def initialize(self):
        self._connect()
        result = self.request(
            "initialize",
            {
                "clientInfo": {
                    "name": "codex-monitor-cinnamon",
                    "title": "Codex Monitor",
                    "version": __version__,
                },
                "capabilities": {
                    "experimentalApi": True,
                    "requestAttestation": False,
                },
            },
        )
        self._send_json({"method": "initialized"})
        return result

    def request(self, method, params=None):
        if self._socket is None:
            raise RuntimeError("Codex control channel is unavailable")
        request_id = self._next_id
        self._next_id += 1
        message: dict[str, Any] = {"id": request_id, "method": method}
        if params is not None:
            message["params"] = params
        previous_timeout = self._socket.gettimeout()
        previous_deadline = self._operation_deadline
        deadline = time.monotonic() + self.timeout_seconds
        self._operation_deadline = deadline
        unexpected = 0
        try:
            self._set_deadline_timeout(deadline)
            self._send_json(message)
            while True:
                response = self._receive_before_deadline(deadline)
                notification_method = response.get("method")
                if isinstance(notification_method, str):
                    self._retain_notification(
                        notification_method, response.get("params")
                    )
                    unexpected += 1
                elif response.get("id") != request_id:
                    unexpected += 1
                else:
                    if "error" in response:
                        error = response.get("error") or {}
                        code = error.get("code", "unknown")
                        raise RpcError(code)
                    return response.get("result")
                if unexpected > MAX_UNEXPECTED_RESPONSES:
                    raise RuntimeError(
                        "Codex control channel sent too many unexpected responses"
                    )
        finally:
            self._operation_deadline = previous_deadline
            if self._socket is not None:
                self._socket.settimeout(previous_timeout)

    def wait_for_notification(self, method, *, timeout_seconds):
        value = self._notifications.pop(method, _MISSING)
        if value is not _MISSING or timeout_seconds <= 0:
            return None if value is _MISSING else value
        previous_timeout = self._socket.gettimeout() if self._socket else None
        if self._socket is None:
            return None
        previous_deadline = self._operation_deadline
        deadline = time.monotonic() + max(0.01, float(timeout_seconds))
        self._operation_deadline = deadline
        unexpected = 0
        try:
            while True:
                response = self._receive_before_deadline(deadline)
                notification_method = response.get("method")
                if isinstance(notification_method, str):
                    if notification_method == method:
                        return response.get("params")
                    self._retain_notification(
                        notification_method, response.get("params")
                    )
                unexpected += 1
                if unexpected > MAX_UNEXPECTED_RESPONSES:
                    raise RuntimeError(
                        "Codex control channel sent too many unexpected responses"
                    )
        except TimeoutError:
            return None
        finally:
            self._operation_deadline = previous_deadline
            self._socket.settimeout(previous_timeout)

    def _retain_notification(self, method, value):
        self._notifications.pop(method, None)
        while len(self._notifications) >= MAX_PENDING_NOTIFICATIONS:
            self._notifications.popitem(last=False)
        self._notifications[method] = value

    def _receive_before_deadline(self, deadline):
        self._set_deadline_timeout(deadline)
        response = self._receive_json()
        if time.monotonic() >= deadline:
            raise TimeoutError("Codex control channel timed out")
        return response

    def _set_deadline_timeout(self, deadline):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Codex control channel timed out")
        if self._socket is None:
            raise RuntimeError("Codex control channel is unavailable")
        self._socket.settimeout(max(0.001, remaining))

    def close(self):
        connection = self._socket
        self._socket = None
        self._buffer.clear()
        if connection is None:
            return
        try:
            self._send_frame(b"", opcode=8, connection=connection)
        except (OSError, RuntimeError, TimeoutError):
            pass
        try:
            connection.close()
        except OSError:
            pass

    def _connect(self):
        if self._socket is not None:
            raise RuntimeError("Codex control channel is already connected")
        connection = self._open_connection()
        connection.settimeout(self.timeout_seconds)
        self._socket = connection
        try:
            self._upgrade()
        except BaseException:
            self.close()
            raise

    def _open_connection(self):
        try:
            metadata = os.stat(self.socket_path, follow_symlinks=False)
        except OSError:
            raise RuntimeError("Codex control channel is unavailable") from None
        if not stat.S_ISSOCK(metadata.st_mode) or metadata.st_uid != os.geteuid():
            raise RuntimeError("Codex control channel is unavailable")
        connection = self.socket_factory(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            connection.connect(self.socket_path)
        except (OSError, socket.timeout):
            connection.close()
            raise RuntimeError("Codex control channel is unavailable") from None
        return connection

    def _upgrade(self):
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        request = (
            "GET / HTTP/1.1\r\n"
            "Host: localhost\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        ).encode("ascii")
        self._send_bytes(request)
        raw = self._read_until(b"\r\n\r\n", MAX_HANDSHAKE_BYTES)
        try:
            header_block, remainder = raw.split(b"\r\n\r\n", 1)
            lines = header_block.decode("ascii").split("\r\n")
        except (UnicodeDecodeError, ValueError):
            raise RuntimeError("Codex control channel handshake failed") from None
        headers = {}
        for line in lines[1:]:
            if ":" not in line:
                raise RuntimeError("Codex control channel handshake failed")
            name, value = line.split(":", 1)
            headers[name.strip().lower()] = value.strip()
        expected_accept = base64.b64encode(
            # RFC 6455 requires SHA-1 here as a protocol checksum, not for
            # authentication or cryptographic trust.
            hashlib.sha1(
                (key + _WEBSOCKET_GUID).encode("ascii"), usedforsecurity=False
            ).digest()
        ).decode("ascii")
        valid = (
            lines[0].startswith("HTTP/1.1 101 ")
            and headers.get("upgrade", "").lower() == "websocket"
            and "upgrade" in {
                token.strip().lower()
                for token in headers.get("connection", "").split(",")
            }
            and hmac.compare_digest(
                headers.get("sec-websocket-accept", ""), expected_accept
            )
        )
        if not valid:
            raise RuntimeError("Codex control channel handshake failed")
        self._buffer.extend(remainder)

    def _send_json(self, message):
        try:
            payload = json.dumps(message, separators=(",", ":")).encode("utf-8")
        except (TypeError, ValueError):
            raise RuntimeError("Codex control channel request was invalid") from None
        if len(payload) > MAX_MESSAGE_BYTES:
            raise RuntimeError("Codex control channel message was too large")
        self._send_frame(payload, opcode=1)

    def _receive_json(self):
        fragments = bytearray()
        fragmented = False
        while True:
            final, opcode, payload = self._read_frame()
            if opcode == 8:
                raise RuntimeError("Codex control channel closed")
            if opcode == 9:
                self._send_frame(payload, opcode=10)
                continue
            if opcode == 10:
                continue
            if opcode == 1:
                if fragmented:
                    raise RuntimeError("Codex control channel protocol failed")
                fragments.extend(payload)
                fragmented = not final
            elif opcode == 0:
                if not fragmented:
                    raise RuntimeError("Codex control channel protocol failed")
                fragments.extend(payload)
                fragmented = not final
            else:
                raise RuntimeError("Codex control channel protocol failed")
            if len(fragments) > MAX_MESSAGE_BYTES:
                raise RuntimeError("Codex control channel message was too large")
            if fragmented:
                continue
            try:
                value = json.loads(fragments.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise RuntimeError("Codex control channel response was invalid") from None
            if not isinstance(value, dict):
                raise RuntimeError("Codex control channel response was invalid")
            return value

    def _read_frame(self):
        first, second = self._read_exact(2)
        if first & 0x70 or second & 0x80:
            raise RuntimeError("Codex control channel protocol failed")
        final = bool(first & 0x80)
        opcode = first & 0x0F
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._read_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._read_exact(8))[0]
        if length > MAX_MESSAGE_BYTES:
            raise RuntimeError("Codex control channel message was too large")
        if opcode >= 8 and (not final or length > 125):
            raise RuntimeError("Codex control channel protocol failed")
        return final, opcode, self._read_exact(length)

    def _send_frame(self, payload, *, opcode, connection=None):
        connection = connection or self._socket
        if connection is None:
            raise RuntimeError("Codex control channel is unavailable")
        payload = bytes(payload)
        first = 0x80 | opcode
        length = len(payload)
        if length < 126:
            header = bytes((first, 0x80 | length))
        elif length <= 65_535:
            header = bytes((first, 0x80 | 126)) + struct.pack("!H", length)
        else:
            header = bytes((first, 0x80 | 127)) + struct.pack("!Q", length)
        mask = os.urandom(4)
        masked = bytes(
            value ^ mask[index % 4] for index, value in enumerate(payload)
        )
        self._send_bytes(header + mask + masked, connection=connection)

    def _send_bytes(self, value, *, connection=None):
        connection = connection or self._socket
        if connection is None:
            raise RuntimeError("Codex control channel is unavailable")
        if connection is self._socket and self._operation_deadline is not None:
            self._set_deadline_timeout(self._operation_deadline)
        try:
            connection.sendall(value)
        except socket.timeout:
            raise TimeoutError("Codex control channel timed out") from None
        except OSError:
            raise RuntimeError("Codex control channel is unavailable") from None

    def _read_until(self, marker, maximum):
        while marker not in self._buffer:
            if len(self._buffer) >= maximum:
                raise RuntimeError("Codex control channel handshake failed")
            self._buffer.extend(self._receive_bytes(min(4096, maximum - len(self._buffer))))
        end = self._buffer.index(marker) + len(marker)
        value = bytes(self._buffer[:end])
        del self._buffer[:end]
        return value

    def _read_exact(self, size):
        while len(self._buffer) < size:
            self._buffer.extend(self._receive_bytes(size - len(self._buffer)))
        value = bytes(self._buffer[:size])
        del self._buffer[:size]
        return value

    def _receive_bytes(self, maximum):
        connection = self._socket
        if connection is None:
            raise RuntimeError("Codex control channel is unavailable")
        if self._operation_deadline is not None:
            self._set_deadline_timeout(self._operation_deadline)
        try:
            value = connection.recv(maximum)
        except socket.timeout:
            raise TimeoutError("Codex control channel timed out") from None
        except OSError:
            raise RuntimeError("Codex control channel is unavailable") from None
        if not value:
            raise RuntimeError("Codex control channel closed")
        return value
