const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Tweener = imports.ui.tweener;
const Tooltips = imports.ui.tooltips;
const Keybinding = imports.ui.appletManager.applets['panel-launchers@cinnamon.org'] ? imports.ui.settings : imports.ui.settings;

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        this.set_applet_icon_symbolic_name("open-menu-symbolic");
        this.set_applet_tooltip("App Drawer");
        
        this.metadata = metadata;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("navigationMode", "navigationMode", this._onSettingsChanged.bind(this));
        this.settings.bind("columns", "columns", this._onSettingsChanged.bind(this));
        this.settings.bind("rows", "rows", this._onSettingsChanged.bind(this));
        this.settings.bind("iconSize", "iconSize", this._onSettingsChanged.bind(this));
        this.settings.bind("padding", "padding", this._onSettingsChanged.bind(this));
        this.settings.bind("fontSize", "fontSize", this._onSettingsChanged.bind(this));
        
        this.settings.bind("enableSearch", "enableSearch", this._onSettingsChanged.bind(this));
        this.settings.bind("autoFocusSearch", "autoFocusSearch");
        this.settings.bind("enableFavorites", "enableFavorites", this._onSettingsChanged.bind(this));
        this.settings.bind("favoriteApps", "favoriteApps");

        this.settings.bind("bgColor", "bgColor", this._onSettingsChanged.bind(this));
        this.settings.bind("bgOpacity", "bgOpacity", this._onSettingsChanged.bind(this));
        this.settings.bind("containerColor", "containerColor", this._onSettingsChanged.bind(this));
        this.settings.bind("containerOpacity", "containerOpacity", this._onSettingsChanged.bind(this));
        this.settings.bind("boxColor", "boxColor", this._onSettingsChanged.bind(this));
        this.settings.bind("boxOpacity", "boxOpacity", this._onSettingsChanged.bind(this));
        this.settings.bind("boxHoverColor", "boxHoverColor", this._onSettingsChanged.bind(this));
        this.settings.bind("boxHoverOpacity", "boxHoverOpacity", this._onSettingsChanged.bind(this));
        
        this.settings.bind("enableAnimations", "enableAnimations");
        this.settings.bind("openAnimationType", "openAnimationType");
        this.settings.bind("closeAnimationType", "closeAnimationType");
        this.settings.bind("pageAnimationType", "pageAnimationType");
        this.settings.bind("animationDuration", "animationDuration");
        
        this.settings.bind("overlay-keybinding", "overlayKeybinding", this._onKeybindingChanged.bind(this));
        
        this.modal = null;
        this.apps = [];
        this.filteredApps = [];
        this.currentPage = 0;
        this.isAnimating = false;
        this.isSearchMode = false;
        this.searchEntry = null;
        this.scrollAdjustment = null;
        this.isFirstOpen = true;
        this.activeTooltip = null;
        this.tooltipTimeout = null;
        this.firstResultButton = null;
        
        this._setupKeybinding();
    },

    _setupKeybinding: function() {
        Main.keybindingManager.addHotKey(
            "overlay-keybinding-" + this.instance_id,
            this.overlayKeybinding,
            () => {
                if (this.modal) {
                    this._destroyModal();
                } else {
                    this._showModal();
                }
            }
        );
    },

    _onKeybindingChanged: function() {
        Main.keybindingManager.removeHotKey("overlay-keybinding-" + this.instance_id);
        this._setupKeybinding();
    },

    on_applet_clicked: function() {
        if (this.isAnimating) return;
        
        if (this.modal) {
            this._destroyModal();
        } else {
            this._showModal();
        }
    },

    _onSettingsChanged: function() {
        if (this.modal) {
            this._destroyModal();
            this._showModal();
        }
    },

    _rgbToRgba: function(color, opacity) {
        let match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            let r = match[1];
            let g = match[2];
            let b = match[3];
            let a = opacity / 100;
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        return color;
    },

    _loadApps: function() {
        this.apps = [];
        let appSystem = Gio.AppInfo.get_all();
        
        for (let i = 0; i < appSystem.length; i++) {
            let app = appSystem[i];
            if (app.should_show()) {
                this.apps.push(app);
            }
        }
        
        this.apps.sort((a, b) => {
            if (this.enableFavorites && this.favoriteApps && Array.isArray(this.favoriteApps)) {
                let aIsFav = this.favoriteApps.indexOf(a.get_id()) !== -1;
                let bIsFav = this.favoriteApps.indexOf(b.get_id()) !== -1;
                if (aIsFav && !bIsFav) return -1;
                if (!aIsFav && bIsFav) return 1;
            }
            return a.get_display_name().toLowerCase().localeCompare(b.get_display_name().toLowerCase());
        });
        
        this.filteredApps = this.apps.slice();
    },

    _getMonitorGeometry: function() {
        let [mouseX, mouseY] = global.get_pointer();
        
        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
            let monitor = Main.layoutManager.monitors[i];
            if (mouseX >= monitor.x && mouseX < monitor.x + monitor.width &&
                mouseY >= monitor.y && mouseY < monitor.y + monitor.height) {
                return monitor;
            }
        }
        
        return Main.layoutManager.primaryMonitor;
    },

    _showModal: function() {
        let isFirstOpen = this.apps.length === 0;
        
        this._loadApps();
        this.currentPage = 0;
        this.isSearchMode = false;
        
        let monitor = this._getMonitorGeometry();
        
        let bgColor = this._rgbToRgba(this.bgColor, this.bgOpacity);
        
        this.modal = new St.BoxLayout({
            style_class: 'app-drawer-overlay',
            vertical: true,
            reactive: true,
            style: 'background-color: ' + bgColor + '; backdrop-filter: blur(20px);'
        });
        
        this.modal.set_position(monitor.x, monitor.y);
        this.modal.set_size(monitor.width, monitor.height);
        
        let containerColor = this._rgbToRgba(this.containerColor, this.containerOpacity);

        let container = new St.BoxLayout({
            style_class: 'app-drawer-container',
            vertical: true,
            reactive: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
            style: 'background: ' + containerColor + '; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.18); backdrop-filter: blur(40px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);',
            clip_to_allocation: true
        });

        container.connect('button-press-event', (actor, event) => {
            if (this.searchEntry && global.stage.get_key_focus() === this.searchEntry.clutter_text) {
                global.stage.set_key_focus(this.modal);
            }
            return Clutter.EVENT_STOP;
        });
        
        if (this.enableSearch) {
            let searchBox = new St.BoxLayout({
                x_align: Clutter.ActorAlign.CENTER,
                style: 'padding: 24px 24px 12px 24px;'
            });
            
            let searchIcon = new St.Icon({
                icon_name: 'edit-find-symbolic',
                icon_size: 16,
                style: 'margin-right: 8px;'
            });

            this.searchEntry = new St.Entry({
                track_hover: true,
                can_focus: true,
                style_class: 'app-drawer-search',
                style: 'width: 400px; padding: 12px 16px 12px 40px; border-radius: 8px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; font-size: 14px;'
            });

            this.searchEntry.set_primary_icon(searchIcon);
            
            this.searchClearButton = new St.Icon({
                icon_name: 'edit-clear-symbolic',
                icon_size: 16,
                style: 'color: rgba(255, 255, 255, 0.7); padding: 4px;',
                reactive: true,
                visible: false
            });
            
            this.searchEntry.set_secondary_icon(this.searchClearButton);
            
            this.searchClearButton.connect('button-press-event', () => {
                this._clearSearch();
                return Clutter.EVENT_STOP;
            });
            
            this.searchEntry.clutter_text.connect('text-changed', () => {
                this.searchClearButton.visible = this.searchEntry.get_text().length > 0;
                this._onSearchTextChanged();
            });
            
            this.searchEntry.clutter_text.connect('key-press-event', (actor, event) => {
                let symbol = event.get_key_symbol();
                if (symbol === Clutter.KEY_Escape) {
                    if (this.searchEntry.get_text() !== '') {
                        this._clearSearch();
                    } else {
                        this.searchEntry.clutter_text.set_selection(0, 0);
                        global.stage.set_key_focus(this.modal);
                    }
                    return Clutter.EVENT_STOP;
                }
                if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                    if (this.isSearchMode && this.filteredApps.length > 0) {
                        let app = this.filteredApps[0];
                        this._hideTooltip();
                        app.launch([], null);
                        this._destroyModal();
                        return Clutter.EVENT_STOP;
                    }
                }
                return Clutter.EVENT_PROPAGATE;
            });
            
            searchBox.add_actor(this.searchEntry);
            container.add_actor(searchBox);
        }

        let boxSize = this.iconSize + 60;
        let viewWidth = (boxSize + this.padding * 2) * this.columns + this.padding * 2;
        let viewHeight = (boxSize + this.padding * 2) * this.rows + this.padding * 2;
        
        if (this.navigationMode === 'scroll-vertical') {
            let scrollView = new St.ScrollView({
                style: 'width: ' + viewWidth + 'px; height: ' + viewHeight + 'px;',
                hscrollbar_policy: St.PolicyType.NEVER,
                vscrollbar_policy: St.PolicyType.AUTOMATIC,
                clip_to_allocation: true
            });
            
            this.gridContainer = new St.BoxLayout({
                vertical: true,
                style: 'width: ' + (viewWidth - 20) + 'px;'
            });
            
            scrollView.add_actor(this.gridContainer);
            this.scrollAdjustment = scrollView.vscroll.adjustment;
            
            scrollView.connect('scroll-event', (actor, event) => {
                let direction = event.get_scroll_direction();
                if (direction === Clutter.ScrollDirection.UP || direction === Clutter.ScrollDirection.DOWN) {
                    let adjustment = scrollView.vscroll.adjustment;
                    let increment = adjustment.step_increment * 3;
                    let targetValue;
                    
                    if (direction === Clutter.ScrollDirection.UP) {
                        targetValue = Math.max(adjustment.lower, adjustment.value - increment);
                    } else {
                        targetValue = Math.min(adjustment.upper - adjustment.page_size, adjustment.value + increment);
                    }
                    
                    Tweener.addTween(adjustment, {
                        value: targetValue,
                        time: 0.3,
                        transition: 'easeOutQuad'
                    });
                    
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            
            container.add_actor(scrollView);
        } else if (this.navigationMode === 'scroll-horizontal') {
            let scrollView = new St.ScrollView({
                style: 'width: ' + viewWidth + 'px; height: ' + viewHeight + 'px;',
                hscrollbar_policy: St.PolicyType.AUTOMATIC,
                vscrollbar_policy: St.PolicyType.NEVER,
                clip_to_allocation: true
            });
            
            this.gridContainer = new St.BoxLayout({
                vertical: false,
                style: 'height: ' + (viewHeight - 20) + 'px;'
            });
            
            scrollView.add_actor(this.gridContainer);
            this.scrollAdjustment = scrollView.hscroll.adjustment;
            
            scrollView.connect('scroll-event', (actor, event) => {
                let direction = event.get_scroll_direction();
                let adjustment = scrollView.hscroll.adjustment;
                let increment = adjustment.step_increment * 3;
                let targetValue;
                
                if (direction === Clutter.ScrollDirection.UP) {
                    targetValue = Math.max(adjustment.lower, adjustment.value - increment);
                } else if (direction === Clutter.ScrollDirection.DOWN) {
                    targetValue = Math.min(adjustment.upper - adjustment.page_size, adjustment.value + increment);
                }
                
                if (targetValue !== undefined) {
                    Tweener.addTween(adjustment, {
                        value: targetValue,
                        time: 0.3,
                        transition: 'easeOutQuad'
                    });
                    return Clutter.EVENT_STOP;
                }
                
                return Clutter.EVENT_PROPAGATE;
            });
            
            container.add_actor(scrollView);
        } else {
            this.gridContainer = new St.Widget({
                clip_to_allocation: true
            });
            container.add_actor(this.gridContainer);
            
            let navBox = new St.BoxLayout({
                x_align: Clutter.ActorAlign.CENTER,
                style: 'padding: 24px;'
            });
            
            this.prevButton = new St.Button({
                label: '←',
                style: 'padding: 16px 32px; margin: 0 16px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);'
            });

            this.prevButton.connect('clicked', () => {
                this._navigateLeft();
            });

            this.nextButton = new St.Button({
                label: '→',
                style: 'padding: 16px 32px; margin: 0 16px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);'
            });
            this.nextButton.connect('clicked', () => {
                this._navigateRight();
            });
            
            navBox.add_actor(this.prevButton);
            navBox.add_actor(this.nextButton);
            container.add_actor(navBox);
        }

        this.modal.add_actor(container);
        
        this.modal.connect('button-press-event', (actor, event) => {
            let button = event.get_button();
            
            if (button === 1) {
                if (this.searchEntry && this.searchEntry.has_key_focus()) {
                    global.stage.set_key_focus(null);
                    return Clutter.EVENT_STOP;
                }
                
                if (event.get_source() === this.modal) {
                    this._destroyModal();
                    return Clutter.EVENT_STOP;
                }
            }
            
            if (this.navigationMode === 'buttons') {
                if (button === 8) {
                    this._navigateLeft();
                    return Clutter.EVENT_STOP;
                }
                
                if (button === 9) {
                    this._navigateRight();
                    return Clutter.EVENT_STOP;
                }
            }
            
            return Clutter.EVENT_PROPAGATE;
        });
        
        this.modal.connect('scroll-event', (actor, event) => {
            if (this.navigationMode === 'buttons' && !this.isSearchMode) {
                let direction = event.get_scroll_direction();
                if (direction === Clutter.ScrollDirection.UP || direction === Clutter.ScrollDirection.LEFT) {
                    this._navigateLeft();
                    return Clutter.EVENT_STOP;
                } else if (direction === Clutter.ScrollDirection.DOWN || direction === Clutter.ScrollDirection.RIGHT) {
                    this._navigateRight();
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });
        
        this.modal.connect('key-press-event', (actor, event) => {
            let symbol = event.get_key_symbol();
            
            if (symbol === Clutter.KEY_Escape) {
                this._destroyModal();
                return Clutter.EVENT_STOP;
            }
            
            if (this.navigationMode === 'buttons') {
                if (symbol === Clutter.KEY_Left) {
                    this._navigateLeft();
                    return Clutter.EVENT_STOP;
                }
                
                if (symbol === Clutter.KEY_Right) {
                    this._navigateRight();
                    return Clutter.EVENT_STOP;
                }
            }
            
            return Clutter.EVENT_PROPAGATE;
        });
        
        Main.pushModal(this.modal);
        global.stage.add_actor(this.modal);
        
        this._updateGrid();

        this.modal.opacity = 0;

        let delay = this.isFirstOpen ? 50 : 0;
        let isFirst = this.isFirstOpen;
        this.isFirstOpen = false;

        imports.mainloop.timeout_add(delay, () => {
            if (!this.modal) return false;
            
            if (this.enableSearch && this.autoFocusSearch && this.searchEntry) {
                global.stage.set_key_focus(this.searchEntry.clutter_text);
            }
            
            if (isFirst) {
                Tweener.addTween(this.modal, {
                    opacity: 255,
                    time: this.animationDuration / 1000,
                    transition: 'easeOutQuad',
                    onComplete: () => {
                        if (this.enableAnimations) {
                            this._animateOpen(this.modal, container);
                        }
                    }
                });
            } else if (this.enableAnimations) {
                this._animateOpen(this.modal, container);
            } else {
                this.modal.opacity = 255;
            }
            return false;
        });
    },

    _safeDestroyGrid: function(grid) {
        if (!grid) return;
        try {
            grid.destroy();
        } catch(e) {}
    },

    _updateGrid: function() {
        let oldGrid = this.grid;
        this.firstResultButton = null;
        
        let boxSize = this.iconSize + 60;
        
        if (this.navigationMode === 'scroll-vertical') {
            this.grid = new St.Widget({
                layout_manager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.VERTICAL
                }),
                style: 'padding: ' + this.padding + 'px;'
            });
            
            let viewWidth = (boxSize + this.padding * 2) * this.columns;
            this.grid.set_width(viewWidth);
            
            let layout = this.grid.layout_manager;
            let col = 0;
            let row = 0;
            
            for (let i = 0; i < this.filteredApps.length; i++) {
                let app = this.filteredApps[i];
                let isFirst = (i === 0 && this.isSearchMode);
                let button = this._createAppButton(app, boxSize, isFirst);
                if (isFirst) this.firstResultButton = button;
                layout.attach(button, col, row, 1, 1);
                
                col++;
                if (col >= this.columns) {
                    col = 0;
                    row++;
                }
            }
            
            this._safeDestroyGrid(oldGrid);
            this.gridContainer.add_actor(this.grid);
            
        } else if (this.navigationMode === 'scroll-horizontal') {
            this.grid = new St.Widget({
                layout_manager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.HORIZONTAL
                }),
                style: 'padding: ' + this.padding + 'px;'
            });
            
            let viewHeight = (boxSize + this.padding * 2) * this.rows;
            this.grid.set_height(viewHeight);
            
            let layout = this.grid.layout_manager;
            let col = 0;
            let row = 0;
            
            for (let i = 0; i < this.filteredApps.length; i++) {
                let app = this.filteredApps[i];
                let isFirst = (i === 0 && this.isSearchMode);
                let button = this._createAppButton(app, boxSize, isFirst);
                if (isFirst) this.firstResultButton = button;
                layout.attach(button, col, row, 1, 1);
                
                row++;
                if (row >= this.rows) {
                    row = 0;
                    col++;
                }
            }
            
            this._safeDestroyGrid(oldGrid);
            this.gridContainer.add_actor(this.grid);
            
        } else {
            this.grid = new St.Widget({
                layout_manager: new Clutter.GridLayout({
                    orientation: Clutter.Orientation.VERTICAL
                }),
                style: 'padding: ' + this.padding + 'px;'
            });
            
            let totalWidth = (boxSize + this.padding * 2) * this.columns + this.padding * 2;
            let totalHeight = (boxSize + this.padding * 2) * this.rows + this.padding * 2;
            this.grid.set_width(totalWidth);
            this.grid.set_height(totalHeight);
            
            let layout = this.grid.layout_manager;
            let perPage = this.columns * this.rows;
            let start = this.currentPage * perPage;
            let end = Math.min(start + perPage, this.filteredApps.length);
            
            let col = 0;
            let row = 0;
            
            for (let i = start; i < end; i++) {
                let app = this.filteredApps[i];
                let isFirst = (i === start && this.isSearchMode);
                let button = this._createAppButton(app, boxSize, isFirst);
                if (isFirst) this.firstResultButton = button;
                layout.attach(button, col, row, 1, 1);
                
                col++;
                if (col >= this.columns) {
                    col = 0;
                    row++;
                }
            }
            
            let maxPage = Math.ceil(this.filteredApps.length / perPage) - 1;
            
            if (this.isSearchMode) {
                this.prevButton.visible = false;
                this.nextButton.visible = false;
            } else {
                this.prevButton.visible = this.currentPage > 0;
                this.nextButton.visible = this.currentPage < maxPage;
            }
            
            if (this.enableAnimations && oldGrid) {
                this._animatePageTransition(oldGrid, this.grid);
            } else {
                this._safeDestroyGrid(oldGrid);
                this.gridContainer.add_actor(this.grid);
            }
        }
    },

    _navigateLeft: function() {
        if (this.isSearchMode || this.isAnimating) return;
        
        if (this.currentPage > 0) {
            this.currentPage--;
            this._updateGrid();
        }
    },

    _navigateRight: function() {
        if (this.isSearchMode || this.isAnimating) return;
        
        let maxPage = Math.ceil(this.filteredApps.length / (this.columns * this.rows)) - 1;
        if (this.currentPage < maxPage) {
            this.currentPage++;
            this._updateGrid();
        }
    },

    _calculateMatchScore: function(app, searchText) {
        let name = app.get_display_name().toLowerCase();
        let description = app.get_description();
        let descText = description ? description.toLowerCase() : '';
        
        let score = 0;
        
        if (name === searchText) {
            score = 1000;
        } else if (name.startsWith(searchText)) {
            score = 500 + (100 - searchText.length);
        } else if (name.includes(searchText)) {
            let index = name.indexOf(searchText);
            score = 200 - index;
        } else if (descText.startsWith(searchText)) {
            score = 100 + (50 - searchText.length);
        } else if (descText.includes(searchText)) {
            let index = descText.indexOf(searchText);
            score = 50 - Math.min(index, 40);
        }
        
        return score;
    },

    _onSearchTextChanged: function() {
        let searchText = this.searchEntry.get_text().toLowerCase().trim();
        
        if (searchText === '') {
            this._clearSearch();
            return;
        }
        
        this.isSearchMode = true;
        this.currentPage = 0;
        
        let matches = [];
        for (let i = 0; i < this.apps.length; i++) {
            let app = this.apps[i];
            let score = this._calculateMatchScore(app, searchText);
            if (score > 0) {
                matches.push({ app: app, score: score });
            }
        }
        
        matches.sort((a, b) => b.score - a.score);
        
        this.filteredApps = matches.map(m => m.app);
        
        this._updateGrid();
    },

    _clearSearch: function() {
        if (this.searchEntry) {
            this.searchEntry.set_text('');
        }
        this.isSearchMode = false;
        this.currentPage = 0;
        this.filteredApps = this.apps.slice();
        this.firstResultButton = null;
        this._updateGrid();
    },

    _animateOpen: function(modal, container) {
        this.isAnimating = true;
        let duration = this.animationDuration / 1000;
        
        switch(this.openAnimationType) {
            case 'fade':
                container.set_scale(1.0, 1.0);
                container.translation_y = 0;
                container.opacity = 255;
                modal.opacity = 0;
                Tweener.addTween(modal, {
                    opacity: 255,
                    time: duration,
                    transition: 'easeOutQuad',
                    onComplete: () => { this.isAnimating = false; }
                });
                break;
                
            case 'scale':
                modal.opacity = 255;
                container.translation_y = 0;
                container.set_scale(0.8, 0.8);
                container.opacity = 0;
                Tweener.addTween(container, {
                    scale_x: 1.0,
                    scale_y: 1.0,
                    opacity: 255,
                    time: duration,
                    transition: 'easeOutQuad',
                    onComplete: () => { this.isAnimating = false; }
                });
                break;
                
            case 'slide-up':
                modal.opacity = 255;
                container.set_scale(1.0, 1.0);
                container.translation_y = 100;
                container.opacity = 0;
                Tweener.addTween(container, {
                    translation_y: 0,
                    opacity: 255,
                    time: duration,
                    transition: 'easeOutQuad',
                    onComplete: () => { this.isAnimating = false; }
                });
                break;
                
            case 'zoom':
                container.translation_y = 0;
                modal.opacity = 0;
                container.set_scale(0.5, 0.5);
                container.opacity = 255;
                Tweener.addTween(modal, {
                    opacity: 255,
                    time: duration,
                    transition: 'easeOutQuad'
                });
                Tweener.addTween(container, {
                    scale_x: 1.0,
                    scale_y: 1.0,
                    time: duration,
                    transition: 'easeOutCubic',
                    onComplete: () => {this.isAnimating = false; }
                });
                break;
                
            default:
                modal.opacity = 255;
                container.opacity = 255;
                this.isAnimating = false;
        }
    },

    _animatePageTransition: function(oldGrid, newGrid) {
        this.isAnimating = true;
        let duration = this.animationDuration / 1000;
        
        this.gridContainer.add_actor(newGrid);
        
        switch(this.pageAnimationType) {
            case 'fade':
                newGrid.opacity = 0;
                Tweener.addTween(oldGrid, {
                    opacity: 0,
                    time: duration / 2,
                    transition: 'easeOutQuad',
                    onComplete: () => {
                        this._safeDestroyGrid(oldGrid);
                    }
                });
                Tweener.addTween(newGrid, {
                    opacity: 255,
                    time: duration / 2,
                    delay: duration / 2,
                    transition: 'easeInQuad',
                    onComplete: () => { this.isAnimating = false; }
                });
                break;
                
            case 'slide':
                let direction = this.prevButton.visible && !this.nextButton.visible ? -1 : 1;
                newGrid.translation_x = direction * 200;
                newGrid.opacity = 0;
                
                Tweener.addTween(oldGrid, {
                    translation_x: -direction * 200,
                    opacity: 0,
                    time: duration,
                    transition: 'easeInOutQuad',
                    onComplete: () => {
                        this._safeDestroyGrid(oldGrid);
                    }
                });
                Tweener.addTween(newGrid, {
                    translation_x: 0,
                    opacity: 255,
                    time: duration,
                    transition: 'easeInOutQuad',
                    onComplete: () => { this.isAnimating = false; }
                });
                break;
                
            case 'crossfade':
                newGrid.opacity = 0;
                Tweener.addTween(oldGrid, {
                    opacity: 0,
                    time: duration,
                    transition: 'easeInOutQuad',
                    onComplete: () => {
                        this._safeDestroyGrid(oldGrid);
                    }
                });
                Tweener.addTween(newGrid, {
                    opacity: 255,
                    time: duration,
                    transition: 'easeInOutQuad',
                    onComplete: () => { this.isAnimating = false; }
                });
                break;
                
            default:
                this._safeDestroyGrid(oldGrid);
                this.isAnimating = false;
        }
    },

