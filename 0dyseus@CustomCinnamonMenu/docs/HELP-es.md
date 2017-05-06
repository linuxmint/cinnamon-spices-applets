
# Ayuda para el applet Configurable Menú para Cinnamon

### ¡IMPORTANTE!
Jamás borrar ninguno de los archivos encontrados dentro de la carpeta de este xlet. Podría romper la funcionalidad del xlet.

***

<h2 style="color:red;">Reportes de fallos, peticiones de características y contribuciones</h2>
<span style="color:red;">
Si cualquiera tiene fallos que reportar, peticiones de características y contribuciones, deben realizarlas <a href="https://github.com/Odyseus/CinnamonTools">en la página de GitHub de este xlet</a>.
</span>

***

### Navegación por teclado
**Nota:** Casi todos los atajos de teclado de este menú son los mismos utilizados por el menú original. Hay sólo un par de diferencias que me vi fozado a agregar a mi menú para que hacer funcionar algunas de sus características.

- Teclas <kbd>Flecha Izquierda</kbd> y <kbd>Flecha Derecha</kbd>:
    - Ciclan a través de la caja de favoritos, la caja de aplicaciones y la caja de categorías si alguna de estas cajas están enfocadas.
    - Si el foco se encuentra dentro de la caja de lanzadores personalizados, estas teclas van a ciclar a través de los botones dentro de esta caja.
- Tecla <kbd>Tabuladora</kbd>:
    - Si la caja de favoritos, la caja de aplicaciones o la caja de categorías están actualmente enfocadas, la tecla <kbd>Tabuladora</kbd> va a cambiar el foco hacia la caja de lanzadores personalizados.
    - Si el foco está en la caja de lanzadores personalizados, el foco será devuelto a la caja de categorías.
    - Si la caja de lanzadores personalizados no es parte del menú y la tecla <kbd>Tabuladora</kbd> o la combinación <kbd>Ctrl</kbd>/<kbd>Shit</kbd> + <kbd>Tabuladora</kbd> son presionadas, se ciclará a través de la caja de favoritos, la caja de aplicaciones y la caja de categorías.
- Teclas <kbd>Flecha Arriba</kbd> y <kbd>Flecha Abajo</kbd>:
    - Si la caja de favoritos, la caja de aplicaciones o la caja de categorías tienen actualmente el foco, estas teclas van a ciclar a través de los ítems de la caja actualmente enfocada.
    - Si el foco se encuentra dentro de la caja de lanzadores personalizados, el foco se devolverá a la caja de categorías.
- Teclas <kbd>Página Arriba</kbd> y <kbd>Página Abajo</kbd>: Salta al primer y último ítem de la caja actualmente enfocada. Estas teclas no afectan a los lanzadores personalizados.
- Teclas <kbd>Menú</kbd> o <kbd>Alt</kbd> + <kbd>Enter</kbd>: Abren y cierran el menú contextual (si lo hubiere) del ítem actualmente seleccionado.
- Tecla <kbd>Enter</kbd>: Ejecuta el ítem actualmente seleccionado.
- Tecla <kbd>Escape</kbd>: Cierra el menú principal. Si un menú contextual está actualmente abierto, va a cerrar el menú contextual en su lugar y un segundo accionamiento de esta tecla sí va a cerrar el menú principal del applet.
- <kbd>Shift</kbd> + <kbd>Enter</kbd>: Ejecuta la aplicación como root. Esta combinación de teclas no afectan a los lanzadores personalizados.
- <kbd>Ctrl</kbd> + <kbd>Enter</kbd>: Abre una terminal y se ejecuta la aplicación desde allí. Esta combinación de teclas no afectan a los lanzadores personalizados.
- <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd>: Abre una terminal y se ejecuta la aplicación desde allí, pero la aplicación es ejecutada como root. Esta combinación de teclas no afectan a los lanzadores personalizados.

***

### Acciones extras al hacer clic en las aplicaciones

Al hacer clic izquierdo en una aplicación del menú, ciertas teclas modificadoras pueden presionarse para ejecutar una aplicación de una manera especial.

- <kbd>Shift</kbd> + **Clic Derecho**: Ejecuta la aplicación como root.
- <kbd>Ctrl</kbd> + **Left click**: Abre una terminal y se ejecuta la aplicación desde allí.
- <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + **Left click**: Abre una terminal y se ejecuta la aplicación desde allí, pero la aplicación es ejecutada como root.

***

