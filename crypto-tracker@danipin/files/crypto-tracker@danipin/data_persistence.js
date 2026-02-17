const Gio = imports.gi.Gio;

let _applet = null; // To hold a reference to the main applet instance

function init(appletInstance) {
    _applet = appletInstance;
}

function _getCallStatsFilePath() {
    return _applet.metadata.path + "/call_stats.json";
}

function loadCallStats() {
    let callStatsFile = _getCallStatsFilePath();
    let file = Gio.file_new_for_path(callStatsFile);
    if (file.query_exists(null)) {
        try {
            let [success, contents] = file.load_contents(null);
            if (success && contents) {
                let stats = JSON.parse(contents.toString());
                let now = new Date();
                let lastReset = new Date(stats.lastReset || 0);

                // Adopt values from file or set default
                _applet.basicCalls = stats.basicCalls || 0;
                _applet.keyCalls = stats.keyCalls || 0;
                _applet.chartCalls = stats.chartCalls || 0;
                _applet.detailCalls = stats.detailCalls || 0;
                _applet.searchCalls = stats.searchCalls || 0;
                _applet.portfolioCalls = stats.portfolioCalls || 0;
                _applet.alarmCalls = stats.alarmCalls || 0;
                _applet.allTimeCalls = stats.allTimeCalls || 0;
                _applet.successfulPings = stats.successfulPings || 0;
                _applet.apiErrors = stats.apiErrors || 0;
                _applet.lastResetDate = stats.lastReset;
                _applet.avgPerDay = stats.avgPerDay || 0;
                _applet.avgBasicPerDay = stats.avgBasicPerDay || 0;
                _applet.dailyHistory = stats.dailyHistory || {};

                _applet.persistedKeyCalls = _applet.keyCalls;
                _applet.persistedBasicCalls = _applet.basicCalls;

                // Monthly Reset Check
                if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
                    _applet.keyCalls = 0;
                    _applet.basicCalls = 0;
                    _applet.chartCalls = 0;
                    _applet.detailCalls = 0;
                    _applet.searchCalls = 0;
                    _applet.portfolioCalls = 0;
                    _applet.alarmCalls = 0;
                    
                    // FIX: Set reset date to 1st of month for correct averages
                    let startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    _applet.lastResetDate = startOfMonth.toISOString();
                    
                    _applet.quotaResetDetected = true;
                    saveCallStats(); // Save the reset state immediately
                }
            }
        } catch (e) {
            global.logError("Error loading call stats: " + e);
        }
    } else {
        // Initial values if file does not exist yet
        _applet.allTimeCalls = 0;
        _applet.apiErrors = 0;
        _applet.successfulPings = 0;
        _applet.keyCalls = 0;
        _applet.chartCalls = 0;
        _applet.detailCalls = 0;
        _applet.searchCalls = 0;
        _applet.portfolioCalls = 0;
        _applet.alarmCalls = 0;
        _applet.basicCalls = 0;
        _applet.lastResetDate = new Date().toISOString();
        _applet.avgPerDay = 0;
        _applet.dailyHistory = {};
        
        _applet.persistedKeyCalls = 0;
        _applet.persistedBasicCalls = 0;
    }
}

function saveCallStats() {
    let callStatsFile = _getCallStatsFilePath();
    let file = Gio.file_new_for_path(callStatsFile);
    try {
        let now = new Date();
        let today = now.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Runtime Reset Check (If month change happens during runtime)
        let lastResetCheck = new Date(_applet.lastResetDate || now);
        if (now.getMonth() !== lastResetCheck.getMonth() || now.getFullYear() !== lastResetCheck.getFullYear()) {
            _applet.keyCalls = 0;
            _applet.basicCalls = 0;
            _applet.chartCalls = 0;
            _applet.detailCalls = 0;
            _applet.searchCalls = 0;
            _applet.portfolioCalls = 0;
            _applet.alarmCalls = 0;
            
            // FIX: Set reset date to 1st of month
            let startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            _applet.lastResetDate = startOfMonth.toISOString();
            
            _applet.persistedKeyCalls = 0;
            _applet.persistedBasicCalls = 0;
            _applet.quotaResetDetected = true;
        }

        let lastReset = new Date(_applet.lastResetDate || now);
        let diffTime = Math.abs(now - lastReset);
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        
        let avg = Math.round(_applet.keyCalls / diffDays);
        _applet.avgPerDay = avg; 

        let avgBasic = Math.round(_applet.basicCalls / diffDays);
        _applet.avgBasicPerDay = avgBasic;

        // Update daily history
        if (_applet.persistedKeyCalls === undefined) _applet.persistedKeyCalls = _applet.keyCalls;
        if (_applet.persistedBasicCalls === undefined) _applet.persistedBasicCalls = _applet.basicCalls;

        let deltaKey = _applet.keyCalls - _applet.persistedKeyCalls;
        let deltaBasic = _applet.basicCalls - _applet.persistedBasicCalls;

        if (deltaKey > 0 || deltaBasic > 0) {
            if (!_applet.dailyHistory) _applet.dailyHistory = {};
            if (!_applet.dailyHistory[today]) _applet.dailyHistory[today] = { key: 0, basic: 0 };
            
            _applet.dailyHistory[today].key += deltaKey;
            _applet.dailyHistory[today].basic += deltaBasic;
            
            _applet.persistedKeyCalls = _applet.keyCalls;
            _applet.persistedBasicCalls = _applet.basicCalls;
        }

        // Cleanup: Keep only the last 60 days
        let keys = Object.keys(_applet.dailyHistory).sort();
        if (keys.length > 60) {
            let newHistory = {};
            keys.slice(keys.length - 60).forEach(k => newHistory[k] = _applet.dailyHistory[k]);
            _applet.dailyHistory = newHistory;
        }

        let stats = {
            basicCalls: _applet.basicCalls || 0,
            keyCalls: _applet.keyCalls || 0,
            chartCalls: _applet.chartCalls || 0,
            detailCalls: _applet.detailCalls || 0,
            searchCalls: _applet.searchCalls || 0,
            portfolioCalls: _applet.portfolioCalls || 0,
            alarmCalls: _applet.alarmCalls || 0,
            allTimeCalls: _applet.allTimeCalls || 0,
            successfulPings: _applet.successfulPings || 0,
            apiErrors: _applet.apiErrors || 0,
            avgPerDay: avg, 
            avgBasicPerDay: avgBasic,
            lastReset: _applet.lastResetDate || now.toISOString(),
            lastUpdate: now.toISOString(),
            dailyHistory: _applet.dailyHistory
        };
        let json = JSON.stringify(stats, null, 4);
        let outStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let outData = new Gio.DataOutputStream({ base_stream: outStream });
        outData.put_string(json, null);
        outStream.close(null);
    } catch (e) {
        global.logError("Error saving call stats: " + e);
    }
}

// Export the functions
var DataPersistence = {
    init: init,
    loadCallStats: loadCallStats,
    saveCallStats: saveCallStats
};
