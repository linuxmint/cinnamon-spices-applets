/* Window-list applet
 *
 * The applet code consists of four main object. WindowPreview, AppMenuButton,
 * AppMenuButtonRightClickMenu and the main applet code.
 *
 * The main applet object listens to different events and updates the window
 * list accordingly. Since addition/removal of windows is emitted by the
 * workspace, we have to listen to the changes to the number of workspaces and
 * update our signals accordingly as well. It also listens to the change in
 * window state (eg tile/maximize) since the window titles are displayed
 * differently in the AppMenuButton for each different state, eg minimized
 * windows are shown as [Title].
 *
 * For each window the main applet object wants to show, an AppMenuButton is
 * created. This is created for every window in the monitors it is responsible
 * for, regardless of whether it is on the active workspace.  Individual applet
 * objects are then shown/hidden according to which workspace they are in.
 *
 * The AppMenuButton is responsible for managing its own appearance using a
 * CinnamonGenericContainer.  We manage the allocation ourselves and shrink the
 * label when there isn't enough space in the panel (the space available is
 * divided among all AppMenuButtons and each is told how much space they can
 * use through the "allocate" signal). It also has an onFocus function that the
 * main applet calls when a window is focused.
 *
 * When a window is marked urgent or demand attention ("urgent" windows are not
 * more important that those demanding attention. These are two unrelated
 * notions in different specifications that both mean approximately the same
 * thing), we will ask the AppMenuButton to flash. If the window is from a
 * separate workspace, we generate a new temporary AppMenuButton and add it to
 * our actor box. It stops flashing when the onFocus function is called (and if
 * the window is indeed focused) (destroyed in the case of temporary
 * AppMenuButtons).
 *
 * The AppMenuButtonRightClickMenu is, as the name suggests, the right click
 * menu of the AppMenuButton. The menu is generated every time the button is
 * right-clicked, since this rarely happens and generating all at the beginning
 * would be a waste of time/memory. This also saves us from having to listen to
 * signals for changes in workspace/monitor etc.
 *
 * Finally, the WindowPreview object is a tooltip that shows a preview of the
 * window. Users can opt to show a window preview (using this), or the title
 * (using Tooltips.PanelItemTooltip) in the tooltip. The window preview is
 * generated on the fly when needed instead of cached.
 */

const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Tooltips = imports.ui.tooltips;
const WindowUtils = imports.misc.windowUtils;
const Util = imports.misc.util;

const APPLET_DIRECTORY = AppletManager.appletMeta["window-list@sangorys"].path;
const TEMP_DIRECTORY = "/tmp"
const USER_ORDER_PATH = APPLET_DIRECTORY.replace("window-list@sangorys", "") + "window-list@sangorys-userOrder.txt" // path to the file which contains the order preferences for the users
const LOG_PATH = TEMP_DIRECTORY + "/window-list@sangorys.log"

const MAX_TEXT_LENGTH = 1000;
const FLASH_INTERVAL = 500;
const FLASH_MAX_COUNT = 4;

const WINDOW_PREVIEW_WIDTH = 200;
const WINDOW_PREVIEW_HEIGHT = 150;


////////////////////////////////////////////////////////////////////////////////////////////////////
var debug = false;


function logif(context, text) {
    if (context)
        log(String(text));
}

function log(text) {
    if (debug){
        //global.log(text);
        if (typeof(text) == "string")
            fileAppend(text);
        else
            fileAppend(String(text));
    }
}


function logm(text) {
    if (debug){
        if (typeof(text) == "string")
        global.log(text);
        else
            global.log(String(text));
        //fileAppend(text);
    }
}


function msgbox(text) {
    if (debug){
        //global.log(text);
        ;
    }
}


function fileAppend(text) {
    //if (debug){
        try {
            let file = Gio.file_new_for_path(LOG_PATH);
            let out = file.append_to (Gio.FileCreateFlags.NONE, null);
            out.write (text, null);
            out.write ("\n", null);
            out.close(null);
        } catch(error) { global.logError(error) };
    //}
}


function notify(title, text="", icon="info") {
    //log("notify-send --icon=\"info\" \" + title + \" \"text\"");
    Util.spawnCommandLine("notify-send --icon=\"" + icon + "\" \"" + title + "\" \"" + text + "\"");
}


////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
class UserOrder {
    constructor(cinnamonWindowListApplet) {
        this.cinnamonWindowListApplet=cinnamonWindowListApplet;

        this.debug=true;//false;

        this.separator = ";"
        this.fileUserOrder = new FileUserOrder(this);
        this.fileUserOrder.writeString("", LOG_PATH);

        logif(this.debug, "UserOrder()");

        this.tableOfDictionary = this.fileUserOrder.readToTableOfDictionary();
        //this.printDictionnary();
        this._cleanTableOfDictionary();

        //log("UserOrder:" + String(this.tableOfDictionary.length));
        //log("1st class:" + String(this.tableOfDictionary[0]["class"]));
    }

    add(xid, listOfPreviousXid, position, theClass, title) {
        logif(this.debug, "add()");
        /*let position = this.getIndexFrom("xid", xid);
        log("position="+position);
        if (position >= 0){
            // Update existing entry
            this.tableOfDictionary.splice(position, 1,
            {
                "xid":xid,
                "after": "",
                "position": "",
                "class": theClass,
                "title": title
            });
        }else*/ {
            // Add at the end
            this.tableOfDictionary.push({
                "xid":xid,
                "after": "",
                "position": position,
                "class": theClass,
                "title": title});
            }
        logif(this.debug, "add() end");
        }


    addAndSave(xid, listOfPreviousXid, position, theClass, title) {
        logif(this.debug, "addAndSave()");
        add(xid, listOfPreviousXid, position, theClass, title);
        this.fileUserOrder.writeDictionary(this.tableOfDictionary);
        logif(this.debug, "addAndSave() end");
        }


    _cleanTableOfDictionary(){
        logif(this.debug, "_cleanTableOfDictionary()");

        try {
            // REMOVE DUPLICATE CLASS (we keep the first one)
            let fileToUpdate=false;
            for (let i=0 ; i < this.tableOfDictionary.length ; i++)
                for (let j=i+1 ; j < this.tableOfDictionary.length ; j++)
                    if (this.tableOfDictionary[i]["class"] == this.tableOfDictionary[j]["class"]
                    && this.tableOfDictionary[i]["title"] == this.tableOfDictionary[j]["title"]
                    && this.tableOfDictionary[j]["xid"] == "") {
                        logif(this.debug, "Found " + this.tableOfDictionary[i]["class"] + " in row " + i);
                        logif(this.debug, "Remove " + this.tableOfDictionary[j]["class"] + " from row " + j);
                        this.tableOfDictionary.splice(j, 1);
                        fileToUpdate=true;
                        logif(this.debug, "Removed ");
                    }

            if (fileToUpdate){
                fileUserOrder.writeTableOfDictionary(this.tableOfDictionary);
            }
        } catch(error) { log(error) };

/*
        //REMOVE CLOSED WINDOW (IF NO BUG, THIS PART IS USELESS)
        for (let i=0 ; i < this.tableOfDictionary.length ; i++){
            if (this.cinnamonWindowListApplet.doesXidExist(this.tableOfDictionary[i]["xid"]) == false){
                log("WARNING : tableOfDictionary has a non existing window id : " + this.tableOfDictionary[i]["xid"] + ". We delete the row");
                //this.tableOfDictionary.splice(i, 1);
            }
        }
*/

        logif(this.debug, "_cleanTableOfDictionary().END ");
    }


    getXidFrom(type, value, startPosition=0){
        let fileIndex = this.getIndexFrom(type, value, startPosition);
        if (fileIndex >= 0)
            return this.tableOfDictionary[fileIndex]["xid"];
    }

    getIndexFrom(type, value, toExcludeClosedWindow = false){
        let localDebug=false;
        logif(localDebug, "getIndexFrom(" + type + "," + String(value) + ")");
        logif(localDebug, "tableOfDictionary.length = " + this.tableOfDictionary.length);

        let index = 0;

        for (let i=0 ; i < this.tableOfDictionary.length ; i++) {
            //log("");
            //logif("search in " + this.tableOfDictionary[i]["class"]);
            //logif(this.tableOfDictionary[i]["xid"]);
            //log(typeof(this.tableOfDictionary[i]["xid"]));
            //log(i + "." + index);
            //log(this.tableOfDictionary[i][type]);
            if (toExcludeClosedWindow == false && this.tableOfDictionary[i]["xid"] == ""){
                continue;
            }

            if (this.tableOfDictionary[i][type] == value)
            {
                logif(localDebug, "return " + index);
                return index;
            }
            index++;

        }
        logif(localDebug, "return -1 (not found)");
        return -1;
    }


    getLastIndexFromClassAndTitle(theClass, title/*, toExcludeClosedWindow = false*/){
        let localDebug=false;
        logif(localDebug, "\getLastIndexFromClassAndTitle(class=" + theClass + ", title=" + title + ")");
        //logif(this.debug, "tableOfDictionary length=" + String(this.tableOfDictionary.length));

        for (let i=this.tableOfDictionary.length-1 ; i >= 0  ; i--) {
            logif(localDebug, this.tableOfDictionary[i]["class"]);
            if  (this.tableOfDictionary[i]["class"] == theClass
             && this.tableOfDictionary[i]["title"] == title) {
                
                logif(localDebug, "getLastIndexFromClassAndTitle() => return " + i); //this.getIndexFrom("xid", this.tableOfDictionary[i]["xid"], toExcludeClosedWindow));
                return i; //this.getIndexFrom("xid", this.tableOfDictionary[i]["xid"], toExcludeClosedWindow);
            }
        }
        logif(localDebug, "getIndexFrgetLastIndexFromClassAndTitleomReverse() => return -1");
        return -1;
    }


