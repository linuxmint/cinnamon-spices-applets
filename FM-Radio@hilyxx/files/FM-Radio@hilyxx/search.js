// === IMPORTS & CONSTANTS ===
const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext;

const UUID = "FM-Radio@hilyxx";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

// Session initialization compatibility
const _httpSession = Soup.SessionAsync ? new Soup.SessionAsync() : new Soup.Session();

function findStations(keyword, callback) {
    if (!keyword || keyword.trim() === "") {
        if (callback) callback(_("Please enter a radio station name to search for."));
        return;
    }

    global.log("FM Radio : API Search for -> " + keyword);
    let encodedQuery = encodeURIComponent(keyword.trim());
    let url = "https://de1.api.radio-browser.info/json/stations/byname/" + encodedQuery;
    //let url = "https://all.api.radio-browser.info/json/stations/byname/" + encodedQuery; //Alt API

    let message = Soup.Message.new('GET', url);

    // Internal function to format the response and send it to the widget
    let handleResponse = (status, data) => {
        if (status === 200) {
            try {
                let json = JSON.parse(data);
                let formattedText = "";
                let maxResults = Math.min(json.length, 20);
                
                let listResults = [];
                let fullData = [];

                if (maxResults > 0) {
                    for (let i = 0; i < maxResults; i++) {
                        let originalName = json[i].name.trim() || _("Unknown Station");
                        let originalUrl = json[i].url_resolved;
                        
                        let codec = json[i].codec || "";
                        let bitrate = json[i].bitrate ? json[i].bitrate + " kbps" : "";
                        let quality = (codec + " " + bitrate).trim();

                        let displayName = originalName;
                        const MAX_NAME_LENGTH = 65;
                        if (displayName.length > MAX_NAME_LENGTH) {
                            displayName = displayName.substring(0, MAX_NAME_LENGTH - 3) + "...";
                        }

                        fullData.push({
                            name: originalName,
                            url: originalUrl
                        });

                        listResults.push({
                            "select": false,
                            "name": displayName,
                            "quality": quality,
                            "url": originalUrl,
                            "pic": ""
                        });
                    }
                }
                
                if (callback) callback(listResults, fullData);

            } catch (e) {
                global.logError("FM Radio: Error Reading JSON : " + e);
                if (callback) callback("Error reading API data.");
            }
        } else {
            global.logError("FM Radio : API Error (" + status + ")");
            if (callback) callback("Unable to connect to the API.");
        }
    };

    // Check Soup version
    if (typeof _httpSession.send_and_read_async !== 'undefined') {
        // Mode Soup 3 (Mint 21.3+)
        _httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            try {
                let bytes = session.send_and_read_finish(result);
                let data = ByteArray.toString(bytes.get_data ? bytes.get_data() : bytes.toArray());
                handleResponse(message.get_status(), data);
            } catch (e) {
                global.logError("FM Radio: Soup 3 request error: " + e);
            }
        });
    } else {
        // Mode Soup 2.4 (Old Mint versions)
        _httpSession.queue_message(message, (session, msg) => {
            handleResponse(msg.status_code, msg.response_body.data);
        });
    }
}
