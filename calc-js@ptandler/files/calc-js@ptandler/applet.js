const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const helpText = require("./helpText.js").helpText;

const ICON = "icon.svg";

function formatLog(...data) {
    let str = "";
    for (const d of data) {
        if (d === null) str += "<null>"
        else if (d === undefined) str += "<undefined>"
        else str += typeof d === "string" || typeof d === "number" ? d : JSON.stringify(d, null, 2)
    }
    return str;
}

function logInfo(...data) {
    global.log(formatLog(...data));
}

/*
function logWarn(...data) {
    global.logWarning(formatLog(...data));
}

function logError(...data) {
    global.logError(formatLog(...data));
}
*/

class EvalError {
    constructor(message) {
        this.message = message;
    }

    toString() {
        return this.message;
    }
}

/** avoid `eval()`
 *
 * @param input
 */
function evalExpression(input) {
    try {
        // todo to speed up a wee bit: clone the Math object and add these functions to the clone
        const helper_functions =
            "var toHex = (num) => '0x' + Number(num).toString(16);" +
            "var toOct = (num) => '0' + Number(num).toString(8);" +
            "var toBin = (num) => '0b' + Number(num).toString(2);" +
            "var fromHex = (str) => parseInt(String(str).replace(/^0x/i, ''), 16);" +
            "var fromOct = (str) => parseInt(String(str).replace(/^0/, ''), 8);" +
            "var fromBin = (str) => parseInt(String(str).replace(/^0b/i, ''), 2);" +
            "var degToRad = (degrees) => degrees * (Math.PI / 180);" +
            "var radToDeg = (rad) => rad / (Math.PI / 180);"
        const result = Function(helper_functions + "with (Math) return " + input)();
        if (result === undefined) return new EvalError("undefined");
        if (result === null) return new EvalError("null");
        return JSON.stringify(result);
    } catch (e) {
        return new EvalError("error: " + e.message);
    }
}

/**
 * https://stackoverflow.com/a/17886301/1480587
 * @param stringToGoIntoTheRegex
 * @returns {string} with escaped characters
 */
