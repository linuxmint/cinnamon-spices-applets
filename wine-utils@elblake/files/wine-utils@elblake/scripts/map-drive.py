#!/usr/bin/env python3

##
## Map folders to drive letters
##

##
## Map Drive for:
##  Local path (starts with / , or a folder in home directory)
##  SMB (UNC Path or URL)
##  WebDAV (http/https Path)
##

import os
import sys
import re
import subprocess
from urllib import parse as url_parse

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
from gi.repository import Gdk
from gi.repository import GLib
from gi.repository import Gio

import locale

UUID = 'wine-utils@elblake'

locale.setlocale(locale.LC_MESSAGES, "")
locale.textdomain(UUID)
locale.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale")

## Where to find the GVFS mounts (may depend on OS)
GVFS_PATH = "/var/run/user/{}/gvfs/"

def _(str0):
    str1 = locale.dgettext(UUID, str0)
    if str1 == '':
        return str0
    return str1


def fix_dir_case(filedir):
    if os.path.isdir(filedir):
        return filedir
    actualdir = fix_dir_case(os.path.dirname(filedir))
    base = os.path.basename(filedir).lower()
    for d in os.listdir(actualdir):
        if d.lower() == base:
            return os.path.join(actualdir, d)
    return None

## Case insensitive isdir
def isdir_ci(file):
    if os.path.isdir(file):
        return True
    filedir = os.path.dirname(file)
    base = os.path.basename(file).lower()
    if not os.path.isdir(filedir):
        filedir = fix_dir_case(filedir)
    if not os.path.isdir(filedir):
        return False
    for d in os.listdir(filedir):
        if d.lower() == base:
            if os.path.isdir(os.path.join(filedir, d)):
                return True
    return False

## Case insensitive islink
def islink_ci(file):
    if os.path.islink(file):
        return True
    filedir = os.path.dirname(file)
    base = os.path.basename(file).lower()
    if not os.path.isdir(filedir):
        filedir = fix_dir_case(filedir)
    if not os.path.isdir(filedir):
        return False
    for d in os.listdir(filedir):
        if d.lower() == base:
            if os.path.islink(os.path.join(filedir, d)):
                return True
    return False

## List available drives that can be mapped to. Returns
## an empty list if the wine prefix does not exist.
##
def list_avail_drives (prefix):
    listd = []
    devicedir = os.path.join(prefix["prefix"], 'dosdevices')
    if os.path.isdir(devicedir):
        dir_list = os.listdir(devicedir)
        found = {}
        for x in dir_list:
            if x == '.' or x == '..':
                continue
            found[x] = 1
        letter = ord('a')
        for i in range(0, 26):
            if not ((chr(letter) + ":") in found):
                listd.append(chr(letter).upper() + ":")
            
            letter = letter + 1
            
    return listd


## Actually map a drive to a path.
##
def map_drive_local (prefix, path, driveletter):
    wineprefix = prefix["prefix"]
    driveletter = driveletter.lower()
    try:
        subprocess.check_output(["ln", "-s", path, os.path.join(wineprefix, "dosdevices", driveletter)])
        return True
    except subprocess.CalledProcessError:
        return None

## Link a UNC path so wine applications can use the UNC path directly.
##
def link_unc_path(prefix, unc_server, unc_folder, path):
    unc_server = unc_server.lower()
    unc_folder = unc_folder.lower()
    wineprefix = prefix["prefix"]
    try:
        devices_path = os.path.join(wineprefix, "dosdevices")
        if not os.path.isdir(devices_path):
            return False
        if not os.path.isdir(os.path.join(devices_path, "unc")):
            os.mkdir(os.path.join(devices_path, "unc"))
        devices_path_unc_server = os.path.join(devices_path, "unc", unc_server)
        if not isdir_ci(devices_path_unc_server):
            os.mkdir(devices_path_unc_server)
        else:
            devices_path_unc_server = fix_dir_case(devices_path_unc_server)
        if devices_path_unc_server == None:
            return False
        if not islink_ci(os.path.join(devices_path_unc_server, unc_folder)):
            subprocess.check_output(["ln", "-s", path, os.path.join(devices_path_unc_server, unc_folder)])
        if not islink_ci(os.path.join(devices_path_unc_server, unc_folder)):
            return False
        return True
    except subprocess.CalledProcessError:
        return False

## Get the default file manager
##
def get_file_manager():
    found = 'nemo' ## Default to nemo
    try:
        desktopfile = subprocess.check_output(["xdg-mime","query","default","inode/directory"]).decode()
        desktopfile = desktopfile.strip()
        print(desktopfile)
        app_info = Gio.DesktopAppInfo.new(desktopfile)
        if app_info != None:
            found_app = app_info.get_string("Exec")
            if found_app != None:
                found = found_app
        return found
    except subprocess.CalledProcessError:
        return found


