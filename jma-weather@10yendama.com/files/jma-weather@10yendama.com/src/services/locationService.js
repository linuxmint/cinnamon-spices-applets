var LocationService = class LocationService {
    constructor(utils) {
        this._utils = utils;
    }

    createProviderConfig(settings) {
        const areaCode = String(settings.jmaAreaCode || "130000").trim();
        const areaName = String(settings.jmaAreaName || "東京地方").trim();
        const tempAreaName = String(settings.jmaTempAreaName || "東京").trim();
        const latitude = Number(settings.latitude);
        const longitude = Number(settings.longitude);

        if (!/^\d{6}$/.test(areaCode))
            throw new Error("気象庁コードは6桁の数字で指定してください");
        if (!areaName)
            throw new Error("気象庁の予報エリア名が未設定です");
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
            throw new Error("緯度が正しくありません");
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
            throw new Error("経度が正しくありません");

        return {
            displayName: String(settings.displayName || "設定地域").trim(),
            location: {
                prefectureCode: String(settings.selectedPrefectureCode || ""),
                municipalityCode: String(settings.selectedMunicipalityCode || ""),
                customCoordinates: Boolean(settings.customCoordinates)
            },
            jma: {
                areaCode,
                areaName,
                tempAreaName,
                displayName: String(settings.displayName || "").trim()
            },
            openMeteo: {
                latitude,
                longitude
            }
        };
    }
};
