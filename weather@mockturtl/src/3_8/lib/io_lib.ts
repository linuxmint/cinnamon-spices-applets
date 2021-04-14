// --------------------------
// IO
// --------------------------

import { Log } from "lib/logger";
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

/**
 * NOT WORKING, fileInfo completely empty atm
 * @param file 
 */
export async function GetFileInfo(file: imports.gi.Gio.File): Promise<imports.gi.Gio.FileInfo> {
	return new Promise((resolve, reject) => {
		file.query_info_async("", Gio.FileQueryInfoFlags.NONE, null, null, (obj, res) => {
			let result = file.query_info_finish(res);
			resolve(result);
			return result;
		});
	});
}

export async function FileExists(file: imports.gi.Gio.File, dictionary: boolean = false): Promise<boolean> {
	try {
		return file.query_exists(null);
		/*// fileInfo doesn't work, don't use for now
		let info = await this.GetFileInfo(file);
		let type = info.get_size(); // type always 0
		return true;*/
	}
	catch (e) {
		Log.Instance.Error("Cannot get file info for '" + file.get_path() + "', error: ");
		global.log(e)
		return false;
	}
}

/**
 * Loads contents of a file. Can throw Gio.IOErrorEnum exception. (e.g file does not exist)
 * @param file 
 */
export async function LoadContents(file: imports.gi.Gio.File): Promise<string> {
	return new Promise((resolve, reject) => {
		file.load_contents_async(null, (obj, res) => {
			let result, contents = null;
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
	let result: boolean = await new Promise((resolve, reject) => {
		file.delete_async(null, null, (obj, res) => {
			let result = null;
			try {
				result = file.delete_finish(res);
			}
			catch (e) {
				let error: GJSError = e;
				if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
					resolve(true);
					return true;
				}

				Log.Instance.Error("Can't delete file, reason: ");
				global.log(e);
				resolve(false);
				return false;
			}

			resolve(result);
			return result;
		});
	});
	return result;

}

export async function OverwriteAndGetIOStream(file: imports.gi.Gio.File): Promise<imports.gi.Gio.IOStream> {
	if (!FileExists(file.get_parent()))
		file.get_parent().make_directory_with_parents(null); //don't know if this is a blocking call or not

	return new Promise((resolve, reject) => {
		file.replace_readwrite_async(null, false, Gio.FileCreateFlags.NONE, null, null, (source_object, result) => {
			let ioStream = file.replace_readwrite_finish(result);
			resolve(ioStream);
			return ioStream;
		});
	});
}

export async function WriteAsync(outputStream: imports.gi.Gio.OutputStream, buffer: string): Promise<boolean> {
	// normal write_async can't use normal string or ByteArray.fromString
	// so we save using write_bytes_async, seem to work well.
	let text = ByteArray.fromString(buffer);
	if (outputStream.is_closed()) return false;

	return new Promise((resolve, reject) => {
		outputStream.write_bytes_async(text as any, null, null, (obj, res) => {
			let ioStream = outputStream.write_bytes_finish(res);
			resolve(true);
			return true;
		});
	});
}

export async function CloseStream(stream: imports.gi.Gio.OutputStream | imports.gi.Gio.InputStream | imports.gi.Gio.FileIOStream): Promise<boolean> {
	return new Promise((resolve, reject) => {
		stream.close_async(null, null, (obj, res) => {
			let result = stream.close_finish(res);
			resolve(result);
			return result;
		});
	});
}