const Soup = imports.gi.Soup;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

/**
 * OctoPrint manager
 */
function OctoPrint(octoprint_url, octoprint_api_key) {
	this._init(octoprint_url, octoprint_api_key);
}

OctoPrint.prototype = {
	_init: function(octoprint_url, octoprint_api_key) {
        this.octoprint_url = octoprint_url;
        this.octoprint_api_key = octoprint_api_key;
        this._httpSession = new Soup.Session()
    },

    pause: function() {
        this._sendSoupMessage('POST', this.octoprint_url + "api/job", '{"command":"pause","action":"pause"}', null);
    },

    continue: function() {
        this._sendSoupMessage('POST', this.octoprint_url + "api/job", '{"command":"pause","action":"resume"}', null);
    },

    changeFilament: function() {
    	global.log("Change filament");
    },

    restartOctoPrint: function() {
        this._sendSoupMessage('POST', this.octoprint_url + "api/system/commands/core/restart", null, null);
    },

    shutdownOctoPrint: function() {
        this._sendSoupMessage('POST', this.octoprint_url + "api/system/commands/core/shutdown", null, null);
    },

    getJobStatus: function(callback) {
        this._sendSoupMessage('GET', this.octoprint_url + "api/job", null, callback);
    },

    getPrinterStatus: function(callback) {
        this._sendSoupMessage('GET', this.octoprint_url + "api/printer", null, callback);
    },

    _sendSoupMessage: function(message_type, message_url, post_params, callback) {
        let message = Soup.Message.new(message_type, message_url);
        if (Soup.MAJOR_VERSION === 2) {
            if (post_params) {
                message.set_request('application/json', 2, post_params, post_params.length);
            }
            message.request_headers.append('X-Api-Key', this.octoprint_api_key);

            this._httpSession.queue_message(message, (session, response) => {
                if (callback) {
                    if( response.status_code === 200 ) {
                        callback(JSON.parse(response.response_body.data));
                    } else {
                        callback(null);
                    }
                }
            });
        } else { //version 3
            if (post_params) {
                const bytes = GLib.Bytes.new(ByteArray.fromString(post_params));
                message.set_request_body_from_bytes('application/json', bytes);
            }
            message.get_request_headers().append('X-Api-Key', this.octoprint_api_key);
        
            this._httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, (session, response) => {
                if (callback) {
                    if( message.get_status() === 200 ) {
                        const bytes = this._httpSession.send_and_read_finish(response);
                        callback(JSON.parse(ByteArray.toString(bytes.get_data())));
                    } else {
                        callback(null);
                    }
                }
            });
        }
    }

}
