import { Logger } from "./services/logger";
import type { WeatherButton } from "../ui_elements/weatherbutton";

const { spawnCommandLineAsyncIO, spawnCommandLineAsync } = imports.misc.util;

/**
 * Doesn't do JSON typechecking, you have to do that manually
 * @param command
 */
export async function SpawnProcessJson<TData>(command: string[]): Promise<TypedResponse<TData> | TypedFailResponse> {
	const response = await SpawnProcess(command);
	if (!response.Success)
		return response as TypedFailResponse;

	try {
		response.Data = JSON.parse(response.Data) as never;
		return response as TypedResponse<TData>;
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
		return response as TypedFailResponse;
	}
}


export function Literal(command: string): string {
	return ("'" + command.replace(/'/g, "'\"'\"'") + "' ");
}


/** Spawns a command and await for the output it gives */
export async function SpawnProcess(command: string[]): Promise<GenericResponse> {
	// prepare command
	const cmd = command.join(" ");

	Logger.Debug("Spawning command: " + cmd);

	let response;
	if (spawnCommandLineAsyncIO === undefined) {
		response = await new Promise((resolve) => {
			spawnCommandLineAsync(cmd,
				() => {
					resolve({
						Success: true,
						ErrorData: undefined,
						Data: ""
					});
				},
				() => {
					resolve({
						Success: false,
						ErrorData: {
							Code: -1,
							Message: "Command failed",
							Type: "unknown"
						},
						Data: ""
					});
				}
			)
		});
	}
	else {
		response = await new Promise((resolve) => {
			spawnCommandLineAsyncIO(cmd, (aStdout: string, err: string, exitCode: number) => {
				const result: GenericResponse = {
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
			},);
		});
	}

	return response as GenericResponse;
}

export function OpenUrl(element: WeatherButton): void {
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
	Data: unknown;
	ErrorData: ErrorData | undefined;
}

interface ErrorData {
	Code: number;
	Type: ErrorType;
	Message: string;
}

type ErrorType = "jsonParse" | "unknown"