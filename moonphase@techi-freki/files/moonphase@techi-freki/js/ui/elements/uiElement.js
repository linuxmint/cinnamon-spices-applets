const { BoxLayout } = imports.gi.St;

class UiElement {
    constructor(app) {
        this.app = app;
        this.actor = new BoxLayout();
    }

    destroy() {
        this.actor.destroy_all_children();
    }

    create() {
        throw new Error('Must implement create abstract method');
    }

    rebuild() {
        this.destroy();
        this.create();
    }
}