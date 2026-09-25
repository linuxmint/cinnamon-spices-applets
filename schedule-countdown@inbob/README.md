# Schedule Countdown

Schedule Countdown is an applet to keep track of recurring schedules.  For example, if you have a rigid work schedule or a bell schedule at school, you can have an applet count time until the current event is over or the next event begins.

## Multiple Schedules

This applet supports the use of multiple schedules.  For example, you may have a normal schedule, a 2 hour delay schedule, and a Friday schedule.

### Variants

This applet also support variants for each schedule.  For example, the normal schedule might have two variants depending on whether you eat lunch "a" or lunch "b."  You can simply add an event with variants "a" and "b" and set the start and end times properly.

## Setting the schedules

Schedules are all stored in JSON form.  You could manually edit the JSON, but this is not recommended.  Instead, you can open the applet's context menu and choose configure.  The configure screen has a button to launch the included schedule editor, which will give you a GUI interface for editing your schedules.

## Picking a schedule

By clicking on the applet, you are able to select a schedule-variant pair.  By default, your selection lasts only until the end of the day.  This can be changed in the configuration menu.

## Disclaimer

There are still numerous bugs surrounding the editing of schedules.  This means that certain edge cases may be hard to recover from.  The GUI editor is, for the most part, safe, but by manually editing the JSON, you could crash the applet and make it hard to fix the schedule.  Safeguards, along with translation support, are on the roadmap.