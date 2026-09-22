const UUID = 'yasm@sniemetz';

// Gettext binding — GJS at runtime, no-op passthrough in Node tests.
let _translator = (s) => s;
if (typeof imports !== 'undefined') {
  try {
    const Gettext = imports.gettext;
    const GLib    = imports.gi.GLib;
    Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');
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
