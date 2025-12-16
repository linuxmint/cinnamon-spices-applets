const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Tooltips = imports.ui.tooltips;
const Ascii = [
    ["€", "Euro sign currency"],
    ["‚", "Single low-9 quotation mark"],
    ["ƒ", "Latin small letter f with hook"],
    ["„", "Double low-9 quotation mark"],
    ["…", "Horizontal ellipsis"],
    ["†", "Dagger cross"],
    ["‡", "Double dagger"],
    ["ˆ", "Modifier letter circumflex accent"],
    ["‰", "Per mille sign"],
    ["Š", "Latin capital letter S with caron"],
    ["‹", "Single left-pointing angle quotation"],
    ["Œ", "Latin capital ligature OE"],
    ["Ž", "accented Latin capital letter Z with carons"],
    ["‘", "Left single quotation mark"],
    ["’", "Right single quotation mark"],
    ["“", "Left double quotation mark"],
    ["”", "Right double quotation mark"],
    ["•", "Bullet point"],
    ["–", "En dash"],
    ["—", "Em dash"],
    ["˜", "accent Small tilde"],
    ["™", "Trade mark sign"],
    ["š", "Latin small letter S with caron"],
    ["›", "Single right-pointing angle quotation mark"],
    ["œ", "Latin small ligature oe"],
    ["ž", "accented Latin small letter z with caron"],
    ["Ÿ", "accented Latin capital letter Y with diaeresis"],
    ["¡", "Upside down exclamation mark"],
    ["¢", "Cent sign"],
    ["£", "Pound sign"],
    ["¤", "Currency sign"],
    ["¥", "Yen sign"],
    ["¦", "Pipe, broken vertical bar"],
    ["§", "Section sign"],
    ["¨", "accented Spacing diaeresis - umlaut"],
    ["©", "Copyright sign"],
    ["ª", "Feminine ordinal indicator"],
    ["«", "Left double angle quotes"],
    ["¬", "Negation"],
    ["®", "Registered trade mark sign"],
    ["¯", "Spacing macron - overline"],
    ["°", "Degree sign"],
    ["±", "math Plus-or-minus sign"],
    ["²", "math Superscript two - squared"],
    ["³", "math Superscript three - cubed"],
    ["´", "Acute accent - spacing acute"],
    ["µ", "Micro sign"],
    ["¶", "Pilcrow sign - paragraph sign"],
    ["·", "Middle dot - Georgian comma"],
    ["¸", "accent Spacing cedilla"],
    ["¹", "Superscript one"],
    ["º", "Masculine ordinal indicator"],
    ["»", "Right double angle quotes"],
    ["¼", "Fraction one quarter"],
    ["½", "Fraction one half"],
    ["¾", "Fraction three quarters"],
    ["¿", "Upside down question mark"],
    ["À", "accented Latin capital letter A with grave"],
    ["Á", "accented Latin capital letter A with acute"],
    ["Â", "accented Latin capital letter A with circumflex"],
    ["Ã", "accented Latin capital letter A with tilde"],
    ["Ä", "accented Latin capital letter A with diaeresis"],
    ["Å", "accented Latin capital letter A with ring above"],
    ["Æ", "accented Latin capital letter AE"],
    ["Ç", "accented Latin capital letter C with cedilla"],
    ["È", "accented Latin capital letter E with grave"],
    ["É", "accented Latin capital letter E with acute"],
    ["Ê", "accented Latin capital letter E with circumflex"],
    ["Ë", "accented Latin capital letter E with diaeresis"],
    ["Ì", "accented Latin capital letter I with grave"],
    ["Í", "accented Latin capital letter I with acute"],
    ["Î", "accented Latin capital letter I with circumflex"],
    ["Ï", "accented Latin capital letter I with diaeresis"],
    ["Ð", "accented Latin capital letter ETH"],
    ["Ñ", "accented Latin capital letter N with tilde"],
    ["Ò", "accented Latin capital letter O with grave"],
    ["Ó", "accented Latin capital letter O with acute"],
    ["Ô", "accented Latin capital letter O with circumflex"],
    ["Õ", "accented Latin capital letter O with tilde"],
    ["Ö", "accented Latin capital letter O with diaeresis"],
    ["×", "math Multiplication sign"],
    ["Ø", "accented Latin capital letter O with slash"],
    ["Ù", "accented Latin capital letter U with grave"],
    ["Ú", "accented Latin capital letter U with acuteLatin capital letter U with acute"],
    ["Û", "accented Latin capital letter U with circumflex"],
    ["Ü", "accented Latin capital letter U with diaeresis"],
    ["Ý", "accented Latin capital letter Y with acute"],
    ["Þ", "accented Latin capital letter THORN"],
    ["ß", "accented Latin small letter sharp s - ess-zed"],
    ["à", "accented Latin small letter a with grave"],
    ["á", "accented Latin small letter a with acute"],
    ["â", "accented Latin small letter a with circumflex"],
    ["ã", "accented Latin small letter a with tilde"],
    ["ä", "accented Latin small letter a with diaeresis"],
    ["å", "accented Latin small letter a with ring above"],
    ["æ", "accented Latin small letter ae"],
    ["ç", "accented Latin small letter c with cedilla"],
    ["è", "accented Latin small letter e with grave"],
    ["é", "accented Latin small letter e with acute"],
    ["ê", "accented Latin small letter e with circumflex"],
    ["ë", "accented Latin small letter e with diaeresis"],
    ["ì", "accented Latin small letter i with grave"],
    ["í", "accented Latin small letter i with acute"],
    ["î", "accented Latin small letter i with circumflex"],
    ["ï", "accented Latin small letter i with diaeresis"],
    ["ð", "accented Latin small letter eth"],
    ["ñ", "accented Latin small letter n with tilde"],
    ["ò", "accented Latin small letter o with grave"],
    ["ó", "accented Latin small letter o with acute"],
    ["ô", "accented Latin small letter o with circumflex"],
    ["õ", "accented Latin small letter o with tilde"],
    ["ö", "accented Latin small letter o with diaeresis"],
    ["÷", "math Division sign"],
    ["ø", "accented Latin small letter o with slash"],
    ["ù", "accented Latin small letter u with grave"],
    ["ú", "accented Latin small letter u with acute"],
    ["û", "accented Latin small letter u with circumflex"],
    ["ü", "accented Latin small letter u with diaeresis"],
    ["ý", "accented Latin small letter y with acute"],
    ["þ", "accented Latin small letter thorn"],
    ["ÿ", "accented Latin small letter y with diaeresis"]
]
//array that represents previously used chars
//most used chars (first 5 in the list) will be shown in the 'hotbar'
let hotlist = [ ["°", 0], ["™", 0], ["¢", 0], ["€", 0], ["©", 0] ];
//array structure: Character, Use number

