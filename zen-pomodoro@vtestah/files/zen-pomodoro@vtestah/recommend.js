// Pure recommendation engine for the Zen Pomodoro onboarding wizard.
//
// This module has no GJS/St/Clutter dependencies. Translation (`_`) and string
// formatting (`format`) are injected through a `deps` object, so the logic is
// unit-testable under plain node or gjs (see tests/js/recommend.test.js).
//
// computeFocusPlan(answers, deps) -> { items: [ { id, label, keys, core, group } ] }
//   Each item bundles a group of related settings with a human-readable label.
//   Apply the union of `keys` for every item that is `core` or enabled — see
//   selectKeys(). Items are returned in display order; the wizard renders the
//   non-core ones as toggles on the review screen.
//
// Loaded by features.js through the same dual pattern as constants.js:
//   - Cinnamon runtime: imports.ui.appletManager.applets[UUID].recommend
//   - node / require():  module.exports below

// Maximum number of obstacles a user may pick in the (multi-select) "what gets
// in your way" question. Exposed so the wizard UI and the engine agree.
var RECO_STRUGGLE_LIMIT = 3;

// Canonical priority order for obstacles. Selections are sorted into this order
// before assists are built, so the outcome never depends on the order the user
// tapped them, and any same-key conflict resolves predictably (later wins via
// selectKeys). Also used by the UI to render options in a stable order.
var RECO_STRUGGLE_ORDER = ['notifications', 'websites', 'starting', 'overwork', 'anxiety'];

// Normalise the struggle answer (a single string for back-compat, or an array)
// into a de-duplicated, known-only, priority-sorted, capped list of keys.
function _recoSelectedStruggles(struggle) {
    var raw = Array.isArray(struggle) ? struggle : (struggle == null ? [] : [struggle]);
    var seen = {};
    var out = [];
    raw.forEach(function(k) {
        if (k && k !== 'none' && RECO_STRUGGLE_ORDER.indexOf(k) !== -1 && !seen[k]) {
            seen[k] = true;
            out.push(k);
        }
    });
    out.sort(function(a, b) { return RECO_STRUGGLE_ORDER.indexOf(a) - RECO_STRUGGLE_ORDER.indexOf(b); });
    return out.slice(0, RECO_STRUGGLE_LIMIT);
}

function _recoClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))); }

// Preset groups for the "which sites pull you away" branch. Each maps to a few
// well-known apex domains; the wizard adds both the apex and the www. variant
// to the block list. Editable afterwards in Settings → Advanced.
var RECO_SITE_PRESETS = {
    social:   ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'reddit.com'],
    video:    ['youtube.com', 'netflix.com', 'twitch.tv'],
    news:     ['news.ycombinator.com', 'theverge.com', 'cnn.com', 'bbc.com'],
    shopping: ['amazon.com', 'ebay.com', 'aliexpress.com']
};

// Turn the chosen preset keys into a de-duplicated block_domains list (the
// schema stores it as objects: { domain: "youtube.com" }), apex + www variants.
function _recoSiteDomains(sites) {
    var arr = Array.isArray(sites) ? sites : (sites ? [sites] : []);
    var seen = {};
    var out = [];
    arr.forEach(function(cat) {
        (RECO_SITE_PRESETS[cat] || []).forEach(function(d) {
            [d, 'www.' + d].forEach(function(host) {
                if (!seen[host]) { seen[host] = true; out.push({ domain: host }); }
            });
        });
    });
    return out;
}

// Build the assist item for a single obstacle key, or null for an unknown key.
// Kept as a standalone helper so multi-select (Task 4) can reuse it per choice.
function _recoAssistItem(key, _) {
    switch (key) {
        case 'notifications':
            return { id: 'assist:notifications', core: false, group: 'assist',
                keys: { focus_dnd: true },
                label: _("Notifications are muted while you focus.") };
        case 'websites':
            return { id: 'assist:websites', core: false, group: 'assist',
                keys: { enable_blocking: true },
                label: _("Distraction blocking is ready — add sites in Settings → Advanced. Browsers using secure DNS (DoH) may bypass it.") };
        case 'starting':
            return { id: 'assist:starting', core: false, group: 'assist',
                keys: { start_on_click: true, focus_start_ritual: true, require_focus_task: false },
                label: _("One-click start and a calm start ritual make it easier to begin.") };
        case 'overwork':
            return { id: 'assist:overwork', core: false, group: 'assist',
                keys: { auto_start_next: true, show_dialog_messages: true,
                        break_breathing: true, flow_extend: false },
                label: _("Breaks start on their own so you don't overwork.") };
        case 'anxiety':
            return { id: 'assist:anxiety', core: false, group: 'assist',
                keys: { show_seconds: false, warn_sound: false,
                        theme_preset: 'cool', breathing_pattern: 'relax', frame_style: 'glow' },
                label: _("A calm theme, no ticking seconds and no end-of-timer rush.") };
        default:
            return null;
    }
}