    getIndexFromReverse(type, value, toExcludeClosedWindow = false){
        logif(this.debug, "\ngetIndexFromReverse(" + type + "," + String(value) + ")");
        logif(this.debug, "tableOfDictionary length=" + String(this.tableOfDictionary.length));

        for (let i=this.tableOfDictionary.length-1 ; i >= 0  ; i--) {
            log(this.tableOfDictionary[i][type]);
            if (this.tableOfDictionary[i][type] == value) {
                try {
                    if (toExcludeClosedWindow == false && this.tableOfDictionary[i]["xid"] == ""){
                        continue;
                    }
                    } catch(error) { log(error) };
                
                logif(this.debug, "getIndexFromReverse() => return " + i); //this.getIndexFrom("xid", this.tableOfDictionary[i]["xid"], toExcludeClosedWindow));
                return i; //this.getIndexFrom("xid", this.tableOfDictionary[i]["xid"], toExcludeClosedWindow);
            }
        }
        logif(this.debug, "getIndexFromReverse() => return -1");
        return -1;
    }


    printDictionnary(){
        log("printDictionnary()");

        for (let i=0 ; i < this.tableOfDictionary.length ; i++) {
            log("  o " +
                this.tableOfDictionary[i]["xid"] + ", " +
                this.tableOfDictionary[i]["class"] + ", " +
                this.tableOfDictionary[i]["title"]
            );
        }
    }


}


    ////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
class FileUserOrder {
    constructor(userOrder) {
        this.debug=false;
        logif(this.debug, "FileUserOrder()");

        this.separator = ";;"
        this.userOrder = userOrder;
    }


    appendString(textData) {
        logif(this.debug, "appendString()");
        try {
            let file = Gio.file_new_for_path(USER_ORDER_PATH);
            let out = file.append_to (Gio.FileCreateFlags.NONE, null);
            out.write (textData, null);
            out.write ("\n", null);
            out.close(null);
        } catch(error) { global.logError(error) };
    }


    readToString() {
        logif(this.debug, "readToString() : " + USER_ORDER_PATH);
        let textData="";
        try {
            textData = Cinnamon.get_file_contents_utf8_sync(USER_ORDER_PATH);//.split("\n")
        }catch(error) { global.logError(error) };
        logif(this.debug, textData);
        logif(this.debug, "readToString() END");
        return textData;
    }


    readToTable(separator=this.separator) {
        logif(this.debug, "readToTable()");
        let table = this.readToString().split(separator);
        //let table = [];

        /*for (let i=0 ; i < textData.length ; i++) {
            global.log(i)
            if (textData[i].length != 0) {
                table.push(textData[i].split(separator));
            }
        }*/
        logif(this.debug, "readToTable(size=" + table.length + ") END");
        return table;//table;
    }


    readToTableOfDictionary() {
        logif(this.debug, "readToTableOfDictionary()");
        let windowTable = this.readToTable("\n");
        let listData = [];
        let localDictionary=[]; //Init again
        //log(1);
        //log("readToTableOfDictionary");
        for (let i=0 ; i < windowTable.length ; i++) {
            //global.log(i)
            //log(i);
            if (windowTable[i].length != 0) {
                let dict={};
                listData=windowTable[i].split(this.separator);
                dict["xid"]    = listData[0];
                //dict["after"]       = listData[1];
                //dict["position"]    = listData[2];
                dict["class"]       = listData[1];
                dict["title"]        = listData[2];
                
                localDictionary.push(dict);
            }
        }
        logif(localDictionary.length + " items in localDictionary");
        logif(this.debug, "readToTableOfDictionary() END()");
        return localDictionary;
    }


    writeTableOfDictionary(tableOfDictionary = this.userOrder.tableOfDictionary) {
        logif(this.debug, "writeDictionary()");
        let textData="";

        for (let iLine=0 ; iLine < tableOfDictionary.length ; iLine++) {
            textData += 
                tableOfDictionary[iLine]["xid"]    + this.separator
                /*+ tableOfDictionary[iLine]["after"]     + this.separator
                + tableOfDictionary[iLine]["position"]  + this.separator*/
                + tableOfDictionary[iLine]["class"]     + this.separator
                + tableOfDictionary[iLine]["title"] + "\n";
        }

        this.writeString(textData)
    }


    writeTable(table) {
        logif(this.debug, "writeTable()");
        let textData="";

        for (let iLine=0 ; iLine < table.length ; iLine++) {
            textData += table[iLine].join(this.separator) + "\n";
        }

        this.writeString(textData)
    }


