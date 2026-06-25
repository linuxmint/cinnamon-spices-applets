# Ajustes

Para abrir el panel de control, haz clic derecho sobre el icono de WMM en el panel y selecciona **WMM Ajustes**.

## Opciones

Aquí encontrarás las opciones generales de WMM. Cambia el fondo al iniciar, elige el modo de aspecto, efectos de imagen, color de fondo y controla la presentación de diapositivas. Cada cambio se refleja en tiempo real en los monitores virtuales de la sección **Pantallas**.

### Icono Reiniciar
Reinicia completamente el motor y el panel de control. Es útil si el motor deja de responder.

### Icono Visor de Logs
Abre el visor de logs de depuración en una ventana aparte. Muestra en tiempo real toda la actividad del motor y del panel de control.

### Cambiar el fondo de pantalla al iniciar
Si está **activada**, al iniciar el ordenador el motor elige imágenes nuevas y regenera el fondo desde cero.
Si está **desactivada**, se conserva la última composición guardada (ideal si te gusta cómo lo dejaste y no quieres cambios inesperados).

### Distribución
Activa o desactiva el **Modo Distribuido** (*Spanned*). Al activarse, se utiliza una única imagen panorámica que se extiende por todos los monitores a la vez.
Solo está disponible si hay más de un monitor activo.

### Relación de aspecto
Controla cómo se ajusta la imagen dentro de cada monitor:

- **Escalado** (*Scaled*): La imagen se reduce o amplía para ocupar el monitor completamente **sin deformarla**. Si la imagen no llena todo el monitor, el espacio sobrante se rellena con el color o efecto de fondo seleccionado.
- **Zoom**: La imagen se escala para cubrir todo el monitor. Si la imagen y el monitor tienen proporciones diferentes, las partes que sobran se recortan.
- **Estirado** (*Stretched*): La imagen se estira para ajustarse exactamente al tamaño del monitor, aunque se deforme.

### Efecto de imagen
Aplica un efecto visual sobre la imagen de cada monitor:

- **Ninguno** (*None*): Sin efecto.
- **Sepia** (*Sepia*): Aplica un tono envejecido, marronoso, a la imagen.
- **Blanco y negro** (*Black and White*): Convierte la imagen a escala de grises, eliminando los colores.

### Efecto de fondo
Rellena el espacio sobrante cuando la imagen no cubre completamente el monitor (solo visible en modo Escalado). Tienes dos opciones:

- **Difuminado** (*Blur*): Toma la propia imagen, la desenfoca y la usa como fondo, creando un efecto de continuidad.
- **Color**: Utiliza el color sólido o degradado que tengas seleccionado en la opción "Color de fondo".

### Color de fondo
Define el color del espacio sobrante cuando se usa el modo Escalado o cuando un monitor no tiene imagen asignada. Tienes tres opciones:

- **Color sólido** (*Solid color*): Un único color plano. Puedes elegirlo con el selector de color.
- **Degradado Horizontal** (*Gradient H*): Un degradado de dos colores de izquierda a derecha.
- **Degradado Vertical** (*Gradient V*): Un degradado de dos colores de arriba abajo.

### Presentación de diapositivas
Activa o desactiva el cambio automático de imágenes. Cuando está activado, el motor cambia las imágenes de fondo según la configuración de frecuencia y modo.

### Frecuencia máxima.
Establece el límite máximo (en minutos) que puede tener el intervalo de rotación. El control deslizante del menú del applet se ajusta a este valor.

### Diapositivas cada:
Define cada cuántos minutos el motor cambiará las imágenes de fondo.

### Modo de presentación
Controla cómo cambian las imágenes los monitores durante la presentación de diapositivas:

- **Síncrono** (*Sync*): Todos los monitores cambian a la vez, tomando una imagen de un mismo *preset* o de la biblioteca general.
- **Asíncrono** (*Async*): Cada monitor cambia por su cuenta, de manera independiente.

