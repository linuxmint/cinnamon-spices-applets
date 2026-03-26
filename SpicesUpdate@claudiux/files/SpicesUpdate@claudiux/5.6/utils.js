const versionCompare = (left, right) => {
  if (typeof left + typeof right != "stringstring")
    return false;

  let a = left.split(".");
  let b = right.split(".");
  let len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    let l = parseInt(a[i], 10);
    let r = parseInt(b[i], 10);
    if (isNaN(l) || isNaN(r))
      return false;
    if (l > r) {
      return 1;
    } else if (l < r) {
      return -1;
    }
  }

  return 0;
};

module.exports = {
  versionCompare
};
