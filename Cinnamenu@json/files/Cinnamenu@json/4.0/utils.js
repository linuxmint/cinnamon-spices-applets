const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const ByteArray = imports.byteArray;
const Cinnamon = imports.gi.Cinnamon;
const {escapeRegExp} = imports.misc.util;
Gettext.bindtextdomain('Cinnamenu@json', GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
    let cinnamonTranslation = Gettext.gettext(str);
    if (cinnamonTranslation !== str) {
        return cinnamonTranslation;
    }
    return Gettext.dgettext('Cinnamenu@json', str);
}

const wordWrap = text => text.match( /.{1,80}(\s|$|-|=|\+|_|&|\\)|\S+?(\s|$|-|=|\+|_|&|\\)/g ).join('\n');

const graphemeBaseChars = s => //decompose and remove discritics.
                s.normalize('NFKD').replace(/[\u0300-\u036f]/g, "");

//===========================================================

const getThumbnail_gicon = (uri, mimeType) => {
    //Note: this function doesn't check if thumbnail is up to date.
    const file = Gio.File.new_for_uri(uri);
    if (!file.query_exists(null)) {//check because it's possible for isFavoriteFile's to not exist.
        return null;
    }
    //
    const isImage = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/tiff', 'image/bmp',
                                                                'image/gif'].includes(mimeType);
    const fileSize = file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size();

    //----Get thumbnail from cache
    if (!(isImage && fileSize < 50000)) {//Don't bother with thumbnail cache if file is a
                            //small image, quicker to just create icon from file itself and avoids
                            //possible out of date cached thumbnail.
        const ba = ByteArray.fromString(uri, 'UTF-8');
        const md5 = GLib.Checksum.new(GLib.ChecksumType.MD5);
        md5.update(ba);
        const thumbDir = GLib.get_user_cache_dir() + '/thumbnails/';
        const thumbName = md5.get_string() + '.png';
        const thumbPathNormal = thumbDir + 'normal/' + thumbName;
        const thumbPathLarge = thumbDir + 'large/' + thumbName;
        if (GLib.file_test(thumbPathNormal, GLib.FileTest.EXISTS)) {
            return new Gio.FileIcon({ file: Gio.file_new_for_path(thumbPathNormal) });
        }
        if (GLib.file_test(thumbPathLarge, GLib.FileTest.EXISTS)) {
            return new Gio.FileIcon({ file: Gio.file_new_for_path(thumbPathLarge) });
        }
    }

    //----No cached thumbnail available so make icon from image.
    if (isImage && fileSize < 30000000) {//don't read image files > 30MB
        return new Gio.FileIcon({ file: file });
    }

    //----No thumbnail
    return null;
};

//============================================================

let onlyOneTooltip = null;
const showTooltip = (actor, xpos, ypos, center_x, text) => {
    if (onlyOneTooltip) {
        global.logWarning("Cinnamenu: Previous tooltip still exists...removing...");
        onlyOneTooltip.destroy();
        onlyOneTooltip = null;
    }
    onlyOneTooltip = new NewTooltip (actor, xpos, ypos, center_x, text);
};

const hideTooltipIfVisible = () => {
    if (onlyOneTooltip) {
        onlyOneTooltip.destroy();
        onlyOneTooltip = null;
    }
};

class NewTooltip {
    constructor(actor, xpos, ypos, center_x /*boolean*/, text) {
        //if center_x then tooltip should be centered on xpos
        this.actor = actor;
        this.xpos = xpos;
        this.ypos = ypos;
        this.center_x = center_x;
        this.text = text;
        if (this.text && this.text !== '') {
            this.showTimer = Mainloop.timeout_add(250, Lang.bind(this, this.show));
        }
    }

    show() {
        this.showTimer = null;

        this.tooltip = new St.Label({
            name: 'Tooltip'
        });
        this.tooltip.show_on_set_parent = false;
        Main.uiGroup.add_actor(this.tooltip);
        this.tooltip.set_text(this.text);
        this.tooltip.get_clutter_text().set_use_markup(true);
        this.tooltip.set_style('text-align: left;');

        let tooltipWidth = this.tooltip.get_allocation_box().x2 - this.tooltip.get_allocation_box().x1;
        let monitor = Main.layoutManager.findMonitorForActor(this.actor);
        let tooltipLeft = this.xpos;
        if (this.center_x) {
            tooltipLeft -= Math.floor(tooltipWidth / 3);
        }
        tooltipLeft = Math.max(tooltipLeft, monitor.x);
        tooltipLeft = Math.min(tooltipLeft, monitor.x + monitor.width - tooltipWidth);

        this.tooltip.set_position(tooltipLeft, this.ypos);
        this.tooltip.raise_top();
        this.tooltip.show();
    }

