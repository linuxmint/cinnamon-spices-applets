const { UiElement } = require('./js/ui/elements/uiElement');
const { IconTextElement } = require('./js/ui/elements/iconTextElement');
const { Compass } = require('./js/compass');

class RiseSetElement extends UiElement {
    constructor(app) {
        super(app);
        this.compass = new Compass(this.app);
        this.elementGenerator = new IconTextElement(this.app);
        this.iconName = null;
        this.iconSize = 0;
        this.header = null;
        this.dateObject = null;
        this.angle = 0;
    }

    create() {
        const direction = this.compass.getCardinalDirection(this.angle);

        // TODO: direction isn't styling properly
        const directionNameLabel = this.elementGenerator.generateLabel(direction.name);
        const directionArrowIcon = this.elementGenerator.generateIcon(direction.icon_name, 18);
        const directionAngleLabel = this.elementGenerator.generateLabel(`(${Math.floor(this.angle)}°)`);
        const directionLayout = this.elementGenerator.generateLayout([directionNameLabel, directionArrowIcon, directionAngleLabel], false, 'padding-top-5-strict');

        const datetimeHeaderLabel = this.elementGenerator.generateLabel(this.header, 'margin-bottom-5');
        const dateLabel = this.elementGenerator.generateLabel(this.dateObject.toLocaleDateString());
        const timeLabel = this.elementGenerator.generateLabel(this.dateObject.toLocaleTimeString());
        const datetimeLayout = this.elementGenerator.generateLayout([datetimeHeaderLabel, dateLabel, timeLabel], true, 'padding-top-3');

        this.actor.add_actor(this.elementGenerator.create(this.iconName, this.iconSize, [directionLayout, datetimeLayout], 'margin-5', 'margin-5'));
    }
}