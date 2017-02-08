/**
 * Cinnamon Screenshot class to support capture selection and 
 * communication with back-end screencapture program.
 *
 * @author  Rob Adams <pillage@gmail.com>
 * @link    http://github.com/rjanja/desktop-capture/
 */

const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Params = imports.misc.params;
const Clutter = imports.gi.Clutter;

const Flashspot = imports.ui.flashspot;
//const Lightbox = imports.ui.lightbox;
const Util = imports.misc.util;
const Tweener = imports.ui.tweener;

const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;

// l10n/translation support
const Gettext = imports.gettext;
const UUID = "capture@rjanja";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const SelectionType = {
   ALL_WORKSPACES: 0,  /* @todo */
   SCREEN: 1,
   MONITOR: 2,
   WINDOW: 3,
   AREA: 4,
   CINNAMON: 5,
   REPEAT: 6
}

const SOUND_ID = 1;

const SelectionTypeStr = {
   0: "workspaces",
   1: "screen",
   2: "monitor",
   3: "window",
   4: "area",
   5: "cinnamon",
   6: "repeat"
}

function ScreenshotHelper(selectionType, callback, params) {
   this._init(selectionType, callback, params);
}
ScreenshotHelper.prototype = {
   _init: function(selectionType, callback, params) {
      this._capturedEventId = null;
      this._selectionType = selectionType;
      this._callback = callback;
      this._modifiers = {};
      this._timeout  = 0;
      this._interactive = false;
      this._params = {
         filename: '',
         useFlash: true,
         includeFrame: true,
         includeCursor: true,
         includeStyles: true,
         windowAsArea: false,
         playShutterSound: true,
         useTimer: true,
         showTimer: true,
         playTimerSound: true,
         timerDuration: 3,
         soundTimerInterval: 'dialog-warning',
         soundShutter: 'camera-shutter',
         sendNotification: true,
         uploadToImgur: false,
         useIndex: null,
         openAfter: false,
         selectionHelper: false
      };

      this.setOptions(params);
      
      global.log("Initializing screenshot tool");

      this._xfixesCursor = Cinnamon.XFixesCursor.get_for_stage(global.stage);

      if (selectionType !== null) {
         this.runCaptureMode(selectionType);
      }
   },

   playSound: function(effect) {
      // @todo: Maybe check against GLib.getenv("CINNAMON_VERSION") instead.
      if ("cancel_theme_sound" in global) {
         global.cancel_theme_sound(SOUND_ID);
      }
      else {
         global.cancel_sound(SOUND_ID);
      }

      global.play_theme_sound(SOUND_ID, effect);
   },

   setOptions: function(params) {
      if (params != undefined) {
         this._params = Params.parse(params, this._params);
      }
   },

   runCaptureMode: function(mode) {
      this._selectionType = mode;

      if (mode == SelectionType.WINDOW) {
         this.selectWindow();
      }
      else if (mode == SelectionType.AREA) {
         this.selectArea();
      }
      else if (mode == SelectionType.CINNAMON) {
         this.selectCinnamon();
      }
      else if (mode == SelectionType.SCREEN) {
         this.selectScreen();
      }
      else if (mode == SelectionType.MONITOR) {
         this.selectMonitor();
      }
   },

   getModifier: function(symbol) {
      //global.log('getModifier ' + symbol);
      return this._modifiers[symbol] || false;
   },

   setModifier: function(symbol, value) {
      //global.log('setModifier ' + symbol + (value ? ' TRUE ' : ' false'));
      this._modifiers[symbol] = value;
   },

   captureTimer: function(options, onFinished, onInterval) {
      if (options.useTimer && options.timerDuration > 0) {
         if (options.showTimer == false) {
            let timeoutId = Mainloop.timeout_add(options.timerDuration * 1000, Lang.bind(this, function() {
               Mainloop.source_remove(timeoutId);
               onFinished();
               return false;
            }));
         }
         else {
            this._setTimer(options.timerDuration);
            this._fadeOutTimer();

            if (options.playTimerSound)
               this.playSound(options.soundTimerInterval);

            let timeoutId = Mainloop.timeout_add(1000, Lang.bind(this, function() {
               this._timeout--;

               if (onInterval && typeof onInterval == 'function')
                  onInterval();

               if (this._timeout > 0) {
                  let timeoutText = '';
                  if (this._timeout == 1 && Math.floor(Math.random()*101) == 100) {
                     timeoutText = '\u2764';
                  }
                  else {
                     timeoutText = this._timeout;
                  }

                  this._timer.set_text('' + timeoutText);

                  if (options.playTimerSound)
                     this.playSound(options.soundTimerInterval)

                  this._fadeOutTimer();
               } else {
                  //if (options.playShutterSound)
                  //   this.playSound(options.soundShutter);

                  Mainloop.source_remove(timeoutId);
                  onFinished();
                  return false;
               }

               return true;
            }));
         }
      }
      else {
         onFinished();
      }   
   },

   _setTimer: function(timeout) {
      if (timeout === 0) {
         if (this._timer) {
            Main.uiGroup.remove_actor(this._timer);
            this._timer.destroy();
            this._timer = null;
         }
      } else {
         if (!this._timer) {
            this._timer = new St.Label({
              style_class: 'capture-countdown-timer'
            });

            Main.uiGroup.add_actor(this._timer);

            let monitor;
            if (this._params.useIndex != null) {
               monitor = Main.layoutManager.monitors[this._params.useIndex];
            }
            else {
               monitor = Main.layoutManager.primaryMonitor;
            }

            this._timer.set_position(
              (monitor.width / 2 + monitor.x),
              (monitor.height / 2 + monitor.y)
            );

            this._timer.set_anchor_point_from_gravity(Clutter.Gravity.CENTER);
         }

         this._timer.set_text('' + timeout);
      }

      this._timeout = timeout;
   },

   _fadeOutTimer: function() {
     this._timer.opacity = 255;
     this._timer.scale_x = 1.0;
     this._timer.scale_y = 1.0;

     Tweener.addTween(this._timer, {
         opacity: 0,
         scale_x: 2.5,
         scale_y: 2.5,
         delay: 0.200,
         time: 0.700,
         transition: 'linear'
     });
   },

   /**
    * showSystemCursor:
    * Show the system mouse pointer.
    */
   showSystemCursor: function() {
      this._xfixesCursor.show();
   },

   /**
    * hideSystemCursor:
    * Hide the system mouse pointer.
    */
   hideSystemCursor: function() {
      this._xfixesCursor.hide();
   },

   flash: function(x, y, width, height) {
      //global.log('flash x:'+x+' y:'+y+' w:'+width+' h:'+height);
      let flashspot = new Flashspot.Flashspot({ x : x, y : y, width: width, height: height});
      global.f = flashspot;
      flashspot.fire();
   },

   selectScreen: function() {
      this.captureTimer(this._params, Lang.bind(this, Lang.bind(this, function() {
         this.screenshotScreen();
      })));
   },

   selectMonitor: function() {
      this.captureTimer(this._params, Lang.bind(this, Lang.bind(this, function() {
         this.screenshotMonitor();
      })));
   },
   
   selectCinnamon: function() {
      this._modal = true;
      this._target = null;
      this._pointerTarget = null;
      this._borderPaintTarget = null;
      this._borderPaintId = null;
      this._screenWidth = global.screen_width;
      this._screenHeight = global.screen_height;

      this.container = new Cinnamon.GenericContainer({
         name: 'frame-container',
         reactive: false,
         visible: true,
         x: 0,
         y: 0
      });

      Main.uiGroup.add_actor(this.container);

      if (!Main.pushModal(this.container)) {
         return;
      }

      this.initializeShadow();

      this.showInstructions('ui');
      this._capturedEventId = global.stage.connect('captured-event', Lang.bind(this, this._onCapturedEvent));
   },

   _updateCinnamon: function(event) {
      let [stageX, stageY] = event.get_coords();
      let target = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE,
                                                 stageX,
                                                 stageY);

      if (target != this._pointerTarget) {
         this._target = target;
      }

      this._pointerTarget = target;

      if (this._borderPaintTarget != this._target) {
         if (this.uiContainer) {
            this.clearActorOutline();
         }

         this.showActorOutline(this._target, stageX, stageY);
      }
   },

   _onDestroy: function() {
      this.reset();
   },

   selectArea: function() {
      this._modal = true;
      this._mouseDown = false;
      this._isMoving = false;
      this._isResizing = false;
      this._resizeActor = null;
      this._timeout = 0;
      this._xStart = -1;
      this._yStart = -1;
      this._xEnd = -1;
      this._yEnd = -1;
      this._selectionMade = false;
      this._screenWidth = global.screen_width;
      this._screenHeight = global.screen_height;

      this.container = new St.Group({
         reactive: true,
         style_class: 'capture-area-selection',
         x_align: St.Align.START,
         y_align: St.Align.START
      });

      Main.uiGroup.add_actor(this.container);

      if (!Main.pushModal(this.container)) {
         return;
      }

      this.border1 = new St.Bin({ 
         style_class: 'border-h',
         x_fill: true,
         y_fill: false,
         y_align: St.Align.START
      });
      this.border2 = new St.Bin({ 
         style_class: 'border-h',
         x_fill: true,
         y_fill: false,
         y_align: St.Align.END
      });
      this.border3 = new St.Bin({ 
         style_class: 'border-v',
         x_fill: false,
         y_fill: true,
         x_align: St.Align.START,
         y_align: St.Align.START
      });
      this.border4 = new St.Bin({ 
         style_class: 'border-v',
         x_fill: false,
         y_fill: true,
         x_align: St.Align.END,
         y_align: St.Align.START
      });

      this.container.add_actor(this.border1, {expand: false, x_fill: false});
      this.container.add_actor(this.border2, {expand: false, x_fill: false});
      this.container.add_actor(this.border3, {expand: false, x_fill: false});
      this.container.add_actor(this.border4, {expand: false, x_fill: false});

      this.handle1 = new St.Bin({ style_class: 'handle', name: 'handleNw', reactive: true });
      this.handle2 = new St.Bin({ style_class: 'handle', name: 'handleN', reactive: true });
      this.handle3 = new St.Bin({ style_class: 'handle', name: 'handleNe', reactive: true });
      this.handle4 = new St.Bin({ style_class: 'handle', name: 'handleW', reactive: true });
      this.handle5 = new St.Bin({ style_class: 'handle', name: 'handleE', reactive: true });
      this.handle6 = new St.Bin({ style_class: 'handle', name: 'handleSw', reactive: true });
      this.handle7 = new St.Bin({ style_class: 'handle', name: 'handleS', reactive: true });
      this.handle8 = new St.Bin({ style_class: 'handle', name: 'handleSe', reactive: true });

      this.container.add_actor(this.handle1);
      this.container.add_actor(this.handle2);
      this.container.add_actor(this.handle3);
      this.container.add_actor(this.handle4);
      this.container.add_actor(this.handle5);
      this.container.add_actor(this.handle6);
      this.container.add_actor(this.handle7);
      this.container.add_actor(this.handle8);

      
      this.initializeShadow();
      this.drawShadows(0, 0, 0, 0);

      this.showInstructions('area');

      global.set_cursor(Cinnamon.Cursor.POINTING_HAND);

      this._capturedEventId = global.stage.connect('captured-event', Lang.bind(this, this._onCapturedEvent));

   },

   instructionsShowing: function() {
      return this.instructionsContainer && this.instructionsContainer !== null;
   },

   hideInstructions: function() {
      if (this.instructionsShowing()) {
         Main.uiGroup.remove_actor(this.instructionsContainer);
         this.instructionsContainer.destroy();
         this.instructionsContainer = null;
         return true;
      } 
      else {
         return false;
      }
   }, 

   showInstructions: function(cssExtra) {
      this.instructionsContainer = new St.Group({
         reactive: false,
         style_class: 'instructions-container' + ' ' + cssExtra
      });

      Main.uiGroup.add_actor(this.instructionsContainer);

      let monitor = Main.layoutManager.primaryMonitor;
      let [startX, startY] = [monitor.x + 50, monitor.height / 2 + monitor.y + 50];

      let labelWidth = monitor.width - 100,
          labelHeight = monitor.height / 1.5;

      this.instructionsContainer.set_size(monitor.width, monitor.height);
      this.instructionsContainer.set_position(monitor.x, monitor.y);

      function instructionHeader(container, labelText) {
         let label = new St.Label({
            text: labelText,
            style_class: 'instructions-label-header'
         });
         container.add_actor(label);
         label.set_position(startX, startY);
         label.set_size(labelWidth, 40);
         return true;
      }

      let subCount = 0;
      function instructionSub(container, labelText) {
         subCount++;
         let label = new St.Label({
            text: labelText,
            style_class: 'instructions-label-text'
         });
         container.add_actor(label);
         label.set_position(startX, startY + (subCount * 40));
         label.set_size(labelWidth, 30);
         return true;
      }

      if (this._selectionType == SelectionType.AREA) {
         startY -= 140; // 30*3 + 50
         instructionHeader(this.instructionsContainer, _("Select an area by clicking and dragging"));
         instructionSub(this.instructionsContainer, _("Use arrow keys to move the selection"));
         instructionSub(this.instructionsContainer, _("Use SHIFT and arrow keys to resize the selection"));
         instructionSub(this.instructionsContainer, _("Press ENTER to confirm or ESC to cancel")); //or KP_RETURN to complete the capture, or ESC to cancel"));
      }
      else if (this._selectionType == SelectionType.CINNAMON) {
         startY -= 140;
         instructionHeader(this.instructionsContainer, _("Select a UI element by moving the mouse"));
         instructionSub(this.instructionsContainer, _("Use mousewheel to traverse hierarchy"));
         instructionSub(this.instructionsContainer, _("Hold SHIFT to allow clicking UI element"));
         instructionSub(this.instructionsContainer, _("Click to complete the capture, or ESC to cancel"));
      }
   },

   initializeShadow: function() {
      this.shadowContainer = new St.Group({
         reactive: false,
         style_class: 'shadow-container'
      });
      
      Main.uiGroup.add_actor(this.shadowContainer);

      this.coverLeft = new St.Bin({
         style_class: 'cover',
         x_fill: true,
         y_fill: true
      });
      this.coverRight = new St.Bin({
         style_class: 'cover',
         x_fill: true,
         y_fill: true
      });
      this.coverTop = new St.Bin({
         style_class: 'cover',
         x_fill: true,
         y_fill: true
      });
      this.coverBottom = new St.Bin({
         style_class: 'cover',
         x_fill: true,
         y_fill: true
      });
      
      this.shadowContainer.add_actor(this.coverLeft);
      this.shadowContainer.add_actor(this.coverRight);
      this.shadowContainer.add_actor(this.coverTop);
      this.shadowContainer.add_actor(this.coverBottom);
   },

   selectWindow: function() {
      this._modal = true;
      this._mouseDown = false;
      this._outlineBackground = null;
      this._outlineFrame = null;
      this.bringWindowsToFront = false;

      this.container = new Cinnamon.GenericContainer({
         name: 'frame-container',
         reactive: true,
         visible: true,
         x: 0,
         y: 0
      });

      Main.uiGroup.add_actor(this.container);

      if (!Main.pushModal(this.container)) {
         return;
      }

      this._windows = global.get_window_actors();

      global.set_cursor(Cinnamon.Cursor.POINTING_HAND);

      this._capturedEventId = global.stage.connect('captured-event', Lang.bind(this, this._onCapturedEvent));
   },

   getDefaultFilename: function() {
      let date = new Date();
      let filename = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) + '/'
         + 'screenshot-'
         + this.getSelectionTypeStr() + '-'
         + date.getFullYear() + '-'
         + this._padNum(date.getMonth() + 1) + '-'
         + this._padNum(date.getDate()) + 'T'
         + this._padNum(date.getHours()) + ':'
         + this._padNum(date.getMinutes()) + ':'
         + this._padNum(date.getSeconds())
         + '.png';

      return filename;
   },

   getFilename: function(options) {
      if (options['filename'] == '') {
         return this.getDefaultFilename();
      }
      else if (options['filename'].indexOf('%') != -1) {
         let date = new Date();
         return str_replace(
            ['%Y',
            '%M',
            '%D',
            '%H',
            '%I',
            '%S',
            '%m',
            '%TYPE'],
            [date.getFullYear(),
            this._padNum(date.getMonth() + 1),
            this._padNum(date.getDate()),
            this._padNum(date.getHours()),
            this._padNum(date.getMinutes()),
            this._padNum(date.getSeconds()),
            this._padNum(date.getMilliseconds()),
            this.getSelectionTypeStr(this._selectionType)
            ],
            options['filename']);
      }
      else {
         return options['filename'];
      }
   },

   _padNum: function(num) {
      return (num < 10 ? '0' + num : num);
   },

   getSelectionTypeStr: function() {
      return SelectionTypeStr[this._selectionType];
   },

   getParams: function(options) {
      if (options != undefined)
         return Params.parse(this._params, options);

      return this._params;
   },

   screenshotScreen: function(options) {
      //global.log('screenshotScreen()');

      let opts = this.getParams(options);
      let filename = this.getFilename(opts);

      let screenshot = new Cinnamon.Screenshot();
      screenshot.screenshot (opts.includeCursor, filename,
         Lang.bind(this, function() {
            this.runCallback({
               file: filename,
               options: opts
            });
         }));

      return true;
   },

   screenshotMonitor: function(options) {
      //global.log('screenshotMonitor()');

      let opts = this.getParams(options);
      let filename = this.getFilename(opts);

      let monitor = Main.layoutManager.monitors[opts.useIndex];
      
      // Call capture back-end.
      let screenshot = new Cinnamon.Screenshot();
      screenshot.screenshot_area (opts.includeCursor, 
                                  monitor.x, monitor.y, 
                                  monitor.width, monitor.height, 
                                  filename,
         Lang.bind(this, function() {
            this.runCallback({
               x: monitor.x,
               y: monitor.y,
               width: monitor.width,
               height: monitor.height,
               file: filename,
               options: opts
            });
         }));

      return true;
   },

   

   screenshotCinnamon: function(actor, stageX, stageY, options) {
      //global.log('screenshotCinnamon() [actor,stageX,stageY]');

      if (actor.get_paint_visibility() === false) {
         global.log('Actor is not visible. Cancelling screenshot to prevent empty output.');
         this.reset();
         return false;
      }
      
      // Reset after a short delay so we don't activate the actor we
      // have clicked.
      let timeoutId = Mainloop.timeout_add(200, Lang.bind(this, function() {
         this.reset();
         Mainloop.source_remove(timeoutId);
         return false;
      }));

      let opts = this.getParams(options);
      let filename = this.getFilename(opts);

      // If we don't use a short timer here, we end up capturing any
      // CSS styles we're applying to the selection. So use a short timer,
      // and make it into an option.
      let captureTimer = 200;
      if (opts.includeStyles)
         captureTimer = 0;

      let captureTimeoutId = Mainloop.timeout_add(captureTimer, Lang.bind(this, function() {
         Mainloop.source_remove(captureTimeoutId);

         let [x, y] = actor.get_transformed_position();
         let [width, height] = actor.get_transformed_size();

         // Call capture back-end.
         let screenshot = new Cinnamon.Screenshot();
         screenshot.screenshot_area (opts.includeCursor, x, y, width, height, filename,
            Lang.bind(this, function() {
               this.runCallback({
                  stageX: stageX,
                  stageY: stageY,
                  actor: actor,
                  x: x,
                  y: y,
                  width: width,
                  height: height,
                  file: filename,
                  options: opts
               });
            }));
      }));

      return true;
   },

   screenshotArea: function(x, y, width, height, options) {
      //global.log('screenshotArea(' + x + ', ' + y + ', ' + width + ', ' + height + ') [x,y,w,h]');
      this.reset();

      let opts = this.getParams(options);
      let filename = this.getFilename(opts);

      if (null !== this._callback && opts.selectionHelper === true) {
         this._callback({
            x: x, y: y, width: width, height: height,
            file: filename, options: opts });
         return false;
      }

      // Call capture back-end.
      let screenshot = new Cinnamon.Screenshot();
      this.captureTimer(opts, Lang.bind(this, function() {
         screenshot.screenshot_area (opts.includeCursor, x, y, width, height, filename,
            Lang.bind(this, function() {
               this.runCallback({
                  x: x,
                  y: y,
                  width: width,
                  height: height,
                  file: filename,
                  options: opts
               });
            }));
      }));

      return true;
   },

   screenshotWindow: function(window, options) {
      if (!window.get_meta_window().has_focus()) {
         let tracker = Cinnamon.WindowTracker.get_default();
         let focusEventId = tracker.connect('notify::focus-app', Lang.bind(this, function() {
             let timeoutId = Mainloop.timeout_add(1, Lang.bind(this, function() {
                 this.screenshotWindow(window, options);
                 Mainloop.source_remove(timeoutId);
                 return false;
             }));

             tracker.disconnect(focusEventId);
         }));

         Main.activateWindow(window.get_meta_window(), global.get_current_time())

         return true;
      }

      // Get the size so we can calculate the outer rectangle area.
      let [sW, sY] = window.get_size();

      let rect = window.get_meta_window().get_outer_rect();
      [width, height, x, y] = [rect.width, rect.height, rect.x, rect.y];

      //global.log('screenshotWindow(..) [frame, cursor, flash, filename]');
      this.reset();

      let opts = this.getParams(options);
      let filename = this.getFilename(opts);

      let screenshot = new Cinnamon.Screenshot();

      if (null !== this._callback && opts.selectionHelper === true) {
         this._callback({
            window: window, x: x, y: y, width: width, height: height,
            file: filename, options: opts });
         return false;
      }

      this.captureTimer(opts, Lang.bind(this, function() {
         if (opts.windowAsArea) {
            screenshot.screenshot_area (opts.includeCursor, x, y, width, height, filename,
               Lang.bind(this, function() {
                  this.runCallback({
                     window: window, x: x, y: y, width: width, height: height,
                     file: filename, options: opts });
               }));
         }
         else {
            screenshot.screenshot_window (opts.includeFrame, opts.includeCursor, filename,
               Lang.bind(this, function() {
                  this.runCallback({
                     window: window, x: x, y: y, width: width, height: height,
                     file: filename, options: opts });
               }));
         }
      }), Lang.bind(this, function() {
         // Make sure we have the right window focused.
         Main.activateWindow(window.get_meta_window(), global.get_current_time())
      }));

      return true;
   },

   runCallback: function(screenshot) {
      screenshot.selectionType = this._selectionType;
      screenshot.selectionTypeVerbose = this.getSelectionTypeStr(this._selectionType);

      let fileCapture = Gio.file_new_for_path(screenshot.file);
      screenshot.outputFilename = fileCapture.get_basename();
      screenshot.outputDirectory = fileCapture.get_parent().get_path();

      if (screenshot.options.useFlash) {
         if (this._selectionType == SelectionType.WINDOW
          && screenshot.window.get_meta_window().get_title() != _('Desktop')
          && screenshot.options.padWindowFlash) {
            let pad = 1;
            this.flash(screenshot.x - pad, screenshot.y - pad, screenshot.width + (2*pad), screenshot.height + (2*pad));
         }
         else if (this._selectionType == SelectionType.SCREEN) {
            this.flash(0, 0, global.screen_width, global.screen_height);
         }
         else {
            this.flash(screenshot.x, screenshot.y, screenshot.width, screenshot.height);
         }
      }

      if (screenshot.options.playShutterSound) {
         this.playSound('camera-shutter');
      }

      if (this._callback) {
         this._callback(screenshot);
      }

      return true;
   },

   _getLaunchContext: function(screenshot) {
      // return global.create_app_launch_context();
      return new Gio.AppLaunchContext();
   },

   abort: function() {
      this.reset();
      return true;
   },

   reset: function() {
      // Mode-specific resets
      if (this._selectionType == SelectionType.WINDOW) {
         if (this._windowSelected) {
            this.clearWindowOutline();
         }
      }
      else if (this._selectionType == SelectionType.CINNAMON) {
         if (this.uiContainer) {
            this.clearActorOutline();
         }

         if (this._borderPaintTarget != null) {
            this._borderPaintTarget.disconnect(this._borderPaintId);
         }

         if (this._eventHandler) {
            this._eventHandler.destroy();
         }
         this._eventHandler = null;
      }
      
      if (this.shadowContainer) {
         Main.uiGroup.remove_actor(this.shadowContainer);
         this.shadowContainer.destroy();
      }

      this.hideInstructions();
      
      if (this._timer) {
         Main.uiGroup.remove_actor(this._timer);
         this._timer.destroy();
         this._timer = null;
      }

      if (this._modal) {
         Main.popModal(this.container);
      }

      if (this._lightbox) {
         this._lightbox.hide();
         this._lightbox.destroy();
      }

      global.unset_cursor();

      this._modal = false;

      if (this.container) {
         Main.uiGroup.remove_actor(this.container);
         this.container.destroy();
      }

      if (this._capturedEventId) {
         global.stage.disconnect(this._capturedEventId);
         this._capturedEventId = null;
      }
   },

   drawBorders: function(width, height) {
      this.border1.set_clip(0, 0, width, 1);
      this.border2.set_clip(0, 0, width, 1);
      this.border3.set_clip(0, 0, 1, height);
      this.border4.set_clip(0, 0, 1, height);

      this.border1.set_position(0, 0);
      this.border1.set_size(width, 1);

      this.border2.set_position(0, height-1);
      this.border2.set_size(width, 1);

      this.border3.set_position(0, 0);
      this.border3.set_size(1, height);

      this.border4.set_position(width-1, 0);
      this.border4.set_size(1, height);

      let handleSize = 10;

      this.handle1.set_position(0, 0);
      this.handle1.set_size(handleSize, handleSize);
      this.handle2.set_position(width/2-(handleSize/2), 0);
      this.handle2.set_size(handleSize, handleSize);
      this.handle3.set_position(width - handleSize, 0);
      this.handle3.set_size(handleSize, handleSize);
      this.handle4.set_position(0, height/2-(handleSize/2));
      this.handle4.set_size(handleSize, handleSize);
      this.handle5.set_position(width - handleSize, height/2-(handleSize/2));
      this.handle5.set_size(handleSize, handleSize);
      this.handle6.set_position(0, height - handleSize);
      this.handle6.set_size(handleSize, handleSize);
      this.handle7.set_position(width/2-(handleSize/2), height - handleSize);
      this.handle7.set_size(handleSize, handleSize);
      this.handle8.set_position(width - handleSize, height - handleSize);
      this.handle8.set_size(handleSize, handleSize);
   },

   drawShadows: function(x, y, width, height) {
      this.coverLeft.set_position(0, 0);
      this.coverLeft.set_size(x, this._screenHeight);

      this.coverRight.set_position(x+width, 0);
      this.coverRight.set_size(this._screenWidth - (x+width), this._screenHeight);

      this.coverTop.set_position(x, 0);
      this.coverTop.set_size(width, y);

      this.coverBottom.set_position(x, y+height);
      this.coverBottom.set_size(width, (this._screenHeight - (y+height)));
   },

   redrawAreaSelection: function(x, y) {
      let width = Math.abs(this._xEnd - this._xStart);
      let height = Math.abs(this._yEnd - this._yStart);

      // Constrain selection area to screen dimensions
      if (x+width > this._screenWidth) x = this._screenWidth - width;
      if (y+height > this._screenHeight) y = this._screenHeight - height;

      this.container.set_position(x, y);
      this.container.set_size(width, height);

      this.drawBorders(width, height);
      this.drawShadows(x, y, width, height);
   },

   _onCapturedEvent: function(actor, event) {
      let type = event.type();

      if (type == Clutter.EventType.KEY_PRESS) {
         this.hideInstructions();
         let sym = event.get_key_symbol();
         if (sym == Clutter.Escape) {
            global.log("Aborting screenshot.");
            this.abort();
            return true;
         }
         else if (sym == Clutter.Shift_L) {
            this.setModifier(sym, true);
            return true;
         }
         else if (this._selectionType == SelectionType.AREA) {
            if (this._selectionMade && (sym == Clutter.KEY_Return || sym == Clutter.KEY_KP_Enter)) {
               let [x,y] = this.container.get_position();
               let [w,h] = this.container.get_size();
               global.log("Selection area is "+x+","+y+" - " + w + " x " + h);
               this.screenshotArea(x, y, w, h);
               return true;
            }
            else if (this._selectionMade) {
               let isMovementKey = (sym == Clutter.KEY_Up 
                   || sym == Clutter.KEY_Down || sym == Clutter.KEY_Left 
                   || sym == Clutter.KEY_Right);

               if (isMovementKey) {
                  if (this.getModifier(Clutter.Shift_L)) {
                     // Resize selection
                     switch (sym) {
                        case Clutter.KEY_Up:
                           this._yEnd -= 1;
                           break;
                        case Clutter.KEY_Down:
                           this._yEnd += 1;
                           break;
                        case Clutter.KEY_Left:
                           this._xEnd -= 1;
                           break;
                        case Clutter.KEY_Right:
                           this._xEnd += 1;
                           break;
                     }
                  }
                  else {
                     // Move selection
                     switch (sym) {
                        case Clutter.KEY_Up:
                           if (this._yStart > 1) {
                              this._yStart -= 1;
                              this._yEnd -= 1;
                           }
                           break;
                        case Clutter.KEY_Down:
                           if (this._yEnd < this._screenHeight) {
                              this._yStart += 1;
                              this._yEnd += 1;
                           }
                           break;
                        case Clutter.KEY_Left:
                           if (this._xStart > 1) {
                              this._xStart -= 1;
                              this._xEnd -= 1;
                           }
                           break;
                        case Clutter.KEY_Right:
                           if (this._xEnd < this._screenWidth) {
                              this._xStart += 1;
                              this._xEnd += 1;
                           }
                           break;
                     }
                  }

                  let x = Math.min(this._xEnd, this._xStart);
                  let y = Math.min(this._yEnd, this._yStart);
                  this.redrawAreaSelection(x, y);
                  return true;
               }
            }
         }
      }
      else if (type == Clutter.EventType.KEY_RELEASE) {
         let sym = event.get_key_symbol();
         if (sym == Clutter.Shift_L)
         {
            this.setModifier(sym, false);
         }
      }
      else if (type == Clutter.EventType.BUTTON_PRESS) {
         if (this.instructionsShowing()) {
            this.hideInstructions();
            return true;
         }

         if (event.get_button() != 1) {
             return true;
         }

         let [xMouse, yMouse, mask] = global.get_pointer();

         if (event.get_source() == this.container) {
            this._isMoving = true;
            this._mouseDown = true;
            this._xMouse = xMouse;
            this._yMouse = yMouse;
         }
         else if (event.get_source().style_class == 'handle') {
            this._isResizing = true;
            this._mouseDown = true;
            this._resizeActor = event.get_source();
            return true;
         }
         else {
            this._isMoving = false;
            this._mouseDown = true;
            this._xStart = xMouse;
            this._yStart = yMouse;
            this._xEnd = xMouse;
            this._yEnd = yMouse;
         }

         if (this._selectionMade) {
            return true;
         }

         if (this._selectionType == SelectionType.AREA) {
            this.container.set_position(this._xStart, this._yStart);
            this.container.set_size(1, 1);
         }
         else if (this._selectionType == SelectionType.CINNAMON) {
            if (this.getModifier(Clutter.Shift_L))
            {
               if (this._capturedEventId) {
                  global.stage.disconnect(this._capturedEventId);
                  this._capturedEventId = null;
                  global.unset_cursor();

                  let timeoutId = Mainloop.timeout_add(100, Lang.bind(this, function() {
                     global.set_cursor(Cinnamon.Cursor.POINTING_HAND);
                     this._capturedEventId = global.stage.connect('captured-event', Lang.bind(this, this._onCapturedEvent));
                     return false;
                  }));
               }

               return false;
            }
            else if (this._target) {
               let [stageX, stageY] = event.get_coords();
               this.screenshotCinnamon(this._target, stageX, stageY);
               //this.reset();
               return true;
            }
            return true;
         }

      }
      else if (type == Clutter.EventType.MOTION && this._selectionType == SelectionType.WINDOW) {
         let [x, y, mask] = global.get_pointer();

         let windows = this._windows.filter(function(w) {
            let [_w, _h] = w.get_size();
            let [_x, _y] = w.get_position();

            return (w['get_meta_window'] && w.visible && _x <= x && _x+_w >= x && _y <= y && _y+_h >= y);
         });

         // Sort windows by layer
         windows.sort(function(a, b) {
             return a['get_meta_window'] && b['get_meta_window']
               && a.get_meta_window().get_layer() <= b.get_meta_window().get_layer();
         });

         let titles = windows.map(function(w) {
             if (w['get_meta_window'])
                 return '[' + w.get_meta_window().get_layer() + '] '
                     + w.meta_window.get_wm_class() + ' - '
                     + w.meta_window.get_title();
             else
                 return 'Unknown Cinnamon container';
         });

         if (windows.length > 0) {
            let currentWindow = windows[0];
            this._windowSelected = windows[0];
            this.showWindowOutline(this._windowSelected);
         }

         return true;

      }
      else if (type == Clutter.EventType.MOTION && this._selectionType == SelectionType.CINNAMON) {
         this._updateCinnamon(event);
      }
      else if (type == Clutter.EventType.SCROLL && this._selectionType == SelectionType.CINNAMON) {
         this.hideInstructions();
         switch (event.get_scroll_direction()) {
         case Clutter.ScrollDirection.UP:
            // select parent
            let parent = this._target.get_parent();
            if (parent != null) {
                this._target = parent;
                this._updateCinnamon(event);
            }
            break;

         case Clutter.ScrollDirection.DOWN:
            // select child
            if (this._target != this._pointerTarget) {
                let child = this._pointerTarget;
                while (child) {
                    let parent = child.get_parent();
                    if (parent == this._target)
                        break;
                    child = parent;
                }
                if (child) {
                    this._target = child;
                    this._updateCinnamon(event);
                }
            }
            break;

         default:
            break;
         }
         return true;
      }
      else if (this._mouseDown) {
         if (type == Clutter.EventType.MOTION && this._selectionType == SelectionType.AREA) {
            let [xMouse, yMouse, mask] = global.get_pointer();

            if (xMouse != this._xStart || yMouse != this._yStart) {
               let x, y;
               if (this._isMoving) {
                  x = Math.min(this._xStart, this._xEnd) - (this._xMouse - xMouse);
                  y = Math.min(this._yStart, this._yEnd) - (this._yMouse - yMouse);

                  // Constrain selection area to screen dimensions
                  if (x < 0) x = 0;
                  if (y < 0) y = 0;
               }
               else if (this._isResizing) {
                  let dragName = this._resizeActor.name;
                  if (dragName == 'handleN') {
                     this._yStart = yMouse;
                  }
                  else if (dragName == 'handleS') {
                     this._yEnd = yMouse;
                  }
                  else if (dragName == 'handleW') {
                     this._xStart = xMouse;
                  }
                  else if (dragName == 'handleE') {
                     this._xEnd = xMouse;
                  }
                  else if (dragName == 'handleNw') {
                     this._xStart = xMouse;
                     this._yStart = yMouse;
                  }
                  else if (dragName == 'handleNe') {
                     this._xEnd = xMouse;
                     this._yStart = yMouse;
                  }
                  else if (dragName == 'handleSw') {
                     this._xStart = xMouse;
                     this._yEnd = yMouse;
                  }
                  else if (dragName == 'handleSe') {
                     this._xEnd = xMouse;
                     this._yEnd = yMouse;
                  }

                  x = Math.min(this._xEnd, this._xStart);
                  y = Math.min(this._yEnd, this._yStart);

               }
               else {
                  this._xEnd = xMouse;
                  this._yEnd = yMouse;
                  x = Math.min(this._xEnd, this._xStart);
                  y = Math.min(this._yEnd, this._yStart);
               }
               
               this.redrawAreaSelection(x, y);
            }
         } else if (type == Clutter.EventType.BUTTON_RELEASE) {
            if (event.get_button() != 1) {
              return true;
            }

            if (this._selectionType == SelectionType.WINDOW) {
               this.screenshotWindow(this._windowSelected);
               return true;
            }
            else if (this._selectionType == SelectionType.AREA) {
               let x = Math.min(this._xEnd, this._xStart);
               let y = Math.min(this._yEnd, this._yStart);
               let width = Math.abs(this._xEnd - this._xStart);
               let height = Math.abs(this._yEnd - this._yStart);

               if (this._isMoving) {
                  this._isMoving = false;
                  this._yMouse = 0;
                  this._xMouse = 0;
               }
               else if (this._isResizing) {
                  this._isResizing = false;
                  this._resizeActor = null;
               }

               [this._xStart, this._yStart] = this.container.get_position();
               [this._xEnd, this._yEnd] = [this._xStart + width, this._yStart + height];
               
               this._mouseDown = false;
               
               this._selectionMade = true;

               //if (this._xEnd == -1 || this._yEnd == -1 || (width < 5 && height < 5)) {
                  //this.screenshotArea(x, y, width, height);
               //}
               return true;
            }
            else if (this._selectionType == SelectionType.CINNAMON) {
               return true;
            }

               //this._prepareWindowScreenshot(this._xStart, this._yStart);
               //this._makeAreaScreenshot(x, y, width, height);
         }
      }

      return true;
   },

   clearActorOutline: function() {
      if (this._lightbox) {
         this._lightbox.hide();
      }

      Main.uiGroup.remove_actor(this.uiContainer);
      this.uiContainer.destroy();

      this.container.remove_actor(this._outlineFrame);
      this._outlineFrame.destroy();
   },

   showActorOutline: function(actor, eventX, eventY) {
      // Create the actor that will serve as background for the clone.
      let frameClass = 'capture-outline-frame';

      let background = new St.Bin();
      this.container.add_actor(background);

      // We need to know the border width so that we can
      // make the background slightly bigger than the clone window.
      let themeNode = background.get_theme_node();
      let borderWidth = themeNode.get_border_width(St.Side.LEFT);// assume same for all sides
      let borderAdj = borderWidth / 2;
      this.container.remove_actor(background);

      let ag = actor.get_allocation_geometry();
      let [width, height] = [ag.width, ag.height];
      let [x, y] = actor.get_transformed_position();

      let childBox = new Clutter.ActorBox();
      childBox.x1 = x;
      childBox.x2 = x + width;
      childBox.y1 = y;
      childBox.y2 = y + height;

      global.cb = childBox;

      // The frame is needed to draw the border round the clone.
      let frame = this._outlineFrame = new St.Bin({style_class: frameClass});
      this.container.add_actor(frame); // must not be a child of the background
      frame.allocate(childBox, 0); // same dimensions

      this.uiContainer = new St.Group({
         reactive: false,
         //visible: false,
         x: x,
         y: y,
         width: width,
         height: height,
         style_class: 'test-container'
      });

      Main.uiGroup.add_actor(this.uiContainer);

      this.drawShadows(x, y, width, height);
   },

   clearWindowOutline: function() {
      if (this._lightbox) {
         this._lightbox.hide();
      }

      Main.uiGroup.remove_actor(this.uiContainer);
      this.uiContainer.destroy();

      
      this.container.remove_actor(this._outlineBackground);
      this._outlineBackground.destroy();
      this._outlineBackground = null;
      
      this.container.remove_actor(this._outlineFrame);
      this._outlineFrame.destroy();

      return true;
   },

   showWindowOutline: function(window) {
      if (this._outlineBackground) {
         this.clearWindowOutline();
      }

      let metaWindow = window.get_meta_window();

      // Create the actor that will serve as background for the clone.
      let binClass = 'capture-outline-background capture-outline-frame';
      let frameClass = 'capture-outline-frame';

      if (metaWindow.get_title() == 'Desktop') {
         binClass += ' desktop';
         frameClass += ' desktop';
      }

      let background = new St.Bin({style_class: binClass});
      this._outlineBackground = background;
      this.container.add_actor(background);
      // Make sure that the frame does not overlap the switcher.
      //background.lower(this._appSwitcher.actor);

      // We need to know the border width so that we can
      // make the background slightly bigger than the clone window.
      let themeNode = background.get_theme_node();
      let borderWidth = themeNode.get_border_width(St.Side.LEFT);// assume same for all sides
      let borderAdj = borderWidth / 2;

      let or = metaWindow.get_outer_rect();
      or.x -= borderAdj; or.y -= borderAdj;
      or.width += borderAdj; or.height += borderAdj;

      let childBox = new Clutter.ActorBox();
      childBox.x1 = or.x;
      childBox.x2 = or.x + or.width;
      childBox.y1 = or.y;
      childBox.y2 = or.y + or.height;
      background.allocate(childBox, 0);

      // The frame is needed to draw the border round the clone.
      let frame = this._outlineFrame = new St.Bin({style_class: frameClass});
      this.container.add_actor(frame); // must not be a child of the background
      frame.allocate(childBox, 0); // same dimensions
      background.lower(frame);

      if (this.bringWindowsToFront) {
         // Show a clone of the target window
         let outlineClone = new Clutter.Clone({source: metaWindow.get_compositor_private().get_texture()});
         background.add_actor(outlineClone);
         outlineClone.opacity = 100; // translucent to get a tint from the background color

         // The clone's rect is not the same as the window's outer rect
         let ir = metaWindow.get_input_rect();
         let diffX = (ir.width - or.width)/2;
         let diffY = (ir.height - or.height)/2;

         childBox.x1 = -diffX;
         childBox.x2 = or.width + diffX;
         childBox.y1 = -diffY;
         childBox.y2 = or.height + diffY;

         outlineClone.allocate(childBox, 0);
      }

      this.uiContainer = new St.Group({
         reactive: true,
         x: or.x,
         y: or.y,
         width: or.width,
         height: or.height,
         style_class: 'test-container',
         x_align: St.Align.MIDDLE,
         y_align: St.Align.MIDDLE
      });

      Main.uiGroup.add_actor(this.uiContainer);

      let tracker = Cinnamon.WindowTracker.get_default();
      let app = tracker.get_window_app(metaWindow);
      let icon = null;
      if (app) {
         icon = app.create_icon_texture(22);
      }
      if (!icon) {
         icon = new St.Icon({ icon_name: 'application-default-icon',
                              icon_type: St.IconType.FULLCOLOR,
                              icon_size: 22, style_class: 'overlay-icon' });
      }

      icon.width = 32;
      icon.height = 32;

      this._iconBin = new St.Bin({
         visible: true,
         reactive: true,
         x_fill: false,
         y_fill: false,
         style_class: 'overlay-iconbox',
         child: icon,
         y_align: St.Align.END
      });

      let sizeInfo = or.width + ' \u00D7 ' + or.height;
      let title = new St.Label({ text: metaWindow.get_title(), style_class: 'overlay-label-title' });
      let subtitle = new St.Label({ text: sizeInfo, style_class: 'overlay-label-size' })

      let box = new St.BoxLayout({
         vertical: true,
         width: this.uiContainer.width,
         height: this.uiContainer.height
      });
      box.add(this._iconBin, {expand: true, y_fill: true, y_align: St.Align.END});

      let box2 = new St.BoxLayout({
         vertical: true,
         width: this.uiContainer.width,
         height: 50,
         x_align: St.Align.MIDDLE
      });
      box2.add(title, {expand: true, x_align: St.Align.MIDDLE});
      box2.add(subtitle, {expand: true, x_align: St.Align.MIDDLE});

      box.add(box2, {expand: true, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.START});

      this.uiContainer.add_actor(box);
      box.show();

      return true;

   }
}


