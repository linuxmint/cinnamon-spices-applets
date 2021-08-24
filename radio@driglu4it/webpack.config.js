const path = require('path');
const webpack = require('webpack');
const fs = require('fs')
const os = require('os')
const { exec } = require("child_process");

// Constants which might need to be changed when using this file for other apples
const DESCRIPTION = 'A simple radio applet for Cinnamon'
const NAME = 'Radio++'
const MAX_INSTANCES = 1
const CINNAMON_VERSION = '4.6' // When set to null, the build output path is set to the files applet folder, elso to a sub folder inside the applet 

// Automatic calculated constants
const UUID = __dirname.split('/').slice(-1)[0]
const APPLET_SHORT_NAME = UUID.split('@')[0]
// could both also be any other name
const BUNDLED_FILE_NAME = `${APPLET_SHORT_NAME}-applet.js`
const LIBRARY_NAME = `${APPLET_SHORT_NAME}Applet`
const FILES_DIR = `${__dirname}/files/${UUID}`
const BUILD_DIR = CINNAMON_VERSION ? `${FILES_DIR}/${CINNAMON_VERSION}` : FILES_DIR
const LOCAL_TESTING_DIR = `${os.homedir()}/.local/share/cinnamon/applets/${UUID}/`
// important that there are no spaces/tabs in the string as otherwilse 'Function main is missing` error is given   
const APPLET_JS_CONTENT =
    `const {${LIBRARY_NAME}} = require('./${APPLET_SHORT_NAME}-applet');
    
function main(metadata, orientation, panel_height, instance_id) {
    return new ${LIBRARY_NAME}.main({
        orientation,
        panelHeight: panel_height,
        instanceId: instance_id
    });
}`

createAppletJs()
createMetadata()

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'production',
    entry: './src/index.ts',
    devtool: "eval-source-map",
    target: 'node', // without webpack renames 'global'
    module: {
        rules: [
            {
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        path: BUILD_DIR,
        filename: BUNDLED_FILE_NAME,
        library: LIBRARY_NAME,
    },
    plugins: [
        {

            apply: (
              /** @type {import('webpack').Compiler}  */  compiler
            ) => {
                compiler.hooks.afterEmit.tap('afterEmitPlugin', (compilation) => {
                    copyDir(FILES_DIR, LOCAL_TESTING_DIR)
                    exec('xdotool key ctrl+alt+0xff1b', (error, stdout, stderr) => {
                        if (stderr) {
                            console.log(`stderr: ${stderr}`);
                        }
                    })
                })
            }
        }
    ]
};


function createAppletJs() {
    fs.mkdirSync(BUILD_DIR, { recursive: true })

    const APPLET_JS_PATH = BUILD_DIR + '/applet.js'
    fs.writeFileSync(APPLET_JS_PATH, APPLET_JS_CONTENT)
}

function createMetadata() {

    const metadata = {
        uuid: UUID,
        name: NAME,
        description: DESCRIPTION,
        "max-instances": MAX_INSTANCES,
        multiversion: Boolean(CINNAMON_VERSION)
    }

    const METADA_PATH = FILES_DIR + '/metadata.json'
    fs.writeFileSync(METADA_PATH, JSON.stringify(metadata))
}


function copyDir(src, dest) {
    fs.rmdirSync(dest, { recursive: true })
    fs.mkdirSync(dest, { recursive: true })

    const entries = fs.readdirSync(src, { withFileTypes: true })

    entries.map((entry) => {
        const entryPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        const isSymbolicLink = fs.lstatSync(entryPath).isSymbolicLink()

        const srcPath = isSymbolicLink ? 
            path.join(src,fs.readlinkSync(entryPath)) : 
            entryPath        
            
        return fs.lstatSync(srcPath).isDirectory()
            ? copyDir(srcPath, destPath)
            : fs.copyFileSync(srcPath, destPath)
    })

}