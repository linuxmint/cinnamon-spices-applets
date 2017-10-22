const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const uuid = "system-monitor@pixunil";
const iconName = "utilities-system-monitor";

Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale");

function _(str){
    return Gettext.dgettext(uuid, str);
}

function bind(func, context){
    function callback(){
        try {
            return func.apply(context, arguments);
        } catch(e){
            global.logError(e);
            return null;
        }
    }

    return callback;
}

function dashToCamelCase(string){
    return string.replace(/-(.)/g, function(match, char){
        return char.toUpperCase();
    });
}
