const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const Utils = imports.utils.Utils;
const Animations = imports.animations.Animations;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext;
const UUID = "crypto-tracker@danipin";

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var _applet;
var _expandedId = null;
var _activeDetailsActor = null;

function init(applet) {
    _applet = applet;
}

function createDonateSection(maxHeight) {
    let section = new PopupMenu.PopupMenuSection();
    
    // --- 1. Fixed Header (Description) ---
    let introItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
    introItem.actor.style = "padding: 0px; margin: 0px;";
    
    let introBox = new St.BoxLayout({ vertical: true, style: "padding: 10px 40px 0 40px;" });
    
    let descLbl = new St.Label({ text: _("If you like this applet, you can support\nits development with a donation."), style: "font-size: 11px; color: " + _applet.colors.text_dim + ";" });
    descLbl.clutter_text.set_line_wrap(true);
    descLbl.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD);
    introBox.add(descLbl);
    
    // Separator
    let sep = new St.Bin({ style: "height: 1px; background-color: " + _applet.colors.divider + "; margin: 15px 0 5px 0;" });
    introBox.add(sep);

    introItem.addActor(introBox, { expand: true, span: -1 });
    section.addMenuItem(introItem);

    // --- 2. Scrollable List ---
    let scrollItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
    scrollItem.actor.style = "padding: 0px; margin: 0px;";
    
    // Reduce height for list, as header now takes space (~60px)
    let listMaxHeight = Math.max(100, maxHeight - 60);

    let scrollView = new St.ScrollView({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        style_class: 'vfade',
        style: "max-height: " + listMaxHeight + "px;",
        reactive: true
    });

    let container = new St.BoxLayout({ vertical: true, style: "padding: 5px 0px;" });
    scrollView.add_actor(container);
    
    let scrollBox = Utils.addScrollArrows(scrollView);
    scrollItem.addActor(scrollBox, { expand: true, span: -1 });
    section.addMenuItem(scrollItem);

    // Donation Options (Dummies)
    let options = [
        { id: "btc", name: "Bitcoin (BTC)", address: "1DHfDSWx9qrHgZXxFKHNeDP8LJiVLsLqwy", color: "#f7931a" },
        { id: "eth", name: "Ethereum (ETH)", address: "0xb3eb0f9cfffb6d3acc7edde4435a11eb2eedb47e", color: "#627eea" },
        { id: "ada", name: "Cardano (ADA)", address: "addr1vyl2drdd3qp5r3f88rrqctea0men25pl7zjku8tm0qglslsyp9366", color: "#0033ad" },
        { id: "usdt", name: "Tether (USDT - TRC20)", address: "TXU5vsfdycYJrA6VfoKci7TiE7pJQmRG1c", color: "#26a17b" },
        { id: "doge", name: "Dogecoin (DOGE)", address: "DFVDhRnFUwgQzpLRzuS22XQrZpKnVfWsSB", color: "#C2A633" },
        { id: "sol", name: "Solana (SOL)", address: "DnLAjRweqBB1Br95KV8RwR5VsZvp7ebQ8EDmrkzQuzbF", color: "#9945FF" },
        { id: "ltc", name: "Litecoin (LTC)", address: "LQ2Mwa4wR44J2E4c1s9dctThwC3KS2jyeq", color: "#345D9D" }
    ];

    options.forEach(opt => {
        let itemBox = new St.BoxLayout({ vertical: true, style: "margin-bottom: 4px;" });
        
        // Header (Clickable)
        let header = new St.BoxLayout({ style: "padding: 8px 40px; border-radius: 4px;", reactive: true });
        
        let isExpanded = (_expandedId === opt.id);
        let textColor = isExpanded ? _applet.colors.text : _applet.colors.text_dim;
        let fontWeight = isExpanded ? "bold" : "normal";
        let label = new St.Label({ text: opt.name, style: "font-weight: " + fontWeight + "; color: " + textColor + ";" });
        header.add(label);
        
        header.connect('enter-event', () => {
            header.set_style("padding: 8px 40px; border-radius: 4px; background-color: " + _applet.hoverColor + ";");
        });
        header.connect('leave-event', () => {
            header.set_style("padding: 8px 40px; border-radius: 4px; background-color: transparent;");
        });
        
        header.connect('button-release-event', () => {
            // FIX: Keep menu open on click
            _applet.menu.close = () => {};
            
            let toggleAction = () => {
                // Animation Logic
                if (_expandedId && _activeDetailsActor) {
                    // If we click the already open element -> Close
                    if (_expandedId === opt.id) {
                        Animations.animateCollapse(_activeDetailsActor, () => {
                            _expandedId = null;
                            _activeDetailsActor = null;
                            _applet._buildMenu();
                            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                        }, 8); // Slower (like Portfolio)
                        return;
                    }
                    
                    // If we click another element -> Close old, open new
                    Animations.animateCollapse(_activeDetailsActor, () => {
                        _expandedId = opt.id;
                        _activeDetailsActor = null;
                        Mainloop.timeout_add(120, () => {
                            _applet._buildMenu();
                            Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
                            return false;
                        });
                    }, 8); // Slower (like Portfolio)
                    return;
                }
                
                // Nothing open -> Just open
                _expandedId = opt.id;
                _applet._buildMenu();
                Mainloop.timeout_add(100, () => { if (_applet.menu) _applet.menu.close = _applet._originalMenuClose; return false; });
            };

            // Check if header menu or other dropdown is open
            if (_applet._closeAnyDropdown(() => {
                Mainloop.timeout_add(120, () => {
                    toggleAction();
                    return false;
                });
            })) {
                return true;
            }

            toggleAction();
            return true;
        });
        
        itemBox.add(header);

        // Details (Dropdown)
        if (_expandedId === opt.id) {
            let details = new St.BoxLayout({ vertical: true, style: "padding: 15px; background-color: " + _applet.colors.bg_popup + "; width: 100%;" });
            
            // QR Code
            let qrBox = new St.BoxLayout({ x_align: St.Align.MIDDLE, style: "margin-bottom: 10px; margin-top: 10px;" });
            
            let qrId = "qr_" + opt.id;
            let qrPath = Utils.getCacheDir() + "/icons/" + qrId + ".png";
            let qrFile = Gio.file_new_for_path(qrPath);
            
            if (!qrFile.query_exists(null)) {
                let qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + opt.address;
                Utils.downloadIcon(qrId, qrUrl);
                Mainloop.timeout_add(1500, () => { if (_expandedId === opt.id) _applet._buildMenu(); return false; });
            }

            if (qrFile.query_exists(null)) {
                let qrIcon = new St.Icon({ gicon: new Gio.FileIcon({ file: qrFile }), icon_size: 240, style: "background-color: white; border-radius: 4px;" });
                qrBox.add(qrIcon);
            } else {
                let qrPlaceholder = new St.Bin({ style: "width: 240px; height: 240px; background-color: rgba(255,255,255,0.1); border-radius: 4px;" });
                qrBox.add(qrPlaceholder);
            }
            
            details.add(qrBox, { x_fill: false, x_align: St.Align.MIDDLE });

            // Address Row
            let addrBox = new St.BoxLayout({ vertical: true });
            let addrLabel = new St.Label({ text: _("Address:"), style: "font-size: 10px; color: " + _applet.colors.text_dim + "; text-align: center;" });
            addrBox.add(addrLabel, { x_fill: false, x_align: St.Align.MIDDLE });
            
            let valRow = new St.BoxLayout({ style: "margin-top: 2px;", x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
            
            let displayAddr = opt.address;
            if (opt.id === "ada") {
                let cut = 20;
                let start = Math.floor((opt.address.length - cut) / 2);
                displayAddr = opt.address.substring(0, start) + "..." + opt.address.substring(start + cut);
            }
            
            let valLabel = new St.Label({ text: displayAddr, style: "font-size: 11px; color: " + _applet.colors.text + "; font-family: monospace;" });
            if (opt.id !== "ada") valLabel.get_clutter_text().set_ellipsize(Pango.EllipsizeMode.MIDDLE);
            valRow.add(valLabel, { expand: true });
            
            // Copy Button
            let copyBtn = new St.Button({ style: "padding: 2px 6px; margin-left: 5px; border-radius: 4px;", reactive: true });
            let copyIcon = new St.Icon({ icon_name: "edit-copy-symbolic", icon_size: 14, style: "color: " + _applet.colors.text_more_dim + ";" });
            copyIcon.set_translation(0, -3, 0);
            copyBtn.set_child(copyIcon);
            
            let resetCopyTimer = null;
            copyBtn._success = false;

            copyBtn.connect('enter-event', () => { if (!copyBtn._success) copyIcon.set_style("color: " + _applet.colors.text + ";"); });
            copyBtn.connect('leave-event', () => { if (!copyBtn._success) copyIcon.set_style("color: " + _applet.colors.text_more_dim + ";"); });
            
            copyBtn.connect('clicked', () => {
                let clipboard = St.Clipboard.get_default();
                clipboard.set_text(St.ClipboardType.CLIPBOARD, opt.address);
                Utils.sendNotification(_("Copied"), _("%s address copied.").format(opt.name), "dialog-information");
                
                if (resetCopyTimer) {
                    Mainloop.source_remove(resetCopyTimer);
                    resetCopyTimer = null;
                }
                
                copyBtn._success = true;
                copyIcon.set_icon_name("emblem-ok-symbolic");
                copyIcon.set_style("color: #449d44;");

                resetCopyTimer = Mainloop.timeout_add(2000, () => {
                    if (copyBtn && copyIcon) {
                        copyBtn._success = false;
                        copyIcon.set_icon_name("edit-copy-symbolic");
                        copyIcon.set_style("color: " + _applet.colors.text_more_dim + ";");
                    }
                    resetCopyTimer = null;
                    return false;
                });
            });
            
            copyBtn.connect('destroy', () => { if (resetCopyTimer) Mainloop.source_remove(resetCopyTimer); });
            
            valRow.add(copyBtn);
            addrBox.add(valRow, { x_fill: false, x_align: St.Align.MIDDLE });
            details.add(addrBox, { x_fill: false, x_align: St.Align.MIDDLE });
            
            itemBox.add(details);
            _activeDetailsActor = details;
            Animations.animateExpand(details, null, 8);
        }
        
        container.add(itemBox);
    });

    return section;
}

function closeDropdown(callback) {
    if (_expandedId && _activeDetailsActor) {
        Animations.animateCollapse(_activeDetailsActor, () => {
            _expandedId = null;
            _activeDetailsActor = null;
            _applet._buildMenu();
            if (callback) callback();
        }, 8);
        return true;
    }
    return false;
}

function resetState() {
    _expandedId = null;
    _activeDetailsActor = null;
}

var Donate = {
    init: init,
    createDonateSection: createDonateSection,
    closeDropdown: closeDropdown,
    resetState: resetState
};