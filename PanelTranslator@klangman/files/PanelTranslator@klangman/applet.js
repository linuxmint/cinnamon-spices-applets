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
const Pango = imports.gi.Pango;
const Gettext = imports.gettext;
const SignalManager = imports.misc.signalManager;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Lang = imports.lang;
const Tooltips = imports.ui.tooltips;
const Clutter = imports.gi.Clutter;
const Config = imports.misc.config;
const Gtk = imports.gi.Gtk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cogl = imports.gi.Cogl;
const Main = imports.ui.main;

// St.PolicyType only exists in newer Cinnamon versions, older versions use Gtk.PolicyType
const PolicyType = St.PolicyType ? St.PolicyType : Gtk.PolicyType;

const ICONTHEME = Gtk.IconTheme.get_default();

const UUID = "PanelTranslator@klangman";
const ICON_SIZE = 16;

const majorVersion = parseInt(Config.PACKAGE_VERSION.substring(0,1));

const { hardcodedLanguages } = require('./languages_0_9_6_12.js');

// Keys that move the cursor or are modifiers, they don't change the language entry text
const NON_EDIT_KEYS = [
   Clutter.KEY_Left, Clutter.KEY_Right, Clutter.KEY_Home, Clutter.KEY_End,
   Clutter.KEY_KP_Left, Clutter.KEY_KP_Right, Clutter.KEY_KP_Home, Clutter.KEY_KP_End,
   Clutter.KEY_Shift_L, Clutter.KEY_Shift_R, Clutter.KEY_Control_L, Clutter.KEY_Control_R,
   Clutter.KEY_Alt_L, Clutter.KEY_Alt_R, Clutter.KEY_Super_L, Clutter.KEY_Super_R,
   Clutter.KEY_Tab, Clutter.KEY_ISO_Left_Tab, Clutter.KEY_Escape
];

const AutoPasteType = {
   Disabled: 0,
   Selection: 1,
   Clipboard: 2
}

