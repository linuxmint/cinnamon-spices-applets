const { BoxLayout, Align } = imports.gi.St;

class TimeBox {
    constructor(icon, header, info) {
        this.icon = icon;
        this.header = header;
        this.info = info;
        this.actor = this._createBox();
    }

    _createBox() {
        const holder = new BoxLayout({ style_class: 'margin-15' });
        const iconBox = new BoxLayout({ style_class: 'margin-10' });
        const labelBox = new BoxLayout({ vertical: true, style_class: 'margin-5' });

        iconBox.add(this.icon);
        labelBox.add(this.header);
        labelBox.add(this.info.date);
        labelBox.add(this.info.time);

        holder.add(iconBox);
        holder.add(labelBox);

        return holder;
    }
}