var computeFocusPlan = function(answers, deps) {
    answers = answers || {};
    deps = deps || {};
    var _ = deps._ || function(s) { return s; };
    var fmt = deps.format || function(t) {
        var args = Array.prototype.slice.call(arguments, 1);
        var i = 0;
        return String(t).replace(/%[ds]/g, function() { return String(args[i++]); });
    };

    var work = answers.work || 'study';
    var attention = answers.attention || 'medium';
    var struggle = answers.struggle || 'none';   // single-select string for now
    var sound = answers.sound || 'silence';
    var load = answers.load || 'light';

    var items = [];

    // --- Focus rhythm (core: always applied) ---
    var base = ({
        short:  { f: 15, s: 5,  l: 15, n: 4 },
        medium: { f: 25, s: 5,  l: 15, n: 4 },
        long:   { f: 50, s: 10, l: 20, n: 4 },
        flow:   { f: 50, s: 10, l: 20, n: 3 }
    })[attention] || { f: 25, s: 5, l: 15, n: 4 };
    var f = base.f, s = base.s, l = base.l, n = base.n;

    // Nudge the rhythm toward the kind of work.
    if (work === 'deep') { if (f <= 25) { f += 5; } }       // a little longer to ramp up
    else if (work === 'creative') { l += 5; }               // longer breaks let ideas settle
    else if (work === 'admin') { f = Math.max(15, f - 5); } // quicker cycles for small tasks

    f = _recoClamp(f, 1, 60); s = _recoClamp(s, 1, 15); l = _recoClamp(l, 1, 60); n = _recoClamp(n, 1, 10);

    var workReason = ({
        deep: _("longer focus blocks suit deep work"),
        study: _("the classic rhythm suits studying"),
        creative: _("a little more break time lets ideas settle"),
        admin: _("shorter cycles keep small tasks moving")
    })[work] || _("a balanced rhythm");
    items.push({
        id: 'rhythm', core: true, group: 'rhythm',
        keys: { pomodoro_duration: f, short_break_duration: s, long_break_duration: l, pomodori_number: n },
        label: fmt(_("Focus rhythm %d / %d / %d min — %s."), f, s, l, workReason)
    });

    // --- Daily goal from how much they want to do today ---
    var goal = ({ try: 0, light: 4, full: 6, push: 8 })[load];
    if (goal === undefined) { goal = 4; }
    items.push({
        id: 'goal', core: false, group: 'goal',
        keys: { daily_goal: goal },
        label: goal > 0 ? fmt(_("Daily goal: %d focus blocks."), goal)
                        : _("No daily goal yet — just getting a feel for it.")
    });

    // --- Flow extension (deep work / natural flow) ---
    if (attention === 'flow' || work === 'deep') {
        items.push({
            id: 'flow', core: false, group: 'flow',
            keys: { flow_extend: true, flow_extend_minutes: 10 },
            label: _("Flow extend: keep going up to 10 min past the timer when you're in the zone.")
        });
    }

    // --- Soundscape / environment ---
    if (sound === 'silence') {
        items.push({ id: 'sound', core: false, group: 'sound',
            keys: { timer_sound: false, interval_chime: false, focus_ambient_choice: 'off' },
            label: _("Silent focus — no ticking or chimes.") });
    } else if (sound === 'ambient') {
        items.push({ id: 'sound', core: false, group: 'sound',
            keys: { focus_ambient_choice: 'brown', focus_ambient_volume: 40, timer_sound: false, interval_chime: false },
            label: _("Soft brown-noise ambience while you focus.") });
    } else if (sound === 'chime') {
        var chimeMin = parseInt(answers.chimeInterval, 10);
        var chimeSecs = (chimeMin > 0) ? chimeMin * 60 : ((attention === 'short') ? 180 : 300);
        items.push({ id: 'sound', core: false, group: 'sound',
            keys: { interval_chime: true, interval_chime_seconds: chimeSecs, timer_sound: false },
            label: fmt(_("A gentle chime every %d min to mark time."), Math.round(chimeSecs / 60)) });
    } else if (sound === 'shared') {
        items.push({ id: 'sound', core: false, group: 'sound',
            keys: { timer_sound: false, interval_chime: false, focus_ambient_choice: 'off',
                    start_sound: false, break_sound: false, focus_show_task_chip: true, focus_dnd: true },
            label: _("Quiet, visual-only cues for a shared space.") });
    }

    // --- Obstacles → assists (multi-select, capped & merged deterministically) ---
    // `struggle` may be a single string (back-compat) or an array of keys. We
    // canonicalise to a fixed priority order, then push one assist item per
    // chosen obstacle. selectKeys merges later-wins, so when two items touch the
    // same key the later (higher-priority) one decides — e.g. the "overwork"
    // assist clears the flow_extend that the flow item turned on.
    var selected = _recoSelectedStruggles(struggle);
    selected.forEach(function(k) {
        var assist = _recoAssistItem(k, _);
        if (!assist) { return; }
        // If the user picked which sites distract them, pre-fill the block list
        // on the websites assist so blocking is useful out of the box.
        if (k === 'websites') {
            var domains = _recoSiteDomains(answers.sites);
            if (domains.length) {
                assist.keys.block_domains = domains;
                assist.label = fmt(_("Block %d distracting sites while you focus."), domains.length);
            }
        }
        items.push(assist);
    });

    // Optional auto-break, offered to flow-prone users (the wizard only asks
    // when this adds something the "overwork" assist hasn't already turned on).
    if (answers.autobreak === 'yes') {
        items.push({
            id: 'autobreak', core: false, group: 'assist',
            keys: { auto_start_next: true, flow_extend: false, break_breathing: true },
            label: _("Breaks start on their own so you don't overrun.")
        });
    }

    return { items: items };
};

