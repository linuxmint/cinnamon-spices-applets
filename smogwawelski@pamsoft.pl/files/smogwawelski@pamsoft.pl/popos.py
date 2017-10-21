#!/usr/bin/env python
import json


class DataEntry:
    def __init__(self, unit, max_val, hour, value):
        self.unit = unit
        self.maxVal = max_val
        self.hour = hour
        self.value = value


    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4, separators=(',', ':'))


class Data:
    def __init__(self, measurements, updated_at, location_name, station_id):
        self.measurements = measurements
        self.updatedAt = updated_at
        self.locationName = location_name
        self.stationId = station_id

    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4, separators=(',', ':'))