
/**
 *
 * @param point
 * @param vs
 * @returns
 */
export function PointInsidePolygon(point: [lon: number, lat: number], vs: [lon: number, lat: number][]): boolean {
    const maxX = Math.max(...vs.map(v => v[0]));
	const minX = Math.min(...vs.map(v => v[0]));
	const maxY = Math.max(...vs.map(v => v[1]));
	const minY = Math.min(...vs.map(v => v[1]));

	if (point[0] < minX || point[0] > maxX || point[1] < minY || point[1] > maxY) {
		return false;
	}

	let intersections = 0;
	const padding = 0.1;
	const pv1 = [(minX - padding/point[0]), (minY - padding/point[1])];
	const pv2 = point;
	for (let i = 0; i < vs.length - 1; i++) {
		const v1 = vs[i];
		const v2 = vs[i + 1];
		// Test if current side intersects with ray.
		if (areIntersecting(v1[0], v1[1], v2[0], v2[1], pv1[0], pv1[1], pv2[0], pv2[1]))
			intersections++;

		// If yes, intersections++;
	}
	if ((intersections & 1) == 1) {
		return true;
	} else {
		// Outside of polygon
		return false;
	}
}

function areIntersecting(
		v1x1: number, v1y1: number, v1x2: number, v1y2: number,
		v2x1: number, v2y1: number, v2x2: number, v2y2: number
	) {
		let d1: number, d2: number;

		// Convert vector 1 to a line (line 1) of infinite length.
		// We want the line in linear equation standard form: A*x + B*y + C = 0
		// See: http://en.wikipedia.org/wiki/Linear_equation
		const a1 = v1y2 - v1y1;
		const b1 = v1x1 - v1x2;
		const c1 = (v1x2 * v1y1) - (v1x1 * v1y2);

		// Every point (x,y), that solves the equation above, is on the line,
		// every point that does not solve it, is not. The equation will have a
		// positive result if it is on one side of the line and a negative one
		// if is on the other side of it. We insert (x1,y1) and (x2,y2) of vector
		// 2 into the equation above.
		d1 = (a1 * v2x1) + (b1 * v2y1) + c1;
		d2 = (a1 * v2x2) + (b1 * v2y2) + c1;

		// If d1 and d2 both have the same sign, they are both on the same side
		// of our line 1 and in that case no intersection is possible. Careful,
		// 0 is a special case, that's why we don't test ">=" and "<=",
		// but "<" and ">".
		if (d1 > 0 && d2 > 0) return false;
		if (d1 < 0 && d2 < 0) return false;

		// The fact that vector 2 intersected the infinite line 1 above doesn't
		// mean it also intersects the vector 1. Vector 1 is only a subset of that
		// infinite line 1, so it may have intersected that line before the vector
		// started or after it ended. To know for sure, we have to repeat the
		// the same test the other way round. We start by calculating the
		// infinite line 2 in linear equation standard form.
		const a2 = v2y2 - v2y1;
		const b2 = v2x1 - v2x2;
		const c2 = (v2x2 * v2y1) - (v2x1 * v2y2);

		// Calculate d1 and d2 again, this time using points of vector 1.
		d1 = (a2 * v1x1) + (b2 * v1y1) + c2;
		d2 = (a2 * v1x2) + (b2 * v1y2) + c2;

		// Again, if both have the same sign (and neither one is 0),
		// no intersection is possible.
		if (d1 > 0 && d2 > 0) return false;
		if (d1 < 0 && d2 < 0) return false;

		// If we get here, only two possibilities are left. Either the two
		// vectors intersect in exactly one point or they are collinear, which
		// means they intersect in any number of points from zero to infinite.
		if ((a1 * b2) - (a2 * b1) == 0.0) return false;

		// If they are not collinear, they must intersect in exactly one point.
		return true;

}