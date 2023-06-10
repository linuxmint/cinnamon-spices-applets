const {log} = require("./utils");

//
const ByteArray = imports.byteArray;

const Soup = imports.gi.Soup;
let _httpSession;
if (Soup.MAJOR_VERSION == 2) {
    _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
} else if (Soup.MAJOR_VERSION == 3) {
    _httpSession = new Soup.Session();
}

const GOOGLE = false;
var message;

function searchSuggestions(pattern, callback) {

    function processResult(session, results) {
        try {
            let resultArray;
            if (Soup.MAJOR_VERSION === 2) {
                if (!results.response_body.data) { //request cancelled
                    return;
                }
                resultArray = JSON.parse(results.response_body.data.toString());
            } else { //version 3
                const bytes = _httpSession.send_and_read_finish(results);
                resultArray = JSON.parse(ByteArray.toString(bytes.get_data()));
            }
            if (GOOGLE) {
                resultArray[1].length = Math.min(resultArray[1].length, 5);
                callback(resultArray[1]);
            } else {
                const results = [];
                resultArray.forEach( result => {
                    results.push(result['phrase']);
                })
                results.length = Math.min(results.length, 6);
                callback(results);
            }
        } catch(e) {
            global.logError(e);
        }
    }

    try {
        if (Soup.MAJOR_VERSION === 2) {
            if (message) { //Cancel previous message in case it's still active
                _httpSession.cancel_message(message, Soup.Status.CANCELLED);
            }
        }

        if (GOOGLE) {
            message = Soup.Message.new('GET',
                'http://suggestqueries.google.com/complete/search?output=firefox&q=' + encodeURIComponent(pattern));
        } else {
            message = Soup.Message.new('GET',
                'https://ac.duckduckgo.com/ac/?q=' + encodeURIComponent(pattern) + '&t=Cinnamenu');
        }
        if (Soup.MAJOR_VERSION === 2) {
            _httpSession.queue_message(message, (...args) => processResult(...args));
        } else { //version 3
            _httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null,
                                                        (...args) => processResult(...args));
        }
    } catch(e) {
        global.logError(e);
    }
    
}

module.exports = {searchSuggestions};
