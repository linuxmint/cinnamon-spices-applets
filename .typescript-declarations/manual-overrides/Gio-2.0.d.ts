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

    type ChangedVariable = `changed::${string}`;
    interface ISettings {
        /**
         * Generic signal function for support for any schema
         * @param event 
         * @param callback 
         */
        connect(event: ChangedVariable, callback: (...args: any[]) => void): number;
    }
}