const os = require('os')
import { mapValues, isObject } from 'lodash'

export function get_home_dir() {
    return os.homedir()
}

export class Variant {

    #unPackedValue: any

    // constructor at the moment simplified for testing purposes
    constructor(type: string, value: any) {

        const validValues = new Map<string, boolean>()

        validValues.set('s', typeof value === 'string')
        validValues.set('a{sv}', Object.values((value as Object)).every(val => val instanceof Variant))
        validValues.set('d', typeof value === 'number')

        if (!validValues.get(type)) throw new TypeError('Variant type/value combination is not valid')

        this.#unPackedValue = value
    }

    public unpack() {
        return this.#unPackedValue
    }


    public recursiveUnpack() {

        function recursiveUnpackKey(key: any) {

            if (key instanceof Variant) {

                const deepUnpackedVal = key.deepUnpack()

                if (deepUnpackedVal instanceof Variant) {
                    return deepUnpackedVal.recursiveUnpack()
                } else {
                    return deepUnpackedVal
                }
            } else {
                return key
            }
        }

        return isObject(this.#unPackedValue) ? mapValues(this.#unPackedValue, recursiveUnpackKey) : this.#unPackedValue

    }

    public deep_unpack() {
        // not really true - Simplified TODO: improve (can be good tested with MPRIS Metadata)
        return this.#unPackedValue
    }

    public deepUnpack() {
        return this.deep_unpack()
    }

    public static new_string(str: string) {
        return new Variant('s', str)
    }

    public static new_double(value: number) {
        return new Variant('d', value)
    }

}