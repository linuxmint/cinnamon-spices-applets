// --------------------------
// IO
// --------------------------

import { Logger } from "./services/logger";
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

/**
 * NOT WORKING, fileInfo completely empty atm
 * @param file
 */
export async function GetFileInfo(file: imports.gi.Gio.File): Promise<imports.gi.Gio.FileInfo | null> {
	return new Promise((resolve) => {
		file.query_info_async("", Gio.FileQueryInfoFlags.NONE, null, null, (obj, res) => {
			try {
				const result = file.query_info_finish(res);
				resolve(result);
				return result;
			}
			catch (e) {
				Logger.Error("Error getting file info: ", e);
				resolve(null);
				return null;
			}
		});
	});
}

export function FileExists(file: imports.gi.Gio.File): boolean {
	try {
		return file.query_exists(null);
		/*// fileInfo doesn't work, don't use for now
		let info = await this.GetFileInfo(file);
		let type = info.get_size(); // type always 0
		return true;*/
	}
	catch (e) {
		if (e instanceof Error)
			Logger.Error("Cannot get file info for '" + file.get_path() + "', error: ", e);
		return false;
	}
}

/**
 * Loads contents of a file. Can throw Gio.IOErrorEnum exception. (e.g file does not exist)
 * @param file
 */
export async function LoadContents(file: imports.gi.Gio.File): Promise<string | null> {
	return new Promise((resolve, reject) => {
		file.load_contents_async(null, (obj, res) => {
			let result: boolean | null, contents: number[] | string | null = null;
			try {
				[result, contents] = file.load_contents_finish(res);
			}
			catch (e) {
				reject(e);
				return e;
			}
			if (result != true) {
				resolve(null);
				return null;
			}
			if (contents instanceof Uint8Array) // mozjs60 future-proofing
				contents = ByteArray.toString(contents);

			resolve(contents.toString());
			return contents.toString();
		});
	});
}

export async function DeleteFile(file: imports.gi.Gio.File): Promise<boolean> {
	const result: boolean = await new Promise((resolve) => {
		file.delete_async(null, null, (obj, res) => {
			let result = null;
			try {
				result = file.delete_finish(res);
			}
			catch (e) {
				if (e instanceof Error) {
					const error: GJSError = <GJSError>e;
					if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
						resolve(true);
						return true;
					}

					Logger.Error("Can't delete file, reason: ", e);
				}
				resolve(false);
				return false;
			}

			resolve(result);
			return result;
		});
	});
	return result;
}

export async function OverwriteAndGetIOStream(file: imports.gi.Gio.File): Promise<imports.gi.Gio.FileIOStream | null> {
	const parent = file.get_parent();
	if (parent != null && !FileExists(parent))
		parent.make_directory_with_parents(null); //don't know if this is a blocking call or not

	return new Promise((resolve) => {
		file.replace_readwrite_async(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null, null, (source_object, result) => {
			try {
				const ioStream = file.replace_readwrite_finish(result);
				resolve(ioStream);
				return ioStream;
			}
			catch (e) {
				Logger.Error("Error overwriting file: ", e);
				resolve(null);
				return null;
			}
		});
	});
}

export async function WriteAsync(outputStream: imports.gi.Gio.OutputStream, buffer: string): Promise<boolean> {
	// normal write_async can't use normal string or ByteArray.fromString
	// so we save using write_bytes_async, seem to work well.
	const text = ByteArray.fromString(buffer);
	if (outputStream.is_closed())
		return false;

	return new Promise((resolve) => {
		// ByteArray is valid here
		outputStream.write_bytes_async(text as never, null, null, (obj, res) => {
			try {
				outputStream.write_bytes_finish(res);
				resolve(true);
				return true;
			}
			catch (e) {
				Logger.Error("Error writing to stream: ", e);
				resolve(false);
				return false;
			}
		});
	});
}

export async function CloseStream(stream: imports.gi.Gio.OutputStream | imports.gi.Gio.InputStream | imports.gi.Gio.FileIOStream): Promise<boolean> {
	return new Promise((resolve) => {
		stream.close_async(null, null, (obj, res) => {
			try {
				const result = stream.close_finish(res);
				resolve(result);
				return result;
			}
			catch (e) {
				Logger.Error("Error closing stream: ", e);
				resolve(false);
				return false;
			}
		});
	});
}