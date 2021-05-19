import { Widget, WidgetOptions } from './St'
const fs = require('fs')

export class GenericContainer extends Widget {
    constructor(options?: WidgetOptions) {
        super(options)
    }
}

export function get_file_contents_utf8_sync(path: string) {
    return fs.readFileSync(path, 'utf8').toString()
}