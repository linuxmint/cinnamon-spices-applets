const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

let _httpSession;
if (Soup.MAJOR_VERSION == 2) {
    _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession,
        new Soup.ProxyResolverDefault());
} else { //version 3
    _httpSession = new Soup.Session();
}

const defaultTooltip = _("trying to fetch IP information");
const noConnectionIcon = "nm-no-connection";

const Debugger = {
    logLevel: 0,
    log: function (message, level) {
        if (!level) {
            level = 1;
        }
        if (level <= this.logLevel) {
            global.log(message);
        }
    }
};

const IpGateway = {
    init: function () {
        this._services = [];
        this._ispServices = [];
        this._serviceIteration = 0;

        this._services.push({
            url: "https://api.ipify.org?format=json",
            parse: function (jsonResponse) {
                let response = JSON.parse(jsonResponse);
                return response.ip.trim();
            }
        });
        this._services.push({
            url: "https://api.my-ip.io/ip",
            parse: function (response) {
                return response.trim();
            }
        });
        this._services.push({
            url: "https://myexternalip.com/json",
            parse: function (jsonResponse) {
                let response = JSON.parse(jsonResponse);
                return response.ip.trim();
            }
        });
        this._services.push({
            url: "https://icanhazip.com",
            parse: function (response) {
                return response.trim();
            }
        });
        this._services.push({
            url: "https://ipinfo.io/json",
            parse: function (jsonResponse) {
                let response = JSON.parse(jsonResponse);
                return response.ip.trim();
            }
        });
        this._services.push({
            url: "https://ip.seeip.org/",
            parse: function (response) {
                return response.ip.trim();
            }
        });
        this._services.push({
            url: "https://api.myip.com/",
            parse: function (jsonResponse) {
                let response = JSON.parse(jsonResponse);
                return response.ip.trim();
            }
        });        

        // ISP Service should be only one, because different services return different ISPs
        this._ispServices.push({
            // http://ip-api.com/docs/api:returned_values#selectable_output
            url: "http://ip-api.com/json?fields=country,countryCode,isp,query",
            parse: function (jsonResponse) {
                let response = JSON.parse(jsonResponse);
                return {
                    ip: response.query.trim(),
                    isp: response.isp.trim(),
                    country: response.country.trim(),
                    countryCode: response.countryCode.toLowerCase().trim()
                };
            }
        });

    },

    getOnlyIp: function (callback) {
        Debugger.log("Fetching only IP");
        if (this._serviceIteration + 1 >= this._services.length) {
            this._serviceIteration = 0;
        } else {
            this._serviceIteration += 1;
        }
        let service = this._services[this._serviceIteration];
        this._get(service.url, function (response) {
            Debugger.log("Response = " + response, 2);
            let ip = service.parse(response);
            callback(ip);
        });
    },

    getFullInfo: function (callback) {
        Debugger.log("Fetching full info");
        let service = this._ispServices[0];
        this._get(service.url, function (response) {
            Debugger.log("Response = " + response, 2);

            let fullInfo = service.parse(response);
            callback(fullInfo.ip, fullInfo.isp, fullInfo.country, fullInfo.countryCode);
        });
    },

    _get: function (url, callback) {
        Debugger.log(url, 2);
        
        if (Soup.MAJOR_VERSION === 2) {
            const request = new Soup.Message({
                method: 'GET',
                uri: new Soup.URI(url)
            });
            _httpSession.queue_message(request, function (_httpSession, message) {
                Debugger.log("Status code: " + message.status_code, 2);
                if (message.status_code !== 200) {
                    return;
                }
                let data = request.response_body.data;
                callback(data);
            });
        } else { //version 3
            const request = Soup.Message.new('GET', url);
            _httpSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, function (_httpSession, message) {
                Debugger.log("Status code: " + request.get_status(), 2);
                if (request.get_status() !== 200) {
                    return;
                }
                const bytes = _httpSession.send_and_read_finish(message);
                let data = ByteArray.toString(bytes.get_data());
                callback(data);
            });
        }
    }
};

function IpIndicatorApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

IpIndicatorApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height,
            instance_id);
        try {
            this.icon_theme = Gtk.IconTheme.get_default();
            this.icon_theme.append_search_path(metadata.path + "/flags");
            this._getNetworkInterfacesPath = metadata.path + "/getNetworkInterfaces.sh";
            this._interfaces = [];
            IpGateway.init();

            this.settings = new Settings.AppletSettings(this, metadata.uuid,
                instance_id);
            this._buildSettings();
            this._updateLogLevel();

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._buildMenu(orientation);
            this._updateNoInfo();
            this._restartTimer();

        } catch (e) {
            global.logError(e);
        }
    },

    _buildSettings: function () {
        this.settings.bindProperty(Settings.BindingDirection.IN, "home_isp",
            "homeIspName", this._updateSettings, null);
        this.settings
            .bindProperty(Settings.BindingDirection.IN,
                "home_isp_icon-name", "homeIspIcon",
                this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "home_isp_nickname", "homeIspNickname", this._updateSettings,
            null);

        this.settings.bindProperty(Settings.BindingDirection.IN, "other1_isp",
            "other1IspName", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other1_isp_icon-name", "other1IspIcon", this._updateSettings,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other1_isp_nickname", "other1IspNickname",
            this._updateSettings, null);

        this.settings.bindProperty(Settings.BindingDirection.IN, "other2_isp",
            "other2IspName", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other2_isp_icon-name", "other2IspIcon", this._updateSettings,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other2_isp_nickname", "other2IspNickname",
            this._updateSettings, null);

        this.settings.bindProperty(Settings.BindingDirection.IN, "other3_isp",
            "other3IspName", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other3_isp_icon-name", "other3IspIcon", this._updateSettings,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other3_isp_nickname", "other3IspNickname",
            this._updateSettings, null);

        this.settings.bindProperty(Settings.BindingDirection.IN, "other4_isp",
            "other4IspName", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other4_isp_icon-name", "other4IspIcon", this._updateSettings,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other4_isp_nickname", "other4IspNickname",
            this._updateSettings, null);

        this.settings.bindProperty(Settings.BindingDirection.IN, "other5_isp",
            "other5IspName", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other5_isp_icon-name", "other5IspIcon", this._updateSettings,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "other5_isp_nickname", "other5IspNickname",
            this._updateSettings, null);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "update_interval_ifconfig", "updateIntervalIfconfig", this._restartTimer, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "update_interval_service", "updateIntervalService", this._restartTimer, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "debug_level", "debuggerLogLevel", this._updateLogLevel, null);
        this._prepareIspsSettings();

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "appearance", "appearance", this._updateSettings, null);
    },

    _updateLogLevel: function () {
        Debugger.log("Setting debugger log level: " + this.debuggerLogLevel);
        Debugger.logLevel = this.debuggerLogLevel;
    },

    _updateSettings: function () {
        Debugger.log("Updating settings");
        this._prepareIspsSettings();
        //clean up interfaces so new ISP settings will be applied
        this._interfaces = [];
        this._restartTimer();
    },

    _updateViaIfconfigPeriodic: function () {
        if (this._areNetworkInterfacesChanged()) {
            this._fetchFullInfo();
        }
        Debugger.log("Update interval ifconfig = " + this.updateIntervalIfconfig + " seconds", 2);
        this._periodicTimeoutIfconfigId = Mainloop.timeout_add_seconds(
            this.updateIntervalIfconfig, Lang.bind(this, this._updateViaIfconfigPeriodic));
    },

    _updateViaIpServicePeriodic: function () {
        this._isPublicIpChanged(Lang.bind(this, this._fetchFullInfo));
        Debugger.log("Update interval service = " + this.updateIntervalService + " minutes", 2);
        this._periodicTimeoutIpServiceId = Mainloop.timeout_add_seconds(
            this.updateIntervalService * 60, Lang.bind(this, this._updateViaIpServicePeriodic));
    },

    _buildMenu: function (orientation) {
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._infoBox = new St.BoxLayout();
        this._infoBox.set_vertical(true);
        this._infoBox.set_style("margin-left: 22px; margin-right: 22px");

        this._ip = new St.Label();
        this._infoBox.add(this._ip);

        this._isp = new St.Label();
        this._infoBox.add(this._isp);

        this._country = new St.Label();
        this._infoBox.add(this._country);

        this.menu.addActor(this._infoBox);
    },

    _prepareIspsSettings: function () {
        this.homeIsp = {
            name: this.homeIspName.trim(),
            icon: this.homeIspIcon,
            nickname: this.homeIspNickname.trim()
        };
        this.other1_isp = {
            name: this.other1IspName.trim(),
            icon: this.other1IspIcon,
            nickname: this.other1IspNickname.trim()
        };
        this.other2_isp = {
            name: this.other2IspName.trim(),
            icon: this.other2IspIcon,
            nickname: this.other2IspNickname.trim()
        };
        this.other3_isp = {
            name: this.other3IspName.trim(),
            icon: this.other3IspIcon,
            nickname: this.other3IspNickname.trim()
        };
        this.other4_isp = {
            name: this.other4IspName.trim(),
            icon: this.other4IspIcon,
            nickname: this.other4IspNickname.trim()
        };
        this.other5_isp = {
            name: this.other5IspName.trim(),
            icon: this.other5IspIcon,
            nickname: this.other5IspNickname.trim()
        };
        this.ispsSettings = [this.homeIsp, this.other1_isp, this.other2_isp,
            this.other3_isp, this.other4_isp, this.other5_isp
        ];
    },

    _fetchFullInfo: function () {
        IpGateway.getFullInfo(Lang.bind(this, this._updateInfo));
    },

    _updateNoInfo: function () {
        Debugger.log("Updating with no info");
        this._infoBox.hide();
        this.set_applet_tooltip(defaultTooltip);
        this.set_applet_icon_symbolic_name(noConnectionIcon);
        this.set_applet_icon_name(noConnectionIcon);
        this.set_applet_label("");
    },

    _updateInfo: function (ip, isp, country, countryCode) {
        Debugger.log("Updating info");
        Debugger.log("ip = " + ip, 2);
        Debugger.log("isp = " + isp, 2);
        Debugger.log("country = " + country, 2);
        Debugger.log("countryCode = " + countryCode, 2);

        this._infoBox.show();
        this._ip.set_text(ip);
        this._country.set_text(country);

        let ispName = isp;
        let iconName;
        let isIspSettingFound = false;

        Debugger.log("Searching for ISP settings", 2);
        for (let i = 0; i < this.ispsSettings.length; i++) {
            const ispSetting = this.ispsSettings[i];
            if (ispSetting.name != "" && isp.toLowerCase().includes(ispSetting.name.toLowerCase())) {
                Debugger.log("ISP setting found: " + ispSetting.name, 2);
                if (ispSetting.icon) {
                    iconName = ispSetting.icon;
                } else {
                    iconName = countryCode;
                }
                Debugger.log("iconName: " + iconName, 2);
                if (ispSetting.nickname) {
                    ispName = ispSetting.nickname;
                    Debugger.log("nickname: " + ispSetting.nickname, 2);
                }
                isIspSettingFound = true;
                break;
            }
        }
        
        if (!isIspSettingFound) {
            iconName = countryCode;
        }

        this.set_applet_label(ip);

        Debugger.log("Appearance is " + this.appearance);
        if (this.appearance === "icon") {
            this.hideLabel();
            this._showIcon(iconName);
        } else if (this.appearance === "ip") {
            this.showLabel();
            this.hide_applet_icon();
        } else {
            this.showLabel();
            this._showIcon(iconName);
        }

        this.set_applet_tooltip(ip);
        this._isp.set_text(ispName);
    },

    _showIcon: function (iconName) {
        const icon_file = Gio.File.new_for_path(iconName);
        if (icon_file.query_exists(null)) {
            this.set_applet_icon_path(iconName);
        } else {
            this.set_applet_icon_symbolic_name(iconName);
            this.set_applet_icon_name(iconName);
        }
    },

    _isPublicIpChanged: function (actionIfYes) {
        Debugger.log("Checking if public IP has changed");
        IpGateway.getOnlyIp(Lang.bind(this, function (ip) {
            let oldPublicIP = this._publicIp;
            this._publicIp = ip;

            Debugger.log("Old public IP: " + oldPublicIP, 2);
            Debugger.log("Current public IP: " + this._publicIp, 2);

            let areChanged = oldPublicIP !== this._publicIp;
            if (areChanged) Debugger.log("CHANGED!!!"); else Debugger.log("ARE NOT CHANGED");
            if (areChanged) {
                actionIfYes();
            }
        }));
    },

    _areNetworkInterfacesChanged: function () {
        Debugger.log("Checking if network interfaces have changed");

        let oldInterfaces = this._interfaces;
        this._interfaces = this._getNetworkInterfaces().sort();

        Debugger.log("Old interfaces: " + oldInterfaces, 2);
        Debugger.log("Current interfaces: " + this._interfaces, 2);

        let areChanged = oldInterfaces.toString() !== this._interfaces.toString();
        if (areChanged) Debugger.log("CHANGED!!!"); else Debugger.log("ARE NOT CHANGED");
        return areChanged;
    },

    _getNetworkInterfaces: function () {
        Debugger.log("Executing " + this._getNetworkInterfacesPath, 2);
        let output = GLib.spawn_command_line_sync(this._getNetworkInterfacesPath);
        let interfaces = output[1].toString().split("\n");
        return interfaces;
    },

    _restartTimer: function () {
        this._removeTimer();
        this._updateViaIfconfigPeriodic();
        this._updateViaIpServicePeriodic();
    },

    _removeTimer: function () {
        if (this._periodicTimeoutIfconfigId) {
            Mainloop.source_remove(this._periodicTimeoutIfconfigId);
        }
        if (this._periodicTimeoutIpServiceId) {
            Mainloop.source_remove(this._periodicTimeoutIpServiceId);
        }
    },

    on_applet_removed_from_panel: function () {
        this._removeTimer();
        this.settings.finalize();
    },

    on_applet_clicked: function () {
        this._restartTimer();
        this.menu.toggle();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new IpIndicatorApplet(metadata, orientation, panel_height,
        instance_id);
}
