const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

const to_string = function(data) {
  if (ByteArray.toString) {
    return ByteArray.toString(data);
  } else {
    return ""+data;
  }
  //~ return stringFromUTF8Array(data);
}

//~ const stringFromUTF8Array = function(data) {
  //~ const extraByteMap = [ 1, 1, 1, 1, 2, 2, 3, 0 ];
  //~ var count = data.length;
  //~ var str = "";

  //~ for (var index = 0;index < count;)
  //~ {
    //~ var ch = data[index++];
    //~ if (ch & 0x80)
    //~ {
      //~ var extra = extraByteMap[(ch >> 3) & 0x07];
      //~ if (!(ch & 0x40) || !extra || ((index + extra) > count))
        //~ return null;

      //~ ch = ch & (0x3F >> extra);
      //~ for (;extra > 0;extra -= 1)
      //~ {
        //~ var chx = data[index++];
        //~ if ((chx & 0xC0) != 0x80)
          //~ return null;

        //~ ch = (ch << 6) | (chx & 0x3F);
      //~ }
    //~ }

    //~ str += String.fromCharCode(ch);
  //~ }

  //~ return str;
//~ }
