const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Settings = imports.ui.settings; // Import the Settings module

const UUID = "password-generator@spencerlommel.com"
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

class CinnamonRandomPasswordApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);

        // Bind settings
        this.settings.bind("password-length", "passwordLength", this.onSettingsChanged);
        this.settings.bind("include-lowercase", "includeLowercase", this.onSettingsChanged);
        this.settings.bind("include-uppercase", "includeUppercase", this.onSettingsChanged);
        this.settings.bind("include-symbols", "includeSymbols", this.onSettingsChanged);
        this.settings.bind("include-numbers", "includeNumbers", this.onSettingsChanged);

        this.set_applet_icon_name("dialog-password");
        this.set_applet_tooltip(_("Generate Random Password"));

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this.menuBox = new St.BoxLayout({ vertical: false });
        this.textBox = new St.Entry({
            style_class: 'popup-menu-item',
            hint_text: _("Please enable at least one value in settings."),
            x_expand: true,
            can_focus: true
        });
        this.menuBox.add(this.textBox);

        this.copyButton = new St.Button({
            label: _("Copy"),
            style_class: 'popup-menu-item',
            reactive: true,
            can_focus: true
        });
        this.menuBox.add(this.copyButton);
        this.menu.addActor(this.menuBox);

        this.copyButton.connect('clicked', () => {
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, this.textBox.get_text());
        });

        this.onSettingsChanged(); // Apply initial settings
    }

    on_applet_clicked(event) {
        this.menu.toggle();
        let newPassword = this.generateRandomPassword();
        this.textBox.set_text(newPassword);
    }

    generateRandomPassword() {
        let charset = "";
        if (this.includeLowercase) charset += "abcdefghijklmnopqrstuvwxyz";
        if (this.includeUppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (this.includeSymbols) charset += "!@#$%^&*()_+-=[]{}|;':,.<>/?";
        if (this.includeNumbers) charset += "0123456789";

        let randomPassword = "";
        for (let i = 0; i < this.passwordLength; i++) {
            randomPassword += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return randomPassword;
    }

    onSettingsChanged() {
        // React to settings changes if needed
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new CinnamonRandomPasswordApplet(metadata, orientation, panelHeight, instanceId);
}
