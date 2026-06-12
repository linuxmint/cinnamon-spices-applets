#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM Applet - Cinnamon Edition
----------------------------
nemo_add_bookmark.py – Añade una imagen a favoritos desde Nemo.

Recibe la ruta de una imagen desde el menú contextual de Nemo,
la procesa y la añade a la lista plana de favoritos de WMM.
"""

# ==========================================================
# IMPORTS DE LIBRERÍA ESTÁNDAR
# ==========================================================
import sys
import os
import subprocess

# ==========================================================
# CONFIGURACIÓN DEL PATH DEL PROYECTO
# ==========================================================
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _PROJECT_ROOT)

# ==========================================================
# IMPORTS DE MÓDULOS DEL PROYECTO
# ==========================================================
from config_handler import ConfigHandler
from PIL import Image
from debug_logger import log_event, set_cache_dir
from i18n import _

def main():
    if len(sys.argv) < 2:
        print("Uso: nemo_add_bookmark.py <ruta_imagen>")
        sys.exit(1)

    # Reconstruir la ruta si Nemo la ha fragmentado por espacios
    if len(sys.argv) > 2:
        sys.argv = [sys.argv[0], ' '.join(sys.argv[1:])]

    image_path = sys.argv[1]
    if not os.path.isfile(image_path):
        sys.exit(1)

    # Crear ConfigHandler temprano y configurar el logger
    ch = ConfigHandler()
    set_cache_dir(ch.cache_dir)

    # Ahora los log_event de diagnóstico funcionarán correctamente
    log_event(f"sys.argv = {sys.argv}", origin="NEMO_ADD", level="DEBUG", reason="BOOKMARK")
    log_event(f"CWD = {os.getcwd()}", origin="NEMO_ADD", level="DEBUG", reason="BOOKMARK")

    # Obtener dimensiones y orientación
    try:
        with Image.open(image_path) as img:
            w, h = img.size
            orient = "h" if w >= h else "v"
    except Exception as e:
        log_event(f"Error al procesar imagen: {e}", origin="NEMO_ADD", level="ERROR", reason="BOOKMARK")
        ch._send_notification(_("Error adding to favorites"),
                              _("Could not process image:") + "\n" + str(e),
                              level="error")
        sys.exit(1)

    entry = [image_path, w, h, orient]

    # Verificar duplicados
    current_list = ch.load_json("bookmarks_single")
    existing_paths = [item[0] for item in current_list]
    if image_path in existing_paths:
        log_event(f"Imagen ya en favoritos: {os.path.basename(image_path)}", origin="NEMO_ADD", level="INFO", reason="BOOKMARK")
        ch._send_notification(_("Add to favorites"),
                              _("Image is already in favorites."),
                              level="info")
        return

    # Añadir y guardar
    current_list.append(entry)
    log_event(f"Imagen añadida a favoritos: {os.path.basename(image_path)}", origin="NEMO_ADD", level="INFO", reason="BOOKMARK")
    ch.save_json("bookmarks_single", current_list)
    ch.refresh_history_metadata()

    try:
        ch.save_json("commands", {"action": "bookmark_added", "name": os.path.basename(image_path)})
        subprocess.run(["pkill", "-USR1", "-f", "main.py"])
    except Exception as e:
        log_event(f"No se pudo notificar al motor: {e}", origin="NEMO_ADD", level="WARN", reason="SIGNAL")

if __name__ == "__main__":
    main()
