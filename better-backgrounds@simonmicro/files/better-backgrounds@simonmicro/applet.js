const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;

const uuid = "better-backgrounds@simonmicro";
const appletPath = AppletManager.appletMeta[uuid].path;
const imagePath = appletPath + '/background';

function log(msg) {
    global.log('[' + uuid + '] ' + msg);
};

class UnsplashBackgroundApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

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
        this.settings.bind("image-uri", "image_uri", this.on_settings_changed);
        this.settings.bind("image-tag", "image_tag", this.on_settings_changed);
        this.settings.bind("image-tag-data", "image_tag_data", this.on_settings_changed);

        this.set_applet_icon_name("applet");
        this.httpSession = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());

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

    _set_icon_opacity(newValue) {
        if(this.applet_icon_animation)
            Tweener.addTween(this._applet_icon, {
                opacity: newValue,
                time: 0.8
            });
    }

    _icon_animate() {
        this._icon_opacity = this._icon_opacity == 0 ? 255 : 0;
        this._set_icon_opacity(this._icon_opacity);
        //And queue next step...
        this._animator = imports.mainloop.timeout_add_seconds(1, imports.lang.bind(this, this._icon_animate));
    }

    _icon_start() {
        //Start animation and ensure no other is running (anymore)...
        this._icon_stop();
        this._animator = imports.mainloop.timeout_add_seconds(1, imports.lang.bind(this, this._icon_animate));
    }

    _icon_stop() {
        //Abort queued step
        if(this._animator)
            imports.mainloop.source_remove(this._animator);
        this._animator = null;
        //And fade back to normal
        this._set_icon_opacity(255);
    }

    _auto_change_background() {
        //Updates the background and then retriggers the timeout for this...
        this._change_background();
        this._timeout_update();
    }

    _change_background() {
        this._icon_start();
        let resStr = '';
        let tagStr = '';
        let cmdStr = '';

        switch(this.image_source) {
            case 'cutycapt':
                if(this.image_res_manual)
                    resStr = ' --min-width=' + this.image_res_width + ' --min-height=' + this.image_res_height;
                cmdStr = 'cutycapt --out-format=png --url="' + this.image_uri + '" --out="' + imagePath + '"' + resStr;
                log('Running ' + cmdStr);
                imports.ui.main.Util.spawnCommandLine(cmdStr);
            break;
            case 'bing':
                let request = Soup.Message.new('GET', 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mbl=1');
                var that = this;
                this.httpSession.queue_message(request, function(http, msg) {
                    if (msg.status_code === 200)
                        that._download_image('https://www.bing.com' + JSON.parse(msg.response_body.data).images[0].url);
                    else
                        log('Could not download image!');
                    that._icon_stop();
                });
                log('Downloading bing metadata');
            break;
            case 'unsplash':
                resStr = 'featured';
                if(this.image_res_manual)
                    resStr = this.image_res_width + 'x' + this.image_res_height;
                if(this.image_tag)
                    tagStr = '?' + this.image_tag_data;
                this._download_image('https://source.unsplash.com/' + resStr + '/' + tagStr);
            break;
            case 'placekitten':
                resStr = '1920/1080';
                if(this.image_res_manual)
                    resStr = this.image_res_width + '/' + this.image_res_height;
                this._download_image('http://placekitten.com/' + resStr);
            break;
            case 'picsum':
                resStr = '1920/1080';
                if(this.image_res_manual)
                    resStr = this.image_res_width + '/' + this.image_res_height;
                this._download_image('https://picsum.photos/' + resStr);
            break;
        }
    }

    _download_image(uri) {
        let gFile = Gio.file_new_for_path(imagePath);
        let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let request = Soup.Message.new('GET', uri);

        request.connect('got_chunk', function(message, chunk) {
            if (message.status_code === 200)
                fStream.write(chunk.get_data(), null);
        });

        var that = this;
        this.httpSession.queue_message(request, function(http, message) {
            fStream.close(null);

            //Now apply any effect (if selected)
            switch(that.effect_select) {
                case 'grayscale':
                    imports.ui.main.Util.spawnCommandLine('mogrify -grayscale average ' + imagePath);
                break;
                case 'gaussian-blur':
                    imports.ui.main.Util.spawnCommandLine('mogrify -gaussian-blur 40 ' + imagePath);
                break;
                default:
                    //Just ignore any invalid option...
            }

            if (message.status_code === 200) {
                let gSetting = new Gio.Settings({schema: 'org.cinnamon.desktop.background'});
                gSetting.set_string('picture-uri', 'file://' + imagePath);
                Gio.Settings.sync();
                gSetting.apply();
            } else
                this._show_notification('Could not download image!');
            that._icon_stop();
        });
        log('Downloading ' + uri);
    }

    _update_tooltip() {
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
            tooltipStr += 'No action defined! Please enable at least on in the configuration!';
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
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
        this._timeout_disable();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new UnsplashBackgroundApplet(orientation, panel_height, instance_id);
}
