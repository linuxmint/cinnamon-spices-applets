const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Main = imports.ui.main;
const Util = imports.misc.util;
const {SignalManager} = imports.misc.signalManager;
const {EllipsizeMode} = imports.gi.Pango;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;

const { _,
        wordWrap,
        getThumbnail_gicon,
        showTooltip,
        hideTooltipIfVisible,
        scrollToButton} = require('./utils');
const ApplicationsViewMode = Object.freeze({LIST: 0, GRID: 1});
const DescriptionPlacement = Object.freeze({TOOLTIP: 0, UNDER: 1, NONE: 2});

class AppButton {
    constructor(appThis, app) {
        this.appThis = appThis;
        this.app = app;
        const isListView = this.appThis.settings.applicationsViewMode === ApplicationsViewMode.LIST;
        this.signals = new SignalManager(null);

        //----------ICON---------------------------------------------
        if (this.app.icon) {  // Clone instead of reuse
          this.icon = new St.Icon({
            gicon: this.app.icon.gicon,
            icon_name: this.app.icon.icon_name,
            icon_size: this.appThis.getAppIconSize()
            });
        } else if (this.app.icon_filename) { //some of isSearchResult
            const gicon = new Gio.FileIcon({file: Gio.file_new_for_path(this.app.icon_filename)});
            this.icon = new St.Icon({ gicon: gicon, icon_size: this.appThis.getAppIconSize()});
        } else if (this.app.gicon) { //isRecentFile, isFavoriteFile,
                                    //isFolderviewFile/Directory, some of isSearchResult
            let gicon = this.app.gicon;
            if (!this.app.isSearchResult) {
                gicon = getThumbnail_gicon(this.app.uri, this.app.mimeType) || gicon;
            }
            this.icon = new St.Icon({ gicon: gicon, icon_size: this.appThis.getAppIconSize()});
        } else if (this.app.emoji) {//emoji search result
            this.icon = new St.Label({ style: 'color: white; font-size: ' +
                                            (Math.round(this.appThis.getAppIconSize() * 0.85)) + 'px;'});
            this.icon.get_clutter_text().set_text(this.app.emoji);
        } else if (this.app.mixed) {//mixed search result
            this.icon = new St.Label({ style: 'color: white; font-size: ' +
                                            (Math.round(this.appThis.getAppIconSize() * 0.85)) + 'px;'});
            this.icon.get_clutter_text().set_text(this.app.mixed);
        } else if (this.app.isApplication) {//isApplication
            this.icon = this.app.create_icon_texture(this.appThis.getAppIconSize());
        } else if (this.app.iconFactory) {//isPlace
            this.icon = this.app.iconFactory(this.appThis.getAppIconSize());
            if (!this.icon) {
                this.icon = new St.Icon({ icon_name: 'folder', icon_size: this.appThis.getAppIconSize()});
            }
        }
        if (!this.icon) {
            this.icon = new St.Icon({icon_name: 'dialog-error', icon_size: this.appThis.getAppIconSize()});
        }

        //--------Label------------------------------------
        this.label = new St.Label({ style_class: 'menu-application-button-label' });
        if (!isListView) {
            this.label.set_x_align(Clutter.ActorAlign.CENTER);
            this.label.set_y_align(Clutter.ActorAlign.CENTER);

            this.label.set_x_expand(false);

            // optional: limit max width so wrapping still works nicely
            this.label.set_style('max-width: 100px;');
        }
        if (this.app.isClearRecentsButton) {
            this.label.style = 'font-weight: bold;';
        }

        // Set label text
        let name = this.app.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        let description = this.app.description ?
                    this.app.description.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';

        // ----- Limit name max no. of characters including spaces -----
        const maxChars = 22;
        if (!isListView && name.length > maxChars) {
            name = name.slice(0, maxChars - 3) + '...'; // reserve 3 chars for '...'
        }

        let markup = '<span>' + name + '</span>';

        if (this.appThis.settings.descriptionPlacement === DescriptionPlacement.UNDER && description) {
            description = description.replace(/\n/g, ' '); // remove formatting intended for tooltip
            markup += '\n<span size="small">' + description + '</span>';
        }

        const clutterText = this.label.get_clutter_text();

        if (!isListView) {

        // Force space for 2 lines of text
        const layout = clutterText.get_layout();
        const lineHeight = layout.get_pixel_size()[1]; // safer than font math

        // Reserve space for ~2 lines
        this.label.set_height(lineHeight * 2.0);


        //this.label.y_expand = true;         // Ensure label expands
        }
        clutterText.set_markup(markup);

        // Enable wrapping
        clutterText.line_wrap = true;
        clutterText.line_wrap_mode = 2; // Pango.WrapMode.WORD_CHAR
        clutterText.set_single_line_mode(false);

        // Disable ellipsizing (so it wraps instead)
        clutterText.ellipsize = EllipsizeMode.NONE;

        // Center text (important for grid view)
        clutterText.set_line_alignment(Clutter.ActorAlign.CENTER);
        clutterText.set_justify(true);


        //-------------actor---------------------
        this.actor = new St.BoxLayout({ vertical: !isListView, reactive: true,
                                            accessible_role: Atk.Role.MENU_ITEM});

        this.actor = new St.BoxLayout({ vertical: !isListView, reactive: true,
        accessible_role: Atk.Role.MENU_ITEM, y_expand: false   // FIX: stop vertical stretching
        });

        if (!isListView) {
            const iconSize = this.appThis.getAppIconSize();

        // icon + label (2 lines) + padding
            const BUTTON_HEIGHT = Math.floor(iconSize + (iconSize * 1.2));
        }

        //-------------icons and label ---------------------
        if (this.icon && this.appThis.getAppIconSize() > 0) {

        // spacer above icon
        if (!isListView) { // only for grid view
            const iconSpacer = new St.Widget({ height: 8 });
            this.actor.add(iconSpacer, { x_fill: false, y_fill: false, x_align: St.Align.MIDDLE });
        }

        this.actor.add(this.icon, { x_fill: false, y_fill: false,
            x_align: isListView ? St.Align.START : St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        }
        this.actor.add(this.label, {
            x_fill: false,
            y_fill: false,   // stop vertical stretching
            x_align: isListView ? St.Align.START : St.Align.MIDDLE,
            y_align: St.Align.MIDDLE   //  center vertically
        });

        this._setButtonStyleNormal();
        this._setNewAppHighlightClass();

        //----------dnd--------------
        if (this.app.isApplication) {
            this.actor._delegate = {
                handleDragOver: (source) => {
                        if (source.isDraggableApp && source.id !== this.app.id &&
                                                        this.appThis.currentCategory === 'favorite_apps') {
                            this._resetAllAppsOpacity();
                            this.actor.set_opacity(40);
                            return DragMotionResult.MOVE_DROP;
                        }
                        return DragMotionResult.NO_DROP; },
                handleDragOut: () => {  this.actor.set_opacity(255); },
                acceptDrop: (source) => {
                        if (source.isDraggableApp && source.id !== this.app.id &&
                                                        this.appThis.currentCategory === 'favorite_apps') {
                            this.actor.set_opacity(255);
                            this.appThis.addFavoriteAppToPos(source.id, this.app.id);
                            return true;
                        } else {
                            this.actor.set_opacity(255);
                            return DragMotionResult.NO_DROP;
                        } },
                getDragActorSource: () => this.actor,
                _getDragActor: () => new Clutter.Clone({source: this.actor}),
                getDragActor: () => new Clutter.Clone({source: this.icon}),
                id: this.app.id,
                get_app_id: () => this.app.id, //used when eg. dragging to panel launcher
                isDraggableApp: true
            };

            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.draggable, 'drag-begin', () => hideTooltipIfVisible());
            //this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this._onDragCancelled(...args));
            this.signals.connect(this.draggable, 'drag-end', () => this._resetAllAppsOpacity());
        }

        //this.signals.connect(this.actor, 'button-press-event', (...args) => this.handleButtonPress(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this._handleButtonRelease(...args));
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        }

    _setButtonStyleNormal() {
        this.has_focus = false;
        this.actor.set_style_class_name('menu-application-button');
        this._addTileStyle();
    }

    _setButtonStyleSelected() {
        this.has_focus = true;
        this.actor.set_style_class_name('menu-application-button-selected');
        
        this._addTileStyle();
    }

    _addTileStyle() {
        if (!this.appThis.settings.useTileStyle) {
            return;
        }

        const toRgbaString = (col) => {
                const decPlaces2 = (n) => Math.round(n * 100) / 100;
                return `rgba(${col.red},${col.green},${col.blue},${decPlaces2(col.alpha / 255)})`; };
        const lightenOrDarkenColor = (col) => { //lighten a dark color or darken a light color
                    const isLightTheme = (col.red + col.green + col.blue) > 364;
                    const amt = isLightTheme ? -15 : 15;
                    col.red += amt;
                    col.green += amt;
                    col.blue += amt;
                    return col; };
        const getThemeBackgroundColor = () => {
            return this.appThis.menu.actor.get_theme_node().get_background_color();
        }

        const bgColor = getThemeBackgroundColor();
        if (bgColor.to_string().startsWith('#000000')) {
            bgColor.red = 20;
            bgColor.green = 20;
            bgColor.blue = 20;
        }
        let addedStyle = 'border:2px; border-color:' + toRgbaString(bgColor) + '; padding-left:2px; padding-right:2px; ';
        if (!this.has_focus) {
            addedStyle += 'background-color:' + toRgbaString(lightenOrDarkenColor(bgColor)) + ';';
        }
        this.actor.set_style(addedStyle);
    }

    _setNewAppHighlightClass() {
        if (this.app.newAppShouldHighlight) {
            if (!this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.add_style_pseudo_class('highlighted'); //'font-weight: bold;';
            }
        } else {
            if (this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.remove_style_pseudo_class('highlighted');
            }
        }
    }

    setGridButtonWidth() {
        this.actor.width = this.appThis.display.appsView.getGridValues().columnWidth;
    }

    handleEnter(actor, event) {
        if (this.appThis.display.contextMenu.isOpen ) {
            return Clutter.EVENT_PROPAGATE;
        }

        if (event) {//mouse
            this.appThis.display.clearFocusedActors();
        } else {//keyboard navigation
            scrollToButton(this, this.appThis.settings.enableAnimation);
        }
        this._setButtonStyleSelected();

        //------show tooltip
        if (this.appThis.settings.descriptionPlacement != DescriptionPlacement.TOOLTIP) {
            return Clutter.EVENT_STOP;
        }  
        const SHOW_SEARCH_MARKUP_IN_TOOLTIP = true;
        let tooltipMarkup = '<span>' + wordWrap((this.app.nameWithSearchMarkup &&
                                        SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.appThis.searchActive) ?
                                        this.app.nameWithSearchMarkup : this.app.name) + '</span>';
        if (this.app.description) {
            tooltipMarkup += '\n<span size="small">' + wordWrap((this.app.descriptionWithSearchMarkup &&
                                SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.appThis.searchActive) ?
                                this.app.descriptionWithSearchMarkup : this.app.description) + '</span>';
        }
        tooltipMarkup = tooltipMarkup.replace(/&/g, '&amp;');
        let [x, y] = this.actor.get_transformed_position();
        let {width, height} = this.actor;
        let center_x = false; //should tooltip x pos. be centered on x
        if (this.appThis.settings.applicationsViewMode === ApplicationsViewMode.LIST) {
            x += 175 * global.ui_scale;
            y += height + 8 * global.ui_scale;
        } else {//grid view
            x += Math.floor(width / 2);
            y += height + 8 * global.ui_scale;
            center_x = true;
        }
        showTooltip(this.actor, x, y, center_x, tooltipMarkup);
        return Clutter.EVENT_STOP;
    }

    handleLeave(actor, event) {
        if (this.appThis.display.contextMenu.isOpen) {
            return false;
        }
        this._setButtonStyleNormal();
        hideTooltipIfVisible();
    }

    _handleButtonRelease(actor, e) {
        const button = e.get_button();
        if (button === Clutter.BUTTON_PRIMARY) {
            if (this.appThis.display.contextMenu.isOpen) {
                this.appThis.display.clearFocusedActors();
                this.handleEnter();
            } else {
                this.activate(e);
            }
            return Clutter.EVENT_STOP;
        } else if (button === Clutter.BUTTON_SECONDARY) {
            if (this.appThis.display.contextMenu.isOpen) {
                this.appThis.display.clearFocusedActors();
                this.handleEnter();
                return Clutter.EVENT_STOP;
            } else {
                if (this.app.isApplication || this.app.isFolderviewFile ||
                    this.app.isDirectory || this.app.isFavoriteFile ||
                    this.app.emoji || this.app.mixed || this.app.isRecentFile){
                    this.openContextMenu(e);
                }
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    activate() {
        if (this.app.isApplication) {
            if (this.app.newAppShouldHighlight) {
                this.app.newAppShouldHighlight = false;
                this._setNewAppHighlightClass();
            }
            this.appThis.recentApps.add(this.app.id);
            this.app.open_new_window(-1);
            this.appThis.menu.close();
        } else if ((this.app.isDirectory && !this.app.isPlace) || this.app.isBackButton) {
            this.appThis.setActiveCategory(Gio.File.new_for_uri(this.app.uri).get_path());
    this._updateAllAppsButton();
            //don't menu.close()
        } else if (this.app.isFolderviewFile || this.app.isRecentFile ||
                   this.app.isFavoriteFile || (this.app.isDirectory && this.app.isPlace)) {
            try {
                Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context());
                this.appThis.menu.close();
            } catch (e) {
                Main.notify(_('Error while opening file:'), e.message);
                //don't menu.close()
            }
        } else if (this.app.isClearRecentsButton) {
            this.appThis.recentApps.clear();
            this.appThis.recentManagerDefault.purge_items();
        if (this.appThis.settings.showCategories) {
            // Normal category mode
            this.appThis.setActiveCategory('recents');
    this._updateAllAppsButton();
        } else {
    // Compact mode (no categories → uses mixed view)
    this.appThis.setActiveCategory('mixed');
    this._updateAllAppsButton();
        }
            //don't menu.close
        } else if (this.app.isSearchResult || this.app.isPlace) {
            this.app.activate(this.app);
            this.appThis.menu.close();
        }
    }

    activateAsRoot() {
        if (this.app.isApplication) {
            if (this.app.newAppShouldHighlight) {
                this.app.newAppShouldHighlight = false;
                this._setNewAppHighlightClass();
            }
            this.appThis.recentApps.add(this.app.id);
            const command = 'gksu ' + this.app.get_app_info().get_executable();
            Util.spawnCommandLine(command);
            this.appThis.menu.close();
        } 
    }

    openContextMenu(e) {
        this._setButtonStyleSelected();
        hideTooltipIfVisible();
        this.appThis.display.contextMenu.openApp(this.app, e, this.actor);
    }

    _resetAllAppsOpacity() {
        this.appThis.display.appsView.getActiveContainer().get_children().forEach(
                                                                child => child.set_opacity(255));
    }

    destroy() {
        this.signals.disconnectAllSignals();
        hideTooltipIfVisible();

        this.label.destroy();
        if (this.icon) {
            this.icon.destroy();
        }
        this.actor.destroy();
    }
}

class Subheading {
    constructor(appThis, subheadingText, clickAction) {
        this.appThis = appThis;
        this.subheadingText = subheadingText;
        this.clickAction = clickAction;
        this.signals = new SignalManager(null);
        this.subheading = new St.Label({ text: subheadingText, x_expand: true, reactive: true,
                                            accessible_role: Atk.Role.HEADING});
        const subheadingStyleClass =
                clickAction?'menu-applications-subheading-clickable':'menu-applications-subheading';
        this.subheadingBox = new St.BoxLayout({ style_class: subheadingStyleClass });
        this.subheadingBox.add(this.subheading, { });

        if (this.clickAction) {
            this.signals.connect(this.subheading, 'button-press-event', (...args) =>
                                                                this._handleButtonPress(...args));
        }
    }

    _handleButtonPress(actor, e) {
        const button = e.get_button();
        if (button === Clutter.BUTTON_PRIMARY) {
            if (this.appThis.display.contextMenu.isOpen) {
                this.appThis.display.contextMenu.close();
                return Clutter.EVENT_STOP;
            }
            if (this.clickAction) {
                this.clickAction();
            }
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    destroy(){
        this.signals.disconnectAllSignals();
        this.subheading.destroy();
        this.subheadingBox.destroy();
    }
}

/* Creates and populates the main applications view. Method populate_add() takes an array of app
 * objects and creates AppButton objs with .app as a property. These AppButton objs are then stored
 * in this.buttonStore[] array for later reuse otherwise new AppButton's would need to be created
 * each time a category is clicked on. Only the .actor property of the AppButton is used to populate
 * the actual GridLayout*/
class AppsView {
    constructor(appThis) {
        this.appThis = appThis;
        this.buttonStore = [];
        this.appsViewSignals = new SignalManager(null);

        this.applicationsListBox = new St.BoxLayout({ vertical: true });
        this.applicationsGridBox = new St.Bin({ style_class: 'menu-applications-grid-box',
                                                                x_fill: true, y_fill: true });

        const gridLayout = new Clutter.GridLayout();

        gridLayout.set_row_spacing(20);      // controls vertical spacing
        gridLayout.set_column_spacing(12);   // (optional) horizontal spacing

        this.applicationsGridLayout = new Clutter.Actor({ 
            layout_manager: gridLayout 
        });

        this.applicationsGridBox.set_child(this.applicationsGridLayout);
        this.headerText = new St.Label({ style_class: 'menu-applications-header-text' });
        this.applicationsBoxWrapper = new St.BoxLayout({ style_class: 'menu-applications-inner-box',
                                                                                    vertical: true});
        this.applicationsBoxWrapper.add_style_class_name(
                                            'menu-applications-box'); //this is to support old themes

        this.applicationsBoxWrapper.add(this.headerText, { x_fill: false, x_align: St.Align.MIDDLE });
        this.applicationsBoxWrapper.add(this.applicationsGridBox, { });
        this.applicationsBoxWrapper.add(this.applicationsListBox, { });
        this.applicationsScrollBox = new St.ScrollView(
                                            { style_class: 'vfade menu-applications-scrollbox' });
        const vscrollApplications = this.applicationsScrollBox.get_vscroll_bar();
        this.appsViewSignals.connect(vscrollApplications, 'scroll-start',
                                                () => { this.appThis.menu.passEvents = true; });
        this.appsViewSignals.connect(vscrollApplications, 'scroll-stop',
                                                () => { this.appThis.menu.passEvents = false; });
        this.applicationsScrollBox.add_actor(this.applicationsBoxWrapper);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.applicationsScrollBox.set_clip_to_allocation(true);
        this.applicationsScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.applicationsScrollBox.set_mouse_scrolling(true);
        this.appsViewSignals.connect(this.applicationsScrollBox, 'button-release-event',
                        (actor, event) => {
                            if (event.get_button() === Clutter.BUTTON_SECONDARY  &&
                                        !this.appThis.display.contextMenu.isOpen &&
                                        (this.appThis.currentCategory === 'all' ||
                                        this.appThis.currentCategory.startsWith('/'))) {
                                hideTooltipIfVisible();
                                this.appThis.display.contextMenu.openAppsView(event);
                                return Clutter.EVENT_STOP;
                            }
                            return Clutter.EVENT_PROPAGATE;
                        });
    }


    _updateAllAppsButton() {
        if (!this.allAppsBox) return;

        // Hide if categories are enabled
        if (this.appThis.settings.showCategories) {
            this.allAppsBox.visible = false;
            return;
        }

        this.allAppsBox.visible = true;

        if (this.appThis.currentCategory === 'all') {
        this.allAppsLabel.text = "Back";
        this.allAppsIcon.icon_name = 'go-previous-symbolic';
        } else {
            this.allAppsLabel.text = "All Apps";
            this.allAppsIcon.icon_name = 'cinnamon-all-applications';
        }
    }

    // ----------- Add icon at the top to Switch between all apps and the mixed view

    _createAllAppsButton() {
        // Do not show if categories are enabled
    if (this.appThis.settings.showCategories) {
        return;
    }

    // Destroy previous
    if (this.allAppsBox) {
        this.allAppsBox.destroy();
        this.allAppsBox = null;
    }

    this.allAppsBox = new St.BoxLayout({
        style_class: 'menu-applications-subheading',
        style: 'margin-bottom: 16px;',
        vertical: false
    });

    let spacer = new St.Widget({ x_expand: true });
    this.allAppsBox.add(spacer);

    this.allAppsButton = new St.BoxLayout({
        style_class: 'menu-category-button',
        reactive: true,
        track_hover: true,
        can_focus: true,
        y_align: Clutter.ActorAlign.CENTER
    });

    this.allAppsIcon = new St.Icon({
        icon_size: 16,
        y_align: Clutter.ActorAlign.CENTER
    });

    this.allAppsLabel = new St.Label({
        y_align: Clutter.ActorAlign.CENTER
    });

    this.allAppsButton.add(this.allAppsIcon);
    this.allAppsButton.add(new St.Widget({ width: 8 }));
    this.allAppsButton.add(this.allAppsLabel);

    this.allAppsBox.add(this.allAppsButton);

    this.applicationsBoxWrapper.insert_child_at_index(this.allAppsBox, 1);

    this._updateAllAppsButton();

    // Click handler (category-aware)
    this.appsViewSignals.connect(
        this.allAppsButton,
        'button-release-event',
        (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {

                if (this.appThis.currentCategory === 'all') {
                    // Go back to mixed (or previous view)
                    this.appThis.setActiveCategory('mixed');

                } else {
                    // Go to all apps
                    this.appThis.setActiveCategory('all');
                }
    this._updateAllAppsButton();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }
      );
    }

    populate(appList, headerText = null) {
        //too many actors in applicationsGridBox causes display errors, don't know why. Plus, it takes a long time
        if (appList.length > 1000) {
            appList.length = 1000; //truncate array
            headerText = _('Too many entries - showing first 1000 entries only');
        }
        this.populate_init(headerText);
        this.populate_add(appList, null);
        this.populate_finish();
    }

    populate_init(headerText = null) {
        this.applicationsListBox.hide();//hide while populating for performance.
        this.applicationsGridBox.hide();//
        this.clearApps();
        this.applicationsScrollBox.vscroll.adjustment.set_value(0);//scroll to top

        if (headerText) {
            this.headerText.set_text(headerText);
            this.headerText.show();
        } else {
            this.headerText.hide();
        }

        this.column = 0;
        this.rownum = 0;

        this.subheadings = [];

        // Always show the All Apps button when categories are hidden
    if (!this.appThis.settings.showCategories) {
        this._createAllAppsButton();
        } else {
        // Ensure it's removed when categories are shown
        if (this.allAppsBox) {
            this.allAppsBox.destroy();
            this.allAppsBox = null;
        }
    }
            }

    populate_add(appList, subheadingText = null, subheadingClickAction = null) {
        if (subheadingText) {
            if (this.column !== 0) {
                this.column = 0;
                this.rownum++;
            }

            const subheading = new Subheading(this.appThis, subheadingText, subheadingClickAction);
            if (this.appThis.settings.applicationsViewMode === ApplicationsViewMode.LIST) {
                this.applicationsListBox.add(subheading.subheadingBox);
            } else {
                const gridLayout = this.applicationsGridLayout.layout_manager;
                gridLayout.attach(subheading.subheadingBox, this.column, this.rownum,
                                                                    this.getGridValues().columns, 1);
                this.rownum++;
            }

            subheading.subheadingBox.show();
            this.subheadings.push(subheading);
        }


        appList.forEach(app => {

        // Always create a new button so duplicates can appear
        let appButton = new AppButton(this.appThis, app);
        this.buttonStore.push(appButton);

        if (this.appThis.settings.applicationsViewMode === ApplicationsViewMode.LIST) {
            this.applicationsListBox.add_actor(appButton.actor);
        } else {
            const gridLayout = this.applicationsGridLayout.layout_manager;
            appButton.setGridButtonWidth();// In case menu has been resized.
            gridLayout.attach(appButton.actor, this.column, this.rownum, 1, 1);
            appButton.actor.layout_column = this.column;//used for key navigation
            this.column++;

            if (this.column > this.getGridValues().columns - 1) {
                    this.column = 0;
                    this.rownum++;
            }

          //set minimum top & bottom padding for appbuttons as theme node is designed for list view.
          const buttonTopPadding = appButton.actor.get_theme_node().get_padding(St.Side.TOP);
          const buttonBottomPadding = appButton.actor.get_theme_node().get_padding(St.Side.BOTTOM);
                
          const MIN_PADDING = 8;
          if (buttonTopPadding < MIN_PADDING) {
              appButton.actor.style += `padding-top: ${MIN_PADDING}px; `;
          }
          if (buttonBottomPadding < MIN_PADDING) {
              appButton.actor.style += `padding-bottom: ${MIN_PADDING}px; `;}}
          });
        }

        addSpacer(height = 4) {
            if (this.appThis.settings.applicationsViewMode === ApplicationsViewMode.LIST) {
                const spacer = new St.Widget({ height });
                this.applicationsListBox.add(spacer);
            } else {
                if (this.column !== 0) {
                     this.column = 0;
                    this.rownum++;
                }

        const spacer = new St.Widget({ height });

        const gridLayout = this.applicationsGridLayout.layout_manager;
        gridLayout.attach(
            spacer,
            this.column,
            this.rownum,
            this.getGridValues().columns,
            1
        );

        this.rownum++;
    }
}

    populate_finish() {
        if (this.appThis.settings.applicationsViewMode === ApplicationsViewMode.LIST) {
            this.applicationsListBox.show();
        } else {
            this.applicationsGridBox.show();
        }

        this.currentGridViewColumnCount = this.getGridValues().columns;
    }

    resizeGrid() {
        this.applicationsGridBox.hide();//for performance

        const newcolumnCount = this.getGridValues().columns;
        if (this.currentGridViewColumnCount === newcolumnCount) {
            //Number of columns are the same so just adjust button widths only.
            this.applicationsGridLayout.get_children().forEach(actor => {
                            if (actor.has_style_class_name('menu-application-button') ||
                                actor.has_style_class_name('menu-application-button-selected')) {
                                actor.width = this.getGridValues().columnWidth;
                            }
                         });
        } else {//Rearrange buttons to fit new number of columns.
            this.applicationsGridBox.hide();//
            const buttons = this.applicationsGridLayout.get_children();
            this.applicationsGridLayout.remove_all_children();
            let column = 0;
            let rownum = 0;
            const gridLayout = this.applicationsGridLayout.layout_manager;
            const newColumnWidth = this.getGridValues().columnWidth;
            buttons.forEach(actor => {
                if (actor.has_style_class_name('menu-application-button') ||
                    actor.has_style_class_name('menu-application-button-selected')) {
                    actor.width = newColumnWidth;
                    gridLayout.attach(actor, column, rownum, 1, 1);
                    actor.layout_column = column;//used for key navigation
                    column++;
                    if (column > newcolumnCount - 1) {
                        column = 0;
                        rownum++;
                    }
                } else { //subheading label
                    if (column !== 0) {
                        column = 0;
                        rownum++;
                    }
                    gridLayout.attach(actor, column, rownum, newcolumnCount, 1);
                    rownum++;
                }
            });
            this.applicationsGridBox.show();
        }

        this.applicationsGridBox.show();
        this.currentGridViewColumnCount = newcolumnCount;
    }

    getGridValues() {
        const appsBoxWidth = this.currentGridBoxWidth;
        const minColumnWidth = Math.max(112, this.appThis.settings.appsGridIconSize * 1.3);
        const gridLayout = this.applicationsGridLayout.layout_manager;
        const columnSpacing = gridLayout.get_column_spacing();
        const columns = Math.max( 1, Math.floor((appsBoxWidth + columnSpacing) / (minColumnWidth * global.ui_scale + columnSpacing))
    );

        const totalSpacing = (columns - 1) * columnSpacing;
        const columnWidth = Math.floor((appsBoxWidth - totalSpacing) / columns);

        return {
            columnWidth: columnWidth,
            columns: columns
        };
    }

    getActiveButtons() {
        const activeButtons = [];
        this.getActiveContainer().get_children().forEach(child => {
            const foundButton = this.buttonStore.find(button => button.actor === child);
            if (foundButton) {
                activeButtons.push(foundButton);
            }
        });
        return activeButtons;
    }

    clearApps() {
        this.clearAppsViewFocusedActors();

        //destroy subheading labels
        if(this.subheadings){
            this.subheadings.forEach(subheading => subheading.destroy());
        }
        this.subheadings = [];

        this.getActiveContainer().remove_all_children();
    }

    clearAppsViewFocusedActors() {
        this.getActiveButtons().forEach(button => { if (button.has_focus) button.handleLeave(); });
    }

    getActiveContainer() {
        return this.appThis.settings.applicationsViewMode === ApplicationsViewMode.LIST ?
                                        this.applicationsListBox : this.applicationsGridLayout;
    }

    buttonStoreCleanup() {
        //delete all buttons which won't be reused
        const buttonStore = this.buttonStore.filter(button => {
            if (button.app.deleteAfterUse) {
                button.destroy();
                return false;
            } else {
                return true;
            } });
        this.buttonStore = buttonStore;
    }

    destroy() {
        this.appsViewSignals.disconnectAllSignals();
        this.headerText.destroy();
        this.applicationsListBox.destroy();
        this.applicationsGridBox.destroy();
        this.applicationsGridLayout.destroy();
        this.applicationsBoxWrapper.destroy();
        this.applicationsScrollBox.destroy();
        this.buttonStore.forEach(button => { if (button) button.destroy(); });
        this.buttonStore = [];
    }
}

module.exports = {AppsView};
