
// Class responsible for keeping track of the entire applet area
class AppletArea {
    init(isHorizontal, graphWidth, graphHeight) {
        this.isHorizontal = isHorizontal;

        if (this.isHorizontal) {
            // An area big enough to have two graphs next to each other
            this.height = graphHeight;
            this.width = graphWidth * 2;

        } else {
            // An area big enough to have two graphs on top of each other
            this.height = graphHeight * 2;
            this.width = graphWidth;
        }

        this.graph = [];
        this.graph[0] = new GraphArea();
        this.graph[0].init(this, graphWidth, graphHeight);
        this.graph[1] = new GraphArea();
        this.graph[1].init(this, graphWidth, graphHeight);
    }
}

// Class responsible for keeping track of the area for one of the graphs
class GraphArea {    
    init(parent, width, height) {
        // Set the actual drawing area of the graph
        // which is sligthly smaller because of themes,
        // borders and space between graphs etc
        if (parent.isHorizontal) {
            this.outer = new Box();
            this.outer.init(2, 0, width - 4, height - 6);

            this.inner = new Box();
            this.inner.initFromBox(this.outer, 1);
        } else {
            this.outer = new Box();
            this.outer.init(0, 3, width - 8, height - 4);

            this.inner = new Box();
            this.inner.initFromBox(this.outer, 1);
        }
    }
}

// Just a square class
class Box {
    init(top, left, width, height) {
        this.top = top;
        this.left = left;
        this.width = width;
        this.height = height;
    }

    initFromBox(box, delta) {
        this.top = box.top + delta;
        this.left = box.left + delta;
        this.width = box.width;
        this.height = box.height;
    }
}
