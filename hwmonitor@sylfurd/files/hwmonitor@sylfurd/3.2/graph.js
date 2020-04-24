const Cairo = imports.cairo;
const Main = imports.ui.main;

//
// Class responsible for drawing an instance of one graph
//
function Graph(provider, graphArea, theme, show_detail) {
    this.init(provider, graphArea, theme, show_detail);
}

Graph.prototype = {    
    init : function(provider, graphArea, theme, show_detail) {
        this.provider = provider;
        this.graph = graphArea;
        this.theme = theme;
        this.show_detail = show_detail;

        this.datas = Array(this.graph.inner.width + 1);

        for (let i = 0; i < this.datas.length; i++) {
            this.datas[i] = 0;
        }
    },

    paint : function(area) {
        let cr = area.get_context();

        // Since Cairo uses antialiasing, we need to translate all coordinates
        // by half a pixel rather than having to deal with half a pixel everywhere
        // See for example: https://stackoverflow.com/questions/8696631/canvas-drawings-like-lines-are-blurry
        // We also translate to the (outer.left,outer.top) corner.
        cr.translate(this.graph.outer.left + 0.5, this.graph.outer.top + 0.5);

        // Draw border
        this.drawBorder(cr);

		// Draw background
        this.drawBackground(cr);

        // Draw graph grid lines
        if (this.theme.graph_line_mode=="graph")
            this.drawGraphLines(cr);

        // Draw data points
        this.drawDataPoints(cr);

        if (this.theme.graph_line_mode=="lines")
            this.drawGraphLines(cr);

            // Draw label
        this.drawLabel(cr);

        // Draw detail label
        if (this.show_detail)
            this.drawDetailLabel(cr);

        // Reset translation
        cr.translate( -(this.graph.outer.left + 0.5), -(this.graph.outer.top + 0.5));
    },

    // Draw the border around the graph
    drawBorder : function(cr){
        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 0.5);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 0.5);
        else if (this.theme.theme=="gray")
            cr.setSourceRGBA(0.18, 0.204, 0.212, 0.5);
        else {
            cr.setSourceRGBA(this.theme.border_colors[0], this.theme.border_colors[1], this.theme.border_colors[2], 0.5);
        }
        cr.setLineWidth(1);
        cr.rectangle(0, 0, 
                    this.graph.outer.width, this.graph.outer.height);
        cr.stroke();
    },

    // Draw the graph background with a linear gradient between two colors
    drawBackground : function(cr) {
        let pattern = new Cairo.LinearGradient(0, 0, 0, this.graph.inner.height);
        
        if (this.theme.theme=="light") {
            pattern.addColorStopRGBA(0, 1, 1, 1, 0.4);
            pattern.addColorStopRGBA(1, 0, 0, 0, 0.4);
        } else if (this.theme.theme=="dark") {
            pattern.addColorStopRGBA(0, 1, 1, 1, 0.3);
            pattern.addColorStopRGBA(1, 0, 0, 0, 0.3);
        } else if (this.theme.theme=="gray") {
            pattern.addColorStopRGBA(0, 0.18, 0.204, 0.212, 0.3);
            pattern.addColorStopRGBA(1, 0.18, 0.204, 0.212, 0.3);
        } else {
            pattern.addColorStopRGBA(0, this.theme.background_colors1[0], this.theme.background_colors1[1], this.theme.background_colors1[2], 0.7);
            pattern.addColorStopRGBA(1, this.theme.background_colors2[0], this.theme.background_colors2[1], this.theme.background_colors2[2], 0.7);
        }
        cr.setSource(pattern);
        cr.rectangle(0, 0, this.graph.inner.width, this.graph.inner.height);
        cr.fill();
    },

    // Draw the lines inside the graph
    drawGraphLines : function(cr) {
        let widthOffset1 = Math.round(this.graph.inner.width * 0.5);
        let widthOffset2 = Math.round(this.graph.inner.width * 0.25);
        let widthOffset3 = Math.round(this.graph.inner.width * 0.75);
        let heightOffset1 = Math.round(this.graph.inner.height * 0.5);
        let heightOffset2 = Math.round(this.graph.inner.height * 0.25);
        let heightOffset3 = Math.round(this.graph.inner.height * 0.75);

        cr.setLineWidth(1);
        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 0.4);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 0.4);
        else if (this.theme.theme=="gray")
            cr.setSourceRGBA(0.18, 0.204, 0.212, 0.5);
        else {
            cr.setSourceRGBA(this.theme.border_colors[0], this.theme.border_colors[1], this.theme.border_colors[2], 0.4);
        }
        // Center horizontal line
        cr.moveTo(1, heightOffset1);
        cr.lineTo(this.graph.inner.width, heightOffset1);
        cr.stroke();
        // Center vertical line
        cr.moveTo(widthOffset1, 1);
        cr.lineTo(widthOffset1, this.graph.inner.height);
        cr.stroke();
        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 0.2);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 0.2);
        else if (this.theme.theme=="gray")
            cr.setSourceRGBA(0.18, 0.204, 0.212, 0.5);
        else {
            cr.setSourceRGBA(this.theme.border_colors[0], this.theme.border_colors[1], this.theme.border_colors[2], 0.2);
        }
        // 25% horizontal line
        cr.moveTo(1, heightOffset2);
        cr.lineTo(this.graph.inner.width, heightOffset2);
        cr.stroke();
        // 75% horizontal line
        cr.moveTo(1, heightOffset3);
        cr.lineTo(this.graph.inner.width, heightOffset3);
        cr.stroke();
        // 25% vertical line
        cr.moveTo(widthOffset2, 1);
        cr.lineTo(widthOffset2, this.graph.inner.height);
        cr.stroke();
        // 75% vertical line
        cr.moveTo(widthOffset3, 1);
        cr.lineTo(widthOffset3, this.graph.inner.height);
        cr.stroke();
    },

    // Draw the data points, and fill the area with a linear gradient of four colors
    drawDataPoints : function(cr) {
        cr.setLineWidth(0);
        cr.moveTo(1, this.graph.inner.height - this.datas[0]);
        for (let i = 0; i < this.datas.length; i++) {
        	cr.lineTo(i, this.graph.inner.height - this.datas[i]);
        }
    	cr.lineTo(this.datas.length - 1, this.graph.inner.height);
        cr.lineTo(0, this.graph.inner.height);
    	cr.closePath();

        let pattern = new Cairo.LinearGradient(0, this.graph.inner.top, 0, this.graph.inner.top + this.graph.inner.height);
        cr.setSource(pattern);
        if (this.theme.theme_data=="user")
            pattern.addColorStopRGBA(this.r(0), this.theme.graph_color4[0], this.theme.graph_color4[1], this.theme.graph_color4[2], 1);
        else if (this.theme.theme_data=="default")
            pattern.addColorStopRGBA(this.r(0), 1, 0, 0, 1);
        else if (this.theme.theme_data=="blue")
            pattern.addColorStopRGBA(this.r(0), 0.730, 0.741, 0.714, 1);
        else if (this.theme.theme_data=="gray")
            pattern.addColorStopRGBA(this.r(0), 0.730, 0.741, 0.714, 1);

        if (this.theme.theme_data=="user")
            pattern.addColorStopRGBA(this.r(this.theme.graph_offset3), this.theme.graph_color3[0], this.theme.graph_color3[1], this.theme.graph_color3[2], 1);
        else if (this.theme.theme_data=="default")
            pattern.addColorStopRGBA(this.r(0.5), 1, 1, 0.2, 1);
        else if (this.theme.theme_data=="blue")
            pattern.addColorStopRGBA(this.r(0.3), 0.447, 0.624, 0.812, 1);
        else if (this.theme.theme_data=="gray")
            pattern.addColorStopRGBA(this.r(0.3), 0.533, 0.544, 0.521, 1);

        if (this.theme.theme_data=="user")
            pattern.addColorStopRGBA(this.r(this.theme.graph_offset2), this.theme.graph_color2[0], this.theme.graph_color2[1], this.theme.graph_color2[2], 1);
        else if (this.theme.theme_data=="default")
            pattern.addColorStopRGBA(this.r(0.7), 0.4, 1, 0.3, 1);
        else if (this.theme.theme_data=="blue")
            pattern.addColorStopRGBA(this.r(0.52), 0.204, 0.396, 0.643, 1);
        else if (this.theme.theme_data=="gray")
            pattern.addColorStopRGBA(this.r(0.52), 0.33, 0.34, 0.326, 1);

        if (this.theme.theme_data=="user")
            pattern.addColorStopRGBA(this.r(1), this.theme.graph_color1[0], this.theme.graph_color1[1], this.theme.graph_color1[2], 1);        
        else if (this.theme.theme_data=="default")
            pattern.addColorStopRGBA(this.r(1), 0.2, 0.7, 1, 1);
        else if (this.theme.theme_data=="blue")
            pattern.addColorStopRGBA(this.r(0), 0.125, 0.29, 0.529, 1);
        else if (this.theme.theme_data=="gray")
            pattern.addColorStopRGBA(this.r(1), 0.18, 0.204, 0.212, 1);

        cr.fill();
    },

    // Reverse the value for BAT graph
    r: function(value) {
        if (this.provider.type=="BAT") {
            return 1-value;
        }
        return value;
    },

    // Draw the text label on the graph
    drawLabel : function(cr) {
        cr.setFontSize(this.theme.label_size);
        if (this.theme.theme=="light")
            cr.setSourceRGBA(0.8, 0.8, 0.8, 0.5);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0.2, 0.2, 0.2, 0.5);
        else if (this.theme.theme=="gray")
            cr.setSourceRGBA(1, 1, 1, 0.5);
        else {
            cr.setSourceRGBA(this.theme.label_color[0], this.theme.label_color[1], this.theme.label_color[2], 0.5);
        }
        cr.moveTo(global.ui_scale * 1.5, global.ui_scale * this.theme.label_size + 1);

        if (this.theme.cpu_use_custom_label && this.provider.type == "CPU")
            cr.showText(this.theme.cpu_custom_label);
        else if (this.theme.mem_use_custom_label && this.provider.type == "MEM")
            cr.showText(this.theme.mem_custom_label);
        else if (this.theme.netin_use_custom_label && this.provider.type == "NETIN")
            cr.showText(this.theme.netin_custom_label);
        else if (this.theme.netout_use_custom_label && this.provider.type == "NETOUT")
            cr.showText(this.theme.netout_custom_label);
        else if (this.theme.diskread_use_custom_label && this.provider.type == "DISKREAD")
            cr.showText(this.theme.diskread_custom_label);
        else if (this.theme.diskwrite_use_custom_label && this.provider.type == "DISKWRITE")
            cr.showText(this.theme.diskwrite_custom_label);
        else if (this.theme.bat_use_custom_label && this.provider.type == "BAT")
            cr.showText(this.theme.bat_custom_label);
        else
            cr.showText(this.provider.name);

        if (this.theme.theme=="light")
            cr.setSourceRGBA(0.8, 0.8, 0.8, 1);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0.2, 0.2, 0.2, 1);
        else if (this.theme.theme=="gray")
            cr.setSourceRGBA(1, 1, 1, 0.5);
        else {
            cr.setSourceRGBA(this.theme.label_color[0], this.theme.label_color[1], this.theme.label_color[2], 1);
        }
        cr.moveTo(global.ui_scale * 1, global.ui_scale * this.theme.label_size + 0.5);

        if (this.theme.cpu_use_custom_label && this.provider.type == "CPU")
            cr.showText(this.theme.cpu_custom_label);
        else if (this.theme.mem_use_custom_label && this.provider.type == "MEM")
            cr.showText(this.theme.mem_custom_label);
        else if (this.theme.netin_use_custom_label && this.provider.type == "NETIN")
            cr.showText(this.theme.netin_custom_label);
        else if (this.theme.netout_use_custom_label && this.provider.type == "NETOUT")
            cr.showText(this.theme.netout_custom_label);
        else if (this.theme.diskread_use_custom_label && this.provider.type == "DISKREAD")
            cr.showText(this.theme.diskread_custom_label);
        else if (this.theme.diskwrite_use_custom_label && this.provider.type == "DISKWRITE")
            cr.showText(this.theme.diskwrite_custom_label);
        else if (this.theme.bat_use_custom_label && this.provider.type == "BAT")
            cr.showText(this.theme.bat_custom_label);
        else
            cr.showText(this.provider.name);
    },


    // Draw the text label on the graph
    drawDetailLabel : function(cr) {
        if (this.provider.text==null)
            return;

        cr.setFontSize(this.theme.detail_label_size);
        if (this.theme.theme=="light")
            cr.setSourceRGBA(0.7, 0.7, 0.7, 0.5);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0.1, 0.1, 0.1, 0.5);
        else if (this.theme.theme=="gray")
            cr.setSourceRGBA(1, 1, 1, 0.5);
        else {
            cr.setSourceRGBA(this.theme.detail_label_color[0], this.theme.detail_label_color[1], this.theme.detail_label_color[2], 0.5);
        }
        cr.moveTo(global.ui_scale * 1.5, global.ui_scale * (this.theme.label_size + this.theme.detail_label_size + 0.5) + 0.5);
        
        cr.showText(this.provider.text);

        if (this.theme.theme=="light")
            cr.setSourceRGBA(0.7, 0.7, 0.7, 1);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0.1, 0.1, 0.1, 1);
        else if (this.theme.theme=="gray")
            cr.setSourceRGBA(1, 1, 1, 0.5);
        else {
            cr.setSourceRGBA(this.theme.detail_label_color[0], this.theme.detail_label_color[1], this.theme.detail_label_color[2], 1);
        }
        cr.moveTo(global.ui_scale * 1, global.ui_scale * (this.theme.label_size + this.theme.detail_label_size) + 0.5);

        cr.showText(this.provider.text);
    },

    refreshData : function() {
        try {
            let data = this.provider.getData() * (this.graph.inner.height - 1);

            if (this.datas.push(data) > this.graph.inner.width - 2) {
                this.datas.shift();
            }                
        } catch (error) {
            global.logError("Exception in RefreshData() : " + error.message);
        }
    }
};
