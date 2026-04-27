const Lang = imports.lang;
const St = imports.gi.St;
const Gdk = imports.gi.Gdk;
const BoxLayoutTooltip = require('./boxLayoutTooltip').BoxLayoutTooltip;

class Graph {
    constructor(actor, provider_cls, applet) {

        this.provider = new provider_cls(applet.cfg_refresh_rate);
        this.actor = actor;
        this._applet = applet; // needed for the tooltip /!\ "_applet" prop name must not be changed.
        this.area = new St.DrawingArea();
        this.label_top = new St.Label();
        this.label_bottom = new St.Label();
        this.label_top_right = new St.Label();
        this.actor.add_child(this.area);
        this.actor.add_child(this.label_top);
        this.actor.add_child(this.label_top_right);
        this.actor.add_child(this.label_bottom);
        /* Tooltip */
        this._tooltip = new GraphicTooltip(this, "", applet.orientation)
        this.now = 0;
        
        // SET FROM APPLET SETTINGS :
        this.border_color = applet.cfg_border_color;
        this.bg_color = applet.cfg_bg_color;
        this.spacing = applet.cfg_graph_spacing;
        this.draw_border = applet.cfg_draw_border;
        this.show_values = applet.cfg_show_values;
        this.values_fontsize = applet.cfg_values_fontsize;
        this.values_color = applet.cfg_values_color;
        
        // SET AFTERWARDS OR BY THE APPLET
        this.location = "plain"; //"first" or "plain" or "last"
        this.width = 0;
        this.height = 0;
        this.colors = [];
        this.data = [];
        this.timestamps = [];
        this.dim = this.provider.getDim();
        this.autoScale = false;
        this.scale = 1;
        this.tooltip_scale = 0.98;

        // EVENTS:
        this.area.connect("repaint", ()=>this.paint());
        this._tooltip.area.connect("repaint", ()=>this.paint_tooltip());
    }

    get tooltip_history_seconds() {
        return this._applet.cfg_tooltip_history_seconds
    }

    get data_type() {
        return this.provider.constructor.name
    }

    /*******************
    HELPERS
    ********************/
    _set_prop(prop, value, callback = true) {
        // set value
        this[prop] = value
        // eventually call a callback
        if (callback && typeof this['on_set_'+prop] == 'function') {
            this['on_set_'+prop]();
        }
    }
    
    _set_source_color(cr, c) {
        var color = new Gdk.RGBA();
        color.parse(c);
        cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
    }

    _set_data_source_color(cr, i) {
        var c = this.colors[i % this.colors.length];
        this._set_source_color(cr, c)
    }

    _resizeData() {
        var crop_count = Math.min(
            this.timestamps.filter(ts=>ts<this.now-this.tooltip_history_seconds).length, //60s of records
            Math.max(0,this.data.length - this.area.width - 1) //"area width" nb of records
        )
        if(crop_count>0){
            this.data = this.data.slice(crop_count)
            this.timestamps = this.timestamps.slice(crop_count);
        }
    }

    
    /*******************
     MAIN FUNCTIONS
     ********************/
    
    delete() {
        this.actor.remove_all_children();
        this.actor.height=0;
        this.actor.width=0;
        this.actor.set_style('');
    }
    
    update() {
        this.now = new Date().getTime()/1000;
        this.refresh_data();
        this._resizeData();
        this.repaint();
        if (this._tooltip.visible){
            var text = this.provider.getText();
            var tooltip = "<b>" + text[0] + "</b> " + text[1];
            this._tooltip.set_text(tooltip);
            this._tooltip.area.queue_repaint();
        }
    }

    refresh_data() {
        var d = this.provider.getData();
        this.data.push(d);
        this.timestamps.push(new Date().getTime()/1000)
        
        // compute two scales below: one for the widget, one for the tooltip.
        if (this.autoScale)
        {
            var maxVal = this.minScale;
            var maxValTooltip = this.minScale
            for (var i = 0; i < this.data.length; ++i)
            {
                var sum = this.data_sum(i, this.dim - 1);
                if (sum > maxValTooltip) maxValTooltip = sum;
                if(this.area.width>=this.data.length -i && sum>maxVal ) maxVal = sum;
            }
            this.scale = 1.0 / maxVal;
            this.tooltip_scale = 1.0 / maxValTooltip;
        }
    }
    
    data_sum(i, depth) {
        var sum = 0;
        for (var j = 0; j <= depth; ++j)
            sum += this.data[i][j];
        return sum;
    }
    
