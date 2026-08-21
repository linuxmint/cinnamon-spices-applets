/* applet.js
    Basic Linux Mint / Cinnamon applet to toggle a Home Assistant entity.
    Replace haUrl, token and entityId with your Home Assistant details.
*/

const Applet = imports.ui.applet;
const St = imports.gi.St;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const ByteArray = imports.byteArray;
const GObject = imports.gi.GObject;
// Settings removed - using metadata.json config
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

function HomeAssistantApplet(metadata, orientation, panelHeight, instanceId) {
     this._init(metadata, orientation, panelHeight, instanceId);
}

HomeAssistantApplet.prototype = {
     __proto__: Applet.IconApplet.prototype,

      _init: function(metadata, orientation, panelHeight, instanceId) {
          Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

          // Read configuration from metadata.json
           this.haUrl = metadata.config && metadata.config['ha-url'] ? metadata.config['ha-url'] : "";
           this.token = metadata.config && metadata.config['token'] ? metadata.config['token'] : "";
           this.entityId = metadata.config && metadata.config['entity-id'] ? metadata.config['entity-id'] : "";

          // NOTE: do not overwrite settings here. Defaults are set above and
          // Settings.AppletSettings will load persisted values. Remove hard-coded
          // tokens/IDs to avoid accidental leaks.

          this.set_applet_icon_symbolic_name("network-server");
          this.set_applet_tooltip("Home Assistant: " + this.entityId);

          this._state = null;

          // Network session removed: use curl fallback only (works reliably
          // across environments). Any libsoup-specific code was removed.

         // initial state fetch (if entity configured)
         if (this.entityId)
              this._updateState();

         // left click toggles - attach to the actor so events are delivered
         try {
              if (this.actor && this.actor.connect) {
                   this.actor.connect('button-press-event', Lang.bind(this, this.on_applet_clicked));
                   try { log('HomeAssistantApplet: connected button-press-event on actor'); } catch (e) {}
                   try { this._logToFile('connected button-press-event on actor'); } catch (e) {}
              } else {
                   // fallback: connect on this (older code path)
                   try { this.connect('button-press-event', Lang.bind(this, this.on_applet_clicked)); } catch (e) {}
                   try { log('HomeAssistantApplet: connected button-press-event on this'); } catch (e) {}
                   try { this._logToFile('connected button-press-event on this'); } catch (e) {}
              }
         } catch (e) {
              try { log('Error connecting button handler: ' + e); } catch (__) {}
              try { this._logToFile('Error connecting button handler: ' + e); } catch (__) {}
         }

         // add right-click menu item to configure
         try {
              this.menuManager = imports.ui.popupMenu; // ensure import available
         } catch (e) {}
         this._addConfigureMenu();
     },



         _logToFile: function(msg) {
              try {
                   let path = '/tmp/homeassistant-applet.log';
                   let ts = (new Date()).toISOString();
                   let line = ts + ' ' + msg + '\n';
                   try {
                        let parts = GLib.file_get_contents(path);
                        if (parts && parts[0]) {
                             let existing = parts[1];
                             let existingStr = '';
                             if (existing) {
                                  if (typeof existing === 'string')
                                       existingStr = existing;
                                  else {
                                       try { existingStr = ByteArray.toString(existing); } catch (e) { existingStr = '' + existing; }
                                  }
                             }
                             line = existingStr + line;
                        }
                   } catch (e) {
                        // ignore read errors
                   }
                   try { GLib.file_set_contents(path, line); } catch (e) {}
              } catch (e) {}
         },

     _addConfigureMenu: function() {
         try {
              let menu = this.create_applet_menu();
              this._appletMenu = menu;
              try { this._logToFile && this._logToFile('_addConfigureMenu: menu created'); } catch (e) {}
              try { log('_addConfigureMenu: menu created'); } catch (e) {}
              menu.connect('open-state-changed', Lang.bind(this, function(m, isOpen) {
                   try { this._logToFile && this._logToFile('_addConfigureMenu: menu open=' + isOpen); } catch (e) {}
                   try { log('_addConfigureMenu: menu open=' + isOpen); } catch (e) {}
              }));
              menu.addMenuItem(new imports.ui.popupMenu.PopupSeparatorMenuItem());
              let configureItem = new imports.ui.popupMenu.PopupMenuItem("Configure...");
              // Directly log actor button presses too (extra assurance)
              try {
                   if (configureItem.actor && configureItem.actor.connect) {
                        configureItem.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
                             try { this._logToFile && this._logToFile('configureItem.actor: button-press-event, button=' + event.get_button()); } catch (e) {}
                             try { log('configureItem.actor: button-press-event, button=' + event.get_button()); } catch (e) {}
                        }));
                   }
              } catch (e) {}
              configureItem.connect('activate', Lang.bind(this, function() {
                   // Diagnostic logging: record which preference-opening helpers exist.
                   try {
                        let avail = [];
                        try { if (typeof this.openPreferences === 'function') avail.push('this.openPreferences'); } catch (e) {}
                        try { if (typeof this.open_preferences === 'function') avail.push('this.open_preferences'); } catch (e) {}
                        try { if (global && global.appletManager && typeof global.appletManager.openPreferences === 'function') avail.push('global.appletManager.openPreferences'); } catch (e) {}
                        try { if (global && global.appletManager && typeof global.appletManager.open_preferences === 'function') avail.push('global.appletManager.open_preferences'); } catch (e) {}
                        try { if (imports && imports.ui && imports.ui.appletManager && typeof imports.ui.appletManager.openPreferences === 'function') avail.push('imports.ui.appletManager.openPreferences'); } catch (e) {}
                        try { this._logToFile && this._logToFile('Configure.activate: available=' + avail.join(',')); } catch (e) {}
                        try { log('Configure.activate: available=' + avail.join(',')); } catch (e) {}
                   } catch (e) {}

                   // Try the most likely API methods in order, logging each attempt.
                   // Also create a simple file marker and visual feedback so clicks
                   // are visible even if logging isn't captured.
                   try {
                        // spawn a simple shell append to create an auditable file
                        GLib.spawn_command_line_async("sh -c 'date >> /tmp/homeassistant-config-clicked.log && echo clicked >> /tmp/homeassistant-config-clicked.log'");
                   } catch (e) {}
                   try {
                        // briefly change the applet icon to provide immediate visual feedback
                        try { this.set_applet_icon_symbolic_name('system-run'); } catch (e) {}
                        try { Mainloop.timeout_add(1500, Lang.bind(this, function() { try { this._applyIconFromState(); } catch (e) {} return false; })); } catch (e) {}
                   } catch (e) {}

                   try {
                        if (typeof this.openPreferences === 'function') {
                             try { this._logToFile && this._logToFile('Configure.activate: calling this.openPreferences'); } catch (e) {}
                             this.openPreferences();
                             return;
                        }
                   } catch (e) { try { this._logToFile && this._logToFile('openPreferences threw: ' + e); } catch (ee) {} }
                   try {
                        if (typeof this.open_preferences === 'function') {
                             try { this._logToFile && this._logToFile('Configure.activate: calling this.open_preferences'); } catch (e) {}
                             this.open_preferences();
                             return;
                        }
                   } catch (e) { try { this._logToFile && this._logToFile('open_preferences threw: ' + e); } catch (ee) {} }

                   // Try global appletManager variants
                   try {
                        if (global && global.appletManager) {
                             if (typeof global.appletManager.openPreferences === 'function') {
                                  try { this._logToFile && this._logToFile('Configure.activate: calling global.appletManager.openPreferences'); } catch (e) {}
                                  global.appletManager.openPreferences(this);
                                  return;
                             }
                             if (typeof global.appletManager.open_preferences === 'function') {
                                  try { this._logToFile && this._logToFile('Configure.activate: calling global.appletManager.open_preferences'); } catch (e) {}
                                  global.appletManager.open_preferences(this);
                                  return;
                             }
                        }
                   } catch (e) { try { this._logToFile && this._logToFile('global.appletManager call threw: ' + e); } catch (ee) {} }

                   // Last-resort: external settings app
                   try {
                        try { this._logToFile && this._logToFile('Configure.activate: falling back to spawn launcher'); } catch (e) {}
                        this._openConfigureDialog();
                        return;
                   } catch (e) { try { this._logToFile && this._logToFile('fallback spawn failed: ' + e); } catch (ee) {} }
              }));
              menu.addMenuItem(configureItem);
              // Also log when the menu item is added to help debug missing UI actions
              try { this._logToFile && this._logToFile('_addConfigureMenu: configureItem added'); } catch (e) {}
              try { log('_addConfigureMenu: configureItem added'); } catch (e) {}
         } catch (e) {
              // fall back silently if menu creation fails on some environments
         }
     },

         // Request helper: use curl via GLib.spawn_command_line_sync and return
         // callback(err, parsedResponseOrBody)
         _request: function(method, path, body, callback) {
             try {
                 let url = (this.haUrl || "").replace(/\/+$/, "") + "/api" + path;
                 try { log('HomeAssistantApplet: _request -> ' + method + ' ' + url); } catch (e) {}
                 try { this._logToFile && this._logToFile('_request: ' + method + ' ' + url + ' body=' + JSON.stringify(body || {})); } catch (e) {}

                 let headers = [];
                 if (this.token) headers.push('Authorization: Bearer ' + this.token);
                 if (body) headers.push('Content-Type: application/json');
                 let data = body ? JSON.stringify(body) : null;

                 let cmd = 'curl -s -S -X ' + method + ' ' + GLib.shell_quote(url) + ' -w "\\n%{http_code}"';
                 for (let i = 0; i < headers.length; i++) cmd += ' -H ' + GLib.shell_quote(headers[i]);
                 if (data) cmd += ' -d ' + GLib.shell_quote(data);

                 let [ok, stdout, stderr, status] = GLib.spawn_command_line_sync(cmd);
                 if (!ok) return callback(new Error('curl failed to run'));
                 let out = '';
                 try { out = stdout.toString(); } catch (e) { out = '' + stdout; }
                 let parts = out.split('\n');
                 let code = parseInt(parts[parts.length - 1]) || 0;
                 let bodyText = parts.slice(0, parts.length - 1).join('\n');
                 try { this._logToFile && this._logToFile('_request response: ' + code + ' body_snippet=' + (bodyText ? bodyText.toString().slice(0,200) : '')); } catch (e) {}

                 if (code >= 200 && code < 300) {
                     try {
                         let parsed = bodyText ? JSON.parse(bodyText) : null;
                         return callback(null, parsed !== null ? parsed : bodyText);
                     } catch (e) {
                         return callback(null, bodyText);
                     }
                 } else {
                     return callback(new Error('HTTP ' + code + ' - ' + (bodyText || '')));
                 }
             } catch (e) { return callback(e); }
         },

     // fetch current entity state
     _updateState: function() {
              if (!this.entityId) return;
              let path = "/states/" + this.entityId;
          this._request("GET", path, null, Lang.bind(this, function(err, data) {
                if (err) {
                     this.set_applet_icon_symbolic_name("dialog-warning");
                     this.set_applet_tooltip("HA error: " + err.message);
                     return;
                }
                this._state = (data && data.state) ? data.state : null;
                this._applyIconFromState();
                this.set_applet_tooltip(this.entityId + ": " + this._state);
          }));
     },

     _applyIconFromState: function() {
          if (this._state === "on") {
                this.set_applet_icon_symbolic_name("media-playback-start"); // example icon for ON
          } else if (this._state === "off") {
                this.set_applet_icon_symbolic_name("media-playback-stop"); // example icon for OFF
          } else {
                this.set_applet_icon_symbolic_name("network-idle");
          }
     },

     // toggle entity when applet clicked
     on_applet_clicked: function() {
                  try { log('HomeAssistantApplet: on_applet_clicked invoked'); } catch (e) {}
                  try { this._logToFile && this._logToFile('on_applet_clicked invoked'); } catch (e) {}
                  try { this.set_applet_tooltip('Clicked: toggling...'); } catch (e) {}
              // only respond to left-click (button 1)
              // event object is passed as first arg when invoked by click
              let event = null;
              if (arguments && arguments.length > 0)
                   event = arguments[0];
                   // If right-click (button 3), open preferences immediately (diagnostic + fallback)
                   if (event && event.get_button) {
                        let btn = event.get_button();
                        if (btn === 3) {
                             try { this._logToFile && this._logToFile('on_applet_clicked: right-click detected - opening preferences'); } catch (e) {}
                             try { log('on_applet_clicked: right-click detected - opening preferences'); } catch (e) {}
                             // marker file + visual feedback
                             try { GLib.spawn_command_line_async("sh -c 'date >> /tmp/homeassistant-config-clicked.log && echo right-click >> /tmp/homeassistant-config-clicked.log'"); } catch (e) {}
                             try { this.set_applet_icon_symbolic_name('system-run'); } catch (e) {}
                             try { Mainloop.timeout_add(1500, Lang.bind(this, function() { try { this._applyIconFromState(); } catch (e) {} return false; })); } catch (e) {}
                             // Try built-in preference APIs first
                             try { if (typeof this.openPreferences === 'function') { this.openPreferences(); return; } } catch (e) {}
                             try { if (typeof this.open_preferences === 'function') { this.open_preferences(); return; } } catch (e) {}
                             try { if (global && global.appletManager && typeof global.appletManager.openPreferences === 'function') { global.appletManager.openPreferences(this); return; } } catch (e) {}
                             // Fallback to spawning cinnamon-settings
                             try { this._openConfigureDialog(); } catch (e) {}
                             return;
                        }
                        if (btn !== 1) return; // ignore other buttons
                   }

              if (!this._state) {
                   // if no entity configured, instruct the user to open Applets -> Configure
                   if (!this.entityId) {
                        try { this.set_applet_tooltip('No entity configured — open Applets -> Configure to set one'); } catch (e) {}
                        try { this._logToFile && this._logToFile('Click received but no entity configured'); } catch (e) {}
                        return;
                   }
                   this._updateState();
                   return;
              }

          let domain = this.entityId.split(".")[0];
          let service = (this._state === "on") ? "turn_off" : "turn_on";
          let path = "/services/" + domain + "/" + service;
          let body = { entity_id: this.entityId };
          try { log('HomeAssistantApplet: calling service ' + path + ' body=' + JSON.stringify(body)); } catch (e) {}
          try { this._logToFile && this._logToFile('service call: ' + path + ' body=' + JSON.stringify(body)); } catch (e) {}

          this._request("POST", path, body, Lang.bind(this, function(err /*, data */) {
                if (err) {
                     this.set_applet_tooltip("HA call error: " + err.message);
                     return;
                }
                try { log('HomeAssistantApplet: service call accepted, scheduling state refreshes'); } catch (e) {}
                try { this._logToFile && this._logToFile('service call accepted, scheduling refreshes'); } catch (e) {}
                // small delays to allow HA to process and update state. Two refreshes
                // increase the chance we see the updated state.
                Mainloop.timeout_add(1000, Lang.bind(this, function() {
                     this._updateState();
                     return false; // stop timeout
                }));
                Mainloop.timeout_add(3000, Lang.bind(this, function() {
                     this._updateState();
                     return false;
                }));
          }));
     },

     on_applet_removed_from_panel: function() {
          // optional cleanup
          try {
                  // session removed; nothing to abort
          } catch (e) {}
     }

         ,
              _openConfigureDialog: function() {
                   // Prefer launching the system Applets settings so the user can
                   // configure this applet safely. Using a separate process avoids
                   // in-applet GTK dialogs that have caused instability in some
                   // environments.
                   try {
                        // Launch the Cinnamon Applets settings panel. This should
                        // open the GUI where this applet's preferences are shown.
                        GLib.spawn_command_line_async('cinnamon-settings applets');
                        try { this.set_applet_tooltip('Opening Applets preferences...'); } catch (e) {}
                        try { log('Configure requested - launching cinnamon-settings applets'); } catch (e) {}
                        try { this._logToFile && this._logToFile('Configure requested - launched applets settings'); } catch (e) {}
                        return;
                   } catch (e) {
                        // If launching fails, fall back to a tooltip instruction.
                        try { this.set_applet_tooltip('Open Applets -> Configure for this applet to set URL/token/entity'); } catch (e) {}
                        try { log('Configure requested - fallback: use Applets preferences (spawn failed)'); } catch (e) {}
                        try { this._logToFile && this._logToFile('Configure requested - spawn failed: ' + e); } catch (e) {}
                        return;
                   }
              }
};

function main(metadata, orientation, panelHeight, instanceId) {
     try {
          return new HomeAssistantApplet(metadata, orientation, panelHeight, instanceId);
     } catch (e) {
          try { global.logError && global.logError('Failed to create HomeAssistantApplet: ' + e); } catch (__) {}
          try {
               // try to append to /tmp log to aid debugging when journalctl isn't present
               let path = '/tmp/homeassistant-applet.log';
               let ts = (new Date()).toISOString();
               let line = ts + ' Failed to create HomeAssistantApplet: ' + e + '\n';
               // prepend if file exists
               try {
                    let parts = GLib.file_get_contents(path);
                    if (parts && parts[1]) {
                         let existing = parts[1];
                         try { line = ByteArray.toString(existing) + line; } catch (ee) {}
                    }
               } catch (__) {}
               try { GLib.file_set_contents(path, line); } catch (__) {}
          } catch (__) {}
          throw e;
     }
}