const { Align, BoxLayout, IconType, Icon, Label } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { UiElement } = require('./js/ui/elements/uiElement');

class CurrentPhaseUi extends UiElement {
    constructor (app) {
        super(app);
        this.actor = new BoxLayout({
            style_class: 'padding-15',
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE
        });
    }

    create() {
        const parent = new BoxLayout();
        const iconParent = new BoxLayout({ style_class: 'margin-5' });
        const infoParent = new BoxLayout({ vertical: true, style_class: 'margin-5; text-align-left' });
        const illumParent = new BoxLayout({ style_class: 'padding-top-5-strict' });
        const dateLabel = new Label({ text: new Date().toLocaleDateString() });
        const timeLabel = new Label({ text: new Date().toLocaleTimeString() });
        const illumLabel = new Label({ text: `${ Math.floor(this.app.moon.illumination.fraction * 100 * 100) / 100 }%` });
        const phaseLabel = new Label({ text: this.app.moon.currentPhaseName, style_class: 'margin-bottom-5' });
        const phaseIcon = new Icon({
            icon_name: this.app.moon.currentPhaseIcon,
            icon_type: IconType.SYMBOLIC,
            icon_size: 64
        });

        iconParent.add(phaseIcon);
        illumParent.add(illumLabel);

        infoParent.add(phaseLabel);
        infoParent.add(dateLabel);
        infoParent.add(timeLabel);
        infoParent.add(illumParent);

        parent.add(iconParent);
        parent.add(infoParent);
        parent.add(illumParent);

        this.actor.add_actor(parent);
    }
}