    paint() {
        var cr = this.area.get_context()
        var graph_width = this.area.width;
        var graph_height = this.area.height;
        cr.setLineWidth(1);
        for (var i = 0; i < this.data.length; ++i) {
            if (i>graph_width) break;
            for (var j = this.dim - 1; j >= 0; --j) {
                this._set_data_source_color(cr, j);
                cr.moveTo(graph_width-i-0.5, graph_height);
                var v = Math.round(graph_height * Math.min(1, this.scale * this.data_sum(this.data.length-1-i, j)));
                cr.relLineTo(0, -v);
                cr.stroke();
            }
        }
        // Display values:
        if (this.show_values)
        {
            this.label_top.set_text(this.provider.getShortText()[0])
            if(this.data_type=="NetData"){
                if(this._applet.horizontal){
                    var max = (1/this.scale/1024/1024).toFixed(1);
                    this.label_top_right.set_text(max+'M↥')
                } else this.label_top_right.set_text("")
            }else if(this.data_type=="LoadAvgData"){
                if(this._applet.horizontal){
                    var max = (1/this.scale).toFixed(1);
                    this.label_top_right.set_text(max+'↥')
                } else this.label_top_right.set_text("")
            }
            this.label_top_right.set_position(graph_width-this.label_top_right.width+2,0)
            if(this._applet.vertical && this.data_type=='NetData') this.label_bottom.set_text(this.provider.getShortText()[1].replace(' ','\n').replace('iB/s', '')) // compact net data in vertical panel
            else this.label_bottom.set_text(this.provider.getShortText()[1])
        } else {
            this.label_top.set_text("")
            this.label_bottom.set_text("")
            this.label_top_right.set_text("")
        }
        cr.$dispose();
    }

