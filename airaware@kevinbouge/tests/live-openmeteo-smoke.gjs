#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const GLib = imports.gi.GLib;
const Provider = imports.openMeteoProvider;

function main() {
    const loop = new GLib.MainLoop(null, false);

    Provider.fetchForecastAsync({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        forecastDays: 2,
        timeoutSeconds: 15,
    }, (error, data) => {
        if (error) {
            printerr(error.message);
            imports.system.exit(1);
        }

        print(JSON.stringify({
            provider: data.provider,
            currentFields: Object.keys(data.current.readings).length,
            forecastDays: data.forecast.length,
            partial: data.isPartial,
        }));
        loop.quit();
    });

    loop.run();
}

main();
