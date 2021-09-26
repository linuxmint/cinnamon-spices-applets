/** https://gjs-docs.gnome.org/clutter7~7_api/ */
declare namespace imports.gi.Clutter {

	// CLASSES

	export class Action {

	}

	interface ActorOptions {
		/** Write only */
		actions: Action;
		background_color: Color;
		/** Graphene.Rect */
		clip_rect: any;
		clip_to_allocation: boolean;
		/** Write only */
		constraints: Constraint;
		content: Content;
		content_gravity: ContentGravity;
		content_repeat: ContentRepeat;
		/** Write only */
		effect: Effect;
		fixed_position_set: boolean;
		fixed_x: boolean;
		fixed_y: boolean;
		height: number;
		layout_manager: LayoutManager;
		magnification_filter: ScalingFilter;
		margin_bottom: number;
		margin_left: number;
		margin_right: number;
		margin_top: number;
		min_height: number;
		min_height_set: boolean;
		min_width: number;
		min_width_set: boolean;
		minification_filter: ScalingFilter;
		name: string;
		natural_height: number;
		natural_height_set: boolean;
		natural_width: number;
		natural_width_set: number;
		offscreen_redirect: OffscreenRedirect;
		opacity: number;
		/** Graphene.Point */
		pivot_point: Point;
		pivot_point_z: number;
		/** Graphene.Point */
		position: any;
		reactive: boolean;
		request_mode: RequestMode;
		rotation_angle_x: number;
		rotation_angle_y: number;
		rotation_angle_z: number;
		scale_x: number;
		scale_y: number;
		scale_z: number;
		show_on_set_parent: boolean;
		/** Graphene.Size */
		size: any;
		text_direction: TextDirection;
		translation_x: number;
		translation_y: number;
		translation_z: number;
		visible: boolean;
		width: number;
		x: number;
		/**
		 * According to the GJS docs (https://gjs-docs.gnome.org), the Clutter 
		 * Actor properties 'x_align' and 'y_align' have the type Clutter.ActorAlign. 
		 * However according to the gnome docs (https://developer.gnome.org/st/stable/StBin.html) 
		 * and own observations, the St.Bin properties 'x_align' and 'y_align' are 
		 * actually of the type St.Align. This means in order to allow St.Bin as well 
		 * as  other St classes to implement Clutter.Actor the Clutter.Actor 
		 * x_align and y_align props have to be either of type Clutter.
		 * ActorAlign or St.Align and each class inheriting from Clutter.Actor 
		 * must be speficy the type by it's own. 
		* 
		*/
		x_align: ActorAlign | St.Align;
		x_expand: boolean;
		y: number;
		/** See x_align */
		y_align: ActorAlign | St.Align;
		y_expand: boolean;
		z_position: number;
	}

	interface IActorMethodsReadableProps {
		readonly allocation: ActorBox;
		readonly background_color_set: boolean;
		readonly child_transform_set: boolean;
		readonly content_box: ActorBox;
		readonly first_child: Actor;
		//readonly has_clip: boolean;
		//readonly has_pointer: boolean;
		readonly last_child: Actor;
		readonly mapped: boolean;
		readonly realized: boolean;
		readonly transform_set: boolean;

		/** Clutter.ActorFlags */
		readonly fields: number;

		/**
		 * Adds action to the list of actions applied to this

		 * A Clutter.Action can only belong to one actor at a time
		 * 
		 * The Clutter.Actor will hold a reference on action until either
		 * Clutter.Actor.remove_action or Clutter.Actor.clear_actions
		 * is called
		 * @param action a Clutter.Action
		 */
		add_action(action: Action): void;
		/**
		 * A convenience function for setting the name of a Clutter.Action
		 * while adding it to the list of actions applied to this
		 * 
		 * This function is the logical equivalent of:
		 * 
		 * ```
		 * clutter_actor_meta_set_name (CLUTTER_ACTOR_META (action), name);
		 * clutter_actor_add_action (self, action);
		 * ```
		 * @param name the name to set on the action
		 * @param action a Clutter.Action
		 */
		add_action_with_name(name: string, action: Action): void;
		/**
		 * Adds child to the children of this.
		 *
		 * This function will acquire a reference on child that will only
		 * be released when calling Clutter.Actor.remove_child.
		 * 
		 * This function will take into consideration the #ClutterActor:depth
		 * of child, and will keep the list of children sorted.
		 * 
		 * This function will emit the Clutter.Container.actor-added signal
		 * on this.
		 * @param child a Clutter.Actor
		 */
		add_child(child: Actor): void;
		/**
		 * Adds constraint to the list of Clutter.Constraint<!-- -->s applied
		 * to this
		 *
		 * The Clutter.Actor will hold a reference on the constraint until
		 * either Clutter.Actor.remove_constraint or
		 * Clutter.Actor.clear_constraints is called.
		 * @param constraint a Clutter.Constraint
		 */
		add_constraint(constraint: Constraint): void;
		/**
		 * A convenience function for setting the name of a Clutter.Constraint
		 * while adding it to the list of constraints applied to this
		 *
		 * This function is the logical equivalent of:
		 * 
		 * ```
			 * clutter_actor_meta_set_name (CLUTTER_ACTOR_META (constraint), name);
			 * clutter_actor_add_constraint (self, constraint);
		 * ```
		 * @param name the name to set on the constrain
		 * @param constraint a Clutter.Constraint
		 */
		add_constraint_with_name(name: string, constraint: Constraint): void;
		/**
		 * Adds effect to the list of Clutter.Effect<!-- -->s applied to this
		 * 
		 * The Clutter.Actor will hold a reference on the effect until either
		 * Clutter.Actor.remove_effect or Clutter.Actor.clear_effects is
		 * called.
		 * @param effect a Clutter.Effect
		 */
		add_effect(effect: Effect): void;
		/**
		 * A convenience function for setting the name of a Clutter.Effect
		 * while adding it to the list of effectss applied to this
		 * 
		 * This function is the logical equivalent of:
		 * 
		 * ```
			 * clutter_actor_meta_set_name (CLUTTER_ACTOR_META (effect), name);
			 * clutter_actor_add_effect (self, effect);
		 * ```
		 * @param name the name to set on the effect
		 * @param effect a Clutter.Effect
		 */
		add_effect_with_name(name: string, effect: Effect): void;
		/**
		 * Adds a transition to the Clutter.Actor's list of animations.
		 *
		 * The name string is a per-actor unique identifier of the transition: only
		 * one Clutter.Transition can be associated to the specified name.
		 * 
		 * The transition will be started once added.
		 * 
		 * This function will take a reference on the transition.
		 * 
		 * This function is usually called implicitly when modifying an animatable
		 * property.
		 * @param name  the name of the transition to add
		 * @param transition the Clutter.Transition to add
		 */
		add_transition(name: string, transition: Transition): void;
		/**
		 * Assigns the size of a Clutter.Actor from the given box.
		 * 
		 * This function should only be called on the children of an actor when
		 * overriding the index.ActorClass.allocate() virtual function.
		 * 
		 * This function will adjust the stored allocation to take into account
		 * the alignment flags set in the Clutter.Actor.x-align and
		 * Clutter.Actor.y-align properties, as well as the margin values set in
		 * the Clutter.Actor.margin-top, Clutter.Actor.margin-right,
		 * Clutter.Actor.margin-bottom, and Clutter.Actor.margin-left properties.
		 * 
		 * This function will respect the easing state of the Clutter.Actor and
		 * interpolate between the current allocation and the new one if the
		 * easing state duration is a positive value.
		 * 
		 * Actors can know from their allocation box whether they have moved
		 * with respect to their parent actor. The @flags parameter describes
		 * additional information about the allocation, for instance whether
		 * the parent has moved with respect to the stage, for example because
		 * a grandparent's origin has moved.
		 * @param box new allocation of the actor, in parent-relative coordinates
		 */
		allocate(box: ActorBox, flags?: AllocationFlags): void;
		/**
		 * Allocates this by taking into consideration the available allocation
		 * area; an alignment factor on either axis; and whether the actor should
		 * fill the allocation on either axis.
		 * 
		 * The box should contain the available allocation width and height;
		 * if the x1 and y1 members of Clutter.ActorBox are not set to 0, the
		 * allocation will be offset by their value.
		 * 
		 * This function takes into consideration the geometry request specified by
		 * the Clutter.Actor.request-mode property, and the text direction.
		 * 
		 * This function is useful for fluid layout managers using legacy alignment
		 * flags. Newly written layout managers should use the Clutter.Actor.x-align
		 * and Clutter.Actor.y-align properties, instead, and just call
		 * Clutter.Actor.allocate inside their index.ActorClass.allocate()
		 * implementation.
		 * @param box a Clutter.ActorBox, containing the available width and height
		 * @param x_align the horizontal alignment, between 0 and 1
		 * @param y_align the vertical alignment, between 0 and 1
		 * @param x_fill whether the actor should fill horizontally
		 * @param y_fill whether the actor should fill vertically
		 */
		allocate_align_fill(box: ActorBox, x_align: number, y_align: number, x_fill: boolean, y_fill: boolean): void;
		/**
		 * Allocates this taking into account the Clutter.Actor's
		 * preferred size, but limiting it to the maximum available width
		 * and height provided.
		 * 
		 * This function will do the right thing when dealing with the
		 * actor's request mode.
			 * 
		 * The implementation of this function is equivalent to:
		 * 
		 * ```
		 * if (request_mode == CLUTTER_REQUEST_HEIGHT_FOR_WIDTH)
		 * {
		 * 		clutter_actor_get_preferred_width (self, available_height, &min_width, &natural_width);
		 * 		width = CLAMP (natural_width, min_width, available_width);
		 * 
		 * 		clutter_actor_get_preferred_height (self, width, &min_height, &natural_height);
		 * 		height = CLAMP (natural_height, min_height, available_height);
		 * }
		 * else if (request_mode == CLUTTER_REQUEST_WIDTH_FOR_HEIGHT)
		 * {
		 * 		clutter_actor_get_preferred_height (self, available_width, &min_height, &natural_height);
		 * 		height = CLAMP (natural_height, min_height, available_height);
		 * 
		 * 		clutter_actor_get_preferred_width (self, height, &min_width, &natural_width);
		 * 		width = CLAMP (natural_width, min_width, available_width);
		 * }
		 * else if (request_mode == CLUTTER_REQUEST_CONTENT_SIZE)
		 * {
		 * 		clutter_content_get_preferred_size (content, &natural_width, &natural_height);
		 * 
		 * 		width = CLAMP (natural_width, 0, available_width);
		 * 		height = CLAMP (natural_height, 0, available_height);
		 * }
		 * box.x1 = x; box.y1 = y;
		 * box.x2 = box.x1 + available_width;
		 * box.y2 = box.y1 + available_height;
		 * clutter_actor_allocate (self, &box);
		 * ```
		 * 
		 * This function can be used by fluid layout managers to allocate an actor's preferred size without making it bigger than the area available for the container. 
		 * @param x  the actor's X coordinate
		 * @param y the actor's Y coordinate
		 * @param available_width the maximum available width, or -1 to use the
		 * actor's natural width
		 * @param available_height the maximum available height, or -1 to use the
		 * actor's natural height
		 */
		allocate_available_size(x: number, y: number, available_width: number, available_height: number): void;
		/**
		 * Allocates the natural size of this.
		 * This function is a utility call for Clutter.Actor implementations
		 * that allocates the actor's preferred natural size. It can be used
		 * by fixed layout managers (like #ClutterGroup or so called
		 * 'composite actors') inside the ClutterActor::allocate
		 * implementation to give each child exactly how much space it
		 * requires, regardless of the size of the parent.
		 * 
		 * This function is not meant to be used by applications. It is also
		 * not meant to be used outside the implementation of the
		 * index.ActorClass.allocate virtual function.
		 * @param x the actor's X coordinate
		 * @param y the actor's Y coordinate
		 */
		allocate_preferred_size(x: number, y: number): void;
		/**
		 * Transforms point in coordinates relative to the actor into
		 * ancestor-relative coordinates using the relevant transform
		 * stack (i.e. scale, rotation, etc).
		 * 
		 * If ancestor is null the ancestor will be the Clutter.Stage. In
		 * this case, the coordinates returned will be the coordinates on
		 * the stage before the projection is applied. This is different from
		 * the behaviour of Clutter.Actor.apply_transform_to_point.
		 * @param ancestor A Clutter.Actor ancestor, or null to use the
		 * default Clutter.Stage
		 * @param point (Graphene.Point3D) — A point as #graphene_point3d_t
		 * @returns (Graphene.Point3D) — The translated #graphene_point3d_t
		 */
		apply_relative_transform_to_point(ancestor: Action, point: any): any;
		/**
		 * Transforms point in coordinates relative to the actor
		 * into screen-relative coordinates with the current actor
		 * transformation (i.e. scale, rotation, etc)
		 * @param point (Graphene.Point3D) — A point as #graphene_point3d_t
		 * @returns (Graphene.Point3D) — The translated #graphene_point3d_t
		 */
		apply_transform_to_point(point: any): any;
		/**
		 * Binds a Gio.ListModel to a Clutter.Actor.
		 * 
		 * If the Clutter.Actor was already bound to a Gio.ListModel, the previous
		 * binding is destroyed.
		 * 
		 * The existing children of Clutter.Actor are destroyed when setting a
		 * model, and new children are created and added, representing the contents
		 * of the model. The Clutter.Actor is updated whenever the model changes.
		 * If model is null, the Clutter.Actor is left empty.
		 * 
		 * When a Clutter.Actor is bound to a model, adding and removing children
		 * directly is undefined behaviour
		 * @param model a Gio.ListModel
		 * @param create_child_func a function that creates Clutter.Actor instances
		 * from the contents of the model
		 */
		bind_model(model: Gio.ListModel, create_child_func: ActorCreateChildFunc): void;
		/**
		 * Clears the list of actions applied to this
		 */
		clear_actions(): void;
		/**
		 * Clears the list of constraints applied to this
		 */
		clear_constraints(): void;
		/** Clears the list of effects applied to this */
		clear_effects(): void;
		/**
		 * Determines if descendant is contained inside this (either as an
		 * immediate child, or as a deeper descendant). If this and
		 * descendant point to the same actor then it will also return true.
		 * @param descendant A Clutter.Actor, possibly contained in this
		 * @returns whether @descendent is contained within this
		 */
		contains(descendant: Actor): boolean;
		/**
		 * Run the next stage of the paint sequence. This function should only
		 * be called within the implementation of the ‘run’ virtual of a
		 * Clutter.Effect. It will cause the run method of the next effect to
		 * be applied, or it will paint the actual actor if the current effect
		 * is the last effect in the chain.
		 * @param paint_context 
		 */
		continue_paint(paint_context: PaintContext): void;
		/**
		 * Run the next stage of the pick sequence. This function should only
		 * be called within the implementation of the ‘pick’ virtual of a
		 * Clutter.Effect. It will cause the run method of the next effect to
		 * be applied, or it will pick the actual actor if the current effect
		 * is the last effect in the chain.
		 * @param pick_context 
		 */
		continue_pick(pick_context: PickContext): void;
		/**
		 * Creates a Pango.Context for the given actor. The Pango.Context
		 * is already configured using the appropriate font map, resolution
		 * and font options.
		 * 
		 * See also Clutter.Actor.get_pango_context.
		 * @returns the newly created Pango.Context.
		 * Use GObject.Object on the returned value to deallocate its
		 * resources
		 */
		create_pango_context(): Pango.Context;
		/**
		 * Creates a new Pango.Layout from the same Pango.Context used
		 * by the Clutter.Actor. The Pango.Layout is already configured
		 * with the font map, resolution and font options, and the
		 * given text.
		 * 
		 * If you want to keep around a Pango.Layout created by this
		 * function you will have to connect to the Clutter.Backend.font-changed
		 * and Clutter.Backend.resolution-changed signals, and call
		 * Pango.Layout in response to them.
		 * @param text the text to set on the Pango.Layout, or null
		 * @returns the newly created Pango.Layout.
		 * Use GObject.Object when done
		 */
		create_pango_layout(text: string): Pango.Layout;
		/**
		 * Destroys an actor. When an actor is destroyed, it will break any
		 * references it holds to other objects. If the actor is inside a
		 * container, the actor will be removed.
		 * 
		 * When you destroy a container, its children will be destroyed as well.
		 */
		destroy(): void;
		/**
		 * Destroys all children of this.

		 * This function releases the reference added by inserting a child
		 * actor in the list of children of this, and ensures that the
		 * Clutter.Actor.destroy signal is emitted on each child of the
		 * actor.
		 * 
		 * By default, Clutter.Actor will emit the Clutter.Actor.destroy signal
		 * when its reference count drops to 0; the default handler of the
		 * Clutter.Actor.destroy signal will destroy all the children of an
		 * actor. This function ensures that all children are destroyed, instead
		 * of just removed from this, unlike Clutter.Actor.remove_all_children
		 * which will merely release the reference and remove each child.
		 * 
		 * Unless you acquired an additional reference on each child of this
		 * prior to calling Clutter.Actor.remove_all_children and want to reuse
		 * the actors, you should use Clutter.Actor.destroy_all_children in
		 * order to make sure that children are destroyed and signal handlers
		 * are disconnected even in cases where circular references prevent this
		 * from automatically happening through reference counting alone.
		 */
		destroy_all_children(): void;

