export class SignalManager {

    private _storage: any[]

    constructor() {
        this._storage = []
    }

    connect(obj: any, sigName: string, callback: Function) {

        const id = obj.connect(sigName, callback)

        this._storage.push([sigName, obj, callback, id])
    }
}