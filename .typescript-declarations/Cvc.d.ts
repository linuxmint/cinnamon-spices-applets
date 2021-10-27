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
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link ChannelMap} instead.
     */
    type ChannelMapMixin = IChannelMap & GObject.IObject;

    interface ChannelMap extends ChannelMapMixin { }

    class ChannelMap {
        constructor();
        static new(): ChannelMap;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerCard} instead.
     */
    interface IMixerCard {
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
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerCard} instead.
     */
    type MixerCardMixin = IMixerCard & GObject.IObject;

    interface MixerCard extends MixerCardMixin { }

    class MixerCard {
        constructor();
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerControl} instead.
     */
    interface IMixerControl {
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
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerControl} instead.
     */
    type MixerControlMixin = IMixerControl & GObject.IObject;

    interface MixerControl extends MixerControlMixin { }

    class MixerControl {
        constructor();
        static new(name: string): MixerControl;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerEventRole} instead.
     */
    interface IMixerEventRole {

    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerEventRole} instead.
     */
    type MixerEventRoleMixin = IMixerEventRole & IMixerStream;

    interface MixerEventRole extends MixerEventRoleMixin { }

    class MixerEventRole {
        constructor();
        static new(context: undefined, device: string, channel_map: ChannelMap): MixerStream;
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

    interface MixerSink extends MixerSinkMixin { }

    class MixerSink {
        constructor();
        static new(context: undefined, index: number, channel_map: ChannelMap): MixerStream;
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

    interface MixerSinkInput extends MixerSinkInputMixin { }

    class MixerSinkInput {
        constructor();
        static new(context: undefined, index: number, channel_map: ChannelMap): MixerStream;
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

    interface MixerSource extends MixerSourceMixin { }

    class MixerSource {
        constructor();
        static new(context: undefined, index: number, channel_map: ChannelMap): MixerStream;
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

    interface MixerSourceOutput extends MixerSourceOutputMixin { }

    class MixerSourceOutput {
        constructor();
        static new(context: undefined, index: number, channel_map: ChannelMap): MixerStream;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerStream} instead.
     */
    interface IMixerStream {
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
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerStream} instead.
     */
    type MixerStreamMixin = IMixerStream & GObject.IObject;

    interface MixerStream extends MixerStreamMixin { }

    class MixerStream {
        constructor();
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerUIDevice} instead.
     */
    interface IMixerUIDevice {
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
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link MixerUIDevice} instead.
     */
    type MixerUIDeviceMixin = IMixerUIDevice & GObject.IObject;

    interface MixerUIDevice extends MixerUIDeviceMixin { }

    class MixerUIDevice {
        constructor();
    }

    class ChannelMapClass {
        public parent_class: GObject.ObjectClass;
        volume_changed: { (channel_map: ChannelMap, set: boolean): void; };
    }

    class ChannelMapPrivate {
    }

    class MixerCardClass {
        public parent_class: GObject.ObjectClass;
    }

    class MixerCardPort {
        public port: string;
        public human_port: string;
        public icon_name: string;
        public priority: number;
        public available: number;
        public direction: number;
        public profiles: GLib.List;
    }

    class MixerCardPrivate {
    }

    class MixerCardProfile {
        public profile: string;
        public human_profile: string;
        public status: string;
        public priority: number;
        public n_sinks: number;
        public n_sources: number;
        public compare(_b: MixerCardProfile): number;
    }

    class MixerControlClass {
        public parent_class: GObject.ObjectClass;
        state_changed: { (control: MixerControl, new_state: MixerControlState): void; };
        stream_added: { (control: MixerControl, _id: number): void; };
        stream_changed: { (control: MixerControl, _id: number): void; };
        stream_removed: { (control: MixerControl, _id: number): void; };
        card_added: { (control: MixerControl, _id: number): void; };
        card_removed: { (control: MixerControl, _id: number): void; };
        default_sink_changed: { (control: MixerControl, _id: number): void; };
        default_source_changed: { (control: MixerControl, _id: number): void; };
        active_output_update: { (control: MixerControl, _id: number): void; };
        active_input_update: { (control: MixerControl, _id: number): void; };
        output_added: { (control: MixerControl, _id: number): void; };
        input_added: { (control: MixerControl, _id: number): void; };
        output_removed: { (control: MixerControl, _id: number): void; };
        input_removed: { (control: MixerControl, _id: number): void; };
        audio_device_selection_needed: { (control: MixerControl, _id: number, show_dialog: boolean, choices: HeadsetPortChoice): void; };
    }

    class MixerControlPrivate {
    }

    class MixerEventRoleClass {
        public parent_class: MixerStreamClass;
    }

    class MixerEventRolePrivate {
    }

    class MixerSinkClass {
        public parent_class: MixerStreamClass;
    }

    class MixerSinkInputClass {
        public parent_class: MixerStreamClass;
    }

    class MixerSinkInputPrivate {
    }

    class MixerSinkPrivate {
    }

    class MixerSourceClass {
        public parent_class: MixerStreamClass;
    }

    class MixerSourceOutputClass {
        public parent_class: MixerStreamClass;
    }

    class MixerSourceOutputPrivate {
    }

    class MixerSourcePrivate {
    }

    class MixerStreamClass {
        public parent_class: GObject.ObjectClass;
        push_volume: { (stream: MixerStream, operation: any): boolean; };
        change_is_muted: { (stream: MixerStream, is_muted: boolean): boolean; };
        change_port: { (stream: MixerStream, _port: string): boolean; };
        monitor_update: { (stream: MixerStream, _v: number): void; };
        monitor_suspend: { (stream: MixerStream): void; };
    }

    class MixerStreamPort {
        public port: string;
        public human_port: string;
        public priority: number;
        public available: boolean;
    }

    class MixerStreamPrivate {
    }

    class MixerUIDeviceClass {
        public parent_class: GObject.ObjectClass;
    }

    class MixerUIDevicePrivate {
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