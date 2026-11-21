// SingleTileStrip — floating vertical overlay that reveals every monitor
// tile when YASM is in single-tile-mode.
//
// Opens on hover of the collapsed-source trigger tile. A left click on
// the trigger promotes a hover-opened strip to sticky, click-again
// closes it, and Esc or a button-press outside the strip+trigger closes
// it in either mode.
//
// Close detection:
//   - Button-press anywhere on stage: captured-event handler.
//   - Esc keypress: same captured-event handler.
//   - Pointer-leave in temp mode: a short polling timer. Motion events
//     on `global.stage` don't fire reliably once the pointer leaves the
//     Cinnamon input region (over a window or the desktop), so a 100 ms
//     poll of `global.get_pointer()` is the only robust way to detect
//     "mouse left the strip" from here.
//
// Inner tile tooltips (owned by applet.js's LaptopTooltip) are given an
// `anchor` pointing at the strip's bounds so they render on the free
// side rather than overlapping the strip. On close the strip hides them
// explicitly — Clutter won't fire leave on a tile just because its
// parent was hidden.

const St       = imports.gi.St;
const Clutter  = imports.gi.Clutter;
const Main     = imports.ui.main;
const Mainloop = imports.mainloop;

const HALO_PX           = 12;
const POLL_INTERVAL_MS  = 100;

