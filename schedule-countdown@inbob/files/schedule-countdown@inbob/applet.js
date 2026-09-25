const strings = {
    selectSchedule:"Select Schedule:",
    noSchedule:"Select Schedule",
    dayDone:"Day is done!",
    beforeDay:"Yet to begin!"
}




const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;




class CountdownApplet extends Applet.TextApplet{
    constructor(metadata, orientation, panelHeight, instanceId){
        //register the TextApplet that this extends
        super(orientation, panelHeight, instanceId);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.currentSchedule = null;
        this.path = metadata.path;

        //load from settings
        this.settings = new Settings.AppletSettings(this, "schedule-countdown@inbob", instanceId);
        this.settings.bind("daily-reset", "dailyReset");
        this.settings.bind("update-interval", "updateInterval", this._setRecurringEvent);
        this.settings.bind("schedule-data", "scheduleData", this._updateSchedule);

        //Initialize to no schedule
        this._selectSchedule(null);

        this._setRecurringEvent();
    }

    on_applet_clicked(){
        this.menu.toggle();
    }

    on_applet_removed_from_panel(){
        this._setRecurringEvent(false); 
    }

    launchScheduleEditor(){
        let proc = Gio.Subprocess.new(
            ["cjs", `${this.path}/schedule-editor.js`, this.scheduleData, this.path],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
        );

        proc.communicate_utf8_async(null, null, (p, res) => {
            let [,stdout] = p.communicate_utf8_finish(res);
            if(stdout && stdout.length)try{
                JSON.parse(stdout);
                this.scheduleData = stdout;
                this._updateSchedule();
            } catch {}
        });
    }
    



    _setRecurringEvent(active=true){
        if(this.recurringTaskId) Util.clearInterval(this.recurringTaskId);
        this.recurringTaskId = null;
        if(!active) return;
        this.recurringTaskId = Util.setInterval(()=>{
            try{this.set_applet_label(this._getText());}
            catch(e){global.logError(e);}
        }, this.updateInterval);
    }
    _getText(){
        if(!this.scheduleName) return strings.noSchedule;

        let now = this._getCurrentSeconds();
        const schedule = this.currentSchedule;
        //TESTING ONLY
        //now -= 60*60*6;

        //If it's not the same day that the schedule was set, reset the schedule.
        if(this.dailyReset && this.scheduleSetDay != this._getCurrentDayIndex()){
            this._selectSchedule(null);
            return strings.noSchedule;
        }

        if(now<schedule.begin) return strings.beforeDay;

        for(const event of schedule.events){
            if(now < event.start) return `${event.name} starts in ${this._formatTimeSpan(event.start-now)}`;
            if(now < event.end)   return `${event.name} ends in ${this._formatTimeSpan(event.end-now)}`;
        }

        return strings.dayDone;
    }




    _updateSchedule(){
        //cache schedule
        this.currentSchedule = null;
        if(this.scheduleName) this.currentSchedule = this._getCurrentScheduleData();

        //reset menu
        this.menu.removeAll();

        //add title to menu
        const title = new PopupMenu.PopupMenuItem(strings.selectSchedule);
        title.setSensitive(false);
        title.actor.add_style_class_name("popup-menu-heading");
        this.menu.addMenuItem(title);

        //add each schedule type to menu, splitting out schedule type variations
        const schedulesMeta = this._getSchedulesMeta();
        for(const [name,variants] of schedulesMeta){
            if(!variants) this._addMenuScheduleOption(name,null);
            else variants.forEach(variant => this._addMenuScheduleOption(name, variant))
        }
    }
    //returns {begin,events:[{name,start,end},{name,start,end}...]}
    //begin, start, and end are represented as seconds since midnight
    //the events are guaranteed to be in time order based on start.
    _getCurrentScheduleData(){
        const {begin,events:rawEvents} = JSON.parse(this.scheduleData)[this.scheduleName];

        let finalEvents = [];
        for(const [name,eventData] of Object.entries(rawEvents)){
            const {start,end} = eventData.variants?eventData.variants[this.dayVariant]:eventData;
            if(start && end) finalEvents.push({name,start:this._strToSeconds(start),end:this._strToSeconds(end)});
        }

        finalEvents.sort((a, b) => a.start - b.start);

        return {begin:this._strToSeconds(begin),events:finalEvents};
    }
    //returns [[name,[variant1,variant2...]],[name,null]...]
    _getSchedulesMeta(){
        let schedules = [];
        for(const [name,sched] of Object.entries(JSON.parse(this.scheduleData))){
            let variants = [];
            for(const [event,item] of Object.entries(sched.events)){
                if(item.variants){
                    variants = Object.keys(item.variants);
                    break;
                }
            }
            schedules.push([name, variants.length?variants:null]);
        }
        return schedules;
    }
    _addMenuScheduleOption(name, dayVariant){
        const item = new PopupMenu.PopupMenuItem(`${name}${dayVariant?` - ${dayVariant}`:""}`);
        //stop the selected one from being sensitive
        item.setSensitive(!(name==this.scheduleName && dayVariant==this.dayVariant))
        //when clicked, run this function:
        item.connect('activate', () => this._selectSchedule(name, dayVariant));
        //add to the menu
        this.menu.addMenuItem(item);
    }
    



    _selectSchedule(name=null, dayVariant=null){
        this.scheduleName = name;
        this.dayVariant = dayVariant;
        this.scheduleSetDay=this._getCurrentDayIndex();
        this._updateSchedule();
    }




    _getCurrentSeconds(){
        const now = new Date();
        return (now.getHours()*60+now.getMinutes())*60+now.getSeconds();
    }

    _getCurrentDayIndex(){
        const now = new Date();
        return (now.getFullYear()*12+now.getMonth())*40 + now.getDate();
    }

    //take "hr:mn:sc" or "hr:mn" or "hr" and convert to seconds since midnight
    _strToSeconds(str){
        const [h=0,m=0,s=0] = str.split(":").map(Number);
        return (h*60+m)*60+s;
    }

    //takes a number of seconds and outputs a human readable string
    _formatTimeSpan(sec){
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }
}




//define main to be called with the standard parameters
function main(metadata, orientation, panelHeight, instanceId) {
    return new CountdownApplet(metadata, orientation, panelHeight, instanceId);
}