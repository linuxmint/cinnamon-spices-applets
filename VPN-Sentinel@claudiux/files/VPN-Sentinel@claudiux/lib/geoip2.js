var geoip2 = function() {
    function e(e, t, r, n) {
        this.successCallback = e, this.errorCallback = t, this.type = n
    }
    var t = {};
    e.prototype.returnSuccess = function(e) {
        this.successCallback && "function" == typeof this.successCallback && this.successCallback(this.fillInObject(JSON.parse(e)))
    }, e.prototype.returnError = function(e) {
        this.errorCallback && "function" == typeof this.errorCallback && (e || (e = {
            error: "Unknown error"
        }), this.errorCallback(e))
    };
    var r = {
        country: [
            ["continent", "Object", "names", "Object"],
            ["country", "Object", "names", "Object"],
            ["registered_country", "Object", "names", "Object"],
            ["represented_country", "Object", "names", "Object"],
            ["traits", "Object"]
        ],
        city: [
            ["city", "Object", "names", "Object"],
            ["continent", "Object", "names", "Object"],
            ["country", "Object", "names", "Object"],
            ["location", "Object"],
            ["postal", "Object"],
            ["registered_country", "Object", "names", "Object"],
            ["represented_country", "Object", "names", "Object"],
            ["subdivisions", "Array", 0, "Object", "names", "Object"],
            ["traits", "Object"]
        ]
    };
    return e.prototype.fillInObject = function(e) {
        for (var t = "country" === this.type ? r.country : r.city, n = 0; n < t.length; n++)
            for (var o = t[n], s = e, i = 0; i < o.length; i += 2) {
                var c = o[i];
                s[c] || (s[c] = "Object" === o[i + 1] ? {} : []), s = s[c]
            }
        try {
            Object.defineProperty(e.continent, "continent_code", {
                enumerable: !1,
                get: function() {
                    return this.code
                },
                set: function(e) {
                    this.code = e
                }
            })
        } catch (u) {
            e.continent.code && (e.continent.continent_code = e.continent.code)
        }
        if ("country" !== this.type) try {
            Object.defineProperty(e, "most_specific_subdivision", {
                enumerable: !1,
                get: function() {
                    return this.subdivisions[this.subdivisions.length - 1]
                },
                set: function(e) {
                    this.subdivisions[this.subdivisions.length - 1] = e
                }
            })
        } catch (u) {
            e.most_specific_subdivision = e.subdivisions[e.subdivisions.length - 1]
        }
        return e
    }, e.prototype.getGeoIPResult = function() {
        var e, t = this,
            r = new window.XMLHttpRequest,
            n = "https://geoip-js.com/geoip/v2.1/" + this.type + "/me?",
            o = {
                referrer: location.protocol + "//" + location.hostname
            };
        if (!this.alreadyRan) {
            this.alreadyRan = 1;
            for (e in o) o.hasOwnProperty(e) && o[e] && (n += e + "=" + encodeURIComponent(o[e]) + "&");
            n = n.substring(0, n.length - 1), r.open("GET", n, !0), r.onload = function() {
                if ("undefined" == typeof r.status || 200 === r.status) t.returnSuccess(r.responseText);
                else {
                    var e, n = r.hasOwnProperty("contentType") ? r.contentType : r.getResponseHeader("Content-Type");
                    if (/json/.test(n) && r.responseText.length) try {
                        e = JSON.parse(r.responseText)
                    } catch (o) {
                        e = {
                            code: "HTTP_ERROR",
                            error: "The server returned a " + r.status + " status with an invalid JSON body."
                        }
                    } else e = r.responseText.length ? {
                        code: "HTTP_ERROR",
                        error: "The server returned a " + r.status + " status with the following body: " + r.responseText
                    } : {
                        code: "HTTP_ERROR",
                        error: "The server returned a " + r.status + " status but either the server did not return a body or this browser is a version of Internet Explorer that hides error bodies."
                    };
                    t.returnError(e)
                }
            }, r.ontimeout = function() {
                t.returnError({
                    code: "HTTP_TIMEOUT",
                    error: "The request to the GeoIP2 web service timed out."
                })
            }, r.onerror = function() {
                t.returnError({
                    code: "HTTP_ERROR",
                    error: "There was a network error receiving the response from the GeoIP2 web service."
                })
            }, r.send(null)
        }
    }, t.country = function(t, r, n) {
        var o = new e(t, r, n, "country");
        o.getGeoIPResult()
    }, t.city = function(t, r, n) {
        var o = new e(t, r, n, "city");
        o.getGeoIPResult()
    }, t.insights = function(t, r, n) {
        var o = new e(t, r, n, "insights");
        o.getGeoIPResult()
    }, t
}();
//# sourceMappingURL=geoip2.js.map

module.exports = {
  geoip2
};
