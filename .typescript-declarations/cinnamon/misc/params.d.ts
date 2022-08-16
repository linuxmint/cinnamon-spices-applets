declare namespace imports.misc.params {
    /**
     * Examines `params` and fills in default values from `defaults` for
     * any properties in `defaults` that don't appear in @params. If
     * `allowExtras` is not %true, it will throw an error if `params`
     * contains any properties that aren't in @defaults.
     * @param params caller-provided parameter object, or %null
     * @param defaults function-provided defaults object
     * @param allowExtras whether or not to allow properties not in `default`
     * @returns a new object, containing the merged parameters from
     * `params` and `default`
     */
    export function parse<T, TT>(params: TT, defaults: T, allowExtras?: boolean): T & TT;
}