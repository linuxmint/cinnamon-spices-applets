const UUID = __dirname.split('/').slice(-1)[0]

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'cjs-jest-test-runtime',
    //testEnvironment: '/home/jonathan/Projekte/cjs-jest-test-runtime/dist/cjsEnvironment.js',
    // needed to work with baseUrl. See https://stackoverflow.com/a/51174924/11603006
    moduleDirectories: ['node_modules', './src'],
    clearMocks: true, 
    globals: {
        "ts-jest": {
            tsconfig: './tests/tsconfig.json'
        }, 
        "__meta": {
            uuid: UUID
        }
    }
};