// Adaptive question flow: returns the ordered list of question nodes to ask for
// the current answers. Branch questions appear only when relevant (and are thus
// skipped otherwise), so the wizard length adapts as the user answers. Each node
// is { key, type:'single'|'multi', title, help, opts:[{value,label}], cap? }.
// Pure and dependency-light: translation is injected via deps._.
var buildQuestionFlow = function(answers, deps) {
    answers = answers || {};
    deps = deps || {};
    var _ = deps._ || function(s) { return s; };

    var strug = _recoSelectedStruggles(answers.struggle);
    var hasWebsites = strug.indexOf('websites') !== -1;
    var hasOverwork = strug.indexOf('overwork') !== -1;
    var isFlow = answers.attention === 'flow';

    var flow = [];

    flow.push({ key: 'work', type: 'single',
        title: _("What will you mainly focus on?"),
        help: _("This shapes how long each focus block should be."),
        opts: [
            { value: 'deep',     label: _("Deep work or coding") },
            { value: 'study',    label: _("Studying or reading") },
            { value: 'creative', label: _("Writing or creative work") },
            { value: 'admin',    label: _("Lots of small tasks") }
        ] });

    flow.push({ key: 'attention', type: 'single',
        title: _("How long can you usually concentrate?"),
        help: _("Pick a length you can actually keep — it beats an ideal one."),
        opts: [
            { value: 'short',  label: _("About 15 minutes") },
            { value: 'medium', label: _("About 25 minutes") },
            { value: 'long',   label: _("45 minutes or more") },
            { value: 'flow',   label: _("I lose track of time when I'm in flow") }
        ] });

    flow.push({ key: 'struggle', type: 'multi', cap: RECO_STRUGGLE_LIMIT,
        title: _("What gets in your way most?"),
        help: _("Pick up to 3 — I'll switch on the right help for each."),
        opts: [
            { value: 'notifications', label: _("Notifications and pings") },
            { value: 'websites',      label: _("Distracting websites") },
            { value: 'starting',      label: _("It's hard to get started") },
            { value: 'overwork',      label: _("I forget to take breaks") },
            { value: 'anxiety',       label: _("Timers make me anxious") }
        ] });

    // Branch: which sites to block — only when "distracting websites" is chosen.
    if (hasWebsites) {
        flow.push({ key: 'sites', type: 'multi', cap: 4,
            title: _("Which sites pull you away?"),
            help: _("I'll add these to the block list — edit it later in Settings → Advanced."),
            opts: [
                { value: 'social',   label: _("Social media") },
                { value: 'video',    label: _("Video & streaming") },
                { value: 'news',     label: _("News & forums") },
                { value: 'shopping', label: _("Shopping") }
            ] });
    }

    flow.push({ key: 'sound', type: 'single',
        title: _("What helps you concentrate?"),
        help: _("Sets the focus soundscape — change it anytime in Sounds."),
        opts: [
            { value: 'silence', label: _("Silence") },
            { value: 'ambient', label: _("Soft background noise") },
            { value: 'chime',   label: _("A gentle chime to mark time") },
            { value: 'shared',  label: _("I share my space — keep it quiet") }
        ] });

    // Branch: chime interval — only when the chime soundscape is chosen.
    if (answers.sound === 'chime') {
        flow.push({ key: 'chimeInterval', type: 'single',
            title: _("How often should the chime sound?"),
            help: _("A soft cue to check in with your focus."),
            opts: [
                { value: '3',  label: _("Every 3 minutes") },
                { value: '5',  label: _("Every 5 minutes") },
                { value: '10', label: _("Every 10 minutes") }
            ] });
    }

    flow.push({ key: 'load', type: 'single',
        title: _("How much do you want to get done today?"),
        help: _("Sets your daily goal — no pressure, you can change it."),
        opts: [
            { value: 'try',   label: _("Just trying it out") },
            { value: 'light', label: _("A light day (about 4)") },
            { value: 'full',  label: _("A full day (about 6)") },
            { value: 'push',  label: _("A big push (about 8)") }
        ] });

    // Branch: offer automatic breaks to flow-prone users. Skipped when the user
    // already chose "overwork" (that assist turns auto-breaks on regardless).
    if (isFlow && !hasOverwork) {
        flow.push({ key: 'autobreak', type: 'single',
            title: _("Want breaks to start on their own?"),
            help: _("Helps you step away instead of pushing through."),
            opts: [
                { value: 'yes', label: _("Yes, start breaks automatically") },
                { value: 'no',  label: _("No, I'll start them myself") }
            ] });
    }

    return flow;
};

