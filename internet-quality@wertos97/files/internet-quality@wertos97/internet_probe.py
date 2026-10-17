#!/usr/bin/python3

import argparse
import concurrent.futures
import json
import math
import os
import re
import socket
import subprocess
import time


HOST_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9.:-]{0,252}$")


def safe_host(value):
    value = str(value or "").strip()
    if not HOST_RE.fullmatch(value):
        raise ValueError("invalid host")
    return value


def ping(host, timeout):
    started = time.monotonic()
    try:
        environment = dict(os.environ, LC_ALL="C")
        result = subprocess.run(
            ["/usr/bin/ping", "-n", "-c", "1", "-W", str(max(1, math.ceil(timeout))), "--", host],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=timeout + 1,
            check=False,
            env=environment,
        )
        match = re.search(r"time[=<]([0-9.]+)\s*ms", result.stdout)
        if result.returncode == 0 and match:
            return {"reachable": True, "latencyMs": float(match.group(1)), "method": "icmp"}
    except (OSError, subprocess.TimeoutExpired, ValueError):
        pass
    return {"reachable": False, "latencyMs": round((time.monotonic() - started) * 1000, 1), "method": "icmp"}


def tcp_probe(host, port, timeout):
    started = time.monotonic()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return {"reachable": True,
                    "latencyMs": round((time.monotonic() - started) * 1000, 1),
                    "method": "tcp"}
    except OSError:
        return {"reachable": False, "latencyMs": None, "method": "tcp"}


def dns_probe(host, timeout):
    started = time.monotonic()
    old_timeout = socket.getdefaulttimeout()
    socket.setdefaulttimeout(timeout)
    try:
        socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        return round((time.monotonic() - started) * 1000, 1)
    except OSError:
        return None
    finally:
        socket.setdefaulttimeout(old_timeout)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", default="8.8.8.8")
    parser.add_argument("--tcp-host", default="1.1.1.1")
    parser.add_argument("--dns-host")
    parser.add_argument("--timeout", type=float, default=2.0)
    args = parser.parse_args()

    try:
        target = safe_host(args.target)
        tcp_host = safe_host(args.tcp_host)
        dns_host = safe_host(args.dns_host) if args.dns_host else None
        timeout = max(0.5, min(5.0, float(args.timeout)))
    except (TypeError, ValueError):
        print(json.dumps({"error": "settings"}, separators=(",", ":")))
        return

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        ping_future = executor.submit(ping, target, timeout)
        dns_future = executor.submit(dns_probe, dns_host, timeout) if dns_host else None
        result = ping_future.result()
        if not result["reachable"]:
            result = tcp_probe(tcp_host, 443, timeout)
        result["dnsMs"] = dns_future.result() if dns_future else None
        result["dnsChecked"] = dns_future is not None
        result["checkedAt"] = int(time.time())
        print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
