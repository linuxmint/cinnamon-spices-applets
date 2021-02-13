const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gettext = imports.gettext;
const UUID = "standardIconNames@jerrywham";
const Util = imports.misc.util;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;  // Needed for settings API
const Main = imports.ui.main;
const Cinnamon = imports.gi.Cinnamon;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
// const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
const HOME = GLib.get_home_dir();

//applet command constants
// var CommandConstants = new function() {
//   this.COMMAND = "";
// }


Gettext.bindtextdomain(UUID, HOME + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation, metadata, panelHeight,  instance_id){
  this._init(orientation,metadata);
}

MyApplet.prototype = {

  __proto__: Applet.IconApplet.prototype,

  _init: function(orientation, metadata, panelHeight,  instance_id){

    Applet.IconApplet.prototype._init.call(this, orientation, panelHeight,  instance_id);

    this.instance_id=instance_id;
    this.set_applet_icon_symbolic_name("applications-utilities");
    this.set_applet_tooltip("Standard Icon Names");

    this.appletPath=metadata.path;
    this.pick_notification = true;

    //setup a new menuManager and add the main context main to the manager

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    // Sub-menus

    ///////////////////////////////////////////////
	//                                           //
	//  ████   ████  ██████  ████   ████  ██  ██ //
	// ██  ██ ██  ██ █ ██ █   ██   ██  ██ ███ ██ //
	// ██████ ██       ██     ██   ██  ██ ██████ //
	// ██  ██ ██  ██   ██     ██   ██  ██ ██ ███ //
	// ██  ██  ████   ████   ████   ████  ██  ██ //
	//                                           //
	///////////////////////////////////////////////

    this._StandardActionIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Action Icons"));

    this._addItemToSubMenu("address-book-new",this._StandardActionIconsItem);
	this._addItemToSubMenu("application-exit", this._StandardActionIconsItem);
	this._addItemToSubMenu("appointment-new", this._StandardActionIconsItem);
	this._addItemToSubMenu("call-start", this._StandardActionIconsItem);
	this._addItemToSubMenu("call-stop", this._StandardActionIconsItem);
	this._addItemToSubMenu("contact-new", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-new", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-open", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-open-recent", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-page-setup", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-print", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-print-preview", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-properties", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-revert", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-save", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-save-as", this._StandardActionIconsItem);
	this._addItemToSubMenu("document-send", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-clear", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-copy", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-cut", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-delete", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-find", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-find-replace", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-paste", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-redo", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-select-all", this._StandardActionIconsItem);
	this._addItemToSubMenu("edit-undo", this._StandardActionIconsItem);
	this._addItemToSubMenu("folder-new", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-indent-less", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-indent-more", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-justify-center", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-justify-fill", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-justify-left", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-justify-right", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-text-direction-ltr", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-text-direction-rtl", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-text-bold", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-text-italic", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-text-underline", this._StandardActionIconsItem);
	this._addItemToSubMenu("format-text-strikethrough", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-bottom", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-down", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-first", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-home", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-jump", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-last", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-next", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-previous", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-top", this._StandardActionIconsItem);
	this._addItemToSubMenu("go-up", this._StandardActionIconsItem);
	this._addItemToSubMenu("help-about", this._StandardActionIconsItem);
	this._addItemToSubMenu("help-contents", this._StandardActionIconsItem);
	this._addItemToSubMenu("help-faq", this._StandardActionIconsItem);
	this._addItemToSubMenu("insert-image", this._StandardActionIconsItem);
	this._addItemToSubMenu("insert-link", this._StandardActionIconsItem);
	this._addItemToSubMenu("insert-object", this._StandardActionIconsItem);
	this._addItemToSubMenu("insert-text", this._StandardActionIconsItem);
	this._addItemToSubMenu("list-add", this._StandardActionIconsItem);
	this._addItemToSubMenu("list-remove", this._StandardActionIconsItem);
	this._addItemToSubMenu("mail-mark-important", this._StandardActionIconsItem);
	this._addItemToSubMenu("mail-send", this._StandardActionIconsItem);
	this._addItemToSubMenu("mail-send-receive", this._StandardActionIconsItem);
	this._addItemToSubMenu("media-eject", this._StandardActionIconsItem);
	this._addItemToSubMenu("media-playback-pause", this._StandardActionIconsItem);
	this._addItemToSubMenu("media-playback-start", this._StandardActionIconsItem);
	this._addItemToSubMenu("media-playback-stop", this._StandardActionIconsItem);
	this._addItemToSubMenu("media-record", this._StandardActionIconsItem);
	this._addItemToSubMenu("media-seek-backward", this._StandardActionIconsItem);
	this._addItemToSubMenu("media-seek-forward", this._StandardActionIconsItem);
	this._addItemToSubMenu("media-skip-backward", this._StandardActionIconsItem);
	this._addItemToSubMenu("media-skip-forward", this._StandardActionIconsItem);
	this._addItemToSubMenu("object-flip-horizontal", this._StandardActionIconsItem);
	this._addItemToSubMenu("object-flip-vertical", this._StandardActionIconsItem);
	this._addItemToSubMenu("object-rotate-left", this._StandardActionIconsItem);
	this._addItemToSubMenu("object-rotate-right", this._StandardActionIconsItem);
	this._addItemToSubMenu("process-stop", this._StandardActionIconsItem);
	this._addItemToSubMenu("system-lock-screen", this._StandardActionIconsItem);
	this._addItemToSubMenu("system-run", this._StandardActionIconsItem);
	this._addItemToSubMenu("system-search", this._StandardActionIconsItem);
	this._addItemToSubMenu("system-shutdown", this._StandardActionIconsItem);
	this._addItemToSubMenu("tools-check-spelling", this._StandardActionIconsItem);
	this._addItemToSubMenu("view-fullscreen", this._StandardActionIconsItem);
	this._addItemToSubMenu("view-refresh", this._StandardActionIconsItem);
	this._addItemToSubMenu("view-restore", this._StandardActionIconsItem);
	this._addItemToSubMenu("view-sort-ascending", this._StandardActionIconsItem);
	this._addItemToSubMenu("view-sort-descending", this._StandardActionIconsItem);
	this._addItemToSubMenu("window-close", this._StandardActionIconsItem);
	this._addItemToSubMenu("zoom-fit-best", this._StandardActionIconsItem);
	this._addItemToSubMenu("zoom-in", this._StandardActionIconsItem);
	this._addItemToSubMenu("zoom-original", this._StandardActionIconsItem);
	this._addItemToSubMenu("zoom-out", this._StandardActionIconsItem);

    this.menu.addMenuItem(this._StandardActionIconsItem);

    /////////////////////////////////////////////////////////////////////
    //                                                                 //
    //  ████  ██  ██  ████  █     █  ████  ██████  ████   ████  ██  ██ //
    // ██  ██ ███ ██   ██   ██   ██ ██  ██ █ ██ █   ██   ██  ██ ███ ██ //
    // ██████ ██████   ██   ███ ███ ██████   ██     ██   ██  ██ ██████ //
    // ██  ██ ██ ███   ██   ██ █ ██ ██  ██   ██     ██   ██  ██ ██ ███ //
    // ██  ██ ██  ██  ████  ██   ██ ██  ██  ████   ████   ████  ██  ██ //
    //                                                                 //
    /////////////////////////////////////////////////////////////////////

    this._StandardAnimationIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Animation Icons"));
    this._addItemToSubMenu("process-working",this._StandardAnimationIconsItem);
    this.menu.addMenuItem(this._StandardAnimationIconsItem);

    //////////////////////////////////////////////////////////////////////////////////
    //                                                                              //
    //  ████  █████  █████  ████    ████   ████   ████  ██████  ████   ████  ██  ██ //
    // ██  ██ ██  ██ ██  ██  ██      ██   ██  ██ ██  ██ █ ██ █   ██   ██  ██ ███ ██ //
    // ██████ █████  █████   ██      ██   ██     ██████   ██     ██   ██  ██ ██████ //
    // ██  ██ ██     ██      ██ ██   ██   ██  ██ ██  ██   ██     ██   ██  ██ ██ ███ //
    // ██  ██ ██     ██     ██████  ████   ████  ██  ██  ████   ████   ████  ██  ██ //
    //                                                                              //
    //////////////////////////////////////////////////////////////////////////////////

    this._StandardApplicationsIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Applications Icons"));

    this._addItemToSubMenu("accessories-calculator",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("accessories-character-map",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("accessories-dictionary",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("accessories-text-editor",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("help-browser",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("multimedia-volume-control",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("preferences-desktop-accessibility",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("preferences-desktop-font",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("preferences-desktop-keyboard",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("preferences-desktop-locale",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("preferences-desktop-screensaver",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("preferences-desktop-wallpaper",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("system-file-manager",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("system-software-install",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("utilities-system-monitor",this._StandardApplicationsIconsItem);
    this._addItemToSubMenu("utilities-terminal",this._StandardApplicationsIconsItem);

    this.menu.addMenuItem(this._StandardApplicationsIconsItem);

    /////////////////////////////////////////////////////////////
    //                                                         //
    //  ████   ████  ██████ ██████  ████   ████  █████  ██  ██ //
    // ██  ██ ██  ██ █ ██ █ ██     ██     ██  ██ ██  ██ ██  ██ //
    // ██     ██████   ██   █████  ██ ███ ██  ██ █████   ████  //
    // ██  ██ ██  ██   ██   ██     ██  ██ ██  ██ ██  ██   ██   //
    //  ████  ██  ██  ████  ██████  ████   ████  ██  ██   ██   //
    //                                                         //
    /////////////////////////////////////////////////////////////

    this._StandardCategoryIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Category Icons"));

    this._addItemToSubMenu("applications-engineering",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("applications-games",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("applications-graphics",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("applications-multimedia",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("applications-science",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("applications-system",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("applications-utilities",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("preferences-other",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("preferences-system",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("preferences-system-network",this._StandardCategoryIconsItem);
    this._addItemToSubMenu("system-help",this._StandardCategoryIconsItem);

    this.menu.addMenuItem(this._StandardCategoryIconsItem);

    ///////////////////////////////////////////////
    //                                           //
    // █████  ██████ ██  ██  ████   ████  ██████ //
    // ██  ██ ██     ██  ██   ██   ██  ██ ██     //
    // ██  ██ █████  ██  ██   ██   ██     █████  //
    // ██  ██ ██      ████    ██   ██  ██ ██     //
    // █████  ██████   ██    ████   ████  ██████ //
    //                                           //
    ///////////////////////////////////////////////

    this._StandardDeviceIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Device Icons"));

    this._addItemToSubMenu("audio-card",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("audio-input-microphone",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("battery",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("camera-photo",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("camera-video",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("camera-web",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("computer",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("drive-harddisk",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("drive-optical",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("drive-removable-media",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("input-gaming",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("input-keyboard",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("input-mouse",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("input-tablet",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("media-flash",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("media-floppy",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("media-optical",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("media-tape",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("modem",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("multimedia-player",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("network-wired",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("network-wireless",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("pda",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("phone",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("printer",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("scanner",this._StandardDeviceIconsItem);
    this._addItemToSubMenu("video-display",this._StandardDeviceIconsItem);

    this.menu.addMenuItem(this._StandardDeviceIconsItem);

    /////////////////////////////////////////////////
    //											   //
    // ██████ █     █ █████  ████   ██████ █     █ //
    // ██     ██   ██ ██  ██  ██    ██     ██   ██ //
    // █████  ███ ███ █████   ██    █████  ███ ███ //
    // ██     ██ █ ██ ██  ██  ██ ██ ██     ██ █ ██ //
    // ██████ ██   ██ █████  ██████ ██████ ██   ██ //
    //                                             //
    /////////////////////////////////////////////////

    this._StandardEmblemIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Emblem Icons"));

    this._addItemToSubMenu("emblem-default",this._StandardEmblemIconsItem);
    this._addItemToSubMenu("emblem-documents",this._StandardEmblemIconsItem);
    this._addItemToSubMenu("emblem-favorite",this._StandardEmblemIconsItem);
    this._addItemToSubMenu("emblem-important",this._StandardEmblemIconsItem);
    this._addItemToSubMenu("emblem-photos",this._StandardEmblemIconsItem);
    this._addItemToSubMenu("emblem-shared",this._StandardEmblemIconsItem);
    this._addItemToSubMenu("emblem-system",this._StandardEmblemIconsItem);

    this.menu.addMenuItem(this._StandardEmblemIconsItem);

    ///////////////////////////////////////////////////////
    //                                                   //
    // ██████ █     █  ████  ██████  ████   ████  ██  ██ //
    // ██     ██   ██ ██  ██ █ ██ █   ██   ██  ██ ███ ██ //
    // █████  ███ ███ ██  ██   ██     ██   ██  ██ ██████ //
    // ██     ██ █ ██ ██  ██   ██     ██   ██  ██ ██ ███ //
    // ██████ ██   ██  ████   ████   ████   ████  ██  ██ //
    //                                                   //
    ///////////////////////////////////////////////////////

    this._StandardEmotionIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Emotion Icons"));

    this._addItemToSubMenu("face-angel",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-angry",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-cool",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-crying",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-devilish",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-embarrassed",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-kiss",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-laugh",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-monkey",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-plain",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-raspberry",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-sad",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-sick",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-smile",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-smile-big",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-smirk",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-surprise",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-tired",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-uncertain",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-wink",this._StandardEmotionIconsItem);
    this._addItemToSubMenu("face-worried",this._StandardEmotionIconsItem);

    this.menu.addMenuItem(this._StandardEmotionIconsItem);

    //////////////////////////////////////////////////////////////////////
    //                                                                  //
    // █     █  ████  █     █ ██████        ██████ ██  ██ █████  ██████ //
    // ██   ██   ██   ██   ██ ██            █ ██ █ ██  ██ ██  ██ ██     //
    // ███ ███   ██   ███ ███ █████           ██    ████  █████  █████  //
    // ██ █ ██   ██   ██ █ ██ ██              ██     ██   ██     ██     //
    // ██   ██  ████  ██   ██ ██████         ████    ██   ██     ██████ //
    //                                                                  //
    //////////////////////////////////////////////////////////////////////

    this._StandardMIMETypeIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard MIME Type Icons"));

    this._addItemToSubMenu("application-x-executable",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("audio-x-generic",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("font-x-generic",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("image-x-generic",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("package-x-generic",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("text-x-generic",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("video-x-generic",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("x-office-address-book",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("x-office-calendar",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("x-office-document",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("x-office-presentation",this._StandardMIMETypeIconsItem);
    this._addItemToSubMenu("x-office-spreadsheet",this._StandardMIMETypeIconsItem);

    this.menu.addMenuItem(this._StandardMIMETypeIconsItem);

    ////////////////////////////////////////
    //                                    //
    // █████  ████    ████   ████  ██████ //
    // ██  ██  ██    ██  ██ ██  ██ ██     //
    // █████   ██    ██████ ██     █████  //
    // ██      ██ ██ ██  ██ ██  ██ ██     //
    // ██     ██████ ██  ██  ████  ██████ //
    //                                    //
    ////////////////////////////////////////

    this._StandardPlaceIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Place Icons"));

    this._addItemToSubMenu("folder",this._StandardPlaceIconsItem);
    this._addItemToSubMenu("folder-remote",this._StandardPlaceIconsItem);
    this._addItemToSubMenu("network-server",this._StandardPlaceIconsItem);
    this._addItemToSubMenu("network-workgroup",this._StandardPlaceIconsItem);
    this._addItemToSubMenu("start-here",this._StandardPlaceIconsItem);
    this._addItemToSubMenu("user-bookmarks",this._StandardPlaceIconsItem);
    this._addItemToSubMenu("user-desktop",this._StandardPlaceIconsItem);
    this._addItemToSubMenu("user-home",this._StandardPlaceIconsItem);
    this._addItemToSubMenu("user-trash",this._StandardPlaceIconsItem);

    this.menu.addMenuItem(this._StandardPlaceIconsItem);

    ///////////////////////////////////////////////
    //                                           //
    //  ████  ██████  ████  ██████ ██  ██  ████  //
    // ██   █ █ ██ █ ██  ██ █ ██ █ ██  ██ ██   █ //
    //   ██     ██   ██████   ██   ██  ██   ██   //
    // █   ██   ██   ██  ██   ██   ██  ██ █   ██ //
    //  ████   ████  ██  ██  ████   ████   ████  //
    //                                           //
    ///////////////////////////////////////////////

    this._StandardStatusIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Status Icons"));

    this._addItemToSubMenu("appointment-missed",this._StandardStatusIconsItem);
    this._addItemToSubMenu("appointment-soon",this._StandardStatusIconsItem);
    this._addItemToSubMenu("audio-volume-high",this._StandardStatusIconsItem);
    this._addItemToSubMenu("audio-volume-low",this._StandardStatusIconsItem);
    this._addItemToSubMenu("audio-volume-medium",this._StandardStatusIconsItem);
    this._addItemToSubMenu("audio-volume-muted",this._StandardStatusIconsItem);
    this._addItemToSubMenu("battery-caution",this._StandardStatusIconsItem);
    this._addItemToSubMenu("battery-low",this._StandardStatusIconsItem);
    this._addItemToSubMenu("dialog-error",this._StandardStatusIconsItem);
    this._addItemToSubMenu("dialog-information",this._StandardStatusIconsItem);
    this._addItemToSubMenu("dialog-password",this._StandardStatusIconsItem);
    this._addItemToSubMenu("dialog-question",this._StandardStatusIconsItem);
    this._addItemToSubMenu("dialog-warning",this._StandardStatusIconsItem);
    this._addItemToSubMenu("folder-drag-accept",this._StandardStatusIconsItem);
    this._addItemToSubMenu("folder-open",this._StandardStatusIconsItem);
    this._addItemToSubMenu("folder-visiting",this._StandardStatusIconsItem);
    this._addItemToSubMenu("image-loading",this._StandardStatusIconsItem);
    this._addItemToSubMenu("mail-attachment",this._StandardStatusIconsItem);
    this._addItemToSubMenu("mail-unread",this._StandardStatusIconsItem);
    this._addItemToSubMenu("mail-read",this._StandardStatusIconsItem);
    this._addItemToSubMenu("mail-replied",this._StandardStatusIconsItem);
    this._addItemToSubMenu("media-playlist-repeat",this._StandardStatusIconsItem);
    this._addItemToSubMenu("media-playlist-shuffle",this._StandardStatusIconsItem);
    this._addItemToSubMenu("network-error",this._StandardStatusIconsItem);
    this._addItemToSubMenu("network-idle",this._StandardStatusIconsItem);
    this._addItemToSubMenu("network-offline",this._StandardStatusIconsItem);
    this._addItemToSubMenu("network-receive",this._StandardStatusIconsItem);
    this._addItemToSubMenu("network-transmit",this._StandardStatusIconsItem);
    this._addItemToSubMenu("network-transmit-receive",this._StandardStatusIconsItem);
    this._addItemToSubMenu("printer-error",this._StandardStatusIconsItem);
    this._addItemToSubMenu("printer-printing",this._StandardStatusIconsItem);
    this._addItemToSubMenu("security-high",this._StandardStatusIconsItem);
    this._addItemToSubMenu("security-medium",this._StandardStatusIconsItem);
    this._addItemToSubMenu("security-low",this._StandardStatusIconsItem);
    this._addItemToSubMenu("software-update-available",this._StandardStatusIconsItem);
    this._addItemToSubMenu("software-update-urgent",this._StandardStatusIconsItem);
    this._addItemToSubMenu("task-due",this._StandardStatusIconsItem);
    this._addItemToSubMenu("task-past-due",this._StandardStatusIconsItem);
    this._addItemToSubMenu("user-available",this._StandardStatusIconsItem);
    this._addItemToSubMenu("user-away",this._StandardStatusIconsItem);
    this._addItemToSubMenu("user-idle",this._StandardStatusIconsItem);
    this._addItemToSubMenu("user-offline",this._StandardStatusIconsItem);
    this._addItemToSubMenu("user-trash-full",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-clear",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-clear-night",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-few-clouds",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-few-clouds-night",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-fog",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-overcast",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-severe-alert",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-showers",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-showers-scattered",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-snow",this._StandardStatusIconsItem);
    this._addItemToSubMenu("weather-storm",this._StandardStatusIconsItem);

    this.menu.addMenuItem(this._StandardStatusIconsItem);

    // this._StandardActionIconsItem = new PopupMenu.PopupSubMenuMenuItem(_("Standard Action Icons"));
    // this._addItemToSubMenu("",this._StandardActionIconsItem);
    // this.menu.addMenuItem(this._StandardActionIconsItem);

  },

  notify_send: function(notification, iconPath) {
      if (iconPath == null)
          iconPath = this.appletPath + '/icon.png';
      Util.spawnCommandLine('notify-send --hint=int:transient:1 "' + notification + '" --icon=' + iconPath);
  },

  notify_installation: function(packageName) {
      this.notify_send(_("Please install the '%s' package.").format(packageName), null);
  },

  _addItemToSubMenu: function(label,subMenu){
  	let item = new PopupMenu.PopupIconMenuItem(_(""+label+""), ""+label+"", St.IconType.SYMBOLIC);
    item.connect('activate', Lang.bind(this, function() {
        if(Gio.file_new_for_path("/usr/bin/xclip").query_exists(null)) {
           Util.spawn_async(["python3", this.appletPath + "/copyscript.py", item.label.get_text()], Lang.bind(this, function(output) {
               global.unset_cursor();
               output = output.replace(/\n$/, "");
               if (output == "ImportError Xlib") {
                   Util.spawnCommandLine("apturl apt://python3-xlib");
                   this.notify_installation('python3-xlib');
               } else if (output == "ImportError numpy") {
                   this.notify_installation('python3-numpy');
                   Util.spawnCommandLine("apturl apt://python3-numpy");
               } else {
                   if (this.pick_notification) {
                       this.notify_send(_("Item '%s' copied to clipboard.").format(output), output);
                   }
               }
           }));
       } else {
           this.notify_installation('xclip');
           Util.spawnCommandLine("apturl apt://xclip");
       }
    }));
    subMenu.menu.addMenuItem(item);
  },

  on_applet_clicked: function(event) {
    this.menu.toggle();
  },
}

function main(metadata, orientation, panelHeight,  instance_id){
  let myApplet = new MyApplet(orientation, metadata, panelHeight,  instance_id);
  return myApplet;
}
