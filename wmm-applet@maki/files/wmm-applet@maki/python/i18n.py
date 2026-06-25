#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM
----------------------------
i18n.py – Módulo centralizado de traducciones.

Proporciona la función _() para todo el proyecto.
Utiliza exclusivamente las traducciones propias de WMM.
"""

import gettext

# Dominio de la aplicación (se configura externamente, sin hardcodeos)
_APP_DOMAIN = None

# Ruta de traducciones (se configura externamente)
_LOCALE_DIR = None

def set_app_domain(domain):
    """
    Configura el dominio de la aplicación (ej: 'wmm-applet@maki').
    Se llama desde main.py o panel.py al iniciar.
    """
    global _APP_DOMAIN
    _APP_DOMAIN = domain
    _bind()

def set_locale_dir(locale_dir):
    """
    Configura la ruta de traducciones.
    Se llama desde main.py o panel.py al iniciar.
    """
    global _LOCALE_DIR
    _LOCALE_DIR = locale_dir
    _bind()

def _bind():
    """Vincula el dominio a la ruta si ambos están configurados."""
    if _APP_DOMAIN and _LOCALE_DIR:
        gettext.bindtextdomain(_APP_DOMAIN, _LOCALE_DIR)

def _(text):
    """
    Devuelve la traducción de 'text' según el dominio de WMM.
    Si no se encuentra traducción, devuelve el texto original.
    """
    if _APP_DOMAIN:
        return gettext.dgettext(_APP_DOMAIN, text)
    return text

def N_(text):
    return text
