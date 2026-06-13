"""
WMM - Monitor Manager (núcleo agnóstico)
Proporciona funciones de cálculo geométrico independientes del SO.
"""
import math

def calculate_inches(width_mm, height_mm):
    """Calcula la diagonal en pulgadas a partir de las dimensiones en mm."""
    if width_mm > 0 and height_mm > 0:
        diag_mm = (width_mm ** 2 + height_mm ** 2) ** 0.5
        return int(round(diag_mm / 25.4))
    return 0

def scale_monitors_to_area(monitors_map, area_w, area_h, margin=10):
    """
    Escala los monitores para caber en el área dada, manteniendo la proporción.
    Retorna un diccionario {hash: {x, y, w, h}} con las coordenadas escaladas.
    """
    if not monitors_map:
        return {}

    min_x = min_y = float('inf')
    max_x = max_y = 0
    for m_data in monitors_map.values():
        x, y, w, h = m_data['x'], m_data['y'], m_data['width'], m_data['height']
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x + w)
        max_y = max(max_y, y + h)

    bb_width = max_x - min_x
    bb_height = max_y - min_y
    if bb_width <= 0 or bb_height <= 0:
        return {}

    available_w = area_w - margin * 2
    available_h = area_h - margin * 2 if area_h > 0 else bb_height
    scale = min(available_w / bb_width, available_h / bb_height)

    scaled_monitors = {}
    for m_hash, m_data in monitors_map.items():
        rel_x = m_data['x'] - min_x
        rel_y = m_data['y'] - min_y
        scaled_monitors[m_hash] = {
            'x': int(rel_x * scale) + margin,
            'y': int(rel_y * scale) + margin,
            'w': int(m_data['width'] * scale),
            'h': int(m_data['height'] * scale)
        }
    return scaled_monitors

def get_total_canvas_geometry(monitors_map):
    """
    Calcula el tamaño del lienzo basándose en el punto más lejano
    al que llega cualquier monitor (Borde derecho y Borde inferior).
    """
    if not monitors_map:
        return 0, 0

    max_x_edge = 0
    max_y_edge = 0
    for m in monitors_map.values():
        current_right = m['x'] + m['width']
        current_bottom = m['y'] + m['height']
        if current_right > max_x_edge:
            max_x_edge = current_right
        if current_bottom > max_y_edge:
            max_y_edge = current_bottom
    return max_x_edge, max_y_edge
