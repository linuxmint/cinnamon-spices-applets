import { IconType } from '../gi/St'

export class Panel {

    panelId: number
    monitorIndex: number
    panelPosition: string
    toppanelHeight: number
    bottompanelHeight: number

    // simplified. In realitiy not given by default
    _panelZoneSizes = {
        "fullcolor": {
            "left": 32,
            "center": 32,
            "right": 32,
            "panelId": 2
        },
        "symbolic": {
            "left": 24,
            "center": 10,
            "right": 27,
            "panelId": 2
        },
        "text": {
            "left": 6,
            "center": 0,
            "right": 0,
            "panelId": 2
        }
    }


    constructor(id: number, monitorIndex: number, panelPosition: string, toppanelHeight: number, bottompanelHeight: number, drawCorner: any) {
        this.panelId = id;

        this.monitorIndex = monitorIndex
        this.panelPosition = panelPosition
        this.toppanelHeight = toppanelHeight
        this.bottompanelHeight = bottompanelHeight

    }

    getPanelZoneIconSize(locationLabel: string, iconType: IconType) {
        let typeString = "fullcolor";

        if (iconType == IconType.SYMBOLIC) {
            typeString = "symbolic";
        }

        return this._panelZoneSizes[typeString][locationLabel];

    }



}