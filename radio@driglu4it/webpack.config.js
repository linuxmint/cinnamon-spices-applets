
const path = require('path');
const webpack = require('webpack');

// TODO: use env variable to share between bash script and the config. Or bash script even necessary?
const cinnamonVersion = '4.6'
const appletName = __dirname.split('/').slice(-1)[0]

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
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, `files/${appletName}/${cinnamonVersion}/`),
        filename: 'radio-applet.js',
        library: "radioApplet",
    },
};