    writeString(textData, path = USER_ORDER_PATH) {
        logif(this.debug, "writeString()");
        try {
            let file = Gio.file_new_for_path(path);
            let raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
            let out = Gio.BufferedOutputStream.new_sized (raw, 4096);
            Cinnamon.write_string_to_stream(out, textData);
            out.close(null);
        } catch(error) { global.logError(error) };
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
class WindowPreview extends Tooltips.TooltipBase {
    constructor(item, metaWindow, previewScale, showLabel) {
        super(item.actor);
        this._applet = item._applet;
        this.metaWindow = metaWindow;
        this._windowActor = null;
        this.uiScale = global.ui_scale;
        this.thumbScale = previewScale;

        this._sizeChangedId = 0;
        this.thumbnail = null;

        this.actor = new St.BoxLayout({ vertical: true, style_class: "window-list-preview", important: true });
        this.actor.show_on_set_parent = false;
        Main.uiGroup.add_actor(this.actor);

        this.label = new St.Label();
        this.labelBin = new St.Bin({ y_align: St.Align.MIDDLE });
        this.labelBin.set_width(WINDOW_PREVIEW_WIDTH * this.thumbScale * this.uiScale);
        this.labelBin.add_actor(this.label);
        this.actor.add_actor(this.labelBin);

        if (!showLabel) {
            this.labelBin.hide();
        }

        this.thumbnailBin = new St.Bin();
        this.actor.add_actor(this.thumbnailBin);
    }

    get windowActor() {
        if (this._windowActor) {
            return this._windowActor;
        }

        this._windowActor = this.metaWindow.get_compositor_private();

        if (this._windowActor) {
            return this._windowActor;
        } else {
            log("metaWindow has no actor!");
            return null;
        }
    }

    _onEnterEvent(actor, event) {
        if (this._applet._tooltipShowing)
            this.show();
        else if (!this._showTimer)
            this._showTimer = Mainloop.timeout_add(300, Lang.bind(this, this._onShowTimerComplete));

        this.mousePosition = event.get_coords();
    }

    _getScaledTextureSize(windowTexture) {
        let [width, height] = windowTexture.get_size();
        let scale = this.thumbScale * this.uiScale *
                    Math.min(WINDOW_PREVIEW_WIDTH / width, WINDOW_PREVIEW_HEIGHT / height);
        return [ width * scale,
                 height * scale ];
    }

    _hide(actor, event) {
        super._hide.call(this, actor, event);
        this._applet.erodeTooltip();
    }

    show() {
        if (!this.actor || this._applet._menuOpen)
            return;

        if (this.thumbnail) {
            this.thumbnailBin.set_child(null);
            this.thumbnail.destroy();
            this.thumbnail = null;
        }

        let windowTexture = this.windowActor.get_texture();

        if (!windowTexture) {
            this.actor.hide();
            return;
        }

        let [width, height] = this._getScaledTextureSize(this.windowActor);

        this.thumbnail = WindowUtils.getCloneOrContent(this.windowActor, width, height);

        this._sizeChangedId = this.windowActor.connect('notify::size', () => {
            if (this.thumbnail === null) {
                return;
            }

            let [width, height] = this._getScaledTextureSize(this.windowActor);
            this.thumbnail.set_size(width, height);
            this._set_position();
        });

        this.thumbnailBin.set_child(this.thumbnail);

        this.actor.show();
        this._set_position();

        this.visible = true;
        this._applet.cancelErodeTooltip();
        this._applet._tooltipShowing = true;
    }

    hide() {
        if (this._sizeChangedId > 0) {
            this.windowActor.disconnect(this._sizeChangedId);
            this._sizeChangedId = 0;
        }
        if (this.thumbnail) {
            this.thumbnailBin.set_child(null);
            this.thumbnail.destroy();
            this.thumbnail = null;
        }
        if (this.actor) {
            this.actor.hide();
        }
        this.visible = false;
    }

    _set_position() {
        if (!this.actor || this.actor.is_finalized()) return;
        let allocation = this.actor.get_allocation_box();
        let previewHeight = allocation.y2 - allocation.y1;
        let previewWidth = allocation.x2 - allocation.x1;

        let monitor = Main.layoutManager.findMonitorForActor(this.item);

        let previewTop;
        if (this._applet.orientation === St.Side.BOTTOM) {
            previewTop = this.item.get_transformed_position()[1] - previewHeight - 5;
        } else if (this._applet.orientation === St.Side.TOP) {
            previewTop = this.item.get_transformed_position()[1] + this.item.get_transformed_size()[1] + 5;
        } else {
            previewTop = this.item.get_transformed_position()[1];
        }

        let previewLeft;
        if (this._applet.orientation === St.Side.BOTTOM || this._applet.orientation === St.Side.TOP) {
            // centre the applet on the window list item if window list is on the top or bottom panel
            previewLeft = this.item.get_transformed_position()[0] + this.item.get_transformed_size()[0]/2 - previewWidth/2;
        } else if (this._applet.orientation === St.Side.LEFT) {
            previewLeft = this.item.get_transformed_position()[0] + this.item.get_transformed_size()[0] + 5;
        } else {
            previewLeft = this.item.get_transformed_position()[0] - previewWidth - 5;
        }

        previewLeft = Math.round(previewLeft);
        previewLeft = Math.max(previewLeft, monitor.x);
        previewLeft = Math.min(previewLeft, monitor.x + monitor.width - previewWidth);

        previewTop  = Math.round(previewTop);
        previewTop  = Math.min(previewTop, monitor.y + monitor.height - previewHeight);

        this.actor.set_position(previewLeft, previewTop);
    }

    set_text(text) {
        this.label.set_text(text);
    }

    _destroy() {
        if (this._sizeChangedId > 0) {
            this._windowActor.disconnect(this._sizeChangedId);
            this.sizeChangedId = 0;
        }
        if (this.thumbnail) {
            this.thumbnailBin.set_child(null);
            this.thumbnail.destroy();
            this.thumbnail = null;
        }
        if (this.actor) {
            Main.uiGroup.remove_actor(this.actor);
            this.actor.destroy();
            this.actor = null;
        }
    }
}

class AppMenuButton {
    constructor(applet, metaWindow, transient) {
        this.actor = new Cinnamon.GenericContainer({
            name: 'appMenu',
            style_class: 'window-list-item-box',
            reactive: true,
            can_focus: true,
            track_hover: true });

        this._applet = applet;
        this.metaWindow = metaWindow;
        this.transient = transient;

        let initially_urgent = transient || metaWindow.demands_attention || metaWindow.urgent;
        this.drawLabel = false;
        this.labelVisiblePref = false;
        this._signals = new SignalManager.SignalManager();
        this.xid = global.screen.get_xwindow_for_window(metaWindow);
        this._flashTimer = null;

        if (this._applet.orientation == St.Side.TOP)
            this.actor.add_style_class_name('top');
        else if (this._applet.orientation == St.Side.BOTTOM)
            this.actor.add_style_class_name('bottom');
        else if (this._applet.orientation == St.Side.LEFT)
            this.actor.add_style_class_name('left');
        else if (this._applet.orientation == St.Side.RIGHT)
            this.actor.add_style_class_name('right');

        this.actor._delegate = this;
        this._signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onButtonRelease));
        this._signals.connect(this.actor, 'button-press-event', Lang.bind(this, this._onButtonPress));

        this._signals.connect(this.actor, 'get-preferred-width',
                Lang.bind(this, this._getPreferredWidth));
        this._signals.connect(this.actor, 'get-preferred-height',
                Lang.bind(this, this._getPreferredHeight));

        this._signals.connect(this.actor, 'notify::allocation',
                              Lang.bind(this, this.updateIconGeometry));
        this._updateIconGeometryTimeoutId = 0;

        this._signals.connect(this.actor, 'allocate', Lang.bind(this, this._allocate));

        this.progressOverlay = new St.Widget({ style_class: "progress", reactive: false, important: true  });

        this.actor.add_actor(this.progressOverlay);

        this._iconBox = new Cinnamon.Slicer({ name: 'appMenuIcon' });
        this.actor.add_actor(this._iconBox);

        this._label = new St.Label();
        this.actor.add_actor(this._label);

        this.updateLabelVisible();

        this._visible = true;

        this._progress = 0;

        if (this.metaWindow.progress !== undefined) {
            this._progress = this.metaWindow.progress;
            if (this._progress > 0) {
                this.progressOverlay.show();
            } else
                this.progressOverlay.hide();
            this._updateProgressId = this._signals.connect(this.metaWindow, "notify::progress", () => {
                if (this.metaWindow.progress != this._progress) {
                    this._progress = this.metaWindow.progress;

                    if (this._progress >0) {
                        this.progressOverlay.show();
                    } else {
                        this.progressOverlay.hide();
                    }

                    this.actor.queue_relayout();
                }
            });
        } else {
            this.progressOverlay.hide();
        }

        /* TODO: this._progressPulse = this.metaWindow.progress_pulse; */

        this.onPreviewChanged();

        if (!this.transient) {
            this._menuManager = new PopupMenu.PopupMenuManager(this);
            this.rightClickMenu = new AppMenuButtonRightClickMenu(this, this.metaWindow, this._applet.orientation);
            this._menuManager.addMenu(this.rightClickMenu);

            this._draggable = DND.makeDraggable(this.actor, null, this._applet.actor);
            this._signals.connect(this._draggable, 'drag-begin', Lang.bind(this, this._onDragBegin));
            this._signals.connect(this._draggable, 'drag-cancelled', Lang.bind(this, this._onDragCancelled));
            this._signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));
        }

        this.onPanelEditModeChanged();
        this._signals.connect(global.settings, 'changed::panel-edit-mode', Lang.bind(this, this.onPanelEditModeChanged));

        this._windows = this._applet._windows;

        this.scrollConnector = null;
        this.onScrollModeChanged();
        this._needsAttention = false;

        this.setDisplayTitle();
        this.onFocus();
        this.setIcon();

        if (initially_urgent)
            this.getAttention();

        this._signals.connect(this.metaWindow, 'notify::title', this.setDisplayTitle, this);
        this._signals.connect(this.metaWindow, "notify::minimized", this.setDisplayTitle, this);
        this._signals.connect(this.metaWindow, "notify::tile-type", this.setDisplayTitle, this);
        this._signals.connect(this.metaWindow, "notify::icon", this.setIcon, this);
        this._signals.connect(this.metaWindow, "notify::appears-focused", this.onFocus, this);
        this._signals.connect(this.metaWindow, "unmanaged", this.onUnmanaged, this);
    }

    onUnmanaged() {
        this.destroy();
        this._windows.splice(this._windows.indexOf(this), 1);
    }

    onPreviewChanged() {
        if (this._tooltip)
            this._tooltip.destroy();

        if (this._applet.usePreview)
            this._tooltip = new WindowPreview(this, this.metaWindow, this._applet.previewScale, this._applet.showLabel);
        else
            this._tooltip = new Tooltips.PanelItemTooltip(this, "", this._applet.orientation);

        this.setDisplayTitle();
    }

    onPanelEditModeChanged() {
        let editMode = global.settings.get_boolean("panel-edit-mode");
        if (this._draggable)
            this._draggable.inhibit = editMode;
        this.actor.reactive = !editMode;
    }

    onScrollModeChanged() {
        if (this._applet.scrollable) {
            this.scrollConnector = this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
        } else {
            if (this.scrollConnector) {
                this.actor.disconnect(this.scrollConnector);
                this.scrollConnector = null;
            }
        }
    }

    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        // Find the current focused window
        let windows = this.actor.get_parent().get_children()
        .filter(function(item) {
            return item.visible;
        }).map(function(item) {
            return item._delegate;
        });

        windows = windows.reverse();

        let i = windows.length;
        while (i-- && !windows[i].metaWindow.has_focus());

        if (i == -1)
            return;

        //                   v   home-made xor
        if ((direction == 0) != this._applet.reverseScroll)
            i++;
        else
            i--;

        if (i == windows.length)
            i = 0;
        else if (i == -1)
            i = windows.length - 1;

        Main.activateWindow(windows[i].metaWindow, global.get_current_time());
    }

    _onDragBegin() {
        if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM) {
            this._draggable._overrideY = this.actor.get_transformed_position()[1];
            this._draggable._overrideX = null;
        } else {
            this._draggable._overrideX = this.actor.get_transformed_position()[0];
            this._draggable._overrideY = null;
        }

        this._tooltip.hide();
        this._tooltip.preventShow = true;
    }

    _onDragEnd() {
        this.actor.show();
        this._applet.clearDragPlaceholder();
        this._tooltip.preventShow = false;
    }

    _onDragCancelled() {
        this.actor.show();
        this._applet.clearDragPlaceholder();
        this._tooltip.preventShow = false;
    }

    getDragActor() {
        let clone    = new Clutter.Clone({ source: this.actor });
        clone.width  = this.actor.width;
        clone.height = this.actor.height;
        return clone;
    }

    getDragActorSource() {
        return this.actor;
    }

    handleDragOver(source, actor, x, y, time) {
        if (this._draggable && this._draggable.inhibit) {
            return DND.DragMotionResult.CONTINUE;
        }

        if (source instanceof AppMenuButton)
            return DND.DragMotionResult.CONTINUE;

        /* Users can drag things from one window to another window (eg drag an
         * image from Firefox to LibreOffice). However, if the target window is
         * hidden, they will drag to the AppWindowButton of the target window,
         * and we will open the window for them. */
        this._toggleWindow(true);
        return DND.DragMotionResult.NO_DROP;
    }

    acceptDrop(source, actor, x, y, time) {
        return false;
    }

    setDisplayTitle() {
        let title   = this.metaWindow.get_title();
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(this.metaWindow);

        if (!title) title = app ? app.get_name() : '?';

        /* Sanitize the window title to prevent dodgy window titles such as
         * "); DROP TABLE windows; --. Turn all whitespaces into " " because
         * newline characters are known to cause trouble. Also truncate the
         * title when necessary or else cogl might get unhappy and crash
         * Cinnamon. */
        title = title.replace(/\s/g, " ");
        if (title.length > MAX_TEXT_LENGTH)
            title = title.substr(0, MAX_TEXT_LENGTH);

        if (this._tooltip  && this._tooltip.set_text)
            this._tooltip.set_text(title);

        if (this.metaWindow.minimized) {
            title = "["+ title +"]";
        } else if (this.metaWindow.tile_mode != Meta.TileMode.NONE && this.metaWindow.tile_mode != Meta.TileMode.MAXIMIZED) {
            title = "|"+ title;
        }

        this._label.set_text(title);
    }

    destroy() {
        if (this._flashTimer) {
            Mainloop.source_remove(this._flashTimer);
            this._flashTimer = null;
        }
        if (this._updateIconGeometryTimeoutId > 0) {
            Mainloop.source_remove(this._updateIconGeometryTimeoutId);
            this._updateIconGeometryTimeoutId = 0;
        }

        this._signals.disconnectAllSignals();
        this._tooltip.destroy();
        if (!this.transient) {
            this.rightClickMenu.destroy();
            this._menuManager.destroy();
        }
        this.actor.destroy();
    }

    _hasFocus() {
        if (this.metaWindow.minimized)
            return false;

        if (this.metaWindow.has_focus())
            return true;

        let transientHasFocus = false;
        this.metaWindow.foreach_transient(function(transient) {
            if (transient.has_focus()) {
                transientHasFocus = true;
                return false;
            }
            return true;
        });
        return transientHasFocus;
    }

    onFocus() {
        if (this._hasFocus()) {
            this.actor.add_style_pseudo_class('focus');
            this.actor.remove_style_class_name("window-list-item-demands-attention");
            this.actor.remove_style_class_name("window-list-item-demands-attention-top");
            this._needsAttention = false;

            if (this.transient) {
                this.destroy();
                this._windows.splice(this._windows.indexOf(this), 1);
            }
        } else {
            this.actor.remove_style_pseudo_class('focus');
        }
    }


    _onButtonRelease(actor, event) {
        this._tooltip.hide();
        if (this.transient) {
            if (event.get_button() == 1)
                this._toggleWindow(false);
            return false;
        }

        if (event.get_button() == 1) {
            if (this.rightClickMenu.isOpen)
                this.rightClickMenu.toggle();

            this._toggleWindow(false);
        } else if (event.get_button() == 2 && this._applet.middleClickClose) {
            this.metaWindow.delete(global.get_current_time());
        }
        return true;
    }

    _onButtonPress(actor, event) {
        this._tooltip.hide();
        if (!this.transient && event.get_button() == 3) {
            this.rightClickMenu.mouseEvent = event;
            this.rightClickMenu.toggle();

            if (this._hasFocus()) {
                this.actor.add_style_pseudo_class('focus');
            }
        }
    }

    _toggleWindow(fromDrag){
        if (!this._hasFocus()) {
            Main.activateWindow(this.metaWindow, global.get_current_time());
            this.actor.add_style_pseudo_class('focus');
        } else if (!fromDrag && this._applet.leftClickMinimize) {
            this.metaWindow.minimize();
            this.actor.remove_style_pseudo_class('focus');
        }
    }

    updateIconGeometry() {
        if (this._updateIconGeometryTimeoutId > 0) {
            Mainloop.source_remove(this._updateIconGeometryTimeoutId);
        }

        this._updateIconGeometryTimeoutId = Mainloop.timeout_add(50, Lang.bind(this, this._updateIconGeometryTimeout));
    }

    _updateIconGeometryTimeout() {
        this._updateIconGeometryTimeoutId = 0;

        let rect = new Meta.Rectangle();
        [rect.x, rect.y] = this.actor.get_transformed_position();
        [rect.width, rect.height] = this.actor.get_transformed_size();

        this.metaWindow.set_icon_geometry(rect);

        return GLib.SOURCE_REMOVE;
    }

    _getPreferredWidth(actor, forHeight, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_width(forHeight);

        alloc.min_size = 1 * global.ui_scale;

        if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM ) {
        // the 'buttons use entire space' option only makes sense on horizontal panels with labels
            if (this.labelVisiblePref) {
                if (this._applet.buttonsUseEntireSpace) {
                    let [lminSize, lnaturalSize] = this._label.get_preferred_width(forHeight);
                    let spacing = this.actor.get_theme_node().get_length('spacing');
                    alloc.natural_size = Math.max(150 * global.ui_scale,
                            naturalSize + spacing + lnaturalSize);
                } else {
                    alloc.natural_size = this._applet.buttonWidth * global.ui_scale;
                }
            } else {
                alloc.natural_size = naturalSize
            }
        } else {
            alloc.natural_size = this._applet._panelHeight;
        }
    }

    _getPreferredHeight(actor, forWidth, alloc) {
        let [minSize1, naturalSize1] = this._iconBox.get_preferred_height(forWidth);

        if (this.labelVisiblePref) {
            let [minSize2, naturalSize2] = this._label.get_preferred_height(forWidth);
            alloc.min_size = Math.max(minSize1, minSize2);
        } else {
            alloc.min_size = minSize1;
        }

        if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM ) {
            /* putting a container around the actor for layout management reasons affects the allocation,
               causing the visible border to pull in close around the contents which is not the desired
               (pre-existing) behaviour, so need to push the visible border back towards the panel edge.
               Assigning the natural size to the full panel height used to cause recursion errors but seems fine now.
               If this happens to avoid this you can subtract 1 or 2 pixels, but this will give an unreactive
               strip at the edge of the screen */
            alloc.natural_size = this._applet._panelHeight;
        } else {
            alloc.natural_size = naturalSize1;
        }
    }

    _allocate(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;

        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._iconBox.get_preferred_size();

        let direction = this.actor.get_text_direction();
        let spacing = Math.floor(this.actor.get_theme_node().get_length('spacing'));
        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);

        childBox.y1 = box.y1 + yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);

        if (allocWidth < naturalWidth) {
            this.labelVisible = false;
        } else {
            this.labelVisible = this.labelVisiblePref;
        }

        if (this.drawLabel) {
            if (direction === Clutter.TextDirection.LTR) {
                childBox.x1 = box.x1;
            } else {
                childBox.x1 = Math.max(box.x1, box.x2 - naturalWidth);
            }
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, box.x2);
        } else {
            childBox.x1 = box.x1 + Math.floor(Math.max(0, allocWidth - naturalWidth) / 2);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, box.x2);
        }
        this._iconBox.allocate(childBox, flags);

        if (this.drawLabel) {
            [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();

            yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
            childBox.y1 = box.y1 + yPadding;
            childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
            if (direction === Clutter.TextDirection.LTR) {
                // Reuse the values from the previous allocation
                childBox.x1 = Math.min(childBox.x2 + spacing, box.x2);
                childBox.x2 = box.x2;
            } else {
                childBox.x2 = Math.max(childBox.x1 - spacing, box.x1);
                childBox.x1 = box.x1;
            }

            this._label.allocate(childBox, flags);
        }

        if (!this.progressOverlay.visible) {
            return;
        }

        childBox.x1 = 0;
        childBox.y1 = 0;
        childBox.x2 = this.actor.width;
        childBox.y2 = this.actor.height;

        this.progressOverlay.allocate(childBox, flags);

        let clip_width = Math.max((this.actor.width) * (this._progress / 100.0), 1.0);
        this.progressOverlay.set_clip(0, 0, clip_width, this.actor.height);
    }

    updateLabelVisible() {
        if (this._applet.showLabelPanel) {
            this._label.show();
            this.labelVisiblePref = true;
            this.drawLabel = true;
        } else {
            this._label.hide();
            this.labelVisiblePref = false;
            this.drawLabel = false;
        }
    }

    setIcon() {
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(this.metaWindow);

        this.icon_size = this._applet.icon_size;

        let icon = app ?
            app.create_icon_texture_for_window(this.icon_size, this.metaWindow) :
            new St.Icon({ icon_name: 'application-default-icon',
                icon_type: St.IconType.FULLCOLOR,
                icon_size: this.icon_size });

        let old_child = this._iconBox.get_child();
        this._iconBox.set_child(icon);

        if (old_child)
            old_child.destroy();
    }

    getAttention() {
        if (this._needsAttention)
            return false;

        this._needsAttention = true;
        this._flashButton();
        return true;
    }

    _flashButton() {
        if (!this._needsAttention || this._flashTimer)
            return;

        let counter = 0;
        const sc = "window-list-item-demands-attention";

        this._flashTimer = Mainloop.timeout_add(FLASH_INTERVAL, () => {
            if (!this._needsAttention) {
                this._flashTimer = null;
                return false;
            }

            if (this.actor.has_style_class_name(sc))
                this.actor.remove_style_class_name(sc);
            else
                this.actor.add_style_class_name(sc);

            const continueFlashing = (counter++ < FLASH_MAX_COUNT);
            if (!continueFlashing) {
                this._flashTimer = null;
            }
            return continueFlashing;
        });
    }
};

