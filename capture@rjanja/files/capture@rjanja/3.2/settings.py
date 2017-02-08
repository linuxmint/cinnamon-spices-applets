#!/usr/bin/python

'''
Settings app for Cinnamon Desktop Capture applet
@author Rob Adams <radams@artlogic.com>
'''

try:
    import os
    import json
    import collections
    import string
    import gettext
    from gi.repository import Gio, Gtk, GObject
    import gconf
    import pprint
except Exception, detail:
    print detail
    sys.exit(1)

from gettext import gettext as _

support_file = os.path.dirname(os.path.abspath(__file__)) + "/support.json"
settings_file = os.path.dirname(os.path.abspath(__file__)) + "/settings.json"

def which(program):
    import os
    def is_exe(fpath):
        return os.path.isfile(fpath) and os.access(fpath, os.X_OK)

    fpath, fname = os.path.split(program)
    if fpath:
        if is_exe(program):
            return program
    else:
        for path in os.environ["PATH"].split(os.pathsep):
            exe_file = os.path.join(path, program)
            if is_exe(exe_file):
                return exe_file

    return None

def load_support():
    f = open(support_file, 'r')
    support = json.loads(f.read(), object_pairs_hook=collections.OrderedDict)
    f.close()
    
    return support

def load_settings():
    f = open(settings_file, 'r')
    settings = json.loads(f.read(), object_pairs_hook=collections.OrderedDict)
    f.close()
    
    return settings

def get_settings_key(key):
    return settings[key]

def set_settings_key(key, value):
    settings[key] = value
    save_settings()
    return True

def save_settings():
    f = open(settings_file, 'w')
    f.write(json.dumps(settings, sort_keys=False, indent=3))
    f.close()

def get_resource_path(rel_path):
    dir_of_py_file = os.path.dirname(__file__)
    rel_path_to_resource = os.path.join(dir_of_py_file, rel_path)
    abs_path_to_resource = os.path.abspath(rel_path_to_resource)
    return abs_path_to_resource

