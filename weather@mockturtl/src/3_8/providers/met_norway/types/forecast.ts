export interface MetNorwayForecastPayload {
	type: string,
	geometry: {
		type: string,
		/** lon, lat, alt */
		coordinates: number[]
	},
	properties: {
		meta: {
			updated_at: string,
			units: {
				air_pressure_at_sea_level: string,
				air_temperature: string,
				air_temperature_max: string,
				air_temperature_min: string,
				cloud_area_fraction: string,
				cloud_area_fraction_high: string,
				cloud_area_fraction_low: string,
				cloud_area_fraction_medium: string,
				dew_point_temperature: string,
				fog_area_fraction: string,
				precipitation_amount: string,
				relative_humidity: string,
				ultraviolet_index_clear_sky: string,
				wind_from_direction: string,
				wind_speed: string
			}
		},
		timeseries: MetNorwayForecastData[]
	}
}



export interface MetNorwayForecastData {
	time: string,
	data: {
		instant: {
			details: {
				/**hPa */
				air_pressure_at_sea_level: number,
				/** C */
				air_temperature: number,
				/** % */
				cloud_area_fraction: number,
				/** % */
				cloud_area_fraction_high: number,
				/** % */
				cloud_area_fraction_low: number,
				/** % */
				cloud_area_fraction_medium: number,
				/** C */
				dew_point_temperature: number,
				/** % */
				fog_area_fraction: number,
				/** % */
				relative_humidity: number,
				/** 1 */
				ultraviolet_index_clear_sky: number,
				/** degrees */
				wind_from_direction: number,
				/** m/s */
				wind_speed: number
			}
		},
		next_12_hour?: {
			summary: {
				symbol_code: string
			}
		},
		next_1_hours?: {
			summary: {
				symbol_code: string
			},
			details: {
				/** mm */
				precipitation_amount: number
			}
		},
		next_6_hours?: {
			summary: {
				symbol_code: string
			},
			details: {
				/** C */
				air_temperature_max: number,
				/** C */
				air_temperature_min: number,
				/** mm */
				precipitation_amount: number
			}
		}
	}
}