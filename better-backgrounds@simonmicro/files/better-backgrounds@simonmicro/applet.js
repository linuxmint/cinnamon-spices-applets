const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;
const PopupMenu = imports.ui.popupMenu;

const uuid = "better-backgrounds@simonmicro";
const appletPath = AppletManager.appletMeta[uuid].path;

function log(msg) {
    global.log('[' + uuid + '] ' + msg);
};

class UnsplashBackgroundApplet extends Applet.TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        //Init the menu on applet click, which is opened if applet is click with no bg change
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menuBtnChangeBack = new PopupMenu.PopupMenuItem('Change background');
        this.menuBtnSavePic = new PopupMenu.PopupMenuItem('Save current picture');
        this.menuBtnChangeBack.connect('activate', imports.lang.bind(this, this._change_background));
        this.menuBtnSavePic.connect('activate', imports.lang.bind(this, this._store_background));
        this.menu.addMenuItem(this.menuBtnChangeBack);
        this.menu.addMenuItem(this.menuBtnSavePic);

        this.settings = new imports.ui.settings.AppletSettings(this, uuid, instance_id);

        this.settings.bind("applet-icon-animation", "applet_icon_animation", this.on_settings_changed);
        this.settings.bind("applet-show-notification", "applet_show_notification", this.on_settings_changed);
        this.settings.bind("change-onstart", "change_onstart", this.on_settings_changed);
        this.settings.bind("change-onclick", "change_onclick", this.on_settings_changed);
        this.settings.bind("change-ontime", "change_ontime", this.on_settings_changed);
        this.settings.bind("change-time", "change_time", this.on_settings_changed);
        this.settings.bind("effect-select", "effect_select", this.on_settings_changed);
        this.settings.bind("image-source", "image_source", this.on_settings_changed);
        this.settings.bind("image-res-manual", "image_res_manual", this.on_settings_changed);
        this.settings.bind("image-res-width", "image_res_width", this.on_settings_changed);
        this.settings.bind("image-res-height", "image_res_height", this.on_settings_changed);
        this.settings.bind("image-res-himawari", "image_res_himawari", this.on_settings_changed);
        this.settings.bind("image-uri", "image_uri", this.on_settings_changed);
        this.settings.bind("image-tag", "image_tag", this.on_settings_changed);
        this.settings.bind("image-tag-data", "image_tag_data", this.on_settings_changed);

        this.set_applet_icon_name("applet");
        this._applet_icon.set_pivot_point(0.5, 0.5);
        this.httpAsyncSession = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(this.httpAsyncSession, new Soup.ProxyResolverDefault());
        this.swapChainSwapped = false;

        this.on_settings_changed();

        if(this.change_onstart)
            this._change_background();
    }

    _timeout_update() {
        if(this.change_ontime)
            this._timeout_enable();
        else
            this._timeout_disable();
    }

    _timeout_disable() {
        if (this._timeout)
            imports.mainloop.source_remove(this._timeout);
        this._timeout = null;
    }

    _timeout_enable() {
        this._timeout_disable();
        this._timeout = imports.mainloop.timeout_add_seconds(this.change_time * 60, imports.lang.bind(this, this._auto_change_background));
    }

    _set_icon_rotation(newValue, seconds) {
        if(this.applet_icon_animation)
            Tweener.addTween(this._applet_icon, {
                'rotation-angle-z': newValue,
//                skipUpdates: 4, //Only render every 4th frame - this does sadly not improve the cpu usage...
                time: seconds,
                transition: 'easeInOutQuad'
            });
    }

    _icon_animate() {
        this._set_icon_rotation(0, 0);
        this._set_icon_rotation(360, 2);

        //And queue next step...
        this._animator = imports.mainloop.timeout_add_seconds(2.5, imports.lang.bind(this, this._icon_animate));
    }

    _icon_start() {
        //Start animation and ensure no other is running (anymore)...
        this._icon_stop();
        this._icon_animate();
    }

    _icon_stop() {
        //Abort queued step
        if(this._animator)
            imports.mainloop.source_remove(this._animator);
        this._animator = null;
    }

    _auto_change_background() {
        //Updates the background and then retriggers the timeout for this...
        this._change_background();
        this._timeout_update();
    }

    _change_background() {
        this._icon_start();
        this._update_tooltip();
        let that = this;
        function errorEnd(msg = 'Something went horrible wrong!') {
            that._show_notification(msg);
            that._icon_stop();
        };
        function defaultEnd() {
            that._apply_image().then(function() {
                that._icon_stop();
            });
        };

        if(this.image_source == 'cutycapt') {
            let cmd = ['cutycapt', '--out-format=png', '--url=' + this.image_uri, '--out=' + this._get_swap_chain_image_next()];
            if(this.image_res_manual) {
                cmd.push('--min-width=' + this.image_res_width);
                cmd.push('--min-height=' + this.image_res_height);
            }
            this._run_cmd(cmd).then(defaultEnd);
        } else if(this.image_source == 'bing') {
            log('Downloading bing metadata');
            let request = Soup.Message.new('GET', 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mbl=1');
            this.httpAsyncSession.queue_message(request, function(http, msg) {
                if (msg.status_code === 200) {
                    let jsonData = JSON.parse(msg.response_body.data).images[0];
                    that._update_tooltip(jsonData.title + ' - ' + jsonData.copyright);
                    that._download_image('https://www.bing.com' + jsonData.url).then(defaultEnd).catch(errorEnd);
                } else
                    errorEnd('Could not download bing metadata (' + msg.status_code + ')!');
            });
        } else if(this.image_source == 'himawari') {
            log('Downloading himawari metadata');
            //Download metadata and read latest timestamp
            let request = Soup.Message.new('GET', 'https://himawari8-dl.nict.go.jp/himawari8/img/D531106/latest.json');
            this.httpAsyncSession.queue_message(request, function(http, msg) {
                if (msg.status_code !== 200)
                    errorEnd('Could not download himawari metadata (' + msg.status_code + ')!');
                else {
                    let latestDate = new Date(JSON.parse(request.response_body.data).date);
                    let zoomLvl = that.image_res_himawari;
                    let tileNames = Array();
                    var tileId = 0;

                    function downloadTiles() {
                        //Download the tile and call ourself again
                        let y = tileId % zoomLvl;
                        let x = Math.floor(tileId / zoomLvl);
                        let tileName = appletPath + '/tile_' + x + '_' + y + '.png';
                        tileNames.push(tileName);
                        tileId++;
                        that.set_applet_label(Math.floor(tileId / (zoomLvl * zoomLvl) * 100) + '%');
                        that._download_image('https://himawari8-dl.nict.go.jp/himawari8/img/D531106/' +
                            zoomLvl + 'd/550/' + latestDate.getFullYear() + '/' + ('0' + (latestDate.getMonth() + 1)).slice(-2) + 
                            '/' + ('0' + latestDate.getDate()).slice(-2) + '/' + ('0' + latestDate.getHours()).slice(-2) +
                            ('0' + latestDate.getMinutes()).slice(-2) + ('0' + latestDate.getSeconds()).slice(-2) + '_' +
                            y + '_' + x + '.png', tileName)
                        .then(function() {
                            //tileId == zoomLvl * zoomLvl -> we have all tiles -> proceed
                            if(tileId == zoomLvl * zoomLvl) {
                                //Trigger imagemagick to merge the tiles
                                let cmd = ['montage'];
                                Array.prototype.push.apply(cmd, tileNames);
                                cmd.push('-geometry', '550x550+0+0');
                                cmd.push('-tile', zoomLvl + 'x' + zoomLvl);
                                cmd.push(that._get_swap_chain_image_next());
                                that._run_cmd(cmd).then(function() {
                                    //Cleanup the tiles from buffer
                                    let rmCmd = ['rm', '-f'];
                                    Array.prototype.push.apply(rmCmd, tileNames);
                                    that._run_cmd(rmCmd);

                                    //And update the tooltip
                                    that._update_tooltip('The Earth by Himawari 8 from ' + latestDate.toISOString());

                                    //Remove the progress label
                                    that.set_applet_label('');

                                    //And apply new image
                                    defaultEnd();
                                });
                            } else {
                                //Not? Recall!
                                downloadTiles();
                            }
                        }).catch(errorEnd);
                    }
                    downloadTiles();
                }
            });
        } else if(this.image_source == 'unsplash') {
            let resStr = 'featured';
            if(this.image_res_manual)
                resStr = this.image_res_width + 'x' + this.image_res_height;
            let tagStr = '';
            if(this.image_tag)
                tagStr = '?' + this.image_tag_data;
            this._download_image('https://source.unsplash.com/' + resStr + '/' + tagStr).then(defaultEnd).catch(errorEnd);
        } else if(this.image_source == 'placekitten') {
            let resStr = '1920/1080';
            if(this.image_res_manual)
                resStr = this.image_res_width + '/' + this.image_res_height;
            this._download_image('http://placekitten.com/' + resStr).then(defaultEnd).catch(errorEnd);
        } else if(this.image_source == 'picsum') {
            let resStr = '1920/1080';
            if(this.image_res_manual)
                resStr = this.image_res_width + '/' + this.image_res_height;
            this._download_image('https://picsum.photos/' + resStr).then(defaultEnd).catch(errorEnd);
        }
    }

    _run_cmd(cmd) {
        return new Promise(function(resolve, reject) {
            try {
                log('Running: ' + cmd.join(' '));
                let pid = GLib.spawn_async(null, cmd, null, GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null, null)[1];
                GLib.child_watch_add(GLib.PRIORITY_DEFAULT_IDLE, pid, function test() {
                    GLib.spawn_close_pid(pid); resolve();
                });
            } catch (e) {
                log('Execution failure: ' + e);
                reject(e);
            }
        });
    }

    _store_background() {
        //Copy the background to users picture folder with random name and show the stored notification
        let targetPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) + '/' + Math.floor(Math.random() * 2048) + '.png';
        var that = this;
        this._run_cmd(['convert', this._get_swap_chain_image_current(), '-write', targetPath]).then(function() {
            that._show_notification('Image stored to: ' + targetPath);
        });
    }

    _get_swap_chain_image_next() {
        return this._get_swap_chain_base() + '/next';
    }

    _get_swap_chain_image_current() {
        return this._get_swap_chain_base() + '/background';
    }

    _get_swap_chain_base() {
        return appletPath;
    }

    _swap_chain_image_swap() {
        //Replace current with next
        this._run_cmd(['mv', this._get_swap_chain_image_next(), this._get_swap_chain_image_current()]);
    }

    _apply_image() {
        var that = this;
        return new Promise(function(resolve, reject) {
            function update() {
                //Update gsettings
                that._swap_chain_image_swap();
                let gSetting = new Gio.Settings({schema: 'org.cinnamon.desktop.background'});
                gSetting.set_string('picture-uri', 'file://' + that._get_swap_chain_image_current());
                Gio.Settings.sync();
                gSetting.apply();
                resolve();
            }

            //Now apply any effect (if selected)
            if(that.effect_select == 'grayscale') {
                that._run_cmd(['mogrify', '-grayscale', 'average', that._get_swap_chain_image_next()]).then(update);
            } else if(that.effect_select == 'gaussian-blur') {
                that._run_cmd(['mogrify', '-gaussian-blur', '40', that._get_swap_chain_image_next()]).then(update);
            } else
                //Just ignore any invalid option...
                update();
        });
    }

    _download_image(uri, targetPath = this._get_swap_chain_image_next()) {
        log('Downloading image ' + uri);
        let gFile = Gio.file_new_for_path(targetPath);
        let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let request = Soup.Message.new('GET', uri);
        let that = this;

        request.connect('got_chunk', function(message, chunk) {
            if (message.status_code === 200)
                fStream.write(chunk.get_data(), null);
        });

        return new Promise(function(resolve, reject) {
            that.httpAsyncSession.queue_message(request, function(http, msg) {
                fStream.close(null);
                if (msg.status_code !== 200)
                    reject('Could not download image (' + msg.status_code + ')!');
                resolve();
            });
        });
    }

    _update_tooltip(more = null) {
        let tooltipStr = '';
        if(this.change_onstart)
            tooltipStr += 'Background changed on last startup';
        if(this.change_onstart && (this.change_onclick || this.change_ontime))
            tooltipStr += "\n";
        if(this.change_onclick)
            tooltipStr += 'Click here to change background';
        if(this.change_ontime && this.change_onclick)
            tooltipStr += "\n";
        if(this.change_ontime)
            tooltipStr += 'Every ' + this.change_time + ' minutes the background changes itself';
        if(!this.change_ontime && !this.change_onclick)
            tooltipStr += 'No action defined! Please enable at least one in the configuration!';
        if(more !== null)
            tooltipStr += "\n\n" + more;
        this.set_applet_tooltip(_(tooltipStr));
    }

    _show_notification(text) {
        if(this.applet_show_notification)
            imports.ui.main.notify('Better Backgrounds', text);
    }

    on_settings_changed() {
        this._update_tooltip();
        this._timeout_update();
    }

    on_applet_clicked() {
        if(this.change_onclick)
            this._change_background();
        else
            this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
        this._timeout_disable();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new UnsplashBackgroundApplet(orientation, panel_height, instance_id);
}
