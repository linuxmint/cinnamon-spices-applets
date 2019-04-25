#!/usr/bin/python

# Python 3.5+
import os
import subprocess

''' APPEND NEW FILES INFO OTHER THAN APPLET TO HERE
    key: variable name in applet.ts (what was imported to)
    value: [ module classname, filename ]'''
files={
    "ipApi": ["IpApi", "ipApi.js"],
    "darkSky": ["DarkSky", "darkSky.js"],
    "openWeatherMap": ["OpenWeatherMap", "openWeatherMap.js"]
    }

# Set up Paths, working relative to script path
path = os.path.dirname(os.path.realpath(__file__))
srcPath = path + "/src/"
dstPath = path + "/files/weather@mockturtl/3.4/"


######################################################################

# 3.4 does not have this, we need to include this as it is being used in DarkSky module
arrayIncludesPoly = '''// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(valueToFind, fromIndex) {

      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      // 1. Let O be ? ToObject(this value).
      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If len is 0, return false.
      if (len === 0) {
        return false;
      }

      // 4. Let n be ? ToInteger(fromIndex).
      //    (If fromIndex is undefined, this step produces the value 0.)
      var n = fromIndex | 0;

      // 5. If n ≥ 0, then
      //  a. Let k be n.
      // 6. Else n < 0,
      //  a. Let k be len + n.
      //  b. If k < 0, let k be 0.
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

      function sameValueZero(x, y) {
        return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
      }

      // 7. Repeat, while k < len
      while (k < len) {
        // a. Let elementK be the result of ? Get(O, ! ToString(k)).
        // b. If SameValueZero(valueToFind, elementK) is true, return true.
        if (sameValueZero(o[k], valueToFind)) {
          return true;
        }
        // c. Increase k by 1. 
        k++;
      }

      // 8. Return false
      return false;
    }
  });
}'''

# Compile
subprocess.run(["tsc", "-p", "../tsconfig.34.json"], cwd=srcPath)
subprocess.run(["rm", "@cinnamon.js"], cwd=srcPath)

# Write contents to temporary files
temp = open(srcPath + "/appletTemp.js", "w")
temp.write(arrayIncludesPoly)

with open(srcPath + "/applet.js", "r") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        # Reached main, append all other files contents before it
        if line.startswith("function main("):
            for key in files:
                with open(srcPath + "/" + files[key][1], "r") as file:
                    passedGenerator = False
                    fileLines = file.readlines()
                    # Do not Write generators
                    for j, l in enumerate(fileLines):
                        if (l.startswith("var " + str(files[key][0]))):
                            passedGenerator = True
                        if (passedGenerator): temp.write(l)
        # Writing applet.js lines
        temp.write(line)

temp.close()

# Cleanup
subprocess.run(["mv", srcPath +  "appletTemp.js", dstPath + "applet.js"], cwd=path)
subprocess.run(["rm", "applet.js"], cwd=srcPath)
for key in files:
    subprocess.run(["rm", files[key][1]], cwd=srcPath)








