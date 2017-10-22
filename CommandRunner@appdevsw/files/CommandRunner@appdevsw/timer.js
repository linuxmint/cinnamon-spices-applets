/*
 * author : appdevsw@wp.pl
 */
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const MainLoop = imports.mainloop;

// Wrapper for MainLoop.timeout_add
//

function Timer(debug, callback)
{
    this._init(debug, callback);
}

//
//
Timer.prototype =
{

    _init : function(debug, callback)
    {
        this.RETRY = 1;
        this.debug = debug.clone();
        this.debug.setID(this.debug.getRandomID());
        this.debug.level = debug.level;

        this.callback = callback;
        this.continueStatus = true;
        this.sourceRemoved = false;
        this.timerIn = false;
        this.intervalMs = 0;
        this.finished = false;
        this.retryIntervalMs = 1000;
        this.mainloopID = null;

    },
    //
    //
    start : function(intervalMs)
    {
        this.intervalMs = intervalMs;
        this.onTimerAction();
        this.debug.dbg("Timer started! interval " + this.intervalMs);
    },
    //
    //
    sendStopSignal : function()
    {
        this.debug.dbg("sendStopSignal");
        this.continueStatus = false;
        if (this.mainloopID != null)
        {
            MainLoop.source_remove(this.mainloopID);
            this.sourceRemoved = true;
        }
    },
    //
    //
    isFinished : function()
    {
        return this.finished || (this.sourceRemoved && !this.timerIn);
    },
    //
    //
    onTimerAction : function()
    {
        this.debug.dbg("onTimerAction " + this.continueStatus);
        if (this.continueStatus)
        {

            var res = 0;
            this.timerIn = true;
            try
            {
                res = this.callback(this.debug);
            }
            catch(e)
            {
                this.timerIn = false;
                throw e;
            }
            this.timerIn = false;
        }

        if (this.continueStatus)
        {

            var interval = this.intervalMs;
            if (res == this.RETRY && this.retryIntervalMs < interval)
                interval = this.retryIntervalMs;
            this.mainloopID = MainLoop.timeout_add(interval, Lang.bind(this, this.onTimerAction));
        }
        else
        {
            this.debug.dbg("Timer finished!");
            this.finished = true;
            this.mainloopID = null;
        }
        this.debug.dbg("onTimerAction end");

        return false;
    },
    //
    //
}
