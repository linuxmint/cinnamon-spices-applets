/**
 * IpGateway
 * Code from the ipindicator@matus.benko@gmail.com applet (suitable for the VPN-Sentinel@claudiux applet).
 * Many thanks to the Author of this applet!
 */

const Soup = imports.gi.Soup;
const _httpSession = new Soup.SessionAsync();
_httpSession.timeout=120;
const GLib = imports.gi.GLib;

Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

const IpGateway = {
  init: function() {
    this._services = [];
    this._ispServices = [];
    this._countryServices = [];
    this._countryCodeServices = [];
    this._serviceIteration = 0;
    this._ccsIteration = 0;

    this._services.push({
      url: "https://api.ipify.org?format=json",
      parse: function(jsonResponse) {
        let response = JSON.parse(jsonResponse);
        return response.ip;
      }
    });
    this._services.push({
      url: "http://bot.whatismyipaddress.com",
      parse: function(response) {
        return response;
      }
    });
    this._services.push({
      url: "https://myexternalip.com/json",
      parse: function(jsonResponse) {
        let response = JSON.parse(jsonResponse);
        return response.ip;
      }
    });
    //// Returns only IPv6 addresses:
    //this._services.push({
      //url: "https://icanhazip.com",
      //parse: function(response) {
        //return response;
      //}
    //});
    this._services.push({
      url: "http://ipinfo.io/json",
      parse: function(jsonResponse) {
        let response = JSON.parse(jsonResponse);
        return response.ip;
      }
    });

    // ISP Service should be only one, because different services return different ISPs
    this._ispServices.push({
      //url: "https://extreme-ip-lookup.com/json/",
      url: "http://ip-api.com/json?fields=country,countryCode,isp,query",
      parse: function(jsonResponse) {
        let response = JSON.parse(jsonResponse);
        return {
          ip: response.query,
          isp: response.isp,
          country: response.country,
          countryCode: response.countryCode
        };
      }
    });

    // Country Service should be only one.
    this._countryServices.push({
      //url: "https://freegeoip.app/json/",
      url: "https://extreme-ip-lookup.com/json/",
      parse: function(jsonResponse) {
        let response = JSON.parse(jsonResponse);
        return {
          ip: response.query,
          country: response.country,
          countryCode: response.countryCode
        };
      }
    });

    // Country Code Services.
    this._countryCodeServices.push({
      // url: "https://api.ipgeolocationapi.com/geolocate", // Bad responses!
      //url: "http://ip-api.com/json?fields=country,countryCode,isp,query",
      url: "https://get.geojs.io/v1/ip/country.json", // Seems to be the best one.
      parse: function(jsonResponse) {
        let response = JSON.parse(jsonResponse);
        return {
          //countryCode: response.un_locode
          //countryCode: response.countryCode
          countryCode: response.country
        };
      }
    });

    this._countryCodeServices.push({
      // url: "https://api.ipgeolocationapi.com/geolocate", // Bad responses!
      url: "http://ip-api.com/json?fields=country,countryCode,isp,query",
      //url: "https://get.geojs.io/v1/ip/country.json", // Seems to be the best one.
      parse: function(jsonResponse) {
        let response = JSON.parse(jsonResponse);
        return {
          //countryCode: response.un_locode
          countryCode: response.countryCode
          //countryCode: response.country
        };
      }
    });
  },

  getOnlyIp: function(callback) {
    if (this._serviceIteration + 1 >= this._services.length) {
      this._serviceIteration = 0;
    } else {
      this._serviceIteration += 1;
    }
    let service = this._services[this._serviceIteration];
    let url = service.url;
    if (url.indexOf("?") < 0)
      url += "?%s".format(GLib.uuid_string_random());
    else
      url += "&uuid=%s".format(GLib.uuid_string_random());
    this._get(url, function(response) {
      let ip = service.parse(response);
      callback(ip);
    });
  },

  getFullInfo: function(callback) {
    let service = this._ispServices[0];
    let url = service.url;
    if (url.indexOf("?") < 0)
      url += "?%s".format(GLib.uuid_string_random());
    else
      url += "&uuid=%s".format(GLib.uuid_string_random());
    this._get(url, function(response) {
      let fullInfo = service.parse(response);
      callback(fullInfo.ip, fullInfo.isp, fullInfo.country, fullInfo.countryCode);
    });
  },

  getCountryInfo: function(callback) {
    let service = this._countryServices[0];
    let url = service.url;
    if (url.indexOf("?") < 0)
      url += "?%s".format(GLib.uuid_string_random());
    else
      url += "&uuid=%s".format(GLib.uuid_string_random());
    this._get(url, function(response) {
      let countryInfo = service.parse(response);
      callback(countryInfo.ip, countryInfo.country, countryInfo.countryCode);
    });
  },

  getCountryCodeInfo: function(callback) {
    this._ccsIteration = (this._ccsIteration + 1) % this._countryCodeServices.length;
    let service = this._countryCodeServices[this._ccsIteration];
    let url = service.url;
    if (url.indexOf("?") < 0)
      url += "?%s".format(GLib.uuid_string_random());
    else
      url += "&uuid=%s".format(GLib.uuid_string_random());
    this._get(url, function(response) {
      let countryCodeInfo = service.parse(response);
      callback(countryCodeInfo.countryCode);
    });
  },

  _get: function(url, callback) {
    var request = new Soup.Message({
      method: 'GET',
      uri: new Soup.URI(url)
    });
    _httpSession.queue_message(request, function(_httpSession, message) {
      if (message.status_code !== 200) {
        return;
      }
      let data = request.response_body.data;
      callback(data);
    });
  }
}

module.exports = {
  IpGateway
};
