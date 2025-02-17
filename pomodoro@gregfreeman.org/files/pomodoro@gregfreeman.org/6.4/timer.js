const Mainloop = imports.mainloop;
const Signals = imports.signals;

/**
 * 
 * Components:
 * TimerQueue: Manages a queue of timers, tracking their running state and facilitating the sequential starting of each timer in the queue.
 * Timer: Represents an individual timer that can emit events such as timer-tick, timer-started, timer-stopped, and timer-finished.
 * 
 * 
 * Mental Model of Event Flow:
 * Queue Start: timer-queue-started
 * Timer Start: timer-started
 * Timer Tick: timer-tick (repeats every second)
 * Timer Finish: timer-finished
 * Before Next Timer: timer-queue-before-next-timer
 * Next Timer Start (repeat back to Timer Start as needed depending on how many timers remain in the queue)
 * Queue Finish: timer-queue-finished (when all timers have completed)
 */

class TimerQueue {
    constructor() {
        this._queue = [];
        this._timerRunning = false;
        this._timerFinishedHandler = null;
        this._timerPreventNextStart = false;
        this._queuePos = 0;
        this._isFirstStart = true;
    }

    addTimer(timer) {
        this._queue.push(timer);
    }

    isRunning() {
        return this._timerRunning;
    }

    isStartPrevented() {
        return this._timerPreventNextStart;
    }

    start() {
        if (this._isFirstStart) {
            this.emit('timer-queue-started');
            this._isFirstStart = false;
        }
        this._timerRunning = true;
        return this._startNextTimer();
    }

    stop() {
        let timer = this.getCurrentTimer();
        if (timer === undefined) return;
        timer.stop();
        this._clearTimerFinishedHandler(timer);
        this._timerRunning = false;
    }

    reset() {
        this._resetTimers();
        this._rewindQueue();
        this.emit('timer-queue-reset');
    }

    clear() {
        this._resetTimers();
        this._clearQueue();
    }

    getCurrentTimer() {
        return this._queue[this._queuePos];
    }

    skip() {
        let timer = this.getCurrentTimer();
        if (timer === undefined) return false;
        if (timer.isRunning() && this._timerFinishedHandler !== null) {
            timer.stop();
            timer.reset();
            this._timerFinished(timer);
        }
    }

    preventStart(y) {
        this._timerPreventNextStart = y;
    }

    _startNextTimer() {
        let timer = this.getCurrentTimer();
        if (timer === undefined || this.isStartPrevented()) return false;
        this._timerFinishedHandler = timer.connect('timer-finished', this._timerFinished.bind(this));
        timer.start();
        return true;
    }

    _timerFinished(timer) {
        this._clearTimerFinishedHandler(timer);
        if (this._queueIsFinished()) {
            this._timerRunning = false;
            this.emit('timer-queue-finished');
            return;
        }
        this._queuePos++;
        this.emit('timer-queue-before-next-timer');
        this._startNextTimer();
    }

    _queueIsFinished() {
        return this._queuePos === (this._queue.length - 1);
    }

    _clearQueue() {
        this._queue = [];
        this._rewindQueue();
    }

    _clearTimerFinishedHandler(timer) {
        if (this._timerFinishedHandler !== null) {
            timer.disconnect(this._timerFinishedHandler);
            this._timerFinishedHandler = null;
        }
    }

    _rewindQueue() {
        this._isFirstStart = true;
        this._queuePos = 0;
    }

    _resetTimers() {
        this.stop();
        this._queue.forEach(timer => timer.reset());
    }
}

Signals.addSignalMethods(TimerQueue.prototype);

class Timer {
    constructor({ name = null, timerLimit = null } = {}) {
        this._name = name;
        this._tickTimeout = null;
        this.setTimerLimit(timerLimit);
        this._resetTimer();
    }

    getName() {
        return this._name;
    }

    setTimerLimit(timerLimit) {
        if (typeof timerLimit !== 'number' || timerLimit < 1) {
            throw new Error('timerLimit must be a number greater than 0 to run timer');
        }
        if (this.isRunning()) {
            let timeElapsed = this._timerLimit - this._currentTickCount;
            this._currentTickCount = timerLimit - timeElapsed;
        }
        this._timerLimit = timerLimit;
    }

    start() {
        if (this._isFirstStart) {
            this._startTimer();
            return this;
        }
        this._refreshTimer();
        this._startTimer(true);
        return this;
    }

    stop() {
        if (this._tickTimeout !== null) {
            this._clearTickTimeout();
            this.emit('timer-stopped');
            if (this._currentTickCount >= 0) {
                this._isFirstStart = true;
            }
        }
        return this;
    }

    reset() {
        this._resetTimer();
        return this;
    }

    getTicksRemaining() {
        return this._currentTickCount;
    }

    isRunning() {
        return this._tickTimeout !== null;
    }

    _startTimer(firstRun = false) {
        this._isFirstStart = false;
        if (firstRun) {
            this.emit('timer-started');
        }
        this.emit('timer-running');
        this.emit('timer-tick');
        this._tickTimeout = Mainloop.timeout_add_seconds(1, this._tick.bind(this));
    }

    _tick() {
        this._currentTickCount--;
        if (this._currentTickCount < 0) {
            this._finish();
            return false;
        }
        this.emit('timer-tick');
        return true;
    }

    _finish() {
        this.stop();
        this.emit('timer-finished');
    }

    _resetTimer() {
        this._isFirstStart = false;
        this._clearTickTimeout();
        this._refreshTimer();
    }

    _refreshTimer() {
        this._currentTickCount = this._timerLimit;
    }

    _clearTickTimeout() {
        if (this._tickTimeout !== null) {
            Mainloop.source_remove(this._tickTimeout);
            this._tickTimeout = null;
        }
    }
}

Signals.addSignalMethods(Timer.prototype);
