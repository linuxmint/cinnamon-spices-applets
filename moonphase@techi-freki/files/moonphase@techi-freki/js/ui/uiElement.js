const { BoxLayout } = imports.gi.St;

class UiElement {
    constructor(app) {
        this.app = app;
        this.actor = new BoxLayout();

        // TODO: build out a base class for ui elements
    }

    destroy() {
        this.actor.destroy_all_children();
    }

    create() {
        throw new Error('Must implement create abstract method');
    }

    rebuild() {
        throw new Error('Must implement build abstract method');
    }
}