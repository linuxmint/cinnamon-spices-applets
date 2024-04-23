import { makeJsonHttpRequest } from "../../lib/HttpHandler";
import { createSimpleMenuItem } from "../../lib/SimpleMenuItem";
import { notify, notifyError } from "../../lib/notify";
const { File, FileCreateFlags } = imports.gi.Gio;

const { Bytes } = imports.gi.GLib;

interface RadioStation {
  url: string;
  name: string;
  // ... So much more we can use :-)
}

const saveStations = (stationsUnfiltered: RadioStation[]) => {
  const filteredStations = stationsUnfiltered
    .flatMap(({ name, url }, index) => {
      const isDuplicate =
        stationsUnfiltered.findIndex(
          (val) => val.name === name && val.url === url
        ) !== index;

      if (isDuplicate) return [];

      const trimmedName = name.trim();
      const trimmedUrl = url.trim();


      if (trimmedName.length === 0 || trimmedName.length > 200 || trimmedUrl.length > 200) {
        // some stations have unnormal long names/urls - probably due to some encoding issue on radio browser api side or so.
        return [];
      }

      return [[trimmedName, trimmedUrl]];
    })
    // We need to sort our self - even though they should already be sorted - because some stations are wrongly shown first due to leading spaces
    .sort((a, b) => a[0].localeCompare(b[0]));

  const file = File.new_for_path(`${__meta.path}/allStations.json`);

  if (!file.query_exists(null)) {
    file.create(FileCreateFlags.NONE, null);
  }

  file.replace_contents_bytes_async(
    new Bytes(JSON.stringify(filteredStations)),
    null,
    false,
    FileCreateFlags.REPLACE_DESTINATION,
    null,
    (file, result) => {
      notify("Stations updated successfully");
    }
  );
};

export function createUpdateStationsMenuItem() {
  const defaultText = "Update Radio Stationlist";

  let isLoading = false;

  const menuItem = createSimpleMenuItem({
    text: defaultText,
    onActivated: async (self) => {
      if (isLoading) return;
      isLoading = true;
      self.setText("Updating Radio stations...");

      notify("Upating Radio stations... \n\nThis can take several minutes!");

      makeJsonHttpRequest<RadioStation[]>({
        url: "http://de1.api.radio-browser.info/json/stations",
        onSuccess: (resp) => saveStations(resp),
        onErr: (err) => {
          notifyError(
            `Couldn't update the station list due to an error`,
            err.reason_phrase,
            { showInternetInfo: true }
          );
        },
        onSettled: () => {
          self.setText(defaultText);
          isLoading = false;
        },
      });
    },
  });

  return menuItem.actor;
}
