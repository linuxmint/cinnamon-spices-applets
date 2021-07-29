import * as fs from 'fs'
import { fchmod } from 'fs/promises'

export function file_new_for_path(path: string) {

    return new File(path, false)

}

export class File {

    #path: string

    // constructor not really existing in GJS
    constructor(path: string, createNewIfNotExist: boolean) {

        if (!fs.existsSync(path)) {
            if (createNewIfNotExist) {
                fs.openSync(path, 'a')
            } else {
                throw new Error(`path: ${path} doesn't exist`)
            }
        }

        this.#path = path
    }

    get_child(name: string) {
        return new File(`${this.#path}/${name}`, true)
    }

}