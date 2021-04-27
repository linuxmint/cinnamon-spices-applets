declare namespace imports.ui.slider {

    type SliderEvents = 'drag-end' | 'drag-begin' | 'value-changed'

    export class Slider {

        actor: imports.gi.St.DrawingArea
        flat: boolean
        public readonly value: number
        private _value: number
        private _releaseId: number
        private _dragging: boolean

        constructor(value: number, flat: boolean)

        private _sliderRepaint(area: imports.gi.St.DrawingArea)
        private _startDragging(actor: gi.Clutter.Actor, event: gi.Clutter.Event): void
        private _endDragging(): boolean
        private _onScrollEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): void
        private _motionEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): boolean
        private _moveHandle(absX: number, absY: number): void
        private _onKeyPressEvent(actor: gi.Clutter.Actor, event: gi.Clutter.Event): void

        setValue(value: number): void

        public connect(event: SliderEvents, callback: (slider?: Slider) => void): void
    }
}