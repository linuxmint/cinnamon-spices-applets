declare namespace imports.misc.util {

	/**
	 * Escapes a string for use within a regular expression.
	 * @param str a string to escape
	 * @returns the escaped string
	 */
	export function escapeRegExp(str: string): string;

	/**
	 * Searches @str for URLs and returns an array of objects with %url
	 * properties showing the matched URL string, and %pos properties indicating
	 * the position within @str where the URL was found.
	 * @param str string to find URLs in
	 * @returns the list of match objects, as described above
	 */
	export function findUrls(str: string): Urls[];

	interface Urls {
		url: string;
		pos: number;
	}

	/**
	 * Runs @argv in the background, handling any errors that occur
	 * when trying to start the program.
	 * @param argv 
	 * @returns pid
	 */
	export function spawn(argv: string[]): number;

	/**
	 * Asynchronously Runs the command passed to @args. When the command is complete, the callback will
	 * be called with the contents of stdout from the command passed as the only argument.
	 * @param args an array containing all arguments of the command to be run
	 * @param callback the callback to run when the command has completed
	 */
	export function spawn_async(args: string[], callback: (stdout: string) => void): void;

	/**
	 * Runs @command_line in the background, handling any errors that
	 * occur when trying to parse or start the program.
	 * @param command_line a command line
	 * @returns pid
	 */
	export function spawnCommandLine(command_line: string): number;

	/**
	 * Runs @argv in the background. If launching @argv fails,
	 * this will throw an error.
	 * @param argv an argv array
	 * @param doNotReap whether to set the DO_NOT_REAP_CHILD flag
	 * @returns pid
	 */
	export function trySpawn(argv: string[], doNotReap?: boolean): number;

	/**
	 * Runs @command_line in the background. If launching @command_line
	 * fails, this will throw an error.
	 * @param command_line a command line
	 * @returns pid
	 */
	export function trySpawnCommandLine(command_line: string): number;

	/**
	 * Runs @command_line in the background. If the process exits without
	 * error, a callback will be called, or an error callback will be
	 * called if one is provided.
	 * @param command_line a command line
	 * @param callback called on success
	 * @param errback called on error
	 */
	export function spawnCommandLineAsync(command_line: string, callback: () => void, errback: () => void): void;

	/**
	 * spawnCommandLineAsyncIO:
	 * @command: a command
	 * @callback (function): called on success or failure
	 * @opts (object): options: argv, flags, input
	 *
	 * Runs @command in the background. Callback has three arguments -
	 * stdout, stderr, and exitCode.
	 *
	 * Returns (object): a Gio.Subprocess instance
	 */
	export function spawnCommandLineAsyncIO(command: string, callback: (stdout: string, stderr: string, exitCode: number) => any, opts?: CommanLineAsyncIOOptions): imports.gi.Gio.Subprocess;

	interface CommanLineAsyncIOOptions {
		argv: string[],
		flags: string[],
		input: any
	}

	/**
	 * Kills @processName. If no process with the given name is found,
	 * this will fail silently.
	 * @param processName a process name
	 */
	export function killall(processName: string): void;

	export function fixupPCIDescription(desc: string): string;

	/**
	 * a string
	 * @param string 
	 * @returns @string, replaced accented chars
	 */
	export function latinise(string: string): string;

	/**
	 * 
	 * @param collection an array of objects to query
	 * @param query key-value pairs to find in the collection
	 * @param indexOnly defaults to false, returns only the matching object's index if true.
	 * @returns the matched object, or null if no object
	 * in the collection matches all conditions of the query.
	 */
	export function queryCollection<T>(collection: any[], query: T, indexOnly?: boolean): T;

	/**
	 * 
	 * @param array Array to be iterated.
	 * @param callback The function to call on every iteration, should return a boolean value.
	 * @returns the index of array, else -1
	 */
	export function findIndex<T>(array: T[], callback: (item: T, i: number, array: T[]) => boolean): number;

	/**
	 * 
	 * @param arr Array to be iterated.
	 * @param callback The function to call on every iteration, should return a boolean value.
	 * @returns Returns the matched element, else null.
	 */
	export function find<T>(arr: any[], callback: (item: T, index: number, array: T[]) => boolean): T;

	/**
	 * Iteratee functions may exit iteration early by explicitly returning false.
	 * @param obj array or object to be iterated.
	 * @param callback The function to call on every iteration.
	 */
	export function each(obj: any | any[], callback: (item: any, key: any | number) => void | boolean): void;

	/**
	 * 
	 * @param arr Array to be iterated.
	 * @param callback The function to call on every iteration.
	 * @returns Returns the new filtered array.
	 */
	export function filter<T>(arr: T[], callback: (item: T, i: number, arr: T[]) => boolean): T[];

	/**
	 * 
	 * @param arr Array to be iterated.
	 * @param callback The function to call on every iteration.
	 * @returns Returns the new mapped array.
	 */
	export function map<T, T2>(arr: T[], callback: (item: T, index: number, arr: T[]) => T2): T2[];

	/**
	 * Try-catch can degrade performance in the function scope it is
	 * called in. By using a wrapper for try-catch, the function scope is
	 * reduced to the wrapper and not a potentially performance critical
	 * function calling the wrapper. Use of try-catch in any form will
	 * be slower than writing defensive code.
	 * @param callback Function to wrap in a try-catch block.
	 * @param errCallback The function to call on error.
	 * @returns The output of whichever callback gets called.
	 */
	export function tryFn<T, T2>(callback: T, errCallback: (e: Error) => T2): T | T2;

	/**
	 * Convenience wrapper for a Mainloop.timeout_add loop that
	 * returns false
	 * @param callback Function to call at the end of the timeout.
	 * @param ms Milliseconds until the timeout expires.
	 * @returns The ID of the loop.
	 */
	export function setTimeout(callback: Function, ms: number): number;

	/**
	 * Convenience wrapper for Mainloop.source_remove.
	 * @param id The ID of the loop to remove.
	 */
	export function clearTimeout(id: number): void;

	/**
	 * Convenience wrapper for a Mainloop.timeout_add loop that
	 * returns true.
	 * @param callback Function to call on every interval.
	 * @param ms Milliseconds between invocations.
	 * @returns The ID of the loop.
	 */
	export function setInterval(callback: Function, ms: number): number;

	/**
	 * Convenience wrapper for Mainloop.source_remove.
	 * @param id The ID of the loop to remove.
	 */
	export function clearInterval(id: number): void;

	/**
	 * 
	 * @param callback unction to throttle.
	 * @param interval Milliseconds to throttle invocations to.
	 * @param callFirst Specify invoking on the leading edge of the timeout.
	 * @returns The output of @callback.
	 */
	export function throttle<T>(callback: (...args: any) => T, interval: number, callFirst: boolean): T;

	/**
	 * This will iterate @object and assign null to every property
	 * value except for keys specified in the @reserved array. Calling unref()
	 * in an object that has many references can make garbage collection easier
	 * for the engine. This should be used at the end of the lifecycle for
	 * classes that do not reconstruct very frequently, as GC thrashing can
	 * reduce performance.
	 * @param object Object to be nullified.
	 * @param reserved List of special keys (string) that should not be assigned null.
	 */
	export function unref(object: any, reserved?: string[]): void;

	/**
	 * 
	 * @param obj GObject to inspect
	 * @param r defaults to 0
	 * @returns JS representation of the passed GObject
	 */
	export function getGObjectPropertyValues(obj: imports.gi.GObject.Object, r?: number): any;
}
