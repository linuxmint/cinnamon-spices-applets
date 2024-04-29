class IconSet {
    constructor(
        newMoon,
        waxingCrescent1,
        waxingCrescent2,
        waxingCrescent3,
        waxingCrescent4,
        waxingCrescent5,
        waxingCrescent6,
        firstQuarter,
        waxingGibbous1,
        waxingGibbous2,
        waxingGibbous3,
        waxingGibbous4,
        waxingGibbous5,
        waxingGibbous6,
        fullMoon,
        waningGibbous1,
        waningGibbous2,
        waningGibbous3,
        waningGibbous4,
        waningGibbous5,
        waningGibbous6,
        thirdQuarter,
        waningCrescent1,
        waningCrescent2,
        waningCrescent3,
        waningCrescent4,
        waningCrescent5,
        waningCrescent6
    ) {
        this.newMoon = newMoon;
        this.waxingCrescent1 = waxingCrescent1;
        this.waxingCrescent2 = waxingCrescent2;
        this.waxingCrescent3 = waxingCrescent3;
        this.waxingCrescent4 = waxingCrescent4;
        this.waxingCrescent5 = waxingCrescent5;
        this.waxingCrescent6 = waxingCrescent6;
        this.firstQuarter = firstQuarter;
        this.waxingGibbous1 = waxingGibbous1;
        this.waxingGibbous2 = waxingGibbous2;
        this.waxingGibbous3 = waxingGibbous3;
        this.waxingGibbous4 = waxingGibbous4;
        this.waxingGibbous5 = waxingGibbous5;
        this.waxingGibbous6 = waxingGibbous6;
        this.fullMoon = fullMoon;
        this.waningGibbous1 = waningGibbous1;
        this.waningGibbous2 = waningGibbous2;
        this.waningGibbous3 = waningGibbous3;
        this.waningGibbous4 = waningGibbous4;
        this.waningGibbous5 = waningGibbous5;
        this.waningGibbous6 = waningGibbous6;
        this.thirdQuarter = thirdQuarter;
        this.waningCrescent1 = waningCrescent1;
        this.waningCrescent2 = waningCrescent2;
        this.waningCrescent3 = waningCrescent3;
        this.waningCrescent4 = waningCrescent4;
        this.waningCrescent5 = waningCrescent5;
        this.waningCrescent6 = waningCrescent6;
        this.moonRise = `moonrise-symbolic`;
        this.noMoonRise = `no-moonrise-symbolic`;
        this.moonSet = `moonset-symbolic`;
        this.noMoonSet = `no-moonset-symbolic`;
        this.nightClear = `night-clear-symbolic`;
        this.directionUp = `direction-up-symbolic`;
        this.directionUpRight = `direction-up-right-symbolic`;
        this.directionRight = `direction-right-symbolic`;
        this.directionDownRight = `direction-down-right-symbolic`;
        this.directionDown = `direction-down-symbolic`;
        this.directionDownLeft = `direction-down-left-symbolic`;
        this.directionLeft = `direction-left-symbolic`;
        this.directionUpLeft = `direction-up-left-symbolic`;
        this.warning = `warning-outline-svgrepo-com.svg`;
        this.lunarEclipse = `lunar-eclipse-symbolic`;
    }

    getPhaseIcons() {
        return [
            this.newMoon,
            this.waxingCrescent1,
            this.waxingCrescent2,
            this.waxingCrescent3,
            this.waxingCrescent4,
            this.waxingCrescent5,
            this.waxingCrescent6,
            this.firstQuarter,
            this.waxingGibbous1,
            this.waxingGibbous2,
            this.waxingGibbous3,
            this.waxingGibbous4,
            this.waxingGibbous5,
            this.waxingGibbous6,
            this.fullMoon,
            this.waningGibbous1,
            this.waningGibbous2,
            this.waningGibbous3,
            this.waningGibbous4,
            this.waningGibbous5,
            this.waningGibbous6,
            this.thirdQuarter,
            this.waningCrescent1,
            this.waningCrescent2,
            this.waningCrescent3,
            this.waningCrescent4,
            this.waningCrescent5,
            this.waningCrescent6
        ];
    }
}

class DefaultIconSet extends IconSet {
    constructor() {
        super(
            `moon-new-symbolic`,
            `moon-waxing-crescent-1-symbolic`,
            `moon-waxing-crescent-2-symbolic`,
            `moon-waxing-crescent-3-symbolic`,
            `moon-waxing-crescent-4-symbolic`,
            `moon-waxing-crescent-5-symbolic`,
            `moon-waxing-crescent-6-symbolic`,
            `moon-first-quarter-symbolic`,
            `moon-waxing-gibbous-1-symbolic`,
            `moon-waxing-gibbous-2-symbolic`,
            `moon-waxing-gibbous-3-symbolic`,
            `moon-waxing-gibbous-4-symbolic`,
            `moon-waxing-gibbous-5-symbolic`,
            `moon-waxing-gibbous-6-symbolic`,
            `moon-full-symbolic`,
            `moon-waning-gibbous-1-symbolic`,
            `moon-waning-gibbous-2-symbolic`,
            `moon-waning-gibbous-3-symbolic`,
            `moon-waning-gibbous-4-symbolic`,
            `moon-waning-gibbous-5-symbolic`,
            `moon-waning-gibbous-6-symbolic`,
            `moon-third-quarter-symbolic`,
            `moon-waning-crescent-1-symbolic`,
            `moon-waning-crescent-2-symbolic`,
            `moon-waning-crescent-3-symbolic`,
            `moon-waning-crescent-4-symbolic`,
            `moon-waning-crescent-5-symbolic`,
            `moon-waning-crescent-6-symbolic`
        );
    }
}

class AltIconSet extends IconSet {
    constructor() {
        super(
            `moon-alt-new-symbolic`,
            `moon-alt-waxing-crescent-1-symbolic`,
            `moon-alt-waxing-crescent-2-symbolic`,
            `moon-alt-waxing-crescent-3-symbolic`,
            `moon-alt-waxing-crescent-4-symbolic`,
            `moon-alt-waxing-crescent-5-symbolic`,
            `moon-alt-waxing-crescent-6-symbolic`,
            `moon-alt-first-quarter-symbolic`,
            `moon-alt-waxing-gibbous-1-symbolic`,
            `moon-alt-waxing-gibbous-2-symbolic`,
            `moon-alt-waxing-gibbous-3-symbolic`,
            `moon-alt-waxing-gibbous-4-symbolic`,
            `moon-alt-waxing-gibbous-5-symbolic`,
            `moon-alt-waxing-gibbous-6-symbolic`,
            `moon-alt-full-symbolic`,
            `moon-alt-waning-gibbous-1-symbolic`,
            `moon-alt-waning-gibbous-2-symbolic`,
            `moon-alt-waning-gibbous-3-symbolic`,
            `moon-alt-waning-gibbous-4-symbolic`,
            `moon-alt-waning-gibbous-5-symbolic`,
            `moon-alt-waning-gibbous-6-symbolic`,
            `moon-alt-third-quarter-symbolic`,
            `moon-alt-waning-crescent-1-symbolic`,
            `moon-alt-waning-crescent-2-symbolic`,
            `moon-alt-waning-crescent-3-symbolic`,
            `moon-alt-waning-crescent-4-symbolic`,
            `moon-alt-waning-crescent-5-symbolic`,
            `moon-alt-waning-crescent-6-symbolic`
        );
    }
}