var SingleTileStrip = class SingleTileStrip {
  constructor(applet) {
    this._applet       = applet;
    this._isOpen       = false;
    this._isSticky     = false;
    this._tiles        = [];
    this._pollId       = 0;
    this._stageSignals = [];
    this._sourceTile   = null;
    this._srcEnterId   = 0;
    this._srcClickId   = 0;

    this._box = new St.BoxLayout({ vertical: true, reactive: true, track_hover: true });
    this._box.add_style_class_name('yasm-strip');
    this._box.hide();
    this._chromeAdded = false;
    // Chrome is registered via addChrome only while the strip is open —
    // see open() / close(). Leaving it registered while hidden keeps the
    // input region carved out, which breaks focus-steal prevention for
    // apps the user launches by clicking a strip tile (e.g. uptime →
    // terminal). addChrome itself parents the actor into uiGroup, so we
    // don't add it to any parent here.
  }

  _addChrome() {
    if (this._chromeAdded) return;
    try {
      Main.layoutManager.addChrome(this._box, {
        affectsInputRegion: true,
        affectsStruts:      false,
      });
      this._chromeAdded = true;
    } catch(e) { log(`[yasm] addChrome failed: ${e}`); }
  }

  _removeChrome() {
    if (!this._chromeAdded) return;
    try { Main.layoutManager.removeChrome(this._box); } catch(e) {}
    this._chromeAdded = false;
  }

  // Reparent a (sep, tile) pair from the panel into the strip, and keep
  // a reference to the tile's tooltip so we can hide it on close.
  addTile(sep, tile, tooltip) {
    if (sep)  this._box.add_actor(sep);
    if (tile) this._box.add_actor(tile);
    if (tooltip && tooltip.setAnchor) tooltip.setAnchor(() => this._anchorRect());
    this._tiles.push({ sep, tile, tooltip });
  }

  _anchorRect() {
    const [ax, ay] = this._box.get_transformed_position();
    const [aw, ah] = this._box.get_transformed_size();
    return { x: ax, y: ay, w: aw, h: ah };
  }

  attachTo(sourceTile) {
    this._sourceTile = sourceTile;
    this._srcEnterId = sourceTile.connect('enter-event', () => {
      if (global.settings.get_boolean('panel-edit-mode')) return;
      if (!this._isOpen) this.open({ sticky: false });
    });
    this._srcClickId = sourceTile.connect('button-press-event', (actor, ev) => {
      const btn = ev.get_button();
      // Right-click (3) and middle-click (2) propagate to Cinnamon's own
      // applet context menu; close the strip first so its tooltips can't
      // obscure the Configure/Remove popup.
      if (btn !== 1) {
        this.close();
        return Clutter.EVENT_PROPAGATE;
      }
      if (global.settings.get_boolean('panel-edit-mode')) return Clutter.EVENT_PROPAGATE;
      this.toggleSticky();
      return Clutter.EVENT_STOP;
    });
  }

  open({ sticky }) {
    this._isOpen   = true;
    this._isSticky = !!sticky;
    this._addChrome();
    this._box.show();
    this._position();
    this._installWatchers();
    this._startPoll();
  }

  close() {
    this._stopPoll();
    this._removeWatchers();
    this._hideInnerTooltips();
    this._isOpen   = false;
    this._isSticky = false;
    this._box.hide();
    this._removeChrome();
  }

  toggleSticky() {
    if (!this._isOpen) {
      this.open({ sticky: true });
    } else if (!this._isSticky) {
      this._isSticky = true;
    } else {
      this.close();
    }
  }

  _hideInnerTooltips() {
    for (const { tooltip } of this._tiles) {
      if (tooltip && tooltip.hide) { try { tooltip.hide(); } catch(e) {} }
    }
  }

  _pointerInside(px, py) {
    const inActor = (actor) => {
      if (!actor || !actor.visible) return false;
      const [ax, ay] = actor.get_transformed_position();
      const [aw, ah] = actor.get_transformed_size();
      return px >= ax - HALO_PX && px <= ax + aw + HALO_PX
          && py >= ay - HALO_PX && py <= ay + ah + HALO_PX;
    };
    return inActor(this._box) || inActor(this._sourceTile);
  }

  _position() {
    if (!this._sourceTile) return;
    const monitor = Main.layoutManager.primaryMonitor;
    const [ox, oy] = this._sourceTile.get_transformed_position();
    const [ow, oh] = this._sourceTile.get_transformed_size();
    const [bw, bh] = this._box.get_size();
    const orient = this._applet._orientation;

    let x, y;
    if (orient === St.Side.LEFT) {
      x = ox + ow; y = oy;
    } else if (orient === St.Side.RIGHT) {
      x = ox - bw; y = oy;
    } else if (orient === St.Side.TOP) {
      x = ox;      y = oy + oh;
    } else {
      x = ox;      y = oy - bh;
    }
    x = Math.max(monitor.x, Math.min(x, monitor.x + monitor.width  - bw));
    y = Math.max(monitor.y, Math.min(y, monitor.y + monitor.height - bh));
    this._box.set_position(Math.round(x), Math.round(y));
  }

  // Esc + click-outside watcher. Motion events are NOT used here (they
  // don't fire while the pointer is over client windows); the polling
  // timer handles pointer-leave instead.
  _installWatchers() {
    this._removeWatchers();
    const stage = global.stage;
    const sig = stage.connect('captured-event', (actor, ev) => {
      const t = ev.type();
      if (t === Clutter.EventType.KEY_PRESS) {
        if (ev.get_key_symbol() === Clutter.KEY_Escape) {
          this.close();
          return Clutter.EVENT_STOP;
        }
      } else if (t === Clutter.EventType.BUTTON_PRESS) {
        const [px, py] = ev.get_coords();
        if (!this._pointerInside(px, py)) {
          this.close();
          // Propagate so the click lands on whatever was underneath.
          return Clutter.EVENT_PROPAGATE;
        }
      }
      return Clutter.EVENT_PROPAGATE;
    });
    this._stageSignals = [sig];
  }

  _removeWatchers() {
    for (const id of this._stageSignals) {
      try { global.stage.disconnect(id); } catch(e) {}
    }
    this._stageSignals = [];
  }

  _startPoll() {
    this._stopPoll();
    this._pollId = Mainloop.timeout_add(POLL_INTERVAL_MS, () => {
      if (!this._isOpen) { this._pollId = 0; return false; }
      if (this._isSticky) return true; // keep polling in case we revert to temp
      const [px, py] = global.get_pointer();
      if (!this._pointerInside(px, py)) {
        this.close();
        return false;
      }
      return true;
    });
  }

  _stopPoll() {
    if (this._pollId) {
      try { Mainloop.source_remove(this._pollId); } catch(e) {}
      this._pollId = 0;
    }
  }

  takeTiles() {
    const result = this._tiles.slice();
    for (const { sep, tile, tooltip } of result) {
      if (tooltip && tooltip.setAnchor) tooltip.setAnchor(null);
      if (sep)  { try { this._box.remove_actor(sep);  } catch(e) {} }
      if (tile) { try { this._box.remove_actor(tile); } catch(e) {} }
    }
    this._tiles = [];
    return result;
  }

  destroy() {
    this.close();
    if (this._sourceTile) {
      try { this._sourceTile.disconnect(this._srcEnterId); } catch(e) {}
      try { this._sourceTile.disconnect(this._srcClickId); } catch(e) {}
      this._sourceTile = null;
    }
    this.takeTiles();
    this._removeChrome();
    try { this._box.destroy(); } catch(e) {}
  }
};