##
##

PANEL_START = 0
PANEL_MOUNT_STEP = 1
PANEL_DONE = 2


## Create dialog window.
##
class MapDriveDialog(Gtk.Window):
    def __init__(self, prefix, avail_drives):
        super().__init__(type='toplevel')
        title = _("Create Drive Mapping")
        
        self.set_border_width(10)
        self.set_title(title)
        self.resize(500, 380)
        self.set_type_hint(Gdk.WindowTypeHint.DIALOG)

        vbox = Gtk.VBox()
        
        self.prev_step = -1
        self.step = PANEL_START
        self.panels = []
        self.task = ''
        self.panel_at = [PANEL_START]
        self.complete = 0
        self.prefix = prefix
        self.avail_drives = avail_drives

        stack = Gtk.Stack()
        vbox.pack_start(stack, True, True, 0)
        self.stack = stack

        panels_fun = [
            lambda _: self.dialog_step_1(),
            lambda _: self.dialog_mount_step(),
            lambda _: self.dialog_complete()
        ]
        for panel_func in panels_fun:
            panel = panel_func(self)
            self.panels.append(panel)
            self.stack.add(panel)
        

        vbox.pack_start(
            self.map_drive_dialog_button_row(),
            False, True, 0)
        self.add(vbox)

        self.connect('destroy', self.map_drive_dialog_destroy)
        self.connect('key_press_event', self.map_drive_dialog_key_press_event)

    def map_drive_dialog_destroy(self, widget):
        Gtk.main_quit()
        return True

    def map_drive_dialog_key_press_event(self, widget, evt):
        if evt.keyval == Gdk.KEY_Escape:
            Gtk.main_quit()
            return True
        return False

    ## The row of buttons at the bottom of the dialog.
    ##
    def map_drive_dialog_button_row (self):
        
        btn_label_next = _("Next")
        btn_label_back = _("Back")
        btn_label_dismiss = _("Cancel")
        hbox = Gtk.HBox()

        button_next = Gtk.Button(label=btn_label_next)
        hbox.pack_end(button_next, False, True, 0)
        button_next.connect('clicked', self.dialog_next)

        button_back = Gtk.Button(label=btn_label_back)
        hbox.pack_end(button_back, False, True, 0)
        button_back.connect('clicked', self.dialog_back)

        button_dismiss = Gtk.Button(label=btn_label_dismiss)
        hbox.pack_end(button_dismiss, False, True, 0)
        button_dismiss.connect('clicked', lambda widget: Gtk.main_quit())

        self.next_button = button_next
        self.dismiss_button = button_dismiss
        self.back_button = button_back

        return hbox

    def dialog_back (self, widget):
        if self.step > PANEL_START:
            self.prev_step = self.step
            self.step = self.step - 1
            self.dialog_adjust()

    def dialog_next (self, widget):
        self.prev_step = self.step
        self.step = self.step + 1
        self.dialog_adjust()

    ## Adjust the dialog box after changes in state.
    ##
    def dialog_adjust (self):
        
        self.map_drive_update()
        if self.complete:
            ## The task is complete, hide the buttons and rename one to Close.
            close_text = _("Close")
            self.next_button.hide()
            self.back_button.hide()
            self.dismiss_button.set_label(close_text)
        
        if self.step >= PANEL_START:
            step = self.step
            panel = self.panels[self.panel_at[step]]
            if self.step > self.prev_step:
                self.stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT)
            else:
                self.stack.set_transition_type(Gtk.StackTransitionType.SLIDE_RIGHT)
            
            self.stack.set_visible_child(panel)
        
        if self.step == PANEL_START:
            self.back_button.set_sensitive(False)
        else:
            self.back_button.set_sensitive(True)
    
    ## When the user clicks "Next" or "Back" this function is
    ## called to update the state.
    ##
    def map_drive_update (self):
        
        step = self.step
        prev_step = self.prev_step
        if step == 0:
            if prev_step > 0:
                while (len(self.panel_at) > 1):
                    self.panel_at.pop()
            return
        
        if (prev_step == 0) and (step > prev_step):
            self.add_unc.hide()
            str0 = self.panel_1_entry.get_text()
            str0 = str0.strip()
            if str0 == '':
                self.prev_step = -1
                self.step = PANEL_START
                return
            
            x = re.match("^sftp:/{2}.", str0, re.IGNORECASE)
            if x != None:
                ## SSH SFTP
                self.map_drive_update_step_1_sftp(str0)
                return
            
            x = re.match("^ssh:/{2}(.+)$", str0, re.IGNORECASE)
            if x != None:
                ## SSH SFTP
                self.map_drive_update_step_1_sftp("sftp://" + str0)
                return
            
            x = re.match("^http:/{2}(.+)$", str0, re.IGNORECASE)
            if x != None:
                ## Most likely WebDAV (http)
                self.map_drive_update_step_1_dav("dav://" + x[1])
                return
            
            x = re.match("^https:/{2}(.+)$", str0, re.IGNORECASE)
            if x != None:
                ## Most likely WebDAV (https)
                self.map_drive_update_step_1_dav("davs://" + x[1])
                return
            
            x = re.match("^davs?:/{2}.", str0, re.IGNORECASE)
            if x != None:
                ## WebDAV
                self.map_drive_update_step_1_dav(str0)
                return
            
            x = re.match("^ftps?:/{2}.", str0, re.IGNORECASE)
            if x != None:
                ## FTP
                self.map_drive_update_step_1_ftp(str0)
                return
            
            x = re.match("^\\\\{2}([\\w-]+)\\\\+(.+)$", str0, re.IGNORECASE)
            if x != None:
                ## "netbeui"-style UNC (no dots in host)
                self.add_unc_server = x[1]
                host = url_parse.quote(x[1])
                path = re.sub("\\\\+", "/", x[2])
                self.add_unc_folder = path.split("/")[0]
                self.add_unc.show()
                path = url_parse.quote(path)
                self.map_drive_update_step_1_smb('smb://' + host + '.local/' + path)
                return
            
            x = re.match("^[\\\\/]{2}([\\w-]+\\.[\\w.-]+)[\\\\/]+(.+)$", str0, re.IGNORECASE)
            if x != None:
                ## DNS-based UNC (has dots in host)
                self.add_unc_server = x[1]
                host = url_parse.quote(x[1])
                path = re.sub("\\\\+", "/", x[2])
                self.add_unc_folder = path.split("/")[0]
                self.add_unc.show()
                path = url_parse.quote(path)
                self.map_drive_update_step_1_smb('smb://' + host + '/' + path)
                return
            
            x = re.match("^smb:/{2}([^/]+?)/.", str0, re.IGNORECASE)
            if x != None:
                ## URL-based SMB
                self.map_drive_update_step_1_smb(str0)
                return
            
            x = re.match("^/", str0)
            if x != None:
                ## Absolute local path
                if os.path.isdir(str0):
                    self.map_drive_update_step_1_local(str0)
                else:
                    self.map_drive_update_not_found(str0)
                return
                
            x = re.match("^[a-z]:[/\\\\]", str0, re.IGNORECASE)
            if x != None:
                ## Wine drive letter absolute path
                str0 = self.wine_path(str0)
                if str0 != None:
                    if os.path.isdir(str0):
                        self.map_drive_update_step_1_local(str0)
                    else:
                        self.map_drive_update_not_found(str0)
                    
                else:
                    self.map_drive_update_winepath_error()
                return
                
            x = re.match("^file:/{3}([a-z])[:\\|][/\\\\](.+)$", str0, re.IGNORECASE)
            if x != None:
                ## Wine path as file:/// URL
                str0 = x[1] + ":/" + url_parse.unquote(x[2])
                str0 = self.wine_path(str0)
                if str0 != None:
                    if os.path.isdir(str0):
                        self.map_drive_update_step_1_local(str0)
                    else:
                        self.map_drive_update_not_found(str0)
                    
                else:
                    self.map_drive_update_winepath_error()
                return
                
            x = re.match("^file:/{3}([^/].+)$", str0, re.IGNORECASE)
            if x != None:
                ## file:/// URL
                str0 = "/" + url_parse.unquote(x[1])
                if os.path.isdir(str0):
                    self.map_drive_update_step_1_local(str0)
                else:
                    self.map_drive_update_not_found(str0)
                return
                
            x = re.match("^~/", str0)
            if x != None:
                ## User's home directory, indicated in path
                str0 = re.sub("^~/", "", str0)
                str0 = os.path.join(os.getenv("HOME"), str0)
                if os.path.isdir(str0):
                    self.map_drive_update_step_1_local(str0)
                else:
                    self.map_drive_update_not_found(str0)
                return
                
            if os.path.isdir(os.path.join(os.getenv("HOME"), str0)):
                ## User's home directory
                str0 = os.path.join(os.getenv("HOME"), str0)
                self.map_drive_update_step_1_local(str0)
                return
            
            self.map_drive_update_not_found(str0)
            return
        
        if self.task == 'smb':
            if step > prev_step:
                if prev_step == 1:
                    self.map_drive_smb()
                    return
            return
        
        if self.task == 'webdav':
            if step > prev_step:
                if prev_step == 1:
                    self.map_drive_webdav()
                    return
            return
        
        if self.task == 'ftp':
            if step > prev_step:
                if prev_step == 1:
                    self.map_drive_ftp()
                    return
            return
        
        if self.task == 'sftp':
            if step > prev_step:
                if prev_step == 1:
                    self.map_drive_sftp()
                    return
            return

    def map_drive_update_step_1_local (self, str0):
        self.task = 'local'
        self.task_opts = {}
        self.task_opts['path'] = str0
        
        driveletter = self.get_drive_letter()
        if driveletter != None:
            if map_drive_local(self.prefix, str0, driveletter):
                self.panel_at.append(PANEL_DONE)
                self.complete = 1
            else:
                self.could_not_symlink()
            
        else:
            self.could_not_use_drive_letter()

    def map_drive_update_step_1_sftp (self, str0):
        x = re.match("^sftp:/{2}([^@]+@)?([^/]+)(/.*)?", str0, re.IGNORECASE)
        if x != None:
            urla = x[1]
            host = x[2]
            extrafolders = x[3]
            user = ''
            if urla != None:
                x2 = re.match("^([^:]+)(:.+)@$", urla)
                if x2 != None:
                    user = x2[1]
                
            if extrafolders == None:
                extrafolders = '/'
            
            urluser = ''
            if user != '':
                urluser = user + '@'
            
            urlshare = 'sftp://' + urluser + host + '/'

            ## STEPS:
            ## 1. Run file manager with sftp:... URL
            ## 2. Wait for and then find in GVFS mount folder
            ## 3. Map it with map_drive_local(...)

            msg_sftp_share = _("Mounting SFTP (SSH) share.")
            self.mounting_label.set_text(msg_sftp_share)
            
            self.task = 'sftp'
            self.task_opts = {}
            self.task_opts['urlshare'] = urlshare
            self.task_opts['host'] = host
            self.task_opts['user'] = user
            self.task_opts['extrafolders'] = extrafolders
            
            self.panel_at.append(PANEL_MOUNT_STEP)
            self.panel_at.append(PANEL_DONE)
        else:
            self.step = self.prev_step
            self.prev_step = -1
    
    def map_drive_update_step_1_ftp (self, str0):
        x = re.match("^(ftps?):/{2}([^@]+@)?([^/]+)(/.*)?", str0, re.IGNORECASE)
        if x != None:
            urlproto = x[1]
            urla = x[2]
            host = x[3]
            ssl = 'false'
            extrafolders = x[4]
            if urlproto.lower() == 'ftps':
                ssl = 'true'
            
            user = ''
            if urla != None:
                x = re.match("^([^:]+)(:.+)@$", urla, re.IGNORECASE)
                if x != None:
                    user = x[1]
                
            
            if extrafolders == None:
                extrafolders = '/'
            
            urluser = ''
            if user != '':
                urluser = user + '@'
            
            if ssl == 'false':
                urlproto = 'ftp'
            
            urlshare = urlproto + '://' + urluser + host + '/'

            ## STEPS:
            ## 1. Run file manager with ftp:... or ftps:... URL
            ## 2. Wait for and then find in GVFS mount folder
            ## 3. Map it with map_drive_local(...)

            msg_ftp_share = _("Mounting FTP share.")
            self.mounting_label.set_text(msg_ftp_share)
            
            self.task = 'ftp'
            self.task_opts = {}
            self.task_opts['urlshare'] = urlshare
            self.task_opts['host'] = host
            self.task_opts['ssl'] = ssl
            self.task_opts['user'] = user
            self.task_opts['extrafolders'] = extrafolders
            
            self.panel_at.append(PANEL_MOUNT_STEP)
            self.panel_at.append(PANEL_DONE)
        else:
            self.step = self.prev_step
            self.prev_step = -1
    
    def map_drive_update_step_1_smb (self, str0):
        
        x = re.match("^smb:/{2}([^/]+?)/([^/]+)(/.*)?", str0, re.IGNORECASE)
        if x != None:
            host = url_parse.unquote(x[1])
            share = url_parse.unquote(x[2])
            extrafolders = x[3]
            urlshare = "smb://" + x[1] + "/" + x[2]

            if extrafolders == None:
                extrafolders = ''
            
            extrafolders = url_parse.unquote(extrafolders)

            ## STEPS:
            ## 1. Run file manager with smb://.../ URL
            ## 2. Wait for and then find in GVFS mount folder
            ## 3. Map it with map_drive_local(...)
            
            msg_network_share = _("Mounting network share.")
            self.mounting_label.set_text(msg_network_share)

            self.task = 'smb'
            self.task_opts = {}
            self.task_opts['urlshare'] = urlshare
            self.task_opts['host'] = host
            self.task_opts['share'] = share
            self.task_opts['extrafolders'] = extrafolders
            
            self.panel_at.append(PANEL_MOUNT_STEP)
            self.panel_at.append(PANEL_DONE)

        else:
            self.step = self.prev_step
            self.prev_step = -1
        
    def map_drive_update_step_1_dav (self, str0):
        x = re.match("^dav(s)?:/{2}([^/]+)(/.+)?", str0, re.IGNORECASE)
        if x != None:
            host = x[2]
            ssl = 'false'
            dav_prefix = x[3]
            dav_prefix_list = []
            if dav_prefix != None:
                dav_prefix_list = dav_prefix.split('/')
                if dav_prefix_list[0] == '':
                    dav_prefix_list.pop(0)
                
            if (x[1] != None) and (x[1].lower() == 's'):
                ssl = 'true'
            
            ## STEPS:
            ## 1. Run file manager with dav://.../ or davs://.../ URL
            ## 2. Wait for and then find in GVFS mount folder
            ## 3. Map it with map_drive_local(...)
            
            msg_webdav_share = _("Mounting WebDAV share.")
            self.mounting_label.set_text(msg_webdav_share)

            self.task = 'webdav'
            self.task_opts = {}
            self.task_opts['urlshare'] = str0
            self.task_opts['host'] = host
            self.task_opts['ssl'] = ssl
            self.task_opts['prefix_list'] = dav_prefix_list
            
            self.panel_at.append(PANEL_MOUNT_STEP)
            self.panel_at.append(PANEL_DONE)
        else:
            self.step = self.prev_step
            self.prev_step = -1
    
    ## When mappind drive to local path and the path does not exist.
    def map_drive_update_not_found (self, str0):
        
        folder_not_found = _("Could not find folder.")
        self.step = self.prev_step
        self.prev_step = -1
        self.error_dialog(folder_not_found + "\n\n" + str0)

    ## When mappind drive to network share or webdav and after the
    ## mounting process the mounted folder does not exist.
    def map_drive_update_share_not_found (self, location):
        
        folder_not_found = _("Could not find mounted share, " +
            "make sure to mount the file system first.")
        self.step = self.prev_step
        self.prev_step = -1
        self.error_dialog(folder_not_found + "\n\n" + location)

    ## When winepath returns an error
    def map_drive_update_winepath_error (self):
        
        winepath_error_label = _("Winepath error.")
        self.step = self.prev_step
        self.prev_step = -1
        self.error_dialog(winepath_error_label)


    ##
    ## Mount share
    ##

    def dialog_mount_step_clicked(self, widget):
        ## Launch file manager
        url = self.task_opts["urlshare"]
        filemanager = get_file_manager()
        subprocess.call(filemanager.replace("%U", "'" + url + "'") + " &", shell=True)

    def dialog_mount_step (self):
        
        msg_mounting = _("Mounting:")
        msg = _("To mount the file system, the file manager will be " +
            "launched, and if the file system is not yet mounted, the file " +
            "manager will mount it for you. After mounting the share, return back " +
            "to this window. Don't unmount until after the drive letter is " +
            "mapped.")
        btn_label_launch = _("Launch file manager")
        msg_after = _("After launching the file manager and having " +
            "mounted the share, proceed to the next step.")

        panel1 = Gtk.VBox()
        label_mounting = Gtk.Label(label="")
        label_mounting.set_xalign(0.0)
        label_mounting.set_line_wrap(True)
        panel1.pack_start(label_mounting, False, True, 20)
        self.mounting_label = label_mounting

        label = Gtk.Label(label=msg)
        label.set_xalign(0.0)
        label.set_line_wrap(True)
        panel1.pack_start(label, False, True, 0)

        button_launch = Gtk.Button(label=btn_label_launch)
        panel1.pack_start(button_launch, False, False, 0)
        button_launch.connect('clicked', self.dialog_mount_step_clicked)

        label2 = Gtk.Label(label=msg_after)
        label2.set_xalign(0.0)
        label2.set_line_wrap(True)
        panel1.pack_start(label2, False, True, 30)
        
        self.add_unc = Gtk.CheckButton(label=_("Also link UNC path for applications to use."))
        panel1.pack_start(self.add_unc, False, True, 0)
        
        return panel1


    ##
    ##

    def choose_folder_browse (self, entry):
        
        title = _("Choose Folder")
        
        browse_dialog = Gtk.FileChooserDialog(
            title=title,
            parent=self,
            action=Gtk.FileChooserAction.SELECT_FOLDER,
            )
        browse_dialog.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_OPEN, Gtk.ResponseType.OK
        )
        browse_dialog.set_default_size(800, 400)
        response = browse_dialog.run()
        if response == Gtk.ResponseType.OK:
            filenm = browse_dialog.get_filename()
            entry.set_text(filenm)
        browse_dialog.destroy()


    ## Show examples of paths that can be entered.
    ##
    def path_examples (self):
        
        msg_xmp = self.example_paths()

        d = Gtk.MessageDialog(
            transient_for=self,
            modal=True,destroy_with_parent=True,
            message_type=Gtk.MessageType.INFO,
            buttons=Gtk.ButtonsType.OK,
            text=msg_xmp,
            )
        d.run()
        d.destroy()

    def example_paths (self):
        return _("Examples:\n\n" +
            "\\\\Computer\\SharedFolder\n" +
            "smb://Server.local/SharedFolder/\n" +
            "https://127.0.0.1/webdav/\n" +
            "sftp://user@127.0.0.1/ (SSH SFTP)\n" +
            "/path/to/file/\n" +
            "~/folder/"
            )

    def dialog_step_1 (self):
        
        msg = _("Path:")
        msg2 = _("Path can be a local file path, network share, WebDAV, SSH SFTP, or FTP.")
        msg3 = _("Map to drive letter:")

        avail_drives = self.avail_drives

        panel1 = Gtk.VBox()
        label = Gtk.Label(label=msg)
        label.set_xalign(0.0)
        panel1.pack_start(label, False, True, 0)
        entry = Gtk.Entry()
        entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, "info")
        entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, self.example_paths())
        
        panel1.pack_start(entry, False, True, 0)

        panel1b = Gtk.HBox()
        btn_label_browse = _("Browse Folder...")
        button_browse = Gtk.Button(label=btn_label_browse)
        panel1b.pack_end(button_browse, False, True, 0)
        button_browse.connect('clicked', lambda widget: self.choose_folder_browse(entry))

        panel1.pack_start(panel1b, False, False, 0)

        label2 = Gtk.Label(label=msg2)
        label2.set_xalign(0.0)
        label2.set_margin_bottom(20)
        panel1.pack_start(label2, False, True, 0)

        entry.connect('icon-release', lambda widget, _pos, _event: self.path_examples())


        label3 = Gtk.Label(label=msg3)
        label3.set_xalign(0.0)
        panel1.pack_start(label3, False, True, 0)
        drivelist_store = Gtk.ListStore(str)
        for x in avail_drives:
            drivelist_store.append([x])
        
        driveletter = Gtk.ComboBox.new_with_model(drivelist_store)
        panel1.pack_start(driveletter, False, True, 0)

        drivelist_cell = Gtk.CellRendererText()
        driveletter.pack_start(drivelist_cell, False)
        driveletter.add_attribute(drivelist_cell, 'text', 0)

        ## Select by default the next drive after A: and B:
        firstdrive = 2
        if len(avail_drives) < 3:
            firstdrive = len(avail_drives) - 1
        

        driveletter.set_active(firstdrive)

        self.panel_1_entry = entry
        self.panel_1_driveletter = driveletter

        entry.connect('activate', lambda widget: self.dialog_next(widget))

        return panel1


    ##
    ##


    def map_drive_sftp (self):
        
        host = self.task_opts["host"].lower()
        user = self.task_opts["user"].lower()
        extrafolders = self.task_opts["extrafolders"]
        found = ''
        dirl = self.gvfs_path()
        dir_list = os.listdir(dirl)
        
        for x in dir_list:
            if x == '.' or x == '..':
                continue
            x2 = re.match("^sftp:(.+)$", x, re.IGNORECASE)
            if x2 != None:
                mount = x
                share_options = x2[1].split(',')
                found_options = {}
                found_options['host'] = 0
                found_options['user'] = 0
                
                for x2 in share_options:
                    [key, val] = x2.split('=')
                    val = url_parse.unquote(val)
                    if (key == 'host') and (host == val.lower()):
                        found_options[key] = 1
                    
                    if (key == 'user') and (user == val.lower()):
                        found_options[key] = 1
                    
                
                if user == '':
                    found_options['user'] = 1
                
                if (found_options['host'] == 1) and (found_options['user'] == 1):
                    found = mount
                    break
        
        if found != '':
            driveletter = self.get_drive_letter()
            if driveletter != None:
                path = dirl + found + extrafolders
                if os.path.isdir(path):
                    if map_drive_local(self.prefix, path, driveletter):
                        self.panel_at.append(PANEL_DONE)
                        self.complete = 1
                    else:
                        self.could_not_symlink()
                    
                else:
                    self.could_not_find_share_subfolder(extrafolders)
                
            else:
                self.could_not_use_drive_letter()
            
        else:
            self.map_drive_update_share_not_found(
                "sftp host=" + host + " user=" + user)
    
    def map_drive_ftp (self):
        
        host = self.task_opts["host"].lower()
        user = self.task_opts["user"].lower()
        ssl = self.task_opts["ssl"].lower()
        extrafolders = self.task_opts["extrafolders"]
        found = ''
        dirl = self.gvfs_path()
        dir_list = os.listdir(dirl)
        for x in dir_list:
            if x == '.' or x == '..':
                continue
            x2 = re.match("^ftp:(.+)$", x, re.IGNORECASE)
            if x2 != None:
                mount = x
                share_options = x2[1].split(',')
                found_options = {}
                found_options['host'] = 0
                found_options['user'] = 0
                
                for x2 in share_options:
                    [key, val] = x2.split('=')
                    val = url_parse.unquote(val)
                    if (key == 'host') and (host == val.lower()):
                        found_options[key] = 1
                    
                    if (key == 'user') and (user == val.lower()):
                        found_options[key] = 1
                    
                
                if user == '':
                    found_options['user'] = 1
                
                if (found_options['host'] == 1) and (found_options['user'] == 1):
                    found = mount
                    break
                
        if found != '':
            driveletter = self.get_drive_letter()
            if driveletter != None:
                path = dirl + found + extrafolders
                if os.path.isdir(path):
                    if map_drive_local(self.prefix, path, driveletter):
                        self.panel_at.append(PANEL_DONE)
                        self.complete = 1
                    else:
                        self.could_not_symlink()
                    
                else:
                    self.could_not_find_share_subfolder(extrafolders)
                
            else:
                self.could_not_use_drive_letter()
            
        else:
            self.map_drive_update_share_not_found(
                "ftp host=" + host + " user=" + user)
        
    def map_drive_smb (self):
        
        host = self.task_opts["host"].lower()
        share = self.task_opts["share"].lower()
        found = ''
        dirl = self.gvfs_path()
        extrafolders = self.task_opts["extrafolders"]
        dir_list = os.listdir(dirl)
        for x in dir_list:
            if x == '.' or x == '..':
                continue
            x2 = re.match("^smb-share:(.+)$", x, re.IGNORECASE)
            if x2 != None:
                mount = x
                share_options = x2[1].split(',')
                found_options = {}
                found_options['server'] = 0,
                found_options['share'] = 0
                
                for x2 in share_options:
                    [key, val] = x2.split('=')
                    if (key == 'server') and (host == val.lower()):
                        found_options[key] = 1
                    
                    if (key == 'share') and (share == val.lower()):
                        found_options[key] = 1
                
                if (found_options['server'] == 1) and (found_options['share'] == 1):
                    found = mount
                    break
                
        if found != '':
            driveletter = self.get_drive_letter()
            if driveletter != None:
                path = dirl + found + extrafolders
                if os.path.isdir(path):
                    if self.add_unc.get_active() == True:
                        linked_unc = False
                        linked_unc = link_unc_path(self.prefix, self.add_unc_server, self.add_unc_folder, dirl + found)
                        if linked_unc != True:
                            self.could_not_symlink_unc()
                    if map_drive_local(self.prefix, path, driveletter):
                        self.panel_at.append(PANEL_DONE)
                        self.complete = 1
                    else:
                        self.could_not_symlink()
                    
                else:
                    self.could_not_find_share_subfolder(extrafolders)
                
            else:
                self.could_not_use_drive_letter()
            
        else:
            self.map_drive_update_share_not_found(
                "//" + host + "/" + share)
        
    def map_drive_webdav (self):
        
        host = self.task_opts["host"].lower()
        ssl = self.task_opts["ssl"].lower()
        dav_prefix_list = self.task_opts["prefix_list"]
        extrafolders = ''
        found = ''
        dirl = self.gvfs_path()
        dir_list = os.listdir(dirl)
        for x in dir_list:
            if x == '.' or x == '..':
                continue
            x2 = re.match("^dav:(.+)$", x, re.IGNORECASE)
            if x2 != None:
                mount = x
                share_options = x2[1].split(',')
                found_options = {}
                found_options['host'] = 0
                found_options['ssl'] = 0
                found_options['prefix'] = 0
                
                for x2 in share_options:
                    [key, val] = x2.split('=')
                    val = url_parse.unquote(val)
                    if (key == 'host') and (host == val.lower()):
                        found_options[key] = 1
                    
                    if (key == 'ssl') and (ssl == val):
                        found_options[key] = 1
                    
                    if key == 'prefix':
                        ## The DAV prefix could be any part of the path
                        for i in range(0, 1+len(dav_prefix_list)):
                            dav_prefix = ''
                            extrafolders_list = dav_prefix_list
                            for j in range(0, i):
                                dav_prefix = dav_prefix + '/' + extrafolders_list.pop(0)
                            
                            if (val == dav_prefix) or (val == (dav_prefix + '/')):
                                found_options[key] = 1
                                extrafolders = '/' + extrafolders_list.join('/')
                                break
                            
                if (found_options['host'] == 1) and (found_options['ssl'] == 1) and (found_options['prefix'] == 1):
                    found = mount
                    break
        
        if found != '':
            driveletter = self.get_drive_letter()
            if driveletter != None:
                path = dirl + found + extrafolders
                if os.path.isdir(path):
                    if map_drive_local(self.prefix, path, driveletter):
                        self.panel_at.append(PANEL_DONE)
                        self.complete = 1
                    else:
                        self.could_not_symlink()
                    
                else:
                    self.could_not_find_share_subfolder(extrafolders)
                
            else:
                self.could_not_use_drive_letter()
            
        else:
            self.map_drive_update_share_not_found(
                "dav host=" + host +
                " path=" + dav_prefix_list.join('/'))
        
    def dialog_complete (self):
        
        msg = _("Drive mapping complete")
        
        panel1 = Gtk.VBox()
        label = Gtk.Label(label=msg)
        label.set_xalign(0.0)
        panel1.pack_start(label, False, True, 0)
        
        return panel1

    ## When the folder inside of the mounted file system does not exist.
    def could_not_find_share_subfolder (self, extrafolders):
        
        could_not_ln = _("The share was mounted successfully, " +
            "but the specified subfolder was not found, " +
            "you might need to create it:")

        self.step = self.prev_step
        self.prev_step = -1

        self.error_dialog(could_not_ln + "\n\n" + extrafolders)

    ## When the drive letter is unavailable to map.
    def could_not_use_drive_letter (self):
        
        could_not_use_letter = _("Could not use drive letter.")

        self.error_dialog(could_not_use_letter)

    ## When there was an error making the symlink.
    def could_not_symlink (self):
        
        could_not_ln = _("Could not create link.")

        self.step = self.prev_step
        self.prev_step = -1
        self.error_dialog(could_not_ln)

    def could_not_symlink_unc (self):
        
        could_not_ln = _("Could not create link for UNC path.")

        self.step = self.prev_step
        self.prev_step = -1
        self.error_dialog(could_not_ln)

    def get_drive_letter (self):
        prefix = self.prefix
        wineprefix = prefix["prefix"]
        active = self.panel_1_driveletter.get_active()
        if (active < 0) or (active >= len(self.avail_drives)):
            return None
        
        letter = self.avail_drives[active].lower()
        dirl = os.path.join(wineprefix, "dosdevices", letter)
        if os.path.isdir(dirl) or os.path.islink(dirl):
            return None
        
        return letter

    def error_dialog (self, message):
        d = Gtk.MessageDialog(
            transient_for=self,
            modal=True,destroy_with_parent=True,
            message_type=Gtk.MessageType.WARNING,
            buttons=Gtk.ButtonsType.OK,
            text=message,
            )
        d.run()
        d.destroy()

    ## Get the actual path from a wine path.
    def wine_path (self, str0):
        wineprefix = self.prefix
        #winecmd = self.wine_cmd
        str0 = re.sub("\\\\+", "/", str0)
        try:
            env = os.environ
            env["WINEPREFIX"] = wineprefix
            str1 = subprocess.check_output(["winepath",str0],env=env)
            x = re.match("^([^\r\n]+)", str1)
            if x != None:
                return x[1]
            return None
        except subprocess.CalledProcessError:
            return None

    ## Where to find the GVFS mounts (may depend on OS)
    def gvfs_path (self):
        uid = os.getuid()
        return GVFS_PATH.format(str(uid))