function str_replace (search, replace, subject, count) {
    // http://kevin.vanzonneveld.net
    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   improved by: Gabriel Paderni
    // +   improved by: Philip Peterson
    // +   improved by: Simon Willison (http://simonwillison.net)
    // +    revised by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
    // +   bugfixed by: Anton Ongson
    // +      input by: Onno Marsman
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +    tweaked by: Onno Marsman
    // +      input by: Brett Zamir (http://brett-zamir.me)
    // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   input by: Oleg Eremeev
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +   bugfixed by: Oleg Eremeev
    // %          note 1: The count parameter must be passed as a string in order
    // %          note 1:  to find a global variable in which the result will be given
    // *     example 1: str_replace(' ', '.', 'Kevin van Zonneveld');
    // *     returns 1: 'Kevin.van.Zonneveld'
    // *     example 2: str_replace(['{name}', 'l'], ['hello', 'm'], '{name}, lars');
    // *     returns 2: 'hemmo, mars'
    var i = 0,
        j = 0,
        temp = '',
        repl = '',
        sl = 0,
        fl = 0,
        f = [].concat(search),
        r = [].concat(replace),
        s = subject,
        ra = Object.prototype.toString.call(r) === '[object Array]',
        sa = Object.prototype.toString.call(s) === '[object Array]';
    s = [].concat(s);
    if (count) {
        this.window[count] = 0;
    }

    for (i = 0, sl = s.length; i < sl; i++) {
        if (s[i] === '') {
            continue;
        }
        for (j = 0, fl = f.length; j < fl; j++) {
            temp = s[i] + '';
            repl = ra ? (r[j] !== undefined ? r[j] : '') : r[0];
            s[i] = (temp).split(f[j]).join(repl);
            if (count && s[i] !== temp) {
                this.window[count] += (temp.length - s[i].length) / f[j].length;
            }
        }
    }
    return sa ? s : s[0];
}