// Merge the keys of every applicable item into one settings object. An item is
// applied when it is core or not explicitly disabled (enabled !== false). Items
// are merged in array order, so a later item overrides an earlier key (this
// matches the classic wizard, e.g. the "overwork" assist clearing flow_extend).
var selectKeys = function(items) {
    var out = {};
    (items || []).forEach(function(it) {
        if (!it || !it.keys) { return; }
        if (it.core || it.enabled !== false) {
            Object.keys(it.keys).forEach(function(k) { out[k] = it.keys[k]; });
        }
    });
    return out;
};

// Every setting key the plan could ever write, regardless of core/enabled, in
// first-seen order and de-duplicated. The wizard snapshots these values before
// applying so the whole setup can be undone later — including options the user
// unticked, so a restore is faithful no matter what was applied.
var collectBackupKeys = function(items) {
    var seen = {};
    var out = [];
    (items || []).forEach(function(it) {
        if (!it || !it.keys) { return; }
        Object.keys(it.keys).forEach(function(k) {
            if (!seen[k]) { seen[k] = true; out.push(k); }
        });
    });
    return out;
};

// Map a raw key symbol (Clutter keyval) for digits 1-9 — main row or keypad — to
// a zero-based option index, or -1 for anything else. Pure (uses the literal
// keyval ranges, which equal Clutter.KEY_1.. etc.), so the wizard's number-key
// navigation can be unit-tested without GJS.
var keysymToOptionIndex = function(sym) {
    if (sym >= 0x0031 && sym <= 0x0039) { return sym - 0x0031; }   // '1'..'9'
    if (sym >= 0xffb1 && sym <= 0xffb9) { return sym - 0xffb1; }   // KP_1..KP_9
    return -1;
};

// Normalize a user-entered block-list entry to a bare hostname. Accepts pasted
// URLs and trims scheme, path/query, userinfo and port, plus a leading "www.",
// e.g. "HTTPS://www.YA.ru:443/feed?x=1" -> "ya.ru". Returns "" for blank input.
// Pure (no GJS), so the parsing that feeds /etc/hosts is unit-tested; the root
// helper validates again before writing.
var normalizeBlockDomain = function(raw) {
    var d = (raw ? String(raw) : '').trim().toLowerCase();
    if (!d) { return ''; }
    d = d.replace(/^[a-z][a-z0-9+.\-]*:\/\//, '');       // strip scheme
    d = d.split('/')[0].split('?')[0];                   // strip path / query
    if (d.indexOf('@') >= 0) { d = d.split('@').pop(); } // strip userinfo
    d = d.split(':')[0];                                 // strip port
    d = d.replace(/^www\./, '');                         // strip leading www.
    return d;
};

// Node / CommonJS export for the test runner. In the Cinnamon (GJS) runtime
// `module` is undefined, so top-level `var`s are exposed via imports instead.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RECO_STRUGGLE_LIMIT: RECO_STRUGGLE_LIMIT,
        computeFocusPlan: computeFocusPlan,
        buildQuestionFlow: buildQuestionFlow,
        selectKeys: selectKeys,
        collectBackupKeys: collectBackupKeys,
        keysymToOptionIndex: keysymToOptionIndex,
        normalizeBlockDomain: normalizeBlockDomain
    };
}
