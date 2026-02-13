import { UUID } from "consts"
const { isError } = imports.ui.main

export type LogLevel = "Info" | "Debug" | "Warning" | "Error"

export function mapStringToLogLevel(logLevel: string): LogLevel {
  if (logLevel === "Info" || logLevel === "Debug" || logLevel === "Warning" || logLevel === "Error") {
    return logLevel
  }
  throw new Error(`Invalid log level value: ${logLevel}`)
}

const DEFAULT_LOG_LEVEL = "Info"
const logLevelPriority: Record<LogLevel, number> = {
  Error: 1,
  Warning: 2,
  Info: 3,
  Debug: 4,
}

// This Logger is a wrapper for global.log, providing additional control and adding applet-specific information to the log lines.
//
// The implementation is based on the Log class from the weather@mockturtl applet. Adjustments and simplifications have been made.
// Source: https://github.com/linuxmint/cinnamon-spices-applets/blob/master/weather%40mockturtl/src/3_8/lib/services/logger.ts
class Logger {
  private instanceId: number | undefined
  private logLevel: LogLevel

  public constructor(instanceId?: number, logLevel: LogLevel = DEFAULT_LOG_LEVEL) {
    this.instanceId = instanceId
    this.logLevel = logLevel
  }

  public setInstanceId(instanceId: number): void {
    this.instanceId = instanceId
  }

  public setLogLevel(logLevel: LogLevel) {
    this.logLevel = logLevel
  }

  public logInfo(...msg: (string | number)[]): void {
    if (this.canLog("Info")) {
      global.log(this.formatMessage("Info", ...msg))
    }
  }

  public logDebug(...msg: (string | number)[]): void {
    if (this.canLog("Debug")) {
      global.log(this.formatMessage("Debug", ...msg))
    }
  }

  public logWarning(...msg: (string | number)[]): void {
    if (this.canLog("Warning")) {
      global.logWarning(this.formatMessage("Warning", ...msg))
    }
  }

  public logError(msg: string, error?: unknown): void {
    if (this.canLog("Error")) {
      // first log the formatted message
      global.logError(this.formatMessage("Error", msg))
      // separately log the error which prints a stack trace
      if (this.isCjsOrGlibError(error)) {
        global.logError(error)
      }
    }
  }

  private formatMessage(logLevel: LogLevel, ...msg: (string | number)[]): string {
    const formattedMessage = msg.join(" ")
    return `[${UUID}#${this.instanceId}:${logLevel}]: ${formattedMessage}`
  }

  private canLog(logLevel: LogLevel): boolean {
    return logLevelPriority[logLevel] <= logLevelPriority[this.logLevel]
  }

  private isCjsOrGlibError(error: unknown): error is imports.ui.main.CjsError | imports.gi.GLib.Error {
    return isError(error)
  }
}

// make logger a singleton
export const logger = new Logger()