		/**
		 * This function is used to emit an event on the main stage.
		 * You should rarely need to use this function, except for
		 * synthetising events.
		 * @param event a Clutter.Event
		 * @param capture true if event in in capture phase, false otherwise.
		 * @returns the return value from the signal emission: true
		 * if the actor handled the event, or false if the event was
		 * not handled
		 */
		event(event: Event, capture: boolean): boolean;
		/**
		 * Calculates the transformed screen coordinates of the four corners of
		 * the actor; the returned vertices relate to the Clutter.ActorBox
		 * coordinates as follows
		 * 
			 * - v[0] contains (x1, y1)
		 * - v[1] contains (x2, y1)
		 * - v[2] contains (x1, y2)
		 * - v[3] contains (x2, y2)
		 * 
		 * @returns (Array(Graphene.Point3D)) — Pointer to a location of an array
		 * of 4 #graphene_point3d_t where to store the result.
		 */
		get_abs_allocation_vertices(): any[];
		/**
		 * Returns the accessible object that describes the actor to an
		 * assistive technology.
		 * 
		 * If no class-specific Atk.Object implementation is available for the
		 * actor instance in question, it will inherit an Atk.Object
		 * implementation from the first ancestor class for which such an
		 * implementation is defined.
		 * 
		 * The documentation of the 
		 * url="http://developer.gnome.org/doc/API/2.0/atk/index.html" ATK
		 * library contains more information about accessible objects and
		 * their uses.
		 * @returns  the Atk.Object associated with @actor
		 */
		get_accessible(): Atk.Object;
		/**
		 * Retrieves the Clutter.Action with the given name in the list
		 * of actions applied to this
		 * @param name the name of the action to retrieve
		 * @returns a Clutter.Action for the given
		 * name, or null. The returned Clutter.Action is owned by the
		 * actor and it should not be unreferenced directly
		 */
		get_action(name: string): Action;
		/**
		 * Retrieves the list of actions applied to this
		 * @returns a copy
		 * of the list of Clutter.Action<!-- -->s. The contents of the list are
		 * owned by the Clutter.Actor. Use GLib.List to free the resources
		 * allocated by the returned GLib.Lis
		 */
		get_actions(): Action[];
		/**
		 * Gets the layout box an actor has been assigned. The allocation can
		 * only be assumed valid inside a paint() method; anywhere else, it
		 * may be out-of-date.
		 * 
		 * An allocation does not incorporate the actor's scale or translation;
		 * those transformations do not affect layout, only rendering.
		 * 
		 * Do not call any of the clutter_actor_get_allocation_*() family
		 * of functions inside the implementation of the get_preferred_width()
		 * or get_preferred_height() virtual functions.
		 * @returns the function fills this in with the actor's allocation
		 */
		get_allocation_box(): ActorBox;
		/**
		 * Retrieves the color set using Clutter.Actor.set_background_color.
		 * @returns return location for a Clutter.Color
		 */
		get_background_color(): Color;
		/**
		 * Retrieves the actor at the given index_ inside the list of
		 * children of this.
		 * @param index_ the position in the list of children
		 * @returns a pointer to a Clutter.Actor, or null
		 */
		get_child_at_index(index_: number): Actor;
		/**
		 * Retrieves the child transformation matrix set using
		 * Clutter.Actor.set_child_transform; if none is currently set,
		 * the @transform matrix will be initialized to the identity matrix.
		 * @returns a Clutter.Matrix
		 */
		get_child_transform(): Matrix;
		/**
		 * Retrieves the list of children of this.
		 * @returns A newly
		 * allocated GLib.List of Clutter.Actor<!-- -->s. Use GLib.List when
		 * done.
		 */
		get_children(): Actor[];
		/**
		 * Gets the clip area for this, if any is set.
		 */
		get_clip(): Clip;
		/**
		 * Retrieves the value set using Clutter.Actor.set_clip_to_allocation
		 * @returns true if the Clutter.Actor is clipped to its allocation
		 */
		get_clip_to_allocation(): boolean;
		/**
		 * Retrieves the Clutter.Constraint with the given name in the list
		 * of constraints applied to this
		 * @param name  the name of the constraint to retrieve
		 * @returns a Clutter.Constraint for the given
		 * name, or null. The returned Clutter.Constraint is owned by the
		 * actor and it should not be unreferenced directly
		 */
		get_constraint(name: string): Constraint;
		/**
		 * Retrieves the list of constraints applied to this
		 * @returns a copy
		 * of the list of Clutter.Constraint<!-- -->s. The contents of the list are
		 * owned by the Clutter.Actor. Use GLib.List to free the resources
		 * allocated by the returned GLib.List
		 */
		get_constraints(): Constraint[];
		/**
		 * Retrieves the contents of this.
		 * @returns a pointer to the Clutter.Content instance,
		 * or null if none was set
		 */
		get_content(): Content;
		/**
		 * Retrieves the bounding box for the Clutter.Content of this.
		 *
		 * The bounding box is relative to the actor's allocation.
		 * 
		 * If no Clutter.Content is set for this, or if this has not been
		 * allocated yet, then the result is undefined.
		 * 
		 * The content box is guaranteed to be, at most, as big as the allocation
		 * of the Clutter.Actor.
		 * 
		 * If the Clutter.Content used by the actor has a preferred size, then
		 * it is possible to modify the content box by using the
		 * Clutter.Actor.content-gravity property.
		 * @returns  the return location for the bounding
		 * box for the Clutter.Content
		 */
		get_content_box(): ActorBox;
		/**
		 * Retrieves the content gravity as set using
		 * Clutter.Actor.set_content_gravity.
		 * @returns the content gravity
		 */
		get_content_gravity(): ContentGravity;
		/**
		 * Retrieves the repeat policy for a Clutter.Actor set by
		 * Clutter.Actor.set_content_repeat.
		 * @returns the content repeat policy
		 */
		get_content_repeat(): ContentRepeat;
		/**
		 * Retrieves the values set using Clutter.Actor.set_content_scaling_filters.
		 */
		get_content_scaling_filters(): ContentScalingFilters;
		/**
		 * Retrieves the default paint volume for this.
		 * 
		 * This function provides the same Clutter.PaintVolume that would be
		 * computed by the default implementation inside Clutter.Actor of the
		 * index.ActorClass.get_paint_volume() virtual function.
		 * 
		 * This function should only be used by Clutter.Actor subclasses that
		 * cannot chain up to the parent implementation when computing their
		 * paint volume.
		 * @returns a pointer to the default
		 * Clutter.PaintVolume, relative to the Clutter.Actor, or null if
		 * the actor could not compute a valid paint volume. The returned value
		 * is not guaranteed to be stable across multiple frames, so if you
		 * want to retain it, you will need to copy it using
		 * Clutter.PaintVolume.copy.
		 */
		get_default_paint_volume(): PaintVolume;
		/**
		 * Retrieves the delay that should be applied when tweening animatable
		 * properties.
		 * @returns a delay, in milliseconds
		 */
		get_easing_delay(): number;
		/**
		 * Retrieves the duration of the tweening for animatable
		 * properties of this for the current easing state.
		 * @returns the duration of the tweening, in milliseconds
		 */
		get_easing_duration(): number;
		/**
		 * Retrieves the easing mode for the tweening of animatable properties
		 * of this for the current easing state.
		 * @returns an easing mode
		 */
		get_easing_mode(): AnimationMode;
		/**
		 * Retrieves the Clutter.Effect with the given name in the list
		 * of effects applied to this
		 * @param name the name of the effect to retrieve
		 * @returns a Clutter.Effect for the given
		 * name, or null. The returned Clutter.Effect is owned by the
		 * actor and it should not be unreferenced directly
		 */
		get_effect(name: string): Effect;
		/**
		 * Retrieves the Clutter.Effect<!-- -->s applied on this, if any
		 * @returns a list
		 * of Clutter.Effect<!-- -->s, or null. The elements of the returned
		 * list are owned by Clutter and they should not be freed. You should
		 * free the returned list using GLib.List when done
		 */
		get_effects(): Effect[];
		/**
		 * Retrieves the first child of this.
		 * 
		 * The returned pointer is only valid until the scene graph changes; it
		 * is not safe to modify the list of children of this while iterating
		 * it.
		 * @returns a pointer to a Clutter.Actor, or null
		 */
		get_first_child(): Actor;
		/**
		 * This function gets the fixed position of the actor, if set. If there
		 * is no fixed position set, this function returns false and doesn't set
		 * the x and y coordinates.
		 */
		get_fixed_position(): FixedPosition;
		/**
		 * Checks whether an actor has a fixed position set (and will thus be
		 * unaffected by any layout manager).
		 * @returns true if the fixed position is set on the actor
		 */
		get_fixed_position_set(): boolean;
		/**
		 * Retrieves the flags set on this
		 * @returns a bitwise or of Clutter.ActorFlags or 0
		 */
		get_flags(): ActorFlags;
		/**
		 * Retrieves the height of a Clutter.Actor.
		 * 
		 * If the actor has a valid allocation, this function will return the
		 * height of the allocated area given to the actor.
		 * 
		 * If the actor does not have a valid allocation, this function will
		 * return the actor's natural height, that is the preferred height of
		 * the actor.
		 * 
		 * If you care whether you get the preferred height or the height that
		 * has been assigned to the actor, you should probably call a different
		 * function like Clutter.Actor.get_allocation_box to retrieve the
		 * allocated size or Clutter.Actor.get_preferred_height to retrieve the
		 * preferred height.
		 * 
		 * If an actor has a fixed height, for instance a height that has been
		 * assigned using Clutter.Actor.set_height, the height returned will
		 * be the same value.
		 * @returns the height of the actor, in pixels
		 */
		get_height(): number;
		/**
		 * Retrieves the last child of this.
		 * 
		 * The returned pointer is only valid until the scene graph changes; it
		 * is not safe to modify the list of children of this while iterating
		 * it.
		 * @returns  a pointer to a Clutter.Actor, or null
		 */
		get_last_child(): Actor;
		/**
		 * Retrieves the Clutter.LayoutManager used by this.
		 * @returns a pointer to the Clutter.LayoutManager,
		 * or null
		 */
		get_layout_manager(): LayoutManager;
		/**
		 * Retrieves all the components of the margin of a Clutter.Actor.
		 * @returns return location for a Clutter.Margin
		 */
		get_margin(): Margin;
		/**
		 * Retrieves the bottom margin of a Clutter.Actor
		 * @returns the bottom margin
		 */
		get_margin_bottom(): number;
		/**
		 * Retrieves the left margin of a Clutter.Actor
		 * @returns the left margin
		 */
		get_margin_left(): number;
		/**
		 * Retrieves the right margin of a Clutter.Actor
		 * @returns the right margin
		 */
		get_margin_right(): number;
		/**
		 * Retrieves the top margin of a Clutter.Actor
		 * @returns the top margin
		 */
		get_margin_top(): number;
		/**
		 * Retrieves the number of children of this.
		 * @returns the number of children of an actor
		 */
		get_n_children(): number;
		/**
		 * Retrieves the name of this.
		 * @returns the name of the actor, or null. The returned string is
		 * owned by the actor and should not be modified or freed.
		 */
		get_name(): string;
		/**
		 * Retrieves the sibling of this that comes after it in the list
		 * of children of this's parent.
		 * 
		 * The returned pointer is only valid until the scene graph changes; it
		 * is not safe to modify the list of children of this while iterating
		 * it.
		 * @returns  a pointer to a Clutter.Actor, or null
		 */
		get_next_sibling(): Actor;
		/**
		 * Retrieves whether to redirect the actor to an offscreen buffer, as
		 * set by Clutter.Actor.set_offscreen_redirect.
		 * @returns the value of the offscreen-redirect property of the actor
		 */
		get_offscreen_redirect(): OffscreenRedirect;
		/**
		 * Retrieves the opacity value of an actor, as set by
		 * Clutter.Actor.set_opacity.
		 * 
		 * For retrieving the absolute opacity of the actor inside a paint
		 * virtual function, see Clutter.Actor.get_paint_opacity.
		 * @returns  the opacity of the actor
		 */
		get_opacity(): number;
		/**
		 * Stability: Unstable. See Clutter.Actor.set_opacity_override
		 * @returns the override value for the actor's opacity, or -1 if no override
		 * is set.
		 */
		get_opacity_override(): number;
		/**
		 * Retrieves the paint volume of the passed Clutter.Actor, and
		 * transforms it into a 2D bounding box in stage coordinates.
		 * 
		 * This function is useful to determine the on screen area occupied by
		 * the actor. The box is only an approximation and may often be
		 * considerably larger due to the optimizations used to calculate the
		 * box. The box is never smaller though, so it can reliably be used
		 * for culling.
		 * 
		 * There are times when a 2D paint box can't be determined, e.g.
		 * because the actor isn't yet parented under a stage or because
		 * the actor is unable to determine a paint volume.
		 */
		get_paint_box(): PaintBoxResult;
		/**
		 * Retrieves the absolute opacity of the actor, as it appears on the stage.
		 * 
		 * This function traverses the hierarchy chain and composites the opacity of
		 * the actor with that of its parents.
		 * 
		 * This function is intended for subclasses to use in the paint virtual
		 * function, to paint themselves with the correct opacity.
		 * @returns The actor opacity value.
		 */
		get_paint_opacity(): number;
		/**
		 * Retrieves the 'paint' visibility of an actor recursively checking for non
		 * visible parents.
		 * 
		 * This is by definition the same as %CLUTTER_ACTOR_IS_MAPPED.
		 * @returns true if the actor is visible and will be painted.
		 */
		get_paint_visibility(): boolean;
		/**
		 * Retrieves the paint volume of the passed Clutter.Actor, or null
		 * when a paint volume can't be determined.
		 * 
		 * The paint volume is defined as the 3D space occupied by an actor
		 * when being painted.
		 * 
		 * This function will call the index.ActorClass.get_paint_volume()
		 * virtual function of the Clutter.Actor class. Sub-classes of Clutter.Actor
		 * should not usually care about overriding the default implementation,
		 * unless they are, for instance: painting outside their allocation, or
		 * actors with a depth factor (not in terms of #ClutterActor:depth but real
		 * 3D depth).
		 * 
		 * Note: 2D actors overriding index.ActorClass.get_paint_volume()
		 * should ensure that their volume has a depth of 0. (This will be true
		 * as long as you don't call Clutter.PaintVolume.set_depth.)
		 * @returns a pointer to a Clutter.PaintVolume,
		 * or null if no volume could be determined. The returned pointer
		 * is not guaranteed to be valid across multiple frames; if you want
		 * to keep it, you will need to copy it using Clutter.PaintVolume.copy.
		 */
		get_paint_volume(): PaintVolume;
		/**
		 * Retrieves the Pango.Context for this. The actor's Pango.Context
		 * is already configured using the appropriate font map, resolution
		 * and font options.
		 * 
		 * Unlike Clutter.Actor.create_pango_context, this context is owend
		 * by the Clutter.Actor and it will be updated each time the options
		 * stored by the Clutter.Backend change.
		 * 
		 * You can use the returned Pango.Context to create a Pango.Layout
		 * and render text using CoglPango to reuse the
		 * glyphs cache also used by Clutter.
		 * @returns the Pango.Context for a Clutter.Actor.
		 * The returned Pango.Context is owned by the actor and should not be
		 * unreferenced by the application code
		 */
		get_pango_context(): Pango.Context;
		/**
		 * Retrieves the parent of this.
		 * @returns The Clutter.Actor parent, or null
		 * if no parent is set
		 */
		get_parent(): Actor;
		/**
		 * Retrieves the coordinates of the Clutter.Actor.pivot-point.
		 */
		get_pivot_point(): PivotPointResult;
		/**
		 * Retrieves the Z component of the Clutter.Actor.pivot-point.
		 */
		get_pivot_point_z(): number;
		/**
		 * This function tries to "do what you mean" and tell you where the
		 * actor is, prior to any transformations. Retrieves the fixed
		 * position of an actor in pixels, if one has been set; otherwise, if
		 * the allocation is valid, returns the actor's allocated position;
		 * otherwise, returns 0,0.
		 * 
		 * The returned position is in pixels.
		 */
		get_position(): PositionResult;
		/**
		 * Computes the requested minimum and natural heights for an actor,
		 * or if they are already computed, returns the cached values.
		 * 
		 * An actor may not get its request - depending on the layout
		 * manager that's in effect.
		 * 
		 * A request should not incorporate the actor's scale or translation;
		 * those transformations do not affect layout, only rendering.
		 * @param for_width available width to assume in computing desired height,
		 * or a negative value to indicate that no width is defined
		 * @returns : 
		 * - min_height_p (Number) — return location for minimum height, or null
		 * - natural_height_p (Number) — return location for natural height, or null
		 */
		get_preferred_height(for_width: number): number[];
		/**
		 * Computes the preferred minimum and natural size of an actor, taking into
		 * account the actor's geometry management (either height-for-width
		 * or width-for-height).
		 * 
		 * The width and height used to compute the preferred height and preferred
		 * width are the actor's natural ones.
		 * 
		 * If you need to control the height for the preferred width, or the width for
		 * the preferred height, you should use Clutter.Actor.get_preferred_width
		 * and Clutter.Actor.get_preferred_height, and check the actor's preferred
		 * geometry management using the Clutter.Actor.request-mode property.
		 * @returns :
		 * - min_width_p (Number) — return location for the minimum
		 * width, or null
		 * - min_height_p (Number) — return location for the minimum
		 * height, or null
		 * - natural_width_p (Number) — return location for the natural
		 * width, or null
		 * - natural_height_p (Number) — return location for the natural
		 * height, or null
		 */
		get_preferred_size(): number[];
		/**
		 * 	Computes the requested minimum and natural widths for an actor,
		 * optionally depending on the specified height, or if they are
		 * already computed, returns the cached values.
		 * 
		 * An actor may not get its request - depending on the layout
		 * manager that's in effect.
		 * 
		 * A request should not incorporate the actor's scaleor translation;
		 * those transformations do not affect layout, only rendering.
		 * @param for_height available height when computing the preferred width,
		 * or a negative value to indicate that no height is defined
		 * @returns :
		 * - min_width_p (Number) — return location for minimum width,
		 * or null
		 * - natural_width_p (Number) — return location for the natural
		 * width, or null
		 */
		get_preferred_width(for_height: number): number[];
		/**
		 * Retrieves the sibling of this that comes before it in the list
		 * of children of this's parent.
		 * 
		 * The returned pointer is only valid until the scene graph changes; it
		 * is not safe to modify the list of children of this while iterating
		 * it.
		 * @returns a pointer to a Clutter.Actor, or null
		 */
		get_previous_sibling(): Actor;
		/**
		 * Checks whether this is marked as reactive.
		 * @returns true if the actor is reactive
		 */
		get_reactive(): boolean;
		/**
		 * Retrieves the geometry request mode of this
		 * @returns the request mode for the actor
		 */
		get_request_mode(): RequestMode;
		/**
		 * Retrieves the resource scale for this actor.
		 * 
		 * The resource scale refers to the scale the actor should use for its resources.
		 * For example if an actor draws a a picture of size 100 x 100 in the stage
		 * coordinate space, it should use a texture of twice the size (i.e. 200 x 200)
		 * if the resource scale is 2.
		 * 
		 * The resource scale is determined by calculating the highest Clutter.StageView
		 * scale the actor will get painted on.
		 * 
		 * Note that the scale returned by this function is only guaranteed to be
		 * correct when queried during the paint cycle, in all other cases this
		 * function will only return a best guess. If your implementation really
		 * needs to get a resource scale outside of the paint cycle, make sure to
		 * subscribe to the "resource-scale-changed" signal to get notified about
		 * the new, correct resource scale before painting.
		 * 
		 * Also avoid getting the resource scale for actors that are not attached
		 * to a stage. There's no sane way for Clutter to guess which Clutter.StageView
		 * the actor is going to be painted on, so you'll probably end up receiving
		 * the "resource-scale-changed" signal and having to rebuild your resources.
		 * 
		 * The best guess this function may return is usually just the last resource
		 * scale the actor got painted with. If this resource scale couldn't be found
		 * because the actor was never painted so far or Clutter was unable to
		 * determine its position and size, this function will return the resource
		 * scale of a parent.
		 * @returns The resource scale the actor should use for its textures
		 */
		get_resource_scale(): number;
		/**
		 * Retrieves the angle of rotation set by Clutter.Actor.set_rotation_angle.
		 * @param axis the axis of the rotation
		 * @returns the angle of rotation, in degrees
		 */
		get_rotation_angle(axis: RotateAction): number;
		/**
		 * Retrieves an actors scale factors.
		 * @returns :
		 * - scale_x (Number) — Location to store horizontal
		 * scale factor, or null.
		 * - scale_y (Number) — Location to store vertical
		 * scale factor, or null.
		 */
		get_scale(): number[];
		/**
		 * Retrieves the scaling factor along the Z axis, as set using
		 * Clutter.Actor.set_scale_z.
		 * @returns the scaling factor along the Z axis
		 */
		get_scale_z(): number;
		/**
		 * This function tries to "do what you mean" and return
		 * the size an actor will have. If the actor has a valid
		 * allocation, the allocation will be returned; otherwise,
		 * the actors natural size request will be returned.
		 * 
		 * If you care whether you get the request vs. the allocation, you
		 * should probably call a different function like
		 * Clutter.Actor.get_allocation_box or
		 * Clutter.Actor.get_preferred_width.
		 * @returns :
		 * - width (Number) — return location for the width, or null.
		 * - height (Number) — return location for the height, or null.
		 */
		get_size(): number[];
		/**
		 * Retrieves the Clutter.Stage where this is contained.
		 * @returns the stage
			   * containing the actor, or null
		 */
		get_stage(): Stage;
		/**
		 * Retrieves the value set using Clutter.Actor.set_text_direction
		 * 
		 * If no text direction has been previously set, the default text
		 * direction, as returned by Clutter.get_default_text_direction, will
		 * be returned instead
		 * @returns the Clutter.TextDirection for the actor
		 */
		get_text_direction(): TextDirection;
		/**
		 * Retrieves the current transformation matrix of a Clutter.Actor.
		 * @returns a Clutter.Matrix
		 */
		get_transform(): Matrix;
		/**
		 * Gets the transformed bounding rect of an actor, in pixels relative to the stage.
		 * @returns (Graphene.Rect) — return location for the transformed bounding rect
		 */
		get_transformed_extents(): any;
		/**
		 * Retrieves the 3D paint volume of an actor like
		 * Clutter.Actor.get_paint_volume does (Please refer to the
		 * documentation of Clutter.Actor.get_paint_volume for more
		 * details.) and it additionally transforms the paint volume into the
		 * coordinate space of relative_to_ancestor. (Or the stage if null
		 * is passed for relative_to_ancestor)
		 * 
		 * This can be used by containers that base their paint volume on
		 * the volume of their children. Such containers can query the
		 * transformed paint volume of all of its children and union them
		 * together using Clutter.PaintVolume.union.
		 * @param relative_to_ancestor  A Clutter.Actor that is an ancestor of this
		 * (or null for the stage)
		 * @returns a pointer to a Clutter.PaintVolume,
		 * or null if no volume could be determined. The returned pointer is
		 * not guaranteed to be valid across multiple frames; if you wish to
		 * keep it, you will have to copy it using Clutter.PaintVolume.copy.
		 */
		get_transformed_paint_volume(relative_to_ancestor: Actor): PaintVolume;
		/**
		 * Gets the absolute position of an actor, in pixels relative to the stage.
		 * @returns :
		 * - x (Number) — return location for the X coordinate, or null
		 * - y (Number) — return location for the Y coordinate, or null
		 */
		get_transformed_position(): number[];
		/**
		 * Gets the absolute size of an actor in pixels, taking into account the
		 * scaling factors.
		 * 
		 * If the actor has a valid allocation, the allocated size will be used.
		 * If the actor has not a valid allocation then the preferred size will
		 * be transformed and returned.
		 * 
		 * If you want the transformed allocation, see
		 * Clutter.Actor.get_abs_allocation_vertices instead.
		 * 
		 * When the actor (or one of its ancestors) is rotated around the
		 * X or Y axis, it no longer appears as on the stage as a rectangle, but
		 * as a generic quadrangle; in that case this function returns the size
		 * of the smallest rectangle that encapsulates the entire quad. Please
		 * note that in this case no assumptions can be made about the relative
		 * position of this envelope to the absolute position of the actor, as
		 * returned by Clutter.Actor.get_transformed_position; if you need this
		 * information, you need to use Clutter.Actor.get_abs_allocation_vertices
		 * to get the coords of the actual quadrangle.
		 * @returns :
		 * - width (Number) — return location for the width, or null
		 * - height (Number) — return location for the height, or null
		 */
		get_transformed_size(): number[];
		/**
		 * Retrieves the Clutter.Transition of a Clutter.Actor by using the
		 * transition name.
		 * 
		 * Transitions created for animatable properties use the name of the
		 * property itself, for instance the code below:
		 * 
		 * ```
		 *   clutter_actor_set_easing_duration (actor, 1000);
		 *   clutter_actor_set_rotation_angle (actor, CLUTTER_Y_AXIS, 360.0);
		 * 
		 *   transition = clutter_actor_get_transition (actor, "rotation-angle-y");
		 *   g_signal_connect (transition, "stopped", G_CALLBACK (on_transition_stopped), actor);
		 * ```
		 * will call the `on_transition_stopped` callback when the transition is finished. If you just want to get notifications of the completion of a transition, you should use the [Clutter.Actor.transition-stopped](Clutter.Actor.html#signal-transition-stopped) signal, using the transition name as the signal detail. 
		 * @param name the name of the transition
		 * @returns a Clutter.Transition, or null is none
		 * was found to match the passed name; the returned instance is owned
		 * by Clutter and it should not be freed
		 */
		get_transition(name: string): Transition;
		/**
		 * Retrieves the translation set using Clutter.Actor.set_translation.
		 * @returns :
		 * - translate_x (Number) — return location for the X component
		 * of the translation, or null
		 * - translate_y (Number) — return location for the Y component
		 * of the translation, or null
		 * - translate_z (Number) — return location for the Z component
		 * of the translation, or null
		 */
		get_translation(): number[];
		/**
		 * Retrieves the width of a Clutter.Actor.
		 * 
		 * If the actor has a valid allocation, this function will return the
		 * width of the allocated area given to the actor.
		 * 
		 * If the actor does not have a valid allocation, this function will
		 * return the actor's natural width, that is the preferred width of
		 * the actor.
		 * 
		 * If you care whether you get the preferred width or the width that
		 * has been assigned to the actor, you should probably call a different
		 * function like Clutter.Actor.get_allocation_box to retrieve the
		 * allocated size or Clutter.Actor.get_preferred_width to retrieve the
		 * preferred width.
		 * 
		 * If an actor has a fixed width, for instance a width that has been
		 * assigned using Clutter.Actor.set_width, the width returned will
		 * be the same value.
		 * @returns the width of the actor, in pixels
		 */
		get_width(): number;
		/**
		 * Retrieves the X coordinate of a Clutter.Actor.
		 * 
		 * This function tries to "do what you mean", by returning the
		 * correct value depending on the actor's state.
		 * 
		 * If the actor has a valid allocation, this function will return
		 * the X coordinate of the origin of the allocation box.
		 * 
		 * If the actor has any fixed coordinate set using Clutter.Actor.set_x,
		 * Clutter.Actor.set_position, this function will return that coordinate.
		 * 
		 * If both the allocation and a fixed position are missing, this function
		 * will return 0.
		 * @returns the X coordinate, in pixels, ignoring any
		 * transformation (i.e. scaling, rotation)
		 */
		get_x(): number;
		/**
		 * Retrieves the horizontal alignment policy set using
		 * Clutter.Actor.set_x_align.
		 * @returns the horizontal alignment policy.
		 */
		get_x_align(): ActorAlign;
		/**
		 * Retrieves the value set with Clutter.Actor.set_x_expand.
		 * @returns true if the actor has been set to expand
		 */
		get_x_expand(): boolean;
		/**
		 * Retrieves the Y coordinate of a Clutter.Actor.
		 * 
		 * This function tries to "do what you mean", by returning the
		 * correct value depending on the actor's state.
		 * 
		 * If the actor has a valid allocation, this function will return
		 * the Y coordinate of the origin of the allocation box.
		 * 
		 * If the actor has any fixed coordinate set using Clutter.Actor.set_y,
		 * Clutter.Actor.set_position, this function will return that coordinate.
		 * 
		 * If both the allocation and a fixed position are missing, this function
		 * will return 0.
		 * @returns the Y coordinate, in pixels, ignoring any
		 * transformation (i.e. scaling, rotation)
		 */
		get_y(): number;
		/**
		 * Retrieves the vertical alignment policy set using
		 * Clutter.Actor.set_y_align.
		 * @returns  the vertical alignment policy
		 */
		get_y_align(): ActorAlign;
		/**
		 * Retrieves the value set with Clutter.Actor.set_y_expand.
		 * @returns true if the actor has been set to expand
		 */
		get_y_expand(): boolean;
		/**
		 * Retrieves the actor's position on the Z axis.
		 * @returns the position on the Z axis.
		 */
		get_z_position(): number;
		/**
		 * Sets the key focus of the Clutter.Stage including this
		   * to this Clutter.Actor.
		 */
		grab_key_focus(): void;
		has_accessible(): boolean;
		/**
		 * Returns whether the actor has any actions applied.
		 * @returns true if the actor has any actions,
		 * false otherwise
		 */
		has_actions(): boolean;
		/**
		 * Checks if the actor has an up-to-date allocation assigned to
		 * it. This means that the actor should have an allocation: it's
		 * visible and has a parent. It also means that there is no
		 * outstanding relayout request in progress for the actor or its
		 * children (There might be other outstanding layout requests in
		 * progress that will cause the actor to get a new allocation
		 * when the stage is laid out, however).
		 * 
		 * If this function returns false, then the actor will normally
		 * be allocated before it is next drawn on the screen.
		 * @returns true if the actor has an up-to-date allocation
		 */
		has_allocation(): boolean;
		/**
		 * Determines whether the actor has a clip area set or not.
		 * @returns true if the actor has a clip area set.
		 */
		has_clip(): boolean;
		/**
		 * Returns whether the actor has any constraints applied.
		 * @returns true if the actor has any constraints,
		 * false otherwise
		 */
		has_constraints(): boolean;
		has_damage(): boolean;
		/**
		 * Returns whether the actor has any effects applied.
		 * @returns true if the actor has any effects,
		 * false otherwise
		 */
		has_effects(): boolean;
		/**
		 * Checks whether this is the Clutter.Actor that has key focus
		 * @returns true if the actor has key focus, and false otherwise
		 */
		has_key_focus(): boolean;
		/**
		 * Returns whether a Clutter.Actor or any parent actors have mapped clones
		 * that are clone-painting this.
		 * @returns true if the actor has mapped clones, false otherwise
		 */
		has_mapped_clones(): boolean;
		/**
		 * Asks the actor's implementation whether it may contain overlapping
		 * primitives.
		 * 
		 * For example; Clutter may use this to determine whether the painting
		 * should be redirected to an offscreen buffer to correctly implement
		 * the opacity property.
		 * 
		 * Custom actors can override the default response by implementing the
		 * index.ActorClass.has_overlaps() virtual function. See
		 * Clutter.Actor.set_offscreen_redirect for more information.
		 * @returns true if the actor may have overlapping primitives, and
		 * false otherwise
		 */
		has_overlaps(): boolean;
		/**
		 * Checks whether an actor contains the pointer of a
		 * Clutter.InputDevice
		 * @returns true if the actor contains the pointer, and
		 * false otherwise
		 */
		has_pointer(): boolean;
		/**
		 * Flags an actor to be hidden. A hidden actor will not be
		 * rendered on the stage.
		 * 
		 * Actors are visible by default.
		 * 
		 * If this function is called on an actor without a parent, the
		 * Clutter.Actor.show-on-set-parent property will be set to false
		 * as a side-effect.
		 */
		hide(): void;
		/**
		 * Increases the culling inhibitor counter. Inhibiting culling
		 * forces the actor to be painted even when outside the visible
		 * bounds of the stage view.
		 * 
		 * This is usually necessary when an actor is being painted on
		 * another paint context.
		 * 
		 * Pair with Clutter.Actor.uninhibit_culling when the actor doesn't
		 * need to be painted anymore.
		 */
		inhibit_culling(): void;
		/**
		 * Inserts child into the list of children of this, above another
		 * child of this or, if sibling is null, above all the children
		 * of this.
		 * 
		 * This function will acquire a reference on child that will only
		 * be released when calling Clutter.Actor.remove_child.
		 * 
		 * This function will not take into consideration the #ClutterActor:depth
		 * of child.
		 * 
		 * This function will emit the Clutter.Container.actor-added signal
		 * on this.
		 * @param child  a Clutter.Actor
		 * @param sibling a child of this, or null
		 */
		insert_child_above(child: Actor, sibling: Actor): void;
		/**
		 * Inserts child into the list of children of this, using the
		 * given index_. If index_ is greater than the number of children
		 * in this, or is less than 0, then the new child is added at the end.
		 * 
		 * This function will acquire a reference on child that will only
		 * be released when calling Clutter.Actor.remove_child.
		 * 
		 * This function will not take into consideration the #ClutterActor:depth
		 * of child.
		 * 
		 * This function will emit the Clutter.Container.actor-added signal
		 * on this.
		 * @param child a Clutter.Actor
		 * @param index the index
		 */
		insert_child_at_index(child: Actor, index: number): void;
		/**
		 * Inserts child into the list of children of this, below another
		 * child of this or, if sibling is null, below all the children
		 * of this.
		 * 
		 * This function will acquire a reference on child that will only
		 * be released when calling Clutter.Actor.remove_child.
		 * 
		 * This function will not take into consideration the #ClutterActor:depth
		 * of child.
		 * 
		 * This function will emit the Clutter.Container.actor-added signal
		 * on this.
		 * @param child a Clutter.Actor
		 * @param sibling a child of this, or null
		 */
		insert_child_below(child: Actor, sibling: Actor): void;
		/**
		 * Invalidate the cached transformation matrix of this.
		 * This is needed for implementations overriding the apply_transform()
		 * vfunc and has to be called if the matrix returned by apply_transform()
		 * would change.
		 */
		invalidate_transform(): void;
		is_effectively_on_stage_view(view: StageView): boolean;
		/**
		 * Checks whether this is being currently painted by a Clutter.Clone
		 * 
		 * This function is useful only inside the ::paint virtual function
		 * implementations or within handlers for the Clutter.Actor.paint
		 * signal
		 * 
		 * This function should not be used by applications
		 * @returns true if the Clutter.Actor is currently being painted
		 * by a Clutter.Clone, and false otherwise
		 */
		is_in_clone_paint(): boolean;
		/**
		 * Checks whether a Clutter.Actor has been set as mapped.
		 * @returns true if the actor is mapped
		 */
		is_mapped(): boolean;
		/**
		 * Checks whether a Clutter.Actor is realized.
		 * @returns true if the actor is realized
		 */
		is_realized(): boolean;
		/**
		 * Checks whether any rotation is applied to the actor.
		 * @returns true if the actor is rotated.
		 */
		is_rotated(): boolean;
		/**
		 * Checks whether the actor is scaled in either dimension.
		 * @returns true if the actor is scaled.
		 */
		is_scaled(): boolean;
		/**
		 * Checks whether an actor is marked as visible.
		 * @returns true if the actor visible
		 */
		is_visible(): boolean;
		/**
		 * Sets the Clutter.ActorFlags.MAPPED flag on the actor and possibly maps
		 * and realizes its children if they are visible. Does nothing if the
		 * actor is not visible.
		 * 
		 * Calling this function is strongly discouraged: the default
		 * implementation of index.ActorClass.map() will map all the children
		 * of an actor when mapping its parent.
		 * 
		 * When overriding map, it is mandatory to chain up to the parent
		 * implementation.
		 */
		map(): void;
		/**
		 * Moves an actor by the specified distance relative to its current
		 * position in pixels.
		 * 
		 * This function modifies the fixed position of an actor and thus removes
		 * it from any layout management. Another way to move an actor is with an
		 * additional translation, using Clutter.Actor.set_translation.
		 * @param dx Distance to move Actor on X axis.
		 * @param dy Distance to move Actor on Y axis.
		 */
		move_by(dx: number, dy: number): void;
		/**
		 * Checks whether an actor, or any of its children, is set to expand
		 * horizontally or vertically.
		 * 
		 * This function should only be called by layout managers that can
		 * assign extra space to their children.
		 * 
		 * If you want to know whether the actor was explicitly set to expand,
		 * use Clutter.Actor.get_x_expand or Clutter.Actor.get_y_expand.
		 * @param orientation the direction of expansion
		 * @returns true if the actor should expand
		 */
		needs_expand(orientation: Orientation): boolean;
		/**
		 * Renders the actor to display.
		 * 
		 * This function should not be called directly by applications.
		 * Call Clutter.Actor.queue_redraw to queue paints, instead.
		 * 
		 * This function is context-aware, and will either cause a
		 * regular paint or a pick paint.
		 * 
		 * This function will emit the Clutter.Actor.paint signal or
		 * the Clutter.Actor.pick signal, depending on the context.
		 * 
		 * This function does not paint the actor if the actor is set to 0,
		 * unless it is performing a pick paint.
		 * @param paint_context 
		 */
		paint(paint_context: PaintContext): void;
		/**
		 * Retrieves the list of Clutter.StageView<!-- -->s the actor is being
		 * painted on.
		 * 
		 * If this function is called during the paint cycle, the list is guaranteed
		 * to be up-to-date, if called outside the paint cycle, the list will
		 * contain the views the actor was painted on last.
		 * 
		 * The list returned by this function is not updated when the actors
		 * visibility changes: If an actor gets hidden and is not being painted
		 * anymore, this function will return the list of views the actor was
		 * painted on last.
		 * 
		 * If an actor is not attached to a stage (realized), this function will
		 * always return an empty list.
		 * @returns  The list of
		 * Clutter.StageView<!-- -->s the actor is being painted on. The list and
		 * its contents are owned by the Clutter.Actor and the list may not be
		 * freed or modified.
		 */
		peek_stage_views(): StageView[];
		/**
		 * Asks this to perform a pick.
		 * @param pick_context 
		 */
		pick(pick_context: PickContext): void;
		/**
		 * Logs (does a virtual paint of) a rectangle for picking. Note that box is
		 * in the actor's own local coordinates, so is usually {0,0,width,height}
		 * to include the whole actor. That is unless the actor has a shaped input
		 * region in which case you may wish to log the (multiple) smaller rectangles
		 * that make up the input region.
		 * @param pick_context  The Clutter.PickContext
		 * @param box A rectangle in the actor's own local coordinates.
		 */
		pick_box(pick_context: PickContext, box: ActorBox): void;
		/**
		 * Queues up a redraw of an actor and any children. The redraw occurs
		 * once the main loop becomes idle (after the current batch of events
		 * has been processed, roughly).
		 * 
		 * Applications rarely need to call this, as redraws are handled
		 * automatically by modification functions.
		 * 
		 * This function will not do anything if this is not visible, or
		 * if the actor is inside an invisible part of the scenegraph.
		 * 
		 * Also be aware that painting is a NOP for actors with an opacity of
		 * 0
		 * 
		 * When you are implementing a custom actor you must queue a redraw
		 * whenever some private state changes that will affect painting or
		 * picking of your actor.
		 */
		queue_redraw(): void;
		/**
		 * Queues a redraw on this limited to a specific, actor-relative
		 * rectangular area.
		 * 
		 * If clip is null this function is equivalent to
		 * Clutter.Actor.queue_redraw.
		 * @param clip  a rectangular clip region, or null
		 */
		queue_redraw_with_clip(clip: cairo.RectangleInt): void;
		/**
		 * Indicates that the actor's size request or other layout-affecting
		 * properties may have changed. This function is used inside Clutter.Actor
		 * subclass implementations, not by applications directly.
				 * 
		 * Queueing a new layout automatically queues a redraw as well.
		 */
		queue_relayout(): void;
		/**
		 * DEPRECATED since 1.16. Actors are automatically realized, and nothing
		 * requires explicit realization.
				 * 
		 * Realization informs the actor that it is attached to a stage. It
		 * can use this to allocate resources if it wanted to delay allocation
		 * until it would be rendered. However it is perfectly acceptable for
		 * an actor to create resources before being realized because Clutter
		 * only ever has a single rendering context so that actor is free to
		 * be moved from one stage to another.
				 * 
		 * This function does nothing if the actor is already realized.
				 * 
		 * Because a realized actor must have realized parent actors, calling
		 * Clutter.Actor.realize will also realize all parents of the actor.
				 * 
		 * This function does not realize child actors, except in the special
		 * case that realizing the stage, when the stage is visible, will
		 * suddenly map (and thus realize) the children of the stage.
		 */
		realize(): void;
		/**
		 * Removes action from the list of actions applied to this

		 * The reference held by this on the Clutter.Action will be released
		 * @param action 
		 */
		remove_action(action: Action): void;
		/**
		 * Removes the Clutter.Action with the given name from the list
		 * of actions applied to this
		 * @param name  the name of the action to remove
		 */
		remove_action_by_name(name: string): void;
		/**
		 * Removes all children of this.

		 * This function releases the reference added by inserting a child actor
		 * in the list of children of this.
				 * 
		 * If the reference count of a child drops to zero, the child will be
		 * destroyed. If you want to ensure the destruction of all the children
		 * of this, use Clutter.Actor.destroy_all_children.
		 */
		remove_all_children(): void;
		/**
		 * Removes all transitions associated to this.
		 */
		remove_all_transitions(): void;
		/**
		 * Removes child from the children of this.

		 * This function will release the reference added by
		 * Clutter.Actor.add_child, so if you want to keep using child
		 * you will have to acquire a referenced on it before calling this
		 * function.
				 * 
		 * This function will emit the Clutter.Container.actor-removed
		 * signal on this.
		 * @param child 
		 */
		remove_child(child: Actor): void;
		/**
		 * Removes clip area from this.
		 */
		remove_clip(): void;
		/**
		 * Removes constraint from the list of constraints applied to this

		 * The reference held by this on the Clutter.Constraint will be released
		 * @param constraint 
		 */
		remove_constraint(constraint: Constraint): void;
		/**
		 * Removes the Clutter.Constraint with the given name from the list
		 * of constraints applied to this
		 * @param name  the name of the constraint to remove
		 */
		remove_constraint_by_name(name: string): void;
		/**
		 * Removes effect from the list of effects applied to this

		 * The reference held by this on the Clutter.Effect will be released
		 * @param effect 
		 */
		remove_effect(effect: Effect): void;
		/**
		 * Removes the Clutter.Effect with the given name from the list
		* of effects applied to this
		 * @param name the name of the effect to remove
		 */
		remove_effect_by_name(name: string): void;
		/**
		 * Removes the transition stored inside a Clutter.Actor using name
		 * identifier.
				 * 
		 * If the transition is currently in progress, it will be stopped.
				 * 
		 * This function releases the reference acquired when the transition
		 * was added to the Clutter.Actor.
		 * @param name the name of the transition to remove
		 */
		remove_transition(name: string): void;
		/**
		 * Replaces old_child with new_child in the list of children of this
		 * @param old_child the child of this to replace
		 * @param new_child the Clutter.Actor to replace old_child
		 */
		replace_child(old_child: Actor, new_child: Actor): void;
		/**
		 * Restores the easing state as it was prior to a call to
		 * Clutter.Actor.save_easing_state.
		 */
		restore_easing_state(): void;
		/**
		 * Saves the current easing state for animatable properties, and creates
		 * a new state with the default values for easing mode and duration.
				 * 
		 * New transitions created after calling this function will inherit the
		 * duration, easing mode, and delay of the new easing state; this also
		 * applies to transitions modified in flight.
		 */
		save_easing_state(): void;
		/**
		 * Stores the allocation of this as defined by box.

		 * This function can only be called from within the implementation of
		 * the index.ActorClass.allocate() virtual function.
				 * 
		 * The allocation box should have been adjusted to take into account
		 * constraints, alignment, and margin properties.
				 * 
		 * This function should only be used by subclasses of Clutter.Actor
		 * that wish to store their allocation but cannot chain up to the
		 * parent's implementation; the default implementation of the
		 * index.ActorClass.allocate() virtual function will call this
		 * function.
		 * @param box 
		 */
		set_allocation(box: ActorBox): void;
		/**
		 * Sets the background color of a Clutter.Actor.

		 * The background color will be used to cover the whole allocation of the
		 * actor. The default background color of an actor is transparent.
				 * 
		 * To check whether an actor has a background color, you can use the
		 * Clutter.Actor.background-color-set actor property.
				 * 
		 * The Clutter.Actor.background-color property is animatable.
		 * @param color a Clutter.Color, or null to unset a previously
		 * set color
		 */
		set_background_color(color: Color): void;
		/**
		 * Sets child to be above sibling in the list of children of this.

		 * If sibling is null, child will be the new last child of this.
				 * 
		 * This function is logically equivalent to removing child and using
		 * Clutter.Actor.insert_child_above, but it will not emit signals
		 * or change state on child.
		 * @param child a Clutter.Actor child of this
		 * @param sibling  a Clutter.Actor child of this, or null
		 */
		set_child_above_sibling(child: Actor, sibling: Actor): void;
		/**
		 * Changes the index of child in the list of children of this.

		 * This function is logically equivalent to removing child and
		 * calling Clutter.Actor.insert_child_at_index, but it will not
		 * emit signals or change state on child.
		 * @param child a Clutter.Actor child of this
		 * @param index_ the new index for child
		 */
		set_child_at_index(child: Actor, index_: number): void;
		/**
		 * Sets child to be below sibling in the list of children of this.

		If sibling is null, child will be the new first child of this.

		This function is logically equivalent to removing this and using
		Clutter.Actor.insert_child_below, but it will not emit signals
		or change state on child.
		 * @param child  a Clutter.Actor child of this
		 * @param sibling a Clutter.Actor child of this, or null
		 */
		set_child_below_sibling(child: Actor, sibling: Actor): void;
		/**
		 * Sets the transformation matrix to be applied to all the children
		 * of this prior to their own transformations. The default child
		 * transformation is the identity matrix.
				 * 
		 * If transform is null, the child transform will be unset.
				 * 
		 * The Clutter.Actor.child-transform property is animatable.
		 * @param transform  a Clutter.Matrix, or null
		 */
		set_child_transform(transform: Matrix): void;
		/**
		 * Sets clip area for this. The clip area is always computed from the
		 * upper left corner of the actor.
		 * @param xoff X offset of the clip rectangle
		 * @param yoff Y offset of the clip rectangle
		 * @param width  Width of the clip rectangle
		 * @param height Height of the clip rectangle
		 */
		set_clip(xoff: number, yoff: number, width: number, height: number): void;
		/**
		 * Sets whether this should be clipped to the same size as its
		 * allocation
		 * @param clip_set true to apply a clip tracking the allocation
		 */
		set_clip_to_allocation(clip_set: boolean): void;
		/**
		 * Sets the contents of a Clutter.Actor.
		 * @param content  a Clutter.Content, or null
		 */
		set_content(content: Content): void;
		/**
		 * Sets the gravity of the Clutter.Content used by this.

		 * See the description of the Clutter.Actor.content-gravity property for
		 * more information.
				 * 
		 * The Clutter.Actor.content-gravity property is animatable.
		 * @param gravity 
		 */
		set_content_gravity(gravity: ContentGravity): void;
		/**
		 * Sets the policy for repeating the Clutter.Actor.content of a
		 * Clutter.Actor. The behaviour is deferred to the Clutter.Content
		 * implementation.
		 * @param repeat the repeat policy
		 */
		set_content_repeat(repeat: ContentRepeat): void;
		/**
		 * Sets the minification and magnification filter to be applied when
		 * scaling the Clutter.Actor.content of a Clutter.Actor.
				 * 
		 * The Clutter.Actor.minification-filter will be used when reducing
		 * the size of the content; the Clutter.Actor.magnification-filter
		 * will be used when increasing the size of the content.
		 * @param min_filter the minification filter for the content
		 * @param mag_filter the magnification filter for the content
		 */
		set_content_scaling_filters(min_filter: ScalingFilter, mag_filter: ScalingFilter): void;
		/**
		 * Sets the delay that should be applied before tweening animatable
		 * properties.
		 * @param msecs the delay before the start of the tweening, in milliseconds
		 */
		set_easing_delay(msecs: number): void;
		/**
		 * Sets the duration of the tweening for animatable properties
		 * of this for the current easing state.
		 * @param msecs the duration of the easing, or null
		 */
		set_easing_duration(msecs: number): void;
		/**
		 * Sets the easing mode for the tweening of animatable properties
		 * of this.
		 * @param mode an easing mode, excluding Clutter.AnimationMode.CUSTOM_MODE
		 */
		set_easing_mode(mode: AnimationMode): void;
		/**
		 * Sets whether an actor has a fixed position set (and will thus be
		 * unaffected by any layout manager).
		 * @param is_set whether to use fixed position
		 */
		set_fixed_position_set(is_set: boolean): void;
		/**
		 * Sets flags on this

		 * This function will emit notifications for the changed properties
		 * @param flags  the flags to set
		 */
		set_flags(flags: ActorFlags): void;
		/**
		 * Forces a height on an actor, causing the actor's preferred width
		 * and height (if any) to be ignored.
				 * 
		 * If height is -1 the actor will use its preferred height instead of
		 * overriding it, i.e. you can "unset" the height with -1.
				 * 
		 * This function sets both the minimum and natural size of the actor.
		 * @param height Requested new height for the actor, in pixels, or -1
		 */
		set_height(height: number): void;
		/**
		 * Sets the Clutter.LayoutManager delegate object that will be used to
		 * lay out the children of this.
				 * 
		 * The Clutter.Actor will take a reference on the passed manager which
		 * will be released either when the layout manager is removed, or when
		 * the actor is destroyed.
		 * @param manager a Clutter.LayoutManager, or null to unset it
		 */
		set_layout_manager(manager: LayoutManager): void;
		/**
		 * Sets all the components of the margin of a Clutter.Actor.
		 * @param margin 
		 */
		set_margin(margin: Margin): void;
		/**
		 * Sets the margin from the bottom of a Clutter.Actor.

		 * The Clutter.Actor.margin-bottom property is animatable.
		 * @param margin the bottom margin
		 */
		set_margin_bottom(margin: number): void;
		/**
		 * Sets the margin from the left of a Clutter.Actor.

		 * The Clutter.Actor.margin-left property is animatable.
		 * @param margin the left margin
		 */
		set_margin_left(margin: number): void;
		/**
		 * Sets the margin from the right of a Clutter.Actor.

		 * The Clutter.Actor.margin-right property is animatable.
		 * @param margin the right margin
		 */
		set_margin_right(margin: number): void;
		/**
		 * Sets the margin from the top of a Clutter.Actor.

		 * The Clutter.Actor.margin-top property is animatable.
		 * @param margin  the top margin
		 */
		set_margin_top(margin: number): void;
		/**
		 * Sets the given name to this. The name can be used to identify
		 * a Clutter.Actor.
		 * @param name Textual tag to apply to actor
		 */
		set_name(name: string): void;
		/**
		 * Defines the circumstances where the actor should be redirected into
		 * an offscreen image. The offscreen image is used to flatten the
		 * actor into a single image while painting for two main reasons.
		 * Firstly, when the actor is painted a second time without any of its
		 * contents changing it can simply repaint the cached image without
		 * descending further down the actor hierarchy. Secondly, it will make
		 * the opacity look correct even if there are overlapping primitives
		 * in the actor.
				 * 
		 * Caching the actor could in some cases be a performance win and in
		 * some cases be a performance lose so it is important to determine
		 * which value is right for an actor before modifying this value. For
		 * example, there is never any reason to flatten an actor that is just
		 * a single texture (such as a #ClutterTexture) because it is
		 * effectively already cached in an image so the offscreen would be
		 * redundant. Also if the actor contains primitives that are far apart
		 * with a large transparent area in the middle (such as a large
		 * CluterGroup with a small actor in the top left and a small actor in
		 * the bottom right) then the cached image will contain the entire
		 * image of the large area and the paint will waste time blending all
		 * of the transparent pixels in the middle.
		 * 
		 * The default method of implementing opacity on a container simply
		 * forwards on the opacity to all of the children. If the children are
		 * overlapping then it will appear as if they are two separate glassy
		 * objects and there will be a break in the color where they
		 * overlap. By redirecting to an offscreen buffer it will be as if the
		 * two opaque objects are combined into one and then made transparent
		 * which is usually what is expected.
		 * 
		 * The image below demonstrates the difference between redirecting and
		 * not. The image shows two Clutter groups, each containing a red and
		 * a green rectangle which overlap. The opacity on the group is set to
		 * 128 (which is 50%). When the offscreen redirect is not used, the
		 * red rectangle can be seen through the blue rectangle as if the two
		 * rectangles were separately transparent. When the redirect is used
		 * the group as a whole is transparent instead so the red rectangle is
		 * not visible where they overlap.
		 * 
		 * <figure id="offscreen-redirect">
		 * <title>Sample of using an offscreen redirect for transparency</title>
		 * <graphic fileref="offscreen-redirect.png" format="PNG"/>
		 * </figure>
		 * 
		 * The default value for this property is 0, so we effectively will
		 * never redirect an actor offscreen by default. This means that there
		 * are times that transparent actors may look glassy as described
		 * above. The reason this is the default is because there is a
		 * performance trade off between quality and performance here. In many
		 * cases the default form of glassy opacity looks good enough, but if
		 * it's not you will need to set the
		 * Clutter.OffscreenRedirect.AUTOMATIC_FOR_OPACITY flag to enable
		 * redirection for opacity.
		 * 
		 * Custom actors that don't contain any overlapping primitives are
		 * recommended to override the has_overlaps() virtual to return false
		 * for maximum efficiency.
		 * @param redirect New offscreen redirect flags for the actor.
		 */
		set_offscreen_redirect(redirect: OffscreenRedirect): void;
		/**
		 * Sets the actor's opacity, with zero being completely transparent and
		 * 255 (0xff) being fully opaque.
				 * 
		 * The Clutter.Actor.opacity property is animatable.
		 * @param opacity New opacity value for the actor.
		 */
		set_opacity(opacity: number): void;
		/**
		 *  Stability: Unstable.

		 * Allows overriding the calculated paint opacity (as returned by
		 * Clutter.Actor.get_paint_opacity). This is used internally by
		 * ClutterClone and ClutterOffscreenEffect, and should be used by
		 * actors that need to mimic those.
		 * 
		 * In almost all cases this should not used by applications.
		 * @param opacity he override opacity value, or -1 to reset
		 */
		set_opacity_override(opacity: number): void;
		/**
		 * Sets the position of the Clutter.Actor.pivot-point around which the
		 * scaling and rotation transformations occur.
				 * 
		 * The pivot point's coordinates are in normalized space, with the (0, 0)
		 * point being the top left corner of the actor, and the (1, 1) point being
		 * the bottom right corner.
		 * @param pivot_x the normalized X coordinate of the pivot point
		 * @param pivot_y the normalized Y coordinate of the pivot point
		 */
		set_pivot_point(pivot_x: number, pivot_y: number): void;
		/**
		 * Sets the component on the Z axis of the Clutter.Actor.pivot-point around
		 * which the scaling and rotation transformations occur.
				 * 
		 * The pivot_z value is expressed as a distance along the Z axis.
		 * @param pivot_z  the Z coordinate of the actor's pivot point
		 */
		set_pivot_point_z(pivot_z: number): void;
		/**
		 * Sets the actor's fixed position in pixels relative to any parent
		 * actor.
				 * 
		 * If a layout manager is in use, this position will override the
		 * layout manager and force a fixed position.
		 * @param x New left position of actor in pixels.
		 * @param y New top position of actor in pixels.
		 */
		set_position(x: number, y: number): void;
		/**
		 * Sets this as reactive. Reactive actors will receive events.
		 * @param reactive whether the actor should be reactive to events
		 */
		set_reactive(reactive: boolean): void;
		/**
		 * Sets the geometry request mode of this.

		 * The mode determines the order for invoking
		 * Clutter.Actor.get_preferred_width and
		 * Clutter.Actor.get_preferred_height
		 * @param mode the request mode
		 */
		set_request_mode(mode: RequestMode): void;
		/**
		 * Sets the angle of rotation of a Clutter.Actor on the given axis.

		 * This function is a convenience for setting the rotation properties
		 * Clutter.Actor.rotation-angle-x, Clutter.Actor.rotation-angle-y,
		 * and Clutter.Actor.rotation-angle-z.
				 * 
		 * The center of rotation is established by the Clutter.Actor.pivot-point
		 * property.
		 * @param axis  the axis to set the angle one
		 * @param angle the angle of rotation, in degrees
		 */
		set_rotation_angle(axis: RotateAxis, angle: number): void;
		/**
		 * Scales an actor with the given factors.

		 * The scale transformation is relative the the Clutter.Actor.pivot-point.
				 * 
		 * The Clutter.Actor.scale-x and Clutter.Actor.scale-y properties are
		 * animatable.
		 * @param scale_x double factor to scale actor by horizontally.
		 * @param scale_y double factor to scale actor by vertically.
		 */
		set_scale(scale_x: number, scale_y: number): void;
		/**
		 * Scales an actor on the Z axis by the given scale_z factor.

		 * The scale transformation is relative the the Clutter.Actor.pivot-point.
				 * 
		 * The Clutter.Actor.scale-z property is animatable.
		 * @param scale_z the scaling factor along the Z axis
		 */
		set_scale_z(scale_z: number): void;
		/**
		 * Sets the actor's size request in pixels. This overrides any
		 * "normal" size request the actor would have. For example
		 * a text actor might normally request the size of the text;
		 * this function would force a specific size instead.
				 * 
		 * If width and/or height are -1 the actor will use its
		 * "normal" size request instead of overriding it, i.e.
		 * you can "unset" the size with -1.
				 * 
		 * This function sets or unsets both the minimum and natural size.
		 * @param width New width of actor in pixels, or -1
		 * @param height  New height of actor in pixels, or -1
		 */
		set_size(width: number, height: number): void;
		/**
		 * Sets the Clutter.TextDirection for an actor

		 * The passed text direction must not be Clutter.TextDirection.DEFAULT
				 * 
		 * If this implements Clutter.Container then this function will recurse
		 * inside all the children of this (including the internal ones).
				 * 
		 * Composite actors not implementing Clutter.Container, or actors requiring
		 * special handling when the text direction changes, should connect to
		 * the GObject.Object signal for the Clutter.Actor.text-direction property
		 * @param text_dir  the text direction for this
		 */
		set_text_direction(text_dir: TextDirection): void;
		/**
		 * Overrides the transformations of a Clutter.Actor with a custom
		 * matrix, which will be applied relative to the origin of the
		 * actor's allocation and to the actor's pivot point.
				 * 
		 * The Clutter.Actor.transform property is animatable.
		 * @param transform a Clutter.Matrix, or null to
		 * unset a custom transformation
		 */
		set_transform(transform: Matrix): void;
		/**
		 * Sets an additional translation transformation on a Clutter.Actor,
		 * relative to the Clutter.Actor.pivot-point.
		 * @param translate_x the translation along the X axis
		 * @param translate_y the translation along the Y axis
		 * @param translate_z the translation along the Z axis
		 */
		set_translation(translate_x: number, translate_y: number, translate_z: number): void;
		/**
		 * Forces a width on an actor, causing the actor's preferred width
		 * and height (if any) to be ignored.
				 * 
		 * If width is -1 the actor will use its preferred width request
		 * instead of overriding it, i.e. you can "unset" the width with -1.
				 * 
		 * This function sets both the minimum and natural size of the actor.
		 * @param width Requested new width for the actor, in pixels, or -1
		 */
		set_width(width: number): void;
		/**
		 * Sets the actor's X coordinate, relative to its parent, in pixels.

		 * Overrides any layout manager and forces a fixed position for
		 * the actor.
				 * 
		 * The Clutter.Actor.x property is animatable.

		 * @param x  the actor's position on the X axis
		 */
		set_x(x: number): void;
		/**
		 * Sets the horizontal alignment policy of a Clutter.Actor, in case the
		 * actor received extra horizontal space.
				 * 
		 * See also the Clutter.Actor.x-align property.
		 * @param x_align  the horizontal alignment policy
		 */
		set_x_align(x_align: ActorAlign): void;
		/**
		 * Sets whether a Clutter.Actor should expand horizontally; this means
		 * that layout manager should allocate extra space for the actor, if
		 * possible.
				 * 
		 * Setting an actor to expand will also make all its parent expand, so
		 * that it's possible to build an actor tree and only set this flag on
		 * its leaves and not on every single actor.
		 * @param expand whether the actor should expand horizontally
		 */
		set_x_expand(expand: boolean): void;
		/**
		 * Sets the actor's Y coordinate, relative to its parent, in pixels.#

		 * Overrides any layout manager and forces a fixed position for
		 * the actor.
				 * 
		 * The Clutter.Actor.y property is animatable.
		 * @param y the actor's position on the Y axis
		 */
		set_y(y: number): void;
		/**
		 * Sets the vertical alignment policy of a Clutter.Actor, in case the
		 * actor received extra vertical space.
				 * 
		 * See also the Clutter.Actor.y-align property.
		 * @param y_align the vertical alignment policy
		 */
		set_y_align(y_align: ActorAlign): void;
		/**
		 * Sets whether a Clutter.Actor should expand horizontally; this means
		 * that layout manager should allocate extra space for the actor, if
		 * possible.
				 * 
		 * Setting an actor to expand will also make all its parent expand, so
		 * that it's possible to build an actor tree and only set this flag on
		 * its leaves and not on every single actor.
		 * @param expand whether the actor should expand vertically
		 */
		set_y_expand(expand: boolean): void;
		/**
		 * Sets the actor's position on the Z axis.

		 * See Clutter.Actor.z-position.
		 * @param z_position the position on the Z axis
		 */
		set_z_position(z_position: number): void;
		/**
		 * Should be called inside the implementation of the
		 * Clutter.Actor.pick virtual function in order to check whether
		 * the actor should paint itself in pick mode or not.
				 * 
		 * This function should never be called directly by applications.
		 * @returns true if the actor should paint its silhouette,
		 * false otherwise
		 */
		should_pick_paint(): boolean;
		/**
		 * Flags an actor to be displayed. An actor that isn't shown will not
		 * be rendered on the stage.
				 * 
		 * Actors are visible by default.
				 * 
		 * If this function is called on an actor without a parent, the
		 * Clutter.Actor.show-on-set-parent will be set to true as a side
		 * effect.
		 */
		show(): void;
		/**
		 * This function translates screen coordinates (x, y) to
		 * coordinates relative to the actor. For example, it can be used to translate
		 * screen events from global screen coordinates into actor-local coordinates.
				 * 
		 * The conversion can fail, notably if the transform stack results in the
		 * actor being projected on the screen as a mere line.
				 * 
		 * The conversion should not be expected to be pixel-perfect due to the
		 * nature of the operation. In general the error grows when the skewing
		 * of the actor rectangle on screen increases.
				 * 
		 * This function can be computationally intensive.
				 * 
		 * This function only works when the allocation is up-to-date, i.e. inside of
		 * the index.ActorClass.paint() implementation
		 * @param x x screen coordinate of the point to unproject
		 * @param y y screen coordinate of the point to unproject
		 * @returns :
		 * - ok (Boolean) — true if conversion was successful.
		 * - x_out (Number) — return location for the unprojected x coordinance
		 * - y_out (Number) — return location for the unprojected y coordinance
		 */
		transform_stage_point(x: number, y: number): any[];
		/**
		 * Decreases the culling inhibitor counter. See Clutter.Actor.inhibit_culling
		 * for when inhibit culling is necessary.
				 * 
		 * Calling this function without a matching call to
		 * Clutter.Actor.inhibit_culling is a programming error.
		 */
		uninhibit_culling(): void;
		/**
		 * Unsets the Clutter.ActorFlags.MAPPED flag on the actor and possibly
		 * unmaps its children if they were mapped.
				 * 
		 * Calling this function is not encouraged: the default Clutter.Actor
		 * implementation of index.ActorClass.unmap() will also unmap any
		 * eventual children by default when their parent is unmapped.
				 * 
		 * When overriding index.ActorClass.unmap(), it is mandatory to
		 * chain up to the parent implementation.
				 * 
		 * It is important to note that the implementation of the
		 * index.ActorClass.unmap() virtual function may be called after
		 * the index.ActorClass.destroy() or the GObject.dispose()
		 * implementation, but it is guaranteed to be called before the
		 * GObject.finalize() implementation.
		 */
		unmap(): void;
		/** Deprecated since 1.10. Use Actor.remove_child instead */
		unparent(): void;
		/**
		 *  Deprecated since 1.16. Actors are automatically unrealized, and nothing
		 * requires explicit realization.
				 * 
		 * Unrealization informs the actor that it may be being destroyed or
		 * moved to another stage. The actor may want to destroy any
		 * underlying graphics resources at this point. However it is
		 * perfectly acceptable for it to retain the resources until the actor
		 * is destroyed because Clutter only ever uses a single rendering
		 * context and all of the graphics resources are valid on any stage.
				 * 
		 * Because mapped actors must be realized, actors may not be
		 * unrealized if they are mapped. This function hides the actor to be
		 * sure it isn't mapped, an application-visible side effect that you
		 * may not be expecting.
				 * 
		 * This function should not be called by application code.
				 * 
		 * This function should not really be in the public API, because
		 * there isn't a good reason to call it. ClutterActor will already
		 * unrealize things for you when it's important to do so.
				 * 
		 * If you were using Clutter.Actor.unrealize in a dispose
		 * implementation, then don't, just chain up to ClutterActor's
		 * dispose.
				 * 
		 * If you were using Clutter.Actor.unrealize to implement
		 * unrealizing children of your container, then don't, ClutterActor
		 * will already take care of that.
		 */
		unrealize(): void;
		/**
		 * Unsets flags on this

		 * This function will emit notifications for the changed properties
		 * @param flags the flags to unset
		 */
		unset_flags(flags: ActorFlags): void;
		/** Deprecated, use add_child instead */
		add_actor(actor: Actor): void;
		connect(signal: 'button-press-event' | 'button-release-event' | 'captured-event' | 'enter-event' | 'event' | 'key-press-event' | 'key-release-event' | 'leave-event' | 'motion-event' | 'scroll-event' | 'touch-event', callback: (actor: this, event: Event) => boolean | void): number;
		connect(signal: 'destroy' | 'hide' | 'key-focus-in' | 'key-focus-out' | 'queue-relayout' | 'realize' | 'resource-scale-changed' | 'show' | 'stage-views-changed' | 'transitions-completed' | 'unrealize', callback: (actor: this) => void): number;
		connect(signal: 'paint', callback: (actor: this, paint_context: PaintContext) => void): number;
		connect(signal: 'parent-set', callback: (actor: this, old_parent: Actor) => void): number;
		connect(signal: 'pick', callback: (actor: this, pick_context: PickContext) => void): number;
		connect(signal: 'queue-redraw', callback: (actor: this, origin: Actor, volume: PaintVolume) => void): number;
		connect(event: 'transition-stopped', callback: (name: string, is_finished: Boolean) => void): number;
	}

