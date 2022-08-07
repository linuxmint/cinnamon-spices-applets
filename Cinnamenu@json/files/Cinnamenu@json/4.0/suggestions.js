//
const Soup = imports.gi.Soup;
const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

var last_search;

function searchSuggestions(pattern, callback) {

    function processResult(session, results, p) {
        if (p != last_search) {
            return;
        }
        if(results.status_code == 200) {
            const resultArray = JSON.parse(results.response_body.data.toString());
            resultArray[1].length = Math.min(resultArray[1].length, 5);
            callback(resultArray[1]);
        } else {
            global.logWarning('Error retrieving address ' + url + '. Status: ' +
                                        resultPages.status_code + ': ' + resultPages.reason_phrase);
        }
    }

    try {
        last_search = pattern;
        //const message = Soup.Message.new('GET', 'https://ac.duckduckgo.com/ac/?q=' +
        //                                                encodeURIComponent(pattern) + '&type=list');
        const message = Soup.Message.new('GET',
                'http://suggestqueries.google.com/complete/search?output=firefox&q=' + encodeURIComponent(pattern));
        _httpSession.queue_message(message, (...args) => processResult(...args, pattern));
    } catch(e) {
        global.logError(e);
    }
}

module.exports = {searchSuggestions};
