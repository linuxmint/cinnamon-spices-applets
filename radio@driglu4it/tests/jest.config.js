/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
    preset: 'ts-jest',
    // TODO: optimally would be to implement an own testEnvironment for Gjs/Cjs but this is difficult ... 
    testEnvironment: 'node',
    // needed to work with baseUrl. See https://stackoverflow.com/a/51174924/11603006
    moduleDirectories: ['node_modules', '../src'],
    setupFiles: ['./setupTests.ts'],
    clearMocks: true
};