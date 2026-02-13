
//----------------------------------------------------------------------
//
// Weather Applet
//
//----------------------------------------------------------------------

import { DateTime } from "luxon";
import { type Config, ServiceClassMapping } from "./config";
import type { RefreshOptions} from "./loop";
import { WeatherLoop } from "./loop";
import type { WeatherData, CustomIcons, BuiltinIcons } from "./weather-data";
import type { AppletError, NiceErrorDetail, Metadata, WeatherProvider, LocationData } from "./types";
import { RefreshState } from "./types";
import { UI } from "./ui";
import { AwareDateString, CapitalizeFirstLetter, GenerateLocationText, InjectValues, NotEmpty, ProcessCondition, TempToUserConfig, UnitToUnicode, WeatherIconSafely, _ } from "./utils";
import type { HttpError } from "./lib/httpLib";
import { HttpLib } from "./lib/httpLib";
import { Logger } from "./lib/services/logger";
import { APPLET_ICON, REFRESH_ICON, UUID } from "./consts";
import { CloseStream, OverwriteAndGetIOStream, WriteAsync } from "./lib/io_lib";
import { NotificationService } from "./lib/notification_service";
import { Literal, SpawnProcess } from "./lib/commandRunner";
import { Event } from "./lib/events";
import { ErrorHandler } from "./lib/services/error_handler";


const { TextIconApplet, AllowedLayout, MenuItem } = imports.ui.applet;
const { spawnCommandLine } = imports.misc.util;
const { IconType, Side } = imports.gi.St;
const { File } = imports.gi.Gio;
const keybindingManager = imports.ui.main.keybindingManager;

export class WeatherApplet extends TextIconApplet {
	private readonly loop: WeatherLoop;
	private currentWeatherInfo: WeatherData | null = null;
	public get CurrentData(): WeatherData | null {
		return this.currentWeatherInfo;
	}

	/** Chosen API */
	private provider?: WeatherProvider;

	public get Provider(): WeatherProvider | undefined {
		return this.provider;
	}

	private orientation: imports.gi.St.Side;
	public get Orientation(): imports.gi.St.Side {
		return this.orientation;
	}

	/** Running applet's path */
	public readonly AppletDir: string;
	public readonly config: Config;
	public readonly ui: UI;

	private readonly metadata: Metadata;

	/** Used for error handling, first error calls flips it
	 * to prevents displaying other errors in the current loop.
	 */
	public encounteredError: boolean = false;

