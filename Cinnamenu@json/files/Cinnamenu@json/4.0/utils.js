const SEARCH_DEBUG = false;
const Gettext = imports.gettext;

function _(str) {
    let cinnamonTranslation = Gettext.gettext(str);
    if (cinnamonTranslation !== str) {
        return cinnamonTranslation;
    }
    return Gettext.dgettext('Cinnamenu@json', str);
}

const ApplicationType = {
    _applications: 0,
    _places: 1,
    _recent: 2,
    _providers: 3,
};
const AppTypes = Object.keys(ApplicationType);

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

class ShowTooltip {
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

const searchStr = function (q, str) {
    const highlightMatch = true;
    if ( !(typeof q === 'string' && q && typeof str === 'string' && str) ) {
        return { score: 0, result: str };
    }

    const str2 = latinise(str.toLowerCase());
    const q2 = q; //latinise(q.toLowerCase()); //already done in doSearch()
    let score = 0;
    if ((new RegExp('\\b'+q2)).test(str2)) { //match substring from beginning of words
        score = 1.2;
    } else if (str2.indexOf(q2) !== -1) { //else match substring
        score = 1.1;
    } else { //else fuzzy match and return
        const qletters = q2; //q2.replace(/\W/g, ''); //remove anything that isn't a letter from query
        //find longest substring of str2 made up of letters from qletters
        const found = str2.match(new RegExp('[' + q2 + ']+','g'));
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
            let bigrams_score;
            if (qletters.length >= 2) {
                const max_bigrams = qletters.length -1;
                let found_bigrams = 0;
                for (let qi = 0; qi < max_bigrams; qi++ ) {
                    if (longest.indexOf(qletters[qi] + qletters[qi+1]) >= 0) {
                        found_bigrams++;
                    }
                }
                found_bigrams++; //free boost.
                bigrams_score = Math.min(found_bigrams / max_bigrams, 1);
            } else {
                bigrams_score = 1;
            }

            let markup = '';
            if (highlightMatch) { //highlight match
                const foundposition = str2.indexOf(longest);
                markup = str.slice(0, foundposition) + '<b>' +
                            str.slice(foundposition, foundposition + longest.length) + '</b>' +
                                                str.slice(foundposition + longest.length, str.length);
            } else {
                markup = str;
            }
            let score = Math.min(longest.length / q2.length, 1.0) * bigrams_score;
            if (SEARCH_DEBUG) {
                markup += ':'+score+':'+bigrams_score;
            }
            return {score: score, result: markup};
        } else {
            return {score: 0, result: ''};
        }
    }
    //return result of substring match
    if (highlightMatch) {
        const foundposition = str2.indexOf(q2);
        const markup = str.slice(0, foundposition) + '<b>' +
                                    str.slice(foundposition, foundposition + q.length) + '</b>' +
                                                    str.slice(foundposition + q.length, str.length);
        return {score: score, result: markup};
    } else {
        return {score: score, result: str};
    }
};

module.exports = {SEARCH_DEBUG, _, ApplicationType, AppTypes, tryFn, readFileAsync, readJSONAsync,
                                                                            ShowTooltip, searchStr};
