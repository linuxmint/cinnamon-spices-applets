const SEARCH_DEBUG = false;
const Gettext = imports.gettext;

function _(str) {
    let cinnamonTranslation = Gettext.gettext(str);
    if (cinnamonTranslation !== str) {
        return cinnamonTranslation;
    }
    return Gettext.dgettext('Cinnamenu@json', str);
}

const APPTYPE = {
    application: 0,
    place: 1,
    file: 2,
    provider: 3,
    clearlist_button: 4
};

// Work around Cinnamon#8201
const tryFn = function(callback, errCallback) {
    try {
        return callback();
    } catch (e) {
        if (typeof errCallback === 'function') {
            return errCallback(e);
        }
    }
};

//=========================================

const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

const readFileAsync = function(file, opts = {utf8: true}) {
    const {utf8} = opts;
    return new Promise(function(resolve, reject) {
        if (typeof file === 'string' || file instanceof String) {
            file = Gio.File.new_for_path(file);
        }
        if (!file.query_exists(null)) reject(new Error('File does not exist.'));
        file.load_contents_async(null, function(object, result) {
            tryFn(() => {
                let [success, data] = file.load_contents_finish(result);
                if (!success) return reject(new Error('File cannot be read.'));
                if (utf8) {
                    if (data instanceof Uint8Array) data = ByteArray.toString(data);
                    else data = data.toString();
                }
                resolve(data);
            }, (e) => reject(e));
        });
    });
};

const readJSONAsync = function(file) {
    return readFileAsync(file).then(function(json) {
        return JSON.parse(json);
    });
};

//===========================================================

const Mainloop = imports.mainloop;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;

let onlyOneTooltip = null;
var showTooltip = (actor, xpos, ypos, center_x, text) => {
    if (onlyOneTooltip) {
        global.log("Cinnamenu: Previous tooltip still exists...removing...");
        onlyOneTooltip.destroy();
        onlyOneTooltip = null;
    }
    onlyOneTooltip = new NewTooltip (actor, xpos, ypos, center_x, text);
};

var hideTooltip = () => {
    if (onlyOneTooltip) {
        onlyOneTooltip.destroy();
        onlyOneTooltip = null;
    } else {
        global.log("Cinnamenu: Tooltip already removed.");
    }
};

class NewTooltip {
    constructor(actor, xpos, ypos, center_x, text) {
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

const {latinise} = imports.misc.util;

const searchStr = (q, str, quick = false) => {
    const HIGHTLIGHT_MATCH = true;
    if ( !(typeof q === 'string' && q && typeof str === 'string' && str) ) {
        return { score: 0, result: str };
    }
    let foundPosition = 0;
    let foundLength = 0;
    const str2 = latinise(str.toLowerCase());
    const qletters = q.replace(/[^a-zA-Z0-9_ ]/g, ''); //latinise(q.toLowerCase()); //already done in doSearch()
    if (qletters.length == 0){
        return { score: 0, result: str };
    }
    let score = 0, bigrams_score = 0;
    if (new RegExp('\\b'+qletters).test(str2)) { //match substring from beginning of words
        foundPosition = str2.indexOf(qletters);
        score = (foundPosition === 0) ? 1.21 : 1.2;//slightly higher score if from beginning
        foundLength = qletters.length;
    } else if (str2.indexOf(q) !== -1) { //else match substring
        score = 1.1;
        foundPosition = str2.indexOf(q);
        foundLength = q.length;
    } else if (!quick){ //else fuzzy match
        //find longest substring of str2 made up of letters from qletters
        const found = str2.match(new RegExp('[' + qletters + ']+','g'));
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
            if (qletters.length >= 2) {
                const max_bigrams = qletters.length -1;
                let found_bigrams = 0;
                for (let qi = 0; qi < max_bigrams; qi++ ) {
                    if (longest.indexOf(qletters[qi] + qletters[qi + 1]) >= 0) {
                        found_bigrams++;
                    }
                }
                bigrams_score = Math.min(found_bigrams / max_bigrams, 1);
            } else {
                bigrams_score = 1;
            }

            foundPosition = str2.indexOf(longest);
            foundLength = longest.length;
            score = Math.min(longest.length / qletters.length, 1.0) * bigrams_score;
            /*if (score>=0.4){
                global.log(qletters+">"+longest+" "+score+":"+bigrams_score);
            }*/
        }
    }
    //return result of match
    if (HIGHTLIGHT_MATCH && score > 0) {
        let markup = str.slice(0, foundPosition) + '<b>' +
                                    str.slice(foundPosition, foundPosition + foundLength) + '</b>' +
                                                    str.slice(foundPosition + foundLength, str.length);
        if (SEARCH_DEBUG) {
            markup += ':' + score + ':' + bigrams_score;
        }
        return {score: score, result: markup};
    } else {
        return {score: score, result: str};
    }
};

module.exports = {SEARCH_DEBUG, _, APPTYPE, tryFn, readFileAsync, readJSONAsync,
                                                            showTooltip, hideTooltip, searchStr};
