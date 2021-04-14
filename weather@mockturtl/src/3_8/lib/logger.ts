import { UUID } from "consts";

export class Log {
	// Static properties

	private static instance: Log = null;
	/** Single instance of log */
	public static get Instance() {
		if (this.instance == null)
			this.instance = new Log();
		return this.instance;
	}

	private ID: number;
	private debug: boolean = false;
	private level = 1;
	private appletDir: string;

	private constructor(_instanceId?: number) {
		this.ID = _instanceId;
		this.appletDir = imports.ui.appletManager.appletMeta[UUID].path;
		this.debug = this.DEBUG();
	}

	private DEBUG(): boolean {
		let path = this.appletDir + "/../DEBUG";
		let _debug = imports.gi.Gio.file_new_for_path(path);
		let result = _debug.query_exists(null);
		if (result) this.Print("DEBUG file found in " + path + ", enabling Debug mode");
		return result;
	};

	Print(message: string): void {
		let msg = "[" + UUID + "#" + this.ID + "]: " + message.toString();
		global.log(msg);
	}

	Error(error: string, e?: Error): void {
		global.logError("[" + UUID + "#" + this.ID + "]: " + error.toString());
		if (e != null)
			global.logError(e.stack);
	};

	Debug(message: string): void {
		if (this.debug) {
			this.Print(message);
		}
	}

	Debug2(message: string): void {
		if (this.debug && this.level > 1) {
			this.Print(message);
		}
	}

	public UpdateInstanceID(instanceID: number): void {
		this.ID = instanceID;
	}
}