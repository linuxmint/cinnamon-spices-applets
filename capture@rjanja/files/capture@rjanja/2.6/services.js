
const Gio = imports.gi.Gio
const Soup = imports.gi.Soup
const AppUtil = imports.apputil
const Lang = imports.lang;

const httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault());

function Imgur(accessToken, refreshToken, albumId, onRefresh) {
  this._init(accessToken, refreshToken, albumId, onRefresh);
}
Imgur.prototype = {
  CLIENT_ID: "b639f14917109e3",
  CLIENT_SECRET: "2cc304c4d8c5d628b03cc59d46cb81af301cf38b",
  accessToken: null,
  refreshToken: null,
  albumId: null,
  _onRefresh: null,

  _init: function(accessToken, refreshToken, albumId, onRefresh) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.albumId = albumId;
    this._onRefresh = onRefresh;
  },

  isAnonymous: function() {
    return this.accessToken === null
        && this.refreshToken === null
        && this.albumId === null;
  },

  getAuthUrl: function() {
    return "https://api.imgur.com/oauth2/authorize?client_id=" + this.CLIENT_ID + "&response_type=pin&state={}";
  },

  getTokenUrl: function() {
    return "https://api.imgur.com/oauth2/token";
  },

  getUploadUrl: function() {
    return "https://api.imgur.com/3/image.json";
  },

  getAlbumsUrl: function() {
    return "https://api.imgur.com/3/account/me/albums.json";
  },
  
  requestAlbumList: function(onFailure, onSuccess, limit) {
    let headers = {
      'Authorization': 'Bearer ' + this.accessToken,
    };
    this.getJsonAsync(this.getAlbumsUrl(), headers, Lang.bind(this, function(json) {
      if (json['success']) {
        onSuccess(json['data']);
      }
      else if (!limit && json['status'] == 403) {
        this.getNewTokens(function(json) {
          onFailure(json);
        }, Lang.bind(this, function() {
          this.requestAlbumList(onFailure, onSuccess, true);
        }));
      }
      else {
        onFailure(json);
      }
    }));
  },

  getNewTokens: function(onFailure, onSuccess) {
    let payload = {
      'refresh_token': this.refreshToken,
      'client_id': this.CLIENT_ID,
      'client_secret': this.CLIENT_SECRET,
      'grant_type': 'refresh_token'
    };

    this.postJsonAsync(this.getTokenUrl(), payload, Lang.bind(this, function(json) {
      if (json['access_token'] && json['refresh_token']) {
        this.accessToken = json['access_token'];
        this._onRefresh(json['access_token'], json['refresh_token']);
        onSuccess();
      }
      else {
        onFailure(json);
      }
    }));
  },

	requestPinCode: function() {
    AppUtil.Exec('xdg-open ' + this.getAuthUrl());
	},

  redeemPinCode: function(pin, onFailure, onSuccess) {
    let payload = {
      'client_id': this.CLIENT_ID,
      'client_secret': this.CLIENT_SECRET,
      'grant_type': 'pin',
      'pin': pin
    };

    this.postJsonAsync(this.getTokenUrl(), payload, function(json) {
      if (json['access_token'] && json['refresh_token']) {
        onSuccess(json);
      }
      else {
        onFailure(json);
      }
    });
  },

  getJsonAsync: function (url, header_hash, callback) {
    let context = this;

    let message = Soup.Message.new('GET', url);
    for (var key in header_hash) {
      // log(key + ' ' + header_hash[key]);
      message.request_headers.append(key, header_hash[key]);
    }

    httpSession.queue_message(message, function soupQueue(session, message) {
      // log("<- Receiving <- " + message.response_body.data);
      let json = JSON.parse(message.response_body.data);
      callback.call(context, json);
    })
  },

  postJsonAsync: function (url, param_hash, callback) {
    let context = this
    var params = [];
    for (var key in param_hash) {
      params.push(key+"="+param_hash[key]);
    }
    let str_params = params.join('&');
    log("-> Sending -> " + str_params);

    let message = Soup.Message.new('POST', url);
    message.set_request("application/x-www-form-urlencoded",
      Soup.MemoryUse.COPY, str_params, str_params.length);
    httpSession.queue_message(message, function soupQueue(session, message) {
      log("<- Receiving <- " + message.response_body.data);
      let json = JSON.parse(message.response_body.data);
      callback.call(context, json);
    })
  },

  uploadAnonymous: function(filename, params, callback) {
    let request_headers = {
      'Authorization': 'Client-ID ' + this.CLIENT_ID,
    };

    let f = Gio.file_new_for_path(filename);
    let dir = f.get_parent().get_path();
    let imgLogFile = Gio.file_new_for_path(dir + '/imgur.log');
    let imgLog = imgLogFile.append_to(0, null);
    let url = this.getUploadUrl();

    f.load_contents_async(null, function(f, res) {
      let contents;
      try {
        contents = f.load_contents_finish(res)[1];
      } catch (e) {
        log("*** ERROR: " + e.message);
        callback(false, null);
      }

      let buffer = new Soup.Buffer(contents, contents.length);
      let multiPart = new Soup.Multipart(Soup.FORM_MIME_TYPE_MULTIPART);

      multiPart.append_form_file('image', filename, 'image/png', buffer);
      for (key in params) {
        multiPart.append_form_string(key, params[key]);
      }

      var message = Soup.form_request_new_from_multipart(url, multiPart);
      for (var key in request_headers) {
        message.request_headers.append(key, request_headers[key]);
      }

      httpSession.queue_message(message, Lang.bind(this, function(session, response) {
        if (response.status_code !== 200) {
          log("Error during upload: response code " + response.status_code
            + ": " + response.reason_phrase + " - " + response.response_body.data);
          callback(false, null);
          return true;
        }

        try {
          var imgur = JSON.parse(response.response_body.data);
          if (imgur['success']) {
            let linkText = 't=' + new Date(new Date().getTime()).toISOString()
              + ': ' + imgur['data']['link'] + ' ' 
              + imgur['data']['deletehash'] + '\n';
            imgLog.write(linkText, null);      
            callback(true, imgur['data']);
            return true;
          }
          else {
            log("Imgur upload failed");
            callback(false, null);
            log(JSON.stringify(imgur));
            return false;
          }
        }
        catch (e) {
          log("Imgur seems to be down. Error was:");
          logError(e);
          callback(false, null);
          return true;
        }
      }));

      return true;
    }, null);

    return true;
  },

  upload: function(filename, params, callback, limit) {
    let request_headers = {
      'Authorization': 'Bearer ' + this.accessToken,
    };

    let f = Gio.file_new_for_path(filename);
    let dir = f.get_parent().get_path();
    let url = this.getUploadUrl();

    f.load_contents_async(null, Lang.bind(this, function(f, res) {
      let contents;
      try {
        contents = f.load_contents_finish(res)[1];
      } catch (e) {
        global.log("*** ERROR: " + e.message);
        callback(false, null);
      }

      let buffer = new Soup.Buffer(contents, contents.length);
      let multiPart = new Soup.Multipart(Soup.FORM_MIME_TYPE_MULTIPART);
      
      multiPart.append_form_file('image', filename, 'image/png', buffer);
      for (key in params) {
        multiPart.append_form_string(key, params[key]);
      }

      var message = Soup.form_request_new_from_multipart(url, multiPart);
      for (var key in request_headers) {
        message.request_headers.append(key, request_headers[key]);
      }
      httpSession.queue_message(message, Lang.bind(this, function(session, response) {
        if (!limit && response.status_code == 403) {
          this.getNewTokens(function(json) {
            //log("Error getting new access token");
            callback(false, null);
          }, Lang.bind(this, function() {
            this.upload(filename, params, callback, true);
          }));
          return true;
        }
        else if (response.status_code !== 200) {
          // log("Error during upload: response code " + response.status_code
          //   + ": " + response.reason_phrase + " - " + response.response_body.data);
          callback(false, null);
          return true;
        }

        try {
          var imgur = JSON.parse(response.response_body.data);
          if (imgur['success']) {
            callback(true, imgur['data']);
            return true;
          }
          else {
            global.log("Imgur upload failed");
            callback(false, null);
            log(JSON.stringify(imgur));
            return false;
          }
        }
        catch (e) {
          global.log("Imgur seems to be down. Error was:");
          global.logError(e);
          callback(false, null);
          return true;
        }
      }));

      return true;
    }), null);

    return true;
  }
}