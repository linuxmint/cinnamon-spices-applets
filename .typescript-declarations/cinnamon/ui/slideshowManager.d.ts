declare namespace imports.ui.slideshowManager {

	const dbusIFace: string;

	const proxy: imports.gi.Gio.DBusProxy;

	class SlideshowManager {
		public constructor();

		public proxy: imports.gi.Gio.DBusProxy;
		protected _slideshowSettings: imports.gi.Gio.Settings;

		protected _onSlideshowEnabledChanged(): void;

		public ensureProxy(): void;

		public begin(): void;

		public end(): void;

		public getNextImage(): void;
	}
}