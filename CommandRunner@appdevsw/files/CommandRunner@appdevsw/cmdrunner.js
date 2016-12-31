/*
 * author : appdevsw@wp.pl
 */
const Lang = imports.lang;
const AProc = imports.asyncprocess;
const GLib = imports.gi.GLib;

function CmdRunner(applet, debug)
{
    this._init(applet, debug);
}

//
//
CmdRunner.prototype =
{
    _init : function(applet, debug)
    {
        this.Result =
        {
            ERROR : -1,
            MESSAGE : 0,
            FINISHED : 1
        };

        this.applet = applet;
        this.debug = debug;
        this.execCounter = 0;
        this.process = null;

        this.command = "";
        this.intervalMs = 0;
        this.timer = null;
        this.prevTimer = null;

    },
    //
    //
    start : function(command, intervalMs)
    {
        if (command == "")
        {
            this.applet.onTimerMessage(this.Result.ERROR, _("undefined command!"));
            return;
        }
        this.command = command;
        this.intervalMs = intervalMs;
        this.prevTimer = this.timer;
        if (this.prevTimer != null)
            this.prevTimer.sendStopSignal();
        this.timer = new imports.timer.Timer(this.debug, Lang.bind(this, this.onTimerAction));
        this.timer.start(this.intervalMs);
    },

    //
    //
    closeProcess : function()
    {
        if (this.process != null)
        {
            this.process.freeResources();
            this.process = null;
        }
    },

    //
    //

    replaceAll : function(str, strfrom, strto)
    {
        var v = str;
        while (true)
        {
            var v1 = v.replace(strfrom, strto);
            if (v1 == v)
                return v;
            v = v1;
        }
    },

    //
    // replace predefined parameters with the current values
    prepareCommand : function()
    {
        var cmd = this.replaceAll(this.command, "$counter$", this.execCounter);
        cmd = this.replaceAll(cmd, "$appletdir$", this.applet.currentDir);
        return cmd;
    },
    //
    //
    sendStopSignal : function()
    {
        if (this.timer != null)
            this.timer.sendStopSignal();
        this.closeProcess();
    },
    //
    //
    onTimerAction : function(ndebug)
    {
        try
        {
            var debug = ndebug != null ? ndebug : this.debug;
            debug.dbg("onTimerAction pre ");

            if (this.process != null)
            {
                if (!this.process.isFinished())
                {
                    debug.dbg("onTimerAction current process is still active.");
                    return this.timer.RETRY;
                }
                this.closeProcess();
                this.process = null;
            }

            //user has changed parameters, but the timer with prevoius parammeters is still running
            if (this.prevTimer != null && !this.prevTimer.isFinished())
            {
                debug.dbg("onTimerAction previous timer is still active.");
                return this.timer.RETRY;
            }

            //create and start a new process
            if (this.process == null)
            {
                this.execCounter++;
                this.prevTimer = null;
                var cmd = this.prepareCommand();
                debug.dbg("onTimerAction new proces");
                this.process = new AProc.AsyncProcess(cmd, this.debug, Lang.bind(this.applet, this.applet.onTimerMessage));
                if (!this.process.startProcess())
                {

                    var err = _("cannot execute command!");
                    debug.dbg(err);
                    this.applet.onTimerMessage(this.Result.ERROR, err);
                    this.closeProcess();
                }
            }
        }
        catch(e)
        {
            this.closeProcess();
            debug.handleException(e, "onTimerAction:");
        }
    },
    //
    //
}
