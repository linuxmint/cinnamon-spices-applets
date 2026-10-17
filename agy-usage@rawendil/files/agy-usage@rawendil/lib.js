// Copyright (C) 2026 Sebastian Soczka <rawendil>
// Licensed under the GNU General Public License v3.0 or later.
// See the LICENSE file for details.

// Czyste funkcje appletu agy-usage.
//
// WAŻNE: ten plik nie może importować niczego z imports.gi — jest ładowany
// zarówno przez GJS w panelu Cinnamona, jak i przez node w testach.
// Eksportowane symbole muszą być deklarowane jako `var` albo `function`:
// stary system `imports` w GJS nie widzi top-levelowych `const`/`let`.

// Tłumaczenie wstrzykuje applet.js przez setTranslator(): `imports.gettext`
// nie istnieje pod node, a ten plik ładuje się obiema drogami. Domyślna
// identyczność sprawia, że testy widzą angielskie oryginały.
var _ = function (text) {
    return text;
};

function setTranslator(translate) {
    _ = translate;
}

var GROUP_LABELS = {
    'gemini': 'Gemini',
    '3p': 'Claude/GPT'
};

var BUCKET_IDS = {
    'gemini': { fiveHour: 'gemini-5h', weekly: 'gemini-weekly' },
    '3p': { fiveHour: '3p-5h', weekly: '3p-weekly' }
};

function toUsedPercent(remainingFraction) {
    var used = Math.round((1 - remainingFraction) * 100);
    return Math.min(100, Math.max(0, used));
}

var COLOR_GREEN = 'agy-usage-green';
var COLOR_YELLOW = 'agy-usage-yellow';
var COLOR_RED = 'agy-usage-red';

function colorClassFor(usedPercent) {
    if (usedPercent < 70) {
        return COLOR_GREEN;
    }
    if (usedPercent < 85) {
        return COLOR_YELLOW;
    }
    return COLOR_RED;
}

function _pad2(value) {
    return value < 10 ? '0' + value : String(value);
}

function _msBetween(fromIso, toIso) {
    // Zwraca NaN, gdy którakolwiek data jest nieczytelna — wołający to sprawdza.
    return Date.parse(toIso) - Date.parse(fromIso);
}

function formatCountdown(resetTimeIso, nowIso) {
    var deltaMs = _msBetween(nowIso, resetTimeIso);
    if (!(deltaMs > 0)) {
        return null;
    }
    var totalMinutes = Math.floor(deltaMs / 60000);
    return Math.floor(totalMinutes / 60) + ':' + _pad2(totalMinutes % 60);
}

function formatResetLabel(resetTimeIso, nowIso) {
    var reset = new Date(resetTimeIso);
    var now = new Date(nowIso);
    if (isNaN(reset.getTime()) || isNaN(now.getTime())) {
        return '—';
    }

    var time = _pad2(reset.getHours()) + ':' + _pad2(reset.getMinutes());
    var sameDay = reset.getFullYear() === now.getFullYear() &&
        reset.getMonth() === now.getMonth() &&
        reset.getDate() === now.getDate();
    if (sameDay) {
        return time;
    }
    return _pad2(reset.getDate()) + '.' + _pad2(reset.getMonth() + 1) + ' ' + time;
}

function formatDataAge(lastUpdateIso, nowIso) {
    if (!lastUpdateIso) {
        return null;
    }
    var deltaMs = _msBetween(lastUpdateIso, nowIso);
    if (!(deltaMs >= 0)) {
        return null;
    }

    var minutes = Math.floor(deltaMs / 60000);
    if (minutes < 1) {
        return _('data from moments ago');
    }
    if (minutes < 60) {
        return _('data from %d min ago').replace('%d', minutes);
    }
    return _('data from %d h %d min ago')
        .replace('%d', Math.floor(minutes / 60))
        .replace('%d', minutes % 60);
}

function buildPanelText(bucket5h, bucketWeekly, nowIso) {
    var countdown = formatCountdown(bucket5h.resetTime, nowIso);
    return {
        text5h: bucket5h.usedPercent + '%' + (countdown ? ' (' + countdown + ')' : ''),
        textWeekly: bucketWeekly.usedPercent + '%'
    };
}

var TOOLTIP_SEPARATOR = '──────────────────────────────────────';

function _tooltipLabel(groupLabel, windowLabel) {
    // Pierwsze %s to grupa modeli (Gemini), drugie okno limitu (5h).
    return _('%s — %s:').replace('%s', groupLabel).replace('%s', windowLabel);
}

function _tooltipRows(parsed, group) {
    var label = GROUP_LABELS[group];
    return [
        { label: _tooltipLabel(label, _('5h')), bucket: parsed[group].fiveHour },
        { label: _tooltipLabel(label, _('weekly')), bucket: parsed[group].weekly }
    ];
}

function _tooltipLine(row, labelWidth, nowIso) {
    var percent = row.bucket.usedPercent + '%';
    return row.label.padEnd(labelWidth) + ' ' + percent.padStart(4) + '   ' +
        _('reset %s').replace('%s', formatResetLabel(row.bucket.resetTime, nowIso));
}

