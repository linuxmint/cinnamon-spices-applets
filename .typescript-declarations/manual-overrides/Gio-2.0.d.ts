declare namespace imports.gi.Gio {
    interface IDBusProxy {
        disconnectSignal(id: number): void; 
    }

    interface FileIconOptions {
        file: File;
    }

    interface SettingsInitOptions {
        schema: string;
    }
}