declare namespace imports.ui.soundManager {
	const iface: string;

	const proxy: imports.gi.Gio.DBusProxy;

	const PLAY_ONCE_FLAG: number;

	class SoundManager {
		public constructor();

		public keys: string[];
		public desktop_keys: string[];
		public startup_delay: boolean;
		public enabled: object;
		public file: object;
		public settings: imports.gi.Gio.Settings;
		public desktop_settings: imports.gi.Gio.Settings;
		public proxy: imports.gi.Gio.DBusProxy;

		protected _cacheSettings(): void;

		protected _cacheDesktopSettings(): void;

		protected play(sound: string): void;

		protected playVolume(sound: string, volume: number): void;

		/**  We want the login sound synced to the fade-in animation
		 * but we don't want it playing every time someone restarts
		 * Cinnamon - passing PLAY_ONCE_FLAG will let the sound handler
		 * know not to play this more than once for its lifetime (usually
		 * for the session.)
		 */
		protected play_once_per_session(sound: string): void;

		/* Public methods. */

		public playSoundFile(id: string, filename: string): void;

		public playSoundFileVolume(id: string, filename: string, volume: number): void;

		public playSound(id: string, name: string): void;

		public cancelSound(id: string): void;
	}
}