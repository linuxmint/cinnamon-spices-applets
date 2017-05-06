const AppletUUID = "0dyseus@DesktopHandler";
const CoverflowSwitcher = imports.ui.appSwitcher.coverflowSwitcher;
const TimelineSwitcher = imports.ui.appSwitcher.timelineSwitcher;
const ClassicSwitcher = imports.ui.appSwitcher.classicSwitcher;
const AppSwitcher = imports.ui.appSwitcher.appSwitcher;
const St = imports.gi.St;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

// Needed for confirmation dialogs.
const ModalDialog = imports.ui.modalDialog;

Gettext.bindtextdomain(AppletUUID, GLib.get_home_dir() + "/.local/share/locale");

function _(aStr) {
    let customTrans = Gettext.dgettext(AppletUUID, aStr);

    if (customTrans !== aStr && customTrans !== "") {
        return customTrans;
    }

    return Gettext.gettext(aStr);
}

/**
 * #MenuItem
 * @_text (string): Text to be displayed in the menu item
 * @_icon (string): Name of icon to be displayed in the menu item
 * @_callback (Function): Callback function when the menu item is clicked
 * @icon (St.Icon): Icon of the menu item
 *
 * A menu item that contains an icon, a text and responds to clicks
 *
 * Inherits: PopupMenu.PopupBaseMenuItem
 */
function MenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

MenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    /**
     * _init:
     * @text (string): text to be displayed in the menu item
     * @icon (string): name of icon to be displayed in the menu item
     * @callback (Function): callback function to be called when the menu item is clicked
     *
     * Constructor function
     */
    _init: function(text, icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this._text = text;
        this._icon = icon;
        this._callback = callback;

        let table = new St.Table({
            homogeneous: false,
            reactive: true
        });
        this.icon = icon;
        table.add(this.icon, {
            row: 0,
            col: 0,
            col_span: 1,
            x_expand: false,
            y_fill: St.Align.START,
            x_fill: St.Align.START,
            x_align: St.Align.START
        });

        this.label = new St.Label({
            text: text
        });
        this.label.set_margin_left(6.0);
        table.add(this.label, {
            row: 0,
            col: 1,
            col_span: 1,
            x_align: St.Align.START
        });
        this.addActor(table, {
            expand: true,
            span: 1,
            align: St.Align.START
        });
        this.connect('activate', callback);
    },

    /**
     * clone:
     * Clones the menu item
     * Returns (MenuItem): a clone of this menu item
     */
    clone: function() {
        return new MenuItem(this._text, this._icon, this._callback);
    }
};

function MyClassicSwitcher() {
    this._init.apply(this, arguments);
}

MyClassicSwitcher.prototype = {
    __proto__: ClassicSwitcher.ClassicSwitcher.prototype,

    _init: function() {
        AppSwitcher.AppSwitcher.prototype._init.apply(this, arguments);

        this.actor = new Cinnamon.GenericContainer({
            name: "altTabPopup",
            reactive: true,
            visible: false
        });

        this._thumbnailTimeoutId = 0;
        this.thumbnailsVisible = false;
        this._displayPreviewTimeoutId = 0;

        Main.uiGroup.add_actor(this.actor);

        if (!this._setupModal())
            return true;

        let styleSettings = this._binding.pref_switcher_style;

        if (styleSettings === "default")
            styleSettings = global.settings.get_string("alttab-switcher-style");

        let features = styleSettings.split("+");
        this._iconsEnabled = features.indexOf("icons") !== -1;
        this._previewEnabled = features.indexOf("preview") !== -1;
        this._thumbnailsEnabled = features.indexOf("thumbnails") !== -1;

        if (!this._iconsEnabled && !this._previewEnabled && !this._thumbnailsEnabled)
            this._iconsEnabled = true;

        this._showThumbnails = this._thumbnailsEnabled && !this._iconsEnabled;
        this._showArrows = this._thumbnailsEnabled && this._iconsEnabled;

        this._updateList(0);

        this.actor.connect("get-preferred-width", Lang.bind(this, this._getPreferredWidth));
        this.actor.connect("get-preferred-height", Lang.bind(this, this._getPreferredHeight));
        this.actor.connect("allocate", Lang.bind(this, this._allocate));

        // Need to force an allocation so we can figure out whether we
        // need to scroll when selecting
        this.actor.opacity = 0;
        this.actor.show();
        this.actor.get_allocation_box();

        return true;
    },

    _setupModal: function() {
        this._haveModal = Main.pushModal(this.actor);
        if (!this._haveModal)
            this._activateSelected();
        else {
            this._disableHover();
            this.actor.connect("key-press-event", Lang.bind(this, this._keyPressEvent));
            this.actor.connect("key-release-event", Lang.bind(this, this._keyReleaseEvent));
            this.actor.connect("scroll-event", Lang.bind(this, this._scrollEvent));
            this.actor.connect("button-press-event", Lang.bind(this, this.owndestroy));
            let delay = global.settings.get_int("alttab-switcher-delay");
            this._initialDelayTimeoutId = Mainloop.timeout_add(delay, Lang.bind(this, this._show));
            this._currentIndex--;
        }
        return this._haveModal;
    },

    _keyReleaseEvent: function(actor, event) {
        let key = event.get_key_symbol();
        if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) return true;
        if (this._initialDelayTimeoutId !== 0)
            this._currentIndex = (this._currentIndex + 1) % this._windows.length;
        this._activateSelected();
        return true;
    },

    owndestroy: function() {
        this._activateSelected();
    },
};

