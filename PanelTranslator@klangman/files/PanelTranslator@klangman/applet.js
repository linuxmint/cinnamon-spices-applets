/*
 * applet.js
 * Copyright (C) 2024 Kevin Langman <klangman@gmail.com>
 *
 * PanelTranslator is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * PanelTranslator is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const Applet = imports.ui.applet;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const SignalManager = imports.misc.signalManager;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Lang = imports.lang;
const Tooltips = imports.ui.tooltips;
const Clutter = imports.gi.Clutter;

const UUID = "PanelTranslator@klangman";
const ICON_SIZE = 16;

const { hardcodedLanguages } = require('./languages_0_9_6_12.js');

const AutoPasteType = {
   Disabled: 0,
   Selection: 1,
   Clipboard: 2
}

const MiddleBtnAction = {
   DoNothing: 0,
   PopupSelection: 1,
   PopupClipboard: 2,
   PopupSelectionPlay: 3,
   PopupClipboardPlay: 4,
   PlaySelection: 5,
   PlayClipboard: 6,
   TransSelectionCopy: 7,
   TransClipboardCopy: 8
}

const Engine = {
   Apertium: 0,
   Aspell: 1,
   Auto: 2,
   Bing: 3,
   Google: 4,
   Hunspell: 5,
   Spell: 6,
   Yandex: 7
}

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
  let locText = Gettext.dgettext(UUID, text);
  if (locText == text) {
    locText = window._(text);
  }
  return locText;
}

class PanelTranslatorApp extends Applet.IconApplet {

   constructor(orientation, panelHeight, instanceId) {
      super(orientation, panelHeight, instanceId);
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
      this._signalManager = new SignalManager.SignalManager(null);
      this.settings = new Settings.AppletSettings(this, UUID, instanceId);
      this.set_applet_icon_symbolic_name("panel-translator-symbolic");
      this.set_applet_tooltip(_("Translator"));
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menuManager.addMenu(this.menu);
      this.translatorPopup = new TranslatorPopupItem(this);
      this.menu.addMenuItem(this.translatorPopup);
      this.infomenuitem = new PopupMenu.PopupIconMenuItem("", "", St.IconType.SYMBOLIC);
      this.infomenuitem.actor.set_reactive(false);
      this.menu.addMenuItem(this.infomenuitem);
      this.infomenuitem.actor.hide();
      this.engine = "";
      this.getEngine();
      this.languages = [];
      this.getLanguages();
   }

   on_applet_added_to_panel() {
   }

   _onButtonPressEvent(actor, event) {
      let button = event.get_button();
      if (button == 2 ) {/* Middle Click */
         let action;
         if (event.has_control_modifier()) {
            action = this.settings.getValue("ctrl-middle-button-action");
         } else {
            action = this.settings.getValue("middle-button-action");
         }
         switch(action) {
            case MiddleBtnAction.PopupSelection:
               this.openPopupMenu(AutoPasteType.Selection, false);
               break;
            case MiddleBtnAction.PopupClipboard:
               this.openPopupMenu(AutoPasteType.Clipboard, false);
               break;
            case MiddleBtnAction.PopupSelectionPlay:
               this.openPopupMenu(AutoPasteType.Selection, true);
               break;
            case MiddleBtnAction.PopupClipboardPlay:
               this.openPopupMenu(AutoPasteType.Clipboard, true);
               break;
            case MiddleBtnAction.PlaySelection:
               this.translatorPopup.translateClipboard(AutoPasteType.Selection, true);
               break;
            case MiddleBtnAction.PlayClipboard:
               this.translatorPopup.translateClipboard(AutoPasteType.Clipboard, true);
               break;
            case MiddleBtnAction.TransSelectionCopy:
               this.translatorPopup.translateClipboard(AutoPasteType.Selection, false, true);
               break;
            case MiddleBtnAction.TransClipboardCopy:
               this.translatorPopup.translateClipboard(AutoPasteType.Clipboard, false, true);
               break;
         }
         return;
      }
      super._onButtonPressEvent(actor, event);
   }

   on_applet_clicked() {
      this.openPopupMenu(this.settings.getValue("left-auto-paste"), this.settings.getValue("left-auto-play"));
   }

   openPopupMenu(autoPaste, play) {
      this.infomenuitem.actor.hide();
      if (this.languages.length == 0) {
         this.getLanguages();
      }
      if (!this.menu.isOpen && autoPaste != AutoPasteType.Disabled ) {
         this.translatorPopup.translateClipboard(autoPaste, play);
      }
      this.menu.toggle();
   }

   getLanguages() {
      // trans -list-all
      Util.spawnCommandLineAsyncIO( "trans -list-all", Lang.bind(this, this.readLanguages) );
   }

   // Read output from "trans -list-all", which is only available in newer versions of translate-shell
   readLanguages(stdout, stderr, exitCode) {
      if (exitCode===0) {
         let lines = stdout.split('\n');
         if (lines[0] == "-list-all") {
            // If the "trans -list-all" output starts with "-list-all" then we are dealing with a version of
            // translate shell that does not support the "-list-all" option, so lets just use a hard coded
            // list of languages! Also does not have a "auto" engine, so we'll use google in it's place.
            this.languages = hardcodedLanguages;
            if (this.engine == "auto") {
               this.engine = "google";
            }
         } else {
            let nameStart = lines[0].lastIndexOf(" ")+1;
            let englishNameStart = lines[0].substring(0,nameStart-1).trim().lastIndexOf(" ")+1;
            this.languages = [];
            for (let i=0 ; i < lines.length ; i++) {
               let code = lines[i].substring(0, englishNameStart).trim();
               let englishName = lines[i].substring(englishNameStart, nameStart).trim();
               let name = lines[i].substring(nameStart).trim();
               if (code.length>0 && englishName.length>0 && name.length>0) {
                  this.languages.push( {code: code, englishName: englishName, name: name} );
               }
            }
         }
         // Did we find the languages? If not, we need an error message
         if (this.languages.length == 0) {
            this.infomenuitem.label.set_text(_("Unable to query available languages from translate-shell"));
            this.infomenuitem.setIconSymbolicName("emblem-important");
            this.infomenuitem.actor.show();
         } else {
            this.translatorPopup.setFromLanguage( this.getLanguage( this.settings.getValue("default-from-language") ) );
            this.translatorPopup.setToLanguage(   this.getLanguage( this.settings.getValue("default-to-language") ) );
         }
      } else if (exitCode===127){
         this.infomenuitem.label.set_text(_("Required \"trans\" command not found, please install translate-shell"));
         this.infomenuitem.setIconSymbolicName("emblem-important");
         this.infomenuitem.actor.show();
      } else {
         this.infomenuitem.label.set_text(_("Error, the \"trans\" command returned an exit code of ") + this.exitCode );
         this.infomenuitem.setIconSymbolicName("emblem-important");
         this.infomenuitem.actor.show();
      }
   }

   getLanguage(name) {
      if (name.length == 0)
         return null;
      for (let i=0 ; i<this.languages.length ; i++ ) {
         if (this.languages[i].englishName.toLowerCase().startsWith(name.toLowerCase())) {
            return this.languages[i];
         }
      }
      return null;
   }

   getEngine() {
      let ret;
      let number = this.settings.getValue("translate-engine");
      switch (number) {
         case Engine.Apertium:
            ret = "apertium";
            break;
         case Engine.Aspell:
            ret = "aspell";
            break;
         case Engine.Auto:
            if (this.languages == hardcodedLanguages) {
               ret = "google";  // If we are using hardcodedLanguages then we think this is translate-shell 0.9.6.12 which does not support "auto"
            } else {
               ret = "auto";
            }
            break;
         case Engine.Bing:
            ret = "bing";
            break;
         case Engine.Google:
            ret = "google";
            break;
         case Engine.Hunspell:
            ret = "hunspell";
            break;
         case Engine.Spell:
            ret = "spell";
            break;
         case Engine.Yandex:
            ret = "yandex";
            break;
      }
      this.engine = ret;
   }

}

