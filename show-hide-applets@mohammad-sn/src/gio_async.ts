// Promise wrappers around the Gio async APIs, so that no file I/O happens on
// Cinnamon's main loop. (`Gio._promisify` is unavailable in the type defs.)

const {
  gi: { Gio },
} = imports;

type File = imports.gi.Gio.File;

function settle<T>(
  resolve: (value: T) => void,
  reject: (reason: Error) => void,
  finish: () => T,
) {
  try {
    resolve(finish());
  } catch (error) {
    reject(error as Error);
  }
}

export function matches_io_error(
  error: unknown,
  code: imports.gi.Gio.IOErrorEnum,
) {
  const glib_error = error as imports.gi.GLib.Error;
  return (
    typeof glib_error.matches === "function" &&
    glib_error.matches(Gio.IOErrorEnum as unknown as number, code)
  );
}

export function load_contents_async(file: File) {
  return new Promise<number[]>((resolve, reject) => {
    file.load_contents_async(null, (_source, result) => {
      settle(resolve, reject, () => file.load_contents_finish(result)[1]);
    });
  });
}

export async function query_exists_async(file: File) {
  try {
    await load_contents_async(file);
    return true;
  } catch (error) {
    if (matches_io_error(error, Gio.IOErrorEnum.NOT_FOUND)) {
      return false;
    }
    throw error;
  }
}
