declare namespace imports.gi.St {
  // copied from ci-types, but with one fix in the signature of new method (see below).
  class ThemeNode {
    public constructor(options?: Partial<ThemeNodeInitOptions>)
    /**
     * Creates a new {@link ThemeNode}. Once created, a node is immutable. Of any
     * of the attributes of the node (like the #element_class) change the node
     * and its child nodes must be destroyed and recreated.
     * @param context the context representing global state for this themed tree
     * @param parent_node the parent node of this node
     * @param theme a theme (stylesheet set) that overrides the
     *   theme inherited from the parent node
     * @param element_type the type of the GObject represented by this node
     *  in the tree (corresponding to an element if we were theming an XML
     *  document. %G_TYPE_NONE means this style was created for the stage
     * actor and matches a selector element name of 'stage'.
     * @param element_id the ID to match CSS rules against
     * @param element_class a whitespace-separated list of classes
     *   to match CSS rules against
     * @param pseudo_class a whitespace-separated list of pseudo-classes
     *   (like 'hover' or 'visited') to match CSS rules against
     * @param inline_style
     * @param important
     * @returns the theme node
     */
    public static new(
      context: ThemeContext,
      parent_node: ThemeNode | null,
      theme: Theme | null,
      element_type: GObject.GType, // This was wrong in the original type definition (GObject.Type instead which is a number)!
      element_id: string | null,
      element_class: string | null,
      pseudo_class: string | null,
      inline_style: string, // I think, null should be allowed here, because of https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/4634
      important: boolean,
    ): ThemeNode

    // manual copied the methods below from IThemeNode

