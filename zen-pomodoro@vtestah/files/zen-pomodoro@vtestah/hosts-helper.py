#!/usr/bin/python3
# Zen Pomodoro hosts helper.
#
# Invoked via pkexec (interactive admin authorization) to block or unblock a
# user-chosen list of domains by managing ONLY a clearly delimited section of
# /etc/hosts. It never touches the rest of the file, validates every hostname,
# uses no shell, and writes atomically. Run as: hosts-helper.py block d1 d2 ...
#                                              hosts-helper.py unblock
import os
import re
import sys
import tempfile

HOSTS = "/etc/hosts"
BEGIN = "# >>> zen-pomodoro block >>>"
END = "# <<< zen-pomodoro block <<<"
# RFC-1123-ish hostname (labels of 1-63 chars, at least two labels).
HOST_RE = re.compile(
    r"^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
    r"(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$"
)


def read_hosts():
    # A missing file is fine (fresh start). A real read error must NOT be
    # swallowed: returning "" here would drop the rest of /etc/hosts on the
    # next write. Let the exception propagate so main() aborts without writing.
    if not os.path.exists(HOSTS):
        return ""
    with open(HOSTS, "r", encoding="utf-8") as f:
        return f.read()


def strip_section(text):
    out = []
    skip = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == BEGIN:
            skip = True
            continue
        if stripped == END:
            skip = False
            continue
        if not skip:
            out.append(line)
    res = "\n".join(out).rstrip("\n")
    return (res + "\n") if res else ""


def write_hosts(text):
    directory = os.path.dirname(HOSTS)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".zenhosts")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.chmod(tmp, 0o644)
        os.replace(tmp, HOSTS)
    except Exception:
        try:
            os.unlink(tmp)
        except Exception:
            pass
        raise


def main():
    if os.geteuid() != 0:
        sys.stderr.write("hosts-helper must run as root\n")
        return 2
    if len(sys.argv) < 2:
        return 2

    action = sys.argv[1]
    try:
        base = strip_section(read_hosts())
    except Exception as exc:
        sys.stderr.write("cannot read %s: %s\n" % (HOSTS, exc))
        return 1

    if action == "unblock":
        write_hosts(base)
        return 0

    if action == "block":
        domains = []
        seen = set()
        for raw in sys.argv[2:]:
            d = raw.strip().lower()
            # Accept pasted URLs/paths: reduce to a bare hostname before
            # validating (e.g. "https://ya.ru/path" -> "ya.ru").
            d = re.sub(r"^[a-z][a-z0-9+.\-]*://", "", d)  # drop scheme://
            d = d.split("/", 1)[0].split("?", 1)[0]        # drop path/query
            if "@" in d:
                d = d.split("@", 1)[1]                      # drop userinfo
            d = d.split(":", 1)[0]                          # drop port
            if d.startswith("www."):
                d = d[4:]
            if d and d not in seen and HOST_RE.match(d):
                seen.add(d)
                domains.append(d)
        if not domains:
            write_hosts(base)
            return 0
        lines = [BEGIN]
        for d in domains:
            lines.append("0.0.0.0 %s" % d)
            if not d.startswith("www."):
                lines.append("0.0.0.0 www.%s" % d)
        lines.append(END)
        section = "\n".join(lines) + "\n"
        if base and not base.endswith("\n"):
            base += "\n"
        write_hosts(base + section)
        return 0

    return 2


if __name__ == "__main__":
    sys.exit(main())
