declare namespace imports.gi.Graphene {
	/**
	 * A 3D box, described as the volume between a minimum and
	 * a maximum vertices.
	 */
	interface Box {}
	class Box {
		public constructor();
		/**
		 * Allocates a new #graphene_box_t.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_box_t structure.
		 *   Use graphene_box_free() to free the resources allocated by this function
		 */
		public static alloc(): Box;
		public readonly min: Vec3;
		public readonly max: Vec3;
		/**
		 * Checks whether the #graphene_box_t #a contains the given
		 * #graphene_box_t #b.
		 * @param _b a #graphene_box_t
		 * @returns `true` if the box is contained in the given box
		 */
		public contains_box(_b: Box): boolean;
		/**
		 * Checks whether #box contains the given #point.
		 * @param point the coordinates to check
		 * @returns `true` if the point is contained in the given box
		 */
		public contains_point(point: Point3D): boolean;
		/**
		 * Checks whether the two given boxes are equal.
		 * @param _b a #graphene_box_t
		 * @returns `true` if the boxes are equal
		 */
		public equal(_b: Box): boolean;
		/**
		 * Expands the dimensions of #box to include the coordinates at #point.
		 * @param point the coordinates of the point to include
		 * @param res return location for the expanded box
		 */
		public expand(point: Point3D, res: Box): void;
		/**
		 * Expands the dimensions of #box by the given #scalar value.
		 * 
		 * If #scalar is positive, the #graphene_box_t will grow; if #scalar is
		 * negative, the #graphene_box_t will shrink.
		 * @param scalar a scalar value
		 * @param res return location for the expanded box
		 */
		public expand_scalar(scalar: number, res: Box): void;
		/**
		 * Expands the dimensions of #box to include the coordinates of the
		 * given vector.
		 * @param vec the coordinates of the point to include, as a #graphene_vec3_t
		 * @param res return location for the expanded box
		 */
		public expand_vec3(vec: Vec3, res: Box): void;
		/**
		 * Frees the resources allocated by graphene_box_alloc().
		 */
		public free(): void;
		/**
		 * Computes the bounding #graphene_sphere_t capable of containing the given
		 * #graphene_box_t.
		 * @param sphere return location for the bounding sphere
		 */
		public get_bounding_sphere(sphere: Sphere): void;
		/**
		 * Retrieves the coordinates of the center of a #graphene_box_t.
		 * @param center return location for the coordinates of
		 *   the center
		 */
		public get_center(center: Point3D): void;
		/**
		 * Retrieves the size of the #box on the Z axis.
		 * @returns the depth of the box
		 */
		public get_depth(): number;
		/**
		 * Retrieves the size of the #box on the Y axis.
		 * @returns the height of the box
		 */
		public get_height(): number;
		/**
		 * Retrieves the coordinates of the maximum point of the given
		 * #graphene_box_t.
		 * @param max return location for the maximum point
		 */
		public get_max(max: Point3D): void;
		/**
		 * Retrieves the coordinates of the minimum point of the given
		 * #graphene_box_t.
		 * @param min return location for the minimum point
		 */
		public get_min(min: Point3D): void;
		/**
		 * Retrieves the size of the box on all three axes, and stores
		 * it into the given #size vector.
		 * @param size return location for the size
		 */
		public get_size(size: Vec3): void;
		/**
		 * Computes the vertices of the given #graphene_box_t.
		 * @param vertices return location for an array
		 *   of 8 #graphene_vec3_t
		 */
		public get_vertices(vertices: Vec3[]): void;
		/**
		 * Retrieves the size of the #box on the X axis.
		 * @returns the width of the box
		 */
		public get_width(): number;
		/**
		 * Initializes the given #graphene_box_t with two vertices.
		 * @param min the coordinates of the minimum vertex
		 * @param max the coordinates of the maximum vertex
		 * @returns the initialized #graphene_box_t
		 */
		public init(min: Point3D | null, max: Point3D | null): Box;
		/**
		 * Initializes the given #graphene_box_t with the vertices of
		 * another #graphene_box_t.
		 * @param src a #graphene_box_t
		 * @returns the initialized #graphene_box_t
		 */
		public init_from_box(src: Box): Box;
		/**
		 * Initializes the given #graphene_box_t with the given array
		 * of vertices.
		 * 
		 * If #n_points is 0, the returned box is initialized with
		 * graphene_box_empty().
		 * @param n_points the number #graphene_point3d_t in the #points array
		 * @param points an array of #graphene_point3d_t
		 * @returns the initialized #graphene_box_t
		 */
		public init_from_points(n_points: number, points: Point3D[]): Box;
		/**
		 * Initializes the given #graphene_box_t with two vertices
		 * stored inside #graphene_vec3_t.
		 * @param min the coordinates of the minimum vertex
		 * @param max the coordinates of the maximum vertex
		 * @returns the initialized #graphene_box_t
		 */
		public init_from_vec3(min: Vec3 | null, max: Vec3 | null): Box;
		/**
		 * Initializes the given #graphene_box_t with the given array
		 * of vertices.
		 * 
		 * If #n_vectors is 0, the returned box is initialized with
		 * graphene_box_empty().
		 * @param n_vectors the number #graphene_point3d_t in the #vectors array
		 * @param vectors an array of #graphene_vec3_t
		 * @returns the initialized #graphene_box_t
		 */
		public init_from_vectors(n_vectors: number, vectors: Vec3[]): Box;
		/**
		 * Intersects the two given #graphene_box_t.
		 * 
		 * If the two boxes do not intersect, #res will contain a degenerate box
		 * initialized with graphene_box_empty().
		 * @param _b a #graphene_box_t
		 * @param res return location for the result
		 * @returns true if the two boxes intersect
		 */
		public intersection(_b: Box, res: Box | null): boolean;
		/**
		 * Unions the two given #graphene_box_t.
		 * @param _b the box to union to #a
		 * @param res return location for the result
		 */
		public union(_b: Box, res: Box): void;
	}

	/**
	 * Describe a rotation using Euler angles.
	 * 
	 * The contents of the #graphene_euler_t structure are private
	 * and should never be accessed directly.
	 */
	interface Euler {}
	class Euler {
		public constructor();
		/**
		 * Allocates a new #graphene_euler_t.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_euler_t
		 */
		public static alloc(): Euler;
		public readonly angles: Vec3;
		public readonly order: EulerOrder;
		/**
		 * Checks if two #graphene_euler_t are equal.
		 * @param _b a #graphene_euler_t
		 * @returns `true` if the two #graphene_euler_t are equal
		 */
		public equal(_b: Euler): boolean;
		/**
		 * Frees the resources allocated by graphene_euler_alloc().
		 */
		public free(): void;
		/**
		 * Retrieves the first component of the Euler angle vector,
		 * depending on the order of rotation.
		 * 
		 * See also: graphene_euler_get_x()
		 * @returns the first component of the Euler angle vector, in radians
		 */
		public get_alpha(): number;
		/**
		 * Retrieves the second component of the Euler angle vector,
		 * depending on the order of rotation.
		 * 
		 * See also: graphene_euler_get_y()
		 * @returns the second component of the Euler angle vector, in radians
		 */
		public get_beta(): number;
		/**
		 * Retrieves the third component of the Euler angle vector,
		 * depending on the order of rotation.
		 * 
		 * See also: graphene_euler_get_z()
		 * @returns the third component of the Euler angle vector, in radians
		 */
		public get_gamma(): number;
		/**
		 * Retrieves the order used to apply the rotations described in the
		 * #graphene_euler_t structure, when converting to and from other
		 * structures, like #graphene_quaternion_t and #graphene_matrix_t.
		 * 
		 * This function does not return the %GRAPHENE_EULER_ORDER_DEFAULT
		 * enumeration value; it will return the effective order of rotation
		 * instead.
		 * @returns the order used to apply the rotations
		 */
		public get_order(): EulerOrder;
		/**
		 * Retrieves the rotation angle on the X axis, in degrees.
		 * @returns the rotation angle
		 */
		public get_x(): number;
		/**
		 * Retrieves the rotation angle on the Y axis, in degrees.
		 * @returns the rotation angle
		 */
		public get_y(): number;
		/**
		 * Retrieves the rotation angle on the Z axis, in degrees.
		 * @returns the rotation angle
		 */
		public get_z(): number;
		/**
		 * Initializes a #graphene_euler_t using the given angles.
		 * 
		 * The order of the rotations is %GRAPHENE_EULER_ORDER_DEFAULT.
		 * @param _x rotation angle on the X axis, in degrees
		 * @param _y rotation angle on the Y axis, in degrees
		 * @param _z rotation angle on the Z axis, in degrees
		 * @returns the initialized #graphene_euler_t
		 */
		public init(_x: number, _y: number, _z: number): Euler;
		/**
		 * Initializes a #graphene_euler_t using the angles and order of
		 * another #graphene_euler_t.
		 * 
		 * If the #graphene_euler_t #src is %NULL, this function is equivalent
		 * to calling graphene_euler_init() with all angles set to 0.
		 * @param src a #graphene_euler_t
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_euler(src: Euler | null): Euler;
		/**
		 * Initializes a #graphene_euler_t using the given rotation matrix.
		 * 
		 * If the #graphene_matrix_t #m is %NULL, the #graphene_euler_t will
		 * be initialized with all angles set to 0.
		 * @param _m a rotation matrix
		 * @param order the order used to apply the rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_matrix(_m: Matrix | null, order: EulerOrder): Euler;
		/**
		 * Initializes a #graphene_euler_t using the given normalized quaternion.
		 * 
		 * If the #graphene_quaternion_t #q is %NULL, the #graphene_euler_t will
		 * be initialized with all angles set to 0.
		 * @param q a normalized #graphene_quaternion_t
		 * @param order the order used to apply the rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_quaternion(q: Quaternion | null, order: EulerOrder): Euler;
		/**
		 * Initializes a #graphene_euler_t using the given angles
		 * and order of rotation.
		 * @param _x rotation angle on the X axis, in radians
		 * @param _y rotation angle on the Y axis, in radians
		 * @param _z rotation angle on the Z axis, in radians
		 * @param order order of rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_radians(_x: number, _y: number, _z: number, order: EulerOrder): Euler;
		/**
		 * Initializes a #graphene_euler_t using the angles contained in a
		 * #graphene_vec3_t.
		 * 
		 * If the #graphene_vec3_t #v is %NULL, the #graphene_euler_t will be
		 * initialized with all angles set to 0.
		 * @param _v a #graphene_vec3_t containing the rotation
		 *   angles in degrees
		 * @param order the order used to apply the rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_from_vec3(_v: Vec3 | null, order: EulerOrder): Euler;
		/**
		 * Initializes a #graphene_euler_t with the given angles and #order.
		 * @param _x rotation angle on the X axis, in degrees
		 * @param _y rotation angle on the Y axis, in degrees
		 * @param _z rotation angle on the Z axis, in degrees
		 * @param order the order used to apply the rotations
		 * @returns the initialized #graphene_euler_t
		 */
		public init_with_order(_x: number, _y: number, _z: number, order: EulerOrder): Euler;
		/**
		 * Reorders a #graphene_euler_t using #order.
		 * 
		 * This function is equivalent to creating a #graphene_quaternion_t from the
		 * given #graphene_euler_t, and then converting the quaternion into another
		 * #graphene_euler_t.
		 * @param order the new order
		 * @param res return location for the reordered
		 *   #graphene_euler_t
		 */
		public reorder(order: EulerOrder, res: Euler): void;
		/**
		 * Converts a #graphene_euler_t into a transformation matrix expressing
		 * the extrinsic composition of rotations described by the Euler angles.
		 * 
		 * The rotations are applied over the reference frame axes in the order
		 * associated with the #graphene_euler_t; for instance, if the order
		 * used to initialize #e is %GRAPHENE_EULER_ORDER_XYZ:
		 * 
		 *  * the first rotation moves the body around the X axis with
		 *    an angle φ
		 *  * the second rotation moves the body around the Y axis with
		 *    an angle of ϑ
		 *  * the third rotation moves the body around the Z axis with
		 *    an angle of ψ
		 * 
		 * The rotation sign convention is right-handed, to preserve compatibility
		 * between Euler-based, quaternion-based, and angle-axis-based rotations.
		 * @param res return location for a #graphene_matrix_t
		 */
		public to_matrix(res: Matrix): void;
		/**
		 * Converts a #graphene_euler_t into a #graphene_quaternion_t.
		 * @param res return location for a #graphene_quaternion_t
		 */
		public to_quaternion(res: Quaternion): void;
		/**
		 * Retrieves the angles of a #graphene_euler_t and initializes a
		 * #graphene_vec3_t with them.
		 * @param res return location for a #graphene_vec3_t
		 */
		public to_vec3(res: Vec3): void;
	}

	/**
	 * A 3D volume delimited by 2D clip planes.
	 * 
	 * The contents of the `graphene_frustum_t` are private, and should not be
	 * modified directly.
	 */
	interface Frustum {}
	class Frustum {
		public constructor();
		/**
		 * Allocates a new #graphene_frustum_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_frustum_t
		 *   structure. Use graphene_frustum_free() to free the resources
		 *   allocated by this function.
		 */
		public static alloc(): Frustum;
		public readonly planes: Plane[];
		/**
		 * Checks whether a point is inside the volume defined by the given
		 * #graphene_frustum_t.
		 * @param point a #graphene_point3d_t
		 * @returns `true` if the point is inside the frustum
		 */
		public contains_point(point: Point3D): boolean;
		/**
		 * Checks whether the two given #graphene_frustum_t are equal.
		 * @param _b a #graphene_frustum_t
		 * @returns `true` if the given frustums are equal
		 */
		public equal(_b: Frustum): boolean;
		/**
		 * Frees the resources allocated by graphene_frustum_alloc().
		 */
		public free(): void;
		/**
		 * Retrieves the planes that define the given #graphene_frustum_t.
		 * @param planes return location for an array
		 *   of 6 #graphene_plane_t
		 */
		public get_planes(planes: Plane[]): void;
		/**
		 * Initializes the given #graphene_frustum_t using the provided
		 * clipping planes.
		 * @param p0 a clipping plane
		 * @param p1 a clipping plane
		 * @param p2 a clipping plane
		 * @param p3 a clipping plane
		 * @param p4 a clipping plane
		 * @param p5 a clipping plane
		 * @returns the initialized frustum
		 */
		public init(p0: Plane, p1: Plane, p2: Plane, p3: Plane, p4: Plane, p5: Plane): Frustum;
		/**
		 * Initializes the given #graphene_frustum_t using the clipping
		 * planes of another #graphene_frustum_t.
		 * @param src a #graphene_frustum_t
		 * @returns the initialized frustum
		 */
		public init_from_frustum(src: Frustum): Frustum;
		/**
		 * Initializes a #graphene_frustum_t using the given #matrix.
		 * @param matrix a #graphene_matrix_t
		 * @returns the initialized frustum
		 */
		public init_from_matrix(matrix: Matrix): Frustum;
		/**
		 * Checks whether the given #box intersects a plane of
		 * a #graphene_frustum_t.
		 * @param box a #graphene_box_t
		 * @returns `true` if the box intersects the frustum
		 */
		public intersects_box(box: Box): boolean;
		/**
		 * Checks whether the given #sphere intersects a plane of
		 * a #graphene_frustum_t.
		 * @param sphere a #graphene_sphere_t
		 * @returns `true` if the sphere intersects the frustum
		 */
		public intersects_sphere(sphere: Sphere): boolean;
	}

