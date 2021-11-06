const Soup = imports.gi.Soup

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
        let message = Soup.Message.new('POST', this.octoprint_url + "api/job");
        let postParams = '{"command":"pause","action":"pause"}';
        message.set_request('application/json', 2, postParams, postParams.length);
        message.request_headers.append('X-Api-Key', this.octoprint_api_key);

        this._httpSession.queue_message(message, function soupQueue(session, message) {
        });
    },

    continue: function() {
        let message = Soup.Message.new('POST', this.octoprint_url + "api/job");
        let postParams = '{"command":"pause","action":"resume"}';
        message.set_request('application/json', 2, postParams, postParams.length);
        message.request_headers.append('X-Api-Key', this.octoprint_api_key);

        this._httpSession.queue_message(message, function soupQueue(session, message) {
        });
    },

    changeFilament: function() {
    	global.log("Change filament");
    },

    restartOctoPrint: function() {
        let message = Soup.Message.new('POST', this.octoprint_url + "api/system/commands/core/restart");
        message.request_headers.append('X-Api-Key', this.octoprint_api_key);

        this._httpSession.queue_message(message, function soupQueue(session, message) {
        });
    },

    shutdownOctoPrint: function() {
        let message = Soup.Message.new('POST', this.octoprint_url + "api/system/commands/core/shutdown");
        message.request_headers.append('X-Api-Key', this.octoprint_api_key);

        this._httpSession.queue_message(message, function soupQueue(session, message) {
        });
    },

    getJobStatus: function(callback) {
        let message = Soup.Message.new('GET', this.octoprint_url + "api/job");
        message.request_headers.append('X-Api-Key', this.octoprint_api_key);

        this._httpSession
        this._httpSession.queue_message(message, function soupQueue(session, message) {
            if( message.status_code == 200 ) {
                callback(JSON.parse(message.response_body.data));
            } else {
                callback(null);
            }
        });
    },

    getPrinterStatus: function(callback) {
        let message = Soup.Message.new('GET', this.octoprint_url + "api/printer");
        message.request_headers.append('X-Api-Key', this.octoprint_api_key);

        this._httpSession
        this._httpSession.queue_message(message, function soupQueue(session, message) {
            if( message.status_code == 200 ) {
                callback(JSON.parse(message.response_body.data));
            } else {
                callback(null);
            }
        });
    }

}
