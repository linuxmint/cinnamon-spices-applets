/*
 * applet.js
 * Copyright (C) 2023 Kevin Langman <klangman@gmail.com>
 *
 * MonitorInputSource is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MonitorInputSource is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Main = imports.ui.main;
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "MonitorInputSource@klangman";

const Modifier = {
   None: 0,
   Shift: 0x10,
   Ctrl: 0x20
}

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
  let locText = Gettext.dgettext(UUID, text);
  if (locText == text) {
    locText = window._(text);
  }
  return locText;
}

function getActionName(actionCode) {
   let name = "";
   if ((actionCode&Modifier.Ctrl) == Modifier.Ctrl) {
      name += _("Ctrl+");
   }
   if ((actionCode&Modifier.Shift) == Modifier.Shift) {
      name += _("Shift+");
   }
   let button = (actionCode&0xf);
   if (button == 1) {
      name += _("Left Click");
   } else if (button == 2) {
      name += _("Middle Click");
   } else if (button == 3) {
      name += _("Right Click");
   } else if (button == 8) {
      name += _("Back Click");
   } else if (button == 9) {
      name += _("Forward Click");
   }
   return name;
}

function getActionCode(event) {
   let modifiers = Modifier.None;
   let button = event.get_button();
   if (event.has_control_modifier()) {
      modifiers |= Modifier.Ctrl;
   }
   if (event.has_shift_modifier()) {
      modifiers |= Modifier.Shift;
   }
   if (modifiers != Modifier.None || (button != 1 && button != 3)) {
      return modifiers | button;
   }
   return 0;
}

function readDisplay(stdout, stderr, exitCode) {
   if (exitCode===0) {
      // Read the stdout lines looking for "Feature: 60"
      let lines = stdout.split('\n');
      for (let i=0 ; i < lines.length ; i++) {
         if (lines[i].startsWith("Model:")) {
            this.display.name = lines[i].slice(7);
         } else if (lines[i].includes("Feature: 60") && i+1 < lines.length && lines[i+1].includes("Values:")) {
            for ( i=i+2 ; i<lines.length && !lines[i].includes("Feature:") ; i++ ) {
               this.display.inputs.push( parseInt(lines[i], 16 ) );
               this.display.inputNames.push( lines[i].slice(lines[i].indexOf(": ")+2) );
            }
            this.display.initilized = true;
            break;
         }
      }
      //log( `Display ${this.display.number} ${this.display.name} ${this.display.serialNum} ${this.display.productCode} inputs=${this.display.inputs} names=${this.display.inputNames}` );

      // Save this monitor in the persistent cache
      let monitorCache = this.applet.settings.getValue("monitor-cache");
      let cacheEntry = {name: this.display.name, serialNum: this.display.serialNum, productCode: this.display.productCode, inputs: this.display.inputs, inputNames: this.display.inputNames};
      monitorCache.push(cacheEntry);
      this.applet.settings.setValue("monitor-cache", monitorCache);

      // To avoid errors when running commands asynchronously, we only run the next command now, after this one has ended
      for (let i=0 ; i < this.applet.displays.length ; i++) {
         if (this.applet.displays[i].initilized === false) {
            Util.spawnCommandLineAsyncIO( "ddcutil -d " + this.applet.displays[i].number + " capabilities", Lang.bind({applet: this.applet, display: this.applet.displays[i]}, readDisplay) );
            return;
         }
      }
   } else {
      // ddcutil returned an error code
      this.applet.exitCode=exitCode;
   }
   // Now that all uninitilized displays have been read, we can update the menu!
   this.applet.updateMenu();
}

function readCurrentInput(stdout, stderr, exitCode) {
   if (exitCode===0) {
      let lines = stdout.split('\n');
      for (let i=0 ; i < lines.length ; i++) {
         if (lines[i].startsWith("VCP code 0x60")) {
            // Read the stdout line and extract the hex value after the "="
            this.display.currentInput = parseInt(lines[i].slice(lines[i].indexOf("=")+1));
            // If there is an existing menu item then update the item with the default icon
            let inputIdx = this.display.inputs.indexOf(this.display.currentInput);
            let menuItem = this.applet.getMenuItemForDisplayInput(this.display, this.display.currentInput);
            if (menuItem) {
               menuItem.setInputActive(true);
            }
            break;
         }
      }
   } else {
      // ddcutil returned an error code, but we will ignore it.
   }
   // Query the next monitor's current input since we can get errors when run concurrently
   let idx = this.applet.displays.indexOf(this.display)+1;
   if (idx < this.applet.displays.length) {
      Util.spawnCommandLineAsyncIO( "ddcutil -d " + this.applet.displays[idx].number + " getvcp 60", Lang.bind({applet: this.applet, display: this.applet.displays[idx]}, readCurrentInput) );
   }
}


class InputSourceApp extends Applet.IconApplet {

   constructor(orientation, panelHeight, instanceId) {
      super(orientation, panelHeight, instanceId);
      this._signalManager = new SignalManager.SignalManager(null);
      this.set_applet_icon_symbolic_name("video-display-symbolic");
      this.set_applet_tooltip(_("Monitor input sources"));
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menuManager.addMenu(this.menu);
      this.settings = new Settings.AppletSettings(this, UUID, instanceId);

      this.displays = [];
      this.exitCode = 0;
   }

   on_applet_added_to_panel() {
      // Add a "detecting" menu item in case the detecting phase take a long time
      let item = new InformationMenuItem(_("Detecting monitors..."), "video-display-symbolic");
      item.actor.set_reactive(false);
      this.menu.addMenuItem(item);
      // Add a separator
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      // Set a setting submenu
      let subMenu = new PopupMenu.PopupSubMenuMenuItem(_("Options"));
      this.menu.addMenuItem(subMenu);
      item = new PopupMenu.PopupMenuItem(_("Clear monitor cache"));
      item.connect("activate", Lang.bind(this, function()
         {
            this.settings.setValue("monitor-cache", []);
         }));
      subMenu.menu.addMenuItem(item);
      item = new PopupMenu.PopupMenuItem(_("Clear quick actions"));
      item.connect("activate", Lang.bind(this, function()
         {
            this.settings.setValue("mouse-actions", []);
            let items = this.menu._getMenuItems();
            for (let i=0 ; i < items.length ; i++) {
               if (items[i] instanceof InputMenuItem) {
                  items[i].actionCode =0;
               }
            }
            this.updateToolTip();
         }));
      subMenu.menu.addMenuItem(item);
      item = new PopupMenu.PopupMenuItem(_("Help"));
      item.connect("activate", Lang.bind(this, function()
         {
            Util.spawnCommandLineAsync("/usr/bin/xdg-open https://cinnamon-spices.linuxmint.com/applets/view/382");
         }));
      subMenu.menu.addMenuItem(item);
      // Add a separator
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      // Add a "Refresh" menu item
      item = new RefreshMenuItem(this);
      this.menu.addMenuItem(item);
      // Get a list of all the displays
      Util.spawnCommandLineAsyncIO( "ddcutil detect", Lang.bind(this, this._readDisplays) );
      this._signalManager.connect(Main.layoutManager, "monitors-changed", this._updateMonitors, this);
   }

   _updateMonitors() {
      // There might be new monitors now, so refresh the list of monitors
      // Add a "detecting" menu item in case the detecting phase takes a long time
      this.removeDisplayMenuItems();
      let item = new InformationMenuItem(_("Detecting monitors..."), "video-display-symbolic");
      item.actor.set_reactive(false);
      this.menu.addMenuItem(item,0);
      Util.spawnCommandLineAsyncIO( "ddcutil detect", Lang.bind(this, this._readDisplays) );
   }

   _onButtonPressEvent(actor, event) {
      let action = getActionCode(event);
      if (action) {
         let items = this.menu._getMenuItems();
         for (let i=0 ; i < items.length ; i++) {
            if (items[i] instanceof InputMenuItem && items[i].actionCode == action) {
               Util.spawnCommandLine( "ddcutil -d " + items[i].getDisplay().number + " setvcp 60 0x" + items[i].getInput().toString(16));
               return;
            }
         }
      }
      super._onButtonPressEvent(actor, event);
   }

   on_applet_clicked() {
      if (!this.menu.isOpen && this.displays.length>0) {
         let items = this.menu._getMenuItems();
         // Remove all the "current input" check from all menu items
         for (let i=0 ; i < items.length ; i++) {
            if (items[i] instanceof InputMenuItem) {
               items[i].setInputActive(false);
            }
         }
         // Read the "current input" for all displays
         Util.spawnCommandLineAsyncIO( "ddcutil -d " + this.displays[0].number + " getvcp 60", Lang.bind({applet: this, display: this.displays[0]}, readCurrentInput) );
      }
      this.menu.toggle();
   }

   // Call back routine that gets the output for "ddcutil detect"
   _readDisplays(stdout, stderr, exitCode) {
      if (exitCode===0) {
         // Read the stdout lines looking for "Display #"
         let lines = stdout.split('\n');
         let display;
         let displayNumber;
         this.displays = [];
         for (let i in lines) {
            if (lines[i].startsWith("Display ")) {
               displayNumber = parseInt(lines[i].charAt(8));
               display = {number: displayNumber, name: "", serialNum: -1, productCode: -1, currentInput: -1, initilized: false, inputs: [], inputNames: []};
               this.displays.push( display );
            } else if (lines[i].includes("Binary serial number:") && display) {
               display.serialNum = parseInt(lines[i].slice(lines[i].indexOf(":")+1));
            } else if (lines[i].includes("Product code:") && display) {
               display.productCode = parseInt(lines[i].slice(lines[i].indexOf(":")+1));
            } else if (lines[i].startsWith("Invalid display") && display) {
               display = null;
            }
         }
         if (this.displays.length === 0) {
            this.updateMenu(); // Show no monitors were found in the menu
         } else {
            // Check if any of the displays have been cached
            let monitorCache = this.settings.getValue("monitor-cache");
            let firstUnknownDisplay = null;
            for (let i=0 ; i < this.displays.length ; i++) {
               let idx=0;
               for ( ; idx < monitorCache.length ; idx++) {
                  if (monitorCache[idx].serialNum == this.displays[i].serialNum && monitorCache[idx].productCode == this.displays[i].productCode) {
                     // Load the display settings from the persistent cache
                     //log( `Loading monitor from cache ${monitorCache[idx].name}` );
                     this.displays[i].initilized = true;
                     this.displays[i].name = monitorCache[idx].name;
                     this.displays[i].inputs = monitorCache[idx].inputs;
                     this.displays[i].inputNames = monitorCache[idx].inputNames;
                     break;
                  }
               }
               if (idx === monitorCache.length && firstUnknownDisplay===null) {
                  firstUnknownDisplay = this.displays[0];
               }
            }
            // If there are any unknown monitors, then read the details now
            if (firstUnknownDisplay) {
               Util.spawnCommandLineAsyncIO( "ddcutil -d " + this.displays[0].number + " capabilities", Lang.bind({applet: this, display: firstUnknownDisplay}, readDisplay) );
            } else {
               // There are no unknown monitors so we can update the menu now
               this.updateMenu();
            }
         }
      } else {
         // ddcutil returned an error code
         this.exitCode = exitCode;
         this.updateMenu(); // Show the error in the menu
      }
   }

   getMenuItemForDisplayInput(display, input) {
      let items = this.menu._getMenuItems();
      for (let i=0 ; i < items.length ; i++) {
         if (items[i] instanceof InputMenuItem && items[i].getDisplay() === display && items[i].getInput() === input) {
            return items[i];
         }
      }
      return null;
   }

   removeDisplayMenuItems() {
      let items = this.menu._getMenuItems();
      for (let i=items.length-1 ; i >= 0 ; i--) {
         // Once we hit the first InputMenuItem|InformationMenuItem remove everything above it!
         if (items[i] instanceof InputMenuItem || items[i] instanceof InformationMenuItem) {
            for( ; i >= 0 ; i-- ) {
               items[i].destroy();
            }
            break;
         }
      }
   }

   updateMenu() {
      let item;
      this.removeDisplayMenuItems();
      if (this.displays.length === 0) {
         if (this.exitCode == 127) {
            item = new InformationMenuItem(_("Required \"ddcutil\" not found"), "emblem-important");
            item.actor.set_reactive(false);
            this.menu.addMenuItem(item,0);
         } else if (this.exitCode != 0) {
            item = new InformationMenuItem(_("Error, \"ddcutil\" exit code ") + this.exitCode, "emblem-important");
            item.actor.set_reactive(false);
            this.menu.addMenuItem(item,0);
         } else {
            item = new InformationMenuItem(_("No capable monitors detected"), "emblem-important");
            item.actor.set_reactive(false);
            this.menu.addMenuItem(item,0);
         }
         this.exitCode = 0;
      } else {
         let pos = 0;
         for (let i=0 ; i<this.displays.length ; i++) {
            if (i!=0) {
               // Add a separator
               this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
            item = new InformationMenuItem(this.displays[i].name, "video-display-symbolic");
            item.actor.set_reactive(false);
            this.menu.addMenuItem(item,pos++);
            for (let idx=0 ; idx < this.displays[i].inputNames.length ; idx++ ) {
               item = new InputMenuItem(this, this.displays[i], idx);
               item.connect("activate", Lang.bind(this, function()
                  {
                     Util.spawnCommandLine( "ddcutil -d " + this.displays[i].number + " setvcp 60 0x" + this.displays[i].inputs[idx].toString(16));
                  }));
               this.menu.addMenuItem(item,pos++);
            }
            if (this.menu.isOpen && this.displays[i].inputNames.length) {
               // Read the "current input" for all displays since we just refreshed the list
               Util.spawnCommandLineAsyncIO( "ddcutil -d " + this.displays[0].number + " getvcp 60", Lang.bind({applet: this, display: this.displays[0]}, readCurrentInput) );
            }
         }
      }
      this.updateToolTip();
   }

   updateToolTip() {
      let toolTipText = "";
      let items = this.menu._getMenuItems();
      for (let i=0 ; i < items.length ; i++) {
         let item = items[i];
         if (item instanceof InputMenuItem && item.actionCode != 0) {
            let display = item.getDisplay();
            toolTipText += "\n"+ getActionName(item.actionCode) + " " + _("for") + " " + display.name + ":" + item.getInputName();
         }
      }
      if (toolTipText.length>0) {
         toolTipText = "<b>" + _("Monitor input sources") + "</b>" + toolTipText;
      } else {
         toolTipText = _("Monitor input sources");
      }
      this.set_applet_tooltip(toolTipText, true);
   }
}

class InputMenuItem extends PopupMenu.PopupMenuItem {
   _init (applet, display, inputIdx, params) {
      super._init.call(this, "\t" + display.inputNames[inputIdx], params);
      this._applet = applet;
      this._display = display;
      this._inputIdx = inputIdx;
      this._currentIcon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'emblem-default', icon_type: St.IconType.SYMBOLIC, width: 32 });
      this.addActor(this._currentIcon);
      this._currentIcon.hide();
      this.actionCode = 0;
      let actions = applet.settings.getValue("mouse-actions");
      for (let i=0 ; i<actions.length ; i++) {
         if (actions[i].serialNum == display.serialNum && actions[i].productCode == display.productCode && actions[i].inputIdx == inputIdx) {
            this.actionCode = actions[i].actionCode;
         }
      }
   }

   getDisplay() {
      return this._display;
   }

   getInputIdx() {
      return this.inputIdx;
   }

   getInput() {
      return this._display.inputs[this._inputIdx];
   }

   getInputName() {
      return this._display.inputNames[this._inputIdx];
   }

   setInputActive(state) {
      if (state) {
         this._currentIcon.show();
      } else {
         this._currentIcon.hide();
      }
   }

   _onButtonReleaseEvent(actor, event) {
      let action = getActionCode(event);
      if (action != 0) {
         // Setup a mouse-action for the panel button
         let actions = this._applet.settings.getValue("mouse-actions");
         // Check for an existing action for this mouse+key combination and remove it
         for (let i=actions.length-1 ; i>=0 ; i--) {
            if (actions[i].actionCode === action || (actions[i].serialNum == this._display.serialNum && actions[i].productCode == this._display.productCode && actions[i].inputIdx == this._inputIdx)) {
               if (actions[i].actionCode === action) {
                  let items = this._applet.menu._getMenuItems();
                  for (let i=0 ; i < items.length ; i++) {
                     if (items[i].actionCode==action) {
                        items[i].actionCode=0;
                     }
                  }
               }
               actions.splice(i, 1);
            }
         }
         let actionEntry = {actionCode: action, serialNum: this._display.serialNum, productCode: this._display.productCode, inputIdx: this._inputIdx };
         actions.push(actionEntry);
         this._applet.settings.setValue("mouse-actions", actions);
         this.actionCode = action;
         this._applet.updateToolTip();
         this._applet.menu.close();
      } else {
         super._onButtonReleaseEvent(actor, event);
      }
   }
}

class RefreshMenuItem extends PopupMenu.PopupIconMenuItem {
   _init (applet, params) {
      super._init.call(this, _("Refresh"), "view-refresh", St.IconType.SYMBOLIC, params);
      this._applet = applet;
   }

   _onButtonReleaseEvent(actor, event) {
      // Add a "detecting" menu item in case the detecting phase takes a long time
      this._applet.removeDisplayMenuItems();
      let item = new InformationMenuItem(_("Detecting monitors..."), "video-display-symbolic");
      item.actor.set_reactive(false);
      this._applet.menu.addMenuItem(item,0);
      Util.spawnCommandLineAsyncIO( "ddcutil detect", Lang.bind(this._applet, this._applet._readDisplays) );
   }
}

class InformationMenuItem extends PopupMenu.PopupIconMenuItem {
   _init (text, icon, params) {
      super._init.call(this, text, icon, St.IconType.SYMBOLIC, params);
   }
}

// Called by cinnamon when starting this applet
function main(metadata, orientation, panelHeight, instanceId) {
  return new InputSourceApp(orientation, panelHeight, instanceId);
}