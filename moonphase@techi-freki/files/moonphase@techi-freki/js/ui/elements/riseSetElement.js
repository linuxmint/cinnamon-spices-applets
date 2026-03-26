const { marginBottom5, margin5 } = require('./js/ui/styles');
const { UiElement } = require('./js/ui/elements/uiElement');
const { IconTextElementGenerator } = require('./js/ui/elements/iconTextElementGenerator');
const { Compass } = require('./js/compass');

class RiseSetElement extends UiElement {
    constructor(app) {
        super(app);
        this.compass = new Compass(this.app);
        this.elementGenerator = new IconTextElementGenerator();
        this.iconName = null;
        this.iconSize = 0;
        this.header = null;
        this.dateObject = null;
        this.angle = 0;
        this.vertical = false;
    }

    create() {
        const direction = this.compass.getCardinalDirection(this.angle);

        const headerLabel = this.elementGenerator.generateLabel(this.header, marginBottom5);
        const dateLabel = this.elementGenerator.generateLabel(this.dateObject.toLocaleDateString());
        const timeLabel = this.elementGenerator.generateLabel(this.dateObject.toLocaleTimeString(), marginBottom5);
        const datetimeLayout = this.elementGenerator.generateLayout([headerLabel, dateLabel, timeLabel], true);

        const directionNameLabel = this.elementGenerator.generateLabel(direction.name);
        const directionArrowIcon = this.elementGenerator.generateIcon(direction.icon_name, 18);
        const directionAngleLabel = this.elementGenerator.generateLabel(`(${Math.floor(this.angle)}°)`);
        const directionLayout = this.elementGenerator.generateLayout([directionNameLabel, directionArrowIcon, directionAngleLabel], false);

        const infoLayout = this.elementGenerator.generateLayout([datetimeLayout, directionLayout], true);

        this.actor.add_actor(this.elementGenerator.generateElement(this.iconName, this.iconSize, [infoLayout], margin5, margin5));
    }
}