#!/usr/bin/gjs

imports.gi.versions.Gtk = "3.0";
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

Gtk.init(null);

//load UI from xml file
const builder = new Gtk.Builder();
builder.add_from_file(`${ARGV[1]}/schedule-editor.xml`);

const window = builder.get_object("window");




function addViewColumns(view,columnHeaders){
    for(const [cIdx,title] of Object.entries(columnHeaders)){
        const renderer = new Gtk.CellRendererText();
        const column = new Gtk.TreeViewColumn({title});
        column.pack_start(renderer, true);
        column.add_attribute(renderer, "text", cIdx);
        view.append_column(column);
    }
}
addViewColumns(builder.get_object("eventView"),    ["Event","Start","End"]);
addViewColumns(builder.get_object("variantView"),  ["Variant","Start","End"]);
addViewColumns(builder.get_object("scheduleView"), ["Schedule"]);




let data = JSON.parse(ARGV[0]); 
let currentSchedule = null;




function getAvailableDefaultName(obj,base){
    let name=base, i=1;
    while(obj[name]) name=`${base} ${i<10?0:""}${i++}`;
    return name;
}
function attemptRenameKey(obj,oldKey,newKey){
    if(!obj[oldKey] || obj[newKey]) return oldKey;
    const newObj = {};
    for(const key in obj){
        newObj[(key==oldKey)?newKey:key] = obj[key];
    }
    Object.keys(obj).forEach(key => delete obj[key]);
    Object.assign(obj, newObj);
    return newKey;
}
//take "hr:mn:sc" or "hr:mn" or "hr" and convert to seconds since midnight
function strToSeconds(str){
    const [h=0,m=0,s=0] = str.split(":").map(Number);
    return (h*60+m)*60+s;
}




class EditLayer{
    constructor(treeStoreId, treeStoreKeys, treeViewId, nameEntryId, addButtonData,
        removeButtonId, childEntryIds={}, childEditLayers={}){
        this.treeStore = builder.get_object(treeStoreId);
        this.treeStoreKeys = treeStoreKeys;
        this.treeView = builder.get_object(treeViewId);
        this.nameEntry = builder.get_object(nameEntryId);
        this.addButtons = [];
        this.removeButton = builder.get_object(removeButtonId);
        this.childEntries = Object.fromEntries(Object.entries(childEntryIds).map(([key,value]) => [key,builder.get_object(value)]));
        this.childEditLayers = childEditLayers;
        this.currentlySelected = null;
        this.suspendChangeChecking = false;

        this.treeView.get_selection().connect("changed", sel => {
            if(this.suspendChangeChecking) return;
            const [somethingSelected,,iter] = sel.get_selected();
            const eventName = somethingSelected?this.treeStore.get_value(iter, 0):null;
            this.currentlySelected = eventName;
            this.updateChildData();
            this.updateMeta();
        });
        this.nameEntry.connect("changed", entry => {
            if(entry.get_text()=="") return;
            if(!this.currentlySelected) return;
            this.currentlySelected = attemptRenameKey(this.data,this.currentlySelected,entry.get_text());
            this.updateChildData();
            this.update();
        });
        for(const [key,value] of Object.entries(addButtonData)){
            const addButton = builder.get_object(key);
            this.addButtons.push(addButton);
            addButton.connect("clicked", () => {
                const newName = getAvailableDefaultName(this.data, `New ${value.defaultString}`);
                this.data[newName] = JSON.parse(JSON.stringify(value.defaultObject));
                this.currentlySelected = newName;
                this.updateChildData();
                this.update();
            });
        }
        this.removeButton.connect("clicked", () => {
            if(!this.currentlySelected) return;
            delete this.data[this.currentlySelected];
            this.currentlySelected = null;
            this.updateChildData();
            this.update();
        });
        for(const [name,entry] of Object.entries(this.childEntries)){
            entry.connect("changed", entry => {
                if(!this.currentlySelected) return;
                this.data[this.currentlySelected][name] = entry.get_text();
                this.update(true);
            });
        }
    }
    updateData(data){
        if(!data || !data[this.currentlySelected]) this.currentlySelected = null;
        this.data = data;
        this.updateChildData();
        this.update();
    }
    updateChildData(){
        for(const [propertyName, childEditLayer] of Object.entries(this.childEditLayers)){
            if(!this.currentlySelected){
                childEditLayer.updateData(null);
            }
            else childEditLayer.updateData(this.data[this.currentlySelected][propertyName]);
        }
    }
    update(doNotUpdateMetadata=false){
        if(!doNotUpdateMetadata) this.updateMeta();
        this.suspendChangeChecking = true;
        this.treeStore.clear();
        this.suspendChangeChecking = false;
        if(!this.data) return;

        if(doNotUpdateMetadata) this.suspendChangeChecking = true;

        let rowToSelect = null

        const sortedEntries = Object.entries(this.data).sort(([ak,a], [bk,b]) => {
            const aVal = a.start ?? (a.variants?Object.values(a.variants).sort((la,lb) => la.start.localeCompare(lb.start))[0].start:"");
            const bVal = b.start ?? (b.variants?Object.values(b.variants).sort((la,lb) => la.start.localeCompare(lb.start))[0].start:"");
            return (strToSeconds(aVal)+ak).localeCompare(strToSeconds(bVal)+bk);
        });

        for(const [key,value] of sortedEntries){
            const strings = this.treeStoreKeys.map(k => {
                if(k=="{KEY}") return key;
                if(!value[k]) return "";
                return value[k];
            });
            const row = this.treeStore.append()
            this.treeStore.set(row, [0,1,2], strings);
            if(key==this.currentlySelected) rowToSelect = row;
        }
        if(rowToSelect){
            const selection = this.treeView.get_selection();
            selection.select_path(this.treeStore.get_path(rowToSelect));
        }

        this.suspendChangeChecking = false;
    }
    updateMeta(){
        this.addButtons.forEach(b => b.set_visible(this.data));
        for(const [property,entry] of Object.entries(this.childEntries)){
            const goodSelection = this.currentlySelected && this.data[this.currentlySelected][property];
            entry.get_parent().set_visible(goodSelection);
            entry.set_text(goodSelection?this.data[this.currentlySelected][property]:"");
        }
        this.nameEntry.set_visible(this.currentlySelected);
        this.removeButton.set_visible(this.currentlySelected);
        this.nameEntry.set_text(this.currentlySelected || "");
    }
}



