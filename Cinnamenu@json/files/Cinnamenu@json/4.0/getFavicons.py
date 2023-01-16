#! /usr/bin/python3

#This file is used in two ways: by browserBookmarks.js as an external script and by searchHistory.py where it is imported.

import os
import sys
import tempfile
import shutil
import sqlite3
import json
import urllib.parse

FAVICON_CACHE_DIR = os.path.join(os.path.split(__file__)[0], "../favicon_cache")

# Params: sqlite_file: path to Favicons file from which to extract favicons
#        domains_list: list of domains to find favicons for eg. ["https://google.com","http:/..."]
# return: domains with a path to icon eg. {"https://google.com": "/home/USER/.local/share/cinnamon/applets/Cinnamen@json/favicons_cache/google.com", "https://...": "..."}
def get_favicons(sqlite_file, domains_list):
    if not os.path.exists(FAVICON_CACHE_DIR):
        os.mkdir(FAVICON_CACHE_DIR)

    #make temp copy of Favicons file as orignal is probably locked.
    fd, temp_filename = tempfile.mkstemp()
    os.close(fd)

    domains_to_favicons = {}

    try:
        shutil.copyfile(sqlite_file, temp_filename)

        conn = sqlite3.Connection(temp_filename)

        domains_to_favicons = {}
        for domain in domains_list:
            url_parsed = urllib.parse.urlparse(domain)
            netloc = url_parsed.netloc
            filename = os.path.join(FAVICON_CACHE_DIR, netloc)
            if not os.path.exists(filename):
                cur = conn.cursor()
                cur.execute("SELECT page_url, icon_id FROM icon_mapping WHERE page_url LIKE ?", [domain + "%"])

                for page_url, icon_id in cur.fetchall():
                    
                    cur2 = conn.cursor()
                    cur2.execute("SELECT icon_id, image_data FROM favicon_bitmaps WHERE icon_id = ?", (icon_id, ))
                    #There are usually 2 results, a 16px and a 32px PNG with the 32px being the second result.
                    #Save both to same filename so that the 32px overwrites the 16px
                    for fav_id, image_data in cur2.fetchall():
                        image_file = open(filename, "w+b")
                        image_file.write(image_data)
                    cur2.close()
                cur.close()
            if os.path.exists(filename):
                domains_to_favicons[domain] = filename
    except:
        pass

    if os.path.exists(temp_filename):
        os.unlink(temp_filename)

    return domains_to_favicons

if __name__ == "__main__":
    if len(sys.argv) > 2:
        sqlite_file = sys.argv[1]
        domains_json = sys.argv[2]
        domains_list = json.loads(domains_json)
        results = get_favicons(sqlite_file, domains_list)
        print(json.dumps(results))
