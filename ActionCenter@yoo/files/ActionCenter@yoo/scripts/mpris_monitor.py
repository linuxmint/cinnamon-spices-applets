#!/usr/bin/env python3
"""MPRIS2 Monitor Daemon for ActionCenter@yoo
监听 D-Bus MPRIS 事件，维护播放器状态，写入 JSON 供 applet 读取。
控制命令通过文件通信：applet 写入命令文件，本脚本读取并执行。
"""
import hashlib
import os
import sys
import json
import time
import subprocess
import signal
import dbus
import dbus.mainloop.glib
from gi.repository import GLib
from _config import CACHE_DIR, STATE_FILE, CMD_FILE, DAEMON_VERSION

os.makedirs(CACHE_DIR, exist_ok=True)

bus = None
players = {}  # owner -> {bus_name, static, static_time, position}
_last_state_hash = ""
_last_state_write = 0
HEARTBEAT_SEC = 4  # 心跳间隔：必须小于 applet 的 6 秒过期判定
STATIC_TTL_SEC = 60  # 静态元数据最长缓存，超时强制重读（信号兜底）


def get_static_info(bus_name):
    """静态元数据（状态/标题/艺人/专辑/封面/时长）：重 D-Bus 读，调用方负责缓存"""
    try:
        obj_path = "/org/mpris/MediaPlayer2"
        service_name = bus_name if bus_name.startswith("org.mpris.MediaPlayer2.") else \
            "org.mpris.MediaPlayer2." + bus_name

        props = dbus.Interface(
            bus.get_object(service_name, obj_path),
            "org.freedesktop.DBus.Properties"
        )

        md = props.Get("org.mpris.MediaPlayer2.Player", "PlaybackStatus")
        meta = props.Get("org.mpris.MediaPlayer2.Player", "Metadata")

        title = str(meta.get("xesam:title", ""))
        artist_list = meta.get("xesam:artist", dbus.Array())
        artist = str(artist_list[0]) if artist_list else ""
        album = str(meta.get("xesam:album", ""))
        art_url = str(meta.get("mpris:artUrl", ""))

        identity = ""
        try:
            identity = str(props.Get("org.mpris.MediaPlayer2", "Identity"))
        except Exception:
            pass

        length = int(meta.get("mpris:length", 0))

        return {
            "status": str(md),
            "title": title,
            "artist": artist,
            "album": album,
            "artUrl": art_url,
            "identity": identity,
            "length": length,
        }
    except Exception as e:
        return {
            "status": "Stopped",
            "title": "",
            "artist": "",
            "album": "",
            "artUrl": "",
            "identity": "",
            "length": 0,
        }


def get_position(bus_name):
    """当前进度：轻量单次 Get，播放中才调"""
    try:
        obj_path = "/org/mpris/MediaPlayer2"
        service_name = bus_name if bus_name.startswith("org.mpris.MediaPlayer2.") else \
            "org.mpris.MediaPlayer2." + bus_name
        props = dbus.Interface(
            bus.get_object(service_name, obj_path),
            "org.freedesktop.DBus.Properties"
        )
        return int(props.Get("org.mpris.MediaPlayer2.Player", "Position"))
    except Exception:
        return 0


