const { HeaderUi } = require('./js/ui/headerUi');
const { CurrentPhaseUi } = require('./js/ui/currentPhaseUi');
const { RiseSetUi } = require('./js/ui/riseSetUi');

class Menu {
    constructor(app) {
        this.app = app;
    }

    buildMenu() {
        const headerUi = new HeaderUi(this.app);
        const currentPhaseUi = new CurrentPhaseUi(this.app);
        const riseSetUi = new RiseSetUi(this.app);

        headerUi.rebuild();
        currentPhaseUi.rebuild();
        riseSetUi.rebuild();

        this.app.menu.addActor(headerUi.actor);
        this.app.menu.addActor(currentPhaseUi.actor);
        this.app.menu.addActor(riseSetUi.actor);
    }
}