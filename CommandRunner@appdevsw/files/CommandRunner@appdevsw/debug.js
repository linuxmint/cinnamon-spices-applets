/*
 * author : appdevsw@wp.pl
 */
const GLib = imports.gi.GLib;

function Debug(applet)
{
    this._init(applet);
}

//
//
Debug.prototype =
{
    _init : function(applet)
    {
        this.applet = applet;
        this.level = 0;
        this.id = "";
    },
    //
    //
    setID : function(id)
    {
        this.id = id;
    },
    //
    //
    handleException : function(e, desc)
    {
        var msg = desc + " " + e.toString();
        if (this.id != "")
            msg = this.id + " " + msg;
        if (this.level == 1 || this.level == 3)
        {
            global.logError(msg);
        }
        if (this.level == 2 || this.level == 3)
        {
            this.applet.setLabel(msg);
        }
    },
    //
    //
    dbg : function(pmsg)
    {
        var msg = pmsg;
        if (this.id != "")
            msg = this.id + " " + msg;
        if (this.level == 1 || this.level == 3)
        {
            global.log(msg);
        }
        if (this.level == 2 || this.level == 3)
        {
            this.applet.setLabel(msg);
        }
    },
    //
    //
    getRandomID : function()
    {
        return Math.round(GLib.get_real_time() / 1000);
    },
    //
    //
    clone : function()
    {
        var n = new imports.debug.Debug(this.applet);
        n.level = this.level;
        n.id = this.id;
        return n;
    },
    //
    //
    timestart : function(msg)
    {
        var tstart = GLib.get_real_time();
        if (msg)
            this.dbg(msg);
        return tstart;
    },
    //
    //
    timestop : function(msg, tstart)
    {
        this.dbg(msg + (GLib.get_real_time() - tstart));
    },
}