class CM extends Applet.IconApplet {
    constructor (metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        //set icon and tooltip
        this.set_applet_tooltip("Search Special Ascii Characters");
        this.set_applet_icon_symbolic_name("accented-a-symbolic");
        
        //initialize menu building ui 
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        //objects for organizing menu elements
        this.items = {};
        this.actors = {};

        //hot bar (most commly fetched characters)
        this.items.hotbar = new PopupMenu.PopupMenuSection({reactive: false});
        this.menu.addMenuItem(this.items.hotbar);

        //extra item to allow proper clearing of the hotbar to update it, while keep things styled correctly
        this.items.hotbarWrapper = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.items.hotbar.addMenuItem(this.items.hotbarWrapper);

        //add buttons to hotbars
        this.createHotbar();

        //line divider
        this.items.line = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.menu.addMenuItem(this.items.line);

        this.actors.line = new St.BoxLayout({style_class: "popup-menu-item:active && line", vertical: true});
        this.items.line.addActor(this.actors.line, {expand: true, span: -1});

        //search bar
        this.items.search = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.menu.addMenuItem(this.items.search);

        //add search bar actor
        this.actors.searchBar = new St.Entry({style_class: "menu-application-button-selected && searchBar", name: "search", hint_text: _(" search")});
        //get search bar text
        let searchClutter = this.actors.searchBar.get_clutter_text();
        searchClutter.connect('activate', () => {
            //find search results
            let query = new RegExp(String(this.actors.searchBar.get_text()), "gi");
            let matches = [];

            for (let i = 0; i < Ascii.length; i++) {
                let queryMatchIter = Ascii[i][1].matchAll(query);
                let queryMatch = Array.from(queryMatchIter);
                if (queryMatch.length > 0) {
                    matches.push(Ascii[i][0]);
                }
            }

            //clear previous results in menu
            this.items.results.removeAll();

            //show search results in menu
            //add maximum of 5 rows and colums of results
            for (let i = 0; i < Math.min(matches.length / 5, 5); i++) {
                this.items.resultsRow = new PopupMenu.PopupBaseMenuItem({reactive: false});
                this.items.results.addMenuItem(this.items.resultsRow);

                for (let g = 0; g < 5; g++) {
                    let currentChar = matches[i * 5 + g];
                    this.actors.resultsButton = new St.Button({label: currentChar, style_class: "menu-application-button-selected && button"});
                    this.actors.resultsButton.connect("clicked", () => {
                        //copy char to clipboard (selection / middle click)
                        let clipboard = St.Clipboard.get_default();
                        clipboard.set_text(St.ClipboardType.CLIPBOARD, currentChar);

                        this.insertCharHotlist(currentChar);
                        this.createHotbar();
                        
                        this.menu.toggle();
                    });
                    this.items.resultsRow.addActor(this.actors.resultsButton, {expand: false, span: 0});
                }
            }
        });
        this.items.search.addActor(this.actors.searchBar, {expand: false, span: 0});

        //search icon
        this.actors.searchIcon = new St.Icon({style_class: "applet-icon", icon_name: "search-icon-symbolic", icon_size: "25"});
        this.items.search.addActor(this.actors.searchIcon, {expand: false, span: 0});

        //section to contain the search results
        this.items.results = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.items.results);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
        this.actors.searchBar.grab_key_focus();
    }

    //function to clear hotbar, and add a new one with the re-ordered array
    createHotbar() {
        this.items.hotbar.removeAll();
        this.items.hotbarWrapper = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.items.hotbar.addMenuItem(this.items.hotbarWrapper);
        for (let i = 0; i < 5; i++) {
            this.actors.hotButton = new St.Button({label: hotlist[i][0], style_class: "menu-application-button-selected && button"});
            this.actors.hotButton.connect("clicked", () => {
                let clipboard = St.Clipboard.get_default();
                clipboard.set_text(St.ClipboardType.CLIPBOARD, currentChar);
                
                this.menu.toggle();
            });
            this.items.hotbarWrapper.addActor(this.actors.hotButton, {expand: false, span: 0});
        }
    }

    //function to re order the array that represents the previously used chars (hotlist)
    insertCharHotlist(currentChar) {
        //search array for character inside of for loop to find its index and compare to other characters in front of it
        for (let z = 0; z < hotlist.length; z++) {
            if (hotlist[z][0] == currentChar) {
                //increment the amount of times it has been used for the array
                let index = z;
                let useNumber = hotlist[index][1] + 1;
                let spacesToMove = 0;
                for (let x = 1; x < hotlist.length; x++) {
                    //find how many spaces the current char can move forward with its new use value
                    if (index == 0) {
                        break;
                    }
                    if (hotlist[index - x][1] <= useNumber) {
                        spacesToMove++;
                    } else {
                        //no point checking anything after the first greater entry
                        break;
                    }
                }
                //move item forward based on the loop
                hotlist.splice(index, 1);
                hotlist.splice(index - spacesToMove, 0, [currentChar, useNumber]);
                break;
            } else if (z == hotlist.length - 1) {
                let index = hotlist.length - 1;
                let useNumber = 1;
                let spacesToMove = 0;
                for (let x = 1; x < hotlist.length; x++) {
                    //find how many spaces the current char can move forward with its new use value
                    if (index == 0) {
                        break;
                    }
                    if (hotlist[index - x][1] <= useNumber) {
                        spacesToMove++;
                    } else {
                        //no point checking anything after the first greater entry
                        break;
                    }
                }
                hotlist.splice(index - spacesToMove, 0, [currentChar, useNumber]);
                return
            }
        }
    }
}

function main(metadata, orientation, panelHeight, instance_id) {
    return new CM(metadata, orientation, panelHeight, instance_id);
}