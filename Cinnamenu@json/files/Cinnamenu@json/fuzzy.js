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

var fuzzy = function (q, str, opts) {
  if (typeof q !== 'string' || typeof str !== 'string') {
    return {
      score: 0,
      result: str
    };
  }

  if (!str) {
    return {
      score: 0,
      result: str
    };
  }

  if (!q) {
    return {
      score: 1,
      result: str
    };
  }

  // Keep original str for case
  let originalStr = str;

  opts = Object.assign({
    caseSensitive: false,
    before: '',
    after: ''
  }, opts);

  if (!opts.caseSensitive) {
    q = q.toLowerCase();
    str = str.toLowerCase();
  }

  if (q === str) {
    return {
      score: 1,
      result: opts.before + originalStr + opts.after
    };
  }

  // String with surrounded results
  let result = '';

  // Number of spaces between matches
  let steps = 0;

  // Actual pattern position
  let pos = 0;

  // Last match position
  let lastI = 0;

  let i = 0;
  while (i < str.length) {
    const c = str[i];

    if (c === q[pos]) {
      result += opts.before + originalStr[i] + opts.after;

      // Move to the next pattern character
      pos += 1;

      // Add spaces between the last match to steps
      steps += (i - lastI);

      // Reset counter to the actual position in string
      lastI = i;
    } else {
      result += originalStr[i];
    }

    ++i;
  }

  if (pos === q.length) {
    // Score between 0 and 1 calculated by the number of spaces
    // between letters and the string length.
    // The biggest the score is the better
    const score = q.length / (steps + 1);

    return {
      score: score,
      result: result
    };
  }

  return {
    score: 0,
    result: str
  };
}