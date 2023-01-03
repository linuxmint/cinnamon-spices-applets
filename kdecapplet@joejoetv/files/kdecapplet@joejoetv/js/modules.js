

// Module base class
class KDECModule {

    static moduleID = "";
    static requiredKDECModules = [];

    constructor(device, compatMode) {
        this.device = device;
        this.compatMode = compatMode;
    }

    remove() {

    }

    getMenuItems() {
        
    }
}
