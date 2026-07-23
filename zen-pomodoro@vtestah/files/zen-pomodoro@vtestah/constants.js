const GLib = imports.gi.GLib;

// Persistent state lives under the XDG state dir (created on first write).
var POMODORO_STATE_DIR = GLib.build_filenamev([GLib.get_user_state_dir(), "zen-pomodoro"]);
var POMODORO_STATE_FILE = GLib.build_filenamev([POMODORO_STATE_DIR, "applet-state.json"]);
var POMODORO_STATE_MAX_AGE_MS = 3 * 60 * 60 * 1000;
var POMODORO_STATS_FILE = GLib.build_filenamev([POMODORO_STATE_DIR, "daily-stats.json"]);
var POMODORO_TASKS_DATA_FILE = GLib.build_filenamev([POMODORO_STATE_DIR, "tasks-data.json"]);
var POMODORO_HOSTS_HELPER_INSTALLED = "/usr/local/sbin/zen-pomodoro-hosts-helper";
var POMODORO_HOSTS_POLICY_INSTALLED = "/usr/share/polkit-1/actions/org.cinnamon.zenpomodoro.hosts.policy";
var POMODORO_HOSTS_FILE = "/etc/hosts";
var POMODORO_HOSTS_BLOCK_BEGIN = "# >>> zen-pomodoro block >>>";
var POMODORO_HOSTS_BLOCK_END = "# <<< zen-pomodoro block <<<";
var POMODORO_FOCUS_FRAME_BOTTOM_SAFE = "border-bottom: 0px;";
var POMODORO_FOCUS_FRAME_NORMAL_STYLE = `border: 2px solid rgba(214, 152, 48, 0.72); ${POMODORO_FOCUS_FRAME_BOTTOM_SAFE} background-color: transparent;`;
var POMODORO_FOCUS_FRAME_WARNING_STYLE = `border: 2px solid rgba(235, 132, 35, 0.86); ${POMODORO_FOCUS_FRAME_BOTTOM_SAFE} background-color: transparent;`;
var POMODORO_BREAK_OVER_FRAME_STYLE = `border: 2px solid rgba(108, 224, 148, 0.70); ${POMODORO_FOCUS_FRAME_BOTTOM_SAFE} background-color: rgba(96, 214, 139, 0.012);`;
var POMODORO_FOCUS_FRAME_TRANSITION = "transition-duration: 220ms; transition-timing-function: ease-in-out;";
var POMODORO_FOCUS_FRAME_STYLE = POMODORO_FOCUS_FRAME_NORMAL_STYLE;
// Flow Soft Landing "overrun": a focus pomodoro has ended but the user is still
// working, so we hold instead of breaking. A calm, dimmed sage frame — gentler
// than the focus gold and distinct from the break green — that reads as a quiet
// "wrap up when you're ready". Static (no pulse / no transition) so it stays
// calm and is inherently reduce-motion-safe, like the other steady frames.
var POMODORO_OVERRUN_FRAME_STYLE = `border: 2px solid rgba(170, 200, 160, 0.52); ${POMODORO_FOCUS_FRAME_BOTTOM_SAFE} background-color: rgba(150, 200, 160, 0.010);`;
var POMODORO_PANEL_FOCUS_CUE_STYLE = "background-color: rgba(214, 152, 48, 0.22); border-radius: 4px; padding-left: 6px; padding-right: 6px;";
var POMODORO_PANEL_BREAK_CUE_STYLE = "background-color: rgba(62, 180, 111, 0.18); border-radius: 4px; padding-left: 6px; padding-right: 6px;";
var POMODORO_PANEL_FOCUS_LABEL_STYLE = "font-weight: bold; color: rgb(255, 224, 153);";
var POMODORO_PANEL_BREAK_LABEL_STYLE = "font-weight: bold; color: rgb(172, 245, 198);";
// Light-panel variants: a touch more tint + dark text so the cue stays
// readable on light themes (the colours above are tuned for dark panels).
var POMODORO_PANEL_FOCUS_CUE_STYLE_LIGHT = "background-color: rgba(214, 152, 48, 0.30); border-radius: 4px; padding-left: 6px; padding-right: 6px;";
var POMODORO_PANEL_BREAK_CUE_STYLE_LIGHT = "background-color: rgba(62, 180, 111, 0.30); border-radius: 4px; padding-left: 6px; padding-right: 6px;";
var POMODORO_PANEL_FOCUS_LABEL_STYLE_LIGHT = "font-weight: bold; color: rgb(150, 92, 8);";
var POMODORO_PANEL_BREAK_LABEL_STYLE_LIGHT = "font-weight: bold; color: rgb(18, 110, 60);";
var POMODORO_FOCUS_TASK_CHIP_STYLE = "background-color: rgba(18, 18, 18, 0.55); color: rgba(255, 224, 153, 0.92); border: 1px solid rgba(214, 152, 48, 0.4); border-radius: 9px; padding: 6px 12px; font-weight: bold;";
var POMODORO_FOCUS_TASK_CHIP_PAUSED_STYLE = "background-color: rgba(18, 18, 18, 0.5); color: rgba(210, 210, 210, 0.82); border: 1px solid rgba(150, 150, 150, 0.35); border-radius: 9px; padding: 6px 12px; font-weight: bold;";
var POMODORO_FOCUS_CHIP_MARGIN = 28;
var POMODORO_FOCUS_RITUAL_STYLE = "font-size: 2.1em; font-weight: bold; color: rgba(255, 224, 153, 0.96); background-color: rgba(18, 18, 18, 0.58); border: 1px solid rgba(214, 152, 48, 0.45); border-radius: 14px; padding: 14px 28px;";
var POMODORO_FOCUS_RITUAL_FADE_IN_MS = 600;
var POMODORO_FOCUS_RITUAL_HOLD_MS = 2600;
var POMODORO_FOCUS_RITUAL_FADE_OUT_MS = 700;
var POMODORO_FOCUS_RITUAL_FRAME_FADE_MS = 900;
var POMODORO_FOCUS_RITUAL_STEP_MS = 30;
var POMODORO_FOCUS_GLOW_FOCUS_RGB = [255, 176, 82];
var POMODORO_FOCUS_GLOW_FOCUS_END_RGB = [255, 110, 56];
var POMODORO_FOCUS_GLOW_BREAK_RGB = [108, 224, 148];
var POMODORO_FOCUS_GLOW_END_SHIFT_START = 0.8;
var POMODORO_FOCUS_GLOW_DEPTH_RATIO = 0.035;
var POMODORO_FOCUS_GLOW_DEPTH_MAX = 26;
var POMODORO_FOCUS_GLOW_DEPTH_MIN = 14;
var POMODORO_FOCUS_GLOW_MAX_ALPHA = 0.18;
var POMODORO_FOCUS_GLOW_PROGRESS_WIDTH = 2;
var POMODORO_FOCUS_GLOW_PROGRESS_ALPHA = 0.7;
var POMODORO_FOCUS_GLOW_TRACK_ALPHA = 0.1;
var POMODORO_FOCUS_GLOW_TICK_ALPHA = 0.3;
var POMODORO_FOCUS_GLOW_TICK_RADIUS = 2.5;
var POMODORO_FOCUS_GLOW_BREATH_BOOST = 0.9;
var POMODORO_FOCUS_GLOW_BREATH_MS = 1500;
