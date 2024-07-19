const Gio = imports.gi.Gio;

/**
 * SettingsManager manages system settings for changing the desktop wallpaper.
 */
const SettingsManager = function () {};

SettingsManager.prototype = {
  /**
   * Sets the desktop wallpaper to the specified file path.
   * @param {string} filePath - File path of the wallpaper image.
   */
  setWallpaper: function (filePath) {
    let gSetting = new Gio.Settings({
      schema: "org.cinnamon.desktop.background",
    });
    const uri = "file://" + filePath;
    gSetting.set_string("picture-uri", uri);
    gSetting.set_string("picture-options", "zoom");
    Gio.Settings.sync();
    gSetting.apply();
  },
};

exports.SettingsManager = SettingsManager;
