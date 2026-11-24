var UUID = "c-eyes@anaximeno";

var AREA_DEFAULT_WIDTH = 28;

var MONITORS_CHANGED_UPDATE_TIMEOUT_MS = 100;

var WS_SWITCHED_UPDATE_TIMEOUT_MS = 400;

var IDLE_ANIMATION_FRAME_INTERVAL_MS = 150;

var Optimizations = Object.freeze({
	"battery": {
		repaint_interval_ms: 120,
		repaint_angle_rad: 0.09,
		animation_frame_interval_ms: 66,
	},
	"balance": {
		repaint_interval_ms: 70,
		repaint_angle_rad: 0.07,
		animation_frame_interval_ms: 40,
	},
	"performance": {
		repaint_interval_ms: 30,
		repaint_angle_rad: 0.01,
		animation_frame_interval_ms: 25,
	}
});
