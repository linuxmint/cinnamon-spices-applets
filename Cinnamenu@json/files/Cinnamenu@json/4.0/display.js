const St = imports.gi.St;
const {SignalManager} = imports.misc.signalManager;
const {PopupMenuSection} = imports.ui.popupMenu;
const {log} = require('./utils');
const {ContextMenu} = require('./contextmenu');
const {AppsView} = require('./appsview');
const {CategoriesView} = require('./categoriesview');
const {Sidebar} = require('./sidebar');
const ApplicationsViewMode = Object.freeze({LIST: 0, GRID: 1});
const SidebarPlacement = Object.freeze({TOP: 0, BOTTOM: 1, LEFT: 2, RIGHT: 3});

class Display {
    constructor (appThis) {
        this.appThis = appThis;
        this.displaySignals = new SignalManager(null);
        const sidebarPlacement = this.appThis.settings.sidebarPlacement;
        this.sidebar = new Sidebar(this.appThis);

        //==================bottomPane================
        this.searchView = new SearchView(this.appThis);
        this.displaySignals.connect(this.searchView.searchEntryText, 'text-changed',
                                        (...args) => this.appThis._onSearchTextChanged(...args));
        this.displaySignals.connect(this.searchView.searchEntryText, 'key-press-event',
                                                (...args) => this.appThis._onMenuKeyPress(...args));
        this.bottomPane = new St.BoxLayout({});
        if (sidebarPlacement === SidebarPlacement.TOP || sidebarPlacement === SidebarPlacement.BOTTOM) {
            this.bottomPane.add(this.sidebar.sidebarOuterBox, { expand: false, x_fill: false, y_fill: false,
                                                  x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }
        this.bottomPane.add(this.searchView.searchBox, { expand: true, x_fill: true, y_fill: false,
                                                    x_align: St.Align.END, y_align: St.Align.MIDDLE });

        //=================middlePane======================
        this.appsView = new AppsView(this.appThis);
        this.categoriesView = new CategoriesView(this.appThis);
        this.middlePane = new St.BoxLayout();
        if (sidebarPlacement === SidebarPlacement.LEFT) {
            this.middlePane.add(this.sidebar.sidebarOuterBox, { expand: false, x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }
        this.middlePane.add(this.categoriesView.groupCategoriesWorkspacesScrollBox,
                        { x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.START });
        this.middlePane.add(this.appsView.applicationsScrollBox, { x_fill: false, y_fill: false,
                                            x_align: St.Align.START, y_align: St.Align.START, expand: false });
        if (sidebarPlacement === SidebarPlacement.RIGHT) {
            this.middlePane.add(this.sidebar.sidebarOuterBox, { expand: false, x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }

        //=============mainBox================
        //set style: 'spacing: 0px' so that extra space is not added to mainBox when contextMenuBox is
        //added. Only happens with themes that have set a spacing value on this class.
        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-outer-box', style: 'spacing: 0px;',
                                        vertical: true, reactive: true,
                                        show_on_set_parent: false });
        this.mainBox.add_style_class_name('menu-applications-box'); //this is to support old themes
        if (sidebarPlacement === SidebarPlacement.TOP) {
            this.mainBox.add(this.bottomPane);
        }
        this.mainBox.add_actor(this.middlePane);
        if (sidebarPlacement !== SidebarPlacement.TOP) {
            this.mainBox.add(this.bottomPane);
        }

        this.contextMenu = new ContextMenu(this.appThis);
        //Note: The context menu is not fully model. Instead, it is added to the stage by adding it to
        //mainBox with it's height set to 0. contextMenuBox is then positioned at mouse coords and above
        //siblings. The context menu is not fully model because then it would be difficult to close both
        //the context menu and the applet menu when the user clicks outside of both.
        this.contextMenu.contextMenuBox.height = 0;
        this.mainBox.add(this.contextMenu.contextMenuBox, {expand: false, x_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE,});
        //=============menu================
        const section = new PopupMenuSection();
        section.actor.add_actor(this.mainBox);
        this.appThis.menu.addMenuItem(section);

        //if a blank part of the menu was clicked on, close context menu
        this.displaySignals.connect(this.mainBox, 'button-release-event',() => this.clearFocusedActors());

        //monitor mouse motion to prevent category mis-selection
        const onMouseMotion = (actor, event) => {
            //keep track of mouse motion to prevent misselection of another category button when moving mouse
            //pointer from selected category button to app button by calculating angle of pointer movement
            let [x, y] = event.get_coords();
            if (!this.mTrack) {
                this.mTrack = [];
            }
            //compare current position with oldest position in last 0.1 seconds.
            this.mTrack.push({time: Date.now(), x: x, y: y});//push current position onto array
            while (this.mTrack[0].time + 100 < Date.now()) {//remove positions older than 0.1 seconds ago
                this.mTrack.shift();
            }
            const dx = x - this.mTrack[0].x;
            const dy = Math.abs(y - this.mTrack[0].y);

            const tan = dx / dy;
            this.badAngle = tan > 0.3;//if tan = +infinity, badAngle is true.
                                      //if tan = -infinity or NaN, badAngle is false.
        };
        this.categoriesView.categoriesBox.set_reactive(true);
        this.displaySignals.connect(this.categoriesView.categoriesBox, 'motion-event',
                                                        (...args) => onMouseMotion(...args));

        //When sidebar is not on the left, limit excessive mainBox left padding + categoriesBox left
        //padding to 20px by subtracting the difference from categoriesBox left padding.
        if (sidebarPlacement !== SidebarPlacement.LEFT) {
            const catLpadding = this.categoriesView.categoriesBox.get_theme_node().get_padding(St.Side.LEFT);
            const mainBoxLpadding = this.mainBox.get_theme_node().get_padding(St.Side.LEFT);
            const excessPadding = Math.max(catLpadding + mainBoxLpadding - 20, 0);//=total padding > 20px
            if (excessPadding > 0) {
                this.categoriesView.categoriesBox.style = `padding-left: ${
                                            Math.max(catLpadding - excessPadding, 0)}px; `;
            }
        }

        //this.sidebar.populate();

        if (this.appThis.settings.applicationsViewMode === ApplicationsViewMode.LIST) {
            this.appsView.applicationsGridBox.hide();
            this.appsView.applicationsListBox.show();
        } else {
            this.appsView.applicationsListBox.hide();
            this.appsView.applicationsGridBox.show();
        }

        this.mainBox.show();
    }

    clearFocusedActors() {
        if (this.contextMenu.isOpen) {
            this.contextMenu.close();
        }
        this.appsView.clearAppsViewFocusedActors();
        this.sidebar.clearSidebarFocusedActors();
        this.categoriesView.allButtonsRemoveFocus();
    }

    onMenuResized(userWidth, userHeight){ //resizing callback
        this.updateMenuSize(userWidth, userHeight);
        //when resizing, no adjustments to app buttons are needed for list view
        if (this.appThis.settings.applicationsViewMode === ApplicationsViewMode.GRID) {
            this.appsView.resizeGrid();
        }
    }

    updateMenuSize(newWidth, newHeight) {
        //if newWidth & newHeight are not supplied, use current settings values.
        if (!newWidth) {
            newWidth = this.appThis.settings.customMenuWidth * global.ui_scale,
            newHeight= this.appThis.settings.customMenuHeight * global.ui_scale
        }

        //----------height--------
        //Note: the stored menu height value is middlePane + bottomPane which is smaller than the
        //menu's actual height. CategoriesView and sidebar height are not automatically
        //set because ScrollBox.set_policy Gtk.PolicyType.NEVER pushes other items off the menu
        let appsHeight = newHeight - this.bottomPane.height;
        appsHeight = Math.max(appsHeight, 200);//set minimum height

        //---set middlePane actors to appsHeight
        this.appsView.applicationsScrollBox.height = appsHeight;
        this.categoriesView.groupCategoriesWorkspacesScrollBox.height = appsHeight;

        //find sidebarOuterBox vertical padding
        const themeNode = this.sidebar.sidebarOuterBox.get_theme_node();
        const verticalPadding = Math.max(   themeNode.get_length('padding-top') +
                                            themeNode.get_length('padding-bottom'),
                                            themeNode.get_length('padding') * 2);
                
        //set sidebarScrollBox height
        this.sidebar.sidebarScrollBox.set_height(-1);//undo previous set_height()
        this.sidebar.sidebarScrollBox.set_height(Math.min(appsHeight - verticalPadding,
                                                this.sidebar.sidebarScrollBox.height));

        //------------width-------------
        //Note: the stored menu width value is less than the menu's actual width because it doesn't
        //include the outer menuBox padding, margin, etc. appsView width is not set automatically
        //because I don't know how to determine it's available width in order to calculate number
        //of columns to use in Clutter.GridLayout

        //find minimum width for categoriesView + sidebar (if present)
        let leftSideWidth = this.categoriesView.groupCategoriesWorkspacesScrollBox.width;
        if (this.appThis.settings.sidebarPlacement === SidebarPlacement.LEFT ||
                                this.appThis.settings.sidebarPlacement === SidebarPlacement.RIGHT) {
            leftSideWidth += this.sidebar.sidebarOuterBox.width;
        }

        //find minimum width of bottomPane
        this.searchView.searchEntry.width = 5;  //Set to something small so that it gets set to its
                                                //minimum value.
        let bottomPaneMinWidth = 0;
        if (this.appThis.settings.sidebarPlacement === SidebarPlacement.TOP ||
                            this.appThis.settings.sidebarPlacement === SidebarPlacement.BOTTOM) {
            bottomPaneMinWidth = this.bottomPane.width;
        }

        //find minimum menu width
        const minWidthForAppsView = 200;
        const minMenuWidth = Math.max(leftSideWidth + minWidthForAppsView, bottomPaneMinWidth);

        //---set applicationsListBox and applicationsGridBox width.
        const menuWidth = Math.max(minMenuWidth, newWidth);
        const appsBoxWidth = Math.floor(menuWidth - leftSideWidth);
        this.appsView.applicationsListBox.width = appsBoxWidth;
        this.appsView.applicationsGridBox.width = appsBoxWidth;
        this.appsView.currentGridBoxWidth = appsBoxWidth; //because reading
                                                        //applicationsGridBox.width seems unreliable.

        //Don't change settings while resizing to avoid excessive disk writes.
        if (!this.appThis.resizer.resizingInProgress) {
            this.appThis.settings.customMenuHeight = newHeight / global.ui_scale;
            this.appThis.settings.customMenuWidth = menuWidth / global.ui_scale;
        }
    }

    destroy() {
        this.displaySignals.disconnectAllSignals();
        this.searchView.destroy();
        this.searchView = null;
        this.appsView.destroy();
        this.appsView = null;
        this.sidebar.destroy();
        this.sidebar = null;
        this.categoriesView.destroy();
        this.categoriesView = null;
        this.contextMenu.destroy();
        this.contextMenu = null;
        this.bottomPane.destroy();
        this.middlePane.destroy();
        this.mainBox.destroy();
    }
}

class SearchView {
    constructor(appThis) {
        this.appThis = appThis;
        this.searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                                icon_name: 'edit-find' });
        this.searchActiveIcon = new St.Icon({   style_class: 'menu-search-entry-icon',
                                                icon_name: 'edit-clear' });
        this.searchEntry = new St.Entry({ name: 'menu-search-entry', track_hover: true, can_focus: true});
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntry.set_primary_icon(this.searchInactiveIcon);
        this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box' });
        this.searchBox.add(this.searchEntry, { expand: true });
    }

    showAndConnectSecondaryIcon() {
        this.searchEntry.set_secondary_icon(this.searchActiveIcon);
        this.appThis.signals.connect(this.searchEntry, 'secondary-icon-clicked', () => { //todo
                                                                    this.searchEntryText.set_text('');});
    }

    hideAndDisconnectSecondaryIcon() {
        this.searchEntry.set_secondary_icon(null);
        this.appThis.signals.disconnect('secondary-icon-clicked', this.searchEntry);
    }

    tweakTheme() {
        this.searchBox.style = 'min-width: 160px; ';

        //make searchBox l/r padding & margin symmetrical when it uses the full width of the menu.
        if (this.appThis.settings.sidebarPlacement === SidebarPlacement.RIGHT ||
                                        this.appThis.settings.sidebarPlacement === SidebarPlacement.LEFT) {
            //set left padding of searchBox to match right padding
            const searchBoxNode = this.searchBox.get_theme_node();
            const searchBoxPaddingRight = searchBoxNode.get_padding(St.Side.RIGHT);
            this.searchBox.style += `padding-left: ${searchBoxPaddingRight}px; `;

            //deal with uneven searchBox margins and uneven mainBox paddings by setting searchBox margins.
            const searchBoxMarginLeft = searchBoxNode.get_margin(St.Side.LEFT);
            const mainBoxNode = this.appThis.display.mainBox.get_theme_node();
            const mainBoxPaddingRight = mainBoxNode.get_padding(St.Side.RIGHT);
            const mainBoxPaddingLeft = mainBoxNode.get_padding(St.Side.LEFT);
            const newMargin = Math.max(searchBoxMarginLeft, mainBoxPaddingRight, mainBoxPaddingLeft);
            this.searchBox.style += `margin-left: ${newMargin - mainBoxPaddingLeft}px; ` +
                                                `margin-right: ${newMargin - mainBoxPaddingRight}px; `;
        }
    }

    destroy() {
        this.searchInactiveIcon.destroy();
        this.searchActiveIcon.destroy();
        this.searchEntry.destroy();
        this.searchBox.destroy();
    }
}

module.exports = {Display};