def map_drive_dialog (prefix):
    no_drives_avail = _("No drives are available to map.")
    avail_drives = list_avail_drives(prefix)
    if (avail_drives == None) or (len(avail_drives) < 1):
        d = Gtk.MessageDialog(
                transient_for=None,
                modal=True,destroy_with_parent=True,
                message_type=Gtk.MessageType.WARNING,
                buttons=Gtk.ButtonsType.OK,
                text=no_drives_avail,
                )
        d.run()
        d.destroy()
        return

    window = MapDriveDialog(prefix, avail_drives)
    window.show_all()
    window.dialog_adjust()
    Gtk.main()

def map_drive ():
    wine_cmd = 'wine'
    
    action = sys.argv[1]
    
    if len(sys.argv) < 3:
        if os.getenv('HOME') == None:
            sys.exit(1)
        prefix = os.getenv('HOME') + "/.wine"
    else:
        prefix = sys.argv[2]
        if len(sys.argv) > 3:
            wine_cmd = sys.argv[3]
    
    prefix1 = {}
    prefix1['prefix'] = prefix
    prefix1['wine_cmd'] = wine_cmd
    
    if action == 'map-drive':
        map_drive_dialog(prefix1)
        return


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: <action> <prefix> <winecommand>",file=sys.stderr)
        sys.exit(1)
    map_drive()


