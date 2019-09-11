const Cairo = imports.cairo;
const Main = imports.ui.main;

//
// Class responsible for drawing an instance of one graph
//
class Graph {    
    constructor (provider, graphArea, theme) {
        this.provider = provider;
        this.graph = graphArea;
        this.theme = theme;

        this.datas = Array(this.graph.inner.width-1);

        for (let i = 0; i < this.datas.length; i++) {
            this.datas[i] = 0;
        }
    }

    paint(area) {
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
        this.drawGraphLines(cr);

        // Draw data points
        this.drawDataPoints(cr);

        // Draw label
        this.drawLabel(cr);

        // Reset translation
        cr.translate( -(this.graph.outer.left + 0.5), -(this.graph.outer.top + 0.5));
    }

    // Draw the border around the graph
    drawBorder(cr){
        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 0.5);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 0.5);
        else {
            cr.setSourceRGBA(this.theme.border_colors[0], this.theme.border_colors[1], this.theme.border_colors[2], 0.5);
        }
        cr.setLineWidth(1);
        cr.rectangle(0, 0, 
                    this.graph.outer.width, this.graph.outer.height);
        cr.stroke();
    }

    // Draw the graph background with a linear gradient between two colors
    drawBackground(cr) {
        let pattern = new Cairo.LinearGradient(0, 0, 0, this.graph.inner.height);
        
        if (this.theme.theme=="light") {
            pattern.addColorStopRGBA(0, 1, 1, 1, 0.4);
            pattern.addColorStopRGBA(1, 0, 0, 0, 0.4);
        } else if (this.theme.theme=="dark") {
            pattern.addColorStopRGBA(0, 1, 1, 1, 0.3);
            pattern.addColorStopRGBA(1, 0, 0, 0, 0.3);
        } else {
            pattern.addColorStopRGBA(0, this.theme.background_colors1[0], this.theme.background_colors1[1], this.theme.background_colors1[2], 0.7);
            pattern.addColorStopRGBA(1, this.theme.background_colors2[0], this.theme.background_colors2[1], this.theme.background_colors2[2], 0.7);
        }
        cr.setSource(pattern);
        cr.rectangle(0, 0, this.graph.inner.width, this.graph.inner.height);
        cr.fill();
    }

    // Draw the lines inside the graph
    drawGraphLines(cr) {
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
    }

    // Draw the data points, and fill the area with a linear gradient of four colors
    drawDataPoints(cr) {
        cr.setLineWidth(0);
        cr.moveTo(1, this.graph.inner.height - this.datas[0]);
        for (let i = 1; i < this.datas.length; i++) {
        	cr.lineTo(i + 1, this.graph.inner.height - this.datas[i]);
        }
    	cr.lineTo(this.datas.length, this.graph.inner.height);
        cr.lineTo(1, this.graph.inner.height);
    	cr.closePath();

        let pattern = new Cairo.LinearGradient(0, this.graph.inner.top, 0, this.graph.inner.top + this.graph.inner.height);
        cr.setSource(pattern);
        if (this.theme.theme=="user")
            pattern.addColorStopRGBA(0, this.theme.graph_color4[0], this.theme.graph_color4[1], this.theme.graph_color4[2], 1);
        else 
            pattern.addColorStopRGBA(0, 1, 0, 0, 1);

        if (this.theme.theme=="user")
            pattern.addColorStopRGBA(this.theme.graph_offset3, this.theme.graph_color3[0], this.theme.graph_color3[1], this.theme.graph_color3[2], 1);
        else 
            pattern.addColorStopRGBA(0.5, 1, 1, 0.2, 1);

        if (this.theme.theme=="user")
            pattern.addColorStopRGBA(this.theme.graph_offset2, this.theme.graph_color2[0], this.theme.graph_color2[1], this.theme.graph_color2[2], 1);
        else 
            pattern.addColorStopRGBA(0.7, 0.4, 1, 0.3, 1);

        if (this.theme.theme=="user")
            pattern.addColorStopRGBA(1, this.theme.graph_color1[0], this.theme.graph_color1[1], this.theme.graph_color1[2], 1);        
        else 
            pattern.addColorStopRGBA(1, 0.2, 0.7, 1, 1);
        cr.fill();
    }

    // Draw the text label on the graph
    drawLabel(cr) {
        let uiScale7x = global.ui_scale * 7;

        cr.setFontSize(uiScale7x);
        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 0.5);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 0.5);
        else {
            cr.setSourceRGBA(this.theme.label_color[0], this.theme.label_color[1], this.theme.label_color[2], 0.5);
        }
        cr.moveTo(global.ui_scale * 2.5, global.ui_scale * 7.5 + 0.5);

        if (this.theme.cpu_use_custom_label && this.provider.type == "CPU")
            cr.showText(this.theme.cpu_custom_label);
        else if (this.theme.mem_use_custom_label && this.provider.type == "MEM")
            cr.showText(this.theme.mem_custom_label);
        else if (this.theme.netin_use_custom_label && this.provider.type == "NETIN")
            cr.showText(this.theme.netin_custom_label);
        else if (this.theme.netout_use_custom_label && this.provider.type == "NETOUT")
            cr.showText(this.theme.netout_custom_label);
        else
            cr.showText(this.provider.name);

        if (this.theme.theme=="light")
            cr.setSourceRGBA(1, 1, 1, 1);
        else if (this.theme.theme=="dark")
            cr.setSourceRGBA(0, 0, 0, 1);
        else {
            cr.setSourceRGBA(this.theme.label_color[0], this.theme.label_color[1], this.theme.label_color[2], 1);
        }
        cr.moveTo(global.ui_scale * 2, uiScale7x + 0.5);

        if (this.theme.cpu_use_custom_label && this.provider.type == "CPU")
            cr.showText(this.theme.cpu_custom_label);
        else if (this.theme.mem_use_custom_label && this.provider.type == "MEM")
            cr.showText(this.theme.mem_custom_label);
        else if (this.theme.netin_use_custom_label && this.provider.type == "NETIN")
            cr.showText(this.theme.netin_custom_label);
        else if (this.theme.netout_use_custom_label && this.provider.type == "NETOUT")
            cr.showText(this.theme.netout_custom_label);
        else
            cr.showText(this.provider.name);
    }

    refreshData() {
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
