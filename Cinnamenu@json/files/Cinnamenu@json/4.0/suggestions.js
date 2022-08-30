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

var last_search;

function searchSuggestions(pattern, callback) {

    function processResult(session, results, p) {
        if (p != last_search) {
            return;
        }
        try {
            let resultArray;
            if (Soup.MAJOR_VERSION === 2) {
                resultArray = JSON.parse(results.response_body.data.toString());
            } else { //version 3
                const bytes = _httpSession.send_and_read_finish(results);
                resultArray = JSON.parse(ByteArray.toString(bytes.get_data()));
            }
            resultArray[1].length = Math.min(resultArray[1].length, 5);
            callback(resultArray[1]);
        } catch(e) {
            global.logError(e);
        }
    }

    last_search = pattern;
    try {
        //const message = Soup.Message.new('GET', 'https://ac.duckduckgo.com/ac/?q=' +
        //                                                encodeURIComponent(pattern) + '&type=list');
        const message = Soup.Message.new('GET',
            'http://suggestqueries.google.com/complete/search?output=firefox&q=' + encodeURIComponent(pattern));
        if (Soup.MAJOR_VERSION === 2) {
            _httpSession.queue_message(message, (...args) => processResult(...args, pattern));
        } else { //version 3
            _httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null,
                                                        (...args) => processResult(...args, pattern));
        }
    } catch(e) {
        global.logError(e);
    }
    
}

module.exports = {searchSuggestions};
