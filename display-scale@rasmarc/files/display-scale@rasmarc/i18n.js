// Match Cinnamon 6.6's fixed user catalog location used by settings and About.
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const DOMAIN = "display-scale@rasmarc";
Gettext.bindtextdomain(DOMAIN, GLib.get_home_dir() + "/.local/share/locale");

function _(message) {
    return Gettext.dgettext(DOMAIN, message);
}

const percentFormatter = new Intl.NumberFormat(undefined, {
    useGrouping: false, maximumFractionDigits: 1
});

function formatPercent(percent) {
    return percentFormatter.format(Math.round(percent * 10) / 10) + "%";
}

module.exports = { _, formatPercent };
