declare namespace imports.ui.keyboard {
	class Key {
		protected _key: any;
		protected _grabbed: boolean;
		protected _eventCaptureId: number;
		protected _boxPointer: ui.boxpointer.BoxPointer;

		public actor: gi.St.Button

		constructor(key: any)

		protected _onDestroy(): void
		protected _makeKey(): gi.St.Button
		protected _getUnichar(key: any): string
		protected _getExtendedKeys(): void
		protected _onEventCapture(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean
		protected _ungrab(): void
		protected _onShowSubkeysChanged(): void

	}

	class Keyboard {
		protected _timestamp: number
		public monitorIndex: number
		protected _focusInExtendedKeys: boolean
		protected _keyboardSettings: gi.Gio.Settings
		protected _a11yApplicationsSettings: gi.Gio.Settings
		protected _keyboard: gi.Caribou.KeyboardModel
		public readonly Name: string

		constructor()

		protected _compareTimestamp(one: number, two: number): number
		protected _settingsChanged(settings?: gi.Gio.Settings): void
		protected _destroyKeyboard(): void
		protected _setupKeyboard(show: boolean): void
		protected _onKeyFocusChanged(): void
		protected _addKeys(): void
		protected _addRows(keys: any[], layout: gi.St.BoxLayout): void
		protected _loadRows(level: any, layout: gi.St.BoxLayout): void
		protected _redraw(): void
		protected _onLevelChanged(): void
		protected _onGroupChanged(): void
		protected _setActiveLayer(): void
		public toggle(): void
		public show(): void
		public hide(): void
		protected _moveTemporarily(): void
		protected _setLocation(x: number, y: number): void
		public shouldTakeEvent(event: gi.Clutter.Event): boolean
		public Show(timestamp: number): void
		public Hide(timestamp: number): void
		public SetCursorLocation(x: number, y: number, w: number, h: number): void
		public SetEntryLocation(x: number, y: number, w: number, h: number): void
	}
}