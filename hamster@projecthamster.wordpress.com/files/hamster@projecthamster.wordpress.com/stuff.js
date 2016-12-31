function formatDuration(minutes) {
    return "%02d:%02d".format((minutes - minutes % 60) / 60, minutes % 60)
}

function formatDurationHuman(minutes) {
    let hours = (minutes - minutes % 60) / 60;
    let mins = minutes % 60;
    let res = ""

    if (hours > 0 || mins > 0) {
        if (hours > 0)
            res += "%dh ".format(hours)

        if (mins > 0)
            res += "%dmin".format(mins)
    } else {
        res = "Just started"
    }

    return res;
}

function formatDurationHours(minutes) {
    return new Number(minutes / 60.0).toFixed(1) + "h";
}

function fromDbusFact(fact) {
    // converts a fact coming from dbus into a usable object
    function UTCToLocal(timestamp) {
        // TODO - is this really the way?!
        let res = new Date(timestamp)
        return new Date(res.setUTCMinutes(res.getUTCMinutes() + res.getTimezoneOffset()));
    }

    return {
        name: fact[4],
        startTime: UTCToLocal(fact[1]*1000),
        endTime: fact[2] != 0 ? UTCToLocal(fact[2]*1000) : null,
        description: fact[3],
        activityId: fact[5],
        category: fact[6],
        tags: fact[7],
        date: UTCToLocal(fact[8] * 1000),
        delta: Math.floor(fact[9] / 60), // minutes
        id: fact[0]
    }
};

function fromDbusFacts(facts) {
    let res = [];
    for each(var fact in facts) {
        res.push(fromDbusFact(fact));
    }

    return res;
};


function parseFactString(input) {
    let res = {
        "time": null,
        "activity": input,
        "category": null,
        "description": null,
        "tags": null,
    }
}
