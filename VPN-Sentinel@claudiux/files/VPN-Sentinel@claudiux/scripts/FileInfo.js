 try {
        let _shareFolder = GLib.get_home_dir() + "/.local/share/";
        let _localeFolder = Gio.file_new_for_path(_shareFolder + "locale/");
        let _moFolder = Gio.file_new_for_path(_shareFolder + "cinnamon/applets/" + this._uuid + "/locale/mo/");

        let children = _moFolder.enumerate_children('standard::name,standard::type,time::modified',
                                                   Gio.FileQueryInfoFlags.NONE, null);
        let info, child, _moFile, _moLocale, _moPath;

        while ((info = children.next_file(null)) != null) {
            let type = info.get_file_type();
            let modified = info.get_modification_time().tv_sec;
            if (type == Gio.FileType.REGULAR) {
                _moFile = info.get_name();
                if (_moFile.substring(_moFile.lastIndexOf(".")) == ".mo") {
                    _moLocale = _moFile.substring(0, _moFile.lastIndexOf("."));
                    _moPath = _localeFolder.get_path() + "/" + _moLocale + "/LC_MESSAGES/";
                    let src = Gio.file_new_for_path(String(_moFolder.get_path() + "/" + _moFile));
                    let dest = Gio.file_new_for_path(String(_moPath + this._uuid + ".mo"));
                    let destModified = dest.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                    try {
                        if(modified > destModified) {
                            this._makeDirectoy(dest.get_parent());
                            src.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
                        }
                    } catch(e) {
                        global.logError(e);
                    }
                }
            }
        }
    } catch(e) {
        global.logError(e);
    }
