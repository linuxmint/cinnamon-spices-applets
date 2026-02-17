/**
 * providers.js — Wallpaper source providers for Essentials Backgrounds
 *
 * Each provider exposes:
 *   fetchWallpaper(callback)  → callback({ url, title, credits, filename })
 *
 * @author Luan Schons Griebler <luan@twizer.com.br>
 * @license MIT
 * @see https://github.com/Luan1Schons/cinnamon-essentials-backgrounds
 *
 * Utility:
 *   downloadImage(url, destPath, callback) → downloads url to destPath
 */

const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// ---------- HTTP helpers ----------

let _soupSession = null;

function _getSession() {
    if (!_soupSession) {
        _soupSession = new Soup.Session();
        _soupSession.timeout = 30;
    }
    return _soupSession;
}

/**
 * Perform a GET request and return the response body as string.
 * @param {string} url
 * @param {Object} headers - optional extra headers { key: value }
 * @param {Function} callback - (error, responseText)
 */
function httpGet(url, headers, callback) {
    let session = _getSession();
    let message = Soup.Message.new("GET", url);

    if (headers) {
        for (let key in headers) {
            message.request_headers.append(key, headers[key]);
        }
    }

    session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
        try {
            let bytes = session.send_and_read_finish(result);
            if (message.get_status() !== Soup.Status.OK) {
                callback(new Error("HTTP " + message.get_status()), null);
                return;
            }
            let decoder = new TextDecoder("utf-8");
            let text = decoder.decode(bytes.get_data());
            callback(null, text);
        } catch (e) {
            callback(e, null);
        }
    });
}

/**
 * Download a file from a URL and save it to destPath.
 * @param {string} url
 * @param {string} destPath - absolute file path
 * @param {Function} callback - (error, destPath)
 */
function downloadImage(url, destPath, callback) {
    let session = _getSession();
    let message = Soup.Message.new("GET", url);

    session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
        try {
            let bytes = session.send_and_read_finish(result);
            if (message.get_status() !== Soup.Status.OK) {
                callback(new Error("Download failed: HTTP " + message.get_status()), null);
                return;
            }

            let file = Gio.File.new_for_path(destPath);
            let parentDir = file.get_parent();
            if (parentDir && !parentDir.query_exists(null)) {
                parentDir.make_directory_with_parents(null);
            }

            let outputStream = file.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            outputStream.write_bytes(bytes.get_data(), null);
            outputStream.close(null);

            callback(null, destPath);
        } catch (e) {
            callback(e, null);
        }
    });
}

// ---------- Bing Provider ----------

var BingProvider = class BingProvider {
    constructor() {
        this.name = "Bing Daily";
        this._baseUrl = "https://www.bing.com";
        this._apiUrl = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=en-US";
        this._lastIndex = -1;
    }

    fetchWallpaper(callback) {
        httpGet(this._apiUrl, null, (error, responseText) => {
            if (error) {
                callback(error, null);
                return;
            }

            try {
                let data = JSON.parse(responseText);
                if (!data.images || data.images.length === 0) {
                    callback(new Error("No images returned from Bing"), null);
                    return;
                }

                // Pick a random image from the available ones (up to 8 days)
                this._lastIndex = (this._lastIndex + 1) % data.images.length;
                let img = data.images[this._lastIndex];

                let imageUrl = this._baseUrl + img.url;
                // Get UHD version if available
                imageUrl = imageUrl.replace("1920x1080", "UHD");

                let title = img.title || "Bing Daily Wallpaper";
                let credits = img.copyright || "";
                let filename = img.hsh
                    ? "bing_" + img.hsh + ".jpg"
                    : "bing_" + img.startdate + ".jpg";

                callback(null, {
                    url: imageUrl,
                    title: title,
                    credits: credits,
                    filename: filename
                });
            } catch (e) {
                callback(e, null);
            }
        });
    }
};

// ---------- Unsplash Provider ----------

var UnsplashProvider = class UnsplashProvider {
    constructor(apiKey, query) {
        this.name = "Unsplash";
        this._apiKey = apiKey || "";
        this._query = query || "nature,landscape";
        this._apiUrl = "https://api.unsplash.com/photos/random";
    }

    setApiKey(key) {
        this._apiKey = key;
    }

    setQuery(query) {
        this._query = query;
    }

    fetchWallpaper(callback) {
        if (!this._apiKey) {
            callback(new Error("Unsplash API key is required. Get one at unsplash.com/developers"), null);
            return;
        }

        let url = this._apiUrl + "?query=" + encodeURIComponent(this._query) + "&orientation=landscape";

        let headers = {
            "Authorization": "Client-ID " + this._apiKey
        };

        httpGet(url, headers, (error, responseText) => {
            if (error) {
                callback(error, null);
                return;
            }

            try {
                let data = JSON.parse(responseText);

                let imageUrl = "";
                if (data.urls) {
                    if (data.urls.raw) {
                        // raw URL uses Imgix — append params for max quality
                        let sep = data.urls.raw.indexOf("?") !== -1 ? "&" : "?";
                        imageUrl = data.urls.raw + sep + "w=3840&h=2160&fit=max&q=100&fm=jpg";
                    } else if (data.urls.full) {
                        imageUrl = data.urls.full;
                    } else if (data.urls.regular) {
                        imageUrl = data.urls.regular;
                    }
                }

                if (!imageUrl) {
                    callback(new Error("No image URL in Unsplash response"), null);
                    return;
                }

                let photographer = (data.user && data.user.name) || "Unknown";
                let title = data.description || data.alt_description || "Unsplash Photo";
                let credits = "Photo by " + photographer + " on Unsplash";
                let filename = "unsplash_" + data.id + ".jpg";

                callback(null, {
                    url: imageUrl,
                    title: title,
                    credits: credits,
                    filename: filename
                });
            } catch (e) {
                callback(e, null);
            }
        });
    }
};

