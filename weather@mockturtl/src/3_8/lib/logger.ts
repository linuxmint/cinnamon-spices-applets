import { UUID } from "../consts";

class Log {
	private ID?: number;
	private debug: boolean = false;
	private level = 1;
	private appletDir: string;

	public constructor(_instanceId?: number) {
		this.ID = _instanceId;
		this.appletDir = imports.ui.appletManager.appletMeta[UUID].path;
		this.debug = this.DEBUG();
	}

	private DEBUG(): boolean {
		let path = this.appletDir + "/../DEBUG";
		let _debug = imports.gi.Gio.file_new_for_path(path);
		let result = _debug.query_exists(null);
		if (result) this.Info("DEBUG file found in " + path + ", enabling Debug mode");
		return result;
	};

	Info(message: string): void {
		let msg = "[" + UUID + "#" + this.ID + "]: " + message.toString();
		global.log(msg);
	}

	Error(error: string, e?: Error): void {
		global.logError("[" + UUID + "#" + this.ID + "]: " + error.toString());
		if (!!e?.stack)
			global.logError(e.stack);
	};

	Debug(message: string): void {
		if (this.debug) {
			this.Info(message);
		}
	}

	Debug2(message: string): void {
		if (this.debug && this.level > 1) {
			this.Info(message);
		}
	}

	public UpdateInstanceID(instanceID: number): void {
		this.ID = instanceID;
	}
}

export const Logger = new Log();