	type ActorMethodsReadableProps = IActorMethodsReadableProps & GObject.Object & Animatable & Container & Scriptable


	interface Actor extends ActorOptions, ActorMethodsReadableProps { }

	/** Base class for actors. */
	export class Actor {
		constructor(options?: Partial<ActorOptions>)
	}

	/**
	 * Bounding box of an actor. The coordinates of the top left and right bottom
	 * corners of an actor. The coordinates of the two points are expressed in
	 * pixels with sub-pixel precision
	 */
	export class ActorBox {
		/**
		 *  X coordinate of the top left corner
		 */
		x1: number;
		/** Y coordinate of the top left corner */
		y1: number;
		/** X coordinate of the bottom right corner */
		x2: number;
		/** Y coordinate of the bottom right corner */
		y2: number;

		/**
		 * Allocates a new Clutter.ActorBox.
		 * @returns  the newly allocated Clutter.ActorBox.
		 * Use Clutter.ActorBox.free to free its resources
		 */
		static alloc(): ActorBox;
		/**
		 * Allocates a new Clutter.ActorBox using the passed coordinates
		 * for the top left and bottom right points.

		 * This function is the logical equivalent of:

			`clutter_actor_box_init (clutter_actor_box_alloc (), x_1, y_1, x_2, y_2);`

		 * @param x_1 X coordinate of the top left point
		 * @param y_1 Y coordinate of the top left point
		 * @param x_2 X coordinate of the bottom right point
		 * @param y_2 Y coordinate of the bottom right point
		 * @returns the newly allocated Clutter.ActorBox.
		 * Use Clutter.ActorBox.free to free the resources
		 */
		static new(x_1: number, y_1: number, x_2: number, y_2: number): ActorBox;
		/**
		 * Clamps the components of this to the nearest integer
		 */
		clamp_to_pixel(): void;
		/**
		 * Checks whether a point with x, y coordinates is contained
		 * within this
		 * @param x X coordinate of the point
		 * @param y Y coordinate of the point
		 * @returns true if the point is contained by the Clutter.ActorBox
		 */
		contains(x: number, y: number): boolean;
		/**
		 * Copies this
		 * @returns a newly allocated copy of Clutter.ActorBox. Use
		 * Clutter.ActorBox.free to free the allocated resources
		 */
		copy(): ActorBox;
		/**
		 * Checks this and box_b for equality
		 * @param box_b 
		 * @returns true if the passed Clutter.ActorBox are equa
		 */
		equal(box_b: ActorBox): boolean;
		/**
		 * Frees a Clutter.ActorBox allocated using Clutter.ActorBox.new
		 * or Clutter.ActorBox.copy
		 */
		free(): void;
		/**
		 * Calculates the bounding box represented by the four vertices; for details
		 * of the vertex array see Clutter.Actor.get_abs_allocation_vertices.
		 * @param verts (Array(Graphene.Point3D)) — array of four #graphene_point3d_t
		 */
		from_vertices(verts: any[]): void;
		/**
		 * Retrieves the area of this
		 * @returns  the area of a Clutter.ActorBox, in pixels
		 */
		get_area(): number;
		/**
		 * Retrieves the height of the this
		 * @returns the height of the box
		 */
		get_height(): number;
		/**
		 * Retrieves the origin of this
		 * @returns :
		 * - x (Number) — return location for the X coordinate, or null
		 * - y (Number) — return location for the Y coordinate, or null
		 */
		get_origin(): number[];
		/**
		 * Retrieves the size of this
		 * @returns :
		 * - width (Number) — return location for the width, or null
		 * - height (Number) — return location for the height, or null
		 */
		get_size(): number[];
		/**
		 * Retrieves the width of the this
		 * @returns the width of the box
		 */
		get_width(): number;
		/**
		 * Retrieves the X coordinate of the origin of this
		 * @returns the X coordinate of the origin
		 */
		get_x(): number;
		/**
		 * Retrieves the Y coordinate of the origin of this
		 * @returns the Y coordinate of the origin
		 */
		get_y(): number;
		/**
		 * Initializes this with the given coordinates.
		 * @param x_1  X coordinate of the top left point
		 * @param y_1 Y coordinate of the top left point
		 * @param x_2  X coordinate of the bottom right point
		 * @param y_2 Y coordinate of the bottom right point
		 * @returns the initialized Clutter.ActorBox
		 */
		init(x_1: number, y_1: number, x_2: number, y_2: number): void;
		/**
		 * Initializes this with the given origin and size.
		 * @param x X coordinate of the origin
		 * @param y Y coordinate of the origin
		 * @param width width of the box
		 * @param height height of the box
		 */
		init_rect(x: number, y: number, width: number, height: number): void;
		/**
		 * Interpolates between this and final Clutter.ActorBox<!-- -->es
		 * using progress
		 * @param final the final Clutter.ActorBox
		 * @param progress the interpolation progress
		 * @returns return location for the interpolation
		 */
		interpolate(final: ActorBox, progress: number): ActorBox;
		/**
		 * Checks if this has been initialized, a Clutter.ActorBox is uninitialized
		 * if it has a size of -1 at an origin of 0, 0.
		 * @returns true if the box is uninitialized, false if it isn't
		 */
		is_initialized(): boolean;
		/**
		 * Rescale the this by provided scale factor.
		 * @param scale scale factor for resizing this box
		 */
		scale(scale: number): void;
		/**
		 * Changes the origin of this, maintaining the size of the Clutter.ActorBox.
		 * @param x  the X coordinate of the new origin
		 * @param y the Y coordinate of the new origin
		 */
		set_origin(x: number, y: number): void;
		/**
		 * Sets the size of this, maintaining the origin of the Clutter.ActorBox.
		 * @param width the new width
		 * @param height the new height
		 */
		set_size(width: number, height: number): void;
		/**
		 * Unions the two boxes this and b and stores the result in @result.
		 * @param b the second Clutter.ActorBox
		 * @returns  the Clutter.ActorBox representing a union
		 * of this and b
		 */
		union(b: ActorBox): ActorBox;
	}
	export class ActorMeta {

	}
	export class ActorNode {

	}
	export class AlignConstraint {

	}
	export class Animatable {

	}
	export class Backend {

	}
	export class BinLayout {

	}
	export class BindConstraint {

	}
	export class BindingPool {

	}
	export class BlurEffect {

	}

