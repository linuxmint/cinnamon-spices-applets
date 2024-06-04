import type { LogLevel } from "../../consts";
import { UUID } from "../../consts";
import { CompareVersion, _ } from "../../utils";
import { FileExists, LoadContents } from "../io_lib";

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

/**
 * For each error create an error name.
 */
const IOErrorEnumNames: Record<imports.gi.Gio.IOErrorEnum, string> = {
	[imports.gi.Gio.IOErrorEnum.FAILED]: "FAILED",
	[imports.gi.Gio.IOErrorEnum.NOT_FOUND]: "NOT_FOUND",
	[imports.gi.Gio.IOErrorEnum.EXISTS]: "EXISTS",
	[imports.gi.Gio.IOErrorEnum.IS_DIRECTORY]: "IS_DIRECTORY",
	[imports.gi.Gio.IOErrorEnum.NOT_DIRECTORY]: "NOT_DIRECTORY",
	[imports.gi.Gio.IOErrorEnum.NOT_EMPTY]: "NOT_EMPTY",
	[imports.gi.Gio.IOErrorEnum.NOT_REGULAR_FILE]: "NOT_REGULAR_FILE",
	[imports.gi.Gio.IOErrorEnum.NOT_SYMBOLIC_LINK]: "NOT_SYMBOLIC_LINK",
	[imports.gi.Gio.IOErrorEnum.NOT_MOUNTABLE_FILE]: "NOT_MOUNTABLE_FILE",
	[imports.gi.Gio.IOErrorEnum.FILENAME_TOO_LONG]: "FILENAME_TOO_LONG",
	[imports.gi.Gio.IOErrorEnum.INVALID_FILENAME]: "INVALID_FILENAME",
	[imports.gi.Gio.IOErrorEnum.TOO_MANY_LINKS]: "TOO_MANY_LINKS",
	[imports.gi.Gio.IOErrorEnum.NO_SPACE]: "NO_SPACE",
	[imports.gi.Gio.IOErrorEnum.INVALID_ARGUMENT]: "INVALID_ARGUMENT",
	[imports.gi.Gio.IOErrorEnum.PERMISSION_DENIED]: "PERMISSION_DENIED",
	[imports.gi.Gio.IOErrorEnum.NOT_SUPPORTED]: "NOT_SUPPORTED",
	[imports.gi.Gio.IOErrorEnum.NOT_MOUNTED]: "NOT_MOUNTED",
	[imports.gi.Gio.IOErrorEnum.ALREADY_MOUNTED]: "ALREADY_MOUNTED",
	[imports.gi.Gio.IOErrorEnum.CLOSED]: "CLOSED",
	[imports.gi.Gio.IOErrorEnum.CANCELLED]: "CANCELLED",
	[imports.gi.Gio.IOErrorEnum.PENDING]: "PENDING",
	[imports.gi.Gio.IOErrorEnum.READ_ONLY]: "READ_ONLY",
	[imports.gi.Gio.IOErrorEnum.CANT_CREATE_BACKUP]: "CANT_CREATE_BACKUP",
	[imports.gi.Gio.IOErrorEnum.WRONG_ETAG]: "WRONG_ETAG",
	[imports.gi.Gio.IOErrorEnum.TIMED_OUT]: "TIMED_OUT",
	[imports.gi.Gio.IOErrorEnum.WOULD_RECURSE]: "WOULD_RECURSE",
	[imports.gi.Gio.IOErrorEnum.BUSY]: "BUSY",
	[imports.gi.Gio.IOErrorEnum.WOULD_BLOCK]: "WOULD_BLOCK",
	[imports.gi.Gio.IOErrorEnum.HOST_NOT_FOUND]: "HOST_NOT_FOUND",
	[imports.gi.Gio.IOErrorEnum.WOULD_MERGE]: "WOULD_MERGE",
	[imports.gi.Gio.IOErrorEnum.FAILED_HANDLED]: "FAILED_HANDLED",
	[imports.gi.Gio.IOErrorEnum.TOO_MANY_OPEN_FILES]: "TOO_MANY_OPEN_FILES",
	[imports.gi.Gio.IOErrorEnum.NOT_INITIALIZED]: "NOT_INITIALIZED",
	[imports.gi.Gio.IOErrorEnum.ADDRESS_IN_USE]: "ADDRESS_IN_USE",
	[imports.gi.Gio.IOErrorEnum.PARTIAL_INPUT]: "PARTIAL_INPUT",
	[imports.gi.Gio.IOErrorEnum.INVALID_DATA]: "INVALID_DATA",
	[imports.gi.Gio.IOErrorEnum.DBUS_ERROR]: "DBUS_ERROR",
	[imports.gi.Gio.IOErrorEnum.HOST_UNREACHABLE]: "HOST_UNREACHABLE",
	[imports.gi.Gio.IOErrorEnum.NETWORK_UNREACHABLE]: "NETWORK_UNREACHABLE",
	[imports.gi.Gio.IOErrorEnum.CONNECTION_REFUSED]: "CONNECTION_REFUSED",
	[imports.gi.Gio.IOErrorEnum.PROXY_FAILED]: "PROXY_FAILED",
	[imports.gi.Gio.IOErrorEnum.PROXY_AUTH_FAILED]: "PROXY_AUTH_FAILED",
	[imports.gi.Gio.IOErrorEnum.PROXY_NEED_AUTH]: "PROXY_NEED_AUTH",
	[imports.gi.Gio.IOErrorEnum.PROXY_NOT_ALLOWED]: "PROXY_NOT_ALLOWED",
	[imports.gi.Gio.IOErrorEnum.CONNECTION_CLOSED]: "CONNECTION_CLOSED",
	[imports.gi.Gio.IOErrorEnum.NOT_CONNECTED]: "NOT_CONNECTED",
	[imports.gi.Gio.IOErrorEnum.MESSAGE_TOO_LARGE]: "MESSAGE_TOO_LARGE",
	[imports.gi.Gio.IOErrorEnum.NO_SUCH_DEVICE]: "NO_SUCH_DEVICE",
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

	Info(message: string, level: string = "Info"): void {
		if (!this.CanLog("info"))
			return;

		const msg = `[${UUID}#${this.ID}:${level}]: ${message.toString()}`;
		global.log(msg);
	}

	Error(error: string, e?: unknown): void {
		if (!this.CanLog("error"))
			return;

		global.logError("[" + UUID + "#" + this.ID + ":Error]: " + error.toString());
		if (typeof e === "string") {
			return;
		}

		if (!(e instanceof Error))
			return;

		const gjsE = e as GJSError;
		global.logError(`GJS Error context - Name: ${gjsE.name}, domain: ${gjsE.domain}, code: ${IOErrorEnumNames[gjsE.code as imports.gi.Gio.IOErrorEnum] ?? gjsE.code}, message: ${gjsE.message}`);

		if (gjsE.stack)
			global.logError(gjsE.stack);

	};

	Debug(message: string): void {
		if (!this.CanLog("debug"))
			return;

		this.Info(message, "Debug");
	}

	Verbose(message: string): void {
		if (!this.CanLog("verbose"))
			return;

		this.Info(message, "Verbose");
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
		if (!FileExists(logFile)) {
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
