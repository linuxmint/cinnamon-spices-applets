const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Main = imports.ui.main;
const {SignalManager} = imports.misc.signalManager;
const {AppState} = imports.gi.Cinnamon;
const {EllipsizeMode} = imports.gi.Pango;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;

const {_, wordWrap, getThumbnail_gicon, showTooltip, hideTooltipIfVisible} = require('./utils');
const ApplicationsViewModeLIST = 0, ApplicationsViewModeGRID = 1;
const DescriptionPlacementTOOLTIP = 1, DescriptionPlacementUNDER = 2, DescriptionPlacementNONE = 3;

class AppButton {
    constructor(appThis, app) {
        this.appThis = appThis;
        this.app = app;
        const isListView = this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST;
        this.signals = new SignalManager(null);

        //----------ICON---------------------------------------------
        if (this.app.icon) { //isSearchResult(excl. emoji), isClearRecentsButton, isBackButton
            this.icon = this.app.icon;
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
            this.icon.get_clutter_text().set_markup(this.app.emoji);
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
        //.menu-application-button-label{} in themes are designed for list view and may have uneven
        //padding, so in grid view make padding symmetrical and center text
        let labelStyle = '';
        if (!isListView) {
            labelStyle = 'padding-right: 2px; padding-left: 2px; text-align: center; ';
        }
        if (this.app.isClearRecentsButton) {
            labelStyle += 'font-weight: bold;';
        }
        this.label.style = labelStyle;
        //set label text
        let name = this.app.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        let description = this.app.description ?
                            this.app.description.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';
        let markup = '<span>' + name + '</span>';
        if (this.appThis.settings.descriptionPlacement === DescriptionPlacementUNDER && description) {
            description = description.replace(/\n/g, ' ');//remove formatting intended for tooltip
            markup += '\n<span size="small">' + description + '</span>';
        }
        const clutterText = this.label.get_clutter_text();
        clutterText.set_markup(markup);
        clutterText.ellipsize = EllipsizeMode.END;

        //--------app running indicator--------------
        this.appRunningIndicator = new St.Widget({
                style: isListView ?
                'width: 2px; height: 12px; background-color: ' + this.appThis.getThemeForegroundColor() +
                                                    '; margin: 0px; border: 1px; border-radius: 10px;' :
                'width: 32px; height: 2px; background-color: ' + this.appThis.getThemeForegroundColor() +
                                                    '; margin: 0px; border: 1px; border-radius: 10px;',
                x_expand: false,
                y_expand: false});

        //-------------actor---------------------
        this.actor = new St.BoxLayout({ vertical: !isListView, reactive: true,
                                            accessible_role: Atk.Role.MENU_ITEM});
        //remove l/r padding in grid view to allow maximum space for label
        if (!isListView) {
            this.actor.set_style('padding-left: 0px; padding-right: 0px;');
            this.setGridButtonWidth();
        }
        if (this.icon && this.appThis.getAppIconSize() > 0) {
            this.actor.add(this.icon, { x_fill: false, y_fill: false,
                                        x_align: isListView ? St.Align.START : St.Align.MIDDLE,
                                        y_align: St.Align.MIDDLE});
        }
        this.actor.add(this.appRunningIndicator, {  x_fill: false, y_fill: false,
                                        x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.actor.add(this.label, {
                                x_fill: false, y_fill: false,
                                x_align: isListView ? St.Align.START : St.Align.MIDDLE,
                                y_align: St.Align.MIDDLE});
        this._setButtonNormal();
        this._setAppHighlightClass();

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

        //----running state
        this._onRunningStateChanged();
        if (this.app.isApplication) {
            this.signals.connect(this.app, 'notify::state', (...args) => this._onRunningStateChanged(...args));
        }

        //this.signals.connect(this.actor, 'button-press-event', (...args) => this.handleButtonPress(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this._handleButtonRelease(...args));
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
    }

    _setButtonNormal() {
        this.has_focus = false;
        this.actor.set_style_class_name('menu-application-button');
        this._addTileStyle();
    }

    _setButtonSelected() {
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
        //const opaqueify = (col) => { //make color 1/3 more opaque
        //            col.alpha = Math.floor((col.alpha + col.alpha + 255) / 3);
        //            return col; };
        const bgColor = this.appThis.getThemeBackgroundColor();
        if (bgColor.to_string().startsWith('#000000')) {
            bgColor.red = 20;
            bgColor.green = 20;
            bgColor.blue = 20;
        }
        let addedStyle = 'border:2px; border-color:' + toRgbaString(bgColor) + '; ';
        if (!this.has_focus) {
            addedStyle += 'background-color:' + toRgbaString(lightenOrDarkenColor(bgColor)) + ';';
        }
        this.actor.set_style(addedStyle);
    }

    _setAppHighlightClass() {
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
        this.actor.width = this.appThis.appsView.getGridValues().columnWidth;
    }

    handleEnter(actor, event) {
        if (this.appThis.contextMenu.isOpen ) {
            return false;
        }

        if (event) {//mouse
            this.appThis.clearFocusedActors();
        } else {//keyboard navigation
            this.appThis.scrollToButton(this, this.appThis.settings.enableAnimation);
        }
        this._setButtonSelected();

        //------show tooltip
        if (this.appThis.settings.descriptionPlacement === DescriptionPlacementTOOLTIP) {
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
            if (this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                x += 175 * global.ui_scale;
                y += height + 8 * global.ui_scale;
            } else {//grid view
                x += Math.floor(width / 2);
                y += height + 8 * global.ui_scale;
                center_x = true;
            }
            showTooltip(this.actor, x, y, center_x, tooltipMarkup);
        }
        return false;
    }

    handleLeave(actor, event) {
        if (this.appThis.contextMenu.isOpen) {
            return false;
        }
        this._setButtonNormal();
        hideTooltipIfVisible();
    }

    _handleButtonRelease(actor, e) {
        const button = e.get_button();
        if (button === 1) {//left click
            if (this.appThis.contextMenu.isOpen) {
                this.appThis.clearFocusedActors();
                this.handleEnter();
            } else {
                this.activate(e);
            }
            return Clutter.EVENT_STOP;
        } else if (button === 3) {//right click
            if (this.appThis.contextMenu.isOpen) {
                this.appThis.clearFocusedActors();
                this.handleEnter();
                return Clutter.EVENT_STOP;
            } else {
                if (this.app.isApplication || this.app.isFolderviewFile || this.app.isFolderviewDirectory ||
                                            this.app.isFavoriteFile || this.app.emoji || this.app.isRecentFile){
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
                this._setAppHighlightClass();
            }
            this.appThis.recentApps.add(this.app.id);
            this.app.open_new_window(-1);
            this.appThis.menu.close();
        } else if (this.app.isFolderviewDirectory || this.app.isBackButton) {
            this.appThis.setActiveCategory(Gio.File.new_for_uri(this.app.uri).get_path());
            //don't menu.close()
        } else if (this.app.isFolderviewFile || this.app.isRecentFile || this.app.isFavoriteFile) {
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
            this.appThis.setActiveCategory('recents');
            //don't menu.close
        } else if (this.app.isSearchResult || this.app.isPlace) {
            this.app.activate(this.app);
            this.appThis.menu.close();
        }
    }

    _onRunningStateChanged() {
        if (this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST) {
            if (this.app.isApplication && this.app.state !== AppState.STOPPED) {
                this.appRunningIndicator.show();
            } else {
                this.appRunningIndicator.hide();
            }
        } else {
            if (this.app.isApplication && this.app.state !== AppState.STOPPED) {
                this.appRunningIndicator.opacity = 255;
            } else {
                this.appRunningIndicator.opacity = 0;
            }
        }
        return true;
    }

    openContextMenu(e) {
        this._setButtonSelected();
        hideTooltipIfVisible();
        this.appThis.contextMenu.open(this.app, e, this.actor);
    }

    _resetAllAppsOpacity() {
        this.appThis.appsView.getActiveContainer().get_children().forEach( child => child.set_opacity(255) );
    }

    destroy() {
        this.signals.disconnectAllSignals();
        hideTooltipIfVisible();

        this.appRunningIndicator.destroy();
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
        const subheadingStyleClass = clickAction?'menu-applications-subheading-clickable':'menu-applications-subheading';
        this.subheadingBox = new St.BoxLayout({ style_class: subheadingStyleClass });
        this.subheadingBox.add(this.subheading, { });

        if (this.clickAction) {
            this.signals.connect(this.subheading, 'button-press-event', (...args) =>
                                                                    this._handleButtonPress(...args));
        }
    }

    _handleButtonPress(actor, e) {
        const button = e.get_button();
        if (button === 1) {//left click
            if (this.appThis.contextMenu.isOpen) {
                this.appThis.contextMenu.close();
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

/*Creates and populates the main applications view. Takes .app objects and creates AppButton objs with
 *.app as a property. this.buttonStore[] array is used to store AppButton objs for later reuse
 *otherwise new AppButton's would need to be created each time a category is clicked on.*/
class AppsView {
    constructor(appThis) {
        this.appThis = appThis;
        this.buttonStore = [];
        this.appsViewSignals = new SignalManager(null);

        this.applicationsListBox = new St.BoxLayout({ vertical: true });
        this.applicationsGridBox = new Clutter.Actor({ layout_manager: new Clutter.GridLayout() });
        this.headerText = new St.Label({ style_class: 'menu-applications-header-text' });
        this.applicationsBoxWrapper = new St.BoxLayout({ style_class: 'menu-applications-inner-box',
                                                                                            vertical: true});
        this.applicationsBoxWrapper.add_style_class_name('menu-applications-box'); //this is to support old themes

        this.applicationsBoxWrapper.add(this.headerText, { x_fill: false, x_align: St.Align.MIDDLE });
        this.applicationsBoxWrapper.add(this.applicationsGridBox, { });
        this.applicationsBoxWrapper.add(this.applicationsListBox, { });
        this.applicationsScrollBox = new St.ScrollView({ style_class: 'vfade menu-applications-scrollbox' });
        const vscrollApplications = this.applicationsScrollBox.get_vscroll_bar();
        this.appsViewSignals.connect(vscrollApplications, 'scroll-start',
                                                                () => { this.appThis.menu.passEvents = true; });
        this.appsViewSignals.connect(vscrollApplications, 'scroll-stop',
                                                                () => { this.appThis.menu.passEvents = false; });
        this.applicationsScrollBox.add_actor(this.applicationsBoxWrapper);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.applicationsScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.applicationsScrollBox.set_mouse_scrolling(true);
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
    }

    populate_add(appList, subheadingText = null, clickAction = null) {
        if (subheadingText) {
            if (this.column !== 0) {
                this.column = 0;
                this.rownum++;
            }

            const subheading = new Subheading(this.appThis, subheadingText, clickAction);
            if (this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                this.applicationsListBox.add(subheading.subheadingBox);
            } else {
                const gridLayout = this.applicationsGridBox.layout_manager;
                gridLayout.attach(subheading.subheadingBox, this.column, this.rownum,
                                                                    this.getGridValues().columns, 1);
                this.rownum++;
            }

            subheading.subheadingBox.show();
            this.subheadings.push(subheading);
        }

        appList.forEach(app => {
            let appButton = this.buttonStore.find(button => button.app === app);

            if (!appButton) {
                appButton = new AppButton(this.appThis, app);
                this.buttonStore.push(appButton);
            }
            if (this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                this.applicationsListBox.add_actor(appButton.actor);
            } else {
                const gridLayout = this.applicationsGridBox.layout_manager;
                appButton.setGridButtonWidth();// In case menu has been resized.
                gridLayout.attach(appButton.actor, this.column, this.rownum, 1, 1);
                appButton.actor.layout_column = this.column;//used for key navigation
                this.column++;

                if (this.column > this.getGridValues().columns - 1) {
                    this.column = 0;
                    this.rownum++;
                }
            }
        });
    }

    populate_finish() {
        if (this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST) {
            this.applicationsListBox.show();
        } else {
            this.applicationsGridBox.show();
        }

        this.currentGridViewColumnCount = this.getGridValues().columns;
    }

    highlightFirstItem() {
        //When displying search results, ensure first item is highlighted so that pressing
        //return selects top result.
        const buttons = this.getActiveButtons();
        if (buttons[0] && !buttons[0].has_focus) {
            this.appThis.clearFocusedActors();
            buttons[0].handleEnter();
        }
    }

    resizeGrid() {
        this.applicationsGridBox.hide();//for performance

        const newcolumnCount = this.getGridValues().columns;
        if (this.currentGridViewColumnCount === newcolumnCount) {
            //Number of columns are the same so just adjust button widths only.
            this.applicationsGridBox.get_children().forEach(actor => {
                            if (actor.has_style_class_name('menu-application-button') ||
                                actor.has_style_class_name('menu-application-button-selected')) {
                                actor.width = this.getGridValues().columnWidth;
                            }
                         });
        } else {//Rearrange buttons to fit new number of columns.
            this.applicationsGridBox.hide();//
            const buttons = this.applicationsGridBox.get_children();
            this.applicationsGridBox.remove_all_children();
            let column = 0;
            let rownum = 0;
            const gridLayout = this.applicationsGridBox.layout_manager;
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
        const minColumnWidth = Math.max(140, this.appThis.settings.appsGridIconSize * 1.2);
        const columns = Math.floor(appsBoxWidth / (minColumnWidth * global.ui_scale));
        const columnWidth = Math.floor(appsBoxWidth / columns);

        return {columnWidth: columnWidth, columns: columns};
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
        return this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST ?
                                                this.applicationsListBox : this.applicationsGridBox;
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
        this.applicationsBoxWrapper.destroy();
        this.applicationsScrollBox.destroy();
        this.buttonStore.forEach(button => { if (button) button.destroy(); });
        this.buttonStore = [];
    }
}

module.exports = {AppsView};
