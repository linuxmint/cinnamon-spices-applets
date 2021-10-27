declare namespace imports.gi.Atk {
    /** This construct is only for enabling class multi-inheritance,
     * use {@link GObjectAccessible} instead.
     */
    interface IGObjectAccessible {
        /**
         * Gets the GObject for which #obj is the accessible object.
         * @returns a #GObject which is the object for which #obj is
         * the accessible object
         */
        get_object(): GObject.Object;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link GObjectAccessible} instead.
     */
    type GObjectAccessibleMixin = IGObjectAccessible & IObject;

    /**
     * This object class is derived from AtkObject. It can be used as a
     * basis for implementing accessible objects for GObjects which are
     * not derived from GtkWidget. One example of its use is in providing
     * an accessible object for GnomeCanvasItem in the GAIL library.
     */
    interface GObjectAccessible extends GObjectAccessibleMixin { }

    class GObjectAccessible {
        constructor();
        /**
         * Gets the accessible object for the specified #obj.
         * @param obj a #GObject
         * @returns a {@link Object} which is the accessible object for
         * the #obj
         */
        static for_object(obj: GObject.Object): Object;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Hyperlink} instead.
     */
    interface IHyperlink {
        /**
         * Gets the index with the hypertext document at which this link ends.
         * @returns the index with the hypertext document at which this link ends
         */
        get_end_index(): number;
        /**
         * Gets the number of anchors associated with this hyperlink.
         * @returns the number of anchors associated with this hyperlink
         */
        get_n_anchors(): number;
        /**
         * Returns the item associated with this hyperlinks nth anchor.
         * For instance, the returned {@link Object} will implement #AtkText
         * if #link_ is a text hyperlink, #AtkImage if #link_ is an image
         * hyperlink etc.
         * 
         * Multiple anchors are primarily used by client-side image maps.
         * @param _i a (zero-index) integer specifying the desired anchor
         * @returns an {@link Object} associated with this hyperlinks
         * i-th anchor
         */
        get_object(_i: number): Object;
        /**
         * Gets the index with the hypertext document at which this link begins.
         * @returns the index with the hypertext document at which this link begins
         */
        get_start_index(): number;
        /**
         * Get a the URI associated with the anchor specified
         * by #i of #link_.
         * 
         * Multiple anchors are primarily used by client-side image maps.
         * @param _i a (zero-index) integer specifying the desired anchor
         * @returns a string specifying the URI
         */
        get_uri(_i: number): string;
        /**
         * Indicates whether the link currently displays some or all of its
         *           content inline.  Ordinary HTML links will usually return
         *           %FALSE, but an inline &lt;src&gt; HTML element will return
         *           %TRUE.
         * @returns whether or not this link displays its content inline.
         */
        is_inline(): boolean;
        /**
         * Determines whether this AtkHyperlink is selected
         * @returns True if the AtkHyperlink is selected, False otherwise
         */
        is_selected_link(): boolean;
        /**
         * Since the document that a link is associated with may have changed
         * this method returns %TRUE if the link is still valid (with
         * respect to the document it references) and %FALSE otherwise.
         * @returns whether or not this link is still valid
         */
        is_valid(): boolean;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Hyperlink} instead.
     */
    type HyperlinkMixin = IHyperlink & GObject.IObject & IAction;

    /**
     * An ATK object which encapsulates a link or set of links (for
     * instance in the case of client-side image maps) in a hypertext
     * document.  It may implement the AtkAction interface.  AtkHyperlink
     * may also be used to refer to inline embedded content, since it
     * allows specification of a start and end offset within the host
     * AtkHypertext object.
     */
    interface Hyperlink extends HyperlinkMixin { }

    class Hyperlink {
        constructor();
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Misc} instead.
     */
    interface IMisc {
        /**
         * Take the thread mutex for the GUI toolkit,
         * if one exists.
         * (This method is implemented by the toolkit ATK implementation layer;
         *  for instance, for GTK+, GAIL implements this via GDK_THREADS_ENTER).
         */
        threads_enter(): void;
        /**
         * Release the thread mutex for the GUI toolkit,
         * if one exists. This method, and atk_misc_threads_enter,
         * are needed in some situations by threaded application code which
         * services ATK requests, since fulfilling ATK requests often
         * requires calling into the GUI toolkit.  If a long-running or
         * potentially blocking call takes place inside such a block, it should
         * be bracketed by atk_misc_threads_leave/atk_misc_threads_enter calls.
         * (This method is implemented by the toolkit ATK implementation layer;
         *  for instance, for GTK+, GAIL implements this via GDK_THREADS_LEAVE).
         */
        threads_leave(): void;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Misc} instead.
     */
    type MiscMixin = IMisc & GObject.IObject;

    /**
     * A set of utility functions for thread locking. This interface and
     * all his related methods are deprecated since 2.12.
     */
    interface Misc extends MiscMixin { }

    class Misc {
        constructor();
        /**
         * Obtain the singleton instance of AtkMisc for this application.
         * @returns The singleton instance of AtkMisc for this application.
         */
        static get_instance(): Misc;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link NoOpObject} instead.
     */
    interface INoOpObject {

    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link NoOpObject} instead.
     */
    type NoOpObjectMixin = INoOpObject & IObject & IAction & IComponent & IDocument & IEditableText & IHypertext & IImage & ISelection & ITable & ITableCell & IText & IValue & IWindow;

    /**
     * An AtkNoOpObject is an AtkObject which purports to implement all
     * ATK interfaces. It is the type of AtkObject which is created if an
     * accessible object is requested for an object type for which no
     * factory type is specified.
     */
    // interface NoOpObject extends NoOpObjectMixin {}

    class NoOpObject {
        constructor();
        /**
         * Provides a default (non-functioning stub) {@link Object}.
         * Application maintainers should not use this method.
         * @param obj a #GObject
         * @returns a default (non-functioning stub) {@link Object}
         */
        static new(obj: GObject.Object): Object;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link NoOpObjectFactory} instead.
     */
    interface INoOpObjectFactory {

    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link NoOpObjectFactory} instead.
     */
    type NoOpObjectFactoryMixin = INoOpObjectFactory & IObjectFactory;

    /**
     * The AtkObjectFactory which creates an AtkNoOpObject. An instance of
     * this is created by an AtkRegistry if no factory type has not been
     * specified to create an accessible object of a particular type.
     */
    interface NoOpObjectFactory extends NoOpObjectFactoryMixin { }

    class NoOpObjectFactory {
        constructor();
        /**
         * Creates an instance of an {@link ObjectFactory} which generates primitive
         * (non-functioning) #AtkObjects.
         * @returns an instance of an {@link ObjectFactory}
         */
        static new(): ObjectFactory;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Object} instead.
     */
    interface IObject {
        /**
         * Adds a relationship of the specified type with the specified target.
         * @param relationship The {@link RelationType} of the relation
         * @param target The {@link Object} which is to be the target of the relation.
         * @returns TRUE if the relationship is added.
         */
        add_relationship(relationship: RelationType, target: Object): boolean;
        /**
         * Calls #handler on property changes.
         * @param handler a function to be called when a property changes its value
         * @returns a #guint which is the handler id used in
         *   atk_object_remove_property_change_handler()
         */
        connect_property_change_handler(handler: PropertyChangeHandler): number;
        /**
         * Gets the accessible id of the accessible.
         * @returns a character string representing the accessible id of the object, or
         * NULL if no such string was set.
         */
        get_accessible_id(): string;
        /**
         * Get a list of properties applied to this object as a whole, as an {@link AttributeSet} consisting of
         * name-value pairs. As such these attributes may be considered weakly-typed properties or annotations,
         * as distinct from strongly-typed object data available via other get/set methods.
         * Not all objects have explicit "name-value pair" #AtkAttributeSet properties.
         * @returns an {@link AttributeSet} consisting of all
         * explicit properties/annotations applied to the object, or an empty
         * set if the object has no name-value pair attributes assigned to
         * it. This #atkattributeset should be freed by a call to
         * atk_attribute_set_free().
         */
        get_attributes(): AttributeSet;
        /**
         * Gets the accessible description of the accessible.
         * @returns a character string representing the accessible description
         * of the accessible.
         */
        // get_description(): string;
        /**
         * Gets the 0-based index of this accessible in its parent; returns -1 if the
         * accessible does not have an accessible parent.
         * @returns an integer which is the index of the accessible in its parent
         */
        get_index_in_parent(): number;
        /**
         * Gets the layer of the accessible.
         * @returns an {@link Layer} which is the layer of the accessible
         */
        get_layer(): Layer;
        /**
         * Gets the zorder of the accessible. The value G_MININT will be returned
         * if the layer of the accessible is not ATK_LAYER_MDI.
         * @returns a gint which is the zorder of the accessible, i.e. the depth at
         * which the component is shown in relation to other components in the same
         * container.
         */
        get_mdi_zorder(): number;
        /**
         * Gets the number of accessible children of the accessible.
         * @returns an integer representing the number of accessible children
         * of the accessible.
         */
        get_n_accessible_children(): number;
        /**
         * Gets the accessible name of the accessible.
         * @returns a character string representing the accessible name of the object.
         */
        get_name(): string;
        /**
         * Gets a UTF-8 string indicating the POSIX-style LC_MESSAGES locale
         * of #accessible.
         * @returns a UTF-8 string indicating the POSIX-style LC_MESSAGES
         *          locale of #accessible.
         */
        get_object_locale(): string;
        /**
         * Gets the accessible parent of the accessible. By default this is
         * the one assigned with atk_object_set_parent(), but it is assumed
         * that ATK implementors have ways to get the parent of the object
         * without the need of assigning it manually with
         * atk_object_set_parent(), and will return it with this method.
         * 
         * If you are only interested on the parent assigned with
         * atk_object_set_parent(), use atk_object_peek_parent().
         * @returns an {@link Object} representing the accessible
         * parent of the accessible
         */
        get_parent(): Object;
        /**
         * Gets the role of the accessible.
         * @returns an {@link Role} which is the role of the accessible
         */
        get_role(): Role;
        /**
         * This function is called when implementing subclasses of {@link Object}.
         * It does initialization required for the new object. It is intended
         * that this function should called only in the ..._new() functions used
         * to create an instance of a subclass of #AtkObject
         * @param data a #gpointer which identifies the object for which the AtkObject was created.
         */
        initialize(data: any): void;
        /**
         * Emits a state-change signal for the specified state.
         * 
         * Note that as a general rule when the state of an existing object changes,
         * emitting a notification is expected.
         * @param state an {@link State} whose state is changed
         * @param value a gboolean which indicates whether the state is being set on or off
         */
        notify_state_change(state: State, value: boolean): void;
        /**
         * Gets the accessible parent of the accessible, if it has been
         * manually assigned with atk_object_set_parent. Otherwise, this
         * function returns %NULL.
         * 
         * This method is intended as an utility for ATK implementors, and not
         * to be exposed to accessible tools. See atk_object_get_parent() for
         * further reference.
         * @returns an {@link Object} representing the accessible
         * parent of the accessible if assigned
         */
        peek_parent(): Object;
        /**
         * Gets a reference to the specified accessible child of the object.
         * The accessible children are 0-based so the first accessible child is
         * at index 0, the second at index 1 and so on.
         * @param _i a gint representing the position of the child, starting from 0
         * @returns an {@link Object} representing the specified
         * accessible child of the accessible.
         */
        ref_accessible_child(_i: number): Object;
        /**
         * Gets the {@link RelationSet} associated with the object.
         * @returns an {@link RelationSet} representing the relation set
         * of the object.
         */
        ref_relation_set(): RelationSet;
        /**
         * Gets a reference to the state set of the accessible; the caller must
         * unreference it when it is no longer needed.
         * @returns a reference to an {@link StateSet} which is the state
         * set of the accessible
         */
        ref_state_set(): StateSet;
        /**
         * Removes a property change handler.
         * @param handler_id a guint which identifies the handler to be removed.
         */
        remove_property_change_handler(handler_id: number): void;
        /**
         * Removes a relationship of the specified type with the specified target.
         * @param relationship The {@link RelationType} of the relation
         * @param target The {@link Object} which is the target of the relation to be removed.
         * @returns TRUE if the relationship is removed.
         */
        remove_relationship(relationship: RelationType, target: Object): boolean;
        /**
         * Sets the accessible ID of the accessible.  This is not meant to be presented
         * to the user, but to be an ID which is stable over application development.
         * Typically, this is the gtkbuilder ID. Such an ID will be available for
         * instance to identify a given well-known accessible object for tailored screen
         * reading, or for automatic regression testing.
         * @param name a character string to be set as the accessible id
         */
        set_accessible_id(name: string): void;
        /**
         * Sets the accessible description of the accessible. You can't set
         * the description to NULL. This is reserved for the initial value. In
         * this aspect NULL is similar to ATK_ROLE_UNKNOWN. If you want to set
         * the name to a empty value you can use "".
         * @param description a character string to be set as the accessible description
         */
        set_description(description: string): void;
        /**
         * Sets the accessible name of the accessible. You can't set the name
         * to NULL. This is reserved for the initial value. In this aspect
         * NULL is similar to ATK_ROLE_UNKNOWN. If you want to set the name to
         * a empty value you can use "".
         * @param name a character string to be set as the accessible name
         */
        set_name(name: string): void;
        /**
         * Sets the accessible parent of the accessible. #parent can be NULL.
         * @param parent an {@link Object} to be set as the accessible parent
         */
        set_parent(parent: Object): void;
        /**
         * Sets the role of the accessible.
         * @param role an {@link Role} to be set as the role
         */
        set_role(role: Role): void;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Object} instead.
     */
    type ObjectMixin = IObject & GObject.IObject;

    /**
     * This class is the primary class for accessibility support via the
     * Accessibility ToolKit (ATK).  Objects which are instances of
     * {@link Object} (or instances of AtkObject-derived types) are queried
     * for properties which relate basic (and generic) properties of a UI
     * component such as name and description.  Instances of #AtkObject
     * may also be queried as to whether they implement other ATK
     * interfaces (e.g. #AtkAction, #AtkComponent, etc.), as appropriate
     * to the role which a given UI component plays in a user interface.
     * 
     * All UI components in an application which provide useful
     * information or services to the user must provide corresponding
     * #AtkObject instances on request (in GTK+, for instance, usually on
     * a call to #gtk_widget_get_accessible ()), either via ATK support
     * built into the toolkit for the widget class or ancestor class, or
     * in the case of custom widgets, if the inherited #AtkObject
     * implementation is insufficient, via instances of a new #AtkObject
     * subclass.
     * 
     * See also: #AtkObjectFactory, #AtkRegistry.  (GTK+ users see also
     * #GtkAccessible).
     */
    interface Object extends ObjectMixin { }

    class Object {
        constructor();
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link ObjectFactory} instead.
     */
    interface IObjectFactory {
        /**
         * Provides an {@link Object} that implements an accessibility interface
         * on behalf of #obj
         * @param obj a #GObject
         * @returns an {@link Object} that implements an accessibility
         * interface on behalf of #obj
         */
        create_accessible(obj: GObject.Object): Object;
        /**
         * Gets the GType of the accessible which is created by the factory.
         * @returns the type of the accessible which is created by the #factory.
         * The value G_TYPE_INVALID is returned if no type if found.
         */
        get_accessible_type(): GObject.Type;
        /**
         * Inform #factory that it is no longer being used to create
         * accessibles. When called, #factory may need to inform
         * {@link Objects} which it has created that they need to be re-instantiated.
         * Note: primarily used for runtime replacement of #AtkObjectFactorys
         * in object registries.
         */
        invalidate(): void;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link ObjectFactory} instead.
     */
    type ObjectFactoryMixin = IObjectFactory & GObject.IObject;

    /**
     * This class is the base object class for a factory used to create an
     * accessible object for a specific GType. The function
     * atk_registry_set_factory_type() is normally called to store in the
     * registry the factory type to be used to create an accessible of a
     * particular GType.
     */
    interface ObjectFactory extends ObjectFactoryMixin { }

    class ObjectFactory {
        constructor();
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Plug} instead.
     */
    interface IPlug {
        /**
         * Gets the unique ID of an {@link Plug} object, which can be used to
         * embed inside of an #AtkSocket using atk_socket_embed().
         * 
         * Internally, this calls a class function that should be registered
         * by the IPC layer (usually at-spi2-atk). The implementor of an
         * #AtkPlug object should call this function (after atk-bridge is
         * loaded) and pass the value to the process implementing the
         * #AtkSocket, so it could embed the plug.
         * @returns the unique ID for the plug
         */
        get_id(): string;
        /**
         * Sets #child as accessible child of #plug and #plug as accessible parent of
         * #child. #child can be NULL.
         * 
         * In some cases, one can not use the AtkPlug type directly as accessible
         * object for the toplevel widget of the application. For instance in the gtk
         * case, GtkPlugAccessible can not inherit both from GtkWindowAccessible and
         * from AtkPlug. In such a case, one can create, in addition to the standard
         * accessible object for the toplevel widget, an AtkPlug object, and make the
         * former the child of the latter by calling atk_plug_set_child().
         * @param child an {@link Object} to be set as accessible child of #plug.
         */
        set_child(child: Object): void;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Plug} instead.
     */
    type PlugMixin = IPlug & IObject & IComponent;

    /**
     * See {@link Socket}
     */
    interface Plug extends PlugMixin { }

    class Plug {
        constructor();
        /**
         * Creates a new {@link Plug} instance.
         * @returns the newly created {@link Plug}
         */
        static new(): Object;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Registry} instead.
     */
    interface IRegistry {
        /**
         * Gets an {@link ObjectFactory} appropriate for creating #AtkObjects
         * appropriate for #type.
         * @param _type a #GType with which to look up the associated {@link ObjectFactory}
         * @returns an {@link ObjectFactory} appropriate for creating
         * #AtkObjects appropriate for #type.
         */
        get_factory(_type: GObject.Type): ObjectFactory;
        /**
         * Provides a #GType indicating the {@link ObjectFactory} subclass
         * associated with #type.
         * @param _type a #GType with which to look up the associated {@link ObjectFactory}
         * subclass
         * @returns a #GType associated with type #type
         */
        get_factory_type(_type: GObject.Type): GObject.Type;
        /**
         * Associate an {@link ObjectFactory} subclass with a #GType. Note:
         * The associated #factory_type will thereafter be responsible for
         * the creation of new #AtkObject implementations for instances
         * appropriate for #type.
         * @param _type an {@link Object} type
         * @param factory_type an {@link ObjectFactory} type to associate with #type.  Must
         * implement AtkObject appropriate for #type.
         */
        set_factory_type(_type: GObject.Type, factory_type: GObject.Type): void;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Registry} instead.
     */
    type RegistryMixin = IRegistry & GObject.IObject;

    /**
     * The AtkRegistry is normally used to create appropriate ATK "peers"
     * for user interface components.  Application developers usually need
     * only interact with the AtkRegistry by associating appropriate ATK
     * implementation classes with GObject classes via the
     * atk_registry_set_factory_type call, passing the appropriate GType
     * for application custom widget classes.
     */
    interface Registry extends RegistryMixin { }

    class Registry {
        constructor();
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Relation} instead.
     */
    interface IRelation {
        /**
         * Adds the specified AtkObject to the target for the relation, if it is
         * not already present.  See also atk_object_add_relationship().
         * @param target an {@link Object}
         */
        add_target(target: Object): void;
        /**
         * Gets the type of #relation
         * @returns the type of #relation
         */
        get_relation_type(): RelationType;
        /**
         * Gets the target list of #relation
         * @returns 
         */
        get_target(): Object[];
        /**
         * Remove the specified AtkObject from the target for the relation.
         * @param target an {@link Object}
         * @returns TRUE if the removal is successful.
         */
        remove_target(target: Object): boolean;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Relation} instead.
     */
    type RelationMixin = IRelation & GObject.IObject;

    /**
     * An AtkRelation describes a relation between an object and one or
     * more other objects. The actual relations that an object has with
     * other objects are defined as an AtkRelationSet, which is a set of
     * AtkRelations.
     */
    interface Relation extends RelationMixin { }

    class Relation {
        constructor();
        /**
         * Create a new relation for the specified key and the specified list
         * of targets.  See also atk_object_add_relationship().
         * @param targets 
         * @param n_targets number of {@link Objects} pointed to by #targets
         * @param relationship an {@link RelationType} with which to create the new
         *  #AtkRelation
         * @returns a pointer to a new {@link Relation}
         */
        static new(targets: Object[], n_targets: number, relationship: RelationType): Relation;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link RelationSet} instead.
     */
    interface IRelationSet {
        /**
         * Add a new relation to the current relation set if it is not already
         * present.
         * This function ref's the AtkRelation so the caller of this function
         * should unref it to ensure that it will be destroyed when the AtkRelationSet
         * is destroyed.
         * @param relation an {@link Relation}
         */
        add(relation: Relation): void;
        /**
         * Add a new relation of the specified type with the specified target to
         * the current relation set if the relation set does not contain a relation
         * of that type. If it is does contain a relation of that typea the target
         * is added to the relation.
         * @param relationship an {@link RelationType}
         * @param target an {@link Object}
         */
        add_relation_by_type(relationship: RelationType, target: Object): void;
        /**
         * Determines whether the relation set contains a relation that matches the
         * specified type.
         * @param relationship an {@link RelationType}
         * @returns %TRUE if #relationship is the relationship type of a relation
         * in #set, %FALSE otherwise
         */
        contains(relationship: RelationType): boolean;
        /**
         * Determines whether the relation set contains a relation that
         * matches the specified pair formed by type #relationship and object
         * #target.
         * @param relationship an {@link RelationType}
         * @param target an {@link Object}
         * @returns %TRUE if #set contains a relation with the relationship
         * type #relationship with an object #target, %FALSE otherwise
         */
        contains_target(relationship: RelationType, target: Object): boolean;
        /**
         * Determines the number of relations in a relation set.
         * @returns an integer representing the number of relations in the set.
         */
        get_n_relations(): number;
        /**
         * Determines the relation at the specified position in the relation set.
         * @param _i a gint representing a position in the set, starting from 0.
         * @returns a {@link Relation}, which is the relation at
         * position i in the set.
         */
        get_relation(_i: number): Relation;
        /**
         * Finds a relation that matches the specified type.
         * @param relationship an {@link RelationType}
         * @returns an {@link Relation}, which is a relation matching the
         * specified type.
         */
        get_relation_by_type(relationship: RelationType): Relation;
        /**
         * Removes a relation from the relation set.
         * This function unref's the {@link Relation} so it will be deleted unless there
         * is another reference to it.
         * @param relation an {@link Relation}
         */
        remove(relation: Relation): void;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link RelationSet} instead.
     */
    type RelationSetMixin = IRelationSet & GObject.IObject;

    /**
     * The AtkRelationSet held by an object establishes its relationships
     * with objects beyond the normal "parent/child" hierarchical
     * relationships that all user interface objects have.
     * AtkRelationSets establish whether objects are labelled or
     * controlled by other components, share group membership with other
     * components (for instance within a radio-button group), or share
     * content which "flows" between them, among other types of possible
     * relationships.
     */
    interface RelationSet extends RelationSetMixin { }

    class RelationSet {
        constructor();
        /**
         * Creates a new empty relation set.
         * @returns a new {@link RelationSet}
         */
        static new(): RelationSet;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Socket} instead.
     */
    interface ISocket {
        /**
         * Embeds the children of an {@link Plug} as the children of the
         * #AtkSocket. The plug may be in the same process or in a different
         * process.
         * 
         * The class item used by this function should be filled in by the IPC
         * layer (usually at-spi2-atk). The implementor of the AtkSocket
         * should call this function and pass the id for the plug as returned
         * by atk_plug_get_id().  It is the responsibility of the application
         * to pass the plug id on to the process implementing the #AtkSocket
         * as needed.
         * @param plug_id the ID of an {@link Plug}
         */
        embed(plug_id: string): void;
        /**
         * Determines whether or not the socket has an embedded plug.
         * @returns TRUE if a plug is embedded in the socket
         */
        is_occupied(): boolean;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Socket} instead.
     */
    type SocketMixin = ISocket & IObject & IComponent;

    /**
     * Together with {@link Plug}, #AtkSocket provides the ability to embed
     * accessibles from one process into another in a fashion that is
     * transparent to assistive technologies. #AtkSocket works as the
     * container of #AtkPlug, embedding it using the method
     * atk_socket_embed(). Any accessible contained in the #AtkPlug will
     * appear to the assistive technologies as being inside the
     * application that created the #AtkSocket.
     * 
     * The communication between a #AtkSocket and a #AtkPlug is done by
     * the IPC layer of the accessibility framework, normally implemented
     * by the D-Bus based implementation of AT-SPI (at-spi2). If that is
     * the case, at-spi-atk2 is the responsible to implement the abstract
     * methods atk_plug_get_id() and atk_socket_embed(), so an ATK
     * implementor shouldn't reimplement them. The process that contains
     * the #AtkPlug is responsible to send the ID returned by
     * atk_plug_id() to the process that contains the #AtkSocket, so it
     * could call the method atk_socket_embed() in order to embed it.
     * 
     * For the same reasons, an implementor doesn't need to implement
     * atk_object_get_n_accessible_children() and
     * atk_object_ref_accessible_child(). All the logic related to those
     * functions will be implemented by the IPC layer.
     */
    interface Socket extends SocketMixin { }

    class Socket {
        constructor();
        /**
         * Creates a new {@link Socket}.
         * @returns the newly created {@link Socket} instance
         */
        static new(): Object;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link StateSet} instead.
     */
    interface IStateSet {
        /**
         * Adds the state of the specified type to the state set if it is not already
         * present.
         * 
         * Note that because an {@link StateSet} is a read-only object, this method should
         * be used to add a state to a newly-created set which will then be returned by
         * #atk_object_ref_state_set. It should not be used to modify the existing state
         * of an object. See also #atk_object_notify_state_change.
         * @param _type an {@link StateType}
         * @returns %TRUE if  the state for #type is not already in #set.
         */
        add_state(_type: StateType): boolean;
        /**
         * Adds the states of the specified types to the state set.
         * 
         * Note that because an {@link StateSet} is a read-only object, this method should
         * be used to add states to a newly-created set which will then be returned by
         * #atk_object_ref_state_set. It should not be used to modify the existing state
         * of an object. See also #atk_object_notify_state_change.
         * @param types 
         * @param n_types The number of elements in the array
         */
        add_states(types: StateType[], n_types: number): void;
        /**
         * Constructs the intersection of the two sets, returning %NULL if the
         * intersection is empty.
         * @param compare_set another {@link StateSet}
         * @returns a new {@link StateSet} which is the intersection of
         * the two sets.
         */
        and_sets(compare_set: StateSet): StateSet;
        /**
         * Removes all states from the state set.
         */
        clear_states(): void;
        /**
         * Checks whether the state for the specified type is in the specified set.
         * @param _type an {@link StateType}
         * @returns %TRUE if #type is the state type is in #set.
         */
        contains_state(_type: StateType): boolean;
        /**
         * Checks whether the states for all the specified types are in the
         * specified set.
         * @param types 
         * @param n_types The number of elements in the array
         * @returns %TRUE if all the states for #type are in #set.
         */
        contains_states(types: StateType[], n_types: number): boolean;
        /**
         * Checks whether the state set is empty, i.e. has no states set.
         * @returns %TRUE if #set has no states set, otherwise %FALSE
         */
        is_empty(): boolean;
        /**
         * Constructs the union of the two sets.
         * @param compare_set another {@link StateSet}
         * @returns a new {@link StateSet} which is
         * the union of the two sets, returning %NULL is empty.
         */
        or_sets(compare_set: StateSet): StateSet;
        /**
         * Removes the state for the specified type from the state set.
         * 
         * Note that because an {@link StateSet} is a read-only object, this method should
         * be used to remove a state to a newly-created set which will then be returned
         * by #atk_object_ref_state_set. It should not be used to modify the existing
         * state of an object. See also #atk_object_notify_state_change.
         * @param _type an {@link Type}
         * @returns %TRUE if #type was the state type is in #set.
         */
        remove_state(_type: StateType): boolean;
        /**
         * Constructs the exclusive-or of the two sets, returning %NULL is empty.
         * The set returned by this operation contains the states in exactly
         * one of the two sets.
         * @param compare_set another {@link StateSet}
         * @returns a new {@link StateSet} which contains the states
         * which are in exactly one of the two sets.
         */
        xor_sets(compare_set: StateSet): StateSet;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link StateSet} instead.
     */
    type StateSetMixin = IStateSet & GObject.IObject;

    /**
     * An AtkStateSet is a read-only representation of the full set of {@link States}
     * that apply to an object at a given time. This set is not meant to be
     * modified, but rather created when #atk_object_ref_state_set() is called.
     */
    interface StateSet extends StateSetMixin { }

    class StateSet {
        constructor();
        /**
         * Creates a new empty state set.
         * @returns a new {@link StateSet}
         */
        static new(): StateSet;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Util} instead.
     */
    interface IUtil {

    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Util} instead.
     */
    type UtilMixin = IUtil & GObject.IObject;

    /**
     * A set of ATK utility functions which are used to support event
     * registration of various types, and obtaining the 'root' accessible
     * of a process and information about the current ATK implementation
     * and toolkit version.
     */
    interface Util extends UtilMixin { }

    class Util {
        constructor();
    }

    /**
     * The {@link Action} interface should be supported by any object that can
     * perform one or more actions. The interface provides the standard
     * mechanism for an assistive technology to determine what those actions
     * are as well as tell the object to perform them. Any object that can
     * be manipulated should support this interface.
     */
    class ActionIface {
        public parent: GObject.TypeInterface;
        do_action: { (action: Action, _i: number): boolean; };
        get_n_actions: { (action: Action): number; };
        get_description: { (action: Action, _i: number): string; };
        get_name: { (action: Action, _i: number): string; };
        get_keybinding: { (action: Action, _i: number): string; };
        set_description: { (action: Action, _i: number, desc: string): boolean; };
        get_localized_name: { (action: Action, _i: number): string; };
    }

    /**
     * AtkAttribute is a string name/value pair representing a generic
     * attribute. This can be used to expose additional information from
     * an accessible object as a whole (see atk_object_get_attributes())
     * or an document (see atk_document_get_attributes()). In the case of
     * text attributes (see atk_text_get_default_attributes()),
     * {@link TextAttribute} enum defines all the possible text attribute
     * names. You can use atk_text_attribute_get_name() to get the string
     * name from the enum value. See also atk_text_attribute_for_name()
     * and atk_text_attribute_get_value() for more information.
     * 
     * A string name/value pair representing a generic attribute.
     */
    class Attribute {
        public name: string;
        public value: string;
    }

    /**
     * The AtkComponent interface should be supported by any object that is
     * rendered on the screen. The interface provides the standard mechanism
     * for an assistive technology to determine and set the graphical
     * representation of an object.
     */
    class ComponentIface {
        public parent: GObject.TypeInterface;
        add_focus_handler: { (component: Component, handler: FocusHandler): number; };
        contains: { (component: Component, _x: number, _y: number, coord_type: CoordType): boolean; };
        ref_accessible_at_point: { (component: Component, _x: number, _y: number, coord_type: CoordType): Object; };
        get_extents: { (component: Component, _x: number, _y: number, width: number, height: number, coord_type: CoordType): void; };
        get_position: { (component: Component, _x: number, _y: number, coord_type: CoordType): void; };
        get_size: { (component: Component, width: number, height: number): void; };
        grab_focus: { (component: Component): boolean; };
        remove_focus_handler: { (component: Component, handler_id: number): void; };
        set_extents: { (component: Component, _x: number, _y: number, width: number, height: number, coord_type: CoordType): boolean; };
        set_position: { (component: Component, _x: number, _y: number, coord_type: CoordType): boolean; };
        set_size: { (component: Component, width: number, height: number): boolean; };
        get_layer: { (component: Component): Layer; };
        get_mdi_zorder: { (component: Component): number; };
        bounds_changed: { (component: Component, bounds: Rectangle): void; };
        get_alpha: { (component: Component): number; };
        scroll_to: { (component: Component, _type: ScrollType): boolean; };
        scroll_to_point: { (component: Component, coords: CoordType, _x: number, _y: number): boolean; };
    }

    class DocumentIface {
        public parent: GObject.TypeInterface;
        get_document_type: { (document: Document): string; };
        get_document: { (document: Document): any; };
        get_document_locale: { (document: Document): string; };
        get_document_attributes: { (document: Document): AttributeSet; };
        get_document_attribute_value: { (document: Document, attribute_name: string): string; };
        set_document_attribute: { (document: Document, attribute_name: string, attribute_value: string): boolean; };
        get_current_page_number: { (document: Document): number; };
        get_page_count: { (document: Document): number; };
    }

    class EditableTextIface {
        public parent_interface: GObject.TypeInterface;
        set_run_attributes: { (text: EditableText, attrib_set: AttributeSet, start_offset: number, end_offset: number): boolean; };
        set_text_contents: { (text: EditableText, string: string): void; };
        insert_text: { (text: EditableText, string: string, length: number, position: number): void; };
        copy_text: { (text: EditableText, start_pos: number, end_pos: number): void; };
        cut_text: { (text: EditableText, start_pos: number, end_pos: number): void; };
        delete_text: { (text: EditableText, start_pos: number, end_pos: number): void; };
        paste_text: { (text: EditableText, position: number): void; };
    }

    class GObjectAccessibleClass {
        public parent_class: ObjectClass;
        public pad1: Function;
        public pad2: Function;
    }

    class HyperlinkClass {
        public parent: GObject.ObjectClass;
        public pad1: Function;
        get_uri: { (link_: Hyperlink, _i: number): string; };
        get_object: { (link_: Hyperlink, _i: number): Object; };
        get_end_index: { (link_: Hyperlink): number; };
        get_start_index: { (link_: Hyperlink): number; };
        is_valid: { (link_: Hyperlink): boolean; };
        get_n_anchors: { (link_: Hyperlink): number; };
        link_state: { (link_: Hyperlink): number; };
        is_selected_link: { (link_: Hyperlink): boolean; };
        link_activated: { (link_: Hyperlink): void; };
    }

    class HyperlinkImplIface {
        public parent: GObject.TypeInterface;
        get_hyperlink: { (_impl: HyperlinkImpl): Hyperlink; };
    }

    class HypertextIface {
        public parent: GObject.TypeInterface;
        get_link: { (hypertext: Hypertext, link_index: number): Hyperlink; };
        get_n_links: { (hypertext: Hypertext): number; };
        get_link_index: { (hypertext: Hypertext, char_index: number): number; };
        link_selected: { (hypertext: Hypertext, link_index: number): void; };
    }

    class ImageIface {
        public parent: GObject.TypeInterface;
        get_image_position: { (image: Image, _x: number, _y: number, coord_type: CoordType): void; };
        get_image_description: { (image: Image): string; };
        get_image_size: { (image: Image, width: number, height: number): void; };
        set_image_description: { (image: Image, description: string): boolean; };
        get_image_locale: { (image: Image): string; };
    }

    class Implementor {
        /**
         * Gets a reference to an object's {@link Object} implementation, if
         * the object implements #AtkObjectIface
         * @returns a reference to an object's {@link Object}
         * implementation
         */
        public ref_accessible(): Object;
    }

    /**
     * Encapsulates information about a key event.
     */
    class KeyEventStruct {
        public type: number;
        public state: number;
        public keyval: number;
        public length: number;
        public string: string;
        public keycode: number;
        public timestamp: number;
    }

    /**
     * Usage of AtkMisc is deprecated since 2.12 and heavily discouraged.
     */
    class MiscClass {
        public parent: GObject.ObjectClass;
        public vfuncs: any[];
        threads_enter: { (misc: Misc): void; };
        threads_leave: { (misc: Misc): void; };
    }

    class NoOpObjectClass {
        public parent_class: ObjectClass;
    }

    class NoOpObjectFactoryClass {
        public parent_class: ObjectFactoryClass;
    }

    class ObjectClass {
        public parent: GObject.ObjectClass;
        public pad1: Function;
        get_name: { (accessible: Object): string; };
        get_description: { (accessible: Object): string; };
        get_parent: { (accessible: Object): Object; };
        get_n_children: { (accessible: Object): number; };
        ref_child: { (accessible: Object, _i: number): Object; };
        get_index_in_parent: { (accessible: Object): number; };
        ref_relation_set: { (accessible: Object): RelationSet; };
        get_role: { (accessible: Object): Role; };
        get_layer: { (accessible: Object): Layer; };
        get_mdi_zorder: { (accessible: Object): number; };
        ref_state_set: { (accessible: Object): StateSet; };
        set_name: { (accessible: Object, name: string): void; };
        set_description: { (accessible: Object, description: string): void; };
        set_parent: { (accessible: Object, parent: Object): void; };
        set_role: { (accessible: Object, role: Role): void; };
        connect_property_change_handler: { (accessible: Object, handler: PropertyChangeHandler): number; };
        remove_property_change_handler: { (accessible: Object, handler_id: number): void; };
        initialize: { (accessible: Object, data: any): void; };
        children_changed: { (accessible: Object, change_index: number, changed_child: any): void; };
        focus_event: { (accessible: Object, focus_in: boolean): void; };
        property_change: { (accessible: Object, values: PropertyValues): void; };
        state_change: { (accessible: Object, name: string, state_set: boolean): void; };
        visible_data_changed: { (accessible: Object): void; };
        active_descendant_changed: { (accessible: Object, child: any): void; };
        get_attributes: { (accessible: Object): AttributeSet; };
        get_object_locale: { (accessible: Object): string; };
    }

    class ObjectFactoryClass {
        public parent_class: GObject.ObjectClass;
        public pad1: Function;
        public pad2: Function;
        create_accessible: { (obj: GObject.Object): Object; };
        invalidate: { (factory: ObjectFactory): void; };
        get_accessible_type: { (): GObject.Type; };
    }

    class PlugClass {
        public parent_class: ObjectClass;
        get_object_id: { (obj: Plug): string; };
    }

    /**
     * Note: #old_value field of {@link PropertyValues} will not contain a
     * valid value. This is a field defined with the purpose of contain
     * the previous value of the property, but is not used anymore.
     */
    class PropertyValues {
        public property_name: string;
        public old_value: GObject.Value;
        public new_value: GObject.Value;
    }

    /**
     * {@link Range} are used on #AtkValue, in order to represent the full
     * range of a given component (for example an slider or a range
     * control), or to define each individual subrange this full range is
     * splitted if available. See #AtkValue documentation for further
     * details.
     */
    class Range {
        /**
         * Creates a new {@link Range}.
         * @param lower_limit inferior limit for this range
         * @param upper_limit superior limit for this range
         * @param description human readable description of this range.
         * @returns a new {@link Range}
         */
        static new(lower_limit: number, upper_limit: number, description: string): Range;
        /**
         * Returns a new {@link Range} that is a exact copy of #src
         * @returns a new {@link Range} copy of #src
         */
        public copy(): Range;
        /**
         * Free #range
         */
        public free(): void;
        /**
         * Returns the human readable description of #range
         * @returns the human-readable description of #range
         */
        public get_description(): string;
        /**
         * Returns the lower limit of #range
         * @returns the lower limit of #range
         */
        public get_lower_limit(): number;
        /**
         * Returns the upper limit of #range
         * @returns the upper limit of #range
         */
        public get_upper_limit(): number;
    }

    /**
     * A data structure for holding a rectangle. Those coordinates are
     * relative to the component top-level parent.
     */
    class Rectangle {
        public x: number;
        public y: number;
        public width: number;
        public height: number;
    }

    class RegistryClass {
        public parent_class: GObject.ObjectClass;
    }

    class RelationClass {
        public parent: GObject.ObjectClass;
    }

    class RelationSetClass {
        public parent: GObject.ObjectClass;
        public pad1: Function;
        public pad2: Function;
    }

    class SelectionIface {
        public parent: GObject.TypeInterface;
        add_selection: { (selection: Selection, _i: number): boolean; };
        clear_selection: { (selection: Selection): boolean; };
        ref_selection: { (selection: Selection, _i: number): Object; };
        get_selection_count: { (selection: Selection): number; };
        is_child_selected: { (selection: Selection, _i: number): boolean; };
        remove_selection: { (selection: Selection, _i: number): boolean; };
        select_all_selection: { (selection: Selection): boolean; };
        selection_changed: { (selection: Selection): void; };
    }

    class SocketClass {
        public parent_class: ObjectClass;
        embed: { (obj: Socket, plug_id: string): void; };
    }

    class StateSetClass {
        public parent: GObject.ObjectClass;
    }

    class StreamableContentIface {
        public parent: GObject.TypeInterface;
        public pad1: Function;
        public pad2: Function;
        public pad3: Function;
        get_n_mime_types: { (streamable: StreamableContent): number; };
        get_mime_type: { (streamable: StreamableContent, _i: number): string; };
        get_stream: { (streamable: StreamableContent, mime_type: string): GLib.IOChannel; };
        get_uri: { (streamable: StreamableContent, mime_type: string): string; };
    }

    /**
     * AtkTableCell is an interface for cells inside an {@link Table}.
     */
    class TableCellIface {
        public parent: GObject.TypeInterface;
        get_column_span: { (cell: TableCell): number; };
        get_column_header_cells: { (cell: TableCell): Object[]; };
        get_position: { (cell: TableCell, _row: number, column: number): boolean; };
        get_row_span: { (cell: TableCell): number; };
        get_row_header_cells: { (cell: TableCell): Object[]; };
        get_row_column_span: { (cell: TableCell, _row: number, column: number, row_span: number, column_span: number): boolean; };
        get_table: { (cell: TableCell): Object; };
    }

    class TableIface {
        public parent: GObject.TypeInterface;
        ref_at: { (table: Table, _row: number, column: number): Object; };
        get_index_at: { (table: Table, _row: number, column: number): number; };
        get_column_at_index: { (table: Table, index_: number): number; };
        get_row_at_index: { (table: Table, index_: number): number; };
        get_n_columns: { (table: Table): number; };
        get_n_rows: { (table: Table): number; };
        get_column_extent_at: { (table: Table, _row: number, column: number): number; };
        get_row_extent_at: { (table: Table, _row: number, column: number): number; };
        get_caption: { (table: Table): Object; };
        get_column_description: { (table: Table, column: number): string; };
        get_column_header: { (table: Table, column: number): Object; };
        get_row_description: { (table: Table, _row: number): string; };
        get_row_header: { (table: Table, _row: number): Object; };
        get_summary: { (table: Table): Object; };
        set_caption: { (table: Table, caption: Object): void; };
        set_column_description: { (table: Table, column: number, description: string): void; };
        set_column_header: { (table: Table, column: number, header: Object): void; };
        set_row_description: { (table: Table, _row: number, description: string): void; };
        set_row_header: { (table: Table, _row: number, header: Object): void; };
        set_summary: { (table: Table, accessible: Object): void; };
        get_selected_columns: { (table: Table, selected: number): number; };
        get_selected_rows: { (table: Table, selected: number): number; };
        is_column_selected: { (table: Table, column: number): boolean; };
        is_row_selected: { (table: Table, _row: number): boolean; };
        is_selected: { (table: Table, _row: number, column: number): boolean; };
        add_row_selection: { (table: Table, _row: number): boolean; };
        remove_row_selection: { (table: Table, _row: number): boolean; };
        add_column_selection: { (table: Table, column: number): boolean; };
        remove_column_selection: { (table: Table, column: number): boolean; };
        row_inserted: { (table: Table, _row: number, num_inserted: number): void; };
        column_inserted: { (table: Table, column: number, num_inserted: number): void; };
        row_deleted: { (table: Table, _row: number, num_deleted: number): void; };
        column_deleted: { (table: Table, column: number, num_deleted: number): void; };
        row_reordered: { (table: Table): void; };
        column_reordered: { (table: Table): void; };
        model_changed: { (table: Table): void; };
    }

    class TextIface {
        public parent: GObject.TypeInterface;
        get_text: { (text: Text, start_offset: number, end_offset: number): string; };
        get_text_after_offset: { (text: Text, offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number): string; };
        get_text_at_offset: { (text: Text, offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number): string; };
        get_character_at_offset: { (text: Text, offset: number): string; };
        get_text_before_offset: { (text: Text, offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number): string; };
        get_caret_offset: { (text: Text): number; };
        get_run_attributes: { (text: Text, offset: number, start_offset: number, end_offset: number): AttributeSet; };
        get_default_attributes: { (text: Text): AttributeSet; };
        get_character_extents: { (text: Text, offset: number, _x: number, _y: number, width: number, height: number, coords: CoordType): void; };
        get_character_count: { (text: Text): number; };
        get_offset_at_point: { (text: Text, _x: number, _y: number, coords: CoordType): number; };
        get_n_selections: { (text: Text): number; };
        get_selection: { (text: Text, selection_num: number, start_offset: number, end_offset: number): string; };
        add_selection: { (text: Text, start_offset: number, end_offset: number): boolean; };
        remove_selection: { (text: Text, selection_num: number): boolean; };
        set_selection: { (text: Text, selection_num: number, start_offset: number, end_offset: number): boolean; };
        set_caret_offset: { (text: Text, offset: number): boolean; };
        text_changed: { (text: Text, position: number, length: number): void; };
        text_caret_moved: { (text: Text, location: number): void; };
        text_selection_changed: { (text: Text): void; };
        text_attributes_changed: { (text: Text): void; };
        get_range_extents: { (text: Text, start_offset: number, end_offset: number, coord_type: CoordType, rect: TextRectangle): void; };
        get_bounded_ranges: { (text: Text, rect: TextRectangle, coord_type: CoordType, x_clip_type: TextClipType, y_clip_type: TextClipType): TextRange[]; };
        get_string_at_offset: { (text: Text, offset: number, granularity: TextGranularity, start_offset: number, end_offset: number): string; };
        scroll_substring_to: { (text: Text, start_offset: number, end_offset: number, _type: ScrollType): boolean; };
        scroll_substring_to_point: { (text: Text, start_offset: number, end_offset: number, coords: CoordType, _x: number, _y: number): boolean; };
    }

    /**
     * A structure used to describe a text range.
     */
    class TextRange {
        public bounds: TextRectangle;
        public start_offset: number;
        public end_offset: number;
        public content: string;
    }

    /**
     * A structure used to store a rectangle used by AtkText.
     */
    class TextRectangle {
        public x: number;
        public y: number;
        public width: number;
        public height: number;
    }

    class UtilClass {
        public parent: GObject.ObjectClass;
        add_global_event_listener: { (listener: GObject.SignalEmissionHook, event_type: string): number; };
        remove_global_event_listener: { (listener_id: number): void; };
        add_key_event_listener: { (listener: KeySnoopFunc, data: any): number; };
        remove_key_event_listener: { (listener_id: number): void; };
        get_root: { (): Object; };
        get_toolkit_name: { (): string; };
        get_toolkit_version: { (): string; };
    }

    class ValueIface {
        public parent: GObject.TypeInterface;
        get_current_value: { (obj: Value, value: GObject.Value): void; };
        get_maximum_value: { (obj: Value, value: GObject.Value): void; };
        get_minimum_value: { (obj: Value, value: GObject.Value): void; };
        set_current_value: { (obj: Value, value: GObject.Value): boolean; };
        get_minimum_increment: { (obj: Value, value: GObject.Value): void; };
        get_value_and_text: { (obj: Value, value: number, text: string): void; };
        get_range: { (obj: Value): Range; };
        get_increment: { (obj: Value): number; };
        get_sub_ranges: { (obj: Value): GLib.SList; };
        set_value: { (obj: Value, new_value: number): void; };
    }

    class WindowIface {
        public parent: GObject.TypeInterface;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Action} instead.
     */
    interface IAction {
        /**
         * Perform the specified action on the object.
         * @param _i the action index corresponding to the action to be performed
         * @returns %TRUE if success, %FALSE otherwise
         */
        // do_action(_i: number): boolean;
        /**
         * Returns a description of the specified action of the object.
         * @param _i the action index corresponding to the action to be performed
         * @returns a description string, or %NULL if #action does
         * not implement this interface.
         */
        // get_description(_i: number): string;
        /**
         * Gets the keybinding which can be used to activate this action, if one
         * exists. The string returned should contain localized, human-readable,
         * key sequences as they would appear when displayed on screen. It must
         * be in the format "mnemonic;sequence;shortcut".
         * 
         * - The mnemonic key activates the object if it is presently enabled onscreen.
         *   This typically corresponds to the underlined letter within the widget.
         *   Example: "n" in a traditional "New..." menu item or the "a" in "Apply" for
         *   a button.
         * - The sequence is the full list of keys which invoke the action even if the
         *   relevant element is not currently shown on screen. For instance, for a menu
         *   item the sequence is the keybindings used to open the parent menus before
         *   invoking. The sequence string is colon-delimited. Example: "Alt+F:N" in a
         *   traditional "New..." menu item.
         * - The shortcut, if it exists, will invoke the same action without showing
         *   the component or its enclosing menus or dialogs. Example: "Ctrl+N" in a
         *   traditional "New..." menu item.
         * 
         * Example: For a traditional "New..." menu item, the expected return value
         * would be: "N;Alt+F:N;Ctrl+N" for the English locale and "N;Alt+D:N;Strg+N"
         * for the German locale. If, hypothetically, this menu item lacked a mnemonic,
         * it would be represented by ";;Ctrl+N" and ";;Strg+N" respectively.
         * @param _i the action index corresponding to the action to be performed
         * @returns the keybinding which can be used to activate
         * this action, or %NULL if there is no keybinding for this action.
         */
        // get_keybinding(_i: number): string;
        /**
         * Returns the localized name of the specified action of the object.
         * @param _i the action index corresponding to the action to be performed
         * @returns a name string, or %NULL if #action does not
         * implement this interface.
         */
        // get_localized_name(_i: number): string;
        /**
         * Gets the number of accessible actions available on the object.
         * If there are more than one, the first one is considered the
         * "default" action of the object.
         * @returns a the number of actions, or 0 if #action does not
         * implement this interface.
         */
        // get_n_actions(): number;
        /**
         * Returns a non-localized string naming the specified action of the
         * object. This name is generally not descriptive of the end result
         * of the action, but instead names the 'interaction type' which the
         * object supports. By convention, the above strings should be used to
         * represent the actions which correspond to the common point-and-click
         * interaction techniques of the same name: i.e.
         * "click", "press", "release", "drag", "drop", "popup", etc.
         * The "popup" action should be used to pop up a context menu for the
         * object, if one exists.
         * 
         * For technical reasons, some toolkits cannot guarantee that the
         * reported action is actually 'bound' to a nontrivial user event;
         * i.e. the result of some actions via atk_action_do_action() may be
         * NIL.
         * @param _i the action index corresponding to the action to be performed
         * @returns a name string, or %NULL if #action does not
         * implement this interface.
         */
        // get_name(_i: number): string;
        /**
         * Sets a description of the specified action of the object.
         * @param _i the action index corresponding to the action to be performed
         * @param desc the description to be assigned to this action
         * @returns a gboolean representing if the description was successfully set;
         */
        // set_description(_i: number, desc: string): boolean;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Action} instead.
     */
    type ActionMixin = IAction;

    /**
     * {@link Action} should be implemented by instances of #AtkObject classes
     * with which the user can interact directly, i.e. buttons,
     * checkboxes, scrollbars, e.g. components which are not "passive"
     * providers of UI information.
     * 
     * Exceptions: when the user interaction is already covered by another
     * appropriate interface such as #AtkEditableText (insert/delete text,
     * etc.) or #AtkValue (set value) then these actions should not be
     * exposed by #AtkAction as well.
     * 
     * Though most UI interactions on components should be invocable via
     * keyboard as well as mouse, there will generally be a close mapping
     * between "mouse actions" that are possible on a component and the
     * AtkActions.  Where mouse and keyboard actions are redundant in
     * effect, #AtkAction should expose only one action rather than
     * exposing redundant actions if possible.  By convention we have been
     * using "mouse centric" terminology for #AtkAction names.
     */
    interface Action extends ActionMixin { }

    class Action {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link Component} instead.
     */
    interface IComponent {
        /**
         * Add the specified handler to the set of functions to be called
         * when this object receives focus events (in or out). If the handler is
         * already added it is not added again
         * @param handler The {@link FocusHandler} to be attached to #component
         * @returns a handler id which can be used in atk_component_remove_focus_handler()
         * or zero if the handler was already added.
         */
        add_focus_handler(handler: FocusHandler): number;
        /**
         * Checks whether the specified point is within the extent of the #component.
         * 
         * Toolkit implementor note: ATK provides a default implementation for
         * this virtual method. In general there are little reason to
         * re-implement it.
         * @param _x x coordinate
         * @param _y y coordinate
         * @param coord_type specifies whether the coordinates are relative to the screen
         * or to the components top level window
         * @returns %TRUE or %FALSE indicating whether the specified point is within
         * the extent of the #component or not
         */
        contains(_x: number, _y: number, coord_type: CoordType): boolean;
        /**
         * Returns the alpha value (i.e. the opacity) for this
         * #component, on a scale from 0 (fully transparent) to 1.0
         * (fully opaque).
         * @returns An alpha value from 0 to 1.0, inclusive.
         */
        get_alpha(): number;
        /**
         * Gets the rectangle which gives the extent of the #component.
         * 
         * If the extent can not be obtained (e.g. a non-embedded plug or missing
         * support), all of x, y, width, height are set to -1.
         * @param _x address of #gint to put x coordinate
         * @param _y address of #gint to put y coordinate
         * @param width address of #gint to put width
         * @param height address of #gint to put height
         * @param coord_type specifies whether the coordinates are relative to the screen
         * or to the components top level window
         */
        get_extents(_x: number, _y: number, width: number, height: number, coord_type: CoordType): void;
        /**
         * Gets the layer of the component.
         * @returns an {@link Layer} which is the layer of the component
         */
        get_layer(): Layer;
        /**
         * Gets the zorder of the component. The value G_MININT will be returned
         * if the layer of the component is not ATK_LAYER_MDI or ATK_LAYER_WINDOW.
         * @returns a gint which is the zorder of the component, i.e. the depth at
         * which the component is shown in relation to other components in the same
         * container.
         */
        get_mdi_zorder(): number;
        /**
         * Gets the position of #component in the form of
         * a point specifying #component's top-left corner.
         * 
         * If the position can not be obtained (e.g. a non-embedded plug or missing
         * support), x and y are set to -1.
         * @param _x address of #gint to put x coordinate position
         * @param _y address of #gint to put y coordinate position
         * @param coord_type specifies whether the coordinates are relative to the screen
         * or to the components top level window
         */
        // get_position(_x: number, _y: number, coord_type: CoordType): void;
        /**
         * Gets the size of the #component in terms of width and height.
         * 
         * If the size can not be obtained (e.g. a non-embedded plug or missing
         * support), width and height are set to -1.
         * @param width address of #gint to put width of #component
         * @param height address of #gint to put height of #component
         */
        get_size(width: number, height: number): void;
        /**
         * Grabs focus for this #component.
         * @returns %TRUE if successful, %FALSE otherwise.
         */
        // grab_focus(): boolean;
        /**
         * Gets a reference to the accessible child, if one exists, at the
         * coordinate point specified by #x and #y.
         * @param _x x coordinate
         * @param _y y coordinate
         * @param coord_type specifies whether the coordinates are relative to the screen
         * or to the components top level window
         * @returns a reference to the accessible
         * child, if one exists
         */
        ref_accessible_at_point(_x: number, _y: number, coord_type: CoordType): Object;
        /**
         * Remove the handler specified by #handler_id from the list of
         * functions to be executed when this object receives focus events
         * (in or out).
         * @param handler_id the handler id of the focus handler to be removed
         * from #component
         */
        remove_focus_handler(handler_id: number): void;
        /**
         * Makes #component visible on the screen by scrolling all necessary parents.
         * 
         * Contrary to atk_component_set_position, this does not actually move
         * #component in its parent, this only makes the parents scroll so that the
         * object shows up on the screen, given its current position within the parents.
         * @param _type specify where the object should be made visible.
         * @returns whether scrolling was successful.
         */
        scroll_to(_type: ScrollType): boolean;
        /**
         * Move the top-left of #component to a given position of the screen by
         * scrolling all necessary parents.
         * @param coords specify whether coordinates are relative to the screen or to the
         * parent object.
         * @param _x x-position where to scroll to
         * @param _y y-position where to scroll to
         * @returns whether scrolling was successful.
         */
        scroll_to_point(coords: CoordType, _x: number, _y: number): boolean;
        /**
         * Sets the extents of #component.
         * @param _x x coordinate
         * @param _y y coordinate
         * @param width width to set for #component
         * @param height height to set for #component
         * @param coord_type specifies whether the coordinates are relative to the screen
         * or to the components top level window
         * @returns %TRUE or %FALSE whether the extents were set or not
         */
        set_extents(_x: number, _y: number, width: number, height: number, coord_type: CoordType): boolean;
        /**
         * Sets the position of #component.
         * 
         * Contrary to atk_component_scroll_to, this does not trigger any scrolling,
         * this just moves #component in its parent.
         * @param _x x coordinate
         * @param _y y coordinate
         * @param coord_type specifies whether the coordinates are relative to the screen
         * or to the component's top level window
         * @returns %TRUE or %FALSE whether or not the position was set or not
         */
        set_position(_x: number, _y: number, coord_type: CoordType): boolean;
        /**
         * Set the size of the #component in terms of width and height.
         * @param width width to set for #component
         * @param height height to set for #component
         * @returns %TRUE or %FALSE whether the size was set or not
         */
        set_size(width: number, height: number): boolean;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Component} instead.
     */
    type ComponentMixin = IComponent;

    /**
     * {@link Component} should be implemented by most if not all UI elements
     * with an actual on-screen presence, i.e. components which can be
     * said to have a screen-coordinate bounding box.  Virtually all
     * widgets will need to have #AtkComponent implementations provided
     * for their corresponding #AtkObject class.  In short, only UI
     * elements which are *not* GUI elements will omit this ATK interface.
     * 
     * A possible exception might be textual information with a
     * transparent background, in which case text glyph bounding box
     * information is provided by #AtkText.
     */
    interface Component extends ComponentMixin { }

    class Component {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link Document} instead.
     */
    interface IDocument {
        /**
         * Retrieves the value of the given #attribute_name inside #document.
         * @param attribute_name a character string representing the name of the attribute
         *   whose value is being queried.
         * @returns a string value associated with the named
         *    attribute for this document, or %NULL if a value for
         *    #attribute_name has not been specified for this document.
         */
        get_attribute_value(attribute_name: string): string;
        /**
         * Gets an AtkAttributeSet which describes document-wide
         *          attributes as name-value pairs.
         * @returns An AtkAttributeSet containing the explicitly
         *          set name-value-pair attributes associated with this document
         *          as a whole.
         */
        get_attributes(): AttributeSet;
        /**
         * Retrieves the current page number inside #document.
         * @returns the current page number inside #document, or -1 if
         *   not implemented, not know by the implementor, or irrelevant.
         */
        get_current_page_number(): number;
        /**
         * Gets a %gpointer that points to an instance of the DOM.  It is
         * up to the caller to check atk_document_get_type to determine
         * how to cast this pointer.
         * @returns a %gpointer that points to an instance of the DOM.
         */
        get_document(): any;
        /**
         * Gets a string indicating the document type.
         * @returns a string indicating the document type
         */
        get_document_type(): string;
        /**
         * Gets a UTF-8 string indicating the POSIX-style LC_MESSAGES locale
         *          of the content of this document instance.  Individual
         *          text substrings or images within this document may have
         *          a different locale, see atk_text_get_attributes and
         *          atk_image_get_image_locale.
         * @returns a UTF-8 string indicating the POSIX-style LC_MESSAGES
         *          locale of the document content as a whole, or NULL if
         *          the document content does not specify a locale.
         */
        get_locale(): string;
        /**
         * Retrieves the total number of pages inside #document.
         * @returns total page count of #document, or -1 if not implemented,
         *   not know by the implementor or irrelevant.
         */
        get_page_count(): number;
        /**
         * Sets the value for the given #attribute_name inside #document.
         * @param attribute_name a character string representing the name of the attribute
         *   whose value is being set.
         * @param attribute_value a string value to be associated with #attribute_name.
         * @returns %TRUE if #attribute_value is successfully associated
         *   with #attribute_name for this #document, and %FALSE if if the
         *   document does not allow the attribute to be modified
         */
        set_attribute_value(attribute_name: string, attribute_value: string): boolean;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Document} instead.
     */
    type DocumentMixin = IDocument;

    /**
     * The AtkDocument interface should be supported by any object whose
     * content is a representation or view of a document.  The AtkDocument
     * interface should appear on the toplevel container for the document
     * content; however AtkDocument instances may be nested (i.e. an
     * AtkDocument may be a descendant of another AtkDocument) in those
     * cases where one document contains "embedded content" which can
     * reasonably be considered a document in its own right.
     */
    interface Document extends DocumentMixin { }

    class Document {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link EditableText} instead.
     */
    interface IEditableText {
        /**
         * Copy text from #start_pos up to, but not including #end_pos
         * to the clipboard.
         * @param start_pos start position
         * @param end_pos end position
         */
        copy_text(start_pos: number, end_pos: number): void;
        /**
         * Copy text from #start_pos up to, but not including #end_pos
         * to the clipboard and then delete from the widget.
         * @param start_pos start position
         * @param end_pos end position
         */
        cut_text(start_pos: number, end_pos: number): void;
        /**
         * Delete text #start_pos up to, but not including #end_pos.
         * @param start_pos start position
         * @param end_pos end position
         */
        delete_text(start_pos: number, end_pos: number): void;
        /**
         * Insert text at a given position.
         * @param string the text to insert
         * @param length the length of text to insert, in bytes
         * @param position The caller initializes this to
         * the position at which to insert the text. After the call it
         * points at the position after the newly inserted text.
         */
        insert_text(string: string, length: number, position: number): void;
        /**
         * Paste text from clipboard to specified #position.
         * @param position position to paste
         */
        paste_text(position: number): void;
        /**
         * Sets the attributes for a specified range. See the ATK_ATTRIBUTE
         * macros (such as #ATK_ATTRIBUTE_LEFT_MARGIN) for examples of attributes
         * that can be set. Note that other attributes that do not have corresponding
         * ATK_ATTRIBUTE macros may also be set for certain text widgets.
         * @param attrib_set an {@link AttributeSet}
         * @param start_offset start of range in which to set attributes
         * @param end_offset end of range in which to set attributes
         * @returns %TRUE if attributes successfully set for the specified
         * range, otherwise %FALSE
         */
        set_run_attributes(attrib_set: AttributeSet, start_offset: number, end_offset: number): boolean;
        /**
         * Set text contents of #text.
         * @param string string to set for text contents of #text
         */
        set_text_contents(string: string): void;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link EditableText} instead.
     */
    type EditableTextMixin = IEditableText;

    /**
     * {@link EditableText} should be implemented by UI components which
     * contain text which the user can edit, via the #AtkObject
     * corresponding to that component (see #AtkObject).
     * 
     * #AtkEditableText is a subclass of #AtkText, and as such, an object
     * which implements #AtkEditableText is by definition an #AtkText
     * implementor as well.
     * 
     * See also: #AtkText
     */
    interface EditableText extends EditableTextMixin { }

    class EditableText {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link HyperlinkImpl} instead.
     */
    interface IHyperlinkImpl {
        /**
         * Gets the hyperlink associated with this object.
         * @returns an AtkHyperlink object which points to this
         * implementing AtkObject.
         */
        get_hyperlink(): Hyperlink;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link HyperlinkImpl} instead.
     */
    type HyperlinkImplMixin = IHyperlinkImpl;

    /**
     * AtkHyperlinkImpl allows AtkObjects to refer to their associated
     * AtkHyperlink instance, if one exists.  AtkHyperlinkImpl differs
     * from AtkHyperlink in that AtkHyperlinkImpl is an interface, whereas
     * AtkHyperlink is a object type.  The AtkHyperlinkImpl interface
     * allows a client to query an AtkObject for the availability of an
     * associated AtkHyperlink instance, and obtain that instance.  It is
     * thus particularly useful in cases where embedded content or inline
     * content within a text object is present, since the embedding text
     * object implements AtkHypertext and the inline/embedded objects are
     * exposed as children which implement AtkHyperlinkImpl, in addition
     * to their being obtainable via AtkHypertext:getLink followed by
     * AtkHyperlink:getObject.
     * 
     * The AtkHyperlinkImpl interface should be supported by objects
     * exposed within the hierarchy as children of an AtkHypertext
     * container which correspond to "links" or embedded content within
     * the text.  HTML anchors are not, for instance, normally exposed
     * this way, but embedded images and components which appear inline in
     * the content of a text object are. The AtkHyperlinkIface interface
     * allows a means of determining which children are hyperlinks in this
     * sense of the word, and for obtaining their corresponding
     * AtkHyperlink object, from which the embedding range, URI, etc. can
     * be obtained.
     * 
     * To some extent this interface exists because, for historical
     * reasons, AtkHyperlink was defined as an object type, not an
     * interface.  Thus, in order to interact with AtkObjects via
     * AtkHyperlink semantics, a new interface was required.
     */
    interface HyperlinkImpl extends HyperlinkImplMixin { }

    class HyperlinkImpl {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link Hypertext} instead.
     */
    interface IHypertext {
        /**
         * Gets the link in this hypertext document at index
         * #link_index
         * @param link_index an integer specifying the desired link
         * @returns the link in this hypertext document at
         * index #link_index
         */
        get_link(link_index: number): Hyperlink;
        /**
         * Gets the index into the array of hyperlinks that is associated with
         * the character specified by #char_index.
         * @param char_index a character index
         * @returns an index into the array of hyperlinks in #hypertext,
         * or -1 if there is no hyperlink associated with this character.
         */
        get_link_index(char_index: number): number;
        /**
         * Gets the number of links within this hypertext document.
         * @returns the number of links within this hypertext document
         */
        get_n_links(): number;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Hypertext} instead.
     */
    type HypertextMixin = IHypertext;

    /**
     * An interface used for objects which implement linking between
     * multiple resource or content locations, or multiple 'markers'
     * within a single document.  A Hypertext instance is associated with
     * one or more Hyperlinks, which are associated with particular
     * offsets within the Hypertext's included content.  While this
     * interface is derived from Text, there is no requirement that
     * Hypertext instances have textual content; they may implement Image
     * as well, and Hyperlinks need not have non-zero text offsets.
     */
    interface Hypertext extends HypertextMixin { }

    class Hypertext {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link Image} instead.
     */
    interface IImage {
        /**
         * Get a textual description of this image.
         * @returns a string representing the image description
         */
        get_image_description(): string;
        /**
         * Retrieves the locale identifier associated to the {@link Image}.
         * @returns a string corresponding to the POSIX
         *   `LC_MESSAGES` locale used by the image description, or
         *   %NULL if the image does not specify a locale.
         */
        get_image_locale(): string;
        /**
         * Gets the position of the image in the form of a point specifying the
         * images top-left corner.
         * 
         * If the position can not be obtained (e.g. missing support), x and y are set
         * to -1.
         * @param _x address of #gint to put x coordinate position; otherwise, -1 if value cannot be obtained.
         * @param _y address of #gint to put y coordinate position; otherwise, -1 if value cannot be obtained.
         * @param coord_type specifies whether the coordinates are relative to the screen
         * or to the components top level window
         */
        get_image_position(_x: number, _y: number, coord_type: CoordType): void;
        /**
         * Get the width and height in pixels for the specified image.
         * The values of #width and #height are returned as -1 if the
         * values cannot be obtained (for instance, if the object is not onscreen).
         * 
         * If the size can not be obtained (e.g. missing support), x and y are set
         * to -1.
         * @param width filled with the image width, or -1 if the value cannot be obtained.
         * @param height filled with the image height, or -1 if the value cannot be obtained.
         */
        get_image_size(width: number, height: number): void;
        /**
         * Sets the textual description for this image.
         * @param description a string description to set for #image
         * @returns boolean TRUE, or FALSE if operation could
         * not be completed.
         */
        set_image_description(description: string): boolean;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Image} instead.
     */
    type ImageMixin = IImage;

    /**
     * {@link Image} should be implemented by #AtkObject subtypes on behalf of
     * components which display image/pixmap information onscreen, and
     * which provide information (other than just widget borders, etc.)
     * via that image content.  For instance, icons, buttons with icons,
     * toolbar elements, and image viewing panes typically should
     * implement #AtkImage.
     * 
     * #AtkImage primarily provides two types of information: coordinate
     * information (useful for screen review mode of screenreaders, and
     * for use by onscreen magnifiers), and descriptive information.  The
     * descriptive information is provided for alternative, text-only
     * presentation of the most significant information present in the
     * image.
     */
    interface Image extends ImageMixin { }

    class Image {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link ImplementorIface} instead.
     */
    interface IImplementorIface {

    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link ImplementorIface} instead.
     */
    type ImplementorIfaceMixin = IImplementorIface;

    /**
     * The AtkImplementor interface is implemented by objects for which
     * AtkObject peers may be obtained via calls to
     * iface->(ref_accessible)(implementor);
     */
    interface ImplementorIface extends ImplementorIfaceMixin { }

    class ImplementorIface {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link Selection} instead.
     */
    interface ISelection {
        /**
         * Adds the specified accessible child of the object to the
         * object's selection.
         * @param _i a #gint specifying the child index.
         * @returns TRUE if success, FALSE otherwise.
         */
        add_selection(_i: number): boolean;
        /**
         * Clears the selection in the object so that no children in the object
         * are selected.
         * @returns TRUE if success, FALSE otherwise.
         */
        clear_selection(): boolean;
        /**
         * Gets the number of accessible children currently selected.
         * Note: callers should not rely on %NULL or on a zero value for
         * indication of whether AtkSelectionIface is implemented, they should
         * use type checking/interface checking macros or the
         * atk_get_accessible_value() convenience method.
         * @returns a gint representing the number of items selected, or 0
         * if #selection does not implement this interface.
         */
        get_selection_count(): number;
        /**
         * Determines if the current child of this object is selected
         * Note: callers should not rely on %NULL or on a zero value for
         * indication of whether AtkSelectionIface is implemented, they should
         * use type checking/interface checking macros or the
         * atk_get_accessible_value() convenience method.
         * @param _i a #gint specifying the child index.
         * @returns a gboolean representing the specified child is selected, or 0
         * if #selection does not implement this interface.
         */
        is_child_selected(_i: number): boolean;
        /**
         * Gets a reference to the accessible object representing the specified
         * selected child of the object.
         * Note: callers should not rely on %NULL or on a zero value for
         * indication of whether AtkSelectionIface is implemented, they should
         * use type checking/interface checking macros or the
         * atk_get_accessible_value() convenience method.
         * @param _i a #gint specifying the index in the selection set.  (e.g. the
         * ith selection as opposed to the ith child).
         * @returns an {@link Object} representing the
         * selected accessible, or %NULL if #selection does not implement this
         * interface.
         */
        ref_selection(_i: number): Object;
        /**
         * Removes the specified child of the object from the object's selection.
         * @param _i a #gint specifying the index in the selection set.  (e.g. the
         * ith selection as opposed to the ith child).
         * @returns TRUE if success, FALSE otherwise.
         */
        remove_selection(_i: number): boolean;
        /**
         * Causes every child of the object to be selected if the object
         * supports multiple selections.
         * @returns TRUE if success, FALSE otherwise.
         */
        select_all_selection(): boolean;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Selection} instead.
     */
    type SelectionMixin = ISelection;

    /**
     * {@link Selection} should be implemented by UI components with children
     * which are exposed by #atk_object_ref_child and
     * #atk_object_get_n_children, if the use of the parent UI component
     * ordinarily involves selection of one or more of the objects
     * corresponding to those #AtkObject children - for example,
     * selectable lists.
     * 
     * Note that other types of "selection" (for instance text selection)
     * are accomplished a other ATK interfaces - #AtkSelection is limited
     * to the selection/deselection of children.
     */
    interface Selection extends SelectionMixin { }

    class Selection {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link StreamableContent} instead.
     */
    interface IStreamableContent {
        /**
         * Gets the character string of the specified mime type. The first mime
         * type is at position 0, the second at position 1, and so on.
         * @param _i a gint representing the position of the mime type starting from 0
         * @returns a gchar* representing the specified mime type; the caller
         * should not free the character string.
         */
        get_mime_type(_i: number): string;
        /**
         * Gets the number of mime types supported by this object.
         * @returns a gint which is the number of mime types supported by the object.
         */
        get_n_mime_types(): number;
        /**
         * Gets the content in the specified mime type.
         * @param mime_type a gchar* representing the mime type
         * @returns A #GIOChannel which contains the content in the
         * specified mime type.
         */
        get_stream(mime_type: string): GLib.IOChannel;
        /**
         * Get a string representing a URI in IETF standard format
         * (see http://www.ietf.org/rfc/rfc2396.txt) from which the object's content
         * may be streamed in the specified mime-type, if one is available.
         * If mime_type is NULL, the URI for the default (and possibly only) mime-type is
         * returned.
         * 
         * Note that it is possible for get_uri to return NULL but for
         * get_stream to work nonetheless, since not all GIOChannels connect to URIs.
         * @param mime_type a gchar* representing the mime type, or NULL to request a URI
         * for the default mime type.
         * @returns Returns a string representing a URI, or %NULL
         * if no corresponding URI can be constructed.
         */
        get_uri(mime_type: string): string;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link StreamableContent} instead.
     */
    type StreamableContentMixin = IStreamableContent;

    /**
     * An interface whereby an object allows its backing content to be
     * streamed to clients.  Typical implementors would be images or
     * icons, HTML content, or multimedia display/rendering widgets.
     * 
     * Negotiation of content type is allowed. Clients may examine the
     * backing data and transform, convert, or parse the content in order
     * to present it in an alternate form to end-users.
     * 
     * The AtkStreamableContent interface is particularly useful for
     * saving, printing, or post-processing entire documents, or for
     * persisting alternate views of a document. If document content
     * itself is being serialized, stored, or converted, then use of the
     * AtkStreamableContent interface can help address performance
     * issues. Unlike most ATK interfaces, this interface is not strongly
     * tied to the current user-agent view of the a particular document,
     * but may in some cases give access to the underlying model data.
     */
    interface StreamableContent extends StreamableContentMixin { }

    class StreamableContent {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link Table} instead.
     */
    interface ITable {
        /**
         * Adds the specified #column to the selection.
         * @param column a #gint representing a column in #table
         * @returns a gboolean representing if the column was successfully added to
         * the selection, or 0 if value does not implement this interface.
         */
        add_column_selection(column: number): boolean;
        /**
         * Adds the specified #row to the selection.
         * @param _row a #gint representing a row in #table
         * @returns a gboolean representing if row was successfully added to selection,
         * or 0 if value does not implement this interface.
         */
        add_row_selection(_row: number): boolean;
        /**
         * Gets the caption for the #table.
         * @returns a AtkObject* representing the
         * table caption, or %NULL if value does not implement this interface.
         */
        get_caption(): Object;
        /**
         * Gets a #gint representing the column at the specified #index_.
         * @param index_ a #gint representing an index in #table
         * @returns a gint representing the column at the specified index,
         * or -1 if the table does not implement this method.
         */
        get_column_at_index(index_: number): number;
        /**
         * Gets the description text of the specified #column in the table
         * @param column a #gint representing a column in #table
         * @returns a gchar* representing the column description, or %NULL
         * if value does not implement this interface.
         */
        get_column_description(column: number): string;
        /**
         * Gets the number of columns occupied by the accessible object
         * at the specified #row and #column in the #table.
         * @param _row a #gint representing a row in #table
         * @param column a #gint representing a column in #table
         * @returns a gint representing the column extent at specified position, or 0
         * if value does not implement this interface.
         */
        get_column_extent_at(_row: number, column: number): number;
        /**
         * Gets the column header of a specified column in an accessible table.
         * @param column a #gint representing a column in the table
         * @returns a AtkObject* representing the
         * specified column header, or %NULL if value does not implement this
         * interface.
         */
        get_column_header(column: number): Object;
        /**
         * Gets a #gint representing the index at the specified #row and
         * #column.
         * @param _row a #gint representing a row in #table
         * @param column a #gint representing a column in #table
         * @returns a #gint representing the index at specified position.
         * The value -1 is returned if the object at row,column is not a child
         * of table or table does not implement this interface.
         */
        get_index_at(_row: number, column: number): number;
        /**
         * Gets the number of columns in the table.
         * @returns a gint representing the number of columns, or 0
         * if value does not implement this interface.
         */
        get_n_columns(): number;
        /**
         * Gets the number of rows in the table.
         * @returns a gint representing the number of rows, or 0
         * if value does not implement this interface.
         */
        get_n_rows(): number;
        /**
         * Gets a #gint representing the row at the specified #index_.
         * @param index_ a #gint representing an index in #table
         * @returns a gint representing the row at the specified index,
         * or -1 if the table does not implement this method.
         */
        get_row_at_index(index_: number): number;
        /**
         * Gets the description text of the specified row in the table
         * @param _row a #gint representing a row in #table
         * @returns a gchar* representing the row description, or
         * %NULL if value does not implement this interface.
         */
        get_row_description(_row: number): string;
        /**
         * Gets the number of rows occupied by the accessible object
         * at a specified #row and #column in the #table.
         * @param _row a #gint representing a row in #table
         * @param column a #gint representing a column in #table
         * @returns a gint representing the row extent at specified position, or 0
         * if value does not implement this interface.
         */
        get_row_extent_at(_row: number, column: number): number;
        /**
         * Gets the row header of a specified row in an accessible table.
         * @param _row a #gint representing a row in the table
         * @returns a AtkObject* representing the
         * specified row header, or %NULL if value does not implement this
         * interface.
         */
        get_row_header(_row: number): Object;
        /**
         * Gets the selected columns of the table by initializing **selected with
         * the selected column numbers. This array should be freed by the caller.
         * @param selected a #gint** that is to contain the selected columns numbers
         * @returns a gint representing the number of selected columns,
         * or %0 if value does not implement this interface.
         */
        get_selected_columns(selected: number): number;
        /**
         * Gets the selected rows of the table by initializing **selected with
         * the selected row numbers. This array should be freed by the caller.
         * @param selected a #gint** that is to contain the selected row numbers
         * @returns a gint representing the number of selected rows,
         * or zero if value does not implement this interface.
         */
        get_selected_rows(selected: number): number;
        /**
         * Gets the summary description of the table.
         * @returns a AtkObject* representing a summary description
         * of the table, or zero if value does not implement this interface.
         */
        get_summary(): Object;
        /**
         * Gets a boolean value indicating whether the specified #column
         * is selected
         * @param column a #gint representing a column in #table
         * @returns a gboolean representing if the column is selected, or 0
         * if value does not implement this interface.
         */
        is_column_selected(column: number): boolean;
        /**
         * Gets a boolean value indicating whether the specified #row
         * is selected
         * @param _row a #gint representing a row in #table
         * @returns a gboolean representing if the row is selected, or 0
         * if value does not implement this interface.
         */
        is_row_selected(_row: number): boolean;
        /**
         * Gets a boolean value indicating whether the accessible object
         * at the specified #row and #column is selected
         * @param _row a #gint representing a row in #table
         * @param column a #gint representing a column in #table
         * @returns a gboolean representing if the cell is selected, or 0
         * if value does not implement this interface.
         */
        is_selected(_row: number, column: number): boolean;
        /**
         * Get a reference to the table cell at #row, #column. This cell
         * should implement the interface {@link TableCell}
         * @param _row a #gint representing a row in #table
         * @param column a #gint representing a column in #table
         * @returns an {@link Object} representing the referred
         * to accessible
         */
        ref_at(_row: number, column: number): Object;
        /**
         * Adds the specified #column to the selection.
         * @param column a #gint representing a column in #table
         * @returns a gboolean representing if the column was successfully removed from
         * the selection, or 0 if value does not implement this interface.
         */
        remove_column_selection(column: number): boolean;
        /**
         * Removes the specified #row from the selection.
         * @param _row a #gint representing a row in #table
         * @returns a gboolean representing if the row was successfully removed from
         * the selection, or 0 if value does not implement this interface.
         */
        remove_row_selection(_row: number): boolean;
        /**
         * Sets the caption for the table.
         * @param caption a {@link Object} representing the caption to set for #table
         */
        set_caption(caption: Object): void;
        /**
         * Sets the description text for the specified #column of the #table.
         * @param column a #gint representing a column in #table
         * @param description a #gchar representing the description text
         * to set for the specified #column of the #table
         */
        set_column_description(column: number, description: string): void;
        /**
         * Sets the specified column header to #header.
         * @param column a #gint representing a column in #table
         * @param header an {@link Table}
         */
        set_column_header(column: number, header: Object): void;
        /**
         * Sets the description text for the specified #row of #table.
         * @param _row a #gint representing a row in #table
         * @param description a #gchar representing the description text
         * to set for the specified #row of #table
         */
        set_row_description(_row: number, description: string): void;
        /**
         * Sets the specified row header to #header.
         * @param _row a #gint representing a row in #table
         * @param header an {@link Table}
         */
        set_row_header(_row: number, header: Object): void;
        /**
         * Sets the summary description of the table.
         * @param accessible an {@link Object} representing the summary description
         * to set for #table
         */
        set_summary(accessible: Object): void;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Table} instead.
     */
    type TableMixin = ITable;

    /**
     * {@link Table} should be implemented by components which present
     * elements ordered via rows and columns.  It may also be used to
     * present tree-structured information if the nodes of the trees can
     * be said to contain multiple "columns".  Individual elements of an
     * #AtkTable are typically referred to as "cells". Those cells should
     * implement the interface #AtkTableCell, but #Atk doesn't require
     * them to be direct children of the current #AtkTable. They can be
     * grand-children, grand-grand-children etc. #AtkTable provides the
     * API needed to get a individual cell based on the row and column
     * numbers.
     * 
     * Children of #AtkTable are frequently "lightweight" objects, that
     * is, they may not have backing widgets in the host UI toolkit.  They
     * are therefore often transient.
     * 
     * Since tables are often very complex, #AtkTable includes provision
     * for offering simplified summary information, as well as row and
     * column headers and captions.  Headers and captions are #AtkObjects
     * which may implement other interfaces (#AtkText, #AtkImage, etc.) as
     * appropriate.  #AtkTable summaries may themselves be (simplified)
     * #AtkTables, etc.
     * 
     * Note for implementors: in the past, #AtkTable required that all the
     * cells should be direct children of #AtkTable, and provided some
     * index based methods to request the cells. The practice showed that
     * that forcing made #AtkTable implementation complex, and hard to
     * expose other kind of children, like rows or captions. Right now,
     * index-based methods are deprecated.
     */
    interface Table extends TableMixin { }

    class Table {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link TableCell} instead.
     */
    interface ITableCell {
        /**
         * Returns the column headers as an array of cell accessibles.
         * @returns 
         */
        get_column_header_cells(): Object[];
        /**
         * Returns the number of columns occupied by this cell accessible.
         * @returns a gint representing the number of columns occupied by this cell,
         * or 0 if the cell does not implement this method.
         */
        get_column_span(): number;
        /**
         * Retrieves the tabular position of this cell.
         * @param _row the row of the given cell.
         * @param column the column of the given cell.
         * @returns TRUE if successful; FALSE otherwise.
         */
        get_position(_row: number, column: number): boolean;
        /**
         * Gets the row and column indexes and span of this cell accessible.
         * 
         * Note: If the object does not implement this function, then, by default, atk
         * will implement this function by calling get_row_span and get_column_span
         * on the object.
         * @param _row the row index of the given cell.
         * @param column the column index of the given cell.
         * @param row_span the number of rows occupied by this cell.
         * @param column_span the number of columns occupied by this cell.
         * @returns TRUE if successful; FALSE otherwise.
         */
        get_row_column_span(_row: number, column: number, row_span: number, column_span: number): boolean;
        /**
         * Returns the row headers as an array of cell accessibles.
         * @returns 
         */
        get_row_header_cells(): Object[];
        /**
         * Returns the number of rows occupied by this cell accessible.
         * @returns a gint representing the number of rows occupied by this cell,
         * or 0 if the cell does not implement this method.
         */
        get_row_span(): number;
        /**
         * Returns a reference to the accessible of the containing table.
         * @returns the atk object for the containing table.
         */
        get_table(): Object;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link TableCell} instead.
     */
    type TableCellMixin = ITableCell;

    /**
     * Being {@link Table} a component which present elements ordered via rows
     * and columns, an #AtkTableCell is the interface which each of those
     * elements, so "cells" should implement.
     * 
     * See also #AtkTable.
     */
    interface TableCell extends TableCellMixin { }

    class TableCell {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link Text} instead.
     */
    interface IText {
        /**
         * Adds a selection bounded by the specified offsets.
         * @param start_offset the starting character offset of the selected region
         * @param end_offset the offset of the first character after the selected region.
         * @returns %TRUE if successful, %FALSE otherwise
         */
        add_selection(start_offset: number, end_offset: number): boolean;
        /**
         * Get the ranges of text in the specified bounding box.
         * @param rect An AtkTextRectangle giving the dimensions of the bounding box.
         * @param coord_type Specify whether coordinates are relative to the screen or widget window.
         * @param x_clip_type Specify the horizontal clip type.
         * @param y_clip_type Specify the vertical clip type.
         * @returns 
         */
        get_bounded_ranges(rect: TextRectangle, coord_type: CoordType, x_clip_type: TextClipType, y_clip_type: TextClipType): TextRange[];
        /**
         * Gets the offset of the position of the caret (cursor).
         * @returns the character offset of the position of the caret or -1 if
         *          the caret is not located inside the element or in the case of
         *          any other failure.
         */
        get_caret_offset(): number;
        /**
         * Gets the specified text.
         * @param offset a character offset within #text
         * @returns the character at #offset or 0 in the case of failure.
         */
        get_character_at_offset(offset: number): string;
        /**
         * Gets the character count.
         * @returns the number of characters or -1 in case of failure.
         */
        get_character_count(): number;
        /**
         * If the extent can not be obtained (e.g. missing support), all of x, y, width,
         * height are set to -1.
         * 
         * Get the bounding box containing the glyph representing the character at
         *     a particular text offset.
         * @param offset The offset of the text character for which bounding information is required.
         * @param _x Pointer for the x coordinate of the bounding box
         * @param _y Pointer for the y coordinate of the bounding box
         * @param width Pointer for the width of the bounding box
         * @param height Pointer for the height of the bounding box
         * @param coords specify whether coordinates are relative to the screen or widget window
         */
        get_character_extents(offset: number, _x: number, _y: number, width: number, height: number, coords: CoordType): void;
        /**
         * Creates an {@link AttributeSet} which consists of the default values of
         * attributes for the text. See the enum AtkTextAttribute for types of text
         * attributes that can be returned. Note that other attributes may also be
         * returned.
         * @returns an {@link AttributeSet} which contains the default text
         *          attributes for this #AtkText. This #AtkAttributeSet should be freed by
         *          a call to atk_attribute_set_free().
         */
        get_default_attributes(): AttributeSet;
        /**
         * Gets the number of selected regions.
         * @returns The number of selected regions, or -1 in the case of failure.
         */
        get_n_selections(): number;
        /**
         * Gets the offset of the character located at coordinates #x and #y. #x and #y
         * are interpreted as being relative to the screen or this widget's window
         * depending on #coords.
         * @param _x screen x-position of character
         * @param _y screen y-position of character
         * @param coords specify whether coordinates are relative to the screen or
         * widget window
         * @returns the offset to the character which is located at  the specified
         *          #x and #y coordinates of -1 in case of failure.
         */
        get_offset_at_point(_x: number, _y: number, coords: CoordType): number;
        /**
         * Get the bounding box for text within the specified range.
         * 
         * If the extents can not be obtained (e.g. or missing support), the rectangle
         * fields are set to -1.
         * @param start_offset The offset of the first text character for which boundary
         *        information is required.
         * @param end_offset The offset of the text character after the last character
         *        for which boundary information is required.
         * @param coord_type Specify whether coordinates are relative to the screen or widget window.
         * @param rect A pointer to a AtkTextRectangle which is filled in by this function.
         */
        get_range_extents(start_offset: number, end_offset: number, coord_type: CoordType, rect: TextRectangle): void;
        /**
         * Creates an {@link AttributeSet} which consists of the attributes explicitly
         * set at the position #offset in the text. #start_offset and #end_offset are
         * set to the start and end of the range around #offset where the attributes are
         * invariant. Note that #end_offset is the offset of the first character
         * after the range.  See the enum AtkTextAttribute for types of text
         * attributes that can be returned. Note that other attributes may also be
         * returned.
         * @param offset the character offset at which to get the attributes, -1 means the offset of
         * the character to be inserted at the caret location.
         * @param start_offset the address to put the start offset of the range
         * @param end_offset the address to put the end offset of the range
         * @returns an {@link AttributeSet} which contains the attributes
         *         explicitly set at #offset. This #AtkAttributeSet should be freed by
         *         a call to atk_attribute_set_free().
         */
        get_run_attributes(offset: number, start_offset: number, end_offset: number): AttributeSet;
        /**
         * Gets the text from the specified selection.
         * @param selection_num The selection number.  The selected regions are
         * assigned numbers that correspond to how far the region is from the
         * start of the text.  The selected region closest to the beginning
         * of the text region is assigned the number 0, etc.  Note that adding,
         * moving or deleting a selected region can change the numbering.
         * @param start_offset passes back the starting character offset of the selected region
         * @param end_offset passes back the ending character offset (offset immediately past)
         * of the selected region
         * @returns a newly allocated string containing the selected text. Use g_free()
         *          to free the returned string.
         */
        get_selection(selection_num: number, start_offset: number, end_offset: number): string;
        /**
         * Gets a portion of the text exposed through an {@link Text} according to a given #offset
         * and a specific #granularity, along with the start and end offsets defining the
         * boundaries of such a portion of text.
         * 
         * If #granularity is ATK_TEXT_GRANULARITY_CHAR the character at the
         * offset is returned.
         * 
         * If #granularity is ATK_TEXT_GRANULARITY_WORD the returned string
         * is from the word start at or before the offset to the word start after
         * the offset.
         * 
         * The returned string will contain the word at the offset if the offset
         * is inside a word and will contain the word before the offset if the
         * offset is not inside a word.
         * 
         * If #granularity is ATK_TEXT_GRANULARITY_SENTENCE the returned string
         * is from the sentence start at or before the offset to the sentence
         * start after the offset.
         * 
         * The returned string will contain the sentence at the offset if the offset
         * is inside a sentence and will contain the sentence before the offset
         * if the offset is not inside a sentence.
         * 
         * If #granularity is ATK_TEXT_GRANULARITY_LINE the returned string
         * is from the line start at or before the offset to the line
         * start after the offset.
         * 
         * If #granularity is ATK_TEXT_GRANULARITY_PARAGRAPH the returned string
         * is from the start of the paragraph at or before the offset to the start
         * of the following paragraph after the offset.
         * @param offset position
         * @param granularity An {@link TextGranularity}
         * @param start_offset the starting character offset of the returned string, or -1
         *                in the case of error (e.g. invalid offset, not implemented)
         * @param end_offset the offset of the first character after the returned string,
         *              or -1 in the case of error (e.g. invalid offset, not implemented)
         * @returns a newly allocated string containing the text at
         *          the #offset bounded by the specified #granularity. Use g_free()
         *          to free the returned string.  Returns %NULL if the offset is invalid
         *          or no implementation is available.
         */
        get_string_at_offset(offset: number, granularity: TextGranularity, start_offset: number, end_offset: number): string;
        /**
         * Gets the specified text.
         * @param start_offset a starting character offset within #text
         * @param end_offset an ending character offset within #text, or -1 for the end of the string.
         * @returns a newly allocated string containing the text from #start_offset up
         *          to, but not including #end_offset. Use g_free() to free the returned
         *          string.
         */
        get_text(start_offset: number, end_offset: number): string;
        /**
         * Gets the specified text.
         * @param offset position
         * @param boundary_type An {@link TextBoundary}
         * @param start_offset the starting character offset of the returned string
         * @param end_offset the offset of the first character after the
         *              returned substring
         * @returns a newly allocated string containing the text after #offset bounded
         *          by the specified #boundary_type. Use g_free() to free the returned
         *          string.
         */
        get_text_after_offset(offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number): string;
        /**
         * Gets the specified text.
         * 
         * If the boundary_type if ATK_TEXT_BOUNDARY_CHAR the character at the
         * offset is returned.
         * 
         * If the boundary_type is ATK_TEXT_BOUNDARY_WORD_START the returned string
         * is from the word start at or before the offset to the word start after
         * the offset.
         * 
         * The returned string will contain the word at the offset if the offset
         * is inside a word and will contain the word before the offset if the
         * offset is not inside a word.
         * 
         * If the boundary type is ATK_TEXT_BOUNDARY_SENTENCE_START the returned
         * string is from the sentence start at or before the offset to the sentence
         * start after the offset.
         * 
         * The returned string will contain the sentence at the offset if the offset
         * is inside a sentence and will contain the sentence before the offset
         * if the offset is not inside a sentence.
         * 
         * If the boundary type is ATK_TEXT_BOUNDARY_LINE_START the returned
         * string is from the line start at or before the offset to the line
         * start after the offset.
         * @param offset position
         * @param boundary_type An {@link TextBoundary}
         * @param start_offset the starting character offset of the returned string
         * @param end_offset the offset of the first character after the
         *              returned substring
         * @returns a newly allocated string containing the text at #offset bounded
         *          by the specified #boundary_type. Use g_free() to free the returned
         *          string.
         */
        get_text_at_offset(offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number): string;
        /**
         * Gets the specified text.
         * @param offset position
         * @param boundary_type An {@link TextBoundary}
         * @param start_offset the starting character offset of the returned string
         * @param end_offset the offset of the first character after the
         *              returned substring
         * @returns a newly allocated string containing the text before #offset bounded
         *          by the specified #boundary_type. Use g_free() to free the returned
         *          string.
         */
        get_text_before_offset(offset: number, boundary_type: TextBoundary, start_offset: number, end_offset: number): string;
        /**
         * Removes the specified selection.
         * @param selection_num The selection number.  The selected regions are
         * assigned numbers that correspond to how far the region is from the
         * start of the text.  The selected region closest to the beginning
         * of the text region is assigned the number 0, etc.  Note that adding,
         * moving or deleting a selected region can change the numbering.
         * @returns %TRUE if successful, %FALSE otherwise
         */
        remove_selection(selection_num: number): boolean;
        /**
         * Makes a substring of #text visible on the screen by scrolling all necessary parents.
         * @param start_offset start offset in the #text
         * @param end_offset end offset in the #text, or -1 for the end of the text.
         * @param _type specify where the object should be made visible.
         * @returns whether scrolling was successful.
         */
        scroll_substring_to(start_offset: number, end_offset: number, _type: ScrollType): boolean;
        /**
         * Move the top-left of a substring of #text to a given position of the screen
         * by scrolling all necessary parents.
         * @param start_offset start offset in the #text
         * @param end_offset end offset in the #text, or -1 for the end of the text.
         * @param coords specify whether coordinates are relative to the screen or to the
         * parent object.
         * @param _x x-position where to scroll to
         * @param _y y-position where to scroll to
         * @returns whether scrolling was successful.
         */
        scroll_substring_to_point(start_offset: number, end_offset: number, coords: CoordType, _x: number, _y: number): boolean;
        /**
         * Sets the caret (cursor) position to the specified #offset.
         * 
         * In the case of rich-text content, this method should either grab focus
         * or move the sequential focus navigation starting point (if the application
         * supports this concept) as if the user had clicked on the new caret position.
         * Typically, this means that the target of this operation is the node containing
         * the new caret position or one of its ancestors. In other words, after this
         * method is called, if the user advances focus, it should move to the first
         * focusable node following the new caret position.
         * 
         * Calling this method should also scroll the application viewport in a way
         * that matches the behavior of the application's typical caret motion or tab
         * navigation as closely as possible. This also means that if the application's
         * caret motion or focus navigation does not trigger a scroll operation, this
         * method should not trigger one either. If the application does not have a caret
         * motion or focus navigation operation, this method should try to scroll the new
         * caret position into view while minimizing unnecessary scroll motion.
         * @param offset the character offset of the new caret position
         * @returns %TRUE if successful, %FALSE otherwise.
         */
        set_caret_offset(offset: number): boolean;
        /**
         * Changes the start and end offset of the specified selection.
         * @param selection_num The selection number.  The selected regions are
         * assigned numbers that correspond to how far the region is from the
         * start of the text.  The selected region closest to the beginning
         * of the text region is assigned the number 0, etc.  Note that adding,
         * moving or deleting a selected region can change the numbering.
         * @param start_offset the new starting character offset of the selection
         * @param end_offset the new end position of (e.g. offset immediately past)
         * the selection
         * @returns %TRUE if successful, %FALSE otherwise
         */
        set_selection(selection_num: number, start_offset: number, end_offset: number): boolean;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Text} instead.
     */
    type TextMixin = IText;

    /**
     * {@link Text} should be implemented by #AtkObjects on behalf of widgets
     * that have text content which is either attributed or otherwise
     * non-trivial.  #AtkObjects whose text content is simple,
     * unattributed, and very brief may expose that content via
     * #atk_object_get_name instead; however if the text is editable,
     * multi-line, typically longer than three or four words, attributed,
     * selectable, or if the object already uses the 'name' ATK property
     * for other information, the #AtkText interface should be used to
     * expose the text content.  In the case of editable text content,
     * #AtkEditableText (a subtype of the #AtkText interface) should be
     * implemented instead.
     * 
     *  #AtkText provides not only traversal facilities and change
     * notification for text content, but also caret tracking and glyph
     * bounding box calculations.  Note that the text strings are exposed
     * as UTF-8, and are therefore potentially multi-byte, and
     * caret-to-byte offset mapping makes no assumptions about the
     * character length; also bounding box glyph-to-offset mapping may be
     * complex for languages which use ligatures.
     */
    interface Text extends TextMixin { }

    class Text {
        constructor();
        /**
         * Frees the memory associated with an array of AtkTextRange. It is assumed
         * that the array was returned by the function atk_text_get_bounded_ranges
         * and is NULL terminated.
         * @param ranges 
         */
        static free_ranges(ranges: TextRange[]): void;
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link Value} instead.
     */
    interface IValue {
        /**
         * Gets the value of this object.
         * @param value a #GValue representing the current accessible value
         */
        get_current_value(value: GObject.Value): void;
        /**
         * Gets the minimum increment by which the value of this object may be
         * changed.  If zero, the minimum increment is undefined, which may
         * mean that it is limited only by the floating point precision of the
         * platform.
         * @returns the minimum increment by which the value of this
         * object may be changed. zero if undefined.
         */
        get_increment(): number;
        /**
         * Gets the maximum value of this object.
         * @param value a #GValue representing the maximum accessible value
         */
        get_maximum_value(value: GObject.Value): void;
        /**
         * Gets the minimum increment by which the value of this object may be changed.  If zero,
         * the minimum increment is undefined, which may mean that it is limited only by the
         * floating point precision of the platform.
         * @param value a #GValue representing the minimum increment by which the accessible value may be changed
         */
        get_minimum_increment(value: GObject.Value): void;
        /**
         * Gets the minimum value of this object.
         * @param value a #GValue representing the minimum accessible value
         */
        get_minimum_value(value: GObject.Value): void;
        /**
         * Gets the range of this object.
         * @returns a newly allocated {@link Range}
         * that represents the minimum, maximum and descriptor (if available)
         * of #obj. NULL if that range is not defined.
         */
        get_range(): Range;
        /**
         * Gets the list of subranges defined for this object. See {@link Value}
         * introduction for examples of subranges and when to expose them.
         * @returns an #GSList of
         * {@link Range} which each of the subranges defined for this object. Free
         * the returns list with g_slist_free().
         */
        get_sub_ranges(): GLib.SList;
        /**
         * Gets the current value and the human readable text alternative of
         * #obj. #text is a newly created string, that must be freed by the
         * caller. Can be NULL if no descriptor is available.
         * @param value address of #gdouble to put the current value of #obj
         * @param text address of #gchar to put the human
         * readable text alternative for #value
         */
        get_value_and_text(value: number, text: string): void;
        /**
         * Sets the value of this object.
         * @param value a #GValue which is the desired new accessible value.
         * @returns %TRUE if new value is successfully set, %FALSE otherwise.
         */
        set_current_value(value: GObject.Value): boolean;
        /**
         * Sets the value of this object.
         * 
         * This method is intended to provide a way to change the value of the
         * object. In any case, it is possible that the value can't be
         * modified (ie: a read-only component). If the value changes due this
         * call, it is possible that the text could change, and will trigger
         * an {@link Value}::value-changed signal emission.
         * 
         * Note for implementors: the deprecated atk_value_set_current_value()
         * method returned TRUE or FALSE depending if the value was assigned
         * or not. In the practice several implementors were not able to
         * decide it, and returned TRUE in any case. For that reason it is not
         * required anymore to return if the value was properly assigned or
         * not.
         * @param new_value a double which is the desired new accessible value.
         */
        set_value(new_value: number): void;
    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Value} instead.
     */
    type ValueMixin = IValue;

    /**
     * {@link Value} should be implemented for components which either display
     * a value from a bounded range, or which allow the user to specify a
     * value from a bounded range, or both. For instance, most sliders and
     * range controls, as well as dials, should have #AtkObject
     * representations which implement #AtkValue on the component's
     * behalf. #AtKValues may be read-only, in which case attempts to
     * alter the value return would fail.
     * 
     * <refsect1 id="current-value-text">
     * <title>On the subject of current value text</title>
     * <para>
     * In addition to providing the current value, implementors can
     * optionally provide an end-user-consumable textual description
     * associated with this value. This description should be included
     * when the numeric value fails to convey the full, on-screen
     * representation seen by users.
     * </para>
     * 
     * <example>
     * <title>Password strength</title>
     * A password strength meter whose value changes as the user types
     * their new password. Red is used for values less than 4.0, yellow
     * for values between 4.0 and 7.0, and green for values greater than
     * 7.0. In this instance, value text should be provided by the
     * implementor. Appropriate value text would be "weak", "acceptable,"
     * and "strong" respectively.
     * </example>
     * 
     * A level bar whose value changes to reflect the battery charge. The
     * color remains the same regardless of the charge and there is no
     * on-screen text reflecting the fullness of the battery. In this
     * case, because the position within the bar is the only indication
     * the user has of the current charge, value text should not be
     * provided by the implementor.
     * 
     * <refsect2 id="implementor-notes">
     * <title>Implementor Notes</title>
     * <para>
     * Implementors should bear in mind that assistive technologies will
     * likely prefer the value text provided over the numeric value when
     * presenting a widget's value. As a result, strings not intended for
     * end users should not be exposed in the value text, and strings
     * which are exposed should be localized. In the case of widgets which
     * display value text on screen, for instance through a separate label
     * in close proximity to the value-displaying widget, it is still
     * expected that implementors will expose the value text using the
     * above API.
     * </para>
     * 
     * <para>
     * #AtkValue should NOT be implemented for widgets whose displayed
     * value is not reflective of a meaningful amount. For instance, a
     * progress pulse indicator whose value alternates between 0.0 and 1.0
     * to indicate that some process is still taking place should not
     * implement #AtkValue because the current value does not reflect
     * progress towards completion.
     * </para>
     * </refsect2>
     * </refsect1>
     * 
     * <refsect1 id="ranges">
     * <title>On the subject of ranges</title>
     * <para>
     * In addition to providing the minimum and maximum values,
     * implementors can optionally provide details about subranges
     * associated with the widget. These details should be provided by the
     * implementor when both of the following are communicated visually to
     * the end user:
     * </para>
     * <itemizedlist>
     *   <listitem>The existence of distinct ranges such as "weak",
     *   "acceptable", and "strong" indicated by color, bar tick marks,
     *   and/or on-screen text.</listitem>
     *   <listitem>Where the current value stands within a given subrange,
     *   for instance illustrating progression from very "weak" towards
     *   nearly "acceptable" through changes in shade and/or position on
     *   the bar within the "weak" subrange.</listitem>
     * </itemizedlist>
     * <para>
     * If both of the above do not apply to the widget, it should be
     * sufficient to expose the numeric value, along with the value text
     * if appropriate, to make the widget accessible.
     * </para>
     * 
     * <refsect2 id="ranges-implementor-notes">
     * <title>Implementor Notes</title>
     * <para>
     * If providing subrange details is deemed necessary, all possible
     * values of the widget are expected to fall within one of the
     * subranges defined by the implementor.
     * </para>
     * </refsect2>
     * </refsect1>
     * 
     * <refsect1 id="localization">
     * <title>On the subject of localization of end-user-consumable text
     * values</title>
     * <para>
     * Because value text and subrange descriptors are human-consumable,
     * implementors are expected to provide localized strings which can be
     * directly presented to end users via their assistive technology. In
     * order to simplify this for implementors, implementors can use
     * atk_value_type_get_localized_name() with the following
     * already-localized constants for commonly-needed values can be used:
     * </para>
     * 
     * <itemizedlist>
     *   <listitem>ATK_VALUE_VERY_WEAK</listitem>
     *   <listitem>ATK_VALUE_WEAK</listitem>
     *   <listitem>ATK_VALUE_ACCEPTABLE</listitem>
     *   <listitem>ATK_VALUE_STRONG</listitem>
     *   <listitem>ATK_VALUE_VERY_STRONG</listitem>
     *   <listitem>ATK_VALUE_VERY_LOW</listitem>
     *   <listitem>ATK_VALUE_LOW</listitem>
     *   <listitem>ATK_VALUE_MEDIUM</listitem>
     *   <listitem>ATK_VALUE_HIGH</listitem>
     *   <listitem>ATK_VALUE_VERY_HIGH</listitem>
     *   <listitem>ATK_VALUE_VERY_BAD</listitem>
     *   <listitem>ATK_VALUE_BAD</listitem>
     *   <listitem>ATK_VALUE_GOOD</listitem>
     *   <listitem>ATK_VALUE_VERY_GOOD</listitem>
     *   <listitem>ATK_VALUE_BEST</listitem>
     *   <listitem>ATK_VALUE_SUBSUBOPTIMAL</listitem>
     *   <listitem>ATK_VALUE_SUBOPTIMAL</listitem>
     *   <listitem>ATK_VALUE_OPTIMAL</listitem>
     * </itemizedlist>
     * <para>
     * Proposals for additional constants, along with their use cases,
     * should be submitted to the GNOME Accessibility Team.
     * </para>
     * </refsect1>
     * 
     * <refsect1 id="changes">
     * <title>On the subject of changes</title>
     * <para>
     * Note that if there is a textual description associated with the new
     * numeric value, that description should be included regardless of
     * whether or not it has also changed.
     * </para>
     * </refsect1>
     */
    interface Value extends ValueMixin { }

    class Value {
        constructor();
    }



    /** This construct is only for enabling class multi-inheritance,
     * use {@link Window} instead.
     */
    interface IWindow {

    }

    /** This construct is only for enabling class multi-inheritance,
     * use {@link Window} instead.
     */
    type WindowMixin = IWindow;

    /**
     * {@link Window} should be implemented by the UI elements that represent
     * a top-level window, such as the main window of an application or
     * dialog.
     */
    interface Window extends WindowMixin { }

    class Window {
        constructor();
    }



    /**
     * Specifies how xy coordinates are to be interpreted. Used by functions such
     * as atk_component_get_position() and atk_text_get_character_extents()
     */
    enum CoordType {
        /**
         * specifies xy coordinates relative to the screen
         */
        SCREEN = 0,
        /**
         * specifies xy coordinates relative to the widget's
         * top-level window
         */
        WINDOW = 1,
        /**
         * specifies xy coordinates relative to the widget's
         * immediate parent. Since: 2.30
         */
        PARENT = 2
    }

    /**
     * Specifies the type of a keyboard evemt.
     */
    enum KeyEventType {
        /**
         * specifies a key press event
         */
        PRESS = 0,
        /**
         * specifies a key release event
         */
        RELEASE = 1,
        /**
         * Not a valid value; specifies end of enumeration
         */
        LAST_DEFINED = 2
    }

    /**
     * Describes the layer of a component
     * 
     * These enumerated "layer values" are used when determining which UI
     * rendering layer a component is drawn into, which can help in making
     * determinations of when components occlude one another.
     */
    enum Layer {
        /**
         * The object does not have a layer
         */
        INVALID = 0,
        /**
         * This layer is reserved for the desktop background
         */
        BACKGROUND = 1,
        /**
         * This layer is used for Canvas components
         */
        CANVAS = 2,
        /**
         * This layer is normally used for components
         */
        WIDGET = 3,
        /**
         * This layer is used for layered components
         */
        MDI = 4,
        /**
         * This layer is used for popup components, such as menus
         */
        POPUP = 5,
        /**
         * This layer is reserved for future use.
         */
        OVERLAY = 6,
        /**
         * This layer is used for toplevel windows.
         */
        WINDOW = 7
    }

    /**
     * Describes the type of the relation
     */
    enum RelationType {
        /**
         * Not used, represens "no relationship" or an error condition.
         */
        NULL = 0,
        /**
         * Indicates an object controlled by one or more target objects.
         */
        CONTROLLED_BY = 1,
        /**
         * Indicates an object is an controller for one or more target objects.
         */
        CONTROLLER_FOR = 2,
        /**
         * Indicates an object is a label for one or more target objects.
         */
        LABEL_FOR = 3,
        /**
         * Indicates an object is labelled by one or more target objects.
         */
        LABELLED_BY = 4,
        /**
         * Indicates an object is a member of a group of one or more target objects.
         */
        MEMBER_OF = 5,
        /**
         * Indicates an object is a cell in a treetable which is displayed because a cell in the same column is expanded and identifies that cell.
         */
        NODE_CHILD_OF = 6,
        /**
         * Indicates that the object has content that flows logically to another
         *  AtkObject in a sequential way, (for instance text-flow).
         */
        FLOWS_TO = 7,
        /**
         * Indicates that the object has content that flows logically from
         *  another AtkObject in a sequential way, (for instance text-flow).
         */
        FLOWS_FROM = 8,
        /**
         * Indicates a subwindow attached to a component but otherwise has no connection in  the UI heirarchy to that component.
         */
        SUBWINDOW_OF = 9,
        /**
         * Indicates that the object visually embeds
         *  another object's content, i.e. this object's content flows around
         *  another's content.
         */
        EMBEDS = 10,
        /**
         * Reciprocal of %ATK_RELATION_EMBEDS, indicates that
         *  this object's content is visualy embedded in another object.
         */
        EMBEDDED_BY = 11,
        /**
         * Indicates that an object is a popup for another object.
         */
        POPUP_FOR = 12,
        /**
         * Indicates that an object is a parent window of another object.
         */
        PARENT_WINDOW_OF = 13,
        /**
         * Reciprocal of %ATK_RELATION_DESCRIPTION_FOR. Indicates that one
         * or more target objects provide descriptive information about this object. This relation
         * type is most appropriate for information that is not essential as its presentation may
         * be user-configurable and/or limited to an on-demand mechanism such as an assistive
         * technology command. For brief, essential information such as can be found in a widget's
         * on-screen label, use %ATK_RELATION_LABELLED_BY. For an on-screen error message, use
         * %ATK_RELATION_ERROR_MESSAGE. For lengthy extended descriptive information contained in
         * an on-screen object, consider using %ATK_RELATION_DETAILS as assistive technologies may
         * provide a means for the user to navigate to objects containing detailed descriptions so
         * that their content can be more closely reviewed.
         */
        DESCRIBED_BY = 14,
        /**
         * Reciprocal of %ATK_RELATION_DESCRIBED_BY. Indicates that this
         * object provides descriptive information about the target object(s). See also
         * %ATK_RELATION_DETAILS_FOR and %ATK_RELATION_ERROR_FOR.
         */
        DESCRIPTION_FOR = 15,
        /**
         * Indicates an object is a cell in a treetable and is expanded to display other cells in the same column.
         */
        NODE_PARENT_OF = 16,
        /**
         * Reciprocal of %ATK_RELATION_DETAILS_FOR. Indicates that this object
         * has a detailed or extended description, the contents of which can be found in the target
         * object(s). This relation type is most appropriate for information that is sufficiently
         * lengthy as to make navigation to the container of that information desirable. For less
         * verbose information suitable for announcement only, see %ATK_RELATION_DESCRIBED_BY. If
         * the detailed information describes an error condition, %ATK_RELATION_ERROR_FOR should be
         * used instead. #Since: ATK-2.26.
         */
        DETAILS = 17,
        /**
         * Reciprocal of %ATK_RELATION_DETAILS. Indicates that this object
         * provides a detailed or extended description about the target object(s). See also
         * %ATK_RELATION_DESCRIPTION_FOR and %ATK_RELATION_ERROR_FOR. #Since: ATK-2.26.
         */
        DETAILS_FOR = 18,
        /**
         * Reciprocal of %ATK_RELATION_ERROR_FOR. Indicates that this object
         * has one or more errors, the nature of which is described in the contents of the target
         * object(s). Objects that have this relation type should also contain %ATK_STATE_INVALID_ENTRY
         * in their {@link StateSet}. #Since: ATK-2.26.
         */
        ERROR_MESSAGE = 19,
        /**
         * Reciprocal of %ATK_RELATION_ERROR_MESSAGE. Indicates that this object
         * contains an error message describing an invalid condition in the target object(s). #Since:
         * ATK_2.26.
         */
        ERROR_FOR = 20,
        /**
         * Not used, this value indicates the end of the enumeration.
         */
        LAST_DEFINED = 21
    }

    /**
     * Describes the role of an object
     * 
     * These are the built-in enumerated roles that UI components can have
     * in ATK.  Other roles may be added at runtime, so an AtkRole >=
     * %ATK_ROLE_LAST_DEFINED is not necessarily an error.
     */
    enum Role {
        /**
         * Invalid role
         */
        INVALID = 0,
        /**
         * A label which represents an accelerator
         */
        ACCELERATOR_LABEL = 1,
        /**
         * An object which is an alert to the user. Assistive Technologies typically respond to ATK_ROLE_ALERT by reading the entire onscreen contents of containers advertising this role.  Should be used for warning dialogs, etc.
         */
        ALERT = 2,
        /**
         * An object which is an animated image
         */
        ANIMATION = 3,
        /**
         * An arrow in one of the four cardinal directions
         */
        ARROW = 4,
        /**
         * An object that displays a calendar and allows the user to select a date
         */
        CALENDAR = 5,
        /**
         * An object that can be drawn into and is used to trap events
         */
        CANVAS = 6,
        /**
         * A choice that can be checked or unchecked and provides a separate indicator for the current state
         */
        CHECK_BOX = 7,
        /**
         * A menu item with a check box
         */
        CHECK_MENU_ITEM = 8,
        /**
         * A specialized dialog that lets the user choose a color
         */
        COLOR_CHOOSER = 9,
        /**
         * The header for a column of data
         */
        COLUMN_HEADER = 10,
        /**
         * A collapsible list of choices the user can select from
         */
        COMBO_BOX = 11,
        /**
         * An object whose purpose is to allow a user to edit a date
         */
        DATE_EDITOR = 12,
        /**
         * An inconifed internal frame within a DESKTOP_PANE
         */
        DESKTOP_ICON = 13,
        /**
         * A pane that supports internal frames and iconified versions of those internal frames
         */
        DESKTOP_FRAME = 14,
        /**
         * An object whose purpose is to allow a user to set a value
         */
        DIAL = 15,
        /**
         * A top level window with title bar and a border
         */
        DIALOG = 16,
        /**
         * A pane that allows the user to navigate through and select the contents of a directory
         */
        DIRECTORY_PANE = 17,
        /**
         * An object used for drawing custom user interface elements
         */
        DRAWING_AREA = 18,
        /**
         * A specialized dialog that lets the user choose a file
         */
        FILE_CHOOSER = 19,
        /**
         * A object that fills up space in a user interface
         */
        FILLER = 20,
        /**
         * A specialized dialog that lets the user choose a font
         */
        FONT_CHOOSER = 21,
        /**
         * A top level window with a title bar, border, menubar, etc.
         */
        FRAME = 22,
        /**
         * A pane that is guaranteed to be painted on top of all panes beneath it
         */
        GLASS_PANE = 23,
        /**
         * A document container for HTML, whose children represent the document content
         */
        HTML_CONTAINER = 24,
        /**
         * A small fixed size picture, typically used to decorate components
         */
        ICON = 25,
        /**
         * An object whose primary purpose is to display an image
         */
        IMAGE = 26,
        /**
         * A frame-like object that is clipped by a desktop pane
         */
        INTERNAL_FRAME = 27,
        /**
         * An object used to present an icon or short string in an interface
         */
        LABEL = 28,
        /**
         * A specialized pane that allows its children to be drawn in layers, providing a form of stacking order
         */
        LAYERED_PANE = 29,
        /**
         * An object that presents a list of objects to the user and allows the user to select one or more of them
         */
        LIST = 30,
        /**
         * An object that represents an element of a list
         */
        LIST_ITEM = 31,
        /**
         * An object usually found inside a menu bar that contains a list of actions the user can choose from
         */
        MENU = 32,
        /**
         * An object usually drawn at the top of the primary dialog box of an application that contains a list of menus the user can choose from
         */
        MENU_BAR = 33,
        /**
         * An object usually contained in a menu that presents an action the user can choose
         */
        MENU_ITEM = 34,
        /**
         * A specialized pane whose primary use is inside a DIALOG
         */
        OPTION_PANE = 35,
        /**
         * An object that is a child of a page tab list
         */
        PAGE_TAB = 36,
        /**
         * An object that presents a series of panels (or page tabs), one at a time, through some mechanism provided by the object
         */
        PAGE_TAB_LIST = 37,
        /**
         * A generic container that is often used to group objects
         */
        PANEL = 38,
        /**
         * A text object uses for passwords, or other places where the text content is not shown visibly to the user
         */
        PASSWORD_TEXT = 39,
        /**
         * A temporary window that is usually used to offer the user a list of choices, and then hides when the user selects one of those choices
         */
        POPUP_MENU = 40,
        /**
         * An object used to indicate how much of a task has been completed
         */
        PROGRESS_BAR = 41,
        /**
         * An object the user can manipulate to tell the application to do something
         */
        PUSH_BUTTON = 42,
        /**
         * A specialized check box that will cause other radio buttons in the same group to become unchecked when this one is checked
         */
        RADIO_BUTTON = 43,
        /**
         * A check menu item which belongs to a group. At each instant exactly one of the radio menu items from a group is selected
         */
        RADIO_MENU_ITEM = 44,
        /**
         * A specialized pane that has a glass pane and a layered pane as its children
         */
        ROOT_PANE = 45,
        /**
         * The header for a row of data
         */
        ROW_HEADER = 46,
        /**
         * An object usually used to allow a user to incrementally view a large amount of data.
         */
        SCROLL_BAR = 47,
        /**
         * An object that allows a user to incrementally view a large amount of information
         */
        SCROLL_PANE = 48,
        /**
         * An object usually contained in a menu to provide a visible and logical separation of the contents in a menu
         */
        SEPARATOR = 49,
        /**
         * An object that allows the user to select from a bounded range
         */
        SLIDER = 50,
        /**
         * A specialized panel that presents two other panels at the same time
         */
        SPLIT_PANE = 51,
        /**
         * An object used to get an integer or floating point number from the user
         */
        SPIN_BUTTON = 52,
        /**
         * An object which reports messages of minor importance to the user
         */
        STATUSBAR = 53,
        /**
         * An object used to represent information in terms of rows and columns
         */
        TABLE = 54,
        /**
         * A cell in a table
         */
        TABLE_CELL = 55,
        /**
         * The header for a column of a table
         */
        TABLE_COLUMN_HEADER = 56,
        /**
         * The header for a row of a table
         */
        TABLE_ROW_HEADER = 57,
        /**
         * A menu item used to tear off and reattach its menu
         */
        TEAR_OFF_MENU_ITEM = 58,
        /**
         * An object that represents an accessible terminal.  (Since: 0.6)
         */
        TERMINAL = 59,
        /**
         * An interactive widget that supports multiple lines of text and
         * optionally accepts user input, but whose purpose is not to solicit user input.
         * Thus ATK_ROLE_TEXT is appropriate for the text view in a plain text editor
         * but inappropriate for an input field in a dialog box or web form. For widgets
         * whose purpose is to solicit input from the user, see ATK_ROLE_ENTRY and
         * ATK_ROLE_PASSWORD_TEXT. For generic objects which display a brief amount of
         * textual information, see ATK_ROLE_STATIC.
         */
        TEXT = 60,
        /**
         * A specialized push button that can be checked or unchecked, but does not provide a separate indicator for the current state
         */
        TOGGLE_BUTTON = 61,
        /**
         * A bar or palette usually composed of push buttons or toggle buttons
         */
        TOOL_BAR = 62,
        /**
         * An object that provides information about another object
         */
        TOOL_TIP = 63,
        /**
         * An object used to represent hierarchical information to the user
         */
        TREE = 64,
        /**
         * An object capable of expanding and collapsing rows as well as showing multiple columns of data.   (Since: 0.7)
         */
        TREE_TABLE = 65,
        /**
         * The object contains some Accessible information, but its role is not known
         */
        UNKNOWN = 66,
        /**
         * An object usually used in a scroll pane
         */
        VIEWPORT = 67,
        /**
         * A top level window with no title or border.
         */
        WINDOW = 68,
        /**
         * An object that serves as a document header. (Since: 1.1.1)
         */
        HEADER = 69,
        /**
         * An object that serves as a document footer.  (Since: 1.1.1)
         */
        FOOTER = 70,
        /**
         * An object which is contains a paragraph of text content.   (Since: 1.1.1)
         */
        PARAGRAPH = 71,
        /**
         * An object which describes margins and tab stops, etc. for text objects which it controls (should have CONTROLLER_FOR relation to such).   (Since: 1.1.1)
         */
        RULER = 72,
        /**
         * The object is an application object, which may contain #ATK_ROLE_FRAME objects or other types of accessibles.  The root accessible of any application's ATK hierarchy should have ATK_ROLE_APPLICATION.   (Since: 1.1.4)
         */
        APPLICATION = 73,
        /**
         * The object is a dialog or list containing items for insertion into an entry widget, for instance a list of words for completion of a text entry.   (Since: 1.3)
         */
        AUTOCOMPLETE = 74,
        /**
         * The object is an editable text object in a toolbar.  (Since: 1.5)
         */
        EDIT_BAR = 75,
        /**
         * The object is an embedded container within a document or panel.  This role is a grouping "hint" indicating that the contained objects share a context.  (Since: 1.7.2)
         */
        EMBEDDED = 76,
        /**
         * The object is a component whose textual content may be entered or modified by the user, provided #ATK_STATE_EDITABLE is present.   (Since: 1.11)
         */
        ENTRY = 77,
        /**
         * The object is a graphical depiction of quantitative data. It may contain multiple subelements whose attributes and/or description may be queried to obtain both the quantitative data and information about how the data is being presented. The LABELLED_BY relation is particularly important in interpreting objects of this type, as is the accessible-description property.  (Since: 1.11)
         */
        CHART = 78,
        /**
         * The object contains descriptive information, usually textual, about another user interface element such as a table, chart, or image.  (Since: 1.11)
         */
        CAPTION = 79,
        /**
         * The object is a visual frame or container which contains a view of document content. Document frames may occur within another Document instance, in which case the second document may be said to be embedded in the containing instance. HTML frames are often ROLE_DOCUMENT_FRAME. Either this object, or a singleton descendant, should implement the Document interface.  (Since: 1.11)
         */
        DOCUMENT_FRAME = 80,
        /**
         * The object serves as a heading for content which follows it in a document. The 'heading level' of the heading, if availabe, may be obtained by querying the object's attributes.
         */
        HEADING = 81,
        /**
         * The object is a containing instance which encapsulates a page of information. #ATK_ROLE_PAGE is used in documents and content which support a paginated navigation model.  (Since: 1.11)
         */
        PAGE = 82,
        /**
         * The object is a containing instance of document content which constitutes a particular 'logical' section of the document. The type of content within a section, and the nature of the section division itself, may be obtained by querying the object's attributes. Sections may be nested. (Since: 1.11)
         */
        SECTION = 83,
        /**
         * The object is redundant with another object in the hierarchy, and is exposed for purely technical reasons.  Objects of this role should normally be ignored by clients. (Since: 1.11)
         */
        REDUNDANT_OBJECT = 84,
        /**
         * The object is a container for form controls, for instance as part of a
         * web form or user-input form within a document.  This role is primarily a tag/convenience for
         * clients when navigating complex documents, it is not expected that ordinary GUI containers will
         * always have ATK_ROLE_FORM. (Since: 1.12.0)
         */
        FORM = 85,
        /**
         * The object is a hypertext anchor, i.e. a "link" in a
         * hypertext document.  Such objects are distinct from 'inline'
         * content which may also use the Hypertext/Hyperlink interfaces
         * to indicate the range/location within a text object where
         * an inline or embedded object lies.  (Since: 1.12.1)
         */
        LINK = 86,
        /**
         * The object is a window or similar viewport
         * which is used to allow composition or input of a 'complex character',
         * in other words it is an "input method window." (Since: 1.12.1)
         */
        INPUT_METHOD_WINDOW = 87,
        /**
         * A row in a table.  (Since: 2.1.0)
         */
        TABLE_ROW = 88,
        /**
         * An object that represents an element of a tree.  (Since: 2.1.0)
         */
        TREE_ITEM = 89,
        /**
         * A document frame which contains a spreadsheet.  (Since: 2.1.0)
         */
        DOCUMENT_SPREADSHEET = 90,
        /**
         * A document frame which contains a presentation or slide content.  (Since: 2.1.0)
         */
        DOCUMENT_PRESENTATION = 91,
        /**
         * A document frame which contains textual content, such as found in a word processing application.  (Since: 2.1.0)
         */
        DOCUMENT_TEXT = 92,
        /**
         * A document frame which contains HTML or other markup suitable for display in a web browser.  (Since: 2.1.0)
         */
        DOCUMENT_WEB = 93,
        /**
         * A document frame which contains email content to be displayed or composed either in plain text or HTML.  (Since: 2.1.0)
         */
        DOCUMENT_EMAIL = 94,
        /**
         * An object found within a document and designed to present a comment, note, or other annotation. In some cases, this object might not be visible until activated.  (Since: 2.1.0)
         */
        COMMENT = 95,
        /**
         * A non-collapsible list of choices the user can select from. (Since: 2.1.0)
         */
        LIST_BOX = 96,
        /**
         * A group of related widgets. This group typically has a label. (Since: 2.1.0)
         */
        GROUPING = 97,
        /**
         * An image map object. Usually a graphic with multiple hotspots, where each hotspot can be activated resulting in the loading of another document or section of a document. (Since: 2.1.0)
         */
        IMAGE_MAP = 98,
        /**
         * A transitory object designed to present a message to the user, typically at the desktop level rather than inside a particular application.  (Since: 2.1.0)
         */
        NOTIFICATION = 99,
        /**
         * An object designed to present a message to the user within an existing window. (Since: 2.1.0)
         */
        INFO_BAR = 100,
        /**
         * A bar that serves as a level indicator to, for instance, show the strength of a password or the state of a battery.  (Since: 2.7.3)
         */
        LEVEL_BAR = 101,
        /**
         * A bar that serves as the title of a window or a
         * dialog. (Since: 2.12)
         */
        TITLE_BAR = 102,
        /**
         * An object which contains a text section
         * that is quoted from another source. (Since: 2.12)
         */
        BLOCK_QUOTE = 103,
        /**
         * An object which represents an audio element. (Since: 2.12)
         */
        AUDIO = 104,
        /**
         * An object which represents a video element. (Since: 2.12)
         */
        VIDEO = 105,
        /**
         * A definition of a term or concept. (Since: 2.12)
         */
        DEFINITION = 106,
        /**
         * A section of a page that consists of a
         * composition that forms an independent part of a document, page, or
         * site. Examples: A blog entry, a news story, a forum post. (Since: 2.12)
         */
        ARTICLE = 107,
        /**
         * A region of a web page intended as a
         * navigational landmark. This is designed to allow Assistive
         * Technologies to provide quick navigation among key regions within a
         * document. (Since: 2.12)
         */
        LANDMARK = 108,
        /**
         * A text widget or container holding log content, such
         * as chat history and error logs. In this role there is a
         * relationship between the arrival of new items in the log and the
         * reading order. The log contains a meaningful sequence and new
         * information is added only to the end of the log, not at arbitrary
         * points. (Since: 2.12)
         */
        LOG = 109,
        /**
         * A container where non-essential information
         * changes frequently. Common usages of marquee include stock tickers
         * and ad banners. The primary difference between a marquee and a log
         * is that logs usually have a meaningful order or sequence of
         * important content changes. (Since: 2.12)
         */
        MARQUEE = 110,
        /**
         * A text widget or container that holds a mathematical
         * expression. (Since: 2.12)
         */
        MATH = 111,
        /**
         * A widget whose purpose is to display a rating,
         * such as the number of stars associated with a song in a media
         * player. Objects of this role should also implement
         * AtkValue. (Since: 2.12)
         */
        RATING = 112,
        /**
         * An object containing a numerical counter which
         * indicates an amount of elapsed time from a start point, or the time
         * remaining until an end point. (Since: 2.12)
         */
        TIMER = 113,
        /**
         * An object that represents a list of
         * term-value groups. A term-value group represents a individual
         * description and consist of one or more names
         * (ATK_ROLE_DESCRIPTION_TERM) followed by one or more values
         * (ATK_ROLE_DESCRIPTION_VALUE). For each list, there should not be
         * more than one group with the same term name. (Since: 2.12)
         */
        DESCRIPTION_LIST = 114,
        /**
         * An object that represents a term or phrase
         * with a corresponding definition. (Since: 2.12)
         */
        DESCRIPTION_TERM = 115,
        /**
         * An object that represents the
         * description, definition or value of a term. (Since: 2.12)
         */
        DESCRIPTION_VALUE = 116,
        /**
         * A generic non-container object whose purpose is to display a
         * brief amount of information to the user and whose role is known by the
         * implementor but lacks semantic value for the user. Examples in which
         * %ATK_ROLE_STATIC is appropriate include the message displayed in a message box
         * and an image used as an alternative means to display text. %ATK_ROLE_STATIC
         * should not be applied to widgets which are traditionally interactive, objects
         * which display a significant amount of content, or any object which has an
         * accessible relation pointing to another object. Implementors should expose the
         * displayed information through the accessible name of the object. If doing so seems
         * inappropriate, it may indicate that a different role should be used. For
         * labels which describe another widget, see %ATK_ROLE_LABEL. For text views, see
         * %ATK_ROLE_TEXT. For generic containers, see %ATK_ROLE_PANEL. For objects whose
         * role is not known by the implementor, see %ATK_ROLE_UNKNOWN. (Since: 2.16)
         */
        STATIC = 117,
        /**
         * An object that represents a mathematical fraction.
         * (Since: 2.16)
         */
        MATH_FRACTION = 118,
        /**
         * An object that represents a mathematical expression
         * displayed with a radical. (Since: 2.16)
         */
        MATH_ROOT = 119,
        /**
         * An object that contains text that is displayed as a
         * subscript. (Since: 2.16)
         */
        SUBSCRIPT = 120,
        /**
         * An object that contains text that is displayed as a
         * superscript. (Since: 2.16)
         */
        SUPERSCRIPT = 121,
        /**
         * An object that contains the text of a footnote. (Since: 2.26)
         */
        FOOTNOTE = 122,
        /**
         * Content previously deleted or proposed to be
         * deleted, e.g. in revision history or a content view providing suggestions
         * from reviewers. (Since: 2.34)
         */
        CONTENT_DELETION = 123,
        /**
         * Content previously inserted or proposed to be
         * inserted, e.g. in revision history or a content view providing suggestions
         * from reviewers. (Since: 2.34)
         */
        CONTENT_INSERTION = 124,
        /**
         * A run of content that is marked or highlighted, such as for
         * reference purposes, or to call it out as having a special purpose. If the
         * marked content has an associated section in the document elaborating on the
         * reason for the mark, then %ATK_RELATION_DETAILS should be used on the mark
         * to point to that associated section. In addition, the reciprocal relation
         * %ATK_RELATION_DETAILS_FOR should be used on the associated content section
         * to point back to the mark. (Since: 2.36)
         */
        MARK = 125,
        /**
         * A container for content that is called out as a proposed
         * change from the current version of the document, such as by a reviewer of the
         * content. This role should include either %ATK_ROLE_CONTENT_DELETION and/or
         * %ATK_ROLE_CONTENT_INSERTION children, in any order, to indicate what the
         * actual change is. (Since: 2.36)
         */
        SUGGESTION = 126,
        /**
         * not a valid role, used for finding end of the enumeration
         */
        LAST_DEFINED = 127
    }

    /**
     * Specifies where an object should be placed on the screen when using scroll_to.
     */
    enum ScrollType {
        /**
         * Scroll the object vertically and horizontally to bring
         *   its top left corner to the top left corner of the window.
         */
        TOP_LEFT = 0,
        /**
         * Scroll the object vertically and horizontally to
         *   bring its bottom right corner to the bottom right corner of the window.
         */
        BOTTOM_RIGHT = 1,
        /**
         * Scroll the object vertically to bring its top edge to
         *   the top edge of the window.
         */
        TOP_EDGE = 2,
        /**
         * Scroll the object vertically to bring its bottom
         *   edge to the bottom edge of the window.
         */
        BOTTOM_EDGE = 3,
        /**
         * Scroll the object vertically and horizontally to bring
         *   its left edge to the left edge of the window.
         */
        LEFT_EDGE = 4,
        /**
         * Scroll the object vertically and horizontally to
         *   bring its right edge to the right edge of the window.
         */
        RIGHT_EDGE = 5,
        /**
         * Scroll the object vertically and horizontally so that
         *   as much as possible of the object becomes visible. The exact placement is
         *   determined by the application.
         */
        ANYWHERE = 6
    }

    /**
     * The possible types of states of an object
     */
    enum StateType {
        /**
         * Indicates an invalid state - probably an error condition.
         */
        INVALID = 0,
        /**
         * Indicates a window is currently the active window, or an object is the active subelement within a container or table. ATK_STATE_ACTIVE should not be used for objects which have ATK_STATE_FOCUSABLE or ATK_STATE_SELECTABLE: Those objects should use ATK_STATE_FOCUSED and ATK_STATE_SELECTED respectively. ATK_STATE_ACTIVE is a means to indicate that an object which is not focusable and not selectable is the currently-active item within its parent container.
         */
        ACTIVE = 1,
        /**
         * Indicates that the object is 'armed', i.e. will be activated by if a pointer button-release event occurs within its bounds.  Buttons often enter this state when a pointer click occurs within their bounds, as a precursor to activation. ATK_STATE_ARMED has been deprecated since ATK-2.16 and should not be used in newly-written code.
         */
        ARMED = 2,
        /**
         * Indicates the current object is busy, i.e. onscreen representation is in the process of changing, or the object is temporarily unavailable for interaction due to activity already in progress.  This state may be used by implementors of Document to indicate that content loading is underway.  It also may indicate other 'pending' conditions; clients may wish to interrogate this object when the ATK_STATE_BUSY flag is removed.
         */
        BUSY = 3,
        /**
         * Indicates this object is currently checked, for instance a checkbox is 'non-empty'.
         */
        CHECKED = 4,
        /**
         * Indicates that this object no longer has a valid backing widget (for instance, if its peer object has been destroyed)
         */
        DEFUNCT = 5,
        /**
         * Indicates that this object can contain text, and that the
         * user can change the textual contents of this object by editing those contents
         * directly. For an object which is expected to be editable due to its type, but
         * which cannot be edited due to the application or platform preventing the user
         * from doing so, that object's {@link StateSet} should lack ATK_STATE_EDITABLE and
         * should contain ATK_STATE_READ_ONLY.
         */
        EDITABLE = 6,
        /**
         * Indicates that this object is enabled, i.e. that it currently reflects some application state. Objects that are "greyed out" may lack this state, and may lack the STATE_SENSITIVE if direct user interaction cannot cause them to acquire STATE_ENABLED. See also: ATK_STATE_SENSITIVE
         */
        ENABLED = 7,
        /**
         * Indicates this object allows progressive disclosure of its children
         */
        EXPANDABLE = 8,
        /**
         * Indicates this object its expanded - see ATK_STATE_EXPANDABLE above
         */
        EXPANDED = 9,
        /**
         * Indicates this object can accept keyboard focus, which means all events resulting from typing on the keyboard will normally be passed to it when it has focus
         */
        FOCUSABLE = 10,
        /**
         * Indicates this object currently has the keyboard focus
         */
        FOCUSED = 11,
        /**
         * Indicates the orientation of this object is horizontal; used, for instance, by objects of ATK_ROLE_SCROLL_BAR.  For objects where vertical/horizontal orientation is especially meaningful.
         */
        HORIZONTAL = 12,
        /**
         * Indicates this object is minimized and is represented only by an icon
         */
        ICONIFIED = 13,
        /**
         * Indicates something must be done with this object before the user can interact with an object in a different window
         */
        MODAL = 14,
        /**
         * Indicates this (text) object can contain multiple lines of text
         */
        MULTI_LINE = 15,
        /**
         * Indicates this object allows more than one of its children to be selected at the same time, or in the case of text objects, that the object supports non-contiguous text selections.
         */
        MULTISELECTABLE = 16,
        /**
         * Indicates this object paints every pixel within its rectangular region.
         */
        OPAQUE = 17,
        /**
         * Indicates this object is currently pressed.
         */
        PRESSED = 18,
        /**
         * Indicates the size of this object is not fixed
         */
        RESIZABLE = 19,
        /**
         * Indicates this object is the child of an object that allows its children to be selected and that this child is one of those children that can be selected
         */
        SELECTABLE = 20,
        /**
         * Indicates this object is the child of an object that allows its children to be selected and that this child is one of those children that has been selected
         */
        SELECTED = 21,
        /**
         * Indicates this object is sensitive, e.g. to user interaction.
         * STATE_SENSITIVE usually accompanies STATE_ENABLED for user-actionable controls,
         * but may be found in the absence of STATE_ENABLED if the current visible state of the
         * control is "disconnected" from the application state.  In such cases, direct user interaction
         * can often result in the object gaining STATE_SENSITIVE, for instance if a user makes
         * an explicit selection using an object whose current state is ambiguous or undefined.
         * #see STATE_ENABLED, STATE_INDETERMINATE.
         */
        SENSITIVE = 22,
        /**
         * Indicates this object, the object's parent, the object's parent's parent, and so on,
         * are all 'shown' to the end-user, i.e. subject to "exposure" if blocking or obscuring objects do not interpose
         * between this object and the top of the window stack.
         */
        SHOWING = 23,
        /**
         * Indicates this (text) object can contain only a single line of text
         */
        SINGLE_LINE = 24,
        /**
         * Indicates that the information returned for this object may no longer be
         * synchronized with the application state.  This is implied if the object has STATE_TRANSIENT,
         * and can also occur towards the end of the object peer's lifecycle. It can also be used to indicate that
         * the index associated with this object has changed since the user accessed the object (in lieu of
         * "index-in-parent-changed" events).
         */
        STALE = 25,
        /**
         * Indicates this object is transient, i.e. a snapshot which may not emit events when its
         * state changes.  Data from objects with ATK_STATE_TRANSIENT should not be cached, since there may be no
         * notification given when the cached data becomes obsolete.
         */
        TRANSIENT = 26,
        /**
         * Indicates the orientation of this object is vertical
         */
        VERTICAL = 27,
        /**
         * Indicates this object is visible, e.g. has been explicitly marked for exposure to the user.
         * **note**: %ATK_STATE_VISIBLE is no guarantee that the object is actually unobscured on the screen, only
         * that it is 'potentially' visible, barring obstruction, being scrolled or clipped out of the
         * field of view, or having an ancestor container that has not yet made visible.
         * A widget is potentially onscreen if it has both %ATK_STATE_VISIBLE and %ATK_STATE_SHOWING.
         * The absence of %ATK_STATE_VISIBLE and %ATK_STATE_SHOWING is semantically equivalent to saying
         * that an object is 'hidden'.  See also %ATK_STATE_TRUNCATED, which applies if an object with
         * %ATK_STATE_VISIBLE and %ATK_STATE_SHOWING set lies within a viewport which means that its
         * contents are clipped, e.g. a truncated spreadsheet cell or
         * an image within a scrolling viewport.  Mostly useful for screen-review and magnification
         * algorithms.
         */
        VISIBLE = 28,
        /**
         * Indicates that "active-descendant-changed" event
         * is sent when children become 'active' (i.e. are selected or navigated to onscreen).
         * Used to prevent need to enumerate all children in very large containers, like tables.
         * The presence of STATE_MANAGES_DESCENDANTS is an indication to the client.
         * that the children should not, and need not, be enumerated by the client.
         * Objects implementing this state are expected to provide relevant state
         * notifications to listening clients, for instance notifications of visibility
         * changes and activation of their contained child objects, without the client
         * having previously requested references to those children.
         */
        MANAGES_DESCENDANTS = 29,
        /**
         * Indicates that the value, or some other quantifiable
         * property, of this AtkObject cannot be fully determined. In the case of a large
         * data set in which the total number of items in that set is unknown (e.g. 1 of
         * 999+), implementors should expose the currently-known set size (999) along
         * with this state. In the case of a check box, this state should be used to
         * indicate that the check box is a tri-state check box which is currently
         * neither checked nor unchecked.
         */
        INDETERMINATE = 30,
        /**
         * Indicates that an object is truncated, e.g. a text value in a speradsheet cell.
         */
        TRUNCATED = 31,
        /**
         * Indicates that explicit user interaction with an object is required by the user interface, e.g. a required field in a "web-form" interface.
         */
        REQUIRED = 32,
        /**
         * Indicates that the object has encountered an error condition due to failure of input validation. For instance, a form control may acquire this state in response to invalid or malformed user input.
         */
        INVALID_ENTRY = 33,
        /**
         * Indicates that the object in question implements some form of ¨typeahead¨ or
         * pre-selection behavior whereby entering the first character of one or more sub-elements
         * causes those elements to scroll into view or become selected.  Subsequent character input
         * may narrow the selection further as long as one or more sub-elements match the string.
         * This state is normally only useful and encountered on objects that implement Selection.
         * In some cases the typeahead behavior may result in full or partial ¨completion¨ of
         * the data in the input field, in which case these input events may trigger text-changed
         * events from the AtkText interface.  This state supplants #ATK_ROLE_AUTOCOMPLETE.
         */
        SUPPORTS_AUTOCOMPLETION = 34,
        /**
         * Indicates that the object in question supports text selection. It should only be exposed on objects which implement the Text interface, in order to distinguish this state from #ATK_STATE_SELECTABLE, which infers that the object in question is a selectable child of an object which implements Selection. While similar, text selection and subelement selection are distinct operations.
         */
        SELECTABLE_TEXT = 35,
        /**
         * Indicates that the object is the "default" active component, i.e. the object which is activated by an end-user press of the "Enter" or "Return" key.  Typically a "close" or "submit" button.
         */
        DEFAULT = 36,
        /**
         * Indicates that the object changes its appearance dynamically as an inherent part of its presentation.  This state may come and go if an object is only temporarily animated on the way to a 'final' onscreen presentation.
         * **note**: some applications, notably content viewers, may not be able to detect
         * all kinds of animated content.  Therefore the absence of this state should not
         * be taken as definitive evidence that the object's visual representation is
         * static; this state is advisory.
         */
        ANIMATED = 37,
        /**
         * Indicates that the object (typically a hyperlink) has already been 'activated', and/or its backing data has already been downloaded, rendered, or otherwise "visited".
         */
        VISITED = 38,
        /**
         * Indicates this object has the potential to be
         *  checked, such as a checkbox or toggle-able table cell. #Since:
         *  ATK-2.12
         */
        CHECKABLE = 39,
        /**
         * Indicates that the object has a popup context
         * menu or sub-level menu which may or may not be showing. This means
         * that activation renders conditional content.  Note that ordinary
         * tooltips are not considered popups in this context. #Since: ATK-2.12
         */
        HAS_POPUP = 40,
        /**
         * Indicates this object has a tooltip. #Since: ATK-2.16
         */
        HAS_TOOLTIP = 41,
        /**
         * Indicates that a widget which is ENABLED and SENSITIVE
         * has a value which can be read, but not modified, by the user. Note that this
         * state should only be applied to widget types whose value is normally directly
         * user modifiable, such as check boxes, radio buttons, spin buttons, text input
         * fields, and combo boxes, as a means to convey that the expected interaction
         * with that widget is not possible. When the expected interaction with a
         * widget does not include modification by the user, as is the case with
         * labels and containers, ATK_STATE_READ_ONLY should not be applied. See also
         * ATK_STATE_EDITABLE. #Since: ATK-2-16
         */
        READ_ONLY = 42,
        /**
         * Not a valid state, used for finding end of enumeration
         */
        LAST_DEFINED = 43
    }

    /**
     * Describes the text attributes supported
     */
    enum TextAttribute {
        /**
         * Invalid attribute, like bad spelling or grammar.
         */
        INVALID = 0,
        /**
         * The pixel width of the left margin
         */
        LEFT_MARGIN = 1,
        /**
         * The pixel width of the right margin
         */
        RIGHT_MARGIN = 2,
        /**
         * The number of pixels that the text is indented
         */
        INDENT = 3,
        /**
         * Either "true" or "false" indicating whether text is visible or not
         */
        INVISIBLE = 4,
        /**
         * Either "true" or "false" indicating whether text is editable or not
         */
        EDITABLE = 5,
        /**
         * Pixels of blank space to leave above each newline-terminated line.
         */
        PIXELS_ABOVE_LINES = 6,
        /**
         * Pixels of blank space to leave below each newline-terminated line.
         */
        PIXELS_BELOW_LINES = 7,
        /**
         * Pixels of blank space to leave between wrapped lines inside the same newline-terminated line (paragraph).
         */
        PIXELS_INSIDE_WRAP = 8,
        /**
         * "true" or "false" whether to make the background color for each character the height of the highest font used on the current line, or the height of the font used for the current character.
         */
        BG_FULL_HEIGHT = 9,
        /**
         * Number of pixels that the characters are risen above the baseline. See also ATK_TEXT_ATTR_TEXT_POSITION.
         */
        RISE = 10,
        /**
         * "none", "single", "double", "low", or "error"
         */
        UNDERLINE = 11,
        /**
         * "true" or "false" whether the text is strikethrough
         */
        STRIKETHROUGH = 12,
        /**
         * The size of the characters in points. eg: 10
         */
        SIZE = 13,
        /**
         * The scale of the characters. The value is a string representation of a double
         */
        SCALE = 14,
        /**
         * The weight of the characters.
         */
        WEIGHT = 15,
        /**
         * The language used
         */
        LANGUAGE = 16,
        /**
         * The font family name
         */
        FAMILY_NAME = 17,
        /**
         * The background color. The value is an RGB value of the format "%u,%u,%u"
         */
        BG_COLOR = 18,
        /**
         * The foreground color. The value is an RGB value of the format "%u,%u,%u"
         */
        FG_COLOR = 19,
        /**
         * "true" if a #GdkBitmap is set for stippling the background color.
         */
        BG_STIPPLE = 20,
        /**
         * "true" if a #GdkBitmap is set for stippling the foreground color.
         */
        FG_STIPPLE = 21,
        /**
         * The wrap mode of the text, if any. Values are "none", "char", "word", or "word_char".
         */
        WRAP_MODE = 22,
        /**
         * The direction of the text, if set. Values are "none", "ltr" or "rtl"
         */
        DIRECTION = 23,
        /**
         * The justification of the text, if set. Values are "left", "right", "center" or "fill"
         */
        JUSTIFICATION = 24,
        /**
         * The stretch of the text, if set. Values are "ultra_condensed", "extra_condensed", "condensed", "semi_condensed", "normal", "semi_expanded", "expanded", "extra_expanded" or "ultra_expanded"
         */
        STRETCH = 25,
        /**
         * The capitalization variant of the text, if set. Values are "normal" or "small_caps"
         */
        VARIANT = 26,
        /**
         * The slant style of the text, if set. Values are "normal", "oblique" or "italic"
         */
        STYLE = 27,
        /**
         * The vertical position with respect to the baseline. Values are "baseline", "super", or "sub". Note that a super or sub text attribute refers to position with respect to the baseline of the prior character.
         */
        TEXT_POSITION = 28,
        /**
         * not a valid text attribute, used for finding end of enumeration
         */
        LAST_DEFINED = 29
    }

    /**
     * Text boundary types used for specifying boundaries for regions of text.
     * This enumeration is deprecated since 2.9.4 and should not be used. Use
     * AtkTextGranularity with #atk_text_get_string_at_offset instead.
     */
    enum TextBoundary {
        /**
         * Boundary is the boundary between characters
         * (including non-printing characters)
         */
        CHAR = 0,
        /**
         * Boundary is the start (i.e. first character) of a word.
         */
        WORD_START = 1,
        /**
         * Boundary is the end (i.e. last
         * character) of a word.
         */
        WORD_END = 2,
        /**
         * Boundary is the first character in a sentence.
         */
        SENTENCE_START = 3,
        /**
         * Boundary is the last (terminal)
         * character in a sentence; in languages which use "sentence stop"
         * punctuation such as English, the boundary is thus the '.', '?', or
         * similar terminal punctuation character.
         */
        SENTENCE_END = 4,
        /**
         * Boundary is the initial character of the content or a
         * character immediately following a newline, linefeed, or return character.
         */
        LINE_START = 5,
        /**
         * Boundary is the linefeed, or return
         * character.
         */
        LINE_END = 6
    }

    /**
     * Describes the type of clipping required.
     */
    enum TextClipType {
        /**
         * No clipping to be done
         */
        NONE = 0,
        /**
         * Text clipped by min coordinate is omitted
         */
        MIN = 1,
        /**
         * Text clipped by max coordinate is omitted
         */
        MAX = 2,
        /**
         * Only text fully within mix/max bound is retained
         */
        BOTH = 3
    }

    /**
     * Text granularity types used for specifying the granularity of the region of
     * text we are interested in.
     */
    enum TextGranularity {
        /**
         * Granularity is defined by the boundaries between characters
         * (including non-printing characters)
         */
        CHAR = 0,
        /**
         * Granularity is defined by the boundaries of a word,
         * starting at the beginning of the current word and finishing at the beginning of
         * the following one, if present.
         */
        WORD = 1,
        /**
         * Granularity is defined by the boundaries of a sentence,
         * starting at the beginning of the current sentence and finishing at the beginning of
         * the following one, if present.
         */
        SENTENCE = 2,
        /**
         * Granularity is defined by the boundaries of a line,
         * starting at the beginning of the current line and finishing at the beginning of
         * the following one, if present.
         */
        LINE = 3,
        /**
         * Granularity is defined by the boundaries of a paragraph,
         * starting at the beginning of the current paragraph and finishing at the beginning of
         * the following one, if present.
         */
        PARAGRAPH = 4
    }

    /**
     * Default types for a given value. Those are defined in order to
     * easily get localized strings to describe a given value or a given
     * subrange, using atk_value_type_get_localized_name().
     */
    enum ValueType {
        VERY_WEAK = 0,
        WEAK = 1,
        ACCEPTABLE = 2,
        STRONG = 3,
        VERY_STRONG = 4,
        VERY_LOW = 5,
        LOW = 6,
        MEDIUM = 7,
        HIGH = 8,
        VERY_HIGH = 9,
        VERY_BAD = 10,
        BAD = 11,
        GOOD = 12,
        VERY_GOOD = 13,
        BEST = 14,
        LAST_DEFINED = 15
    }

    /**
     * Describes the type of link
     */
    enum HyperlinkStateFlags {
        /**
         * Link is inline
         */
        INLINE = 1
    }

    /**
     * A function which is called when an object emits a matching event,
     * as used in #atk_add_focus_tracker.
     * Currently the only events for which object-specific handlers are
     * supported are events of type "focus:".  Most clients of ATK will prefer to
     * attach signal handlers for the various ATK signals instead.
     * 
     * see atk_add_focus_tracker.
     */
    interface EventListener {
        /**
         * A function which is called when an object emits a matching event,
         * as used in #atk_add_focus_tracker.
         * Currently the only events for which object-specific handlers are
         * supported are events of type "focus:".  Most clients of ATK will prefer to
         * attach signal handlers for the various ATK signals instead.
         * 
         * see atk_add_focus_tracker.
         * @param obj An {@link Object} instance for whom the callback will be called when
         * the specified event (e.g. 'focus:') takes place.
         */
        (obj: Object): void;
    }

    /**
     * An {@link EventListenerInit} function is a special function that is
     * called in order to initialize the per-object event registration system
     * used by #AtkEventListener, if any preparation is required.
     * 
     * see atk_focus_tracker_init.
     */
    interface EventListenerInit {
        /**
         * An {@link EventListenerInit} function is a special function that is
         * called in order to initialize the per-object event registration system
         * used by #AtkEventListener, if any preparation is required.
         * 
         * see atk_focus_tracker_init.
         */
        (): void;
    }

    /**
     * The type of callback function used for
     * atk_component_add_focus_handler() and
     * atk_component_remove_focus_handler()
     */
    interface FocusHandler {
        /**
         * The type of callback function used for
         * atk_component_add_focus_handler() and
         * atk_component_remove_focus_handler()
         * @param object the {@link Object} that receives/lose the focus
         * @param focus_in TRUE if the object receives the focus
         */
        (object: Object, focus_in: boolean): void;
    }

    /**
     * An AtkFunction is a function definition used for padding which has
     * been added to class and interface structures to allow for expansion
     * in the future.
     */
    interface Function {
        /**
         * An AtkFunction is a function definition used for padding which has
         * been added to class and interface structures to allow for expansion
         * in the future.
         * @returns not used
         */
        (): boolean;
    }

    /**
     * An {@link KeySnoopFunc} is a type of callback which is called whenever a key event occurs,
     * if registered via atk_add_key_event_listener.  It allows for pre-emptive
     * interception of key events via the return code as described below.
     */
    interface KeySnoopFunc {
        /**
         * An {@link KeySnoopFunc} is a type of callback which is called whenever a key event occurs,
         * if registered via atk_add_key_event_listener.  It allows for pre-emptive
         * interception of key events via the return code as described below.
         * @param event an AtkKeyEventStruct containing information about the key event for which
         * notification is being given.
         * @returns TRUE (nonzero) if the event emission should be stopped and the event
         * discarded without being passed to the normal GUI recipient; FALSE (zero) if the
         * event dispatch to the client application should proceed as normal.
         * 
         * see atk_add_key_event_listener.
         */
        (event: KeyEventStruct): number;
    }

    /**
     * An AtkPropertyChangeHandler is a function which is executed when an
     * AtkObject's property changes value. It is specified in a call to
     * atk_object_connect_property_change_handler().
     */
    interface PropertyChangeHandler {
        /**
         * An AtkPropertyChangeHandler is a function which is executed when an
         * AtkObject's property changes value. It is specified in a call to
         * atk_object_connect_property_change_handler().
         * @param obj atkobject which property changes
         * @param vals values changed
         */
        (obj: Object, vals: PropertyValues): void;
    }

    /**
     * This is a singly-linked list (a #GSList) of {@link Attribute}. It is
     * used by atk_text_get_run_attributes(),
     * atk_text_get_default_attributes(),
     * atk_editable_text_set_run_attributes(),
     * atk_document_get_attributes() and atk_object_get_attributes()
     */
    type AttributeSet = GLib.SList;

    type State = number;

    /**
     * Adds the specified function to the list of functions to be called
     * when an object receives focus.
     * @param focus_tracker Function to be added to the list of functions to be called
     * when an object receives focus.
     * @returns added focus tracker id, or 0 on failure.
     */
    function add_focus_tracker(focus_tracker: EventListener): number;

    /**
     * Adds the specified function to the list of functions to be called
     * when an ATK event of type event_type occurs.
     * 
     * The format of event_type is the following:
     *  "ATK:&lt;atk_type&gt;:&lt;atk_event&gt;:&lt;atk_event_detail&gt;
     * 
     * Where "ATK" works as the namespace, &lt;atk_interface&gt; is the name of
     * the ATK type (interface or object), &lt;atk_event&gt; is the name of the
     * signal defined on that interface and &lt;atk_event_detail&gt; is the
     * gsignal detail of that signal. You can find more info about gsignal
     * details here:
     * http://developer.gnome.org/gobject/stable/gobject-Signals.html
     * 
     * The first three parameters are mandatory. The last one is optional.
     * 
     * For example:
     *   ATK:AtkObject:state-change
     *   ATK:AtkText:text-selection-changed
     *   ATK:AtkText:text-insert:system
     * 
     * Toolkit implementor note: ATK provides a default implementation for
     * this virtual method. ATK implementors are discouraged from
     * reimplementing this method.
     * 
     * Toolkit implementor note: this method is not intended to be used by
     * ATK implementors but by ATK consumers.
     * 
     * ATK consumers note: as this method adds a listener for a given ATK
     * type, that type should be already registered on the GType system
     * before calling this method. A simple way to do that is creating an
     * instance of {@link NoOpObject}. This class implements all ATK
     * interfaces, so creating the instance will register all ATK types as
     * a collateral effect.
     * @param listener the listener to notify
     * @param event_type the type of event for which notification is requested
     * @returns added event listener id, or 0 on failure.
     */
    function add_global_event_listener(listener: GObject.SignalEmissionHook, event_type: string): number;

    /**
     * Adds the specified function to the list of functions to be called
     *        when a key event occurs.  The #data element will be passed to the
     *        {@link KeySnoopFunc} (#listener) as the #func_data param, on notification.
     * @param listener the listener to notify
     * @param data a #gpointer that points to a block of data that should be sent to the registered listeners,
     *        along with the event notification, when it occurs.
     * @returns added event listener id, or 0 on failure.
     */
    function add_key_event_listener(listener: KeySnoopFunc, data: any): number;

    /**
     * Frees the memory used by an {@link AttributeSet}, including all its
     * #AtkAttributes.
     * @param attrib_set The {@link AttributeSet} to free
     */
    function attribute_set_free(attrib_set: AttributeSet): void;

    /**
     * Specifies the function to be called for focus tracker initialization.
     * This function should be called by an implementation of the
     * ATK interface if any specific work needs to be done to enable
     * focus tracking.
     * @param init Function to be called for focus tracker initialization
     */
    function focus_tracker_init(init: EventListenerInit): void;

    /**
     * Cause the focus tracker functions which have been specified to be
     * executed for the object.
     * @param object an {@link Object}
     */
    function focus_tracker_notify(object: Object): void;

    /**
     * Returns the binary age as passed to libtool when building the ATK
     * library the process is running against.
     * @returns the binary age of the ATK library
     */
    function get_binary_age(): number;

    /**
     * Gets a default implementation of the {@link ObjectFactory}/type
     * registry.
     * Note: For most toolkit maintainers, this will be the correct
     * registry for registering new #AtkObject factories. Following
     * a call to this function, maintainers may call atk_registry_set_factory_type()
     * to associate an #AtkObjectFactory subclass with the GType of objects
     * for whom accessibility information will be provided.
     * @returns a default implementation of the
     * {@link ObjectFactory}/type registry
     */
    function get_default_registry(): Registry;

    /**
     * Gets the currently focused object.
     * @returns the currently focused object for the current
     * application
     */
    function get_focus_object(): Object;

    /**
     * Returns the interface age as passed to libtool when building the
     * ATK library the process is running against.
     * @returns the interface age of the ATK library
     */
    function get_interface_age(): number;

    /**
     * Returns the major version number of the ATK library.  (e.g. in ATK
     * version 2.7.4 this is 2.)
     * 
     * This function is in the library, so it represents the ATK library
     * your code is running against. In contrast, the #ATK_MAJOR_VERSION
     * macro represents the major version of the ATK headers you have
     * included when compiling your code.
     * @returns the major version number of the ATK library
     */
    function get_major_version(): number;

    /**
     * Returns the micro version number of the ATK library.  (e.g. in ATK
     * version 2.7.4 this is 4.)
     * 
     * This function is in the library, so it represents the ATK library
     * your code is are running against. In contrast, the
     * #ATK_MICRO_VERSION macro represents the micro version of the ATK
     * headers you have included when compiling your code.
     * @returns the micro version number of the ATK library
     */
    function get_micro_version(): number;

    /**
     * Returns the minor version number of the ATK library.  (e.g. in ATK
     * version 2.7.4 this is 7.)
     * 
     * This function is in the library, so it represents the ATK library
     * your code is are running against. In contrast, the
     * #ATK_MINOR_VERSION macro represents the minor version of the ATK
     * headers you have included when compiling your code.
     * @returns the minor version number of the ATK library
     */
    function get_minor_version(): number;

    /**
     * Gets the root accessible container for the current application.
     * @returns the root accessible container for the current
     * application
     */
    function get_root(): Object;

    /**
     * Gets name string for the GUI toolkit implementing ATK for this application.
     * @returns name string for the GUI toolkit implementing ATK for this application
     */
    function get_toolkit_name(): string;

    /**
     * Gets version string for the GUI toolkit implementing ATK for this application.
     * @returns version string for the GUI toolkit implementing ATK for this application
     */
    function get_toolkit_version(): string;

    /**
     * Gets the current version for ATK.
     * @returns version string for ATK
     */
    function get_version(): string;

    /**
     * Get the {@link RelationType} type corresponding to a relation name.
     * @param name a string which is the (non-localized) name of an ATK relation type.
     * @returns the {@link RelationType} enumerated type corresponding to the specified name,
     *          or #ATK_RELATION_NULL if no matching relation type is found.
     */
    function relation_type_for_name(name: string): RelationType;

    /**
     * Gets the description string describing the {@link RelationType} #type.
     * @param _type The {@link RelationType} whose name is required
     * @returns the string describing the AtkRelationType
     */
    function relation_type_get_name(_type: RelationType): string;

    /**
     * Associate #name with a new {@link RelationType}
     * @param name a name string
     * @returns an {@link RelationType} associated with #name
     */
    function relation_type_register(name: string): RelationType;

    /**
     * Removes the specified focus tracker from the list of functions
     * to be called when any object receives focus.
     * @param tracker_id the id of the focus tracker to remove
     */
    function remove_focus_tracker(tracker_id: number): void;

    /**
     * #listener_id is the value returned by #atk_add_global_event_listener
     * when you registered that event listener.
     * 
     * Toolkit implementor note: ATK provides a default implementation for
     * this virtual method. ATK implementors are discouraged from
     * reimplementing this method.
     * 
     * Toolkit implementor note: this method is not intended to be used by
     * ATK implementors but by ATK consumers.
     * 
     * Removes the specified event listener
     * @param listener_id the id of the event listener to remove
     */
    function remove_global_event_listener(listener_id: number): void;

    /**
     * #listener_id is the value returned by #atk_add_key_event_listener
     * when you registered that event listener.
     * 
     * Removes the specified event listener.
     * @param listener_id the id of the event listener to remove
     */
    function remove_key_event_listener(listener_id: number): void;

    /**
     * Get the {@link Role} type corresponding to a rolew name.
     * @param name a string which is the (non-localized) name of an ATK role.
     * @returns the {@link Role} enumerated type corresponding to the specified name,
     *          or #ATK_ROLE_INVALID if no matching role is found.
     */
    function role_for_name(name: string): Role;

    /**
     * Gets the localized description string describing the {@link Role} #role.
     * @param role The {@link Role} whose localized name is required
     * @returns the localized string describing the AtkRole
     */
    function role_get_localized_name(role: Role): string;

    /**
     * Gets the description string describing the {@link Role} #role.
     * @param role The {@link Role} whose name is required
     * @returns the string describing the AtkRole
     */
    function role_get_name(role: Role): string;

    /**
     * Registers the role specified by #name. #name must be a meaningful
     * name. So it should not be empty, or consisting on whitespaces.
     * @param name a character string describing the new role.
     * @returns an {@link Role} for the new role if added
     * properly. ATK_ROLE_INVALID in case of error.
     */
    function role_register(name: string): Role;

    /**
     * Gets the {@link StateType} corresponding to the description string #name.
     * @param name a character string state name
     * @returns an {@link StateType} corresponding to #name
     */
    function state_type_for_name(name: string): StateType;

    /**
     * Gets the description string describing the {@link StateType} #type.
     * @param _type The {@link StateType} whose name is required
     * @returns the string describing the AtkStateType
     */
    function state_type_get_name(_type: StateType): string;

    /**
     * Register a new object state.
     * @param name a character string describing the new state.
     * @returns an {@link State} value for the new state.
     */
    function state_type_register(name: string): StateType;

    /**
     * Get the {@link TextAttribute} type corresponding to a text attribute name.
     * @param name a string which is the (non-localized) name of an ATK text attribute.
     * @returns the {@link TextAttribute} enumerated type corresponding to the specified
     *          name, or #ATK_TEXT_ATTRIBUTE_INVALID if no matching text attribute
     *          is found.
     */
    function text_attribute_for_name(name: string): TextAttribute;

    /**
     * Gets the name corresponding to the {@link TextAttribute}
     * @param attr The {@link TextAttribute} whose name is required
     * @returns a string containing the name; this string should not be freed
     */
    function text_attribute_get_name(attr: TextAttribute): string;

    /**
     * Gets the value for the index of the {@link TextAttribute}
     * @param attr The {@link TextAttribute} for which a value is required
     * @param index_ The index of the required value
     * @returns a string containing the value; this string
     * should not be freed; %NULL is returned if there are no values
     * maintained for the attr value.
     */
    function text_attribute_get_value(attr: TextAttribute, index_: number): string;

    /**
     * Associate #name with a new {@link TextAttribute}
     * @param name a name string
     * @returns an {@link TextAttribute} associated with #name
     */
    function text_attribute_register(name: string): TextAttribute;

    /**
     * Frees the memory associated with an array of AtkTextRange. It is assumed
     * that the array was returned by the function atk_text_get_bounded_ranges
     * and is NULL terminated.
     * @param ranges A pointer to an array of {@link TextRange} which is
     *   to be freed.
     */
    function text_free_ranges(ranges: TextRange[]): void;

    /**
     * Gets the localized description string describing the {@link ValueType} #value_type.
     * @param value_type The {@link ValueType} whose localized name is required
     * @returns the localized string describing the {@link ValueType}
     */
    function value_type_get_localized_name(value_type: ValueType): string;

    /**
     * Gets the description string describing the {@link ValueType} #value_type.
     * @param value_type The {@link ValueType} whose name is required
     * @returns the string describing the {@link ValueType}
     */
    function value_type_get_name(value_type: ValueType): string;

}