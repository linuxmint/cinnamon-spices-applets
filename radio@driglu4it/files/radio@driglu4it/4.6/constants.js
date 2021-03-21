"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MPRIS_PLUGIN_PATH = exports.CONFIG_DIR = void 0;
const { get_home_dir } = imports.gi.GLib;
exports.CONFIG_DIR = `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;
exports.MPRIS_PLUGIN_PATH = exports.CONFIG_DIR + '/.mpris.so';
