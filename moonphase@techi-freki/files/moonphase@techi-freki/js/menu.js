const { RiseSetUi } = require('./js/ui/riseSetUi');

class Menu {
    constructor(app) {
        this.app = app;
    }

    buildMenu() {
        // TODO: Handle user selections
        const riseSetUi = new RiseSetUi(this.app);
        riseSetUi.rebuild();
        this.app.menu.addActor(riseSetUi.actor);
    }
}