**Comportamiento con Favoritos activado:**
- Si **"Solo Favoritos"** está activado en el menú del applet, o en la sección **Favoritos**, la presentación de diapositivas utiliza exclusivamente las imágenes de tus **Favoritos**
- Si tienes activado el modo **Síncrono** la rotación se hará solo con los presets guardados, ignorando el resto de la biblioteca.
- Si tienes activado el modo **Asíncrono** la rotación se hará solo con los favoritos guardados, ignorando el resto de la biblioteca.

## Favoritos

Gestiona tus combinaciones de fondos favoritas. Puedes crear, cargar y eliminar presets. Un *preset* es una composición de fondo guardada que puedes cargar en cualquier momento.

### Switch "Solo favoritos"
Si lo activas, la presentación de diapositivas utiliza exclusivamente las imágenes de tus presets guardados, ignorando el resto de la biblioteca. Si la presentación está en modo síncrono, selecciona un preset al azar en cada cambio. En modo asíncrono, selecciona imágenes individuales de la lista plana de favoritos.

### Caja Presets (izquierda)

- **Cargar un preset en los monitores**: haz clic derecho sobre el nombre del preset y selecciona *"Cargar en monitores"*. El preset se cargará en el modo de edición para que puedas verlo y modificarlo antes de aplicarlo.
- **Cambiar el nombre de un preset**: haz un clic lento sobre el nombre del preset (sin hacer doble clic). El texto se volverá editable. Escribe el nuevo nombre y pulsa Enter.
- **Eliminar un preset**: haz clic derecho sobre el preset y selecciona *"Eliminar el preset"*. También puedes seleccionarlo y pulsar el botón de la papelera.
- **Eliminar una imagen de un preset**: haz clic derecho sobre la imagen dentro del preset y selecciona *"Eliminar la imagen"*. El monitor conservará su posición en el preset pero sin imagen.
- **Abrir una imagen del preset**: haz doble clic sobre la imagen. Se abrirá con el visor de imágenes predeterminado del sistema.

### Caja Favoritos (derecha)

- **Añadir una imagen a favoritos**: desde la galería de miniaturas, haz clic derecho sobre una imagen y selecciona *"Añadir a favoritos"*. También puedes añadirla desde el gestor de archivos Nemo con la acción *"WMM: Add to favorites"*.
- **Seleccionar varias imágenes**: puedes seleccionar varias imágenes a la vez usando **Ctrl+clic** (selección discontinua) o **Mayús+clic** (selección de un rango continuo).
- **Eliminar una imagen de favoritos**: haz clic derecho sobre la imagen en la lista y selecciona *"Eliminar de favoritos"*.
- **Abrir una imagen**: haz doble clic sobre la imagen para abrirla con el visor de imágenes predeterminado del sistema.

### Botones de eliminación

Tanto la caja de Presets como la de Favoritos tienen un botón con icono de papelera en la parte inferior derecha. Este botón elimina el elemento seleccionado en ese momento (un preset, una imagen de un preset o una imagen de la lista de favoritos). Si tienes varios elementos seleccionados en la lista de favoritos, el botón los eliminará todos a la vez.

## Fuentes de imagen

Desde aquí puedes añadir, eliminar y gestionar las carpetas que WMM utiliza para buscar imágenes. Cada carpeta se muestra con sus subcarpetas (si la recursividad está activada) y puedes controlar cuáles están activas.
En los procesos y funcionalidades de esta sección **nunca se eliminan carpetas ni imágenes originales del disco.** Únicamente se eliminan sus referencias a la biblioteca y sus **miniaturas** de la memoria caché

### Botón "Añadir una fuente"
Abre un diálogo para seleccionar una carpeta del sistema. Al seleccionarla:

- **Carpeta con subcarpetas**: marca la casilla *"Incluir subcarpetas (Recursivo)"* si quieres que WMM busque imágenes también dentro de todas las subcarpetas.
- **Carpeta sin subcarpetas**: deja la casilla desmarcada para indexar solo las imágenes de la carpeta raíz.
- Al pulsar **"Añadir"**, la carpeta se registra en la lista de fuentes, pero **no se escanea inmediatamente**. Queda preparada para ser procesada.
- Las miniaturas se generarán y la carpeta se indexará en la **próxima sincronización**, que puede ser:
  - Cuando pulses el botón **"Resincronizar"**.
  - Cuando abras el panel de control en una nueva sesión.
  - Cuando forces una **"Sincronización de la biblioteca"** desde el menú del applet.
  - Cuando el motor se inicia.
