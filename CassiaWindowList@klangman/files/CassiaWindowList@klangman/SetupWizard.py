#!/usr/bin/python3

import sys
import os.path
import subprocess

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gio, GLib
sys.path.append("/usr/share/cinnamon/cinnamon-settings/bin")
from JsonSettingsWidgets import *
from pathlib import Path
import shutil
import glob

UUID = "CassiaWindowList@klangman"

import gettext
gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")
gettext.textdomain(UUID)
_ = gettext.gettext

config_path   = GLib.get_user_config_dir() + "/cinnamon/spices/"
cinnamon_path = GLib.get_home_dir() + "/.cinnamon/configs/"
applets_path  = GLib.get_home_dir() + "/.local/share/cinnamon/applets/"

# Behaviour options "group-windows"
GROUPED  = 0     # All windows for an application should be grouped under a single windowlist button
POOLED   = 1     # All windows for an application should be pooled side-by-side on the windowlist
AUTO     = 2     # Application windows should automatically switch between Grouped and Pooled based on whether button caption space is constrained 
OFF      = 3     # All windows should have there own windowlist button and no ordering is maintained.
LAUNCHER = 4     # Behave like a panel launcher applet, only pinned buttons will be displayed

# Caption/Label options "display-caption-for"
NO      = 0      # No window list buttons will have text captions
ALL     = 1      # All window list buttons will have captions
FOCUSED = 2      # Only the window that has the focus will have a caption
ONE     = 3      # Only one window (the last one in the window list) will have a caption (only really makes sense when also using GroupType.Pooled/Auto)

# Indicator options "display-indicators"
NONE       = 0
MINIMIZED  = 1
PINNED     = 2
BOTH       = 3
AUTO_IND   = 7

# Caption/Label type options "caption-type"
APP_NAME   = 0
WIN_TITLE  = 1

# Launch left click action options
RESTORE    = 1
THUMBNAIL  = 2
NEW_WINDOW = 4

