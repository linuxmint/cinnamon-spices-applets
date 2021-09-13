import { isObject, mapValues } from "lodash";

const { Variant } = imports.gi.GLib

declare global {
  interface String {
    replaceAll(substr: string, replacement: string): string
  }

  // Comment copied from node_modules/typescript/lib/lib.es2019.array.d.ts
  interface Array<T> {
    /**
     * Calls a defined callback function on each element of an array. Then, flattens the result into
     * a new array.
     * This is identical to a map followed by flat with depth 1.
     *
     * @param callback A function that accepts up to three arguments. The flatMap method calls the
     * callback function one time for each element in the array.
     * @param thisArg An object to which the this keyword can refer in the callback function. If
     * thisArg is omitted, undefined is used as the this value.
    */
    flatMap<U, This = undefined>(
      callback: (this: This, value: T, index: number, array: T[]) => U | ReadonlyArray<U>,
      thisArg?: This
    ): U[]
  }
}

export function initPolyfills() {

  // included in LM 20.2 (cinnamon 5.0.4) but not in LM 20.0 (cinnamon 4.6.7). (20.1 not tested)
  // Copied from https://stackoverflow.com/a/17606289/11603006
  if (!String.prototype.hasOwnProperty('replaceAll')) {
    String.prototype.replaceAll = function (search: string, replacement: string) {
      var target = this;
      return target.split(search).join(replacement);
    };
  }



  // @ts-ignore
  if (!Array.prototype.flat) {
    Object.defineProperty(Array.prototype, 'flat', {
      configurable: true,
      writable: true,
      value: function () {
        var depth =
          typeof arguments[0] === 'undefined' ? 1 : Number(arguments[0]) || 0;
        var result: any[] = [];
        var forEach = result.forEach;

        var flatDeep = function (arr: any[], depth: any) {
          forEach.call(arr, function (val: any) {
            if (depth > 0 && Array.isArray(val)) {
              flatDeep(val, depth - 1);
            } else {
              result.push(val);
            }
          });
        };

        flatDeep(this, depth);
        return result;
      },
    });
  }


  // Copied from https://github.com/behnammodi/polyfill/blob/master/array.polyfill.js
  // included in LM 20.1 (cinnamon 4.8) but not in LM 20.0 (cinnamon 4.6.7)
  if (!Array.prototype.flatMap) {
    Object.defineProperty(Array.prototype, 'flatMap', {
      configurable: true,
      writable: true,
      value: function () {
        return Array.prototype.map.apply(this, arguments).flat(1);
      },
    });
  }


  // included in LM 20.1 (cinnamon 4.8) but not in LM 20.0 (cinnamon 4.6.7)
  Variant.prototype.deepUnpack = Variant.prototype.deep_unpack

  // included in LM 20.1 (cinnamon 4.8) but not in LM 20.0 (cinnamon 4.6.7)
  // TODO: write unit test. Are arrays handled correct??
  if (!Variant.prototype.recursiveUnpack) {
    Variant.prototype.recursiveUnpack = function () {
      function recursiveUnpackKey(key: any) {

        if (key instanceof Variant) {
          const deepUnpackedVal = key.deep_unpack()

          return deepUnpackedVal instanceof Variant
            ? deepUnpackedVal.recursiveUnpack() : deepUnpackedVal
        }

        return key
      }

      const deepUnpackedVal = this.deep_unpack()

      return isObject(deepUnpackedVal) ? mapValues(deepUnpackedVal, recursiveUnpackKey) : deepUnpackedVal
    }
  }
}