#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM Applet - Cinnamon Edition
----------------------------
i18n.py – Módulo centralizado de traducciones.

Proporciona la función _() para todo el proyecto.
El dominio del sistema se configura externamente mediante
set_system_domain().
"""

import gettext
import os

# Dominio del sistema (se configura externamente)
_SYSTEM_DOMAIN = None

# Ruta estándar de traducciones para extensiones de Cinnamon
LOCALE_DIR = os.path.expanduser('~/.local/share/locale')
gettext.bindtextdomain('wmm-applet@maki', LOCALE_DIR)

def set_system_domain(domain):
    """
    Configura el dominio del sistema donde buscar traducciones.
    Se llama desde main.py o core.py al iniciar.
    """
    global _SYSTEM_DOMAIN
    _SYSTEM_DOMAIN = domain

def _(text):
    """
    Busca primero en el dominio del sistema, luego en el de WMM.
    Si no se encuentra traducción, devuelve el texto original.
    """
    if _SYSTEM_DOMAIN:
        translated = gettext.dgettext(_SYSTEM_DOMAIN, text)
        if translated != text:
            return translated
    return gettext.dgettext('wmm-applet@maki', text)
