import { UUID } from "./consts";

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
        let debug = "";
        if (this.debug) {
            debug = this.GetErrorLine();
            global.log(msg, '\n', "On Line:", debug);
        } else {
            global.log(msg);
        }
    }

    Error(error: string): void {
        global.logError("[" + UUID + "#" + this.ID + "]: " + error.toString() + "\n" + "On Line: " + this.GetErrorLine());
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

    private GetErrorLine(): string {
        // Couldn't be more ugly, but it returns the file and line number
        let arr = (new Error).stack.split("\n").slice(-2)[0].split('/').slice(-1)[0];
        return arr;
    }
}