	interface BoxLayout extends LayoutManager, GObject.Object {}
	export class BoxLayout {
		static new(): BoxLayout;
		constructor(initObj?: any);
		/**
		 * Retrieves if the children sizes are allocated homogeneously.
		 * @returns true if the Clutter.BoxLayout is arranging its children
		 * homogeneously, and false otherwise
		 */
		get_homogeneous(): boolean;
		/**
		 * Retrieves the orientation of the this.
		 * @returns  the orientation of the layout
		 */
		get_orientation(): Orientation;
		/**
		 * Retrieves the value set using Clutter.BoxLayout.set_pack_start
		 * @returns true if the Clutter.BoxLayout should pack children
		 * at the beginning of the layout, and false otherwise
		 */
		get_pack_start(): boolean;
		/**
		 * Retrieves the spacing set using Clutter.BoxLayout.set_spacing
		 * @returns the spacing between children of the Clutter.BoxLayout
		 */
		get_spacing(): number;
		/**
		 * Sets whether the size of this children should be
		 * homogeneous
		 * @param homogeneous true if the layout should be homogeneous
		 */
		set_homogeneous(homogeneous: boolean): void;
		/**
		 * Sets the orientation of the Clutter.BoxLayout layout manager.
		 * @param orientation the orientation of the Clutter.BoxLayout
		 */
		set_orientation(orientation: Orientation): void;
		/**
		 * Sets whether children of this should be laid out by appending
		 * them or by prepending them
		 * @param pack_start true if the this should pack children at the
 		 * beginning of the layout
		 */
		set_pack_start(pack_start: boolean): void;
		/**
		 * Sets the spacing between children of this
		 * @param spacing the spacing between children of the layout, in pixels
		 */
		set_spacing(spacing: number): void; 
	}
	export class BrightnessContrastEffect {

	}
	export class Canvas {

	}
	export class ChildMeta {

	}
	export class ClickAction {

	}
	export class ClipNode {

	}
	export class Clone {

	}
	export class ColorNode {

	}
	export class ColorizeEffect {

	}
	export class Constraint {

	}
	/**
	 * Clutter.Container is an opaque structure whose members cannot be directly
	 * accessed
	 */
	export class Container {
		remove_actor(actor: Actor): void
	}

	export class Content {

	}
	export class DeformEffect {

	}
	export class DesaturateEffect {

	}
	export class Effect {

	}
	export class FixedLayout {

	}
	export class FlowLayout {

	}
	export class FrameClock {

	}
	export class GestureAction {

	}
	export class GridLayout {
		constructor(options: any);
		set_column_homogeneous(homogeneous: boolean): void;
		set_row_homogeneous(homogeneous: boolean): void;
		set_column_spacing(spacing: number): void;
		set_row_spacing(spacing: number): void;
		attach(widget: imports.gi.St.Widget, col: number, row: number, colspan: number, rowspan: number): void;
	}
	export class Image {

	}
	export class InputDevice extends GObject.Object {

	}
	export class InputDeviceTool {

	}
	export class InputFocus {

	}
	export class InputMethod {

	}
	export class Interval {

	}
	export class KeyframeTransition {

	}
	export class Keymap {

	}
	export class LayerNode {

	}

	export interface LayoutManager {

	}
	export class LayoutManager {

	}
	export class LayoutMeta {

	}
	export class Margin {
		/** the margin from the left */
		left: number;
		/** the margin from the right */
		right: number;
		/** the margin from the top */
		top: number;
		/** the margin from the bottom */
		bottom: number;

		/**
		 * Creates a new Clutter.Margin.
		 * @returns a newly allocated Clutter.Margin. Use
		 * Clutter.Margin.free to free the resources associated with it when
		 * done.
		 */
		static new(): Margin;
		/**
		 * Creates a new Clutter.Margin and copies the contents of this into
		 * the newly created structure.
		 * @returns a copy of the Clutter.Margin.
		 */
		copy(): Margin;
		/**
		 * Frees the resources allocated by Clutter.Margin.new and
		 * Clutter.Margin.copy.
		 */
		free(): void;
	}
	/**
	 * A type representing a 4x4 matrix.

		It is identicaly to Cogl.Matrix.
	 */
	export class Matrix {

	}
	export class OffscreenEffect {

	}
	export class PageTurnEffect {

	}
	export class PaintNode {

	}
	export class PanAction {

	}
	export class Path {

	}
	export class PathConstraint {

	}
	export class PipelineNode {

	}

	interface PointOptions {
		x: number;
		y: number
	}

	export class Point {
		constructor(options?: PointOptions)
	}

	export class PropertyTransition {

	}
	export class RootNode {

	}
	export class RotateAction {

	}
	export class Script {

	}
	export class Scriptable {

	}
	export class ScrollActor {

	}
	export class Seat {

	}
	export class Settings {

	}
	export class ShaderEffect {

	}
	export class ShaderFloat {

	}
	export class ShaderInt {

	}
	export class ShaderMatrix {

	}
	export class SnapConstraint {

	}
	export class Stage extends Actor {
		key_focus: Actor;
		capture_into(paint: boolean, rect: cairo.RectangleInt, data: number): void;
		clear_stage_views(): void;
		ensure_viewport(): void;
		//event(event: Event): void;
		get_actor_at_pos(pick_mode: PickMode, x: number, y: number): Actor;
		get_capture_final_size(rect: cairo.RectangleInt, width: number, height: number, scale: number): boolean;
		get_frame_counter(): number;
		get_key_focus(): Actor;
		/**
		 * 
		Returns:

		width (Number) — return location for the minimum width, in pixels,
		or null
		height (Number) — return location for the minimum height, in pixels,
		or null


		 */
		get_minimum_size(): number[];
		get_motion_events_enabled(): boolean;
		get_perspective(): Perspective;
		get_throttle_motion_events(): boolean;
		get_title(): string;
		get_use_alpha(): boolean;
		paint_to_buffer(rect: cairo.RectangleInt, scale: number, data: number, stride: number, format: any, paint_flags: PaintFlag): boolean;
		paint_to_framebuffer(framebuffer: any, rect: cairo.RectangleInt, scale: number, paint_flags: PaintFlag): void;
		read_pixels(x: number, y: number, width: number, height: number): ByteArray
		schedule_update(): void;
		set_key_focus(actor: Actor): void;
		set_minimum_size(width: number, height: number): void;
		set_motion_events_enabled(enabled: boolean): void;
		set_throttle_motion_events(throttle: boolean): void;
		set_title(title: string): void;
		set_use_alpha(use_alpha: boolean): void;
	}
	export class StageManager {

	}
	export class StageView {

	}
	export class SwipeAction {

	}
	export class TapAction {

	}

	export class Text extends Actor {
		ellipsize: gi.Pango.EllipsizeMode
		line_wrap: boolean
		line_wrap_mode: gi.Pango.WrapMode
		text: string
		coords_to_position(x: number, y: number): number
		get_layout(): gi.Pango.Layout;
		set_line_wrap(line_wrap: boolean): void;
		set_ellipsize(mode: gi.Pango.EllipsizeMode): void;
		set_line_alignment(alignment: gi.Pango.Alignment): void;
		set_line_wrap_mode(wrap_mode: gi.Pango.WrapMode): void;
		set_markup(markup: string): void
	}

	export class TextBuffer {

	}
	export class TextNode {

	}
	export class TextureNode {

	}
	export class Timeline {

	}
	export class TransformNode {

	}
	export class Transition {

	}
	export class TransitionGroup {

	}
	export class VirtualInputDevice {

	}
	export class ZoomAction {

	}


	export class EventSequence {

	}

	export class Event {
		public get_button(): number;
		public get_coords(): number[];
		public get_scroll_direction(): ScrollDirection;
		public get_source(): Clutter.Actor;
		public get_key_symbol(): number;
		public type(): EventType;
	}

	export class Color {
		/** red component, between 0 and 255 */
		red: number;
		/** green component, between 0 and 255 */
		green: number;
		/** blue component, between 0 and 255 */
		blue: number;
		/** alpha component, between 0 and 255 */
		alpha: number;

		/**
		 * Converts a color expressed in HLS (hue, luminance and saturation)
		 * values into a Clutter.Color.
		 * @param hue hue value, in the 0 .. 360 range
		 * @param luminance luminance value, in the 0 .. 1 range
		 * @param saturation saturation value, in the 0 .. 1 range
		 * @returns return location for a Clutter.Color
		 */
		static from_hls(hue: number, luminance: number, saturation: number): Color;
		/**
		 * Converts pixel from the packed representation of a four 8 bit channel
		 * color to a Clutter.Color.
		 * @param pixel a 32 bit packed integer containing a color
		 */
		static from_pixel(pixel: number): Color;
		/**
		 * Parses a string definition of a color, filling the Clutter.Color.red,
		 * Clutter.Color.green, Clutter.Color.blue and Clutter.Color.alpha fields
		 * of color.
			 * 
		 * The color is not allocated.
			 * 
		 * The format of str can be either one of:
			 * 
		 *     a standard name (as taken from the X11 rgb.txt file)
		 *     an hexadecimal value in the form: #rgb, #rrggbb, #rgba, or #rrggbbaa
		 *     a RGB color in the form: rgb(r, g, b)
		 *     a RGB color in the form: rgba(r, g, b, a)
		 *     a HSL color in the form: hsl(h, s, l)
		 *     -a HSL color in the form: hsla(h, s, l, a)
			 * 
		 * where 'r', 'g', 'b' and 'a' are (respectively) the red, green, blue color
		 * intensities and the opacity. The 'h', 's' and 'l' are (respectively) the
		 * hue, saturation and luminance values.
			 * 
		 * In the rgb() and rgba() formats, the 'r', 'g', and 'b' values are either
		 * integers between 0 and 255, or percentage values in the range between 0%
		 * and 100%; the percentages require the '%' character. The 'a' value, if
		 * specified, can only be a floating point value between 0.0 and 1.0.
			 * 
		 * In the hls() and hlsa() formats, the 'h' value (hue) is an angle between
		 * 0 and 360.0 degrees; the 'l' and 's' values (luminance and saturation) are
		 * percentage values in the range between 0% and 100%. The 'a' value, if specified,
		 * can only be a floating point value between 0.0 and 1.0.
			 * 
		 * Whitespace inside the definitions is ignored; no leading whitespace
		 * is allowed.
			 * 
		 * If the alpha component is not specified then it is assumed to be set to
		 * be fully opaque.
		 * @param str  a string specifying a color
		 * @returns :
		 * - ok (Boolean) — true if parsing succeeded, and false otherwise
		 * - color (Clutter.Color) — return location for a Clutter.Color
		 */
		static from_string(str: string): any[];
		/**
		 * Retrieves a static color for the given color name

		 * Static colors are created by Clutter and are guaranteed to always be
		 * available and valid
		 * @param color the named global color
		 * @returns a pointer to a static color; the returned pointer
		 * is owned by Clutter and it should never be modified or freed
		 */
		static get_static(color: StaticColor): Color;
		/**
		 * Allocates a new, transparent black Clutter.Color.
		 * @returns the newly allocated Clutter.Color; use
		 * Clutter.Color.free to free its resources
		 */
		static alloc(): Color;
		/**
		 * Creates a new Clutter.Color with the given values.
		 * @param red red component of the color, between 0 and 255
		 * @param green green component of the color, between 0 and 255
		 * @param blue blue component of the color, between 0 and 255
		 * @param alpha alpha component of the color, between 0 and 255
		 * @returns the newly allocated color.
			 * Use Clutter.Color.free when done
		 */
		static new(red: number, green: number, blue: number, alpha: number): Color;
		/**
		 * Adds this to b and saves the resulting color inside @result.

		 * The alpha channel of @result is set as as the maximum value
		 * between the alpha channels of this and b.
		 * @param b a Clutter.Color
		 */
		add(b: Color): Color;
		/**
		 * Makes a copy of the color structure. The result must be
		 * freed using Clutter.Color.free.
		 * @returns an allocated copy of this.
		 */
		copy(): Color;
		/**
		 * Darkens this by a fixed amount, and saves the changed color
		 * in @result.
		 * @returns return location for the darker color
		 */
		darken(): Color;
		/**
		 * Compares two Clutter.Color<!-- -->s and checks if they are the same.

		 * This function can be passed to GLib.HashTable as the @key_equal_func
		 * parameter, when using Clutter.Color<!-- -->s as keys in a GLib.HashTable.
		 * @param v2 
		 * @returns true if the two colors are the same.
		 */
		equal(v2: Color): boolean;
		/**
		 * Frees a color structure created with Clutter.Color.copy.
		 */
		free(): void;
		/**
		 * Converts a Clutter.Color to a hash value.

		 * This function can be passed to GLib.HashTable as the @hash_func
		 * parameter, when using Clutter.Color<!-- -->s as keys in a GLib.HashTable.
		 * @returns a hash value corresponding to the color
		 */
		hash(): number;
		/**
		 * Initializes this with the given values.
		 * @param red red component of the color, between 0 and 255
		 * @param green green component of the color, between 0 and 255
		 * @param blue blue component of the color, between 0 and 255
		 * @param alpha alpha component of the color, between 0 and 255
		 * @returns the initialized Clutter.Color
		 */
		init(red: number, green: number, blue: number, alpha: number): Color;
		/**
		 * Interpolates between this and final Clutter.Color<!-- -->s
		 * using progress
		 * @param final the final Clutter.Color
		 * @param progress the interpolation progress
		 * @returns  return location for the interpolation
		 */
		interpolate(final: Color, progress: number): Color;
		/**
		 * Lightens this by a fixed amount, and saves the changed color
		 * in @result.
		 * @returns  return location for the lighter color
		 */
		lighten(): Color;
		/**
		 * Shades this by factor and saves the modified color into @result.
		 * @param factor  the shade factor to apply
		 * @returns return location for the shaded color
		 */
		shade(factor: number): Color;
		/**
		 * Subtracts b from this and saves the resulting color inside @result.

		 * This function assumes that the components of this are greater than the
		 * components of b; the result is, otherwise, undefined.
			 * 
		 * The alpha channel of @result is set as the minimum value
		 * between the alpha channels of this and b.
		 * @param b 
		 * @returns return location for the result
		 */
		subtract(b: Color): Color;
		/**
		 * Converts this to the HLS format.

		 * The hue value is in the 0 .. 360 range. The luminance and
		 * saturation values are in the 0 .. 1 range.
		 * @returns :
		 * - hue (Number) — return location for the hue value or null
		 * - luminance (Number) — return location for the luminance value or null
		 * - saturation (Number) — return location for the saturation value or null
		 */
		to_hls(): number[];
		/**
		 * Converts this into a packed 32 bit integer, containing
		 * all the four 8 bit channels used by Clutter.Color.
		 * @returns a packed color
		 */
		to_pixel(): number;
		/**
		 * Returns a textual specification of this in the hexadecimal form
		 * <literal>&num;rrggbbaa</literal>, where <literal>r</literal>,
		 * <literal>g</literal>, <literal>b</literal> and <literal>a</literal> are
		 * hexadecimal digits representing the red, green, blue and alpha components
		 * respectively.
		 * @returns a newly-allocated text string
		 */
		to_string(): string;
	}

	export class PickContext { }

	export class PaintContext { }

	export class PaintVolume { }

	// ENUMS

	export enum ActorAlign {
		/** Center the actor inside the allocation */
		CENTER = 2,
		/** Snap to right or bottom side, leaving space
		 * to the left or top. For horizontal layouts, in right-to-left locales
		 * this should be reversed. */
		END = 3,
		/**  */
		FILL = 0,
		/** Snap to left or top side, leaving space
		 * to the right or bottom. For horizontal layouts, in right-to-left
		 * locales this should be reversed. */
		START = 1
	}
	/** Flags used to signal the state of an actor. */
	export enum ActorFlags {
		/** 2. the actor will be painted (is visible, and inside
		 * a toplevel, and all parents visible) */
		MAPPED = 1 << 1,
		/** 4. the resources associated to the actor have been
		 * allocated */
		REALIZED = 1 << 2,
		/** 8. the actor 'reacts' to mouse events emitting event
		* signals */
		REACTIVE = 1 << 3,
		/** 16. the actor has been shown by the application program */
		VISIBLE = 1 << 4,
		/** 32. the actor provides an explicit layout management
		policy for its children; this flag will prevent Clutter from automatic
		queueing of relayout and will defer all layouting to the actor itself */
		NO_LAYOUT = 1 << 5
	}
	export enum AlignAxis {

	}

	/**
	  * Flags passed to the index.ActorClass.allocate() virtual function
	  * and to the Clutter.Actor.allocate function.
	  */
	export enum AllocationFlags {
		/** No flag set */
		ALLOCATION_NONE = 0,
		/** Whether the absolute origin of the actor has changed; this implies that any 
		ancestor of the actor has been moved. */
		ABSOLUTE_ORIGIN_CHANGED = 2,
		/** Whether the allocation should be delegated to the Clutter.LayoutManager 
		instance stored inside the Clutter.Actor.layout-manager property of Clutter.
		Actor. This flag should only be used if you are subclassing Clutter.Actor and
		overriding the index.ActorClass.allocate() virtual function, but you wish to 
		use the default implementation of the virtual function inside Clutter.Actor.
		Added in Clutter 1.10. */
		DELEGATE_LAYOUT = 4
	}

	export enum AnimationMode {

	}
	export enum BinAlignment {

	}
	export enum BindCoordinate {

	}
	export enum BoxAlignment {

	}
	export enum ButtonState {

	}
	export enum ContentRepeat {

	}
	export enum ContentGravity {

	}
	export enum DragAxis {

	}
	export enum DrawDebugFlag {

	}
	export enum DebugFlag {

	}
	export enum EventType {
		NOTHING = 0,
		KEY_PRESS = 1,
		KEY_RELEASE = 2,
		MOTION = 3,
		ENTER = 4,
		LEAVE = 5,
		BUTTON_PRESS = 6,
		BUTTON_RELEASE = 7,
		SCROLL = 8,
		STAGE_STATE = 9,
		DESTROY_NOTIFY = 10,
		CLIENT_MESSAGE = 11,
		TOUCH_BEGIN = 12,
		TOUCH_UPDATE = 13,
		TOUCH_END = 14,
		TOUCH_CANCEL = 15,
		TOUCHPAD_PINCH = 16,
		TOUCHPAD_SWIPE = 17,
		PROXIMITY_IN = 18,
		PROXIMITY_OUT = 19,
		PAD_BUTTON_PRESS = 20,
		PAD_BUTTON_RELEASE = 21,
		PAD_STRIP = 22,
		PAD_RING = 23,
		DEVICE_ADDED = 24,
		DEVICE_REMOVED = 25,
		IM_COMMIT = 26,
		IM_DELETE = 27,
		IM_PREEDIT = 28,
		EVENT_LAST = 29
	}
	export enum FeatureFlags {

	}
	export enum FlowOrientation {

	}
	export enum FrameResult {

	}
	export enum GestureTriggerEdge {

	}
	export enum Gravity {

	}
	export enum GridPosition {

	}
	export enum ImageError {

	}
	export enum InitError {

	}
	export enum InputAxis {

	}
	export enum InputContentPurpose {

	}
	export enum InputDeviceMapping {

	}
	export enum InputDevicePadSource {

	}
	export enum InputDeviceToolType {

	}
	export enum InputDeviceType {

	}
	export enum InputMode {

	}
	export enum InputPanelState {

	}
	export enum Interpolation {

	}
	export enum KeyState {

	}
	export enum LongPressState {

	}

	/** Masks applied to a ClutterEvent by modifiers */
	export enum ModifierType {
		SHIFT_MASK = 1,
		LOCK_MASK = 2,
		CONTROL_MASK = 4,
		MOD1_MASK = 8,
		MOD2_MASK = 16,
		MOD3_MASK = 32,
		MOD4_MASK = 64,
		MOD5_MASK = 128,
		BUTTON1_MASK = 256,
		BUTTON2_MASK = 512,
		BUTTON3_MASK = 1024,
		BUTTON4_MASK = 2048,
		BUTTON5_MASK = 4096,
		MODIFIER_RESERVED_13_MASK = 8192,
		MODIFIER_RESERVED_14_MASK = 16384,
		MODIFIER_RESERVED_15_MASK = 32768,
		MODIFIER_RESERVED_16_MASK = 65536,
		MODIFIER_RESERVED_17_MASK = 131072,
		MODIFIER_RESERVED_18_MASK = 262144,
		MODIFIER_RESERVED_19_MASK = 524288,
		MODIFIER_RESERVED_20_MASK = 1048576,
		MODIFIER_RESERVED_21_MASK = 2097152,
		MODIFIER_RESERVED_22_MASK = 4194304,
		MODIFIER_RESERVED_23_MASK = 8388608,
		MODIFIER_RESERVED_24_MASK = 16777216,
		MODIFIER_RESERVED_25_MASK = 33554432,
		SUPER_MASK = 67108864,
		HYPER_MASK = 134217728,
		META_MASK = 268435456,
		MODIFIER_RESERVED_29_MASK = 536870912,
		RELEASE_MASK = 1073741824,
		MODIFIER_MASK = 1543512063,
	}

	export enum Orientation {
		HORIZONTAL,
		VERTICAL
	}
	export enum OffscreenRedirect {

	}
	export enum PaintFlag {

	}
	export enum PanAxis {

	}
	export enum PickDebugFlag {

	}
	export enum PathNodeType {

	}
	export enum PickMode {

	}
	export enum PointerA11yDwellClickType {

	}
	export enum PointerA11yDwellDirection {

	}
	export enum PointerA11yDwellMode {

	}
	export enum PointerA11yTimeoutType {

	}
	export enum RequestMode {

	}
	export enum RepaintFlags {

	}
	export enum RotateAxis {

	}
	export enum RotateDirection {

	}
	export enum ScalingFilter {

	}
	export enum ScriptError {

	}
	export enum ScrollDirection {
		DOWN,
		LEFT,
		RIGHT,
		SMOOTH,
		UP
	}
	export enum ScrollSource {

	}
	export enum ShaderType {

	}
	export enum SnapEdge {

	}
	export enum StaticColor {

	}
	export enum StepMode {

	}
	export enum TextDirection {
		/** Use the default setting, as returned 
		 * by Clutter.get_default_text_direction  */
		DEFAULT = 0,
		/** Use left-to-right text direction */
		LTR = 1,
		/** Use right-to-left text direction */
		RTL = 2

	}
	export enum TextureQuality {

	}
	export enum TimelineDirection {

	}
	export enum TouchpadGesturePhase {

	}
	export enum Units {

	}
	export enum UnitType {

	}
	export enum ZoomAxis {

	}

	// INTERFACES and Types

	export type ActorCreateChildFunc = Function;

	export interface Coords {
		x: number;
		y: number;
	}

	export interface Clip {
		/** return location for the X offset of
		 * the clip rectangle, or null */
		xoff: number;
		/** return location for the Y offset of
		 * the clip rectangle, or null */
		yoff: number;
		/** return location for the width of
		 * the clip rectangle, or null */
		width: number;
		/** return location for the height of
		 * the clip rectangle, or null */
		height: number;
	}

	export interface ContentScalingFilters {
		/**  return location for the minification
		 * filter, or null */
		min_filter: ScalingFilter;
		/** return location for the magnification
		 * filter, or null */
		mag_filter: ScalingFilter;
	}