	public constructor(config: Config, metadata: Metadata, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
		super(orientation, panelHeight, instanceId);
		this.metadata = metadata;
		this.AppletDir = metadata.path;
		this.orientation = orientation;
		Logger.Debug("Applet created with instanceID " + instanceId);
		Logger.Debug("AppletDir is: " + this.AppletDir);

		this.SetAppletOnPanel();
		this.config = config;
		this.AddRefreshButton();
		this.EnsureProvider();
		this.ui = new UI(this, orientation);
		this.ui.Rebuild(this.config);
		this.loop = new WeatherLoop(this, instanceId);
		HttpLib.Instance.UnhandledError.Subscribe((sender, error) => this.HandleHTTPError(error));
		ErrorHandler.Instance.OnError.Subscribe((sender, error) => this.ShowError(error));
		try {
			this.setAllowedLayout(AllowedLayout.BOTH);
		} catch {
			// vertical panel not supported
		}

		void this.loop.Start();
		// We need a full rebuild and refresh for these
		this.config.DataServiceChanged.Subscribe(() => this.loop.Refresh({rebuild: true}));

		// We need a full rebuild without refresh for these
		this.config.VerticalOrientationChanged.Subscribe(this.AfterRefresh(this.onSettingNeedsRebuild));
		this.config.ForecastColumnsChanged.Subscribe(this.AfterRefresh(this.onSettingNeedsRebuild));
		this.config.ForecastRowsChanged.Subscribe(this.AfterRefresh(this.onSettingNeedsRebuild));
		this.config.UseCustomAppletIconsChanged.Subscribe(this.AfterRefresh(this.onSettingNeedsRebuild));
		this.config.UseCustomMenuIconsChanged.Subscribe(this.AfterRefresh(this.onSettingNeedsRebuild));
		this.config.UseSymbolicIconsChanged.Subscribe(this.AfterRefresh(this.onSettingNeedsRebuild));
		this.config.ForecastHoursChanged.Subscribe(this.AfterRefresh(this.onSettingNeedsRebuild));

		// We need a full refresh for these
		this.config.ApiKeyChanged.Subscribe(() => this.loop.Refresh());
		// We change how we process data when this is changed
		this.config.ShortConditionsChanged.Subscribe(() => this.loop.Refresh());
		// Some translations come from the API we need a refresh
		this.config.TranslateConditionChanged.Subscribe(() => this.loop.Refresh());
		this.config.ManualLocationChanged.Subscribe(() => this.loop.Refresh());
		this.config.LocationChanged.Subscribe(() => this.loop.Refresh());

		// Misc Triggers
		this.config.RefreshIntervalChanged.Subscribe(() => this.loop.Refresh({immediate: false}));

		// Panel
		this.config.ShowCommentInPanelChanged.Subscribe(this.RefreshLabel);
		this.config.ShowTextInPanelChanged.Subscribe(this.RefreshLabel);

		// Redisplay
		this.config.TemperatureUnitChanged.Subscribe(this.AfterRefresh(this.OnSettingNeedRedisplay));
		this.config.TempRussianStyleChanged.Subscribe(this.AfterRefresh(this.OnSettingNeedRedisplay));
		this.config.ShowBothTempUnitsChanged.Subscribe(this.AfterRefresh(this.OnSettingNeedRedisplay));
		this.config.Show24HoursChanged.Subscribe(this.AfterRefresh(this.OnSettingNeedRedisplay));
		this.config.DistanceUnitChanged.Subscribe(this.AfterRefresh(this.OnSettingNeedRedisplay));
		this.config.ShowAlertsChanged.Subscribe(this.AfterRefresh(this.OnSettingNeedRedisplay));

		this.config.TooltipTextOverrideChanged.Subscribe(this.AfterRefresh((conf, val, data) => this.SetAppletTooltip(data, conf, val)));
		this.config.TempTextOverrideChanged.Subscribe(this.RefreshLabel);
		this.config.FontChanged.Subscribe(() => this.loop.Refresh({rebuild: true}));
		this.config.HotkeyChanged.Subscribe(this.OnKeySettingsUpdated);
		this.config.SelectedLogPathChanged.Subscribe(this.saveLog);
		this.config.LocStore.CurrentLocationModified.Subscribe(() => this.loop.Refresh());

		keybindingManager.addHotKey(
			UUID, this.config.keybinding, () => this.on_applet_clicked());
	}

	private OnKeySettingsUpdated = (): void => {
		if (this.config.keybinding != null) {
			keybindingManager.addHotKey(
				UUID,
				this.config.keybinding,
				() => this.on_applet_clicked()
			);
		}
	}

	private onSettingNeedsRebuild = (conf: Config, changedData: unknown, data: WeatherData) => {
		if (this.Provider == null)
			return;

		this.ui.Rebuild(conf);
		this.DisplayWeather(data);
		this.ui.Display(data, conf, this.Provider);
	}

	private OnSettingNeedRedisplay = (conf: Config, changedData: unknown, data: WeatherData) => {
		if (this.Provider == null)
			return;

		this.DisplayWeather(data);
		this.ui.Display(data, conf, this.Provider);
	}

	/**
	 *
	 * @param options By default it will cancel the current refresh (if any) then start a new one.
	 * @returns
	 */
	public async Refresh(options?: RefreshOptions): Promise<void> {
		return this.loop.Refresh(options);
	}

