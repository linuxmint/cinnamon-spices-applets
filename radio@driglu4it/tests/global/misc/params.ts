export function parse(params: any, defaults: any, allowExtras?: boolean) {
    let ret = {};

    if (!params)
        return Object.assign({}, defaults);

    for (let prop in params) {
        if (!(prop in defaults) && !allowExtras)
            throw new Error('Unrecognized parameter "' + prop + '"');
        ret[prop] = params[prop];
    }

    for (let prop in defaults) {
        if (!(prop in params))
            ret[prop] = defaults[prop];
    }

    return ret;

}