const TranslateAction = {
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

const Hotkeys = [
   {name: "panelTranslator-trans-selection",      setting: "hotkey-trans-selection",      action: TranslateAction.PopupSelection,     enabled: false},
   {name: "panelTranslator-trans-clipboard",      setting: "hotkey-trans-clipboard",      action: TranslateAction.PopupClipboard,     enabled: false},
   {name: "panelTranslator-trans-play-selection", setting: "hotkey-trans-play-selection", action: TranslateAction.PopupSelectionPlay, enabled: false},
   {name: "panelTranslator-trans-play-clipboard", setting: "hotkey-trans-play-clipboard", action: TranslateAction.PopupClipboardPlay, enabled: false},
   {name: "panelTranslator-play-selection",       setting: "hotkey-play-selection",       action: TranslateAction.PlaySelection,      enabled: false},
   {name: "panelTranslator-play-clipboard",       setting: "hotkey-play-clipboard",       action: TranslateAction.PlayClipboard,      enabled: false},
   {name: "panelTranslator-trans-copy-selection", setting: "hotkey-trans-copy-selection", action: TranslateAction.TransSelectionCopy, enabled: false},
   {name: "panelTranslator-trans-copy-clipboard", setting: "hotkey-trans-copy-clipboard", action: TranslateAction.TransClipboardCopy, enabled: false},
]

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

function escapeQuotes(txt) {
   txt = txt.replace(/\"/g, "\\\"");
   return txt;
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
      if (typeof Applet.PopupResizeHandler === "function") {
         this._resizer = new Applet.PopupResizeHandler(this.menu.actor,
            () => this._orientation,
            (w,h) => this.translatorPopup.onBoxResized(w,h),
            () => this.popup_width,
            () => this.popup_height);
      }
      this.settings.bind("popup-width", "popup_width");
      this.settings.bind("popup-height", "popup_height");

   }

   on_applet_added_to_panel() {
      for ( let i=0 ; i < Hotkeys.length ; i++ ) {
         this._signalManager.connect(this.settings, "changed::" + Hotkeys[i].setting, this._updateHotkeys, this);
      }
      this._updateHotkeys()
   }

   on_applet_removed_from_panel() {
      this._updateHotkeys(false);
   }

   _updateHotkeys(register=true) {
      let i;
      for ( i=0 ; i < Hotkeys.length ; i++ ) {
         if (Hotkeys[i].enabled) {
            Main.keybindingManager.removeHotKey(Hotkeys[i].name);
            Hotkeys.enabled = false;
         }

         if (register) {
            let hotkeyCombo = this.getHotkeySequence(Hotkeys[i].setting);
            if (hotkeyCombo) {
               let action = Hotkeys[i].action;
               Main.keybindingManager.addHotKey(Hotkeys[i].name, hotkeyCombo, () => this._performTranslateAction(action));
               Hotkeys[i].enabled = true;
            }
         }
      }
   }

   getHotkeySequence(name) {
      let str = this.settings.getValue(name);
      if (str && str.length>0 && str != "::") {
         return str;
      }
      return null;
   }

   _performTranslateAction(action) {
      switch(action) {
         case TranslateAction.PopupSelection:
            this.openPopupMenu(AutoPasteType.Selection, false);
            break;
         case TranslateAction.PopupClipboard:
            this.openPopupMenu(AutoPasteType.Clipboard, false);
            break;
         case TranslateAction.PopupSelectionPlay:
            this.openPopupMenu(AutoPasteType.Selection, true);
            break;
         case TranslateAction.PopupClipboardPlay:
            this.openPopupMenu(AutoPasteType.Clipboard, true);
            break;
         case TranslateAction.PlaySelection:
            this.translatorPopup.translateClipboard(AutoPasteType.Selection, true);
            break;
         case TranslateAction.PlayClipboard:
            this.translatorPopup.translateClipboard(AutoPasteType.Clipboard, true);
            break;
         case TranslateAction.TransSelectionCopy:
            this.translatorPopup.translateClipboard(AutoPasteType.Selection, false, true);
            break;
         case TranslateAction.TransClipboardCopy:
            this.translatorPopup.translateClipboard(AutoPasteType.Clipboard, false, true);
            break;
      }
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
         this._performTranslateAction(action);
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

   setInfoMessage(message) {
      if (message) {
         this.infomenuitem.setIconSymbolicName("emblem-important");
         this.infomenuitem.label.set_text(message);
         this.infomenuitem.actor.show();
      } else {
         this.infomenuitem.actor.hide();
      }
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
            let fromDefName = this.settings.getValue("default-from-language");
            let toDefName = this.settings.getValue("default-to-language");
            this.translatorPopup.setFromLanguage( this.getLanguage( fromDefName ), fromDefName );
            this.translatorPopup.setToLanguage(   this.getLanguage( toDefName ), toDefName );
            this.updateTooltip( fromDefName, toDefName );
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
         if (this.languages[i].englishName.toLowerCase().startsWith(name.toLowerCase()) ||
             this.languages[i].name.toLocaleLowerCase(this.languages[i].code).startsWith(name.toLocaleLowerCase(this.languages[i].code)))
          {
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

   updateTooltip(fromLanguageTxt, toLanguageTxt) {
      if (fromLanguageTxt.length == 0) {
         fromLanguageTxt = _("Auto-detect");
      }
      if(majorVersion > 4 && fromLanguageTxt.length > 0 && toLanguageTxt.length > 0){
         this.set_applet_tooltip("<b>" + _("Translator") + "</b>" + "\n" + fromLanguageTxt + " \u{2B95} " + toLanguageTxt, true);
      } else {
         this.set_applet_tooltip(_("Translator"));
      }
   }
}

class TranslatorPopupItem extends PopupMenu.PopupMenuSection {

   constructor(applet) {
      super();
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
         let fromTxt = this.fromSearchEntry.get_text();
         let to = this.toLanguage;
         let toTxt = this.toSearchEntry.get_text();
         if (this.fromLanguage) {
            this.toLanguage = from;
            this.toSearchEntry.set_text(fromTxt);
            this._applet.settings.setValue("default-to-language", fromTxt);
         }
         if (this.toLanguage) {
            this.fromLanguage = to;
            this.fromSearchEntry.set_text(toTxt);
            this._applet.settings.setValue("default-from-language", toTxt);
         }
         let fromText = this.fromTextBox.get_text();
         let toText = this.toTextBox.get_text();
         if (toText)
            this.fromTextBox.set_text(toText);
         if (fromText)
            this.toTextBox.set_text(fromText);
      });

      let monitor = this._applet.panel.monitor;
      let width = Math.min(monitor.width, this._applet.settings.getValue("popup-width"));
      let height = Math.min(monitor.height, this._applet.settings.getValue("popup-height"));
      this._applet.settings.setValue("popup-width", width);
      this._applet.settings.setValue("popup-height", height);
      this.fromSearchEntry = new St.Entry({ name: 'menu-search-entry', hint_text: _("{auto}"), width: 210*global.ui_scale, track_hover: true, can_focus: true, x_expand: true, x_align: Clutter.ActorAlign.START });
      this.fromSearchEntry.get_clutter_text().connect( 'key-press-event', Lang.bind(this, this._onKeyPressEvent) );
      this.fromSearchEntry.get_clutter_text().connect( 'key-release-event', (actor, event) => {this._onKeyReleaseEvent(actor, event, this.fromLanguage); } );
      this.toSearchEntry = new St.Entry({ name: 'menu-search-entry', width: 210*global.ui_scale, track_hover: true, can_focus: true, x_expand: true, x_align: Clutter.ActorAlign.END });
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
      // Each text box is wrapped in a St.ScrollView. The ScrollView gets the fixed size, the Entry
      // does NOT, so the Entry can grow taller than the view as text wraps, which makes the scrollbar appear.
      let boxWidth  = (width/2-45)*global.ui_scale;
      let boxHeight = (height-90)*global.ui_scale;
      this.fromTextBox = new St.Entry({x_expand: true, name: 'menu-search-entry', hint_text: _("{Text to translate}")});
      let text = this.fromTextBox.get_clutter_text();
      text.set_line_wrap(true);
      text.set_single_line_mode(false);
      text.set_max_length(2000);
      text.connect('text-changed', () => {this.enableTranslateIfPossible();});
      text.connect('activate', (actor, event) => {
         Util.spawnCommandLineAsyncIO( "trans -no-bidi -b -e " + this._applet.engine + " " + this._fromCode() + ":" + this.toLanguage.code + " \"" + escapeQuotes(this.fromTextBox.get_text()) + "\"", Lang.bind(this, this.readTranslation) );
         });
      this.fromScrollView = this._createScrollView(this.fromTextBox, boxWidth, boxHeight, 'margin-right:2px;');
      this.textBox.add_child(this.fromScrollView);

      this.toTextBox = new St.Entry({x_expand: true, name: 'menu-search-entry', hint_text: _("{Translated text}")});
      text = this.toTextBox.get_clutter_text();
      text.set_line_wrap(true);
      text.set_single_line_mode(false);
      text.set_editable(false);
      text.set_max_length(2000);
      text.connect('text-changed', () => {
         let state = (this.toTextBox.get_text().length != 0 );
         this.copy.setEnabled(state);
         this.playTo.setEnabled(state);
         });
      this.toScrollView = this._createScrollView(this.toTextBox, boxWidth, boxHeight, 'margin-left:2px;');
      this.textBox.add_child(this.toScrollView);

      // Setup the action buttons
      this.config = new ControlButton("system-run", _("Configure"), () => {this._applet.menu.close(); this._applet.configureApplet()});
      this.help = new ControlButton("help-about", _("Help"), () => {
         this._applet.menu.close();
         Util.spawnCommandLineAsync("/usr/bin/xdg-open https://cinnamon-spices.linuxmint.com/applets/view/385");
         });
      this.playFrom = new ControlButton("audio-speakers-symbolic", _("Play"), () => {
         Util.spawnCommandLineAsyncIO("trans -no-translate -speak -e " + this._applet.engine + " " + (this.fromLanguage ? this.fromLanguage.code + ":" + this.fromLanguage.code : "") + " \"" + escapeQuotes(this.fromTextBox.get_text()) + "\"", Lang.bind(this, this.readSpeak));
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
         Util.spawnCommandLineAsyncIO( "trans -no-bidi -b -e " + this._applet.engine + " " + this._fromCode() + ":" + this.toLanguage.code + " \"" + escapeQuotes(this.fromTextBox.get_text()) + "\"", Lang.bind(this, this.readTranslation) );
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
         Util.spawnCommandLineAsyncIO("trans -no-translate -speak -e " + this._applet.engine + " " + this.toLanguage.code + ":" + this.toLanguage.code + " \"" + escapeQuotes(this.toTextBox.get_text()) + "\"", Lang.bind(this, this.readSpeak));
         });
      this.playTo.setEnabled(false);

      this.actionBox.add_child(this.config.getActor());
      this.actionBox.add_child(this.help.getActor());
      this.actionBox.add_child(this.paste.getActor());
      this.actionBox.add_child(this.clear.getActor());
      this.actionBox.add_child(this.playFrom.getActor());
      this.actionBox.add_child(this.translate.getActor());
      toBtnBox.add_child(this.copy.getActor());
      toBtnBox.add_child(this.playTo.getActor());
      this.actionBox.add_child(toBtnBox);

      this.addActor(this.vertBox, {expand: true});
      this._applet._signalManager.connect(this._applet.settings, "changed::translate-engine", this._applet.getEngine, this._applet);
      this._applet._signalManager.connect(global, "scale-changed", this._onScaleChanged, this);
   }

   // Wrap a multi-line St.Entry in a vertically scrolling St.ScrollView.
   // Note: a St.ScrollView child must implement St.Scrollable. St.BoxLayout does, St.Bin does not
   // (which is why the Bin version never scrolled).
   _createScrollView(entry, width, height, style) {
      // The ScrollView takes the entry's theme look (name 'menu-search-entry') so the frame is drawn around
      // the whole ScrollView and the scrollbar ends up inside the box. The Entry itself is made frameless.
      let scrollView = new St.ScrollView({ name: 'menu-search-entry', width: width, height: height, style: style,
                                           x_fill: true, y_fill: true, reactive: true, track_hover: true,
                                           hscrollbar_policy: PolicyType.NEVER, vscrollbar_policy: PolicyType.AUTOMATIC });
      let text = entry.get_clutter_text();
      // A read-only box can still get key focus (so text can be selected/copied), but it should not show a text
      // cursor. St.Entry forces the cursor visible on focus, so instead make it zero width.
      entry.set_style('border: none; border-image: none; background-color: transparent; background-gradient-direction: none;' +
                      'box-shadow: none; padding: 0; margin: 0;' + (text.get_editable() ? '' : 'caret-size: 0px;'));
      // Mirror the entry's focus state on the frame (the ScrollView) so the theme's focus highlight still shows
      text.connect('key-focus-in', () => scrollView.add_style_pseudo_class('focus'));
      text.connect('key-focus-out', () => scrollView.remove_style_pseudo_class('focus'));
      // St.Entry always centres its ClutterText vertically within whatever height it is allocated, and
      // there is no property to change that. So never let the entry be taller than its text: don't expand
      // it and pin it to the top of the box. The empty area below the text is just the ScrollView frame.
      entry.set_y_expand(false);
      entry.set_y_align(Clutter.ActorAlign.START);
      // Clicking anywhere in the box (e.g. the padding, or the empty area below the text) focuses the
      // entry, and a click below the text puts the cursor at the end, like a normal multi-line text box.
      scrollView.connect('button-press-event', (actor, event) => {
         if (global.stage.get_key_focus() != text)
            text.grab_key_focus();
         let [, y] = event.get_coords();
         let [, entryY] = entry.get_transformed_position();
         if (y > entryY + entry.get_height()) {
            // Move the selection bound too. Otherwise ClutterText sees a (zero width) selection between the old
            // cursor position and the end, and draws no cursor (and St.Entry stops blinking it).
            text.set_cursor_position(-1);
            text.set_selection_bound(-1);
         }
         return Clutter.EVENT_PROPAGATE;
      });
      text.set_ellipsize(Pango.EllipsizeMode.NONE);
      text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);  // also wrap long words with no spaces
      // St.ScrollView (and the St.BoxLayout inside it) size their content using the MINIMUM size of the
      // children, but St.Entry reports a one-line minimum height even when its text wraps onto many lines,
      // so the ScrollView never thinks it overflows. Letting the layout negotiate sizes is also unstable
      // (the entry can briefly get laid out as wide as the unwrapped text). So we give the entry an explicit
      // size: width = the ScrollView width minus room for the scrollbar, height = the wrapped text height.
      let pendingUpdate = 0;
      let updateEntrySize = () => {
         pendingUpdate = 0;
         if (!entry.get_stage())
            return GLib.SOURCE_REMOVE;
         let node = entry.get_theme_node();
         let [, sbWidth] = scrollView.vscroll.get_preferred_width(-1);
         let svNode = scrollView.get_theme_node();
         let svInner = scrollView.natural_width - svNode.get_horizontal_padding()
                       - svNode.get_border_width(St.Side.LEFT) - svNode.get_border_width(St.Side.RIGHT);
         let entryWidth = Math.floor(svInner - sbWidth);
         let textWidth = entryWidth - node.get_horizontal_padding()
                         - node.get_border_width(St.Side.LEFT) - node.get_border_width(St.Side.RIGHT);
         if (textWidth <= 0)
            return GLib.SOURCE_REMOVE;
         let [, textHeight] = text.get_preferred_height(textWidth);
         let entryHeight = Math.ceil(textHeight + node.get_vertical_padding()
                           + node.get_border_width(St.Side.TOP) + node.get_border_width(St.Side.BOTTOM));
         if (entry.natural_width != entryWidth || entry.natural_height != entryHeight)
            entry.set_size(entryWidth, entryHeight);
         return GLib.SOURCE_REMOVE;
      };
      // Deferred to idle so we never change sizes in the middle of a layout pass
      let queueUpdate = () => {
         if (!pendingUpdate)
            pendingUpdate = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, updateEntrySize);
      };
      scrollView._queueEntrySizeUpdate = queueUpdate;   // called after the popup is resized
      text.connect('text-changed', queueUpdate);
      entry.connect('style-changed', queueUpdate);        // first time on stage, and theme changes
      let box = new St.BoxLayout({ vertical: true, x_expand: true, y_expand: true });
      box.add_child(entry);
      scrollView.add_actor(box);
      // Keep the text cursor visible when typing/moving past the visible area
      let followCursor = () => {
         if (global.stage.get_key_focus() == text)
            this._scrollToCursor(scrollView, entry);
      };
      text.connect('cursor-changed', () => {
         GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            followCursor();
            return GLib.SOURCE_REMOVE;
         });
      });
      // When the text grows, the scroll range is only updated after the next layout, so follow the cursor again then
      scrollView.vscroll.adjustment.connect('changed', followCursor);
      return scrollView;
   }

   _scrollToCursor(scrollView, entry) {
      let text = entry.get_clutter_text();
      let [ok, x, y, lineHeight] = text.position_to_coords(text.get_cursor_position());
      if (!ok) return;
      let top = entry.y + text.y + y;
      let bottom = top + lineHeight;
      let adjustment = scrollView.vscroll.adjustment;
      if (top < adjustment.value)
         adjustment.set_value(top);
      else if (bottom > adjustment.value + adjustment.page_size)
         adjustment.set_value(bottom - adjustment.page_size);
   }

   onBoxResized(w,h) {
      w = Math.max(Math.trunc(w), 540);
      h = Math.max(Math.trunc(h), 160);
      this.fromScrollView.set_width((w/2-45)*global.ui_scale);
      this.fromScrollView.set_height((h-90)*global.ui_scale);
      this.fromScrollView._queueEntrySizeUpdate();

      this.toScrollView.set_width((w/2-45)*global.ui_scale);
      this.toScrollView.set_height((h-90)*global.ui_scale);
      this.toScrollView._queueEntrySizeUpdate();
      this._applet.settings.setValue("popup-width", w);
      this._applet.settings.setValue("popup-height", h);
   }

   _onScaleChanged() {
      let monitor = this._applet.panel.monitor;
      let width = Math.min(monitor.width, this._applet.settings.getValue("popup-width"));
      let height = Math.min(monitor.height, this._applet.settings.getValue("popup-height"));
      this._applet.settings.setValue("popup-width", width);
      this._applet.settings.setValue("popup-height", height);

      this.fromSearchEntry.set_width(210*global.ui_scale);
      this.toSearchEntry.set_width(210*global.ui_scale);
      this.fromScrollView.set_width((width/2-45)*global.ui_scale);
      this.fromScrollView.set_height((height-90)*global.ui_scale);
      this.fromScrollView._queueEntrySizeUpdate();
      this.toScrollView.set_width((width/2-45)*global.ui_scale);
      this.toScrollView.set_height((height-90)*global.ui_scale);
      this.toScrollView._queueEntrySizeUpdate();

      this.switchButton.updateDisabledIcon();
      this.config.updateDisabledIcon();
      this.help.updateDisabledIcon();
      this.playFrom.updateDisabledIcon();
      this.paste.updateDisabledIcon();
      this.clear.updateDisabledIcon();
      this.translate.updateDisabledIcon();
      this.copy.updateDisabledIcon();
      this.playTo.updateDisabledIcon();
   }

   // Handles key press events for the from/to language search entry widgets
   _onKeyPressEvent(actor, event) {
      let key = event.get_key_symbol();
      if (key == Clutter.KEY_BackSpace) {
         // If the auto-filled part of the name is selected (a selection that runs to the end of the text),
         // handle the Backspace here: drop the selection plus one typed character, then let the key release
         // handler auto-fill again. Doing it all here (and stopping the event) means the result does not
         // depend on when ClutterText processes the key or how many key-release events we get.
         let txt = actor.get_text();
         let pos = actor.get_cursor_position();
         let bound = actor.get_selection_bound();
         if (pos == -1) pos = txt.length;
         if (bound == -1) bound = txt.length;
         if (pos != bound && Math.max(pos, bound) == txt.length) {
            let start = Math.min(pos, bound);
            actor.set_text(txt.substring(0, Math.max(start-1, 0)));
            actor.set_cursor_position(-1);
            actor.set_selection_bound(-1);
            return Clutter.EVENT_STOP;
         }
      }
      if (key == Clutter.KEY_Up || key == Clutter.KEY_Down) {
         return Clutter.EVENT_STOP;
      }
   }

   // Handles key release events for the from/to language search entry widgets
   _onKeyReleaseEvent(actor, event, curLanguage) {
      let cursorPos = actor.get_cursor_position();
      let txt = actor.get_text();
      if (cursorPos == -1) {
         cursorPos = txt.length;
      }
      let key = event.get_key_symbol();
      // Keys that don't change the text must not re-run the match (i.e. Home would otherwise match
      // the empty string before the cursor and switch to auto-detect / no language)
      if (NON_EDIT_KEYS.includes(key)) {
         return;
      }
      if (key == Clutter.KEY_BackSpace && cursorPos == 0) {
         actor.set_text("");
         txt = "";
      }
      let txtSubstring = txt.substring(0, cursorPos);
      let language = this._applet.getLanguage(txtSubstring);
      let useEnglish = language ? language.englishName.toLowerCase().startsWith(txtSubstring.toLowerCase()) : true;
      if (language && key == Clutter.KEY_Up || key == Clutter.KEY_Down) {
         let idx = this._applet.languages.indexOf(language);
         if (key == Clutter.KEY_Up && idx > 0) {
            language = this._applet.languages[idx-1];
         } else if (key == Clutter.KEY_Down && idx < this._applet.languages.length-1) {
            language = this._applet.languages[idx+1];
         }
         if (useEnglish) {
            txtSubstring = language.englishName;
         } else {
            txtSubstring = language.name;
         }
         cursorPos = txtSubstring.length;
      }
      if (language != curLanguage) {
         curLanguage = language;
         // Set the text box to "" since the associated language has been changed.
         if (actor == this.fromSearchEntry.get_clutter_text()) {
            this.fromLanguage = language;
            this.fromTextBox.set_text(""); // Clear the text box since the language has changed!
            if (language) {
               this._applet.settings.setValue("default-from-language", useEnglish ? language.englishName : language.name);
            } else if (txt.length == 0) {
               this._applet.settings.setValue("default-from-language", "");  // Empty = auto-detect
            }
         } else {
            this.toLanguage = language;
            this.toTextBox.set_text(""); // Clear the text box since the language has changed!
            if (language) {
               this._applet.settings.setValue("default-to-language", useEnglish ? language.englishName : language.name);
            }
         }
      }
      this.enableTranslateIfPossible();
      if (curLanguage) {
         if (useEnglish) {
            actor.set_text(curLanguage.englishName);
         } else {
            actor.set_text(curLanguage.name);
         }
         actor.set_cursor_position(cursorPos);
      }
      this._applet.updateTooltip(this.fromSearchEntry.get_text(), this.toSearchEntry.get_text());
   }

   readTranslation(stdout, stderr, exitCode) {
      if (exitCode===0) {
         this.toTextBox.set_text( stdout.trim() );
      }
      return exitCode;
   }

   readSpeak(stdout, stderr, exitCode) {
      if (exitCode===0 && stderr.length > 0) {
         this._applet.setInfoMessage(stderr.trim());
      }
      return exitCode;
   }

   playTranslation(stdout, stderr, exitCode) {
      if (this.readTranslation(stdout, stderr, exitCode)==0) {
         Util.spawnCommandLineAsync("trans -b -p -e " + this._applet.engine + " " + this.toLanguage.code + ":" + this.toLanguage.code + " \"" + escapeQuotes(this.toTextBox.get_text()) + "\"");
      }
   }

   copyTranslation(stdout, stderr, exitCode) {
      if (this.readTranslation(stdout, stderr, exitCode)==0) {
         St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this.toTextBox.get_text());
      }
   }

   translateClipboard(autoPaste, play, copy=false) {
      let clipboard = St.Clipboard.get_default();
      if (autoPaste != AutoPasteType.Selection) {
         clipboard.get_text(St.ClipboardType.CLIPBOARD, (cb, text) => {this.clipboardText(cb, text, true, play, copy);} );
      } else {
         clipboard.get_text(St.ClipboardType.PRIMARY, (cb, text) => {this.clipboardText(cb, text, true, play, copy);} );
      }
   }

   // Callback that gets the clipboard text then performs some action with that text.
   clipboardText(cb, text, translate, play=false, copy=false) {
      this.fromTextBox.set_text(text.trim());
      if (translate) {
         if (play) {
            Util.spawnCommandLineAsyncIO( "trans -no-bidi -b -e " + this._applet.engine + " " + this._fromCode() + ":" + this.toLanguage.code + " \"" + escapeQuotes(this.fromTextBox.get_text()) + "\"", Lang.bind(this, this.playTranslation) );
         } else if (copy) {
            Util.spawnCommandLineAsyncIO( "trans -no-bidi -b -e " + this._applet.engine + " " + this._fromCode() + ":" + this.toLanguage.code + " \"" + escapeQuotes(this.fromTextBox.get_text()) + "\"", Lang.bind(this, this.copyTranslation) );
         } else {
            Util.spawnCommandLineAsyncIO( "trans -no-bidi -b -e " + this._applet.engine + " " + this._fromCode() + ":" + this.toLanguage.code + " \"" + escapeQuotes(this.fromTextBox.get_text()) + "\"", Lang.bind(this, this.readTranslation) );
         }
      } else {
         this.toTextBox.set_text("");
      }
   }

   setFromLanguage(lang, name) {
      this.fromLanguage = lang;
      this.fromSearchEntry.set_text(lang ? name : "");  // Empty shows the "{auto}" hint
      this.enableTranslateIfPossible();
   }

   setToLanguage(lang, name) {
      this.toLanguage = lang;
      this.toSearchEntry.set_text(name);
      this.enableTranslateIfPossible();
   }

   enableTranslateIfPossible() {
      // An empty "from" language entry means translate-shell will auto-detect the source language. But if
      // text was entered that doesn't match any language, don't allow translating.
      let fromOk = this.fromLanguage || this.fromSearchEntry.get_text().length == 0;
      let state = (this.fromTextBox.get_text().length != 0 && fromOk && this.toLanguage) ? true : false;
      this.playFrom.setEnabled(state);
      this.translate.setEnabled(state);
      // Can't swap when the "from" language is auto-detect, since the "to" language can't be auto
      this.switchButton.setEnabled(this.fromLanguage ? true : false);
   }

   // The translate-shell source language code, "" means auto-detect
   _fromCode() {
      return this.fromLanguage ? this.fromLanguage.code : "";
   }
}

