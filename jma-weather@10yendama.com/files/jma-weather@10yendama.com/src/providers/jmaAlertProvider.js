function _tagAlertError(error, kind) {
    const tagged = error instanceof Error ? error : new Error(String(error));
    if (!tagged.kind)
        tagged.kind = kind;
    return tagged;
}

const ALERT_KINDS = {
    "33": { category: "rain", name: "レベル5大雨特別警報", level: 5 },
    "43": { category: "rain", name: "レベル4大雨危険警報", level: 4 },
    "03": { category: "rain", name: "レベル3大雨警報", level: 3 },
    "10": { category: "rain", name: "レベル2大雨注意報", level: 2 },
    "39": { category: "landslide", name: "レベル5土砂災害特別警報", level: 5 },
    "49": { category: "landslide", name: "レベル4土砂災害危険警報", level: 4 },
    "09": { category: "landslide", name: "レベル3土砂災害警報", level: 3 },
    "29": { category: "landslide", name: "レベル2土砂災害注意報", level: 2 },
    "38": { category: "tide", name: "レベル5高潮特別警報", level: 5 },
    "48": { category: "tide", name: "レベル4高潮危険警報", level: 4 },
    "08": { category: "tide", name: "レベル3高潮警報", level: 3 },
    "19": { category: "tide", name: "レベル2高潮注意報", level: 2 },
    "35": { category: "wind", name: "暴風特別警報", level: 5 },
    "05": { category: "wind", name: "暴風警報", level: 3 },
    "15": { category: "wind", name: "強風注意報", level: 2 },
    "32": { category: "wind_snow", name: "暴風雪特別警報", level: 5 },
    "02": { category: "wind_snow", name: "暴風雪警報", level: 3 },
    "13": { category: "wind_snow", name: "風雪注意報", level: 2 },
    "36": { category: "snow", name: "大雪特別警報", level: 5 },
    "06": { category: "snow", name: "大雪警報", level: 3 },
    "12": { category: "snow", name: "大雪注意報", level: 2 },
    "37": { category: "wave", name: "波浪特別警報", level: 5 },
    "07": { category: "wave", name: "波浪警報", level: 3 },
    "16": { category: "wave", name: "波浪注意報", level: 2 },
    "14": { category: "thunder", name: "雷注意報", level: 2 },
    "17": { category: "snow_melting", name: "融雪注意報", level: 2 },
    "20": { category: "fog", name: "濃霧注意報", level: 2 },
    "21": { category: "dry", name: "乾燥注意報", level: 2 },
    "22": { category: "avalanche", name: "なだれ注意報", level: 2 },
    "23": { category: "cold", name: "低温注意報", level: 2 },
    "24": { category: "frost", name: "霜注意報", level: 2 },
    "25": { category: "ice_accretion", name: "着氷注意報", level: 2 },
    "26": { category: "snow_accretion", name: "着雪注意報", level: 2 }
};

function _normaliseAlertStatus(value) {
    const status = String(value || "").trim();
    if (status === "解除" || status === "発表警報・注意報はなし")
        return "cancelled";
    if (status === "継続")
        return "continued";
    if (status === "発表")
        return "active";
    if (status.includes("解除"))
        return "cancelled";
    if (status.includes("継続"))
        return "continued";
    if (status.includes("から") || status.includes("切替"))
        return "active";
    return "unknown";
}

function _severityForLevel(level) {
    const values = {
        2: "advisory",
        3: "warning",
        4: "dangerous_warning",
        5: "emergency_warning"
    };
    return values[level] || "unknown";
}

function alertIdentity(alert) {
    const status = ["active", "continued"].includes(alert?.status)
        ? "issued"
        : String(alert?.status || "unknown");
    return `${alert?.rawType || "unknown"}:${alert?.code || "unknown"}:` +
        `${alert?.areaCode || "unknown"}:${status}`;
}