	export interface FixedPosition {
		/** true if the fixed position is set, false if it isn't */
		ok: boolean;
		/** return location for the X coordinate, or null */
		x: number;
		/** return location for the Y coordinate, or null */
		y: number;
	}

	export interface PaintBoxResult {
		/** true if a 2D paint box could be determined, else
		 * false. */
		ok: boolean;
		/** return location for a Clutter.ActorBox */
		box: ActorBox;
	}

	export interface PivotPointResult {
		/** return location for the normalized X
		coordinate of the pivot point, or null */
		pivot_x: number;
		/** return location for the normalized Y
		coordinate of the pivot point, or null */
		pivot_y: number;
	}

	export interface PositionResult {
		/** return location for the X coordinate, or null */
		x: number;
		/** return location for the Y coordinate, or null */
		y: number;
	}

	export interface Perspective {
		fovy: number;
		aspect: number;
		z_near: number;
		z_far: number;
	}

	// FUNCTIONS


	export function actor_box_alloc(): any;
	export function base_init(): any;
	/**
	 * Utility function to clear a Cairo context.
	 * @param cr 
	 */
	export function cairo_clear(cr: cairo.Context): void;
	/**
	 * Utility function for setting the source color of cr using
	 * a Clutter.Color. This function is the equivalent of:

		`cairo_set_source_rgba (cr, color->red / 255.0, color->green / 255.0, color->blue / 255.0, color->alpha / 255.0);`
	 * @param cr 
	 * @param color 
	 */
	export function cairo_set_source_color(cr: cairo.Context, color: Color): void;
	export function color_from_hls(): any;
	export function color_from_pixel(): any;
	export function color_from_string(): any;
	export function color_get_static(): any;
	export function container_class_find_child_property(): any;
	export function container_class_list_child_properties(): any;
	/**
	 * Disable loading the accessibility support. It has the same effect
	 * as setting the environment variable
	 * CLUTTER_DISABLE_ACCESSIBILITY. For the same reason, this method
	 * should be called before Clutter.init.
	 */
	export function disable_accessibility(): void;
	/**
	 * Processes an event.

	 * The event must be a valid Clutter.Event and have a Clutter.Stage
	 * associated to it.
	 * 
	 * This function is only useful when embedding Clutter inside another
	 * toolkit, and it should never be called by applications.
	 * @param event 
	 */
	export function do_event(event: Event): void;
	export function event_add_filter(): any;
	export function event_get(): any;
	export function event_peek(): any;
	export function event_remove_filter(): any;
	/**
	 * Checks if events are pending in the event queue.
	 * @returns TRUE if there are pending events, FALSE otherwise.
	 */
	export function events_pending(): boolean;
	/**
	 * Checks whether feature is available. feature can be a logical
	 * OR of Clutter.FeatureFlags.
	 * @param feature 
	 * @returns true if a feature is available
	 */
	export function feature_available(feature: FeatureFlags): boolean;
	/**
	 * Returns all the supported features.
	 * @returns a logical OR of all the supported features.
	 */
	export function feature_get_all(): FeatureFlags;
	/**
	 * Returns whether Clutter has accessibility support enabled. As
	 * least, a value of TRUE means that there are a proper AtkUtil
	 * implementation available
	 * @returns true if Clutter has accessibility support enabled
	 */
	export function get_accessibility_enabled(): boolean;
	/**
	 * If an event is currently being processed, return that event.
	 * This function is intended to be used to access event state
	 * that might not be exposed by higher-level widgets. For
	 * example, to get the key modifier state from a Button 'clicked'
	 * event.
	 * @returns  The current ClutterEvent, or null if none
	 */
	export function get_current_event(): Event;
	/**
	 * Retrieves the timestamp of the last event, if there is an
	 * event or if the event has a timestamp.
	 * @returns the event timestamp, or %CLUTTER_CURRENT_TIME
	 */
	export function get_current_event_time(): number;
	/**
	 * Retrieves the default Clutter.Backend used by Clutter. The
	 * Clutter.Backend holds backend-specific configuration options.
	 * @returns  the default backend. You should
	 * not ref or unref the returned object. Applications should rarely
	 * need to use this.
	 */
	export function get_default_backend(): Backend;
	/**
	 * Retrieves the default frame rate. See clutter_set_default_frame_rate().
	 * @returns the default frame rate
	 */
	export function get_default_frame_rate(): number;
	/**
	 * Retrieves the default direction for the text. The text direction is
	 * determined by the locale and/or by the CLUTTER_TEXT_DIRECTION
	 * environment variable.
	 * 
	 * The default text direction can be overridden on a per-actor basis by using
	 * Clutter.Actor.set_text_direction.
	 */
	export function get_default_text_direction(): TextDirection;
	/**
	 * Retrieves the Pango.FontMap instance used by Clutter.
	 * You can use the global font map object with the COGL
	 * Pango API.
	 * @returns the Pango.FontMap instance. The returned
	 * value is owned by Clutter and it should never be unreferenced.
	 */
	export function get_font_map(): Pango.FontMap;
	/**
	 * Retrieves the Clutter script id, if any
	 * @param gobject 
	 * @returns the script id, or null if @object was not defined inside
	 * a UI definition file. The returned string is owned by the object and
	 * should never be modified or freed.
	 */
	export function get_script_id(gobject: GObject.Object): string;

	/**
	 * Grabs pointer events, after the grab is done all pointer related events
	 * (press, motion, release, enter, leave and scroll) are delivered to this
	 * actor directly without passing through both capture and bubble phases of
	 * the event delivery chain. The source set in the event will be the actor
	 * that would have received the event if the pointer grab was not in effect.
	 * 
	 * Grabs completely override the entire event delivery chain
	 * done by Clutter. Pointer grabs should only be used as a last resource;
	 * using the Clutter.Actor.captured-event signal should always be the
	 * preferred way to intercept event delivery to reactive actors.
	 * 
	 * This function should rarely be used.
	 * 
	 * If a grab is required, you are strongly encouraged to use a specific
	 * input device by calling Clutter.InputDevice.grab.
	 * 
	 * @param actor a Clutter.Actor
	 */
	export function grab_pointer(actor: Actor): void

	export function image_error_quark(): any;
	/**
	 * Initialises everything needed to operate with Clutter and parses some
	 * standard command line options; argc and argv are adjusted accordingly
	 * so your own code will never see those standard arguments.
	 * 
	 * It is safe to call this function multiple times.
	 * 
	 * This function will not abort in case of errors during
	 * initialization; Clutter.init will print out the error message on
	 * stderr, and will return an error code. It is up to the application
	 * code to handle this case. If you need to display the error message
	 * yourself, you can use Clutter.init_with_args, which takes a GLib.Error
	 * pointer.
	 * 
	 * If this function fails, and returns an error code, any subsequent
	 * Clutter API will have undefined behaviour - including segmentation
	 * faults and assertion failures. Make sure to handle the returned
	 * Clutter.InitError enumeration value.
	 * @param argv A pointer to an array
	 * of arguments.
	 * @returns :
	 * - return_value (Clutter.InitError) — a Clutter.InitError value
	 * - argv (Array(String)) — A pointer to an array
	 * of arguments.
	 */
	export function init(argv: string[]): any[];
	export function init_error_quark(): any;
	/**
	 * This function does the same work as Clutter.init. Additionally,
	 * it allows you to add your own command line options, and it
	 * automatically generates nicely formatted <option>--help</option>
	 * output. Note that your program will be terminated after writing
	 * out the help output. Also note that, in case of error, the
	 * error message will be placed inside @error instead of being
	 * printed on the display.
	 * 
	 * Just like Clutter.init, if this function returns an error code then
	 * any subsequent call to any other Clutter API will result in undefined
	 * behaviour - including segmentation faults.
	 * @param argv  a pointer to the array
	 * of command line arguments
	 * @param parameter_string a string which is displayed in the
	 * first line of <option>--help</option> output, after
	 * <literal><replaceable>programname</replaceable> [OPTION...]</literal>
	 * @param entries  a null terminated array of
	 * GLib.OptionEntry<!-- -->s describing the options of your program
	 * @param translation_domain a translation domain to use for
	 * translating the <option>--help</option> output for the options in
	 * entries with gettext(), or null
	 * @returns :
	 * - return_value (Clutter.InitError) — Clutter.InitError.SUCCESS if Clutter has been successfully
	 * initialised, or other values or Clutter.InitError in case of error.
	 * - argv (Array(String)) — a pointer to the array
	 * of command line arguments
	 */
	export function init_with_args(argv: string[], parameter_string: string, entries: GLib.OptionEntry[], translation_domain: string): any[];
	/**
	 * Converts keyval from a Clutter key symbol to the corresponding
	 * ISO10646 (Unicode) character.
	 * @param keyval a key symbol
	 * @returns a Unicode character, or 0 if there is no corresponding
	 * character.
	 */
	export function keysym_to_unicode(keyval: number): number;
	/**
	 * Allocates enough memory to hold a Clutter.Matrix.
	 * @returns the newly allocated Clutter.Matrix
	 */
	export function matrix_alloc(): Matrix;
	/**
	 * Frees the memory allocated by Clutter.matrix_alloc.
	 * @param matrix 
	 */
	export function matrix_free(matrix: Matrix): void;
	/**
	 * 
	 */
	export function matrix_get_type(): GObject.Type;
	/**
	 * Initializes matrix with the contents of a C array of floating point
	 * values.
	 * @param matrix 
	 * @param values a C array of 16 floating point values,
	 * representing a 4x4 matrix, with column-major order
	 * @returns the initialized Clutter.Matrix
	 */
	export function matrix_init_from_array(matrix: Matrix, values: number[]): Matrix;
	/**
	 * Initializes the Clutter.Matrix a with the contents of the
	 * Clutter.Matrix b.
	 * @param a the Clutter.Matrix to initialize
	 * @param b the Clutter.Matrix to copy
	 * @returns the initialized Clutter.Matrix
	 */
	export function matrix_init_from_matrix(a: Matrix, b: Matrix): Matrix;
	/**
	 * Initializes matrix with the identity matrix, i.e.:
	```
  .xx = 1.0, .xy = 0.0, .xz = 0.0, .xw = 0.0
  .yx = 0.0, .yy = 1.0, .yz = 0.0, .yw = 0.0
  .zx = 0.0, .zy = 0.0, .zz = 1.0, .zw = 0.0
  .wx = 0.0, .wy = 0.0, .wz = 0.0, .ww = 1.0
  ```
	 * @param matrix a Clutter.Matrix
	 * @returns the initialized Clutter.Matrix
	 */
	export function matrix_init_identity(matrix: Matrix): Matrix;
	export function script_error_quark(): any;
	export function set_custom_backend_func(func: void): void;
	/**
	 * Adds a function to be called whenever there are no higher priority
	 * events pending. If the function returns false it is automatically
	 * removed from the list of event sources and will not be called again.
	 * 
	 * This function can be considered a thread-safe variant of GLib.idle_add:
	 * it will call @function while holding the Clutter lock. It is logically
	 * equivalent to the following implementation:

		```
		static gboolean
		idle_safe_callback (gpointer data)
		{
		SafeClosure *closure = data;
		gboolean res = FALSE;

		// the callback does not need to acquire the Clutter
			/ lock itself, as it is held by the this proxy handler
			//
		res = closure->callback (closure->data);

		return res;
		}
		static gulong
		add_safe_idle (GSourceFunc callback,
					gpointer    data)
		{
		SafeClosure *closure = g_new0 (SafeClosure, 1);

		closure->callback = callback;
		closure->data = data;

		return g_idle_add_full (G_PRIORITY_DEFAULT_IDLE,
								idle_safe_callback,
								closure,
								g_free)
		}
		```
			* This function should be used by threaded applications to make sure that func is emitted under the Clutter threads lock and invoked from the same thread that started the Clutter main loop. For instance, it can be used to update the UI using the results from a worker thread:

		```
		static gboolean
		update_ui (gpointer data)
		{
		SomeClosure *closure = data;

		// it is safe to call Clutter API from this function because
		/ it is invoked from the same thread that started the main
		/ loop and under the Clutter thread lock
		//
		clutter_label_set_text (CLUTTER_LABEL (closure->label),
								closure->text);

		g_object_unref (closure->label);
		g_free (closure);

		return FALSE;
		}

		// within another thread //
		closure = g_new0 (SomeClosure, 1);
		// always take a reference on GObject instances //
		closure->label = g_object_ref (my_application->label);
		closure->text = g_strdup (processed_text_to_update_the_label);

		clutter_threads_add_idle_full (G_PRIORITY_HIGH_IDLE,
										update_ui,
										closure,
										NULL);
										```
	 * @param priority the priority of the timeout source. Typically this will be in the
	 * range between #G_PRIORITY_DEFAULT_IDLE and #G_PRIORITY_HIGH_IDLE
	 * @param func function to call
	 * @returns  the ID (greater than 0) of the event source.
	 */
	export function threads_add_idle(priority: number, func: GLib.SourceFunc): number;
	/**
	 * Adds a function to be called whenever Clutter is processing a new
	 * frame.
	 * 
	 * If the function returns false it is automatically removed from the
	 * list of repaint functions and will not be called again.
	 * 
	 * This function is guaranteed to be called from within the same thread
	 * that called clutter_main(), and while the Clutter lock is being held;
	 * the function will be called within the main loop, so it is imperative
	 * that it does not block, otherwise the frame time budget may be lost.
	 * 
	 * A repaint function is useful to ensure that an update of the scenegraph
	 * is performed before the scenegraph is repainted. By default, a repaint
	 * function added using this function will be invoked prior to the frame
	 * being processed.
	 * 
	 * Adding a repaint function does not automatically ensure that a new
	 * frame will be queued.
	 * 
	 * When the repaint function is removed (either because it returned false
	 * or because Clutter.threads_remove_repaint_func has been called) the
	 * notify function will be called, if any is set.
	 * 
	 * See also: Clutter.threads_add_repaint_func_full
	 * @param func the function to be called within the paint cycle
	 * @returns the ID (greater than 0) of the repaint function. You
	 * can use the returned integer to remove the repaint function by
	 * calling Clutter.threads_remove_repaint_func.
	 */
	export function threads_add_repaint_func(func: GLib.SourceFunc): number;
	/**
	 * Adds a function to be called whenever Clutter is processing a new
	 * frame.
		 * 
	 * If the function returns false it is automatically removed from the
	 * list of repaint functions and will not be called again.
		 * 
	 * This function is guaranteed to be called from within the same thread
	 * that called clutter_main(), and while the Clutter lock is being held;
	 * the function will be called within the main loop, so it is imperative
	 * that it does not block, otherwise the frame time budget may be lost.
		 * 
	 * A repaint function is useful to ensure that an update of the scenegraph
	 * is performed before the scenegraph is repainted. The flags passed to this
	 * function will determine the section of the frame processing that will
	 * result in func being called.
		 * 
	 * Adding a repaint function does not automatically ensure that a new
	 * frame will be queued.
		 * 
	 * When the repaint function is removed (either because it returned false
	 * or because Clutter.threads_remove_repaint_func has been called) the
	 * notify function will be called, if any is set.
	 * @param flags flags for the repaint function
	 * @param func the function to be called within the paint cycle
	 * @returns the ID (greater than 0) of the repaint function. You
	 * can use the returned integer to remove the repaint function by
	 * calling Clutter.threads_remove_repaint_func.
	 */
	export function threads_add_repaint_func_full(flags: RepaintFlags, func: GLib.SourceFunc): number;
	/**
	 * Sets a function to be called at regular intervals holding the Clutter
	 * threads lock, with the given priority. The function is called repeatedly
	 * until it returns false, at which point the timeout is automatically
	 * removed and the function will not be called again. The notify function
	 * is called when the timeout is removed.
		 * 
	 * The first call to the function will be at the end of the first interval.
		 * 
	 * It is important to note that, due to how the Clutter main loop is
	 * implemented, the timing will not be accurate and it will not try to
	 * "keep up" with the interval.
		 * 
	 * See also Clutter.threads_add_idle.
	 * @param priority the priority of the timeout source. Typically this will be in the
	 * range between #G_PRIORITY_DEFAULT and #G_PRIORITY_HIGH.
	 * @param interval the time between calls to the function, in milliseconds
	 * @param func function to call
	 * @returns the ID (greater than 0) of the event source.
	 */
	export function threads_add_timeout(priority: number, interval: number, func: GLib.SourceFunc): number;
	/**
	 * Removes the repaint function with handle_id as its id
	 * @param handle_id an unsigned integer greater than zero
	 */
	export function threads_remove_repaint_func(handle_id: number): void;
	/**
	 * Removes an existing grab of the pointer.
	 */
	export function ungrab_pointer(): void
	/**
	 * Convert from a ISO10646 character to a key symbol.
	 * @param wc a ISO10646 encoded character
	 * @returns the corresponding Clutter key symbol, if one exists.
	 * or, if there is no corresponding symbol, wc | 0x01000000
	 */
	export function unicode_to_keysym(wc: number): number;
	export function units_from_cm(): any;
	export function units_from_em(): any;
	export function units_from_em_for_font(): any;
	export function units_from_mm(): any;
	export function units_from_pixels(): any;
	export function units_from_pt(): any;
	export function units_from_string(): any;
	/**
	 * Retrieves a pointer to the Clutter.PaintNode contained inside
	 * the passed GObject.Value, and if not null it will increase the
	 * reference count.
	 * @param value a GObject.Value initialized with %CLUTTER_TYPE_PAINT_NODE
	 * @returns a pointer
	 * to the Clutter.PaintNode, with its reference count increased,
	 * or null
	 */
	export function value_dup_paint_node(value: any): PaintNode;
	/**
	 * Gets the Clutter.Color contained in value.
	 * @param value  a GObject.Value initialized to #CLUTTER_TYPE_COLOR
	 * @returns the color inside the passed GObject.Value
	 */
	export function value_get_color(value: any): Color;
	/**
	 * Retrieves a pointer to the Clutter.PaintNode contained inside
	 * the passed GObject.Value.
	 * @param value  a GObject.Value initialized with %CLUTTER_TYPE_PAINT_NODE
	 * @returns a pointer to
	 * a Clutter.PaintNode, or null
	 */
	export function value_get_paint_node(value: any): PaintNode;
	/**
	 * Retrieves the list of floating point values stored inside
	 * the passed GObject.Value. value must have been initialized with
	 * %CLUTTER_TYPE_SHADER_FLOAT.
	 * @param value a GObject.Value
	 * @returns :
	 * - return_value (Array(Number)) — the pointer to a list of
	 * floating point values. The returned value is owned by the
	 * - GObject.Value and should never be modified or freed.
	 * length (Number) — return location for the number of returned floating
	 * point values, or null
	 */
	export function value_get_shader_float(value: any): number[];
	/**
	 * Retrieves the list of integer values stored inside
	 * the passed GObject.Value. value must have been initialized with
	 * %CLUTTER_TYPE_SHADER_INT.
	 * @param value a GObject.Value
	 * @returns :
	 * - return_value (Array(Number)) — the pointer to a list of
	 * integer values. The returned value is owned by the
	 * - GObject.Value and should never be modified or freed.
	 * length (Number) — return location for the number of returned integer
	 * values, or null
	 */
	export function value_get_shader_int(value: any): number[];
	/**
	 * Retrieves a matrix of floating point values stored inside
	 * the passed GObject.Value. value must have been initialized with
	 * %CLUTTER_TYPE_SHADER_MATRIX.
	 * @param value a GObject.Value
	 * @returns :
	 * - return_value (Array(Number)) — the pointer to a matrix
	 * of floating point values. The returned value is owned by the GObject.Value and
	 * - should never be modified or freed.
	 * length (Number) — return location for the number of returned floating
	 * point values, or null
	 */
	export function value_get_shader_matrix(value: any): number[];
	/**
	 * Gets the Clutter.Units contained in value.
	 * @param value a GObject.Value initialized to %CLUTTER_TYPE_UNITS
	 * @returns  the units inside the passed GObject.Value
	 */
	export function value_get_units(value: any): Units;
	/**
	 * Sets value to color.
	 * @param value a GObject.Value initialized to #CLUTTER_TYPE_COLOR
	 * @param color the color to set
	 */
	export function value_set_color(value: any, color: Color): void;
	/**
	 * Sets the contents of a GObject.Value initialized with %CLUTTER_TYPE_PAINT_NODE.

	 * This function increased the reference count of node; if you do not wish
	 * to increase the reference count, use Clutter.value_take_paint_node
	 * instead. The reference count will be released by GObject.Value.
	 * @param value a GObject.Value initialized with %CLUTTER_TYPE_PAINT_NODE
	 * @param node a Clutter.PaintNode, or null
	 */
	export function value_set_paint_node(value: any, node: PaintNode): void;
	/**
	 * Sets floats as the contents of value. The passed GObject.Value
	 * must have been initialized using %CLUTTER_TYPE_SHADER_FLOAT.
	 * @param value a GObject.Value
	 * @param floats an array of floating point values
	 */
	export function value_set_shader_float(value: any, floats: number[]): void;
	/**
	 * Sets ints as the contents of value. The passed GObject.Value
	 * must have been initialized using %CLUTTER_TYPE_SHADER_INT.
	 * @param value a GObject.Value
	 * @param ints an array of integer values
	 */
	export function value_set_shader_int(value: any, ints: number[]): void;
	/**
	 * Sets matrix as the contents of value. The passed GObject.Value
	 * must have been initialized using %CLUTTER_TYPE_SHADER_MATRIX.
	 * @param value a GObject.Value
	 * @param matrix  a matrix of floating point values
	 */
	export function value_set_shader_matrix(value: any, matrix: number[]): void;
	/**
	 * Sets value to units
	 * @param value a GObject.Value initialized to %CLUTTER_TYPE_UNITS
	 * @param units the units to set
	 */
	export function value_set_units(value: any, units: Units): void;
	/**
	 * Sets the contents of a GObject.Value initialized with %CLUTTER_TYPE_PAINT_NODE.

	 * Unlike Clutter.value_set_paint_node, this function will not take a
	 * reference on the passed node: instead, it will take ownership of the
	 * current reference count.
	 * @param value a GObject.Value, initialized with %CLUTTER_TYPE_PAINT_NODE
	 * @param node  a Clutter.PaintNode, or null
	 */
	export function value_take_paint_node(value: any, node: PaintNode): void;


	// CONSTS

