# Duolingo Helper Cinnamon Spice

This applet shows public Duolingo profile statistics in the Cinnamon panel.

The previous version used Duolingo's obsolete password login endpoint and displayed daily-goal/crown/lingot data that is no longer reliable in the current Duolingo product. This version no longer asks for or stores a Duolingo password. It reads public profile data from:

```text
https://www.duolingo.com/2017-06-30/users?username=<username>
```

## Features

- No Duolingo password is requested or stored.
- Multiple Duolingo usernames can be configured.
- Right-click the panel applet and choose `Settings` to edit users. The label is translated by Cinnamon.
- Hover over the applet to see per-user statistics.
- Left-click the applet for a compact menu, profile links, and manual refresh.
- Refreshes automatically every 5 minutes.

## Displayed Statistics

The current public profile endpoint exposes:

- Streak in days
- Total XP
- XP in the current course
- Current course title
- Duolingo Plus status when present
- Error state per configured username

The panel label stays compact:

```text
<loaded-users> | <sum-of-streaks>
```

Example:

```text
3 | 42
```

## Configure

1. Right-click the Duolingo Helper applet in the Cinnamon panel.
2. Click `Settings`.
3. Add one row per Duolingo username.
4. Enable the rows you want to fetch.

Use the Duolingo username, not the email address.

Clicking a loaded user in the applet menu opens that user's Duolingo profile.

## Notes

This applet uses an unofficial public Duolingo endpoint. Duolingo can change or remove it without notice.

If a configured username shows an error, verify that the profile exists and that the username is public.
