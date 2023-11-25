import { Logger } from "./logger";
import { WeatherButton } from "../ui_elements/weatherbutton";

const { spawnCommandLineAsyncIO } = imports.misc.util;

/**
 * Doesn't do JSON typechecking, you have to do that manually
 * @param command
 */
export async function SpawnProcessJson<TData>(command: string[]): Promise<TypedResponse<TData> | TypedFailResponse> {
	const response = await SpawnProcess(command);
	if (!response.Success) return response as TypedFailResponse;

	try {
		response.Data = JSON.parse(response.Data);
	}
	catch (e) {
		if (e instanceof Error)
			Logger.Error("Error: Command response is not JSON. The response: " + response.Data, e);
		response.Success = false;
		response.ErrorData = {
			Code: -1,
			Message: "Failed to parse JSON",
			Type: "jsonParse",
		}
	}
	finally {
		return response as TypedFailResponse;
	}
}


/** Spawns a command and await for the output it gives */
export async function SpawnProcess(command: string[]): Promise<GenericResponse> {
	// prepare command
	let cmd = "";
	for (const element of command) {
		cmd += "'" + element + "' ";
	}

	const response = await new Promise((resolve, reject) => {
		spawnCommandLineAsyncIO(cmd, (aStdout: string, err: string, exitCode: number) => {
			let result: GenericResponse = {
				Success: exitCode == 0,
				ErrorData: undefined,
				Data: aStdout ?? null
			}

			if (exitCode != 0) {
				result.ErrorData = {
					Code: exitCode,
					Message: err ?? null,
					Type: "unknown"
				}
			}
			resolve(result);
			return result;
		});
	});
	return response as GenericResponse;
}

export function OpenUrl(element: WeatherButton) {
	if (!element.url) return;
	imports.gi.Gio.app_info_launch_default_for_uri(
		element.url,
		global.create_app_launch_context()
	)
}

interface GenericResponse extends ProcessResponse {
	Data: string;
}

interface TypedResponse<TData> extends ProcessResponse {
	Success: true;
	Data: TData;
}

interface TypedFailResponse extends ProcessResponse {
	Success: false;
	Data: string;
}

interface ProcessResponse {
	Success: boolean;
	Data: any;
	ErrorData: ErrorData | undefined;
}

interface ErrorData {
	Code: number;
	Type: ErrorType;
	Message: string;
}

type ErrorType = "jsonParse" | "unknown"