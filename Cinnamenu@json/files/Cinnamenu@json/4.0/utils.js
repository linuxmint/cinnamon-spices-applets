const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

// Work around Cinnamon#8201
const tryFn = function(callback, errCallback) {
    try {
        return callback();
    } catch (e) {
        if (typeof errCallback === 'function') {
            return errCallback(e);
        }
    }
};

const readFileAsync = function(file, opts = {utf8: true}) {
  const {utf8} = opts;
  return new Promise(function(resolve, reject) {
    if (typeof file === 'string' || file instanceof String) {
      file = Gio.File.new_for_path(file);
    }
    if (!file.query_exists(null)) reject(new Error('File does not exist.'));
    file.load_contents_async(null, function(object, result) {
      tryFn(() => {
        let [success, data] = file.load_contents_finish(result);
        if (!success) return reject(new Error('File cannot be read.'));
        if (utf8) {
          if (data instanceof Uint8Array) data = ByteArray.toString(data);
          else data = data.toString();
        }
        resolve(data);
      }, (e) => reject(e));
    });
  });
};

const readJSONAsync = function(file) {
  return readFileAsync(file).then(function(json) {
    return JSON.parse(json);
  });
};

const Mainloop = imports.mainloop;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;

class ShowTooltip {
    constructor(actor, xpos, ypos, center_x, text) {
        this.actor = actor;
        this.xpos = xpos;
        this.ypos = ypos;
        this.center_x = center_x;
        this.text = text;
        if (this.text && this.text !== '') {
            this.showTimer = Mainloop.timeout_add(250, Lang.bind(this, this.show));
        }
    }

    show() {
        this.showTimer = null;

        this.tooltip = new St.Label({
            name: 'Tooltip'
        });
        this.tooltip.show_on_set_parent = false;
        Main.uiGroup.add_actor(this.tooltip);
        this.tooltip.set_text(this.text);
        this.tooltip.get_clutter_text().set_use_markup(true);
        this.tooltip.set_style('text-align: left;');

        let tooltipWidth = this.tooltip.get_allocation_box().x2 - this.tooltip.get_allocation_box().x1;
        let monitor = Main.layoutManager.findMonitorForActor(this.actor);
        let tooltipLeft = this.xpos;
        if (this.center_x) {
            tooltipLeft -= Math.floor(tooltipWidth / 2);
        }
        tooltipLeft = Math.max(tooltipLeft, monitor.x);
        tooltipLeft = Math.min(tooltipLeft, monitor.x + monitor.width - tooltipWidth);

        this.tooltip.set_position(tooltipLeft, this.ypos);
        this.tooltip.raise_top();
        this.tooltip.show();
    }

    destroy() {
        if (this.showTimer) {
            Mainloop.source_remove(this.showTimer);
            this.showTimer = null;
        }
        if (this.tooltip) {
            this.tooltip.destroy();
        }
    }
}


module.exports = {tryFn, readFileAsync, readJSONAsync, ShowTooltip};
