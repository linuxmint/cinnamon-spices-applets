
## Future Improvements

* Display avatar url for user -> https://api.github.com/users/jamesemorgan
* Correct GitHub Icons & styling
* Add User authentication as well as using public API feed
* Enable Max height or number of repos to list without scrolling
* Add option for closing secondary open sub menus
* Ability to have more than one applet running at once? -> https://github.com/linuxmint/Cinnamon/wiki/Applet,%20Desklet%20and%20Extension%20Settings%20Reference#additional-options-in-metadatajson
* Ability to change icon if you dont like the icon supplied as default (see settings example)
* Should knowledge of Github URLs and endpoints be inside applet.js?
* Right click -> Close applet?
* Investigate use of access token instead of using open public API

* Add Language icon & type to repository details -> JSON tag ['language']
* Consider moving timing functionality to its own class?

* Conditional Request based on responses -> http://developer.github.com/v3/#conditional-requests
* Move query string to Github object
* Refresh GitHub on intertent reconnection from a disconnect
* Pretty Print datetimes - http://ejohn.org/projects/javascript-pretty-date/
* Using GitHub V3 OAuth token based authentication
* Notification on new repo added
* Tool-tips for when rolling over repos giving short description

* Fix missing icon - check /usr/share/icons && /usr/share/icons/gnome/scalable
* Setup custom domain for new site : https://help.github.com/articles/setting-up-a-custom-domain-with-pages

* Add link to WIKI on has_wiki json flag

## Released Versions

##### V1.5

* Fixed issus 32 - show open issues for each repo in name

##### V1.4

* Created basic blog site - http://jamesemorgan.github.io/github-explorer/
* Renamed project to github-explorer
* Removed old project demos
* Cleaned up README
* Added Watchers link and icon

##### V1.3

* Added indentation thanks to https://github.com/azzazzel

##### V1.2

* Updated to work on Cinnamon 2.0
* Removal of Settings contact menu when running under Cinnamon 2.0+

##### V1.1
* Added ability to create a Gist as default
* Contribution: Removed warnings from Looking Glass, https://github.com/Koutch

##### V1.0
* Basic support of watching changes to repos including number forks, issues and watcher modifcation
* Enable additional notifications with settings, default disabled

##### V0.9
-- Prevent further GitHub query when API query threshold reached, uses X-RateLimit headers
-- Improve applet tool tip on API rate exceeded and errors
-- Build in optional Logging for various testing modes

##### V0.8
-- Remove old settings files which are not needed
-- Optional menu item if no project home found i.e. don't display it if not present
-- Last Query Attempt added to tool tip off applet
-- Simple logging of Request limits and rates
-- Updated README and installation details

##### V0.7
-- New Settings API (Cinnamon 1.8) incorporated, removal of old home brew GTK+ settings as well as revamp of settings functionality - https://github.com/linuxmint/Cinnamon/blob/master/files/usr/share/cinnamon/applets/settings-example%40cinnamon.org/applet.js
-- Include links to home and Github, morgan-design.com
-- Right click context now opens applet configuration settings

##### V0.6

-- Increased default refresh interval to 3 minutes
-- Change default user to 'username' and myself @jamesemorgan
-- github username link not updated when user changes
-- Display popup when no user is set
-- Dont perform inital lookup request when no user is set
-- Small re-factorings of menu creation logic, method names, class format

##### V0.5

-- Fix missing icon in applet explorer - thanks @maristgeek
-- Improve installation scripts - thanks @magno32
-- Fix missing user agent string from GitHub API integration - thanks @magno32
-- General code re-factor of error reporting
-- Ensure working with Cinnamon 1.8 and Linux Mint 15
-- Remove Verbose Logging

##### V0.4
-- On 403 error from GitHub, show error message supplied in alert and not default error message
-- Re-factor Notifications and their content
-- Minor re-factorings, replacement of this being miss used!
-- Enable verbose logging mode via settings, default false

##### V0.3
-- Only show failure message X 5
-- Re-written error message to make sense!
-- Correct Icon/Image for settings right click menu

##### V0.2
-- Add Settings Menu so users dont have to edit .js file using Gtk glade
-- Added version to metadata.json
-- Add notifications for set-up attempt, first successful load & failure to find repos

##### V0.1
-- First release
