"""ActionCenter@yoo 共享路径配置（唯一真相源）"""
import os

CACHE_DIR = os.path.join(
    os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache")),
    "ActionCenter@yoo")
STATE_FILE = os.path.join(CACHE_DIR, "players.json")
CMD_FILE = os.path.join(CACHE_DIR, "commands")
WIFI_CACHE_FILE = os.path.join(CACHE_DIR, "wifi_cache.json")
THEMES_CACHE_FILE = os.path.join(CACHE_DIR, "available_themes.json")

# daemon 版本戳：applet 用它判断驻留 daemon 是否过时，过时则杀掉重拉
# 改 daemon 逻辑时把两边一起 +1（JS 侧见 mpris_controller.js EXPECTED_DAEMON_VERSION）
DAEMON_VERSION = 2
