/**
 * To be tested manually with `cjs -m <this file path>`.
 *
 * Changing the system wall clock time for more than `time_difference_tolerance` seconds must trigger the console log within `monitoring_interval` seconds.
 */

import { Wall_clock_adjustment_monitor } from '../Wall_clock_adjustment_monitor.js';

const monitor = new Wall_clock_adjustment_monitor();
monitor.callback = () => console.log('Wall-clock has been adjusted');
monitor.time_difference_tolerance = 2;
monitor.monitoring_interval = 1;
monitor.enable();

new imports.gi.GLib.MainLoop(null, false).run();
