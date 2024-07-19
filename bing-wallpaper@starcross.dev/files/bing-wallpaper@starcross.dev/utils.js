/**
 * Utility functions for logging and other common tasks.
 */
const Utils = {
  /**
   * Logs a message if logging is enabled.
   * @param {string} message - The message to log.
   */
  log: function (message) {
    if (false) {
      // Set to true to enable logging
      global.log(`[bing-wallpaper@starcross.dev]: ${message}`);
    }
  },
};

exports.Utils = Utils;
