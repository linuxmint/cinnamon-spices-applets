class UiBase {
    constructor(app) {
        this._app = app;
    }

    create() {
        throw new Error('Must implement abstract method "create()"');
    }
}