	/**
	 * Main function pulling and refreshing data
	 * @param rebuild
	 */
	private async RefreshWeather(
		this: WeatherApplet,
		rebuild: boolean,
		location: LocationData | null = null,
		cancellable: imports.gi.Gio.Cancellable
	): Promise<RefreshState> {
		try {
			this.encounteredError = false;

			this.EnsureProvider();
			if (this.provider == null) {
				return RefreshState.Error;
			}

			if (!location) {
				location = await this.config.GetLocation(cancellable, this.provider);
				if (!location) {
					return RefreshState.NoLocation;
				}
			}


			// No key
			if (this.provider.needsApiKey && this.config.NoApiKey()) {
				return RefreshState.NoKey;
			}

			this.ui.ShowRefreshIcon();
			let weatherInfo = await this.provider.GetWeather(location, cancellable, this.config);

			if (weatherInfo == null) {
				return RefreshState.NoWeather;
			}

			weatherInfo = this.MergeWeatherData(weatherInfo, location);

			if (rebuild)
				this.ui.Rebuild(this.config);

			if (!this.ui.Display(weatherInfo, this.config, this.provider) ||
				!this.DisplayWeather(weatherInfo)) {
				return RefreshState.DisplayFailure;
			}

			this.currentWeatherInfo = weatherInfo;
			if (this.config._runScript)
				void this.SendCommand();
			return RefreshState.Success;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("Generic Error while refreshing Weather info: " + e.message + ", ", e);
			this.ShowError({ type: "hard", detail: "unknown", message: _("Unexpected Error While Refreshing Weather, please see log in Looking Glass") });
			return RefreshState.Error;
		}
		finally {
			this.ui.HideRefreshIcon();
		}
	}

	// ---------------------------------------------------------------------------
	// Panel Set helpers helpers

	/** Displays weather info in applet's panel */
	private DisplayWeather(weather: WeatherData): boolean {
		this.SetAppletTooltip(weather, this.config, this.config._tooltipTextOverride);
		this.DisplayWeatherOnLabel(weather);
		this.SetAppletIcon(weather.condition.icons, weather.condition.customIcon);
		return true;
	}

	public RefreshLabel = (): void => {
		if (this.currentWeatherInfo == null)
			return;
		this.DisplayWeatherOnLabel(this.currentWeatherInfo);
	}

	private DisplayWeatherOnLabel(weather: WeatherData) {
		const temperature = weather.temperature;
		const mainCondition = CapitalizeFirstLetter(weather.condition.main);
		// Applet panel label
		let label = "";
		// Horizontal panels
		if (this.Orientation != Side.LEFT && this.Orientation != Side.RIGHT) {
			if (this.config._showCommentInPanel) {
				label += mainCondition;
			}
			if (this.config._showTextInPanel) {
				if (label != "") {
					label += " ";
				}
				label += (TempToUserConfig(temperature, this.config) ?? "");
			}
		}
		// Vertical panels
		else {
			if (this.config._showTextInPanel) {
				label = TempToUserConfig(temperature, this.config, false) ?? "";
				// Vertical panel width is more than this value then we has space
				// to show units
				if (this.GetPanelHeight() >= 35 && label) {
					label += UnitToUnicode(this.config.TemperatureUnit);
				}
			}
		}

		// Overriding temperature panel label
		if (NotEmpty(this.config._tempTextOverride))
			label = InjectValues(this.config._tempTextOverride, weather, this.config);

		this.SetAppletLabel(label);
	}

	private SetAppletTooltip(weather: WeatherData, config: Config, override: string) {
		const location = GenerateLocationText(weather, this.config);
		const lastUpdatedTime = AwareDateString(weather.date, this.config._show24Hours, DateTime.local().zoneName);
		let msg = `${location} - ${_("As of {lastUpdatedTime}", { "lastUpdatedTime": lastUpdatedTime })}`;

		if (NotEmpty(override)) {
			msg = InjectValues(override, weather, config);
		}
		this.set_applet_tooltip(msg);
	}

	private SetAppletIcon(iconNames: BuiltinIcons[], customIcon: CustomIcons) {
		if (this.config._useCustomAppletIcons) {
			this.SetCustomIcon(customIcon);
		}
		else {
			const icon = WeatherIconSafely(iconNames, this.config.AppletIconType);
			this.config.AppletIconType == IconType.SYMBOLIC ?
				this.set_applet_icon_symbolic_name(icon) :
				this.set_applet_icon_name(icon);
		}
	}

