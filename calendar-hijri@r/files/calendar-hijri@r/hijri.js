const GLib = imports.gi.GLib;

// Umm al-Qura (Kuwaiti) calendar algorithm
// Based on the official lookup table used by Microsoft .NET UmAlQuraCalendar.
// Supported range: 1318..1500 AH (1900-04-30 .. 2077-11-16 CE).

const UQ_MIN_YEAR = 1318;
const UQ_FLAGS = [
    0x02EA,0x06E9,0x0ED2,0x0EA4,0x0D4A,0x0A96,0x0536,0x0AB5,0x0DAA,0x0BA4,0x0B49,0x0A93,
    0x052B,0x0A57,0x04B6,0x0AB5,0x05AA,0x0D55,0x0D2A,0x0A56,0x04AE,0x095D,0x02EC,0x06D5,
    0x06AA,0x0555,0x04AB,0x095B,0x02BA,0x0575,0x0BB2,0x0764,0x0749,0x0655,0x02AB,0x055B,
    0x0ADA,0x06D4,0x0EC9,0x0D92,0x0D25,0x0A4D,0x02AD,0x056D,0x0B6A,0x0B52,0x0AA5,0x0A4B,
    0x0497,0x0937,0x02B6,0x0575,0x0D6A,0x0D52,0x0A96,0x092D,0x025D,0x04DD,0x0ADA,0x05D4,
    0x0DA9,0x0D52,0x0AAA,0x04D6,0x09B6,0x0374,0x0769,0x0752,0x06A5,0x054B,0x0AAB,0x055A,
    0x0AD5,0x0DD2,0x0DA4,0x0D49,0x0A95,0x052D,0x0A5D,0x055A,0x0AD5,0x06AA,0x0695,0x052B,
    0x0A57,0x04AE,0x0976,0x056C,0x0B55,0x0AAA,0x0A55,0x04AD,0x095D,0x02DA,0x05D9,0x0DB2,
    0x0BA4,0x0B4A,0x0A55,0x02B5,0x0575,0x0B6A,0x0BD2,0x0BC4,0x0B89,0x0A95,0x052D,0x05AD,
    0x0B6A,0x06D4,0x0DC9,0x0D92,0x0AA6,0x0956,0x02AE,0x056D,0x036A,0x0B55,0x0AAA,0x094D,
    0x049D,0x095D,0x02BA,0x05B5,0x05AA,0x0D55,0x0A9A,0x092E,0x026E,0x055D,0x0ADA,0x06D4,
    0x06A5,0x054B,0x0A97,0x054E,0x0AAE,0x05AC,0x0BA9,0x0D92,0x0B25,0x064B,0x0CAB,0x055A,
    0x0B55,0x06D2,0x0EA5,0x0E4A,0x0A95,0x052D,0x0AAD,0x036C,0x0759,0x06D2,0x0695,0x052D,
    0x0A5B,0x04BA,0x09BA,0x03B4,0x0B69,0x0B52,0x0AA6,0x04B6,0x096D,0x02EC,0x06D9,0x0EB2,
    0x0D54,0x0D2A,0x0A56,0x04AE,0x096D,0x0D6A,0x0B54,0x0B29,0x0A93,0x052B,0x0A57,0x0536,
    0x0AB5,0x06AA,0x0E93,
];
const UQ_GREG = [
    [1900,4,30],[1901,4,19],[1902,4,9],[1903,3,30],[1904,3,18],[1905,3,7],
    [1906,2,24],[1907,2,13],[1908,2,3],[1909,1,23],[1910,1,12],[1911,1,1],
    [1911,12,21],[1912,12,9],[1913,11,29],[1914,11,18],[1915,11,8],[1916,10,27],
    [1917,10,17],[1918,10,6],[1919,9,25],[1920,9,13],[1921,9,3],[1922,8,23],
    [1923,8,13],[1924,8,1],[1925,7,21],[1926,7,10],[1927,6,30],[1928,6,18],
    [1929,6,8],[1930,5,29],[1931,5,18],[1932,5,6],[1933,4,25],[1934,4,14],
    [1935,4,4],[1936,3,24],[1937,3,13],[1938,3,3],[1939,2,20],[1940,2,9],
    [1941,1,28],[1942,1,17],[1943,1,7],[1943,12,28],[1944,12,16],[1945,12,5],
    [1946,11,24],[1947,11,13],[1948,11,2],[1949,10,22],[1950,10,12],[1951,10,2],
    [1952,9,20],[1953,9,9],[1954,8,29],[1955,8,18],[1956,8,7],[1957,7,28],
    [1958,7,17],[1959,7,7],[1960,6,25],[1961,6,14],[1962,6,3],[1963,5,24],
    [1964,5,12],[1965,5,2],[1966,4,21],[1967,4,10],[1968,3,29],[1969,3,19],
    [1970,3,8],[1971,2,26],[1972,2,16],[1973,2,4],[1974,1,24],[1975,1,13],
    [1976,1,2],[1976,12,22],[1977,12,11],[1978,12,1],[1979,11,20],[1980,11,8],
    [1981,10,28],[1982,10,18],[1983,10,7],[1984,9,26],[1985,9,15],[1986,9,5],
    [1987,8,25],[1988,8,13],[1989,8,2],[1990,7,23],[1991,7,12],[1992,7,1],
    [1993,6,21],[1994,6,10],[1995,5,30],[1996,5,18],[1997,5,7],[1998,4,27],
    [1999,4,17],[2000,4,6],[2001,3,26],[2002,3,15],[2003,3,4],[2004,2,21],
    [2005,2,10],[2006,1,31],[2007,1,20],[2008,1,10],[2008,12,29],[2009,12,18],
    [2010,12,7],[2011,11,26],[2012,11,15],[2013,11,4],[2014,10,25],[2015,10,14],
    [2016,10,2],[2017,9,21],[2018,9,11],[2019,8,31],[2020,8,20],[2021,8,9],
    [2022,7,30],[2023,7,19],[2024,7,7],[2025,6,26],[2026,6,16],[2027,6,6],
    [2028,5,25],[2029,5,14],[2030,5,3],[2031,4,23],[2032,4,11],[2033,4,1],
    [2034,3,21],[2035,3,11],[2036,2,28],[2037,2,16],[2038,2,5],[2039,1,26],
    [2040,1,15],[2041,1,4],[2041,12,24],[2042,12,14],[2043,12,3],[2044,11,21],
    [2045,11,10],[2046,10,31],[2047,10,20],[2048,10,9],[2049,9,28],[2050,9,17],
    [2051,9,6],[2052,8,26],[2053,8,15],[2054,8,5],[2055,7,25],[2056,7,14],
    [2057,7,3],[2058,6,22],[2059,6,11],[2060,5,31],[2061,5,20],[2062,5,10],
    [2063,4,30],[2064,4,18],[2065,4,7],[2066,3,27],[2067,3,16],[2068,3,5],
    [2069,2,23],[2070,2,12],[2071,2,1],[2072,1,21],[2073,1,9],[2073,12,30],
    [2074,12,19],[2075,12,9],[2076,11,27],
];

