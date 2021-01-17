"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Http = exports.Logger = void 0;
const httpLib_1 = require("./httpLib");
const logger_1 = require("./logger");
exports.Logger = new logger_1.Log();
exports.Http = new httpLib_1.HttpLib();
