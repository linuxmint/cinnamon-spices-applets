/** Models an event with a generic sender and generic arguments */
interface IEvent<TSender, TArgs> {

	Subscribe(fn: (sender: TSender, args: TArgs) => void): void;

	Unsubscribe(fn: (sender: TSender, args: TArgs) => void): void;

	Invoke(sender: TSender, args: TArgs): void;
}

export class Event<TSender, TArgs> implements IEvent<TSender, TArgs> {
	private subscribers: Array<(sender: TSender, args: TArgs) => void> = [];

	public Subscribe(fn: (sender: TSender, args: TArgs) => void): void {
		this.subscribers.push(fn);
	}

	/**
	 * If you use this, you HAVE to make sure it's the same function
	 * what you passed in. this means you have to save the arrow or the Lang.bind
	 * function and Subscribe/Unsubscribe that.
	 * 
	 * If you create them on the fly you won't be able to unsubscribe from them.
	 */
	public Unsubscribe(fn: (sender: TSender, args: TArgs) => void): void {
		for (let index = this.subscribers.length - 1; index >= 0; index--) {
			const element = this.subscribers[index];
			if (element == fn) {
				this.subscribers.splice(index, 1);
				return;
			}
		}
	}

	public Invoke(sender: TSender, args: TArgs): void {
		if (this.subscribers.length == 0) return;

		for (let index = 0; index < this.subscribers.length; index++) {
			const element = this.subscribers[index];
			element(sender, args);
		}
	}

	public UnSubscribeAll(): void {
		this.subscribers = [];
	}
}