    paint_tooltip() {
        // GRAPH ZONE SETUP
        var area = this._tooltip.area
        var cr = area.get_context()
        const pad_b = 20;
        const pad_t = 0;
        const pad_lr = 10;
        var graph_width = area.width - 2*pad_lr;
        var graph_height = area.height - pad_b;
        var tl = [pad_lr, pad_t]
        var bl = [pad_lr, pad_t+graph_height]
        var tr = [pad_lr+graph_width, pad_t]
        var br = [pad_lr+graph_width, pad_t+graph_height]

        // ACTUAL TRACE
        cr.setLineWidth(1);
        var max_v = 0;
        for (var j = this.dim - 1; j >= 0; --j) {
            this._set_data_source_color(cr, j);
            var data_overflow = false; //does the data overflows to the left in the horizontal direction ?
            for (var i = this.data.length-1; i >=0 ; --i) {
                var v = graph_height * Math.min(1, this.tooltip_scale * this.data_sum(i, j));
                if(this.data_type=='MemData'){
                    if(j==0 && v>max_v) max_v=v;
                } else {
                    if(v>max_v) max_v=v;
                }
                var t = br[0]-(this.now - this.timestamps[i])/this.tooltip_history_seconds*graph_width;
                if(t<bl[0]) {
                    data_overflow = true;
                    t=bl[0]+1
                }; //avoid graph to overflow to the graph left
                v = graph_height - v;
                if(i==this.data.length-1)
                    cr.moveTo(t,graph_height)
                cr.lineTo(t,v)
                if(data_overflow) break;
            }
            cr.lineTo(t, bl[1]);
            cr.fill();
        }

        // MAX HORIZONTAL LINE
        this._set_data_source_color(cr, 0);
        cr.setDash([3,3], 2);
        cr.setFontSize(10);
        cr.moveTo(bl[0],graph_height - max_v);
        cr.lineTo(br[0],graph_height - max_v);
        cr.stroke();
        this._set_source_color(cr, this._applet.cfg_tooltip_tick_labels_border_color)
        const label_y = graph_height-max_v>20 ? graph_height - max_v - 2 : graph_height - max_v + 12
        var text
        if(this.data_type=='NetData'){
            const val = max_v/graph_height/this.tooltip_scale/1024
            if(val>=1024) text = (val/1024).toFixed(1)+'MiB/s'
            else text = val.toFixed(1)+'KiB/s'
        }else if(this.data_type=='LoadAvgData'){
            text = (max_v/graph_height/this.tooltip_scale).toFixed(1)
        } else text = (max_v/graph_height/this.tooltip_scale*100).toFixed(0)+'%';
        cr.moveTo(br[0]-cr.textExtents(text).width-2, label_y)
        cr.showText( text );
        cr.setDash([],0);

        // BORDER
        cr.setLineWidth(1);
        this._set_source_color(cr, this._applet.cfg_tooltip_tick_labels_border_color);
        cr.rectangle(tl[0]+0.5, tl[1]+0.5, graph_width, graph_height);
        cr.stroke();

        // VETICAL GRID / TICKS
        cr.setLineWidth(1);
        cr.setFontSize(8);
        const grid_dashes = [3,3]
        var ticks_step = 5;
        var previous_tick = 1e20 // a high value
        var previous_label = 1e20 // a high value
        var tick_number = 0
        for(var t=0; t<=this.tooltip_history_seconds; t+=ticks_step){
            // Ticks
            var tx = Math.round(br[0]-t/this.tooltip_history_seconds*graph_width);
            if(previous_tick-tx<20) continue; // don't draw ticks too close from each other
            this._set_source_color(cr, this._applet.cfg_tooltip_tick_labels_border_color);
            cr.setDash([],0);
            cr.moveTo(tx+0.5,br[1]);
            cr.relLineTo(0,5);
            cr.stroke();
            // Grid
            cr.setDash(grid_dashes, grid_dashes.length);
            if(t!=0 && t!=this.tooltip_history_seconds){
                this._set_source_color(cr, this._applet.cfg_tooltip_grid_color);
                cr.moveTo(tx+0.5,br[1]);
                cr.lineTo(tx+0.5,1)
                cr.stroke();
            }
            previous_tick = tx;
            tick_number += 1
            // Ticks labels
            if( (tick_number%2==1 || t==0) && previous_label-tx>30) { // draw tick labels every 2 ticks, if the previous was not too close
                if(t>=100) // large labels need more space
                    cr.moveTo(tx+0.5-8, br[1]+10+5)
                else if(t==0) // first label must be put to the left a little
                    cr.moveTo(tx+0.5-3, br[1]+10+5)
                else // general case
                    cr.moveTo(tx+0.5-5, br[1]+10+5)
                    this._set_source_color(cr, this._applet.cfg_tooltip_tick_labels_border_color);
                cr.showText(String(t)+'s');
                previous_label = tx
            }
        }

        // HORIZONTAL TICKS / GRID
        cr.setLineWidth(1);
        cr.setFontSize(10);
        this._set_source_color(cr, this._applet.cfg_tooltip_grid_color);
        // Configure potential grid, note that values must be pushed in decreasing order.
        // How it works:
        // - horizontal lines that exceeds the graph height will have vy<0 (don't show)
        // - iterate horizontal lines in decreasing order, but don't draw one line if the previous has a vy too close from the previous one (this way, the large number of low values lines will not be displayed if there is no space.)
        var h_lines = [];
        if(this.data_type=='NetData'){
            [100,90,80,70,60,50,40,30,20,10,9,8,7,6,5,4,3,2,1].forEach(s=>{
                h_lines.push([1024*1024*s,`${s}MiB/s`]);
            });
            [900,800,700,600,500,400,300,200,100].forEach(s=>{
                h_lines.push([1024*s,`${s}KiB/s`]);
            });
        } else if(this.data_type=='LoadAvgData') {
            [100,90,80,70,60,50,40,30,25,20,15,10,9,8,7,6,5,4,3,2,1,0.8,0.6,0.4,0.2].forEach(l=>{
                h_lines.push([l,''+l]);
            });
        } else {
            h_lines = [[0.75,'75%'],[0.50,'50%'],[0.25,'25%']];
        }
        var previous_vy = -1e20; // a low value value
        h_lines.forEach(hl=>{
            var vy = Math.round(graph_height-graph_height*this.tooltip_scale*hl[0])+0.5
            if(vy<0 || vy-previous_vy<20) return //too high value || too close from previous line.
            this._set_source_color(cr, this._applet.cfg_tooltip_tick_labels_border_color);
            // In-graph labels
            if(vy<12) cr.moveTo(bl[0]+2,vy+10); //under the grid line
            else if(vy>graph_height-12) cr.moveTo(bl[0]+2,vy-2); //above the grid line
            else cr.moveTo(bl[0]+2,vy+4); //on the grid line
            cr.showText(hl[1]);
            // Actual grid lines
            this._set_source_color(cr, this._applet.cfg_tooltip_grid_color);
            cr.moveTo(bl[0]+0.5,vy);
            cr.lineTo(br[0],vy);
            cr.stroke();
            previous_vy = vy;
        });
        cr.$dispose();
    }
    
    set_auto_scale(minScale)
    {
        if (minScale > 0)
        {
            this.autoScale = true;
            this.minScale = minScale;
        }
        else
            this.autoScale = false;
    }

    repaint() {
        this.area.queue_repaint();
    }

    set_area_height() {
        this.area.height = this.height - (this.draw_border ? 2 : 0);
    }

    set_area_width() {
        this.area.width = this.width - (this.draw_border ? 2 : 0);
        this._resizeData();
    }

