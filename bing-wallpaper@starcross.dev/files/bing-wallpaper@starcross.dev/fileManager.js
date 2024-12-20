const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

/**
 * FileManager handles file operations related to storing and retrieving metadata and images.
 */
const FileManager = function () {
  this.wallpaperDir = `${GLib.get_user_config_dir()}/bingwallpaper`;
  this.wallpaperPath = `${this.wallpaperDir}/BingWallpaper.jpg`;
  this.metaDataPath = `${this.wallpaperDir}/meta.json`;

  this._init();
};

FileManager.prototype = {
  /**
   * Initializes the file manager by creating necessary directories.
   */
  _init: function () {
    let dir = Gio.file_new_for_path(this.wallpaperDir);
    if (!dir.query_exists(null)) dir.make_directory(null);
  },

  /**
   * Reads metadata from the local file.
   * @returns {object} - Parsed JSON metadata.
   */
  readMetaData: function () {
    const jsonString = GLib.file_get_contents(this.metaDataPath)[1];
    return JSON.parse(jsonString);
  },

  /**
   * Writes metadata to the local file.
   * @param {string} data - Metadata in JSON format.
   */
  writeMetaData: function (data) {
    let gFile = Gio.file_new_for_path(this.metaDataPath);
    let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
    fStream.write(data, null);
    fStream.close(null);
  },

  /**
   * Parses metadata dates to GLib.DateTime objects.
   * @param {object} metaData - Metadata object containing image details.
   * @returns {object} - Object containing start_date and end_date as GLib.DateTime.
   */
  parseMetaDataDates: function (metaData) {
    const startDateStr = metaData.images[0].fullstartdate;
    const start_date = GLib.DateTime.new(
      GLib.TimeZone.new_utc(),
      startDateStr.substring(0, 4),
      startDateStr.substring(4, 6),
      startDateStr.substring(6, 8),
      startDateStr.substring(8, 10),
      startDateStr.substring(10, 12),
      0
    );
    const end_date = start_date.add_days(1);
    return { start_date, end_date };
  },

  /**
   * Checks if the image file is up-to-date.
   * @returns {boolean} - True if the image is up-to-date, false otherwise.
   */
  isImageUpToDate: function () {
    let image_file = Gio.file_new_for_path(this.wallpaperPath);
    if (image_file.query_exists(null)) {
      let image_file_info = image_file.query_info(
        "*",
        Gio.FileQueryInfoFlags.NONE,
        null
      );
      let image_file_mod_secs = image_file_info.get_modification_time().tv_sec;
      return image_file_mod_secs > GLib.DateTime.new_now_utc().to_unix();
    }
    return false;
  },

  /**
   * Writes an image to the local file.
   * @param {string} data - Image data in binary format.
   */
  writeImage: function (data) {
    let gFile = Gio.file_new_for_path(this.wallpaperPath);
    let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
    fStream.write(data, null);
    fStream.close(null);
  },

  /**
   * Returns the path to the wallpaper file.
   * @returns {string} - Path to the wallpaper file.
   */
  getWallpaperPath: function () {
    return this.wallpaperPath;
  },

  /**
   * Returns the image URL for downloading.
   * @returns {string} - URL of the image to download.
   */
  getImageUrl: function () {
    // Implementation depends on the structure of metadata.
    // For example:
    return this.imageData.url.replace(/_\d+x\d+./gm, `_UHD.`);
  },
};

exports.FileManager = FileManager;
