function _alertErrorLabel(error) {
    const labels = {
        timeout: "タイムアウト",
        http: "HTTPエラー",
        json: "JSON解析エラー",
        network: "通信エラー",
        parse: "データ解析エラー",
        config: "設定エラー",
        closed: "通信終了"
    };
    return labels[String(error?.kind || "unknown")] || "取得エラー";
}

var AlertService = class AlertService {
    constructor(provider) {
        this._provider = provider;
    }

    refresh(config, previousData, callback) {
        this._provider.fetch(config, (error, data) => {
            if (error) {
                callback({
                    data: previousData || null,
                    state: previousData ? "previous" : "missing",
                    error: `${_alertErrorLabel(error)}: ${error.message || error}`
                });
                return;
            }

            callback({ data, state: "fresh", error: null });
        });
    }
};
