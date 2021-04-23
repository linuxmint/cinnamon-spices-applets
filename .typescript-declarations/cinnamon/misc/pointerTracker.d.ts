declare namespace imports.misc.pointerTracker {
	class PointerTracker {
		public constructor();


		public hasMoved(): boolean;
		/**
		 * @returns lastpointerX, lastPointerY, lastScreen
		 */
		public getPosition(): number[];

		public setPosition(x: number, y: number, screenOpt?: number): void;
	}
}