- Hasta que no se produzca una de estas acciones, la carpeta aparecerá en la lista pero no verás sus imágenes en la galería.

### Botón "Eliminar una fuente"
Elimina la carpeta seleccionada **de la biblioteca de imágenes.** Antes de eliminarla, se muestra un diálogo de confirmación. Si aceptas:

- La carpeta desaparece de la lista de fuentes.
- **Las miniaturas no se borran inmediatamente.** Permanecen en la memoria caché hasta que se haga una limpieza. Puedes eliminarlas de tres maneras:
  - Manualmente: haciendo clic derecho en la carpeta (o subcarpeta) y seleccionando **"Eliminar la memoria caché"**.
  - Automáticamente: al pulsar el botón **"Resincronizar"** (el motor detecta que la fuente ya no existe y limpia su caché).
  - Automáticamente: durante un ciclo de mantenimiento (sincronización de la biblioteca desde el applet o al inicio del motor).

### Botón "Resincronizar"
Vuelve a escanear todas las fuentes de imagen y actualiza la biblioteca. Debes usar este botón cuando:

- **Añades o eliminas imágenes** manualmente dentro de las carpetas de WMM.
- **Cambias el nombre o la estructura** de las subcarpetas.
- Quieres **regenerar las miniaturas** después de haber movido o modificado imágenes.

Durante la sincronización, WMM recorre todas las carpetas activas, detecta imágenes nuevas, **elimina miniaturas** de las que ya no existen y actualiza la galería de miniaturas. Al finalizar, recibirás una notificación con el resumen de los cambios.

### Navegación por el árbol de carpetas

#### Doble clic en una carpeta
Abre la carpeta con el gestor de archivos del sistema para que puedas ver su contenido directamente.

#### Clic derecho en una carpeta padre
Muestra un menú contextual con estas opciones:

- **Activar/Desactivar la carpeta**: si la desactivas, la carpeta y todas sus subcarpetas dejarán de mostrarse en la galería de miniaturas. Las imágenes no se incluirán en la presentación de diapositivas. Es útil para ocultar temporalmente una carpeta sin eliminarla.
- **Activar/Desactivar todas las subcarpetas**: aplica el mismo estado (activado o desactivado) a todas las subcarpetas de la carpeta seleccionada. Ideal para gestionar carpetas con muchas subcarpetas de golpe.
- **Eliminar de la memoria caché de la carpeta**: esta opción **solo aparece si la carpeta ha sido previamente desactivada**. Borra las **miniaturas** asociadas para liberar espacio.

#### Clic derecho en una subcarpeta
Muestra un menú contextual con estas opciones:

- **Activar/Desactivar la subcarpeta**: controla si las imágenes de esta subcarpeta en concreto se muestran en la galería y se incluyen en la presentación.
- **Eliminar la memoria caché de la subcarpeta**: borra las **miniaturas** de esta subcarpeta específica.

### Activar/Desactivar la recursividad
La columna *"Recursivo"* del árbol de carpetas muestra un interruptor para cada carpeta padre. Cuando está **activado**, WMM indexa todas las subcarpetas dentro de esta fuente. Cuando está **desactivado**, solo indexa las imágenes de la carpeta raíz, ignorando las subcarpetas.

Si activas la recursividad, el árbol de carpetas se despliega automáticamente para mostrar las subcarpetas activas. Si la desactivas, las subcarpetas no desaparecerán inmediatamente. El cambio se hará efectivo en la próxima sincronización (al pulsar "Resincronizar", al abrir el panel de nuevo, al forzar una sincronización de la biblioteca o en el siguiente inicio del motor). Hasta entonces, las subcarpetas permanecerán en la galería y en la presentación de diapositivas.

