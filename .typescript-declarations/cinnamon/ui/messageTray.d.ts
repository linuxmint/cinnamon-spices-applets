declare namespace imports.ui.messageTray {
	const ANIMATION_TIME: number;
	const NOTIFICATION_TIMEOUT: number;
	const NOTIFICATION_CRITICAL_TIMEOUT_WITH_APPLET: number;
	const SUMMARY_TIMEOUT: number;
	const LONGER_SUMMARY_TIMEOUT: number;

	const HIDE_TIMEOUT: number;
	const LONGER_HIDE_TIMEOUT: number;

	const NOTIFICATION_IMAGE_SIZE: number;
	/** 0 - 255 */
	const NOTIFICATION_IMAGE_OPACITY: number;

	enum State {
		HIDDEN = 0,
		SHOWING = 1,
		SHOWN = 2,
		HIDING = 3
	}

	/** These reasons are useful when we destroy the notifications received through
	the notification daemon. We use EXPIRED for transient notifications that the
	user did not interact with, DISMISSED for all other notifications that were
	destroyed as a result of a user action, and SOURCE_CLOSED for the notifications
	that were requested to be destroyed by the associated source. */
	enum NotificationDestroyedReason {
		EXPIRED = 1,
		DISMISSED = 2,
		SOURCE_CLOSED = 3
	}

	/** Message tray has its custom Urgency enumeration. LOW, NORMAL and CRITICAL
	 urgency values map to the corresponding values for the notifications received
	through the notification daemon. HIGH urgency value is used for chats received
	through the Telepathy client. */
	enum Urgency {
		LOW = 0,
		NORMAL = 1,
		HIGH = 2,
		CRITICAL = 3
	}

	function _fixMarkup(text: string, allowMarkup: boolean): string;

	interface URL {
		url: string;
		pos: number;
	}

	class URLHighlighter {
		public actor: gi.St.Label;
		protected _urls: URL[];
		protected _linkColor: string;
		protected _text: string;

		public constructor(text?: string, lineWrap?: boolean, allowMarkup?: boolean);

		public setMarkup(text?: string, allowMarkup?: boolean): void;

		protected _highlightUrls(): void;

		protected _findUrlAtPos(event: gi.Clutter.Event): number;
	}


	/**
	 * #Notification:
	 * @short_description: A shell notification.
	 * @source (object): The notification's Source
	 * @title (string): The title/summary text
	 * @body (string): Optional - body text
	 * @params (object): Optional - additional params
	 *
	 * Creates a notification with the associated title and body
	 *
	 * @params can contain values for 'body', 'icon', 'titleMarkup',
	 * 'bodyMarkup', and 'silent' parameters.
	 *
	 * By default, the icon shown is created by calling
	 * source.createNotificationIcon(). However, if @params contains an 'icon'
	 * parameter, the passed in icon will be shown.
	 *
	 * If @params contains a 'titleMarkup', or 'bodyMarkup' parameter
	 * with the value %true, then the corresponding element is assumed to
	 * use pango markup. If the parameter is not present for an element,
	 * then anything that looks like markup in that element will appear
	 * literally in the output.
	 *
	 * If @params contains a 'silent' parameter with the value %true, then
	 * the associated sound effects are suppressed. Note that notifications
	 * with an URGENT priority will always play a sound effect if there is
	 * one set.
	 */

	interface NotificationParams {
		/** Default null */
		icon: gi.St.Icon;
		/** Default false */
		titleMarkup: boolean;
		/** Default false */
		bodyMarkup: boolean;
		/** Default false */
		silent: boolean;
	}

	type NotificationEventEmitters = "action-invoked" | "done-displaying" | "clicked" | "destroy";

	class Notification {
		public actor: gi.St.Button;
		public source: SystemNotificationSource;
		public title: string;
		public urgency: Urgency;
		public resident: boolean;
		public isTransient: boolean;
		public silent: boolean;
		protected _destroyed: boolean;
		protected _useActionIcons: boolean;
		protected _titleDirection: gi.St.TextDirection;
		protected _scrollArea: gi.St.ScrollView;
		protected _actionArea: gi.St.BoxLayout;
		protected _imageBin: gi.St.Bin;
		protected _timestamp: Date;
		protected _inNotificationBin: boolean;
		protected _table: gi.St.Table;
		protected _buttonFocusManager: gi.St.FocusManager;
		protected _bannerBox: gi.St.BoxLayout;
		protected _timeLabel: gi.St.Label;
		protected _titleLabel: gi.St.Label;
		protected _icon: gi.St.Icon;
		protected _bodyUrlHighlighter: URLHighlighter;
		protected _destroyedReason: string;

		public constructor(source: SystemNotificationSource, title: string, body: string, params?: Partial<NotificationParams>);

		/** for backwards compatibility with old class constant */
		public get IMAGE_SIZE(): number;

		/**
		 * update:
		 * @title (string): the new title
		 * @body (string): the new body
		 * @params (object): as in the Notification constructor
		 *
		 * Updates the notification timestamp, title, and body and
		 * regenerates the icon.
		 */
		public update(title: string, body: string, params?: Partial<NotificationParams>): void;

		protected _setBodyArea(text?: string, allowMarkup?: boolean): void;

		public setIconVisible(visible: boolean): void;

		/**
			 * scrollTo:
			 * @side (St.Side): St.Side.TOP or St.Side.BOTTOM
			 * 
			 * Scrolls the content area (if scrollable) to the indicated edge
			 */
		public scrollTo(side: gi.St.Side): void;

		protected _updateLayout(): void;

		public setImage(image: gi.St.Image): void;

		public unsetImage(): void;

		/**
		 * addButton:
		 * @id (number): the action ID
		 * @label (string): the label for the action's button
		 * 
		 * Adds a button with the given @label to the notification. All
		 * action buttons will appear in a single row at the bottom of
		 * the notification.
		 * 
		 * If the button is clicked, the notification will emit the
		 * %action-invoked signal with @id as a parameter.
		 */
		public addButton(id: string, label: string): void;

		/**
		 * clearButtons:
		 * 
		 * Removes all buttons.
		 */
		public clearButtons(): void;

		public setUrgency(urgency: Urgency): void;

		public setResident(resident: boolean): void;

		public setTransient(isTransient: boolean): void;

		public setUseActionIcons(useIcons: boolean): void;

		protected _onActionInvoked(actor: gi.Clutter.Actor, mouseButtonClicked: number, id: string): void;

		protected _onClicked(): void;

		protected _onDestroy(): void;

		public destroy(reason: string): void;

		public connect(event: 'action-invoked', cb: (actor: this, actionId: string) => void): void
		public connect(event: 'done-displaying' | 'clicked', cb: (actor: this) => void): void
		public connect(event: 'destroyed', cb: (actor: this, destroyedReason: string) => void): void

	}

	type SourceEventEmitters = "title-changed" | "notification-added" | "notify" | "destroy";
	class Source {
		public readonly ICON_SIZE: number;
		public readonly MAX_NOTIFICATIONS: number;
		public title: string;
		public actor: imports.gi.Cinnamon.GenericContainer;
		public notifications: Notification[];
		public isTransient: boolean;
		public isChat: boolean;

		protected _actorDestroyed: boolean;
		protected _counterLabel: gi.St.Label;
		protected _counterBin: gi.St.Bin;
		protected _iconBin: gi.St.Bin;

		public constructor(title: string);

		protected _getPreferredWidth(actor: gi.Clutter.Actor, forHeight: number, alloc: any): void;

		protected _getPreferredHeight(actor: gi.Clutter.Actor, forWidth: number, alloc: any): void;

		protected _allocate(actor: gi.Clutter.Actor, box: gi.Clutter.ActorBox, flags: any): void;

		protected _setCount(count: number, visible: boolean): void;

		protected _updateCount(): void;

		public setTransient(isTransient: boolean): void;

		public setTitle(newTitle: string): void;

		/**
		 * Called to create a new icon actor (of size this.ICON_SIZE).
		 * Must be overridden by the subclass if you do not pass icons
		 * explicitly to the Notification() constructor.
		 */
		public createNotificationIcon(): void;

		/**
		 * Unlike createNotificationIcon, this always returns the same actor;
		 * there is only one summary icon actor for a Source.
		 */
		public getSummaryIcon(): gi.Cinnamon.GenericContainer;

		public pushNotification(notification: Notification): void;

		public notify(notification: Notification): void;

		public destroy(reason: string): void;

		// A subclass can redefine this to "steal" clicks from the
		// summaryitem; Use Clutter.get_current_event() to get the
		// details, return true to prevent the default handling from
		// ocurring.
		/**
		 * A subclass can redefine this to "steal" clicks from the
		 * summaryitem; Use Clutter.get_current_event() to get the
		 * details, return true to prevent the default handling from
		 * ocurring.
		 */
		public handleSummaryClick(): boolean;

		//// Protected methods ////

		/**
		 * The subclass must call this at least once to set the summary icon.
		 * @param icon 
		 */
		protected _setSummaryIcon(icon: gi.St.Icon): void;

		/**
		 * Default implementation is to do nothing, but subclasses can override
		 * @param notification 
		 */
		protected open(notification: Notification): void;

		protected destroyNonResidentNotifications(): void;

		/**
		 * Default implementation is to destroy this source, but subclasses can override
		 */
		protected _lastNotificationRemoved(): void;
	}

	type MessageTrayEmitters = "notify-applet-update";
	class MessageTray {
		public settings: gi.Gio.Settings;
		public readonly bottomPosition: boolean;

		protected _presence: misc.gnomeSession.Presence;
		protected _userStatus: misc.gnomeSession.PresenceStatus;
		protected _busy: boolean;
		protected _backFromAway: boolean;
		protected _notificationBin: gi.St.Bin;
		protected _notification: Notification;
		protected _locked: boolean;
		protected _notificationState: State;
		protected _notificationTimeoutId: number;
		protected _notificationExpandedId: number;
		protected _notificationRemoved: boolean;
		protected _sources: Source[];

		public constructor();

		public contains(source: Source): boolean;

		protected _getSourceIndex(source: Source): number;

		public add(source: Source): void;

		protected _onSourceDestroy(source: Source): void;

		protected _onNotificationDestroy(notification: Notification): void;

		protected _lock(): void;

		protected _unlock(): void;

		protected _onNotify(source: Source, notification: Notification): void;

		protected _onStatusChanged(status: misc.gnomeSession.PresenceStatus): void;

		// All of the logic for what happens when occurs here; the various
		// event handlers merely update variables and
		// _updateState() figures out what (if anything) needs to be done
		// at the present time.
		/**
		 * All of the logic for what happens when occurs here; the various
		 * event handlers merely update variables and
		 * _updateState() figures out what (if anything) needs to be done
		 * at the present time.
		 */
		protected _updateState(): void;

		protected _tween(actor: gi.Clutter.Actor, statevar: any, value: any, params: any): void;

		protected _tweenComplete(statevar: any, value: any, onComplete: any, onCompleteScope: any, onCompleteParams: any): void;

		protected _showNotification(): void;

		protected _updateShowingNotification(): void;

		protected _showNotificationCompleted(): void;

		protected _updateNotificationTimeout(timeout: number): void;

		protected _notificationTimeout(): boolean;

		protected _hideNotification(): void;

		protected _hideNotificationCompleted(): void;
	}


	class SystemNotificationSource extends Source {

		public createNotificationIcon(): gi.St.Icon;

		public open(): void;
	}

}