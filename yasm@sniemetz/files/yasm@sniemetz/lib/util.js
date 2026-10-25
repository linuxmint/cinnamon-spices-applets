// Hardcoded on purpose: the .mo files cinnamon-spices-makepot installs
// live under ~/.local/share/locale/<lang>/LC_MESSAGES/yasm@sniemetz.mo,
// so dgettext() must query the "yasm@sniemetz" domain regardless of the
// UUID the applet is currently running under. This keeps translations
// working for dev-toggle (yasm@local) and for anyone running the
// published package. If YASM is ever forked under a different UUID AND
// that fork ships its own translations, update this constant to match
// — self-deriving from AppletPath would break the dev-toggle case where
// no yasm@local.mo exists.
const UUID = 'yasm@sniemetz';

// Gettext binding — GJS at runtime, no-op passthrough in Node tests.
let _translator = (s) => s;
if (typeof imports !== 'undefined') {
  try {
    const Gettext = imports.gettext;
    const GLib    = imports.gi.GLib;
    Gettext.bindtextdomain(UUID, GLib.get_user_data_dir()  + '/locale');

    _translator = (s) => Gettext.dgettext(UUID, s);
  } catch(e) {}
}
function _(text) { return _translator(text); }

function parseList(val) {
  if (!val) return [];
  if (typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return []; } }
  return Array.isArray(val) ? val : [];
}

// Pad label→value pairs so column 2 aligns after the widest label.
// Keeps monospace-tooltip alignment stable across translations.
function padColumn(pairs, minWidth) {
  const w = Math.max(minWidth || 0, ...pairs.map(([l]) => l.length));
  return pairs.map(([l, v]) => `${l.padEnd(w + 1)}${v}`);
}

if (typeof module !== 'undefined') module.exports = { parseList, _, padColumn };