## Monitores

Aquí se muestran tus monitores como miniaturas. La sección se actualiza en tiempo real con cualquier cambio: rotación de fondos, cambios de geometría, encendido/apagado de monitores, etc.

### Botonera de alineación

En la cabecera de la sección encontrarás tres botones: `[` , `•` y `]`. Sirven para cambiar la alineación horizontal del bloque de monitores dentro de la ventana:

- **`[`** : alineación a la izquierda.
- **`•`** : alineación centrada.
- **`]`** : alineación a la derecha.

Es útil cuando tienes monitores con geometrías muy diferentes y quieres ajustar visualmente la previsualización.

### Modo normal

En modo normal, la sección muestra una miniatura de cada monitor con la imagen que tiene asignada y un interruptor en la parte superior para activarlo o desactivarlo.

#### Interruptores de monitor

Cada interruptor tiene dos funciones:
- **Activado**: el monitor muestra la imagen que tiene asignada. Si no tiene ninguna, se le asignará una automáticamente según su orientación.
- **Desactivado**: el monitor se pinta con el color de fondo seleccionado (sólido o degradado) y no participa en la rotación de diapositivas.

Si el **Modo Distribuido** está activado, los interruptores quedan bloqueados (no se pueden cambiar) porque una única imagen se extiende por todos los monitores.

#### Botones de acción

- **Casilla "Favorito"**: si la marcas, al pulsar **Aceptar** se guardará la composición actual como un preset nuevo.
- **Aceptar**: guarda la composición actual como preset (si la casilla está marcada) o simplemente aplica los cambios a tus pantallas. Si no se marca la casilla, no se guarda ningún preset.
- **Actualizar**: refresca la vista de los monitores desde el motor. Útil si detectas que la previsualización no coincide con la realidad.

### Modo de edición

Para activarlo, pulsa el botón **Modo de edición** (icono del lápiz). La sección cambia para permitirte asignar imágenes manualmente a cada monitor.

#### Arrastrar y soltar (Drag & Drop)

Puedes arrastrar cualquier imagen desde la galería de miniaturas y soltarla sobre el monitor virtual donde quieras asignarla. El monitor se actualiza al instante con la nueva imagen.

#### Panel de opciones de edición

Cuando el modo de edición está activo, aparece un panel con opciones específicas para la composición que estás creando:

- **Distribución (Spanned)**: activa o desactiva el modo distribuido para esta composición.
- **Relación de aspecto**: elige el modo de ajuste para las imágenes de esta composición.
- **Efectos**: aplica un efecto de imagen (sepia, blanco y negro) a la composición.

Podrás ver el efecto al manipular estas opciones en tiempo real.
Estos valores se guardan junto con el preset y tienen prioridad sobre la configuración global.

#### Botones de acción en modo edición

- **Casilla "Favorito"**: si la marcas, al pulsar **Aceptar** se guardará la composición editada como un preset (creando uno nuevo o actualizando el que habías cargado).
- **Aceptar**: aplica los cambios al motor y sale del modo de edición. Si la casilla de favorito está marcada, también guarda el preset.
- **Actualizar**: vacía todas las imágenes de los monitores y los deja sin imagen, para que puedas empezar de cero.

## Miniaturas

La galería de imágenes disponibles. Aquí se muestran todas las imágenes que WMM ha indexado en tus fuentes. Las miniaturas se generan automáticamente y se guardan en la memoria caché para que la navegación sea rápida.

### Botón Actualizar

A la derecha de los botones H/V encontrarás un botón con el icono de refresco. Al pulsarlo, se regeneran todas las miniaturas de la galería. Es útil si has modificado imágenes fuera de WMM (por ejemplo, si las has editado con un programa externo) y quieres ver los cambios reflejados sin tener que hacer una sincronización completa de la biblioteca.

### Botones H / V

En la cabecera de la sección encontrarás dos botones: **Horizontal** y **Vertical**. Al pulsarlos, la galería se desplaza automáticamente hasta la primera imagen de la orientación seleccionada. Son una ayuda rápida para navegar por la galería sin tener que hacer scroll manual.

