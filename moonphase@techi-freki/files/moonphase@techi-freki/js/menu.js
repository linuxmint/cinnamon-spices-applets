const { MoonTimes } = require('./js/ui/moonTimes');
const { RiseSetUi } = require('./js/ui/riseSetUi');

class Menu {
    constructor(app) {
        this.app = app;
    }

    buildMenu() {
        const moonTimes = new RiseSetUi(this.app);
        moonTimes.create();
        this.app.menu.addActor(moonTimes.actor);
    }
}