class TranslatorPopupItem extends PopupMenu.PopupMenuSection {

   constructor(applet) {
      super();
      this.deletedSelection = false;
      this._applet = applet;

      this.vertBox     = new St.BoxLayout({ important: true, vertical: true, x_expand: true, style: 'padding-right:10px;padding-left:10px;'});
      this.languageBox = new St.BoxLayout({ important: true, vertical: false, style: 'border-width:2px;padding:2px;', x_align: Clutter.ActorAlign.FILL, x_expand: true});
      this.textBox     = new St.BoxLayout({ important: true, vertical: false, style: 'border-width:2px;padding:2px;', x_align: Clutter.ActorAlign.FILL, x_expand: true});
      this.actionBox   = new St.BoxLayout({ important: true, vertical: false, style: 'border-width:2px;padding:2px;', x_align: Clutter.ActorAlign.FILL, x_expand: true});
      this.vertBox.add_child(this.languageBox);
      this.vertBox.add_child(this.textBox);
      this.vertBox.add_child(this.actionBox);

      // Setup the language selection box
      this.switchButton = new ControlButton("object-flip-horizontal-symbolic", _("Swap Languages"), () => {
         let from = this.fromLanguage;
         let to = this.toLanguage;
         if (this.fromLanguage) {
            this.toLanguage = from;
            this.toSearchEntry.set_text(this.toLanguage.englishName);
         }
         if (this.toLanguage) {
            this.fromLanguage = to;
            this.fromSearchEntry.set_text(this.fromLanguage.englishName);
         }
         let fromText = this.fromTextBox.get_text();
         let toText = this.toTextBox.get_text();
         if (toText)
            this.fromTextBox.set_text(toText);
         if (fromText)
            this.toTextBox.set_text(fromText);
      });

      this.fromSearchEntry = new St.Entry({ name: 'menu-search-entry', width: 210, track_hover: true, can_focus: true, x_expand: true, x_align: Clutter.ActorAlign.START });
      this.fromSearchEntry.get_clutter_text().connect( 'key-press-event', Lang.bind(this, this._onKeyPressEvent) );
      this.fromSearchEntry.get_clutter_text().connect( 'key-release-event', (actor, event) => {this._onKeyReleaseEvent(actor, event, this.fromLanguage); } );
      this.toSearchEntry = new St.Entry({ name: 'menu-search-entry', width: 210, track_hover: true, can_focus: true, x_expand: true, x_align: Clutter.ActorAlign.END });
      this.toSearchEntry.get_clutter_text().connect( 'key-press-event', Lang.bind(this, this._onKeyPressEvent) );
      this.toSearchEntry.get_clutter_text().connect( 'key-release-event', (actor, event) => {this._onKeyReleaseEvent(actor, event, this.toLanguage); } );
      this._searchFromIcon = new St.Icon({ style_class: 'menu-search-entry-icon', icon_name: 'edit-find', icon_type: St.IconType.SYMBOLIC });
      this._searchToIcon = new St.Icon({ style_class: 'menu-search-entry-icon', icon_name: 'edit-find', icon_type: St.IconType.SYMBOLIC });
      this.fromSearchEntry.set_secondary_icon(this._searchFromIcon);
      this.toSearchEntry.set_secondary_icon(this._searchToIcon);
      this.languageBox.add_child(this.fromSearchEntry);
      this.languageBox.add_child(this.switchButton.getActor());
      this.languageBox.add_child(this.toSearchEntry);

      // Setup the from/to text boxes
      //let fromScrollView = new St.ScrollView()     // TODO... Get this working!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      this.fromTextBox = new St.Entry({name: 'menu-search-entry', hint_text: _("{Text to translate}"), width: 250, height: 180});
      let text = this.fromTextBox.get_clutter_text();
      text.set_line_wrap(true);
      text.set_single_line_mode(false);
      text.set_max_length(200);
      text.connect('text-changed', () => {
         let state = (this.fromTextBox.get_text().length != 0 );
         this.playFrom.setEnabled(state);
         this.translate.setEnabled(state);
         });
      text.connect('activate', (actor, event) => {
         Util.spawnCommandLineAsyncIO( "trans -b -e " + this._applet.engine + " " + this.fromLanguage.code + ":" + this.toLanguage.code + " \"" + this.fromTextBox.get_text() + "\"", Lang.bind(this, this.readTranslation) );
         });
      //fromScrollView.set_child(this.fromTextBox);
      this.textBox.add_child(this.fromTextBox);
      //this.textBox.add_child(fromScrollView);

      this.toTextBox = new St.Entry({name: 'menu-search-entry', hint_text: _("{Translated text}"), width: 250, height: 180});
      text = this.toTextBox.get_clutter_text();
      text.set_line_wrap(true);
      text.set_single_line_mode(false);
      text.set_editable(false);
      text.set_max_length(200);
      text.connect('text-changed', () => {
         let state = (this.toTextBox.get_text().length != 0 );
         this.copy.setEnabled(state);
         this.playTo.setEnabled(state);
         });
      this.textBox.add_child(this.toTextBox);

      // Setup the action buttons
      this.config = new ControlButton("system-run", _("Configure"), () => {this._applet.menu.close(); this._applet.configureApplet()});
      this.playFrom = new ControlButton("audio-speakers-symbolic", _("Play"), () => {
         Util.spawnCommandLineAsync("trans -b -p -e " + this._applet.engine + " " + this.fromLanguage.code + ":" + this.fromLanguage.code + " \"" + this.fromTextBox.get_text() + "\"");
         });
      this.playFrom.setEnabled(false);
      this.paste = new ControlButton("edit-paste-symbolic", _("Paste"), () => {
         let clipboard = St.Clipboard.get_default();
         clipboard.get_text(St.ClipboardType.CLIPBOARD, (cb, text) => {this.clipboardText(cb, text, true);} );
         });
      this.clear = new ControlButton("edit-clear", _("Clear"), () => {
         this.fromTextBox.set_text("");
         this.toTextBox.set_text("");
         });
      this.translate = new ControlButton("media-playback-start-symbolic", _("Translate"), () => {
         Util.spawnCommandLineAsyncIO( "trans -b -e " + this._applet.engine + " " + this.fromLanguage.code + ":" + this.toLanguage.code + " \"" + this.fromTextBox.get_text() + "\"", Lang.bind(this, this.readTranslation) );
         });
      this.translate.setEnabled(false);
      let toBtnBox = new St.BoxLayout({x_align: Clutter.ActorAlign.END, x_expand: true});
      this.copy = new ControlButton("edit-copy-symbolic", _("Copy"), () => {
         St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this.toTextBox.get_text());
         });
      this.copy.getActor().set_x_expand(true);
      this.copy.setEnabled(false);
      this.copy.getActor().set_x_align(Clutter.ActorAlign.END);
      this.playTo = new ControlButton("audio-speakers-symbolic", _("Play Translation"), () => {
         Util.spawnCommandLineAsync("trans -b -p -e " + this._applet.engine + " " + this.toLanguage.code + ":" + this.toLanguage.code + " \"" + this.toTextBox.get_text() + "\"");
         });
      this.playTo.setEnabled(false);

