import math

class Annotation:
    def __init__(self, type, start, end, color=(1,0,0), width=2, text=""):
        self.type = type # 'rect', 'arrow', 'text', 'ellipse'
        self.start = start # (x, y)
        self.end = end # (x, y)
        self.color = color
        self.width = width
        self.text = text
        self.rect = self._get_rect(start, end)
        self.angle = 0 # Rotation angle in radians

    def _get_rect(self, start, end):
        x = min(start[0], end[0])
        y = min(start[1], end[1])
        w = abs(start[0] - end[0])
        h = abs(start[1] - end[1])
        return [x, y, w, h]
