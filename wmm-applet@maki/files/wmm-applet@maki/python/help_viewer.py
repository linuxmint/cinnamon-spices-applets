#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WMM Applet - Cinnamon Edition
----------------------------
help_viewer.py – Visor de ayuda integrado con índice de navegación.

Carga un archivo de ayuda en formato Markdown según el idioma del sistema
(help/HELP_xx.md) y muestra un índice de secciones a la izquierda con
acceso rápido al contenido a la derecha. Un marcador (▶) señala la
sección activa en el índice.
"""

import os
import re
import gi

gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Pango, GLib
from i18n import _

# ----------------------------------------------------------------------
# VISOR DE AYUDA
# ----------------------------------------------------------------------

class HelpViewer(Gtk.Window):
    """
    Ventana de ayuda con índice de navegación.
    """

    def __init__(self, parent=None):
        super().__init__(title="WMM - " + _("Help"))
        self.set_default_size(900, 650)
        self.set_position(Gtk.WindowPosition.CENTER)
        if parent:
            self.set_transient_for(parent)

        # Icono estándar de ayuda del sistema
        self.set_icon_name("help-contents")

        # ----------------------------------------------------------
        # DEFINICIÓN DE WIDGETS
        # ----------------------------------------------------------

        # --- PANEL IZQUIERDO: ÍNDICE ---
        left_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        left_box.set_border_width(6)

        index_label = Gtk.Label()
        index_label.set_markup(f"<b>{_('Contents')}</b>")
        index_label.set_halign(Gtk.Align.START)
        left_box.pack_start(index_label, False, False, 4)

        scrolled_index = Gtk.ScrolledWindow()
        scrolled_index.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

        # TreeView con dos columnas: título y marcador
        self.index_store = Gtk.TreeStore(str, int, str)  # [título, línea_inicio, marcador]
        self.index_tree = Gtk.TreeView(model=self.index_store)
        self.index_tree.set_headers_visible(False)

        # Columna del título
        renderer_title = Gtk.CellRendererText()
        column_title = Gtk.TreeViewColumn("", renderer_title, text=0)
        column_title.set_expand(True)
        self.index_tree.append_column(column_title)

        # Columna del marcador (flecha ▶, estrecha)
        renderer_marker = Gtk.CellRendererText()
        renderer_marker.set_property("xalign", 1.0)
        column_marker = Gtk.TreeViewColumn("", renderer_marker, text=2)
        column_marker.set_min_width(25)
        column_marker.set_max_width(30)
        self.index_tree.append_column(column_marker)

        # Conectar un solo clic para navegar
        self.index_tree.connect("cursor-changed", self._on_index_cursor_changed)

        scrolled_index.add(self.index_tree)
        left_box.pack_start(scrolled_index, True, True, 0)

        # --- PANEL DERECHO: CONTENIDO ---
        right_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        right_box.set_border_width(6)

        scrolled_content = Gtk.ScrolledWindow()
        scrolled_content.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

        self.content_view = Gtk.TextView()
        self.content_view.set_editable(False)
        self.content_view.set_wrap_mode(Gtk.WrapMode.WORD)
        self.content_view.set_left_margin(10)
        self.content_view.set_right_margin(10)

        self.textbuffer = self.content_view.get_buffer()
        scrolled_content.add(self.content_view)
        right_box.pack_start(scrolled_content, True, True, 0)

        # ----------------------------------------------------------
        # TAGS DE FORMATO MARKDOWN
        # ----------------------------------------------------------
        self.tag_h1 = self.textbuffer.create_tag("h1", scale=1.5, weight=Pango.Weight.BOLD)
        self.tag_h2 = self.textbuffer.create_tag("h2", scale=1.3, weight=Pango.Weight.BOLD)
        self.tag_h3 = self.textbuffer.create_tag("h3", scale=1.1, weight=Pango.Weight.BOLD)
        self.tag_h4 = self.textbuffer.create_tag("h4", scale=1.0, weight=Pango.Weight.BOLD)
        self.tag_bold = self.textbuffer.create_tag("bold", weight=Pango.Weight.BOLD)
        self.tag_italic = self.textbuffer.create_tag("italic", style=Pango.Style.ITALIC)
        self.tag_list_item = self.textbuffer.create_tag("list-item", left_margin=20)
        self.tag_code = self.textbuffer.create_tag("code", family="Monospace")
        self.tag_link = self.textbuffer.create_tag("link", foreground="blue", underline=Pango.Underline.SINGLE)

        # ----------------------------------------------------------
        # VARIABLES DE CONTROL
        # ----------------------------------------------------------
        self._last_marked_iter = None  # Para quitar el marcador anterior del índice
        # Marcas para restaurar la línea del marcador (no se invalidan)
        self._marker_line_start = self.textbuffer.create_mark(
            "marker-line-start", self.textbuffer.get_start_iter(), True
        )
        self._marker_line_end = self.textbuffer.create_mark(
            "marker-line-end", self.textbuffer.get_start_iter(), False
        )

        # ----------------------------------------------------------
        # ORDEN DE EMPAQUETADO
        # ----------------------------------------------------------
        main_paned = Gtk.HPaned()
        main_paned.set_position(220)
        main_paned.pack1(left_box, False, False)
        main_paned.pack2(right_box, True, False)
        self.add(main_paned)

        # ----------------------------------------------------------
        # CARGA DEL CONTENIDO MULTILINGÜE
        # ----------------------------------------------------------
        self._load_help_content()

        self.show_all()

    # ----------------------------------------------------------
    # CARGA DEL ARCHIVO DE AYUDA Y GENERACIÓN DEL ÍNDICE
    # ----------------------------------------------------------
    def _load_help_content(self):
        """
        Carga el archivo HELP correspondiente al idioma del sistema,
        parsea el Markdown y genera el índice.
        """
        # Detectar idioma
        lang = os.environ.get('LANG', 'en')[:2].lower()
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        help_dir = os.path.join(base_dir, "help")
        help_path = os.path.join(help_dir, f"HELP_{lang}.md")
        if not os.path.exists(help_path):
            help_path = os.path.join(help_dir, "HELP.md")
        if not os.path.exists(help_path):
            self._show_error(_("Help file not found."))
            return

        try:
            with open(help_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception as e:
            self._show_error(_("Could not read help file:") + f"\n{e}")
            return

        # Limpiar buffer e índice
        self.textbuffer.set_text("")
        self.index_store.clear()

        current_parent = None
        buffer = self.textbuffer
        iter = buffer.get_end_iter()

        for line in lines:
            stripped = line.strip()

            # --- TÍTULOS Y GENERACIÓN DEL ÍNDICE ---
            if stripped.startswith("#"):
                level = min(stripped.count("#", 0, 4), 4)
                title = stripped.lstrip("#").strip()
                # Seleccionar el tag según el nivel
                tags = {1: self.tag_h1, 2: self.tag_h2, 3: self.tag_h3, 4: self.tag_h4}
                tag = tags.get(level, self.tag_h4)
                buffer.insert_with_tags(iter, title + "\n", tag)

                # Añadir entrada al índice con la profundidad correcta
                if level == 1:
                    # Título principal (h1): nuevo nodo raíz
                    current_parent = self.index_store.append(None, [title, iter.get_line(), ""])
                    current_h2 = None  # Resetear el nivel 2 al empezar nueva sección
                elif level == 2 and current_parent is not None:
                    # Subtítulo (h2): hijo del h1 actual
                    current_h2 = self.index_store.append(current_parent, [title, iter.get_line(), ""])
                elif level >= 3 and current_h2 is not None:
                    # Sub-subtítulo (h3/h4): hijo del último h2
                    self.index_store.append(current_h2, [title, iter.get_line(), ""])

            # --- LISTAS ---
            elif stripped.startswith("- ") or stripped.startswith("* "):
                text = stripped[2:]
                buffer.insert_with_tags(iter, "  • ", self.tag_list_item)
                self._insert_markdown_text(buffer, iter, text + "\n")

            # --- PÁRRAFOS NORMALES ---
            elif stripped:
                self._insert_markdown_text(buffer, iter, stripped + "\n")

            else:
                # Línea vacía (espaciado)
                buffer.insert(iter, "\n")

    # ----------------------------------------------------------
    # INSERCIÓN DE TEXTO CON FORMATO MARKDOWN BÁSICO
    # ----------------------------------------------------------
    def _insert_markdown_text(self, buffer, iter, text):
        """
        Inserta texto en el buffer parseando **negritas**, *itálicas*,
        `código` y [enlaces](url).
        """
        patterns = [
            (r'\*\*(.+?)\*\*', self.tag_bold),
            (r'\*(.+?)\*', self.tag_italic),
            (r'`(.+?)`', self.tag_code),
        ]

        pos = 0
        while pos < len(text):
            next_match = None
            next_tag = None
            next_start = len(text)

            for pattern, tag in patterns:
                match = re.search(pattern, text[pos:])
                if match:
                    start = pos + match.start()
                    if start < next_start:
                        next_match = match
                        next_tag = tag
                        next_start = start

            if next_match is None:
                buffer.insert(iter, text[pos:])
                break

            if next_start > pos:
                buffer.insert(iter, text[pos:next_start])

            buffer.insert_with_tags(iter, next_match.group(1), next_tag)
            pos = next_start + len(next_match.group(0))

    # ----------------------------------------------------------
    # NAVEGACIÓN DESDE EL ÍNDICE (UN SOLO CLIC)
    # ----------------------------------------------------------
    def _on_index_cursor_changed(self, treeview):
        """
        Al hacer clic en un elemento del índice:
        - Restaura la línea anterior (quita el marcador).
        - Inserta un marcador (▶) al inicio de la nueva línea en el documento.
        - Actualiza el marcador en el índice (▶).
        - Salta a la sección correspondiente.
        """
        selection = treeview.get_selection()
        model, tree_iter = selection.get_selected()
        if not tree_iter:
            return

        new_line = model.get_value(tree_iter, 1)

        # --- 1. Restaurar la línea anterior (quitar "▶ " si existe) ---
        old_start = self.textbuffer.get_iter_at_mark(self._marker_line_start)
        old_end = self.textbuffer.get_iter_at_mark(self._marker_line_end)
        if not old_start.equal(old_end):
            old_text = self.textbuffer.get_text(old_start, old_end, False)
            if old_text.startswith("▶ "):
                # Eliminar los dos primeros caracteres (▶ y espacio)
                end_marker = old_start.copy()
                end_marker.forward_chars(2)
                self.textbuffer.delete(old_start, end_marker)

        # --- 2. Insertar el marcador al inicio de la nueva línea ---
        line_start = self.textbuffer.get_iter_at_line(new_line)
        self.textbuffer.insert(line_start, "▶ ")

        # Guardar las marcas para la próxima restauración
        new_line_start = self.textbuffer.get_iter_at_line(new_line)
        new_line_end = new_line_start.copy()
        if not new_line_end.ends_line():
            new_line_end.forward_to_line_end()
        new_line_end.forward_char()  # Incluir el "\n"
        self.textbuffer.move_mark(self._marker_line_start, new_line_start)
        self.textbuffer.move_mark(self._marker_line_end, new_line_end)

        # --- 3. Actualizar el marcador en el índice ---
        if self._last_marked_iter:
            model.set_value(self._last_marked_iter, 2, "")
        model.set_value(tree_iter, 2, "▶")
        self._last_marked_iter = tree_iter

        # --- 4. Saltar a la sección centrada verticalmente ---
        start_iter = self.textbuffer.get_iter_at_line(new_line)
        # Crear una marca temporal para referenciar la posición exacta
        temp_mark = self.textbuffer.create_mark(None, start_iter, True)
        # Desplazar el scroll para que la marca quede centrada verticalmente
        self.content_view.scroll_to_mark(temp_mark, 0.0, True, 0.0, 0.5)
        # Eliminar la marca temporal para no dejar residuos
        self.textbuffer.delete_mark(temp_mark)

    # ----------------------------------------------------------
    # MENSAJE DE ERROR EN EL ÁREA DE CONTENIDO
    # ----------------------------------------------------------
    def _show_error(self, message):
        """Muestra un mensaje de error en el área de contenido."""
        self.textbuffer.set_text(message)
        error_tag = self.textbuffer.create_tag("error", foreground="red")
        self.textbuffer.apply_tag(error_tag, self.textbuffer.get_start_iter(),
                                  self.textbuffer.get_end_iter())


# ----------------------------------------------------------------------
# PRUEBA INDEPENDIENTE DEL VISOR
# ----------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    from gi.repository import Gtk, Gio

    # Usar Gtk.Application para garantizar instancia única
    class HelpApplication(Gtk.Application):
        def __init__(self):
            super().__init__(application_id="org.wmm.HelpViewer")

        def do_activate(self):
            # Si ya hay una ventana abierta, traerla al frente
            for window in self.get_windows():
                window.present()
                return
            # Si no, crear una nueva
            viewer = HelpViewer()
            viewer.connect("destroy", lambda w: self.quit())
            self.add_window(viewer)
            viewer.show_all()

    app = HelpApplication()
    app.run(sys.argv)
