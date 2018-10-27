const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;

//const Lang = imports.lang;


function execInstallLanguages(uuid) {
    if (uuid == null || uuid == "")
        return false;
    //let appletPath = imports.ui.appletManager.applets[uuid];
    let appletPath = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid;
    let poPath = appletPath + "/po";
    let poDir = Gio.file_new_for_path(poPath);
    let poEnum;
    try {
        poEnum = poDir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null)
    } catch(e) {
        poEnum = null
    }

    let moExists = true;
    if (poEnum != null) {
        let info;
        let poFile;
        let language;
        let moPath, moFile;
        let localePath = GLib.get_home_dir() + "/.local/share/locale";
        while (moExists && (info = poEnum.next_file(null)) != null) {
            let type = info.get_file_type();
            if (type == Gio.FileType.REGULAR) {
                let name = info.get_name().toString();
                poFile = poDir.get_child(name);
                if (name.endsWith('.po')) {
                    language = name.substring(0, name.length - 3);
                    moPath = localePath + '/' + language + '/LC_MESSAGES/'+uuid+'.mo';
                    moFile = Gio.file_new_for_path(moPath);
                    if (!moFile.query_exists(null)) { // .mo file doesn't exist
                        moExists = false
                    } else { // .mo file exists
                        // modification times
                        let poModified = poFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                        let moModified = moFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                        if (poModified > moModified) { // .po file is most recent than .mo file
                            moExists = false; // .mo file must be replaced.
                        }
                    }
                }
            }
        }
    }

    if (!moExists) { // at least one .mo file is missing or is too old
        let generatemoPath = appletPath + '/scripts/generate_mo.sh'; // script to generate .mo files
        GLib.spawn_command_line_async('sh "' + generatemoPath + '"'); // generate all .mo files
    }

    return !moExists
} // End of execInstallLanguage
