/*
 * CommandRunner Cinnamon applet
 * 
 * author : appdevsw@wp.pl
 * version: 1.1
 * Applet runs a given command/script/application periodically and displays its results from stdout on the taskbar
 * 
 */
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const UUID = "CommandRunner@appdevsw";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

//
//
//--------- MyApplet class -------------
function MyApplet(metadata, orientation, panelHeight, instanceId)
{
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype =
{
    __proto__ : Applet.TextIconApplet.prototype,
    _init : function(metadata, orientation, panelHeight, instanceId)
    {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try
        {
            var that = this;
            this.metadata = metadata;
            this.instanceId = instanceId;
            this.orientation = orientation;
            this.currentDir = imports.ui.appletManager.appletMeta[this.metadata.uuid].path;
            imports.searchPath.push(this.currentDir);
            this.debug = new imports.debug.Debug(that);
            this.debug.level = 1;
            this.set_applet_tooltip(_("CommandRunner"));
            // parameter form variables
            this.form_command = "";
            this.form_prefix = "";
            this.form_suffix = "";
            this.form_interval = "5";
            this.form_interval_unit = "s";
            this.form_click_command = '';
            // real parameters
            this.command = "";
            this.prefix = "|";
            this.suffix = "|";
            this.intervalMs = 0;
            this.clickCommand = '';
            // constraint to avoid high cpu usage
            this.intervalMsMin = 100;
            this.cmdrunner = new imports.cmdrunner.CmdRunner(that, that.debug);
            this.gui = new imports.appletgui.AppletGui(that, this.debug);
            this.bindSettings();
            this.onApplyButtonPressed();

        }
        catch (e)
        {
            this.debug.handleException(e, "init:");
        }
    },
    //
    //
    setLabel : function(txt)
    {
        this.gui.clearBox();
        this.set_applet_label(txt);
    },
    //
    //
    removeCRLF : function(str, repl)
    {
        if (repl == null)
            repl = "~";
        return str.replace(/(?:\r\n|\r|\n)/g, repl);
    },
    //
    //

    displayTextFormatMessage : function(msg)
    {
        if (msg == null)
            msg = "";
        if (this.prefix == null)
            this.prefix = "";
        if (this.suffix == null)
            this.suffix = "";
        msg = msg.replace(/[\n\r]$/, "");
        msg = this.removeCRLF(msg);
        msg = this.prefix.concat(msg).concat(this.suffix);
        if (msg == "")
            msg = _("<no text>");
        this.setLabel(msg);
    },
    //
    //
    getMillis : function(val, unit)
    {
        if (unit == "s")
            return val * 1000;
        return val;
    },
    //
    //
    //hidden option - enable debug level using marker in command - `>debugX`
    // - X=1 - log to glass.log     X=2 - display label       X=3 - both
    //
    parseCommand : function(command)
    {
        this.debug.level = 0;
        var cmd = command;
        for (let i = 0; i <= 3; i++)
        {
            var c = cmd.replace(">debug" + i, "");
            if (c != cmd)
                this.debug.level = i;
            cmd = c;
        }
        return cmd;
    },
    //
    //function copies screen variables from the parameter form to internal parameters,
    //then starts the timer.
    onApplyButtonPressed : function()
    {
        this.setLabel(_("starting..."));
        //preparing parameters
        this.command = this.form_command;
        this.command = this.parseCommand(this.command);
        this.prefix = this.form_prefix;
        this.suffix = this.form_suffix;
        this.intervalMs = this.getMillis(this.form_interval, this.form_interval_unit);
        this.clickCommand = this.form_click_command;
        this.clickCommand = this.parseCommand(this.clickCommand);

        if (this.intervalMs < this.intervalMsMin)
            this.intervalMs = this.intervalMsMin;
        this.debug.dbg("setParameters " + this.command + " " + this.intervalMs);

        //starting timer
        this.cmdrunner.start(this.command, this.intervalMs);
        this.debug.dbg("setParameters done");
    },
    //
    //
    bindSettings : function()
    {
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instanceId);
        this.settings.bindProperty(Settings.BindingDirection.IN, "form_command", "form_command");
        this.settings.bindProperty(Settings.BindingDirection.IN, "form_prefix", "form_prefix");
        this.settings.bindProperty(Settings.BindingDirection.IN, "form_suffix", "form_suffix");
        this.settings.bindProperty(Settings.BindingDirection.IN, "form_interval", "form_interval");
        this.settings.bindProperty(Settings.BindingDirection.IN, "form_interval_unit", "form_interval_unit");
        this.settings.bindProperty(Settings.BindingDirection.IN, 'form_click_command', 'form_click_command');
    },
    //
    //
    on_applet_clicked : function(event)
    {
        var cmd = this.clickaction;
        if (cmd == "")
            return;
        if (!cmd || cmd== null)
        {
            if (this.clickCommand)
                cmd = this.clickCommand;
            else
                cmd = "cinnamon-settings applets " + this.metadata.uuid + " " + this.instanceId;
        }
        try
        {
            Util.spawnCommandLine(cmd);
        }
        catch(e)
        {
            this.debug.handleException(e, "showParameters:");
        }

    },
    //
    //Displays a message on the taskbar in text or graphical form.
    //Used as a callback invoked from the CmdRunner
    onTimerMessage : function(code, msg)
    {
        var t = this.debug.timestart();
        if (msg.indexOf("<xml>") < 0 && msg.indexOf("\"json\"") < 0)
            this.displayTextFormatMessage(msg);
        else
            this.gui.displayGuiFormatMessage(msg);
        this.debug.timestop("display time ", t);
    },
    //
    //
    on_applet_removed_from_panel : function(event)
    {
        this.debug.dbg("on_applet_removed_from_panel");
        if (this.cmdrunner != null)
            this.cmdrunner.sendStopSignal();
    },
    //
    //
};
//
//
function main(metadata, orientation, panelHeight, instanceId)
{
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