      this.actionBox.add_child(this.config.getActor());
      this.actionBox.add_child(this.paste.getActor());
      this.actionBox.add_child(this.clear.getActor());
      this.actionBox.add_child(this.playFrom.getActor());
      this.actionBox.add_child(this.translate.getActor());
      toBtnBox.add_child(this.copy.getActor());
      toBtnBox.add_child(this.playTo.getActor());
      this.actionBox.add_child(toBtnBox);

      this.addActor(this.vertBox, {expand: true});
      this._applet._signalManager.connect(this._applet.settings, "changed::translate-engine", this._applet.getEngine, this._applet);
   }

   // Handles key press events for the from/to language search entry widgets
   _onKeyPressEvent(actor, event) {
      let keyCode = event.get_key_symbol();
      if (keyCode == Clutter.KEY_BackSpace) {
         let selection = actor.get_selection();
         if (selection==null || selection.length==0) {
            this.deletedSelection = false;
         } else {
            this.deletedSelection = true;
         }
      }
   }

   // Handles key release events for the from/to language search entry widgets
   _onKeyReleaseEvent(actor, event, curLanguage) {
      let cursorPos = actor.get_cursor_position();
      let txt = actor.get_text();
      if (cursorPos == -1) {
         cursorPos = txt.length;
      }
      if (event.get_key_symbol() == Clutter.KEY_BackSpace) {
         if (cursorPos > 0) {
            if (this.deletedSelection!=false) {
               cursorPos--;
            }
            if (cursorPos==0) {
               actor.set_text("");
               return;
            }
         }
      }
      let txtSubstring = txt.substring(0, cursorPos);
      let language = this._applet.getLanguage(txtSubstring);
      if (language != curLanguage) {
         if (language==null && txtSubstring.startsWith(curLanguage.englishName)) {
            actor.set_text(curLanguage.englishName);
         } else {
            curLanguage = language;
            // Set the text box to "" since the associated language has been changed.
            if (actor == this.fromSearchEntry.get_clutter_text()) {
               this.fromLanguage = language;
               this.fromTextBox.set_text("");
            } else {
               this.toLanguage = language;
               this.toTextBox.set_text("");
            }
         }
      }
      if (curLanguage) {
         actor.set_text(curLanguage.englishName);
         actor.set_cursor_position(cursorPos);
      }
   }

   readTranslation(stdout, stderr, exitCode) {
      if (exitCode===0) {
         log( `Got translation: "${stdout.trim()}"` );
         this.toTextBox.set_text( stdout.trim() );
      }
      return exitCode;
   }

   playTranslation(stdout, stderr, exitCode) {
      if (this.readTranslation(stdout, stderr, exitCode)==0) {
         Util.spawnCommandLineAsync("trans -b -p -e " + this._applet.engine + " " + this.toLanguage.code + ":" + this.toLanguage.code + " \"" + this.toTextBox.get_text() + "\"");
      }
   }

   copyTranslation(stdout, stderr, exitCode) {
      if (this.readTranslation(stdout, stderr, exitCode)==0) {
         log( "Coping to the clipboard" );
         St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this.toTextBox.get_text());
      }
   }

   translateClipboard(autoPaste, play, copy=false) {
      let clipboard = St.Clipboard.get_default();
      log( "Asking to read clipboard" );
      if (autoPaste != AutoPasteType.Selection) {
         clipboard.get_text(St.ClipboardType.CLIPBOARD, (cb, text) => {this.clipboardText(cb, text, true, play, copy);} );
      } else {
         clipboard.get_text(St.ClipboardType.PRIMARY, (cb, text) => {this.clipboardText(cb, text, true, play, copy);} );
      }
   }

   // Callback that gets the clipboard text then performs some action with that text.
   clipboardText(cb, text, translate, play=false, copy=false) {
      log( `Got the text: "${text}", translating...` );
      this.fromTextBox.set_text(text);
      if (translate) {
         if (play) {
            Util.spawnCommandLineAsyncIO( "trans -b -e " + this._applet.engine + " " + this.fromLanguage.code + ":" + this.toLanguage.code + " \"" + this.fromTextBox.get_text() + "\"", Lang.bind(this, this.playTranslation) );
         } else if (copy) {
            Util.spawnCommandLineAsyncIO( "trans -b -e " + this._applet.engine + " " + this.fromLanguage.code + ":" + this.toLanguage.code + " \"" + this.fromTextBox.get_text() + "\"", Lang.bind(this, this.copyTranslation) );
         } else {
            Util.spawnCommandLineAsyncIO( "trans -b -e " + this._applet.engine + " " + this.fromLanguage.code + ":" + this.toLanguage.code + " \"" + this.fromTextBox.get_text() + "\"", Lang.bind(this, this.readTranslation) );
         }
      } else {
         this.toTextBox.set_text("");
      }
   }

   setFromLanguage(lang) {
      this.fromLanguage = lang;
      this.fromSearchEntry.set_text(lang.englishName);
   }

   setToLanguage(lang) {
      this.toLanguage = lang;
      this.toSearchEntry.set_text(lang.englishName);
   }
}

/* This class was borrowed from sound@cinnamon.org */
class ControlButton {
    constructor(icon, tooltip, callback) {
        this.actor = new St.Bin();

        this.button = new St.Button({style_class: 'menu-favorites-button' /*'panel-translator-button' 'menu-favorites-button' 'keyboard-key'*/});
        this.button.connect('clicked', callback);

        this.icon = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_name: icon, icon_size: ICON_SIZE });
        this.button.set_child(this.icon);
        this.actor.add_actor(this.button);

        this.tooltip = new Tooltips.Tooltip(this.button, tooltip);
    }

    getActor() {
        return this.actor;
    }

    setData(icon, tooltip) {
        this.icon.icon_name = icon;
        this.tooltip.set_text(tooltip);
    }

    setActive(status) {
        this.button.change_style_pseudo_class("active", status);
    }

    setEnabled(status) {
        this.button.change_style_pseudo_class("insensitive", !status);
        this.button.can_focus = status;
        this.button.reactive = status;
    }
}

// Called by cinnamon when starting this applet
function main(metadata, orientation, panelHeight, instanceId) {
  return new PanelTranslatorApp(orientation, panelHeight, instanceId);
}