	/**
	 * A structure capable of holding a 4x4 matrix.
	 * 
	 * The contents of the #graphene_matrix_t structure are private and
	 * should never be accessed directly.
	 */
	interface Matrix {}
	class Matrix {
		public constructor();
		/**
		 * Allocates a new #graphene_matrix_t.
		 * @returns the newly allocated matrix
		 */
		public static alloc(): Matrix;
		public readonly value: Simd4X4F;
		/**
		 * Decomposes a transformation matrix into its component transformations.
		 * 
		 * The algorithm for decomposing a matrix is taken from the
		 * [CSS3 Transforms specification](http://dev.w3.org/csswg/css-transforms/);
		 * specifically, the decomposition code is based on the equivalent code
		 * published in "Graphics Gems II", edited by Jim Arvo, and
		 * [available online](http://tog.acm.org/resources/GraphicsGems/gemsii/unmatrix.c).
		 * @param translate the translation vector
		 * @param scale the scale vector
		 * @param rotate the rotation quaternion
		 * @param shear the shear vector
		 * @param perspective the perspective vector
		 * @returns `true` if the matrix could be decomposed
		 */
		public decompose(translate: Vec3, scale: Vec3, rotate: Quaternion, shear: Vec3, perspective: Vec4): boolean;
		/**
		 * Computes the determinant of the given matrix.
		 * @returns the value of the determinant
		 */
		public determinant(): number;
		/**
		 * Checks whether the two given #graphene_matrix_t matrices are equal.
		 * @param _b a #graphene_matrix_t
		 * @returns `true` if the two matrices are equal, and `false` otherwise
		 */
		public equal(_b: Matrix): boolean;
		/**
		 * Checks whether the two given #graphene_matrix_t matrices are
		 * byte-by-byte equal.
		 * 
		 * While this function is faster than graphene_matrix_equal(), it
		 * can also return false negatives, so it should be used in
		 * conjuction with either graphene_matrix_equal() or
		 * graphene_matrix_near(). For instance:
		 * 
		 * |[<!-- language="C" -->
		 *   if (graphene_matrix_equal_fast (a, b))
		 *     {
		 *       // matrices are definitely the same
		 *     }
		 *   else
		 *     {
		 *       if (graphene_matrix_equal (a, b))
		 *         // matrices contain the same values within an epsilon of FLT_EPSILON
		 *       else if (graphene_matrix_near (a, b, 0.0001))
		 *         // matrices contain the same values within an epsilon of 0.0001
		 *       else
		 *         // matrices are not equal
		 *     }
		 * ]|
		 * @param _b a #graphene_matrix_t
		 * @returns `true` if the matrices are equal. and `false` otherwise
		 */
		public equal_fast(_b: Matrix): boolean;
		/**
		 * Frees the resources allocated by graphene_matrix_alloc().
		 */
		public free(): void;
		/**
		 * Retrieves the given row vector at #index_ inside a matrix.
		 * @param index_ the index of the row vector, between 0 and 3
		 * @param res return location for the #graphene_vec4_t
		 *   that is used to store the row vector
		 */
		public get_row(index_: number, res: Vec4): void;
		/**
		 * Retrieves the value at the given #row and #col index.
		 * @param _row the row index
		 * @param col the column index
		 * @returns the value at the given indices
		 */
		public get_value(_row: number, col: number): number;
		/**
		 * Retrieves the scaling factor on the X axis in #m.
		 * @returns the value of the scaling factor
		 */
		public get_x_scale(): number;
		/**
		 * Retrieves the translation component on the X axis from #m.
		 * @returns the translation component
		 */
		public get_x_translation(): number;
		/**
		 * Retrieves the scaling factor on the Y axis in #m.
		 * @returns the value of the scaling factor
		 */
		public get_y_scale(): number;
		/**
		 * Retrieves the translation component on the Y axis from #m.
		 * @returns the translation component
		 */
		public get_y_translation(): number;
		/**
		 * Retrieves the scaling factor on the Z axis in #m.
		 * @returns the value of the scaling factor
		 */
		public get_z_scale(): number;
		/**
		 * Retrieves the translation component on the Z axis from #m.
		 * @returns the translation component
		 */
		public get_z_translation(): number;
		/**
		 * Initializes a #graphene_matrix_t from the values of an affine
		 * transformation matrix.
		 * 
		 * The arguments map to the following matrix layout:
		 * 
		 * |[<!-- language="plain" -->
		 *   ⎛ xx  yx ⎞   ⎛  a   b  0 ⎞
		 *   ⎜ xy  yy ⎟ = ⎜  c   d  0 ⎟
		 *   ⎝ x0  y0 ⎠   ⎝ tx  ty  1 ⎠
		 * ]|
		 * 
		 * This function can be used to convert between an affine matrix type
		 * from other libraries and a #graphene_matrix_t.
		 * @param xx the xx member
		 * @param yx the yx member
		 * @param xy the xy member
		 * @param yy the yy member
		 * @param x_0 the x0 member
		 * @param y_0 the y0 member
		 * @returns the initialized matrix
		 */
		public init_from_2d(xx: number, yx: number, xy: number, yy: number, x_0: number, y_0: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with the given array of floating
		 * point values.
		 * @param _v an array of at least 16 floating
		 *   point values
		 * @returns the initialized matrix
		 */
		public init_from_float(_v: number[]): Matrix;
		/**
		 * Initializes a #graphene_matrix_t using the values of the
		 * given matrix.
		 * @param src a #graphene_matrix_t
		 * @returns the initialized matrix
		 */
		public init_from_matrix(src: Matrix): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with the given four row
		 * vectors.
		 * @param v0 the first row vector
		 * @param v1 the second row vector
		 * @param v2 the third row vector
		 * @param v3 the fourth row vector
		 * @returns the initialized matrix
		 */
		public init_from_vec4(v0: Vec4, v1: Vec4, v2: Vec4, v3: Vec4): Matrix;
		/**
		 * Initializes a #graphene_matrix_t compatible with #graphene_frustum_t.
		 * 
		 * See also: graphene_frustum_init_from_matrix()
		 * @param left distance of the left clipping plane
		 * @param right distance of the right clipping plane
		 * @param bottom distance of the bottom clipping plane
		 * @param top distance of the top clipping plane
		 * @param z_near distance of the near clipping plane
		 * @param z_far distance of the far clipping plane
		 * @returns the initialized matrix
		 */
		public init_frustum(left: number, right: number, bottom: number, top: number, z_near: number, z_far: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with the identity matrix.
		 * @returns the initialized matrix
		 */
		public init_identity(): Matrix;
		/**
		 * Initializes a #graphene_matrix_t so that it positions the "camera"
		 * at the given #eye coordinates towards an object at the #center
		 * coordinates. The top of the camera is aligned to the direction
		 * of the #up vector.
		 * 
		 * Before the transform, the camera is assumed to be placed at the
		 * origin, looking towards the negative Z axis, with the top side of
		 * the camera facing in the direction of the Y axis and the right
		 * side in the direction of the X axis.
		 * 
		 * In theory, one could use #m to transform a model of such a camera
		 * into world-space. However, it is more common to use the inverse of
		 * #m to transform another object from world coordinates to the view
		 * coordinates of the camera. Typically you would then apply the
		 * camera projection transform to get from view to screen
		 * coordinates.
		 * @param eye the vector describing the position to look from
		 * @param center the vector describing the position to look at
		 * @param _up the vector describing the world's upward direction; usually,
		 *   this is the graphene_vec3_y_axis() vector
		 * @returns the initialized matrix
		 */
		public init_look_at(eye: Vec3, center: Vec3, _up: Vec3): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with an orthographic projection.
		 * @param left the left edge of the clipping plane
		 * @param right the right edge of the clipping plane
		 * @param top the top edge of the clipping plane
		 * @param bottom the bottom edge of the clipping plane
		 * @param z_near the distance of the near clipping plane
		 * @param z_far the distance of the far clipping plane
		 * @returns the initialized matrix
		 */
		public init_ortho(left: number, right: number, top: number, bottom: number, z_near: number, z_far: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with a perspective projection.
		 * @param fovy the field of view angle, in degrees
		 * @param aspect the aspect value
		 * @param z_near the near Z plane
		 * @param z_far the far Z plane
		 * @returns the initialized matrix
		 */
		public init_perspective(fovy: number, aspect: number, z_near: number, z_far: number): Matrix;
		/**
		 * Initializes #m to represent a rotation of #angle degrees on
		 * the axis represented by the #axis vector.
		 * @param angle the rotation angle, in degrees
		 * @param axis the axis vector as a #graphene_vec3_t
		 * @returns the initialized matrix
		 */
		public init_rotate(angle: number, axis: Vec3): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with the given scaling factors.
		 * @param _x the scale factor on the X axis
		 * @param _y the scale factor on the Y axis
		 * @param _z the scale factor on the Z axis
		 * @returns the initialized matrix
		 */
		public init_scale(_x: number, _y: number, _z: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with a skew transformation
		 * with the given factors.
		 * @param x_skew skew factor, in radians, on the X axis
		 * @param y_skew skew factor, in radians, on the Y axis
		 * @returns the initialized matrix
		 */
		public init_skew(x_skew: number, y_skew: number): Matrix;
		/**
		 * Initializes a #graphene_matrix_t with a translation to the
		 * given coordinates.
		 * @param _p the translation coordinates
		 * @returns the initialized matrix
		 */
		public init_translate(_p: Point3D): Matrix;
		/**
		 * Linearly interpolates the two given #graphene_matrix_t by
		 * interpolating the decomposed transformations separately.
		 * 
		 * If either matrix cannot be reduced to their transformations
		 * then the interpolation cannot be performed, and this function
		 * will return an identity matrix.
		 * @param _b a #graphene_matrix_t
		 * @param factor the linear interpolation factor
		 * @param res return location for the
		 *   interpolated matrix
		 */
		public interpolate(_b: Matrix, factor: number, res: Matrix): void;
		/**
		 * Inverts the given matrix.
		 * @param res return location for the
		 *   inverse matrix
		 * @returns `true` if the matrix is invertible
		 */
		public inverse(res: Matrix): boolean;
		/**
		 * Checks whether the given #graphene_matrix_t is compatible with an
		 * a 2D affine transformation matrix.
		 * @returns `true` if the matrix is compatible with an affine
		 *   transformation matrix
		 */
		public is_2d(): boolean;
		/**
		 * Checks whether a #graphene_matrix_t has a visible back face.
		 * @returns `true` if the back face of the matrix is visible
		 */
		public is_backface_visible(): boolean;
		/**
		 * Checks whether the given #graphene_matrix_t is the identity matrix.
		 * @returns `true` if the matrix is the identity matrix
		 */
		public is_identity(): boolean;
		/**
		 * Checks whether a matrix is singular.
		 * @returns `true` if the matrix is singular
		 */
		public is_singular(): boolean;
		/**
		 * Multiplies two #graphene_matrix_t.
		 * 
		 * Matrix multiplication is not commutative in general; the order of the factors matters.
		 * The product of this multiplication is (#a × #b)
		 * @param _b a #graphene_matrix_t
		 * @param res return location for the matrix
		 *   result
		 */
		public multiply(_b: Matrix, res: Matrix): void;
		/**
		 * Compares the two given #graphene_matrix_t matrices and checks
		 * whether their values are within the given #epsilon of each
		 * other.
		 * @param _b a #graphene_matrix_t
		 * @param epsilon the threshold between the two matrices
		 * @returns `true` if the two matrices are near each other, and
		 *   `false` otherwise
		 */
		public near(_b: Matrix, epsilon: number): boolean;
		/**
		 * Normalizes the given #graphene_matrix_t.
		 * @param res return location for the normalized matrix
		 */
		public normalize(res: Matrix): void;
		/**
		 * Applies a perspective of #depth to the matrix.
		 * @param depth the depth of the perspective
		 * @param res return location for the
		 *   perspective matrix
		 */
		public perspective(depth: number, res: Matrix): void;
		/**
		 * Prints the contents of a matrix to the standard error stream.
		 * 
		 * This function is only useful for debugging; there are no guarantees
		 * made on the format of the output.
		 */
		public print(): void;
		/**
		 * Projects a #graphene_point_t using the matrix #m.
		 * @param _p a #graphene_point_t
		 * @param res return location for the projected
		 *   point
		 */
		public project_point(_p: Point, res: Point): void;
		/**
		 * Projects all corners of a #graphene_rect_t using the given matrix.
		 * 
		 * See also: graphene_matrix_project_point()
		 * @param _r a #graphene_rect_t
		 * @param res return location for the projected
		 *   rectangle
		 */
		public project_rect(_r: Rect, res: Quad): void;
		/**
		 * Projects a #graphene_rect_t using the given matrix.
		 * 
		 * The resulting rectangle is the axis aligned bounding rectangle capable
		 * of fully containing the projected rectangle.
		 * @param _r a #graphene_rect_t
		 * @param res return location for the projected
		 *   rectangle
		 */
		public project_rect_bounds(_r: Rect, res: Rect): void;
		/**
		 * Adds a rotation transformation to #m, using the given #angle
		 * and #axis vector.
		 * 
		 * This is the equivalent of calling graphene_matrix_init_rotate() and
		 * then multiplying the matrix #m with the rotation matrix.
		 * @param angle the rotation angle, in degrees
		 * @param axis the rotation axis, as a #graphene_vec3_t
		 */
		public rotate(angle: number, axis: Vec3): void;
		/**
		 * Adds a rotation transformation to #m, using the given
		 * #graphene_euler_t.
		 * @param _e a rotation described by a #graphene_euler_t
		 */
		public rotate_euler(_e: Euler): void;
		/**
		 * Adds a rotation transformation to #m, using the given
		 * #graphene_quaternion_t.
		 * 
		 * This is the equivalent of calling graphene_quaternion_to_matrix() and
		 * then multiplying #m with the rotation matrix.
		 * @param q a rotation described by a #graphene_quaternion_t
		 */
		public rotate_quaternion(q: Quaternion): void;
		/**
		 * Adds a rotation transformation around the X axis to #m, using
		 * the given #angle.
		 * 
		 * See also: graphene_matrix_rotate()
		 * @param angle the rotation angle, in degrees
		 */
		public rotate_x(angle: number): void;
		/**
		 * Adds a rotation transformation around the Y axis to #m, using
		 * the given #angle.
		 * 
		 * See also: graphene_matrix_rotate()
		 * @param angle the rotation angle, in degrees
		 */
		public rotate_y(angle: number): void;
		/**
		 * Adds a rotation transformation around the Z axis to #m, using
		 * the given #angle.
		 * 
		 * See also: graphene_matrix_rotate()
		 * @param angle the rotation angle, in degrees
		 */
		public rotate_z(angle: number): void;
		/**
		 * Adds a scaling transformation to #m, using the three
		 * given factors.
		 * 
		 * This is the equivalent of calling graphene_matrix_init_scale() and then
		 * multiplying the matrix #m with the scale matrix.
		 * @param factor_x scaling factor on the X axis
		 * @param factor_y scaling factor on the Y axis
		 * @param factor_z scaling factor on the Z axis
		 */
		public scale(factor_x: number, factor_y: number, factor_z: number): void;
		/**
		 * Adds a skew of #factor on the X and Y axis to the given matrix.
		 * @param factor skew factor
		 */
		public skew_xy(factor: number): void;
		/**
		 * Adds a skew of #factor on the X and Z axis to the given matrix.
		 * @param factor skew factor
		 */
		public skew_xz(factor: number): void;
		/**
		 * Adds a skew of #factor on the Y and Z axis to the given matrix.
		 * @param factor skew factor
		 */
		public skew_yz(factor: number): void;
		/**
		 * Converts a #graphene_matrix_t to an affine transformation
		 * matrix, if the given matrix is compatible.
		 * 
		 * The returned values have the following layout:
		 * 
		 * |[<!-- language="plain" -->
		 *   ⎛ xx  yx ⎞   ⎛  a   b  0 ⎞
		 *   ⎜ xy  yy ⎟ = ⎜  c   d  0 ⎟
		 *   ⎝ x0  y0 ⎠   ⎝ tx  ty  1 ⎠
		 * ]|
		 * 
		 * This function can be used to convert between a #graphene_matrix_t
		 * and an affine matrix type from other libraries.
		 * @returns `true` if the matrix is compatible with an affine
		 *   transformation matrix
		 */
		public to_2d(): boolean;
		/**
		 * Converts a #graphene_matrix_t to an array of floating point
		 * values.
		 * @param _v return location
		 *   for an array of floating point values. The array must be capable
		 *   of holding at least 16 values.
		 */
		public to_float(_v: number[]): void;
		/**
		 * Transforms each corner of a #graphene_rect_t using the given matrix #m.
		 * 
		 * The result is the axis aligned bounding rectangle containing the coplanar
		 * quadrilateral.
		 * 
		 * See also: graphene_matrix_transform_point()
		 * @param _r a #graphene_rect_t
		 * @param res return location for the bounds
		 *   of the transformed rectangle
		 */
		public transform_bounds(_r: Rect, res: Rect): void;
		/**
		 * Transforms the vertices of a #graphene_box_t using the given matrix #m.
		 * 
		 * The result is the axis aligned bounding box containing the transformed
		 * vertices.
		 * @param _b a #graphene_box_t
		 * @param res return location for the bounds
		 *   of the transformed box
		 */
		public transform_box(_b: Box, res: Box): void;
		/**
		 * Transforms the given #graphene_point_t using the matrix #m.
		 * 
		 * Unlike graphene_matrix_transform_vec3(), this function will take into
		 * account the fourth row vector of the #graphene_matrix_t when computing
		 * the dot product of each row vector of the matrix.
		 * 
		 * See also: graphene_simd4x4f_point3_mul()
		 * @param _p a #graphene_point_t
		 * @param res return location for the
		 *   transformed #graphene_point_t
		 */
		public transform_point(_p: Point, res: Point): void;
		/**
		 * Transforms the given #graphene_point3d_t using the matrix #m.
		 * 
		 * Unlike graphene_matrix_transform_vec3(), this function will take into
		 * account the fourth row vector of the #graphene_matrix_t when computing
		 * the dot product of each row vector of the matrix.
		 * 
		 * See also: graphene_simd4x4f_point3_mul()
		 * @param _p a #graphene_point3d_t
		 * @param res return location for the result
		 */
		public transform_point3d(_p: Point3D, res: Point3D): void;
		/**
		 * Transform a #graphene_ray_t using the given matrix #m.
		 * @param _r a #graphene_ray_t
		 * @param res return location for the
		 *   transformed ray
		 */
		public transform_ray(_r: Ray, res: Ray): void;
		/**
		 * Transforms each corner of a #graphene_rect_t using the given matrix #m.
		 * 
		 * The result is a coplanar quadrilateral.
		 * 
		 * See also: graphene_matrix_transform_point()
		 * @param _r a #graphene_rect_t
		 * @param res return location for the
		 *   transformed quad
		 */
		public transform_rect(_r: Rect, res: Quad): void;
		/**
		 * Transforms a #graphene_sphere_t using the given matrix #m. The
		 * result is the bounding sphere containing the transformed sphere.
		 * @param _s a #graphene_sphere_t
		 * @param res return location for the bounds
		 *   of the transformed sphere
		 */
		public transform_sphere(_s: Sphere, res: Sphere): void;
		/**
		 * Transforms the given #graphene_vec3_t using the matrix #m.
		 * 
		 * This function will multiply the X, Y, and Z row vectors of the matrix #m
		 * with the corresponding components of the vector #v. The W row vector will
		 * be ignored.
		 * 
		 * See also: graphene_simd4x4f_vec3_mul()
		 * @param _v a #graphene_vec3_t
		 * @param res return location for a #graphene_vec3_t
		 */
		public transform_vec3(_v: Vec3, res: Vec3): void;
		/**
		 * Transforms the given #graphene_vec4_t using the matrix #m.
		 * 
		 * See also: graphene_simd4x4f_vec4_mul()
		 * @param _v a #graphene_vec4_t
		 * @param res return location for a #graphene_vec4_t
		 */
		public transform_vec4(_v: Vec4, res: Vec4): void;
		/**
		 * Adds a translation transformation to #m using the coordinates
		 * of the given #graphene_point3d_t.
		 * 
		 * This is the equivalent of calling graphene_matrix_init_translate() and
		 * then multiplying #m with the translation matrix.
		 * @param pos a #graphene_point3d_t
		 */
		public translate(pos: Point3D): void;
		/**
		 * Transposes the given matrix.
		 * @param res return location for the
		 *   transposed matrix
		 */
		public transpose(res: Matrix): void;
		/**
		 * Unprojects the given #point using the #projection matrix and
		 * a #modelview matrix.
		 * @param modelview a #graphene_matrix_t for the modelview matrix; this is
		 *   the inverse of the modelview used when projecting the point
		 * @param point a #graphene_point3d_t with the coordinates of the point
		 * @param res return location for the unprojected
		 *   point
		 */
		public unproject_point3d(modelview: Matrix, point: Point3D, res: Point3D): void;
		/**
		 * Undoes the transformation on the corners of a #graphene_rect_t using the
		 * given matrix, within the given axis aligned rectangular #bounds.
		 * @param _r a #graphene_rect_t
		 * @param bounds the bounds of the transformation
		 * @param res return location for the
		 *   untransformed rectangle
		 */
		public untransform_bounds(_r: Rect, bounds: Rect, res: Rect): void;
		/**
		 * Undoes the transformation of a #graphene_point_t using the
		 * given matrix, within the given axis aligned rectangular #bounds.
		 * @param _p a #graphene_point_t
		 * @param bounds the bounds of the transformation
		 * @param res return location for the
		 *   untransformed point
		 * @returns `true` if the point was successfully untransformed
		 */
		public untransform_point(_p: Point, bounds: Rect, res: Point): boolean;
	}

	/**
	 * A 2D plane that extends infinitely in a 3D volume.
	 * 
	 * The contents of the `graphene_plane_t` are private, and should not be
	 * modified directly.
	 */
	interface Plane {}
	class Plane {
		public constructor();
		/**
		 * Allocates a new #graphene_plane_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_plane_t.
		 *   Use graphene_plane_free() to free the resources allocated by
		 *   this function
		 */
		public static alloc(): Plane;
		public readonly normal: Vec3;
		public readonly constant: number;
		/**
		 * Computes the distance of #point from a #graphene_plane_t.
		 * @param point a #graphene_point3d_t
		 * @returns the distance of the given #graphene_point3d_t from the plane
		 */
		public distance(point: Point3D): number;
		/**
		 * Checks whether the two given #graphene_plane_t are equal.
		 * @param _b a #graphene_plane_t
		 * @returns `true` if the given planes are equal
		 */
		public equal(_b: Plane): boolean;
		/**
		 * Frees the resources allocated by graphene_plane_alloc().
		 */
		public free(): void;
		/**
		 * Retrieves the distance along the normal vector of the
		 * given #graphene_plane_t from the origin.
		 * @returns the constant value of the plane
		 */
		public get_constant(): number;
		/**
		 * Retrieves the normal vector pointing towards the origin of the
		 * given #graphene_plane_t.
		 * @param normal return location for the normal vector
		 */
		public get_normal(normal: Vec3): void;
		/**
		 * Initializes the given #graphene_plane_t using the given #normal vector
		 * and #constant values.
		 * @param normal a unit length normal vector defining the plane
		 *   pointing towards the origin; if unset, we use the X axis by default
		 * @param constant the distance from the origin to the plane along the
		 *   normal vector; the sign determines the half-space occupied by the
		 *   plane
		 * @returns the initialized plane
		 */
		public init(normal: Vec3 | null, constant: number): Plane;
		/**
		 * Initializes the given #graphene_plane_t using the normal
		 * vector and constant of another #graphene_plane_t.
		 * @param src a #graphene_plane_t
		 * @returns the initialized plane
		 */
		public init_from_plane(src: Plane): Plane;
		/**
		 * Initializes the given #graphene_plane_t using the given normal vector
		 * and an arbitrary co-planar point.
		 * @param normal a normal vector defining the plane pointing towards the origin
		 * @param point a #graphene_point3d_t
		 * @returns the initialized plane
		 */
		public init_from_point(normal: Vec3, point: Point3D): Plane;
		/**
		 * Initializes the given #graphene_plane_t using the 3 provided co-planar
		 * points.
		 * 
		 * The winding order is counter-clockwise, and determines which direction
		 * the normal vector will point.
		 * @param _a a #graphene_point3d_t
		 * @param _b a #graphene_point3d_t
		 * @param _c a #graphene_point3d_t
		 * @returns the initialized plane
		 */
		public init_from_points(_a: Point3D, _b: Point3D, _c: Point3D): Plane;
		/**
		 * Initializes the given #graphene_plane_t using the components of
		 * the given #graphene_vec4_t vector.
		 * @param src a #graphene_vec4_t containing the normal vector in its first
		 *   three components, and the distance in its fourth component
		 * @returns the initialized plane
		 */
		public init_from_vec4(src: Vec4): Plane;
		/**
		 * Negates the normal vector and constant of a #graphene_plane_t, effectively
		 * mirroring the plane across the origin.
		 * @param res return location for the negated plane
		 */
		public negate(res: Plane): void;
		/**
		 * Normalizes the vector of the given #graphene_plane_t,
		 * and adjusts the constant accordingly.
		 * @param res return location for the normalized plane
		 */
		public normalize(res: Plane): void;
		/**
		 * Transforms a #graphene_plane_t #p using the given #matrix
		 * and #normal_matrix.
		 * 
		 * If #normal_matrix is %NULL, a transformation matrix for the plane
		 * normal will be computed from #matrix. If you are transforming
		 * multiple planes using the same #matrix it's recommended to compute
		 * the normal matrix beforehand to avoid incurring in the cost of
		 * recomputing it every time.
		 * @param matrix a #graphene_matrix_t
		 * @param normal_matrix a #graphene_matrix_t
		 * @param res the transformed plane
		 */
		public transform(matrix: Matrix, normal_matrix: Matrix | null, res: Plane): void;
	}

	/**
	 * A point with two coordinates.
	 */
	interface Point {}
	class Point {
		public constructor();
		/**
		 * Allocates a new #graphene_point_t structure.
		 * 
		 * The coordinates of the returned point are (0, 0).
		 * 
		 * It's possible to chain this function with graphene_point_init()
		 * or graphene_point_init_from_point(), e.g.:
		 * 
		 * |[<!-- language="C" -->
		 *   graphene_point_t *
		 *   point_new (float x, float y)
		 *   {
		 *     return graphene_point_init (graphene_point_alloc (), x, y);
		 *   }
		 * 
		 *   graphene_point_t *
		 *   point_copy (const graphene_point_t *p)
		 *   {
		 *     return graphene_point_init_from_point (graphene_point_alloc (), p);
		 *   }
		 * ]|
		 * @returns the newly allocated #graphene_point_t.
		 *   Use graphene_point_free() to free the resources allocated by
		 *   this function.
		 */
		public static alloc(): Point;
		/**
		 * the X coordinate of the point
		 */
		public x: number;
		/**
		 * the Y coordinate of the point
		 */
		public y: number;
		/**
		 * Computes the distance between #a and #b.
		 * @param _b a #graphene_point_t
		 * @returns the distance between the two points
		 */
		public distance(_b: Point): number;
		/**
		 * Checks if the two points #a and #b point to the same
		 * coordinates.
		 * 
		 * This function accounts for floating point fluctuations; if
		 * you want to control the fuzziness of the match, you can use
		 * graphene_point_near() instead.
		 * @param _b a #graphene_point_t
		 * @returns `true` if the points have the same coordinates
		 */
		public equal(_b: Point): boolean;
		/**
		 * Frees the resources allocated by graphene_point_alloc().
		 */
		public free(): void;
		/**
		 * Initializes #p to the given #x and #y coordinates.
		 * 
		 * It's safe to call this function multiple times.
		 * @param _x the X coordinate
		 * @param _y the Y coordinate
		 * @returns the initialized point
		 */
		public init(_x: number, _y: number): Point;
		/**
		 * Initializes #p with the same coordinates of #src.
		 * @param src the #graphene_point_t to use
		 * @returns the initialized point
		 */
		public init_from_point(src: Point): Point;
		/**
		 * Initializes #p with the coordinates inside the given #graphene_vec2_t.
		 * @param src a #graphene_vec2_t
		 * @returns the initialized point
		 */
		public init_from_vec2(src: Vec2): Point;
		/**
		 * Linearly interpolates the coordinates of #a and #b using the
		 * given #factor.
		 * @param _b a #graphene_point_t
		 * @param factor the linear interpolation factor
		 * @param res return location for the interpolated
		 *   point
		 */
		public interpolate(_b: Point, factor: number, res: Point): void;
		/**
		 * Checks whether the two points #a and #b are within
		 * the threshold of #epsilon.
		 * @param _b a #graphene_point_t
		 * @param epsilon threshold between the two points
		 * @returns `true` if the distance is within #epsilon
		 */
		public near(_b: Point, epsilon: number): boolean;
		/**
		 * Stores the coordinates of the given #graphene_point_t into a
		 * #graphene_vec2_t.
		 * @param _v return location for the vertex
		 */
		public to_vec2(_v: Vec2): void;
	}

	/**
	 * A point with three components: X, Y, and Z.
	 */
	interface Point3D {}
	class Point3D {
		public constructor();
		/**
		 * Allocates a #graphene_point3d_t structure.
		 * @returns the newly allocated structure.
		 *   Use graphene_point3d_free() to free the resources
		 *   allocated by this function.
		 */
		public static alloc(): Point3D;
		/**
		 * the X coordinate
		 */
		public x: number;
		/**
		 * the Y coordinate
		 */
		public y: number;
		/**
		 * the Z coordinate
		 */
		public z: number;
		/**
		 * Computes the cross product of the two given #graphene_point3d_t.
		 * @param _b a #graphene_point3d_t
		 * @param res return location for the cross
		 *   product
		 */
		public cross(_b: Point3D, res: Point3D): void;
		/**
		 * Computes the distance between the two given #graphene_point3d_t.
		 * @param _b a #graphene_point3d_t
		 * @param delta return location for the distance
		 *   components on the X, Y, and Z axis
		 * @returns the distance between two points
		 */
		public distance(_b: Point3D, delta: Vec3 | null): number;
		/**
		 * Computes the dot product of the two given #graphene_point3d_t.
		 * @param _b a #graphene_point3d_t
		 * @returns the value of the dot product
		 */
		public dot(_b: Point3D): number;
		/**
		 * Checks whether two given points are equal.
		 * @param _b a #graphene_point3d_t
		 * @returns `true` if the points are equal
		 */
		public equal(_b: Point3D): boolean;
		/**
		 * Frees the resources allocated via graphene_point3d_alloc().
		 */
		public free(): void;
		/**
		 * Initializes a #graphene_point3d_t with the given coordinates.
		 * @param _x the X coordinate of the point
		 * @param _y the Y coordinate of the point
		 * @param _z the Z coordinate of the point
		 * @returns the initialized #graphene_point3d_t
		 */
		public init(_x: number, _y: number, _z: number): Point3D;
		/**
		 * Initializes a #graphene_point3d_t using the coordinates of
		 * another #graphene_point3d_t.
		 * @param src a #graphene_point3d_t
		 * @returns the initialized point
		 */
		public init_from_point(src: Point3D): Point3D;
		/**
		 * Initializes a #graphene_point3d_t using the components
		 * of a #graphene_vec3_t.
		 * @param _v a #graphene_vec3_t
		 * @returns the initialized #graphene_point3d_t
		 */
		public init_from_vec3(_v: Vec3): Point3D;
		/**
		 * Linearly interpolates each component of #a and #b using the
		 * provided #factor, and places the result in #res.
		 * @param _b a #graphene_point3d_t
		 * @param factor the interpolation factor
		 * @param res the return location for the
		 *   interpolated #graphene_point3d_t
		 */
		public interpolate(_b: Point3D, factor: number, res: Point3D): void;
		/**
		 * Computes the length of the vector represented by the
		 * coordinates of the given #graphene_point3d_t.
		 * @returns the length of the vector represented by the point
		 */
		public length(): number;
		/**
		 * Checks whether the two points are near each other, within
		 * an #epsilon factor.
		 * @param _b a #graphene_point3d_t
		 * @param epsilon fuzzyness factor
		 * @returns `true` if the points are near each other
		 */
		public near(_b: Point3D, epsilon: number): boolean;
		/**
		 * Computes the normalization of the vector represented by the
		 * coordinates of the given #graphene_point3d_t.
		 * @param res return location for the normalized
		 *   #graphene_point3d_t
		 */
		public normalize(res: Point3D): void;
		/**
		 * Normalizes the coordinates of a #graphene_point3d_t using the
		 * given viewport and clipping planes.
		 * 
		 * The coordinates of the resulting #graphene_point3d_t will be
		 * in the [ -1, 1 ] range.
		 * @param viewport a #graphene_rect_t representing a viewport
		 * @param z_near the coordinate of the near clipping plane, or 0 for
		 *   the default near clipping plane
		 * @param z_far the coordinate of the far clipping plane, or 1 for the
		 *   default far clipping plane
		 * @param res the return location for the
		 *   normalized #graphene_point3d_t
		 */
		public normalize_viewport(viewport: Rect, z_near: number, z_far: number, res: Point3D): void;
		/**
		 * Scales the coordinates of the given #graphene_point3d_t by
		 * the given #factor.
		 * @param factor the scaling factor
		 * @param res return location for the scaled point
		 */
		public scale(factor: number, res: Point3D): void;
		/**
		 * Stores the coordinates of a #graphene_point3d_t into a
		 * #graphene_vec3_t.
		 * @param _v return location for a #graphene_vec3_t
		 */
		public to_vec3(_v: Vec3): void;
	}

	/**
	 * A 4 vertex quadrilateral, as represented by four #graphene_point_t.
	 * 
	 * The contents of a #graphene_quad_t are private and should never be
	 * accessed directly.
	 */
	interface Quad {}
	class Quad {
		public constructor();
		/**
		 * Allocates a new #graphene_quad_t instance.
		 * 
		 * The contents of the returned instance are undefined.
		 * @returns the newly created #graphene_quad_t instance
		 */
		public static alloc(): Quad;
		public readonly points: Point[];
		/**
		 * Computes the bounding rectangle of #q and places it into #r.
		 * @param _r return location for a #graphene_rect_t
		 */
		public bounds(_r: Rect): void;
		/**
		 * Checks if the given #graphene_quad_t contains the given #graphene_point_t.
		 * @param _p a #graphene_point_t
		 * @returns `true` if the point is inside the #graphene_quad_t
		 */
		public contains(_p: Point): boolean;
		/**
		 * Frees the resources allocated by graphene_quad_alloc()
		 */
		public free(): void;
		/**
		 * Retrieves the point of a #graphene_quad_t at the given index.
		 * @param index_ the index of the point to retrieve
		 * @returns a #graphene_point_t
		 */
		public get_point(index_: number): Point;
		/**
		 * Initializes a #graphene_quad_t with the given points.
		 * @param p1 the first point of the quadrilateral
		 * @param p2 the second point of the quadrilateral
		 * @param p3 the third point of the quadrilateral
		 * @param p4 the fourth point of the quadrilateral
		 * @returns the initialized #graphene_quad_t
		 */
		public init(p1: Point, p2: Point, p3: Point, p4: Point): Quad;
		/**
		 * Initializes a #graphene_quad_t using an array of points.
		 * @param points an array of 4 #graphene_point_t
		 * @returns the initialized #graphene_quad_t
		 */
		public init_from_points(points: Point[]): Quad;
		/**
		 * Initializes a #graphene_quad_t using the four corners of the
		 * given #graphene_rect_t.
		 * @param _r a #graphene_rect_t
		 * @returns the initialized #graphene_quad_t
		 */
		public init_from_rect(_r: Rect): Quad;
	}

	/**
	 * A quaternion.
	 * 
	 * The contents of the #graphene_quaternion_t structure are private
	 * and should never be accessed directly.
	 */
	interface Quaternion {}
	class Quaternion {
		public constructor();
		/**
		 * Allocates a new #graphene_quaternion_t.
		 * 
		 * The contents of the returned value are undefined.
		 * @returns the newly allocated #graphene_quaternion_t
		 */
		public static alloc(): Quaternion;
		public readonly x: number;
		public readonly y: number;
		public readonly z: number;
		public readonly w: number;
		/**
		 * Adds two #graphene_quaternion_t #a and #b.
		 * @param _b a #graphene_quaternion_t
		 * @param res the result of the operation
		 */
		public add(_b: Quaternion, res: Quaternion): void;
		/**
		 * Computes the dot product of two #graphene_quaternion_t.
		 * @param _b a #graphene_quaternion_t
		 * @returns the value of the dot products
		 */
		public dot(_b: Quaternion): number;
		/**
		 * Checks whether the given quaternions are equal.
		 * @param _b a #graphene_quaternion_t
		 * @returns `true` if the quaternions are equal
		 */
		public equal(_b: Quaternion): boolean;
		/**
		 * Releases the resources allocated by graphene_quaternion_alloc().
		 */
		public free(): void;
		/**
		 * Initializes a #graphene_quaternion_t using the given four values.
		 * @param _x the first component of the quaternion
		 * @param _y the second component of the quaternion
		 * @param _z the third component of the quaternion
		 * @param _w the fourth component of the quaternion
		 * @returns the initialized quaternion
		 */
		public init(_x: number, _y: number, _z: number, _w: number): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using an #angle on a
		 * specific #axis.
		 * @param angle the rotation on a given axis, in degrees
		 * @param axis the axis of rotation, expressed as a vector
		 * @returns the initialized quaternion
		 */
		public init_from_angle_vec3(angle: number, axis: Vec3): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the values of
		 * the [Euler angles](http://en.wikipedia.org/wiki/Euler_angles)
		 * on each axis.
		 * 
		 * See also: graphene_quaternion_init_from_euler()
		 * @param deg_x rotation angle on the X axis (yaw), in degrees
		 * @param deg_y rotation angle on the Y axis (pitch), in degrees
		 * @param deg_z rotation angle on the Z axis (roll), in degrees
		 * @returns the initialized quaternion
		 */
		public init_from_angles(deg_x: number, deg_y: number, deg_z: number): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the given #graphene_euler_t.
		 * @param _e a #graphene_euler_t
		 * @returns the initialized #graphene_quaternion_t
		 */
		public init_from_euler(_e: Euler): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the rotation components
		 * of a transformation matrix.
		 * @param _m a #graphene_matrix_t
		 * @returns the initialized quaternion
		 */
		public init_from_matrix(_m: Matrix): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t with the values from #src.
		 * @param src a #graphene_quaternion_t
		 * @returns the initialized quaternion
		 */
		public init_from_quaternion(src: Quaternion): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the values of
		 * the [Euler angles](http://en.wikipedia.org/wiki/Euler_angles)
		 * on each axis.
		 * 
		 * See also: graphene_quaternion_init_from_euler()
		 * @param rad_x rotation angle on the X axis (yaw), in radians
		 * @param rad_y rotation angle on the Y axis (pitch), in radians
		 * @param rad_z rotation angle on the Z axis (roll), in radians
		 * @returns the initialized quaternion
		 */
		public init_from_radians(rad_x: number, rad_y: number, rad_z: number): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t with the values from #src.
		 * @param src a #graphene_vec4_t
		 * @returns the initialized quaternion
		 */
		public init_from_vec4(src: Vec4): Quaternion;
		/**
		 * Initializes a #graphene_quaternion_t using the identity
		 * transformation.
		 * @returns the initialized quaternion
		 */
		public init_identity(): Quaternion;
		/**
		 * Inverts a #graphene_quaternion_t, and returns the conjugate
		 * quaternion of #q.
		 * @param res return location for the inverted
		 *   quaternion
		 */
		public invert(res: Quaternion): void;
		/**
		 * Multiplies two #graphene_quaternion_t #a and #b.
		 * @param _b a #graphene_quaternion_t
		 * @param res the result of the operation
		 */
		public multiply(_b: Quaternion, res: Quaternion): void;
		/**
		 * Normalizes a #graphene_quaternion_t.
		 * @param res return location for the normalized
		 *   quaternion
		 */
		public normalize(res: Quaternion): void;
		/**
		 * Scales all the elements of a #graphene_quaternion_t #q using
		 * the given scalar factor.
		 * @param factor a scaling factor
		 * @param res the result of the operation
		 */
		public scale(factor: number, res: Quaternion): void;
		/**
		 * Interpolates between the two given quaternions using a spherical
		 * linear interpolation, or [SLERP](http://en.wikipedia.org/wiki/Slerp),
		 * using the given interpolation #factor.
		 * @param _b a #graphene_quaternion_t
		 * @param factor the linear interpolation factor
		 * @param res return location for the interpolated
		 *   quaternion
		 */
		public slerp(_b: Quaternion, factor: number, res: Quaternion): void;
		/**
		 * Converts a quaternion into an #angle, #axis pair.
		 * @param axis return location for the rotation axis
		 */
		public to_angle_vec3(axis: Vec3): void;
		/**
		 * Converts a #graphene_quaternion_t to its corresponding rotations
		 * on the [Euler angles](http://en.wikipedia.org/wiki/Euler_angles)
		 * on each axis.
		 * @returns return location for the rotation angle on
		 *   the X axis (yaw), in degrees
		 * 
		 * return location for the rotation angle on
		 *   the Y axis (pitch), in degrees
		 * 
		 * return location for the rotation angle on
		 *   the Z axis (roll), in degrees
		 */
		public to_angles(): [ deg_x: number | null, deg_y: number | null, deg_z: number | null ];
		/**
		 * Converts a quaternion into a transformation matrix expressing
		 * the rotation defined by the #graphene_quaternion_t.
		 * @param _m a #graphene_matrix_t
		 */
		public to_matrix(_m: Matrix): void;
		/**
		 * Converts a #graphene_quaternion_t to its corresponding rotations
		 * on the [Euler angles](http://en.wikipedia.org/wiki/Euler_angles)
		 * on each axis.
		 * @returns return location for the rotation angle on
		 *   the X axis (yaw), in radians
		 * 
		 * return location for the rotation angle on
		 *   the Y axis (pitch), in radians
		 * 
		 * return location for the rotation angle on
		 *   the Z axis (roll), in radians
		 */
		public to_radians(): [ rad_x: number | null, rad_y: number | null, rad_z: number | null ];
		/**
		 * Copies the components of a #graphene_quaternion_t into a
		 * #graphene_vec4_t.
		 * @param res return location for a
		 *   #graphene_vec4_t
		 */
		public to_vec4(res: Vec4): void;
	}

	/**
	 * A ray emitted from an origin in a given direction.
	 * 
	 * The contents of the `graphene_ray_t` structure are private, and should not
	 * be modified directly.
	 */
	interface Ray {}
	class Ray {
		public constructor();
		/**
		 * Allocates a new #graphene_ray_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_ray_t.
		 *   Use graphene_ray_free() to free the resources allocated by
		 *   this function
		 */
		public static alloc(): Ray;
		public readonly origin: Vec3;
		public readonly direction: Vec3;
		/**
		 * Checks whether the two given #graphene_ray_t are equal.
		 * @param _b a #graphene_ray_t
		 * @returns `true` if the given rays are equal
		 */
		public equal(_b: Ray): boolean;
		/**
		 * Frees the resources allocated by graphene_ray_alloc().
		 */
		public free(): void;
		/**
		 * Computes the point on the given #graphene_ray_t that is closest to the
		 * given point #p.
		 * @param _p a #graphene_point3d_t
		 * @param res return location for the closest point3d
		 */
		public get_closest_point_to_point(_p: Point3D, res: Point3D): void;
		/**
		 * Retrieves the direction of the given #graphene_ray_t.
		 * @param direction return location for the direction
		 */
		public get_direction(direction: Vec3): void;
		/**
		 * Computes the distance of the origin of the given #graphene_ray_t from the
		 * given plane.
		 * 
		 * If the ray does not intersect the plane, this function returns `INFINITY`.
		 * @param _p a #graphene_plane_t
		 * @returns the distance of the origin of the ray from the plane
		 */
		public get_distance_to_plane(_p: Plane): number;
		/**
		 * Computes the distance of the closest approach between the
		 * given #graphene_ray_t #r and the point #p.
		 * 
		 * The closest approach to a ray from a point is the distance
		 * between the point and the projection of the point on the
		 * ray itself.
		 * @param _p a #graphene_point3d_t
		 * @returns the distance of the point
		 */
		public get_distance_to_point(_p: Point3D): number;
		/**
		 * Retrieves the origin of the given #graphene_ray_t.
		 * @param origin return location for the origin
		 */
		public get_origin(origin: Point3D): void;
		/**
		 * Retrieves the coordinates of a point at the distance #t along the
		 * given #graphene_ray_t.
		 * @param _t the distance along the ray
		 * @param position return location for the position
		 */
		public get_position_at(_t: number, position: Point3D): void;
		/**
		 * Initializes the given #graphene_ray_t using the given #origin
		 * and #direction values.
		 * @param origin the origin of the ray
		 * @param direction the direction vector
		 * @returns the initialized ray
		 */
		public init(origin: Point3D | null, direction: Vec3 | null): Ray;
		/**
		 * Initializes the given #graphene_ray_t using the origin and direction
		 * values of another #graphene_ray_t.
		 * @param src a #graphene_ray_t
		 * @returns the initialized ray
		 */
		public init_from_ray(src: Ray): Ray;
		/**
		 * Initializes the given #graphene_ray_t using the given vectors.
		 * @param origin a #graphene_vec3_t
		 * @param direction a #graphene_vec3_t
		 * @returns the initialized ray
		 */
		public init_from_vec3(origin: Vec3 | null, direction: Vec3 | null): Ray;
		/**
		 * Intersects the given #graphene_ray_t #r with the given
		 * #graphene_box_t #b.
		 * @param _b a #graphene_box_t
		 * @returns the type of intersection
		 */
		public intersect_box(_b: Box): RayIntersectionKind;
		/**
		 * Intersects the given #graphene_ray_t #r with the given
		 * #graphene_sphere_t #s.
		 * @param _s a #graphene_sphere_t
		 * @returns the type of intersection
		 */
		public intersect_sphere(_s: Sphere): RayIntersectionKind;
		/**
		 * Intersects the given #graphene_ray_t #r with the given
		 * #graphene_triangle_t #t.
		 * @param _t a #graphene_triangle_t
		 * @returns the type of intersection
		 */
		public intersect_triangle(_t: Triangle): RayIntersectionKind;
		/**
		 * Checks whether the given #graphene_ray_t #r intersects the
		 * given #graphene_box_t #b.
		 * 
		 * See also: graphene_ray_intersect_box()
		 * @param _b a #graphene_box_t
		 * @returns `true` if the ray intersects the box
		 */
		public intersects_box(_b: Box): boolean;
		/**
		 * Checks if the given #graphene_ray_t #r intersects the
		 * given #graphene_sphere_t #s.
		 * 
		 * See also: graphene_ray_intersect_sphere()
		 * @param _s a #graphene_sphere_t
		 * @returns `true` if the ray intersects the sphere
		 */
		public intersects_sphere(_s: Sphere): boolean;
		/**
		 * Checks whether the given #graphene_ray_t #r intersects the
		 * given #graphene_triangle_t #b.
		 * 
		 * See also: graphene_ray_intersect_triangle()
		 * @param _t a #graphene_triangle_t
		 * @returns `true` if the ray intersects the triangle
		 */
		public intersects_triangle(_t: Triangle): boolean;
	}

	/**
	 * The location and size of a rectangle region.
	 * 
	 * The width and height of a #graphene_rect_t can be negative; for instance,
	 * a #graphene_rect_t with an origin of [ 0, 0 ] and a size of [ 10, 10 ] is
	 * equivalent to a #graphene_rect_t with an origin of [ 10, 10 ] and a size
	 * of [ -10, -10 ].
	 * 
	 * Application code can normalize rectangles using graphene_rect_normalize();
	 * this function will ensure that the width and height of a rectangle are
	 * positive values. All functions taking a #graphene_rect_t as an argument
	 * will internally operate on a normalized copy; all functions returning a
	 * #graphene_rect_t will always return a normalized rectangle.
	 */
	interface Rect {}
	class Rect {
		public constructor();
		/**
		 * the coordinates of the origin of the rectangle
		 */
		public origin: Point;
		/**
		 * the size of the rectangle
		 */
		public size: Size;
		/**
		 * Checks whether a #graphene_rect_t contains the given coordinates.
		 * @param _p a #graphene_point_t
		 * @returns `true` if the rectangle contains the point
		 */
		public contains_point(_p: Point): boolean;
		/**
		 * Checks whether a #graphene_rect_t fully contains the given
		 * rectangle.
		 * @param _b a #graphene_rect_t
		 * @returns `true` if the rectangle #a fully contains #b
		 */
		public contains_rect(_b: Rect): boolean;
		/**
		 * Checks whether the two given rectangle are equal.
		 * @param _b a #graphene_rect_t
		 * @returns `true` if the rectangles are equal
		 */
		public equal(_b: Rect): boolean;
		/**
		 * Expands a #graphene_rect_t to contain the given #graphene_point_t.
		 * @param _p a #graphene_point_t
		 * @param res return location for the expanded rectangle
		 */
		public expand(_p: Point, res: Rect): void;
		/**
		 * Frees the resources allocated by graphene_rect_alloc().
		 */
		public free(): void;
		/**
		 * Compute the area of given normalized rectangle.
		 * @returns the area of the normalized rectangle
		 */
		public get_area(): number;
		/**
		 * Retrieves the coordinates of the bottom-left corner of the given rectangle.
		 * @param _p return location for a #graphene_point_t
		 */
		public get_bottom_left(_p: Point): void;
		/**
		 * Retrieves the coordinates of the bottom-right corner of the given rectangle.
		 * @param _p return location for a #graphene_point_t
		 */
		public get_bottom_right(_p: Point): void;
		/**
		 * Retrieves the coordinates of the center of the given rectangle.
		 * @param _p return location for a #graphene_point_t
		 */
		public get_center(_p: Point): void;
		/**
		 * Retrieves the normalized height of the given rectangle.
		 * @returns the normalized height of the rectangle
		 */
		public get_height(): number;
		/**
		 * Retrieves the coordinates of the top-left corner of the given rectangle.
		 * @param _p return location for a #graphene_point_t
		 */
		public get_top_left(_p: Point): void;
		/**
		 * Retrieves the coordinates of the top-right corner of the given rectangle.
		 * @param _p return location for a #graphene_point_t
		 */
		public get_top_right(_p: Point): void;
		/**
		 * Computes the four vertices of a #graphene_rect_t.
		 * @param vertices return location for an array
		 *  of 4 #graphene_vec2_t
		 */
		public get_vertices(vertices: Vec2[]): void;
		/**
		 * Retrieves the normalized width of the given rectangle.
		 * @returns the normalized width of the rectangle
		 */
		public get_width(): number;
		/**
		 * Retrieves the normalized X coordinate of the origin of the given
		 * rectangle.
		 * @returns the normalized X coordinate of the rectangle
		 */
		public get_x(): number;
		/**
		 * Retrieves the normalized Y coordinate of the origin of the given
		 * rectangle.
		 * @returns the normalized Y coordinate of the rectangle
		 */
		public get_y(): number;
		/**
		 * Initializes the given #graphene_rect_t with the given values.
		 * 
		 * This function will implicitly normalize the #graphene_rect_t
		 * before returning.
		 * @param _x the X coordinate of the #graphene_rect_t.origin
		 * @param _y the Y coordinate of the #graphene_rect_t.origin
		 * @param width the width of the #graphene_rect_t.size
		 * @param height the height of the #graphene_rect_t.size
		 * @returns the initialized rectangle
		 */
		public init(_x: number, _y: number, width: number, height: number): Rect;
		/**
		 * Initializes #r using the given #src rectangle.
		 * 
		 * This function will implicitly normalize the #graphene_rect_t
		 * before returning.
		 * @param src a #graphene_rect_t
		 * @returns the initialized rectangle
		 */
		public init_from_rect(src: Rect): Rect;
		/**
		 * Changes the given rectangle to be smaller, or larger depending on the
		 * given inset parameters.
		 * 
		 * To create an inset rectangle, use positive #d_x or #d_y values; to
		 * create a larger, encompassing rectangle, use negative #d_x or #d_y
		 * values.
		 * 
		 * The origin of the rectangle is offset by #d_x and #d_y, while the size
		 * is adjusted by `(2 * #d_x, 2 * #d_y)`. If #d_x and #d_y are positive
		 * values, the size of the rectangle is decreased; if #d_x and #d_y are
		 * negative values, the size of the rectangle is increased.
		 * 
		 * If the size of the resulting inset rectangle has a negative width or
		 * height then the size will be set to zero.
		 * @param d_x the horizontal inset
		 * @param d_y the vertical inset
		 * @returns the inset rectangle
		 */
		public inset(d_x: number, d_y: number): Rect;
		/**
		 * Changes the given rectangle to be smaller, or larger depending on the
		 * given inset parameters.
		 * 
		 * To create an inset rectangle, use positive #d_x or #d_y values; to
		 * create a larger, encompassing rectangle, use negative #d_x or #d_y
		 * values.
		 * 
		 * The origin of the rectangle is offset by #d_x and #d_y, while the size
		 * is adjusted by `(2 * #d_x, 2 * #d_y)`. If #d_x and #d_y are positive
		 * values, the size of the rectangle is decreased; if #d_x and #d_y are
		 * negative values, the size of the rectangle is increased.
		 * 
		 * If the size of the resulting inset rectangle has a negative width or
		 * height then the size will be set to zero.
		 * @param d_x the horizontal inset
		 * @param d_y the vertical inset
		 * @param res return location for the inset rectangle
		 */
		public inset_r(d_x: number, d_y: number, res: Rect): void;
		/**
		 * Linearly interpolates the origin and size of the two given
		 * rectangles.
		 * @param _b a #graphene_rect_t
		 * @param factor the linear interpolation factor
		 * @param res return location for the
		 *   interpolated rectangle
		 */
		public interpolate(_b: Rect, factor: number, res: Rect): void;
		/**
		 * Computes the intersection of the two given rectangles.
		 * 
		 * ![](rectangle-intersection.png)
		 * 
		 * The intersection in the image above is the blue outline.
		 * 
		 * If the two rectangles do not intersect, #res will contain
		 * a degenerate rectangle with origin in (0, 0) and a size of 0.
		 * @param _b a #graphene_rect_t
		 * @param res return location for
		 *   a #graphene_rect_t
		 * @returns `true` if the two rectangles intersect
		 */
		public intersection(_b: Rect, res: Rect | null): boolean;
		/**
		 * Normalizes the passed rectangle.
		 * 
		 * This function ensures that the size of the rectangle is made of
		 * positive values, and that the origin is the top-left corner of
		 * the rectangle.
		 * @returns the normalized rectangle
		 */
		public normalize(): Rect;
		/**
		 * Normalizes the passed rectangle.
		 * 
		 * This function ensures that the size of the rectangle is made of
		 * positive values, and that the origin is in the top-left corner
		 * of the rectangle.
		 * @param res the return location for the
		 *   normalized rectangle
		 */
		public normalize_r(res: Rect): void;
		/**
		 * Offsets the origin by #d_x and #d_y.
		 * 
		 * The size of the rectangle is unchanged.
		 * @param d_x the horizontal offset
		 * @param d_y the vertical offset
		 * @returns the offset rectangle
		 */
		public offset(d_x: number, d_y: number): Rect;
		/**
		 * Offsets the origin of the given rectangle by #d_x and #d_y.
		 * 
		 * The size of the rectangle is left unchanged.
		 * @param d_x the horizontal offset
		 * @param d_y the vertical offset
		 * @param res return location for the offset
		 *   rectangle
		 */
		public offset_r(d_x: number, d_y: number, res: Rect): void;
		/**
		 * Rounds the origin and size of the given rectangle to
		 * their nearest integer values; the rounding is guaranteed
		 * to be large enough to have an area bigger or equal to the
		 * original rectangle, but might not fully contain its extents.
		 * Use graphene_rect_round_extents() in case you need to round
		 * to a rectangle that covers fully the original one.
		 * 
		 * This function is the equivalent of calling `floor` on
		 * the coordinates of the origin, and `ceil` on the size.
		 * @param res return location for the
		 *   rounded rectangle
		 */
		public round(res: Rect): void;
		/**
		 * Rounds the origin of the given rectangle to its nearest
		 * integer value and and recompute the size so that the
		 * rectangle is large enough to contain all the conrners
		 * of the original rectangle.
		 * 
		 * This function is the equivalent of calling `floor` on
		 * the coordinates of the origin, and recomputing the size
		 * calling `ceil` on the bottom-right coordinates.
		 * 
		 * If you want to be sure that the rounded rectangle
		 * completely covers the area that was covered by the
		 * original rectangle — i.e. you want to cover the area
		 * including all its corners — this function will make sure
		 * that the size is recomputed taking into account the ceiling
		 * of the coordinates of the bottom-right corner.
		 * If the difference between the original coordinates and the
		 * coordinates of the rounded rectangle is greater than the
		 * difference between the original size and and the rounded
		 * size, then the move of the origin would not be compensated
		 * by a move in the anti-origin, leaving the corners of the
		 * original rectangle outside the rounded one.
		 * @param res return location for the
		 *   rectangle with rounded extents
		 */
		public round_extents(res: Rect): void;
		/**
		 * Rounds the origin and the size of the given rectangle to
		 * their nearest integer values; the rounding is guaranteed
		 * to be large enough to contain the original rectangle.
		 * @returns the pixel-aligned rectangle.
		 */
		public round_to_pixel(): Rect;
		/**
		 * Scales the size and origin of a rectangle horizontaly by #s_h,
		 * and vertically by #s_v. The result #res is normalized.
		 * @param s_h horizontal scale factor
		 * @param s_v vertical scale factor
		 * @param res return location for the
		 *   scaled rectangle
		 */
		public scale(s_h: number, s_v: number, res: Rect): void;
		/**
		 * Computes the union of the two given rectangles.
		 * 
		 * ![](rectangle-union.png)
		 * 
		 * The union in the image above is the blue outline.
		 * @param _b a #graphene_rect_t
		 * @param res return location for a #graphene_rect_t
		 */
		public union(_b: Rect, res: Rect): void;
	}

	interface Simd4F {}
	class Simd4F {
		public constructor();
		public readonly x: number;
		public readonly y: number;
		public readonly z: number;
		public readonly w: number;
	}

	interface Simd4X4F {}
	class Simd4X4F {
		public constructor();
		public readonly x: Simd4F;
		public readonly y: Simd4F;
		public readonly z: Simd4F;
		public readonly w: Simd4F;
	}

	/**
	 * A size.
	 */
	interface Size {}
	class Size {
		public constructor();
		/**
		 * Allocates a new #graphene_size_t.
		 * 
		 * The contents of the returned value are undefined.
		 * @returns the newly allocated #graphene_size_t
		 */
		public static alloc(): Size;
		/**
		 * the width
		 */
		public width: number;
		/**
		 * the height
		 */
		public height: number;
		/**
		 * Checks whether the two give #graphene_size_t are equal.
		 * @param _b a #graphene_size_t
		 * @returns `true` if the sizes are equal
		 */
		public equal(_b: Size): boolean;
		/**
		 * Frees the resources allocated by graphene_size_alloc().
		 */
		public free(): void;
		/**
		 * Initializes a #graphene_size_t using the given #width and #height.
		 * @param width the width
		 * @param height the height
		 * @returns the initialized #graphene_size_t
		 */
		public init(width: number, height: number): Size;
		/**
		 * Initializes a #graphene_size_t using the width and height of
		 * the given #src.
		 * @param src a #graphene_size_t
		 * @returns the initialized #graphene_size_t
		 */
		public init_from_size(src: Size): Size;
		/**
		 * Linearly interpolates the two given #graphene_size_t using the given
		 * interpolation #factor.
		 * @param _b a #graphene_size_t
		 * @param factor the linear interpolation factor
		 * @param res return location for the interpolated size
		 */
		public interpolate(_b: Size, factor: number, res: Size): void;
		/**
		 * Scales the components of a #graphene_size_t using the given #factor.
		 * @param factor the scaling factor
		 * @param res return location for the scaled size
		 */
		public scale(factor: number, res: Size): void;
	}

	/**
	 * A sphere, represented by its center and radius.
	 */
	interface Sphere {}
	class Sphere {
		public constructor();
		/**
		 * Allocates a new #graphene_sphere_t.
		 * 
		 * The contents of the newly allocated structure are undefined.
		 * @returns the newly allocated #graphene_sphere_t. Use
		 *   graphene_sphere_free() to free the resources allocated by this function
		 */
		public static alloc(): Sphere;
		public readonly center: Vec3;
		public readonly radius: number;
		/**
		 * Checks whether the given #point is contained in the volume
		 * of a #graphene_sphere_t.
		 * @param point a #graphene_point3d_t
		 * @returns `true` if the sphere contains the point
		 */
		public contains_point(point: Point3D): boolean;
		/**
		 * Computes the distance of the given #point from the surface of
		 * a #graphene_sphere_t.
		 * @param point a #graphene_point3d_t
		 * @returns the distance of the point
		 */
		public distance(point: Point3D): number;
		/**
		 * Checks whether two #graphene_sphere_t are equal.
		 * @param _b a #graphene_sphere_t
		 * @returns `true` if the spheres are equal
		 */
		public equal(_b: Sphere): boolean;
		/**
		 * Frees the resources allocated by graphene_sphere_alloc().
		 */
		public free(): void;
		/**
		 * Computes the bounding box capable of containing the
		 * given #graphene_sphere_t.
		 * @param box return location for the bounding box
		 */
		public get_bounding_box(box: Box): void;
		/**
		 * Retrieves the coordinates of the center of a #graphene_sphere_t.
		 * @param center return location for the coordinates of
		 *   the center
		 */
		public get_center(center: Point3D): void;
		/**
		 * Retrieves the radius of a #graphene_sphere_t.
		 * @returns 
		 */
		public get_radius(): number;
		/**
		 * Initializes the given #graphene_sphere_t with the given #center and #radius.
		 * @param center the coordinates of the center of the sphere, or %NULL
		 *   for a center in (0, 0, 0)
		 * @param radius the radius of the sphere
		 * @returns the initialized #graphene_sphere_t
		 */
		public init(center: Point3D | null, radius: number): Sphere;
		/**
		 * Initializes the given #graphene_sphere_t using the given array
		 * of 3D coordinates so that the sphere includes them.
		 * 
		 * The center of the sphere can either be specified, or will be center
		 * of the 3D volume that encompasses all #points.
		 * @param n_points the number of #graphene_point3d_t in the #points array
		 * @param points an array of #graphene_point3d_t
		 * @param center the center of the sphere
		 * @returns the initialized #graphene_sphere_t
		 */
		public init_from_points(n_points: number, points: Point3D[], center: Point3D | null): Sphere;
		/**
		 * Initializes the given #graphene_sphere_t using the given array
		 * of 3D coordinates so that the sphere includes them.
		 * 
		 * The center of the sphere can either be specified, or will be center
		 * of the 3D volume that encompasses all #vectors.
		 * @param n_vectors the number of #graphene_vec3_t in the #vectors array
		 * @param vectors an array of #graphene_vec3_t
		 * @param center the center of the sphere
		 * @returns the initialized #graphene_sphere_t
		 */
		public init_from_vectors(n_vectors: number, vectors: Vec3[], center: Point3D | null): Sphere;
		/**
		 * Checks whether the sphere has a zero radius.
		 * @returns `true` if the sphere is empty
		 */
		public is_empty(): boolean;
		/**
		 * Translates the center of the given #graphene_sphere_t using the #point
		 * coordinates as the delta of the translation.
		 * @param point the coordinates of the translation
		 * @param res return location for the translated sphere
		 */
		public translate(point: Point3D, res: Sphere): void;
	}

	/**
	 * A triangle.
	 */
	interface Triangle {}
	class Triangle {
		public constructor();
		/**
		 * Allocates a new #graphene_triangle_t.
		 * 
		 * The contents of the returned structure are undefined.
		 * @returns the newly allocated #graphene_triangle_t
		 *   structure. Use graphene_triangle_free() to free the resources
		 *   allocated by this function
		 */
		public static alloc(): Triangle;
		public readonly a: Vec3;
		public readonly b: Vec3;
		public readonly c: Vec3;
		/**
		 * Checks whether the given triangle #t contains the point #p.
		 * @param _p a #graphene_point3d_t
		 * @returns `true` if the point is inside the triangle
		 */
		public contains_point(_p: Point3D): boolean;
		/**
		 * Checks whether the two given #graphene_triangle_t are equal.
		 * @param _b a #graphene_triangle_t
		 * @returns `true` if the triangles are equal
		 */
		public equal(_b: Triangle): boolean;
		/**
		 * Frees the resources allocated by graphene_triangle_alloc().
		 */
		public free(): void;
		/**
		 * Computes the area of the given #graphene_triangle_t.
		 * @returns the area of the triangle
		 */
		public get_area(): number;
		/**
		 * Computes the [barycentric coordinates](http://en.wikipedia.org/wiki/Barycentric_coordinate_system)
		 * of the given point #p.
		 * 
		 * The point #p must lie on the same plane as the triangle #t; if the
		 * point is not coplanar, the result of this function is undefined.
		 * 
		 * If we place the origin in the coordinates of the triangle's A point,
		 * the barycentric coordinates are `u`, which is on the AC vector; and `v`
		 * which is on the AB vector:
		 * 
		 * ![](triangle-barycentric.png)
		 * 
		 * The returned #graphene_vec2_t contains the following values, in order:
		 * 
		 *  - `res.x = u`
		 *  - `res.y = v`
		 * @param _p a #graphene_point3d_t
		 * @param res return location for the vector
		 *   with the barycentric coordinates
		 * @returns `true` if the barycentric coordinates are valid
		 */
		public get_barycoords(_p: Point3D | null, res: Vec2): boolean;
		/**
		 * Computes the bounding box of the given #graphene_triangle_t.
		 * @param res return location for the box
		 */
		public get_bounding_box(res: Box): void;
		/**
		 * Computes the coordinates of the midpoint of the given #graphene_triangle_t.
		 * 
		 * The midpoint G is the [centroid](https://en.wikipedia.org/wiki/Centroid#Triangle_centroid)
		 * of the triangle, i.e. the intersection of its medians.
		 * @param res return location for the coordinates of
		 *   the midpoint
		 */
		public get_midpoint(res: Point3D): void;
		/**
		 * Computes the normal vector of the given #graphene_triangle_t.
		 * @param res return location for the normal vector
		 */
		public get_normal(res: Vec3): void;
		/**
		 * Computes the plane based on the vertices of the given #graphene_triangle_t.
		 * @param res return location for the plane
		 */
		public get_plane(res: Plane): void;
		/**
		 * Retrieves the three vertices of the given #graphene_triangle_t and returns
		 * their coordinates as #graphene_point3d_t.
		 * @param _a return location for the coordinates
		 *   of the first vertex
		 * @param _b return location for the coordinates
		 *   of the second vertex
		 * @param _c return location for the coordinates
		 *   of the third vertex
		 */
		public get_points(_a: Point3D | null, _b: Point3D | null, _c: Point3D | null): void;
		/**
		 * Computes the UV coordinates of the given point #p.
		 * 
		 * The point #p must lie on the same plane as the triangle #t; if the point
		 * is not coplanar, the result of this function is undefined. If #p is %NULL,
		 * the point will be set in (0, 0, 0).
		 * 
		 * The UV coordinates will be placed in the #res vector:
		 * 
		 *  - `res.x = u`
		 *  - `res.y = v`
		 * 
		 * See also: graphene_triangle_get_barycoords()
		 * @param _p a #graphene_point3d_t
		 * @param uv_a the UV coordinates of the first point
		 * @param uv_b the UV coordinates of the second point
		 * @param uv_c the UV coordinates of the third point
		 * @param res a vector containing the UV coordinates
		 *   of the given point #p
		 * @returns `true` if the coordinates are valid
		 */
		public get_uv(_p: Point3D | null, uv_a: Vec2, uv_b: Vec2, uv_c: Vec2, res: Vec2): boolean;
		/**
		 * Retrieves the three vertices of the given #graphene_triangle_t.
		 * @param _a return location for the first vertex
		 * @param _b return location for the second vertex
		 * @param _c return location for the third vertex
		 */
		public get_vertices(_a: Vec3 | null, _b: Vec3 | null, _c: Vec3 | null): void;
		/**
		 * Initializes a #graphene_triangle_t using the three given arrays
		 * of floating point values, each representing the coordinates of
		 * a point in 3D space.
		 * @param _a an array of 3 floating point values
		 * @param _b an array of 3 floating point values
		 * @param _c an array of 3 floating point values
		 * @returns the initialized #graphene_triangle_t
		 */
		public init_from_float(_a: number[], _b: number[], _c: number[]): Triangle;
		/**
		 * Initializes a #graphene_triangle_t using the three given 3D points.
		 * @param _a a #graphene_point3d_t
		 * @param _b a #graphene_point3d_t
		 * @param _c a #graphene_point3d_t
		 * @returns the initialized #graphene_triangle_t
		 */
		public init_from_point3d(_a: Point3D | null, _b: Point3D | null, _c: Point3D | null): Triangle;
		/**
		 * Initializes a #graphene_triangle_t using the three given vectors.
		 * @param _a a #graphene_vec3_t
		 * @param _b a #graphene_vec3_t
		 * @param _c a #graphene_vec3_t
		 * @returns the initialized #graphene_triangle_t
		 */
		public init_from_vec3(_a: Vec3 | null, _b: Vec3 | null, _c: Vec3 | null): Triangle;
	}

	/**
	 * A structure capable of holding a vector with two dimensions, x and y.
	 * 
	 * The contents of the #graphene_vec2_t structure are private and should
	 * never be accessed directly.
	 */
	interface Vec2 {}
	class Vec2 {
		public constructor();
		/**
		 * Allocates a new #graphene_vec2_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * 
		 * Use graphene_vec2_init() to initialize the vector.
		 * @returns the newly allocated #graphene_vec2_t
		 *   structure. Use graphene_vec2_free() to free the resources allocated
		 *   by this function.
		 */
		public static alloc(): Vec2;
		public readonly value: Simd4F;
		/**
		 * Adds each component of the two passed vectors and places
		 * each result into the components of #res.
		 * @param _b a #graphene_vec2_t
		 * @param res return location for the result
		 */
		public add(_b: Vec2, res: Vec2): void;
		/**
		 * Divides each component of the first operand #a by the corresponding
		 * component of the second operand #b, and places the results into the
		 * vector #res.
		 * @param _b a #graphene_vec2_t
		 * @param res return location for the result
		 */
		public divide(_b: Vec2, res: Vec2): void;
		/**
		 * Computes the dot product of the two given vectors.
		 * @param _b a #graphene_vec2_t
		 * @returns the dot product of the vectors
		 */
		public dot(_b: Vec2): number;
		/**
		 * Checks whether the two given #graphene_vec2_t are equal.
		 * @param v2 a #graphene_vec2_t
		 * @returns `true` if the two vectors are equal, and false otherwise
		 */
		public equal(v2: Vec2): boolean;
		/**
		 * Frees the resources allocated by #v
		 */
		public free(): void;
		/**
		 * Retrieves the X component of the #graphene_vec2_t.
		 * @returns the value of the X component
		 */
		public get_x(): number;
		/**
		 * Retrieves the Y component of the #graphene_vec2_t.
		 * @returns the value of the Y component
		 */
		public get_y(): number;
		/**
		 * Initializes a #graphene_vec2_t using the given values.
		 * 
		 * This function can be called multiple times.
		 * @param _x the X field of the vector
		 * @param _y the Y field of the vector
		 * @returns the initialized vector
		 */
		public init(_x: number, _y: number): Vec2;
		/**
		 * Initializes #v with the contents of the given array.
		 * @param src an array of floating point values
		 *   with at least two elements
		 * @returns the initialized vector
		 */
		public init_from_float(src: number[]): Vec2;
		/**
		 * Copies the contents of #src into #v.
		 * @param src a #graphene_vec2_t
		 * @returns the initialized vector
		 */
		public init_from_vec2(src: Vec2): Vec2;
		/**
		 * Linearly interpolates #v1 and #v2 using the given #factor.
		 * @param v2 a #graphene_vec2_t
		 * @param factor the interpolation factor
		 * @param res the interpolated vector
		 */
		public interpolate(v2: Vec2, factor: number, res: Vec2): void;
		/**
		 * Computes the length of the given vector.
		 * @returns the length of the vector
		 */
		public length(): number;
		/**
		 * Compares the two given vectors and places the maximum
		 * values of each component into #res.
		 * @param _b a #graphene_vec2_t
		 * @param res the resulting vector
		 */
		public max(_b: Vec2, res: Vec2): void;
		/**
		 * Compares the two given vectors and places the minimum
		 * values of each component into #res.
		 * @param _b a #graphene_vec2_t
		 * @param res the resulting vector
		 */
		public min(_b: Vec2, res: Vec2): void;
		/**
		 * Multiplies each component of the two passed vectors and places
		 * each result into the components of #res.
		 * @param _b a #graphene_vec2_t
		 * @param res return location for the result
		 */
		public multiply(_b: Vec2, res: Vec2): void;
		/**
		 * Compares the two given #graphene_vec2_t vectors and checks
		 * whether their values are within the given #epsilon.
		 * @param v2 a #graphene_vec2_t
		 * @param epsilon the threshold between the two vectors
		 * @returns `true` if the two vectors are near each other
		 */
		public near(v2: Vec2, epsilon: number): boolean;
		/**
		 * Negates the given #graphene_vec2_t.
		 * @param res return location for the result vector
		 */
		public negate(res: Vec2): void;
		/**
		 * Computes the normalized vector for the given vector #v.
		 * @param res return location for the
		 *   normalized vector
		 */
		public normalize(res: Vec2): void;
		/**
		 * Multiplies all components of the given vector with the given scalar #factor.
		 * @param factor the scalar factor
		 * @param res return location for the result vector
		 */
		public scale(factor: number, res: Vec2): void;
		/**
		 * Subtracts from each component of the first operand #a the
		 * corresponding component of the second operand #b and places
		 * each result into the components of #res.
		 * @param _b a #graphene_vec2_t
		 * @param res return location for the result
		 */
		public subtract(_b: Vec2, res: Vec2): void;
		/**
		 * Stores the components of #v into an array.
		 * @param dest return location
		 *   for an array of floating point values with at least 2 elements
		 */
		public to_float(dest: number[]): void;
	}

	/**
	 * A structure capable of holding a vector with three dimensions: x, y, and z.
	 * 
	 * The contents of the #graphene_vec3_t structure are private and should
	 * never be accessed directly.
	 */
	interface Vec3 {}
	class Vec3 {
		public constructor();
		/**
		 * Allocates a new #graphene_vec3_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * 
		 * Use graphene_vec3_init() to initialize the vector.
		 * @returns the newly allocated #graphene_vec3_t
		 *   structure. Use graphene_vec3_free() to free the resources allocated
		 *   by this function.
		 */
		public static alloc(): Vec3;
		public readonly value: Simd4F;
		/**
		 * Adds each component of the two given vectors.
		 * @param _b a #graphene_vec3_t
		 * @param res return location for the resulting vector
		 */
		public add(_b: Vec3, res: Vec3): void;
		/**
		 * Computes the cross product of the two given vectors.
		 * @param _b a #graphene_vec3_t
		 * @param res return location for the resulting vector
		 */
		public cross(_b: Vec3, res: Vec3): void;
		/**
		 * Divides each component of the first operand #a by the corresponding
		 * component of the second operand #b, and places the results into the
		 * vector #res.
		 * @param _b a #graphene_vec3_t
		 * @param res return location for the resulting vector
		 */
		public divide(_b: Vec3, res: Vec3): void;
		/**
		 * Computes the dot product of the two given vectors.
		 * @param _b a #graphene_vec3_t
		 * @returns the value of the dot product
		 */
		public dot(_b: Vec3): number;
		/**
		 * Checks whether the two given #graphene_vec3_t are equal.
		 * @param v2 a #graphene_vec3_t
		 * @returns `true` if the two vectors are equal, and false otherwise
		 */
		public equal(v2: Vec3): boolean;
		/**
		 * Frees the resources allocated by #v
		 */
		public free(): void;
		/**
		 * Retrieves the first component of the given vector #v.
		 * @returns the value of the first component of the vector
		 */
		public get_x(): number;
		/**
		 * Creates a #graphene_vec2_t that contains the first and second
		 * components of the given #graphene_vec3_t.
		 * @param res return location for a #graphene_vec2_t
		 */
		public get_xy(res: Vec2): void;
		/**
		 * Creates a #graphene_vec3_t that contains the first two components of
		 * the given #graphene_vec3_t, and the third component set to 0.
		 * @param res return location for a #graphene_vec3_t
		 */
		public get_xy0(res: Vec3): void;
		/**
		 * Converts a #graphene_vec3_t in a #graphene_vec4_t using 0.0
		 * as the value for the fourth component of the resulting vector.
		 * @param res return location for the vector
		 */
		public get_xyz0(res: Vec4): void;
		/**
		 * Converts a #graphene_vec3_t in a #graphene_vec4_t using 1.0
		 * as the value for the fourth component of the resulting vector.
		 * @param res return location for the vector
		 */
		public get_xyz1(res: Vec4): void;
		/**
		 * Converts a #graphene_vec3_t in a #graphene_vec4_t using #w as
		 * the value of the fourth component of the resulting vector.
		 * @param _w the value of the W component
		 * @param res return location for the vector
		 */
		public get_xyzw(_w: number, res: Vec4): void;
		/**
		 * Retrieves the second component of the given vector #v.
		 * @returns the value of the second component of the vector
		 */
		public get_y(): number;
		/**
		 * Retrieves the third component of the given vector #v.
		 * @returns the value of the third component of the vector
		 */
		public get_z(): number;
		/**
		 * Initializes a #graphene_vec3_t using the given values.
		 * 
		 * This function can be called multiple times.
		 * @param _x the X field of the vector
		 * @param _y the Y field of the vector
		 * @param _z the Z field of the vector
		 * @returns a pointer to the initialized
		 *   vector
		 */
		public init(_x: number, _y: number, _z: number): Vec3;
		/**
		 * Initializes a #graphene_vec3_t with the values from an array.
		 * @param src an array of 3 floating point values
		 * @returns the initialized vector
		 */
		public init_from_float(src: number[]): Vec3;
		/**
		 * Initializes a #graphene_vec3_t with the values of another
		 * #graphene_vec3_t.
		 * @param src a #graphene_vec3_t
		 * @returns the initialized vector
		 */
		public init_from_vec3(src: Vec3): Vec3;
		/**
		 * Linearly interpolates #v1 and #v2 using the given #factor.
		 * @param v2 a #graphene_vec3_t
		 * @param factor the interpolation factor
		 * @param res the interpolated vector
		 */
		public interpolate(v2: Vec3, factor: number, res: Vec3): void;
		/**
		 * Retrieves the length of the given vector #v.
		 * @returns the value of the length of the vector
		 */
		public length(): number;
		/**
		 * Compares each component of the two given vectors and creates a
		 * vector that contains the maximum values.
		 * @param _b a #graphene_vec3_t
		 * @param res return location for the result vector
		 */
		public max(_b: Vec3, res: Vec3): void;
		/**
		 * Compares each component of the two given vectors and creates a
		 * vector that contains the minimum values.
		 * @param _b a #graphene_vec3_t
		 * @param res return location for the result vector
		 */
		public min(_b: Vec3, res: Vec3): void;
		/**
		 * Multiplies each component of the two given vectors.
		 * @param _b a #graphene_vec3_t
		 * @param res return location for the resulting vector
		 */
		public multiply(_b: Vec3, res: Vec3): void;
		/**
		 * Compares the two given #graphene_vec3_t vectors and checks
		 * whether their values are within the given #epsilon.
		 * @param v2 a #graphene_vec3_t
		 * @param epsilon the threshold between the two vectors
		 * @returns `true` if the two vectors are near each other
		 */
		public near(v2: Vec3, epsilon: number): boolean;
		/**
		 * Negates the given #graphene_vec3_t.
		 * @param res return location for the result vector
		 */
		public negate(res: Vec3): void;
		/**
		 * Normalizes the given #graphene_vec3_t.
		 * @param res return location for the normalized vector
		 */
		public normalize(res: Vec3): void;
		/**
		 * Multiplies all components of the given vector with the given scalar #factor.
		 * @param factor the scalar factor
		 * @param res return location for the result vector
		 */
		public scale(factor: number, res: Vec3): void;
		/**
		 * Subtracts from each component of the first operand #a the
		 * corresponding component of the second operand #b and places
		 * each result into the components of #res.
		 * @param _b a #graphene_vec3_t
		 * @param res return location for the resulting vector
		 */
		public subtract(_b: Vec3, res: Vec3): void;
		/**
		 * Copies the components of a #graphene_vec3_t into the given array.
		 * @param dest return location for
		 *   an array of floating point values
		 */
		public to_float(dest: number[]): void;
	}

	/**
	 * A structure capable of holding a vector with four dimensions: x, y, z, and w.
	 * 
	 * The contents of the #graphene_vec4_t structure are private and should
	 * never be accessed directly.
	 */
	interface Vec4 {}
	class Vec4 {
		public constructor();
		/**
		 * Allocates a new #graphene_vec4_t structure.
		 * 
		 * The contents of the returned structure are undefined.
		 * 
		 * Use graphene_vec4_init() to initialize the vector.
		 * @returns the newly allocated #graphene_vec4_t
		 *   structure. Use graphene_vec4_free() to free the resources allocated
		 *   by this function.
		 */
		public static alloc(): Vec4;
		public readonly value: Simd4F;
		/**
		 * Adds each component of the two given vectors.
		 * @param _b a #graphene_vec4_t
		 * @param res return location for the resulting vector
		 */
		public add(_b: Vec4, res: Vec4): void;
		/**
		 * Divides each component of the first operand #a by the corresponding
		 * component of the second operand #b, and places the results into the
		 * vector #res.
		 * @param _b a #graphene_vec4_t
		 * @param res return location for the resulting vector
		 */
		public divide(_b: Vec4, res: Vec4): void;
		/**
		 * Computes the dot product of the two given vectors.
		 * @param _b a #graphene_vec4_t
		 * @returns the value of the dot product
		 */
		public dot(_b: Vec4): number;
		/**
		 * Checks whether the two given #graphene_vec4_t are equal.
		 * @param v2 a #graphene_vec4_t
		 * @returns `true` if the two vectors are equal, and false otherwise
		 */
		public equal(v2: Vec4): boolean;
		/**
		 * Frees the resources allocated by #v
		 */
		public free(): void;
		/**
		 * Retrieves the value of the fourth component of the given #graphene_vec4_t.
		 * @returns the value of the fourth component
		 */
		public get_w(): number;
		/**
		 * Retrieves the value of the first component of the given #graphene_vec4_t.
		 * @returns the value of the first component
		 */
		public get_x(): number;
		/**
		 * Creates a #graphene_vec2_t that contains the first two components
		 * of the given #graphene_vec4_t.
		 * @param res return location for a #graphene_vec2_t
		 */
		public get_xy(res: Vec2): void;
		/**
		 * Creates a #graphene_vec3_t that contains the first three components
		 * of the given #graphene_vec4_t.
		 * @param res return location for a graphene_vec3_t
		 */
		public get_xyz(res: Vec3): void;
		/**
		 * Retrieves the value of the second component of the given #graphene_vec4_t.
		 * @returns the value of the second component
		 */
		public get_y(): number;
		/**
		 * Retrieves the value of the third component of the given #graphene_vec4_t.
		 * @returns the value of the third component
		 */
		public get_z(): number;
		/**
		 * Initializes a #graphene_vec4_t using the given values.
		 * 
		 * This function can be called multiple times.
		 * @param _x the X field of the vector
		 * @param _y the Y field of the vector
		 * @param _z the Z field of the vector
		 * @param _w the W field of the vector
		 * @returns a pointer to the initialized
		 *   vector
		 */
		public init(_x: number, _y: number, _z: number, _w: number): Vec4;
		/**
		 * Initializes a #graphene_vec4_t with the values inside the given array.
		 * @param src an array of four floating point values
		 * @returns the initialized vector
		 */
		public init_from_float(src: number[]): Vec4;
		/**
		 * Initializes a #graphene_vec4_t using the components of a
		 * #graphene_vec2_t and the values of #z and #w.
		 * @param src a #graphene_vec2_t
		 * @param _z the value for the third component of #v
		 * @param _w the value for the fourth component of #v
		 * @returns the initialized vector
		 */
		public init_from_vec2(src: Vec2, _z: number, _w: number): Vec4;
		/**
		 * Initializes a #graphene_vec4_t using the components of a
		 * #graphene_vec3_t and the value of #w.
		 * @param src a #graphene_vec3_t
		 * @param _w the value for the fourth component of #v
		 * @returns the initialized vector
		 */
		public init_from_vec3(src: Vec3, _w: number): Vec4;
		/**
		 * Initializes a #graphene_vec4_t using the components of
		 * another #graphene_vec4_t.
		 * @param src a #graphene_vec4_t
		 * @returns the initialized vector
		 */
		public init_from_vec4(src: Vec4): Vec4;
		/**
		 * Linearly interpolates #v1 and #v2 using the given #factor.
		 * @param v2 a #graphene_vec4_t
		 * @param factor the interpolation factor
		 * @param res the interpolated vector
		 */
		public interpolate(v2: Vec4, factor: number, res: Vec4): void;
		/**
		 * Computes the length of the given #graphene_vec4_t.
		 * @returns the length of the vector
		 */
		public length(): number;
		/**
		 * Compares each component of the two given vectors and creates a
		 * vector that contains the maximum values.
		 * @param _b a #graphene_vec4_t
		 * @param res return location for the result vector
		 */
		public max(_b: Vec4, res: Vec4): void;
		/**
		 * Compares each component of the two given vectors and creates a
		 * vector that contains the minimum values.
		 * @param _b a #graphene_vec4_t
		 * @param res return location for the result vector
		 */
		public min(_b: Vec4, res: Vec4): void;
		/**
		 * Multiplies each component of the two given vectors.
		 * @param _b a #graphene_vec4_t
		 * @param res return location for the resulting vector
		 */
		public multiply(_b: Vec4, res: Vec4): void;
		/**
		 * Compares the two given #graphene_vec4_t vectors and checks
		 * whether their values are within the given #epsilon.
		 * @param v2 a #graphene_vec4_t
		 * @param epsilon the threshold between the two vectors
		 * @returns `true` if the two vectors are near each other
		 */
		public near(v2: Vec4, epsilon: number): boolean;
		/**
		 * Negates the given #graphene_vec4_t.
		 * @param res return location for the result vector
		 */
		public negate(res: Vec4): void;
		/**
		 * Normalizes the given #graphene_vec4_t.
		 * @param res return location for the normalized
		 *   vector
		 */
		public normalize(res: Vec4): void;
		/**
		 * Multiplies all components of the given vector with the given scalar #factor.
		 * @param factor the scalar factor
		 * @param res return location for the result vector
		 */
		public scale(factor: number, res: Vec4): void;
		/**
		 * Subtracts from each component of the first operand #a the
		 * corresponding component of the second operand #b and places
		 * each result into the components of #res.
		 * @param _b a #graphene_vec4_t
		 * @param res return location for the resulting vector
		 */
		public subtract(_b: Vec4, res: Vec4): void;
		/**
		 * Stores the components of the given #graphene_vec4_t into an array
		 * of floating point values.
		 * @param dest return location for
		 *   an array of floating point values
		 */
		public to_float(dest: number[]): void;
	}

	/**
	 * Specify the order of the rotations on each axis.
	 * 
	 * The %GRAPHENE_EULER_ORDER_DEFAULT value is special, and is used
	 * as an alias for one of the other orders.
	 */
	enum EulerOrder {
		/**
		 * Rotate in the default order; the
		 *   default order is one of the following enumeration values
		 */
		DEFAULT = -1,
		/**
		 * Rotate in the X, Y, and Z order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SXYZ
		 */
		XYZ = 0,
		/**
		 * Rotate in the Y, Z, and X order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SYZX
		 */
		YZX = 1,
		/**
		 * Rotate in the Z, X, and Y order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SZXY
		 */
		ZXY = 2,
		/**
		 * Rotate in the X, Z, and Y order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SXZY
		 */
		XZY = 3,
		/**
		 * Rotate in the Y, X, and Z order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SYXZ
		 */
		YXZ = 4,
		/**
		 * Rotate in the Z, Y, and X order. Deprecated in
		 *   Graphene 1.10, it's an alias for %GRAPHENE_EULER_ORDER_SZYX
		 */
		ZYX = 5,
		/**
		 * Defines a static rotation along the X, Y, and Z axes (Since: 1.10)
		 */
		SXYZ = 6,
		/**
		 * Defines a static rotation along the X, Y, and X axes (Since: 1.10)
		 */
		SXYX = 7,
		/**
		 * Defines a static rotation along the X, Z, and Y axes (Since: 1.10)
		 */
		SXZY = 8,
		/**
		 * Defines a static rotation along the X, Z, and X axes (Since: 1.10)
		 */
		SXZX = 9,
		/**
		 * Defines a static rotation along the Y, Z, and X axes (Since: 1.10)
		 */
		SYZX = 10,
		/**
		 * Defines a static rotation along the Y, Z, and Y axes (Since: 1.10)
		 */
		SYZY = 11,
		/**
		 * Defines a static rotation along the Y, X, and Z axes (Since: 1.10)
		 */
		SYXZ = 12,
		/**
		 * Defines a static rotation along the Y, X, and Y axes (Since: 1.10)
		 */
		SYXY = 13,
		/**
		 * Defines a static rotation along the Z, X, and Y axes (Since: 1.10)
		 */
		SZXY = 14,
		/**
		 * Defines a static rotation along the Z, X, and Z axes (Since: 1.10)
		 */
		SZXZ = 15,
		/**
		 * Defines a static rotation along the Z, Y, and X axes (Since: 1.10)
		 */
		SZYX = 16,
		/**
		 * Defines a static rotation along the Z, Y, and Z axes (Since: 1.10)
		 */
		SZYZ = 17,
		/**
		 * Defines a relative rotation along the Z, Y, and X axes (Since: 1.10)
		 */
		RZYX = 18,
		/**
		 * Defines a relative rotation along the X, Y, and X axes (Since: 1.10)
		 */
		RXYX = 19,
		/**
		 * Defines a relative rotation along the Y, Z, and X axes (Since: 1.10)
		 */
		RYZX = 20,
		/**
		 * Defines a relative rotation along the X, Z, and X axes (Since: 1.10)
		 */
		RXZX = 21,
		/**
		 * Defines a relative rotation along the X, Z, and Y axes (Since: 1.10)
		 */
		RXZY = 22,
		/**
		 * Defines a relative rotation along the Y, Z, and Y axes (Since: 1.10)
		 */
		RYZY = 23,
		/**
		 * Defines a relative rotation along the Z, X, and Y axes (Since: 1.10)
		 */
		RZXY = 24,
		/**
		 * Defines a relative rotation along the Y, X, and Y axes (Since: 1.10)
		 */
		RYXY = 25,
		/**
		 * Defines a relative rotation along the Y, X, and Z axes (Since: 1.10)
		 */
		RYXZ = 26,
		/**
		 * Defines a relative rotation along the Z, X, and Z axes (Since: 1.10)
		 */
		RZXZ = 27,
		/**
		 * Defines a relative rotation along the X, Y, and Z axes (Since: 1.10)
		 */
		RXYZ = 28,
		/**
		 * Defines a relative rotation along the Z, Y, and Z axes (Since: 1.10)
		 */
		RZYZ = 29
	}

	/**
	 * The type of intersection.
	 */
	enum RayIntersectionKind {
		/**
		 * No intersection
		 */
		NONE = 0,
		/**
		 * The ray is entering the intersected
		 *   object
		 */
		ENTER = 1,
		/**
		 * The ray is leaving the intersected
		 *   object
		 */
		LEAVE = 2
	}

	/**
	 * A degenerate #graphene_box_t that can only be expanded.
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_empty(): Box;

	/**
	 * A degenerate #graphene_box_t that cannot be expanded.
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_infinite(): Box;

	/**
	 * A #graphene_box_t with the minimum vertex set at (-1, -1, -1) and the
	 * maximum vertex set at (0, 0, 0).
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_minus_one(): Box;

	/**
	 * A #graphene_box_t with the minimum vertex set at (0, 0, 0) and the
	 * maximum vertex set at (1, 1, 1).
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_one(): Box;

	/**
	 * A #graphene_box_t with the minimum vertex set at (-1, -1, -1) and the
	 * maximum vertex set at (1, 1, 1).
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_one_minus_one(): Box;

	/**
	 * A #graphene_box_t with both the minimum and maximum vertices set at (0, 0, 0).
	 * 
	 * The returned value is owned by Graphene and should not be modified or freed.
	 * @returns a #graphene_box_t
	 */
	function box_zero(): Box;

	/**
	 * Retrieves a constant point with all three coordinates set to 0.
	 * @returns a zero point
	 */
	function point3d_zero(): Point3D;

	/**
	 * Returns a point fixed at (0, 0).
	 * @returns a fixed point
	 */
	function point_zero(): Point;

	/**
	 * Allocates a new #graphene_rect_t.
	 * 
	 * The contents of the returned rectangle are undefined.
	 * @returns the newly allocated rectangle
	 */
	function rect_alloc(): Rect;

	/**
	 * Returns a degenerate rectangle with origin fixed at (0, 0) and
	 * a size of 0, 0.
	 * @returns a fixed rectangle
	 */
	function rect_zero(): Rect;

	/**
	 * A constant pointer to a zero #graphene_size_t, useful for
	 * equality checks and interpolations.
	 * @returns a constant size
	 */
	function size_zero(): Size;

	/**
	 * Retrieves a constant vector with (1, 1) components.
	 * @returns the one vector
	 */
	function vec2_one(): Vec2;

	/**
	 * Retrieves a constant vector with (1, 0) components.
	 * @returns the X axis vector
	 */
	function vec2_x_axis(): Vec2;

	/**
	 * Retrieves a constant vector with (0, 1) components.
	 * @returns the Y axis vector
	 */
	function vec2_y_axis(): Vec2;

	/**
	 * Retrieves a constant vector with (0, 0) components.
	 * @returns the zero vector
	 */
	function vec2_zero(): Vec2;

	/**
	 * Provides a constant pointer to a vector with three components,
	 * all sets to 1.
	 * @returns a constant vector
	 */
	function vec3_one(): Vec3;

	/**
	 * Provides a constant pointer to a vector with three components
	 * with values set to (1, 0, 0).
	 * @returns a constant vector
	 */
	function vec3_x_axis(): Vec3;

	/**
	 * Provides a constant pointer to a vector with three components
	 * with values set to (0, 1, 0).
	 * @returns a constant vector
	 */
	function vec3_y_axis(): Vec3;

	/**
	 * Provides a constant pointer to a vector with three components
	 * with values set to (0, 0, 1).
	 * @returns a constant vector
	 */
	function vec3_z_axis(): Vec3;

	/**
	 * Provides a constant pointer to a vector with three components,
	 * all sets to 0.
	 * @returns a constant vector
	 */
	function vec3_zero(): Vec3;

	/**
	 * Retrieves a pointer to a #graphene_vec4_t with all its
	 * components set to 1.
	 * @returns a constant vector
	 */
	function vec4_one(): Vec4;

	/**
	 * Retrieves a pointer to a #graphene_vec4_t with its
	 * components set to (0, 0, 0, 1).
	 * @returns a constant vector
	 */
	function vec4_w_axis(): Vec4;

	/**
	 * Retrieves a pointer to a #graphene_vec4_t with its
	 * components set to (1, 0, 0, 0).
	 * @returns a constant vector
	 */
	function vec4_x_axis(): Vec4;

	/**
	 * Retrieves a pointer to a #graphene_vec4_t with its
	 * components set to (0, 1, 0, 0).
	 * @returns a constant vector
	 */
	function vec4_y_axis(): Vec4;

	/**
	 * Retrieves a pointer to a #graphene_vec4_t with its
	 * components set to (0, 0, 1, 0).
	 * @returns a constant vector
	 */
	function vec4_z_axis(): Vec4;

	/**
	 * Retrieves a pointer to a #graphene_vec4_t with all its
	 * components set to 0.
	 * @returns a constant vector
	 */
	function vec4_zero(): Vec4;

}