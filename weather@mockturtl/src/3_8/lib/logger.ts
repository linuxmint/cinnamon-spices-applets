import { UUID, LogLevel } from "../consts";
import { CompareVersion, _ } from "../utils";
import { FileExists, LoadContents } from "./io_lib";

const { File } = imports.gi.Gio;
const { get_home_dir, get_environ } = imports.gi.GLib;

const LogLevelSeverity: Record<LogLevel, number> = {
	always: 0,
	critical: 1,
	error: 5,
	info: 10,
	debug: 50,
	verbose: 100
}

class Log {
	private ID: number | undefined;
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

		const msg = "[" + UUID + "#" + this.ID + "]: " + message.toString();
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

	public async GetAppletLogs(): Promise<string[]> {
		const home = get_home_dir() ?? "~";
		let logFilePath = `${home}/`;

		// Get correct log file
		if (CompareVersion(imports.misc.config.PACKAGE_VERSION, "3.8.8") == -1) {
			logFilePath += ".cinnamon/glass.log";
		}
		else {
			// XSession Error file location
			const errFileEnv = get_environ().find(x => x.includes("ERRFILE"));
			if (!errFileEnv) {
				logFilePath += ".xsession-errors";
			}
			else {
				logFilePath = errFileEnv.replace("ERRFILE=", "");
			}

		}
		const logFile = File.new_for_path(logFilePath);

		// Check if file exists
		if (!await FileExists(logFile)) {
			throw new Error(
				_("Could not retrieve logs, log file was not found under path\n {logFilePath}", { logFilePath: logFilePath })
			);
		}

		// Load file contents
		const logs = await LoadContents(logFile);
		if (logs == null) {
			throw new Error(
				_("Could not get contents of log file under path\n {logFilePath}", { logFilePath: logFilePath })
			);
		}

		const logLines = logs.split("\n");
		const filteredLines: string[] = [];
		let lastWasCinnamonLog = false;
		for (const line of logLines) {
			// Trace line
			if (lastWasCinnamonLog && (line.match(/.js:\d+:\d+$/gm)?.length ?? 0) > 0) {
				filteredLines.push(line)
			}
			// Looking glass line
			else if (line.includes("LookingGlass") && line.includes(UUID)) {
				filteredLines.push(line);
				lastWasCinnamonLog = true;
			}
			else {
				lastWasCinnamonLog = false;
			}

		}

		return filteredLines;
	}
}

export const Logger = new Log();