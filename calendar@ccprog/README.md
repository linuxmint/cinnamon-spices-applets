This applet is a fork of Cinnamon's own calender. It adds the capability to mark
public holidays in the calender panel in addition to the weekend days. Like the
World Clock calendar, it has the capability to display additional time zones.

Choose the Country and region for which to show the public holidays in the applet
"Calendar" settings page. Add timezones to display in the applet "World Clocks"
settings page.

The holiday data are obtained from the webservice [Enrico](http://kayaposoft.com/enrico/)
by Kayaposoft.com.

> Enrico Service 2.0 is a free service written in PHP providing public holidays for several 
  countries. You can use Enrico Service to display public holidays on your website or in your 
  desktop application written in any programming language.  
  Enrico Service 2.0 is an open-source software licensed under the MIT License so you can 
  study, contribute, change or use it. See Enrico source code on Github.

See [here](http://holidays.kayaposoft.com/) for a list of supported countries and
its regions. It needs to be noted that each change to their list needs to be reflected
by an update to this applet. While I will try to keep track, if you notice something
missing in the applet that the service offers, let me know about it.

Both the list of supported countries and the actual holiday data are provided
by Enrico. If you find errors or have suggestions, please contact them directly
at enrico@kayaposoft.com or raise an issue at [Github](https://github.com/jurajmajer/enrico).

If you find bugs in the applet itself or know about other sources of holiday information
that can be included as webservices, please
[tell me about them](https://github.com/linuxmint/cinnamon-spices-applets/issues).

## About Events and Holidays

Most people using calendars today have adopted the logic behind the iCalendar format (RFC 5545).
Applications using it may gloss over that, but the available categories for things to be
entered in a calendar are limited to: event, to-do, journal, free/busy and alarm.

Holidays do not really fit any of those. And because of that, they mostly get entered as
all-day (probably recurring) events, without any more distinction from the rest.

Suppose your calendar mentions someone's birthday. You will add it
to your calendar as a whole-day event. If the calendar also mentions your country's National
Holiday, both have no distinguishing feature that would make it possible to mark one and
not the other as a non-working day.

This applet takes the notion of a non-working day, which could be a weekend day, a public
holiday, or a religious observance (including the latter is not yet implemented), and
gives them all the same visual marker. Events are not marked, or if they would be
in a future version, they would need a separate representation to display the richer information
attached to them. (Things like location, start and end time or participants.)

So, as it stands, holidays and events need to be separate data sources, and sources
that provide data in an iCalendar format are not fit to be used as source for public
holidays.