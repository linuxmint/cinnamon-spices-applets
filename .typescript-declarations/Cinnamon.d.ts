declare namespace imports.gi.Cinnamon {
	function util_format_date(format: string, milliseconds: number): string;
	enum Cursor {
		//INCOMPLETE
		DND_UNSUPPORTED_TARGET,
		DND_COPY,
		DND_MOVE,
		POINTING_HAND,
	}


	interface IGenericContainer {
		connect(signal: 'allocate', callback: (actor: this, box: Clutter.ActorBox, flags: Clutter.AllocationFlags, user_data?: any) => void): number;

		connect(signal: 'get-preferred-width', callback: (actor: this, for_height: number, alloc: GenericContainerAllocation, user_data?: any) => void): number

		connect(signal: 'get-preferred-height', callback: (actor: this, for_width: number, alloc: GenericContainerAllocation, user_data?: any) => void): number

	}

	type GenericContainerType = IGenericContainer & St.Widget
	interface GenericContainer extends GenericContainerType { }

	export class GenericContainer {
		constructor(options?: any)
	}

	export class GenericContainerAllocation {
		public min_size: number
		public natural_size: number
	}

	class Recorder {

	}

	class WindowTracker {

	}

	export function util_get_transformed_allocation(actor: imports.gi.Clutter.Actor): gi.Clutter.ActorBox

}