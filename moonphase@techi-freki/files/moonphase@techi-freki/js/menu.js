const { MoonTimes } = require('./js/ui/moonTimes');
const { RiseSetUi } = require('./js/ui/riseSetUi');

class Menu {
    constructor(app) {
        this.app = app;
    }

    buildMenu() {
        const moonTimes = new MoonTimes(this.app);
        this.app.menu.addActor(moonTimes.actor);
    }
}