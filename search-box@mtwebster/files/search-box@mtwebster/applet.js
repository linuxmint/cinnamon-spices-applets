const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;

var prov_label = "";
var prov_url = "";

// Calculates the Levenshtein distance between two strings a and b.
// The Levenshtein distance is a measure of the similarity between two strings.
// It is defined as the minimum number of single-character edits
// (insertions, deletions or substitutions) required to change one word into the other.
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1,
                                   Math.min(matrix[i][j - 1] + 1,
                                            matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

const UUID = "search-box@mtwebster";
const HOME_DIR = GLib.get_home_dir();

// l10n
const Gettext = imports.gettext;
function _(str, uuid=UUID) {
  Gettext.bindtextdomain(uuid, HOME_DIR + "/.local/share/locale");
  let _str = Gettext.dgettext(uuid, str);
  if (_str !== str)
    return _str;
  // If the text was not found locally then try with system-wide translations:
  return Gettext.gettext(str);
}

function SearchBoxApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

SearchBoxApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            this._searchInactiveIcon = new St.Icon({ style_class: "menu-search-entry-icon",
                                               icon_name: "edit-find",
                                               icon_type: St.IconType.SYMBOLIC });
            this._searchActiveIcon = new St.Icon({ style_class: "menu-search-entry-icon",
                                             icon_name: "edit-clear",
                                             icon_type: St.IconType.SYMBOLIC });
            this.searchIcon = new St.Icon({icon_name: "edit-find", icon_size: 24, icon_type: St.IconType.FULLCOLOR});
            this._searchIconClickedId = 0;

            this.settings.bind("show-provider", "show_provider", () => { this._reload() });
            this.settings.bind("selected-provider", "selected_provider", () => { this._reload() });
            this.already_changed = false;
            this.settings.bind("providers", "providers", () => { this._on_providers_changed() });
            this.settings.bind("reset-after-search", "reset_after_search", () => { this._reload() });
            this.settings.bind("use-custom-provider", "use_custom_provider");
            this.settings.bind("custom-provider-label", "custom_provider_label");
            this.settings.bind("custom-provider-url", "custom_provider_url");
            this.settings.bind("custom-keybinding", "custom_keybinding", () => { this.on_keybinding_changed() });
            this.settings.bind("background-color", "bgd_color", () => { this._set_searchEntry_style() });
            this.settings.bind("text-color", "txt_color", () => { this._set_searchEntry_style() });

            this.set_applet_icon_symbolic_name("edit-find-symbolic");
            this._orientation = orientation;

            this.populate_search_engines_menu();
            this.set_applet_tooltip(_("Right-click to select or add your search engine"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);

            this._searchArea = new St.BoxLayout({name: "searchArea" });

            this.menu.addActor(this._searchArea);

            this.searchBox = new St.BoxLayout({ style_class: "menu-search-box" });
            this._searchArea.add(this.searchBox);

            this.buttonbox = new St.BoxLayout();
            let button = new St.Button({ child: this.searchIcon });
            button.connect("clicked", () => { this._search() });
            this.buttonbox.add_actor(button);
            this._searchArea.add(this.buttonbox);
            this.searchEntry = new St.Entry({ name: "menu-search-entry",
                                     hint_text: _("Type to search..."),
                                     track_hover: true,
                                     can_focus: true,
                                     style: "background: %s; color: %s;".format(this.bgd_color, this.txt_color)
                                    });
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            this.searchBox.add_actor(this.searchEntry);
            this.searchActive = false;
            this.searchEntryText = this.searchEntry.clutter_text;
            this.searchEntryText.connect("text-changed", () => { this._onSearchTextChanged() });
            this.searchEntryText.connect("key-press-event", (actor, event) => { this._onMenuKeyPress(actor, event) });
            this._previousSearchPattern = "";

            this.on_keybinding_changed();
            this.update_label_visible();
            this._on_providers_changed();
        }
        catch (e) {
            global.logError(e);
        }
    },

    _set_searchEntry_style: function() {
        this.searchEntry.style = "background: %s; color: %s;".format(this.bgd_color, this.txt_color);
    },

    populate_search_engines_menu: function() {
        if (this.context_menu_item_search_engines)
            this.context_menu_item_search_engines.destroy();

        this.context_menu_item_search_engines = new PopupMenu.PopupSubMenuMenuItem(_("Select your Search Engine:"));
        this._applet_context_menu.addMenuItem(this.context_menu_item_search_engines);

        for (let p of this.providers) {
            if (p.show != undefined && p.show == false) continue;
            p.show = true;
            let item = new PopupMenu.PopupMenuItem((p.short.length > 0) ? p.name + " ("+p.short+")" : p.name, {
                reactive: true
            });
            item.setShowDot(this.selected_provider == ""+p.name);
            item.connect("activate", () => {
                this.selected_provider = ""+p.name;
                this.update_label_visible();
            });
            this.context_menu_item_search_engines.menu.addMenuItem(item);
        }
        this.context_menu_item_search_engines.menu.open();
    },

    _on_providers_changed: function() {
        if (this.already_changed) return;

        if (this.custom_provider_label.length > 0 && this.custom_provider_url.length > 0) {
            this.providers.push({"name": ""+this.custom_provider_label, "url": ""+this.custom_provider_url});
            this.use_custom_provider = false;
            this.custom_provider_label = "";
            this.custom_provider_url = "";
        }

        this._reload();
    },

    _reload: function() {
        prov_label = this.selected_provider;
        prov_url = "";
        for (let p of this.providers) {
            if (p["show"] == true && p["name"] == prov_label) {
                prov_url = p["url"];
                break
            }
        }

        if (prov_url.length === 0) {
            // Select the first checked provider:
            for (let p of this.providers) {
                if (p["show"] == true) {
                    prov_label = p["name"];
                    prov_url = p["url"];
                    break
                }
            }
        }

        if (prov_url.length === 0) { // There is no provider checked.
            // Use the default provider:
            prov_label = "Google";
            prov_url = "https://google.com/search?q=";
        }

        if (this.show_provider) {
            this.set_applet_label(prov_label);
            this.hide_applet_label(false);
        }
        else {
            this.hide_applet_label(true);
        }
        this.already_changed = false;
    },

    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if ((symbol==Clutter.KEY_Return || symbol==Clutter.KEY_KP_Enter) && this.menu.isOpen) {
            this._search();
            return true;
        }
        return false;
    },

    _search: function() {
        var _entry = this.searchEntry.get_text().replace(/'/g,"%27");
        let potential_shortcode = _entry.split(" ", 1)[0];
        let shortcode_length_plus_space = 0;
        let exact_match_found = false;

        // Try exact shortcode match first (case-insensitive)
        for (let p of this.providers) {
            if (p.short && p.short.toLowerCase() === potential_shortcode.toLowerCase()) {
                prov_label = p.name;
                this.selected_provider = prov_label; // Update the selected provider
                prov_url = p.url;
                shortcode_length_plus_space = p.short.length + 1;
                _entry = _entry.slice(shortcode_length_plus_space);
                exact_match_found = true;
                break;
            }
        }

        // If no exact match, try fuzzy matching for shortcodes
        if (!exact_match_found && potential_shortcode.length > 0) { // Only attempt fuzzy if no exact match and there's a potential shortcode
            let best_match_provider = null;
            let min_distance = Infinity; // Or a sensible threshold like 2

            for (let p of this.providers) {
                if (p.short && p.short.length > 0) { // Ensure provider has a shortcode
                    let distance = levenshtein(potential_shortcode.toLowerCase(), p.short.toLowerCase());
                    if (distance < min_distance) {
                        min_distance = distance;
                        best_match_provider = p;
                    }
                }
            }

            // Use the best match if the distance is small (e.g., 1, or <=2 for longer shortcodes)
            // Threshold of 1 is safer for short shortcodes to avoid incorrect matches.
            // For this basic implementation, let's use a threshold of 1.
            if (best_match_provider && min_distance <= 1) {
                prov_label = best_match_provider.name;
                this.selected_provider = prov_label; // Update the selected provider
                prov_url = best_match_provider.url;
                // shortcode_length_plus_space = best_match_provider.short.length + 1; // Not needed here as we use potential_shortcode.length for slicing
                 // Check if the potential_shortcode was indeed what we corrected from
                if (_entry.toLowerCase().startsWith(potential_shortcode.toLowerCase() + " ")) {
                    _entry = _entry.slice(potential_shortcode.length + 1);
                } else if (_entry.toLowerCase() === potential_shortcode.toLowerCase()) {
                    // If the entry was *only* the misspelled shortcode
                    _entry = "";
                }
                // If not, _entry remains as is, meaning no search term was provided after the (misspelled) shortcode
            }
        }

        // Fallback: Ensure prov_url is set from current selection or default if not matched by shortcode
        if (!prov_url) {
             for (let p of this.providers) {
                if (p.name === this.selected_provider) {
                    prov_url = p.url;
                    break;
                }
            }
        }
        // Fallback if still no prov_url (shouldn't happen if selected_provider is always valid)
        if (!prov_url && this.providers.length > 0) {
            // Attempt to find the first available provider as a last resort
            for (let p of this.providers) {
                if (p.show !== false && p.url) { // Check if provider is shown and has a URL
                    prov_url = p.url;
                    prov_label = p.name;
                    this.selected_provider = prov_label; // Also update selected_provider
                    break;
                }
            }
            // If still no provider, use a hardcoded default (original fallback)
            if (!prov_url) {
                prov_url = "https://google.com/search?q=";
                prov_label = "Google";
                this.selected_provider = prov_label;
            }
        }

        Util.spawnCommandLineAsync("xdg-open " + prov_url + "'" + _entry + "'");
        if (this.reset_after_search) {
            this.searchEntry.set_text("");
            this.searchActive = false;
        }
        // Do not reset selected_provider here, it's now updated by the fuzzy logic if a match was made
        // this.selected_provider = old_provider; // Remove this line or adapt
        this._reload(); // Call reload to update applet label if provider changed
        this.menu.close();
    },

    resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        global.stage.set_key_focus(this.searchEntry);
    },

    _onSearchTextChanged: function () {
        this.searchActive = this.searchEntry.get_text().length > 0;
        if (this.searchActive) {
            this.searchEntry.set_secondary_icon(this._searchActiveIcon);

            if (this._searchIconClickedId == 0) {
                this._searchIconClickedId = this.searchEntry.connect("secondary-icon-clicked",
                    () => {
                        this.resetSearch();
                    });
            }
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;

            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);

        }
    },

    on_keybinding_changed: function() {
        Main.keybindingManager.addHotKey("must-be-unique-id", this.custom_keybinding, () => { this.on_hotkey_triggered() });
    },

    on_hotkey_triggered: function() {
        this.on_applet_clicked();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
        global.stage.set_key_focus(this.searchEntry);
    },

    _onButtonPressEvent: function(actor, event) {
        let button = event.get_button();
        if (button < 3) {
            if (!this._draggable.inhibit) {
                return false;
            } else {
                if (this._applet_context_menu.isOpen) {
                    this._applet_context_menu.close();
                }
            }
        }

        if (button === 1) {
            this.on_applet_clicked(event);
        } else if (button === 2) {
            return false;
        } else if (button === 3) {
            if (this._applet_context_menu._getMenuItems().length > 0) {
                this._applet_context_menu.toggle();
                if (this._applet_context_menu.isOpen) {
                    this.populate_search_engines_menu();
                    this.context_menu_item_search_engines.menu.open();
                }
            }
        }

        return true;
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;

        this.update_label_visible();
    },

    update_label_visible: function () {
        if (this._orientation == St.Side.LEFT || this._orientation == St.Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    }

};

function main(metadata, orientation, panel_height, instance_id) {
    let searchBoxApplet = new SearchBoxApplet(orientation, panel_height, instance_id);
    return searchBoxApplet;
}
