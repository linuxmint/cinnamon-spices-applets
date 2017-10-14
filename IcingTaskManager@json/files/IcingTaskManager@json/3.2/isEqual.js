// Native objects such as CinnamonApps and MetaWindows stringify with a unique identifier.
const isEqual = function(a, b) {
  if (!a) {
    a = 'null';
  }
  if (!b) {
    b = 'null';
  }
  return a.toString() === b.toString();
};