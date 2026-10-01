//
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;

const Soup = imports.gi.Soup;
let _httpSession;
if (Soup.MAJOR_VERSION == 2) {
    _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
} else if (Soup.MAJOR_VERSION == 3) {
    _httpSession = new Soup.Session();
}

let last_search;

const wikipedia_icon_file = Gio.file_new_for_path('/usr/share/icons/Mint-Y/apps/64/wikipedia.png');
const wikipedia_gicon = new Gio.FileIcon({ file: wikipedia_icon_file });

class Cache {
    constructor() {
        this.results_cache = [];
    }

    add(entry) {
        this.results_cache.unshift(entry);
        if (this.results_cache.length > 10) {
            this.results_cache.length = 10;
        }
    }

    retrieve(pattern) {
        const found = this.results_cache.find(entry => entry.pattern === pattern);
        if (found) {
            return found.results;
        }
        return null;
    }

    clear() {
        this.results_cache = [];
    }
}

const cache = new Cache();

function wikiSearch(pattern, langCode, callback) {
    function returnResults(results){
        results.forEach(result => result.gicon = wikipedia_gicon);
        callback(results);
    }

    function processPages(session, resultPages, p) {
        if (p != last_search) {
            return;
        }
        try {
            const message = Soup.Message.new('GET',
                'https://'+langCode+'.wikipedia.org/w/api.php?action=query&generator=prefixsearch&gpssearch=' +
                encodeURIComponent(pattern) +
                '&prop=extracts&exintro=1&exchars=1000&explaintext=1&redirects=1&gpslimit=4&format=json');
            if (Soup.MAJOR_VERSION === 2) {
                _httpSession.queue_message(message, (...args) => processContent(...args, resultPages, p));
            } else { //version 3
                _httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null,
                                            (...args) => processContent(...args, resultPages, p));
            }
        } catch(e) {
            global.logError(e);
        }
    }

    function processContent(session, resultContent, resultPages, p) {
        try {
            if (p != last_search) {
                return;
            }
            
            let pageResults, extracts;
            if (Soup.MAJOR_VERSION === 2) {
                pageResults = JSON.parse(resultPages.response_body.data.toString());
                extracts = JSON.parse(resultContent.response_body.data.toString());
            } else { //version 3
                const bytes = _httpSession.send_and_read_finish(resultPages);
                pageResults = JSON.parse(ByteArray.toString(bytes.get_data()));
                const bytes2 = _httpSession.send_and_read_finish(resultContent);
                extracts = JSON.parse(ByteArray.toString(bytes2.get_data()));
            }
            const result_titles = pageResults[1];
            const result_urls = pageResults[3];

            const cacheEntry = {pattern: p, results: []};
            for (let i = 0; i < result_urls.length; i++) {
                cacheEntry.results.push({
                    name: result_titles[i],
                    url: result_urls[i],
                    description: _getDescription(i + 1, extracts),
                    activate: () => Util.spawn(['xdg-open', result_urls[i]]),
                    isSearchResult: true
                });
            }

            cache.add(cacheEntry);
            returnResults(cacheEntry.results);
        } catch(e) {
            global.logError(e);
        }
    }

    try {
        const results = cache.retrieve(pattern);
        if (results) {
            last_search = '';
            returnResults(results);
        } else {
            last_search = pattern;
            const message = Soup.Message.new('GET',
                                    'https://'+langCode+'.wikipedia.org/w/api.php?action=opensearch&search=' +
                                    encodeURIComponent(pattern) + '&format=json&limit=4');
            if (Soup.MAJOR_VERSION === 2) {
                _httpSession.queue_message(message, (...args) => processPages(...args, pattern));
            } else { //version 3
                _httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null,
                                            (...args) => processPages(...args, pattern));
            }
        }
    } catch(e) {
        global.logError(e);
    }
}

function _getDescription(index, descriptions) {
    try {
        const items = descriptions.query.pages;
        for (const item in items) {
            if (items[item].index === index) {
                return items[item].extract;
            }
        }
    } catch(e) {
        global.logError(e);
    }
    return 'No description available';
}

function clearWikiSearchCache() {
    cache.clear();
}

module.exports = {wikiSearch, clearWikiSearchCache};
