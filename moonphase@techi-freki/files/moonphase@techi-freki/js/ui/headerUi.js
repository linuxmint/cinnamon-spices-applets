const { BoxLayout, Label, Alight } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;

class HeaderUi {
    constructor(app) {
        this.app = app;
        // TODO: Build out a header ({ Applet Name } v{ version })
    }

    create() {
        const parent = new BoxLayout({ x_align: ActorAlign.CENTER, y_align: Align.MIDDLE, style_class: 'margin-5; align-center' });

        this.actor.add_actor(parent);
    }
}