var Hijri = class Hijri {
    static fromGregorian(year, month, day) {
        // month is 0-indexed (JavaScript Date convention)
        return this._jdToHijri(this._gregToJd(year, month + 1, day));
    }

static getDefaultLang() {
        let langs = GLib.get_language_names();
        for (let l of langs) {
            if (l.startsWith('ar')) return 'ar';
            if (l.startsWith('ru')) return 'ru';
            if (l.startsWith('de')) return 'de';
            if (l.startsWith('fr')) return 'fr';
            if (l.startsWith('es')) return 'es';
            if (l.startsWith('tr')) return 'tr';
            if (l.startsWith('id')) return 'id';
            if (l.startsWith('fa')) return 'fa';
            if (l.startsWith('ur')) return 'ur';
        }
        return 'en';
    }

static _gregToJd(gy, gm, gd) {
        if (gm <= 2) { gy -= 1; gm += 12; }
        let a = Math.floor(gy / 100);
        let b = 2 - a + Math.floor(a / 4);
        return Math.floor(365.25 * (gy + 4716)) + Math.floor(30.6001 * (gm + 1)) + gd + b - 1524.5;
    }

    static _buildJdTable() {
        let tbl = [];
        for (let i = 0; i < UQ_GREG.length; i++) {
            let g = UQ_GREG[i];
            tbl.push(this._gregToJd(g[0], g[1], g[2]));
        }
        return tbl;
    }

    static _jdToHijri(jd) {
        let tbl = this._jdTable;
        // Binary search for the largest year whose Muharram 1 <= jd
        let lo = 0, hi = tbl.length - 1, idx = 0;
        while (lo <= hi) {
            let mid = (lo + hi) >> 1;
            if (tbl[mid] <= jd) { idx = mid; lo = mid + 1; }
            else { hi = mid - 1; }
        }
        let year = UQ_MIN_YEAR + idx;
        let flags = UQ_FLAGS[idx];
        let nDays = Math.floor(jd - tbl[idx]);
        let month = 1;
        while (nDays >= 29 + (flags & 1)) {
            nDays -= 29 + (flags & 1);
            flags >>= 1;
            month++;
        }
        let day = 1 + nDays;
        return { year: year, month: month, day: day };
    }

    static _hijriToJd(year, month, day) {
        let idx = year - UQ_MIN_YEAR;
        if (idx < 0 || idx >= UQ_GREG.length) return null;
        let flags = UQ_FLAGS[idx];
        let jd = this._jdTable[idx];
        let nDays = day - 1;
        for (let m = 1; m < month; m++) {
            nDays += 29 + (flags & 1);
            flags >>= 1;
        }
        return jd + nDays;
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

Hijri._jdTable = Hijri._buildJdTable();

