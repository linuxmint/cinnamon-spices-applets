function _errorLabel(error) {
    const kind = String(error?.kind || "unknown");
    const labels = {
        timeout: "タイムアウト",
        http: "HTTPエラー",
        json: "JSON解析エラー",
        network: "通信エラー",
        parse: "データ解析エラー",
        config: "設定エラー",
        closed: "通信終了"
    };
    return labels[kind] || "取得エラー";
}

function _describeError(error) {
    const message = String(error?.message || error || "不明なエラー");
    return `${_errorLabel(error)}: ${message}`;
}

var WeatherService = class WeatherService {
    constructor(jmaProvider, openMeteoProvider, WeatherSnapshotClass) {
        this._jmaProvider = jmaProvider;
        this._openMeteoProvider = openMeteoProvider;
        this._WeatherSnapshot = WeatherSnapshotClass;
    }

    refresh(config, previousSnapshot, callback) {
        const snapshot = this._WeatherSnapshot.fromPrevious(previousSnapshot);
        let pending = 2;

        const finished = () => {
            pending -= 1;
            if (pending === 0)
                callback(snapshot);
        };

        this._jmaProvider.fetch(config.jma, (error, data) => {
            if (error) {
                snapshot.errors.push(`JMA: ${_describeError(error)}`);
            } else {
                snapshot.setProviderData("jma", data);
            }
            finished();
        });

        this._openMeteoProvider.fetch(config.openMeteo, (error, data) => {
            if (error) {
                snapshot.errors.push(`Open-Meteo: ${_describeError(error)}`);
            } else {
                snapshot.setProviderData("openMeteo", data);
            }
            finished();
        });
    }
};
