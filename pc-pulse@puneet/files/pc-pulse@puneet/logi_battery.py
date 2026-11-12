#!/usr/bin/env python3
"""Exact battery % for Logitech HID++ 2.0 devices on a Unifying/Bolt receiver.

The Linux hid-logitech-hidpp driver reports only a coarse level for some mice
(the MX Vertical shows "Full"), while the device itself answers HID++ battery
features with a real percentage. This talks to the receiver's hidraw node
directly (user access via the uaccess ACL, no root, no driver) and prints JSON:
  [{"slot": 1, "name": "...", "percent": 85, "charging": false, "source": "..."}]
Usage: logi_battery.py [--debug]
"""
import glob, json, os, select, sys, time

VID = "046D"
SWID = 0x0B
FEAT_NAME, FEAT_STATUS, FEAT_VOLTAGE, FEAT_UNIFIED = 0x0005, 0x1000, 0x1001, 0x1004
VOLT = [(4186, 100), (4067, 90), (3989, 80), (3922, 70), (3859, 60), (3811, 50),
        (3778, 40), (3751, 30), (3717, 20), (3671, 10), (3646, 5), (3579, 2), (3500, 0)]
DEBUG = "--debug" in sys.argv


def log(*a):
    if DEBUG:
        print(*a, file=sys.stderr)


def receivers():
    out = []
    for node in sorted(glob.glob("/sys/class/hidraw/hidraw*")):
        ue = open(node + "/device/uevent").read()
        hid_id = next((l.split("=")[1] for l in ue.splitlines() if l.startswith("HID_ID=")), "")
        name = next((l.split("=", 1)[1] for l in ue.splitlines() if l.startswith("HID_NAME=")), "")
        if VID in hid_id.upper() and "Receiver" in name:
            dev = "/dev/" + os.path.basename(node)
            if os.access(dev, os.R_OK | os.W_OK):
                out.append(dev)
            else:
                log("no access to", dev)
    return out


def request(fd, dev, feat, func, params=(), timeout=1.0):
    fn = (func << 4) | SWID
    msg = bytes([0x11, dev, feat, fn] + list(params) + [0] * (16 - len(params)))
    os.write(fd, msg[:20])
    end = time.time() + timeout
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], max(0, end - time.time()))
        if not r:
            break
        rep = os.read(fd, 64)
        if len(rep) < 5 or rep[1] != dev:
            continue
        if rep[0] == 0x10 and rep[2] == 0x8F and rep[3] == feat and rep[4] == fn:
            return None
        if rep[0] == 0x11 and rep[2] == 0xFF and rep[3] == feat and rep[4] == fn:
            return None
        if rep[0] == 0x11 and rep[2] == feat and rep[3] == fn:
            return rep[4:]
    return None


def feature(fd, dev, f):
    r = request(fd, dev, 0x00, 0, [f >> 8, f & 0xFF])
    return r[0] if r and r[0] else None


def name(fd, dev):
    idx = feature(fd, dev, FEAT_NAME)
    if not idx:
        return None
    r = request(fd, dev, idx, 0)
    if not r:
        return None
    n, out = r[0], b""
    while len(out) < n:
        r = request(fd, dev, idx, 1, [len(out)])
        if not r:
            break
        out += bytes(r[: n - len(out)])
    return out.decode("ascii", "replace").strip("\x00") or None


def battery(fd, dev):
    # 0x1000 first: it gives a real % on the MX Vertical where 0x1004 can be level-only.
    idx = feature(fd, dev, FEAT_STATUS)
    if idx:
        r = request(fd, dev, idx, 0)
        log("dev", dev, "0x1000 ->", r and list(r[:4]))
        if r and r[0]:
            return r[0], r[2] in (1, 2, 3, 4), "status"
    idx = feature(fd, dev, FEAT_UNIFIED)
    if idx:
        r = request(fd, dev, idx, 1)
        log("dev", dev, "0x1004 ->", r and list(r[:4]))
        if r and r[0]:
            return r[0], r[2] in (1, 2, 3), "unified"
    idx = feature(fd, dev, FEAT_VOLTAGE)
    if idx:
        r = request(fd, dev, idx, 0)
        log("dev", dev, "0x1001 ->", r and list(r[:4]))
        if r:
            mv = (r[0] << 8) | r[1]
            return next((p for v, p in VOLT if mv >= v), 0), bool(r[2] & 0x80), "voltage %dmV" % mv
    return None


def read_all():
    results = []
    for path in receivers():
        fd = os.open(path, os.O_RDWR)
        try:
            for dev in range(1, 7):
                if request(fd, dev, 0x00, 0, [0x00, 0x01], timeout=0.5) is None:
                    continue
                bat = battery(fd, dev)
                if bat is None:
                    continue
                results.append({"slot": dev, "name": name(fd, dev) or "Logitech %d" % dev,
                                "percent": bat[0], "charging": bat[1], "source": bat[2]})
        finally:
            os.close(fd)
    return results


if __name__ == "__main__":
    # The first exchange after opening the receiver sometimes gets no answer; retry once.
    res = read_all()
    if not res and receivers():
        time.sleep(0.4)
        res = read_all()
    print(json.dumps(res))
