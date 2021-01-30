"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Event = void 0;
class Event {
    constructor() {
        this.subscribers = [];
    }
    Subscribe(fn) {
        this.subscribers.push(fn);
    }
    Unsubscribe(fn) {
        for (let index = this.subscribers.length - 1; index >= 0; index--) {
            const element = this.subscribers[index];
            if (element == fn) {
                this.subscribers.splice(index, 1);
                return;
            }
        }
    }
    Invoke(sender, args) {
        if (this.subscribers.length == 0)
            return;
        for (let index = 0; index < this.subscribers.length; index++) {
            const element = this.subscribers[index];
            element(sender, args);
        }
    }
}
exports.Event = Event;
