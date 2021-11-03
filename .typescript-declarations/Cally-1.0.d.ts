declare namespace imports.gi.Cally {
	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Actor} instead.
	 */
	interface IActor {
		/**
		 * Adds a new action to be accessed with the #AtkAction interface.
		 * @param action_name the action name
		 * @param action_description the action description
		 * @param action_keybinding the action keybinding
		 * @param action_func the callback of the action, to be executed with do_action
		 * @returns added action id, or -1 if failure
		 */
		add_action(action_name: string, action_description: string, action_keybinding: string, action_func: ActionFunc): number;
		/**
		 * Adds a new action to be accessed with the #AtkAction interface.
		 * @param action_name the action name
		 * @param action_description the action description
		 * @param action_keybinding the action keybinding
		 * @param callback the callback of the action
		 * @param notify function to be called when removing the action
		 * @returns added action id, or -1 if failure
		 */
		add_action_full(action_name: string, action_description: string, action_keybinding: string, callback: ActionCallback, notify: GLib.DestroyNotify): number;
		/**
		 * Removes a action, using the #action_id returned by cally_actor_add_action()
		 * @param action_id the action id
		 * @returns %TRUE if the operation was succesful, %FALSE otherwise
		 */
		remove_action(action_id: number): boolean;
		/**
		 * Removes an action, using the #action_name used when the action was added
		 * with cally_actor_add_action()
		 * @param action_name the name of the action to remove
		 * @returns %TRUE if the operation was succesful, %FALSE otherwise
		 */
		remove_action_by_name(action_name: string): boolean;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Actor} instead.
	 */
	type ActorMixin = IActor & Atk.GObjectAccessible & Atk.Action & Atk.Component;

	/**
	 * The <structname>CallyActor</structname> structure contains only private
	 * data and should be accessed using the provided API
	 */
	interface Actor extends ActorMixin {}

	class Actor {
		public constructor();
		/**
		 * Creates a new {@link Actor} for the given #actor
		 * @param actor a #ClutterActor
		 * @returns the newly created #AtkObject
		 */
		public static new(actor: Clutter.Actor): Atk.Object;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Clone} instead.
	 */
	interface IClone {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Clone} instead.
	 */
	type CloneMixin = IClone & Actor & Atk.Action & Atk.Component;

	/**
	 * The <structname>CallyClone</structname> structure contains only private
	 * data and should be accessed using the provided API
	 */
	interface Clone extends CloneMixin {}

	class Clone {
		public constructor();
		/**
		 * Creates a new {@link Clone} for the given #actor. #actor must be a
		 * #ClutterClone.
		 * @param actor a #ClutterActor
		 * @returns the newly created #AtkObject
		 */
		public static new(actor: Clutter.Actor): Atk.Object;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Group} instead.
	 */
	interface IGroup {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Group} instead.
	 */
	type GroupMixin = IGroup & Actor & Atk.Action & Atk.Component;

	/**
	 * The <structname>CallyGroup</structname> structure contains only
	 * private data and should be accessed using the provided API
	 */
	interface Group extends GroupMixin {}

	class Group {
		public constructor();
		/**
		 * Creates a {@link Group} for #actor
		 * @param actor a #ClutterGroup
		 * @returns the newly created {@link Group}
		 */
		public static new(actor: Clutter.Actor): Atk.Object;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Rectangle} instead.
	 */
	interface IRectangle {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Rectangle} instead.
	 */
	type RectangleMixin = IRectangle & Actor & Atk.Action & Atk.Component;

	/**
	 * The <structname>CallyRectangle</structname> structure contains only private
	 * data and should be accessed using the provided API
	 */
	interface Rectangle extends RectangleMixin {}

	class Rectangle {
		public constructor();
		/**
		 * Creates a new {@link Rectangle} for the given #actor. #actor must be
		 * a #ClutterRectangle.
		 * @param actor a #ClutterActor
		 * @returns the newly created #AtkObject
		 */
		public static new(actor: Clutter.Actor): Atk.Object;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Root} instead.
	 */
	interface IRoot {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Root} instead.
	 */
	type RootMixin = IRoot & Atk.GObjectAccessible;

	/**
	 * The <structname>CallyRoot</structname> structure contains only private
	 * data and should be accessed using the provided API
	 */
	interface Root extends RootMixin {}

	class Root {
		public constructor();
		/**
		 * Creates a new {@link Root} object.
		 * @returns the newly created #AtkObject
		 */
		public static new(): Atk.Object;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Stage} instead.
	 */
	interface IStage {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Stage} instead.
	 */
	type StageMixin = IStage & Group & Atk.Action & Atk.Component & Atk.Window;

	/**
	 * The <structname>CallyStage</structname> structure contains only
	 * private data and should be accessed using the provided API
	 */
	interface Stage extends StageMixin {}

	class Stage {
		public constructor();
		/**
		 * Creates a new {@link Stage} for the given #actor. #actor should be a
		 * #ClutterStage.
		 * @param actor a #ClutterActor
		 * @returns the newly created #AtkObject
		 */
		public static new(actor: Clutter.Actor): Atk.Object;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Text} instead.
	 */
	interface IText {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Text} instead.
	 */
	type TextMixin = IText & Actor & Atk.Action & Atk.Component & Atk.EditableText & Atk.Text;

	/**
	 * The <structname>CallyText</structname> structure contains only private
	 * data and should be accessed using the provided API
	 */
	interface Text extends TextMixin {}

	class Text {
		public constructor();
		/**
		 * Creates a new {@link Text} for the given #actor. #actor must be a
		 * #ClutterText.
		 * @param actor a #ClutterActor
		 * @returns the newly created #AtkObject
		 */
		public static new(actor: Clutter.Actor): Atk.Object;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Texture} instead.
	 */
	interface ITexture {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Texture} instead.
	 */
	type TextureMixin = ITexture & Actor & Atk.Action & Atk.Component;

	/**
	 * The <structname>CallyTexture</structname> structure contains only
	 * private data and should be accessed using the provided API
	 */
	interface Texture extends TextureMixin {}

	class Texture {
		public constructor();
		/**
		 * Creates a new {@link Texture} for the given #actor. #actor must be
		 * a #ClutterTexture.
		 * @param actor a #ClutterActor
		 * @returns the newly created #AtkObject
		 */
		public static new(actor: Clutter.Actor): Atk.Object;
	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Util} instead.
	 */
	interface IUtil {

	}

	/** This construct is only for enabling class multi-inheritance,
	 * use {@link Util} instead.
	 */
	type UtilMixin = IUtil & Atk.Util;

	/**
	 * The <structname>CallyUtil</structname> structure contains only
	 * private data and should be accessed using the provided API
	 */
	interface Util extends UtilMixin {}

	class Util {
		public constructor();
	}

	/**
	 * The <structname>CallyActorClass</structname> structure contains
	 * only private data
	 */
	interface ActorClass {}
	class ActorClass {
		public constructor();
		public readonly _padding_dummy: any[];
		public notify_clutter: {(object: GObject.Object, pspec: GObject.ParamSpec): void;};
		public focus_clutter: {(actor: Clutter.Actor, data: any): boolean;};
		public add_actor: {(container: Clutter.Actor, actor: Clutter.Actor, data: any): number;};
		public remove_actor: {(container: Clutter.Actor, actor: Clutter.Actor, data: any): number;};
	}

	interface ActorPrivate {}
	class ActorPrivate {
		public constructor();
	}

	/**
	 * The <structname>CallyCloneClass</structname> structure contains only
	 * private data
	 */
	interface CloneClass {}
	class CloneClass {
		public constructor();
		public readonly _padding_dummy: any[];
	}

	interface ClonePrivate {}
	class ClonePrivate {
		public constructor();
	}

	/**
	 * The <structname>CallyGroupClass</structname> structure contains only
	 * private data
	 */
	interface GroupClass {}
	class GroupClass {
		public constructor();
		public readonly _padding_dummy: any[];
	}

	interface GroupPrivate {}
	class GroupPrivate {
		public constructor();
	}

	/**
	 * The <structname>CallyRectangleClass</structname> structure contains
	 * only private data
	 */
	interface RectangleClass {}
	class RectangleClass {
		public constructor();
		public readonly _padding_dummy: any[];
	}

	interface RectanglePrivate {}
	class RectanglePrivate {
		public constructor();
	}

	/**
	 * The <structname>CallyRootClass</structname> structure contains only
	 * private data
	 */
	interface RootClass {}
	class RootClass {
		public constructor();
		public readonly _padding_dummy: any[];
	}

	interface RootPrivate {}
	class RootPrivate {
		public constructor();
	}

	/**
	 * The <structname>CallyStageClass</structname> structure contains only
	 * private data
	 */
	interface StageClass {}
	class StageClass {
		public constructor();
		public readonly _padding_dummy: any[];
	}

	interface StagePrivate {}
	class StagePrivate {
		public constructor();
	}

	/**
	 * The <structname>CallyTextClass</structname> structure contains only
	 * private data
	 */
	interface TextClass {}
	class TextClass {
		public constructor();
		public readonly _padding_dummy: any[];
	}

	interface TextPrivate {}
	class TextPrivate {
		public constructor();
	}

	/**
	 * The <structname>CallyTextureClass</structname> structure contains
	 * only private data
	 */
	interface TextureClass {}
	class TextureClass {
		public constructor();
		public readonly _padding_dummy: any[];
	}

	interface TexturePrivate {}
	class TexturePrivate {
		public constructor();
	}

	/**
	 * The <structname>CallyUtilClass</structname> structure contains only
	 * private data
	 */
	interface UtilClass {}
	class UtilClass {
		public constructor();
		public readonly _padding_dummy: any[];
	}

	interface UtilPrivate {}
	class UtilPrivate {
		public constructor();
	}

	/**
	 * Action function, to be used on #AtkAction implementations as
	 * an individual action. Unlike {@link ActionFunc}, this function
	 * uses the #user_data argument passed to cally_actor_add_action_full().
	 */
	interface ActionCallback {
		/**
		 * Action function, to be used on #AtkAction implementations as
		 * an individual action. Unlike {@link ActionFunc}, this function
		 * uses the #user_data argument passed to cally_actor_add_action_full().
		 * @param cally_actor a {@link Actor}
		 */
		(cally_actor: Actor): void;
	}

	/**
	 * Action function, to be used on #AtkAction implementations as a individual
	 * action
	 */
	interface ActionFunc {
		/**
		 * Action function, to be used on #AtkAction implementations as a individual
		 * action
		 * @param cally_actor a {@link Actor}
		 */
		(cally_actor: Actor): void;
	}

	/**
	 * Initializes the accessibility support.
	 * @returns %TRUE if accessibility support has been correctly
	 * initialized.
	 */
	function accessibility_init(): boolean;

	/**
	 * Returns if the accessibility support using cally is enabled.
	 * @returns %TRUE if accessibility support has been correctly
	 * initialized.
	 */
	function get_cally_initialized(): boolean;

}