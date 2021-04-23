declare namespace imports.ui.backgroundManager {
	class BackgroundManager {
		public constructor();

		protected _gnomeSettings: imports.gi.Gio.Settings;
		protected _cinnamonSettings: imports.gi.Gio.Settings;
		protected color_shading_type: string;
		protected picture_options: string;
		protected picture_uri: string;
		protected primary_color: string;
		protected secondary_color: string;
		protected picture_opacity: string;

		protected _onColorShadingTypeChanged(schema: string, key: string): void;

		protected _onPictureOptionsChanged(schema: string, key: string): void;

		protected _onPictureURIChanged(schema: string, key: string): void;

		protected _onPrimaryColorChanged(schema: string, key: string): void;

		protected _onSecondaryColorChanged(schema: string, key: string): void;

		protected _onPictureOpacityChanged(schema: string, key: string): void;
	}
}