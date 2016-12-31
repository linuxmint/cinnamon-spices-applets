/*
 * author : appdevsw@wp.pl
 */
const GLib = imports.gi.GLib;
const Lang = imports.lang;

function Node(parent, name)
{
    this._init(parent, name);
}

Node.prototype =
{
    _init : function(parent, name)
    {
        this.parent = parent;
        this.name = name;
        this.value = null;
        if (parent)
            this.level = parent.level + 1;
        else
            this.level = 0;
    },
    //
    //
    getname : function()
    {
        return this.name;
    },
    //
    //
    getpath : function()
    {
        var path = this.name;
        if (this.parent != null)
            path = this.parent.getpath() + "/" + path;
        return path;
    },

    //
    getvalue : function()
    {
        return this.value;
    },
    //
    isLeaf : function()
    {
        return this.children == null || this.children.length == 0;
    },
    //
    pl : function()
    {
        return new Array(this.level * 2 + 1).join(" ");
    },

    //
    //
    addChild : function(node)
    {
        if (this.children == null)
            this.children = new Array();
        this.children.push(node);
    },
    //
    //
    getFirstChild : function(name)
    {
        if (!this.isLeaf())
            for (var i = 0; i < this.children.length; i++)
            {
                var cn = this.children[i];
                if (cn.getname() == name)
                    return cn;
            }
        return null;
    },
    //
    //
    getFirstChildValue : function(name)
    {
        var node = this.getFirstChild(name);
        if (node == null)
            return null;
        return node.value;
    },
    //
    //
    getFirstChildValueBool : function(name)
    {
        var node = this.getFirstChild(name);
        if (node == null)
            return false;
        return node.getbool();
    },
    //
    //
    getbool : function()
    {
        var v = this.value;
        if (v == null || v == "")
            return false;
        v = v.toLowerCase();
        if (v == "0"//
            || v == "no"//
            || v == "false"//
            )
            return false;
        return true;
    },
    //
    // Create a JS object from xml
    //
    toJSObject : function(arrayTags)
    {
        var node = this;
        if (node.isLeaf())
            return;
        var jsObj =
        {
        };
        var margin = node.pl();
        var itemcount = 0;
        var parentname = node.getname();
        for (var i = 0; i < node.children.length; i++)
        {
            var cn = node.children[i];
            var name = cn.name;
            if (cn.isLeaf())
            {
                jsObj[name] = cn.getvalue();
            }
            else
            {
                var jsSubObj = cn.toJSObject(arrayTags);
                if (arrayTags && //
                (//
                    (arrayTags.indexOf(name) >= 0) || //
                    (arrayTags.indexOf(parentname + "." + name) >= 0))//
                )
                {
                    if (itemcount == 0)
                        jsObj.item = new Array();
                    jsObj.item[itemcount++] = jsSubObj;
                }
                else
                    jsObj[name] = jsSubObj;
            }
        }
        return jsObj;
    },
    //
    //

}
//
//
//
function SimpleXml(applet, debug)
{
    this._init(applet, debug);
}

//
const xmlconv = [//
["&#60;", "<"], //
["&#62;", ">"], //
["&lt;", "<"], //
["&gt;", ">"]//
];
//
//
SimpleXml.prototype =
{
    _init : function(applet, debug)
    {
        this.applet = applet;
        this.debug = debug;
    },
    //
    //
    convert : function(val, rev)
    {
        var v = val;
        for (var i = 0; i < xmlconv.length; i++)
        {
            var i1 = rev ? 1 : 0;
            var i2 = rev ? 0 : 1;
            v = v.replace(new RegExp(xmlconv[i][i1], 'g'), xmlconv[i][i2]);
        }
        return v;
    },
    //
    //parse an xml and build a tree of nodes
    parse : function(xml)
    {
        var t = this.debug.timestart();
        var level = 0;
        var inTag = 0;
        var p1 = 0;
        var root = new Node(null, "root");
        var node = root;
        for (var p2 = 0; p2 < xml.length; p2++)
        {
            var c = xml.charAt(p2);
            if (c == "<")
            {
                if (++inTag > 1)
                    break;
                p1 = p2;
            }
            else
            if (c == ">")
            {
                if (--inTag < 0)
                    break;
                var chr2 = xml.charAt(p1 + 1);
                if (chr2 == '!' || chr2 == '?')
                {
                    //skip comments and special tags
                    continue;
                }
                var closing = (chr2 == "/");
                level += ( closing ? -1 : 1);
                if (level < 0)
                    break;
                if (closing)
                {
                    var tagname = xml.substring(p1 + 2, p2);
                    if (tagname != node.name)
                        break;
                    if (node.isLeaf())
                    {
                        var l = tagname.length + 2;
                        node.value = this.convert(xml.substring(node.start + l, p2 - l));
                    }
                    delete node.start;
                    node = node.parent;
                }
                else
                {
                    var tagname = xml.substring(p1 + 1, p2);
                    var n = new Node(node, tagname);
                    n.start = p1;
                    node.addChild(n);
                    node = n;
                }
            }
        }
        if (root != node || level != 0 || inTag != 0 || p2 != xml.length)
        {
            var e = _("xml parse error at pos ") + p2 + "/" + xml.length + _(", level ") + level + _(", inside tag ") + inTag;
            this.debug.dbg(e);
            throw e;
        }
        this.debug.timestop("xml parse time ", t);
        //this.debug.dbg(this.format(root));
        return node;
    },
    //
    //
    format : function(node)
    {
        var buf = "\n" + node.pl() + "<" + node.getname() + ">";
        if (!node.isLeaf())
        {
            for (var i = 0; i < node.children.length; i++)
                buf += this.format(node.children[i]);
            buf += "\n" + node.pl() + "</" + node.getname() + ">";
        }
        else
        {
            buf += this.convert(node.getvalue(), true) + "</" + node.getname() + ">";
        }
        return buf;
    },
}

