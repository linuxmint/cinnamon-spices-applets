#! /usr/bin/python3
# -*- coding=utf-8 -*-

import os
import sys
import tempfile
import shutil
import sqlite3
import json
import urllib.parse
import subprocess
import getFavicons

if __name__ == "__main__":
    if len(sys.argv) > 2:
        path = sys.argv[1]
        fd, temp_filename = tempfile.mkstemp()
        os.close(fd)
        try:
            shutil.copyfile(os.path.join(path, "History"), temp_filename)

            conn = sqlite3.Connection(temp_filename)
            cur = conn.cursor()

            words = []
            for i in sys.argv[2:]:
                words += i.split()
            query = "SELECT url, title FROM urls WHERE " + \
                            " AND ".join(len(words) * ["(url LIKE ? OR title LIKE ?)"]) + \
                                " ORDER BY last_visit_time DESC, visit_count DESC LIMIT 10"
            params = []
            for word in words:
                params.append("%" + word + "%")
                params.append("%" + word + "%")
            cur.execute(query, tuple(params))

            results = []
            domains_list = []
            for url, title in cur.fetchall():
                url_parsed = urllib.parse.urlparse(url)
                domain = url_parsed.scheme + '://' + url_parsed.netloc
                if not domain in domains_list:
                    domains_list.append(domain)
                if url and title:
                    desc = url
                    if len(url) > 150:
                        desc = url[:150] + ' ...';
                    results.append({
                        "id": url,
                        "uri": url,
                        "domain": domain,
                        "description": desc,
                        "name": title
                    })

            cur.close()

            favicons_file = os.path.join(path, "Favicons")
            domains_to_favicons = getFavicons.get_favicons(favicons_file, domains_list)

            for i in range(len(results)):
                if results[i]['domain'] in domains_to_favicons:
                    results[i]['icon_filename'] = domains_to_favicons[results[i]['domain']]

            print(json.dumps(results))
        except:
            print(json.dumps([]))

        if os.path.exists(temp_filename):
            os.unlink(temp_filename)
