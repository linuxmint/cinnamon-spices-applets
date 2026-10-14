const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const Settings = imports.ui.settings;

class AirQualityApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.stationId = null;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bindProperty(
            Settings.BindingDirection.IN, 
            "latitude",
            "latitude",
            this.onSettingsChanged,
            null
        );
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "longitude",
            "longitude",
            this.onSettingsChanged,
            null
        );

        this.session = new Soup.Session();

        this.set_applet_label("AQ ...");

        this.update();

        Mainloop.timeout_add_seconds(1800, () => {
            this.update();
            return true;
        });
    }

    onSettingsChanged() {
        this.stationId = null;
        this.update();
    }


    // distance function for picking closest air monitor to the user 
    distanceSquared(lat1, lon1, lat2, lon2) {
        let dlat = lat1 - lat2;
        let dlon = lon1 - lon2;

        return dlat * dlat + dlon * dlon;
    }


    // Breakpoints based on EPA 
    getPm25Category(pm25) {
        if (pm25 <= 9) {
            return {
                label: "Good",
                icon: "●",
                color: "green"
            };
        }
        if (pm25 <= 35.4) {
            return {
                label: "Moderate",
                icon: "●",
                color: "yellow"
            };
        }
        if (pm25 <= 55.4) {
            return {
                label: "Unhealthy for Sensitive",
                icon: "●",
                color: "orange"
            };
        }
        if (pm25 <= 125.4) {
            return {
                label: "Unhealthy",
                icon: "●",
                color: "red"
            };
        }
        if (pm25 <= 225.4) {
            return {
                label: "Very Unhealthy",
                icon: "●",
                color: "red"
            };
        }
        return {
            label: "Hazardous",
            icon: "●",
            color: "purple"
        };
    }


    update() {
        if (!this.stationId) {
            this.findNearestStation();
            return;
        }
        this.fetchStationData();
    }


    fetchStationData() {
        if (!this.stationId) return;

        let url = `https://api.airgradient.com/public/api/v1/world/locations/${this.stationId}/measures/current`;
        let request = Soup.Message.new("GET", url);
        request.request_headers.append("accept", "application/json")

        this.session.send_and_read_async(
            request,
            Soup.MessagePriority.NORMAL,
            null,
            (session, message) => {
                try{
                    if (request.get_status() !== 200) {
                        this.set_applet_label("HTTP " + request.get_status());
                        return;
                    }

                    let bytes = session.send_and_read_finish(message);
                    let text = ByteArray.toString(bytes.get_data());
                    let station = JSON.parse(text);

                    let pm25 = station.pm02;
                    let category = this.getPm25Category(pm25);

                    this.set_applet_label(category.label + " - " + pm25.toFixed(1));
                    this.set_applet_tooltip(
                        "Station: " + station.publicLocationName + "\n" +
                        "PM2.5: "  + pm25
                    );
                } catch(e) {
                    global.log(e);
                    this.set_applet_label("ERR");
                }
            });
    }

    findNearestStation() {
        let request = Soup.Message.new("GET", "https://api.airgradient.com/public/api/v1/world/locations/measures/current");
        request.request_headers.append("accept", "application/json");

        this.session.send_and_read_async(
            request,
            Soup.MessagePriority.NORMAL,
            null,
            (session, message) => {
                try {
                    if (request.get_status() !== 200) {
                        this.set_applet_label("HTTP " + request.get_status());
                        return;
                    }

                    let bytes = session.send_and_read_finish(message);
                    let text = ByteArray.toString(bytes.get_data());
                    let data = JSON.parse(text);

                    let nearest = null;
                    let closestDistance = Infinity;

                    for (let station of data){
                        if (station.offline)
                            continue;

                        let distance = this.distanceSquared(
                            this.latitude,
                            this.longitude,
                            station.latitude,
                            station.longitude
                        );

                        if (distance < closestDistance){
                            closestDistance = distance;
                            nearest = station;
                        }
                    }

                    if (!nearest) {
                        this.set_applet_label("No station ...");
                        return;
                    }

                    this.stationId = nearest.locationId;
                    this.fetchStationData();
                } catch (error) {
                    global.log(error);
                    this.set_applet_label("ERR");
                }
            });
    }
}


function main(metadata, orientation, panelHeight, instanceId) {
    return new AirQualityApplet(metadata, orientation, panelHeight, instanceId);
}

