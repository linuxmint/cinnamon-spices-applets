"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnCommandLinePromise = void 0;
const { spawnCommandLineAsyncIO } = imports.misc.util;
const spawnCommandLinePromise = function (command) {
    return new Promise((resolve, reject) => {
        spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            (stdout) ? resolve([null, stdout, 0]) : resolve([stderr, null, exitCode]);
        });
    });
};
exports.spawnCommandLinePromise = spawnCommandLinePromise;
