var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var IpApi = (function () {
    function IpApi(_app) {
        this.query = "https://ipapi.co/json";
        this.app = _app;
    }
    IpApi.prototype.GetLocation = function () {
        return __awaiter(this, void 0, void 0, function () {
            var json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.app.LoadJsonAsync(this.query)];
                    case 1:
                        json = _a.sent();
                        if (json == null) {
                            this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                            return [2, false];
                        }
                        return [3, 3];
                    case 2:
                        e_1 = _a.sent();
                        this.app.log.Error("IpApi service error: " + e_1);
                        this.app.showError(this.app.errMsg.label.generic, this.app.errMsg.desc.cantGetLoc);
                        return [2, false];
                    case 3:
                        if (json.error) {
                            this.HandleErrorResponse(json);
                            return [2, false];
                        }
                        return [2, this.ParseInformation(json)];
                }
            });
        });
    };
    ;
    IpApi.prototype.ParseInformation = function (json) {
        try {
            var loc = json.latitude + "," + json.longitude;
            this.app.settings.setValue('location', loc);
            this.app.weather.location.timeZone = json.timezone;
            this.app.weather.location.city = json.city;
            this.app.weather.location.country = json.country;
            this.app.log.Print("Location obtained");
            this.app.log.Debug("Location:" + json.latitude + "," + json.longitude);
            this.app.log.Debug("Location setting is now: " + this.app._location);
            return true;
        }
        catch (e) {
            this.app.log.Error("IPapi parsing error: " + e);
            this.app.showError(this.app.errMsg.label.generic, this.app.errMsg.desc.cantGetLoc);
            return false;
        }
    };
    ;
    IpApi.prototype.HandleErrorResponse = function (json) {
        this.app.log.Error("IpApi error response: " + json.reason);
    };
    ;
    return IpApi;
}());
;
