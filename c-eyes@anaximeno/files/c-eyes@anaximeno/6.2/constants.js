const UUID = "c-eyes@anaximeno";

const AREA_DEFAULT_WIDTH = 28;

const IDLE_TIME = 1000;

const MONITORS_CHANGED_UPDATE_TIMEOUT_MS = 100;

const Optimizations = Object.freeze({
	"battery": {
		repaint_interval_ms: 70,
		repaint_angle_rad: 0.07,
	},
	"balance": {
		repaint_interval_ms: 55,
		repaint_angle_rad: 0.05,
	},
	"performance": {
		repaint_interval_ms: 30,
		repaint_angle_rad: 0.01,
	}
});
