const Applet = imports.ui.applet;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;

const UUID = "meetingbar@redbranch.net";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function ngettext(singular, plural, count) {
    return Gettext.dngettext(UUID, singular, plural, count);
}

function formatString(template, replacements) {
    let result = template;

    replacements.forEach(value => {
        result = result.replace(/%[sd]/, String(value));
    });

    return result;
}

class MeetingBarApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.instance_id = instance_id;

        // Set up settings
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instance_id);
        this.settings.bind('ical-urls', 'ical_urls', this.on_settings_changed);
        this.settings.bind('refresh-rate', 'refresh_rate', this.on_settings_changed);
        this.settings.bind('padding', 'padding', this.on_settings_changed);
        this.settings.bind('max-text-length', 'max_text_length', this.on_settings_changed);
        this.settings.bind('show-tomorrow-events', 'show_tomorrow_events', this.on_settings_changed);
        this.settings.bind('past-event-color', 'past_event_color');
        this.settings.bind('current-event-color', 'current_event_color');
        this.settings.bind('future-event-color', 'future_event_color');

        // Track combined events from all calendars
        this.allEvents = [];

        // Set up popup menu for displaying full agenda
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._label = new St.Label({
            text: _("Loading calendars..."),
            y_align: St.Align.MIDDLE,
            x_align: St.Align.START
        });

        // Add the label to the applet
        this.actor.add_actor(this._label);

        // Remove background and ensure vertical centering
        this.actor.set_style('background-color: transparent;');

        // Timer for periodic calendar updates
        this.update_timer = null;

        // Timer for updating the countdown display every minute
        this.display_timer = null;

        // Store the current next meeting for countdown updates
        this.nextMeeting = null;

        // Track refresh status for button callback
        this.refreshStatus = [];
        this.manualRefresh = false;

        // Apply initial font styling and start updates
        this.on_settings_changed();
    }

    on_settings_changed() {
        // Update label style with configurable padding (font inherited from theme)
        let style = `color: white; padding: ${this.padding}px;`;
        this._label.set_style(style);

        // Restart the update timer
        if (this.update_timer) {
            Mainloop.source_remove(this.update_timer);
        }

        // Restart the display timer
        if (this.display_timer) {
            Mainloop.source_remove(this.display_timer);
        }

        // Fetch calendar data
        this._update_calendar();

        // Update based on user-configured refresh rate (convert minutes to seconds)
        let refreshSeconds = this.refresh_rate * 60;
        this.update_timer = Mainloop.timeout_add_seconds(refreshSeconds, () => {
            this._update_calendar();
            return true; // Keep timer running
        });

        // Update the countdown display every minute
        this.display_timer = Mainloop.timeout_add_seconds(60, () => {
            this._update_display();
            return true; // Keep timer running
        });
    }

    on_refresh_button_clicked() {
        // Called when the refresh button is clicked in settings
        this.manualRefresh = true;
        this.refreshStatus = [];

        // Show notification that refresh has started
        Main.notify(_('Meeting Bar'), _('Refreshing calendars...'));
        global.log('Meeting Bar: Manual refresh started');

        this._update_calendar();
    }

    _update_calendar() {
        // Parse URLs (one per line)
        if (!this.ical_urls || this.ical_urls.trim() === '') {
            this._label.set_text(_('No calendars configured'));
            return;
        }

        // Split by newlines and filter out empty lines
        let urls = this.ical_urls.split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        if (urls.length === 0) {
            this._label.set_text(_('No calendars configured'));
            return;
        }

        // Reset combined events
        this.allEvents = [];
        this.fetchesRemaining = urls.length;

        // Fetch from all URLs
        urls.forEach(url => this._fetch_ical(url));
    }

    _fetch_ical(url) {
        try {
            let file = Gio.File.new_for_uri(url);

            file.load_contents_async(null, (source, result) => {
                try {
                    let [success, contents] = source.load_contents_finish(result);

                    if (success) {
                        // Convert contents to string
                        let icalData = ByteArray.toString(contents);
                        this._parse_ical(icalData, url);
                        if (this.manualRefresh) {
                            this.refreshStatus.push({ url: url, status: 'success', message: _('Loaded successfully') });
                        }
                    } else {
                        global.log('Failed to fetch calendar from: ' + url);
                        if (this.manualRefresh) {
                            this.refreshStatus.push({ url: url, status: 'error', message: _('Failed to fetch') });
                        }
                        // Still decrement the counter
                        this._on_fetch_complete();
                    }
                } catch (e) {
                    global.logError('Error loading calendar from ' + url + ': ' + e);
                    if (this.manualRefresh) {
                        this.refreshStatus.push({ url: url, status: 'error', message: `${_('Error')}: ${e.message}` });
                    }
                    // Still decrement the counter
                    this._on_fetch_complete();
                }
            });
        } catch (e) {
            global.logError('Error fetching calendar from ' + url + ': ' + e);
            if (this.manualRefresh) {
                this.refreshStatus.push({ url: url, status: 'error', message: `${_('Error')}: ${e.message}` });
            }
            // Still decrement the counter
            this._on_fetch_complete();
        }
    }

    _on_fetch_complete() {
        this.fetchesRemaining--;

        // When all fetches are done, find the next meeting
        if (this.fetchesRemaining === 0) {
            this._find_next_meeting(this.allEvents);

            // Show refresh results if this was a manual refresh
            if (this.manualRefresh) {
                this._show_refresh_results();
                this.manualRefresh = false;
            }
        }
    }

    _show_refresh_results() {
        // Build a summary message
        let totalCalendars = this.refreshStatus.length;
        let successCount = this.refreshStatus.filter(s => s.status === 'success').length;
        let errorCount = this.refreshStatus.filter(s => s.status === 'error').length;
        let totalEvents = this.allEvents.length;

        // Build detailed message
        let message = formatString(
            ngettext('Refreshed %d calendar:', 'Refreshed %d calendars:', totalCalendars),
            [totalCalendars]
        );
        message += '\n';
        message += formatString(
            _('✓ %d successful, ✗ %d failed'),
            [successCount, errorCount]
        );
        message += '\n';
        message += formatString(
            ngettext('Found %d event today', 'Found %d events today', totalEvents),
            [totalEvents]
        );
        message += '\n\n';

        // Add details for each calendar
        this.refreshStatus.forEach(status => {
            let shortUrl = this._shorten_url(status.url);
            let icon = status.status === 'success' ? '✓' : '✗';
            message += `${icon} ${shortUrl}\n   ${status.message}\n`;
        });

        // Log to system log for troubleshooting
        global.log('Meeting Bar Refresh Results:\n' + message);

        // Show notification
        Main.notify(_('Meeting Bar Refresh Complete'), message);
    }

    _shorten_url(url) {
        // Shorten URL for display (show last part of path or domain)
        try {
            if (url.startsWith('file://')) {
                let path = url.substring(7);
                let parts = path.split('/');
                return parts[parts.length - 1] || _('local file');
            } else {
                // For http/https URLs, show domain and last path component
                let urlObj = url.split('/');
                let domain = urlObj[2] || url;
                let lastPart = urlObj[urlObj.length - 1] || '';
                if (lastPart.length > 20) {
                    lastPart = '...' + lastPart.substring(lastPart.length - 17);
                }
                return lastPart || domain;
            }
        } catch (e) {
            return url.substring(0, 50);
        }
    }

    _parse_ical(icalData, url) {
        try {
            let events = [];
            let lines = icalData.split('\n');
            let inEvent = false;
            let currentEvent = {};

            // Get today's date boundaries (start and end of day)
            let now = new Date();
            let todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            let todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

            // Get tomorrow's date boundaries if needed
            let tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);

            for (let line of lines) {
                line = line.trim();

                if (line === 'BEGIN:VEVENT') {
                    inEvent = true;
                    currentEvent = {};
                } else if (line === 'END:VEVENT') {
                    // Keep events that are today, or today+tomorrow if setting is enabled
                    if (currentEvent.start && currentEvent.summary) {
                        let endBoundary = this.show_tomorrow_events ? tomorrowEnd : todayEnd;
                        if (currentEvent.start >= todayStart && currentEvent.start <= endBoundary) {
                            // Mark if this event is tomorrow
                            currentEvent.isTomorrow = (currentEvent.start > todayEnd);
                            events.push(currentEvent);
                        }
                    }
                    inEvent = false;
                } else if (inEvent) {
                    // Parse event properties
                    if (line.startsWith('DTSTART')) {
                        currentEvent.start = this._parse_datetime(line);
                    } else if (line.startsWith('DTEND')) {
                        currentEvent.end = this._parse_datetime(line);
                    } else if (line.startsWith('SUMMARY:')) {
                        currentEvent.summary = line.substring(8);
                    } else if (line.startsWith('STATUS:')) {
                        currentEvent.status = line.substring(7).trim();
                    }
                }
            }

            // Add events from this calendar to the combined list
            this.allEvents = this.allEvents.concat(events);

            // Update refresh status with event count
            if (this.manualRefresh) {
                // Find the status entry for this URL and update it with event count
                let statusEntry = this.refreshStatus.find(s => s.url === url);
                if (statusEntry) {
                    statusEntry.message = `${_('Loaded successfully')} (${events.length} ${ngettext('event', 'events', events.length)})`;
                    statusEntry.eventCount = events.length;
                }
            }

            // Mark this fetch as complete
            this._on_fetch_complete();
        } catch (e) {
            global.logError('Error parsing calendar: ' + e);
            if (this.manualRefresh) {
                this.refreshStatus.push({ url: url, status: 'error', message: `${_('Parse error')}: ${e.message}` });
            }
            // Still mark fetch as complete
            this._on_fetch_complete();
        }
    }

    _windows_tz_to_iana(windowsTz) {
        // Map Windows timezone names to IANA timezone identifiers
        const mapping = {
            'Central Standard Time': 'America/Chicago',
            'Eastern Standard Time': 'America/New_York',
            'Mountain Standard Time': 'America/Denver',
            'Pacific Standard Time': 'America/Los_Angeles',
            'GMT Standard Time': 'Europe/London',
            'W. Europe Standard Time': 'Europe/Berlin',
            'Central Europe Standard Time': 'Europe/Warsaw',
            'E. Europe Standard Time': 'Europe/Bucharest',
            'China Standard Time': 'Asia/Shanghai',
            'Tokyo Standard Time': 'Asia/Tokyo',
            'India Standard Time': 'Asia/Kolkata',
            'AUS Eastern Standard Time': 'Australia/Sydney'
        };

        return mapping[windowsTz] || windowsTz;
    }

    _parse_datetime(line) {
        // Extract datetime from iCal format
        // Format: DTSTART:20250121T140000Z (UTC)
        //     or: DTSTART;TZID=America/Chicago:20250121T140000 (timezone-specific)
        //     or: DTSTART:20250121T140000 (floating/local time)

        let parts = line.split(':');
        if (parts.length < 2) return null;

        let dateStr = parts[parts.length - 1].trim();

        // Parse iCal datetime format: YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
        if (dateStr.length < 15) return null;

        let year = parseInt(dateStr.substring(0, 4));
        let month = parseInt(dateStr.substring(4, 6)); // GLib uses 1-indexed months
        let day = parseInt(dateStr.substring(6, 8));
        let hour = parseInt(dateStr.substring(9, 11));
        let minute = parseInt(dateStr.substring(11, 13));
        let second = parseInt(dateStr.substring(13, 15));

        let originalTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;

        // Check if this is a UTC time (ends with 'Z')
        if (dateStr.endsWith('Z')) {
            // UTC time - use GLib.DateTime for proper conversion
            global.log(`MeetingBar: Parsing UTC time: ${originalTimeStr}Z`);

            let utcTz = GLib.TimeZone.new_utc();
            let dt = GLib.DateTime.new(utcTz, year, month, day, hour, minute, second);

            // Convert to local timezone
            let localTz = GLib.TimeZone.new_local();
            let localDt = dt.to_timezone(localTz);

            global.log(`MeetingBar: UTC ${originalTimeStr} → Local ${localDt.format('%Y-%m-%d %H:%M:%S %Z')}`);

            // Convert to JavaScript Date
            return this._glib_datetime_to_js_date(localDt);
        } else if (line.includes('TZID=')) {
            // Extract timezone ID from line
            // Format: DTSTART;TZID=America/Chicago:20250121T100000
            let tzidMatch = line.match(/TZID=([^:;]+)/);
            if (tzidMatch && tzidMatch[1]) {
                let originalTzid = tzidMatch[1].trim();

                // Convert Windows timezone names to IANA identifiers
                let tzid = this._windows_tz_to_iana(originalTzid);

                if (originalTzid !== tzid) {
                    global.log(`MeetingBar: Converted Windows TZ "${originalTzid}" → IANA "${tzid}"`);
                }

                try {
                    // Create GLib.TimeZone from TZID
                    let tz = GLib.TimeZone.new(tzid);
                    let dt = GLib.DateTime.new(tz, year, month, day, hour, minute, second);

                    global.log(`MeetingBar: Parsing time with TZID=${tzid}: ${originalTimeStr}`);
                    global.log(`MeetingBar: Original time in ${tzid}: ${dt.format('%Y-%m-%d %H:%M:%S %Z')}`);

                    // Convert to local timezone
                    let localTz = GLib.TimeZone.new_local();
                    let localDt = dt.to_timezone(localTz);

                    global.log(`MeetingBar: ${tzid} ${originalTimeStr} → Local ${localDt.format('%Y-%m-%d %H:%M:%S %Z')}`);

                    // Convert to JavaScript Date
                    return this._glib_datetime_to_js_date(localDt);
                } catch (e) {
                    global.logError(`MeetingBar: Failed to parse timezone ${tzid}: ${e}`);
                    // Fallback to treating as local time
                    global.log(`MeetingBar: Fallback - treating ${originalTimeStr} as local time`);
                    return new Date(year, month - 1, day, hour, minute, second);
                }
            } else {
                // Couldn't extract TZID, treat as local time
                global.log(`MeetingBar: No TZID found, treating ${originalTimeStr} as local time`);
                return new Date(year, month - 1, day, hour, minute, second);
            }
        } else {
            // Floating time (no timezone specified) - treat as local time
            global.log(`MeetingBar: Floating time (no timezone): ${originalTimeStr} - treating as local time`);
            return new Date(year, month - 1, day, hour, minute, second);
        }
    }

    _glib_datetime_to_js_date(glibDateTime) {
        // Convert GLib.DateTime to JavaScript Date using Unix timestamp
        let unixTime = glibDateTime.to_unix();
        return new Date(unixTime * 1000); // JavaScript uses milliseconds
    }

    _find_next_meeting(events) {
        // Events are already filtered to today only
        let now = new Date();

        // Sort all events by start time
        events.sort((a, b) => a.start - b.start);

        // Update tooltip with full day's agenda
        this._update_tooltip(events);

        // First check for events currently happening
        let currentEvents = events.filter(event => {
            let end = event.end || new Date(event.start.getTime() + 3600000); // Default 1 hour if no end time
            return event.start <= now && now < end;
        });

        if (currentEvents.length > 0) {
            // Show the first current event (in case of overlapping events)
            this.nextMeeting = currentEvents[0];
            this._display_meeting(this.nextMeeting, true); // Pass true to indicate it's happening now
            return;
        }

        // If no current events, find upcoming events
        let upcomingEvents = events.filter(event => event.start > now);

        if (upcomingEvents.length === 0) {
            this._label.set_text(_('No upcoming meetings today'));
            this.nextMeeting = null;
            return;
        }

        // Get the next meeting and store it
        this.nextMeeting = upcomingEvents[0];
        this._display_meeting(this.nextMeeting, false); // Pass false to indicate it's upcoming
    }

    _update_tooltip(events) {
        if (events.length === 0) {
            this.set_applet_tooltip(_('No events today'));
            return;
        }

        // Build agenda text (plain text, no markup)
        let agendaLines = [];
        let now = new Date();

        // Separate today's and tomorrow's events
        let todayEvents = events.filter(e => !e.isTomorrow);
        let tomorrowEvents = events.filter(e => e.isTomorrow);

        // Add today's events
        if (todayEvents.length > 0) {
            agendaLines.push(_("Today's Agenda"), '');
            todayEvents.forEach(event => {
                agendaLines.push(this._format_event_line(event, now));
            });
        }

        // Add tomorrow's events if there are any
        if (tomorrowEvents.length > 0) {
            if (todayEvents.length > 0) {
                agendaLines.push(''); // Add blank line separator
            }
            agendaLines.push(_("Tomorrow's Agenda"), '');
            tomorrowEvents.forEach(event => {
                agendaLines.push(this._format_event_line(event, now));
            });
        }

        // Use plain text tooltip (no markup)
        this.set_applet_tooltip(agendaLines.join('\n'));
    }

    _format_event_line(event, now) {
        let start = event.start;
        let end = event.end || new Date(start.getTime() + 3600000); // Default 1 hour if no end time

        let hours = start.getHours().toString().padStart(2, '0');
        let minutes = start.getMinutes().toString().padStart(2, '0');
        let timeStr = `${hours}:${minutes}`;

        let summary = event.summary;
        let line = `${timeStr} - ${summary}`;

        // Apply formatting based on status and time
        let isCurrent = (start <= now && now < end);
        let isPast = (end < now);
        let status = event.status || 'CONFIRMED';

        // Add status indicators using plain text
        if (status === 'CANCELLED') {
            line = `[${_('CANCELLED')}] ${line}`;
        } else if (status === 'TENTATIVE') {
            line = `[${_('TENTATIVE')}] ${line}`;
        }

        // Add time-based indicators
        if (isCurrent) {
            line = `▶ ${line}`;  // Arrow for current event
        } else if (isPast) {
            line = `  ${line}`;  // Indent for past events
        } else {
            line = `  ${line}`;  // Indent for future events
        }

        return line;
    }

    _update_display() {
        // Update the display of the current next meeting without refetching calendar
        if (this.nextMeeting) {
            // Check if the meeting is currently happening
            let now = new Date();
            let end = this.nextMeeting.end || new Date(this.nextMeeting.start.getTime() + 3600000);
            let isHappeningNow = (this.nextMeeting.start <= now && now < end);

            this._display_meeting(this.nextMeeting, isHappeningNow);

            // If the meeting has ended, refetch to find the next one
            if (now >= end) {
                this._find_next_meeting(this.allEvents);
            }
        }
    }

    _display_meeting(meeting, isHappeningNow = false) {
        // Truncate event title if needed
        let title = meeting.summary;
        if (title.length > this.max_text_length) {
            title = title.substring(0, this.max_text_length - 3) + '...';
        }

        let displayText;
        if (isHappeningNow) {
            // Event is currently happening
            displayText = `${title} - ${_('now')}`;
        } else {
            // Calculate time until meeting (always uses current system time)
            let now = new Date();
            let msUntil = meeting.start - now;
            let timeUntil = this._format_time_until(msUntil);

            // Display: "EVENT_TITLE - in 1h 32m"
            displayText = `${title} - ${timeUntil}`;
        }

        this._label.set_text(displayText);
    }

    _format_time_until(milliseconds) {
        let totalMinutes = Math.floor(milliseconds / 60000);

        if (totalMinutes < 1) {
            return _('now');
        } else if (totalMinutes < 60) {
            return formatString(_('in %dm'), [totalMinutes]);
        } else {
            let hours = Math.floor(totalMinutes / 60);
            let minutes = totalMinutes % 60;
            if (minutes === 0) {
                return formatString(_('in %dh'), [hours]);
            } else {
                return formatString(_('in %dh %dm'), [hours, minutes]);
            }
        }
    }

    on_applet_clicked(event) {
        // Populate and show the menu when clicked
        this._populate_menu();
        this.menu.toggle();
    }

    _populate_menu() {
        // Clear existing menu items
        this.menu.removeAll();

        // Debug log
        global.log(`MeetingBar: Populating menu with ${this.allEvents.length} events`);

        if (this.allEvents.length === 0) {
            let item = new PopupMenu.PopupMenuItem(_('No events today'), { reactive: false });
            this.menu.addMenuItem(item);
            return;
        }

        // Get current time for comparison
        let now = new Date();

        // Separate today's and tomorrow's events
        let todayEvents = this.allEvents.filter(e => !e.isTomorrow);
        let tomorrowEvents = this.allEvents.filter(e => e.isTomorrow);

        // Add today's events section
        if (todayEvents.length > 0) {
            let header = new PopupMenu.PopupMenuItem(_("Today's Agenda"), { reactive: false });
            header.label.set_style('font-weight: bold; color: white;');
            this.menu.addMenuItem(header);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            todayEvents.forEach(event => {
                this._add_event_to_menu(event, now);
            });
        }

        // Add tomorrow's events section if there are any
        if (tomorrowEvents.length > 0) {
            if (todayEvents.length > 0) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            let header = new PopupMenu.PopupMenuItem(_("Tomorrow's Agenda"), { reactive: false });
            header.label.set_style('font-weight: bold; color: white;');
            this.menu.addMenuItem(header);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            tomorrowEvents.forEach(event => {
                this._add_event_to_menu(event, now);
            });
        }
    }

    _add_event_to_menu(event, now) {
        let start = event.start;
        let end = event.end || new Date(start.getTime() + 3600000); // Default 1 hour if no end time

        let hours = start.getHours().toString().padStart(2, '0');
        let minutes = start.getMinutes().toString().padStart(2, '0');
        let timeStr = `${hours}:${minutes}`;

        // Escape HTML entities in event title
        let summary = this._escape_html(event.summary);

        // Determine status and time-based formatting
        let isCurrent = (start <= now && now < end);
        let isPast = (end < now);
        let status = event.status || 'CONFIRMED';

        // Build plain text line with status indicators
        let plainLine = `${timeStr} - ${summary}`;

        // Add status prefix
        if (status === 'CANCELLED') {
            plainLine = `[${_('CANCELLED')}] ` + plainLine;
        } else if (status === 'TENTATIVE') {
            plainLine = `[${_('TENTATIVE')}] ` + plainLine;
        }

        // Add time indicator
        if (isCurrent) {
            plainLine = '▶ ' + plainLine;
        } else {
            plainLine = '  ' + plainLine;
        }

        // Determine color
        let color;
        if (isCurrent) {
            color = this.current_event_color || '#00FF00';
        } else if (isPast) {
            color = this.past_event_color || '#808080';
        } else {
            color = this.future_event_color || '#00BFFF';
        }

        // Create menu item with plain text
        let item = new PopupMenu.PopupMenuItem(plainLine, { reactive: false });
        // Set text color using style
        item.label.set_style(`color: ${color};`);

        this.menu.addMenuItem(item);
    }

    _escape_html(text) {
        // Escape HTML entities to prevent markup issues
        return text.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&apos;');
    }

    on_applet_removed_from_panel() {
        // Clean up timers
        if (this.update_timer) {
            Mainloop.source_remove(this.update_timer);
        }
        if (this.display_timer) {
            Mainloop.source_remove(this.display_timer);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MeetingBarApplet(metadata, orientation, panel_height, instance_id);
}
