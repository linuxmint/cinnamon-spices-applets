const {
  get_home_dir,
  get_user_name,
  get_user_runtime_dir,
  get_user_special_dir,
  UserDirectory,
  find_program_in_path,
  markup_escape_text,
  DateTime,
  file_test,
  FileTest,
  file_get_contents,
  file_set_contents,
  mkdir_with_parents,
  uuid_string_random,
  random_int_range,
  getenv,
  PRIORITY_LOW,
  SOURCE_REMOVE,
  SOURCE_CONTINUE
  //~ chmod  // unknown!!!
} = imports.gi.GLib; //GLib

const {
  network_monitor_get_default,
  NetworkConnectivity,
  file_new_for_path,
  app_info_get_default_for_type,
  FileQueryInfoFlags,
  FileType,
  DataInputStream,
  UnixInputStream,
  Settings
} = imports.gi.Gio; //Gio

const {
  spawnCommandLineAsyncIO,
  spawnCommandLineAsync,
  spawnCommandLine,
  spawn_async,
  trySpawnCommandLine,
  //killall,
  setTimeout,
  clearTimeout
} = imports.misc.util; //Util

const ByteArray = imports.byteArray;
const to_string = function(data) {
  return ""+ByteArray.toString(data);
}

const HOME_DIR = get_home_dir();
//~ let METADATA_JSON_PATH;
//~ if (file_test("./metadata.json", FileTest.EXISTS)) {
  //~ METADATA_JSON_PATH = "./metadata.json"
//~ } else {
  //~ METADATA_JSON_PATH = "../metadata.json"
//~ }

//~ const METADATA = JSON.parse(to_string(file_get_contents(METADATA_JSON_PATH)[1]));
//~ const UUID = METADATA.uuid;
const UUID = "Radio3.0@claudiux";
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const APPLET_ICON = APPLET_DIR + "/icon.svg";
const PO_DIR = APPLET_DIR + "/po";
const LOCALE_DIR = HOME_DIR + "/.local/share/locale"
//~ file_set_contents("./RESULT.txt", "UUID: "+UUID);

function are_translations_installed() {
  if (!file_test(PO_DIR, FileTest.IS_DIR)) return true; // No .po file exists. No install needed.
  if (!file_test(LOCALE_DIR, FileTest.IS_DIR)) return false; // No 'locale' dir exists. Install needed.

  //~ var po_files = [];

  let po_dir = file_new_for_path(PO_DIR);
  let po_children = po_dir.enumerate_children("standard::name,time::*", FileQueryInfoFlags.NONE, null);
  let info, file_type, name, po_modif_date;
  let lang, mo_path, mo_file, mo_modif_date;

  while ((info = po_children.next_file(null)) != null) {
  file_type = info.get_file_type();
    if (file_type === FileType.REGULAR) {
      name = ""+info.get_name();

      if (name.endsWith(".po")) {
        po_modif_date = ""+info.get_attribute_uint64("time::modified");
        lang = ""+name.slice(0, -3);
        mo_path = `${LOCALE_DIR}/${lang}/LC_MESSAGES/${UUID}.mo`;
        if (!file_test(mo_path, FileTest.EXISTS)) return false; // .mo file does not exist. Install needed.
        mo_file = file_new_for_path(mo_path);
        mo_modif_date = ""+mo_file.query_info("time::modified", 0, null).get_attribute_uint64("time::modified");
        if (po_modif_date > mo_modif_date) return false; // .po file is more recent than .mo file. Install needed.

        //~ po_files.push(lang+":"+po_modif_date+":"+mo_modif_date);

      }
    }
  }

  // All is fine.
  //~ file_set_contents("./RESULT.txt", "po_files: "+po_files.join(", "));
  return true
}

function install_translations() {
  spawnCommandLineAsyncIO(`bash -c "cd ${PO_DIR} && ./makepot -i"`, (out, err, exit_code) => {
    if (exit_code === 0) {
      let message = _("To finalize the translation installation, please restart Cinnamon");
      spawnCommandLineAsync(`notify-send -i ${APPLET_ICON} -u critical "${message}"`);
    }
  });
}

//~ let result = are_translations_installed();
//~ file_set_contents("./RESULT.txt", ""+result);
//~ if (!result) install_translations();

module.exports = {
  are_translations_installed,
  install_translations
}