function buildTooltip(parsed, opts) {
    var options = opts || {};
    var primary = parsed[options.group] ? options.group : 'gemini';
    var secondary = primary === 'gemini' ? '3p' : 'gemini';
    var nowIso = options.nowIso;

    var primaryRows = _tooltipRows(parsed, primary);
    var secondaryRows = _tooltipRows(parsed, secondary);

    // Szerokość kolumny liczona z rzeczywistych etykiet: po tłumaczeniu
    // 'Claude/GPT — weekly:' nie musi już być najdłuższe.
    var labelWidth = 0;
    primaryRows.concat(secondaryRows).forEach(function (row) {
        labelWidth = Math.max(labelWidth, row.label.length);
    });

    var render = function (row) {
        return _tooltipLine(row, labelWidth, nowIso);
    };

    var lines = primaryRows.map(render);
    lines.push(TOOLTIP_SEPARATOR);
    lines = lines.concat(secondaryRows.map(render));

    lines.push('');
    lines.push(_('Last update: %s').replace('%s', options.lastUpdateIso
        ? _pad2(new Date(options.lastUpdateIso).getHours()) + ':' +
          _pad2(new Date(options.lastUpdateIso).getMinutes())
        : _('never')));

    if (options.note) {
        lines.push(options.note);
    }
    lines.push(_('(click to refresh)'));
    return lines.join('\n');
}

// Komunikaty budowane na żądanie, nie jako stała: w chwili ładowania modułu
// tłumacz jeszcze nie jest wstrzyknięty.
function errorMessage(kind) {
    switch (kind) {
        case 'noBinary':
            return _('`agy` not found. Set the path in the applet settings.');
        case 'timeout':
            return _('`agy` timed out (30 s).');
        case 'parse':
            return _('Could not read the response from `agy`.');
        case 'auth':
            return _('Sign-in required — run `agy` in a terminal.');
        case 'network':
            return _('No connection to the Antigravity backend.');
    }
    return '';
}

// Rekonesans nie objął wygasłych poświadczeń, więc obie listy są zachowawczym
// zgadywaniem — mają zostać zawężone, gdy prawdziwe komunikaty wyjdą na jaw.
var AUTH_PATTERNS = ['login', 'auth', 'unauthenticated', 'unauthorized', 'credential'];
var NETWORK_PATTERNS = [
    'network', 'connection refused', 'connection reset', 'unreachable',
    'offline', 'no such host', 'dial tcp', 'dns', 'i/o timeout',
    'context deadline exceeded'
];

var STDERR_LINE_LIMIT = 120;

function _matchesAny(haystack, patterns) {
    for (var i = 0; i < patterns.length; i++) {
        if (haystack.indexOf(patterns[i]) !== -1) {
            return true;
        }
    }
    return false;
}

function _firstMeaningfulLine(text) {
    var lines = String(text || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line !== '') {
            return line.length > STDERR_LINE_LIMIT
                ? line.slice(0, STDERR_LINE_LIMIT) + '…'
                : line;
        }
    }
    return _('no message');
}

function classifyFailure(exitStatus, stdout, stderr) {
    var combined = (String(stdout || '') + '\n' + String(stderr || '')).toLowerCase();

    if (_matchesAny(combined, AUTH_PATTERNS)) {
        return { kind: 'auth', message: errorMessage('auth') };
    }
    if (_matchesAny(combined, NETWORK_PATTERNS)) {
        return { kind: 'network', message: errorMessage('network') };
    }
    return {
        kind: 'exit',
        message: _('`agy` exited with code %d: %s')
            .replace('%d', exitStatus)
            .replace('%s', _firstMeaningfulLine(stderr))
    };
}

function _collectBuckets(groups) {
    // Spłaszcza wszystkie kubełki wszystkich grup do mapy po id. Kubełki są
    // wyszukiwane po stabilnym id, więc kolejność grup i kubełków nie ma znaczenia.
    var byId = {};
    for (var i = 0; i < groups.length; i++) {
        var buckets = groups[i] && groups[i].buckets;
        if (!Array.isArray(buckets)) {
            continue;
        }
        for (var j = 0; j < buckets.length; j++) {
            if (buckets[j] && typeof buckets[j].id === 'string') {
                byId[buckets[j].id] = buckets[j];
            }
        }
    }
    return byId;
}

function _readBucket(byId, id) {
    var raw = byId[id];
    if (!raw) {
        throw new Error('Missing bucket ' + id + ' in the agy response');
    }
    if (typeof raw.remaining_fraction !== 'number' || !isFinite(raw.remaining_fraction)) {
        throw new Error('Bucket ' + id + ' has no valid remaining_fraction');
    }
    return {
        usedPercent: toUsedPercent(raw.remaining_fraction),
        resetTime: typeof raw.reset_time === 'string' ? raw.reset_time : ''
    };
}

function parseUsageResponse(stdoutString) {
    if (typeof stdoutString !== 'string' || stdoutString.trim() === '') {
        throw new Error('The agy response is empty');
    }

    var doc;
    try {
        doc = JSON.parse(stdoutString);
    } catch (e) {
        throw new Error('The agy response is not valid JSON: ' + e.message);
    }

    var groups = doc && doc.command && doc.command.data && doc.command.data.groups;
    if (!Array.isArray(groups)) {
        throw new Error('The agy response has no command.data.groups');
    }

    var byId = _collectBuckets(groups);
    var parsed = {};
    for (var group in BUCKET_IDS) {
        parsed[group] = {
            fiveHour: _readBucket(byId, BUCKET_IDS[group].fiveHour),
            weekly: _readBucket(byId, BUCKET_IDS[group].weekly)
        };
    }
    return parsed;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GROUP_LABELS: GROUP_LABELS,
        BUCKET_IDS: BUCKET_IDS,
        toUsedPercent: toUsedPercent,
        parseUsageResponse: parseUsageResponse,
        COLOR_GREEN: COLOR_GREEN,
        COLOR_YELLOW: COLOR_YELLOW,
        COLOR_RED: COLOR_RED,
        colorClassFor: colorClassFor,
        formatCountdown: formatCountdown,
        formatResetLabel: formatResetLabel,
        formatDataAge: formatDataAge,
        buildPanelText: buildPanelText,
        buildTooltip: buildTooltip,
        setTranslator: setTranslator,
        errorMessage: errorMessage,
        classifyFailure: classifyFailure
    };
}
