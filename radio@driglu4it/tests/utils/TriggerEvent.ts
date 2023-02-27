interface RegisteredCallback {
    type: string, 
    callback: Function
}

// This unfortunately doesn't work https://github.com/microsoft/TypeScript/issues/32164
//type Event = Parameters<imports.gi.Clutter.Actor["connect"]>
export function triggerEvent(actor: imports.gi.Clutter.Actor, event: string){

    // @ts-ignore
    const registeredCallbacks = actor["_signals"];

    (registeredCallbacks as RegisteredCallback[]).forEach(registeredCallback => {
        if (registeredCallback.type===event){
            registeredCallback.callback()
        }
    })

}
