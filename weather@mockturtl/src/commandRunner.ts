import { Log } from "./logger";

const { spawnCommandLineAsyncIO } = imports.misc.util;


/** Spawns a command and await for the output it gives */
export async function SpawnProcess(command: string[]): Promise<any> {
	// prepare command
	let cmd = "";
	for (let index = 0; index < command.length; index++) {
		const element = command[index];
		cmd += "'" + element + "' ";
	}
	try {
		let json = await new Promise((resolve, reject) => {
			spawnCommandLineAsyncIO(cmd, (aStdout: string, err: string, exitCode: number) => {
				if (exitCode != 0) {
					reject(err);
				}
				else {
					resolve(aStdout);
				}
			});
		});
		return json;
	}
	catch(e) {
		Log.Instance.Error("Error calling command " + cmd + ", error: ");
		global.log(e);
		return null;
	}
}

export function OpenUrl(element: imports.gi.St.Button) {
	if (!element.url) return;
	imports.gi.Gio.app_info_launch_default_for_uri(
		element.url,
		global.create_app_launch_context()
	)
}