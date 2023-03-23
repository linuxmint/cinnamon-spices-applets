declare namespace imports.ui.systray {
	interface Role {
		role: string;
		id: number;
	}
	class SystrayManager {
		protected _roles: Role[];
	
		registerRole(role: string, id: number): void;
	
		unregisterRole(role: string, id: number): void;
	
		unregisterId(id: number): void;
	
		getRoles(): string[];

		connect(signal: "changed", callback: () => void): number;
		disconnect(id: number): void;
	}
}