	private SetAppletLabel(label: string) {
		this.set_applet_label(label);
	}

	private GetPanelHeight(): number {
		return this.panel?.height ?? 0;
	}

	// ---------------------------------------------------------------------------
	// UI helpers

	public GetMaxForecastDays(): number {
		if (!this.provider) return this.config._forecastDays;
		return Math.min(this.config._forecastDays, this.provider.maxForecastSupport);
	}

	public GetMaxHourlyForecasts(): number {
		if (!this.provider) return this.config._forecastHours;
		return Math.min(this.config._forecastHours, this.provider.maxHourlyForecastSupport);
	}


	// ----------------------------------------------------------------------------
	// Config Callbacks, do not delete

	private locationLookup(): void {
		const command = "xdg-open ";
		spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
	}

	private async testRunScript(): Promise<void> {
		if (!this.config._runScript) {
			NotificationService.Instance.Send(_("No Script Provided"), _("You need to add a script first."));
			return;
		}

		if (!this.currentWeatherInfo) {
			NotificationService.Instance.Send(_("No Weather Data"), _("No weather data to run script with"));
			return;
		}

		const result = await this.SendCommand();
		// We already handled the this above
		if (!result) {
			return;
		}

		if (result.Success)
			NotificationService.Instance.Send(_("Script Executed Successfully"), _("Your script has been executed successfully."));
		else {
			Logger.Error("Error running script: ", result.ErrorData);
			NotificationService.Instance.Send(_("Error Running Script"), _("Script returned error, see logs for more information"));
		}
	}

