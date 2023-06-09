#!/usr/bin/python3
import os, time, json, subprocess, sys, datetime

wallpaper_dir = ""


def wallpaper_filter(path):
    return os.path.isfile(wallpaper_dir + "/" + path) and (
        ".jpg" in path or ".png" in path or ".jpeg" in path
    )


def change_wallpaper(path):
    uri = "'file://%s'" % path
    args = ["gsettings", "set", "org.gnome.desktop.background", "picture-uri", uri]
    subprocess.Popen(args)
    print("wallpaper changed to", uri)


if __name__ == "__main__":
    print(sys.argv)
    wallpaper_dir = sys.argv[1]
    DELAY = int(sys.argv[2]) if sys.argv[2] not in ("prev", "next") else sys.argv[2]
    wallpaper_list = list(filter(wallpaper_filter, os.listdir(wallpaper_dir)))
    data_file = wallpaper_dir + "/data_file.json"

    print(wallpaper_list)
    CURRENT_TIME = time.time()
    data = {}
    if os.path.exists(data_file):
        with open(data_file, "r") as openfile:
            data = json.load(openfile)
    else:
        data = {"current_index": 0, "last_time": time.time()}
        with open(data_file, "w") as outfile:
            json.dump(data, outfile)

    LAST_TIME = float(data["last_time"])
    last_time_str = datetime.datetime.fromtimestamp(LAST_TIME).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    print("Last changed: {}".format(last_time_str))
    current_index = int(data["current_index"])
    new_index = current_index + 1 if current_index + 1 < len(wallpaper_list) else 0
    if DELAY == "prev":
        new_index = (
            current_index - 1 if current_index - 1 >= 0 else len(wallpaper_list) - 1
        )
    if (
        isinstance(DELAY, int)
        and (CURRENT_TIME - LAST_TIME >= DELAY)
        or isinstance(DELAY, str)
        and DELAY in ("prev", "next")
    ):
        data = {"current_index": new_index, "last_time": time.time()}
        with open(data_file, "w") as outfile:
            json.dump(data, outfile)
        change_wallpaper(wallpaper_dir + "/" + wallpaper_list[new_index])
        last_time_str = datetime.datetime.fromtimestamp(data["last_time"]).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        print("Last changed: {}".format(last_time_str))