def get_cover_path(art_url):
    """下载封面到本地缓存"""
    if not art_url:
        return ""
    if art_url.startswith("file://"):
        return art_url[7:]
    # 协议白名单：只接受 http(s)，其他（ftp/smb/data…）一律丢弃
    if not (art_url.startswith("http://") or art_url.startswith("https://")):
        return ""
    cache_path = os.path.join(CACHE_DIR, "cover_%s.jpg" % hashlib.md5(art_url.encode()).hexdigest()[:8])
    if os.path.exists(cache_path):
        return cache_path
    try:
        # 限大小：恶意服务可能返回超大图片，10MB 封顶
        subprocess.Popen(
            ["curl", "-sL", "--max-filesize", "10485760", "-o", cache_path, art_url],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
    except Exception:
        pass
    return ""


def build_payload():
    """组装播放器快照：静态元数据走缓存（信号失效/60 秒 TTL），进度播放中才读"""
    now = time.time()
    payload = []
    for owner, info in players.items():
        static = info.get("static")
        if (not static or (now - info.get("static_time", 0)) > STATIC_TTL_SEC):
            static = get_static_info(info["bus_name"])
            info["static"] = static
            info["static_time"] = now
        position = info.get("position", 0)
        if static.get("status") == "Playing":
            try:
                position = get_position(info["bus_name"])
            except Exception:
                pass
        info["position"] = position
        cover = get_cover_path(static.get("artUrl", ""))
        payload.append({
            "owner": owner,
            "busName": info["bus_name"],
            "identity": static.get("identity", ""),
            "name": static.get("identity") or info["bus_name"],
            "status": static.get("status", "Stopped"),
            "title": static.get("title", ""),
            "artist": static.get("artist", ""),
            "album": static.get("album", ""),
            "artUrl": static.get("artUrl", ""),
            "coverPath": cover,
            "position": position,
            "length": static.get("length", 0),
        })
    return payload


def payload_hash(payload):
    """变化指纹：进度不计入（播歌时每秒都变），只看元数据"""
    slim = [{k: p[k] for k in ("owner", "busName", "identity", "name", "status",
                               "title", "artist", "album", "coverPath", "length")
             if k in p} for p in payload]
    return hashlib.md5(json.dumps(slim, sort_keys=True).encode()).hexdigest()


def write_state(force=False):
    """写入播放器状态到 JSON（带版本号，供 applet 判断 daemon 新旧）。
    元数据没变且心跳未到就跳过，笔记本省唤醒。"""
    global _last_state_hash, _last_state_write
    payload = build_payload()
    h = payload_hash(payload)
    now = time.time()
    if not force and h == _last_state_hash and (now - _last_state_write) < HEARTBEAT_SEC:
        return
    _last_state_hash = h
    _last_state_write = now
    state = {"v": DAEMON_VERSION, "players": payload}
    try:
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(state, f, ensure_ascii=False)
        os.replace(tmp, STATE_FILE)
    except Exception as e:
        print("write_state error: %s" % e, file=sys.stderr)


def handle_name_owner_changed(name, old_owner, new_owner):
    """处理 D-Bus 名称变化"""
    if not name.startswith("org.mpris.MediaPlayer2."):
        return

    if new_owner and not old_owner:
        # 新播放器
        bus_name = name
        players[new_owner] = {"bus_name": bus_name}
        print("Player added: %s (%s)" % (bus_name, new_owner))
        write_state()

    elif old_owner and not new_owner:
        # 播放器退出
        if old_owner in players:
            del players[old_owner]
            print("Player removed: %s" % old_owner)
            write_state()


def handle_properties_changed(interface, changed, invalidated, path=None):
    """属性变化（播放状态、元数据等）：失效静态缓存并即时写"""
    iface = str(interface)
    if iface != "org.mpris.MediaPlayer2.Player":
        return
    changed_keys = [str(k) for k in changed.keys()]
    if "PlaybackStatus" in changed_keys or "Metadata" in changed_keys:
        for info in players.values():
            info.pop("static", None)
        write_state(force=True)


def poll_players():
    """心跳兜底（4 秒）：信号漏接时补写，平时靠信号即时写"""
    write_state()
    return True  # 继续定时器


def get_player_iface(owner):
    """取播放器的 Player D-Bus 接口；播放器已退出则返回 None"""
    info = players.get(owner)
    if not info:
        return None
    try:
        obj = bus.get_object(info["bus_name"], "/org/mpris/MediaPlayer2")
        return dbus.Interface(obj, "org.mpris.MediaPlayer2.Player")
    except Exception as e:
        print("get_player_iface error: %s" % e, file=sys.stderr)
        return None


def check_commands():
    """检查控制命令文件：先 rename 再读，读到写之间来的新命令不会被误删"""
    if not os.path.exists(CMD_FILE):
        return True
    proc_file = CMD_FILE + ".proc"
    try:
        try:
            os.rename(CMD_FILE, proc_file)
        except FileNotFoundError:
            return True
        with open(proc_file, "r") as f:
            content = f.read().strip()
        os.remove(proc_file)
        if not content:
            return True

        cmd = json.loads(content)
        action = cmd.get("action", "")
        owner = cmd.get("owner", "")

        player = get_player_iface(owner)
        if player is None:
            return True

        if action == "play-pause":
            player.PlayPause()
        elif action == "next":
            player.Next()
        elif action == "prev":
            player.Previous()
        elif action == "stop":
            player.Stop()
        elif action == "set-position":
            # SetPosition 需要 (trackId, offset) 两个参数；offset 钳位防负数/超大
            offset = int(cmd.get("offset", 0))
            try:
                props = dbus.Interface(
                    bus.get_object(players[owner]["bus_name"], "/org/mpris/MediaPlayer2"),
                    "org.freedesktop.DBus.Properties")
                meta = props.Get("org.mpris.MediaPlayer2.Player", "Metadata")
                trackid = meta.get("mpris:trackid", "/org/mpris/MediaPlayer2/TrackList/NoTrack")
                length = int(meta.get("mpris:length", 0) or 0)
            except Exception:
                trackid = "/org/mpris/MediaPlayer2/TrackList/NoTrack"
                length = 0
            if offset < 0:
                offset = 0
            if length > 0 and offset > length:
                offset = length
            player.SetPosition(trackid, dbus.Int64(offset))

    except Exception as e:
        print("check_commands error: %s" % e, file=sys.stderr)

    return True  # 继续定时器


def main():
    global bus

    # 版本戳：供 applet 判断驻留进程是否过时
    try:
        with open(os.path.join(CACHE_DIR, "daemon.version"), "w") as f:
            f.write(str(DAEMON_VERSION))
    except Exception:
        pass

    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SessionBus()

    # 监听 NameOwnerChanged
    bus.add_signal_receiver(
        handle_name_owner_changed,
        dbus_interface="org.freedesktop.DBus",
        signal_name="NameOwnerChanged"
    )

    # 监听属性变化
    bus.add_signal_receiver(
        handle_properties_changed,
        dbus_interface="org.freedesktop.DBus.Properties",
        signal_name="PropertiesChanged"
    )

    # 加载已有播放器
    try:
        names = bus.list_names()
        for name in names:
            n = str(name)
            if n.startswith("org.mpris.MediaPlayer2."):
                try:
                    owner = bus.get_name_owner(n)
                    players[owner] = {"bus_name": n}
                    print("Loaded player: %s (%s)" % (n, owner))
                except Exception as e:
                    print("Load player error: %s" % e)
    except Exception as e:
        print("Load error: %s" % e, file=sys.stderr)

    write_state()

    # 定时器：4 秒心跳写状态 + 每 0.5 秒检查命令
    GLib.timeout_add(4000, poll_players)
    GLib.timeout_add(500, check_commands)

    signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))

    loop = GLib.MainLoop()
    print("MPRIS Monitor started, %d players found" % len(players))
    loop.run()


if __name__ == "__main__":
    main()