class AppMenuButtonRightClickMenu extends Applet.AppletPopupMenu {
    constructor(launcher, metaWindow, orientation) {
        super(launcher, orientation);

        this._launcher = launcher;
        this._windows = launcher._applet._windows;
        this._signals.connect(this, 'open-state-changed', Lang.bind(this, this._onToggled));

        this.orientation = orientation;
        this.metaWindow = metaWindow;
        
    }


    _renameWindow(mw) {
        //let read = Cinnamon.get_file_contents_utf8_sync("/tmp/aaa.txt");
        //Main._logWarning("info");
        Main.notify("_renameWindow", "read");
        //log("metaWindow has no actor!");
        Main._logWarning("info");
        fileAppend("");
        fileAppend("mw.title=" + mw.title);
        fileAppend("mw.wm_class=" + mw.wm_class);
        fileAppend("mw.get_wm_class_instance()=" + mw.get_wm_class_instance());
        
        fileAppend("mw.gtk_application_id=" + mw.gtk_application_id);
        fileAppend("mw.gtk_application_object_path=" + mw.gtk_application_object_path);
        fileAppend("mw.gtk_application_object_pathget_pid()=" + mw.get_pid());
        //fileAppend(string(mw.get_transient_for_as_xid()));
        fileAppend("mw.get_startup_id()=" + mw.get_startup_id());
        //fileAppend("xid=" + actors._delagate.xid);
        //fileAppend("xid=" + this._windows.actors._delagate.xid);
        
        for (let window of this._windows)
                if (window.actor.visible &&
                    window.metaWindow == this.metaWindow &&
                   !window._needsAttention) {
                        fileAppend(window.metaWindow.title);
                        fileAppend("" + window.xid);
                   }
                    
        
        //Main.notify("_populateMenu", "read");
        
        //alert("aueiuia");
    };


