const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Cairo = imports.cairo;

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

        this._settings = new Settings.AppletSettings(this, this._metadata.uuid, instanceId);

        // Number of EQ bars
        this._barCount = 60;

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

        // Storlek i panelen
        this._width = 600;

        this._settings.bind("width", "_width", this._onWidthChanged.bind(this));
        this._barWidth = 4;
        this._settings.bind("bar_width", "_barWidth", this._onBarWidthChanged.bind(this));
        this._separator = 0.8;
        this._settings.bind("separator", "_separator", this._onSeparatorChanged.bind(this));
        this._height = 24;
        this._settings.bind("height", "_height", this._onHeightChanged.bind(this));

        this._peakHold = 500;
        this._settings.bind(
            "peak_hold",
            "_peakHold",
            this._onPeakHoldChanged.bind(this)
        );

        this.actor.set_width(this._width);
        this.actor.set_height(this._height);

        // Rita själva visualiseringen
        this._drawingArea = new St.DrawingArea({
            width: this._width,
            height: this._height
        });

        this._drawingArea.connect(
            'repaint',
            this._draw.bind(this)
        );

        this.actor.add_actor(this._drawingArea);

        this._process = null;
        this._stream = null;
        this._animationId = null;

        this._startCava();
        this._animate();
    },

    _onSkinChanged: function() {
        this._drawingArea.queue_repaint();
    },

    _onSensitivityChanged: function() {
        this._restartCava();
    },

    _onFpsChanged: function() {
        this._restartCava();
    },

    _onGravityChanged: function() {
        this._restartCava();
    },

    _onBarCountChanged: function() {
        this._bars = new Array(this._barCount).fill(0);
        this._targets = new Array(this._barCount).fill(0);
        this._peaks = new Array(this._barCount).fill(0);
        this._peakHoldUntil = new Array(this._barCount).fill(0);

        this._drawingArea.queue_repaint();
        this._restartCava();
    },

    _restartCava: function() {
        let config = GLib.build_filenamev([
            this._metadata.path,
            "cava.conf"
        ]);

        let file = Gio.File.new_for_path(config);

        file.load_contents_async(null, (source, result) => {
            try {
                let [, contents] = source.load_contents_finish(result);
                contents = contents.toString();

                contents = contents.replace(
                    /^bars\s*=\s*\d+/m,
                    "bars = " + this._barCount
                );
                contents = contents.replace(
                    /^sensitivity\s*=\s*\d+/m,
                    "sensitivity = " + this._sensitivity
                );
                contents = contents.replace(
                    /^framerate\s*=\s*\d+/m,
                    "framerate = " + this._fps
                );
                contents = contents.replace(
                    /^gravity\s*=\s*\d+/m,
                    "gravity = " + this._gravity
                );

                file.replace_contents_async(
                    contents,
                    null,
                    false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null,
                    (source, result) => {
                        try {
                            source.replace_contents_finish(result);

                            if (this._process) {
                                try {
                                    this._process.force_exit();
                                } catch (e) {
                                }

                                this._process = null;
                            }

                            this._stream = null;
                            this._startCava();

                        } catch (e) {
                            global.logError(
                                "Audio Spectrum: could not update CAVA: " + e
                            );
                        }
                    }
                );

            } catch (e) {
                global.logError(
                    "Audio Spectrum: could not update CAVA: " + e
                );
            }
        });
    },

    _onHeightChanged: function() {
        if (this.actor)
            this.actor.set_height(this._height);

        if (this._drawingArea)
            this._drawingArea.set_height(this._height);

        if (this._drawingArea)
            this._drawingArea.queue_repaint();
    },

    _onBarWidthChanged: function() {
        this._drawingArea.queue_repaint();
    },

    _onSeparatorChanged: function() {
        this._drawingArea.queue_repaint();
    },

    _onPeakHoldChanged: function() {
        this._drawingArea.queue_repaint();
    },

    _onWidthChanged: function() {
        this.actor.set_width(this._width);
        this._drawingArea.set_width(this._width);
        this._drawingArea.queue_repaint();
    },

    _startCava: function() {
        let config = GLib.build_filenamev([
            this._metadata.path,
            'cava.conf'
        ]);

        try {
            this._process = Gio.Subprocess.new(
                [
                    'cava',
                    '-p',
                    config
                ],
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE
            );

            this._stream = new Gio.DataInputStream({
                base_stream: this._process.get_stdout_pipe()
            });

            this._readLine();

        } catch (e) {
            global.logError(
                'Audio Spectrum: could not start CAVA: ' + e
            );
        }
    },

    _readLine: function() {
        if (!this._stream)
            return;

        this._stream.read_line_async(
            GLib.PRIORITY_DEFAULT,
            null,
            (stream, result) => {
                try {
                    let data = stream.read_line_finish_utf8(result);
                    let line = data[0];

                    if (line !== null && line !== undefined) {
                        if (line.length > 0)
                            this._parse(line);

                        this._readLine();
                    }

                } catch (e) {
                    global.logError(
                        'Audio Spectrum: error reading from CAVA: ' + e
                    );
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

        for (let i = 0; i < this._barCount; i++) {
            if (i < values.length && !isNaN(values[i])) {
                this._targets[i] = Math.max(
                    0,
                    Math.min(100, values[i])
                );
            }
        }
    },

    _animate: function() {
        for (let i = 0; i < this._barCount; i++) {
            let current = this._bars[i];
            let target = this._targets[i];

            // Mild dynamikkurva:
            // lyfter svaga frekvensband utan att ändra maxnivån.
            target = Math.pow(target / 100, 0.90) * 100;

            // Snabb attack: förstärk plötsliga uppåtgående transienter.
            // Fallande nivåer lämnas orörda.
            if (target > current) {
                this._bars[i] = Math.min(
                    100,
                    target + (target - current) * 0.35
                );
            } else {
                this._bars[i] = target;
            }

            // Peak-hold: håll toppen i 0,5 sekunder
            if (target > this._peaks[i]) {
                this._peaks[i] = target;

                if (this._peakHold > 0) {
                    this._peakHoldUntil[i] =
                        Date.now() + this._peakHold;
                } else {
                    this._peaks[i] = 0;
                }
            } else if (Date.now() > this._peakHoldUntil[i]) {
                // Låt peak-markören falla långsamt efter hold-tiden
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
        let height = area.height;

        // Transparent bakgrund
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

        // VU Meter: en enda horisontell nivåmätare
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

            // Medelnivå i stället för maxnivå
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

            // Diskret bakgrund
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

            // Klassisk VU-skala: grön -> gul -> röd
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
                  // Rita hela oscilloskopet endast en gång per frame.
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

                // Peak-markör
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

            // Classic Spectrum: hel nålform
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
                // Visuell nivåkurva för 80's Car Stereo.
                // Behåller låg/normal nivå relativt lugn men låter
                // strong peaks can use the full bar height.
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

                // Peak-markör
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
                // Rita hela linjen bara en gång.
                if (i > 0)
                    continue;

                let points = Math.max(
                    2,
                    Math.min(this._barCount, Math.floor(width / 3))
                );

                let step = width / Math.max(1, points - 1);

                // Returnerar Y-position för respektive punkt.
                // Lite marginal upptill så glow inte kapas.
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

                // Yttre glow
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

                // Ljus neonkärna
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
                // Egen visuell nivåförstärkning för Classic Neon.
                value = Math.min(1, value * 1.25);

                // Narrow classic spectrum bars with cyan neon glow.
                // Bar width is intentionally kept small regardless of
                // den globala bar_width-inställningen.
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

                // Yttre glow
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

                // Inre blå glow
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

                // Själva neonstapeln
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

                // Ljus cyan topp på varje stapel
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

            // Cyan/blå färg
            // Retro LED-färger: grönt -> gult -> rött
            let bottom = height;
            let top = y;

            // Grönt: nedersta 55 %
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

            // Gult: 55–80 %
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

            // Rött: översta 20 %
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

            // Peak-markör
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

            // Thin dark separator between LED bars
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

        cr.$dispose();
    },

    on_applet_removed_from_panel: function() {

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