function escapeRegExp(stringToGoIntoTheRegex) {
    return stringToGoIntoTheRegex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

class MiniCalc extends Applet.IconApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        logInfo("MiniCalc.constructor");
        super(orientation, panel_height, instance_id);
        this.metadata = metadata;

        // private properties

        this.history = [];
        // this.historyExpanded = false;
        this.currentResult = "";

        this.opt = {
            keyToggle: 'Calculator::<Primary><Alt><Super>c',
            recentHistoryMaxLength: 2,
            historyMaxDisplayLength: 6,
            historyMaxStoreLength: 16,
            convertLocaleNumberSeparators: true,
            // replaceInputWithConvertedNumbers: false,
        }

        this.initializeNumberFormat()

        // applet setup

        this.set_applet_icon_symbolic_path('');
        // logInfo("MiniCalc.constructor icon path: ", this.metadata.path + "/" + ICON);
        this.set_applet_icon_symbolic_path(this.metadata.path + "/" + ICON);
        // this.set_applet_label("");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // setup settings
        this.settings = new Settings.AppletSettings(this.opt, metadata.uuid, instance_id);
        this.setupSettings();

        this.buildLayout();
    }

    initializeNumberFormat() {
        // see e.g. https://stackoverflow.com/a/51411310/1480587 and https://stackoverflow.com/a/62694190/1480587
        const numberParts = Intl.NumberFormat().formatToParts(1234.5);
        // e.g. [{"type":"integer","value":"1"},{"type":"group","value":"."},{"type":"integer","value":"234"},{"type":"decimal","value":","},{"type":"fraction","value":"5"}]
        // this.numberGroupSeparator = numberParts.find(part => part.type === 'group').value;
        this.numberDecimalSeparator = numberParts.find(part => part.type === 'decimal').value;

        // helpers for `updateResult()` in case `this.opt.convertLocaleNumberSeparators` is set
        // build reg exps to search for group separators (should be removed) ...
        // this.numberGroupRegExp = new RegExp(`\\d${escapeRegExp(this.numberGroupSeparator)}\\d`);
        /// ... and then for decimal separators (which should be replaced by ".")
        this.numberDecimalRegExp = new RegExp(`(\\d+)${escapeRegExp(this.numberDecimalSeparator)}(\\d+)`, "g");
    }

    buildLayout() {
        logInfo("MiniCalc.buildLayout")
        // main container for the desklet
        this.widgets = {}

        this.widgets.headerItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.menu.addMenuItem(this.widgets.headerItem);
        this.widgets.headerItem.addActor(new St.Label({text: "Mini-Calc", style_class: "header"}), {
            span: 0, expand: false
        });
        this.widgets.headerItem.addActor(new St.Label({
            text: this.metadata.version, style_class: "header-smaller"
        }), {span: 0, expand: false});
        this.widgets.helpDialogButton = new St.Button({label: "  ?  ", style_class: "help-button"});
        this.widgets.helpDialogButton.connect("clicked", (/*widget, event*/) => {
            this.showHelpDialog();
        });
        this.widgets.headerItem.addActor(this.widgets.helpDialogButton, {span: -1, expand: false, align: St.Align.END});

        this.widgets.expressionItem = new PopupMenu.PopupBaseMenuItem({reactive: false, focusOnHover: true});
        this.menu.addMenuItem(this.widgets.expressionItem);
        this.widgets.expressionBox = new St.BoxLayout({
            style_class: "expression-box", vertical: true
        })
        this.widgets.expressionItem.addActor(this.widgets.expressionBox, {
            expand: true, span: -1,
        });
        this.buildExpression();
        this.updateExpression("1 + 2")

        this.widgets.recentHistoryBox = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.widgets.recentHistoryBox);

        this.widgets.historySubMenu = new PopupMenu.PopupSubMenuMenuItem("History");
        this.menu.addMenuItem(this.widgets.historySubMenu);

        this.buildHistory();
    }

    buildExpression() {
        this.widgets.input = new St.Entry({style_class: "current input"});
        this.widgets.input.connect('key-release-event', (widget, event) => {
            const input = widget.get_text();
            this.handleKeyPress(event, input);
            return true; // event has been handled
        });
        this.widgets.expressionBox.add_actor(this.widgets.input);

        this.widgets.result = new St.Label({style_class: "current result"});
        this.widgets.resultButton = new St.Button({});
        this.widgets.resultButton.set_child(this.widgets.result);
        this.widgets.resultButton.connect("clicked", (/*widget, event*/) => {
            this.appendExpression(this.currentResult);
            return true; // event has been handled
        });
        this.widgets.expressionBox.add_actor(this.widgets.resultButton);
    }

    buildHistory() {
        // logInfo("MiniCalc.buildHistory: ", this.history);

        // cleanup old elements before (re-)building
        this.widgets.recentHistoryBox.removeAll();
        this.widgets.historySubMenu.menu.removeAll();

        const histList = [...this.history]
        // logInfo("MiniCalc.buildHistory: length = ", histList.length);

        for (let i = 0; i < this.opt.recentHistoryMaxLength; i++) {
            const item = histList.shift();
            if (!item) break;
            // logInfo("MiniCalc.buildHistory: recent item = ", item);
            this.addHistoryItemUI(item, this.widgets.recentHistoryBox, i);
        }

        // logInfo("MiniCalc.buildHistory: remaining length = ", histList.length);

        if (!histList.length) {
            this.widgets.historySubMenu.setSensitive(false);
            return;
        }

        // logInfo("MiniCalc.buildHistory: remaining length = ", histList.length);

        for (let i = 0; i < this.opt.historyMaxDisplayLength; i++) {
            const item = histList.shift();
            if (!item) break;
            // logInfo("MiniCalc.buildHistory: item = ", item);
            this.addHistoryItemUI(item, this.widgets.historySubMenu.menu, i)
        }
        this.widgets.historySubMenu.setSensitive(true);
    }

    addHistoryItemUI(item, menu, index) {
        // if it's not the first item, add a separator
        if (index) {
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem({style_class: "history-separator"}));
        }

        this.addMenuItemWithCallback(menu, item.input, "history input", (/*widget, event*/) => {
            this.appendExpression(item.input);
            return true; // event has been handled
        });

        this.addMenuItemWithCallback(menu, "= " + item.result, "history result", (/*widget, event*/) => {
            this.appendExpression(item.result);
            return true; // event has been handled
        });
    }

    addMenuItemWithCallback(menu, text, style_class, callback) {
        const menuItem = new PopupMenu.PopupMenuItem(text, {style_class, focusOnHover: false});
        menuItem.connect('activate', callback);
        menu.addMenuItem(menuItem);
    }

    pushToHistory(input, result) {
        if (!input) return;
        if (result instanceof EvalError) return;
        // logInfo("MiniCalc: pushToHistory: " + input + " -> " + result);
        const item = {input, result};

        // push new entry to history
        this.history.unshift(item);

        // truncate history length if required
        if (this.history.length > this.opt.historyMaxStoreLength) {
            this.history = this.history.slice(0, this.opt.historyMaxStoreLength);
        }

        // rebuild history UI
        this.buildHistory();
    }

    clearHistory() {
        this.history = [];
        this.buildHistory();
    }

    toggleHistoryExpanded() {
        this.widgets.historySubMenu.menu.toggle();
        // this.buildHistory()
    }


    toggleCalcUI() {
        this.menu.toggle();
        // set keyboard focus to input field to be able to immediately start typing
        this.widgets.input.grab_key_focus();
    }

    showHelpDialog() {
        new ModalDialog.NotifyDialog(helpText).open();
    }


    // applet events

    on_applet_added_to_panel() {
        logInfo("MiniCalc: added to panel");
    }

    on_applet_clicked(/*event*/) {
        this.toggleCalcUI();
    }

    on_applet_removed_from_panel() {
        logInfo("MiniCalc: removed from panel");
        // this.settings.finalize();
        Main.keybindingManager.removeHotKey("keyToggle");
    }

    // settings & key binding

    setupSettings() {
        this.settings.bind("keyToggle", "keyToggle", () => this.onKeyChanged());
        this.settings.bind("recentHistoryMaxLength", "recentHistoryMaxLength", () => this.buildHistory());
        this.settings.bind("historyMaxDisplayLength", "historyMaxDisplayLength", () => this.buildHistory());

        // and initially setup keys
        this.onKeyChanged();
    }

    onKeyChanged() {
        // Main.keybindingManager.addHotKey("must-be-unique-id", this.keybinding, Lang.bind(this, this.on_hotkey_triggered));
        logInfo("toggle key changed to '", this.opt.keyToggle + "' - ", typeof this.opt.keyToggle);

        Main.keybindingManager.addHotKey("keyToggle", this.opt.keyToggle, (/*event*/) => {
            // logInfo("toggle key pressed '", this.opt.keyToggle + "' - ", typeof this.opt.keyToggle);
            this.toggleCalcUI();
        });
    }


    // calculator functions

    handleKeyPress(event, input) {
        const result = this.updateResult(input);
        const keySymbol = event.get_key_symbol();
        // logInfo("keySymbol = ", keySymbol, " control = ", event.has_control_modifier());
        switch (keySymbol) {
            case Clutter.KEY_KP_Enter:
            case Clutter.KEY_Return:
            case Clutter.KP_Enter:
                this.pushToHistory(input, result);
                this.updateExpression(result);
                break;
            case Clutter.KEY_Delete:
            case Clutter.KEY_KP_Delete:
                if (event.has_control_modifier() && event.has_shift_modifier()) {
                    this.clearHistory();
                }
                break;
            case Clutter.KEY_H:
            case Clutter.KEY_h:
                if (event.has_control_modifier()) {
                    this.toggleHistoryExpanded();
                }
                break;
            case Clutter.KEY_question:
                if (event.has_control_modifier()) {
                    this.showHelpDialog();
                }
                break;
            case Clutter.KEY_F1:
                this.showHelpDialog();
                break;
        }
    }

    updateExpression(newInput) {
        this.widgets.input.set_text(newInput);
        this.updateResult(newInput);
        this.widgets.input.grab_key_focus();
    }

    appendExpression(newInput) {
        if (!newInput) return;
        const input = this.widgets.input.get_text();
        this.updateExpression(input + (input ? " " : "") + newInput);
    }

    updateResult(input) {
        if (input && this.opt.convertLocaleNumberSeparators) {
            // if the input contains numbers in the current locale's format, convert them to JS before evaluating
            // remove group separators ... TODO: but only if this is really a group separator and not e.g. the JS decimal separator - how to detect??

            // replace decimal separator in all numbers
            input = input.replace(this.numberDecimalRegExp, "$1.$2")

        }
        const result = evalExpression(input);
        // logInfo("MiniCalc: updateResult: " + input + " -> " + result);
        if (result instanceof EvalError && result.toString().startsWith("error: expected expression, got '}'")) {
            // this.widgets.result.set_text("...");
        } else {
            this.currentResult = result instanceof EvalError ? "" : result;
            this.widgets.result.set_text(input
                ? ((result instanceof EvalError ? " ? " : " = ") + result)
                : ""
            );
        }
        return result;
    }
}

// noinspection JSUnusedLocalSymbols
function main(metadata, orientation, panel_height, instance_id) {
    return new MiniCalc(metadata, orientation, panel_height, instance_id);
}
