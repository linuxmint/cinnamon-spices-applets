const Soup = imports.gi.Soup;
const session = new Soup.Session();
const Signals = imports.signals;

const SC_DIR_URL = "https://directory.shoutcast.com/";
const WORDS = "loadStationsByGenre";
//const CATEGORIES_REGEX = new RegExp(`.*loadStationsByGenre[^0-9]+([0-9]+?)[^0-9]+([0-9]+?)[^0-9]+>(.+)</a>`);
const CATEGORIES_REGEX = new RegExp(`.*loadStationsByGenre[(]'([^']*)'[^0-9]+([0-9]+?)[^0-9]+([0-9]+?)[^0-9]+>.+</a>`);
const PART_REGEX = new RegExp(`.*<h2>Genre</h2>(.*?)<div.*id="playlist">.*`);

//var test = `  <a href="/Genre?name=30s" onclick="return loadStationsByGenre('30s', 213, 212);">30s</a>`;
//var result = CATEGORIES_REGEX.exec(test);
//global.log("result: " + result);
//result = CATEGORIES_REGEX.exec(test);
//if (result != null)
  //global.log(result[1] + ", " + result[2] + ", " + result[3]);

//test = `  <a href="/Genre?name=Ethnic%20Fusion" onclick="return loadStationsByGenre('Ethnic Fusion', 208, 206);">Ethnic Fusion</a>`;
//result = test.match(CATEGORIES_REGEX);
//global.log("result2: " + result);
//if (result != null)
  //global.log(result[1] + ", " + result[2] + ", " + result[3]);

function Shoutcast() {
  this._init()
}

Shoutcast.prototype = {
  _init: function() {
    this.categories = null;
    this.options = null;
    //this.set_categories();
  },

  _clean_str: function(str) {
    let ret = str.replace(/\\'/gi, "'");
    ret = ret.replace(/\\"/gi, '"');

    ret = ret.replace(/&amp;/g, "&");

    return ret;
  },

  set_categories: function() {
    var categories = {};
    let msg = Soup.Message.new('GET', SC_DIR_URL);
    session.queue_message(msg, (session, message) => {
      if (message.status_code === Soup.KnownStatusCode.OK) {
        let data = message.response_body.data;
        let lines = data.split("\n");
        for (let line of lines) {
          let result = CATEGORIES_REGEX.exec(line);
          let id, parentId, name;
          if (result !== null) {
            name = this._clean_str(result[1]);
            id = result[2];
            parentId = result[3];
            if (parentId === "0") {
              categories[id] = {};
              categories[id]["name"] = name;
              categories[id]["subcats"] = {};
            } else {
              categories[parentId]["subcats"][id] = name;
            }

            //categories[id] = {};
            //categories[id]["number"] = result[1];
            //categories[id]["parent"] = result[2];
          }
        }
        //global.log(JSON.stringify(categories, null, 4));
        this.categories = categories;
        this.set_options();
      }
    });
  },

  set_options: function() {
    var options = {};
    if (this.categories == null) return options;

    let keys = Object.keys(this.categories);
    for (let key of keys) {
      let catName = this.categories[key].name;
      options[""+catName] = ""+key+",0";
      for (let subKey of Object.keys(this.categories[key].subcats)) {
        let subcatName = this.categories[key].subcats[subKey];
        options[""+catName+": "+subcatName] = ""+subKey+","+key;
      }
    }
    //global.log(JSON.stringify(options, null, 4));
    this.options = options;
    this.emit("shoutcast-options-available");
  },

  get_categories: function() {
    return this.categories;
  },

  get_options: function() {
    return this.options;
  }
}

Signals.addSignalMethods(Shoutcast.prototype);

module.exports = {Shoutcast}
