function fixedEncodeURIComponent(str) {
  // Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
  return encodeURIComponent(str).
    // Note that although RFC3986 reserves "!", RFC5987 does not,
    // so we do not need to escape it
    replace(/['()]/g, escape). // i.e., %27 %28 %29
    replace(/\*/g, '%2A').
    // The following are not required for percent-encoding per RFC5987,
    // so we can allow for a little better readability over the wire: |`^
    replace(/%(?:7C|60|5E)/g, unescape);
}
