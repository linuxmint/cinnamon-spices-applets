/*
Knuth-Morris-Pratt string searching algorithm in Javascript
https://github.com/miguelmota/knuth-morris-pratt/

MIT license

Copyright (C) 2015 Miguel Mota

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
*/

var kmp = function(s, w) {
  if (kmp.isNumber(w)) w = ''+w;
  if (kmp.isNumber(s)) s = ''+s;
  if (!(kmp.isString(s) || kmp.isArray(s))) return -1;
  if (!(kmp.isString(w) || kmp.isArray(w))) return -1;
  var m = 0; // start of s
  var i = 0; // start of w
  var t = kmp.table(w);

  while (m + i < s.length) {
    if (w[i] === s[m+i]) {
      if (i === w.length - 1) {
        return m;
      }
      i = i + 1;
    } else {
      if (t[i] > -1) {
        m = m+i - t[i];
        i = t[i];
      } else {
        i = 0;
        m = m + 1;
      }
    }
  }

  return -1;
}

/**
 * table
 * @desc Returns "Partial match" table
 * @param {string} word - search word
 */
kmp.table = function kmpTable(w) {
  var t = [];
  var pos = 2; // current position in T
  var cnd = 0; // index in w of the next character of the current candidate substring

  t[0] = -1;
  t[1] = 0;

  while (pos < w.length) {
    // substring continues
    if (w[pos-1] === w[cnd]) {
      cnd = cnd + 1;
      t[pos] = cnd;
      pos = pos + 1;
    // it doesn't but we can fall back
    } else if (cnd > 0) {
      cnd = t[cnd];
    // we have run out of candidates
    } else {
      t[pos] = 0;
      pos = pos + 1;
    }
  }

  return t;
};

kmp.isArray = function(v) {
  return Array.isArray(v);
};

kmp.isString = function(v) {
  return typeof v === 'string' || v instanceof String;
};

kmp.isDefined = function(v) {
  return !(typeof v === 'undefined' || typeof v === null);
};

kmp.isNumber = function(v) {
  return !isNaN(v);
};