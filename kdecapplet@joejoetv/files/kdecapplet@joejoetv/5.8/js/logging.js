/**
 * Supported log levels.
 * @constant
 * @enum {number}
 */
const LogLevel = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,

    /**
     * Map from enum values to names as strings.
     * @constant
     * @static
     */
    names: {
        0: "TRACE",
        1: "DEBUG",
        2: "INFO",
        3: "WARN",
        4: "ERROR",
    },
}

/**
 * The log level that is currently set for the whole applet.
 * @constant {LogLevel}
 */
const LOG_LEVEL = LogLevel.INFO

/**
 * @classdesc Provides simple logging functionality based on log levels {@link LogLevel}
 */
class Logger {
    /**
     * @param {!string} identifier The identifier of the application/applet.
     * @param {?string} context The name/identifier of the current context.
     */
    constructor(identifier, context = null) {
        if (typeof identifier !== "string" || identifier === "")
            throw new Error("Identifier has to be given and a string");

        this.identifier = identifier;
        this.context = context;
    }

    _formatMsg(level, msg, context_override = null) {
        if (Object.values(LogLevel).includes(level) == false) {
            try {
                throw new Error(`Log Level value ${level} does not exist!`);
            } catch (error) {
                global.logError(error);
                throw error;
            }
        }
        let ctx = this.context !== null ? this.context : context_override;
        return `[${this.identifier}/${LogLevel.names[level]}]${ctx === null ? '' : ` (${this.context})`} ${msg}`;
    }

    /**
     * Send a message with logging level {@link LogLevel.TRACE}.
     * @param {!string} msg The message
     * @param {?string} ctx Optional override of the context
     */
    trace(msg, ctx = null) {
        if (LogLevel.TRACE >= LOG_LEVEL)
            global.log(this._formatMsg(LogLevel.TRACE, msg, ctx));
    }

    /**
     * Send a message with logging level {@link LogLevel.DEBUG}.
     * @param {!string} msg The message
     * @param {?string} ctx Optional override of the context
     */
    debug(msg, ctx = null) {
        if (LogLevel.DEBUG >= LOG_LEVEL)
            global.log(this._formatMsg(LogLevel.DEBUG, msg, ctx));
    }

    /**
     * Send a message with logging level {@link LogLevel.INFO}.
     * @param {!string} msg The message
     * @param {?string} ctx Optional override of the context
     */
    info(msg, ctx = null) {
        if (LogLevel.INFO >= LOG_LEVEL)
            global.log(this._formatMsg(LogLevel.INFO, msg, ctx));
    }

    /**
     * Send a message with logging level {@link LogLevel.WARN}.
     * @param {!string} msg The message
     * @param {?string} ctx Optional override of the context
     */
    warn(msg, ctx = null) {
        if (LogLevel.WARN >= LOG_LEVEL)
            global.logWarning(this._formatMsg(LogLevel.WARN, msg, ctx));
    }

    /**
     * Send a message with logging level {@link LogLevel.ERROR} with optionally attached error information.
     * @param {!string} msg The message
     * @param {?Error} error Optional error
     * @param {?string} ctx Optional override of the context
     */
    error(msg, error = null, ctx = null) {
        if (LogLevel.ERROR >= LOG_LEVEL)
            global.logError(this._formatMsg(LogLevel.ERROR, msg, ctx), error);
    }
}