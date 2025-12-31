const versionCompare = (left, right) => {
  if (typeof left + typeof right != 'stringstring')
    return false;
  var a = left.split('.'),
      b = right.split('.'),
      len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
      return 1;
    } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
      return -1;
    }
  }
  return 0;
}; // End of versionCompare


module.exports = {
  versionCompare
};