    refresh_actor_styles() {
        var border_style = '';
        var margin_style = '';
        if(this.draw_border){
            if(this._applet.horizontal) {
                border_style = `
                border-top: 1px solid ${this.border_color};
                border-bottom: 1px solid ${this.border_color};
                border-right: 1px solid ${this.border_color};
                `;
                if(this.spacing>0 || this.location=="first"){
                    border_style += `border-left: 1px solid ${this.border_color};`;
                }
            } else {
                border_style = `
                border-left: 1px solid ${this.border_color};
                border-bottom: 1px solid ${this.border_color};
                border-right: 1px solid ${this.border_color};
                `;
                if(this.spacing>0 || this.location=="first"){
                    border_style += `border-top: 1px solid ${this.border_color};`;
                } else border_style += `border-top: 0px solid ${this.border_color};`;
                // For a mysterious reason, border-top and its color has to be set in this precise configuration. Set it to width=0 to hide it.
                // If we don't set it, no borders at all are drawn...
            }
        }
        if (this.spacing>0 && this.location!="first") {
            if(this._applet.horizontal) {
                margin_style = `margin-left: ${this.spacing}px;`
            } else {
                margin_style = `margin-top: ${this.spacing}px;`
            }
        }
        this.actor.set_style(
            border_style + margin_style + `
            background-color: ${this.bg_color};
        `);
        this.actor.height = this.height;
        this.actor.width = this.width;
    }

    refresh_area_styles() {
        this.area.set_position(
            this.draw_border ? 1 : 0,
            this.draw_border ? 1 : 0
        )
    }

    refresh_labels_styles() {
        this.label_top.set_position(0,0);
        this.label_top.set_style(`
            font-size: ${this.values_fontsize-2}pt;
            padding-left: 2px;
            text-align: left;
            color: ${this.values_color};
        `);
        this.label_top_right.set_style(`
            font-size: ${this.values_fontsize-2}pt;
            padding-right: 2px;
            text-align: right;
            color: ${this.values_color};
        `);
        this.label_bottom.set_position(0,this.values_fontsize);
        this.label_bottom.set_style(`
            font-size: ${this.values_fontsize}pt;
            padding-left: 2px;
            text-align: left;
            color: ${this.values_color};
        `);
    }

    refresh_all() {
        // this should only be used at startup or when enabling a graph from configs.
        this.refresh_actor_styles();
        this.refresh_area_styles();
        this.refresh_labels_styles();
        this.set_area_width();
        this.repaint();
    }

    /*******************
    PROP CHANGES CALLBACKS
    ********************/
    on_set_draw_border() {
        this.refresh_actor_styles()
        this.refresh_area_styles()
        this.set_area_height()
        this.set_area_width()
        this.repaint()
    }

    on_set_width() {
        this.refresh_actor_styles()
        this.set_area_width()
        this.repaint()
    }

    on_set_height() {
        this.refresh_actor_styles()
        this.set_area_height()
        this.repaint()
    }

    on_set_show_values() {
        this.refresh_labels_styles()
    }

    on_set_values_fontsize() {
        this.refresh_labels_styles()
    }

    on_set_values_color() {
        this.refresh_labels_styles()
    }
    
    on_set_bg_color() {
        this.refresh_actor_styles()
    }

    on_set_border_color() {
        this.refresh_actor_styles()
    }

    on_set_colors() {
        this.repaint();
    }

    on_set_spacing() {
        this.refresh_actor_styles();
    }

}

class GraphicTooltip extends BoxLayoutTooltip {
    constructor(panelItem, initTitle, orientation){
        super(panelItem, initTitle, orientation);
        this.applet = panelItem._applet
        this.label = new St.Label();
        this.label.set_style(`
            margin-left: 5px;
            color: black;
        `)
        this._tooltip.add_child(this.label);
        this.label_max_scale

        this.area = new St.DrawingArea({
            width: 300,
            height: 150,
            reactive: true
        })
        this._tooltip.add_child(this.area);
        this.set_boxlayout_styles();
        this.set_label_styles();
    }

    set_boxlayout_styles() {
        this._tooltip.set_style(`
            background-color: ${this.applet.cfg_tooltip_background_color};
            border-radius: 7px;
            border: 2px solid;
            margin:5px;
        `)
    }

    set_label_styles() {
        this.label.set_style(`
            margin-left: 10px;
            color: ${this.applet.cfg_tooltip_label_color};
        `)
    }
    
    set_text(text) {
        this.label.clutter_text.set_markup(text);
    }

    show() {
        this.area.queue_repaint();
        super.show();
    }
}