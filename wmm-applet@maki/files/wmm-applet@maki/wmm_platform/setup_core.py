#!/usr/bin/env python3
"""
WMM - Setup Core (Detector Puro)
Misión Única: Detectar el sistema operativo y el entorno de escritorio,
y escribir los hechos observados en settings_core.json.
NO interpreta, NO decide backends, NO tiene lógica de negocio.
"""
import os, sys, json

def _detect_linux_desktop():
    """
    Si el SO es Linux, detecta el entorno de escritorio.
    Devuelve el nombre del escritorio o 'generic' si no lo identifica.
    """
    # Pistas ordenadas por fiabilidad. Si encontramos una coincidencia, devolvemos el valor.
    desktop_checks = [
        ('XDG_CURRENT_DESKTOP', 'cinnamon'),
        ('XDG_CURRENT_DESKTOP', 'kde'),
        ('XDG_CURRENT_DESKTOP', 'gnome'),
        ('XDG_CURRENT_DESKTOP', 'xfce'),
        ('DESKTOP_SESSION', 'cinnamon'),
        ('DESKTOP_SESSION', 'plasma'),  # KDE a veces usa 'plasma'
        ('GNOME_DESKTOP_SESSION_ID', 'this-is-deprecated'),
        ('CINNAMON_VERSION', None)      # Si la variable existe, es Cinnamon seguro
    ]
    for var, value in desktop_checks:
        if var in os.environ:
            if value is None or value in os.environ[var].lower():
                return value if value else 'cinnamon'  # Si la pista es solo la existencia de la variable
    return 'generic'

def main():
    print("WMM Setup Core: Detectando entorno...")

    # 1. Detectar SO (sys.platform es el estándar)
    platform = sys.platform
    desktop = 'windows' if platform == 'win32' else 'macos' if platform == 'darwin' else _detect_linux_desktop()
    # Simplificamos la salida de 'linux' para que sea más limpia
    if platform.startswith('linux'): platform = 'linux'

    system_info = {
        "platform": platform,
        "desktop": desktop
    }

    # 2. Guardar los hechos en settings_core.json
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, '..', 'data')
    os.makedirs(data_dir, exist_ok=True)
    settings_path = os.path.join(data_dir, 'settings_core.json')

    with open(settings_path, 'w') as f:
        json.dump(system_info, f, indent=4)

    print(f"  Entorno detectado: {system_info['platform']} - {system_info['desktop']}")
    print(f"  Configuración guardada en {settings_path}")

if __name__ == '__main__':
    main()
