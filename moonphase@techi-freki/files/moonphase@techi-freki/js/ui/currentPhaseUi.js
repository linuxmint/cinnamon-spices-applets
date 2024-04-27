const { Align, BoxLayout, IconType, Icon, Label } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { UiElement } = require('./js/ui/elements/uiElement');

class CurrentPhaseUi extends UiElement {
    constructor (app) {
        super(app);
        this.actor = new BoxLayout({
            style_class: 'padding-15; align-center',
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE
        });
    }

    create() {
        const parent = new BoxLayout({ vertical: true });
        const iconParent = new BoxLayout({ style_class: 'margin-5' });
        const infoParent = new BoxLayout({ vertical: true, style_class: 'margin-5' });
        const dateLabel = new Label({ text: new Date().toLocaleDateString() });
        const timeLabel = new Label({ text: new Date().toLocaleTimeString() });
        // TODO: currentPhaseName is coming back as 'Moon Phase', needs to report correctly
        const phaseLabel = new Label({ text: this.app.moon.currentPhaseName, style_class: 'margin-bottom-5' });
        const phaseIcon = new Icon({
            icon_name: this.app.moon.currentPhaseIcon,
            icon_type: IconType.SYMBOLIC,
            icon_size: 64
        });

        iconParent.add(phaseIcon);

        infoParent.add(phaseLabel);
        infoParent.add(dateLabel);
        infoParent.add(timeLabel);

        parent.add(iconParent);
        parent.add(infoParent);

        this.actor.add_actor(parent);
    }
}