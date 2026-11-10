//!/usr/bin/cjs
var ByteArray = imports.byteArray;
var Extension = imports.ui.extension;

var to_string = function(data) {
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
