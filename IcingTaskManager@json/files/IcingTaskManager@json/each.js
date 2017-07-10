const each = (obj, cb)=>{
  if (Array.isArray(obj)) {
    for (let i = 0, len = obj.length; i < len; i++) {
      if (cb(obj[i], i) === false) {
        return;
      }
    }
  } else {
    for (let key in obj) {
      cb(obj[key], key);
    }
  }
};