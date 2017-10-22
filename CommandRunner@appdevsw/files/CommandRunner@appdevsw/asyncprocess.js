/*
 * author : appdevsw@wp.pl
 */
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

//--------- AsyncProcess class -------------
//
// Non-blocking process with stdout handling
//
function AsyncProcess(command, debug, callback)
{
    this._init(command, debug, callback);
}

AsyncProcess.prototype =
{

    _init : function(command, debug, callback)
    {
        this.command = command;
        this.debug = debug;
        this.callback = callback;
        this.DO_NOT_FINISH_PROCESS = true;
        this.isProcFinished = false;
        this.bufferSize = 4096;
        this.pid = -1;
        this.fdo = -1;
        this.fdi = -1;
        this.fde = -1;
        this.readBuffer = "";
    },
    //
    //
    // Function starts the asynchronous process for the given command line.
    //
    startProcess : function()
    {
        try
        {
            var t = this.debug.timestart("startProcess pre");
            var[argvrest, argv] =
            GLib.shell_parse_argv(this.command);
            var flags = GLib.SpawnFlags.SEARCH_PATH;
            var [res, pid, fdi, fdo, fde]  =
            GLib.spawn_async_with_pipes(null, argv, null, flags, null);

            this.pid = pid;
            this.fdi = fdi;
            this.fdo = fdo;
            this.fde = fde;

            if (res == false)
            {
                this.debug.dbg("execute error!");
                this.freeResources();
                return false;
            }

            this.istream = new Gio.DataInputStream(
            {
                base_stream : new Gio.UnixInputStream(
                {
                    fd : this.fdo
                })
            });

            this.istream.set_buffer_size(this.bufferSize);
            this.readAsync();
            return true;
        }
        catch (e)
        {
            this.freeResources();
            this.debug.handleException(e, "startProcess:");
        }
        return false;
    },
    //
    //
    readAsync : function()
    {
        this.istream.fill_async(-1, GLib.PRIORITY_DEFAULT, null, Lang.bind(this, this.readAsyncCallback));
    },
    //
    //
    readAsyncCallback : function(istr, res)
    {
        try
        {
            var avail = istr.get_available();
            this.debug.dbg("readAsyncCallback avail " + avail);
            if (avail > 0)
            {
                var buf = istr.read_bytes(avail, null).get_data();
                this.debug.dbg("buf " + buf);
                this.readBuffer += buf;
                this.readAsync();
            }
            else
            {
                this.freeResources(this.DO_NOT_FINISH_PROCESS);
                if (this.callback != null)
                {
                    this.callback(0, this.readBuffer);
                }
                this.isProcFinished = true;
            }
        }
        catch (e)
        {
            this.debug.handleException(e, "readAsyncCallback:");
            this.freeResources();
        }
    },
    //
    //
    secureClose : function(obj)
    {
        try
        {
            if (obj == this.istream)
                obj.close(null);
            else
                GLib.close(obj);
        }
        catch (e)
        {
            this.debug.handleException(e, "secureClose:");
        }
    },
    //
    //
    freeResources : function(doNotFinish)
    {
        try
        {

            if (this.istream != null)
                //istream also closes this.fdo internally
                this.secureClose(this.istream);
            else
            if (this.fdo > 0)
                this.secureClose(this.fdo);
            if (this.fdi > 0)
                this.secureClose(this.fdi);
            if (this.fde > 0)
                this.secureClose(this.fde);
            if (this.pid != -1)
            {
                GLib.spawn_close_pid(this.pid);
                this.pid = -1;
            }
        }
        catch (e)
        {
            this.debug.handleException(e, "freeResources:");
        }
        this.fdo = -1;
        this.fdi = -1;
        this.fde = -1;
        if (doNotFinish)
            return;
        this.isProcFinished = true;
    },
    //
    //
    isFinished : function()
    {
        return this.isProcFinished;
    },
    //
    //
}