class MyWindow(Gtk.Window):
    def camera_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            model = widget.get_model()
            value = model[tree_iter][1]
            set_settings_key('camera-program', value)
            self.cameraApp = value
            if value == "cinnamon":
              self.set_camera_tab(True)
            else:
              self.set_camera_tab(False)
            #self.maybe_show_tabs()

    def recorder_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            model = widget.get_model()
            value = model[tree_iter][1]
            set_settings_key('recorder-program', value)
            self.recorderApp = value
            if value == "cinnamon":
              self.pipeline_input.set_sensitive(True)
              self.set_recorder_tab(True)
            else:
              self.pipeline_input.set_sensitive(False)
              self.set_recorder_tab(False)
            #self.maybe_show_tabs()

    def clipboard_type_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            model = widget.get_model()
            value = model[tree_iter][0]
            set_settings_key('copy-to-clipboard', value)
            self.copyClipboardType = value
            self.cbClipboardEnabled.set_active(self.copyClipboardType > 0)
            print "clipboard value is %d" % value

    def delay_changed(self, widget):
        delay = int(widget.get_value())
        set_settings_key('delay-seconds', delay)
        self.delay = delay

    def fps_changed(self, widget):
        fps = widget.get_value()
        crSettings.set_int('framerate', fps)

    def pipeline_changed(self, widget):
        pipeline = widget.get_text()
        crSettings.set_string('pipeline', pipeline)

    def directory_filter_func(chooser, info, data):
        return os.path.isdir(info.filename)

    def on_camera_browse(self, widget):
        mode = Gtk.FileChooserAction.SELECT_FOLDER
        string = _("Select a directory to use")
        dialog = Gtk.FileChooserDialog(string,
                                       None,
                                       mode,
                                       (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                        Gtk.STOCK_OPEN, Gtk.ResponseType.OK))
        filt = Gtk.FileFilter()
        filt.set_name(_("Directories"))
        filt.add_custom(Gtk.FileFilterFlags.FILENAME, self.directory_filter_func, None)
        dialog.add_filter(filt)

        dialog.set_filename(self.cameraSaveDir)
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            self.camera_save_dir.set_text(filename)
            self.cameraSaveDir = filename
            set_settings_key('camera-save-dir', filename)
        dialog.destroy()

    def on_recorder_browse(self, widget):
        mode = Gtk.FileChooserAction.SELECT_FOLDER
        string = _("Select a directory to use")
        dialog = Gtk.FileChooserDialog(string,
                                       None,
                                       mode,
                                       (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                        Gtk.STOCK_OPEN, Gtk.ResponseType.OK))
        filt = Gtk.FileFilter()
        filt.set_name(_("Directories"))
        filt.add_custom(Gtk.FileFilterFlags.FILENAME, self.directory_filter_func, None)
        dialog.add_filter(filt)

        dialog.set_filename(self.cameraSaveDir)
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            filename = dialog.get_filename()
            self.recorder_save_dir.set_text(filename)
            self.recorderSaveDir = filename
            set_settings_key('recorder-save-dir', filename)
        dialog.destroy()

    #def camera_save_dir_changed(self, widget):
    #    save_dir = widget.get_filename()
    #    if save_dir != self.cameraSaveDir:
    #       set_settings_key('camera-save-dir', save_dir)
    #       self.cameraSaveDir = save_dir

    #def recorder_save_dir_changed(self, widget):
    #    save_dir = widget.get_filename()
    #    if save_dir != self.recorderSaveDir:
    #       set_settings_key('recorder-save-dir', save_dir)
    #       self.recorderSaveDir = save_dir

    def camera_save_dir_changed(self, widget):
        newdir = os.path.expanduser(widget.get_text())
        if (os.path.isdir(newdir)):
            set_settings_key('camera-save-dir', newdir)
            self.cameraSaveDir = newdir

    def recorder_save_dir_changed(self, widget):
        newdir = os.path.expanduser(widget.get_text())
        if (os.path.isdir(newdir)):
            set_settings_key('recorder-save-dir', newdir)
            self.recorderSaveDir = newdir

    def camera_save_name_changed(self, widget):
        save_prefix = widget.get_text()
        set_settings_key('camera-save-prefix', save_prefix)
        self.cameraSavePrefix = save_prefix

    def recorder_save_name_changed(self, widget):
        save_prefix = widget.get_text()
        set_settings_key('recorder-save-prefix', save_prefix)
        self.recorderSavePrefix = save_prefix

    def set_camera_tab(self, status=False):
        notebook = self.builder.get_object('notebookCamera')
        notebook.set_sensitive(status)
        #page = self.builder.get_object('boxPage2')
        #page.set_sensitive(status)

    def set_recorder_tab(self, status=False):
        fps = self.builder.get_object('fps_spin')
        fps.set_sensitive(status)
        pipeline = self.builder.get_object('pipeline_input')
        pipeline.set_sensitive(status)
        #page = self.builder.get_object('boxPage3')
        #page.set_sensitive(status)

    def maybe_show_tabs(self):
        if self.cameraApp != "cinnamon" and self.recorderApp != "cinnamon":
           self.notebook.set_show_tabs(False)
           return False
        else:
           self.notebook.set_show_tabs(True)
           return True

    def notebook_page_changed(self, notebook, page, page_num):
        set_settings_key('last-selected-page', page_num)

    def notebook_subpage_changed(self, notebook, page, page_num):
        set_settings_key('last-selected-subpage', page_num)

    def checkbox_toggled(self, button):
        buttonId = Gtk.Buildable.get_name(button)
        settingsKey = self.checkboxMap[buttonId]
        set_settings_key(settingsKey, button.get_active())

        if settingsKey == 'use-symbolic-icon':
            self.check_set_icon()

    def clipboard_toggled(self, button):
        tree_iter = self.dropdown_clipboard_type.get_active_iter()
        value = 0
        if tree_iter != None:
            model =self.dropdown_clipboard_type.get_model()
            value = model[tree_iter][0]
        
        self.copyClipboardType = max(value,1) if button.get_active() else 0
        set_settings_key('copy-to-clipboard', self.copyClipboardType)
        print self.copyClipboardType
        self.dropdown_clipboard_type.set_active(self.copyClipboardType)

    def check_set_icon(self):
        if get_settings_key('use-symbolic-icon'):
            self.window.set_icon_name('camera-photo-symbolic')
        else:
            self.window.set_icon_name('')
            self.window.set_icon_from_file(get_resource_path("desktop-capture.png"))

    def __init__(self):
        self.builder = Gtk.Builder()
        self.builder.add_from_file(os.path.dirname(os.path.abspath(__file__)) + "/settings.ui")
        self.window = self.builder.get_object("main_window")
        self.button_cancel = self.builder.get_object("button_cancel")
        self.dropdown_camera = self.builder.get_object("dropdown_camera")
        self.dropdown_recorder = self.builder.get_object("dropdown_recorder")
        self.dropdown_clipboard_type = self.builder.get_object("dropdown_clipboard_type")

        self.delay_spin = self.builder.get_object("spin_delay")

        self.fps_spin = self.builder.get_object("fps_spin")
        self.pipeline_input = self.builder.get_object("pipeline_input")
        self.camera_save_dir = self.builder.get_object("camera_save_dir")
        self.camera_save_dir_browse = self.builder.get_object("camera_save_dir_browse")
        self.recorder_save_dir = self.builder.get_object("recorder_save_dir")
        self.recorder_save_dir_browse = self.builder.get_object("recorder_save_dir_browse")
        self.notebook = self.builder.get_object("notebook")
        self.notebookCamera = self.builder.get_object("notebookCamera")

        self.camera_save_name = self.builder.get_object("camera_save_prefix")
        self.recorder_save_name = self.builder.get_object("recorder_save_prefix")

        self.window.connect("destroy", Gtk.main_quit)
        self.button_cancel.connect("clicked", Gtk.main_quit)

        self.notebook.connect("switch-page", self.notebook_page_changed)
        self.notebookCamera.connect("switch-page", self.notebook_subpage_changed)

        # Get current application choices from settings
        self.cameraApp = get_settings_key('camera-program')
        self.recorderApp = get_settings_key('recorder-program')
        fps = crSettings.get_int('framerate')
        pipeline = crSettings.get_string('pipeline')
        self.cameraSaveDir = get_settings_key('camera-save-dir')
        self.recorderSaveDir = get_settings_key('recorder-save-dir')
        self.cameraSavePrefix = get_settings_key('camera-save-prefix')
        self.recorderSavePrefix = get_settings_key('recorder-save-prefix')
        self.delay = get_settings_key('delay-seconds')

        self.camera_save_name.set_text(self.cameraSavePrefix)
        self.recorder_save_name.set_text(self.recorderSavePrefix)

        self.checkboxes = {}
        self.checkboxMap = {
            'cb_window_as_area': 'capture-window-as-area',
            'cb_include_window_frame': 'include-window-frame',
            'cb_camera_flash': 'use-camera-flash',
            'cb_show_timer': 'show-capture-timer',
            'cb_play_shutter_sound': 'play-shutter-sound',
            'cb_play_interval_sound': 'play-timer-interval-sound',
            #'cb_copy_clipboard': 'copy-to-clipboard',
            'cb_send_notification': 'send-notification',
            'cb_use_timer': 'use-timer',
            'cb_include_styles': 'include-styles',
            'cb_open_after': 'open-after',
            'cb_symbolic_icon': 'use-symbolic-icon'
        }

        for x in self.checkboxMap:
            currentSetting = get_settings_key(self.checkboxMap[x])
            self.checkboxes[x] = self.builder.get_object(x)
            self.checkboxes[x].set_active(currentSetting)
            self.checkboxes[x].connect("toggled", self.checkbox_toggled)

        self.copyClipboardType = get_settings_key('copy-to-clipboard')
        self.cbClipboardEnabled = self.builder.get_object('cb_copy_clipboard')
        self.cbClipboardEnabled.set_active(self.copyClipboardType > 0)
        self.cbClipboardEnabled.connect("toggled", self.clipboard_toggled)

        self.clipboard_list_store = Gtk.ListStore(GObject.TYPE_INT, GObject.TYPE_STRING)
        self.clipboard_list_store.append([0, _("Disabled")])
        self.clipboard_list_store.append([1, _("Path and filename")])
        self.clipboard_list_store.append([2, _("Only Directory")])
        self.clipboard_list_store.append([3, _("Only Filename")])
        self.clipboard_list_store.append([4, _("Image data")])
        self.dropdown_clipboard_type.set_model(self.clipboard_list_store)
        
        if isinstance(self.copyClipboardType, bool):
            self.copyClipboardType = 1 if self.copyClipboardType else 0;
            set_settings_key('copy-to-clipboard', self.copyClipboardType)

        self.dropdown_clipboard_type.set_active(self.copyClipboardType)
        cell = Gtk.CellRendererText()
        self.dropdown_clipboard_type.pack_start(cell, True)
        self.dropdown_clipboard_type.add_attribute(cell, "text", 1)
        self.dropdown_clipboard_type.connect('changed', self.clipboard_type_changed)

        lastPage = get_settings_key('last-selected-page')
        lastSubPage = get_settings_key('last-selected-subpage')

        self.delay_spin.set_value(self.delay)
        self.delay_spin.connect('changed', self.delay_changed)

        self.fps_spin.set_value(fps)
        self.fps_spin.connect('changed', self.fps_changed)

        self.pipeline_input.set_text(pipeline)
        self.pipeline_input.connect('changed', self.pipeline_changed)
        
        #self.camera_save_dir.unselect_all()

        self.camera_save_dir.set_text(self.cameraSaveDir)
        self.camera_save_dir_browse.connect("clicked", self.on_camera_browse)
        self.recorder_save_dir.set_text(self.recorderSaveDir)
        self.recorder_save_dir_browse.connect('clicked', self.on_recorder_browse)

        #self.camera_save_dir.set_current_folder(self.cameraSaveDir)
        #self.camera_save_dir.connect('current-folder-changed', self.camera_save_dir_changed)
        
        #self.recorder_save_dir.set_current_folder(self.recorderSaveDir)
        #self.recorder_save_dir.connect('current-folder-changed', self.recorder_save_dir_changed)

        self.camera_save_dir.connect('changed', self.camera_save_dir_changed)
        self.recorder_save_dir.connect('changed', self.recorder_save_dir_changed)

        self.camera_save_name.connect('changed', self.camera_save_name_changed)
        self.recorder_save_name.connect('changed', self.recorder_save_name_changed)

        # Load camera options into combobox
        self.camera_list_store = Gtk.ListStore(GObject.TYPE_STRING, GObject.TYPE_STRING)
        self.camera_list_store.append([_('None'), 'none'])

        i = 1
        useIndex = 0
        for x in support['camera']:
           if which(x) != None and support['camera'][x]['enabled'] == True:
             self.camera_list_store.append([support['camera'][x]['title'], x])

             if x == self.cameraApp:
                 useIndex = i
             i = i + 1

        if self.cameraApp != "cinnamon":
           self.set_camera_tab(False)

        self.dropdown_camera.set_model(self.camera_list_store)
        self.dropdown_camera.set_active(useIndex)

        cell = Gtk.CellRendererText()
        self.dropdown_camera.pack_start(cell, True)
        self.dropdown_camera.add_attribute(cell, "text", 0)
        self.dropdown_camera.connect('changed', self.camera_changed)

        # Load recorder options into combobox
        self.recorder_list_store = Gtk.ListStore(GObject.TYPE_STRING, GObject.TYPE_STRING)
        self.recorder_list_store.append([_('None'), 'none'])
        i = 1
        useIndex = 0
        useRecorderProrgram = None
        for x in support['recorder']:
           if which(x) != None and support['recorder'][x]['enabled'] == True:
             self.recorder_list_store.append([support['recorder'][x]['title'], x])

             if x == self.recorderApp:
                 useIndex = i
             i = i + 1

        if self.recorderApp != "cinnamon":
           self.set_recorder_tab(False)

        self.notebook.set_current_page(lastPage)
        self.notebookCamera.set_current_page(lastSubPage)

        self.dropdown_recorder.set_model(self.recorder_list_store)
        self.dropdown_recorder.set_active(useIndex)

        cell = Gtk.CellRendererText()
        self.dropdown_recorder.pack_start(cell, True)
        self.dropdown_recorder.add_attribute(cell, "text", 0)
        self.dropdown_recorder.connect('changed', self.recorder_changed)

        self.check_set_icon()

        self.window.show()

if __name__ == "__main__":
    settings = load_settings()
    crSettings = Gio.Settings.new('org.cinnamon.recorder')
    support = load_support()

    MyWindow()
    Gtk.main()

