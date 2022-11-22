let stations_help_text = `This is your own list of Categories and Radio Stations.
You can add more using the + button.
For a category, fill in only its name; leave the other fields empty.
For a radio station, enter only its name and its streaming URL.
You can order the rows by dragging and dropping or by using the buttons and tools below the list.
The 4 buttons located on the right below the list are used to consult it page by page. To search for one of your stations, click on the list and start writing its name.
To easily add stations to your list, use the following 2 tabs: Search and Import.
Check its 'Menu' box to display a station or category in the menu.
Check its second box to listen to the station or move it to another category using the tools below.`;

let button_update_help_text = `If the category you just created does not appear in the drop-down list, press the button above.
This window will disappear and reappear updated after two seconds.`;

let search_help_text = `Here you can search for other stations in a free radio database accessible via the Internet.
Fill in at least a few fields of the form below then click on the 'Search ...' button.
Each time this button is clicked, a new results page is displayed in the second part of this page, where you can test certain stations and include them in the menu.
A station already in your menu will only appear in search results if its streaming URL has changed.
When no new page appears, it means that all results matching your search criteria have been displayed.`);

let import_help_text = `You can import a file containing the name and streaming URL of at least one radio station.
These radio stations are displayed in the list below. You can test them by checking their ♪ box.
Then manage this list with the buttons at the bottom of this tab.`;

let import_shoutcast_help_text = `In the Shoutcast directory, click the download button to the left of the station name.
Select the open format (.XSPF) and save the file giving it the same name as the station.
This file can then be imported here.`;

module.exports = {
  stations_help_text,
  button_update_help_text,
  search_help_text,
  import_help_text,
  import_shoutcast_help_text
}
