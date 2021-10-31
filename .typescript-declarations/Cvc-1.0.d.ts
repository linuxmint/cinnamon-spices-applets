declare namespace imports.gi.Cvc {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ChannelMap} instead.
	 */
	interface IChannelMap {
		can_balance(): boolean;
		can_fade(): boolean;
		can_lfe(): boolean;
		get_balance(): number;
		get_fade(): number;
		get_lfe(): number;
		get_mapping(): string;
		get_num_channels(): number;
		get_volume(): number;
		has_position(position: number): boolean;
		set_balance(value: number): void;
		set_fade(value: number): void;
		set_lfe(value: number): void;
		connect(signal: "volume-changed", callback: (owner: this, object: boolean) => void): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link ChannelMap} instead.
	 */
	type ChannelMapMixin = IChannelMap & GObject.IObject;

	interface ChannelMap extends ChannelMapMixin {}

	class ChannelMap {
		public constructor();
		public static new(): ChannelMap;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerCard} instead.
	 */
	interface IMixerCard {
		readonly human_profile: string;
		icon_name: string;
		id: number;
		index: number;
		name: string;
		pa_context: any;
		profile: string;
		change_profile(profile: string): boolean;
		get_gicon(): Gio.Icon;
		get_icon_name(): string;
		get_id(): number;
		get_index(): number;
		get_name(): string;
		get_ports(): GLib.List;
		get_profile(): MixerCardProfile;
		get_profiles(): GLib.List;
		set_icon_name(name: string): boolean;
		set_name(name: string): boolean;
		set_ports(ports: GLib.List): boolean;
		set_profile(profile: string): boolean;
		set_profiles(profiles: GLib.List): boolean;
		connect(signal: "notify::human_profile", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::icon_name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::id", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::index", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::pa_context", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::profile", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerCard} instead.
	 */
	type MixerCardMixin = IMixerCard & GObject.IObject;

	interface MixerCard extends MixerCardMixin {}

	class MixerCard {
		public constructor();
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerControl} instead.
	 */
	interface IMixerControl {
		name: string;
		change_input(input: MixerUIDevice): void;
		change_output(output: MixerUIDevice): void;
		change_profile_on_selected_device(device: MixerUIDevice, profile: string): boolean;
		close(): boolean;
		get_cards(): GLib.SList;
		get_default_sink(): MixerStream;
		get_default_source(): MixerStream;
		get_event_sink_input(): MixerStream;
		get_sink_inputs(): GLib.SList;
		get_sinks(): GLib.SList;
		get_source_outputs(): GLib.SList;
		get_sources(): GLib.SList;
		get_state(): MixerControlState;
		get_stream_from_device(device: MixerUIDevice): MixerStream;
		get_streams(): GLib.SList;
		get_vol_max_amplified(): number;
		get_vol_max_norm(): number;
		lookup_card_id(_id: number): MixerCard;
		lookup_device_from_stream(stream: MixerStream): MixerUIDevice;
		lookup_input_id(_id: number): MixerUIDevice;
		lookup_output_id(_id: number): MixerUIDevice;
		lookup_stream_id(_id: number): MixerStream;
		open(): boolean;
		set_default_sink(stream: MixerStream): boolean;
		set_default_source(stream: MixerStream): boolean;
		set_headset_port(_id: number, choices: HeadsetPortChoice): void;
		connect(signal: "active-input-update", callback: (owner: this, object: number) => void): number;
		connect(signal: "active-output-update", callback: (owner: this, object: number) => void): number;
		connect(signal: "audio-device-selection-needed", callback: (owner: this, object: number, p0: boolean, p1: number) => void): number;
		connect(signal: "card-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "card-removed", callback: (owner: this, object: number) => void): number;
		connect(signal: "default-sink-changed", callback: (owner: this, object: number) => void): number;
		connect(signal: "default-source-changed", callback: (owner: this, object: number) => void): number;
		connect(signal: "input-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "input-removed", callback: (owner: this, object: number) => void): number;
		connect(signal: "output-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "output-removed", callback: (owner: this, object: number) => void): number;
		connect(signal: "state-changed", callback: (owner: this, object: number) => void): number;
		connect(signal: "stream-added", callback: (owner: this, object: number) => void): number;
		connect(signal: "stream-changed", callback: (owner: this, object: number) => void): number;
		connect(signal: "stream-removed", callback: (owner: this, object: number) => void): number;

		connect(signal: "notify::name", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerControl} instead.
	 */
	type MixerControlMixin = IMixerControl & GObject.IObject;

	interface MixerControl extends MixerControlMixin {}

	class MixerControl {
		public constructor(options?: Partial<MixerControlOptions>);
		public static new(name: string): MixerControl;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerEventRole} instead.
	 */
	interface IMixerEventRole {
		device: string;

		connect(signal: "notify::device", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerEventRole} instead.
	 */
	type MixerEventRoleMixin = IMixerEventRole & IMixerStream;

	interface MixerEventRole extends MixerEventRoleMixin {}

	class MixerEventRole {
		public constructor();
		public static new(context: any, device: string, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSink} instead.
	 */
	interface IMixerSink {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSink} instead.
	 */
	type MixerSinkMixin = IMixerSink & IMixerStream;

	interface MixerSink extends MixerSinkMixin {}

	class MixerSink {
		public constructor();
		public static new(context: any, index: number, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSinkInput} instead.
	 */
	interface IMixerSinkInput {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSinkInput} instead.
	 */
	type MixerSinkInputMixin = IMixerSinkInput & IMixerStream;

	interface MixerSinkInput extends MixerSinkInputMixin {}

	class MixerSinkInput {
		public constructor();
		public static new(context: any, index: number, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSource} instead.
	 */
	interface IMixerSource {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSource} instead.
	 */
	type MixerSourceMixin = IMixerSource & IMixerStream;

	interface MixerSource extends MixerSourceMixin {}

	class MixerSource {
		public constructor();
		public static new(context: any, index: number, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSourceOutput} instead.
	 */
	interface IMixerSourceOutput {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerSourceOutput} instead.
	 */
	type MixerSourceOutputMixin = IMixerSourceOutput & IMixerStream;

	interface MixerSourceOutput extends MixerSourceOutputMixin {}

	class MixerSourceOutput {
		public constructor();
		public static new(context: any, index: number, channel_map: ChannelMap): MixerStream;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerStream} instead.
	 */
	interface IMixerStream {
		application_id: string;
		can_decibel: boolean;
		card_index: number;
		channel_map: ChannelMap;
		decibel: number;
		description: string;
		form_factor: string;
		icon_name: string;
		id: number;
		index: number;
		// is_event_stream: boolean;
		is_muted: boolean;
		// is_virtual: boolean;
		name: string;
		pa_context: any;
		port: string;
		sysfs_path: string;
		volume: number;
		change_is_muted(is_muted: boolean): boolean;
		change_port(_port: string): boolean;
		create_monitor(): void;
		get_application_id(): string;
		get_base_volume(): number;
		get_can_decibel(): boolean;
		get_card_index(): number;
		get_channel_map(): ChannelMap;
		get_decibel(): number;
		get_description(): string;
		get_form_factor(): string;
		get_gicon(): Gio.Icon;
		get_icon_name(): string;
		get_id(): number;
		get_index(): number;
		get_is_muted(): boolean;
		get_name(): string;
		get_port(): MixerStreamPort;
		get_ports(): GLib.List;
		get_sysfs_path(): string;
		get_volume(): number;
		is_event_stream(): boolean;
		is_running(): boolean;
		is_virtual(): boolean;
		push_volume(): boolean;
		remove_monitor(): void;
		set_application_id(application_id: string): boolean;
		set_base_volume(base_volume: number): boolean;
		set_can_decibel(can_decibel: boolean): boolean;
		set_card_index(card_index: number): boolean;
		set_decibel(db: number): boolean;
		set_description(description: string): boolean;
		set_form_factor(form_factor: string): boolean;
		set_icon_name(name: string): boolean;
		set_is_event_stream(is_event_stream: boolean): boolean;
		set_is_muted(is_muted: boolean): boolean;
		set_is_virtual(is_event_stream: boolean): boolean;
		set_name(name: string): boolean;
		set_port(_port: string): boolean;
		set_ports(ports: GLib.List): boolean;
		set_sysfs_path(sysfs_path: string): boolean;
		set_volume(volume: number): boolean;
		connect(signal: "monitor-suspend", callback: (owner: this) => void): number;
		connect(signal: "monitor-update", callback: (owner: this, object: number) => void): number;

		connect(signal: "notify::application_id", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::can_decibel", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::card_index", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::channel_map", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::decibel", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::description", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::form_factor", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::icon_name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::id", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::index", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::is_event_stream", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::is_muted", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::is_virtual", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::pa_context", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::port", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::sysfs_path", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::volume", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerStream} instead.
	 */
	type MixerStreamMixin = IMixerStream & GObject.IObject;

	interface MixerStream extends MixerStreamMixin {}

	class MixerStream {
		public constructor();
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerUIDevice} instead.
	 */
	interface IMixerUIDevice {
		card: any;
		description: string;
		icon_name: string;
		origin: string;
		port_available: boolean;
		port_name: string;
		stream_id: number;
		type: number;
		get_active_profile(): string;
		get_best_profile(selected: string, current: string): string;
		get_card(): MixerCard;
		get_description(): string;
		get_gicon(): Gio.Icon;
		get_icon_name(): string;
		get_id(): number;
		get_matching_profile(profile: string): string;
		get_origin(): string;
		get_port(): string;
		get_profiles(): GLib.List;
		get_stream_id(): number;
		get_supported_profiles(): GLib.List;
		get_top_priority_profile(): string;
		get_user_preferred_profile(): string;
		has_ports(): boolean;
		invalidate_stream(): void;
		is_output(): boolean;
		/**
		 * Assigns value to
		 *  - device->priv->profiles (profiles to be added to combobox)
		 *  - device->priv->supported_profiles (all profiles of this port)
		 *  - device->priv->disable_profile_swapping (whether to show the combobox)
		 * 
		 * This method attempts to reduce the list of profiles visible to the user by figuring out
		 * from the context of that device (whether it's an input or an output) what profiles
		 * actually provide an alternative.
		 * 
		 * It does this by the following.
		 *  - It ignores off profiles.
		 *  - It takes the canonical name of the profile. That name is what you get when you
		 *    ignore the other direction.
		 *  - In the first iteration, it only adds the names of canonical profiles - i e
		 *    when the other side is turned off.
		 *  - Normally the first iteration covers all cases, but sometimes (e g bluetooth)
		 *    it doesn't, so add other profiles whose canonical name isn't already added
		 *    in a second iteration.
		 * @param in_profiles a list of GvcMixerCardProfile
		 */
		set_profiles(in_profiles: GLib.List): void;
		set_user_preferred_profile(profile: string): void;
		should_profiles_be_hidden(): boolean;
		connect(signal: "notify::card", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::description", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::icon_name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::origin", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::port_available", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::port_name", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::stream_id", callback: (owner: this, ...args: any) => number): number;
		connect(signal: "notify::type", callback: (owner: this, ...args: any) => number): number;

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link MixerUIDevice} instead.
	 */
	type MixerUIDeviceMixin = IMixerUIDevice & GObject.IObject;

	interface MixerUIDevice extends MixerUIDeviceMixin {}

	class MixerUIDevice {
		public constructor();
	}

	interface ChannelMapClass {}
	class ChannelMapClass {
		public constructor();
		public volume_changed: {(channel_map: ChannelMap, set: boolean): void;};
	}

	interface ChannelMapPrivate {}
	class ChannelMapPrivate {
		public constructor();
	}

	interface MixerCardClass {}
	class MixerCardClass {
		public constructor();
	}

	interface MixerCardPort {}
	class MixerCardPort {
		public constructor();
		public port: string;
		public human_port: string;
		public icon_name: string;
		public priority: number;
		public available: number;
		public direction: number;
		public profiles: GLib.List;
	}

	interface MixerCardPrivate {}
	class MixerCardPrivate {
		public constructor();
	}

	interface MixerCardProfile {}
	class MixerCardProfile {
		public constructor();
		public profile: string;
		public human_profile: string;
		public status: string;
		public priority: number;
		public n_sinks: number;
		public n_sources: number;
		public compare(_b: MixerCardProfile): number;
	}

	interface MixerControlClass {}
	class MixerControlClass {
		public constructor();
		public state_changed: {(control: MixerControl, new_state: MixerControlState): void;};
		public stream_added: {(control: MixerControl, _id: number): void;};
		public stream_changed: {(control: MixerControl, _id: number): void;};
		public stream_removed: {(control: MixerControl, _id: number): void;};
		public card_added: {(control: MixerControl, _id: number): void;};
		public card_removed: {(control: MixerControl, _id: number): void;};
		public default_sink_changed: {(control: MixerControl, _id: number): void;};
		public default_source_changed: {(control: MixerControl, _id: number): void;};
		public active_output_update: {(control: MixerControl, _id: number): void;};
		public active_input_update: {(control: MixerControl, _id: number): void;};
		public output_added: {(control: MixerControl, _id: number): void;};
		public input_added: {(control: MixerControl, _id: number): void;};
		public output_removed: {(control: MixerControl, _id: number): void;};
		public input_removed: {(control: MixerControl, _id: number): void;};
		public audio_device_selection_needed: {(control: MixerControl, _id: number, show_dialog: boolean, choices: HeadsetPortChoice): void;};
	}

	interface MixerControlPrivate {}
	class MixerControlPrivate {
		public constructor();
	}

	interface MixerEventRoleClass {}
	class MixerEventRoleClass {
		public constructor();
	}

	interface MixerEventRolePrivate {}
	class MixerEventRolePrivate {
		public constructor();
	}

	interface MixerSinkClass {}
	class MixerSinkClass {
		public constructor();
	}

	interface MixerSinkInputClass {}
	class MixerSinkInputClass {
		public constructor();
	}

	interface MixerSinkInputPrivate {}
	class MixerSinkInputPrivate {
		public constructor();
	}

	interface MixerSinkPrivate {}
	class MixerSinkPrivate {
		public constructor();
	}

	interface MixerSourceClass {}
	class MixerSourceClass {
		public constructor();
	}

	interface MixerSourceOutputClass {}
	class MixerSourceOutputClass {
		public constructor();
	}

	interface MixerSourceOutputPrivate {}
	class MixerSourceOutputPrivate {
		public constructor();
	}

	interface MixerSourcePrivate {}
	class MixerSourcePrivate {
		public constructor();
	}

	interface MixerStreamClass {}
	class MixerStreamClass {
		public constructor();
		public push_volume: {(stream: MixerStream, operation: any | null): boolean;};
		public change_is_muted: {(stream: MixerStream, is_muted: boolean): boolean;};
		public change_port: {(stream: MixerStream, _port: string): boolean;};
		public monitor_update: {(stream: MixerStream, _v: number): void;};
		public monitor_suspend: {(stream: MixerStream): void;};
	}

	interface MixerStreamPort {}
	class MixerStreamPort {
		public constructor();
		public port: string;
		public human_port: string;
		public priority: number;
		public available: boolean;
	}

	interface MixerStreamPrivate {}
	class MixerStreamPrivate {
		public constructor();
	}

	interface MixerUIDeviceClass {}
	class MixerUIDeviceClass {
		public constructor();
	}

	interface MixerUIDevicePrivate {}
	class MixerUIDevicePrivate {
		public constructor();
	}

	enum MixerControlState {
		CLOSED = 0,
		READY = 1,
		CONNECTING = 2,
		FAILED = 3
	}

	enum MixerUIDeviceDirection {
		IDEVICEINPUT = 0,
		IDEVICEOUTPUT = 1
	}

	enum HeadsetPortChoice {
		NONE = 0,
		HEADPHONES = 1,
		HEADSET = 2,
		MIC = 4
	}

}