const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Cairo = imports.cairo;
const ByteArray = imports.byteArray;

function AudioSpectrum(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

AudioSpectrum.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.Applet.prototype._init.call(
            this,
            orientation,
            panelHeight,
            instanceId
        );

        this._metadata = metadata;
        this._cavaRestartInProgress = false;
        this._cavaRestartPending = false;
        this._removed = false;

        // Cinnamon supplies the current panel height when the applet is
        // created. Keep it separately from the requested visualization
        // height so Auto mode can fit different panel sizes.
        this._availablePanelHeight = panelHeight;

        // The visualization manages its own horizontal geometry.
        this.actor.set_style("padding-left: 0px; padding-right: 0px;");

        this._settings = new Settings.AppletSettings(this, this._metadata.uuid, instanceId);

        // Number of EQ bars
        this._barCount = 120;

        this._settings.bind("bar_count", "_barCount", this._onBarCountChanged.bind(this));
        this._sensitivity = 100;
        this._settings.bind("sensitivity", "_sensitivity", this._onSensitivityChanged.bind(this));

        this._fps = 25;
        this._settings.bind("fps", "_fps", this._onFpsChanged.bind(this));

        this._gravity = 300;
        this._settings.bind("gravity", "_gravity", this._onGravityChanged.bind(this));
        this._skin = "classic";
        this._settings.bind("skin", "_skin", this._onSkinChanged.bind(this));

        // Current and target bar heights
        this._bars = new Array(this._barCount).fill(0);
        this._targets = new Array(this._barCount).fill(0);
        this._peaks = new Array(this._barCount).fill(0);
        this._peakHoldUntil = new Array(this._barCount).fill(0);

        // Width is calculated automatically from the visualization geometry.
        this._width = 1;
        this._barWidth = 4;
        this._settings.bind("bar_width", "_barWidth", this._onBarWidthChanged.bind(this));
        this._separator = 0.8;
        this._settings.bind("separator", "_separator", this._onSeparatorChanged.bind(this));
        this._heightMode = "auto";
        this._settings.bind(
            "height_mode",
            "_heightMode",
            this._onHeightChanged.bind(this)
        );

        this._height = 24;
        this._settings.bind(
            "height",
            "_height",
            this._onHeightChanged.bind(this)
        );

        this._verticalAlignment = "center";
        this._settings.bind(
            "vertical_alignment",
            "_verticalAlignment",
            this._onHeightChanged.bind(this)
        );

        this._peakHold = 500;
        this._settings.bind(
            "peak_hold",
            "_peakHold",
            this._onPeakHoldChanged.bind(this)
        );

        this.actor.set_width(this._width);

        // Draw the visualization. Height is applied after the drawing
        // area exists so Auto and Manual modes use the same code path.
        this._drawingArea = new St.DrawingArea({
            width: this._width,
            height: 1
        });

        this._updateWidth();
        this._updateHeight();

        this._drawingArea.connect(
            'repaint',
            this._draw.bind(this)
        );

        this.actor.add_actor(this._drawingArea);

        this._process = null;
        this._stream = null;
        this._animationId = null;

        this._restartCava();
        this._animate();
    },

    _onSkinChanged: function() {
        this._updateWidth();
        this._drawingArea.queue_repaint();
    },

    _onSensitivityChanged: function() {
        this._restartCava();
    },

    _onFpsChanged: function() {
        this._restartCava();
    },

    _onGravityChanged: function() {
        // Fall speed is consumed directly by the animation loop.
        // No CAVA restart is required.
    },

    _onBarCountChanged: function() {
        this._bars = new Array(this._barCount).fill(0);
        this._targets = new Array(this._barCount).fill(0);
        this._peaks = new Array(this._barCount).fill(0);
        this._peakHoldUntil = new Array(this._barCount).fill(0);

        this._updateWidth();
        this._drawingArea.queue_repaint();
        this._restartCava();
    },

    _restartCava: function() {
        if (this._removed)
            return;

        if (this._cavaRestartInProgress) {
            this._cavaRestartPending = true;
            return;
        }

        this._cavaRestartInProgress = true;
        this._cavaRestartPending = false;

        let templateConfig = GLib.build_filenamev([
            this._metadata.path,
            "cava.conf"
        ]);

        let runtimeConfig = GLib.build_filenamev([
            GLib.get_user_cache_dir(),
            this._metadata.uuid + "-cava.conf"
        ]);

        let templateFile = Gio.File.new_for_path(templateConfig);
        let runtimeFile = Gio.File.new_for_path(runtimeConfig);
        let rawBarCount = this._barCount * 2;
        let sensitivity = this._sensitivity;
        let fps = this._fps;
        let gravity = this._gravity;

        templateFile.load_contents_async(null, (source, result) => {
            try {
                let [, contents] = source.load_contents_finish(result);

                if (this._removed || this._cavaRestartPending) {
                    this._finishCavaRestart();
                    return;
                }

                contents = ByteArray.toString(contents);

                // The parser combines one left- and one right-channel value
                // for every visible bar. Request two raw values per visible
                // bar so both stereo channel halves cover the full spectrum.
                contents = contents.replace(
                    /^bars\s*=\s*\d+/m,
                    "bars = " + rawBarCount
                );
                contents = contents.replace(
                    /^sensitivity\s*=\s*\d+/m,
                    "sensitivity = " + sensitivity
                );
                contents = contents.replace(
                    /^framerate\s*=\s*\d+/m,
                    "framerate = " + fps
                );
                contents = contents.replace(
                    /^gravity\s*=\s*\d+/m,
                    "gravity = " + gravity
                );

                let bytes = new GLib.Bytes(
                    ByteArray.fromString(contents)
                );

                runtimeFile.replace_contents_async(
                    bytes,
                    null,
                    false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null,
                    (source, result) => {
                        try {
                            source.replace_contents_finish(result);

                            if (this._removed || this._cavaRestartPending) {
                                this._finishCavaRestart();
                                return;
                            }

                            if (this._process) {
                                try {
                                    this._process.force_exit();
                                } catch (e) {
                                }

                                this._process = null;
                            }

                            this._stream = null;
                            this._startCava(runtimeConfig);
                            this._finishCavaRestart();

                        } catch (e) {
                            global.logError(
                                "Audio Spectrum: could not update CAVA: " + e
                            );
                            this._finishCavaRestart();
                        }
                    }
                );

            } catch (e) {
                global.logError(
                    "Audio Spectrum: could not update CAVA: " + e
                );
                this._finishCavaRestart();
            }
        });
    },

    _finishCavaRestart: function() {
        this._cavaRestartInProgress = false;

        if (this._removed)
            return;

        if (this._cavaRestartPending) {
            this._cavaRestartPending = false;
            this._restartCava();
        }
    },

    _onHeightChanged: function() {
        this._updateHeight();
    },

    _updateHeight: function() {
        if (!this._drawingArea)
            return;

        let panelHeight = Math.max(
            1,
            Math.round(Number(this._availablePanelHeight) || 24)
        );

        let requestedHeight = Math.max(
            1,
            Math.round(Number(this._height) || 24)
        );

        // Auto fills the panel's available applet height.
        // Manual never grows beyond the panel.
        let visualHeight =
            this._heightMode === "manual"
                ? Math.min(requestedHeight, panelHeight)
                : panelHeight;

        visualHeight = Math.max(1, visualHeight);

        // Keep the Cinnamon actor and DrawingArea at the panel's full
        // allocated height. Only the visualization itself is constrained.
        // This avoids fighting Cinnamon's panel layout.
        this._visualHeight = visualHeight;

        if (this._verticalAlignment === "bottom") {
            this._visualY = panelHeight - visualHeight;
        } else if (this._verticalAlignment === "center") {
            this._visualY = Math.floor(
                (panelHeight - visualHeight) / 2
            );
        } else {
            this._visualY = 0;
        }

        this._visualY = Math.max(0, this._visualY);

        this.actor.set_height(panelHeight);
        this._drawingArea.set_height(panelHeight);

        this.actor.queue_relayout();
        this._drawingArea.queue_relayout();
        this._drawingArea.queue_repaint();
    },

    _onBarWidthChanged: function() {
        this._updateWidth();
        this._drawingArea.queue_repaint();
    },

    _onSeparatorChanged: function() {
        this._updateWidth();
        this._drawingArea.queue_repaint();
    },

    _onPeakHoldChanged: function() {
        this._drawingArea.queue_repaint();
    },

    _restoreDefaultSettings: function() {
        const defaults = {
            bar_count: 60,
            sensitivity: 650,
            bar_width: 4,
            height_mode: "auto",
            height: 24,
            vertical_alignment: "center",
            separator: 0.8,
            skin: "classic",
            fps: "25",
            gravity: 400,
            peak_hold: 0
        };

        for (let key in defaults) {
            this._settings.setValue(
                key,
                defaults[key]
            );
        }

        // Recalculate final geometry after all settings have been
        // restored. Individual setting callbacks may run while other
        // settings still contain their previous values.
        this._updateWidth();
        this._updateHeight();

        if (this._drawingArea)
            this._drawingArea.queue_repaint();
    },

    _updateWidth: function() {
        let count = Math.max(1, this._barCount);
        let width;

        if (this._skin === "classicneon") {
            // Classic Neon: 1 px core with 3 px pitch.
            width = 3 * (count - 1) + 1;
        } else if (this._skin === "fire" || this._skin === "spectrum") {
            let barWidth = Math.max(2, this._barWidth);
            let gap = Math.max(0, this._separator);
            width = barWidth * count + gap * (count - 1);
        } else {
            let barWidth = this._barWidth;
            let gap = this._separator;
            width = barWidth * count + gap * (count - 1);
        }

        this._width = Math.max(1, Math.ceil(width));

        if (this.actor)
            this.actor.set_width(this._width);

        if (this._drawingArea)
            this._drawingArea.set_width(this._width);
    },

    _startCava: function(config) {
        try {
            // Prefer Audio Spectrum's private CAVA installation when
            // available. Otherwise fall back to CAVA from the user's PATH.
            let localCava = GLib.build_filenamev([
                GLib.get_home_dir(),
                '.local',
                'lib',
                'audio-spectrum',
                'cava'
            ]);

            let subprocessFlags = Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE;

            try {
                this._process = Gio.Subprocess.new(
                    [localCava, '-p', config],
                    subprocessFlags
                );
            } catch (e) {
                this._process = Gio.Subprocess.new(
                    ['cava', '-p', config],
                    subprocessFlags
                );
            }

            this._stream = new Gio.DataInputStream({
                base_stream: this._process.get_stdout_pipe()
            });

            this._readLine(this._stream);

        } catch (e) {
            global.logError(
                'Audio Spectrum: could not start CAVA: ' + e
            );
        }
    },

    _readLine: function(activeStream) {
        if (
            !activeStream ||
            activeStream !== this._stream ||
            this._removed
        )
            return;

        activeStream.read_line_async(
            GLib.PRIORITY_DEFAULT,
            null,
            (stream, result) => {
                try {
                    let data = stream.read_line_finish_utf8(result);

                    // A callback from a stopped CAVA process may finish
                    // after a replacement process has already created a
                    // new stream. Never continue reading on that new stream
                    // from the stale callback.
                    if (
                        stream !== this._stream ||
                        this._removed
                    )
                        return;

                    let line = data[0];

                    if (line !== null && line !== undefined) {
                        if (line.length > 0)
                            this._parse(line);

                        this._readLine(stream);
                    }

                } catch (e) {
                    if (
                        stream === this._stream &&
                        !this._removed
                    ) {
                        global.logError(
                            'Audio Spectrum: error reading from CAVA: ' + e
                        );
                    }
                }
            }
        );
    },

    _parse: function(line) {
        let values = line
            .toString()
            .trim()
            .split(';')
            .map(Number);

        // CAVA outputs stereo spectrum data as:
        // left-channel bands followed by right-channel bands.
        //
        // Combine corresponding frequency bands only AFTER
        // CAVA has analysed each channel separately. Using the
        // stronger magnitude prevents opposite-polarity stereo
        // signals from cancelling each other.
        let channelBars = Math.floor(values.length / 2);

        for (let i = 0; i < this._barCount; i++) {
            // CAVA stereo output is mirrored:
            // left channel runs high -> low, right runs low -> high.
            // Reverse the left half so corresponding frequencies align.
            let left = values[channelBars - 1 - i];
            let right = values[channelBars + i];

            if (!isNaN(left) || !isNaN(right)) {
                if (isNaN(left))
                    left = 0;

                if (isNaN(right))
                    right = 0;

                let value = Math.max(left, right);

                this._targets[i] = Math.max(
                    0,
                    Math.min(100, value)
                );
            }
        }
    },

    _animate: function() {
        for (let i = 0; i < this._barCount; i++) {
            let current = this._bars[i];
            let target = this._targets[i];

            // Mild dynamic curve lifts quieter bands without
            // changing the maximum level.
            target = Math.pow(target / 100, 0.90) * 100;

            // Smooth bar movement while keeping transients responsive.
            // Attack is faster than decay.
            let smoothing;

            if (target > current) {
                // Fast attack is independent of Fall speed.
                smoothing = 0.65;
            } else {
                // Fall speed controls only downward movement.
                // 400 preserves the previous 0.30 behaviour.
                smoothing = Math.min(
                    0.95,
                    Math.max(0.02, 0.30 * (this._gravity / 400))
                );
            }

            this._bars[i] = current + (target - current) * smoothing;

            // Snap fully to silence once the decaying value is visually
            // negligible. Exponential smoothing otherwise approaches zero
            // forever without actually reaching it.
            if (target === 0 && this._bars[i] < 0.5)
                this._bars[i] = 0;

            // Peak hold: hold the peak for 0.5 seconds
            if (target > this._peaks[i]) {
                this._peaks[i] = target;

                if (this._peakHold > 0) {
                    this._peakHoldUntil[i] =
                        Date.now() + this._peakHold;
                } else {
                    this._peaks[i] = 0;
                }
            } else if (Date.now() > this._peakHoldUntil[i]) {
                // Let the peak marker fall slowly after the hold time
                this._peaks[i] = Math.max(
                    0,
                    this._peaks[i] - 2
                );
            }
        }

        this._drawingArea.queue_repaint();

        this._animationId = Mainloop.timeout_add(
            20,
            this._animate.bind(this)
        );
    },

    _draw: function(area) {
        let cr = area.get_context();

        let width = area.width;

        // The DrawingArea occupies the full panel height. The actual
        // visualizer may use a smaller region in Manual mode.
        let fullHeight = area.height;
        let height = Math.max(
            1,
            Math.min(
                fullHeight,
                Math.round(Number(this._visualHeight) || fullHeight)
            )
        );

        let visualY = Math.max(
            0,
            Math.min(
                fullHeight - height,
                Math.round(Number(this._visualY) || 0)
            )
        );

        // Draw the visualization in its own vertical region.
        cr.save();
        cr.translate(0, visualY);
        cr.rectangle(0, 0, width, height);
        cr.clip();

        // Transparent background
        cr.setSourceRGBA(0, 0, 0, 0);
        cr.paint();

        let gap = this._separator;

        let barWidth = this._barWidth;
        let totalWidth =
            barWidth * this._barCount
            + gap * (this._barCount - 1);

        let offset = Math.max(
            0,
            (width - totalWidth) / 2
        );

        // VU Meter: a single horizontal level meter
        if (this._skin === "vu") {
            let vuSum = 0;
            let vuPeak = 0;

            for (let v = 0; v < this._barCount; v++) {
                vuSum += this._bars[v] / 100;

                vuPeak = Math.max(
                    vuPeak,
                    this._peaks[v] / 100
                );
            }

            // Average level instead of maximum level
            let vuLevel =
                Math.min(
                    1,
                    (vuSum / Math.max(1, this._barCount)) * 2.5
                );

            let vuHeight = Math.max(
                4,
                Math.min(8, height)
            );

            let vuY = Math.floor(
                (height - vuHeight) / 2
            );

            // Subtle background
            cr.setSourceRGBA(
                0.18, 0.18, 0.18, 0.35
            );

            cr.rectangle(
                0,
                vuY,
                width,
                vuHeight
            );
            cr.fill();

            // Classic VU scale: green -> yellow -> red
            if (vuLevel > 0) {
                let vuGradient =
                    new Cairo.LinearGradient(
                        0,
                        0,
                        width,
                        0
                    );

                vuGradient.addColorStopRGBA(
                    0.00, 0.10, 0.80, 0.15, 0.95
                );

                vuGradient.addColorStopRGBA(
                    0.70, 0.10, 0.80, 0.15, 0.95
                );

                vuGradient.addColorStopRGBA(
                    0.82, 1.00, 0.82, 0.10, 0.95
                );

                vuGradient.addColorStopRGBA(
                    1.00, 0.90, 0.20, 0.20, 0.95
                );

                cr.setSource(vuGradient);

                cr.rectangle(
                    0,
                    vuY,
                    Math.max(1, vuLevel * width),
                    vuHeight
                );
                cr.fill();
            }

            // Peak-markering
            if (vuPeak > 0) {
                let peakX =
                    Math.max(
                        0,
                        Math.min(width - 1, vuPeak * width)
                    );

                cr.setSourceRGBA(
                    1.0, 1.0, 1.0, 0.95
                );

                cr.rectangle(
                    Math.max(0, peakX - 1),
                    Math.max(0, vuY - 2),
                    2,
                    vuHeight + 4
                );
                cr.fill();
            }

            return;
        }

        for (let i = 0; i < this._barCount; i++) {

            let value = this._bars[i] / 100;

            let barHeight =
                Math.max(1, value * height);

            let x =
                offset + i * (barWidth + gap);

            let y =
                height - barHeight;

            // Oscilloscope-skin
            if (this._skin === "oscilloscope") {
                  // Draw the entire oscilloscope only once per frame.
                  if (i > 0)
                      continue;

                  let centerY = height / 2;

                  // Svag amber mittlinje
                  cr.setSourceRGBA(
                      0.65, 0.25, 0.04, 0.20
                  );

                  cr.setLineWidth(1);
                  cr.moveTo(0, Math.floor(centerY) + 0.5);
                  cr.lineTo(width, Math.floor(centerY) + 0.5);
                  cr.stroke();

                  let points = Math.max(
                      2,
                      Math.min(
                          this._barCount,
                          Math.floor(width / 2)
                      )
                  );

                  let step =
                      width / Math.max(1, points - 1);

                  // Glow
                  cr.setSourceRGBA(
                      1.0, 0.30, 0.02, 0.18
                  );

                  cr.setLineWidth(4);
                  cr.moveTo(0, centerY);

                  for (let p = 0; p < points; p++) {
                      let index = Math.floor(
                          p *
                          (this._barCount - 1) /
                          Math.max(1, points - 1)
                      );

                      let level =
                          this._bars[index] / 100;

                      // Spegla signalen runt mittlinjen.
                      let amplitude =
                          level * height * 0.45;

                      let y;

                      if (p === 0) {
                          y = centerY;
                      } else {
                          let direction =
                              (p % 2 === 0) ? -1 : 1;

                          y =
                              centerY +
                              direction * amplitude;
                      }

                      cr.lineTo(
                          p * step,
                          y
                      );
                  }

                  cr.stroke();

                  // Huvudkurva
                  cr.setSourceRGBA(
                      1.0, 0.58, 0.08, 1.0
                  );

                  cr.setLineWidth(1.5);
                  cr.moveTo(0, centerY);

                  for (let p = 0; p < points; p++) {
                      let index = Math.floor(
                          p *
                          (this._barCount - 1) /
                          Math.max(1, points - 1)
                      );

                      let level =
                          this._bars[index] / 100;

                      let amplitude =
                          level * height * 0.45;

                      let y;

                      if (p === 0) {
                          y = centerY;
                      } else {
                          let direction =
                              (p % 2 === 0) ? -1 : 1;

                          y =
                              centerY +
                              direction * amplitude;
                      }

                      cr.lineTo(
                          p * step,
                          y
                      );
                  }

                  cr.stroke();

                  // Peakindikator
                  let oscPeak = 0;

                  for (let q = 0; q < this._barCount; q++) {
                      oscPeak = Math.max(
                          oscPeak,
                          this._peaks[q] / 100
                      );
                  }

                  if (oscPeak > 0.75) {
                      let peakY =
                          centerY -
                          oscPeak * height * 0.45;

                      cr.setSourceRGBA(
                          1.0, 0.85, 0.35, 0.95
                      );

                      cr.setLineWidth(2);
                      cr.moveTo(
                          Math.max(0, width - 8),
                          peakY - 2
                      );
                      cr.lineTo(
                          width,
                          peakY + 2
                      );
                      cr.stroke();
                  }

                  continue;
              }

                  if (this._skin === "digital80") {
                  let digitalWidth = Math.max(3, barWidth);
                  let digitalSegments = Math.max(
                      1,
                      Math.floor(height / 5)
                  );

                  let litSegments = Math.ceil(
                      value * digitalSegments
                  );

                  for (let s = 0; s < digitalSegments; s++) {
                      let sy =
                          height -
                          (s + 1) * 5 +
                          1;

                      if (s >= litSegments) {
                          cr.setSourceRGBA(
                              0.05, 0.12, 0.06, 0.20
                          );
                      } else if (s >= digitalSegments * 0.85) {
                          cr.setSourceRGBA(
                              1.0, 0.48, 0.05, 0.98
                          );
                      } else {
                          cr.setSourceRGBA(
                              0.30, 1.0, 0.45, 0.98
                          );
                      }

                      cr.rectangle(
                          x,
                          sy,
                          digitalWidth,
                          4
                      );
                      cr.fill();
                  }

                  if (this._peaks[i] > 0) {
                      let peakSegment = Math.floor(
                          (this._peaks[i] / 100) *
                          digitalSegments
                      );

                      let peakY =
                          height -
                          Math.max(1, peakSegment) * 5 +
                          1;

                      cr.setSourceRGBA(
                          1.0, 1.0, 0.70, 1.0
                      );

                      cr.rectangle(
                          x,
                          Math.max(0, peakY),
                          digitalWidth,
                          4
                      );
                      cr.fill();
                  }

                  continue;
              }

              if (this._skin === "dotmatrix") {
                let dotSize = Math.max(1, Math.min(barWidth, 3));
                let dotGap = Math.max(1, gap);
                let rows = Math.max(
                    1,
                    Math.floor(height / (dotSize + dotGap))
                );

                let litRows = Math.ceil(value * rows);

                for (let d = 0; d < litRows; d++) {
                    let dy =
                        height -
                        (d + 1) * (dotSize + dotGap) +
                        dotGap;

                    let level = (d + 1) / rows;

                    // Dot Matrix: green, red only in top 10 %
                    if (level > 0.90) {
                        cr.setSourceRGBA(0.90, 0.05, 0.05, 0.95);
                    } else {
                        cr.setSourceRGBA(0.10, 0.80, 0.15, 0.95);
                    }

                    cr.rectangle(
                        x,
                        dy,
                        dotSize,
                        dotSize
                    );
                    cr.fill();
                }

                // Peak marker
                if (this._peaks[i] > 0) {
                    let peakY =
                        height -
                        (this._peaks[i] / 100) * height;

                    cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95);

                    cr.rectangle(
                        x,
                        Math.max(0, peakY - 1),
                        dotSize,
                        2
                    );

                    cr.fill();
                }

                continue;
            }

            // 80s Car Stereo-skin
            if (this._skin === "fire") {
            let fireWidth = Math.max(2, barWidth);
            let fireGap = Math.max(0, gap);

            let totalWidth =
                fireWidth * this._barCount +
                fireGap * (this._barCount - 1);

            let fireOffset =
                Math.max(0, (width - totalWidth) / 2);

            let fx =
                fireOffset +
                i * (fireWidth + fireGap);

            let fireValue = Math.min(1, value * 1.25);

            let fireHeight =
                Math.max(2, fireValue * height);

            let fy = height - fireHeight;

            // Fire: blue-hot base -> red/orange -> yellow-white tip
            let fireGradient =
                new Cairo.LinearGradient(
                    0,
                    height,
                    0,
                    fy
                );

            fireGradient.addColorStopRGBA(
                0.00, 0.10, 0.18, 0.45, 0.95
            );
            fireGradient.addColorStopRGBA(
                0.12, 0.10, 0.18, 0.45, 0.95
            );
            fireGradient.addColorStopRGBA(
                0.25, 0.55, 0.03, 0.01, 0.95
            );
            fireGradient.addColorStopRGBA(
                0.62, 1.00, 0.38, 0.03, 0.95
            );
            fireGradient.addColorStopRGBA(
                0.84, 1.00, 0.75, 0.05, 0.95
            );
            fireGradient.addColorStopRGBA(
                1.00, 1.00, 0.95, 0.55, 0.95
            );

            cr.setSource(fireGradient);

            let mid = fx + fireWidth / 2;
            let left = fx;
            let right = fx + fireWidth;

            // Flame-shaped top
            let tipOffset =
                ((i * 7) % 5) * 0.45;

            cr.moveTo(left, height);
            cr.lineTo(left, fy + fireHeight * 0.18);
            cr.lineTo(
                left + fireWidth * 0.25,
                fy + fireHeight * 0.32
            );
            cr.lineTo(
                mid - fireWidth * 0.08,
                fy + fireHeight * (0.12 + tipOffset / 20)
            );
            cr.lineTo(
                mid,
                fy
            );
            cr.lineTo(
                mid + fireWidth * 0.10,
                fy + fireHeight * 0.22
            );
            cr.lineTo(
                right - fireWidth * 0.22,
                fy + fireHeight * 0.08
            );
            cr.lineTo(right, fy + fireHeight * 0.28);
            cr.lineTo(right, height);
            cr.closePath();
            cr.fill();

            // Bright flame core at higher levels
            if (value > 0.70) {
                cr.setSourceRGBA(1.0, 0.92, 0.45, 0.95);

                cr.rectangle(
                    fx + fireWidth * 0.30,
                    fy + fireHeight * 0.25,
                    fireWidth * 0.40,
                    fireHeight * 0.55
                );
                cr.fill();
            }

            // Peak marker
            if (this._peaks[i] > 0) {
                let peakY =
                    height -
                    (this._peaks[i] / 100) * height;

                cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95);

                cr.rectangle(
                    fx,
                    Math.max(0, peakY - 1),
                    fireWidth,
                    1
                );
                cr.fill();
            }

            continue;
        }

        if (this._skin === "spectrum") {
            let spectrumWidth = Math.max(2, barWidth);
            let spectrumGap = Math.max(0, gap);

            let totalWidth =
                spectrumWidth * this._barCount +
                spectrumGap * (this._barCount - 1);

            let spectrumOffset =
                Math.max(0, (width - totalWidth) / 2);

            let sx =
                spectrumOffset +
                i * (spectrumWidth + spectrumGap);

            let spectrumHeight =
                Math.max(2, value * height);

            let sy = height - spectrumHeight;

            // Classic Spectrum: pointed tops
            if (value > 0.80) {
                cr.setSourceRGBA(0.95, 0.10, 0.05, 0.95);
            } else if (value > 0.55) {
                cr.setSourceRGBA(1.0, 0.75, 0.05, 0.95);
            } else {
                cr.setSourceRGBA(0.10, 0.80, 0.15, 0.95);
            }

            // Classic Spectrum: solid needle shape
            let needleWidth = Math.max(1, spectrumWidth);

            cr.moveTo(
                sx + spectrumWidth / 2,
                height
            );

            cr.lineTo(
                sx + spectrumWidth / 2 - needleWidth / 2,
                sy + spectrumHeight * 0.45
            );

            cr.lineTo(
                sx + spectrumWidth / 2,
                sy
            );

            cr.lineTo(
                sx + spectrumWidth / 2 + needleWidth / 2,
                sy + spectrumHeight * 0.45
            );

            cr.closePath();
            cr.fill();
            cr.fill();

            // Peak marker
            if (this._peaks[i] > 0) {
                let peakY =
                    height -
                    (this._peaks[i] / 100) * height;

                cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95);

                cr.rectangle(
                    sx,
                    Math.max(0, peakY - 1),
                    spectrumWidth,
                    1
                );
                cr.fill();
            }

            continue;
        }

        if (this._skin === "stereo80") {
                // Visual level curve for 80's Car Stereo.
                // Keeps low/normal levels relatively calm while allowing
                // strong peaks to use the full bar height.
                value = Math.min(1, value * 1.25);

                let segmentHeight = 2;
                let segmentGap = Math.max(1, gap);
                let segments = Math.max(
                    1,
                    Math.floor(height / (segmentHeight + segmentGap))
                );

                let litSegments = Math.ceil(value * segments);

                for (let s = 0; s < litSegments; s++) {
                    let sy =
                        height -
                        (s + 1) * (segmentHeight + segmentGap) +
                        segmentGap;

                    let level = (s + 1) / segments;

                    // 80s Car Stereo: orange
                    cr.setSourceRGBA(1.0, 0.42, 0.05, 0.95);

                    cr.rectangle(
                        x,
                        sy,
                        barWidth,
                        segmentHeight
                    );
                    cr.fill();
                }

                // Peak marker
                if (this._peaks[i] > 0) {
                    let peakY =
                        height -
                        (this._peaks[i] / 100) * height;

                    cr.setSourceRGBA(1.0, 1.0, 1.0, 0.95);

                    cr.rectangle(
                        x,
                        Math.max(0, peakY - 1),
                        barWidth,
                        2
                    );

                    cr.fill();
                }

                continue;
            }

            // Neon Line
            if (this._skin === "neon") {
                // Draw the entire line only once.
                if (i > 0)
                    continue;

                let points = Math.max(
                    2,
                    Math.min(this._barCount, Math.floor(width / 3))
                );

                let step = width / Math.max(1, points - 1);

                // Return the Y position for each point.
                // Leave a small top margin so the glow is not clipped.
                function neonY(p) {
                    let index = Math.floor(
                        p * (this._barCount - 1) /
                        Math.max(1, points - 1)
                    );

                    let level = Math.max(
                        0,
                        Math.min(1, this._bars[index] / 100)
                    );

                    return (height - 2) - level * (height - 4);
                }

                // Outer glow
                cr.setSourceRGBA(0.00, 0.65, 1.00, 0.16);
                cr.setLineWidth(7);
                cr.setLineCap(Cairo.LineCap.ROUND);
                cr.setLineJoin(Cairo.LineJoin.ROUND);

                cr.moveTo(0, neonY.call(this, 0));

                for (let p = 1; p < points; p++) {
                    cr.lineTo(
                        p * step,
                        neonY.call(this, p)
                    );
                }

                cr.stroke();

                // Inre glow
                cr.setSourceRGBA(0.00, 0.85, 1.00, 0.38);
                cr.setLineWidth(4);

                cr.moveTo(0, neonY.call(this, 0));

                for (let p = 1; p < points; p++) {
                    cr.lineTo(
                        p * step,
                        neonY.call(this, p)
                    );
                }

                cr.stroke();

                // Bright neon core
                cr.setSourceRGBA(0.55, 0.95, 1.00, 1.00);
                cr.setLineWidth(1.5);

                cr.moveTo(0, neonY.call(this, 0));

                for (let p = 1; p < points; p++) {
                    cr.lineTo(
                        p * step,
                        neonY.call(this, p)
                    );
                }

                cr.stroke();

                continue;
            }

            // Classic Neon
            if (this._skin === "classicneon") {
                // Dedicated visual level boost for Classic Neon.
                value = Math.min(1, value * 1.25);

                // Narrow classic spectrum bars with cyan neon glow.
                // The bar width is intentionally kept narrow regardless of
                // the global bar_width setting.
                let neonWidth = 1;

                // Classic Neon har egen horisontell geometri.
                // 1 px core with 3 px between bar centers.
                let neonPitch = 3;
                let neonTotalWidth =
                    neonPitch * (this._barCount - 1) + neonWidth;

                let neonOffset =
                    Math.max(0, (width - neonTotalWidth) / 2);

                let neonX =
                    neonOffset + i * neonPitch;

                let neonHeight =
                    Math.max(1, value * height);

                let neonY =
                    height - neonHeight;

                // Outer glow
                cr.setSourceRGBA(
                    0.00, 0.55, 1.00, 0.16
                );

                cr.rectangle(
                    neonX - 1.5,
                    neonY,
                    neonWidth + 3,
                    neonHeight
                );
                cr.fill();

                // Inner blue glow
                cr.setSourceRGBA(
                    0.00, 0.78, 1.00, 0.38
                );

                cr.rectangle(
                    neonX - 0.75,
                    neonY,
                    neonWidth + 1.5,
                    neonHeight
                );
                cr.fill();

                // The neon bar itself
                let neonGradient =
                    new Cairo.LinearGradient(
                        0,
                        height,
                        0,
                        neonY
                    );

                neonGradient.addColorStopRGBA(
                    0.00,
                    0.00, 0.35, 0.85, 0.95
                );

                neonGradient.addColorStopRGBA(
                    0.55,
                    0.00, 0.72, 1.00, 1.00
                );

                neonGradient.addColorStopRGBA(
                    1.00,
                    0.45, 0.96, 1.00, 1.00
                );

                cr.setSource(neonGradient);

                cr.rectangle(
                    neonX,
                    neonY,
                    neonWidth,
                    neonHeight
                );
                cr.fill();

                // Bright cyan top on each bar
                cr.setSourceRGBA(
                    0.65, 1.00, 1.00, 0.95
                );

                cr.rectangle(
                    neonX,
                    neonY,
                    neonWidth,
                    Math.min(1.5, neonHeight)
                );
                cr.fill();

                continue;
            }

            // Cyan/blue color
            // Retro LED colors: green -> yellow -> red
            let bottom = height;
            let top = y;

            // Green: bottom 55%
            let greenTop = Math.max(
                top,
                height - height * 0.55
            );

            if (bottom > greenTop) {
                cr.setSourceRGBA(0.10, 0.80, 0.15, 0.95);
                cr.rectangle(
                    x,
                    greenTop,
                    barWidth,
                    bottom - greenTop
                );
                cr.fill();
            }

            // Yellow: 55–80%
            let yellowTop = Math.max(
                top,
                height - height * 0.80
            );

            if (greenTop > yellowTop) {
                cr.setSourceRGBA(1.0, 0.85, 0.05, 0.95);
                cr.rectangle(
                    x,
                    yellowTop,
                    barWidth,
                    greenTop - yellowTop
                );
                cr.fill();
            }

            // Red: top 20%
            if (yellowTop > top) {
                cr.setSourceRGBA(0.90, 0.05, 0.05, 0.95);
                cr.rectangle(
                    x,
                    top,
                    barWidth,
                    yellowTop - top
                );
                cr.fill();
            }

            // Peak marker
            if (this._peaks[i] > 0) {
                let peakY =
                    height - (this._peaks[i] / 100) * height;

                cr.setSourceRGBA(
                    1.0,
                    1.0,
                    1.0,
                    0.95
                );

                cr.rectangle(
                    x,
                    Math.max(0, peakY - 1),
                    barWidth,
                    2
                );

                cr.fill();
            }

            // Thin dark separator between the LED bars
            if (i < this._barCount - 1) {
                cr.setSourceRGBA(0, 0, 0, 0.65);
                cr.rectangle(
                    x + barWidth,
                    0,
                    gap,
                    height
                );
                cr.fill();
            }
        }

        cr.restore();
        cr.$dispose();
    },

    on_panel_height_changed: function(panelHeight) {
        this._availablePanelHeight = panelHeight;
        this._updateHeight();
    },

    on_applet_removed_from_panel: function() {
        this._removed = true;
        this._cavaRestartPending = false;

        if (this._animationId) {
            Mainloop.source_remove(
                this._animationId
            );

            this._animationId = null;
        }

        if (this._process) {
            try {
                this._process.force_exit();
            } catch (e) {
            }

            this._process = null;
        }

        this._stream = null;
    }
};


function main(metadata, orientation, panelHeight, instanceId) {
    return new AudioSpectrum(
        metadata,
        orientation,
        panelHeight,
        instanceId
    );
}
