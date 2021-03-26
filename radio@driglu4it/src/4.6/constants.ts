const { get_home_dir } = imports.gi.GLib;

export const CONFIG_DIR = `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;
export const MPRIS_PLUGIN_PATH = CONFIG_DIR + '/.mpris.so'