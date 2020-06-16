/*
fuzzyjs - https://github.com/gjuchault/fuzzyjs

The MIT License (MIT)

Copyright (c) 2016 Gabriel Juchault

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const {latinise} = imports.misc.util;

const {stripMarkupRegex} = require('./constants');

const fuzzy = function (q, str) {
    let originalStr = str;  // Keep original str for case
    q = q.toLowerCase();
    str = str.toLowerCase();

    let result = '';
    let steps = 0;
    let pos = 0;
    let lastI = 0;

    let i = 0;
    while (i < str.length) {
        const c = str[i];
        if (c === q[pos]) {
            result += '<b>' + originalStr[i] + '</b>';
            ++pos;
            steps += (i - lastI);
            lastI = i;
        } else {
            result += originalStr[i];
        }
        ++i;
    }
    if (pos === q.length) {
        // Score between 0 and 1 calculated by the number of spaces between letters
        // and the string length. The bigger the score is the better
        const score = q.length / (steps + 1);
        return {score, result};
    }
    return { score: 0, result: str };
};

const searchStr = function (q, str, splitChar, highlightMatch) {
    if ( !(typeof q === 'string' && q && typeof str === 'string' && str) ) {
        return { score: 0, result: str };
    }
    str = str.replace(stripMarkupRegex, '');

    const str2 = latinise(str.toLowerCase());
    const q2 = latinise(q.toLowerCase());
    let score = 0;
    if (str2.split(splitChar).some(word => word.startsWith(q2))) { //match substring (word start only)
        score = 1.2;
    } else if (str2.indexOf(q2) !== -1) { //else match substring
        score = 1.1;
    } else { //else fuzzy match and return
        let fuzzyMatch = fuzzy(q, str);
        if (highlightMatch) {
            return {score: fuzzyMatch.score, result: fuzzyMatch.result};
        } else {
            return {score: fuzzyMatch.score, result: str};
        }
    }
    //return result of substring match
    if (highlightMatch) {
        const foundposition = str2.indexOf(q2);
        const markup = str.slice(0, foundposition) + "<b>" + str.slice(foundposition, foundposition + q.length) +
                                    "</b>" + str.slice(foundposition + q.length, str.length);
        return {score: score, result: markup};
    } else {
        return {score: score, result: str};
    }
};

module.exports = searchStr;
