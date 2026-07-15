"""Optional bounded in-memory SVG generation for short-lived pairing payloads."""

from __future__ import annotations


_MAX_INPUT_LENGTH = 4096
_MAX_MODULES = 177
_MAX_SVG_BYTES = 256 * 1024
_QUIET_ZONE = 4


def _default_qr():
    import qrcode

    return qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=1,
        border=0,
    )


def encode_qr_svg(value, *, qr_factory=None):
    """Return a compact QR SVG or ``None`` when safe rendering is unavailable."""

    if not isinstance(value, str) or not value or len(value) > _MAX_INPUT_LENGTH:
        return None
    factory = qr_factory or _default_qr
    try:
        qr = factory()
        qr.add_data(value)
        qr.make(fit=True)
        matrix = qr.get_matrix()
    except (ImportError, OSError, RuntimeError, TypeError, ValueError):
        return None
    if not isinstance(matrix, list) or not 1 <= len(matrix) <= _MAX_MODULES:
        return None
    size = len(matrix)
    if any(not isinstance(row, list) or len(row) != size for row in matrix):
        return None

    commands = []
    for y, row in enumerate(matrix):
        x = 0
        while x < size:
            if not bool(row[x]):
                x += 1
                continue
            start = x
            while x < size and bool(row[x]):
                x += 1
            length = x - start
            commands.append(
                f"M{start + _QUIET_ZONE} {y + _QUIET_ZONE}"
                f"h{length}v1h-{length}z"
            )

    canvas = size + 2 * _QUIET_ZONE
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {canvas} {canvas}" shape-rendering="crispEdges">'
        f'<rect width="{canvas}" height="{canvas}" fill="#fff"/>'
        f'<path d="{"".join(commands)}" fill="#000"/>'
        "</svg>"
    )
    if len(svg.encode("utf-8")) > _MAX_SVG_BYTES:
        return None
    return svg
