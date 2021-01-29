/** Models an event with a generic sender and generic arguments */
interface IEvent<TSender, TArgs> {

    Subscribe(fn: (sender: TSender, args: TArgs) => void): void;

	Unsubscribe(fn: (sender: TSender, args: TArgs) => void): void;
	
	Invoke(sender: TSender, args: TArgs): void;
}

export class Event<TSender, TArgs> implements IEvent<TSender, TArgs> {
	private subscribers: Array<(sender: TSender, args: TArgs) => void>  = [];

	public Subscribe(fn: (sender: TSender, args: TArgs) => void): void {
		this.subscribers.push(fn);
	}

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
}