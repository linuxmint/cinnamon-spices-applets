const Chromium = imports.webChromium;
const Firefox = imports.webFirefox;
const GoogleChrome = imports.webGoogleChrome;
const Midori = imports.webMidori;
const Opera = imports.webOpera;
const Fuse = imports.fuse.Fuse;

const ApplicationType = {
  _applications: 0,
  _places: 1,
  _recent: 2
};

function helper() {
  this._init.apply(this, arguments);
}

helper.prototype = {
  _init: function(worker){
    Chromium.init();
    GoogleChrome.init();
    Firefox.init();
    Midori.init();
    Opera.init();
  },
  getBookmarks: function(pattern){
    let res = [];
    let bookmarks = [];

    bookmarks = bookmarks.concat(Chromium.bookmarks);
    bookmarks = bookmarks.concat(GoogleChrome.bookmarks);
    bookmarks = bookmarks.concat(Firefox.bookmarks);
    bookmarks = bookmarks.concat(Midori.bookmarks);
    bookmarks = bookmarks.concat(Opera.bookmarks);

    for (let i = 0, len = bookmarks.length; i < len; i++) {
      res.push({
        class: bookmarks[i].class,
        name: bookmarks[i].name,
        mime: null,
        uri: bookmarks[i].uri,
        type: ApplicationType._places
      });
    }

    // Create a unique list of bookmarks across all browsers.
    let arr = {};

    for (let i=0, len = res.length; i < len; i++ ) {
      arr[res[i].uri] = res[i];
    }

    res = []
    for (let key in arr) {
      res.push(arr[key]);
    }

    if (pattern) {
      let query = new Fuse(res, {
        keys: [{
          name: 'uri',
          weight: 1
        }],
        thresholod: 0.4,
        include: ['score']
      });

      res = query.search(pattern);
      res= res.map((r)=>{
        return r.item;
      })
    }

    return res;
  },
}