function MyTimelineSwitcher() {
    this._init.apply(this, arguments);
}

MyTimelineSwitcher.prototype = {
    __proto__: TimelineSwitcher.TimelineSwitcher.prototype,

    _init: function() {
        TimelineSwitcher.TimelineSwitcher.prototype._init.apply(this, arguments);
    },

    _setupModal: function() {
        this._haveModal = Main.pushModal(this.actor);
        if (!this._haveModal)
            this._activateSelected();
        else {
            this._disableHover();

            this.actor.connect("key-press-event", Lang.bind(this, this._keyPressEvent));
            this.actor.connect("key-release-event", Lang.bind(this, this._keyReleaseEvent));
            this.actor.connect("scroll-event", Lang.bind(this, this._scrollEvent));
            this.actor.connect("button-press-event", Lang.bind(this, this.owndestroy));
            let delay = global.settings.get_int("alttab-switcher-delay");
            this._initialDelayTimeoutId = Mainloop.timeout_add(delay, Lang.bind(this, this._show));
            this._currentIndex--;
        }
        return this._haveModal;
    },

    _keyReleaseEvent: function(actor, event) {
        let key = event.get_key_symbol();
        if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) return true;
        if (this._initialDelayTimeoutId !== 0)
            this._currentIndex = (this._currentIndex + 1) % this._windows.length;
        this._activateSelected();
        return true;
    },

    owndestroy: function() {
        this._activateSelected();
    },
};

function MyCoverflowSwitcher() {
    this._init.apply(this, arguments);
}

MyCoverflowSwitcher.prototype = {
    __proto__: CoverflowSwitcher.CoverflowSwitcher.prototype,

    _init: function() {
        CoverflowSwitcher.CoverflowSwitcher.prototype._init.apply(this, arguments);
    },

    _setupModal: function() {
        this._haveModal = Main.pushModal(this.actor);
        if (!this._haveModal)
            this._activateSelected();
        else {
            this._disableHover();

            this.actor.connect("key-press-event", Lang.bind(this, this._keyPressEvent));
            this.actor.connect("key-release-event", Lang.bind(this, this._keyReleaseEvent));
            this.actor.connect("scroll-event", Lang.bind(this, this._scrollEvent));
            this.actor.connect("button-press-event", Lang.bind(this, this.owndestroy));
            let delay = global.settings.get_int("alttab-switcher-delay");
            this._initialDelayTimeoutId = Mainloop.timeout_add(delay, Lang.bind(this, this._show));
            this._currentIndex--;
        }
        return this._haveModal;
    },

    _keyReleaseEvent: function(actor, event) {
        let key = event.get_key_symbol();
        if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) return true;
        if (this._initialDelayTimeoutId !== 0)
            this._currentIndex = (this._currentIndex + 1) % this._windows.length;
        this._activateSelected();
        return true;
    },

    owndestroy: function() {
        this._activateSelected();
    },

};

function ConfirmationDialog() {
    this._init.apply(this, arguments);
}

ConfirmationDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(aCallback, aDialogLabel, aDialogMessage, aCancelButtonLabel, aDoButtonLabel) {
        ModalDialog.ModalDialog.prototype._init.call(this, {
            styleClass: null
        });

        let mainContentBox = new St.BoxLayout({
            style_class: 'polkit-dialog-main-layout',
            vertical: false
        });
        this.contentLayout.add(mainContentBox, {
            x_fill: true,
            y_fill: true
        });

        let messageBox = new St.BoxLayout({
            style_class: 'polkit-dialog-message-layout',
            vertical: true
        });
        mainContentBox.add(messageBox, {
            y_align: St.Align.START
        });

        this._subjectLabel = new St.Label({
            style_class: 'polkit-dialog-headline',
            text: aDialogLabel
        });

        messageBox.add(this._subjectLabel, {
            y_fill: false,
            y_align: St.Align.START
        });

        this._descriptionLabel = new St.Label({
            style_class: 'polkit-dialog-description',
            text: aDialogMessage
        });

        messageBox.add(this._descriptionLabel, {
            y_fill: true,
            y_align: St.Align.START
        });

        this.setButtons([{
            label: aCancelButtonLabel,
            action: Lang.bind(this, function() {
                this.close();
            }),
            key: Clutter.Escape
        }, {
            label: aDoButtonLabel,
            action: Lang.bind(this, function() {
                this.close();
                aCallback();
            })
        }]);
    }
};

/*
exported _
 */
