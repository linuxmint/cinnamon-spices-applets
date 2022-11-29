#!/usr/bin/env python3
# -*- coding:Utf-8 -*-

# Author : Claudiux <cc@claudeclerc.fr> <claude.clerc@gmail.com>

from urllib.request import urlretrieve, urlcleanup
from os import getenv, stat, remove, makedirs
import json
from os.path import exists
from datetime import datetime

runtime_dir = getenv("XDG_RUNTIME_DIR")
json_file = runtime_dir + "/allradiostations.json"
radio_dir = getenv("HOME") + "/.config/Radio3.0/radio-lists/"
csv_file = radio_dir + "ALL_STATIONS.csv"

for subdir in ["A-Z", "Categories", "Countries"]:
  makedirs(radio_dir + subdir, exist_ok=True)

initials=[]
all_tags = list()

def clean(s):
  ret = r"""%s""" % s.strip()
  ret = ret.replace("\n", "").replace(",", "").strip()
  ret = ret.replace("__", "")
  ret = ret.replace("_", "")
  if ret.startswith("'"):
    ret = str(ret[1:])
  if ret.endswith("'"):
    ret = str(ret[:-1])
  if ret.startswith("- 0 N - "):
    ret = str(ret.split("- 0 N - ", 1)[1])
  elif ret.startswith("- "):
    ret = ret.replace("- ", "").replace(" -", "")
  elif ret.startswith("-=- "):
    ret = ret.replace("-=- ", "").replace(" -=-", "")
  elif ret.startswith(": "):
    ret = ret.replace(": ", "").replace(" :", "")
  elif ret.startswith("¡"):
    ret = ret.replace("¡", "").replace("!", "")
  elif ret.startswith("??????? ????? ("):
    ret = ret.replace("??????? ????? (", "").replace(")", "")
  elif ret.startswith(".::"):
    ret = ret.replace(".::", "").replace("::.", "")
  elif ret.startswith(".::"):
    ret = ret.replace(".::", "").replace("::.", "")
  elif ret.startswith(".. "):
    ret = ret.replace(".. ", "").replace("..", "")
  elif ret.startswith("..:: "):
    ret = ret.replace("..:: ", "",1).replace("..::", "").replace(" ::..", "")
  elif ret.startswith("."):
    ret = ret.replace(".", "")
  elif ret.startswith(""""name": "'undefined' -> """):
    ret = ret.replace(""""name": "'undefined' -> """, "").replace("'", "").replace("\"", "")
  elif ret.startswith("„"):
    ret = ret.replace("„", "").replace("“", "")
  elif ret.startswith("«"):
    ret = ret.replace("«", "").replace("»", "")
  elif ret.startswith("(New!) "):
    ret = ret.replace("(New!) ", "")
  elif ret.startswith("("):
    ret = ret.replace("(", "").replace(")", " -")
  elif ret.startswith("["):
    ret = ret.replace("[", "").replace("]", " -")
  elif ret.startswith("*"):
    ret = ret.replace("*", "")
  elif ret.startswith("/run/media/mircikemie/WD/Rádió/Amcsi rádió adók/"):
    ret = ret.replace("/run/media/mircikemie/WD/Rádió/Amcsi rádió adók/", "")
  elif ret.startswith("\\"):
    ret = ret.replace("\\", "Antfarm (Pty) Ltd.")
  elif ret.startswith("#"):
    ret = ret.replace("#", "")
  elif ret.startswith("🎤nrj🎤"):
    ret = ret.replace("🎤nrj🎤", "NRJ")

  return ret

def download_all_stations_json_file():
  url = "https://de1.api.radio-browser.info/json/stations"
  file_exists = exists(json_file)

  if file_exists:
    created= stat(json_file).st_ctime
    now = datetime.timestamp(datetime.now())

    if (now - created) < 3600*24*30:
      print("Nothing to do")
      exit(0)
    else:
      # File is too old; remove it before reload it!
      remove(json_file)

  urlretrieve(url, json_file)
  urlcleanup()

def create_pls_files():
  file_exists = exists(json_file)

  if not file_exists:
    print(json_file, "does not exist. Unable to create the .pls files.")
    exit(1)

  with open(json_file, mode='rt', encoding='utf-8') as f:
    data = json.load(f)
    f.close()

  with open(csv_file, mode='wt', encoding='utf-8') as f:
    f.write("INC;NAME;URL\n")

    count = 0

    for d in list(data):
      if d["lastcheckok"] == 1:
        count += 1

        url = d["url_resolved"].strip()

        country = d["country"].strip()

        tags = d["tags"].strip()
        tags_list = []
        if len(tags) > 0:
          tags_list = tags.split(",")
          for t in tags_list:
            if not t in all_tags:
              all_tags.append(r"%s" % t)


        name = clean(d["name"])
        initial = str(list(name)[0]).upper()
        initial_file = radio_dir + initial + ".csv"

        if not initial in initials:
          initials.append(initial)
          with open(initial_file, "wt") as i:
            i.write("INC;NAME;URL\n")
            i.close()

        with open(initial_file, "at") as i:
          i.write("false;%s;%s\n" % (name, url))
          i.close()
        #name = name.replace("\n", "").replace(",", "").strip()

        csv_line = "false;%s;%s\n" % (name, url)
        f.write(csv_line)

        pls_contents = """[playlist]
numberofentries=1
File1=%s
Title1=%s
Length1=-1
Version=2

""" % (url, name)

        name = name.replace("/", "-").replace(" ", "_")
        pls_file = r"%s/%s.pls" % (runtime_dir, name)

        with open(pls_file, "wt") as o:
          o.write(pls_contents)
          o.close()

    f.close()

  print("Count: %i." % count)
  #print(json.dumps(data, indent = 4, sort_keys=True))
  initials.sort()
  print(initials)



#download_all_stations_json_file()
create_pls_files()
all_tags = sorted(all_tags)
print(all_tags)

exit(0)



