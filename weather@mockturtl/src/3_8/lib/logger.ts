import { UUID, LogLevel } from "../consts";

const LogLevelSeverity: Record<LogLevel, number> = {
	always: 0,
	critical: 1,
	error: 5,
	info: 10,
	debug: 50,
	verbose: 100
}

class Log {
	private ID?: number;
	private logLevel: LogLevel = "info";

	public constructor(_instanceId?: number) {
		this.ID = _instanceId;
	}

	public ChangeLevel(level: LogLevel) {
		this.logLevel = level;
	}

	private CanLog(level: LogLevel): boolean {
		return LogLevelSeverity[level] <= LogLevelSeverity[this.logLevel];
	}

	Info(message: string): void {
		if (!this.CanLog("info"))
			return;

		let msg = "[" + UUID + "#" + this.ID + "]: " + message.toString();
		global.log(msg);
	}

	Error(error: string, e?: Error): void {
		if (!this.CanLog("error"))
			return;

		global.logError("[" + UUID + "#" + this.ID + "]: " + error.toString());
		if (!!e?.stack)
			global.logError(e.stack);
	};

	Debug(message: string): void {
		if (!this.CanLog("debug"))
			return;

		this.Info(message);
	}

	Verbose(message: string): void {
		if (!this.CanLog("verbose"))
			return;

		this.Info(message);
	}

	public UpdateInstanceID(instanceID: number): void {
		this.ID = instanceID;
	}
}

export const Logger = new Log();