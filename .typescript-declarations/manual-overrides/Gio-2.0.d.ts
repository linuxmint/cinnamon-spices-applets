declare namespace imports.gi.Gio {
    interface IDBusProxy {
        disconnectSignal(id: number): void; 
    }

    type ChangedVariable = `changed::${string}`;
    interface ISettings {
        /**
		 * The "changed" signal is emitted when a key has potentially changed.
		 * You should call one of the g_settings_get() calls to check the new
		 * value.
		 * 
		 * This signal supports detailed connections.  You can connect to the
		 * detailed signal "changed::x" in order to only receive callbacks
		 * when key "x" changes.
		 * 
		 * Note that #settings only emits this signal if you have read #key at
		 * least once while a signal handler was already connected for #key.
		 */
        connect(event: ChangedVariable, callback: (...args: any[]) => void): number;
    }
}