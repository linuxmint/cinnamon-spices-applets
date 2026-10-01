class Annotation:
    """Holds position, style, and type data for a single drawn shape or text label."""

    __slots__ = ('type', 'start', 'end', 'color', 'width', 'text', 'angle',
                 'points', 'sx', 'sy', '_cached_layout', '_layout_cache_key')

    def __init__(self, kind, start, end, color=(1, 0, 0), width=2, text=""):
        self.type = kind    # 'rect', 'arrow', 'text', 'ellipse', 'draw', 'highlight'
        self.start = start  # (x, y) origin
        self.end = end      # (x, y) opposite corner / endpoint
        self.color = color
        self.width = width
        self.text = text
        self.angle = 0      # rotation in radians
        self.points = []    # freehand path points for 'draw' type
        self.sx = 1.0       # user-applied horizontal scale
        self.sy = 1.0       # user-applied vertical scale
        self._cached_layout = None   # cached Pango layout for text annotations
        self._layout_cache_key = None  # (text, width) key to invalidate cache
