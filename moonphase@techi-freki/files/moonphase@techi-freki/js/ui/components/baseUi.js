class BaseUi {
    constructor() {

    }

    create() {
        throw new Error('Must implement abstract method "create()"');
    }
}