### Sobre las opciones "Ejecutar desde terminal"

Estas opciones están diseñadas para fines de depuración (para ver la salida de la consola después de abrir/cerrar un programa para detectar posibles errores, por ejemplo). En vez de abrir una terminal para ejecutar un programa del cual uno puede que no sepa su comando, uno puede hacerlo directamente desde el menú y en un sólo paso. Opciones para ejecutar un programa del menú desde una terminal pueden ser encontradas en el menú contextual de dichas aplicaciones y dichas opciones pueden ser mostradas o escondidas desde la ventana de opciones de este applet.

Por defecto, estas opciones van a usar el emulador de terminal por defecto del sistema (**x-terminal-emulator** en distribuciones basadas en Debian). Cualquier otro emulador de terminal puede ser especificado en la ventana de opciones de este applet, siempre y cuando dicho emulador tenga soporte para el argumento **-e**. Yo he realizado mis pruebas con **gnome-terminal**, **xterm** and **terminator**. Argumentos adicionales podrían ser pasados al emulador de terminal, pero no es soportado por mí.

***

### Manejo de favoritos
- Si la caja de favoritos esta **a la vista**, favoritos pueden ser agregados/removidos desde el menú contextual de las aplicaciones y arrastrando y soltando desde/hacia la caja de favoritos.
    **Nota:** Para remover un favorito, arrastrar un favorito fuera de la caja de favoritos hacia cualquier parte del menú.
- Si la caja de favoritos **está oculta** y la categoría de favoritos está habilitada, favoritos pueden ser agregados/removidos desde el menú contextual de las aplicaciones y arrastrando y soltando desde/hacia la categoría de favoritos. Es sencillo, si un favorito es arrastrado y soltado en la categoría de favoritos, el favorito será eliminado. Si lo que es arrastrado hacia la categoría de favoritos es una aplicación que no está en favoritos, entonces dicha aplicación será agregada a favoritos.
    **Nota:** La categoría favoritos actualizará su contenido luego de cambiar a otra categoría y regresar a la categoría favoritos.

***

### Solución de problemas/información adicional

1. Ejecutar desde terminal.
    1. **Para distribuciones basadas en Debian:** Si el comando **x-terminal-emulator** no ejecuta el emulador de terminal que uno quiere que sea ejecutado, ejecutar el siguiente comando para establecer por defecto un emulador de terminal diferente.
    - `sudo update-alternatives --config x-terminal-emulator`
    - Tipear el número que se desea y presionar <kbd>Enter</kbd>
    2. **Para otras distribuciones:** Simplemente establezca el ejecutable del emulador de terminal de su elección desde la ventana de configuración de este applet.
2. Existe un archivo dentro del directorio de este applet llamado **run_from_terminal.sh**. **No borrar, renombrar o editar este archivo**. De otra manera, todas las opciones *Ejecutar desde terminal* se romperán.
3. Existe una carpeta llamada **icons** dentro dentro del directorio de este applet. Dicha carpeta contiene varios íconos simbólicos (la mayoría proviene del tema Faenza) y cada ícono puede ser usado directamente por nombre (en un lanzador personalizado, por ejemplo).

***

### Localización de applets/desklets/extensiones (también conocidos como xlets)

- Si este xlet se instaló desde Configuración de Cinnamon, todas las localizaciones de este xlet se instalaron automáticamente.
- Si este xlet se instaló manualmente y no a través de Configuración de Cinnamon, las localizaciones se pueden instalar ejecutando el archivo llamado **localizations.sh** desde una terminal abierta dentro de la carpeta del xlet.
- Si este xlet no está disponible en su idioma, la localización puede ser creada siguiendo [estas instrucciones](https://github.com/Odyseus/CinnamonTools/wiki/Xlet-localization) y luego enviarme el archivo .po.
    - Si se posee una cuenta de GitHub:
        - Puede enviar una "pull request" con el nuevo archivo de localización.
        - Si no se desea clonar el repositorio, simplemente crear un [Gist](https://gist.github.com/) y enviarme el enlace.
    - Si no se posee o no se quiere una cuenta de GitHub:
        - Se puede enviar un [Pastebin](http://pastebin.com/) (o servicio similar) a mi [cuenta en el foro de Linux Mint](https://forums.linuxmint.com/memberlist.php?mode=viewprofile&u=164858).
- Si el texto fuente (en Inglés) y/o mi traducción al Español contiene errores o inconsistencias, no dude en informarlos.
