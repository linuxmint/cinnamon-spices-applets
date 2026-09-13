const St = imports.gi.St;

let _probe = null;

function clutterColorToCssRgba(color, alphaFactor) {
    if (!color)
        return null;

    const red = color.red;
    const green = color.green;
    const blue = color.blue;
    if (red === undefined || green === undefined || blue === undefined)
        return null;

    let alpha = color.alpha === undefined ? 1 : color.alpha / 255;
    if (alphaFactor !== undefined && alphaFactor !== null)
        alpha *= alphaFactor;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function readSliderActiveColor(actor, alphaFactor) {
    if (!actor || typeof actor.get_theme_node !== "function")
        return null;

    try {
        const node = actor.get_theme_node();
        if (!node || typeof node.get_color !== "function")
            return null;
        /* Same property/name Cinnamon uses in js/ui/slider.js */
        const sliderActiveColor = node.get_color("-slider-active-background-color");
        return clutterColorToCssRgba(sliderActiveColor, alphaFactor);
    } catch (e) {
        return null;
    }
}

function _attachProbeToStage(probe) {
    try {
        if (typeof global === "undefined" || !global.stage)
            return;

        if (typeof global.stage.add_child === "function")
            global.stage.add_child(probe);
        else if (typeof global.stage.add_actor === "function")
            global.stage.add_actor(probe);
    } catch (e) {
        /* Stage may be unavailable in offline tests. */
    }
}

function getSliderActiveColorProbe() {
    if (_probe)
        return _probe;

    _probe = new St.Widget({
        style_class: "popup-slider-menu-item",
        visible: false,
        reactive: false
    });
    _attachProbeToStage(_probe);
    return _probe;
}

function getSliderActiveColor(alphaFactor) {
    return readSliderActiveColor(getSliderActiveColorProbe(), alphaFactor);
}

function connectSliderActiveColorChanged(callback) {
    const ids = [];
    const probe = getSliderActiveColorProbe();
    if (probe && typeof probe.connect === "function")
        ids.push({ actor: probe, id: probe.connect("style-changed", callback) });

    try {
        if (typeof global !== "undefined" && global.stage && St.ThemeContext) {
            const context = St.ThemeContext.get_for_stage(global.stage);
            if (context && typeof context.connect === "function")
                ids.push({ actor: context, id: context.connect("changed", callback) });
        }
    } catch (e) {
        /* ThemeContext may be unavailable in offline tests. */
    }

    return ids;
}

function disconnectSliderActiveColorChanged(connections) {
    if (!connections)
        return;

    for (const entry of connections) {
        if (entry && entry.actor && typeof entry.actor.disconnect === "function")
            entry.actor.disconnect(entry.id);
    }
}

module.exports = {
    clutterColorToCssRgba,
    readSliderActiveColor,
    getSliderActiveColorProbe,
    getSliderActiveColor,
    connectSliderActiveColorChanged,
    disconnectSliderActiveColorChanged
};
