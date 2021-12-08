const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

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

function logWarn(...data) {
    global.logWarning(formatLog(...data));
}

function logError(...data) {
    global.logError(formatLog(...data));
}

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
        const helper_functions =
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

class MiniCalc extends Applet.TextIconApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        logInfo("MiniCalc.constructor");
        super(orientation, panel_height, instance_id);
        this.metadata = metadata;

        // private properties

        this.history = [];
        this.historyExpanded = false;
        this.currentResult = "";

        // applet setup

        this.set_applet_icon_symbolic_path('');
        logInfo("MiniCalc.constructor icon path: ", this.metadata.path + "/" + ICON);
        this.set_applet_icon_symbolic_path(this.metadata.path + "/" + ICON);
        this.set_applet_label("");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // todo register keyboard shortcut #### and make it configurable!

        this.buildLayout();
    }

    buildLayout() {
        logInfo("MiniCalc.buildLayout")
        // main container for the desklet
        this.widgets = {}

        this.widgets.headerItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.menu.addMenuItem(this.widgets.headerItem);
        this.widgets.headerItem.addActor(new St.Label({text: "Mini-Calc _ V" + this.metadata.version}));

        // this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.widgets.expressionItem = new PopupMenu.PopupBaseMenuItem({reactive: false, focusOnHover: true});
        this.menu.addMenuItem(this.widgets.expressionItem);
        this.widgets.expressionBox = new St.BoxLayout({
            style_class: "expression-box",
            vertical: true,
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true
        })
        this.widgets.expressionItem.addActor(this.widgets.expressionBox);
        this.buildExpression();
        this.updateExpression("1 + 2")

        this.widgets.historyItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.menu.addMenuItem(this.widgets.historyItem);
        this.widgets.historyBox = new St.BoxLayout({
            vertical: true,
            style_class: "history-box"
        })
        this.widgets.historyItem.addActor(this.widgets.historyBox);
        this.buildHistory();
    }

    buildExpression() {
        this.widgets.input = new St.Entry();
        this.widgets.input.connect('key-release-event', (widget, event) => {
            const input = widget.get_text();
            this.handleKeyPress(event, input);
            return true; // event has been handled
        });
        this.widgets.expressionBox.add_actor(this.widgets.input);

        this.widgets.result = new St.Label();
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

        this.widgets.historyBox.remove_all_children();
        if (!this.history) return;

        const histList = [...this.history]
        logInfo("MiniCalc.buildHistory: length = ", histList.length);

        const first = histList.shift();
        if (!first) return;
        // logInfo("MiniCalc.buildHistory: first = ", first);
        this.addHistoryItemUI(first, this.widgets.historyBox);

        // logInfo("MiniCalc.buildHistory: remaining length = ", histList.length);

        if (!histList.length) return;

        // logInfo("MiniCalc.buildHistory: remaining length = ", histList.length);

        const button = new St.Button({style_class: "collapse-expand-button"});
        this.widgets.historyBox.add_actor(button)
        button.connect("clicked", (/*widget, event*/) => {
            this.toggleHistoryExpanded()
            return true; // event has been handled
        });

        if (!this.historyExpanded) {
            // button.set_child(new St.Icon({icon_name: "go-up"}))
            button.set_child(new St.Label({text: "expand history", style_class: "calc-displayText-primary"}))
            return
        }
        // button.set_child(new St.Icon({icon_name: "go-down"}))
        button.set_child(new St.Label({text: "hide history", style_class: "calc-displayText-primary"}))

        let count = 0;
        for (const item of histList) {
            if (count++ > 10) break;
            this.addHistoryItemUI(item, this.widgets.historyBox)
        }
    }

    addHistoryItemUI(item, historyBox) {
        const inputButton = new St.Button({
            label: item.input
        });
        inputButton.connect('clicked', (/*widget, event*/) => {
            this.appendExpression(item.input);
            return true; // event has been handled
        });
        historyBox.add_actor(inputButton);

        const resultButton = new St.Button({
            label: "= " + item.result
        });
        resultButton.connect('clicked', (/*widget, event*/) => {
            this.appendExpression(item.result);
            return true; // event has been handled
        });
        historyBox.add_actor(resultButton);
    }

    pushToHistory(input, result) {
        if (!input) return;
        if (result instanceof EvalError) return;
        logInfo("MiniCalc: pushToHistory: " + input + " -> " + result);
        const item = {input, result};
        this.history.unshift(item);
        this.buildHistory();
    }

    toggleHistoryExpanded() {
        this.historyExpanded = !this.historyExpanded
        this.buildHistory()
    }


    on_applet_added_to_panel() {
        logInfo("MiniCalc: added to panel");
    }


    on_applet_clicked(/*event*/) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        logInfo("MiniCalc: removed from panel");
        // this.settings.finalize();
        // Main.keybindingManager.removeHotKey("keyToggle");
    }


    handleKeyPress(event, input) {
        const result = this.updateResult(input);
        const keySymbol = event.get_key_symbol();
        if (keySymbol === Clutter.Return || keySymbol === Clutter.KP_Enter) {
            this.pushToHistory(input, result);
            this.updateExpression(result);
        }
    }

    updateExpression(newInput) {
        this.widgets.input.set_text(newInput);
        this.updateResult(newInput);
    }

    appendExpression(newInput) {
        if (!newInput) return;
        const input = this.widgets.input.get_text();
        this.updateExpression(input + (input ? " " : "") + newInput);
    }

    updateResult(input) {
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

function main(metadata, orientation, panel_height, instance_id) {
    return new MiniCalc(metadata, orientation, panel_height, instance_id);
}
