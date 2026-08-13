const ByteArray = imports.byteArray;
const Extension = imports.ui.extension;

var to_string = function(data) {
  return ByteArray.toString(data);
}

if (!Extension.getCurrentExtension) {
  module.exports = {
    to_string
  }
}
