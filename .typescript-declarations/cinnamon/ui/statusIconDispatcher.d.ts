declare namespace imports.ui.statusIconDispatcher {

	class StatusIconDispacher {
		protected _traymanager: imports.gi.Cinnamon.TrayManager;
		
		redisplay(): void;

		start(themeWidget: any): void;

		set_tray_orientation(orientation: gi.St.Side): void;

		protected _onTrayIconAdded(o: any, icon: gi.St.Icon): void;

		protected _onTrayIconRemoved(o: any, icon: gi.St.Icon): void;

		public connect(signal: 'before-redisplay' | 'after-redisplay', callback: (o: any) => void): number;
		public connect(signal: 'status-icon-added', callback: (o: any, icon: gi.St.Icon, role: string) => void): number;
		public connect(signal: 'status-icon-removed', callback: (o: any, icon: gi.St.Icon) => void): number;
		public disconnect(number: number): void;
	}
}