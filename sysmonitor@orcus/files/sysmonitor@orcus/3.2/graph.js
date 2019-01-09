const Lang = imports.lang;

function Graph(area, provider, colors) {
    this._init(area, provider, colors);
}

Graph.prototype = {
    _init: function(area, provider) {
        this.area = area;
        this.provider = provider;
        this.colors = [[1,1,1,1]];
        this.bg_color = [0,0,0,1];
        this.border_color = [1,1,1,1];
        this.smooth = false;
        this.data = [];
        this.dim = this.provider.getDim();
        this.autoScale = false;
        this.scale = 1;
        this.width = 1;
        this.draw_border = true;
        this.paint_queued = false;
        this.area.connect('repaint', Lang.bind(this, function() {this.paint();}));
    },
    
    _setColor: function(cr, i) {
        let c = this.colors[i % this.colors.length];
        cr.setSourceRGBA(c[0], c[1], c[2], c[3]);
    },

    _resizeData: function() {
        let datasize = this.width - (this.draw_border ? 2 : 0);
        if (datasize > this.data.length) {
            let d = Array(datasize - this.data.length);
            for (let i = 0; i < d.length; i++) {
                d[i] = Array(this.dim);
                for (let j = 0; j < this.dim; j++)
                    d[i][j] = 0;
            }
            this.data = d.concat(this.data);
        }
        else if (datasize < this.data.length)
            this.data = this.data.slice(this.data.length - datasize);
    },

    updateSize: function() {
        this.width = null;
        this.repaint();
    },

    setWidth: function(width, vertical) {
        if (vertical) {
            this.area.set_width(-1);
            this.area.set_height(width);
        }
        else {
            this.area.set_width(width);
            this.area.set_height(-1);
        }
        this.updateSize();
    },

    setDrawBorder: function(draw_border) {
        this.draw_border = draw_border;
        this.updateSize();
    },
    
    setColors: function(c) {
        this.colors = c;
        this.repaint();
    },

    refresh: function() {
        let d = this.provider.getData();
        this.data.push(d);
        this.data.shift();
        
        if (this.autoScale)
        {
            let maxVal = this.minScale;
            for (let i = 0; i < this.data.length; ++i)
            {
                let sum = this.dataSum(i, this.dim - 1);
                if (sum > maxVal)
                    maxVal = sum;
            }
            this.scale = 1.0 / maxVal;
        }
        this.repaint();
    },
    
    dataSum: function(i, depth) {
        let sum = 0;
        for (let j = 0; j <= depth; ++j)
            sum += this.data[i][j];
        return sum;
    },
    
    repaint: function() {
        if (!this.paint_queued) {
            this.paint_queued = true;
            this.area.queue_repaint();
        }
    },
    
    paint: function() {
        this.paint_queued = false;
        let cr = this.area.get_context();
        let [width, height] = this.area.get_size();
        if (!this.width) {
            this.width = width;
            this._resizeData();
        }
        let border_width = this.draw_border ? 1 : 0;
        let graph_width = width - 2 * border_width;
        let graph_height = height - 2 * border_width;
        cr.setLineWidth(1);
        //background
        cr.setSourceRGBA(this.bg_color[0], this.bg_color[1], this.bg_color[2], this.bg_color[3]);
        cr.rectangle(border_width, border_width, graph_width, graph_height);
        cr.fill();
        //data
        if (this.smooth)
        {
            for (let j = this.dim - 1; j >= 0; --j) {
                this._setColor(cr, j);
                cr.moveTo(border_width, graph_height + border_width);
                for (let i = 0; i < this.data.length; ++i) {
                    let v = Math.round(graph_height * Math.min(1, this.scale * this.dataSum(i, j)));
                    v = graph_height + border_width - v;
                    if (i == 0)
                        cr.lineTo(i + border_width, v);
                    cr.lineTo(i + border_width + 0.5, v);
                    if (i == this.data.length - 1)
                        cr.lineTo(i + border_width + 1, v);
                }
                cr.lineTo(graph_width + border_width, graph_height + border_width);
                cr.lineTo(border_width, graph_height + border_width);
                cr.fill();
            }
        }
        else
        {
            for (let i = 0; i < this.data.length; ++i) {
                for (let j = this.dim - 1; j >= 0; --j) {
                    this._setColor(cr, j);
                    cr.moveTo(i + border_width + 0.5, graph_height + border_width);
                    let v = Math.round(graph_height * Math.min(1, this.scale * this.dataSum(i, j)));
                    cr.relLineTo(0, -v);
                    cr.stroke();
                }
            }
        }
        //border
        if (this.draw_border) {
            cr.setSourceRGBA(this.border_color[0], this.border_color[1], this.border_color[2], this.border_color[3]);
            cr.rectangle(0.5, 0.5, width - 1, height - 1);
            cr.stroke();
        }
    },
    
    setAutoScale: function(minScale)
    {
        if (minScale > 0)
        {
            this.autoScale = true;
            this.minScale = minScale;
        }
        else
            this.autoScale = false;
    }
};
