const { spawnCommandLineAsyncIO } = imports.misc.util;

export const spawnCommandLinePromise = function (command: string) {
    return new Promise<[stdout: string | null, stderr: string | null, exitCode: number]>((resolve, reject) => {

        spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            (stdout) ? resolve([null, stdout, 0]) : resolve([stderr, null, exitCode])
        })
    })
}


