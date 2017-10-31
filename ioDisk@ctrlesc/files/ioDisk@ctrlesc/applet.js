const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const UUID = "ioDisk@ctrlesc";

// l10n/translation support

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var hasDataSource=false;

/* The Applet */
function ioDisk(orientation)
{
    this._init(orientation);
}

ioDisk.prototype =
{
    __proto__: Applet.TextApplet.prototype,
    _init: function(orientation)
    {
        Applet.TextApplet.prototype._init.call(this, orientation);
        try
        {
            this._applet_label.set_style('text-align: left');
            this.actor.style = "width: " + 4.75 + "em";
            this._setLabel(-1);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this._getioDiskEntry();
        }
        catch (e)
        {
            print("ioDisk: init - " + e.toString());
        }
    },
    _getioDiskEntry: function()
    {
        this._getioDiskData();
    },
    _getioDiskData: function()
    {
        if(hasDataSource)
        {
            try
            {
                GLib.spawn_async(null, ['sh', '-c', 'sh -c "iostat -dxh 1 2" > /tmp/ioDisktmp_stat.out'], null, GLib.SpawnFlags.SEARCH_PATH, null);
            }
            catch (e)
            {
                print("ioDisk: GLib.spawn_async - " + e.toString());
            }
            Mainloop.timeout_add(2000, Lang.bind(this, this._continuegetioDiskData));
        }
        else
        {
            try
            {
                hasDataSource = this._hasCommand("which iostat", ".*/iostat");
                if(hasDataSource == true)
                {
                    this.set_applet_tooltip(_("Disk Utilization"));
                }
                else
                {
                    this.set_applet_tooltip(_("Command [iostat] not found."));
                    this._noDataSource();
                }
            }
            catch (e)
            {
                print("ioDisk: DataSource error - " + e.toString());
            }
            Mainloop.timeout_add(2000, Lang.bind(this, this._getioDiskEntry));
        }
    },
    _continuegetioDiskData: function()
    {
        let StatsObject = null;
        try
        {
            let fp = GLib.file_get_contents("/tmp/ioDisktmp_stat.out");
            if(fp != null)
            {
                let iostat_output_lines=fp.toString().split("\n");
                StatsObject = new Object();
                this._processioDiskData(iostat_output_lines, StatsObject);
            }
        }
        catch (e)
        {
            print("ioDisk: ioDisktmp_stat.out - " + e.toString());
        }
        this._ioDiskBuildMenu(StatsObject);
    },
    _ioDiskBuildMenu: function(StatsObject)
    {
        this.menu.removeAll();
        if(StatsObject != null && typeof(StatsObject.drives.length) != "undefined")
        {
            try
            {
                var menuText;
                for(var n = 0; n < StatsObject.drives.length; n++)
                {
                    menuText = StatsObject.drives[n] + ((StatsObject.drives[n].length < 4) ? ":\t\t" : ":\t") + StatsObject.metrics[n] + "%";
                    this.menu.addMenuItem(new PopupMenu.PopupMenuItem(menuText, {reactive:false}));
                }
            }
            catch (e)
            {
                print("ioDisk: menu - " + e.toString());
            }
        }
        else
        {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No drives detected."), {reactive:false}));
        }
        this._getioDiskEntry();
    },
    _processioDiskData: function(ioDisk_lines, Stats)
    {
        try
        {
            if (ioDisk_lines != null && typeof(ioDisk_lines.length) != "undefined")
            {
                Stats.drives = new Array();
                Stats.metrics = new Array();
                Stats.max = 0;
                var bDeviceBoot = false;
                var bDeviceCurr = false;
                var devIndex = 0;
                //print("length: " + ioDisk_lines.length);
                for(let i = 0; i < ioDisk_lines.length; i++)
                {
                    //print("i: " + i + " " + ioDisk_lines[i]);
                    if (!bDeviceBoot && !bDeviceCurr && this._regexTest(ioDisk_lines[i], "^Device"))
                    {
                        //print("DeviceBoot");
                        bDeviceBoot = true;
                    }
                    else if (bDeviceBoot && this._regexTest(ioDisk_lines[i], "^Device"))
                    {
                        //print("DeviceCurr");
                        bDeviceCurr = true;
                        bDeviceBoot = false;
                    }
                    else if (bDeviceCurr && this._regexTest(ioDisk_lines[i], "^([^ ])+"))
                    {
                        Stats.drives[devIndex] = ioDisk_lines[i].trim();
                        //print("Dev=" + Stats.drives[devIndex]);
                        var ioRegExp = new RegExp("([0-9]{1,3}[,.]?[0-9]{0,2})[%]?$");
                        var iostats = new Array();
                        iostats = ioRegExp.exec(ioDisk_lines[i + 1]);

                        if (iostats != null && iostats[1] != null)
                        {
                            Stats.metrics[devIndex] = ~~parseFloat(iostats[1]);
                        }
                        else
                        {
                            Stats.metrics[devIndex] = 0;
                        }
                        if (Stats.metrics[devIndex] > Stats.max)
                        {
                            Stats.max = Stats.metrics[devIndex];
                        }
                        devIndex++;
                    }
                }
                this._setLabel(Stats.max);
            }
            else
            {
                this._setLabel(-1);
            }
        }
        catch (e)
        {
            print("ioDisk: process data - " + e.toString());
        }
    },
    _setLabel: function(lvalue)
    {
		if (lvalue >= 0)
		{
			this.set_applet_label("io: " + lvalue + "%");
		}
		else
		{
			this.set_applet_label(_("io: ??%"));
		}
	},
    _regexTest: function(line, pattern)
    {
        var genericTest = new RegExp(pattern);
        return genericTest.test(line);
    },
    _noDataSource: function()
    {
        this._setLabel(-1);
        this.menu.removeAll();
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Error executing iostat.")), {reactive:false});
    },
    _hasCommand: function(test, match)
    {
        var findOutput = GLib.spawn_command_line_sync(test);
        var hasCommandTest = new RegExp(match);
        if(hasCommandTest.test(findOutput))
        {
            return true;
        }
        return false;
    },
    on_applet_clicked: function(event)
    {
        this.menu.toggle();
    }
};

function main(metadata, orientation)
{
    let iosDisk = new ioDisk(orientation);
    return iosDisk;
}
