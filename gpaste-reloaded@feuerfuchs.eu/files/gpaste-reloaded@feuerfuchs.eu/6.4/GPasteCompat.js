const GObject = imports.gi.GObject;

// ------------------------------------------------------------------------------------------------------
// GPaste 51 (GPaste-3 typelib) renamed most client methods, added a cancellable argument to the
// asynchronous ones and replaced several signals. This wrapper exposes the part of the client API
// used by the applet on top of both the old and the new API.

// Client signals renamed by GPaste 51
const SIGNALS = {
    'switch-history': 'notify::history',
    'delete-history': 'history-deleted'
};

var Client = class Client {
    constructor(client) {
        this._client = client;
        this._legacy = (typeof client.get_item_at_index !== 'function');
    }

    /*
     * Call an asynchronous client method by its name in the installed API, passing the result of
     * the matching _finish method to the callback (if any). Calling _finish is also what reports
     * errors, hence the empty callbacks below.
     */
    _call(legacyMethod, method, args, callback) {
        const name = this._legacy ? legacyMethod : method;
        if (!this._legacy) {
            args = [...args, null]; // Cancellable
        }

        this._client[name](...args, callback ? (client, result) => {
            callback(client[name + '_finish'](result));
        } : null);
    }

    /*
     * Connect to a client signal using its name in the installed API
     */
    connectSignal(signalManager, signal, callback) {
        if (!this._legacy && signal in SIGNALS) {
            signal = SIGNALS[signal];
        }
        signalManager.connect(this._client, signal, callback);
    }

    getVersion() {
        return this._client.get_version();
    }

    isActive() {
        return this._client.is_active();
    }

    getHistoryName(callback) {
        if (this._legacy) {
            this._call('get_history_name', null, [], callback);
        } else {
            callback(this._client.get_history_name());
        }
    }

    /*
     * GPaste 51 only gives the size of the current history, whatever the name
     */
    getHistorySize(name, callback) {
        this._call('get_history_size', 'get_history_size', this._legacy ? [name] : [], callback);
    }

    /*
     * Callback receives the names of the histories
     */
    listHistories(callback) {
        this._call('list_histories', 'list_histories', [], histories => {
            callback(this._legacy ? histories : histories.map(history => history.get_name()));
        });
    }

    /*
     * Callback receives an item providing get_uuid() and get_value()
     */
    getItemAtIndex(index, callback) {
        this._call('get_element_at_index', 'get_item_at_index', [index], callback);
    }

    /*
     * Callback receives the item's text
     */
    getItemValue(uuid, callback) {
        this._call('get_element', 'get_item', [uuid], item => {
            callback(this._legacy ? item : item.get_value());
        });
    }

    /*
     * Callback receives the uuids of the matching items
     */
    search(pattern, callback) {
        this._call('search', 'search', [pattern], items => {
            callback(this._legacy ? items : items.map(item => item.get_uuid()));
        });
    }

    add(text) {
        this._call('add', 'add_text', [text], () => {});
    }

    delete(uuid) {
        this._call('delete', 'delete_item', [uuid], null);
    }

    select(uuid) {
        this._call('select', 'select', [uuid], null);
    }

    track(state) {
        this._call('track', 'set_active', [state], null);
    }

    emptyHistory(name) {
        this._call('empty_history', 'empty_history', [name], null);
    }

    switchHistory(name) {
        this._call('switch_history', 'switch_history', [name], () => {});
    }
};

/*
 * Name of the signal emitted by GPaste.Settings when the given key changes: GPaste 51 replaced the
 * detailed "changed" signal with property notifications
 */
function settingsChangedSignal(settings, key) {
    const hasChanged = (GObject.signal_lookup('changed', settings.constructor.$gtype) != 0);
    return (hasChanged ? 'changed::' : 'notify::') + key;
}
