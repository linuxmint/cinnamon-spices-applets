const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Animations = imports.animations.Animations;
const Alarm = imports.alarm.Alarm;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext;
const UUID = "crypto-tracker@danipin";

function _(str) {
  let forced = _applet ? _applet.forcedLocale : null;
  if (forced && forced !== "system") {
      let old = GLib.getenv("LANGUAGE");
      GLib.setenv("LANGUAGE", forced, true);
      let res = Gettext.dgettext(UUID, str);
      if (old) GLib.setenv("LANGUAGE", old, true);
      else GLib.unsetenv("LANGUAGE");
      return res;
  }
  return Gettext.dgettext(UUID, str);
}

var _applet;

function init(applet) {
    _applet = applet;
}

function createFooter(searchActive = false) {
    let footItem = new PopupMenu.PopupBaseMenuItem({ reactive: !searchActive });
    let footerBox = new St.BoxLayout({ style: "padding: 6px 17px; margin-top: 5px;" }); // FIX: 17px Padding for alignment with metrics
    
    let labelStatus = new St.Label({ y_align: St.Align.MIDDLE });
    let labelMonat = new St.Label({ y_align: St.Align.MIDDLE });
    let labelAvg = new St.Label({ y_align: St.Align.MIDDLE });
    let labelAlarms = new St.Label({ y_align: St.Align.MIDDLE });
    
    let rightBox = new St.BoxLayout({ y_align: St.Align.MIDDLE, reactive: true });
    let starBin = new St.Bin({ y_align: St.Align.MIDDLE });
    let starLabel = new St.Label({ text: "✨", y_align: St.Align.MIDDLE, style: "margin-right: 4px;" });
    starLabel.set_translation(0, -1, 0);
    starLabel.set_opacity(80); // Start transparency (~30%)
    starLabel.set_pivot_point(0.5, 0.5);
    starBin.set_child(starLabel);
    let rightL = new St.Label({ y_align: St.Align.MIDDLE });
    rightBox.add_actor(starBin);
    rightBox.add_actor(rightL);

    rightBox.connect('button-press-event', () => { return true; });
    rightBox.connect('button-release-event', () => {
        let url = _applet.apiValid ? "https://www.coingecko.com" : "https://www.coingecko.com/en/api";
        Util.spawnCommandLine("xdg-open " + url);
        _applet.menu.close();
        return true;
    });

    let createSep = () => {
        return new St.Label({ 
            text: "|", 
            style: "font-size: 10px; color: " + _applet.colors.divider + "; padding: 0 4px;", 
            y_align: St.Align.MIDDLE 
        });
    };

    // 1. Status (Always visible)
    footerBox.add(labelStatus);

    // All API-related data (Stats + Time) only with active Key
    if (_applet.apiValid) {

        if (_applet.settings.getValue("show-monthly-stats")) {
            footerBox.add(createSep());
            footerBox.add(labelMonat);
            
            if (_applet.settings.getValue("show-avg-stats")) {
                footerBox.add(createSep());
                footerBox.add(labelAvg);
            }
        }
        
        if (_applet.settings.getValue("show-active-alarms")) {
            footerBox.add(createSep());
            footerBox.add(labelAlarms);
        }
    }

    // Flexible spacer and source (Always at the end)
    footerBox.add(new St.Label({ text: "" }), { expand: true }); 
    footerBox.add(rightBox);
    
    footItem.addActor(footerBox, { expand: true, span: -1 });

    let refreshF = (isH) => {
        let base = "font-size: 10px; font-weight: normal; "; 
        let passiveColor = "color: " + _applet.colors.text_more_dim + ";";
        let hoverColor = "color: " + _applet.colors.text_dim + ";"; // Keep gray on hover
        let warnColor = "#e67e22"; 
        let dangerColor = "#f44336"; 
        let activeGreen = "#2e8b57"; 

        // Set base texts
        labelStatus.set_text(_applet.apiValid ? _("API: Active") : _("Basic Mode"));
        
        if (_applet.apiValid) {
            starBin.hide();
            rightL.set_text(_("Source: CoinGecko"));
        } else {
            starBin.show();
            rightL.set_text(_("Get Free API Key"));
        }

        // Base Styles
        labelStatus.set_style(base + (isH && _applet.apiValid ? "color: " + activeGreen + ";" : passiveColor));
        let stdStyle = base + (isH ? hoverColor : passiveColor);
        rightL.set_style(stdStyle);

        // --- ONLY UPDATE IF API VALID ---
        if (_applet.apiValid) {
            labelMonat.set_text(_("Month:") + " " + _applet.keyCalls);
            labelAvg.set_text(_("Ø:") + " " + (_applet.avgPerDay || "0"));
            
            let alarmCount = (Alarm && Alarm.getAlarms) ? Alarm.getAlarms().length : 0;
            labelAlarms.set_text(_("Alarms: ") + alarmCount);
            labelAlarms.set_style(stdStyle);

            let mStyle = (isH) ? (_applet.keyCalls >= 9000 ? "color: " + dangerColor + ";" : (_applet.keyCalls >= 7500 ? "color: " + warnColor + ";" : hoverColor)) : passiveColor;
            labelMonat.set_style(base + mStyle);

            let aStyle = (isH) ? (_applet.avgPerDay > 333 ? "color: " + dangerColor + ";" : (_applet.avgPerDay > 280 ? "color: " + warnColor + ";" : hoverColor)) : passiveColor;
            labelAvg.set_style(base + aStyle);
        }
    };

    refreshF(false);

    let starAnimId = null;

    let resetStar = () => {
        if (starAnimId) {
            Mainloop.source_remove(starAnimId);
            starAnimId = null;
        }
        try {
            if (starLabel) {
                starLabel.set_opacity(80);
                starLabel.set_scale(1.0, 1.0);
                starLabel.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0);
            }
        } catch (e) {}
    };

    let animateStar = () => {
        if (_applet.apiValid) return;
        resetStar(); // Reset before start

        try {
            if (!starLabel) return;
            starLabel.set_opacity(255);
            starLabel.set_scale(1.2, 1.2);
            
            let t = 0;
            starAnimId = Mainloop.timeout_add(50, () => {
                if (!starLabel) return false;
                t += 0.6;
                let maxT = 4 * Math.PI;
                if (t >= maxT) {
                    starLabel.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, 0);
                    starAnimId = null;
                    return false;
                }
                let angle = 15 * (1 - (t / maxT)) * Math.sin(t);
                starLabel.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, angle);
                return true;
            });
        } catch (e) {}
    };

    // Uniform hover effect (Gray) also for footer
    if (!searchActive) {
        footItem.actor.connect('enter-event', () => { 
            footItem.actor.set_style("background-color: " + _applet.hoverColor + "; border-radius: " + _applet.hoverRadius + ";");
            refreshF(true);
            animateStar();
        });
    }
    footItem.actor.connect('leave-event', () => { // Always handle leave event for reset
        footItem.actor.set_style("background-color: transparent;");
        refreshF(false);
        resetStar();
    });
    footItem.actor.connect('destroy', resetStar);
    
    // FIX: Prevent clicks in footer from closing menu (except link)
    footItem.activate = () => {};
    
    return footItem;
}

var Footer = {
    init: init,
    createFooter: createFooter
};