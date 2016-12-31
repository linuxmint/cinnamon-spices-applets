// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Signals = imports.signals;

const FAVORITES_LIST_KEY = 'favorites-list'
const menuSettings = new Gio.Settings({schema: 'org.cinnamon.applets.classicMenu'});

function FavSys() {
    this._init();
}

FavSys.prototype = {
    _init: function(){
        this._list = new Array();
        menuSettings.connect('changed::' + FAVORITES_LIST_KEY, Lang.bind(this, this._onFavsChanged));
        this.noOfSections = -1;
        this._reload();
    },

    _onFavsChanged: function() {
        this._reload();
        this.emit('changed');
    },

    _reload: function() {
        let favList = menuSettings.get_string(FAVORITES_LIST_KEY);
	let favSubList = favList.split("::");
        this._list = new Array();
	for (var i in favSubList){
	    this._list.push(favSubList[i].split(":"));
	}
    },

    addSeparatorAtPos: function(posi, posj){
        let firstList = this._list[posi].slice(0, posj+1);
        let secondList = this._list[posi].slice(posj+1);
        this._list.splice(posi, 1, firstList, secondList);
        this.write();
    },

    addFavoriteAtPos: function(appId, posi, posj){
        if (posi >= 0){
            if (!this._list.length <= posi){
                if (posj >= 0)
                    this._list[posi].splice(posj, 0, appId);
                else
                    this._list[posi].push(appId);
            } else
                this._list.push([appId]);
        } else {
                this._list.push([appId]);
        }
        this.write();
    },

    addFavorite: function(appId) {
        this.addFavoriteAtPos(appId, -1, -1);
    },

    moveFavoriteToPos: function(appId, posi, posj) {
        this.removeFavorite(appId);
        this._addFavorite(appId, posi, posj);
    },

    removeFavorite: function(appId){
        for (let i in this._list){
            let index = this._list[i].indexOf(appId);
            while (index != -1){
                this._list[i].splice(index, 1);
                index = this._list[i].indexOf(appId);
            }
        }
        this.write()
    },

    isFavorite: function(appId) {
        global.log(appId);
        let inside = false;
        for (let i in this._list){
            if (appId in this._list[i]){
                inside = true;
                break;
            }
        }
        return inside;
    },

    write: function(){
        let string = "";
        for (let i in this._list)
	    if (this._list[i] != [])
	        string = string + this._list[i].join(":") + "::";
        string = string.slice(0, string.lastIndexOf("::"));
        menuSettings.set_string("favorites-list", string);
    },

    getFavoriteMap: function(){
        return this._favorites;
    },

    getFavorites: function(){
        let ret = [];
        for (let i in this._list){
            let inlist = [];
            for (let j in this._list[i])
                inlist.push(this._list[i][j]);
            ret.push(inlist);
        }
        return ret;
    },

    setFavorites: function(list){
        this._list = list;
    },

    returnId: function(i, j){
        return this._list[i][j];
    }
}
Signals.addSignalMethods(FavSys.prototype);

var favSysInstance = null;
function getFavSys() {
    if (favSysInstance == null)
        favSysInstance = new FavSys();
    return favSysInstance;
}