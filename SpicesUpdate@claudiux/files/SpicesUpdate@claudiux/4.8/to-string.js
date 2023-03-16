const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

const to_string = function(data) {
  if (ByteArray.hasOwnProperty("toString")) {
    return ""+ByteArray.toString(data);
  } else {
    return ""+data;
  }
}
