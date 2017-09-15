// Native objects such as CinnamonApps and MetaWindows stringify with a unique identifier.
const isEqual = function(a, b) {
 /* if (!a) {
    a = 'null';
  }
  if (!b) {
    b = 'null';
  }*/
  return a=== b;
};

const sortBy = function(array = [], property = '', direction = 'asc') {
  let arg;
  array.sort(function(a, b) {
    if (!a || !b || !a[property] || !b[property]) {
      return 0;
    }
    if (typeof (a[property] || b[property]) === 'number') {
      arg = direction === 'asc' ? a[property] - b[property] : b[property] - a[property];
    } else {
      arg = direction ===  'asc' ? a[property] > b[property] : a[property] < b[property];
    }
    return a[property] === b[property] ? 0 : +(arg) || -1;
  });
}

const isString = function(string) {
  return typeof string === 'string' || string instanceof String;
}