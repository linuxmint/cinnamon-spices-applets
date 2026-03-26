#!/usr/bin/python3

try:
    from gi.repository import GLib
    import tempfile
    import os
    import sys
    import zipfile
    import shutil
    import uuid as uuidlib
    import proxygsettings
except Exception as detail:
    print(detail)
    sys.exit(1)

from http.client import HTTPSConnection
from urllib.parse import urlparse

from Spices import *

print("SU %s Spices.py" % os.path.abspath(sys.argv[0]).split("/")[-2])

home = os.path.expanduser("~")
locale_inst = '%s/.local/share/locale' % home
settings_dir = '%s/.cinnamon/configs/' % home

URL_SPICES_HOME = "https://cinnamon-spices.linuxmint.com"
URL_MAP = {
    'applet': URL_SPICES_HOME + "/json/applets.json",
    'theme': URL_SPICES_HOME + "/json/themes.json",
    'desklet': URL_SPICES_HOME + "/json/desklets.json",
    'extension': URL_SPICES_HOME + "/json/extensions.json"
}

ABORT_NONE = 0
ABORT_ERROR = 1
ABORT_USER = 2

def ui_thread_do(callback, *args):
    GLib.idle_add (callback, *args, priority=GLib.PRIORITY_DEFAULT)

def removeEmptyFolders(path):
    if not os.path.isdir(path):
        return

    # remove empty subfolders
    files = os.listdir(path)
    if len(files):
        for f in files:
            fullpath = os.path.join(path, f)
            if os.path.isdir(fullpath):
                removeEmptyFolders(fullpath)

    # if folder empty, delete it
    files = os.listdir(path)
    if len(files) == 0:
        print("Removing empty folder:", path)
        os.rmdir(path)

class SU_Spice_Harvester(Spice_Harvester):
    def __init__(self, collection_type, window=None):
        super(SU_Spice_Harvester, self).__init__(collection_type, window)

    def _download_cache(self, load_assets=True):
        download_url = URL_MAP[self.collection_type] + "?" + str(uuidlib.uuid4())

        filename = os.path.join(self.cache_folder, "index.json")
        if self._download(filename, download_url, binary=False) is None:
            return

        self._load_cache()
        self._download_image_cache()

    def _url_retrieve(self, url, outfd, reporthook, binary):
        #Like the one in urllib. Unlike urllib.retrieve url_retrieve
        #can be interrupted. KeyboardInterrupt exception is raised when
        #interrupted.
        count = 0
        blockSize = 1024 * 8
        parsed_url = urlparse(url)
        host = parsed_url.netloc
        try:
            proxy = proxygsettings.get_proxy_settings()
            if proxy and proxy.get('https'):
                connection = HTTPSConnection(proxy.get('https'), timeout=15)
                connection.set_tunnel(host)
            else:
                connection = HTTPSConnection(host, timeout=15)
            headers = { "Accept-Encoding": "identity", "Host": host, "User-Agent": "Python/3" }
            connection.request("GET", parsed_url.path + "?" + parsed_url.query, headers=headers)
            urlobj = connection.getresponse()
            if urlobj.getcode() != 200:
                self.abort()
                return None

            totalSize = int(urlobj.info()['content-length'])

            while not self._is_aborted():
                data = urlobj.read(blockSize)
                count += 1
                if not data:
                    break
                if not binary:
                    data = data.decode("utf-8")
                outfd.write(data)
                ui_thread_do(reporthook, count, blockSize, totalSize)
        except Exception as e:
            raise e

    def _install(self, job):
        uuid = job['uuid']

        download_url = URL_SPICES_HOME + self.index_cache[uuid]['file'] + "?" + str(uuidlib.uuid4())
        self.current_uuid = uuid

        ziptempfile = tempfile.mkstemp()[1]

        if self._download(ziptempfile, download_url) is None:
            return

        try:
            _zip = zipfile.ZipFile(ziptempfile)

            tempfolder = tempfile.mkdtemp()
            _zip.extractall(tempfolder)

            uuidfolder = os.path.join(tempfolder, uuid)

            self.install_from_folder(uuidfolder, uuid, True)
        except Exception as detail:
            if not self.abort_download:
                self.errorMessage(_("An error occurred during the installation of %s. Please report this incident to its developer.") % uuid, str(detail))
            return

        try:
            shutil.rmtree(tempfolder)
            os.remove(ziptempfile)
        except Exception as e:
            print(e)
