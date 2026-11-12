// This Applet has 7 classic games, that I wrote using AI.
// Nic Nielsen - November 2026
// New Tecumseth, Ontario, Canada
// ://greatertecumsetharea.com

const St = imports.gi.St;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

var GamePrototype = {
  applyUI: function () {
    let sc = parseFloat(this.deskletScale) || 1.0,
      op = isNaN(parseFloat(this.opacity)) ? 0.95 : parseFloat(this.opacity);
    this.win.set_style(
      "background-color:rgba(40,44,52," +
        op +
        ");border:2px solid #51afef;border-radius:10px;padding:" +
        Math.floor(15 * sc) +
        "px;",
    );
    this.lbl.set_style(
      "color:#ecc30b;font-size:" +
        Math.floor(13 * sc) +
        "px;font-weight:bold;text-align:center;margin-bottom:5px;",
    );
    this.area.set_style(
      "font-family:monospace;font-size:" +
        Math.floor(16 * sc) +
        "px;color:#abb2bf;text-align:center;margin:10px 0;background:#1e1e24;padding:10px;border-radius:5px;min-width:" +
        Math.floor(160 * sc) +
        "px;",
    );

    if (this.btnU && this.btnL && this.btnR && this.btnD) {
      let btnDim =
        "width: " +
        Math.floor(22 * sc) +
        "px; height: " +
        Math.floor(22 * sc) +
        "px; text-align: center; font-size: " +
        Math.floor(11 * sc) +
        "px; font-weight: bold; border-radius: 4px;";
      [this.btnU, this.btnL, this.btnR, this.btnD].forEach((b) =>
        b.set_style(
          "background-color:#4b5263; color:white; " + btnDim + " margin: 1px;",
        ),
      );
    }

    if (this.dpadSpacerTop && this.dpadSpacerCenter && this.dpadSpacerBot) {
      let btnDim =
        "width: " +
        Math.floor(22 * sc) +
        "px; height: " +
        Math.floor(22 * sc) +
        "px; text-align: center; font-size: " +
        Math.floor(11 * sc) +
        "px; font-weight: bold; border-radius: 4px;";
      let ss =
        "background-color: transparent; color: transparent; " +
        btnDim +
        " margin: 1px;";
      [this.dpadSpacerTop, this.dpadSpacerCenter, this.dpadSpacerBot].forEach(
        (s) => {
          if (s) s.set_style(ss);
        },
      );
    }

    let linkStyle =
      "color:#51afef;text-decoration:underline;font-weight:bold;font-size:" +
      Math.floor(9 * sc) +
      "px;margin-top:" +
      Math.floor(4 * sc) +
      "px;text-align:center;background-color:transparent;border:none;padding:0px;";
    if (this.btnArt) this.btnArt.set_style(linkStyle);
    if (this.btnMode) this.btnMode.set_style(linkStyle);
    this.dialogOverlay.set_style(
      "background-color:rgba(20,20,25,0.9);border-radius:8px;padding:15px;text-align:center;margin:10px;",
    );
    this.dialogTitle.set_style(
      "color:#e06c75;font-size:" +
        Math.floor(16 * sc) +
        "px;font-weight:bold;margin-bottom:10px;text-align:center;",
    );
    this.dialogScore.set_style(
      "color:white;font-size:" +
        Math.floor(14 * sc) +
        "px;margin-bottom:15px;text-align:center;",
    );
    this.dialogBtn.set_style(
      "background-color:#98c379;color:white;padding:8px 16px;border-radius:4px;font-weight:bold;font-size:" +
        Math.floor(13 * sc) +
        "px;text-align:center;",
    );
    this.btnStyle(sc);
    this.renderFrame();
  },
  btnStyle: function (sc) {
    let s = sc || parseFloat(this.deskletScale) || 1.0,
      p =
        "padding:" +
        Math.floor(1 * s) +
        "px " +
        Math.floor(5 * s) +
        "px;border-radius:3px;margin-right:" +
        Math.floor(2 * s) +
        "px;font-weight:bold;font-size:" +
        Math.floor(10 * s) +
        "px;";
    if (this.btnS)
      this.btnS.set_style(
        "background-color:" +
          (this.go
            ? "#ecc30b;color:black;"
            : this.run
              ? "#e06c75;color:white;"
              : "#98c379;color:white;") +
          p,
      );
  },
  displayArtwork: function () {
    try {
      if (this.metadata && this.metadata.path) {
        let p = GLib.build_filenamev([this.metadata.path, "icon.png"]);
        let f = Gio.File.new_for_path(p);
        Gio.AppInfo.launch_default_for_uri_async(
          f.get_uri(),
          null,
          null,
          (source, res) => {
            try {
              Gio.AppInfo.launch_default_for_uri_finish(res);
            } catch (e) {
              if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                global.logError("Failed to display artwork: " + e.message);
              }
            }
          },
        );
      }
    } catch (e) {}
  },
  resetScoreFromPanel: function () {
    try {
      this.best = 0;
      this.score = 0;
      this._engineBest = 0;
      if (this.path) {
        let bytes = new GLib.Bytes("0");
        Gio.File.new_for_path(this.path).replace_contents_async(
          bytes.get_data(),
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null,
          (source, res) => {
            try {
              source.replace_contents_finish(res);
            } catch (e) {}
          },
        );
      }
      this.renderFrame();
    } catch (e) {}
  },
  loadBest: function () {
    if (this._engineBest !== undefined) {
      return this._engineBest;
    }
    this._engineBest = 0;
    if (!this.path) return 0;

    let f = Gio.File.new_for_path(this.path);
    f.load_contents_async(null, (source, res) => {
      try {
        let [s, c] = source.load_contents_finish(res);
        if (s) {
          let val = parseInt(new TextDecoder().decode(c).trim()) || 0;
          this._engineBest = val;
          this.best = val;
          if (typeof this.renderFrame === "function") {
            this.renderFrame();
          }
        }
      } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
          global.logError("Failed to load best score: " + e.message);
        }
      }
    });
    return 0;
  },
  saveBest: function (n) {
    this._engineBest = n;
    this.best = n;
    if (!this.path) return;

    try {
      let bytes = new GLib.Bytes(n.toString());
      Gio.File.new_for_path(this.path).replace_contents_async(
        bytes.get_data(),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
        (source, res) => {
          try {
            source.replace_contents_finish(res);
          } catch (e) {
            global.logError("Failed to save best score: " + e.message);
          }
        },
      );
    } catch (e) {}
  },
  resetGame: function () {
    this.W =
      this.gameMode === "track"
        ? 10
        : this.gameMode === "pacman"
          ? 15
          : this.gameMode === "go"
            ? 11
            : this.gameMode === "sudoku"
              ? 9
              : this.gameMode === "tetris"
                ? 10
                : 6;
    this.H = this.gameMode === "tetris" ? 16 : 12;
    this.cX = 3;
    this.cY = this.H - 1;
    this.obs = [];
    this.score = this.gameMode === "iqtest" ? 100 : 0;
    this.currentIqIndex = 0;
    this.go = false;
    this.run = false;
    this.roadCenter = 3.0;
    this.roadDirection = 0;
    this.bendDuration = 0;
    this.roadblockCooldown = 0;
    if (this.loopId) Mainloop.source_remove(this.loopId);
    this.loopId = null;
    if (this.btnS) {
      this.btnS.set_label("Start");
      this.btnStyle();
    }
  },

  toggle: function () {
    if (this.go) {
      this.resetGame();
    } else if (this.run) {
      this.run = false;
      this.btnS.set_label("Start");
      this.btnStyle();
      if (this.loopId) Mainloop.source_remove(this.loopId);
      this.loopId = null;
    } else {
      this.run = true;
      this.btnS.set_label("Stop");
      this.btnStyle();
      if (
        this.gameMode === "iqtest" &&
        typeof this.prepareQuizQuestions === "function"
      ) {
        this.prepareQuizQuestions();
      }
      if (
        this.gameMode === "tetris" &&
        typeof this.initTetrisBoard === "function"
      ) {
        this.initTetrisBoard();
      }
      this.loop();
    }
    this.renderFrame();
  },

  move: function (dx, dy) {
    if (!this.run || this.go) return;
    let nx = this.cX + dx,
      ny = this.cY + dy;
    if (nx >= 0 && nx < this.W) this.cX = nx;
    if (ny >= 0 && ny < this.H) this.cY = ny;
    this.checkCollisions();
    this.renderFrame();
  },
  checkCollisions: function () {
    let hi = this.obs.findIndex((o) => o.y === this.cY && o.x === this.cX);
    if (hi !== -1) {
      let s = this.obs[hi].s;
      if (this.gameMode === "track") {
        this.endGame();
      } else {
        if (s === this.SKULL || s === "🚧") {
          this.endGame();
        } else {
          this.score += s === this.CASH ? 50 : 10;
          this.obs.splice(hi, 1);
        }
      }
    }
  },
  endGame: function () {
    this.go = true;
    this.run = false;
    this.btnS.set_label("Restart");
    if (this.score > this.best) {
      if (typeof this.saveBestScore === "function") {
        this.saveBestScore(this.score);
      } else {
        this.saveBest(this.score);
      }
    }
    if (this.loopId) Mainloop.source_remove(this.loopId);
    this.loopId = null;
    this.btnStyle();
    this.renderFrame();
  },
};