	const BUTTON_MIDDLE: number;
	const BUTTON_PRIMARY: number;
	const BUTTON_SECONDARY: number;
	const COGL: number;
	const CURRENT_TIME: number;
	const EVENT_PROPAGATE: number;
	const EVENT_STOP: number;
	const FLAVOUR: number;
	const HAS_WAYLAND_COMPOSITOR_SUPPORT: number;
	const INPUT_EVDEV: number;
	const INPUT_NULL: number;
	const INPUT_X11: number;
	const KEY_0: number;
	const KEY_1: number;
	const KEY_2: number;
	const KEY_3: number;
	const KEY_3270_AltCursor: number;
	const KEY_3270_Attn: number;
	const KEY_3270_BackTab: number;
	const KEY_3270_ChangeScreen: number;
	const KEY_3270_Copy: number;
	const KEY_3270_CursorBlink: number;
	const KEY_3270_CursorSelect: number;
	const KEY_3270_DeleteWord: number;
	const KEY_3270_Duplicate: number;
	const KEY_3270_Enter: number;
	const KEY_3270_EraseEOF: number;
	const KEY_3270_EraseInput: number;
	const KEY_3270_ExSelect: number;
	const KEY_3270_FieldMark: number;
	const KEY_3270_Ident: number;
	const KEY_3270_Jump: number;
	const KEY_3270_KeyClick: number;
	const KEY_3270_Left2: number;
	const KEY_3270_PA1: number;
	const KEY_3270_PA2: number;
	const KEY_3270_PA3: number;
	const KEY_3270_Play: number;
	const KEY_3270_PrintScreen: number;
	const KEY_3270_Quit: number;
	const KEY_3270_Record: number;
	const KEY_3270_Reset: number;
	const KEY_3270_Right2: number;
	const KEY_3270_Rule: number;
	const KEY_3270_Setup: number;
	const KEY_3270_Test: number;
	const KEY_4: number;
	const KEY_5: number;
	const KEY_6: number;
	const KEY_7: number;
	const KEY_8: number;
	const KEY_9: number;
	const KEY_A: number;
	const KEY_AE: number;
	const KEY_Aacute: number;
	const KEY_Abelowdot: number;
	const KEY_Abreve: number;
	const KEY_Abreveacute: number;
	const KEY_Abrevebelowdot: number;
	const KEY_Abrevegrave: number;
	const KEY_Abrevehook: number;
	const KEY_Abrevetilde: number;
	const KEY_AccessX_Enable: number;
	const KEY_AccessX_Feedback_Enable: number;
	const KEY_Acircumflex: number;
	const KEY_Acircumflexacute: number;
	const KEY_Acircumflexbelowdot: number;
	const KEY_Acircumflexgrave: number;
	const KEY_Acircumflexhook: number;
	const KEY_Acircumflextilde: number;
	const KEY_AddFavorite: number;
	const KEY_Adiaeresis: number;
	const KEY_Agrave: number;
	const KEY_Ahook: number;
	const KEY_Alt_L: number;
	const KEY_Alt_R: number;
	const KEY_Amacron: number;
	const KEY_Aogonek: number;
	const KEY_ApplicationLeft: number;
	const KEY_ApplicationRight: number;
	const KEY_Arabic_0: number;
	const KEY_Arabic_1: number;
	const KEY_Arabic_2: number;
	const KEY_Arabic_3: number;
	const KEY_Arabic_4: number;
	const KEY_Arabic_5: number;
	const KEY_Arabic_6: number;
	const KEY_Arabic_7: number;
	const KEY_Arabic_8: number;
	const KEY_Arabic_9: number;
	const KEY_Arabic_ain: number;
	const KEY_Arabic_alef: number;
	const KEY_Arabic_alefmaksura: number;
	const KEY_Arabic_beh: number;
	const KEY_Arabic_comma: number;
	const KEY_Arabic_dad: number;
	const KEY_Arabic_dal: number;
	const KEY_Arabic_damma: number;
	const KEY_Arabic_dammatan: number;
	const KEY_Arabic_ddal: number;
	const KEY_Arabic_farsi_yeh: number;
	const KEY_Arabic_fatha: number;
	const KEY_Arabic_fathatan: number;
	const KEY_Arabic_feh: number;
	const KEY_Arabic_fullstop: number;
	const KEY_Arabic_gaf: number;
	const KEY_Arabic_ghain: number;
	const KEY_Arabic_ha: number;
	const KEY_Arabic_hah: number;
	const KEY_Arabic_hamza: number;
	const KEY_Arabic_hamza_above: number;
	const KEY_Arabic_hamza_below: number;
	const KEY_Arabic_hamzaonalef: number;
	const KEY_Arabic_hamzaonwaw: number;
	const KEY_Arabic_hamzaonyeh: number;
	const KEY_Arabic_hamzaunderalef: number;
	const KEY_Arabic_heh: number;
	const KEY_Arabic_heh_doachashmee: number;
	const KEY_Arabic_heh_goal: number;
	const KEY_Arabic_jeem: number;
	const KEY_Arabic_jeh: number;
	const KEY_Arabic_kaf: number;
	const KEY_Arabic_kasra: number;
	const KEY_Arabic_kasratan: number;
	const KEY_Arabic_keheh: number;
	const KEY_Arabic_khah: number;
	const KEY_Arabic_lam: number;
	const KEY_Arabic_madda_above: number;
	const KEY_Arabic_maddaonalef: number;
	const KEY_Arabic_meem: number;
	const KEY_Arabic_noon: number;
	const KEY_Arabic_noon_ghunna: number;
	const KEY_Arabic_peh: number;
	const KEY_Arabic_percent: number;
	const KEY_Arabic_qaf: number;
	const KEY_Arabic_question_mark: number;
	const KEY_Arabic_ra: number;
	const KEY_Arabic_rreh: number;
	const KEY_Arabic_sad: number;
	const KEY_Arabic_seen: number;
	const KEY_Arabic_semicolon: number;
	const KEY_Arabic_shadda: number;
	const KEY_Arabic_sheen: number;
	const KEY_Arabic_sukun: number;
	const KEY_Arabic_superscript_alef: number;
	const KEY_Arabic_switch: number;
	const KEY_Arabic_tah: number;
	const KEY_Arabic_tatweel: number;
	const KEY_Arabic_tcheh: number;
	const KEY_Arabic_teh: number;
	const KEY_Arabic_tehmarbuta: number;
	const KEY_Arabic_thal: number;
	const KEY_Arabic_theh: number;
	const KEY_Arabic_tteh: number;
	const KEY_Arabic_veh: number;
	const KEY_Arabic_waw: number;
	const KEY_Arabic_yeh: number;
	const KEY_Arabic_yeh_baree: number;
	const KEY_Arabic_zah: number;
	const KEY_Arabic_zain: number;
	const KEY_Aring: number;
	const KEY_Armenian_AT: number;
	const KEY_Armenian_AYB: number;
	const KEY_Armenian_BEN: number;
	const KEY_Armenian_CHA: number;
	const KEY_Armenian_DA: number;
	const KEY_Armenian_DZA: number;
	const KEY_Armenian_E: number;
	const KEY_Armenian_FE: number;
	const KEY_Armenian_GHAT: number;
	const KEY_Armenian_GIM: number;
	const KEY_Armenian_HI: number;
	const KEY_Armenian_HO: number;
	const KEY_Armenian_INI: number;
	const KEY_Armenian_JE: number;
	const KEY_Armenian_KE: number;
	const KEY_Armenian_KEN: number;
	const KEY_Armenian_KHE: number;
	const KEY_Armenian_LYUN: number;
	const KEY_Armenian_MEN: number;
	const KEY_Armenian_NU: number;
	const KEY_Armenian_O: number;
	const KEY_Armenian_PE: number;
	const KEY_Armenian_PYUR: number;
	const KEY_Armenian_RA: number;
	const KEY_Armenian_RE: number;
	const KEY_Armenian_SE: number;
	const KEY_Armenian_SHA: number;
	const KEY_Armenian_TCHE: number;
	const KEY_Armenian_TO: number;
	const KEY_Armenian_TSA: number;
	const KEY_Armenian_TSO: number;
	const KEY_Armenian_TYUN: number;
	const KEY_Armenian_VEV: number;
	const KEY_Armenian_VO: number;
	const KEY_Armenian_VYUN: number;
	const KEY_Armenian_YECH: number;
	const KEY_Armenian_ZA: number;
	const KEY_Armenian_ZHE: number;
	const KEY_Armenian_accent: number;
	const KEY_Armenian_amanak: number;
	const KEY_Armenian_apostrophe: number;
	const KEY_Armenian_at: number;
	const KEY_Armenian_ayb: number;
	const KEY_Armenian_ben: number;
	const KEY_Armenian_but: number;
	const KEY_Armenian_cha: number;
	const KEY_Armenian_da: number;
	const KEY_Armenian_dza: number;
	const KEY_Armenian_e: number;
	const KEY_Armenian_exclam: number;
	const KEY_Armenian_fe: number;
	const KEY_Armenian_full_stop: number;
	const KEY_Armenian_ghat: number;
	const KEY_Armenian_gim: number;
	const KEY_Armenian_hi: number;
	const KEY_Armenian_ho: number;
	const KEY_Armenian_hyphen: number;
	const KEY_Armenian_ini: number;
	const KEY_Armenian_je: number;
	const KEY_Armenian_ke: number;
	const KEY_Armenian_ken: number;
	const KEY_Armenian_khe: number;
	const KEY_Armenian_ligature_ew: number;
	const KEY_Armenian_lyun: number;
	const KEY_Armenian_men: number;
	const KEY_Armenian_nu: number;
	const KEY_Armenian_o: number;
	const KEY_Armenian_paruyk: number;
	const KEY_Armenian_pe: number;
	const KEY_Armenian_pyur: number;
	const KEY_Armenian_question: number;
	const KEY_Armenian_ra: number;
	const KEY_Armenian_re: number;
	const KEY_Armenian_se: number;
	const KEY_Armenian_separation_mark: number;
	const KEY_Armenian_sha: number;
	const KEY_Armenian_shesht: number;
	const KEY_Armenian_tche: number;
	const KEY_Armenian_to: number;
	const KEY_Armenian_tsa: number;
	const KEY_Armenian_tso: number;
	const KEY_Armenian_tyun: number;
	const KEY_Armenian_verjaket: number;
	const KEY_Armenian_vev: number;
	const KEY_Armenian_vo: number;
	const KEY_Armenian_vyun: number;
	const KEY_Armenian_yech: number;
	const KEY_Armenian_yentamna: number;
	const KEY_Armenian_za: number;
	const KEY_Armenian_zhe: number;
	const KEY_Atilde: number;
	const KEY_AudibleBell_Enable: number;
	const KEY_AudioCycleTrack: number;
	const KEY_AudioForward: number;
	const KEY_AudioLowerVolume: number;
	const KEY_AudioMedia: number;
	const KEY_AudioMicMute: number;
	const KEY_AudioMute: number;
	const KEY_AudioNext: number;
	const KEY_AudioPause: number;
	const KEY_AudioPlay: number;
	const KEY_AudioPrev: number;
	const KEY_AudioRaiseVolume: number;
	const KEY_AudioRandomPlay: number;
	const KEY_AudioRecord: number;
	const KEY_AudioRepeat: number;
	const KEY_AudioRewind: number;
	const KEY_AudioStop: number;
	const KEY_Away: number;
	const KEY_B: number;
	const KEY_Babovedot: number;
	const KEY_Back: number;
	const KEY_BackForward: number;
	const KEY_BackSpace: number;
	const KEY_Battery: number;
	const KEY_Begin: number;
	const KEY_Blue: number;
	const KEY_Bluetooth: number;
	const KEY_Book: number;
	const KEY_BounceKeys_Enable: number;
	const KEY_Break: number;
	const KEY_BrightnessAdjust: number;
	const KEY_Byelorussian_SHORTU: number;
	const KEY_Byelorussian_shortu: number;
	const KEY_C: number;
	const KEY_CD: number;
	const KEY_CH: number;
	const KEY_C_H: number;
	const KEY_C_h: number;
	const KEY_Cabovedot: number;
	const KEY_Cacute: number;
	const KEY_Calculator: number;
	const KEY_Calendar: number;
	const KEY_Cancel: number;
	const KEY_Caps_Lock: number;
	const KEY_Ccaron: number;
	const KEY_Ccedilla: number;
	const KEY_Ccircumflex: number;
	const KEY_Ch: number;
	const KEY_Clear: number;
	const KEY_ClearGrab: number;
	const KEY_Close: number;
	const KEY_Codeinput: number;
	const KEY_ColonSign: number;
	const KEY_Community: number;
	const KEY_ContrastAdjust: number;
	const KEY_Control_L: number;
	const KEY_Control_R: number;
	const KEY_Copy: number;
	const KEY_CruzeiroSign: number;
	const KEY_Cut: number;
	const KEY_CycleAngle: number;
	const KEY_Cyrillic_A: number;
	const KEY_Cyrillic_BE: number;
	const KEY_Cyrillic_CHE: number;
	const KEY_Cyrillic_CHE_descender: number;
	const KEY_Cyrillic_CHE_vertstroke: number;
	const KEY_Cyrillic_DE: number;
	const KEY_Cyrillic_DZHE: number;
	const KEY_Cyrillic_E: number;
	const KEY_Cyrillic_EF: number;
	const KEY_Cyrillic_EL: number;
	const KEY_Cyrillic_EM: number;
	const KEY_Cyrillic_EN: number;
	const KEY_Cyrillic_EN_descender: number;
	const KEY_Cyrillic_ER: number;
	const KEY_Cyrillic_ES: number;
	const KEY_Cyrillic_GHE: number;
	const KEY_Cyrillic_GHE_bar: number;
	const KEY_Cyrillic_HA: number;
	const KEY_Cyrillic_HARDSIGN: number;
	const KEY_Cyrillic_HA_descender: number;
	const KEY_Cyrillic_I: number;
	const KEY_Cyrillic_IE: number;
	const KEY_Cyrillic_IO: number;
	const KEY_Cyrillic_I_macron: number;
	const KEY_Cyrillic_JE: number;
	const KEY_Cyrillic_KA: number;
	const KEY_Cyrillic_KA_descender: number;
	const KEY_Cyrillic_KA_vertstroke: number;
	const KEY_Cyrillic_LJE: number;
	const KEY_Cyrillic_NJE: number;
	const KEY_Cyrillic_O: number;
	const KEY_Cyrillic_O_bar: number;
	const KEY_Cyrillic_PE: number;
	const KEY_Cyrillic_SCHWA: number;
	const KEY_Cyrillic_SHA: number;
	const KEY_Cyrillic_SHCHA: number;
	const KEY_Cyrillic_SHHA: number;
	const KEY_Cyrillic_SHORTI: number;
	const KEY_Cyrillic_SOFTSIGN: number;
	const KEY_Cyrillic_TE: number;
	const KEY_Cyrillic_TSE: number;
	const KEY_Cyrillic_U: number;
	const KEY_Cyrillic_U_macron: number;
	const KEY_Cyrillic_U_straight: number;
	const KEY_Cyrillic_U_straight_bar: number;
	const KEY_Cyrillic_VE: number;
	const KEY_Cyrillic_YA: number;
	const KEY_Cyrillic_YERU: number;
	const KEY_Cyrillic_YU: number;
	const KEY_Cyrillic_ZE: number;
	const KEY_Cyrillic_ZHE: number;
	const KEY_Cyrillic_ZHE_descender: number;
	const KEY_Cyrillic_a: number;
	const KEY_Cyrillic_be: number;
	const KEY_Cyrillic_che: number;
	const KEY_Cyrillic_che_descender: number;
	const KEY_Cyrillic_che_vertstroke: number;
	const KEY_Cyrillic_de: number;
	const KEY_Cyrillic_dzhe: number;
	const KEY_Cyrillic_e: number;
	const KEY_Cyrillic_ef: number;
	const KEY_Cyrillic_el: number;
	const KEY_Cyrillic_em: number;
	const KEY_Cyrillic_en: number;
	const KEY_Cyrillic_en_descender: number;
	const KEY_Cyrillic_er: number;
	const KEY_Cyrillic_es: number;
	const KEY_Cyrillic_ghe: number;
	const KEY_Cyrillic_ghe_bar: number;
	const KEY_Cyrillic_ha: number;
	const KEY_Cyrillic_ha_descender: number;
	const KEY_Cyrillic_hardsign: number;
	const KEY_Cyrillic_i: number;
	const KEY_Cyrillic_i_macron: number;
	const KEY_Cyrillic_ie: number;
	const KEY_Cyrillic_io: number;
	const KEY_Cyrillic_je: number;
	const KEY_Cyrillic_ka: number;
	const KEY_Cyrillic_ka_descender: number;
	const KEY_Cyrillic_ka_vertstroke: number;
	const KEY_Cyrillic_lje: number;
	const KEY_Cyrillic_nje: number;
	const KEY_Cyrillic_o: number;
	const KEY_Cyrillic_o_bar: number;
	const KEY_Cyrillic_pe: number;
	const KEY_Cyrillic_schwa: number;
	const KEY_Cyrillic_sha: number;
	const KEY_Cyrillic_shcha: number;
	const KEY_Cyrillic_shha: number;
	const KEY_Cyrillic_shorti: number;
	const KEY_Cyrillic_softsign: number;
	const KEY_Cyrillic_te: number;
	const KEY_Cyrillic_tse: number;
	const KEY_Cyrillic_u: number;
	const KEY_Cyrillic_u_macron: number;
	const KEY_Cyrillic_u_straight: number;
	const KEY_Cyrillic_u_straight_bar: number;
	const KEY_Cyrillic_ve: number;
	const KEY_Cyrillic_ya: number;
	const KEY_Cyrillic_yeru: number;
	const KEY_Cyrillic_yu: number;
	const KEY_Cyrillic_ze: number;
	const KEY_Cyrillic_zhe: number;
	const KEY_Cyrillic_zhe_descender: number;
	const KEY_D: number;
	const KEY_DOS: number;
	const KEY_Dabovedot: number;
	const KEY_Dcaron: number;
	const KEY_Delete: number;
	const KEY_Display: number;
	const KEY_Documents: number;
	const KEY_DongSign: number;
	const KEY_Down: number;
	const KEY_Dstroke: number;
	const KEY_E: number;
	const KEY_ENG: number;
	const KEY_ETH: number;
	const KEY_EZH: number;
	const KEY_Eabovedot: number;
	const KEY_Eacute: number;
	const KEY_Ebelowdot: number;
	const KEY_Ecaron: number;
	const KEY_Ecircumflex: number;
	const KEY_Ecircumflexacute: number;
	const KEY_Ecircumflexbelowdot: number;
	const KEY_Ecircumflexgrave: number;
	const KEY_Ecircumflexhook: number;
	const KEY_Ecircumflextilde: number;
	const KEY_EcuSign: number;
	const KEY_Ediaeresis: number;
	const KEY_Egrave: number;
	const KEY_Ehook: number;
	const KEY_Eisu_Shift: number;
	const KEY_Eisu_toggle: number;
	const KEY_Eject: number;
	const KEY_Emacron: number;
	const KEY_End: number;
	const KEY_Eogonek: number;
	const KEY_Escape: number;
	const KEY_Eth: number;
	const KEY_Etilde: number;
	const KEY_EuroSign: number;
	const KEY_Excel: number;
	const KEY_Execute: number;
	const KEY_Explorer: number;
	const KEY_F: number;
	const KEY_F1: number;
	const KEY_F10: number;
	const KEY_F11: number;
	const KEY_F12: number;
	const KEY_F13: number;
	const KEY_F14: number;
	const KEY_F15: number;
	const KEY_F16: number;
	const KEY_F17: number;
	const KEY_F18: number;
	const KEY_F19: number;
	const KEY_F2: number;
	const KEY_F20: number;
	const KEY_F21: number;
	const KEY_F22: number;
	const KEY_F23: number;
	const KEY_F24: number;
	const KEY_F25: number;
	const KEY_F26: number;
	const KEY_F27: number;
	const KEY_F28: number;
	const KEY_F29: number;
	const KEY_F3: number;
	const KEY_F30: number;
	const KEY_F31: number;
	const KEY_F32: number;
	const KEY_F33: number;
	const KEY_F34: number;
	const KEY_F35: number;
	const KEY_F4: number;
	const KEY_F5: number;
	const KEY_F6: number;
	const KEY_F7: number;
	const KEY_F8: number;
	const KEY_F9: number;
	const KEY_FFrancSign: number;
	const KEY_Fabovedot: number;
	const KEY_Farsi_0: number;
	const KEY_Farsi_1: number;
	const KEY_Farsi_2: number;
	const KEY_Farsi_3: number;
	const KEY_Farsi_4: number;
	const KEY_Farsi_5: number;
	const KEY_Farsi_6: number;
	const KEY_Farsi_7: number;
	const KEY_Farsi_8: number;
	const KEY_Farsi_9: number;
	const KEY_Farsi_yeh: number;
	const KEY_Favorites: number;
	const KEY_Finance: number;
	const KEY_Find: number;
	const KEY_First_Virtual_Screen: number;
	const KEY_Forward: number;
	const KEY_FrameBack: number;
	const KEY_FrameForward: number;
	const KEY_G: number;
	const KEY_Gabovedot: number;
	const KEY_Game: number;
	const KEY_Gbreve: number;
	const KEY_Gcaron: number;
	const KEY_Gcedilla: number;
	const KEY_Gcircumflex: number;
	const KEY_Georgian_an: number;
	const KEY_Georgian_ban: number;
	const KEY_Georgian_can: number;
	const KEY_Georgian_char: number;
	const KEY_Georgian_chin: number;
	const KEY_Georgian_cil: number;
	const KEY_Georgian_don: number;
	const KEY_Georgian_en: number;
	const KEY_Georgian_fi: number;
	const KEY_Georgian_gan: number;
	const KEY_Georgian_ghan: number;
	const KEY_Georgian_hae: number;
	const KEY_Georgian_har: number;
	const KEY_Georgian_he: number;
	const KEY_Georgian_hie: number;
	const KEY_Georgian_hoe: number;
	const KEY_Georgian_in: number;
	const KEY_Georgian_jhan: number;
	const KEY_Georgian_jil: number;
	const KEY_Georgian_kan: number;
	const KEY_Georgian_khar: number;
	const KEY_Georgian_las: number;
	const KEY_Georgian_man: number;
	const KEY_Georgian_nar: number;
	const KEY_Georgian_on: number;
	const KEY_Georgian_par: number;
	const KEY_Georgian_phar: number;
	const KEY_Georgian_qar: number;
	const KEY_Georgian_rae: number;
	const KEY_Georgian_san: number;
	const KEY_Georgian_shin: number;
	const KEY_Georgian_tan: number;
	const KEY_Georgian_tar: number;
	const KEY_Georgian_un: number;
	const KEY_Georgian_vin: number;
	const KEY_Georgian_we: number;
	const KEY_Georgian_xan: number;
	const KEY_Georgian_zen: number;
	const KEY_Georgian_zhar: number;
	const KEY_Go: number;
	const KEY_Greek_ALPHA: number;
	const KEY_Greek_ALPHAaccent: number;
	const KEY_Greek_BETA: number;
	const KEY_Greek_CHI: number;
	const KEY_Greek_DELTA: number;
	const KEY_Greek_EPSILON: number;
	const KEY_Greek_EPSILONaccent: number;
	const KEY_Greek_ETA: number;
	const KEY_Greek_ETAaccent: number;
	const KEY_Greek_GAMMA: number;
	const KEY_Greek_IOTA: number;
	const KEY_Greek_IOTAaccent: number;
	const KEY_Greek_IOTAdiaeresis: number;
	const KEY_Greek_IOTAdieresis: number;
	const KEY_Greek_KAPPA: number;
	const KEY_Greek_LAMBDA: number;
	const KEY_Greek_LAMDA: number;
	const KEY_Greek_MU: number;
	const KEY_Greek_NU: number;
	const KEY_Greek_OMEGA: number;
	const KEY_Greek_OMEGAaccent: number;
	const KEY_Greek_OMICRON: number;
	const KEY_Greek_OMICRONaccent: number;
	const KEY_Greek_PHI: number;
	const KEY_Greek_PI: number;
	const KEY_Greek_PSI: number;
	const KEY_Greek_RHO: number;
	const KEY_Greek_SIGMA: number;
	const KEY_Greek_TAU: number;
	const KEY_Greek_THETA: number;
	const KEY_Greek_UPSILON: number;
	const KEY_Greek_UPSILONaccent: number;
	const KEY_Greek_UPSILONdieresis: number;
	const KEY_Greek_XI: number;
	const KEY_Greek_ZETA: number;
	const KEY_Greek_accentdieresis: number;
	const KEY_Greek_alpha: number;
	const KEY_Greek_alphaaccent: number;
	const KEY_Greek_beta: number;
	const KEY_Greek_chi: number;
	const KEY_Greek_delta: number;
	const KEY_Greek_epsilon: number;
	const KEY_Greek_epsilonaccent: number;
	const KEY_Greek_eta: number;
	const KEY_Greek_etaaccent: number;
	const KEY_Greek_finalsmallsigma: number;
	const KEY_Greek_gamma: number;
	const KEY_Greek_horizbar: number;
	const KEY_Greek_iota: number;
	const KEY_Greek_iotaaccent: number;
	const KEY_Greek_iotaaccentdieresis: number;
	const KEY_Greek_iotadieresis: number;
	const KEY_Greek_kappa: number;
	const KEY_Greek_lambda: number;
	const KEY_Greek_lamda: number;
	const KEY_Greek_mu: number;
	const KEY_Greek_nu: number;
	const KEY_Greek_omega: number;
	const KEY_Greek_omegaaccent: number;
	const KEY_Greek_omicron: number;
	const KEY_Greek_omicronaccent: number;
	const KEY_Greek_phi: number;
	const KEY_Greek_pi: number;
	const KEY_Greek_psi: number;
	const KEY_Greek_rho: number;
	const KEY_Greek_sigma: number;
	const KEY_Greek_switch: number;
	const KEY_Greek_tau: number;
	const KEY_Greek_theta: number;
	const KEY_Greek_upsilon: number;
	const KEY_Greek_upsilonaccent: number;
	const KEY_Greek_upsilonaccentdieresis: number;
	const KEY_Greek_upsilondieresis: number;
	const KEY_Greek_xi: number;
	const KEY_Greek_zeta: number;
	const KEY_Green: number;
	const KEY_H: number;
	const KEY_Hangul: number;
	const KEY_Hangul_A: number;
	const KEY_Hangul_AE: number;
	const KEY_Hangul_AraeA: number;
	const KEY_Hangul_AraeAE: number;
	const KEY_Hangul_Banja: number;
	const KEY_Hangul_Cieuc: number;
	const KEY_Hangul_Codeinput: number;
	const KEY_Hangul_Dikeud: number;
	const KEY_Hangul_E: number;
	const KEY_Hangul_EO: number;
	const KEY_Hangul_EU: number;
	const KEY_Hangul_End: number;
	const KEY_Hangul_Hanja: number;
	const KEY_Hangul_Hieuh: number;
	const KEY_Hangul_I: number;
	const KEY_Hangul_Ieung: number;
	const KEY_Hangul_J_Cieuc: number;
	const KEY_Hangul_J_Dikeud: number;
	const KEY_Hangul_J_Hieuh: number;
	const KEY_Hangul_J_Ieung: number;
	const KEY_Hangul_J_Jieuj: number;
	const KEY_Hangul_J_Khieuq: number;
	const KEY_Hangul_J_Kiyeog: number;
	const KEY_Hangul_J_KiyeogSios: number;
	const KEY_Hangul_J_KkogjiDalrinIeung: number;
	const KEY_Hangul_J_Mieum: number;
	const KEY_Hangul_J_Nieun: number;
	const KEY_Hangul_J_NieunHieuh: number;
	const KEY_Hangul_J_NieunJieuj: number;
	const KEY_Hangul_J_PanSios: number;
	const KEY_Hangul_J_Phieuf: number;
	const KEY_Hangul_J_Pieub: number;
	const KEY_Hangul_J_PieubSios: number;
	const KEY_Hangul_J_Rieul: number;
	const KEY_Hangul_J_RieulHieuh: number;
	const KEY_Hangul_J_RieulKiyeog: number;
	const KEY_Hangul_J_RieulMieum: number;
	const KEY_Hangul_J_RieulPhieuf: number;
	const KEY_Hangul_J_RieulPieub: number;
	const KEY_Hangul_J_RieulSios: number;
	const KEY_Hangul_J_RieulTieut: number;
	const KEY_Hangul_J_Sios: number;
	const KEY_Hangul_J_SsangKiyeog: number;
	const KEY_Hangul_J_SsangSios: number;
	const KEY_Hangul_J_Tieut: number;
	const KEY_Hangul_J_YeorinHieuh: number;
	const KEY_Hangul_Jamo: number;
	const KEY_Hangul_Jeonja: number;
	const KEY_Hangul_Jieuj: number;
	const KEY_Hangul_Khieuq: number;
	const KEY_Hangul_Kiyeog: number;
	const KEY_Hangul_KiyeogSios: number;
	const KEY_Hangul_KkogjiDalrinIeung: number;
	const KEY_Hangul_Mieum: number;
	const KEY_Hangul_MultipleCandidate: number;
	const KEY_Hangul_Nieun: number;
	const KEY_Hangul_NieunHieuh: number;
	const KEY_Hangul_NieunJieuj: number;
	const KEY_Hangul_O: number;
	const KEY_Hangul_OE: number;
	const KEY_Hangul_PanSios: number;
	const KEY_Hangul_Phieuf: number;
	const KEY_Hangul_Pieub: number;
	const KEY_Hangul_PieubSios: number;
	const KEY_Hangul_PostHanja: number;
	const KEY_Hangul_PreHanja: number;
	const KEY_Hangul_PreviousCandidate: number;
	const KEY_Hangul_Rieul: number;
	const KEY_Hangul_RieulHieuh: number;
	const KEY_Hangul_RieulKiyeog: number;
	const KEY_Hangul_RieulMieum: number;
	const KEY_Hangul_RieulPhieuf: number;
	const KEY_Hangul_RieulPieub: number;
	const KEY_Hangul_RieulSios: number;
	const KEY_Hangul_RieulTieut: number;
	const KEY_Hangul_RieulYeorinHieuh: number;
	const KEY_Hangul_Romaja: number;
	const KEY_Hangul_SingleCandidate: number;
	const KEY_Hangul_Sios: number;
	const KEY_Hangul_Special: number;
	const KEY_Hangul_SsangDikeud: number;
	const KEY_Hangul_SsangJieuj: number;
	const KEY_Hangul_SsangKiyeog: number;
	const KEY_Hangul_SsangPieub: number;
	const KEY_Hangul_SsangSios: number;
	const KEY_Hangul_Start: number;
	const KEY_Hangul_SunkyeongeumMieum: number;
	const KEY_Hangul_SunkyeongeumPhieuf: number;
	const KEY_Hangul_SunkyeongeumPieub: number;
	const KEY_Hangul_Tieut: number;
	const KEY_Hangul_U: number;
	const KEY_Hangul_WA: number;
	const KEY_Hangul_WAE: number;
	const KEY_Hangul_WE: number;
	const KEY_Hangul_WEO: number;
	const KEY_Hangul_WI: number;
	const KEY_Hangul_YA: number;
	const KEY_Hangul_YAE: number;
	const KEY_Hangul_YE: number;
	const KEY_Hangul_YEO: number;
	const KEY_Hangul_YI: number;
	const KEY_Hangul_YO: number;
	const KEY_Hangul_YU: number;
	const KEY_Hangul_YeorinHieuh: number;
	const KEY_Hangul_switch: number;
	const KEY_Hankaku: number;
	const KEY_Hcircumflex: number;
	const KEY_Hebrew_switch: number;
	const KEY_Help: number;
	const KEY_Henkan: number;
	const KEY_Henkan_Mode: number;
	const KEY_Hibernate: number;
	const KEY_Hiragana: number;
	const KEY_Hiragana_Katakana: number;
	const KEY_History: number;
	const KEY_Home: number;
	const KEY_HomePage: number;
	const KEY_HotLinks: number;
	const KEY_Hstroke: number;
	const KEY_Hyper_L: number;
	const KEY_Hyper_R: number;
	const KEY_I: number;
	const KEY_ISO_Center_Object: number;
	const KEY_ISO_Continuous_Underline: number;
	const KEY_ISO_Discontinuous_Underline: number;
	const KEY_ISO_Emphasize: number;
	const KEY_ISO_Enter: number;
	const KEY_ISO_Fast_Cursor_Down: number;
	const KEY_ISO_Fast_Cursor_Left: number;
	const KEY_ISO_Fast_Cursor_Right: number;
	const KEY_ISO_Fast_Cursor_Up: number;
	const KEY_ISO_First_Group: number;
	const KEY_ISO_First_Group_Lock: number;
	const KEY_ISO_Group_Latch: number;
	const KEY_ISO_Group_Lock: number;
	const KEY_ISO_Group_Shift: number;
	const KEY_ISO_Last_Group: number;
	const KEY_ISO_Last_Group_Lock: number;
	const KEY_ISO_Left_Tab: number;
	const KEY_ISO_Level2_Latch: number;
	const KEY_ISO_Level3_Latch: number;
	const KEY_ISO_Level3_Lock: number;
	const KEY_ISO_Level3_Shift: number;
	const KEY_ISO_Level5_Latch: number;
	const KEY_ISO_Level5_Lock: number;
	const KEY_ISO_Level5_Shift: number;
	const KEY_ISO_Lock: number;
	const KEY_ISO_Move_Line_Down: number;
	const KEY_ISO_Move_Line_Up: number;
	const KEY_ISO_Next_Group: number;
	const KEY_ISO_Next_Group_Lock: number;
	const KEY_ISO_Partial_Line_Down: number;
	const KEY_ISO_Partial_Line_Up: number;
	const KEY_ISO_Partial_Space_Left: number;
	const KEY_ISO_Partial_Space_Right: number;
	const KEY_ISO_Prev_Group: number;
	const KEY_ISO_Prev_Group_Lock: number;
	const KEY_ISO_Release_Both_Margins: number;
	const KEY_ISO_Release_Margin_Left: number;
	const KEY_ISO_Release_Margin_Right: number;
	const KEY_ISO_Set_Margin_Left: number;
	const KEY_ISO_Set_Margin_Right: number;
	const KEY_Iabovedot: number;
	const KEY_Iacute: number;
	const KEY_Ibelowdot: number;
	const KEY_Ibreve: number;
	const KEY_Icircumflex: number;
	const KEY_Idiaeresis: number;
	const KEY_Igrave: number;
	const KEY_Ihook: number;
	const KEY_Imacron: number;
	const KEY_Insert: number;
	const KEY_Iogonek: number;
	const KEY_Itilde: number;
	const KEY_J: number;
	const KEY_Jcircumflex: number;
	const KEY_K: number;
	const KEY_KP_0: number;
	const KEY_KP_1: number;
	const KEY_KP_2: number;
	const KEY_KP_3: number;
	const KEY_KP_4: number;
	const KEY_KP_5: number;
	const KEY_KP_6: number;
	const KEY_KP_7: number;
	const KEY_KP_8: number;
	const KEY_KP_9: number;
	const KEY_KP_Add: number;
	const KEY_KP_Begin: number;
	const KEY_KP_Decimal: number;
	const KEY_KP_Delete: number;
	const KEY_KP_Divide: number;
	const KEY_KP_Down: number;
	const KEY_KP_End: number;
	const KEY_KP_Enter: number;
	const KEY_KP_Equal: number;
	const KEY_KP_F1: number;
	const KEY_KP_F2: number;
	const KEY_KP_F3: number;
	const KEY_KP_F4: number;
	const KEY_KP_Home: number;
	const KEY_KP_Insert: number;
	const KEY_KP_Left: number;
	const KEY_KP_Multiply: number;
	const KEY_KP_Next: number;
	const KEY_KP_Page_Down: number;
	const KEY_KP_Page_Up: number;
	const KEY_KP_Prior: number;
	const KEY_KP_Right: number;
	const KEY_KP_Separator: number;
	const KEY_KP_Space: number;
	const KEY_KP_Subtract: number;
	const KEY_KP_Tab: number;
	const KEY_KP_Up: number;
	const KEY_Kana_Lock: number;
	const KEY_Kana_Shift: number;
	const KEY_Kanji: number;
	const KEY_Kanji_Bangou: number;
	const KEY_Katakana: number;
	const KEY_KbdBrightnessDown: number;
	const KEY_KbdBrightnessUp: number;
	const KEY_KbdLightOnOff: number;
	const KEY_Kcedilla: number;
	const KEY_Korean_Won: number;
	const KEY_L: number;
	const KEY_L1: number;
	const KEY_L10: number;
	const KEY_L2: number;
	const KEY_L3: number;
	const KEY_L4: number;
	const KEY_L5: number;
	const KEY_L6: number;
	const KEY_L7: number;
	const KEY_L8: number;
	const KEY_L9: number;
	const KEY_Lacute: number;
	const KEY_Last_Virtual_Screen: number;
	const KEY_Launch0: number;
	const KEY_Launch1: number;
	const KEY_Launch2: number;
	const KEY_Launch3: number;
	const KEY_Launch4: number;
	const KEY_Launch5: number;
	const KEY_Launch6: number;
	const KEY_Launch7: number;
	const KEY_Launch8: number;
	const KEY_Launch9: number;
	const KEY_LaunchA: number;
	const KEY_LaunchB: number;
	const KEY_LaunchC: number;
	const KEY_LaunchD: number;
	const KEY_LaunchE: number;
	const KEY_LaunchF: number;
	const KEY_Lbelowdot: number;
	const KEY_Lcaron: number;
	const KEY_Lcedilla: number;
	const KEY_Left: number;
	const KEY_LightBulb: number;
	const KEY_Linefeed: number;
	const KEY_LiraSign: number;
	const KEY_LogGrabInfo: number;
	const KEY_LogOff: number;
	const KEY_LogWindowTree: number;
	const KEY_Lstroke: number;
	const KEY_M: number;
	const KEY_Mabovedot: number;
	const KEY_Macedonia_DSE: number;
	const KEY_Macedonia_GJE: number;
	const KEY_Macedonia_KJE: number;
	const KEY_Macedonia_dse: number;
	const KEY_Macedonia_gje: number;
	const KEY_Macedonia_kje: number;
	const KEY_Mae_Koho: number;
	const KEY_Mail: number;
	const KEY_MailForward: number;
	const KEY_Market: number;
	const KEY_Massyo: number;
	const KEY_Meeting: number;
	const KEY_Memo: number;
	const KEY_Menu: number;
	const KEY_MenuKB: number;
	const KEY_MenuPB: number;
	const KEY_Messenger: number;
	const KEY_Meta_L: number;
	const KEY_Meta_R: number;
	const KEY_MillSign: number;
	const KEY_ModeLock: number;
	const KEY_Mode_switch: number;
	const KEY_MonBrightnessDown: number;
	const KEY_MonBrightnessUp: number;
	const KEY_MouseKeys_Accel_Enable: number;
	const KEY_MouseKeys_Enable: number;
	const KEY_Muhenkan: number;
	const KEY_Multi_key: number;
	const KEY_MultipleCandidate: number;
	const KEY_Music: number;
	const KEY_MyComputer: number;
	const KEY_MySites: number;
	const KEY_N: number;
	const KEY_Nacute: number;
	const KEY_NairaSign: number;
	const KEY_Ncaron: number;
	const KEY_Ncedilla: number;
	const KEY_New: number;
	const KEY_NewSheqelSign: number;
	const KEY_News: number;
	const KEY_Next: number;
	const KEY_Next_VMode: number;
	const KEY_Next_Virtual_Screen: number;
	const KEY_Ntilde: number;
	const KEY_Num_Lock: number;
	const KEY_O: number;
	const KEY_OE: number;
	const KEY_Oacute: number;
	const KEY_Obarred: number;
	const KEY_Obelowdot: number;
	const KEY_Ocaron: number;
	const KEY_Ocircumflex: number;
	const KEY_Ocircumflexacute: number;
	const KEY_Ocircumflexbelowdot: number;
	const KEY_Ocircumflexgrave: number;
	const KEY_Ocircumflexhook: number;
	const KEY_Ocircumflextilde: number;
	const KEY_Odiaeresis: number;
	const KEY_Odoubleacute: number;
	const KEY_OfficeHome: number;
	const KEY_Ograve: number;
	const KEY_Ohook: number;
	const KEY_Ohorn: number;
	const KEY_Ohornacute: number;
	const KEY_Ohornbelowdot: number;
	const KEY_Ohorngrave: number;
	const KEY_Ohornhook: number;
	const KEY_Ohorntilde: number;
	const KEY_Omacron: number;
	const KEY_Ooblique: number;
	const KEY_Open: number;
	const KEY_OpenURL: number;
	const KEY_Option: number;
	const KEY_Oslash: number;
	const KEY_Otilde: number;
	const KEY_Overlay1_Enable: number;
	const KEY_Overlay2_Enable: number;
	const KEY_P: number;
	const KEY_Pabovedot: number;
	const KEY_Page_Down: number;
	const KEY_Page_Up: number;
	const KEY_Paste: number;
	const KEY_Pause: number;
	const KEY_PesetaSign: number;
	const KEY_Phone: number;
	const KEY_Pictures: number;
	const KEY_Pointer_Accelerate: number;
	const KEY_Pointer_Button1: number;
	const KEY_Pointer_Button2: number;
	const KEY_Pointer_Button3: number;
	const KEY_Pointer_Button4: number;
	const KEY_Pointer_Button5: number;
	const KEY_Pointer_Button_Dflt: number;
	const KEY_Pointer_DblClick1: number;
	const KEY_Pointer_DblClick2: number;
	const KEY_Pointer_DblClick3: number;
	const KEY_Pointer_DblClick4: number;
	const KEY_Pointer_DblClick5: number;
	const KEY_Pointer_DblClick_Dflt: number;
	const KEY_Pointer_DfltBtnNext: number;
	const KEY_Pointer_DfltBtnPrev: number;
	const KEY_Pointer_Down: number;
	const KEY_Pointer_DownLeft: number;
	const KEY_Pointer_DownRight: number;
	const KEY_Pointer_Drag1: number;
	const KEY_Pointer_Drag2: number;
	const KEY_Pointer_Drag3: number;
	const KEY_Pointer_Drag4: number;
	const KEY_Pointer_Drag5: number;
	const KEY_Pointer_Drag_Dflt: number;
	const KEY_Pointer_EnableKeys: number;
	const KEY_Pointer_Left: number;
	const KEY_Pointer_Right: number;
	const KEY_Pointer_Up: number;
	const KEY_Pointer_UpLeft: number;
	const KEY_Pointer_UpRight: number;
	const KEY_PowerDown: number;
	const KEY_PowerOff: number;
	const KEY_Prev_VMode: number;
	const KEY_Prev_Virtual_Screen: number;
	const KEY_PreviousCandidate: number;
	const KEY_Print: number;
	const KEY_Prior: number;
	const KEY_Q: number;
	const KEY_R: number;
	const KEY_R1: number;
	const KEY_R10: number;
	const KEY_R11: number;
	const KEY_R12: number;
	const KEY_R13: number;
	const KEY_R14: number;
	const KEY_R15: number;
	const KEY_R2: number;
	const KEY_R3: number;
	const KEY_R4: number;
	const KEY_R5: number;
	const KEY_R6: number;
	const KEY_R7: number;
	const KEY_R8: number;
	const KEY_R9: number;
	const KEY_Racute: number;
	const KEY_Rcaron: number;
	const KEY_Rcedilla: number;
	const KEY_Red: number;
	const KEY_Redo: number;
	const KEY_Refresh: number;
	const KEY_Reload: number;
	const KEY_RepeatKeys_Enable: number;
	const KEY_Reply: number;
	const KEY_Return: number;
	const KEY_Right: number;
	const KEY_RockerDown: number;
	const KEY_RockerEnter: number;
	const KEY_RockerUp: number;
	const KEY_Romaji: number;
	const KEY_RotateWindows: number;
	const KEY_RotationKB: number;
	const KEY_RotationPB: number;
	const KEY_RupeeSign: number;
	const KEY_S: number;
	const KEY_SCHWA: number;
	const KEY_Sabovedot: number;
	const KEY_Sacute: number;
	const KEY_Save: number;
	const KEY_Scaron: number;
	const KEY_Scedilla: number;
	const KEY_Scircumflex: number;
	const KEY_ScreenSaver: number;
	const KEY_ScrollClick: number;
	const KEY_ScrollDown: number;
	const KEY_ScrollUp: number;
	const KEY_Scroll_Lock: number;
	const KEY_Search: number;
	const KEY_Select: number;
	const KEY_SelectButton: number;
	const KEY_Send: number;
	const KEY_Serbian_DJE: number;
	const KEY_Serbian_DZE: number;
	const KEY_Serbian_JE: number;
	const KEY_Serbian_LJE: number;
	const KEY_Serbian_NJE: number;
	const KEY_Serbian_TSHE: number;
	const KEY_Serbian_dje: number;
	const KEY_Serbian_dze: number;
	const KEY_Serbian_je: number;
	const KEY_Serbian_lje: number;
	const KEY_Serbian_nje: number;
	const KEY_Serbian_tshe: number;
	const KEY_Shift_L: number;
	const KEY_Shift_Lock: number;
	const KEY_Shift_R: number;
	const KEY_Shop: number;
	const KEY_SingleCandidate: number;
	const KEY_Sinh_a: number;
	const KEY_Sinh_aa: number;
	const KEY_Sinh_aa2: number;
	const KEY_Sinh_ae: number;
	const KEY_Sinh_ae2: number;
	const KEY_Sinh_aee: number;
	const KEY_Sinh_aee2: number;
	const KEY_Sinh_ai: number;
	const KEY_Sinh_ai2: number;
	const KEY_Sinh_al: number;
	const KEY_Sinh_au: number;
	const KEY_Sinh_au2: number;
	const KEY_Sinh_ba: number;
	const KEY_Sinh_bha: number;
	const KEY_Sinh_ca: number;
	const KEY_Sinh_cha: number;
	const KEY_Sinh_dda: number;
	const KEY_Sinh_ddha: number;
	const KEY_Sinh_dha: number;
	const KEY_Sinh_dhha: number;
	const KEY_Sinh_e: number;
	const KEY_Sinh_e2: number;
	const KEY_Sinh_ee: number;
	const KEY_Sinh_ee2: number;
	const KEY_Sinh_fa: number;
	const KEY_Sinh_ga: number;
	const KEY_Sinh_gha: number;
	const KEY_Sinh_h2: number;
	const KEY_Sinh_ha: number;
	const KEY_Sinh_i: number;
	const KEY_Sinh_i2: number;
	const KEY_Sinh_ii: number;
	const KEY_Sinh_ii2: number;
	const KEY_Sinh_ja: number;
	const KEY_Sinh_jha: number;
	const KEY_Sinh_jnya: number;
	const KEY_Sinh_ka: number;
	const KEY_Sinh_kha: number;
	const KEY_Sinh_kunddaliya: number;
	const KEY_Sinh_la: number;
	const KEY_Sinh_lla: number;
	const KEY_Sinh_lu: number;
	const KEY_Sinh_lu2: number;
	const KEY_Sinh_luu: number;
	const KEY_Sinh_luu2: number;
	const KEY_Sinh_ma: number;
	const KEY_Sinh_mba: number;
	const KEY_Sinh_na: number;
	const KEY_Sinh_ndda: number;
	const KEY_Sinh_ndha: number;
	const KEY_Sinh_ng: number;
	const KEY_Sinh_ng2: number;
	const KEY_Sinh_nga: number;
	const KEY_Sinh_nja: number;
	const KEY_Sinh_nna: number;
	const KEY_Sinh_nya: number;
	const KEY_Sinh_o: number;
	const KEY_Sinh_o2: number;
	const KEY_Sinh_oo: number;
	const KEY_Sinh_oo2: number;
	const KEY_Sinh_pa: number;
	const KEY_Sinh_pha: number;
	const KEY_Sinh_ra: number;
	const KEY_Sinh_ri: number;
	const KEY_Sinh_rii: number;
	const KEY_Sinh_ru2: number;
	const KEY_Sinh_ruu2: number;
	const KEY_Sinh_sa: number;
	const KEY_Sinh_sha: number;
	const KEY_Sinh_ssha: number;
	const KEY_Sinh_tha: number;
	const KEY_Sinh_thha: number;
	const KEY_Sinh_tta: number;
	const KEY_Sinh_ttha: number;
	const KEY_Sinh_u: number;
	const KEY_Sinh_u2: number;
	const KEY_Sinh_uu: number;
	const KEY_Sinh_uu2: number;
	const KEY_Sinh_va: number;
	const KEY_Sinh_ya: number;
	const KEY_Sleep: number;
	const KEY_SlowKeys_Enable: number;
	const KEY_Spell: number;
	const KEY_SplitScreen: number;
	const KEY_Standby: number;
	const KEY_Start: number;
	const KEY_StickyKeys_Enable: number;
	const KEY_Stop: number;
	const KEY_Subtitle: number;
	const KEY_Super_L: number;
	const KEY_Super_R: number;
	const KEY_Support: number;
	const KEY_Suspend: number;
	const KEY_Switch_VT_1: number;
	const KEY_Switch_VT_10: number;
	const KEY_Switch_VT_11: number;
	const KEY_Switch_VT_12: number;
	const KEY_Switch_VT_2: number;
	const KEY_Switch_VT_3: number;
	const KEY_Switch_VT_4: number;
	const KEY_Switch_VT_5: number;
	const KEY_Switch_VT_6: number;
	const KEY_Switch_VT_7: number;
	const KEY_Switch_VT_8: number;
	const KEY_Switch_VT_9: number;
	const KEY_Sys_Req: number;
	const KEY_T: number;
	const KEY_THORN: number;
	const KEY_Tab: number;
	const KEY_Tabovedot: number;
	const KEY_TaskPane: number;
	const KEY_Tcaron: number;
	const KEY_Tcedilla: number;
	const KEY_Terminal: number;
	const KEY_Terminate_Server: number;
	const KEY_Thai_baht: number;
	const KEY_Thai_bobaimai: number;
	const KEY_Thai_chochan: number;
	const KEY_Thai_chochang: number;
	const KEY_Thai_choching: number;
	const KEY_Thai_chochoe: number;
	const KEY_Thai_dochada: number;
	const KEY_Thai_dodek: number;
	const KEY_Thai_fofa: number;
	const KEY_Thai_fofan: number;
	const KEY_Thai_hohip: number;
	const KEY_Thai_honokhuk: number;
	const KEY_Thai_khokhai: number;
	const KEY_Thai_khokhon: number;
	const KEY_Thai_khokhuat: number;
	const KEY_Thai_khokhwai: number;
	const KEY_Thai_khorakhang: number;
	const KEY_Thai_kokai: number;
	const KEY_Thai_lakkhangyao: number;
	const KEY_Thai_lekchet: number;
	const KEY_Thai_lekha: number;
	const KEY_Thai_lekhok: number;
	const KEY_Thai_lekkao: number;
	const KEY_Thai_leknung: number;
	const KEY_Thai_lekpaet: number;
	const KEY_Thai_leksam: number;
	const KEY_Thai_leksi: number;
	const KEY_Thai_leksong: number;
	const KEY_Thai_leksun: number;
	const KEY_Thai_lochula: number;
	const KEY_Thai_loling: number;
	const KEY_Thai_lu: number;
	const KEY_Thai_maichattawa: number;
	const KEY_Thai_maiek: number;
	const KEY_Thai_maihanakat: number;
	const KEY_Thai_maihanakat_maitho: number;
	const KEY_Thai_maitaikhu: number;
	const KEY_Thai_maitho: number;
	const KEY_Thai_maitri: number;
	const KEY_Thai_maiyamok: number;
	const KEY_Thai_moma: number;
	const KEY_Thai_ngongu: number;
	const KEY_Thai_nikhahit: number;
	const KEY_Thai_nonen: number;
	const KEY_Thai_nonu: number;
	const KEY_Thai_oang: number;
	const KEY_Thai_paiyannoi: number;
	const KEY_Thai_phinthu: number;
	const KEY_Thai_phophan: number;
	const KEY_Thai_phophung: number;
	const KEY_Thai_phosamphao: number;
	const KEY_Thai_popla: number;
	const KEY_Thai_rorua: number;
	const KEY_Thai_ru: number;
	const KEY_Thai_saraa: number;
	const KEY_Thai_saraaa: number;
	const KEY_Thai_saraae: number;
	const KEY_Thai_saraaimaimalai: number;
	const KEY_Thai_saraaimaimuan: number;
	const KEY_Thai_saraam: number;
	const KEY_Thai_sarae: number;
	const KEY_Thai_sarai: number;
	const KEY_Thai_saraii: number;
	const KEY_Thai_sarao: number;
	const KEY_Thai_sarau: number;
	const KEY_Thai_saraue: number;
	const KEY_Thai_sarauee: number;
	const KEY_Thai_sarauu: number;
	const KEY_Thai_sorusi: number;
	const KEY_Thai_sosala: number;
	const KEY_Thai_soso: number;
	const KEY_Thai_sosua: number;
	const KEY_Thai_thanthakhat: number;
	const KEY_Thai_thonangmontho: number;
	const KEY_Thai_thophuthao: number;
	const KEY_Thai_thothahan: number;
	const KEY_Thai_thothan: number;
	const KEY_Thai_thothong: number;
	const KEY_Thai_thothung: number;
	const KEY_Thai_topatak: number;
	const KEY_Thai_totao: number;
	const KEY_Thai_wowaen: number;
	const KEY_Thai_yoyak: number;
	const KEY_Thai_yoying: number;
	const KEY_Thorn: number;
	const KEY_Time: number;
	const KEY_ToDoList: number;
	const KEY_Tools: number;
	const KEY_TopMenu: number;
	const KEY_TouchpadOff: number;
	const KEY_TouchpadOn: number;
	const KEY_TouchpadToggle: number;
	const KEY_Touroku: number;
	const KEY_Travel: number;
	const KEY_Tslash: number;
	const KEY_U: number;
	const KEY_UWB: number;
	const KEY_Uacute: number;
	const KEY_Ubelowdot: number;
	const KEY_Ubreve: number;
	const KEY_Ucircumflex: number;
	const KEY_Udiaeresis: number;
	const KEY_Udoubleacute: number;
	const KEY_Ugrave: number;
	const KEY_Uhook: number;
	const KEY_Uhorn: number;
	const KEY_Uhornacute: number;
	const KEY_Uhornbelowdot: number;
	const KEY_Uhorngrave: number;
	const KEY_Uhornhook: number;
	const KEY_Uhorntilde: number;
	const KEY_Ukrainian_GHE_WITH_UPTURN: number;
	const KEY_Ukrainian_I: number;
	const KEY_Ukrainian_IE: number;
	const KEY_Ukrainian_YI: number;
	const KEY_Ukrainian_ghe_with_upturn: number;
	const KEY_Ukrainian_i: number;
	const KEY_Ukrainian_ie: number;
	const KEY_Ukrainian_yi: number;
	const KEY_Ukranian_I: number;
	const KEY_Ukranian_JE: number;
	const KEY_Ukranian_YI: number;
	const KEY_Ukranian_i: number;
	const KEY_Ukranian_je: number;
	const KEY_Ukranian_yi: number;
	const KEY_Umacron: number;
	const KEY_Undo: number;
	const KEY_Ungrab: number;
	const KEY_Uogonek: number;
	const KEY_Up: number;
	const KEY_Uring: number;
	const KEY_User1KB: number;
	const KEY_User2KB: number;
	const KEY_UserPB: number;
	const KEY_Utilde: number;
	const KEY_V: number;
	const KEY_VendorHome: number;
	const KEY_Video: number;
	const KEY_View: number;
	const KEY_VoidSymbol: number;
	const KEY_W: number;
	const KEY_WLAN: number;
	const KEY_WWW: number;
	const KEY_Wacute: number;
	const KEY_WakeUp: number;
	const KEY_Wcircumflex: number;
	const KEY_Wdiaeresis: number;
	const KEY_WebCam: number;
	const KEY_Wgrave: number;
	const KEY_WheelButton: number;
	const KEY_WindowClear: number;
	const KEY_WonSign: number;
	const KEY_Word: number;
	const KEY_X: number;
	const KEY_Xabovedot: number;
	const KEY_Xfer: number;
	const KEY_Y: number;
	const KEY_Yacute: number;
	const KEY_Ybelowdot: number;
	const KEY_Ycircumflex: number;
	const KEY_Ydiaeresis: number;
	const KEY_Yellow: number;
	const KEY_Ygrave: number;
	const KEY_Yhook: number;
	const KEY_Ytilde: number;
	const KEY_Z: number;
	const KEY_Zabovedot: number;
	const KEY_Zacute: number;
	const KEY_Zcaron: number;
	const KEY_Zen_Koho: number;
	const KEY_Zenkaku: number;
	const KEY_Zenkaku_Hankaku: number;
	const KEY_ZoomIn: number;
	const KEY_ZoomOut: number;
	const KEY_Zstroke: number;
	const KEY_a: number;
	const KEY_aacute: number;
	const KEY_abelowdot: number;
	const KEY_abovedot: number;
	const KEY_abreve: number;
	const KEY_abreveacute: number;
	const KEY_abrevebelowdot: number;
	const KEY_abrevegrave: number;
	const KEY_abrevehook: number;
	const KEY_abrevetilde: number;
	const KEY_acircumflex: number;
	const KEY_acircumflexacute: number;
	const KEY_acircumflexbelowdot: number;
	const KEY_acircumflexgrave: number;
	const KEY_acircumflexhook: number;
	const KEY_acircumflextilde: number;
	const KEY_acute: number;
	const KEY_adiaeresis: number;
	const KEY_ae: number;
	const KEY_agrave: number;
	const KEY_ahook: number;
	const KEY_amacron: number;
	const KEY_ampersand: number;
	const KEY_aogonek: number;
	const KEY_apostrophe: number;
	const KEY_approxeq: number;
	const KEY_approximate: number;
	const KEY_aring: number;
	const KEY_asciicircum: number;
	const KEY_asciitilde: number;
	const KEY_asterisk: number;
	const KEY_at: number;
	const KEY_atilde: number;
	const KEY_b: number;
	const KEY_babovedot: number;
	const KEY_backslash: number;
	const KEY_ballotcross: number;
	const KEY_bar: number;
	const KEY_because: number;
	const KEY_blank: number;
	const KEY_botintegral: number;
	const KEY_botleftparens: number;
	const KEY_botleftsqbracket: number;
	const KEY_botleftsummation: number;
	const KEY_botrightparens: number;
	const KEY_botrightsqbracket: number;
	const KEY_botrightsummation: number;
	const KEY_bott: number;
	const KEY_botvertsummationconnector: number;
	const KEY_braceleft: number;
	const KEY_braceright: number;
	const KEY_bracketleft: number;
	const KEY_bracketright: number;
	const KEY_braille_blank: number;
	const KEY_braille_dot_1: number;
	const KEY_braille_dot_10: number;
	const KEY_braille_dot_2: number;
	const KEY_braille_dot_3: number;
	const KEY_braille_dot_4: number;
	const KEY_braille_dot_5: number;
	const KEY_braille_dot_6: number;
	const KEY_braille_dot_7: number;
	const KEY_braille_dot_8: number;
	const KEY_braille_dot_9: number;
	const KEY_braille_dots_1: number;
	const KEY_braille_dots_12: number;
	const KEY_braille_dots_123: number;
	const KEY_braille_dots_1234: number;
	const KEY_braille_dots_12345: number;
	const KEY_braille_dots_123456: number;
	const KEY_braille_dots_1234567: number;
	const KEY_braille_dots_12345678: number;
	const KEY_braille_dots_1234568: number;
	const KEY_braille_dots_123457: number;
	const KEY_braille_dots_1234578: number;
	const KEY_braille_dots_123458: number;
	const KEY_braille_dots_12346: number;
	const KEY_braille_dots_123467: number;
	const KEY_braille_dots_1234678: number;
	const KEY_braille_dots_123468: number;
	const KEY_braille_dots_12347: number;
	const KEY_braille_dots_123478: number;
	const KEY_braille_dots_12348: number;
	const KEY_braille_dots_1235: number;
	const KEY_braille_dots_12356: number;
	const KEY_braille_dots_123567: number;
	const KEY_braille_dots_1235678: number;
	const KEY_braille_dots_123568: number;
	const KEY_braille_dots_12357: number;
	const KEY_braille_dots_123578: number;
	const KEY_braille_dots_12358: number;
	const KEY_braille_dots_1236: number;
	const KEY_braille_dots_12367: number;
	const KEY_braille_dots_123678: number;
	const KEY_braille_dots_12368: number;
	const KEY_braille_dots_1237: number;
	const KEY_braille_dots_12378: number;
	const KEY_braille_dots_1238: number;
	const KEY_braille_dots_124: number;
	const KEY_braille_dots_1245: number;
	const KEY_braille_dots_12456: number;
	const KEY_braille_dots_124567: number;
	const KEY_braille_dots_1245678: number;
	const KEY_braille_dots_124568: number;
	const KEY_braille_dots_12457: number;
	const KEY_braille_dots_124578: number;
	const KEY_braille_dots_12458: number;
	const KEY_braille_dots_1246: number;
	const KEY_braille_dots_12467: number;
	const KEY_braille_dots_124678: number;
	const KEY_braille_dots_12468: number;
	const KEY_braille_dots_1247: number;
	const KEY_braille_dots_12478: number;
	const KEY_braille_dots_1248: number;
	const KEY_braille_dots_125: number;
	const KEY_braille_dots_1256: number;
	const KEY_braille_dots_12567: number;
	const KEY_braille_dots_125678: number;
	const KEY_braille_dots_12568: number;
	const KEY_braille_dots_1257: number;
	const KEY_braille_dots_12578: number;
	const KEY_braille_dots_1258: number;
	const KEY_braille_dots_126: number;
	const KEY_braille_dots_1267: number;
	const KEY_braille_dots_12678: number;
	const KEY_braille_dots_1268: number;
	const KEY_braille_dots_127: number;
	const KEY_braille_dots_1278: number;
	const KEY_braille_dots_128: number;
	const KEY_braille_dots_13: number;
	const KEY_braille_dots_134: number;
	const KEY_braille_dots_1345: number;
	const KEY_braille_dots_13456: number;
	const KEY_braille_dots_134567: number;
	const KEY_braille_dots_1345678: number;
	const KEY_braille_dots_134568: number;
	const KEY_braille_dots_13457: number;
	const KEY_braille_dots_134578: number;
	const KEY_braille_dots_13458: number;
	const KEY_braille_dots_1346: number;
	const KEY_braille_dots_13467: number;
	const KEY_braille_dots_134678: number;
	const KEY_braille_dots_13468: number;
	const KEY_braille_dots_1347: number;
	const KEY_braille_dots_13478: number;
	const KEY_braille_dots_1348: number;
	const KEY_braille_dots_135: number;
	const KEY_braille_dots_1356: number;
	const KEY_braille_dots_13567: number;
	const KEY_braille_dots_135678: number;
	const KEY_braille_dots_13568: number;
	const KEY_braille_dots_1357: number;
	const KEY_braille_dots_13578: number;
	const KEY_braille_dots_1358: number;
	const KEY_braille_dots_136: number;
	const KEY_braille_dots_1367: number;
	const KEY_braille_dots_13678: number;
	const KEY_braille_dots_1368: number;
	const KEY_braille_dots_137: number;
	const KEY_braille_dots_1378: number;
	const KEY_braille_dots_138: number;
	const KEY_braille_dots_14: number;
	const KEY_braille_dots_145: number;
	const KEY_braille_dots_1456: number;
	const KEY_braille_dots_14567: number;
	const KEY_braille_dots_145678: number;
	const KEY_braille_dots_14568: number;
	const KEY_braille_dots_1457: number;
	const KEY_braille_dots_14578: number;
	const KEY_braille_dots_1458: number;
	const KEY_braille_dots_146: number;
	const KEY_braille_dots_1467: number;
	const KEY_braille_dots_14678: number;
	const KEY_braille_dots_1468: number;
	const KEY_braille_dots_147: number;
	const KEY_braille_dots_1478: number;
	const KEY_braille_dots_148: number;
	const KEY_braille_dots_15: number;
	const KEY_braille_dots_156: number;
	const KEY_braille_dots_1567: number;
	const KEY_braille_dots_15678: number;
	const KEY_braille_dots_1568: number;
	const KEY_braille_dots_157: number;
	const KEY_braille_dots_1578: number;
	const KEY_braille_dots_158: number;
	const KEY_braille_dots_16: number;
	const KEY_braille_dots_167: number;
	const KEY_braille_dots_1678: number;
	const KEY_braille_dots_168: number;
	const KEY_braille_dots_17: number;
	const KEY_braille_dots_178: number;
	const KEY_braille_dots_18: number;
	const KEY_braille_dots_2: number;
	const KEY_braille_dots_23: number;
	const KEY_braille_dots_234: number;
	const KEY_braille_dots_2345: number;
	const KEY_braille_dots_23456: number;
	const KEY_braille_dots_234567: number;
	const KEY_braille_dots_2345678: number;
	const KEY_braille_dots_234568: number;
	const KEY_braille_dots_23457: number;
	const KEY_braille_dots_234578: number;
	const KEY_braille_dots_23458: number;
	const KEY_braille_dots_2346: number;
	const KEY_braille_dots_23467: number;
	const KEY_braille_dots_234678: number;
	const KEY_braille_dots_23468: number;
	const KEY_braille_dots_2347: number;
	const KEY_braille_dots_23478: number;
	const KEY_braille_dots_2348: number;
	const KEY_braille_dots_235: number;
	const KEY_braille_dots_2356: number;
	const KEY_braille_dots_23567: number;
	const KEY_braille_dots_235678: number;
	const KEY_braille_dots_23568: number;
	const KEY_braille_dots_2357: number;
	const KEY_braille_dots_23578: number;
	const KEY_braille_dots_2358: number;
	const KEY_braille_dots_236: number;
	const KEY_braille_dots_2367: number;
	const KEY_braille_dots_23678: number;
	const KEY_braille_dots_2368: number;
	const KEY_braille_dots_237: number;
	const KEY_braille_dots_2378: number;
	const KEY_braille_dots_238: number;
	const KEY_braille_dots_24: number;
	const KEY_braille_dots_245: number;
	const KEY_braille_dots_2456: number;
	const KEY_braille_dots_24567: number;
	const KEY_braille_dots_245678: number;
	const KEY_braille_dots_24568: number;
	const KEY_braille_dots_2457: number;
	const KEY_braille_dots_24578: number;
	const KEY_braille_dots_2458: number;
	const KEY_braille_dots_246: number;
	const KEY_braille_dots_2467: number;
	const KEY_braille_dots_24678: number;
	const KEY_braille_dots_2468: number;
	const KEY_braille_dots_247: number;
	const KEY_braille_dots_2478: number;
	const KEY_braille_dots_248: number;
	const KEY_braille_dots_25: number;
	const KEY_braille_dots_256: number;
	const KEY_braille_dots_2567: number;
	const KEY_braille_dots_25678: number;
	const KEY_braille_dots_2568: number;
	const KEY_braille_dots_257: number;
	const KEY_braille_dots_2578: number;
	const KEY_braille_dots_258: number;
	const KEY_braille_dots_26: number;
	const KEY_braille_dots_267: number;
	const KEY_braille_dots_2678: number;
	const KEY_braille_dots_268: number;
	const KEY_braille_dots_27: number;
	const KEY_braille_dots_278: number;
	const KEY_braille_dots_28: number;
	const KEY_braille_dots_3: number;
	const KEY_braille_dots_34: number;
	const KEY_braille_dots_345: number;
	const KEY_braille_dots_3456: number;
	const KEY_braille_dots_34567: number;
	const KEY_braille_dots_345678: number;
	const KEY_braille_dots_34568: number;
	const KEY_braille_dots_3457: number;
	const KEY_braille_dots_34578: number;
	const KEY_braille_dots_3458: number;
	const KEY_braille_dots_346: number;
	const KEY_braille_dots_3467: number;
	const KEY_braille_dots_34678: number;
	const KEY_braille_dots_3468: number;
	const KEY_braille_dots_347: number;
	const KEY_braille_dots_3478: number;
	const KEY_braille_dots_348: number;
	const KEY_braille_dots_35: number;
	const KEY_braille_dots_356: number;
	const KEY_braille_dots_3567: number;
	const KEY_braille_dots_35678: number;
	const KEY_braille_dots_3568: number;
	const KEY_braille_dots_357: number;
	const KEY_braille_dots_3578: number;
	const KEY_braille_dots_358: number;
	const KEY_braille_dots_36: number;
	const KEY_braille_dots_367: number;
	const KEY_braille_dots_3678: number;
	const KEY_braille_dots_368: number;
	const KEY_braille_dots_37: number;
	const KEY_braille_dots_378: number;
	const KEY_braille_dots_38: number;
	const KEY_braille_dots_4: number;
	const KEY_braille_dots_45: number;
	const KEY_braille_dots_456: number;
	const KEY_braille_dots_4567: number;
	const KEY_braille_dots_45678: number;
	const KEY_braille_dots_4568: number;
	const KEY_braille_dots_457: number;
	const KEY_braille_dots_4578: number;
	const KEY_braille_dots_458: number;
	const KEY_braille_dots_46: number;
	const KEY_braille_dots_467: number;
	const KEY_braille_dots_4678: number;
	const KEY_braille_dots_468: number;
	const KEY_braille_dots_47: number;
	const KEY_braille_dots_478: number;
	const KEY_braille_dots_48: number;
	const KEY_braille_dots_5: number;
	const KEY_braille_dots_56: number;
	const KEY_braille_dots_567: number;
	const KEY_braille_dots_5678: number;
	const KEY_braille_dots_568: number;
	const KEY_braille_dots_57: number;
	const KEY_braille_dots_578: number;
	const KEY_braille_dots_58: number;
	const KEY_braille_dots_6: number;
	const KEY_braille_dots_67: number;
	const KEY_braille_dots_678: number;
	const KEY_braille_dots_68: number;
	const KEY_braille_dots_7: number;
	const KEY_braille_dots_78: number;
	const KEY_braille_dots_8: number;
	const KEY_breve: number;
	const KEY_brokenbar: number;
	const KEY_c: number;
	const KEY_c_h: number;
	const KEY_cabovedot: number;
	const KEY_cacute: number;
	const KEY_careof: number;
	const KEY_caret: number;
	const KEY_caron: number;
	const KEY_ccaron: number;
	const KEY_ccedilla: number;
	const KEY_ccircumflex: number;
	const KEY_cedilla: number;
	const KEY_cent: number;
	const KEY_ch: number;
	const KEY_checkerboard: number;
	const KEY_checkmark: number;
	const KEY_circle: number;
	const KEY_club: number;
	const KEY_colon: number;
	const KEY_comma: number;
	const KEY_containsas: number;
	const KEY_copyright: number;
	const KEY_cr: number;
	const KEY_crossinglines: number;
	const KEY_cuberoot: number;
	const KEY_currency: number;
	const KEY_cursor: number;
	const KEY_d: number;
	const KEY_dabovedot: number;
	const KEY_dagger: number;
	const KEY_dcaron: number;
	const KEY_dead_A: number;
	const KEY_dead_E: number;
	const KEY_dead_I: number;
	const KEY_dead_O: number;
	const KEY_dead_U: number;
	const KEY_dead_a: number;
	const KEY_dead_abovecomma: number;
	const KEY_dead_abovedot: number;
	const KEY_dead_abovereversedcomma: number;
	const KEY_dead_abovering: number;
	const KEY_dead_aboveverticalline: number;
	const KEY_dead_acute: number;
	const KEY_dead_belowbreve: number;
	const KEY_dead_belowcircumflex: number;
	const KEY_dead_belowcomma: number;
	const KEY_dead_belowdiaeresis: number;
	const KEY_dead_belowdot: number;
	const KEY_dead_belowmacron: number;
	const KEY_dead_belowring: number;
	const KEY_dead_belowtilde: number;
	const KEY_dead_belowverticalline: number;
	const KEY_dead_breve: number;
	const KEY_dead_capital_schwa: number;
	const KEY_dead_caron: number;
	const KEY_dead_cedilla: number;
	const KEY_dead_circumflex: number;
	const KEY_dead_currency: number;
	const KEY_dead_dasia: number;
	const KEY_dead_diaeresis: number;
	const KEY_dead_doubleacute: number;
	const KEY_dead_doublegrave: number;
	const KEY_dead_e: number;
	const KEY_dead_grave: number;
	const KEY_dead_greek: number;
	const KEY_dead_hook: number;
	const KEY_dead_horn: number;
	const KEY_dead_i: number;
	const KEY_dead_invertedbreve: number;
	const KEY_dead_iota: number;
	const KEY_dead_longsolidusoverlay: number;
	const KEY_dead_lowline: number;
	const KEY_dead_macron: number;
	const KEY_dead_o: number;
	const KEY_dead_ogonek: number;
	const KEY_dead_perispomeni: number;
	const KEY_dead_psili: number;
	const KEY_dead_semivoiced_sound: number;
	const KEY_dead_small_schwa: number;
	const KEY_dead_stroke: number;
	const KEY_dead_tilde: number;
	const KEY_dead_u: number;
	const KEY_dead_voiced_sound: number;
	const KEY_decimalpoint: number;
	const KEY_degree: number;
	const KEY_diaeresis: number;
	const KEY_diamond: number;
	const KEY_digitspace: number;
	const KEY_dintegral: number;
	const KEY_division: number;
	const KEY_dollar: number;
	const KEY_doubbaselinedot: number;
	const KEY_doubleacute: number;
	const KEY_doubledagger: number;
	const KEY_doublelowquotemark: number;
	const KEY_downarrow: number;
	const KEY_downcaret: number;
	const KEY_downshoe: number;
	const KEY_downstile: number;
	const KEY_downtack: number;
	const KEY_dstroke: number;
	const KEY_e: number;
	const KEY_eabovedot: number;
	const KEY_eacute: number;
	const KEY_ebelowdot: number;
	const KEY_ecaron: number;
	const KEY_ecircumflex: number;
	const KEY_ecircumflexacute: number;
	const KEY_ecircumflexbelowdot: number;
	const KEY_ecircumflexgrave: number;
	const KEY_ecircumflexhook: number;
	const KEY_ecircumflextilde: number;
	const KEY_ediaeresis: number;
	const KEY_egrave: number;
	const KEY_ehook: number;
	const KEY_eightsubscript: number;
	const KEY_eightsuperior: number;
	const KEY_elementof: number;
	const KEY_ellipsis: number;
	const KEY_em3space: number;
	const KEY_em4space: number;
	const KEY_emacron: number;
	const KEY_emdash: number;
	const KEY_emfilledcircle: number;
	const KEY_emfilledrect: number;
	const KEY_emopencircle: number;
	const KEY_emopenrectangle: number;
	const KEY_emptyset: number;
	const KEY_emspace: number;
	const KEY_endash: number;
	const KEY_enfilledcircbullet: number;
	const KEY_enfilledsqbullet: number;
	const KEY_eng: number;
	const KEY_enopencircbullet: number;
	const KEY_enopensquarebullet: number;
	const KEY_enspace: number;
	const KEY_eogonek: number;
	const KEY_equal: number;
	const KEY_eth: number;
	const KEY_etilde: number;
	const KEY_exclam: number;
	const KEY_exclamdown: number;
	const KEY_ezh: number;
	const KEY_f: number;
	const KEY_fabovedot: number;
	const KEY_femalesymbol: number;
	const KEY_ff: number;
	const KEY_figdash: number;
	const KEY_filledlefttribullet: number;
	const KEY_filledrectbullet: number;
	const KEY_filledrighttribullet: number;
	const KEY_filledtribulletdown: number;
	const KEY_filledtribulletup: number;
	const KEY_fiveeighths: number;
	const KEY_fivesixths: number;
	const KEY_fivesubscript: number;
	const KEY_fivesuperior: number;
	const KEY_fourfifths: number;
	const KEY_foursubscript: number;
	const KEY_foursuperior: number;
	const KEY_fourthroot: number;
	const KEY_function: number;
	const KEY_g: number;
	const KEY_gabovedot: number;
	const KEY_gbreve: number;
	const KEY_gcaron: number;
	const KEY_gcedilla: number;
	const KEY_gcircumflex: number;
	const KEY_grave: number;
	const KEY_greater: number;
	const KEY_greaterthanequal: number;
	const KEY_guillemotleft: number;
	const KEY_guillemotright: number;
	const KEY_h: number;
	const KEY_hairspace: number;
	const KEY_hcircumflex: number;
	const KEY_heart: number;
	const KEY_hebrew_aleph: number;
	const KEY_hebrew_ayin: number;
	const KEY_hebrew_bet: number;
	const KEY_hebrew_beth: number;
	const KEY_hebrew_chet: number;
	const KEY_hebrew_dalet: number;
	const KEY_hebrew_daleth: number;
	const KEY_hebrew_doublelowline: number;
	const KEY_hebrew_finalkaph: number;
	const KEY_hebrew_finalmem: number;
	const KEY_hebrew_finalnun: number;
	const KEY_hebrew_finalpe: number;
	const KEY_hebrew_finalzade: number;
	const KEY_hebrew_finalzadi: number;
	const KEY_hebrew_gimel: number;
	const KEY_hebrew_gimmel: number;
	const KEY_hebrew_he: number;
	const KEY_hebrew_het: number;
	const KEY_hebrew_kaph: number;
	const KEY_hebrew_kuf: number;
	const KEY_hebrew_lamed: number;
	const KEY_hebrew_mem: number;
	const KEY_hebrew_nun: number;
	const KEY_hebrew_pe: number;
	const KEY_hebrew_qoph: number;
	const KEY_hebrew_resh: number;
	const KEY_hebrew_samech: number;
	const KEY_hebrew_samekh: number;
	const KEY_hebrew_shin: number;
	const KEY_hebrew_taf: number;
	const KEY_hebrew_taw: number;
	const KEY_hebrew_tet: number;
	const KEY_hebrew_teth: number;
	const KEY_hebrew_waw: number;
	const KEY_hebrew_yod: number;
	const KEY_hebrew_zade: number;
	const KEY_hebrew_zadi: number;
	const KEY_hebrew_zain: number;
	const KEY_hebrew_zayin: number;
	const KEY_hexagram: number;
	const KEY_horizconnector: number;
	const KEY_horizlinescan1: number;
	const KEY_horizlinescan3: number;
	const KEY_horizlinescan5: number;
	const KEY_horizlinescan7: number;
	const KEY_horizlinescan9: number;
	const KEY_hstroke: number;
	const KEY_ht: number;
	const KEY_hyphen: number;
	const KEY_i: number;
	const KEY_iTouch: number;
	const KEY_iacute: number;
	const KEY_ibelowdot: number;
	const KEY_ibreve: number;
	const KEY_icircumflex: number;
	const KEY_identical: number;
	const KEY_idiaeresis: number;
	const KEY_idotless: number;
	const KEY_ifonlyif: number;
	const KEY_igrave: number;
	const KEY_ihook: number;
	const KEY_imacron: number;
	const KEY_implies: number;
	const KEY_includedin: number;
	const KEY_includes: number;
	const KEY_infinity: number;
	const KEY_integral: number;
	const KEY_intersection: number;
	const KEY_iogonek: number;
	const KEY_itilde: number;
	const KEY_j: number;
	const KEY_jcircumflex: number;
	const KEY_jot: number;
	const KEY_k: number;
	const KEY_kana_A: number;
	const KEY_kana_CHI: number;
	const KEY_kana_E: number;
	const KEY_kana_FU: number;
	const KEY_kana_HA: number;
	const KEY_kana_HE: number;
	const KEY_kana_HI: number;
	const KEY_kana_HO: number;
	const KEY_kana_HU: number;
	const KEY_kana_I: number;
	const KEY_kana_KA: number;
	const KEY_kana_KE: number;
	const KEY_kana_KI: number;
	const KEY_kana_KO: number;
	const KEY_kana_KU: number;
	const KEY_kana_MA: number;
	const KEY_kana_ME: number;
	const KEY_kana_MI: number;
	const KEY_kana_MO: number;
	const KEY_kana_MU: number;
	const KEY_kana_N: number;
	const KEY_kana_NA: number;
	const KEY_kana_NE: number;
	const KEY_kana_NI: number;
	const KEY_kana_NO: number;
	const KEY_kana_NU: number;
	const KEY_kana_O: number;
	const KEY_kana_RA: number;
	const KEY_kana_RE: number;
	const KEY_kana_RI: number;
	const KEY_kana_RO: number;
	const KEY_kana_RU: number;
	const KEY_kana_SA: number;
	const KEY_kana_SE: number;
	const KEY_kana_SHI: number;
	const KEY_kana_SO: number;
	const KEY_kana_SU: number;
	const KEY_kana_TA: number;
	const KEY_kana_TE: number;
	const KEY_kana_TI: number;
	const KEY_kana_TO: number;
	const KEY_kana_TSU: number;
	const KEY_kana_TU: number;
	const KEY_kana_U: number;
	const KEY_kana_WA: number;
	const KEY_kana_WO: number;
	const KEY_kana_YA: number;
	const KEY_kana_YO: number;
	const KEY_kana_YU: number;
	const KEY_kana_a: number;
	const KEY_kana_closingbracket: number;
	const KEY_kana_comma: number;
	const KEY_kana_conjunctive: number;
	const KEY_kana_e: number;
	const KEY_kana_fullstop: number;
	const KEY_kana_i: number;
	const KEY_kana_middledot: number;
	const KEY_kana_o: number;
	const KEY_kana_openingbracket: number;
	const KEY_kana_switch: number;
	const KEY_kana_tsu: number;
	const KEY_kana_tu: number;
	const KEY_kana_u: number;
	const KEY_kana_ya: number;
	const KEY_kana_yo: number;
	const KEY_kana_yu: number;
	const KEY_kappa: number;
	const KEY_kcedilla: number;
	const KEY_kra: number;
	const KEY_l: number;
	const KEY_lacute: number;
	const KEY_latincross: number;
	const KEY_lbelowdot: number;
	const KEY_lcaron: number;
	const KEY_lcedilla: number;
	const KEY_leftanglebracket: number;
	const KEY_leftarrow: number;
	const KEY_leftcaret: number;
	const KEY_leftdoublequotemark: number;
	const KEY_leftmiddlecurlybrace: number;
	const KEY_leftopentriangle: number;
	const KEY_leftpointer: number;
	const KEY_leftradical: number;
	const KEY_leftshoe: number;
	const KEY_leftsinglequotemark: number;
	const KEY_leftt: number;
	const KEY_lefttack: number;
	const KEY_less: number;
	const KEY_lessthanequal: number;
	const KEY_lf: number;
	const KEY_logicaland: number;
	const KEY_logicalor: number;
	const KEY_lowleftcorner: number;
	const KEY_lowrightcorner: number;
	const KEY_lstroke: number;
	const KEY_m: number;
	const KEY_mabovedot: number;
	const KEY_macron: number;
	const KEY_malesymbol: number;
	const KEY_maltesecross: number;
	const KEY_marker: number;
	const KEY_masculine: number;
	const KEY_minus: number;
	const KEY_minutes: number;
	const KEY_mu: number;
	const KEY_multiply: number;
	const KEY_musicalflat: number;
	const KEY_musicalsharp: number;
	const KEY_n: number;
	const KEY_nabla: number;
	const KEY_nacute: number;
	const KEY_ncaron: number;
	const KEY_ncedilla: number;
	const KEY_ninesubscript: number;
	const KEY_ninesuperior: number;
	const KEY_nl: number;
	const KEY_nobreakspace: number;
	const KEY_notapproxeq: number;
	const KEY_notelementof: number;
	const KEY_notequal: number;
	const KEY_notidentical: number;
	const KEY_notsign: number;
	const KEY_ntilde: number;
	const KEY_numbersign: number;
	const KEY_numerosign: number;
	const KEY_o: number;
	const KEY_oacute: number;
	const KEY_obarred: number;
	const KEY_obelowdot: number;
	const KEY_ocaron: number;
	const KEY_ocircumflex: number;
	const KEY_ocircumflexacute: number;
	const KEY_ocircumflexbelowdot: number;
	const KEY_ocircumflexgrave: number;
	const KEY_ocircumflexhook: number;
	const KEY_ocircumflextilde: number;
	const KEY_odiaeresis: number;
	const KEY_odoubleacute: number;
	const KEY_oe: number;
	const KEY_ogonek: number;
	const KEY_ograve: number;
	const KEY_ohook: number;
	const KEY_ohorn: number;
	const KEY_ohornacute: number;
	const KEY_ohornbelowdot: number;
	const KEY_ohorngrave: number;
	const KEY_ohornhook: number;
	const KEY_ohorntilde: number;
	const KEY_omacron: number;
	const KEY_oneeighth: number;
	const KEY_onefifth: number;
	const KEY_onehalf: number;
	const KEY_onequarter: number;
	const KEY_onesixth: number;
	const KEY_onesubscript: number;
	const KEY_onesuperior: number;
	const KEY_onethird: number;
	const KEY_ooblique: number;
	const KEY_openrectbullet: number;
	const KEY_openstar: number;
	const KEY_opentribulletdown: number;
	const KEY_opentribulletup: number;
	const KEY_ordfeminine: number;
	const KEY_oslash: number;
	const KEY_otilde: number;
	const KEY_overbar: number;
	const KEY_overline: number;
	const KEY_p: number;
	const KEY_pabovedot: number;
	const KEY_paragraph: number;
	const KEY_parenleft: number;
	const KEY_parenright: number;
	const KEY_partdifferential: number;
	const KEY_partialderivative: number;
	const KEY_percent: number;
	const KEY_period: number;
	const KEY_periodcentered: number;
	const KEY_permille: number;
	const KEY_phonographcopyright: number;
	const KEY_plus: number;
	const KEY_plusminus: number;
	const KEY_prescription: number;
	const KEY_prolongedsound: number;
	const KEY_punctspace: number;
	const KEY_q: number;
	const KEY_quad: number;
	const KEY_question: number;
	const KEY_questiondown: number;
	const KEY_quotedbl: number;
	const KEY_quoteleft: number;
	const KEY_quoteright: number;
	const KEY_r: number;
	const KEY_racute: number;
	const KEY_radical: number;
	const KEY_rcaron: number;
	const KEY_rcedilla: number;
	const KEY_registered: number;
	const KEY_rightanglebracket: number;
	const KEY_rightarrow: number;
	const KEY_rightcaret: number;
	const KEY_rightdoublequotemark: number;
	const KEY_rightmiddlecurlybrace: number;
	const KEY_rightmiddlesummation: number;
	const KEY_rightopentriangle: number;
	const KEY_rightpointer: number;
	const KEY_rightshoe: number;
	const KEY_rightsinglequotemark: number;
	const KEY_rightt: number;
	const KEY_righttack: number;
	const KEY_s: number;
	const KEY_sabovedot: number;
	const KEY_sacute: number;
	const KEY_scaron: number;
	const KEY_scedilla: number;
	const KEY_schwa: number;
	const KEY_scircumflex: number;
	const KEY_script_switch: number;
	const KEY_seconds: number;
	const KEY_section: number;
	const KEY_semicolon: number;
	const KEY_semivoicedsound: number;
	const KEY_seveneighths: number;
	const KEY_sevensubscript: number;
	const KEY_sevensuperior: number;
	const KEY_signaturemark: number;
	const KEY_signifblank: number;
	const KEY_similarequal: number;
	const KEY_singlelowquotemark: number;
	const KEY_sixsubscript: number;
	const KEY_sixsuperior: number;
	const KEY_slash: number;
	const KEY_soliddiamond: number;
	const KEY_space: number;
	const KEY_squareroot: number;
	const KEY_ssharp: number;
	const KEY_sterling: number;
	const KEY_stricteq: number;
	const KEY_t: number;
	const KEY_tabovedot: number;
	const KEY_tcaron: number;
	const KEY_tcedilla: number;
	const KEY_telephone: number;
	const KEY_telephonerecorder: number;
	const KEY_therefore: number;
	const KEY_thinspace: number;
	const KEY_thorn: number;
	const KEY_threeeighths: number;
	const KEY_threefifths: number;
	const KEY_threequarters: number;
	const KEY_threesubscript: number;
	const KEY_threesuperior: number;
	const KEY_tintegral: number;
	const KEY_topintegral: number;
	const KEY_topleftparens: number;
	const KEY_topleftradical: number;
	const KEY_topleftsqbracket: number;
	const KEY_topleftsummation: number;
	const KEY_toprightparens: number;
	const KEY_toprightsqbracket: number;
	const KEY_toprightsummation: number;
	const KEY_topt: number;
	const KEY_topvertsummationconnector: number;
	const KEY_trademark: number;
	const KEY_trademarkincircle: number;
	const KEY_tslash: number;
	const KEY_twofifths: number;
	const KEY_twosubscript: number;
	const KEY_twosuperior: number;
	const KEY_twothirds: number;
	const KEY_u: number;
	const KEY_uacute: number;
	const KEY_ubelowdot: number;
	const KEY_ubreve: number;
	const KEY_ucircumflex: number;
	const KEY_udiaeresis: number;
	const KEY_udoubleacute: number;
	const KEY_ugrave: number;
	const KEY_uhook: number;
	const KEY_uhorn: number;
	const KEY_uhornacute: number;
	const KEY_uhornbelowdot: number;
	const KEY_uhorngrave: number;
	const KEY_uhornhook: number;
	const KEY_uhorntilde: number;
	const KEY_umacron: number;
	const KEY_underbar: number;
	const KEY_underscore: number;
	const KEY_union: number;
	const KEY_uogonek: number;
	const KEY_uparrow: number;
	const KEY_upcaret: number;
	const KEY_upleftcorner: number;
	const KEY_uprightcorner: number;
	const KEY_upshoe: number;
	const KEY_upstile: number;
	const KEY_uptack: number;
	const KEY_uring: number;
	const KEY_utilde: number;
	const KEY_v: number;
	const KEY_variation: number;
	const KEY_vertbar: number;
	const KEY_vertconnector: number;
	const KEY_voicedsound: number;
	const KEY_vt: number;
	const KEY_w: number;
	const KEY_wacute: number;
	const KEY_wcircumflex: number;
	const KEY_wdiaeresis: number;
	const KEY_wgrave: number;
	const KEY_x: number;
	const KEY_xabovedot: number;
	const KEY_y: number;
	const KEY_yacute: number;
	const KEY_ybelowdot: number;
	const KEY_ycircumflex: number;
	const KEY_ydiaeresis: number;
	const KEY_yen: number;
	const KEY_ygrave: number;
	const KEY_yhook: number;
	const KEY_ytilde: number;
	const KEY_z: number;
	const KEY_zabovedot: number;
	const KEY_zacute: number;
	const KEY_zcaron: number;
	const KEY_zerosubscript: number;
	const KEY_zerosuperior: number;
	const KEY_zstroke: number;
	const NO_FPU: number;
	const PATH_RELATIVE: number;
	const PRIORITY_REDRAW: number;
	const STAGE_TYPE: number;
	const WINDOWING_EGL: number;
	const WINDOWING_GLX: number;
	const WINDOWING_X11: number;
}
