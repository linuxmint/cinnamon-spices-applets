// Tabular Islamic (Kuwaiti) calendar algorithm
// Gregorian to Hijri date conversion

var Hijri = class Hijri {
    static fromGregorian(year, month, day) {
        return this._jdToHijri(this._gregToJd(year, month + 1, day));
    }

    static _gregToJd(gy, gm, gd) {
        if (gm <= 2) { gy -= 1; gm += 12; }
        let a = Math.floor(gy / 100);
        let b = 2 - a + Math.floor(a / 4);
        return Math.floor(365.25 * (gy + 4716)) + Math.floor(30.6001 * (gm + 1)) + gd + b - 1524.5;
    }

    static _jdToHijri(jd) {
        let d = jd - 1948438.5;
        let cyc = Math.floor(d / 10631);
        let rem = d - cyc * 10631;

        let hyear = 1;
        let leapPat = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];

        while (true) {
            let len = leapPat.includes(hyear) ? 355 : 354;
            if (rem < len) break;
            rem -= len;
            hyear++;
        }

        let day = Math.floor(rem) + 1;
        let hmonth = 1;
        let monthLen = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30,
                        leapPat.includes(hyear) ? 30 : 29];

        for (let len of monthLen) {
            if (day <= len) break;
            day -= len;
            hmonth++;
        }

        return { year: hyear + 30 * cyc, month: hmonth, day: Math.floor(day) };
    }

    static getMonthName(month, lang) {
        const names = {
            en: ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Awwal',
                 'Jumada al-Thani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal',
                 "Dhu al-Qi'dah", 'Dhu al-Hijjah'],
            ar: ['المحرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى',
                 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوّال',
                 'ذو القعدة', 'ذو الحجة'],
            ru: ['Мухаррам', 'Сафар', 'Раби аль-авваль', 'Раби ас-сани', 'Джумада аль-уля',
                 'Джумада ас-сани', 'Раджаб', 'Шабан', 'Рамадан', 'Шавваль',
                 'Зу-ль-када', 'Зу-ль-хиджжа'],
            de: ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' ath-Thani", 'Dschumada al-Awwal',
                 'Dschumada ath-Thani', 'Radschab', "Scha'ban", 'Ramadan', 'Schawwal',
                 "Dhu l-Qa'da", 'Dhu l-Hiddscha'],
            fr: ['Mouharram', 'Safar', "Rabi' al-Awwal", "Rabi' ath-Thani", 'Joumada al-Awwal',
                 'Joumada ath-Thani', 'Rajab', "Cha'bane", 'Ramadan', 'Chawwal',
                 "Dhou al-Qi'dah", 'Dhou al-Hijjah'],
            es: ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Awwal",
                 "Jumada al-Thani", 'Rajab', "Sha'ban", 'Ramadán', 'Shawwal',
                 "Dhu al-Qa'da", 'Dhu al-Hiyya'],
            tr: ['Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülahir', 'Cemaziyelevvel',
                 'Cemaziyelahir', 'Recep', 'Şaban', 'Ramazan', 'Şevval',
                 'Zilkade', 'Zilhicce'],
            id: ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jamadil Awal',
                 'Jamadil Akhir', 'Rejab', 'Syaaban', 'Ramadan', 'Syawal',
                 'Zulkaedah', 'Zulhijjah'],
            fa: ['محرم', 'صفر', 'ربیع الاول', 'ربیع الثانی', 'جمادی الاول',
                 'جمادی الثانی', 'رجب', 'شعبان', 'رمضان', 'شوال',
                 'ذیقعده', 'ذیحجه'],
            ur: ['محرم', 'صفر', 'ربیع الاول', 'ربیع الثانی', 'جمادی الاول',
                 'جمادی الثانی', 'رجب', 'شعبان', 'رمضان', 'شوال',
                 'ذوالقعدہ', 'ذوالحجہ']
        };
        return (names[lang] || names.en)[month - 1] || '';
    }
};
