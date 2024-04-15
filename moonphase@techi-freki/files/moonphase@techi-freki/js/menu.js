const { MoonTimes } = require('./js/ui/moonTimes');

class Menu {
    constructor(app) {
        this.app = app;
    }

    buildMenu() {
        const moonTimes = new MoonTimes(this.app);
        this.app.menu.addActor(moonTimes.actor);
    }
}