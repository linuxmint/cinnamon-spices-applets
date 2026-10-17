# Media Clock

Reloj con **Dynamic Island estilo iPhone** para Cinnamon.

Al hacer clic sobre el reloj del panel, aparece una pildora horizontal
negra con la cancion que se esta reproduciendo: portada, titulo, artista,
controles de reproduccion y barras de progreso y volumen.

## Caracteristicas

- Reloj 12h con AM/PM y fecha DD/MM en el panel
- Dynamic Island horizontal (estilo iPhone) al hacer clic
- Portada de la cancion en alta calidad
- Titulo y artista
- Barra de progreso arrastrable
- Barra de volumen arrastrable + boton de mute
- Controles: anterior, play/pausa, siguiente
- Cierra con clic fuera, clic en el reloj, o tecla `Esc`
- Compatible con cualquier reproductor que soporte MPRIS
  (Sonora, VLC, Spotify, Rhythmbox, Celluloid, Firefox, Brave, etc.)

## Capturas

![Menu desplegado](screenshot.png)

## Instalacion

### Desde la tienda de Cinnamon (recomendado)

1. Clic derecho en el panel → **Applets**
2. Pestana **Descargar**
3. Buscar **Media Clock**
4. Pulsar **+**

### Manual

    mkdir -p ~/.local/share/cinnamon/applets
    cp -r media-clock@Juanes767 ~/.local/share/cinnamon/applets/
    # Reinicia Cinnamon: Ctrl + Alt + Esc

## Requisitos

- Cinnamon 5.0 o superior
- Un reproductor compatible con MPRIS
- Opcional: extension `BlurCinnamon@klangman` para efecto glass

## Uso

1. Anade el applet al panel (clic derecho → Applets)
2. Quita el reloj/calendario original si quieres
3. Haz clic sobre Media Clock para abrir la Dynamic Island
4. Reproduce musica en cualquier reproductor MPRIS

## Licencia

GPL-3.0 - Ver archivo LICENSE