    _populateMenu() {
        let mw = this.metaWindow;
        let item;
        let length;
        let window=this._windows;
        let applet = this._launcher._applet;
        
        
        // GET THE XID (I am sure there is a better way but I am learning coding applet...)
        for (window of this._windows)
            if (window.actor.visible &&
                window.metaWindow == this.metaWindow &&
               !window._needsAttention) {
                   //fileAppend("window.xid=" + window.xid);
                   break
               }

        // SHOW INFO
        //item = new PopupMenu.PopupMenuItem(_("Window information"), "dialog-question", St.IconType.SYMBOLIC);
        item = new PopupMenu.PopupMenuItem(_("Window information"));
        this._signals.connect(item, 'activate', function() {
               try {
                applet._onShowInfo(window);
             } catch(error) { global.log(error) };
            });
        this.addMenuItem(item);
        //this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    
        //fileAppend(window.xid)
        // MANAGE THE ORDER
        /*if (this._launcher._applet.isUserOrderDefined(window.xid)) {
            item = new PopupMenu.PopupMenuItem(_("Unfreeze user order"));
            this._signals.connect(item, 'activate', function() {
                   try {
                    applet.onRemoveUserOrder(window.xid);
                 } catch(error) { global.log(error) };
                });
        } else {
            item = new PopupMenu.PopupMenuItem(_("Memorize user order"));
            this._signals.connect(item, 'activate', function() {
                try {
                    applet.resetUserOrderFile();
                } catch(error) { global.log(error) };
            });
        }*/
        

        this.addMenuItem(item);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


        // Move to monitor
        if ((length = Main.layoutManager.monitors.length) == 2) {
            Main.layoutManager.monitors.forEach(function (monitor, index) {
                if (index === mw.get_monitor()) return;
                item = new PopupMenu.PopupMenuItem(_("Move to the other monitor"));
                this._signals.connect(item, 'activate', function() {
                    mw.move_to_monitor(index);
                });
                this.addMenuItem(item);
            }, this);
        }
        else if ((length = Main.layoutManager.monitors.length) > 2) {
            Main.layoutManager.monitors.forEach(function (monitor, index) {
                if (index === mw.get_monitor()) return;
                item = new PopupMenu.PopupMenuItem(_("Move to monitor %d").format(index + 1));
                this._signals.connect(item, 'activate', function() {
                    mw.move_to_monitor(index);
                });
                this.addMenuItem(item);
            }, this);
        }

        // Move to workspace
        if ((length = global.workspace_manager.n_workspaces) > 1) {
            if (mw.is_on_all_workspaces()) {
                item = new PopupMenu.PopupMenuItem(_("Only on this workspace"));
                this._signals.connect(item, 'activate', function() {
                    mw.unstick();
                });
                this.addMenuItem(item);
            } else {
                item = new PopupMenu.PopupMenuItem(_("Visible on all workspaces"));
                this._signals.connect(item, 'activate', function() {
                    mw.stick();
                });
                this.addMenuItem(item);

                item = new PopupMenu.PopupSubMenuMenuItem(_("Move to another workspace"));
                this.addMenuItem(item);

                let curr_index = mw.get_workspace().index();
                for (let i = 0; i < length; i++) {
                    // Make the index a local variable to pass to function
                    let j = i;
                    let name = Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i);
                    let ws = new PopupMenu.PopupMenuItem(name);

                    if (i == curr_index)
                        ws.setSensitive(false);

                    this._signals.connect(ws, 'activate', function() {
                        mw.change_workspace(global.workspace_manager.get_workspace_by_index(j));
                    });
                    item.menu.addMenuItem(ws);
                }

            }
        }

        // Preferences
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(_("Preferences"));
        this.addMenuItem(subMenu);

        item = new PopupMenu.PopupIconMenuItem(_("About..."), "dialog-question", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this._launcher._applet, this._launcher._applet.openAbout));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Configure..."), "system-run", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this._launcher._applet, this._launcher._applet.configureApplet));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Remove 'Window list'"), "edit-delete", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', (actor, event) => this._launcher._applet.confirmRemoveApplet(event));
        subMenu.menu.addMenuItem(item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Close all/others
        item = new PopupMenu.PopupIconMenuItem(_("Close all"), "application-exit", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, function() {
            for (let window of this._windows)
                if (window.actor.visible &&
                   !window._needsAttention)
                    window.metaWindow.delete(global.get_current_time());
        }));
        this.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Close others"), "window-close", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, function() {
            for (let window of this._windows)
                if (window.actor.visible &&
                    window.metaWindow != this.metaWindow &&
                   !window._needsAttention)
                    window.metaWindow.delete(global.get_current_time());
        }));
        this.addMenuItem(item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Miscellaneous
        if (mw.get_compositor_private().opacity != 255) {
            item = new PopupMenu.PopupMenuItem(_("Restore to full opacity"));
            this._signals.connect(item, 'activate', function() {
                mw.get_compositor_private().set_opacity(255);
            });
            this.addMenuItem(item);
        }

        if (mw.minimized) {
            item = new PopupMenu.PopupIconMenuItem(_("Restore"), "view-sort-descending", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', function() {
                Main.activateWindow(mw, global.get_current_time());
            });
        } else {
            item = new PopupMenu.PopupIconMenuItem(_("Minimize"), "view-sort-ascending", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', function() {
                mw.minimize();
            });
        }
        this.addMenuItem(item);

        if (mw.get_maximized()) {
            item = new PopupMenu.PopupIconMenuItem(_("Unmaximize"), "view-restore", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', function() {
                mw.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
            });
        } else {
            item = new PopupMenu.PopupIconMenuItem(_("Maximize"), "view-fullscreen", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', function() {
                mw.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
            });
        }
        this.addMenuItem(item);
        item.setSensitive(mw.can_maximize())

        item = new PopupMenu.PopupIconMenuItem(_("Close"), "edit-delete", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', function() {
            mw.delete(global.get_current_time());
        });
        this.addMenuItem(item);
    }

    _onToggled(actor, isOpening){
        if (this.isOpen)
            this._launcher._applet._menuOpen = true;
        else
            this._launcher._applet._menuOpen = false;
    }

    toggle() {
        if (!this.isOpen) {
            this.removeAll();
            this._populateMenu();
        }

        Applet.AppletPopupMenu.prototype.toggle.call(this);
    }
}