// ---------- Wallhaven Provider ----------

var WallhavenProvider = class WallhavenProvider {
    constructor() {
        this.name = "Wallhaven";
        this._apiUrl = "https://wallhaven.cc/api/v1/search";
    }

    fetchWallpaper(callback) {
        // categories=100 = General only, purity=100 = SFW only
        let url = this._apiUrl + "?sorting=random&categories=100&purity=100&atleast=1920x1080&ratios=16x9,16x10";

        httpGet(url, null, (error, responseText) => {
            if (error) {
                callback(error, null);
                return;
            }

            try {
                let data = JSON.parse(responseText);
                if (!data.data || data.data.length === 0) {
                    callback(new Error("No images returned from Wallhaven"), null);
                    return;
                }

                // Pick a random image from results
                let idx = Math.floor(Math.random() * data.data.length);
                let img = data.data[idx];

                let imageUrl = img.path || "";
                if (!imageUrl) {
                    callback(new Error("No image URL in Wallhaven response"), null);
                    return;
                }

                let resolution = img.resolution || "";
                let category = img.category || "";
                let title = "Wallhaven — " + resolution;
                let credits = "Source: wallhaven.cc | ID: " + img.id;
                let ext = imageUrl.split(".").pop() || "jpg";
                let filename = "wallhaven_" + img.id + "." + ext;

                callback(null, {
                    url: imageUrl,
                    title: title,
                    credits: credits,
                    filename: filename
                });
            } catch (e) {
                callback(e, null);
            }
        });
    }
};

// ---------- NASA APOD Provider ----------

var NasaApodProvider = class NasaApodProvider {
    constructor() {
        this.name = "NASA APOD";
        // DEMO_KEY works without registration (30 req/hour)
        this._apiUrl = "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&count=5&thumbs=true";
    }

    fetchWallpaper(callback) {
        httpGet(this._apiUrl, null, (error, responseText) => {
            if (error) {
                callback(error, null);
                return;
            }

            try {
                let data = JSON.parse(responseText);
                if (!Array.isArray(data) || data.length === 0) {
                    callback(new Error("No images returned from NASA APOD"), null);
                    return;
                }

                // Filter to only images (not videos)
                let images = data.filter(item => item.media_type === "image");
                if (images.length === 0) {
                    // If all are videos, try to use a thumbnail
                    let withThumb = data.filter(item => item.thumbnail_url);
                    if (withThumb.length > 0) {
                        images = withThumb;
                        images.forEach(item => { item.hdurl = item.thumbnail_url; });
                    } else {
                        callback(new Error("No image results from NASA APOD"), null);
                        return;
                    }
                }

                let idx = Math.floor(Math.random() * images.length);
                let img = images[idx];

                let imageUrl = img.hdurl || img.url || "";
                if (!imageUrl) {
                    callback(new Error("No image URL in NASA APOD response"), null);
                    return;
                }

                let title = img.title || "NASA Astronomy Picture of the Day";
                let credits = img.copyright ? "© " + img.copyright.trim() : "NASA APOD";
                let dateStr = img.date || "unknown";
                let ext = imageUrl.split(".").pop().split("?")[0] || "jpg";
                let filename = "nasa_" + dateStr + "." + ext;

                callback(null, {
                    url: imageUrl,
                    title: title,
                    credits: credits,
                    filename: filename
                });
            } catch (e) {
                callback(e, null);
            }
        });
    }
};

// ---------- Picsum Provider ----------

var PicsumProvider = class PicsumProvider {
    constructor() {
        this.name = "Picsum";
        this._infoUrl = "https://picsum.photos/v2/list?limit=30&page=";
    }

    fetchWallpaper(callback) {
        // Pick a random page (picsum has thousands of photos)
        let page = Math.floor(Math.random() * 30) + 1;
        let url = this._infoUrl + page;

        httpGet(url, null, (error, responseText) => {
            if (error) {
                callback(error, null);
                return;
            }

            try {
                let data = JSON.parse(responseText);
                if (!Array.isArray(data) || data.length === 0) {
                    callback(new Error("No images returned from Picsum"), null);
                    return;
                }

                let idx = Math.floor(Math.random() * data.length);
                let img = data[idx];

                // Build direct download URL at 3840x2160
                let imageUrl = "https://picsum.photos/id/" + img.id + "/3840/2160";

                let title = "Photo by " + (img.author || "Unknown");
                let credits = img.author || "Picsum";
                let filename = "picsum_" + img.id + ".jpg";

                callback(null, {
                    url: imageUrl,
                    title: title,
                    credits: credits,
                    filename: filename
                });
            } catch (e) {
                callback(e, null);
            }
        });
    }
};
