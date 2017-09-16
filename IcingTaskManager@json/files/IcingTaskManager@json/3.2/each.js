const each = (obj, cb) => {
  if (Array.isArray(obj)) {
    for (let i = 0, len = obj.length; i < len; i++) {
      let returnValue = cb(obj[i], i);
      if (returnValue === false) {
        return;
      } else if (returnValue === null) {
        break;
      } else if (returnValue === true) {
        continue;
      }
    }
  } else {
    for (let key in obj) {
      cb(obj[key], key);
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports.each = each;
}