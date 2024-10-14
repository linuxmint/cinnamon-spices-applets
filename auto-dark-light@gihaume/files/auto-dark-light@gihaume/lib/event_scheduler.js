const Mainloop = imports.mainloop;

const Time_of_day = require('./lib/time_of_day.js');

/**
 * A single-event scheduler which call a function at a specified due time of day.
 */
class Event_scheduler {
    #event_id;

    /**
     * Schedule the event to execute a callback function at the specified due time of day.
     * If the event is already scheduled, it will be replaced.
     * @param {Time_of_day} due_time - The time at which the callback function should be executed.
     * @param {function(): void} on_event_callback - The callback function to be executed when the event occurs.
     */
    set_the_event(due_time, on_event_callback) {
        this.unset_the_event();
        const due_delay = due_time.get_seconds_from_now(); // [s]
        this.#event_id = Mainloop.timeout_add_seconds(due_delay, () => {
            on_event_callback();
            return false; // to not repeat
        });

        // // Debug
        // imports.ui.main.notify(
        //     'Scheduler',
        //     `Event scheduled at ${due_time.as_string()}, in ${due_delay} seconds.`
        // );
    }

    /**
     * Unset the scheduled event if it exists.
     */
    unset_the_event() {
        if (this.#event_id !== undefined) {
            Mainloop.source_remove(this.#event_id);
            this.#event_id = undefined;
        }
    }

    /**
     * Declare the object as finished to release any ressource acquired.
     */
    finalize() { this.unset_the_event(); }

}

module.exports = Event_scheduler;
