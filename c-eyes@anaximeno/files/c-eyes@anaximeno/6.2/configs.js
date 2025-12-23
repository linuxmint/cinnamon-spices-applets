const UUID = "c-eyes@anaximeno";

const AREA_DEFAULT_WIDTH = 28;

const MONITORS_CHANGED_UPDATE_TIMEOUT_MS = 100;

const WS_SWITCHED_UPDATE_TIMEOUT_MS = 400;

const Optimizations = Object.freeze({
	"battery": {
		repaint_interval_ms: 120,
		repaint_angle_rad: 0.09,
	},
	"balance": {
		repaint_interval_ms: 70,
		repaint_angle_rad: 0.07,
	},
	"performance": {
		repaint_interval_ms: 30,
		repaint_angle_rad: 0.01,
	}
});