	private async submitIssue(): Promise<void> {
		const command = "xdg-open";
		const baseUrl = 'https://github.com/linuxmint/cinnamon-spices-applets/issues/new';
		const title = "weather@mockturl - ";

		const distribution: string = (await SpawnProcess(["uname", "-vrosmi"]))?.Data?.trim();
		const appletVersion = this.metadata.version;
		const cinnamonVersion = imports.misc.config.PACKAGE_VERSION;
		const vgaInfo = (await SpawnProcess(["lspci"])).Data?.split("\n").filter(x => x.includes("VGA"));

		let body = "```\n";
		body+= ` * Applet version - ${appletVersion}\n`;
		body+= ` * Cinnamon version - ${cinnamonVersion}\n`;
		body+= ` * Distribution - ${distribution}\n`;
		body+= ` * Graphics hardware - ${vgaInfo.join(", ")}\n`;
		body+= "```\n\n";

		body+= `**Notify author of applet**\n@Gr3q\n\n`;

		body+= "**Issue**\n\n\n\n**Steps to reproduce**\n\n\n\n**Expected behaviour**\n\n\n\n**Other information**\n\n";

		body+= `<details>
<summary>Relevant Logs</summary>

\`\`\`
The contents of the file saved from the applet help page goes here
\`\`\`

</details>\n\n`;

		const finalUrl = `${baseUrl}?title=${encodeURI(title)}&body=${encodeURI(body)}`.replace(/[#()]/g, "");
		spawnCommandLine(`${command} ${finalUrl}`);
	}

	private saveCurrentLocation(): void {
		void this.config.LocStore.SaveCurrentLocation(this.config.CurrentLocation);
	}

	public saveLog = async(): Promise<void> => {
		// Empty string, abort
		if (!(this.config._selectedLogPath?.length > 0))
			return;

		let logLines: string[] = [];
		try {
			logLines = await Logger.GetAppletLogs();
		}
		catch(e) {
			if (e instanceof Error) {
				NotificationService.Instance.Send(_("Error Saving Debug Information"), e.message);
			}
			return;
		}

		let settings: Record<string, unknown> | null = null;
		try {
			settings = await this.config.GetAppletConfigJson();
		}
		catch(e) {
			if (e instanceof Error) {
				NotificationService.Instance.Send(_("Error Saving Debug Information"), e.message);
			}
			return;
		}

		const appletLogFile = File.new_for_path(this.config._selectedLogPath);
		const stream = await OverwriteAndGetIOStream(appletLogFile);
		if (stream == null) {
			NotificationService.Instance.Send(_("Error Saving Debug Information"), _("Could not open file {filePath} for writing", {filePath: this.config._selectedLogPath} ));
			return;
		}

		await WriteAsync(stream.get_output_stream(), logLines.join("\n"));

		if (settings != null) {
			await WriteAsync(stream.get_output_stream(), "\n\n------------------- SETTINGS JSON -----------------\n\n");
			await WriteAsync(stream.get_output_stream(), JSON.stringify(settings, null, 2));
		}

		await CloseStream(stream.get_output_stream());
		NotificationService.Instance.Send(_("Debug Information saved successfully"), _("Saved to {filePath}", {filePath: this.config._selectedLogPath}));
	}

	private async SendCommand() {
		if (!this.config._runScript) {
			return null;
		}

		if (!this.currentWeatherInfo) {
			return null;
		}

		let command = InjectValues(this.config._runScript, this.currentWeatherInfo, this.config, true);
		command = command.replace(/{{full_data}}/g, Literal(JSON.stringify(this.currentWeatherInfo)));
		command = command.replace(/{full_data}/g, JSON.stringify(this.currentWeatherInfo));

		return SpawnProcess([command]);
	}


	/**
	 * Callback wrapper for events, awaits until a refresh is done and ensures complete
	 * weather data is provided.
	 * @param callback
	 * @returns
	 */
	public AfterRefresh = <T, TT>(callback: (owner: T, data: TT, weatherData: WeatherData) => void | Promise<void>): ((owner: T, data: TT) => Promise<void>) => {
		return async (owner, data) => {
			await this.loop.Refreshing;
			const weatherData = this.CurrentData;
			if (weatherData == null)
				return;
			void callback(owner, data, weatherData);
		}
	}

	// -------------------------------------------------------------------
	// Applet Overrides, do not delete

	public override on_orientation_changed(orientation: imports.gi.St.Side): void {
		this.orientation = orientation;
		if (this.currentWeatherInfo)
			this.onSettingNeedsRebuild(this.config, null, this.currentWeatherInfo);
	};

	public override on_applet_removed_from_panel(): void {
		Logger.Info("Removing applet instance...")
		this.loop.Stop();
		this.config.Destroy();
		Event.DisconnectAll();
	}

	public override on_applet_clicked(): boolean {
		this.ui.Toggle();
		return false;
	}

	public override on_applet_middle_clicked(): boolean {
		return false;
	}

	public override on_panel_height_changed(): void {
		// Implemented byApplets
	}

	// ---------------------------------------------------------------------
	// Utilities

	/** Set applet on the panel with default settings */
	private SetAppletOnPanel(): void {
		this.set_applet_icon_name(APPLET_ICON);
		this.set_applet_label(_("..."));
		this.set_applet_tooltip(_("Click to open"));
	}

	/** Into right-click context menu */
	private AddRefreshButton(): void {
		const itemLabel = _("Refresh")
		const refreshMenuItem = new MenuItem(itemLabel, REFRESH_ICON, () => this.loop.Refresh({rebuild: true}));
		this._applet_context_menu.addMenuItem(refreshMenuItem);
	}

	/**
	 * Handles general errors from HTTPLib
	 * @param error
	 */
	private HandleHTTPError(error: HttpError): void {
		const appletError: AppletError = {
			detail: error.message,
			userError: false,
			code: error.code,
			message: this.errMsg[error.message],
			type: "soft"
		};

		switch (error.message) {
			case "bad status code":
			case "unknown":
				appletError.type = "hard"
		}

		this.ShowError(appletError);
	}

	private SetCustomIcon(iconName: CustomIcons): void {
		this.set_applet_icon_symbolic_name(iconName);
	}

	/**
	 * Lazy load provider
	 * @param force Force provider re initialization
	 */
	private EnsureProvider(force: boolean = false): void {
		const currentName = this.provider?.name;
		if (currentName != this.config._dataService || force)
			this.provider = ServiceClassMapping[this.config._dataService](this);
	}

	/** Fills in missing weather info from location Data
	 * and applies translations if needed.
	 */
	private MergeWeatherData(weatherInfo: WeatherData, locationData: LocationData) {
		if (weatherInfo.location.city == null) weatherInfo.location.city = locationData.city;
		if (weatherInfo.location.country == null) weatherInfo.location.country = locationData.country;
		if (weatherInfo.location.timeZone == null) weatherInfo.location.timeZone = locationData.timeZone;
		if (weatherInfo.coord.lat == null) weatherInfo.coord.lat = locationData.lat;
		if (weatherInfo.coord.lon == null) weatherInfo.coord.lon = locationData.lon;
		if (weatherInfo.hourlyForecasts == null) weatherInfo.hourlyForecasts = [];

		// Translate conditions if set
		weatherInfo.condition.main = ProcessCondition(weatherInfo.condition.main);
		weatherInfo.condition.description = ProcessCondition(weatherInfo.condition.description);

		for (const forecast of weatherInfo.forecasts) {
			const condition = forecast.condition;
			condition.main = ProcessCondition(condition.main);
			condition.description = ProcessCondition(condition.description);
		}

		for (const forecast of weatherInfo.hourlyForecasts) {
			const condition = forecast.condition;
			condition.main = ProcessCondition(condition.main);
			condition.description = ProcessCondition(condition.description);
		}

		return weatherInfo;
	}

	// ---------------------------------------------------------------------------------------

	// Error handling

	/** For displaying hard errors */
	private DisplayHardError(title: string, msg: string): void {
		this.set_applet_label(title);
		this.set_applet_tooltip("Click to open");
		this.set_applet_icon_name("weather-severe-alert");
		this.ui.DisplayErrorMessage(msg);
	};

	private errMsg: NiceErrorDetail = { // Error messages to use
		unknown: _("Error"),
		"bad api response - non json": _("Service Error"),
		"bad key": _("Incorrect API Key"),
		"bad api response": _("Service Error"),
		"bad location format": _("Incorrect Location Format"),
		"bad status code": _("Service Error"),
		"key blocked": _("Key Blocked"),
		"location not found": _("Can't find location"),
		"no api response": _("Service Error"),
		"no key": _("No Api Key"),
		"no location": _("No Location"),
		"no network response": _("Service Error"),
		"no response body": _("Service Error"),
		"no response data": _("Service Error"),
		"unusual payload": _("Service Error"),
		"import error": _("Missing Packages"),
		"location not covered": _("Location not covered"),
		"location service blocked": _("Location Service Blocked")
	}

	public ShowError(error: AppletError): void {
		if (error == null) return;
		// An error already claimed in this loop
		if (this.encounteredError == true) return;

		this.encounteredError = true;
		Logger.Debug("User facing Error received, error: " + JSON.stringify(error, null, 2));

		if (error.type == "hard") {
			Logger.Debug("Displaying hard error");
			this.ui.Rebuild(this.config);
			this.DisplayHardError(this.errMsg[error.detail], error.message ?? "");
		}

		if (error.type == "soft") {
			// Maybe something less invasive on network related errors?
			// Nothing yet
			if (this.loop.IsDataTooOld()) {
				this.set_applet_tooltip("Click to open");
				this.set_applet_icon_name("weather-severe-alert");
				this.ui.DisplayErrorMessage(_("Could not update weather for a while...\nare you connected to the internet?"));
			}
		}

		if (error.userError) {
			Logger.Error("Error received caused by User, Pausing main loop.");
			this.loop.Pause();
			return;
		}

		const nextRefresh = this.loop.GetSecondsUntilNextRefresh();
		Logger.Error("Retrying in the next " + nextRefresh.toString() + " seconds...");
	}

	//----------------------------------------------------------------------------------
}