    /**
     * Adjusts a "for height" passed to {@link Clutter.Actor.get_preferred_width} to
     * account for borders and padding. This is a convenience function meant
     * to be called from a get_preferred_width() method of a #ClutterActor
     * subclass. The value after adjustment is the height available for the actor's
     * content.
     */
    adjust_for_height(): void
    /**
     * Adjusts a "for width" passed to {@link Clutter.Actor.get_preferred_height} to
     * account for borders and padding. This is a convenience function meant
     * to be called from a get_preferred_height() method of a #ClutterActor
     * subclass. The value after adjustment is the width available for the actor's
     * content.
     */
    adjust_for_width(): void
    /**
     * Adjusts the minimum and natural height computed for an actor by
     * adding on the necessary space for borders and padding and taking
     * into account any minimum or maximum height. This is a convenience
     * function meant to be called from the {@link Get.preferred_height} method
     * of a #ClutterActor subclass
     */
    adjust_preferred_height(): void
    /**
     * Adjusts the minimum and natural width computed for an actor by
     * adding on the necessary space for borders and padding and taking
     * into account any minimum or maximum width. This is a convenience
     * function meant to be called from the {@link Get.preferred_width} method
     * of a #ClutterActor subclass
     */
    adjust_preferred_width(): void
    /**
     * Copy cached painting state from #other to #node. This function can be used to
     * optimize redrawing cached background images when the style on an element changess
     * in a way that doesn't affect background drawing. This function must only be called
     * if st_theme_node_paint_equal (node, other) returns %TRUE.
     * @param other a different {@link ThemeNode}
     */
    copy_cached_paint_state(other: ThemeNode): void
    /**
     * Compare two {@link ThemeNodes}. Two nodes which compare equal will match
     * the same CSS rules and have the same style properties. However, two
     * nodes that have ended up with identical style properties do not
     * necessarily compare equal.
     * In detail, #node_a and #node_b are considered equal iff
     * <itemizedlist>
     *   <listitem>
     *     <para>they share the same #StTheme and #StThemeContext</para>
     *   </listitem>
     *   <listitem>
     *     <para>they have the same parent</para>
     *   </listitem>
     *   <listitem>
     *     <para>they have the same element type</para>
     *   </listitem>
     *   <listitem>
     *     <para>their id, class, pseudo-class and inline-style match</para>
     *   </listitem>
     * </itemizedlist>
     * @param node_b second {@link ThemeNode}
     * @returns %TRUE if #node_a equals #node_b
     */
    equal(node_b: ThemeNode): boolean
    /**
     * Tests if two theme nodes have the same borders and padding; this can be
     * used to optimize having to relayout when the style applied to a Clutter
     * actor changes colors without changing the geometry.
     * @param other a different {@link ThemeNode}
     * @returns
     */
    geometry_equal(other: ThemeNode): boolean
    /**
     * Returns #node's background bumpmap.
     * @returns
     */
    get_background_bumpmap(): string
    /**
     * Returns #node's background color.
     * @returns location to store the color
     */
    get_background_color(): Clutter.Color
    /**
     * The #start and #end arguments will only be set if #type is not #ST_GRADIENT_NONE.
     * @returns Type of gradient
     *
     * Color at start of gradient
     *
     * Color at end of gradient
     */
    get_background_gradient(): [type: GradientType, start: Clutter.Color, end: Clutter.Color]
    /**
     * Returns #node's background image.
     * @returns
     */
    get_background_image(): string
    /**
     * Gets the value for the -st-background-image-shadow style property
     * @returns the node's background image shadow, or %NULL
     *   if node has no such shadow
     */
    get_background_image_shadow(): Shadow
    /**
     * Gets the box used to paint the actor's background, including the area
     * occupied by properties which paint outside the actor's assigned allocation.
     * @param allocation the box allocated to a #ClutterActor
     * @returns computed box occupied when painting the actor's background
     */
    get_background_paint_box(allocation: Clutter.ActorBox): Clutter.ActorBox
    /**
     * Returns the color of #node's border on #side
     * @param side a {@link Side}
     * @returns location to store the color
     */
    get_border_color(side: Side): Clutter.Color
    /**
     * Gets the value for the border-image style property
     * @returns the border image, or %NULL
     *   if there is no border image.
     */
    get_border_image(): BorderImage
    get_border_radius(corner: Corner): number
    get_border_width(side: Side): number
    /**
     * Gets the value for the box-shadow style property
     * @returns the node's shadow, or %NULL
     *   if node has no shadow
     */
    get_box_shadow(): Shadow
    /**
     * Generically looks up a property containing a single color value. When
     * specific getters (like {@link St.ThemeNode.get_background_color}) exist, they
     * should be used instead. They are cached, so more efficient, and have
     * handling for shortcut properties and other details of CSS.
     *
     * If #property_name is not found, a warning will be logged and a
     * default color returned.
     *
     * See also st_theme_node_lookup_color(), which provides more options,
     * and lets you handle the case where the theme does not specify the
     * indicated color.
     * @param property_name The name of the color property
     * @returns location to store the color that
     *   was determined.
     */
    get_color(property_name: string): Clutter.Color
    /**
     * Gets the box within an actor's allocation that contents the content
     * of an actor (excluding borders and padding). This is a convenience function
     * meant to be used from the allocate() or paint() methods of a #ClutterActor
     * subclass.
     * @param allocation the box allocated to a #ClutterAlctor
     * @returns computed box occupied by the actor's content
     */
    get_content_box(allocation: Clutter.ActorBox): Clutter.ActorBox
    /**
     * Generically looks up a property containing a single numeric value
     *  without units.
     *
     * See also {@link St.ThemeNode.lookup_double}, which provides more options,
     * and lets you handle the case where the theme does not specify the
     * indicated value.
     * @param property_name The name of the numeric property
     * @returns the value found. If #property_name is not
     *  found, a warning will be logged and 0 will be returned.
     */
    get_double(property_name: string): number
    get_element_classes(): string[]
    get_element_id(): string
    get_element_type(): GObject.Type
    get_font(): Pango.FontDescription
    get_font_features(): string
    /**
     * Returns #node's foreground color.
     * @returns location to store the color
     */
    get_foreground_color(): Clutter.Color
    get_height(): number
    /**
     * Gets the total horizonal padding (left + right padding)
     * @returns the total horizonal padding
     *   in pixels
     */
    get_horizontal_padding(): number
    /**
     * Gets the colors that should be used for colorizing symbolic icons according
     * the style of this node.
     * @returns the icon colors to use for this theme node
     */
    get_icon_colors(): IconColors
    get_icon_style(): IconStyle
    /**
     * Generically looks up a property containing a single length value. When
     * specific getters (like {@link St.ThemeNode.get_border_width}) exist, they
     * should be used instead. They are cached, so more efficient, and have
     * handling for shortcut properties and other details of CSS.
     *
     * Unlike st_theme_node_get_color() and st_theme_node_get_double(),
     * this does not print a warning if the property is not found; it just
     * returns 0.
     *
     * See also st_theme_node_lookup_length(), which provides more options.
     * @param property_name The name of the length property
     * @returns the length, in pixels, or 0 if the property was not found.
     */
    get_length(property_name: string): number
    /**
     * Gets the value for the letter-spacing style property, in pixels.
     * @returns the value of the letter-spacing property, if
     *   found, or zero if such property has not been found.
     */
    get_letter_spacing(): number
    get_margin(side: Side): number
    get_max_height(): number
    get_max_width(): number
    get_min_height(): number
    get_min_width(): number
    /**
     * Returns the color of #node's outline.
     * @returns location to store the color
     */
    get_outline_color(): Clutter.Color
    get_outline_width(): number
    get_padding(side: Side): number
    /**
     * Gets the box used to paint the actor, including the area occupied
     * by properties which paint outside the actor's assigned allocation.
     * When painting #node to an offscreen buffer, this function can be
     * used to determine the necessary size of the buffer.
     * @param allocation the box allocated to a #ClutterActor
     * @returns computed box occupied when painting the actor
     */
    get_paint_box(allocation: Clutter.ActorBox): Clutter.ActorBox
    /**
     * Gets the parent themed element node.
     * @returns the parent {@link ThemeNode}, or %NULL if this
     *  is the root node of the tree of theme elements.
     */
    get_parent(): ThemeNode
    get_pseudo_classes(): string[]
    /**
     * Generically looks up a property containing a set of shadow values. When
     * specific getters (like {@link St.ThemeNode.get_box_shadow}) exist, they
     * should be used instead. They are cached, so more efficient, and have
     * handling for shortcut properties and other details of CSS.
     *
     * Like st_theme_get_length(), this does not print a warning if the property is
     * not found; it just returns %NULL
     *
     * See also st_theme_node_lookup_shadow (), which provides more options.
     * @param property_name The name of the shadow property
     * @returns the shadow, or %NULL if the property was not found.
     */
    get_shadow(property_name: string): Shadow
    get_text_align(): TextAlign
    get_text_decoration(): TextDecoration
    /**
     * Gets the value for the text-shadow style property
     * @returns the node's text-shadow, or %NULL
     *   if node has no text-shadow
     */
    get_text_shadow(): Shadow
    /**
     * Gets the theme stylesheet set that styles this node
     * @returns the theme stylesheet set
     */
    get_theme(): Theme
    /**
     * Get the value of the transition-duration property, which
     * specifies the transition time between the previous {@link ThemeNode}
     * and #node.
     * @returns the node's transition duration in milliseconds
     */
    get_transition_duration(): number
    /**
     * Gets the total vertical padding (top + bottom padding)
     * @returns the total vertical padding
     *   in pixels
     */
    get_vertical_padding(): number
    get_width(): number
    hash(): number
    /**
     * Generically looks up a property containing a single color value. When
     * specific getters (like {@link St.ThemeNode.get_background_color}) exist, they
     * should be used instead. They are cached, so more efficient, and have
     * handling for shortcut properties and other details of CSS.
     *
     * See also st_theme_node_get_color(), which provides a simpler API.
     * @param property_name The name of the color property
     * @param inherit if %TRUE, if a value is not found for the property on the
     *   node, then it will be looked up on the parent node, and then on the
     *   parent's parent, and so forth. Note that if the property has a
     *   value of 'inherit' it will be inherited even if %FALSE is passed
     *   in for #inherit; this only affects the default behavior for inheritance.
     * @returns %TRUE if the property was found in the properties for this
     *  theme node (or in the properties of parent nodes when inheriting.)
     *
     * location to store the color that was
     *   determined. If the property is not found, the value in this location
     *   will not be changed.
     */
    lookup_color(property_name: string, inherit: boolean): [boolean, Clutter.Color]
    /**
     * Generically looks up a property containing a single numeric value
     *  without units.
     *
     * See also {@link St.ThemeNode.get_double}, which provides a simpler API.
     * @param property_name The name of the numeric property
     * @param inherit if %TRUE, if a value is not found for the property on the
     *   node, then it will be looked up on the parent node, and then on the
     *   parent's parent, and so forth. Note that if the property has a
     *   value of 'inherit' it will be inherited even if %FALSE is passed
     *   in for #inherit; this only affects the default behavior for inheritance.
     * @returns %TRUE if the property was found in the properties for this
     *  theme node (or in the properties of parent nodes when inheriting.)
     *
     * location to store the value that was determined.
     *   If the property is not found, the value in this location
     *   will not be changed.
     */
    lookup_double(property_name: string, inherit: boolean): [boolean, number]
    /**
     * Generically looks up a property containing a single length value. When
     * specific getters (like {@link St.ThemeNode.get_border_width}) exist, they
     * should be used instead. They are cached, so more efficient, and have
     * handling for shortcut properties and other details of CSS.
     *
     * See also st_theme_node_get_length(), which provides a simpler API.
     * @param property_name The name of the length property
     * @param inherit if %TRUE, if a value is not found for the property on the
     *   node, then it will be looked up on the parent node, and then on the
     *   parent's parent, and so forth. Note that if the property has a
     *   value of 'inherit' it will be inherited even if %FALSE is passed
     *   in for #inherit; this only affects the default behavior for inheritance.
     * @returns %TRUE if the property was found in the properties for this
     *  theme node (or in the properties of parent nodes when inheriting.)
     *
     * location to store the length that was determined.
     *   If the property is not found, the value in this location
     *   will not be changed. The returned length is resolved
     *   to pixels.
     */
    lookup_length(property_name: string, inherit: boolean): [boolean, number]
    /**
     * If the property is not found, the value in the shadow variable will not
     * be changed.
     *
     * Generically looks up a property containing a set of shadow values. When
     * specific getters (like st_theme_node_get_box_shadow ()) exist, they
     * should be used instead. They are cached, so more efficient, and have
     * handling for shortcut properties and other details of CSS.
     *
     * See also {@link St.ThemeNode.get_shadow}, which provides a simpler API.
     * @param property_name The name of the shadow property
     * @param inherit if %TRUE, if a value is not found for the property on the
     *   node, then it will be looked up on the parent node, and then on the
     *   parent's parent, and so forth. Note that if the property has a
     *   value of 'inherit' it will be inherited even if %FALSE is passed
     *   in for #inherit; this only affects the default behavior for inheritance.
     * @returns %TRUE if the property was found in the properties for this
     * theme node (or in the properties of parent nodes when inheriting.), %FALSE
     * if the property was not found, or was explicitly set to 'none'.
     *
     * location to store the shadow
     */
    lookup_shadow(property_name: string, inherit: boolean): [boolean, Shadow]
    /**
     * Check if {@link St.ThemeNode.paint} will paint identically for #node as it does
     * for #other. Note that in some cases this function may return %TRUE even
     * if there is no visible difference in the painting.
     * @param other a different {@link ThemeNode}
     * @returns %TRUE if the two theme nodes paint identically. %FALSE if the
     *   two nodes potentially paint differently.
     */
    paint_equal(other: ThemeNode): boolean
  }
}
