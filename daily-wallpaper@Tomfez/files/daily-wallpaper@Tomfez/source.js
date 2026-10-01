const { HttpSession } = require("./httpSession");
const { Utils } = require("./utils");

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

class Source {
    constructor(source, metaDataPath, wallpaperPath) {
        this.imageData;
        this.copyrightsAutor;
        this.copyrights;
        this.description;
        this.wallpaperDate;
        this.imageURL;
        this.filename;
        this.metaDataPath = metaDataPath;
        this.wallpaperPath = wallpaperPath;
        this.source = source;
        this.httpSession = new HttpSession();

        switch (source) {
            case "Wikimedia":
                this.host = "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/";
                break;
            case "APOD":
                this.host = "https://api.nasa.gov/planetary/apod?api_key=";
                break;
            case "Picsum Photos":
                this.host = "https://picsum.photos/v2/list?page=";
                break;
            case "Bing":
            default:
                this.host = "https://www.bing.com";
                break;
        }
    }

    callUrl(url, callback, callbackError) {
        const processPicsumResponse = finalUrl => {
            if (finalUrl === false || finalUrl === null) {
                callbackError();
            } else {
                finalUrl.download_url += url;
                const data = JSON.stringify(finalUrl, null, 2);

                this._writeMetaDataFile(data);

                this.getMetaDataLocal();
                callback();
            }
        };
        this.httpSession.fetchRandomImage(processPicsumResponse);
    }

    getMetaData(url, callback, callbackError) {
        const writeFile = data => {
            if (data === false) {
                callbackError();
            } else {
                // Write to meta data file
                this._writeMetaDataFile(data);

                this.getMetaDataLocal();
                callback();
            }
        };

        this.wallpaperDate = "";
        this.httpSession.queryMetada(this.host + url, writeFile);
    }

    getMetaDataLocal() {
        const data = GLib.file_get_contents(this.metaDataPath)[1];

        if (data.length === 0)
            return;

        const json = JSON.parse(data);

        if (this.source === "Bing") {
            this.imageData = json.images[0];

            this.copyrights = this.imageData.copyright;
            const copyrightsSplit = Utils.splitCopyrightsText(this.imageData.copyright);
            this.description = copyrightsSplit[0];
            this.copyrightsAutor = copyrightsSplit[1];

            this.imageURL = `${this.host}${this.imageData.url}`;

            const fileUrl = this.imageData.urlbase;
            const regex = "([A-Za-z]+)_";
            const matchRes = fileUrl.match(regex);
            this.filename = `${matchRes[1]}.jpg`;
        } else if (this.source === "Wikimedia") {
            this.imageData = json.image;

            if (this.imageData.length === 0) {
                Utils.showDesktopNotification(_("No image today."), "dialog-information");
                return;
            }

            this.description = this.imageData.description.text; //the description can be very long and can causes issues in the PanelMenu if too long. Maybe set a max-size on the Panel ?
            const descrCut = this.description.slice(0, 50) + (this.description.length > 50 ? "..." : "");
            this.description = descrCut;

            let title = this.imageData.title.split(":");
            title = title[1].substring(0, title[1].lastIndexOf('.')); // removes the extension in the filename
            this.copyrights = title;
            this.copyrightsAutor = this.imageData.artist.text;

            this.imageURL = this.imageData.image.source;
            const fileTitle = this.imageData.title;
            const idx = fileTitle.search(":");
            this.filename = fileTitle.slice(idx + 1);
        } else if (this.source === "APOD") {
            if (json.media_type !== "image") {
                Utils.showDesktopNotification(_("No image today."), "dialog-information");
                return;
            }

            this.description = json.title;
            this.imageURL = json.hdurl;
            this.copyrightsAutor = json.copyright === undefined ? "Nasa" : json.copyright;
            this.copyrights = json.title + this.copyrightsAutor;

            const idx = json.hdurl.lastIndexOf('/');
            const filename = json.hdurl.slice(idx + 1);
            this.filename = filename;
        } else if (this.source === "Picsum Photos") {
            this.description = "Image " + json.id;
            this.copyrightsAutor = json.author === undefined ? "Unknow autor" : json.author;
            this.imageURL = json.download_url;
            this.copyrights = this.description + " - " + this.copyrightsAutor;
        }
    }

    downloadImage(callback, callbackError) {
        const res = data => {
            if (data === false)
                callbackError();
            else
                callback();
        }

        if (this.source === "Bing") {
            const regex = /_\d+x\d+./gm;
            const urlUHD = this.imageURL.replace(regex, `_UHD.`);
            this.httpSession.downloadImageFromUrl(urlUHD, this.wallpaperPath, res);
        } else {
            this.httpSession.downloadImageFromUrl(this.imageURL, this.wallpaperPath, res);
        }
    }

    _writeMetaDataFile(data) {
        let gFile = Gio.file_new_for_path(this.metaDataPath);
        let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let toWrite = data.length;
        while (toWrite > 0)
            toWrite -= fStream.write(data, null);
        fStream.close(null);
    }

    getWallpaperDate() {
        const data = GLib.file_get_contents(this.metaDataPath)[1];
        const json = JSON.parse(data);

        if (this.source === "Bing")
            this.wallpaperDate = GLib.DateTime.new_from_iso8601(`${json.images[0].enddate}T220000Z`, null);
        else if (this.source === "APOD")
            this.wallpaperDate = GLib.DateTime.new_from_iso8601(`${json.date}T220000Z`, null);
    }
}

module.exports = { Source }