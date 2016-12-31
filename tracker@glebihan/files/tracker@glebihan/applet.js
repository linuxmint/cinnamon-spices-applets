const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Gettext = imports.gettext.domain('cinnamon-applets');
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
const Tracker = imports.gi.Tracker;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const _ = Gettext.gettext;

const RESULT_TYPES_LABELS = 
{
    software: _("Software"),
    pictures: _("Pictures"),
    videos: _("Videos"),
    music: _("Music"),
    folders: _("Folders"),
    files: _("Other Files")
}

const CONVERT_TYPES = 
{
    "http://www.tracker-project.org/temp/nmm#MusicPiece": "music",
    "http://www.tracker-project.org/temp/nmm#Video": "videos",
    "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#SoftwareApplication": "software",
    "http://www.tracker-project.org/temp/nmm#Photo": "pictures",
    "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#Folder": "folders",
    "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#FileDataObject": "files"
}

function ApplicationResultButton(applet, app)
{
    this._init(applet, app);
}

ApplicationResultButton.prototype = 
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(applet, app)
    {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        
        this._app = app;
        this._applet = applet;
        
        this.icon = this._app.create_icon_texture(16);
        this.addActor(this.icon);
        this.name = this._app.get_name();
        this.label = new St.Label(
        {
            text: this.name
        });
        this.label.set_style("width: 180px;");
        this.addActor(this.label);
        this.icon.realize();
        this.label.realize();
        
        this.connect('activate', Lang.bind(this, this._on_activate));
    },
    
    _on_activate: function()
    {
        this._applet._search_menu.close();
        this._app.open_new_window(-1);
    }
}

function FileResultButton(applet, result, type)
{
    this._init(applet, result, type);
}

FileResultButton.prototype = 
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(applet, result, type, custom_label)
    {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        
        this._filename = result["url"];
        this._applet = applet;
        
        try
        {
            let icon = Cinnamon.util_get_icon_for_uri(this._filename);
            if (icon)
            {
                this.icon = St.TextureCache.get_default().load_gicon(null, icon, 16);
            }
        }
        catch (e)
        {
        }
        if (!this.icon)
        {
            this.icon = new St.Icon(
            {
                icon_name: (type == "files" ? "gtk-file" : "folder"),
                icon_size: 16,
                icon_type: St.IconType.FULLCOLOR
            });
        }
        this.addActor(this.icon);
        this.label = new St.Label(
        {
            text: (custom_label ? custom_label : decodeURIComponent(this._filename))
        });
        this.addActor(this.label);
        this.icon.realize();
        this.label.realize();
        
        this.connect('activate', Lang.bind(this, this._on_activate));
    },
    
    _on_activate: function()
    {
        this._applet._search_menu.close();
        Util.trySpawn(["xdg-open", this._filename]);
    }
}

function MusicResultButton(applet, result, type)
{
    this._init(applet, result, type);
}

MusicResultButton.prototype = 
{
    __proto__: FileResultButton.prototype,
    
    _init: function(applet, result, type)
    {
        var basename = result["url"].split("/");
        basename = decodeURIComponent(basename[basename.length - 1]);
        var label = (result["performer"] ? result["performer"] + " - " : "") + (result["musicAlbum"] ? result["musicAlbum"] + " - " : "") + (result["trackNumber"] ? result["trackNumber"] + " - " : "") + (result["title"] ? result["title"] : basename);
        FileResultButton.prototype._init.call(this, applet, result, type, label.trim());
    }
}

function MyApplet(orientation, panel_height, instanceId)
{
    this._init(orientation, panel_height, instanceId);
}

