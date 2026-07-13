const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;
const Slider = imports.ui.slider;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

const UUID = "FM-Radio@hilyxx";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
if (imports.searchPath.indexOf(AppletDir) === -1) {
    imports.searchPath.push(AppletDir);
}

const RadioModule = imports.radio; 
const Radio = RadioModule.Radio;
const Channels = imports.channels;
const Data = imports.data;
const Search = imports.search;

class SomaFMApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.uuid = metadata.uuid;
        this.extPath = metadata.path;

        this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
        this.settings.bind("custom_stations", "custom_stations", this._onSettingsChanged, this);
        this.settings.bind("search_keyword", "search_keyword");
        this.settings.bind("search_results", "search_results");

        this._onClearClicked();

        // Send the station list to channels.js before starting the player
        Channels.setChannels(this.custom_stations);

        this.player = new Radio.RadioPlayer(Data.getLastChannel());
        this.player.setVolume(Data.getLastVol());

        this.set_applet_icon_symbolic_path(this.extPath + "/icon/radio-off-symbolic.svg");
        this.set_applet_tooltip(_("FM Radio"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._buildMenu();

        let reloadMenuItem = new PopupMenu.PopupIconMenuItem(
            _("Reload applet"), 
            "view-refresh-symbolic", 
            St.IconType.SYMBOLIC
        );
        
        reloadMenuItem.connect('activate', () => {
            global.log("Radio FM : Manual reload.");
            
            this._onSettingsChanged();
            
            if (this.player && this.player.isPlaying()) {
                this.player.stop();
                this.setPlayingState(false);
            }
        });
        
        this._applet_context_menu.addMenuItem(reloadMenuItem);
    }

    _onSettingsChanged() {
        // Updates the station list in memory and reloads the menu
        Channels.setChannels(this.custom_stations);
        this._loadChannels();
    }

    _onSearchClicked() {
        let keyword = this.search_keyword;

        Search.findStations(keyword, (results) => {
        this.search_results = results; 
        });
    }

    _onClearClicked() {
        this.search_results = "";      
        this.search_keyword = "";
   }

    _buildMenu() {
        this.volumeMenuItem = new PopupMenu.PopupSliderMenuItem(Data.getLastVol());
        
        let volumeIcon = new St.Icon({ 
            icon_name: 'audio-volume-medium-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 16, 
            style_class: 'popup-menu-icon'
        });
  
        this.volumeMenuItem.removeActor(this.volumeMenuItem._slider);
        
        this.volumeMenuItem.addActor(volumeIcon, { span: 0 });
        this.volumeMenuItem.addActor(this.volumeMenuItem._slider, { span: -1, expand: true });

        const updateIcon = (v) => {
            let state = v === 0 ? 'muted' : v < 0.33 ? 'low' : v < 0.66 ? 'medium' : 'high';
            volumeIcon.set_icon_name(`audio-volume-${state}-symbolic`);
        };

        updateIcon(Data.getLastVol());
        
        this.volumeMenuItem.connect('value-changed', (menuItem, value) => {
            this.player.setVolume(value);
            Data.save(this.player.getChannel(), value);
            updateIcon(value);
        });

        this.menu.addMenuItem(this.volumeMenuItem);

        let controlMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.controlBox = Radio.ControlButtons(this.player, this);

        let centerBox = new St.BoxLayout({ 
            x_expand: true, 
            x_align: Clutter.ActorAlign.CENTER,
            width: 210,
            style: 'padding-left: 20px;',
        });

        centerBox.add_child(this.controlBox);
        controlMenuItem.addActor(centerBox, { expand: true });
        this.menu.addMenuItem(controlMenuItem);

        this.statusMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.box = new St.BoxLayout({ 
            x_expand: true, 
            width: 210, 
            vertical: true 
        });

        this.statusLabel = new St.Label({
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            style_class: 'title-label',
        });
        this.statusLabel.clutter_text.line_wrap = true;
        this.statusLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.statusLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this.channelLabel = new St.Label({
            text: this.player.getChannel().getName(),
            style: 'padding-left: 20px;',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            style_class: 'radio-label',
        });
        this.channelLabel.clutter_text.line_wrap = true;
        this.channelLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this.channelLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        let picPath = this.player.getChannel().getPic();
        let iconPath = (picPath && picPath.startsWith("/home/")) ? picPath : (this.extPath + (picPath.startsWith("/") ? "" : "/") + picPath);

        this.channelIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(iconPath),
            icon_size: 48, 
            x_align: Clutter.ActorAlign.CENTER, 
            style: 'margin-top: 10px; margin-bottom: 5px; padding-left: 20px;', 
        });

        this.box.add_child(this.statusLabel);
        this.box.add_child(this.channelLabel); 
        this.box.add_child(this.channelIcon);
        this.statusMenuItem.addActor(this.box, { expand: true });

        this.menu.addMenuItem(this.statusMenuItem);

        if (!this.player.isPlaying()) {
            this.statusMenuItem.actor.hide();
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.channelsMenu = new PopupMenu.PopupSubMenuMenuItem(_("All stations"));
        this.menu.addMenuItem(this.channelsMenu);

        this._loadChannels();

        this.player.setOnTagChanged(() => {
            let currentTag = this.player.getTag();
            if (currentTag && currentTag.trim() !== "") {
                this.statusLabel.set_text(currentTag);
                
                // Force recalculation of text layout allocation to prevent truncation
                this.statusLabel.queue_relayout();
                this.statusMenuItem.actor.queue_relayout();
            }
        });
    }

    _loadChannels() {
        this.channelsMenu.menu.removeAll();

        Channels.getChannels().forEach((ch) => {
            let item = new Channels.ChannelBox(ch, this.player, this);
            this.channelsMenu.menu.addMenuItem(item);
        });
    }

    channelChanged() {
        this.setPlayingState(this.player.isPlaying());
        Data.save(this.player.getChannel(), Data.getLastVol());

        if (this.channelLabel) {
            let currentChannel = this.player.getChannel();
            if (currentChannel) {
                this.channelLabel.set_text("" + currentChannel.getName());
                
                if (this.channelIcon) {
                    let picPath = currentChannel.getPic();
                    let iconPath = (picPath && picPath.startsWith("/home/")) ? picPath : (this.extPath + (picPath.startsWith("/") ? "" : "/") + picPath);
                    let newIcon = Gio.icon_new_for_string(iconPath);
                    this.channelIcon.set_gicon(newIcon);
                }
            }
        }

        if (this.statusLabel) {
            this.statusLabel.set_text(_("Waiting..."));
        }
    }

    setPlayingState(isPlaying) {
        let iconFile = isPlaying ? "/icon/radio-symbolic.svg" : "/icon/radio-off-symbolic.svg";
        this.set_applet_icon_symbolic_path(this.extPath + iconFile);

        if (this.statusMenuItem) {
            if (isPlaying) {
                this.statusMenuItem.actor.show();
            } else {
                this.statusMenuItem.actor.hide();
            }
        }

        if (this.playStopIcon) {
            this.playStopIcon.set_icon_name(
                isPlaying ? "media-playback-stop-symbolic" : "media-playback-start-symbolic"
            );
        }
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this.player) {
            this.player.stop();
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new SomaFMApplet(metadata, orientation, panel_height, instance_id);
}
