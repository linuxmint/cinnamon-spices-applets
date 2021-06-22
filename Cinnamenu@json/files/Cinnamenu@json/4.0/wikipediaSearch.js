//
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Util = imports.misc.util;
const Soup = imports.gi.Soup;
const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

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
}

const cache = new Cache();

function wikiSearch(pattern, callback) {
    function returnResults(results){
        results.forEach(result => result.gicon = wikipedia_gicon);
        callback(results);
    }

    function processPages(session, resultPages, p) {
        if (p != last_search) {
            return;
        }
        if( resultPages.status_code == 200) {
            const message = Soup.Message.new('GET',
                'https://en.wikipedia.org/w/api.php?action=query&generator=prefixsearch&gpssearch=' +
                encodeURIComponent(pattern) +
                '&prop=extracts&exintro=1&exchars=1000&explaintext=1&redirects=1&gpslimit=4&format=json');

            _httpSession.queue_message(message, (...args) => processContent(...args, resultPages, p));
        } else {
            global.logWarning('Error retrieving address ' + url + '. Status: ' +
                                        resultPages.status_code + ': ' + resultPages.reason_phrase);
        }
    }

    function processContent(session, resultContent, resultPages, p) {
        try {
            if (p != last_search) {
                return;
            }
            if(resultContent.status_code == 200) {
                const pageResults = JSON.parse(resultPages.response_body.data.toString());
                const result_titles = pageResults[1];
                const result_urls = pageResults[3];
                const extracts = JSON.parse(resultContent.response_body.data.toString());
                
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
            } else {
                global.logWarning('Error retrieving address ' + url + '. Status: ' +
                                        resultContent.status_code + ': ' + resultContent.reason_phrase);
            }
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
                                    'https://en.wikipedia.org/w/api.php?action=opensearch&search=' +
                                                encodeURIComponent(pattern) + '&format=json&limit=4');
            _httpSession.queue_message(message, (...args) => processPages(...args, pattern));
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

module.exports = {wikiSearch};