class CinnamonWindowListApplet extends Applet.Applet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.signals = new SignalManager.SignalManager(null);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.set_track_hover(false);
        this.actor.set_style_class_name("window-list-box");
        this.orientation = orientation;
        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR);
        this.appletEnabled = false;
        //
        // A layout manager is used to cater for vertical panels as well as horizontal
        //
        let manager;
        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            manager = new Clutter.BoxLayout( { orientation: Clutter.Orientation.HORIZONTAL });
        } else {
            manager = new Clutter.BoxLayout( { orientation: Clutter.Orientation.VERTICAL });
            this.actor.add_style_class_name("vertical");
        }

        this.manager = manager;
        this.manager_container = new Clutter.Actor( { layout_manager: manager } );
        this.userOrder= new UserOrder(this);//should be after this.manager_container
        this.actor.add_actor (this.manager_container);

        this.dragInProgress = false;
        this._tooltipShowing = false;
        this._tooltipErodeTimer = null;
        this._menuOpen = false;
        this._urgentSignal = null;
        this._windows = [];
        this._monitorWatchList = [];

        this.settings = new Settings.AppletSettings(this, "window-list@sangorys", this.instance_id);

        this.settings.bind("show-all-workspaces", "showAllWorkspaces");
        this.settings.bind("enable-alerts", "enableAlerts", this._updateAttentionGrabber);
        this.settings.bind("enable-scrolling", "scrollable", this._onEnableScrollChanged);
        this.settings.bind("reverse-scrolling", "reverseScroll");
        this.settings.bind("left-click-minimize", "leftClickMinimize");
        this.settings.bind("middle-click-close", "middleClickClose");
        this.settings.bind("button-width", "buttonWidth", this._refreshAllItems);
        this.settings.bind("buttons-use-entire-space", "buttonsUseEntireSpace", this._refreshAllItems);
        this.settings.bind("panel-show-label", "showLabelPanel", this._updateLabels);
        this.settings.bind("window-preview", "usePreview", this._onPreviewChanged);
        this.settings.bind("window-preview-show-label", "showLabel", this._onPreviewChanged);
        this.settings.bind("window-preview-scale", "previewScale", this._onPreviewChanged);
        this.settings.bind("last-window-order", "lastWindowOrder", null);

        this.signals.connect(global.display, 'window-created', this._onWindowAddedAsync, this);
        this.signals.connect(global.screen, 'window-monitor-changed', this._onWindowMonitorChanged, this);
        this.signals.connect(global.screen, 'window-workspace-changed', this._onWindowWorkspaceChanged, this);
        this.signals.connect(global.screen, 'window-skip-taskbar-changed', this._onWindowSkipTaskbarChanged, this);
        this.signals.connect(Main.panelManager, 'monitors-changed', this._updateWatchedMonitors, this);
        this.signals.connect(global.window_manager, 'switch-workspace', this._refreshAllItems, this);
        this.signals.connect(Cinnamon.WindowTracker.get_default(), "window-app-changed", this._onWindowAppChanged, this);

        this.signals.connect(this.actor, 'style-changed', Lang.bind(this, this._updateSpacing));

        global.settings.bind("panel-edit-mode", this.actor, "reactive", Gio.SettingsBindFlags.DEFAULT);

        this.on_orientation_changed(orientation);
        this._updateAttentionGrabber();
    }


    _getActorIndex(xid) {
        let localDebug=false;
        logif(localDebug, "_getActorIndex(" + xid + ")");
        let actors = this.manager_container.get_children();

        logif(localDebug, actors.length + " actors");
        for (let k = 0; k < actors.length; k++ ) {
            try {
                logif(localDebug, "actors["+k+"]._delegate.xid = " + actors[k]._delegate.xid + " / " + typeof(actors[k]._delegate.xid));
                logif(localDebug, "xid=" + xid + " / " + typeof(xid));
                if (String(actors[k]._delegate.xid) == xid) {
                    logif(localDebug, "_getActorIndex() return " + k);// + String(k));
                    return k;
                }
            } catch(error) { log("ERROR : " + error); };
            logif(localDebug, "next k");
        }
        logif(localDebug, "_getActorIndex(). Not found. Return -1"); //the last item " + String(actors.length-1));
        return -1;
    }

    on_applet_added_to_panel(userEnabled) {
        this._updateSpacing();
        this.appletEnabled = true;
    }

    on_applet_removed_from_panel() {
        this.signals.disconnectAllSignals();
        this.settings.finalize();
    }

    on_applet_instances_changed() {
        this._updateWatchedMonitors();
    }

    on_panel_height_changed() {
        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR);
        this._refreshAllItems();
    }

    on_panel_icon_size_changed(size) {
        this.icon_size = size;
        this._refreshAllItems();
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;

        for (let window of this._windows)
            window.updateLabelVisible();

        if (orientation == St.Side.TOP || orientation == St.Side.BOTTOM) {
            this.manager.set_vertical(false);
            this._reTitleItems();
            this.actor.remove_style_class_name("vertical");
        } else {
            this.manager.set_vertical(true);
            this.actor.add_style_class_name("vertical");
            this.actor.set_x_align(Clutter.ActorAlign.CENTER);
            this.actor.set_important(true);
        }

        // Any padding/margin is removed on one side so that the AppMenuButton
        // boxes butt up against the edge of the screen

        if (orientation == St.Side.TOP) {
            for (let child of this.manager_container.get_children()) {
                child.set_style_class_name('window-list-item-box top');
                child.set_style('margin-top: 0px; padding-top: 0px;');
            }
            this.actor.set_style('margin-top: 0px; padding-top: 0px;');
        } else if (orientation == St.Side.BOTTOM) {
            for (let child of this.manager_container.get_children()) {
                child.set_style_class_name('window-list-item-box bottom');
                child.set_style('margin-bottom: 0px; padding-bottom: 0px;');
            }
            this.actor.set_style('margin-bottom: 0px; padding-bottom: 0px;');
        } else if (orientation == St.Side.LEFT) {
            for (let child of this.manager_container.get_children()) {
                child.set_style_class_name('window-list-item-box left');
                child.set_style('margin-left 0px; padding-left: 0px; padding-right: 0px; margin-right: 0px;');
                child.set_x_align(Clutter.ActorAlign.CENTER);
            }
            this.actor.set_style('margin-left: 0px; padding-left: 0px; padding-right: 0px; margin-right: 0px;');
        } else if (orientation == St.Side.RIGHT) {
            for (let child of this.manager_container.get_children()) {
                child.set_style_class_name('window-list-item-box right');
                child.set_style('margin-left: 0px; padding-left: 0px; padding-right: 0px; margin-right: 0px;');
                child.set_x_align(Clutter.ActorAlign.CENTER);
            }
            this.actor.set_style('margin-right: 0px; padding-right: 0px; padding-left: 0px; margin-left: 0px;');
        }

        if (this.appletEnabled) {
            this._updateSpacing();
        }

        this._updateAllIconGeometry()
    }

    _onShowInfo(window) {
        //Main.notify(mw.wm_class + ". " +  mw.gtk_application_id + ". " + mw.title);
        log("_onShowInfo()");
        //log(window.metaWindow.wm_class);
        let index=this.userOrder.getIndexFrom("xid", window.xid);
        log("getIndexFrom=" + index);
        log(this.userOrder.tableOfDictionary[index]["class"]);
        //let xid
        notify(
             "class     = " + window.metaWindow.wm_class,
            + "title    = " + window.metaWindow.title  + "\n"
            + "xid      = " + window.xid + "\n"
            + "Position (file) = " + this.userOrder.getIndexFrom("xid", window.xid) + "\n"
            + "Position (task bar) = " + this._getActorIndex(window.xid) + "\n");

    };


    _updateSpacing() {
        let themeNode = this.actor.get_theme_node();
        let spacing = themeNode.get_length('spacing');
        this.manager.set_spacing(spacing * global.ui_scale);
    }

    _onWindowAddedAsync(screen, metaWindow, monitor) {
        Mainloop.timeout_add(20, Lang.bind(this, this._onWindowAdded, screen, metaWindow, monitor));
    }

    _onWindowAdded(screen, metaWindow, monitor) {
        if (this._shouldAdd(metaWindow))
            this._addWindow(metaWindow, false);
    }

    _onWindowMonitorChanged(screen, metaWindow, monitor) {
        if (this._shouldAdd(metaWindow))
            this._addWindow(metaWindow, false);
        else
            this._removeWindow(metaWindow);
    }

    _refreshItemByMetaWindow(metaWindow) {
        let window = this._windows.find(win => (win.metaWindow == metaWindow));

        if (window)
            this._refreshItem(window);
    }

    _onWindowWorkspaceChanged(screen, metaWindow, metaWorkspace) {
        this._refreshItemByMetaWindow(metaWindow);
    }

    _onWindowAppChanged(tracker, metaWindow) {
        this._refreshItemByMetaWindow(metaWindow);
    }

    _onWindowSkipTaskbarChanged(screen, metaWindow) {
        if (metaWindow && metaWindow.is_skip_taskbar()) {
            this._removeWindow(metaWindow);
            return;
        }

        this._onWindowAdded(screen, metaWindow, 0);
    }

    _updateAttentionGrabber() {
        if (this.enableAlerts) {
            this.signals.connect(global.display, "window-marked-urgent", this._onWindowDemandsAttention, this);
            this.signals.connect(global.display, "window-demands-attention", this._onWindowDemandsAttention, this);
        } else {
            this.signals.disconnect("window-marked-urgent");
            this.signals.disconnect("window-demands-attention");
        }
    }

    _onEnableScrollChanged() {
        for (let window of this._windows)
            window.onScrollModeChanged();
    }

    _onPreviewChanged() {
        for (let window of this._windows)
            window.onPreviewChanged();
    }

    _onWindowDemandsAttention (display, window) {
        // Magic to look for AppMenuButton owning window
        let i = this._windows.length;
        while (i-- && this._windows[i].metaWindow != window);

        // Window is not in our list
        if (i == -1)
            return;

        // Asks AppMenuButton to flash. Returns false if already flashing
        if (!this._windows[i].getAttention())
            return;

        if (window.get_workspace() != global.workspace_manager.get_active_workspace())
            this._addWindow(window, true);
    }

    /**
     * 
     * @param {*} xid 
     * @returns True if the user order is defined
     */
    isUserOrderDefined(xid) {
        //log("isUserOrderDefined");
        let userOrderData;

        if (GLib.file_test(USER_ORDER_PATH, GLib.FileTest.EXISTS)) {
            userOrderData = Cinnamon.get_file_contents_utf8_sync(USER_ORDER_PATH);
            for (let line of userOrderData.split("\n")) {
                //fileAppend("isUserOrderDefined found");
                if (line.split(";")[0] == xid) return true;
            }
        }

        //fileAppend("isUserOrderDefined not found");
        return false;
    }


    /* When memorize the position :
     *  1. The list of all previous window xid are recordered
    */

    /**
 * Solves equations of the form a * x = b
 * @example
 * // returns 2
 * globalNS.method1(5, 10);
 * @example
 * // returns 3
 * globalNS.method(5, 15);
 * @returns {Number} Returns the value of x for the equation.
 */
    resetUserOrderFile() {
        let localDebug = false;
        let isError=true;
        logif(localDebug, "resetUserOrderFile");
        //userOrder.fileUserOrder.writeTableOfDictionary();
        //return;
        // Add in the end of the file

        logif(localDebug, "20");
        let actors = this.manager_container.get_children();
        

        // RESET tableOfDictionary
        //log("Recreate tableOfDictionary")
        logif(localDebug, "1");
        delete this.userOrder.tableOfDictionary;
        logif(localDebug, "2");
        this.userOrder.tableOfDictionary=[];
        logif(localDebug, "3");

        // RECREATE tableOfDictionary 
        for (let j = 0; j < actors.length; j++ ) {
            log(j);
            isError=true;
            try {
                log(j + "/" + actors.length + " => " + actors[j]._delegate.metaWindow.wm_class);
                this.userOrder.add(
                    actors[j]._delegate.xid,
                    "",
                    "", 
                    actors[j]._delegate.metaWindow.wm_class, 
                    actors[j]._delegate.metaWindow.title);
                isError=false;
        } catch(error) { log(error) };

            //if (isError()) {
            //    this.userOrder.add(actors[j]._delegate.xid,"","", "", "");
            //}
        }


        // SAVE TO FILE
        this.userOrder.fileUserOrder.writeTableOfDictionary();
        //log("resetUserOrderFile OK")
        logif(localDebug, "resetUserOrderFile END")
    }


    onRemoveUserOrder(xid) {
        global.logError("onRemoveUserOrder")
        //this.userOrder.fileUserOrder.writeTableOfDictionary();
        this.resetUserOrderFile();
        return;

        //let userOrderData = fileUserOrder.readToString();
        let userOrderDataTable=fileUserOrder.readToTable();
    
        try {
            
        for (let iLine=0 ; iLine < userOrderDataTable.length ; iLine++) {
            if (userOrderDataTable[iLine][0] == xid ) {
                global.log("Remove :" + userOrderDataTable[iLine]);
                userOrderDataTable.splice(iLine, 1);
            }
        }
    
        fileUserOrder.writeTable(userOrderDataTable);
        }catch(error) { global.logError(error) };
    }


    _refreshItem(window) {
        window.actor.visible =
            (window.metaWindow.get_workspace() == global.workspace_manager.get_active_workspace()) ||
            window.metaWindow.is_on_all_workspaces() ||
            this.showAllWorkspaces;

        /* The above calculates the visibility if it were the normal
         * AppMenuButton. If this is actually a temporary AppMenuButton for
         * urgent windows on other workspaces, it is shown iff the normal
         * one isn't shown! */
        if (window.transient)
            window.actor.visible = !window.actor.visible;

        if (window.actor.visible)
            window.setIcon();

        window.updateIconGeometry();
    }

    _refreshAllItems() {
        for (let window of this._windows) {
            this._refreshItem(window);
        }
    }

    _reTitleItems() {
        for (let window of this._windows) {
            window.setDisplayTitle();
        }
    }
    
    _updateLabels() {
        for (let window of this._windows)
            window.updateLabelVisible();
    }

    _updateWatchedMonitors() {
        // this can be called after our settings are finalized (and those attributes deleted),
        // so lastWindowOrder won't exist anymore. This can happen when panels are removed, for
        // example due to monitor changes.
        if (this.lastWindowOrder === undefined) {
            return;
        }

        let n_mons = global.display.get_n_monitors();
        let on_primary = this.panel.monitorIndex == Main.layoutManager.primaryIndex;
        let instances = Main.AppletManager.getRunningInstancesForUuid(this._uuid);

        /* Simple cases */
        if (n_mons == 1) {
            this._monitorWatchList = [Main.layoutManager.primaryIndex];
        } else if (instances.length > 1 && !on_primary) {
            this._monitorWatchList = [this.panel.monitorIndex];
        } else {
            /* This is an instance on the primary monitor - it will be
             * responsible for any monitors not covered individually.  First
             * convert the instances list into a list of the monitor indices,
             * and then add the monitors not present to the monitor watch list
             * */
            this._monitorWatchList = [this.panel.monitorIndex];

            instances = instances.map(function(x) {
                return x.panel.monitorIndex;
            });

            for (let i = 0; i < n_mons; i++)
                if (instances.indexOf(i) == -1)
                    this._monitorWatchList.push(i);
        }

        // Now track the windows in our favorite monitors
        let windows = global.display.list_windows(0);
        if (this.showAllWorkspaces) {
            for (let wks=0; wks<global.workspace_manager.n_workspaces; wks++) {
                let metaWorkspace = global.workspace_manager.get_workspace_by_index(wks);
                let wks_windows = metaWorkspace.list_windows();
                for (let wks_window of wks_windows) {
                    windows.push(wks_window);
                }
            }
        }

        this.refreshing = true;

        for (let window of windows) {
            if (this._shouldAdd(window))
                this._addWindow(window, false);
            else
                this._removeWindow(window);
        }

        this.refreshing = false;

        this._applySavedOrder();
        this._updateAllIconGeometry();
    }

    _addWindow(metaWindow, transient) {
        try {
        
        let localDebug = true;

        logif(localDebug,
            "\n_addWindow (" + metaWindow.wm_class + ", " + metaWindow.get_title());

        for (let window of this._windows)
            if (window.metaWindow == metaWindow &&
                window.transient == transient)
                return;

        let appButton = new AppMenuButton(this, metaWindow, transient);
        logif(localDebug, "xid = " + appButton.xid);
        
        this.manager_container.add_actor(appButton.actor);
        this._windows.push(appButton);


        /* We want to make the AppMenuButtons look like they are ordered by
         * workspace. So if we add an AppMenuButton for a window in another
         * workspace, put it in the right position. It is at the end by
         * default, so move it to the start if needed */
        if (transient) {
            if (metaWindow.get_workspace().index() < global.workspace_manager.get_active_workspace_index())
                this.manager_container.set_child_at_index(appButton.actor, 0);
        } else {
            if (metaWindow.get_workspace() != global.workspace_manager.get_active_workspace()) {
                if (!(this.showAllWorkspaces)) {
                    appButton.actor.hide();
                }
            }
        }

        this._printActorPosition();


        // MOVE THE WINDOW TO THE GOOD PLACE
        let toMove=0;
        let realIndex = 0;

        //try {
            let index=this.userOrder.getIndexFrom("xid", appButton.xid);
            logif(localDebug,"tableOfDictionary index = " + index);


            if (index >= 0) // and (index != this._windows.index => index exists ?)
            { 

// CASE 1 : XID ALREADY EXISTS
// WE MOVE IT TO THE RIGHT PLACE (for instance if Cinnamon crashes)

                toMove=1;
                logif(localDebug,"XID already exist. To move " + this.userOrder.tableOfDictionary[index]["class"] + " to index " + index);
                //realIndex = index;

                //FIND THE POSITION OF THE PREVIOUS EXISTING WINDOW
                for (let i=index-1; i>=0 ; i--){
                    if (this.userOrder.tableOfDictionary[index]["xid"] != this.userOrder.tableOfDictionary[i]["xid"]) try{
                        logif(localDebug,"Search " + this.userOrder.tableOfDictionary[i]["class"] + " / " + this.userOrder.tableOfDictionary[i]["xid"] + " in the task bar");
                        let actorIndex = this._getActorIndex(this.userOrder.tableOfDictionary[i]["xid"]);
                        if (actorIndex != -1){
                            logif(localDebug,this.userOrder.tableOfDictionary[i]["class"] + " has been found in the task bar in position" + actorIndex);
                            realIndex = actorIndex + 1;
                            break;
                        }
                    } catch(error) { log(error) };
                }

            }
            else
            {
// CASE 2 : XID NOT EXIST 
//  => SEARCH IF WE FOUND THE CLASS AND TITLE

                logif(localDebug,"XID for " + metaWindow.wm_class + " not found ");
                index=this.userOrder.getLastIndexFromClassAndTitle(metaWindow.wm_class, metaWindow.get_title());
                //index=this.userOrder.getIndexFromReverse("class", metaWindow.wm_class, true);
                //index=this.userOrder.getIndexFrom("title", metaWindow.get_title());
                if (index >= 0){

// CASE 2.1 : FOUND A WINDOW MATCHING WITH CLASS AND TITLE
                    logif(localDebug,this.userOrder.tableOfDictionary[index]["class"] + " / " + this.userOrder.tableOfDictionary[index]["title"] +  " has been found");
                    //FIND THE FILE POSITION OF THE PREVIOUS EXISTING WINDOW
                    for (let i=index; i>=0 ; i--) try {
                        if (this.userOrder.tableOfDictionary[i]["xid"] != ""){
                            index = i; // maybe we need to not change index and use i only for getActoIndex ???
                            break;
                        }
                    } catch(error) { log(error) };

                    // GET THE WINDOW LIST POSITION
                    logif(localDebug,"Previous window index (in tableOfDictionary) = " + index);
                    realIndex = this._getActorIndex(this.userOrder.tableOfDictionary[index]["xid"]) + 1;
                    logif(localDebug,"Position in the task bar = " + String(realIndex));

                    // IS IT A POSITION OF AN OLD CLOSED WINDOW OR AN EXISTING WINDOW ?
                    if (this.userOrder.tableOfDictionary[index]["xid"] == ""){
                        toMove=1;
                    }else { toMove=0 ;}

                }else {
                    // INDEX=-1 => CLASS / TITLE NOT FOUND
                    logif(localDebug,metaWindow.wm_class + " / " + metaWindow.get_title() +  " not been found. Search only the class");
                    index=this.userOrder.getIndexFromReverse("class", metaWindow.wm_class, true);

                    if (index >= 0){
// CASE 2.2 : FOUND A WINDOW MATCHING WITH CLASS ONLY
                        logif(localDebug,this.userOrder.tableOfDictionary[index]["class"] +  " has been found");

                        //FIND THE FILE POSITION OF THE PREVIOUS EXISTING WINDOW
                        for (let i=index; i>=0 ; i--) try {
                            if (this.userOrder.tableOfDictionary[i]["xid"] != ""){
                                index = i; // maybe we need to not change index and use i only for getActoIndex ???
                                break;
                            }
                        } catch(error) { log(error) };

                        // GET THE WINDOW LIST POSITION
                        realIndex = this._getActorIndex(this.userOrder.tableOfDictionary[index]["xid"]) + 1;
                        logif(localDebug,"Position in the task bar = " + String(realIndex));

                        // IS IT A POSITION OF AN OLD CLOSED WINDOW OR AN EXISTING WINDOW ?
                        if (this.userOrder.tableOfDictionary[index]["xid"] == ""){
                            toMove=1;
                        }else { toMove=0 ;}

                    //log("Class " + metaWindow.wm_class + " not found. Keep it at the end");
                    } else {
// CASE : NEW WINDOW, NEVER MEMORIZE
// Nothing to do
                    logif(localDebug,this.userOrder.tableOfDictionary[index]["class"] + " / " + this.userOrder.tableOfDictionary[index]["title"] +  " is a new window, never memorized");
                    }
                }
            }




            if (index >= 0){
                logif(localDebug,"move window to " + realIndex + "(" + index + ")/" + this._windows.length + ". toMove=" + toMove);
                // MOVE TO THE RIGHT PLACE
                this.manager_container.set_child_at_index(
                    appButton.actor,
                    realIndex);

                // ADD OR MOVE THE WINDOW TO tableOfDictionary
                //this.userOrder.tableOfDictionary.splice(index,1);
                //if (toMove == 1)
                //    logif(localDebug,"move to dictionary");
                //else
                //    logif(localDebug,"add to dictionary");

                //this.userOrder.printDictionnary();
                this.userOrder.tableOfDictionary.splice(index+(1-toMove), toMove,
                    {
                        "xid":appButton.xid,
                        "after": "",
                        "position": "",
                        "class": metaWindow.wm_class,
                        "title": metaWindow.get_title()
                    });
                }else{
                    logif(localDebug,"Add at the end");
                // UPDATE THE PREVIOUS INFO
                //this.userOrder.tableOfDictionary.splice(index,1);
                this.userOrder.add(
                        appButton.xid,
                        "",
                        "",
                        metaWindow.wm_class,
                        metaWindow.get_title());
            }

            //this.userOrder.printDictionnary();
            //this.userOrder.fileUserOrder.writeTableOfDictionary(this.userOrder.tableOfDictionary);

                
        //} catch(error) { global.log(error) };
        // 3. SEARCH THE CLASS



            //log("Search " + metaWindow.wm_class + ":");
            //log( String(this.userOrder.getIndexFrom("class", metaWindow.wm_class)));
            //log("1");
            //Main.notify(String(this.userOrder.getIndexFrom("class", metaWindow.wm_class)));
            //let index=this.userOrder.getIndexFrom("class", metaWindow.wm_class);
            /*if (index > -1){ //if the class is in the user define list
                //Main.notify(metaWindow.wm_class + " found :)")
                log(metaWindow.wm_class + " found at position " + String(this.userOrder.tableOfDictionary[index]["position"] + " for row " + index));
                this.manager_container.set_child_at_index(
                    appButton.actor,
                    this.userOrder.tableOfDictionary[index]["position"]);
            }
            } catch(error) { global.log(error) };*/

        //appButton._needsAttention=true;
        //appButton._flashButton();
        //notify(1);
    
        this._saveOrder(true);
        
        this._updateAllIconGeometry();

        logif(localDebug,"_addWindow() END at position " + index + "\n");
    } catch(error) { log(error) };

    }


    _removeWindow(metaWindow) {
        let localDebug = true;
        logif(localDebug,"\n_removeWindow(" + metaWindow.wm_class + ")");

        let toSave = false;

        try {
        
            let i = this._windows.length;
        // Do an inverse loop because we might remove some elements
        while (i--) {
            if (this._windows[i].metaWindow == metaWindow) {

                // SEARCH AND CLEAN tableOfDictionary
                let index = this.userOrder.getIndexFrom("xid", this._windows[i].xid);
                logif(localDebug,"xid " + this._windows[i].xid + " found at index " + index);

                if (index >=0) {
                    let toRemoveFromTableOfDictionary = false;

                    toSave = true;
                    

                    //SEARCH AND REMOVE IF DUPLICATED CLASS TITLE
                    for (let j = 0;j<this.userOrder.tableOfDictionary.length;j++){
                        if (index != j
                        && this.userOrder.tableOfDictionary[j]["class"] == metaWindow.wm_class
                        && this.userOrder.tableOfDictionary[j]["title"] == metaWindow.get_title()){
                            if (this.userOrder.tableOfDictionary[j]["xid"] == ""){
                                // REMOVE THE ROW BECAUSE REDUNDANT
                                logif(localDebug, "Remove duplicated closed window from row : " + j);
                                this.userOrder.tableOfDictionary.splice(j,1);

                            }else{
                                // WE NEED TO REMOVE THE ROW BECAUSE AN OPENNED WINDOW HAS THE SAME CLASS/TITLE
                                toRemoveFromTableOfDictionary = true;
                            }
                        }
                    }


                    //REMOVE THE ROW OR THE XID OF THE WINDOW
                    index = this.userOrder.getIndexFrom("xid", this._windows[i].xid);
                    if (toRemoveFromTableOfDictionary){
                        //REMOVE THE ROW IF DUPLICATED
                        logif(localDebug, "Remove the entire row " + index);
                        this.userOrder.tableOfDictionary.splice(index, 1);
                    }else{
                        //REMOVE THE XID
                        logif(localDebug, "Remove only the xid at index " + index);
                        this.userOrder.tableOfDictionary[index]["xid"] = "";
                    }


                    //REMOVE CLOSED WINDOW (IF NO BUG, THIS PART IS USELESS)
                    for (let i=0 ; i < this.userOrder.tableOfDictionary.length ; i++){
                        if (this.userOrder.tableOfDictionary[i]["xid"] != ""){
                            if (this.doesXidExist(this.userOrder.tableOfDictionary[i]["xid"]) == false){
                                log("WARNING : tableOfDictionary has a non existing window id : " + this.userOrder.tableOfDictionary[i]["xid"] + ". We delete the row");
                                this.userOrder.tableOfDictionary.splice(i, 1);
                            }
                        }
                    }

                    //this.userOrder.printDictionnary();
                    this.userOrder.fileUserOrder.writeTableOfDictionary(); // we save here instead of in _saveOrder because I still don't know how to manage when Cinnamon restart
                    //this.userOrder.printDictionnary();

                }

                this._windows[i].destroy();
                this._windows.splice(i, 1);

                if (this._windows[i].actor.visible)
                    toSave = true;


                // Can we do a "break" here to spare CPU utilization ?

            }
        }
    } catch(error) { log(error) };

        if (toSave == true)
            this._saveOrder(false); //false to prevent to save to disk because when Cinnamon restart, this function is called on each opend window, then we lost the window order. Maybe there is a cleaner solution ?

        this._updateAllIconGeometry(); //Can we spare CPU load by moving this line inside the toSave block ?
        logif(localDebug,"_removeWindow(" + metaWindow.wm_class + ").END");
    }

    _shouldAdd(metaWindow) {
        return Main.isInteresting(metaWindow) &&
            !metaWindow.is_skip_taskbar() &&
            this._monitorWatchList.indexOf(metaWindow.get_monitor()) != -1;
    }

    /* Store by Windows (XIDs), a simple list
       xid::xid::xid::xid::xid
    */

    _applySavedOrder() {
        log("_applySavedOrder()");

        let order = this.lastWindowOrder.split("::");

        order.reverse();

        for (let i = 0; i < order.length; i++) {
            let xid = parseInt(order[i]);

            if (xid === NaN) {
                continue;
            }

            let found = this._windows.find(win => (win.xid == xid));

            if (found) {
                this.manager_container.set_child_at_index(found.actor, 0);
                //log("found.xid=" + found.xid + " | found.actor=" + found.actor);
            }
        }

        this._saveOrder(true);
        //log("_applySavedOrder().end\n");
   }

    _saveOrder(isOrderToSavedToFile) {
        logif(debug, "_saveOrder()");
        if (this.refreshing) {
            return;
        }

        let new_order = [];
        let actors = this.manager_container.get_children();

        for (let i = 0; i < actors.length; i++) {
            new_order.push(actors[i]._delegate.xid);
        }

        if (isOrderToSavedToFile) {
            try {
                //Do we have to move writeTableOfDictionary() here ???
            } catch(error) { global.log(error) };
            
            this.userOrder.fileUserOrder.writeTableOfDictionary();
        }
    }

    _printActorPosition() {
        log("_printActorPosition()");
        let actors = this.manager_container.get_children();

        log(actors.length + " actors");
        for (let k = 0; k < actors.length; k++ ) try {
            log("  o " + actors[k]._delegate.xid + " - " + actors[k]._delegate.metaWindow.wm_class);
        } catch(error) { log(error) };
        //log("_printActorPosition().END");
    }

    _updateAllIconGeometry() {
        for (let window of this._windows) {
            window.updateIconGeometry();
        }
    }

    handleDragOver(source, actor, x, y, time) {
        if (this._inEditMode)
            return DND.DragMotionResult.MOVE_DROP;
        if (!(source instanceof AppMenuButton))
            return DND.DragMotionResult.NO_DROP;

        let children = this.manager_container.get_children();
        let isVertical = (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
        let axis = isVertical ? [y, 'y1'] : [x, 'x1'];

        this._dragPlaceholderPos = -1;
        let minDist = -1;
        for(let i = 0; i < children.length; i++) {
            if (!children[i].visible)
                continue;
            let dim = isVertical ? children[i].height : children[i].width;
            let dist = Math.abs(axis[0] - (children[i].get_allocation_box()[axis[1]] + dim / 2));
            if(dist < minDist || minDist == -1) {
                minDist = dist;
                this._dragPlaceholderPos = i;
            }
        }

        source.actor.hide();
        if (this._dragPlaceholder == undefined) {
            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width (source.actor.width);
            this._dragPlaceholder.child.set_height (source.actor.height);

            this.manager_container.insert_child_at_index(this._dragPlaceholder.actor,
                                                         this._dragPlaceholderPos);
        } else {
            this.manager_container.set_child_at_index(this._dragPlaceholder.actor,
                                                         this._dragPlaceholderPos);
        }

        return DND.DragMotionResult.MOVE_DROP;
    }

    acceptDrop(source, actor, x, y, time) {
        if (!(source instanceof AppMenuButton)) return false;
        if (this._dragPlaceholderPos == undefined) return false;

        let oldPos = this._getActorIndex(actor.xid);
        this.manager_container.set_child_at_index(source.actor, this._dragPlaceholderPos);

        let oldIndex = this.userOrder.getIndexFrom("xid", actor.xid);
        // How to find the new position in the file ???

        log("acceptDrop() run _saveOrder()")
        this._saveOrder(true);
        log("_saveOrder().end from acceptDrop")

        // Waiting for this solution, we reset the file (we loose the position of the removed window )

        this._updateAllIconGeometry();

        this.resetUserOrderFile(); // We reset everything until we found a new way of moving items in tableOfDictionnary

        return true;
    }

    clearDragPlaceholder() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.actor.destroy();
            this._dragPlaceholder = undefined;
            this._dragPlaceholderPos = undefined;
        }
    }

    doesXidExist(xid){
        let localDebug=false;
        logif(localDebug, "doesXidExist(" + xid + ")");
        let actors = this.manager_container.get_children();
        //return true;

        logif(localDebug, actors.length + " actors");
        for (let k = 0; k < actors.length; k++ ) {
            try {
                //logif(localDebug, "actors["+k+"]._delegate.xid = " + actors[k]._delegate.xid + " / " + typeof(actors[k]._delegate.xid));
                //logif(localDebug, "xid=" + xid + " / " + typeof(xid));
                if (String(actors[k]._delegate.xid) == xid) {
                    logif(localDebug, "doesXidExist() return yes");
                    return true;
                }
            } catch(error) { log("ERROR : " + error); };
            //logif(localDebug, "next k");
        }
        logif(localDebug, "doesXidExist(). Not found. Return false"); //the last item " + String(actors.length-1));
        return false;
    }


    erodeTooltip() {
        if (this._tooltipErodeTimer) {
            Mainloop.source_remove(this._tooltipErodeTimer);
            this._tooltipErodeTimer = null;
        }

        this._tooltipErodeTimer = Mainloop.timeout_add(300, Lang.bind(this, function() {
            this._tooltipShowing = false;
            this._tooltipErodeTimer = null;
            return false;
        }));
    }

    cancelErodeTooltip() {
        if (this._tooltipErodeTimer) {
            Mainloop.source_remove(this._tooltipErodeTimer);
            this._tooltipErodeTimer = null;
        }
    }
}


function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonWindowListApplet(orientation, panel_height, instance_id);
}