### Disposición y orden

Las miniaturas se muestran en un mosaico que se adapta al ancho de la ventana. El orden es fijo:

- Primero, todas las imágenes **horizontales**.
- Después, todas las imágenes **verticales**.

Dentro de cada grupo, las imágenes aparecen ordenadas por carpeta (según el orden de las fuentes de imagen) y alfabéticamente dentro de cada carpeta.

### Interacción con las miniaturas

Puedes interactuar con cualquier miniatura de tres maneras:

- **Doble clic**: abre la imagen original con el visor de imágenes predeterminado del sistema.
- **Clic derecho**: muestra un menú contextual con dos opciones:
  - *"Añadir a favoritos"*: añade la imagen a la lista plana de favoritos.
  - *"Eliminar de favoritos"*: quita la imagen de la lista de favoritos (solo aparece si la imagen ya es favorita).
- **Arrastrar (Drag & Drop)**: puedes arrastrar cualquier miniatura y soltarla sobre un monitor virtual en la sección **Monitores** (solo en modo de edición). La imagen se asignará a ese monitor.

### Marco de favorito

Las imágenes que has añadido a la lista de favoritos se destacan visualmente con un marco de color verde alrededor de la miniatura. Así puedes identificarlas rápidamente mientras navegas por la galería.

# Favoritos

El menú Favoritos del applet permite acceder rápidamente a los presets guardados y crear nuevos con la composición actual del fondo.

### Switch "Solo favoritos"

Si lo activas, la presentación de diapositivas utiliza exclusivamente las imágenes de tus presets guardados, ignorando el resto de la biblioteca. Cuando está activado, el modo de presentación cambia su comportamiento:

- **Modo síncrono**: selecciona un preset al azar en cada cambio y lo aplica a todos los monitores a la vez.
- **Modo asíncrono**: selecciona imágenes individuales de la lista plana de favoritos y las asigna a los monitores por turnos.

Si activas este switch mientras el temporizador está apagado, el motor lo encenderá automáticamente para que la rotación pueda funcionar.

### Añadir un preset

Al pulsar **"Add Preset Favorite"**, se abre un pequeño diálogo donde puedes poner nombre a la composición actual de fondos. WMM sugiere un nombre automático (por ejemplo, *"Bookmark 01"*), pero puedes escribir lo que quieras.

- **Nombre en blanco**: si dejas el campo vacío y pulsas **OK**, el diálogo te avisa y no se guarda nada.
- **Nombre repetido**: si escribes un nombre que ya existe, el diálogo te avisa y tienes que elegir uno diferente.
- **Grabación del preset**: al pulsar **OK** con un nombre válido, el preset se guarda automáticamente con la configuración actual de todos los monitores, incluyendo las imágenes, el modo de aspecto, el efecto de imagen y el modo distribuido.

### Lista de presets

Debajo del switch y del botón de añadir, aparece una lista con todos los presets que tienes guardados. Si la lista es larga, se muestra una barra de desplazamiento para navegar por ella.

- **Cargar un preset**: haz clic sobre el nombre del preset. WMM detendrá el temporizador (si estaba activo) y aplicará la composición guardada a los monitores inmediatamente.
- **Eliminar un preset**: haz clic en el icono de la papelera que hay a la derecha de cada preset. Se mostrará un diálogo de confirmación. Si lo eliminas, el preset desaparece de la lista y de la lista plana de favoritos.

# Presentación de diapositivas

Desde este menú puedes controlar el cambio automático de imágenes de fondo. Cuando la presentación está activa, el motor cambia las imágenes según el intervalo y el modo que tengas configurados en el panel de control.

### Switch "Activado / Desactivado"

El interruptor principal enciende o apaga completamente el temporizador de rotación.

- **Activado**: el motor inicia la cuenta atrás inmediatamente. El primer cambio de imágenes se producirá una vez transcurrido el intervalo configurado (por defecto, 15 minutos). Si el intervalo es muy corto, el cambio puede ser casi instantáneo.
- **Desactivado**: el temporizador se detiene. Se mantiene el fondo actual sin cambios hasta que lo vuelvas a activar o hagas una rotación manual.

