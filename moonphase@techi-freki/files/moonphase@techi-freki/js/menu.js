const { CurrentPhaseUi } = require('./js/ui/currentPhaseUi');
const { RiseSetUi } = require('./js/ui/riseSetUi');

class Menu {
    constructor(app) {
        this.app = app;
    }

    buildMenu() {
        // TODO: Handle user selections
        // TODO: Fix setting changes to update in real time
        const currentPhaseUi = new CurrentPhaseUi(this.app);
        const riseSetUi = new RiseSetUi(this.app);

        currentPhaseUi.rebuild();
        riseSetUi.rebuild();

        this.app.menu.addActor(currentPhaseUi.actor);
        this.app.menu.addActor(riseSetUi.actor);
    }
}