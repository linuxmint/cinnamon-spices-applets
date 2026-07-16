"""Bounded capture for short-lived Codex commands."""

from __future__ import annotations

import os
import selectors
import subprocess
import time


class CommandOutputTooLarge(RuntimeError):
    def __init__(self, stream, captured):
        super().__init__(stream)
        self.stream = stream
        self.captured = captured


def run_bounded(command, *, timeout, stdout_limit, stderr_limit=0, env=None):
    """Run fixed argv while bounding captured output and total elapsed time."""
    process = subprocess.Popen(
        command,
        shell=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE if stdout_limit > 0 else subprocess.DEVNULL,
        stderr=subprocess.PIPE if stderr_limit > 0 else subprocess.DEVNULL,
        env=env,
        close_fds=True,
    )
    streams = {}
    if process.stdout is not None:
        streams[process.stdout] = ("stdout", stdout_limit, bytearray())
    if process.stderr is not None:
        streams[process.stderr] = ("stderr", stderr_limit, bytearray())
    selector = selectors.DefaultSelector()
    deadline = time.monotonic() + timeout
    try:
        for stream in streams:
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ)
        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(command, timeout)
            events = selector.select(remaining)
            if not events:
                raise subprocess.TimeoutExpired(command, timeout)
            for key, _events in events:
                stream = key.fileobj
                try:
                    chunk = os.read(stream.fileno(), 65_536)
                except BlockingIOError:
                    continue
                if not chunk:
                    selector.unregister(stream)
                    stream.close()
                    continue
                name, limit, captured = streams[stream]
                available = limit - len(captured)
                captured.extend(chunk[:available])
                if len(chunk) > available:
                    raise CommandOutputTooLarge(name, bytes(captured))
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise subprocess.TimeoutExpired(command, timeout)
        returncode = process.wait(timeout=remaining)
    except BaseException:
        if process.poll() is None:
            process.kill()
        process.wait()
        raise
    finally:
        for key in list(selector.get_map().values()):
            try:
                selector.unregister(key.fileobj)
            except KeyError:
                pass
            key.fileobj.close()
        selector.close()
    stdout = bytes(streams[process.stdout][2]) if process.stdout is not None else b""
    stderr = bytes(streams[process.stderr][2]) if process.stderr is not None else b""
    return subprocess.CompletedProcess(command, returncode, stdout, stderr)