    destroy() {
        if (this.showTimer) {
            Mainloop.source_remove(this.showTimer);
            this.showTimer = null;
        }
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
    }
}

//===================================================

const searchStr = (q, str, noFuzzySearch = false, noSubStringSearch = false) => {
    if (!str) {
        return { score: 0, result: str };
    }

    const HIGHTLIGHT_MATCH = true;
    let foundPosition = 0;
    let foundLength = 0;
    const str2 = graphemeBaseChars(str).toLocaleUpperCase();
    //q is already graphemeBaseChars() in _doSearch()
    let score = 0, bigrams_score = 0;

    if (new RegExp('\\b'+escapeRegExp(q)).test(str2)) { //match substring from beginning of words
        foundPosition = str2.indexOf(q);
        score = (foundPosition === 0) ? 1.21 : 1.2;//slightly higher score if from beginning
        foundLength = q.length;
    } else if (!noSubStringSearch && str2.indexOf(q) !== -1) { //else match substring
        score = 1.1;
        foundPosition = str2.indexOf(q);
        foundLength = q.length;
    } else if (!noFuzzySearch){ //else fuzzy match
        //find longest substring of str2 made up of letters from q
        const found = str2.match(new RegExp('[' + q + ']+','g'));
        let length = 0;
        let longest;
        if (found) {
            for(let i=0; i < found.length; i++){
                if(found[i].length > length){
                    length = found[i].length;
                    longest = found[i];
                }
            }
        }
        if (longest) {
            //get a score for similarity by counting 2 letter pairs (bigrams) that match
            if (q.length >= 2) {
                const max_bigrams = q.length -1;
                let found_bigrams = 0;
                for (let qi = 0; qi < max_bigrams; qi++ ) {
                    if (longest.indexOf(q[qi] + q[qi + 1]) >= 0) {
                        found_bigrams++;
                    }
                }
                bigrams_score = Math.min(found_bigrams / max_bigrams, 1);
            } else {
                bigrams_score = 1;
            }

            foundPosition = str2.indexOf(longest);
            foundLength = longest.length;
            //return a fuzzy match score of between 0 and 1.
            score = Math.min(longest.length / q.length, 1.0) * bigrams_score;
        }
    }
    //return result of match
    if (HIGHTLIGHT_MATCH && score > 0) {
        let markup = str.slice(0, foundPosition) + '<b>' +
                                    str.slice(foundPosition, foundPosition + foundLength) + '</b>' +
                                                    str.slice(foundPosition + foundLength, str.length);
        return {score: score, result: markup};
    } else {
        return {score: score, result: str};
    }
};

const getChromiumProfileDirs = function() {
    //Find profile dirs of various chromium based browsers
    const appSystem = Cinnamon.AppSystem.get_default();
    const folders = [];
    [
        [['chromium'], 'chromium'],
        [['google-chrome'], 'google-chrome'],
        [['opera'], 'opera'],
        [['vivaldi'], 'vivaldi-stable'],
        [['BraveSoftware', 'Brave-Browser'], 'brave-browser'],
        [['microsoft-edge'], 'microsoft-edge']
    ].forEach( browser => {
        const path = browser[0];
        const wmClass = browser[1];

        const foundApps = appSystem.lookup_desktop_wmclass(wmClass);
        if (!foundApps || foundApps.length === 0) {
            return; //browser not installed
        }
        const appInfo = foundApps.get_app_info();

        const addFolderIfExists = function(subfolder) {
            const bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev(
                                        [GLib.get_user_config_dir(), ...path, subfolder, 'Bookmarks']));
            if (bookmarksFile.query_exists(null)) {
                folders.push([path.concat(subfolder), appInfo]);
            }
        };

        addFolderIfExists(''); //i.e. no subfolder
        addFolderIfExists('Default');
        for (let i = 1; i<10; i++) {
            addFolderIfExists('Profile ' + i);
        }
    });

    return folders;
};


module.exports = {  _,
                    wordWrap,
                    graphemeBaseChars,
                    getThumbnail_gicon,
                    showTooltip,
                    hideTooltipIfVisible,
                    searchStr,
                    getChromiumProfileDirs
                 };
