const St = imports.gi.St;

//
// Class responsible for keeping track of the entire applet area
//
class AppletArea {
    constructor(parent, isHorizontal, appletWidth, appletHeight) {        
        this.isHorizontal = isHorizontal;
        this.graphArea = [];
        this.parent = parent;

        if (this.isHorizontal) {
            this.height = appletHeight;
            this.width = 0;
        } else {
            this.height = 0;
            this.width = appletWidth;
        }
    }

    // Adds a new graph
    addGraph(graphWidth, graphHeight) {
        let area = new GraphArea(this, graphWidth, graphHeight);
        this.graphArea.push(area);
        
        // Make place for the new graph
        if (this.isHorizontal)
            this.width += graphWidth;
        else
            this.height += graphHeight;

        return area;
    }

    // Creates a new drawing area
    createDrawingArea() {
        this.destroyDrawingArea();
        this.drawingArea = new St.DrawingArea();
        this.drawingArea.height = this.height;
        this.drawingArea.width = this.width;
    }

    // Destroys an existing drawing area
    destroyDrawingArea() {
        if (this.drawingArea) {
            this.parent.actor.remove_actor(this.drawingArea);    
            this.drawingArea = null;        
        }
    }
}

//
// Class responsible for keeping track of one of the graphs
//
class GraphArea {    
    constructor(parent, width, height) {
        this.width = width;
        this.height = height;
        this.graph = null;

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

//
// Just a square class
//
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
