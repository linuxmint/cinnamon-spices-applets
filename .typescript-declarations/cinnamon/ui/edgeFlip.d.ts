declare namespace imports.ui.edgeFlip {

    export class EdgeFlipper {
        public enabled: boolean;
        public delay: number;
        public entered: boolean;
        public activated: boolean;
        public side: gi.St.Side;
        public func: Function;

        protected _checkOver(): void;
    
        protected _onMouseEnter(): void;
    
        protected _check(): void;
    
        protected _onMouseLeave(): void;
    }
}