const variantEditLayer  = new EditLayer("variantStore", ["{KEY}","start","end"], "variantView", "variantNameEntry",  
    {"variantAddButton":{defaultString:"Variant", defaultObject:{start:"08:30",end:"09:00"}}},
    "variantRemoveButton", {start:"variantStartEntry",end:"variantEndEntry"});

const eventsEditLayer   = new EditLayer("eventStore",  ["{KEY}","start","end"], "eventView", "eventNameEntry",
    {"eventAddButton":{defaultString:"Event", defaultObject:{start:"08:30",end:"09:00"}},
        "variantEventAddButton":{defaultString:"Event", defaultObject:{variants:{}}}},
    "eventRemoveButton", {start:"eventStartEntry",end:"eventEndEntry"}, {variants:variantEditLayer});

const scheduleEditLayer = new EditLayer("scheduleStore", ["{KEY}"], "scheduleView", "scheduleNameEntry", 
    {"scheduleAddButton":{defaultString:"Schedule", defaultObject:{begin:"08:00",events:{}}}},
    "scheduleRemoveButton", {begin:"beginEntry"}, {events:eventsEditLayer});

scheduleEditLayer.updateData(data);

setTimeout(function(){
    scheduleEditLayer.updateChildData();
    scheduleEditLayer.update();
}, 0)





const quit = () => Gtk.main_quit();

//OK -> print(save) and quit
builder.get_object("okBtn").connect("clicked", function() {
    print(JSON.stringify(data));
    quit();
});
//various ways to quit without saving
builder.get_object("cancelBtn").connect("clicked", quit);
window.connect("delete-event", quit);
window.connect("key-press-event", (unused, event) => {
   let [ok, key] = event.get_keycode();
   if(key == 9) quit();//Esc
});


//Show window and start code
window.show_all();
Gtk.main();
