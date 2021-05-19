const os = require('os')

export function get_home_dir() {
    return os.homedir()
}