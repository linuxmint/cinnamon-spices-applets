#! /usr/bin/python3

#This file is used in two ways: by browserBookmarks.js as an external script and by searchHistory.py where it is imported.

import os
import sys
import tempfile
import shutil
import sqlite3
import json
import urllib.parse

FAVICON_CACHE_DIR = os.path.join(
    os.environ.get("XDG_CACHE_HOME", os.path.join(os.path.expanduser("~"), ".cache")),
    "menuelevenreloaded@dshep79",
    "favicons",
)

# Params: sqlite_file: path to Favicons file from which to extract favicons
#        domains_list: list of domains to find favicons for eg. ["https://google.com","http:/..."]
# return: mapping of domains to locally cached favicon file paths
def get_favicons(sqlite_file, domains_list):
    if not os.path.exists(FAVICON_CACHE_DIR):
        os.makedirs(FAVICON_CACHE_DIR, mode=0o700, exist_ok=True)

    sqlite_file_copy_made = False
    try:
        domains_to_favicons = {}
        for domain in domains_list:
            url_parsed = urllib.parse.urlparse(domain)
            netloc = url_parsed.netloc
            filename = os.path.join(FAVICON_CACHE_DIR, netloc)

            if not os.path.exists(filename):

                if not sqlite_file_copy_made:
                    #make temp copy of Favicons file as orignal is probably locked.
                    fd, temp_filename = tempfile.mkstemp()
                    os.close(fd)
                    shutil.copyfile(sqlite_file, temp_filename)
                    conn = sqlite3.Connection(temp_filename)
                    sqlite_file_copy_made = True

                cur = conn.cursor()
                cur.execute("SELECT page_url, icon_id FROM icon_mapping WHERE page_url LIKE ?", [domain + "%"])

                for page_url, icon_id in cur.fetchall():
                    
                    cur2 = conn.cursor()
                    cur2.execute("SELECT icon_id, image_data FROM favicon_bitmaps WHERE icon_id = ?", (icon_id, ))
                    #There are usually 2 results, a 16px and a 32px PNG with the 32px being the second result.
                    #Save both to same filename so that the 32px overwrites the 16px
                    for fav_id, image_data in cur2.fetchall():
                        with open(filename, "w+b") as image_file:
                            image_file.write(image_data)
                    cur2.close()
                cur.close()
            if os.path.exists(filename):
                domains_to_favicons[domain] = filename
    except:
        pass

    if sqlite_file_copy_made:
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
