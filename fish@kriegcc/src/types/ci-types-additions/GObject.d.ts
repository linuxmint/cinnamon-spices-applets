// Copied from gjsify:
// Source: https://github.com/gjsify/types/blob/main/gobject-2.0/gobject-2.0.d.ts
declare namespace imports.gi.GObject {
  type ObjectConstructor = { new (...args: any[]): Object }

  export function registerClass<
    T extends ObjectConstructor,
    Props extends { [key: string]: ParamSpec },
    Interfaces extends { $gtype: GType }[],
    Sigs extends {
      [key: string]: {
        param_types?: readonly GType[]
        [key: string]: any
      }
    },
  >(options: MetaInfo<Props, Interfaces, Sigs>, cls: T): T

  export function registerClass<T extends ObjectConstructor>(cls: T): T
}
