const MessageTray = imports.ui.messageTray;
const St = imports.gi.St;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Tooltips = imports.ui.tooltips;
const Tweener = imports.ui.tweener;

const {
    UUID,
    HOME_DIR,
    APPLET_DIR,
    SCRIPTS_DIR,
    ICONS_DIR,
    HELP_DIR,
    CS_PATH,
    URL_SPICES_HOME,
    CACHE_DIR,
    TYPES,
    URL_MAP,
    CACHE_MAP,
    DIR_MAP,
    DCONFCACHEUPDATED,
    DOWNLOAD_TIME,
    TAB,
    SORT,
    _,
    EXP1, EXP2, EXP3,
    DEBUG,
    capitalize,
    log,
    logError
} = require("./constants");

const ICONTHEME = Gtk.IconTheme.get_default();

/**
 * Class SU_Notification
 */

class SU_Notification extends MessageTray.Notification {

    constructor (source, title, body, params) {
        super(source, title, body, params);
    }

    addButton(id, label) {
        if (!this._actionArea) {
            this._actionArea = new St.BoxLayout({ name: 'notification-actions' });
            this._table.add(this._actionArea, { row: 2,
                                                col: 1,
                                                col_span: 3,
                                                x_expand: true,
                                                y_expand: false,
                                                x_fill: true,
                                                y_fill: false,
                                                x_align: St.Align.START });
        }

        let button = new St.Button({ can_focus: true });

        if (this._useActionIcons
            && id.endsWith("-symbolic")
            && (ICONTHEME.has_icon(id) || GLib.file_test("%s/%s.svg".format(ICONS_DIR, id), GLib.FileTest.EXISTS) )) {

            button.add_style_class_name('notification-icon-button');
            if (ICONTHEME.has_icon(id)) {
                button.child = new St.Icon({ icon_name: id, icon_type: St.IconType.SYMBOLIC, icon_size: 16 });
            } else {
                let gicon = Gio.icon_new_for_string("%s/%s.svg".format(ICONS_DIR, id));
                button.child = new St.Icon({  gicon: gicon, icon_type: St.IconType.SYMBOLIC, icon_size: 16 });
            }
            let tooltip = new Tooltips.Tooltip(button, label);
        } else {
            button.add_style_class_name('notification-button');
            button.label = label;
        }

        if (this._actionArea.get_n_children() > 0)
            this._buttonFocusManager.remove_group(this._actionArea);

        this._actionArea.add(button);
        this._buttonFocusManager.add_group(this._actionArea);
        button.connect('clicked', Lang.bind(this, this._onActionInvoked, id));
        this._updateLayout();
    }

    expand(animate) {
        this.expanded = true;
        // The banner is never shown when the title did not fit, so this
        // can be an if-else statement.
        if (!this._titleFitsInBannerMode) {
            // Remove ellipsization from the title label and make it wrap so that
            // we show the full title when the notification is expanded.
            this._titleLabel.clutter_text.line_wrap = true;
            this._titleLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            this._titleLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        } else if (this._table.row_count > 1 && this._bannerLabel.opacity != 0) {
            // We always hide the banner if the notification has additional content.
            //
            // We don't need to wrap the banner that doesn't fit the way we wrap the
            // title that doesn't fit because we won't have a notification with
            // row_count=1 that has a banner that doesn't fully fit. We'll either add
            // that banner to the content of the notification in _bannerBoxAllocate()
            // or the notification will have custom content.
            if (animate)
                Tweener.addTween(this._bannerLabel,
                                 { opacity: 0,
                                   time: ANIMATION_TIME,
                                   transition: 'easeOutQuad' });
            else
                this._bannerLabel.opacity = 0;
        }
        this._setActorMinHeight();
        this.emit('expanded');
    }

    _setActorMinHeight() {
        //log("notification._table.height = %s".format(this.get_minheight()), true);
        this.actor.style = "min-height: %spx;".format(this.get_minheight().toString());
    }

    get_minheight() {
        let minHeight;
        try {
            minHeight = this._table.height;
        } catch(e) {
            minHeight = 159;
        }
        return minHeight;
    }
}