MyApplet.prototype =
{
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instanceId)
    {
        try
        {
            Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instanceId);
        
            menuItem = new Applet.MenuItem(_("Indexing Preferences"), null, Lang.bind(this, function(actor, event)
            {
                Util.spawnCommandLine('tracker-preferences');
            }));
            this._applet_context_menu.addMenuItem(menuItem);
            
            this.settings = new Settings.AppletSettings(this, "tracker@glebihan", instanceId);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "launch_shortcut",
                                     "launch_shortcut",
                                     this.on_launch_shortcut_changed,
                                     null);
                                     
            this.set_applet_icon_name("edit-find-symbolic");
            this.set_applet_tooltip(_("Search files using Tracker"));

            let menuManager = new PopupMenu.PopupMenuManager(this);
            this._search_menu = new Applet.AppletPopupMenu(this, orientation);
            menuManager.addMenu(this._search_menu);

            let section = new PopupMenu.PopupMenuSection();
            this._search_menu.addMenuItem(section);

            this.searchEntry = new St.Entry(
            {
                name: 'menu-search-entry',
                hint_text: _("Type to search..."),
                track_hover: true,
                can_focus: true
            });
            section.actor.set_style("padding: 10px;");
            this._searchInactiveIcon = new St.Icon(
            {
                style_class: 'menu-search-entry-icon',
                icon_name: 'edit-find',
                icon_type: St.IconType.SYMBOLIC
            });
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);

            section.actor.add_actor(this.searchEntry);
            
            this._scrollBox = new St.ScrollView(
            {
                x_fill: true,
                y_fill: false,
                y_align: St.Align.START
            });
            this._scrollBox.set_style("width: 500px;");
            this._search_menu.addActor(this._scrollBox);
            this._container = new St.BoxLayout(
            {
                vertical:true
            });
            this._scrollBox.add_actor(this._container);
            this._scrollBox.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
            this._scrollBox.set_auto_scrolling(true);

            this.searchEntryText = this.searchEntry.clutter_text;
            this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
            
            this._search_timer = null;
                        
            this._appSys = Cinnamon.AppSystem.get_default();
            
            this.on_launch_shortcut_changed();
        }
        catch(e)
        {
            global.logError(e);
        }
    },
    
    on_launch_shortcut_changed: function()
    {
        Main.keybindingManager.addHotKey("tracker_glebihan_launch", this.launch_shortcut, Lang.bind(this, this.launch));
    },

    _onSearchTextChanged: function(se, prop)
    {
        let searchString = this.searchEntry.get_text();

        if (searchString != "")
        {
            if (this._search_timer)
            {
                Mainloop.source_remove(this._search_timer);
                this._search_timer = null;
            }
            this._search_timer = Mainloop.timeout_add(300, Lang.bind(this, function()
            {
                this._search_timer = null;
                this._process_search(searchString);
            }));
        }
    },
    
    _on_query_results: function(obj, result)
    {
        var cursor = obj.query_finish(result);
        var query_results = {};
        for (var i in RESULT_TYPES_LABELS)
        {
            query_results[i] = new Array();
        }
        var result_types;
        var defined_type;
        while (cursor.next(null))
        {
            defined_type = null;
            if (!cursor.get_string(7)[0] || !cursor.get_string(1)[0])
            {
                // If we have no defined file type or no file url, skip
                continue;
            }
            result_types = cursor.get_string(7)[0].split(",");
            while (result_types.length > 0 && defined_type == null)
            {
                defined_type = CONVERT_TYPES[result_types.pop()];
            }
            if (defined_type == null)
            {
                //~ global.log(cursor.get_string(1) + " : " + cursor.get_string(7));
                defined_type = "files";
            }
            if (query_results[defined_type].length < 10)
            {
                query_results[defined_type].push(
                {
                    id: cursor.get_string(0)[0],
                    url: cursor.get_string(1)[0],
                    musicAlbum: decodeURIComponent(cursor.get_string(2)[0]).substring(10),
                    performer: decodeURIComponent(cursor.get_string(3)[0]).substring(11),
                    trackNumber: cursor.get_string(4)[0],
                    title: cursor.get_string(5)[0],
                    mimeType: cursor.get_string(6)[0],
                    type: defined_type
                });
            }
        }
        this._show_results(query_results);
    },
    
    _process_search: function(searchString)
    {
        try
        {
            var conn = Tracker.SparqlConnection.get(null);
            var words = searchString.split(" ");
            var query_params = new Array();
            for (var i in words)
            {
                if (words[i])
                {
                    if (words[i][0] == '"' && words[i][words[i].length - 1] == '"')
                    {
                        query_params.push("?s fts:match \"" + Tracker.sparql_escape_string(words[i].substring(1, words[i].length - 1)) + "\"");
                    }
                    else
                    {
                        query_params.push("?s fts:match \"" + Tracker.sparql_escape_string(words[i]) + "*\"");
                    }
                }
            }
            var query = "SELECT ?s nie:url(?s) nmm:musicAlbum(?s) nmm:performer(?s) nmm:trackNumber(?s) nie:title(?s) nie:mimeType(?s) rdf:type(?s)\
                         WHERE { " + query_params.join(" . ") + " }\
                         ORDER BY DESC (fts:rank(?s))\
                         LIMIT 100";
            //~ global.log(query);
            conn.query_async(query, null, Lang.bind(this, this._on_query_results));
        }
        catch(e)
        {
            global.log(e);
        }
    },
    
    _show_results: function(results)
    {
        var children = this._container.get_children();
        for (var i in children)
        {
            children[i].destroy();
        }
        
        var results_buttons = {};
        let button;
        let this_results;
        for (var result_type in results)
        {
            this_results = results[result_type];
            if (this_results.length > 0)
            {
                results_buttons[result_type] = new Array();
                for (var i in this_results)
                {
                    button = null;
                    switch (result_type)
                    {
                        case "software":
                            var results_parts = this_results[i]["url"].split("/");
                            let app = this._appSys.lookup_app(results_parts[results_parts.length - 1].split(".desktop")[0] + ".desktop");
                            if (app)
                            {
                                let appinfo = app.get_app_info();
                                if (!appinfo || !appinfo.get_nodisplay())
                                {
                                    button = new ApplicationResultButton(this, app);
                                }
                            }
                            break;
                        case "music":
                            button = new MusicResultButton(this, this_results[i], result_type);
                            break;
                        case "pictures":
                        case "videos":
                        case "folders":
                        case "files":
                            button = new FileResultButton(this, this_results[i], result_type);
                            break;
                    }
                    if (button != null)
                    {
                        button.actor.connect("notify::hover", Lang.bind(this, this._scrollToButton));
                        button.actor.connect("key-focus-in", Lang.bind(this, this._scrollToButton));
                        results_buttons[result_type].push(button);
                    }
                }
            }
        }
        
        let this_results_buttons;
        for (var result_type in results_buttons)
        {
            this_results_buttons = results_buttons[result_type];
            if (this_results_buttons.length > 0)
            {
                if (this._container.get_children().length > 0)
                {
                    var separator = new PopupMenu.PopupSeparatorMenuItem();
                    this._container.add_actor(separator.actor);
                }
                var result_type_label = new PopupMenu.PopupMenuItem(RESULT_TYPES_LABELS[result_type], 
                {
                    reactive: false,
                    hover: false,
                    sensitive: false,
                    focusOnHover: true
                });
                result_type_label.actor.set_style("font-weight: bold;");
                this._container.add_actor(result_type_label.actor);
                
                for (var i in this_results_buttons)
                {
                    this._container.add_actor(this_results_buttons[i].actor);
                }
            }
        }
    },

    on_applet_clicked: function(event)
    {
        if (event.get_button() == 1)
        {
            this.launch();
        }
    },
    
    launch: function()
    {
        this._search_menu.toggle();
        global.stage.set_key_focus(this.searchEntry);
        this.searchEntryText.set_selection(0, this.searchEntry.get_text().length);
    },
    
    _scrollToButton: function(button)
    {
        var current_scroll_value = this._scrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this._scrollBox.get_allocation_box().y2 - this._scrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.get_allocation_box().y1 - 10) new_scroll_value = button.get_allocation_box().y1 - 10;
        if (box_height + current_scroll_value < button.get_allocation_box().y2 + 10) new_scroll_value = button.get_allocation_box().y2-box_height + 10;
        if (new_scroll_value != current_scroll_value) this._scrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    }
}

function main(metadata, orientation, panel_height, instanceId)
{
    let myApplet = new MyApplet(orientation, panel_height, instanceId);
    return myApplet;
}
