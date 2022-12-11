// Copyright J. Chris Anderson 2007
// Retain this notice.
// Released under the LGPL 3
// http://www.gnu.org/licenses/lgpl.html

const XSPF = {
  XMLfromString: function(string) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(string,"text/xml");

    return doc;
  },

  toJSPF : function(xml_dom) {
    var pl =  this.parse_playlist(xml_dom);
    return {playlist:pl};
  },

  parse_playlist : function(xspf) {
    var playlist = new Object;
    var xspf_playlist = xspf.getElementsByTagName('playlist')[0];
    var trackList = xspf_playlist.getElementsByTagName('trackList')[0];
    playlist.title = this.get_contents(xspf_playlist, 'title')[0];
    playlist.creator = this.get_contents(xspf_playlist, 'creator')[0];
    playlist.annotation = this.get_contents(xspf_playlist, 'annotation')[0];
    playlist.info = this.strWh(this.get_contents(xspf_playlist, 'info')[0]);
    playlist.location = this.strWh(this.get_contents(xspf_playlist, 'location')[0]);
    playlist.identifier = this.strWh(this.get_contents(xspf_playlist, 'identifier')[0]);
    playlist.image = this.strWh(this.get_contents(xspf_playlist, 'image')[0]);
    playlist.date = this.strWh(this.get_contents(xspf_playlist, 'date')[0]);

    var attrs = this.getDirectChildrenByTagName(xspf_playlist,'attribution')[0];
    if (attrs) playlist.attribution = this.getKeyValuePairs(attrs,['location','identifier']);

    var linknodes = this.getDirectChildrenByTagName(xspf_playlist,'link');
    playlist.link = this.getRelValuePairs(linknodes);

    var metanodes = this.getDirectChildrenByTagName(xspf_playlist,'meta');
    playlist.meta = this.getRelValuePairs(metanodes,true);


    playlist.license = this.strWh(this.get_contents(xspf_playlist, 'license')[0]);

    playlist.extension = {};
    var extnodes = this.getDirectChildrenByTagName(xspf_playlist,'extension');
    for (var i=0; i < extnodes.length; i++) {
      var node = extnodes[i];
      var app = node.getAttribute('application');
      if (app) {
        playlist.extension[app] = playlist.extension[app] || [];
        var extension = this.getExtensionReader(app,'playlist')(node);
        playlist.extension[app].push(extension);
      }
    }

    playlist.track = this.parse_tracks(trackList);

    return playlist;
  },

  getExtensionReader: function(appname,pltr) {
    if (XSPF.extensionParsers[pltr][appname]) {
      return XSPF.extensionParsers[pltr][appname];
    } else {
      return function(node) {return XSPF.getUniqueKeyValuePairs(node)};
    }
  },

  extensionParsers: {
    playlist: {},
    track: {}
  },

  getUniqueKeyValuePairs: function(node,filter) {
    var result = {};
    for (var y=0; y < node.childNodes.length; y++) {
      var value = {};
      var attr = node.childNodes[y];
      if (attr.tagName) {
        if (!filter || (filter && (filter.indexOf(attr.tagName) != -1))) {
          result[attr.tagName] = this.node_text(attr);
        }
      }
    }
    return result;
  },

  getKeyValuePairs: function(node,filter,nowrap) {
    var result = [];
    for (var y=0; y < node.childNodes.length; y++) {
      var value = {};
      var attr = node.childNodes[y];
      if (attr.tagName) {
        if (!filter || (filter && (filter.indexOf(attr.tagName) != -1))) {
          value[attr.tagName] = this.node_text(attr);
          result.push(nowrap ? this.node_text(attr) : value);
        }
      }
    }
    return result;
  },

  getRelValuePairs: function(nodes,preserve_whitespace) {
    var result = [];
    for (var y=0; y < nodes.length; y++) {
      var ln = nodes[y];
      var rel = ln.getAttribute('rel');
      if (rel) {
        var link = {};
        link[rel] = preserve_whitespace ? this.node_text(ln) : this.strWh(this.node_text(ln));
        result.push(link);
      }
    }
    return result;
  },

  getDirectChildrenByTagName: function(source_node,tag_name) {
    var nodes = source_node.childNodes;
    var matches = [];
    for (var i=0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.tagName == tag_name) {
        matches.push(node);
      }
    }
    return matches;
  },

  parse_tracks : function(xml) {
    var xspf_tracks = this.getDirectChildrenByTagName(xml,'track');
    var xspf_playlist_length = xspf_tracks.length;
    var tracks = new Array;
    for (var i=0; i < xspf_playlist_length; i++) {
      var t = new Object;
      var xspf_track = xspf_tracks[i];

      t.annotation = this.get_contents(xspf_track, 'annotation')[0];
      t.title = this.get_contents(xspf_track, 'title')[0];
      t.creator = this.get_contents(xspf_track, 'creator')[0];
      t.info = this.strWh(this.get_contents(xspf_track, 'info')[0]);
      t.image = this.strWh(this.get_contents(xspf_track, 'image')[0]);
      t.album = this.get_contents(xspf_track, 'album')[0];
      t.trackNum = this.strWh(this.get_contents(xspf_track, 'trackNum')[0])/1;
      t.duration = this.strWh(this.get_contents(xspf_track, 'duration')[0])/1;

      t.location = this.strWh(this.getKeyValuePairs(xspf_track,['location'],true));
      t.identifier = this.strWh(this.getKeyValuePairs(xspf_track,['identifier'],true));

      var linknodes = this.getDirectChildrenByTagName(xspf_track,'link');
      t.link = this.getRelValuePairs(linknodes);

      var metanodes = this.getDirectChildrenByTagName(xspf_track,'meta');
      t.meta = this.getRelValuePairs(metanodes);

      t.extension = {};
      var extnodes = this.getDirectChildrenByTagName(xspf_track,'extension');

      if (extnodes.length > 0) {
        for (var j=0; j < extnodes.length; j++) {
          var node = extnodes[j];
          var app = node.getAttribute('application');
          if (app) {
            t.extension[app] = t.extension[app] || [];
            var extension = this.getExtensionReader(app,'track')(node);
            t.extension[app].push(extension);
          }
        }
      }

      tracks.push(t);
    }
    return tracks;
  },

  get_contents : function(xml_node, tag) {
    var xml_contents = xml_node.childNodes;
    var contents = [];
    for (var i=0; i < xml_contents.length; i++) {
      var xml_content = xml_contents[i];
      if (xml_content.tagName == tag) {
        contents.push(this.node_text(xml_content));
      }
    }
    return contents;
  },

  node_text : function(node) {
    if (node.childNodes && node.childNodes.length > 1) {
      return node.childNodes[1].nodeValue;
    } else if (node.firstChild) {
      return node.firstChild.nodeValue;
    }
  },

  strWh: function(arr) {
    if (!arr) return;
    if(typeof arr == 'string') {
      arr = [arr];
      var scalar = true;
    } else {
      var scalar = false;
    }
    result = [];
    for (var i=0; i < arr.length; i++) {
      var string = arr[i];
      var string = string.replace(/^\s*/,'');
      var string = string.replace(/\s*$/,'');
      result.push(string);
    }
    if (scalar) {
      return result[0];
    } else {
      return result;
    }
  }
};
