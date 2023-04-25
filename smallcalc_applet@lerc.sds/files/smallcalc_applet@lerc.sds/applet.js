const uuid = "smallcalc_applet@lerc.sds";

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Layout = imports.ui.layout;
const modalDialog = imports.ui.modalDialog;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Lang = imports.lang;
const Signals = imports.signals;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    return Gettext.dgettext(uuid, str);
}

const MathJS = imports.ui.appletManager.applets[uuid].math.math;
MathJS.import({ "Pi": Math.PI });

function main(metadata, orientation, panel_height, applet_id) {
    let applet = makeApplet(orientation, panel_height, applet_id);
    return applet;
}


function makeApplet(orientation, panel_height, applet_id) {
    var applet = new Applet.IconApplet(orientation, panel_height, applet_id);
    applet.set_applet_icon_symbolic_name("accessories-calculator");
    applet.set_applet_tooltip(_("Show calculator"));
    var layoutBox;
    let history = ['top of history', ""];
    history.index = 1;
    var invButton, binButton, octButton, decButton, hexButton;
    let baseButtons = [];
    let untouched_result = true;
    let last_result = " ";

    var base = 10;

    var settings = new Settings.AppletSettings(applet, uuid, applet.instance_id);
    settings.bindProperty(Settings.BindingDirection.IN, "definitions", "definitions", definitionsChanged);

    let parser = MathJS.parser();
    loadDefinitions();

    var osdBox = new St.Bin({
        style_class: 'nop',
        reactive: true,
        track_hover: true,
        can_focus: true
    });

    applet.on_applet_removed_from_panel = function() {
        osdBox.destroy();
        settings.finalize();
    };

    applet.on_applet_clicked = function() {
        toggleVisible();
    };

    buildLayout();

    let drag_device;
    enableDragging();



    osdBox.set_child(layoutBox);

    Main.uiGroup.add_actor(osdBox);
    Main.layoutManager.addChrome(osdBox);

    let initialX = Math.floor((Main.uiGroup.get_width() - osdBox.get_width()) / 2);
    let initialY = Math.floor((Main.uiGroup.get_height() - osdBox.get_height()) / 2);

    osdBox.set_position(initialX, initialY);

    osdBox.hide();
    return applet;


    function toggleVisible() {
        function visible() {
            return (osdBox.get_flags() & 0x10) != 0; // is CLUTTER_ACTOR_VISIBLE imported anywhere?
        }
        if (visible()) {
            osdBox.hide();
            applet.set_applet_tooltip(_("Show calculator"));
        } else {
            osdBox.show();
            applet.set_applet_tooltip(_("Hide calculator"));
        }
    }

    function enableDragging() {
        let dragging = false;
        let dragStartPosition = [0, 0];
        let dragStartMousePosition = [0, 0];

        osdBox.connect("button-press-event", function(actor, event) {
            dragging = true;
            drag_device = event.get_device();
            drag_device.grab(osdBox);
            
            Main.pushModal(osdBox);

            dragStartMousePosition = event.get_coords();
            dragStartPosition = actor.get_position();
        });

        osdBox.connect("button-release-event", function() {
            dragging = false;
            Main.popModal(osdBox);
            drag_device.ungrab();

            layoutBox.textEntryField.grab_key_focus();
        });

        osdBox.connect("motion-event", function(actor, event) {
            if (dragging) {
                let [mouseStartX, mouseStartY] = dragStartMousePosition;
                let [stageX, stageY] = event.get_coords();
                var dx = stageX - mouseStartX;
                var dy = stageY - mouseStartY;

                let [originalX, originalY] = dragStartPosition;

                osdBox.set_position(originalX + dx, originalY + dy);
            }
        });
    }

    function buildLayout() {
        if (layoutBox) layoutBox.destroy();
        layoutBox = new St.BoxLayout({ style_class: "frame", reactive: true, track_hover: true, can_focus: true });
        let content = new St.BoxLayout({ style_class: "content", vertical: true });
        layoutBox.add_actor(content);
        //content.layout_manager = new Clutter.FlowLayout();

        let textBox = new St.Entry({ text: " ", style_class: "entryfield", track_hover: true, can_focus: true, reactive: true });
        layoutBox.textEntryField = textBox;

        content.add_actor(textBox);
        textBox.canFocus = true;
        //textBox.fixed_y=0;

        let clutterText = textBox.clutter_text;
        clutterText.set_activatable(true);
        clutterText.set_single_line_mode(true);

        clutterText.connect('activate', function() {});
        clutterText.connect('key-press-event', handleKeyPress);

        clutterText.connect('button-press-event', function(t, e) {
            global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
        });

        global.stage.set_key_focus(textBox);

        clutterText.connect('text-changed', function() {
            invButton.set_checked(false);
            if ((untouched_result === true) && (last_result != clutterText.text)) {
                untouched_result = false;
            }
        });

        function makeInsertHandler(text) {
            function eventHandler(actor, event) {
                textBox.clutter_text.insert_text(text, textBox.clutter_text.position);
            }
            return eventHandler;
        }

        function makeDigitInsertHandler(text) {
            function eventHandler(actor, event) {
                if (untouched_result === true) {
                    textBox.clutter_text.text = "";
                }
                textBox.clutter_text.insert_text(text, textBox.clutter_text.position);
            }
            return eventHandler;
        }

        function makePrefixHandler(prefix, invPrefix) {
            if (!invPrefix) invPrefix = prefix;

            function eventHandler(actor, event) {
                var p = invButton.checked ? invPrefix : prefix;
                textBox.clutter_text.text = p + "(" + textBox.clutter_text.text + ")";
            }
            return eventHandler;
        }

        const buttonInv = { label: "inv", handler: toggleInv };
        const buttonBin = { label: "bin", handler: function() { changeBase(2); } };
        const buttonOct = { label: "oct", handler: function() { changeBase(8); } };
        const buttonDec = { label: "dec", handler: function() { changeBase(10); } };
        const buttonHex = { label: "hex", handler: function() { changeBase(16); } };
        const buttonsmt = { label: " ⌄ ", handler: toggleButtonClick };
        const buttonRec = { label: "1/x", handler: makePrefixHandler("1/") };
        const buttonRoot = { label: " √ ", handler: makePrefixHandler("sqrt") };
        const buttonLog = { label: "log", handler: makePrefixHandler("log") };
        const buttonSin = { label: "sin", handler: makePrefixHandler("sin", "asin") };
        const buttonCos = { label: "cos", handler: makePrefixHandler("cos", "acos") };
        const buttonTan = { label: "tan", handler: makePrefixHandler("tan", "atan") };
        const buttonNeg = { label: "±", handler: makePrefixHandler("-") };
        const buttonAbs = { label: "abs", handler: makePrefixHandler("abs") };
        const buttonOpen = { label: "(", handler: makeInsertHandler("(") };
        const buttonClose = { label: ")", handler: makeInsertHandler(")") };
        const buttonMemStore = { label: "M ⇦", handler: makePrefixHandler("mem=") };
        const buttonMemRecall = { label: "M R", handler: makeInsertHandler(" mem ") };

        const button0 = { label: "  0  ", handler: makeDigitInsertHandler("0") };
        const button1 = { label: "  1  ", handler: makeDigitInsertHandler("1") };
        const button2 = { label: "  2  ", handler: makeDigitInsertHandler("2") };
        const button3 = { label: "  3  ", handler: makeDigitInsertHandler("3") };
        const button4 = { label: "  4  ", handler: makeDigitInsertHandler("4") };
        const button5 = { label: "  5  ", handler: makeDigitInsertHandler("5") };
        const button6 = { label: "  6  ", handler: makeDigitInsertHandler("6") };
        const button7 = { label: "  7  ", handler: makeDigitInsertHandler("7") };
        const button8 = { label: "  8  ", handler: makeDigitInsertHandler("8") };
        const button9 = { label: "  9  ", handler: makeDigitInsertHandler("9") };
        const buttonPoint = { label: "  .  ", handler: makeDigitInsertHandler(".") };
        const buttonAdd = { label: "  +  ", handler: makeInsertHandler("+") };
        const buttonSub = { label: "  -  ", handler: makeInsertHandler("-") };
        const buttonMul = { label: "  ×  ", handler: makeInsertHandler("*") };
        const buttonDiv = { label: "  ÷  ", handler: makeInsertHandler("/") };
        const buttonC = { label: "  C  ", handler: function() { textBox.clutter_text.text = " "; } };
        const buttonAC = {
            label: " AC ",
            handler: function() {
                textBox.clutter_text.text = " ";
                resetParser();
            }
        };

        const buttonPi = { label: "  𝞹  ", handler: makeInsertHandler(" Pi ") };
        const buttonEquals = { label: "  =  ", handler: evaluateDisplay };


        const buttonBlank = { label: "  ^  ", handler: makeInsertHandler("^") };

        function addToHistory(text) {
            if (text === history[history.index]) return;
            history.push(text);
            history.index = history.length - 1;

        }

        function changeBase(newBase) {
            //global.log("changing base from "+base+" to "+newBase);
            for (let b in baseButtons) {

                baseButtons[b].remove_style_class_name("lit");
            }
            var decimalExpression = decimalRepresentation(textBox.clutter_text.text, base);
            base = newBase;
            baseButtons[base].add_style_class_name("lit");
            let newText = baseRepresentation(decimalExpression, base);
            textBox.clutter_text.text = newText;
        }

        function evaluateDisplay() {
            if (textBox.clutter_text.text === "") return; //don't evaluate empty string
            //global.log("evaluating "+textBox.clutter_text.text);

            var decimalExpression = decimalRepresentation(textBox.clutter_text.text, base);
            //global.log("as decimal "+decimalExpression);
            //always evaluate in decimal.
            addToHistory(decimalExpression);
            let result = parser.eval(decimalExpression);
            let newText = "";
            if (typeof(result) === 'function') {
                newText = "function ''" + result.name + "'' set.";
            } else {
                addToHistory("" + result);
                newText = baseRepresentation("" + result, base);
            }
            last_result = newText;
            untouched_result = true;
            textBox.clutter_text.text = newText;
        }

        function toggleButtonClick(actor, event) {
            toggleVisible();

            return true;
        }

        function baseRepresentation(text, base) {
            //global.log("need to convert Decimal "+text +" to base "+base);
            var re = /(?:(?!\w).|^|\n)(-?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
            var result = text.replace(re, function(match, contents) {
                //global.log("replace match="+match+" contents="+contents);
                return match.replace(contents, Number(contents).toString(base));
            });
            //var result = text.replace(re,function(match,contents){return Number.parseFloat(contents).toString(base);} );
            //global.log("result of replace is "+result);

            if (base == 16) {
                //global.log("Test back to decimal "+result+ "as decimal is " + expressionHexToDecimal(result));
                expressionHexToDecimal(result);
            }
            if (base == 8) {
                //global.log("Test back to decimal "+result+ "as decimal is " + expressionOctalToDecimal(result));
                expressionOctalToDecimal(result);
            }
            if (base == 2) {
                //global.log("Test back to decimal "+result+ "as decimal is " + expressionBinaryToDecimal(result));

            }
            //global.log(text +" in base "+base +" is "+result);

            return result;
        }

        function decimalRepresentation(text, base) {
            //global.log("need to convert base "+base+" expression " +text +" to Decimal");
            if (base == 10) return text;
            if (base == 16) return expressionHexToDecimal(text);
            if (base == 8) return expressionOctalToDecimal(text);
            if (base == 2) return expressionBinaryToDecimal(text);
            return ("cannot convert base " + base + " to Decimal");
        }

        function expressionHexToDecimal(text) {
            var re = /(-?(?:0|[1-9a-fA-F][0-9a-fA-F]*)(?:\.[0-9a-fA-F]*)?(?:[eE][+\-]?[0-9a-fA-F]+)?)/g;
            var result = text.replace(re, function(match, contents) {
                return match.replace(contents, Number("0x" + contents).toString(10));
            });
            return result;
        }

        function expressionOctalToDecimal(text) {
            var re = /(-?(?:0|[1-7][0-7]*)(?:\.[0-7]*)?(?:[eE][+\-]?[0-7]+)?)/g;
            var result = text.replace(re, function(match, contents) {
                return match.replace(contents, parseInt("" + contents, 8).toString(10));
            });
            return result;
        }

        function expressionBinaryToDecimal(text) {
            var re = /(-?(?:0|[1][0-1]*)(?:\.[0-1]*)?(?:[eE][+\-]?[0-1]+)?)/g;
            var result = text.replace(re, function(match, contents) {
                return match.replace(contents, parseInt("" + contents, 2).toString(10));
            });
            return result;
        }

        function setDisplayText(text) {
            //global.log(text +" becomes "+ baseRepresentation(text,base));
            textBox.clutter_text.text = baseRepresentation(text, base);
        }

        function handleKeyPress(actor, event) {
            let key = event.get_key_symbol();
            let keyCode = event.get_key_unicode();
            if (key == Clutter.KP_Enter || key == Clutter.Return) {
                evaluateDisplay();
            }
            if (key == Clutter.Down) {
                if (history.index < (history.length - 1)) {
                    history.index += 1;
                    setDisplayText(history[history.index]);
                } else {
                    setDisplayText(" ");
                }
            }
            if (key == Clutter.Up) {
                if (history.index > 0) {
                    history.index -= 1;
                    setDisplayText(history[history.index]);
                }
            }

            if (untouched_result === true) {
                //global.log("keycode was "+keyCode);
                if ('0123456789.'.indexOf(keyCode) >= 0) textBox.clutter_text.text = "";
            }
        }

        const fnButtons = [
            [buttonInv, buttonBin, buttonOct, buttonDec, buttonHex, buttonsmt],
            [buttonRec, buttonRoot, buttonLog, buttonSin, buttonCos, buttonTan],
            [buttonNeg, buttonAbs, buttonOpen, buttonClose, buttonMemStore, buttonMemRecall]
        ];

        const mainButtons = [
            [button7, button8, button9, buttonC, buttonAC],
            [button4, button5, button6, buttonMul, buttonDiv],
            [button1, button2, button3, buttonAdd, buttonSub],
            [button0, buttonPoint, buttonPi, buttonEquals, buttonBlank]
        ];



        let buttonGrid = new Clutter.GridLayout();
        let buttons = new Clutter.Actor(); //St.Widget({style_class:"buttongrid"});
        buttons.margin_left = 2;
        buttons.margin_top = 2;
        buttons.height = 320;
        buttons.layout_manager = buttonGrid;
        content.add_actor(buttons);

        buttonGrid.row_homogeneous = 4;
        buttonGrid.column_homogeneous = 10;
        buttonGrid.row_spacing = 2;
        buttonGrid.column_spacing = 2;

        let fnStore = [];
        for (let j = 0; j < 3; j++) {
            let line = [];
            fnStore.push(line);
            for (let i = 0; i < 6; i++) {
                let buttonConfig = fnButtons[j][i];
                let button = new St.Button({ label: buttonConfig.label, style_class: "button fn", reactive: true });
                button.connect("button-press-event", buttonConfig.handler);
                buttonGrid.attach(button, i * 5, j * 2, 5, 2);
                line.push(button);
            }
        }
        invButton = fnStore[0][0];
        invButton.set_toggle_mode(true);


        binButton = fnStore[0][1];
        octButton = fnStore[0][2];
        decButton = fnStore[0][3];
        hexButton = fnStore[0][4];

        baseButtons[2] = binButton;
        baseButtons[8] = octButton;
        baseButtons[10] = decButton;
        baseButtons[16] = hexButton;
        changeBase(10);

        let store = [];

        for (let j = 0; j < 4; j++) {
            let line = [];
            store.push(line);
            for (let i = 0; i < 5; i++) {
                let buttonConfig = mainButtons[j][i];
                let button = new St.Button({ label: buttonConfig.label, style_class: "button" });
                button.connect("button-press-event", buttonConfig.handler);
                line.push(button);
                buttonGrid.attach(button, i * 6, 6 + (j * 3), 6, 3);
            }
        }
        store[0][3].add_style_class_name("clear");
        store[0][4].add_style_class_name("all clear");
        store[1][3].add_style_class_name("operator times");
        store[1][4].add_style_class_name("operator divide");
        store[2][3].add_style_class_name("operator plus");
        store[2][4].add_style_class_name("operator minus");
        store[3][1].add_style_class_name("decimalpoint");
        store[3][2].add_style_class_name("pi");
        store[3][3].add_style_class_name("operator equals");
        store[3][4].add_style_class_name("operator ");


        textBox.grab_key_focus();

        applet.focus = function() {
            //global.log("applet focus");
        };

    }

    function toggleInv() {

    }

    function resetParser() {
        parser = MathJS.parser();
        loadDefinitions();
    }

    function loadDefinitions() {
        let lines = applet.definitions;
        for (let line of lines.split("\n")) {
            parser.eval(line);
        }
    }

    function definitionsChanged() {
        //global.log(" defintions changed for  "+applet.instance_id);
        loadDefinitions();
    }
}
