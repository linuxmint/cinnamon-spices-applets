const each = (obj, cb)=>{
  if (Array.isArray(obj)) {
    for (let i = 0, len = obj.length; i < len; i++) {
      cb(obj[i], i);
    }
  } else {
    for (let key in obj) {
      cb(obj[key], key);
    }
  }
};