#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM
----------------------------
image_engine.py – Motor gráfico para la generación del lienzo maestro.

Renderiza el fondo de pantalla componiendo las imágenes seleccionadas
sobre un lienzo único, aplicando modos de aspecto, efectos visuales
y fondos de relleno.
"""

# ==========================================================
# IMPORTS DE LIBRERÍA ESTÁNDAR
# ==========================================================
import os
import io
import math
import hashlib

# ==========================================================
# IMPORTS DE TERCEROS
# ==========================================================
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageOps

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GdkPixbuf

# ==========================================================
# IMPORTS DE MÓDULOS DEL PROYECTO
# ==========================================================
from debug_logger import log_event


class ImageEngine:
    def __init__(self, config_handler, monitor_manager):
        """
        Motor gráfico para la generación del lienzo maestro.
        """
        self.ch = config_handler
        self.mm = monitor_manager
        self.master_path = self.ch.master_canvas

    @staticmethod
    def _create_color_surface(width, height, color_mode, solid_color, gradient_h, gradient_v):
        """
        Crea una superficie PIL del tamaño indicado según el modo de color.
        color_mode: 'solid_color', 'gradient_h' o 'gradient_v'
        solid_color: string hex (ej. '#000000')
        gradient_h, gradient_v: listas de dos strings hex (ej. ['#000000', '#FFFFFF'])
        """
        surface = Image.new('RGB', (width, height))
        draw = ImageDraw.Draw(surface)

        if color_mode == 'solid_color' or color_mode == 'solid':
            draw.rectangle([(0, 0), (width, height)], fill=solid_color)

        elif color_mode in ('gradient_h', 'gradient_v', 'gradient_horizontal', 'gradient_vertical'):
            start_hex = gradient_h[0] if 'h' in color_mode else gradient_v[0]
            end_hex = gradient_h[1] if 'h' in color_mode else gradient_v[1]
            start_rgb = ImageEngine._hex_to_rgb(start_hex)
            end_rgb = ImageEngine._hex_to_rgb(end_hex)

            if 'h' in color_mode:
                # Degradado horizontal suave: dibujar en 1px de alto y escalar
                gradient_surface = Image.new('RGB', (width, 1))
                draw_grad = ImageDraw.Draw(gradient_surface)
                for x in range(width):
                    ratio = x / width
                    r = int(start_rgb[0] + (end_rgb[0] - start_rgb[0]) * ratio)
                    g = int(start_rgb[1] + (end_rgb[1] - start_rgb[1]) * ratio)
                    b = int(start_rgb[2] + (end_rgb[2] - start_rgb[2]) * ratio)
                    draw_grad.point((x, 0), fill=(r, g, b))
                del draw_grad
                surface = gradient_surface.resize((width, height), Image.Resampling.BILINEAR)

            else:  # vertical
                gradient_surface = Image.new('RGB', (1, height))
                draw_grad = ImageDraw.Draw(gradient_surface)
                for y in range(height):
                    ratio = y / height
                    r = int(start_rgb[0] + (end_rgb[0] - start_rgb[0]) * ratio)
                    g = int(start_rgb[1] + (end_rgb[1] - start_rgb[1]) * ratio)
                    b = int(start_rgb[2] + (end_rgb[2] - start_rgb[2]) * ratio)
                    draw_grad.point((0, y), fill=(r, g, b))
                del draw_grad
                surface = gradient_surface.resize((width, height), Image.Resampling.BILINEAR)

        del draw
        return surface

    @staticmethod
    def _hex_to_rgb(hex_str):
        """Convierte un color hexadecimal (#RRGGBB) a tupla RGB."""
        hex_str = hex_str.lstrip('#')
        return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

    @staticmethod
    def _open_image_safe(path):
        """Abre una imagen corrigiendo el modo P con transparencia para evitar warnings de Pillow."""
        img = Image.open(path)
        if img.mode == 'P' and 'transparency' in img.info:
            img = img.convert('RGBA')
        return img

    def render_master_wallpaper(self, selection, full_canvas=False, solid_color="#000000", color_mode="solid_color", gradient_h=None, gradient_v=None, wallpaper_effect_scope="blur", wallpaper_mode="fit", image_effect="none"):
        """
        Genera el lienzo maestro (master_canvas.jpg) pegando cada selección en su coordenada.
        Si full_canvas=True, ignora geometrías y pinta una única imagen en todo el lienzo.
        Si una entrada de selección es una tupla ("color", ...), pinta el color indicado.
        """
        if gradient_h is None:
            gradient_h = ["#000000", "#8D9797"]
        if gradient_v is None:
            gradient_v = ["#000000", "#8D9797"]
        geo = self.ch.load_json("geometry")
        if not geo:
            log_event("No existe mapa de geometría. Abortando renderizado.", origin="IMG_ENG", level="ERROR", reason="LIBRARY")
            return None

        canvas_size = (geo["canvas"]["w"], geo["canvas"]["h"])
        monitors_map = geo["monitors"]

        master_canvas = Image.new('RGB', canvas_size, (0, 0, 0))
        log_event(f"Generando lienzo maestro de {canvas_size[0]}x{canvas_size[1]}", origin="IMG_ENG", level="INFO", reason="LIBRARY")

        if full_canvas:
            if not selection:
                return None
            # Obtener la ruta de la imagen maestra (la primera del diccionario)
            img_path = list(selection.values())[0]
            if isinstance(img_path, tuple) and img_path[0] == "color":
                # Si es color, generar un lienzo de color y devolverlo
                _, cm, sc, gh, gv = img_path
                processed = ImageEngine._create_color_surface(
                    canvas_size[0], canvas_size[1], cm, sc, gh, gv
                )
                output_path = os.path.join(self.ch.cache_dir, "wallpaper_master.jpg")
                processed.save(output_path, "JPEG", quality=95)
                return output_path
            else:
                # Procesar la imagen maestra según el modo real sobre el canvas completo
                with ImageEngine._open_image_safe(img_path) as img_obj:
                    if wallpaper_mode == "fit":
                        processed_img = ImageEngine.apply_fit(
                            img_obj, canvas_size[0], canvas_size[1],
                            wallpaper_effect_scope=wallpaper_effect_scope,
                            solid_color=solid_color,
                            gradient_h=gradient_h, gradient_v=gradient_v,
                            color_mode=color_mode,
                            image_effect=image_effect
                        )
                    elif wallpaper_mode == "zoom":
                        processed_img = ImageEngine.apply_zoom(
                            img_obj, canvas_size[0], canvas_size[1],
                            image_effect=image_effect
                        )
                    elif wallpaper_mode == "stretched":
                        processed_img = ImageEngine.apply_stretched(
                            img_obj, canvas_size[0], canvas_size[1],
                            image_effect=image_effect
                        )
                    else:
                        # Fallback a fit
                        processed_img = ImageEngine.apply_fit(
                            img_obj, canvas_size[0], canvas_size[1],
                            wallpaper_effect_scope=wallpaper_effect_scope,
                            solid_color=solid_color,
                            gradient_h=gradient_h, gradient_v=gradient_v,
                            color_mode=color_mode,
                            image_effect=image_effect
                        )
                # Pegar la imagen procesada en el canvas maestro
                master_canvas.paste(processed_img, (0, 0))
                output_path = os.path.join(self.ch.cache_dir, "wallpaper_master.jpg")
                master_canvas.save(output_path, "JPEG", quality=95)
                return output_path
        else:
            for m_hash, img_path in selection.items():
                if m_hash not in monitors_map:
                    continue
                m_geo = monitors_map[m_hash]
                x, y = m_geo['x'], m_geo['y']
                w, h = m_geo['width'], m_geo['height']

                if isinstance(img_path, tuple) and img_path[0] == "color":
                    # Pintar color o degradado en este monitor
                    _, color_mode, solid_color, gradient_h, gradient_v = img_path
                    processed_img = ImageEngine._create_color_surface(
                        w, h, color_mode, solid_color, gradient_h, gradient_v
                    )
                else:
                    # Imagen normal: elegir el método según el modo real
                    with ImageEngine._open_image_safe(img_path) as img_obj:
                        if wallpaper_mode == "fit":
                            processed_img = ImageEngine.apply_fit(
                                img_obj, w, h,
                                wallpaper_effect_scope=wallpaper_effect_scope,
                                solid_color=solid_color,
                                gradient_h=gradient_h, gradient_v=gradient_v,
                                color_mode=color_mode,
                                image_effect=image_effect
                            )
                        elif wallpaper_mode == "zoom":
                            processed_img = ImageEngine.apply_zoom(img_obj, w, h, image_effect=image_effect)
                        elif wallpaper_mode == "stretched":
                            processed_img = ImageEngine.apply_stretched(img_obj, w, h, image_effect=image_effect)
                        else:
                            # Fallback a fit
                            processed_img = ImageEngine.apply_fit(
                                img_obj, w, h,
                                wallpaper_effect_scope=wallpaper_effect_scope,
                                solid_color=solid_color,
                                gradient_h=gradient_h, gradient_v=gradient_v,
                                color_mode=color_mode,
                                image_effect=image_effect
                            )

                master_canvas.paste(processed_img, (x, y))

        output_path = os.path.join(self.ch.cache_dir, "wallpaper_master.jpg")
        master_canvas.save(output_path, "JPEG", quality=95)
        log_event(f"Lienzo maestro guardado en {output_path}", origin="IMG_ENG", level="DEBUG", reason="LIBRARY")
        return output_path

    # --- NUEVOS MÉTODOS ESTÁTICOS DE PROCESAMIENTO DE IMÁGENES ---

    @staticmethod
    def process_image(path):
        """
        Abre la imagen para extraer su orientación y dimensiones reales.
        Retorna (orient, w, h) o (None, 0, 0) si falla.
        """
        try:
            with Image.open(path) as img:
                img.verify()
            with ImageEngine._open_image_safe(path) as img:
                w, h = img.size
                orientation = "h" if w >= h else "v"
                return orientation, w, h
        except Exception as e:
            ext = os.path.splitext(path)[1].lower()
            if ext in ('.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'):
                log_event(f"Error físico/corrupción en: {os.path.basename(path)} -> {e}", origin="IMG_ENG", level="ERROR", reason="LIBRARY")
            return None, 0, 0

    @staticmethod
    def generate_thumbnail(img_path, max_height=160, max_width=250, thumb_dir=None):
        """
        Genera una miniatura proporcional de la imagen en formato JPEG.

        Args:
            img_path (str): Ruta absoluta de la imagen original.
            max_height (int): Altura máxima de la miniatura.
            max_width (int): Anchura máxima de la miniatura.
            thumb_dir (str): Directorio donde se almacenará la miniatura.
                             Debe ser proporcionado por el llamante.

        Returns:
            str: Ruta de la miniatura generada, o cadena vacía si falla.
        """
        if thumb_dir is None:
            raise ValueError("thumb_dir es obligatorio para generar miniaturas.")

        os.makedirs(thumb_dir, exist_ok=True)

        m = hashlib.md5(img_path.encode()).hexdigest()
        thumb_path = os.path.join(thumb_dir, f"{m}.jpg")
        if not os.path.exists(thumb_path):
            try:
                with ImageEngine._open_image_safe(img_path) as img:
                    if img.mode == 'P':
                        img = img.convert('RGB')
                    elif img.mode == 'RGBA':
                        canvas = Image.new("RGB", img.size, (0, 0, 0))
                        canvas.paste(img, mask=img.split()[3])
                        img = canvas
                    elif img.mode != 'RGB':
                        img = img.convert('RGB')

                    w, h = img.size
                    ratio = w / h
                    new_h = max_height
                    new_w = int(new_h * ratio)
                    if new_w > max_width:
                        new_w = max_width
                        new_h = int(new_w / ratio)
                    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    img.save(thumb_path, "JPEG", quality=85)
            except Exception as e:
                log_event(f"Error generando miniatura para {os.path.basename(img_path)}: {e}", origin="IMG_ENG", level="WARN", reason="LIBRARY")
                return ""
        return thumb_path

    @staticmethod
    def generate_composite_thumbnail(img_path, target_w, target_h, thumb_dir=None, wallpaper_effect_scope="blur", solid_color="#000000", gradient_h=None, gradient_v=None, color_mode="solid_color", image_effect="none"):
        """
        Genera una miniatura compuesta (blur de fondo + imagen centrada)
        para que ocupe exactamente target_w × target_h sin deformar la imagen real.
        Utiliza _render_image_with_blur para la composición.

        Args:
            img_path (str): Ruta absoluta de la imagen original.
            target_w (int): Anchura deseada de la miniatura compuesta.
            target_h (int): Altura deseada de la miniatura compuesta.
            thumb_dir (str): Directorio donde se almacenará la miniatura.
                             Debe ser proporcionado por el llamante.

        Returns:
            str or None: Ruta de la miniatura compuesta, o None si falla.
        """
        if thumb_dir is None:
            raise ValueError("thumb_dir es obligatorio para generar miniaturas compuestas.")

        if isinstance(img_path, tuple) and img_path[0] == "color":
            # miniatura de color o degradado
            _, color_mode, solid_color, gradient_h, gradient_v = img_path
            composite = ImageEngine._create_color_surface(
                target_w, target_h, color_mode, solid_color, gradient_h, gradient_v
            )
            # Guardar igual que una miniatura normal
            m = hashlib.md5(f"{color_mode}_{solid_color}_{gradient_h}_{gradient_v}_{target_w}x{target_h}_blur_color".encode()).hexdigest()
            blurred_path = os.path.join(thumb_dir, f"blur_{m}.png")
            composite.save(blurred_path, "PNG")
            return blurred_path

        os.makedirs(thumb_dir, exist_ok=True)

        m = hashlib.md5(f"{img_path}_{target_w}x{target_h}_{wallpaper_effect_scope}_{solid_color}_{gradient_h}_{gradient_v}_{color_mode}_blur".encode()).hexdigest()
        blurred_path = os.path.join(thumb_dir, f"blur_{m}.jpg")
        if os.path.exists(blurred_path):
            return blurred_path

        try:
            img = ImageEngine._open_image_safe(img_path).convert('RGB')
            composite = ImageEngine.apply_fit(
                img, target_w, target_h,
                wallpaper_effect_scope=wallpaper_effect_scope,
                solid_color=solid_color,
                gradient_h=gradient_h,
                gradient_v=gradient_v,
                color_mode=color_mode,
                image_effect=image_effect
            )
            composite.save(blurred_path, "JPEG", quality=85)
            return blurred_path
        except Exception as e:
            log_event(f"Error generando blurred thumbnail: {e}", origin="IMG_ENG", level="WARN", reason="LIBRARY")
            return None

    @staticmethod
    def _create_blur_background(img, target_w, target_h):
        """
        Genera una capa de fondo desenfocada a partir de la propia imagen.
        Se escala para cubrir completamente el área destino y se aplica un filtro gaussiano.
        Devuelve la imagen desenfocada y su posición de pegado (bg_x, bg_y).
        """
        img_w, img_h = img.size
        img_ratio = img_w / img_h
        target_ratio = target_w / target_h

        if img_ratio > target_ratio:
            bg_h = target_h
            bg_w = int(target_h * img_ratio)
        else:
            bg_w = target_w
            bg_h = int(target_w / img_ratio)

        bg_img = img.resize((bg_w, bg_h), Image.Resampling.NEAREST)
        bg_img = bg_img.filter(ImageFilter.GaussianBlur(radius=40))

        bg_x = (target_w - bg_w) // 2
        bg_y = (target_h - bg_h) // 2
        return bg_img, bg_x, bg_y

    # ==========================================================
    # MODOS DE ASPECTO (estáticos + distribuidor)
    # ==========================================================

    @staticmethod
    def apply_fit(img, target_w, target_h, wallpaper_effect_scope="blur", solid_color="#000000", gradient_h=None, gradient_v=None, color_mode="solid_color", image_effect="none"):
        """
        Ajusta la imagen para que quepa dentro del rectángulo destino manteniendo la proporción.
        Los huecos se rellenan según wallpaper_effect_scope: "blur" o "color".
        Si la imagen llena exactamente el contenedor, no se genera capa de fondo.
        """
        if img.mode != 'RGB':
            img = img.convert('RGB')
        # Aplicar efecto de imagen (sepia, bw) antes de redimensionar
        img = ImageEngine.apply_image_effect(img, image_effect)

        # Aplicar efecto de imagen (sepia, bw, none) a la imagen original
        img_effected = ImageEngine.apply_image_effect(img, image_effect)

        img_w, img_h = img_effected.size
        img_ratio = img_w / img_h
        target_ratio = target_w / target_h

        # Calcular dimensiones de la imagen nítida (manteniendo proporción)
        if img_ratio > target_ratio:
            new_w = target_w
            new_h = math.ceil(target_w / img_ratio)
        else:
            new_h = target_h
            new_w = math.ceil(target_h * img_ratio)

        # Limitar para que no exceda el contenedor
        new_w = min(new_w, target_w)
        new_h = min(new_h, target_h)

        # Determinar si hay huecos (la imagen no llena completamente)
        has_gaps = (new_w < target_w) or (new_h < target_h)

        container = Image.new('RGB', (target_w, target_h), (0, 0, 0))

        if has_gaps:
            # --- Pintar capa de fondo solo si hay huecos ---
            if wallpaper_effect_scope == "blur":
                bg_img, bg_x, bg_y = ImageEngine._create_blur_background(img_effected, target_w, target_h)
                container.paste(bg_img, (bg_x, bg_y))
            elif wallpaper_effect_scope == "color":
                if color_mode == "solid_color":
                    bg_surface = Image.new('RGB', (target_w, target_h), solid_color)
                elif color_mode in ("gradient_h", "gradient_v"):
                    bg_surface = ImageEngine._create_color_surface(
                        target_w, target_h, color_mode, solid_color,
                        gradient_h or ["#000000", "#8D9797"],
                        gradient_v or ["#000000", "#8D9797"]
                    )
                else:
                    bg_surface = Image.new('RGB', (target_w, target_h), solid_color)
                container.paste(bg_surface, (0, 0))

        # --- Pegar siempre la imagen nítida encima ---
        img_fit = img_effected.resize((new_w, new_h), Image.Resampling.LANCZOS)
        fit_x = (target_w - new_w) // 2
        fit_y = (target_h - new_h) // 2
        container.paste(img_fit, (fit_x, fit_y))

        return container

    @staticmethod
    def apply_zoom(img, target_w, target_h, image_effect="none"):
        """
        Escala la imagen para llenar completamente el rectángulo destino,
        manteniendo la proporción y recortando el excedente.
        """
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img = ImageEngine.apply_image_effect(img, image_effect)
        img_w, img_h = img.size
        img_ratio = img_w / img_h
        target_ratio = target_w / target_h

        if img_ratio > target_ratio:
            new_h = target_h
            new_w = int(target_h * img_ratio)
        else:
            new_w = target_w
            new_h = int(target_w / img_ratio)

        img_scaled = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        left = (new_w - target_w) // 2
        top = (new_h - target_h) // 2
        right = left + target_w
        bottom = top + target_h
        img_cropped = img_scaled.crop((left, top, right, bottom))

        return img_cropped

    @staticmethod
    def apply_stretched(img, target_w, target_h, image_effect="none"):
        """
        Escala la imagen para que ocupe exactamente el rectángulo destino,
        sin mantener la proporción (la imagen se deforma si es necesario).
        """
        if img.mode != 'RGB':
            img = img.convert('RGB')
        # Aplicar el efecto de imagen (fuera del condicional para que siempre se ejecute)
        img = ImageEngine.apply_image_effect(img, image_effect)

        return img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    @staticmethod
    def apply_image_effect(img, effect, intensity=100):
        """
        Aplica un efecto visual a la imagen.
        effect: "none", "sepia", "bw"
        intensity: 0-100, controla la intensidad del efecto.
        Devuelve una nueva imagen PIL con el efecto aplicado.
        """
        if effect == "none" or effect is None:
            return img
        elif effect == "bw":
            bw_img = img.convert('L').convert('RGB')
            if intensity < 100:
                return Image.blend(img, bw_img, intensity / 100.0)
            return bw_img
        elif effect == "sepia":
            # Fórmula de sepia genuino usando NumPy para rendimiento
            original = img.copy()
            arr = np.array(original, dtype=np.float64)
            sepia = np.zeros_like(arr)
            sepia[:,:,0] = 0.393*arr[:,:,0] + 0.769*arr[:,:,1] + 0.189*arr[:,:,2]
            sepia[:,:,1] = 0.349*arr[:,:,0] + 0.686*arr[:,:,1] + 0.168*arr[:,:,2]
            sepia[:,:,2] = 0.272*arr[:,:,0] + 0.534*arr[:,:,1] + 0.131*arr[:,:,2]
            sepia_img = Image.fromarray(sepia.clip(0, 255).astype('uint8'))
            if intensity < 100:
                return Image.blend(original, sepia_img, intensity / 100.0)
            return sepia_img
        else:
            return img

    def apply_spanned(self, img_path, canvas_w, canvas_h, mode, color_mode="blur", solid_color="#000000", gradient_h=None, gradient_v=None, wallpaper_effect_scope="blur", image_effect="none"):
        """
        Aplica el modo real (mode) al canvas completo definido por
        canvas_w y canvas_h (obtenidos previamente de MonitorManager).

        Args:
            img_path (str):       Ruta de la imagen maestra.
            canvas_w (int):       Ancho del canvas total (bounding box real o escalado).
            canvas_h (int):       Alto del canvas total.
            mode (str):           Modo real a aplicar: "fit", "zoom", "stretched".
            color_mode (str):     Modo de color para relleno (solo si mode == "fit").
            solid_color (str):    Color hexadecimal (solo si color_mode == "solid_color").
            gradient_h (list):    Degradado horizontal [inicio, fin] (solo si color_mode == "gradient_h").
            gradient_v (list):    Degradado vertical [inicio, fin] (solo si color_mode == "gradient_v").

        Returns:
            str: Ruta del thumbnail maestro generado, o None si falla.
        """
        if canvas_w <= 0 or canvas_h <= 0:
            return None

        with ImageEngine._open_image_safe(img_path) as img:
            if mode == "fit":
                processed = ImageEngine.apply_fit(img, canvas_w, canvas_h, wallpaper_effect_scope=wallpaper_effect_scope, solid_color=solid_color, gradient_h=gradient_h, gradient_v=gradient_v, color_mode=color_mode, image_effect=image_effect)
            elif mode == "zoom":
                processed = ImageEngine.apply_zoom(img, canvas_w, canvas_h, image_effect=image_effect)
            elif mode == "stretched":
                processed = ImageEngine.apply_stretched(img, canvas_w, canvas_h, image_effect=image_effect)
            else:
                return None

        thumb_dir = self.ch.thumbnails_dir
        os.makedirs(thumb_dir, exist_ok=True)
        m = hashlib.md5(f"{img_path}_{canvas_w}x{canvas_h}_spanned_{mode}".encode()).hexdigest()
        output_path = os.path.join(thumb_dir, f"spanned_{m}.jpg")
        processed.save(output_path, "JPEG", quality=85)
        return output_path

    def paint_monitors_thumbnails(self, fixed_widget, layout_data, img_source, wallpaper_mode, spanned_enabled, color_tuple, wallpaper_effect_scope="blur", image_effect="none"):
        """
        Pinta las miniaturas dentro de los EventBox existentes en fixed_widget.
        NO añade nuevos widgets si ya existe uno (modifica el existente).
        """
        if spanned_enabled:
            # --- MODO DISTRIBUIDO (SPANNED) ---
            # 1. Buscar la imagen maestra en img_source
            master_path = None
            for entry in img_source.values():
                path = entry.get("path", "") if isinstance(entry, dict) else entry
                if path and os.path.exists(path):
                    master_path = path
                    break
            if not master_path:
                # Sin imagen maestra: limpiar todos los EventBox
                for eb in fixed_widget.get_children():
                    if isinstance(eb, Gtk.EventBox):
                        child = eb.get_child()
                        if child is not None:
                            eb.remove(child)
                return

            # 2. Calcular el bounding box del layout escalado
            canvas_min_x = min(d['x'] for d in layout_data)
            canvas_min_y = min(d['y'] for d in layout_data)
            canvas_w = max(d['x'] + d['w'] for d in layout_data) - canvas_min_x
            canvas_h = max(d['y'] + d['h'] for d in layout_data) - canvas_min_y

            if canvas_w <= 0 or canvas_h <= 0:
                return

            # 3. Generar el thumbnail maestro spanned usando apply_spanned
            thumb_dir = self.ch.thumbnails_dir
            spanned_thumb = self.apply_spanned(
                master_path, canvas_w, canvas_h, mode=wallpaper_mode,
                color_mode=color_tuple[1], solid_color=color_tuple[2],
                gradient_h=color_tuple[3], gradient_v=color_tuple[4],
                wallpaper_effect_scope=wallpaper_effect_scope,
                image_effect=image_effect
            )
            if not spanned_thumb:
                return

            # 4. Cargar el thumbnail maestro como pixbuf
            full_pixbuf = GdkPixbuf.Pixbuf.new_from_file(spanned_thumb)

            # 5. Recortar la porción correspondiente a cada monitor
            for eb in fixed_widget.get_children():
                if not isinstance(eb, Gtk.EventBox):
                    continue
                m_hash = getattr(eb, 'm_hash', None)
                if not m_hash:
                    continue
                monitor_data = next((d for d in layout_data if d['hash'] == m_hash), None)
                if not monitor_data:
                    continue
                x, y, w, h = monitor_data['x'], monitor_data['y'], monitor_data['w'], monitor_data['h']
                rel_x = x - canvas_min_x
                rel_y = y - canvas_min_y
                inner_w = w - 2
                inner_h = h - 2
                if rel_x + 2 >= 0 and rel_y + 2 >= 0 and inner_w > 0 and inner_h > 0:
                    subpixbuf = full_pixbuf.new_subpixbuf(rel_x + 2, rel_y + 2, inner_w, inner_h)
                    child = eb.get_child()
                    if child is None:
                        child = Gtk.Image()
                        eb.add(child)
                    if not child.get_style_context().has_class("monitor-image"):
                        child.get_style_context().add_class("monitor-image")
                    child.set_from_pixbuf(subpixbuf)
                    child.queue_resize()
                    child.show()
        else:
            # Modo fit
            for eb in fixed_widget.get_children():
                if not isinstance(eb, Gtk.EventBox):
                    continue
                m_hash = getattr(eb, 'm_hash', None)
                if not m_hash:
                    continue
                monitor_data = next((d for d in layout_data if d['hash'] == m_hash), None)
                if not monitor_data:
                    continue
                w, h = monitor_data['w'], monitor_data['h']
                entry = img_source.get(m_hash, {})
                if not isinstance(entry, dict):
                    entry = {"path": entry if entry else "", "active": True}
                active = entry.get("active", True)

                # Hijo actual del EventBox (puede ser marcador de posición)
                child = eb.get_child()
                if not active:
                    inner_w = w - 2
                    inner_h = h - 2
                    color_surface = ImageEngine._create_color_surface(
                        inner_w, inner_h, color_tuple[1], color_tuple[2], color_tuple[3], color_tuple[4]
                    )
                    pixbuf = self._pil_to_pixbuf(color_surface)
                    if pixbuf:
                        if child is None:
                            child = Gtk.Image()
                            eb.add(child)
                        if not child.get_style_context().has_class("monitor-image"):
                            child.get_style_context().add_class("monitor-image")
                        child.set_from_pixbuf(pixbuf)
                        child.queue_resize()
                        child.show()
                elif entry.get("path"):
                    img_path = entry["path"]
                    inner_w = w - 2
                    inner_h = h - 2
                    with ImageEngine._open_image_safe(img_path) as img_obj:
                        # img_obj = ImageEngine.apply_image_effect(img_obj, image_effect)
                        if wallpaper_mode == "fit":
                            processed = ImageEngine.apply_fit(
                                img_obj, inner_w, inner_h,
                                wallpaper_effect_scope=wallpaper_effect_scope,
                                solid_color=color_tuple[2],
                                gradient_h=color_tuple[3],
                                gradient_v=color_tuple[4],
                                color_mode=color_tuple[1],
                                image_effect=image_effect
                            )
                        elif wallpaper_mode == "zoom":
                            processed = ImageEngine.apply_zoom(img_obj, inner_w, inner_h, image_effect=image_effect)
                        elif wallpaper_mode == "stretched":
                            processed = ImageEngine.apply_stretched(img_obj, inner_w, inner_h, image_effect=image_effect)
                        else:
                            processed = ImageEngine.apply_fit(
                                img_obj, inner_w, inner_h,
                                wallpaper_effect_scope=wallpaper_effect_scope,
                                solid_color=color_tuple[2],
                                gradient_h=color_tuple[3],
                                gradient_v=color_tuple[4],
                                color_mode=color_tuple[1],
                                image_effect=image_effect
                            )
                    # Guardar miniatura con dimensiones reducidas
                    thumb_dir = self.ch.thumbnails_dir
                    os.makedirs(thumb_dir, exist_ok=True)
                    intensity = 100  # Valor temporal hasta implementar el slider
                    m = hashlib.md5(f"{img_path}_{inner_w}x{inner_h}_{wallpaper_mode}_{wallpaper_effect_scope}_{image_effect}_{intensity}_{color_tuple[1]}_{color_tuple[2]}".encode()).hexdigest()
                    blurred_path = os.path.join(thumb_dir, f"blur_{m}.jpg")
                    processed.save(blurred_path, "JPEG", quality=85)
                    if child is None:
                        child = Gtk.Image()
                        eb.add(child)
                    if not child.get_style_context().has_class("monitor-image"):
                        child.get_style_context().add_class("monitor-image")
                    child.set_from_file(blurred_path)
                    child.queue_resize()
                    child.show()
                else:
                    # Monitor activo sin imagen: dejar vacío (eliminar cualquier hijo existente)
                    if child is not None:
                        eb.remove(child)

        fixed_widget.queue_draw()

    def _pil_to_pixbuf(self, pil_image):
        """Convierte una imagen PIL a GdkPixbuf.Pixbuf."""
        buf = io.BytesIO()
        pil_image.save(buf, 'png')
        buf.seek(0)
        loader = GdkPixbuf.PixbufLoader.new_with_type('png')
        loader.write(buf.read())
        loader.close()
        return loader.get_pixbuf()