/* This class was borrowed from sound@cinnamon.org */
class ControlButton {
    constructor(icon, tooltip, callback) {
        this.actor = new St.Bin();
        this.button = new St.Button({style_class: 'menu-favorites-button' /*'panel-translator-button' 'menu-favorites-button' 'keyboard-key'*/});
        this.button.connect('clicked', callback);
        this.icon_name = icon;
        this.icon = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_name: icon, icon_size: ICON_SIZE });
        this.updateDisabledIcon();
        this.button.set_child(this.icon);
        this.actor.add_actor(this.button);
        this.tooltip = new Tooltips.Tooltip(this.button, tooltip);
    }

    updateDisabledIcon() {
        let themeIcon = ICONTHEME.lookup_icon(this.icon_name, ICON_SIZE*global.ui_scale, 0);
        if (themeIcon) {
           let pixBuf = null;
           try {
              pixBuf = GdkPixbuf.Pixbuf.new_from_file_at_size(themeIcon.get_filename(), ICON_SIZE*global.ui_scale, ICON_SIZE*global.ui_scale);
           } catch(e) {
              // The icon may not be a real file (e.g. a GTK built-in resource), so just use the default!
           }
           if (pixBuf) {
              let image = new Clutter.Image();
              pixBuf.saturate_and_pixelate(pixBuf, 1, true);
              try {
                 image.set_data(pixBuf.get_pixels(), pixBuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGBA_888,
                    ICON_SIZE*global.ui_scale, ICON_SIZE*global.ui_scale, pixBuf.get_rowstride() );
                 this.disabledIcon = new Clutter.Actor({width: ICON_SIZE*global.ui_scale, height: ICON_SIZE*global.ui_scale, content: image});
                 if (this.enabledStatus === false) {
                    // Since the disabledIcon has changed, we might need to reflect that change in the actual button
                    this.setEnabled(false);
                 }
              } catch(e) {
                 // Can't set the image data, so just use the default!
              }
           }
        }
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
        this.enabledStatus = status;
        this.button.change_style_pseudo_class("insensitive", !status);
        this.button.can_focus = status;
        this.button.reactive = status;
        if (status || this.disabledIcon==undefined) {
           this.button.set_child(this.icon);
        } else {
           this.button.set_child(this.disabledIcon);
        }
    }
}

// Called by cinnamon when starting this applet
function main(metadata, orientation, panelHeight, instanceId) {
  return new PanelTranslatorApp(orientation, panelHeight, instanceId);
}
