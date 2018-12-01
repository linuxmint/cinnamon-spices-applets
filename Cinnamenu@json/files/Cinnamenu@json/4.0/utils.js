const GObject = imports.gi.GObject;
const Mainloop = imports.mainloop;

const sortBy = function(array = [], property = '', direction = 'asc') {
  let arg;
  array.sort(function(a, b) {
    if (!a || !b || !a[property] || !b[property]) {
      return -1;
    }
    if (typeof (a[property] || b[property]) === 'number') {
      arg = direction === 'asc' ? a[property] - b[property] : b[property] - a[property];
    } else {
      arg = direction ===  'asc' ? a[property] > b[property] : a[property] < b[property];
    }
    return a[property] === b[property] ? 0 : +(arg) || -1;
  });
}

const sortDirs = (dirs) => {
  dirs.sort(function(a, b) {
    let prefCats = ['administration', 'preferences'];
    let menuIdA = a.get_menu_id().toLowerCase();
    let menuIdB = b.get_menu_id().toLowerCase();
    let prefIdA = prefCats.indexOf(menuIdA);
    let prefIdB = prefCats.indexOf(menuIdB);
    if (prefIdA < 0 && prefIdB >= 0) {
      return -1;
    }
    if (prefIdA >= 0 && prefIdB < 0) {
      return 1;
    }
    let nameA = a.get_name().toLowerCase();
    let nameB = b.get_name().toLowerCase();
    if (nameA > nameB) {
      return 1;
    }
    if (nameA < nameB) {
      return -1;
    }
    return 0;
  });
  return dirs;
};
