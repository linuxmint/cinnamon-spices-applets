const { spawnCommandLineAsyncIO, spawnCommandLine } = imports.misc.util

// Wrapper for Cinnamon's CommandLine functions to provide a common interface for executing shell commands.
// These utility methods abstract away the original functions, allowing for easier integration and potential future enhancements.
// By using these wrappers, you can implement additional features such as security checks, command whitelisting, and error handling.
// This approach also simplifies the codebase by providing a consistent API for command execution, making it easier to maintain and extend.

export function runCommandAsyncIO(
  command: string,
  callback: (output: string) => void,
  errorCallback: (error: Error) => void,
): void {
  spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
    if (exitCode !== 0) {
      errorCallback(new Error(`Failed to run command ${command}. ${stderr}`))
      return
    }
    callback(stdout)
  })
}

export function runCommand(command: string): void {
  spawnCommandLine(command)
}

export function openWebsite(url: string): void {
  runCommand("xdg-open " + url)
}
