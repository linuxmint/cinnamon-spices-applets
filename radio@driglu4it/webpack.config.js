const path = require('path');
const webpack = require('webpack');
const fs = require('fs')
const { exec } = require("child_process");

// Constants which might need to be changed when using this file for other apples
const DESCRIPTION = "A radio applet with 1000's of searchable stations, mpris support, youtube-download function and more"
const NAME = 'Radio++'
const MAX_INSTANCES = 1
const CINNAMON_VERSION = '4.6' // When set to null, the build output path is set to the files applet folder, else to a sub dir inside the applet files dir
const APPLET_VERSION = '2.1.4'

// Automatic calculated constants
const UUID = __dirname.split('/').slice(-1)[0]
const APPLET_SHORT_NAME = UUID.split('@')[0]
const BUNDLED_FILE_NAME = `${APPLET_SHORT_NAME}-applet.js`
const LIBRARY_NAME = `${APPLET_SHORT_NAME}Applet`
const FILES_DIR = `${__dirname}/files/${UUID}`
const BUILD_DIR = CINNAMON_VERSION ? `${FILES_DIR}/${CINNAMON_VERSION}` : FILES_DIR
// important that there are no spaces/tabs in the string as otherwilse 'Function main is missing` error is given   
const APPLET_JS_CONTENT =
    `// THIS FILE IS AUTOGENERATED!
const { panelManager } = imports.ui.main
const { getAppletDefinition } = imports.ui.appletManager;
const {${LIBRARY_NAME}} = require('./${APPLET_SHORT_NAME}-applet');
    
function main(metadata, orientation, panel_height, instance_id) {
    __meta.instanceId = instance_id
    __meta.orientation = orientation

    const appletDefinition = getAppletDefinition({applet_id: instance_id})
    const panel = panelManager.panels.find(panel => panel?.panelId === appletDefinition.panelId)
    const locationLabel = appletDefinition.location_label

    __meta.panel = panel
    __meta.locationLabel = locationLabel

    return new ${LIBRARY_NAME}.main();
}`

createAppletJs()
createMetadata()

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'production',
    entry: './src/index.ts',

    // devtool: "eval-source-map",
    target: 'node', // without webpack renames 'global'
    optimization: {
        minimize: false,
        usedExports: true,
    },
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
                    exec(`cinnamon-install-spice applet ${FILES_DIR} && xdotool key ctrl+alt+0xff1b`, (error, stdout, stderr) => {
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
        multiversion: Boolean(CINNAMON_VERSION),
        version: APPLET_VERSION
    }

    const METADA_PATH = FILES_DIR + '/metadata.json'
    fs.writeFileSync(METADA_PATH, JSON.stringify(metadata))
}