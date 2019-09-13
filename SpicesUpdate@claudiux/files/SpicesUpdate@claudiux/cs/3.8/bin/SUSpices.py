#!/usr/bin/python3

try:
    from gi.repository import GLib
    import tempfile
    import os
    import sys
    import zipfile
    import shutil
    import cgi
    import subprocess
    import threading
    import time
    import dbus
    from PIL import Image
    import datetime
    import uuid as uuidlib
except Exception as detail:
    print(detail)
    sys.exit(1)

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

    def _download_image_cache(self):
        self.is_downloading_image_cache = True

        self.used_thumbs = []

        self.download_total_files = 0
        self.download_current_file = 0

        for uuid, info in self.index_cache.items():
            if self.themes:
                icon_basename = self._sanitize_thumb(os.path.basename(self.index_cache[uuid]['screenshot']))
                download_url = URL_SPICES_HOME + "/uploads/themes/thumbs/" + icon_basename
            else:
                icon_basename = os.path.basename(self.index_cache[uuid]['icon'])
                download_url = URL_SPICES_HOME + self.index_cache[uuid]['icon']
            self.used_thumbs.append(icon_basename)

            icon_path = os.path.join(self.cache_folder, icon_basename)

            # if the image doesn't exist, is corrupt, or may have changed we want to download it
            if not os.path.isfile(icon_path) or self._is_bad_image(icon_path) or self.old_cache[uuid]["last_edited"] != self.index_cache[uuid]["last_edited"]:
                self.download_manager.push(self._download, self._check_download_image_cache_complete, (icon_path, download_url))
                self.download_total_files += 1

        ui_thread_do(self._check_download_image_cache_complete)

    def _check_download_image_cache_complete(self, *args):
        # we're using multiple threads to download image assets, so we only clean up when all the downloads are done
        if self.download_manager.busy():
            return

        # Cleanup obsolete thumbs
        trash = []
        flist = os.listdir(self.cache_folder)
        for f in flist:
            if f not in self.used_thumbs and f != "index.json":
                trash.append(f)
        for t in trash:
            try:
                os.remove(os.path.join(self.cache_folder, t))
            except:
                pass

        self.download_total_files = 0
        self.download_current_file = 0
        self.is_downloading_image_cache = False
        self.settings.set_int('%s-cache-updated' % self.collection_type, time.time())
        self._advance_queue()
        self.emit('cache-loaded')

    def get_cache_age(self):
        return (time.time() - self.settings.get_int('%s-cache-updated' % self.collection_type)) / 86400

    # checks for corrupt images in the cache so we can redownload them the next time we refresh
    def _is_bad_image(self, path):
        try:
            Image.open(path)
        except IOError as detail:
            return True
        return False

    # make sure the thumbnail fits the correct format (we are expecting it to be <uuid>.png
    def _sanitize_thumb(self, basename):
        return basename.replace("jpg", "png").replace("JPG", "png").replace("PNG", "png")

    def install(self, uuid):
        """ downloads and installs the given extension"""
        job = {'uuid': uuid, 'func': self._install, 'callback': self._install_finished}
        job['progress_text'] = _("Installing %s") % uuid
        self._push_job(job)

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
        except Exception:
            pass

    def install_from_folder(self, folder, uuid, from_spices=False):
        """ installs a spice from a specified folder"""
        contents = os.listdir(folder)

        if not self.themes:
            # ensure proper file permissions
            for root, dirs, files in os.walk(folder):
                for file in files:
                    os.chmod(os.path.join(root, file), 0o755)

            # Install spice localization files, if any
            if 'po' in contents:
                po_dir = os.path.join(folder, 'po')
                for file in os.listdir(po_dir):
                    if file.endswith('.po'):
                        lang = file.split(".")[0]
                        locale_dir = os.path.join(locale_inst, lang, 'LC_MESSAGES')
                        os.makedirs(locale_dir, mode=0o755, exist_ok=True)
                        subprocess.call(['msgfmt', '-c', os.path.join(po_dir, file), '-o', os.path.join(locale_dir, '%s.mo' % uuid)])

        dest = os.path.join(self.install_folder, uuid)
        if os.path.exists(dest):
            shutil.rmtree(dest)
        shutil.copytree(folder, dest)

        meta_path = os.path.join(dest, 'metadata.json')
        if self.themes and not os.path.exists(meta_path):
            md = {}
        else:
            file = open(meta_path, 'r')
            raw_meta = file.read()
            file.close()
            md = json.loads(raw_meta)

        if from_spices and uuid in self.index_cache:
            md['last-edited'] = self.index_cache[uuid]['last_edited']
        else:
            md['last-edited'] = int(datetime.datetime.utcnow().timestamp())

        raw_meta = json.dumps(md, indent=4)
        file = open(meta_path, 'w+')
        file.write(raw_meta)
        file.close()

    def _install_finished(self, job):
        uuid = job['uuid']
        if self.get_enabled(uuid):
            self.send_proxy_signal('ReloadXlet', '(ss)', uuid, self.collection_type.upper())

    def uninstall(self, uuid):
        """ uninstalls and removes the given extension"""
        job = {'uuid': uuid, 'func': self._uninstall}
        job['progress_text'] = _("Uninstalling %s") % uuid
        self._push_job(job)

    def _uninstall(self, job):
        try:
            uuid = job['uuid']
            if not self.themes:
                # Uninstall spice localization files, if any
                if (os.path.exists(locale_inst)):
                    i19_folders = os.listdir(locale_inst)
                    for i19_folder in i19_folders:
                        if os.path.isfile(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', '%s.mo' % uuid)):
                            os.remove(os.path.join(locale_inst, i19_folder, 'LC_MESSAGES', '%s.mo' % uuid))
                        # Clean-up this locale folder
                        removeEmptyFolders(os.path.join(locale_inst, i19_folder))

                # Uninstall settings file, if any
                if (os.path.exists(os.path.join(settings_dir, uuid))):
                    shutil.rmtree(os.path.join(settings_dir, uuid))
            shutil.rmtree(os.path.join(self.install_folder, uuid))
        except Exception as detail:
            self.errorMessage(_("A problem occurred while removing %s.") % job['uuid'], str(detail))

    def update_all(self):
        """ applies all available updates"""
        for uuid in self.updates_available:
            self.install(uuid)

    def abort(self, abort_type=ABORT_USER):
        """ trigger in-progress download to halt"""
        self.abort_download = abort_type
        self.download_manager.abort()

    def _is_aborted(self):
        return self.download_manager.abort_status

    def _ui_error_message(self, msg, detail = None):
        dialog = Gtk.MessageDialog(transient_for = self.window,
                                   modal = True,
                                   message_type = Gtk.MessageType.ERROR,
                                   buttons = Gtk.ButtonsType.OK)
        markup = msg
        if detail is not None:
            markup += _("\n\nDetails:  %s") % (str(detail))
        esc = cgi.escape(markup)
        dialog.set_markup(esc)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()

    def errorMessage(self, msg, detail=None):
        ui_thread_do(self._ui_error_message, msg, detail)

    def enable_extension(self, uuid, panel=1, box='right', position=0):
        if self.collection_type == 'applet':
            entries = []
            applet_id = self.settings.get_int('next-applet-id')
            self.settings.set_int('next-applet-id', (applet_id+1))

            for entry in self.settings.get_strv(self.enabled_key):
                info = entry.split(':')
                pos = int(info[2])
                if info[0] == 'panel%d' % panel and info[1] == box and position <= pos:
                    info[2] = str(pos+1)
                    entries.append(':'.join(info))
                else:
                    entries.append(entry)

            entries.append('panel%d:%s:%d:%s:%d' % (panel, box, position, uuid, applet_id))

            self.settings.set_strv(self.enabled_key, entries)
        elif self.collection_type == 'desklet':
            desklet_id = self.settings.get_int('next-desklet-id')
            self.settings.set_int('next-desklet-id', (desklet_id+1))
            enabled = self.settings.get_strv(self.enabled_key)

            screen = Gdk.Screen.get_default()
            primary = screen.get_primary_monitor()
            primary_rect = screen.get_monitor_geometry(primary)
            enabled.append(('%s:%d:%d:%d') % (uuid, desklet_id, primary_rect.x + 100, primary_rect.y + 100))

            self.settings.set_strv(self.enabled_key, enabled)

        else:
            enabled = self.settings.get_strv(self.enabled_key)
            enabled.append(uuid)
            self.settings.set_strv(self.enabled_key, enabled)

    def disable_extension(self, uuid):
        enabled_extensions = self.settings.get_strv(self.enabled_key)
        new_list = []
        for enabled_extension in enabled_extensions:
            if uuid not in enabled_extension:
                new_list.append(enabled_extension)
        self.settings.set_strv(self.enabled_key, new_list)

    def get_icon(self, uuid):
        """ gets the icon  for a given uuid"""
        try:
            if self.themes:
                file_path = os.path.join(self.cache_folder, os.path.basename(self.index_cache[uuid]['screenshot']))
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file_path, 100, -1, True)
            else:
                file_path = os.path.join(self.cache_folder, os.path.basename(self.index_cache[uuid]['icon']))
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(file_path, 24, 24, True)

            return Gtk.Image.new_from_pixbuf(pixbuf)
        except Exception as e:
            print("There was an error processing one of the images. Try refreshing the cache.")
            return Gtk.Image.new_from_icon_name('image-missing', 2)
