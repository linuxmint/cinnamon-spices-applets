const { Utils } = require("./utils");

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;

let _httpSession;

function HttpSession() {
    this._init();
}

HttpSession.prototype = {
    /**
     * init
     */
    _init: function () {
        if (Soup.MAJOR_VERSION == 2) {
            _httpSession = new Soup.SessionAsync();
            Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
        } else { //version 3
            _httpSession = new Soup.Session();
        }
        _httpSession.set_user_agent("cinnamon");
    },

    /**
     * queryMetada
     * @param {string} url - The url to call 
     * @param {function} callback - The function to call when url returns data
     * @returns {function} - Returns the function to call
     */
    queryMetada: function (url, callback) {
        Utils.log('downloading metadata from ' + url);

        let request = Soup.Message.new('GET', url);

        if (Soup.MAJOR_VERSION === 2) {
            _httpSession.queue_message(request, (_httpSession, message) => {
                if (message.status_code === 200) {
                    callback(message.response_body.data);
                } else {
                    Utils.log(`Failed to acquire image metadata (${message.status_code})`);
                    callback(false);
                }
            });
        } else { //version 3
            _httpSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (_httpSession, message) => {
                if (request.get_status() === 200) {
                    const bytes = _httpSession.send_and_read_finish(message);
                    callback(ByteArray.toString(bytes.get_data()));
                } else {
                    Utils.log(`Failed to acquire image metadata (${request.get_status()})`);
                    callback(false);
                }
            });
        }
    },

    /**
     * downloadImageFromUrl
     * @param {string} url - The url to call 
     * @param {string} wallpaperPath - Path where the wallpaper is saved
     * @param {function} callback - The function to call when url returns data
     * @returns {function} - Returns the function to call
     */
    downloadImageFromUrl: function (url, wallpaperPath, callback) {
        Utils.log('downloading new image from ' + url);

        let gFile = Gio.file_new_for_path(wallpaperPath);

        // open the file
        let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // create a http message
        let request = Soup.Message.new('GET', url);

        if (Soup.MAJOR_VERSION === 2) {
            // keep track of total bytes written
            let bytesTotal = 0;

            // got_chunk event
            request.connect('got_chunk', function (message, chunk) {
                if (message.status_code === 200) { // only save the data we want, not content of 301 redirect page
                    bytesTotal += fStream.write(chunk.get_data(), null);
                }
            });

            // queue the http request
            _httpSession.queue_message(request, (_httpSession, message) => {
                // request completed
                fStream.close(null);
                const contentLength = message.response_headers.get_content_length();

                if (message.status_code === 200 && contentLength === bytesTotal) {
                    callback();
                } else {
                    Utils.log("Error " + request.get_status() + ".Couldn't fetch image from " + url);
                    gFile.delete(null);
                    callback(false);
                }
            });
        } else { //version 3
            _httpSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (_httpSession, message) => {
                if (request.get_status() === 200) {
                    const bytes = _httpSession.send_and_read_finish(message);

                    if (bytes && bytes.get_size() > 0) {
                        fStream.write(bytes.get_data(), null);
                    }
                    // request completed
                    fStream.close(null);
                    Utils.log('Download successful');
                    callback();
                } else {
                    Utils.log("Error " + request.get_status() + ".Couldn't fetch image from " + url);
                    callback(false);
                }
            });
        }
    }
};

module.exports = { HttpSession }