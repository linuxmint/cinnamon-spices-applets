const { BoxLayout } = imports.gi.St;

class TimeBox {
    constructor(icon, header, info) {
        this.icon = icon;
        this.header = header;
        this.info = info;
        this.actor = this._createBox();
    }

    _createBox() {
        const holder = new BoxLayout({ style_class: 'margin-5' });
        const iconBox = new BoxLayout({ style_class: 'margin-5' });
        const labelBox = new BoxLayout({ vertical: true, style_class: 'padding-top-3' });
        const angleBox = new BoxLayout({ vertical: false, style_class: 'padding-top-5-strict' });

        angleBox.add(this.info.angleDirection);
        angleBox.add(this.info.angleIcon);
        angleBox.add(this.info.angleDegrees);

        iconBox.add(this.icon);

        labelBox.add(this.header);
        labelBox.add(this.info.date);
        labelBox.add(this.info.time);
        labelBox.add(angleBox);

        holder.add(iconBox);
        holder.add(labelBox);

        return holder;
    }
}