Cuando activas el temporizador desde aquí, el panel de control se sincroniza automáticamente para reflejar el cambio.

### Control deslizante (Slider)

Justo debajo del interruptor encontrarás un control deslizante que te permite ajustar el intervalo de cambio sin abrir el panel de control.

- **Arrastra** el control para elegir los minutos que quieres que pasen entre cada cambio de imagen.
- Mientras lo arrastras, verás el valor en minutos al lado del control.
- Al **soltar** el control, el valor se guarda automáticamente y el motor actualiza el temporizador al instante.

El valor mínimo es de 1 minuto. El valor máximo viene definido por la opción **"Frec. Max."** del panel de control (por defecto, 60 minutos).

# Monitores (Modo de Rotación)

Este interruptor controla el modo de cambio de fondos entre los monitores.

- **ASYNC (One)**: cada monitor cambia por turnos. En cada ciclo de rotación, solo un monitor recibe una imagen nueva, mientras que los otros conservan la que tienen.
- **SYNC (All)**: todos los monitores cambian a la vez, aplicando una composición completa de manera simultánea.

El cambio entre un modo y otro es inmediato y no reinicia el temporizador.

# Modo Distribuido (Spanned)

Activa o desactiva el modo de fondo extendido. Cuando está activado, una única imagen panorámica se extiende por todos los monitores, cubriendo el lienzo completo. Esta opción solo tiene efecto si hay más de un monitor activo.
La aplicación del modo distribuido es inmediata

Al activarlo, los interruptores individuales de los monitores en el Centro de Control se bloquean (no se pueden cambiar), ya que la imagen es común para todos.

# Sincronizar Biblioteca

Esta opción fuerza un escaneo completo de todas las fuentes de imagen configuradas. WMM recorre las carpetas activas, detecta imágenes nuevas, elimina referencias a imágenes que ya no existen y actualiza la galería de miniaturas.

Al finalizar, recibirás una notificación con el resumen de los cambios (número de imágenes nuevas y eliminadas). Es útil después de añadir o quitar imágenes manualmente de las carpetas de WMM.

# Atajos de teclado

Puedes forzar un cambio de fondo sin usar el ratón configurando un atajo de teclado personalizado en tu escritorio. WMM incluye un pequeño script preparado para ello.

## En Cinnamon

1.  Abre **Configuración del sistema → Teclado → Atajos de teclado**.
2.  Haz clic en **Añadir atajo personalizado**.
3.  Ponle el nombre **"WMM - Cambiar fondo de pantalla"**.
4.  En el campo **Comando**, escribe:

    `bash -c "bash $HOME/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh"`

5.  Asigna la combinación de teclas que prefieras (por ejemplo, `Ctrl+Alt+N`).
6.  Pulsa **Aceptar** y prueba el atajo.

## En GNOME

1.  Abre **Configuración → Teclado → Atajos personalizados**.
2.  Haz clic en **"+"** para añadir uno nuevo.
3.  Ponle el nombre **"WMM - Cambiar fondo de pantalla"**.
4.  En el campo **Comando**, escribe:

    `bash -c "bash $HOME/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh"`

5.  Asigna la combinación de teclas que prefieras (por ejemplo, `Ctrl+Alt+N`).
6.  Cierra la ventana y prueba el atajo.

**Nota:** El script `wmm-next.sh` se instala automáticamente con WMM y debería tener los permisos de ejecución correctos. Si el atajo no funciona, asegúrate de que el script sea ejecutable:

    **En Gnome**

    `chmod +x ~/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh   # para GNOME`

    **En Cinnamon**

    `chmod +x ~/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh # para Cinnamon`

# Ayuda

Abre la ventana de ayuda de WMM, donde encontrarás información detallada sobre todas las funcionalidades del programa. La ventana cuenta con un índice de navegación a la izquierda y el contenido formateado a la derecha.