function newAlerts(previousAlerts, currentAlerts) {
    const previous = new Set(
        (Array.isArray(previousAlerts) ? previousAlerts : []).map(alertIdentity)
    );
    return (Array.isArray(currentAlerts) ? currentAlerts : []).filter(alert =>
        !previous.has(alertIdentity(alert))
    );
}

var JmaAlertProvider = class JmaAlertProvider {
    constructor(httpClient) {
        this._httpClient = httpClient;
    }

    buildUrl(config) {
        const officeCode = String(config?.officeCode || "").trim();
        if (!/^\d{6}$/.test(officeCode))
            throw new Error("気象庁の警報府県コードは6桁の数字で指定してください");
        return `https://www.jma.go.jp/bosai/warning/data/r8/${officeCode}.json`;
    }

    fetch(config, callback) {
        let url;
        try {
            url = this.buildUrl(config);
        } catch (error) {
            callback(_tagAlertError(error, "config"), null);
            return;
        }

        this._httpClient.getJson(url, (error, data) => {
            if (error) {
                callback(error, null);
                return;
            }
            try {
                callback(null, this.parse(data, config));
            } catch (parseError) {
                callback(_tagAlertError(parseError, "parse"), null);
            }
        });
    }

    parse(data, config, now = new Date()) {
        if (!Array.isArray(data))
            throw new Error("警報JSONの形式が想定外です");

        const municipalityCode = String(config?.municipalityCode || "").trim();
        if (!/^\d{7}$/.test(municipalityCode))
            throw new Error("気象庁の二次細分区域コードは7桁の数字で指定してください");

        let areaFound = false;
        const alerts = [];
        const cancelledAlerts = [];
        const reportTimes = [];

        for (const report of data) {
            if (!report || typeof report !== "object")
                continue;

            const rawType = String(report.dataTypeCode || "unknown");
            const reportDatetime = report.reportDatetime || null;
            if (reportDatetime && !Number.isNaN(new Date(reportDatetime).getTime()))
                reportTimes.push(reportDatetime);

            const items = report.warning?.class20Items;
            if (!Array.isArray(items))
                continue;
            const area = items.find(item =>
                String(item?.areaCode || "") === municipalityCode
            );
            if (!area)
                continue;

            areaFound = true;
            for (const kind of Array.isArray(area.kinds) ? area.kinds : []) {
                if (!kind?.code)
                    continue;

                const code = String(kind.code).padStart(2, "0");
                const info = ALERT_KINDS[code] || null;
                const status = _normaliseAlertStatus(kind.status);
                const alert = {
                    code,
                    name: info?.name || `気象庁防災情報（コード${code}）`,
                    category: info?.category || "unknown",
                    level: info?.level || null,
                    severity: _severityForLevel(info?.level),
                    areaCode: municipalityCode,
                    areaName: String(config?.areaName || municipalityCode),
                    issuedAt: reportDatetime,
                    updatedAt: null,
                    status,
                    source: "jma",
                    rawType,
                    rawStatus: String(kind.status || ""),
                    additions: Array.isArray(kind.additions) ? kind.additions : []
                };

                if (status === "cancelled")
                    cancelledAlerts.push(alert);
                else
                    alerts.push(alert);
            }
        }

        if (!areaFound)
            throw new Error(`警報対象区域「${municipalityCode}」が見つかりません`);

        const uniqueAlerts = new Map();
        for (const alert of alerts)
            uniqueAlerts.set(alertIdentity(alert), alert);

        const sortedAlerts = Array.from(uniqueAlerts.values()).sort((a, b) =>
            (b.level || 0) - (a.level || 0) || a.name.localeCompare(b.name, "ja")
        );
        const latestReportDatetime = reportTimes
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

        return {
            provider: "jma-alerts",
            alerts: sortedAlerts,
            cancelledAlerts,
            areaCode: municipalityCode,
            areaName: String(config?.areaName || municipalityCode),
            reportDatetime: latestReportDatetime,
            fetchedAt: now,
            updatedAt: now
        };
    }
};