_createAppButton: function(app, boxSize, isFirstResult) {
        let boxColor = this._rgbToRgba(this.boxColor, this.boxOpacity);
        let boxHoverColor = this._rgbToRgba(this.boxHoverColor, this.boxHoverOpacity);
        let spacing = Math.round(this.iconSize * 0.2);
        
        let baseStyle = 'margin: ' + this.padding + 'px; background: ' + boxColor + '; border-radius: 12px; transition: all 0.2s; spacing: ' + spacing + 'px; padding-top: ' + Math.round(boxSize * 0.15) + 'px;';
        let hoverStyle = 'margin: ' + this.padding + 'px; background: ' + boxHoverColor + '; border-radius: 12px; box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.3); spacing: ' + spacing + 'px; padding-top: ' + Math.round(boxSize * 0.15) + 'px;';
        let selectedStyle = 'margin: ' + this.padding + 'px; background: ' + boxHoverColor + '; border-radius: 12px; box-shadow: 0 0 20px 4px rgba(100, 150, 255, 0.6); border: 2px solid rgba(150, 200, 255, 0.8); spacing: ' + spacing + 'px; padding-top: ' + Math.round(boxSize * 0.15) + 'px;';
        
        let box = new St.BoxLayout({
            style_class: 'app-drawer-item',
            vertical: true,
            reactive: true,
            track_hover: true,
            width: boxSize,
            height: boxSize,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            style: isFirstResult ? selectedStyle : baseStyle
        });
        
        let description = app.get_description();
        let tooltipText = app.get_display_name();
        if (description) {
            tooltipText += '\n' + description;
        }
        
        box.connect('enter-event', () => {
            if (!isFirstResult) {
                box.set_style(hoverStyle);
            }

            if (this.tooltipTimeout) {
                imports.mainloop.source_remove(this.tooltipTimeout);
            }
            
            this.tooltipTimeout = imports.mainloop.timeout_add(300, () => {
                this._showTooltip(tooltipText);
                this.tooltipTimeout = null;
                return false;
            });
        });
        
        box.connect('leave-event', () => {
            if (!isFirstResult) {
                box.set_style(baseStyle);
            } else {
                box.set_style(selectedStyle);
            }
    
            if (this.tooltipTimeout) {
                imports.mainloop.source_remove(this.tooltipTimeout);
                this.tooltipTimeout = null;
            }
            this._hideTooltip();
        });
        
        box.connect('motion-event', (actor, event) => {
            if (this.activeTooltip) {
                let [x, y] = event.get_coords();
                this.activeTooltip.set_position(x + 15, y + 15);
            }
            return Clutter.EVENT_PROPAGATE;
        });
        
        let icon = app.get_icon();
        let iconActor = new St.Icon({
            gicon: icon,
            icon_size: this.iconSize,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        
        let iconWrapper = new St.Widget({
            layout_manager: new Clutter.FixedLayout(),
            width: this.iconSize,
            height: this.iconSize,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true
        });
        
        iconWrapper.add_child(iconActor);
        
        if (this.enableFavorites) {
            if (!this.favoriteApps) this.favoriteApps = [];
            let isFavorite = this.favoriteApps.indexOf(app.get_id()) !== -1;
            
            let starButton = new St.Button({
                reactive: true,
                track_hover: true,
                style: 'padding: 2px; background: rgba(0, 0, 0, 0.7); border-radius: 10px;'
            });
            
            let starIcon = new St.Icon({
                icon_name: isFavorite ? 'starred-symbolic' : 'non-starred-symbolic',
                icon_size: 16,
                style: 'color: ' + (isFavorite ? '#FFD700' : 'rgba(255, 255, 255, 0.6)') + ';'
            });
            
            starButton.set_child(starIcon);
            starButton.connect('button-press-event', () => {
                this._toggleFavorite(app);
                return Clutter.EVENT_STOP;
            });
            
            starButton.set_position(this.iconSize - 20, 0);
            iconWrapper.add_child(starButton);
        }
        
        box.add_actor(iconWrapper);
        
        let labelHeight = Math.round(this.fontSize * 2.5);
        let label = new St.Label({
            text: app.get_display_name(),
            style: 'font-size: ' + this.fontSize + 'pt; color: rgba(255, 255, 255, 0.95); text-align: center; padding-left: 8px; padding-right: 8px; height: ' + labelHeight + 'px;',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START
        });
        label.clutter_text.set_line_wrap(false);
        label.clutter_text.set_ellipsize(3);
        label.clutter_text.set_line_alignment(2);
        
        box.add_actor(label);
        
        box.connect('button-press-event', () => {
            this._hideTooltip();
            app.launch([], null);
            this._destroyModal();
            return Clutter.EVENT_STOP;
        });
        
        return box;
    },

    _showTooltip: function(text) {
        this._hideTooltip();
        
        let lines = text.split('\n');
        let styledText = '<span weight="bold">' + lines[0] + '</span>';
        if (lines.length > 1) {
            styledText += '\n' + lines.slice(1).join('\n');
        }
        
        this.activeTooltip = new St.Label({
            style: 'background-color: rgba(0, 0, 0, 0.9); color: white; padding: 8px 12px; border-radius: 6px; font-size: ' + this.fontSize + 'pt; max-width: 300px;'
        });
        
        this.activeTooltip.clutter_text.set_markup(styledText);
        this.activeTooltip.clutter_text.set_line_wrap(true);
        
        global.stage.add_actor(this.activeTooltip);
        
        let [x, y] = global.get_pointer();
        this.activeTooltip.set_position(x + 15, y + 15);
    },

    _hideTooltip: function() {
        if (this.activeTooltip) {
            global.stage.remove_actor(this.activeTooltip);
            this.activeTooltip.destroy();
            this.activeTooltip = null;
        }
    },

    _toggleFavorite: function(app) {
        if (!this.favoriteApps) this.favoriteApps = [];
        let appId = app.get_id();
        let index = this.favoriteApps.indexOf(appId);
        
        if (index === -1) {
            this.favoriteApps.push(appId);
        } else {
            this.favoriteApps.splice(index, 1);
        }
        
        this.settings.setValue("favoriteApps", this.favoriteApps);
        
        if (this.searchEntry && this.searchEntry.get_text() !== '') {
            this.searchEntry.set_text('');
            global.stage.set_key_focus(this.modal);
            this.isSearchMode = false;
        }
        
        this._loadApps();
        this.currentPage = 0;
        this._updateGrid();
    },

    _destroyModal: function() {
        this._hideTooltip();
        if (this.tooltipTimeout) {
            imports.mainloop.source_remove(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }
        if (this.modal && !this.isAnimating) {
            if (this.enableAnimations) {
                this._animateClose();
            } else {
                this._completeDestroy();
            }
        }
    },

    _animateClose: function() {
        this.isAnimating = true;
        let duration = this.animationDuration / 1000;
        let container = this.modal.get_children()[0];
        
        switch(this.closeAnimationType) {
            case 'fade':
                Tweener.addTween(this.modal, {
                    opacity: 0,
                    time: duration,
                    transition: 'easeOutQuad',
                    onComplete: () => { this._completeDestroy(); }
                });
                break;
                
            case 'scale':
                Tweener.addTween(container, {
                    scale_x: 0.8,
                    scale_y: 0.8,
                    opacity: 0,
                    time: duration,
                    transition: 'easeInBack',
                    onComplete: () => { this._completeDestroy(); }
                });
                break;
                
            case 'slide-down':
                Tweener.addTween(container, {
                    translation_y: 100,
                    opacity: 0,
                    time: duration,
                    transition: 'easeInQuad',
                    onComplete: () => { this._completeDestroy(); }
                });
                break;
                
            case 'zoom':
                Tweener.addTween(this.modal, {
                    opacity: 0,
                    time: duration,
                    transition: 'easeInQuad'
                });
                Tweener.addTween(container, {
                    scale_x: 0.5,
                    scale_y: 0.5,
                    time: duration,
                    transition: 'easeInCubic',
                    onComplete: () => { this._completeDestroy(); }
                });
                break;
                
            default:
                this._completeDestroy();
        }
    },

    _completeDestroy: function() {
        this._hideTooltip();
        if (this.tooltipTimeout) {
            imports.mainloop.source_remove(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }
        if (this.modal) {
            Main.popModal(this.modal);
            global.stage.remove_actor(this.modal);
            this.modal.destroy();
            this.modal = null;
            this.searchEntry = null;
            this.scrollAdjustment = null;
        }
        this.isAnimating = false;
        this.isSearchMode = false;
        this.firstResultButton = null;
    },

    on_applet_removed_from_panel: function() {
        Main.keybindingManager.removeHotKey("overlay-keybinding-" + this.instance_id);
        this.enableAnimations = false;
        this._destroyModal();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}