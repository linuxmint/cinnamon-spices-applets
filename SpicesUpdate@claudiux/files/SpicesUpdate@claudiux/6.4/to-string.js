//!/usr/bin/cjs
const ByteArray = imports.byteArray;
const Extension = imports.ui.extension;

const to_string = function(data) {
  if (ByteArray.hasOwnProperty("toString")) {
    return ""+ByteArray.toString(data);
  } else {
    return ""+data.toString();
  }
}

if (!Extension.getCurrentExtension)
module.exports = {
  to_string
}
