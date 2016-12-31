/*
 * author : appdevsw@wp.pl
 */
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

const Interfaces = imports.misc.interfaces
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Pango = imports.gi.Pango;
const Main = imports.ui.main;

function AppletGui(applet, debug)
{
    this._init(applet, debug);
}

const Tag =
{
    XML_ROOT : "xml",
    APP_SETTINGS : "appsettings",
    TOOLTIP : "tooltip",
    CLICK_ACTION : "clickaction",
    ITEM : "item",
    TYPE : "type",
    BOX : "box",
    VERTICAL : "vertical",
    STYLE : "style",
    ICON : "icon",
    TEXT : "text",
    VALUE : "value",
    ATTR : "attr",
    XFILL : "xfill",
    YFILL : "yfill",
    XALIGN : "xalign",
    YALIGN : "yalign"
};

//
//
AppletGui.prototype =
{
    _init : function(applet, debug)
    {
        this.applet = applet;
        this.debug = debug;
        this.prevIconName = "";
        this.xmlutil = new imports.simplexml.SimpleXml(applet, debug);
        this.createBox(applet);
        this.prevObj = null;
    },
    //
    //
    createBox : function(app)
    {
        try
        {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, app.orientation);
            this.menuManager.addMenu(this.menu);
            this.box = new St.BoxLayout(
            {
                name : 'CommandRunner'
            });
            app.actor.add_actor(this.box);

        }
        catch (e)
        {
            this.debug.handleException(e, "createBox:");
        }
    },
    //
    //
    clearBox : function()
    {
        this.box.destroy_all_children();
        this.box.set_style("");
        this.prevObj = null;
    },
    //
    //
    getIconForName : function(iname)
    {

        var icon = null;
        var gicon = null;
        if (iname.indexOf("/") >= 0)
        {
            gicon = Gio.icon_new_for_string(iname);
        }
        icon = new St.Icon(
        {
            icon_type : St.IconType.SYMBOLIC,
            style_class : 'popup-menu-icon',
        });
        if (gicon != null)
            icon.gicon = gicon;
        else
            icon.icon_name = iname;
        return icon;
    },
    //
    //
    setDefaultAttr : function(n)
    {
        var attr =
        {
            xfill : null,
            yfill : null,
            xalign : null,
            yalign : null,
            vertical : null,
            style : null
        };

        if (!n.attr)
            n.attr =
            {
            };
        for (name in attr)
        {
            if (!n.attr[name])
                n.attr[name] = null;
        }
    },
    //
    //
    cmp : function(name, n1, n2)
    {
        if (n1 != n2)
            throw _("Compare error ") + name;
    },
    //
    //
    tryUpdateBoxIncremental : function(root1, root2, level)
    {
        if (root1.item.length != root2.item.length)
            return false;
        var t = this.debug.timestart();
        for (var i = 0; i < root1.item.length; i++)
        {
            var n1 = root1.item[i];
            var n2 = root2.item[i];
            //  this.debug.dbg("cmp " + n1.type + "/" + n2.type);
            if (n1.type != n2.type)
            {
                this.debug.dbg("cmp diff 1 " + n1.type + "/" + n2.type);
                return false;
            }

            this.setDefaultAttr(n1);
            this.setDefaultAttr(n2);
            var a1 = n1.attr;
            var a2 = n2.attr;

            try
            {
                this.cmp(Tag.XFILL, a1.xfill, a2.xfill);
                this.cmp(Tag.YFILL, a1.yfill, a2.yfill);
                this.cmp(Tag.XALIGN, a1.xalign, a2.xalign);
                this.cmp(Tag.YALIGN, a1.yalign, a2.yalign);
            }
            catch(e)
            {
                this.debug.dbg(e.toString());
                return false;
            }

            switch(n1.type)
            {

            case Tag.BOX:
                var res = this.tryUpdateBoxIncremental(n1, n2, level + 1);
                if (!res)
                    return false;
                break;

            case Tag.TEXT:
                if (n1.value != n2.value)
                {
                    this.debug.dbg("change text [" + n1.value + "][" + n2.value + "]");
                    n1.component.set_text(n2.value);
                }
                break;

            case Tag.ICON:
                if (n1.value != n2.value)
                {
                    this.debug.dbg("change icon [" + n1.value + "][" + n2.value + "]");
                    var st = n1.component.child.get_style();
                    n1.component.child = this.getIconForName(n2.value);
                    n1.component.child.set_style(st);
                }
                break;
            }

            if (a1.style != a2.style)
            {
                this.debug.dbg("change style [" + a1.style + "][" + a2.style + "]");
                if (n1.type == Tag.ICON)
                    n1.component.child.set_style(a2.style);
                else
                    n1.component.set_style(a2.style);
            }

            if (!a2.vertical)
                a2.vertical = null;
            if (this.getBool(a1.vertical) != this.getBool(a2.vertical))
            {
                this.debug.dbg("change vertical [" + a1.vertical + "][" + a2.vertical + "]");
                n1.component.set_vertical(this.getBool(a2.vertical));
            }

            n2.component = n1.component;
        }
        if (level == 0)
            this.debug.timestop("tryUpdateBoxIncremental time ", t);
        return true;
    },
    //
    //
    displayGuiFormatMessage : function(message)
    {
        try
        {
            var t = this.debug.timestart("displayGuiFormatMessage");
            this.applet.set_applet_label("");
            var objmsg = null;
            if (message.indexOf("<xml>") >= 0)
            {
                var xmlroot = this.xmlutil.parse(message);
                //create a JS object from xml, treat `item` tags as an array
                var objroot = xmlroot.toJSObject(["item"]);
                var objmsg = objroot.xml;
            }
            else
            {
                objroot = JSON.parse(message);
                objmsg = objroot;
            }

            if (objmsg == null)
            {
                throw _("XML/JSON error: missing tag ") + "`" + Tag.XML_ROOT + "`";
            }

            var sett = objmsg.appsettings;
            if (sett != null)
            {
                if (sett.tooltip != null)
                    this.applet.set_applet_tooltip(sett.tooltip);
                else
                    this.applet.set_applet_tooltip("");
                this.applet.clickaction = sett.clickaction;
            }

            //try to update an applet area without deleting and creating gui objects
            if (this.prevObj != null && this.tryUpdateBoxIncremental(this.prevObj, objmsg, 0))
            {
                this.prevObj = objmsg;
                this.debug.timestop("incremental gui update time ", t);
                return;
            }

            this.prevObj = objmsg;
            this.debug.dbg("full gui rebuild");
            this.clearBox();
            this.prevObj = objmsg;

            if (objmsg.item == null || objmsg.item[0] == null)
            {
                throw _("XML/JSON error: missing tag ") + "`" + Tag.ITEM + "`";
            }
            this.parseItems(objmsg, this.box, 0);
            this.debug.timestop("full gui rebuild time ", t);
        }
        catch(e)
        {
            this.debug.handleException(e, "displayGuiFormatMessage:");
            this.applet.setLabel(_("xml error:") + e.toString());
        }

    },
    //
    //
    parseItems : function(node, box, level)
    {
        this.debug.dbg("parseItems");
        if (node.item == null || node.item.length < 1)
            return;

        for (var i = 0; i < node.item.length; i++)
        {
            var cn = node.item[i];
            var type = cn.type;

            //new icon/text/box
            var newObj = null;

            switch (type)
            {

            case Tag.ICON:
                if (cn.value == null)
                    throw _("property not found ") + Tag.VALUE;
                newObj = new St.Bin();
                var icon = this.getIconForName(cn.value);
                newObj.child = icon;
                newObj.styleobj = icon;
                break;

            case Tag.TEXT:
                if (cn.value == null)
                    throw _("property not found ") + Tag.VALUE;
                newObj = new St.Label();
                newObj.set_text(cn.value);
                break;

            case Tag.BOX:
                newObj = new St.BoxLayout();
                this.parseItems(cn, newObj, level + 1);
                break;

            }

            if (newObj != null)
            {
                this.setDefaultAttr(cn);
                if (newObj.styleobj == null)
                    newObj.styleobj = newObj;
                if (type == Tag.BOX)
                    newObj.set_vertical(this.getBool(cn.attr.vertical));
                newObj.styleobj.set_style(cn.attr.style);
                box.add(newObj,
                {
                    x_align : this.getAlign(cn.attr.xalign),
                    y_align : this.getAlign(cn.attr.yalign),
                    x_fill : this.getBool(cn.attr.xfill),
                    y_fill : this.getBool(cn.attr.yfill)
                });

                box.add(newObj);
                cn.component = newObj;
            }
        }

    },
    //
    //
    getAlign : function(a)
    {
        if (a == 0 || a == "0")
            return St.Align.START;
        if (a == 2 || a == "2")
            return St.Align.END;
        return St.Align.MIDDLE;
    },
    //
    //
    getBool : function(a)
    {
        if (a == null || a == "")
            return false;
        a += "";
        a = a.toLowerCase();
        if (["0", "false", "no"].indexOf(a) >= 0)
            return false;
        return true;
    },
    //
}
