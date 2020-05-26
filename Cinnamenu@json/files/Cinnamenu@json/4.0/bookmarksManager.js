
const { ApplicationType } = require('./constants');
const { readChromiumBookmarks, readFirefoxProfiles } = require('./browserBookmarks');

class BookmarksManager {
    constructor(appSystem) {
        let bookmarks = [];
        this.arrKeys = [];
        this.state = {};
        Promise.all([
            readChromiumBookmarks(bookmarks, ['chromium', 'Default', 'Bookmarks'], 'chromium-browser', appSystem),
            readChromiumBookmarks(bookmarks, ['google-chrome', 'Default', 'Bookmarks'], 'google-chrome', appSystem),
            readChromiumBookmarks(bookmarks, ['.config', 'opera', 'Bookmarks'], 'opera', appSystem)
        ]).then(() => {
            bookmarks = bookmarks.concat(readFirefoxProfiles(appSystem));

            for (let i = 0, len = bookmarks.length; i < len; i++) {
                bookmarks[i].icon = bookmarks[i].app.get_icon();
                bookmarks[i].mime = null;
                bookmarks[i].description = bookmarks[i].uri;
                bookmarks[i].type = ApplicationType._places;
            }
            // Create a unique list of bookmarks across all browsers.
            for (let i = 0, len = bookmarks.length; i < len; i++ ) {
                this.state[bookmarks[i].uri] = bookmarks[i];
            }
            this.arrKeys = Object.keys(this.state);
        }).catch((e) => global.log(e.message, e.stack));
    }
}