class SetupWizard:
   def __init__(self, uuid=0, instanceId=0):
      self.uuid = uuid;
      self.instanceId = instanceId
      self.builder = Gtk.Builder()
      self.builder.add_from_file(applets_path + uuid + "/SetupWizard.ui")
      self.builder.connect_signals(self)

      configFile = config_path + uuid + "/" + instanceId + ".json"
      self.configFilePath = Path(configFile)
      if (self.configFilePath.is_file() == False):
         configFile = cinnamon_path + uuid + "/" + instanceId + ".json"
         self.configFilePath = Path(configFile)
         print( configFile )
      if (self.configFilePath.is_file() == False):
            print( f"Can't find the config file for instance {instanceId}" )
      else:
         self.settings = JSONSettingsHandler( configFile )
         self.appBehaviour = self.settings.get_value("group-windows")
         self.launcherLeftClick = self.settings.get_value("launcher-mouse-action-btn1")

         self.window = self.builder.get_object("setup_wizard_window")
         self.stack  = self.builder.get_object("stack_id")
         self.welcomePageBox = self.builder.get_object("welcome_page_box")
         self.windowListPage1Box = self.builder.get_object("window_list_page1_box")
         self.windowListPage2Box = self.builder.get_object("window_list_page2_box")
         self.launcherPageBox = self.builder.get_object("launcher_page_box")
         self.donePageBox = self.builder.get_object("done_page_box")
         self.restorePage = self.builder.get_object("restore_page_box")
         self.backupPage = self.builder.get_object("backup_page_box")

         self.nextBtn = self.builder.get_object("next_btn")
         self.previousBtn = self.builder.get_object("previous_btn")
         self.configBtn = self.builder.get_object("config_btn")
         self.previousBtn.set_sensitive(False)

         self.windowListRadio = self.builder.get_object("windowlist_radio")
         self.launcherRadio = self.builder.get_object("launcher_radio")
         self.restoreRadio = self.builder.get_object("restore_radio")

         self.oneToOneRadio = self.builder.get_object("one_to_one_radio")
         self.groupedRadio = self.builder.get_object("grouped_radio")
         self.pooledRadio = self.builder.get_object("pooled_radio")

         self.newWindowRadio = self.builder.get_object("lc_new_window_radio")
         self.lcRestoreRadio = self.builder.get_object("lc_restore_radio")
         self.thumbnailRadio = self.builder.get_object("lc_thumbnail_radio")
         self.mouseHoverChk  = self.builder.get_object("mouse_hover_chkbox")

         if self.appBehaviour == OFF:
            self.oneToOneRadio.set_active(True)
         elif self.appBehaviour == GROUPED:
            self.groupedRadio.set_active(True)
         elif self.appBehaviour == POOLED or self.appBehaviour == AUTO:
            self.pooledRadio.set_active(True)

         if self.launcherLeftClick == RESTORE:
            self.lcRestoreRadio.set_active(True)
         elif self.launcherLeftClick == THUMBNAIL:
            self.thumbnailRadio.set_active(True)
         elif self.launcherLeftClick == NEW_WINDOW:
            self.newWindowRadio.set_active(True);
         else:
            self.newWindowRadio.set_active(True);
            self.settings.set_value("launcher-mouse-action-btn1", NEW_WINDOW)

         self.noLabelChk = self.builder.get_object("no_label_chkbox")
         self.noMinimizedChk = self.builder.get_object("no_minimized_chkbox")
         self.noHoverChk = self.builder.get_object("no_hover_chkbox")
         label = self.settings.get_value("display-caption-for")
         indicators = self.settings.get_value("display-indicators")
         hover = self.settings.get_value("menu-show-on-hover")
         if label == NO:
            self.noLabelChk.set_active(True)
         if indicators == PINNED or indicators == NONE:
            self.noMinimizedChk.set_active(True)
         if hover == False:
            self.noHoverChk.set_active(True);
            self.mouseHoverChk.set_active(False);
         else:
            self.noHoverChk.set_active(False);
            self.mouseHoverChk.set_active(True);

         self.backupFileEntry = self.builder.get_object("backup_file_entry")

         self.backupFileList = self.builder.get_object("backupfile_list")
         backupFileCnt = self.loadRestoreOptions(self.backupFileList)
         if backupFileCnt == 0:
            self.restoreRadio.set_sensitive(False)

         self.window.show_all()
         # Make sure we don't run the setup wizard ever again for this applet instance!
         self.settings.set_value("runWizard", 0)
         Gtk.main()

   def onDestroy(self, widget):
      Gtk.main_quit()

   def onClickNext(self, widget):
      self.stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT)
      curPage = self.stack.get_visible_child()
      if curPage == self.welcomePageBox:
         self.previousBtn.set_sensitive(True)
         if self.windowListRadio.get_active() == True:
            self.stack.set_visible_child(self.windowListPage1Box)
         elif self.launcherRadio.get_active() == True:
            self.stack.set_visible_child(self.launcherPageBox)
         else:
            self.stack.set_visible_child(self.restorePage)
            self.backupFileList.select_row(None)
            self.nextBtn.set_sensitive(False)
      elif curPage == self.windowListPage1Box:
         self.stack.set_visible_child(self.windowListPage2Box)
      elif curPage == self.windowListPage2Box or curPage == self.launcherPageBox:
         self.stack.set_visible_child(self.backupPage)
      elif curPage == self.restorePage:
         backupPath = config_path + self.uuid + "/backup/"
         row = self.backupFileList.get_selected_row()
         label = row.get_child()
         self.settings.load_from_file( backupPath + label.get_label() + ".json" )
         self.backupFileEntry.set_text(label.get_label())
         self.stack.set_visible_child(self.backupPage)
      elif curPage == self.backupPage:
         backupFileName = self.backupFileEntry.get_text();
         backupPath = config_path + self.uuid + "/backup/"
         if backupFileName != None and backupFileName != "":
            saved = self.backupConfigFile(backupPath, backupFileName)
            if saved == True:
               self.settings.set_value("backup-file-name", backupFileName)
         else:
            self.settings.set_value("backup-file-name", "")
         if backupFileName == None or backupFileName == "" or saved == True:
            self.nextBtn.set_label(_("Exit"));
            self.stack.set_visible_child(self.donePageBox)
      elif curPage == self.donePageBox:
         Gtk.main_quit()

   def onClickPrevious(self, widget):
      self.stack.set_transition_type(Gtk.StackTransitionType.SLIDE_RIGHT)
      curPage = self.stack.get_visible_child()
      if curPage == self.windowListPage1Box or curPage == self.launcherPageBox or curPage == self.restorePage:
         self.nextBtn.set_sensitive(True)
         self.previousBtn.set_sensitive(False)
         self.stack.set_visible_child(self.welcomePageBox)
      elif curPage == self.windowListPage2Box:
         self.stack.set_visible_child(self.windowListPage1Box)
      elif curPage == self.backupPage:
         if self.windowListRadio.get_active() == True:
            self.stack.set_visible_child(self.windowListPage2Box)
         elif self.launcherRadio.get_active() == True:
            self.stack.set_visible_child(self.launcherPageBox)
         else:
            self.stack.set_visible_child(self.restorePage)
      elif curPage == self.donePageBox:
         self.nextBtn.set_label(_("Next"));
         self.stack.set_visible_child(self.backupPage)

   def onWelcomeBtnToggled(self, widget):
      if widget.get_active() == True:
         if widget == self.windowListRadio:
            if self.appBehaviour < 4:
               self.settings.set_value("group-windows", self.appBehaviour)
            else:
               self.settings.set_value("group-windows", 2) # 2=Automatic
         elif widget == self.launcherRadio:
            self.settings.set_value("group-windows", 4) # 4=Launcher

   def onWLPage1BtnToggled(self, widget):
      if widget.get_active() == True:
         if widget == self.oneToOneRadio:
            self.settings.set_value("group-windows", OFF)
            self.settings.set_value("display-caption-for", ALL)
            self.settings.set_value("caption-type", WIN_TITLE)
         elif widget == self.groupedRadio:
            self.settings.set_value("group-windows", GROUPED)
            self.settings.set_value("caption-type", WIN_TITLE)
         elif widget == self.pooledRadio:
            self.settings.set_value("group-windows", POOLED)
            self.settings.set_value("display-caption-for", ONE)
            self.settings.set_value("caption-type", APP_NAME)

   def onWLPage2BtnToggled(self, widget):
      if widget.get_active() == True:
         if widget == self.noLabelChk:
            self.settings.set_value("display-caption-for", 0)
         elif widget == self.noMinimizedChk:
            self.settings.set_value("display-indicators", 0)
         elif widget == self.noHoverChk:
            self.settings.set_value("menu-show-on-hover", False)
      else:
         if widget == self.noLabelChk:
            self.settings.set_value("display-caption-for", 3)
         elif widget == self.noMinimizedChk:
            self.settings.set_value("display-indicators", 1)
         elif widget == self.noHoverChk:
            self.settings.set_value("menu-show-on-hover", True)

   def onLaunchPageToggled(self, widget):
      if widget.get_active() == True:
         if widget == self.newWindowRadio:
            self.settings.set_value("launcher-mouse-action-btn1", NEW_WINDOW)
         elif widget == self.lcRestoreRadio:
            self.settings.set_value("launcher-mouse-action-btn1", RESTORE)
         elif widget == self.thumbnailRadio:
            self.settings.set_value("launcher-mouse-action-btn1", THUMBNAIL)
         elif widget == self.mouseHoverChk:
            self.settings.set_value("menu-show-on-hover", True)
      else:
         if widget == self.mouseHoverChk:
            self.settings.set_value("menu-show-on-hover", False)

   def onClickConfig(self, widget):
      #os.system("xlet-settings applet " + self.uuid + " -i " + self.instanceId + " -t 0")
      subprocess.Popen(["xlet-settings", "applet", self.uuid, "-i", self.instanceId, "-t", "0"])
      Gtk.main_quit()

   def onRowSelected(self, widget, row):
      self.nextBtn.set_sensitive(True)

   def backupConfigFile(self, path, fileName):
      responce = Gtk.ResponseType.OK;
      fileAndPathName = path + fileName + ".json"
      dirPath = Path(path)
      filePath = Path(fileAndPathName)
      if not dirPath.exists():
         dirPath.mkdir(parents=True)
      if filePath.exists():
         dialog = Gtk.MessageDialog(transient_for=self.window, flags=0, message_type=Gtk.MessageType.INFO, text=_("Backup file already exist. Do you want to overwrite it?") )
         dialog.add_buttons( Gtk.STOCK_NO, Gtk.ResponseType.CANCEL, Gtk.STOCK_YES, Gtk.ResponseType.OK )
         responce = dialog.run()
         dialog.destroy()
      if responce == Gtk.ResponseType.OK:
         try:
            shutil.copyfile(self.configFilePath, filePath)
            return True
         except Exception as e:
            print(e)
            print( "Exception!!!" )
            return False
      return False

   def loadRestoreOptions(self, path):
      backupPath = config_path + self.uuid + "/backup/"
      fileNameOffset = len(backupPath)
      backupFiles = glob.glob(backupPath + "*.json")
      fileCount = 0
      for backupFile in backupFiles:
         fileCount+=1
         self.backupFileList.insert( Gtk.Label(label=backupFile[fileNameOffset:-5]), position=-1 )
      return fileCount

if __name__ == "__main__":
   if len(sys.argv) > 2:
      dialog = SetupWizard(sys.argv[1], sys.argv[2])
   else:
      dialog = SetupWizard()