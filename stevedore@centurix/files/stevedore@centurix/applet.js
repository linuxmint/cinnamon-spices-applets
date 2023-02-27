/*jshint esversion: 6 */
const Gtk = imports.gi.Gtk;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;
const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "stevedore@centurix";
let Docker;
if (typeof require !== 'undefined') {
    Docker = require('./docker');
} else {
    Docker = imports.ui.appletManager.applets[UUID].docker;
}

let _httpSession;
if (Soup.MAJOR_VERSION == 2) {
    _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
} else { //version 3
    _httpSession = new Soup.Session();
}

const APPLET_PATH = global.userdatadir + "/applets/" + UUID;
const ICON = APPLET_PATH + "/icons/icon.png";
const ICON_MISSING = APPLET_PATH + "/icons/missing.png";
const ICON_WORKING_1 = APPLET_PATH + "/icons/working_1.png";
const ICON_WORKING_2 = APPLET_PATH + "/icons/working_2.png";
const ICON_DOCKER = APPLET_PATH + "/icons/docker.png";

/**
 * L10n support
 **/
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function CreateContainerDialog() {
    this._init.apply(this, arguments);
}

CreateContainerDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(image, aCallback) {
        ModalDialog.ModalDialog.prototype._init.call(this, {
            styleClass: null
        });
        this._image = image;
        this._callback = aCallback;
        try {
            let mainContentBox = new St.BoxLayout({
                /* style_class: 'polkit-dialog-main-layout',*/
                vertical: false
            });
            this.contentLayout.add(mainContentBox, {
                x_fill: true,
                y_fill: true
            });

            let messageBox = new St.BoxLayout({
                /*style_class: 'polkit-dialog-message-layout',*/
                vertical: true
            });

            mainContentBox.add(messageBox, {
                y_align: St.Align.START
            });

            this._subjectLabel = new St.Label({
                /* style_class: 'polkit-dialog-headline',*/
                text: _("Create a container from an image")
            });

            messageBox.add(this._subjectLabel, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._mountLabel = new St.Label({
                /* style_class: 'polkit-dialog-headline',*/
                text: _("Mount location:")
            });

            messageBox.add(this._mountLabel, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._mountLocation = new St.Entry({
                style_class: 'stevedore-search',
                track_hover: true,
                can_focus: true,
                text: '/home'
            });

            messageBox.add(this._mountLocation, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._destLabel = new St.Label({
                /* style_class: 'polkit-dialog-headline',*/
                text: _("Destination location:")
            });

            messageBox.add(this._destLabel, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._destLocation = new St.Entry({
                style_class: 'stevedore-search',
                track_hover: true,
                can_focus: true,
                text: '/dest'
            });

            messageBox.add(this._destLocation, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._workdirLabel = new St.Label({
                /* style_class: 'polkit-dialog-headline',*/
                text: _("Working directory:")
            });

            messageBox.add(this._workdirLabel, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._workdir = new St.Entry({
                style_class: 'stevedore-search',
                track_hover: true,
                can_focus: true,
                text: '/'
            });

            messageBox.add(this._workdir, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._memoryLabel = new St.Label({
                /* style_class: 'polkit-dialog-headline',*/
                text: _("Memory:")
            });

            messageBox.add(this._memoryLabel, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._memory = new St.Entry({
                style_class: 'stevedore-search',
                track_hover: true,
                can_focus: true,
                text: '4g'
            });

            messageBox.add(this._memory, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._swapLabel = new St.Label({
                /* style_class: 'polkit-dialog-headline',*/
                text: _("Swap size:")
            });

            messageBox.add(this._swapLabel, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._swap = new St.Entry({
                style_class: 'stevedore-search',
                track_hover: true,
                can_focus: true,
                text: '4g'
            });

            messageBox.add(this._swap, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._entrypointLabel = new St.Label({
                /* style_class: 'polkit-dialog-headline',*/
                text: _("Entry point:")
            });

            messageBox.add(this._entrypointLabel, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._entrypoint = new St.Entry({
                style_class: 'stevedore-search',
                track_hover: true,
                can_focus: true,
                text: '/bin/sh'
            });

            messageBox.add(this._entrypoint, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._paramsLabel = new St.Label({
                /* style_class: 'polkit-dialog-headline',*/
                text: _("Extra parameters:")
            });

            messageBox.add(this._paramsLabel, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._params = new St.Entry({
                style_class: 'stevedore-search',
                track_hover: true,
                can_focus: true,
                text: '-p 80'
            });

            messageBox.add(this._params, {
                y_fill: false,
                y_align: St.Align.START
            });


            this.setButtons([{
                label: _("Start"),
                action: Lang.bind(this, function() {
                    this.close();
                    this._callback(
                        this._image,
                        this._mountLocation.text,
                        this._destLocation.text,
                        this._workdir.text,
                        this._memory.text,
                        this._swap.text,
                        this._entrypoint.text,
                        this._params.text
                    );
                })
            }, {
                label: _("Cancel"),
                action: Lang.bind(this, function() {
                    this.close();
                }),
                key: Clutter.Escape
            }]);

            this.open();
            this._mountLocation.grab_key_focus();
        } catch(e) {
            global.log(e);
        }
    }
};

function NewImageDialog() {
    this._init.apply(this, arguments);
}

NewImageDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(aCallback) {
        ModalDialog.ModalDialog.prototype._init.call(this, {
            styleClass: null
        });
        this._callback = aCallback;
        try {
            let mainContentBox = new St.BoxLayout({
                /* style_class: 'polkit-dialog-main-layout',*/
                vertical: false
            });

            this.contentLayout.add(mainContentBox, {
                x_fill: true,
                y_fill: true
            });

            let messageBox = new St.BoxLayout({
                /*style_class: 'polkit-dialog-message-layout',*/
                vertical: true
            });
            
            mainContentBox.add(messageBox, {
                y_align: St.Align.START
            });

            this._subjectLabel = new St.Label({
                /* style_class: 'polkit-dialog-headline',*/
                text: _("Search for a Docker image:")
            });

            messageBox.add(this._subjectLabel, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._imageSearch = new St.Entry({
                style_class: 'stevedore-search',
                track_hover: true,
                can_focus: true
            });

            messageBox.add(this._imageSearch, {
                y_fill: false,
                y_align: St.Align.START
            });

            this._imageResults = new St.Table({
                homogeneous: false,
                reactive: true
            });

            messageBox.add(this._imageResults, {
                y_fill: false,
                y_align: St.Align.START
            });

            this.setButtons([{
                label: _("Cancel"),
                action: Lang.bind(this, function() {
                    this.close();
                }),
                key: Clutter.Escape
            }]);

            this.open();
            this._imageSearchClutter = this._imageSearch.clutter_text;
            this._imageSearchClutter.connect("key-release-event", Lang.bind(this, this._onKeyPressEvent));
            this._imageSearch.grab_key_focus();
            this._searchDelay = new Date().getTime();
        } catch(e) {
            global.log(e);
        }
    },

    _onKeyPressEvent: function(actor, event) {
        try {
            let searchTerm = this._imageSearch.text;
            if (searchTerm == '') {
                return false;
            }
            let key = event.get_key_symbol();
            if (this._timer && this._timer > 0) {
                Mainloop.source_remove(this._timer);
                this._timer = 0;
            }
            if (key == Clutter.Return) {
                this.imageSearch(searchTerm, Lang.bind(this, this.displayResults));
            } else {
                this._timer = Mainloop.timeout_add(2000, Lang.bind(this, function() {
                    this.imageSearch(searchTerm, Lang.bind(this, this.displayResults));
                    this._timer = 0;
                    return false;
                }));
            }            
        } catch(e) {
            global.log(e);
        }
        return false;
    },

    displayResults: function(json) {
        try {
            this._images = [];
            this._buttons = [];
            this._imageResults.destroy_all_children();
            for (let index = 0; index < json.summaries.length; index++) {
                this._images[index] = new St.Label({
                    style_class: 'image-name',
                    text: json.summaries[index].name
                });
                this._buttons[index] = new St.Button({
                    style_class: "workspace-button",
                    label: _("Select")
                });
                this._buttons[index].index = index;
                this._buttons[index].image_name = json.summaries[index].name;
                this._buttons[index].set_height(20);
                this._buttons[index].set_width(80);
                this._buttons[index].connect('clicked', Lang.bind(this, this.selectImage));
                // this._images[index].clutter_text.connect("click", Lang.bind(this, this.selectImage));
                this._imageResults.add(this._buttons[index], {row: index, col: 0});
                this._imageResults.add(this._images[index], {row: index, col: 1});
            }
        } catch(e) {
            global.log(e);
        }
    },

    selectImage: function(actor, event) {
        this.close();
        this._callback(actor.image_name);
    },

    imageSearch: function(search_terms, callback) {
        // Search for Docker images
        try {
            this._imageResults.destroy_all_children();
            let temp_note = new St.Label({
                style_class: 'image-name',
                text: _("Searching...")
            });
            this._imageResults.add(temp_note, {row: 0, col: 0});
            let params = {};
            
            let message = Soup.Message.new('GET', 'https://store.docker.com/api/content/v1/products/search?source=community&q=' + search_terms);
            
            if (Soup.MAJOR_VERSION == 2) {
                _httpSession.queue_message(message, Lang.bind(this,
                    function (_httpSession, message) {
                        if (message.status_code !== 200)
                            return;
                        let json = JSON.parse(message.response_body.data);
                        callback(json);
                    }
                ));
            } else { // version 3
                _httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, Lang.bind(this,
                    function (_httpSession, response) {
                        if (message.get_status() !== 200)
                            return;
                        const bytes = _httpSession.send_and_read_finish(response);
                        let json = JSON.parse(ByteArray.toString(bytes.get_data()));
                        callback(json);
                    }
                ));
            }
        } catch(e) {
            global.log(e);
        }
    }
};

function Stevedore(metadata, orientation, panelHeight, instanceId) {
    // this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    this._init(orientation, panelHeight, instanceId);
}

Stevedore.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
        this.set_applet_icon_path(ICON);
        this.set_applet_tooltip(_('Stevedore: Docker controller'));
        this.resetIconAnimation();
        
        this._msgsrc = new MessageTray.SystemNotificationSource("Stevedore");
        Main.messageTray.add(this._msgsrc);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.docker = new Docker.Docker();
        if (!this.docker.isInstalled()) {
            this.set_applet_icon_path(ICON_MISSING);
            this.set_applet_tooltip(_("Stevedor: Cannot locate Docker, is it installed?"));
            this.notification(_("Cannot locate Docker, is it installed?"));
            this.menu.addMenuItem(this.newIconMenuItem(
                'package_network',
                _('Get Docker'),
                this.openDockerHome
            ));
            return;
        }
        let versions = this.docker.versions();
        if (parseInt(versions.docker.split('.')[0]) < 17) {
            this.set_applet_icon_path(ICON_MISSING);
            this.set_applet_tooltip(_("Stevedor: Docker is out of date, please install version 17.03.0-ce or higher."));
            this.notification(_("Stevedor: Docker is out of date, please install version 17.03.0-ce or higher."));
            this.menu.addMenuItem(this.newIconMenuItem(
                'package_network',
                _('Get Docker'),
                this.openDockerInstall
            ));
            return;            
        }
        this.refreshMenu();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    refreshMenu: function() {
        this.menu.removeAll();
        this.menu.addMenuItem(this.newIconMenuItem(
            'list-add',
            _('Create a new image'),
            this.openDialog
        ));
        this.subMenuImages = this.newSubMenuItem(_('Images'));
        let images = this.docker.listImages();
        this.imageMenus = [];
        if (images.length == 0) {
            this.subMenuImages.menu.addMenuItem(this.newIconMenuItem(
                'package_network', 
                _('No Images Installed'), 
                null, 
                {reactive: false}
            ));
        }
        for (let index = 0; index < images.length; index++) {
            this.imageMenus.push(this.newSubMenuItem('\t' + images[index].repository));
            let menu_index = this.imageMenus.length - 1;
            this.imageMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                'go-up', 
                '\t' + _('Start a new container from this image'),
                this.startContainer, 
                {}, 
                images[index].repository
            ));
            this.imageMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                'web-browser', 
                '\t' + _('Image Home Page'),
                this.openImagePage, 
                {}, 
                images[index].repository
            ));
            this.imageMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                'list-remove',
                '\t' + _('Remove this image'),
                this.removeImage,
                {},
                images[index].repository
            ));
            this.subMenuImages.menu.addMenuItem(this.imageMenus[menu_index]);
        }
        this.menu.addMenuItem(this.subMenuImages);

        this.subMenuContainers = this.newSubMenuItem(_('Containers'));
        let containers = this.docker.listContainers();
        if (containers.length == 0) {
            this.subMenuContainers.menu.addMenuItem(this.newIconMenuItem(
                'package_network', 
                _('No Containers Created'), 
                null, 
                {reactive: false}
            ));
        }
        this.containerMenus = [];
        for (let index = 0; index < containers.length; index++) {
            let status_tokens = containers[index].status.split(' ');
            this.containerMenus.push(this.newSubMenuItem('\t' + containers[index].names + ' (' + containers[index].image + ', ' + ((status_tokens[0] == 'Up') ? _('Running') : _('Stopped')) + ')'));
            let menu_index = this.containerMenus.length - 1;
            this.containerMenus[menu_index].menu.addMenuItem(this.newSwitchMenuItem(
                '\t\t' + ((status_tokens[0] == 'Up') ? _('Running') : _('Stopped')) + ' (' + containers[index].image + ')',
                (status_tokens[0] == 'Up'),
                this.toggleContainerStatus,
                containers[index].names
            ));
            this.containerMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                'media-memory',
                '\t' + _("Memory: ") + this.formatBytes(this.docker.memory(containers[index].names)),
                null,
                {reactive: false}
            ));
            this.containerMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                'finish',
                '\t' + _("Entry point: ") + this.docker.path(containers[index].names),
                null,
                {reactive: false}
            ));
            let mounts = this.docker.mounts(containers[index].names);
            if (mounts && mounts.length > 0) {
                this.containerMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                    'folder',
                    '\t' + _("Mount: ") + mounts[0].Source + ':' + mounts[0].Destination,
                    null,
                    {reactive: false}
                ));
            }
            if (status_tokens[0] == 'Up') {
                let addresses = this.docker.IPAddresses(containers[index].names);
                if (addresses.length > 0) {
                    for (let ip_index = 0; ip_index < addresses.length; ip_index++) {
                        this.containerMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                            'network-wired',
                            '\t' + _("IP Address: ") + addresses[ip_index],
                            this.copyToClipboard,
                            {},
                            addresses[ip_index]
                        ));
                    }
                }
                if (this.docker.hasSSH(containers[index].names)) {
                    if (addresses.length > 0) {
                        for (let ip_index = 0; ip_index < addresses.length; ip_index++) {
                            this.containerMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                                'terminal',
                                '\t' + _('Open a terminal'),
                                this.openTerminal,
                                {},
                                addresses[ip_index]
                            ));
                        }
                    }
                } else {
                    if (addresses.length > 0) {
                        for (let ip_index = 0; ip_index < addresses.length; ip_index++) {
                            this.containerMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                                'terminal',
                                '\t' + _('Show TTY Session'),
                                this.openTTY,
                                {},
                                addresses[ip_index]
                            ));
                        }
                    }
                }
                if (this.docker.hasWeb(containers[index].names)) {
                    if (addresses.length > 0) {
                        for (let ip_index = 0; ip_index < addresses.length; ip_index++) {
                            this.containerMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                                'emblem-web',
                                '\t' + _('Open a browser'),
                                this.openBrowser,
                                {},
                                addresses[ip_index]
                            ));
                        }
                    }
                }
            }
            this.containerMenus[menu_index].menu.addMenuItem(this.newIconMenuItem(
                'list-remove',
                '\t' + _('Delete this container'),
                this.removeContainer,
                {},
                containers[index].names
            ));
            this.subMenuContainers.menu.addMenuItem(this.containerMenus[menu_index]);
        }
        this.menu.addMenuItem(this.subMenuContainers);
        let versions = this.docker.versions();
        this.subMenuVersions = new PopupMenu.PopupSubMenuMenuItem(_('Docker Version'));
        this.subMenuVersions.menu.addMenuItem(this.newIconMenuItem('info', _('Docker Version: ') + versions.docker, null, {reactive: false}));
        this.subMenuVersions.menu.addMenuItem(this.newIconMenuItem('info', _('API Version: ') + versions.api, null, {reactive: false}));
        this.subMenuVersions.menu.addMenuItem(this.newIconMenuItem('info', _('Go Version: ') + versions.go, null, {reactive: false}));
        this.subMenuVersions.menu.addMenuItem(this.newIconMenuItem('info', _('Git Commit: ') + versions.commit, null, {reactive: false}));
        this.subMenuVersions.menu.addMenuItem(this.newIconMenuItem('info', _('Build Date: ') + versions.built, null, {reactive: false}));
        this.subMenuVersions.menu.addMenuItem(this.newIconMenuItem('info', _('OS/Arch: ') + versions.os, null, {reactive: false}));
        this.menu.addMenuItem(this.subMenuVersions);
        this.menu.addMenuItem(this.newIconMenuItem(
            'view-refresh',
            _('Refresh this menu'),
            this.refreshMenu
        ));
    },

    openDialog: function() {
        let dialog = new NewImageDialog(Lang.bind(this, this.addImage));
    },

    addImage: function(image_name) {
        this.docker.addImage(image_name);
        this.notification(_("Installing image") + " '" + image_name + "', " + _("please wait..."));
        Mainloop.timeout_add(500, Lang.bind(this, this.checkAddStatus, image_name));
    },

    checkAddStatus: function(image_name) {
        try {
            this.toggleIconAnimation();

            if (!this.docker.checkPullProcess()) {
                this.resetIcon();
                this.notification(_("Image") + " '" + image_name + "' " + _("installed, ready to run."));
                this.refreshMenu();
                return false;
            }
        } catch(e) {
            global.log(e);
        }
        return true;
    },

    resetIconAnimation: function() {
        this._animation_icon = ICON_WORKING_1;
    },

    toggleIconAnimation: function() {
        this.set_applet_icon_path(this._animation_icon);
        this._animation_icon = (this._animation_icon == ICON_WORKING_1) ? ICON_WORKING_2 : ICON_WORKING_1;
    },

    resetIcon: function() {
        this.set_applet_icon_path(ICON);
    },

    removeImage: function(menuItem) {
        this.docker.removeImage(menuItem.value);
        this.notification(_("Image") + " '" + menuItem.value + "' " + _("removed."));
        this.refreshMenu();
    },

    openImagePage: function(menuItem) {
        Main.Util.spawnCommandLine("xdg-open https://hub.docker.com/r/" + menuItem.value);
    },

    openDockerHome: function() {
        Main.Util.spawnCommandLine("xdg-open https://www.docker.com");
    },

    openDockerInstall: function() {
        Main.Util.spawnCommandLine("xdg-open https://docs.docker.com/engine/installation/linux/ubuntu/");
    },

    notification: function(message) {
        let notification = new MessageTray.Notification(this._msgsrc, "Stevedore", message);
        notification.setTransient(true);
        this._msgsrc.notify(notification);
    },

    newSeparator: function() {
        return new PopupMenu.PopupSeparatorMenuItem();
    },

    newMenuItem: function(label, callback, options = {}, value = null) {
        let newItem = new PopupMenu.PopupMenuItem(label, options);
        if (callback) {
            newItem.connect("activate", Lang.bind(this, callback));
        }
        newItem.value = value;
        return newItem;
    },

    newSubMenuItem: function(label) {
        return new PopupMenu.PopupSubMenuMenuItem(label);
    },

    newIconMenuItem: function(icon, label, callback, options = {}, value = null) {
        try {
            let newItem = new PopupMenu.PopupIconMenuItem(label, icon, St.IconType.FULLCOLOR, options);
            if (callback) {
                newItem.connect("activate", Lang.bind(this, callback));
            }
            newItem.value = value;
            return newItem;
        } catch(e) {
            global.log(UUID + "::newIconMenuItem: " + e);
        }
        return null;
    },

    newSwitchMenuItem: function(label, state, callback, value = null) {
        let newItem = new PopupMenu.PopupSwitchMenuItem(label, state);
        if (callback) {
            newItem.connect("activate", Lang.bind(this, callback));
        }
        newItem.value = value;
        return newItem;
    },

    toggleContainerStatus: function(menuItem) {
        if (menuItem._switch.state) {
            this.notification(_('Starting container'));
            this.docker.startContainer(menuItem.value);
            this.notification(_('Container up'));
        } else {
            this.notification(_('Stopping container'));
            this.docker.stopContainer(menuItem.value);
            this.notification(_('Container down'));
        }
        this.refreshMenu();
        return true;
    },

    startContainer: function(menuItem) {
        let dialog = new CreateContainerDialog(menuItem.value, Lang.bind(this, this.createContainer));
    },

    createContainer: function(image, mount, dest, workdir, memory, swap, entrypoint, params) {
        this.notification(_("Creating container from") + " '" + image + "', " + _("please wait..."));
        this.docker.newContainer(image, mount + ':' + dest, workdir, memory, swap, entrypoint, params);
        this.refreshMenu();
        this.notification(_("Image created."));
    },

    openTerminal: function(menuItem) {
        try {
            Main.Util.spawnCommandLine("gnome-terminal -x ssh " + menuItem.value);
            // let addresses = this.docker.IPAddresses(menuItem.value);
            // if (addresses.length > 0) {
            //     Main.Util.spawnCommandLine("gnome-terminal -x ssh " + addresses[0]);
            // }
        } catch(e) {
            global.log(e);
        }
    },

    openTTY: function(menuItem) {
        try {
            this.docker.openTTY(menuItem.value);
        } catch(e) {
            global.log(e);
        }
    },

    openBrowser: function(menuItem) {
        Main.Util.spawnCommandLine("xdg-open http://" + menuItem.value);
    },

    removeContainer: function(menuItem) {
        this.notification(_("Removing container") + " '" + menuItem.value + "', " + _("please wait..."));
        this.docker.removeContainer(menuItem.value);
        this.refreshMenu();
        this.notification(_("Container removed"));
    },

    copyToClipboard: function(menuItem) {
        try {
            global.log('Copying to the clipboard');
            St.Clipboard.get_default().set_text(menuItem.value);
            this.notification(_("Copied to the clipboard"));
        } catch(e) {
            global.log(e);
        }
    },

    formatBytes: function(a,b) {
        if(0 == a) return "0 Bytes";
        let c = 1e3, d = b || 2, e = ["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"], f = Math.floor(Math.log(a) / Math.log(c));
        return parseFloat((a / Math.pow(c, f)).toFixed(d)) + " " + e[f];
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new Stevedore(metadata, orientation, panelHeight, instanceId);
}
