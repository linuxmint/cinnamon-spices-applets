const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const HttpClient = require("./httpClient").HttpClient;
const FileManager = require("./fileManager").FileManager;
const SettingsManager = require("./settingsManager").SettingsManager;
const Utils = require("./utils").Utils;

// Time interval for refreshing wallpaper (in seconds)
const REFRESH_INTERVAL = 300;

/**
 * BingWallpaperApplet is a Cinnamon applet that sets the Bing daily wallpaper.
 * It handles fetching metadata, downloading images, and updating the desktop background.
 */
function BingWallpaperApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}

BingWallpaperApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  /**
   * Initializes the applet, sets up directories, and starts the refresh loop.
   * @param {number} orientation - The orientation of the panel.
   * @param {number} panel_height - The height of the panel.
   * @param {string} instance_id - The instance identifier of the applet.
   */
  _init: function (orientation, panel_height, instance_id) {
    // Call parent class initialization
    Applet.IconApplet.prototype._init.call(
      this,
      orientation,
      panel_height,
      instance_id
    );

    // Set applet icon and tooltip
    this.set_applet_icon_symbolic_name("bing-wallpaper");
    this.set_applet_tooltip("Bing Desktop Wallpaper");

    // Initialize file manager and HTTP client
    this.fileManager = new FileManager();
    this.httpClient = new HttpClient();

    this._refresh();
  },

  /**
   * Starts the process to refresh the wallpaper by fetching metadata and setting a timeout.
   */
  _refresh: function () {
    Utils.log("Beginning refresh");
    this._getMetaData();
    this._setTimeout(REFRESH_INTERVAL);
  },

  /**
   * Removes the current timeout to prevent multiple timeouts.
   */
  _removeTimeout: function () {
    if (this._timeout) {
      Mainloop.source_remove(this._timeout);
      this._timeout = null;
    }
  },

  /**
   * Sets a timeout for refreshing the wallpaper.
   * @param {number} seconds - Number of seconds to wait before the next refresh.
   */
  _setTimeout: function (seconds) {
    this._removeTimeout();
    Utils.log(`Setting timeout (${seconds}s)`);
    this._timeout = Mainloop.timeout_add_seconds(
      seconds,
      Lang.bind(this, this._refresh)
    );
  },

  /**
   * Cleanup function called when the applet is destroyed or removed.
   */
  destroy: function () {
    this._removeTimeout();
  },

  /**
   * Called when the applet is removed from the panel to stop refreshing.
   */
  on_applet_removed_from_panel() {
    this._removeTimeout();
  },

  /**
   * Retrieves metadata from local storage or the Bing server.
   */
  _getMetaData: function () {
    try {
      let metaData = this.fileManager.readMetaData();
      if (this._isMetaDataUpToDate(metaData)) {
        Utils.log("Metadata is up-to-date");
        this._checkImage();
      } else {
        Utils.log("Metadata is old, requesting new...");
        this._downloadMetaData();
      }
    } catch (err) {
      Utils.log(`Unable to get local metadata: ${err}`);
      this._downloadMetaData();
    }
  },

  /**
   * Checks if the retrieved metadata is still valid.
   * @param {object} metaData - Metadata object containing image details.
   * @returns {boolean} - True if metadata is up-to-date, false otherwise.
   */
  _isMetaDataUpToDate: function (metaData) {
    const { start_date, end_date } =
      this.fileManager.parseMetaDataDates(metaData);
    const now = GLib.DateTime.new_now_utc();
    return now.to_unix() < end_date.to_unix();
  },

  /**
   * Checks if the image file is up-to-date. If not, it downloads a new image.
   */
  _checkImage: function () {
    if (this.fileManager.isImageUpToDate()) {
      Utils.log("Image appears up-to-date");
    } else {
      Utils.log("Image is old or missing");
      this._downloadImage();
    }
  },

  /**
   * Downloads metadata from Bing's API and processes it.
   */
  _downloadMetaData: function () {
    const url =
      "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mbl=1";
    this.httpClient.get(
      url,
      (data) => {
        this.fileManager.writeMetaData(data);
        this._downloadImage();
      },
      (error) => {
        Utils.log(`Failed to acquire image metadata: ${error}`);
        this._setTimeout(60); // Retry after 60 seconds
      }
    );
  },

  /**
   * Downloads the wallpaper image and sets it as the desktop background.
   */
  _downloadImage: function () {
    Utils.log("Downloading new image");
    const url = this.fileManager.getImageUrl();
    this.httpClient.get(
      url,
      (data) => {
        this.fileManager.writeImage(data);
        this._setBackground();
      },
      (error) => {
        Utils.log(`Couldn't fetch image from ${url}: ${error}`);
        this._setTimeout(60); // Retry after 60 seconds
      }
    );
  },

  /**
   * Sets the downloaded image as the desktop wallpaper.
   */
  _setBackground: function () {
    SettingsManager.setWallpaper(this.fileManager.getWallpaperPath());
  },
};

/**
 * Main function to initialize the BingWallpaperApplet.
 * @param {object} metadata - Metadata for the applet.
 * @param {number} orientation - The orientation of the panel.
 * @param {number} panelHeight - The height of the panel.
 * @param {string} instanceId - The instance identifier of the applet.
 * @returns {BingWallpaperApplet} - An instance of the BingWallpaperApplet.
 */
function main(metadata, orientation, panelHeight, instanceId) {
  return new BingWallpaperApplet(orientation, panelHeight, instanceId);
}
