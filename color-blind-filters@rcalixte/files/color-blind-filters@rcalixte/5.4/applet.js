const Applet = imports.ui.applet;
const Gettext = imports.gettext;
const Lang = imports.lang;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Slider = imports.ui.slider;
const { GLib, St } = imports.gi;

const UUID = 'color-blind-filters@rcalixte';
let Shaders;
if (typeof require !== 'undefined') {
    Shaders = require('Shaders');
} else {
    const AppletDir = imports.ui.appletManager.applets[UUID];
    Shaders = AppletDir.Shaders;
}

// l10n/translation support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
    return Gettext.dgettext(UUID, str);
}


class CBApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.orientation = orientation;
        this.instance_id = instance_id;
        this._filterName = 'color-blind-filters';

        this._getEffects();
        this._updateApplet();

        let properties = this._getProperties();
        this._activeEffect = this._activeData.effect(properties);
        if (this.filter_active)
            this._switchToggled(this.filter_active)
    }

    _refreshApplet() {
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instance_id);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "filter_active",
            "filter_active",
            this._switchToggled,
            null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "filter_strength",
            "filter_strength",
            this._updateSlider,
            null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "category",
            "category",
            this._updateApplet,
            null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "color_corrections",
            "color_corrections",
            this._updateApplet,
            null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "color_simulations",
            "color_simulations",
            this._updateApplet,
            null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "inversions",
            "inversions",
            this._updateApplet,
            null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "other",
            "other",
            this._updateApplet,
            null);

        let effectName;
        switch (this.category) {
            case 'corrections':
                effectName = this.color_corrections;
                break;
            case 'simulations':
                effectName = this.color_simulations;
                break;
            case 'inversions':
                effectName = this.inversions;
                break;
            case 'other':
                effectName = this.other;
                break;
        }

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.popupMenu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.popupMenu);

        this._menuItems = new Map();

        let displayName = effectName.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
        this._switch = new PopupMenu.PopupSwitchMenuItem(displayName, this.filter_active);
        this._switch.connect('toggled', Lang.bind(this, function () {
            this.filter_active = this._switch.state;
            this._switchToggled(this.filter_active);
        }));

        this._strengthMenuItem = new PopupMenu.PopupSliderMenuItem(0);
        this._strengthMenuItem.setValue(this.filter_strength / 100);
        this._strengthMenuItem.connect("value-changed", Lang.bind(this, this._updateSlider));

        let correctionsExpander = new PopupMenu.PopupSubMenuMenuItem(_('Color Blindness - Corrections'));

        let protanItem = new PopupMenu.PopupMenuItem(_('Protanopia Correction'), false);
        protanItem._effect = this.Effects.ProtanopiaCorrection;
        protanItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('ProtanopiaCorrection', protanItem);

        let protanTurboItem = new PopupMenu.PopupMenuItem(_('Protanopia High Contrast'), false);
        protanTurboItem._effect = this.Effects.ProtanopiaCorrectionHighContrast;
        protanTurboItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('ProtanopiaCorrectionHighContrast', protanTurboItem);

        let deuterItem = new PopupMenu.PopupMenuItem(_('Deuteranopia Correction'), false);
        deuterItem._effect = this.Effects.DeuteranopiaCorrection;
        deuterItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('DeuteranopiaCorrection', deuterItem);

        let deuterTurboItem = new PopupMenu.PopupMenuItem(_('Deuteranopia High Contrast'), false);
        deuterTurboItem._effect = this.Effects.DeuteranopiaCorrectionHighContrast;
        deuterTurboItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('DeuteranopiaCorrectionHighContrast', deuterTurboItem);

        let tritanItem = new PopupMenu.PopupMenuItem(_('Tritanopia Correction'), false);
        tritanItem._effect = this.Effects.TritanopiaCorrection;
        tritanItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('TritanopiaCorrection', tritanItem);

        let simulationsExpander = new PopupMenu.PopupSubMenuMenuItem(_('Color Blindness - Simulations'));

        let protanSimulItem = new PopupMenu.PopupMenuItem(_('Protanopia Simulation'), false);
        protanSimulItem._effect = this.Effects.ProtanopiaSimulation;
        protanSimulItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('ProtanopiaSimulation', protanSimulItem);

        let deuterSimulItem = new PopupMenu.PopupMenuItem(_('Deuteranopia Simulation'), false);
        deuterSimulItem._effect = this.Effects.DeuteranopiaSimulation;
        deuterSimulItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('DeuteranopiaSimulation', deuterSimulItem);

        let tritanSimulItem = new PopupMenu.PopupMenuItem(_('Tritanopia Simulation'), false);
        tritanSimulItem._effect = this.Effects.TritanopiaSimulation;
        tritanSimulItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('TritanopiaSimulation', tritanSimulItem);

        let inversionsExpander = new PopupMenu.PopupSubMenuMenuItem(_('Inversions'));

        let lightnessInversionItem = new PopupMenu.PopupMenuItem(_('Lightness Inversion'), false);
        lightnessInversionItem._effect = this.Effects.LightnessInversion;
        lightnessInversionItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('LightnessInversion', lightnessInversionItem);

        let colorInversionItem = new PopupMenu.PopupMenuItem(_('Color Inversion'), false);
        colorInversionItem._effect = this.Effects.ColorInversion;
        colorInversionItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('ColorInversion', colorInversionItem);

        let otherExpander = new PopupMenu.PopupSubMenuMenuItem(_('Other Effects'));

        let desaturateItem = new PopupMenu.PopupMenuItem(_('Desaturation'), false);
        desaturateItem._effect = this.Effects.Desaturation;
        desaturateItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('Desaturation', desaturateItem);

        let gbrItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - GBR'), false);
        gbrItem._effect = this.Effects.ColorMixerGBR;
        gbrItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('ColorMixerGBR', gbrItem);

        let brgItem = new PopupMenu.PopupMenuItem(_('Channel Mixer - BRG'), false);
        brgItem._effect = this.Effects.ColorMixerBRG;
        brgItem.connect('activate', Lang.bind(this, this._switchFilter));
        this._menuItems.set('ColorMixerBRG', brgItem);

        this.popupMenu.addMenuItem(this._switch);
        this.popupMenu.addMenuItem(this._strengthMenuItem);
        if (this.category == "inversions")
            this._strengthMenuItem.actor.hide();

        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        correctionsExpander.menu.addMenuItem(protanItem);
        correctionsExpander.menu.addMenuItem(protanTurboItem);
        correctionsExpander.menu.addMenuItem(deuterItem);
        correctionsExpander.menu.addMenuItem(deuterTurboItem);
        correctionsExpander.menu.addMenuItem(tritanItem);
        this.popupMenu.addMenuItem(correctionsExpander);
        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        simulationsExpander.menu.addMenuItem(protanSimulItem);
        simulationsExpander.menu.addMenuItem(deuterSimulItem);
        simulationsExpander.menu.addMenuItem(tritanSimulItem);
        this.popupMenu.addMenuItem(simulationsExpander);
        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        inversionsExpander.menu.addMenuItem(lightnessInversionItem);
        inversionsExpander.menu.addMenuItem(colorInversionItem);
        this.popupMenu.addMenuItem(inversionsExpander);
        this.popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        otherExpander.menu.addMenuItem(desaturateItem);
        otherExpander.menu.addMenuItem(gbrItem);
        otherExpander.menu.addMenuItem(brgItem);
        this.popupMenu.addMenuItem(otherExpander);

        this._activeItem = this._menuItems.get(effectName);
        this._activeData = this._activeItem._effect;
    }

    _switchToggled(value) {
        if (value)
            this._addEffect(this._activeEffect);
        else
            this._removeEffect();

        if (this.popupMenu.isOpen)
            this.popupMenu.toggle();
        this._refreshApplet();
        this._updatePanel();
        this._setOrnament();
        this._syncSettings();
    }

    on_applet_clicked(event) {
        this.popupMenu.toggle();
    }

    on_applet_removed_from_panel() {
        this._removeEffect();
        this.settings.finalize();
    }

    _switchFilter(activeItem) {
        this._syncSettings();
        this._updatePanel();
        this._setOrnament();

        let sameShader = activeItem._effect.effectName == this._activeData.effectName;
        this._activeItem = activeItem;
        this._activeData = this._menuItems.get(activeItem._effect.name)._effect;
        this._syncSettings();

        if (sameShader)
            this._updateEffect();
        else
            this._setShaderEffect();
    }

    _setOrnament() {
        for (let [key, item] of this._menuItems) {
            item.setOrnament(PopupMenu.OrnamentType.NONE);
            item.setActive(true);
            item.setSensitive(true);
            item.focusOnHover = true;
        }

        this._activeItem.setOrnament(PopupMenu.OrnamentType.DOT);
        this._activeItem.setActive(false);
        this._activeItem.setSensitive(false);
        this._activeItem.focusOnHover = false;

        if (this._activeItem._effect.sliderEnabled)
            this._strengthMenuItem.visible = true;
        else
            this._strengthMenuItem.visible = false;
    }

    _getProperties() {
        let properties = this._activeData.properties;
        if (properties.factor !== undefined)
            properties.factor = this._strengthMenuItem.value;
        return properties;
    }

    _updateEffect() {
        this._updateApplet();

        let properties = this._getProperties();
        this._activeEffect.updateEffect(properties);
    }

    _updateApplet() {
        this._refreshApplet();
        this._syncSettings();
        this._updatePanel();
        this._setOrnament();
        let sameShader = this._activeItem._effect.effectName == this._activeData.effectName;

        let properties = this._getProperties();
        this._activeEffect = this._activeData.effect(properties);

        if (!sameShader)
            this._updateEffect();
        else
            if (this.filter_active)
                this._addEffect(this._activeData.effect(properties));
    }

    _updateSlider(slider, value) {
        if (value) {
            this.filter_strength = Math.round(value * 100);
            if (this.filter_strength == 0 || this.filter_strength == 100) {
                this.filter_strength = Math.abs(1 - this.filter_strength);
                if (this._strengthMenuItem.value !== this.filter_strength / 100)
                    this._strengthMenuItem.setValue(this.filter_strength / 100);
            }
        } else {
            this._strengthMenuItem.setValue(this.filter_strength / 100);
        }

        let properties = this._getProperties();
        this._activeEffect.updateEffect(properties);
    }

    _setShaderEffect() {
        this._removeEffect();
        this._updateApplet();

        if (!this.filter_active)
            return;

        let properties = this._getProperties();
        this._addEffect(this._activeData.effect(properties));
    }

    _addEffect(effect) {
        if (Main.uiGroup.get_effect(this._filterName))
            this._removeEffect();
        Main.uiGroup.add_effect_with_name(this._filterName, effect);
        this._activeEffect = effect;
    }

    _removeEffect() {
        Main.uiGroup.remove_effect_by_name(this._filterName);
    }

    _syncSettings() {
        this.category = this._activeData.category;
        switch (this.category) {
            case 'corrections':
                this.color_corrections = this._activeData.name;
                break;
            case 'simulations':
                this.color_simulations = this._activeData.name;
                break;
            case 'inversions':
                this.inversions = this._activeData.name;
                break;
            case 'other':
                this.other = this._activeData.name;
                break;
        }
    }

    _updatePanel() {
        if (this.filter_active)
            this.set_applet_tooltip(_('Current filter:') + ` ${this._activeData.name.replace(/([a-z])([A-Z])/g, '$1 $2').trim()}`);
        else
            this.set_applet_tooltip(_('Filters disabled.'));

        this.set_applet_icon_path(`${this.metadata.path}/icons/eye-${this.filter_active ? '' : 'disabled-'}symbolic.svg`);
    }

    _getDaltonismEffect(properties) {
        if (!this._daltonismEffect)
            this._daltonismEffect = new Shaders.DaltonismEffect(properties);
        else
            this._daltonismEffect.updateEffect(properties);

        return this._daltonismEffect;
    }

    _getInversionEffect(properties) {
        if (!this._inversionEffect)
            this._inversionEffect = new Shaders.InversionEffect(properties);
        else
            this._inversionEffect.updateEffect(properties);

        return this._inversionEffect;
    }

    _getDesaturateEffect(properties) {
        if (!this._desaturateEffect)
            this._desaturateEffect = new Shaders.DesaturateEffect(properties);
        else
            this._desaturateEffect.updateEffect(properties);

        return this._desaturateEffect;
    }

    _getChannelMixerEffect(properties) {
        if (!this._channelMixerEffect)
            this._channelMixerEffect = new Shaders.ColorMixerEffect(properties);
        else
            this._channelMixerEffect.updateEffect(properties);

        return this._channelMixerEffect;
    }

    _getEffects() {
        this.Effects = {
            ProtanopiaCorrection: {
                name: 'ProtanopiaCorrection',
                category: 'corrections',
                properties: { mode: 0, factor: 1 },
                effect: this._getDaltonismEffect,
                effectName: '_getDaltonismEffect',
                sliderEnabled: true
            },
            ProtanopiaCorrectionHighContrast: {
                name: 'ProtanopiaCorrectionHighContrast',
                category: 'corrections',
                properties: { mode: 1, factor: 1 },
                effect: this._getDaltonismEffect,
                effectName: '_getDaltonismEffect',
                sliderEnabled: true
            },
            DeuteranopiaCorrection: {
                name: 'DeuteranopiaCorrection',
                category: 'corrections',
                properties: { mode: 2, factor: 1 },
                effect: this._getDaltonismEffect,
                effectName: '_getDaltonismEffect',
                sliderEnabled: true
            },
            DeuteranopiaCorrectionHighContrast: {
                name: 'DeuteranopiaCorrectionHighContrast',
                category: 'corrections',
                properties: { mode: 3, factor: 1 },
                effect: this._getDaltonismEffect,
                effectName: '_getDaltonismEffect',
                sliderEnabled: true
            },
            TritanopiaCorrection: {
                name: 'TritanopiaCorrection',
                category: 'corrections',
                properties: { mode: 4, factor: 1 },
                effect: this._getDaltonismEffect,
                effectName: '_getDaltonismEffect',
                sliderEnabled: true
            },
            ProtanopiaSimulation: {
                name: 'ProtanopiaSimulation',
                category: 'simulations',
                properties: { mode: 5, factor: 1 },
                effect: this._getDaltonismEffect,
                effectName: '_getDaltonismEffect',
                sliderEnabled: true
            },
            DeuteranopiaSimulation: {
                name: 'DeuteranopiaSimulation',
                category: 'simulations',
                properties: { mode: 6, factor: 1 },
                effect: this._getDaltonismEffect,
                effectName: '_getDaltonismEffect',
                sliderEnabled: true
            },
            TritanopiaSimulation: {
                name: 'TritanopiaSimulation',
                category: 'simulations',
                properties: { mode: 7, factor: 1 },
                effect: this._getDaltonismEffect,
                effectName: '_getDaltonismEffect',
                sliderEnabled: true
            },
            LightnessInversion: {
                name: 'LightnessInversion',
                category: 'inversions',
                properties: { mode: 0 },
                effect: this._getInversionEffect,
                effectName: '_getInversionEffect',
                sliderEnabled: false
            },
            ColorInversion: {
                name: 'ColorInversion',
                category: 'inversions',
                properties: { mode: 2 },
                effect: this._getInversionEffect,
                effectName: '_getInversionEffect',
                sliderEnabled: false
            },
            Desaturation: {
                name: 'Desaturation',
                category: 'other',
                properties: { factor: 1 },
                effect: this._getDesaturateEffect,
                effectName: '_getDesaturateEffect',
                sliderEnabled: true
            },
            ColorMixerGBR: {
                name: 'ColorMixerGBR',
                category: 'other',
                properties: { mode: 0, factor: 1 },
                effect: this._getChannelMixerEffect,
                effectName: '_getChannelMixerEffect',
                sliderEnabled: true
            },
            ColorMixerBRG: {
                name: 'ColorMixerBRG',
                category: 'other',
                properties: { mode: 1, factor: 1 },
                effect: this._getChannelMixerEffect,
                effectName: '_getChannelMixerEffect',
                sliderEnabled: true
            }
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CBApplet(metadata, orientation, panel_height, instance_id);
}
