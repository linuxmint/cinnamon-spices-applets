import { RedactAppletConfig } from "../src/3_8/config-redaction";
import { BuildRequestUrls } from "../src/3_8/lib/httpLog";
import { FindPrecipitationWindow } from "../src/3_8/lib/precipitation";
import { CelsiusToKelvin, KPHtoMPS, PascalsToHectopascals } from "../src/3_8/lib/unitConversions";
import { deepEqual, equal, ok, test } from "./harness";

test("converts provider units", () => {
	equal(CelsiusToKelvin(20), 293.15);
	equal(KPHtoMPS(36), 10);
	equal(PascalsToHectopascals(100325), 1003.25);
});

test("finds a five-minute precipitation window", () => {
	deepEqual(FindPrecipitationWindow([0, 0.2, 0.1, 0], 5), {
		start: 5,
		end: 15,
	});
	deepEqual(FindPrecipitationWindow([0, 0, 0], 1), {
		start: -1,
		end: -1,
	});
});

test("uses a redacted request URL for logging", () => {
	const urls = BuildRequestUrls(
		"https://api.caiyunapp.com/v2.6/secret-token/116.4,39.9/weather",
		{ unit: "metric:v2" },
		"https://api.caiyunapp.com/v2.6/[REDACTED]/116.4,39.9/weather",
	);
	ok(urls.requestUrl.includes("secret-token"));
	ok(!urls.logUrl.includes("secret-token"));
	ok(urls.logUrl.includes("unit=metric:v2"));
});

test("redacts every provider credential and location", () => {
	const redacted = RedactAppletConfig({
		apiKey: { value: "legacy" },
		openweathermap_onecall_apikey: { value: "owm" },
		qweather_apikey: { value: "qw" },
		qweather_api_host: { value: "abc.def.qweatherapi.com" },
		caiyun_token: { value: "cy" },
		location: { value: "Beijing" },
		locationList: { value: [{ lat: 39.9, lon: 116.4, city: "Beijing", entryText: "Beijing" }] },
	});
	equal(redacted.apiKey.value, "REDACTED");
	equal(redacted.openweathermap_onecall_apikey.value, "REDACTED");
	equal(redacted.qweather_apikey.value, "REDACTED");
	equal(redacted.caiyun_token.value, "REDACTED");
	equal(redacted.qweather_api_host.value, "abc.def.qweatherapi.com");
	equal(redacted.location.value, "REDACTED");
	equal(redacted.locationList.value[0].lat, "REDACTED");
});
