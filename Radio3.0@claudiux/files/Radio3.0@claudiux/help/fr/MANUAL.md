<!-- Required extensions: sane_lists, headerid(level=4) -->
# Radio3.0 - Manuel

## Auteur: Claudiux (@claudiux sur Github)

### Date de dernière révision: 19 décembre 2022

***

## Aperçu

Radio3.0 est une applet * Récepteur & Enregisteur de Radios Internet * pour Cinnamon.


Avec Radio3.0 vous pouvez :

  * Écouter tout type de flux radio (MP3, AAC, AAC+, OGG, FLAC, FLV...)

  * Modifier le volume sonore de la radio, indépendamment du volume sonore général.

   * Effectuer des recherches dans une base de données Internet qui référence des dizaines de milliers de stations de radio.

   * Importer des fichiers contenant l'URL des flux de stations de radio, obtenus à partir d'annuaires Internet tels que SHOUTcast.

   * Créer votre liste de radios préférées, accessible par le menu de cette applet.

   * Gérer votre liste de radios préférées : ajouter, déplacer, supprimer, modifier chaque radio de votre liste.

   * Créer des catégories et trier vous-même vos radios préférées.

   * Enregistrer et restaurer des listes entières de radios.

   * Enregistrer des chansons ou des programmes tout en les écoutant.

   * Planifier des enregistrements en arrière-plan.

   * Essayer d'enregistrer à partir de YouTube la chanson en cours de lecture. (Peu sûr ; une autre chanson peut être enregistrée.)

   * Regarder des vidéos sur YouTube sur la chanson en cours de lecture.

   * Extraire la bande son d'une vidéo YouTube.

   * Lancer et utiliser _Pulse Effects_ (si installé) pour une expérience sonore incroyable.

![Screenshots of Menu and Contextual menu][screenshot]{ width=660px }

***

<a name="TOC"></a>
## Sommaire

  1. [Dépendances](#Dependencies)

  1. [Installation manuelle des dépendances](#DepManualInstall)  
      1. [Linux Mint, Ubuntu, Debian](#DepMint)  
      1. [Arch](#DepArch)  
      1. [Fedora](#DepFedora)  

  1. [Comment installer la dernière version de yt-dlp ?](#InstallYtdlp)

  1. [Comment installer l'applet Radio3.0 ?](#InstallApplet)  

  1. [Où placer l'icône de l'applet Radio3.0 ?](#WhereToPlace)

  1. [Utilisation de l'applet Radio3.0](#UsingApplet)  
      1. [Comment ajouter des radios à ma liste ?](#HowToAdd)  
      1. [Écouter une radio](#ListenRadio)  
      1. [Écouter la dernière radio écoutée](#ListenLastRadio)  
      1. [Écouter au démarrage de Cinnamon la dernière radio écoutée](#ListenAtStartup)  
      1. [Arrêter la radio](#StopRadio)  
      1. [Régler le volume du flux radio](#SetVolume)  
      1. [Gérer la liste de mes radios](#ManageRadios1)  
      1. [Enregistrer une chanson ou une émission de radio](#RecordingSong)  
      1. [Extraire la bande son d'une vidéo YouTube](#RecordYTSoundtrack)
      1. [Ouvrir le dossier contenant mes enregistrements](#OpenRecFolder)  
      1. [Modifier mes enregistrements](#ModifyRecords)  

  1. [Paramètres](#Settings)  
      1. [Radios](#RadiosTab)  
        * [Stations et Catégories au menu](#RadiosTabStations)  
        * [Déplacement des stations/catégories sélectionnées](#RadiosTabMoving)  
        * [Enregistrer et restaurer](#RadiosTabSaveRestore)  
        * [Mettre à jour votre liste à l'aide de la base de données radio](#RadiosTabUpdate)  
      2. [Rechercher](#SearchTab)  
        * [Formulaire de recherche](#SearchTabForm)  
        * [Résultats de la recherche](#SearchTabResults)  
      3. [Importer](#ImportTab)  
      4. [Menu](#MenuTab)  
      5. [Réseau](#NetworkTab)  
      6. [Comportement](#BehaviorTab)  
      7. [Enregistrement](#RecordingTab)  
      8. [YT](#YTTab)
      9. [Planification](#SchedulingTab)  

  1. [Optionnel: Installer PulseEffects](#PulseEffects)


  + [Annexe](#Annex)

***
<a name="Dependencies"></a>
## Dépendances

Radio3.0 utilise:

  * _mpv_ (un lecteur multimédia efficace) pour lire les flux radio.

  * _sox_ (Sound eXchange) pour enregistrer dans un fichier le flux radio, ou plutôt le son sortant de votre carte son.

  * _pacmd_ (PulseAudio Command) qui est un outil pour piloter _pulseaudio_.

  * _at_ pour programmer des enregistrements.

  * _libnotify-bin_ pour afficher des notifications.

  * _youtube-dl_ ou _yt-dlp_ (plus rapide que _youtube-dl_) pour télécharger des vidéos à partir de YouTube.

  * _ffmpeg_ et _ffmpegthumbnailer_ pour extraire la bande son de la vidéo téléchargée.

  * _python3-polib_ pour installer les traductions, lorsqu'elles existent.

  * _python3-brotli_ dont a besoin _yt-dlp_.

Si les packages contenant ces outils et bibliothèques ne sont pas déjà installés, vous êtes invité à les installer lors de la première utilisation de Radio3.0.

Vous pouvez également installer _Pulse Effects_ pour utiliser plusieurs effets sonores (réverbération, etc.), mais cela est facultatif.

[Retour à la table des matières](#TOC)

<a name="DepManualInstall"></a>
## Installation manuelle des dépendances

<a name="DepMint"></a>
### Linux Mint, Ubuntu, Debian

`sudo apt update`

`sudo apt install mpv libmpv1 libmpv-dev sox libsox-fmt-all pulseaudio pulseaudio-utils at libnotify-bin youtube-dl ffmpeg ffmpegthumbnailer python3-polib python3-brotli`

Éventuellement:

`sudo apt install pulseeffects`

<a name="DepArch"></a>
### Arch

`sudo pacman -Syu mpv sox pulseaudio at libnotify youtube-dl ffmpeg ffmpegthumbnailer python-brotli`

`yay -S python-polib`

Pour installer Yay sur Arch Linux et d'autres systèmes basés sur Arch, exécutez les commandes suivantes une par une :

`sudo pacman -S --needed git base-devel`

`git clone https://aur.archlinux.org/yay.git`

`cd yay`

`makepkg -si`

<a name="DepFedora"></a>
### Fedora

`sudo dnf install mpv sox pulseaudio at libnotify yt-dlp ffmpeg gstreamer1-libav python3-brotli python3-polib`

[Retour à la table des matières](#TOC)

***
<a name="InstallYtdlp"></a>
## Comment installer la dernière version de yt-dlp ?
Veuillez noter qu'à partir de sa version 1.0.3, Radio3.0 installe et met à jour automatiquement _yr-dlp_ dans votre répertoire `~/bin/`.

_yt-dlp_ est utilisé par **Radio3.0** pour télécharger des vidéos depuis YouTube.

La dernière version de _yt-dlp_ corrige des bugs et tient notamment mieux compte des cookies de votre navigateur pour ne pas vous priver du droit de télécharger des vidéos pour des raisons de limite d'âge.

Voici comment installer sa dernière version :

   1. Commencer par installer la version de _yt-dlp_ présente dans les dépôts de paquets de votre distribution, car cela installe également toutes ses dépendances. Par example: `sudo apt install yt-dlp`
  1. Créer le répertoire `$HOME/bin` qui contiendra cette nouvelle version : `mkdir -p $HOME/bin`
  1. Télécharger la dernière version pour Linux à partir de [https://github.com/yt-dlp/yt-dlp/releases/latest](https://github.com/yt-dlp/yt-dlp/releases/latest) et l'enregistrer dans le répertoire `$HOME/bin` que vous venez de créer.
  1. Le rendre exécutable : `chmod +x $HOME/bin/yt-dlp`
  1. Déconnectez-vous de votre session.
  1. Connectez-vous. Désormais, tout script de votre répertoire `$HOME/bin` a priorité sur tout autre script portant le même nom sur votre système.

***

<a name="InstallApplet"></a>
## Comment installer l'applet Radio3.0 ?

![Radio3.0 - Installation de l'applet et des dépendances](https://claudeclerc.fr/downloads/Radio3.0/Radio3.0-Install.gif)

<a name="InstallAppletCS"></a>

Clic droit sur un panneau -> Applets -> onglet Télécharger : Télécharger Radio3.0. Ensuite, activer l'onglet Gérer et ajouter Radio3.0 au panneau.

<a name="WhereToPlace"></a>
## Où placer l'icône de l'applet Radio3.0 ?

Le meilleur endroit est près de l'applet _Son_. Vous pouvez donc facilement contrôler le volume général avec l'applet _Son_ et le volume radio avec l'applet Radio3.0.

(Pour déplacer des applets, utilisez le "Mode d'édition du panneau" dans le menu contextuel d'un panneau. Glissez-déposez les icônes. Quittez ce "Mode d'édition du panneau" lorsque vos icônes d'applet sont à leur place.)

[Retour à la table des matières](#TOC)

***

<a name="UsingApplet"></a>
## Utilisation de l'applet Radio3.0

Cette applet possède un menu (clic gauche) et un menu contextuel (clic droit).

Certaines actions peuvent être effectuées à l'aide d'un clic du milieu ou d'un défilement sur l'icône.

<a name="HowToAdd"></a>
### Comment ajouter des radios à ma liste ?
Il existe quatre façons d'ajouter au moins une station de radio dans votre liste.

   1. Dans le menu, sélectionnez l'option "Rechercher de nouvelles stations...". (Vous pouvez aussi utiliser l'option "Configurer..." du menu contextuel, puis sélectionner l'onglet "Rechercher".) Utilisez le formulaire pour interroger la base de données internet contenant plusieurs dizaines de milliers de références.

   1. Vous pouvez importer des fichiers contenant des données de stations de radio, en utilisant l'onglet "Importer" (avec la même option "Configurer..." du menu contextuel).

   1. Vous pouvez directement ajouter une station de radio à votre liste, si vous connaissez son URL de diffusion. Votre liste se trouve dans l'onglet "Radios" (le premier onglet ouvert lorsque vous sélectionnez "Configurer..."). Utilisez le bouton `[+]` pour ajouter une station de radio. Seuls les champs "Nom" et "URL du flux" sont obligatoires ; les autres sont facultatifs. Les champs "Codec" et "Bitrate" seront automatiquement remplis après l'arrêt de la radio.

   1. Restaurer la liste Radio3.0_EXAMPLES.json, en utilisant le bouton situé dans le premier onglet des paramètres de cette applet. Attention, votre liste de stations sera remplacée par celle-ci ; pensez à enregistrer votre propre liste de stations avant de le faire !

Chacun de ces onglets contient des explications sur son utilisation. Ceux-ci peuvent être ignorés en décochant la case appropriée dans l'onglet "Comportement".

<a name="ListenRadio"></a>
### Écouter une radio

   * Ouvrez le menu de Radio3.0 (en cliquant sur son icône).

   * Ouvrez le sous-menu "Toutes mes radios".

   * Sélectionnez une station de radio et attendez quelques secondes. Le temps d'attente dépend de la distance qui vous sépare du serveur de flux et de la qualité de ce flux.

Veuillez noter que les dernières stations de radio sélectionnées apparaissent dans la partie * Stations récemment écoutées * du menu pour leur donner un accès rapide.

Lors de l'écoute d'une radio, la couleur de l'icône symbolique change (vert par défaut ; vous pouvez sélectionner une autre couleur).

<a name="ListenLastRadio"></a>
### Allumer la dernière radio écoutée

Lorsqu'aucune radio ne joue, cliquez avec le bouton central sur l'icône.

(Autre façon : Cliquez sur la première radio dans la section *Stations récemment écoutées* du menu.)

<a name="ListenAtStartup"></a>
### Jouez au démarrage de Cinnamon la dernière radio que vous avez écoutée

Cochez l'option "Radio allumée au démarrage" dans le menu contextuel.

<a name="StopRadio"></a>
### Arrêter la radio

Il existe deux manières d'arrêter la radio :

   * En choisissant *Arrêt* dans le menu.

   * Faire un clic du milieu (c'est-à-dire cliquer avec la molette de la souris) sur l'icône.

Lorsque la radio est OFF, la couleur du symbolique est celle par défaut (gris par défaut ; vous pouvez sélectionner une autre couleur).

<a name="SetVolume"></a>
### Régler le volume du flux radio

Faire rouler la molette de la souris sur l'icône vers le haut ou vers le bas permet de régler le volume du flux radio actuel.

L'utilisation du curseur de volume dans le menu contextuel a le même effet.

Veuillez noter que ces actions n'ont aucun effet sur le volume général ; utilisez l'icône de l'applet _Son_ pour régler le volume général.

<a name="ManageRadios1"></a>
### Gérer la liste de mes radios

Sélectionnez *Configurer...* dans le menu ou dans le menu contextuel pour accéder aux réglages (voir [ci-dessous](#RadiosTab)).

<a name="RecordingSong"></a>
### Enregistrer une chanson ou une émission de radio

<u>Condition</u>: Cocher la case dans la section Consentement de l'onglet Enregistrements dans les paramètres de cette applet.

<u>Première façon</u>: Sélectionner _Démarrer l'enregistrement_ dans le menu contextuel.

<u>Seconde façon</u>: Cliquer sur le bouton _Enregistrer à partir de maintenant_ de la notification lorsqu'elle apparaît à l'écran. Passer la souris sur ce bouton vous permet d'attendre le début de la chanson sans que la notification ne disparaisse. Si la notification disparaît avant que vous puissiez cliquer sur ce bouton, vous devrez utiliser l'option *Démarrer l'enregistrement* du menu contextuel.

Cette deuxième façon dépend de la capacité de votre flux à donner le titre de la chanson ou de l'émission.

Pendant l'enregistrement, la couleur de l'icône symbolique change (rouge par défaut ; vous pouvez sélectionner une autre couleur).

<u>Veuillez noter</u>:

  * Si le flux radio donne le titre de la chanson ou de l'émission, alors l'enregistrement s'arrêtera automatiquement à la fin de cette chanson ou de ce programme. Attention aux pauses publicitaires annoncées dans le stream !

   * Sinon, vous devrez arrêter de vous enregistrer (en utilisant le menu contextuel).

   * L'enregistrement commence au moment du clic ; il n'est pas possible de le démarrer plus tôt. Trop peu de stations annoncent la chanson suivante plusieurs secondes à l'avance.

   * L'enregistrement se termine généralement quelques secondes après la fin du morceau, car il continue pendant que le cache se vide.

<a name="RecordYTSoundtrack"></a>
### Extraire la bande son d'une vidéo YouTube

Dans le menu contextuel : Extraire la bande son d'une vidéo YouTube...

Allez ensuite en bas de la fenêtre qui vient de s'afficher, collez l'URL de la vidéo YouTube dans le champ approprié et cliquez sur "Extraire la bande son".

<a name="OpenRecFolder"></a>
### Ouvrir le dossier contenant mes enregistrements

Dans le menu contextuel : Ouvrir le dossier des enregistrements.

<a name="ModifyRecords"></a>
### Modifier mes enregistrements

Vous pouvez utiliser un programme externe comme Audacity pour modifier vos enregistrements.

[Retour à la table des matières](#TOC)

***

<a name="Settings"></a>
## Paramètres

Les paramètres sont accessibles depuis le menu ou depuis le menu contextuel à l'aide de l'option _Configurer..._.

![Settings Tabs][sshot_settings_tabs]{ width=600px }

Il y a 9 onglets dans les paramètres de Radio3.0 :

| [Radios](#RadiosTab) | [Rechercher](#SearchTab) | [Importer](#ImportTab)| [Menu](#MenuTab)| [Comportement](#BehaviorTab)| [Réseau](#NetworkTab)| [Enregistrement](#RecordingTab)| [YT](#YTTab)| [Planification](#SchedulingTab)|
|----------------------|----------------------|---------------------|-----------------|-------------------------|-----------------------|---------------------------|--------------|-----------------------------|

[Retour à la table des matières](#TOC)

<a name="RadiosTab"></a>
### Radios

<a name="RadiosTabStations"></a>
#### Stations et Catégories au menu

![Radios Settings Screenshot][sshot_radios_tab1]{ width=670px }

Voici un exemple de liste de stations de radio.

Trois Catégories sont visibles : **Hard Rock & Metal**, **Reggae** et **Techno / Dance**. Elles ont leur URL de streaming vide.

Toutes les autres sont des radios. Celles dont la case **Menu** est cochée apparaissent dans le menu de cette applet (dans le sous-menu "Mes stations de radio" ; voir ci-dessous). Celles dont la case **♪/➟** est cochée peuvent être écoutés immédiatement (les uns après les autres) à l'aide du bouton **♪ Écouter la prochaine station à tester**.

Chaque catégorie ou station peut être déplacée par **glisser-déposer**.

Sous cette liste, la partie gauche contient des **outils** pour modifier le contenu de la liste :

  * ![Plus button][plus_button] pour **ajouter** une Catégorie (renseignez uniquement son nom) ou une Station (renseignez au moins son nom et son URL de diffusion). L'élément ajouté est situé tout en haut de la liste.

  * ![Minus button][minus_button] pour **supprimer** l'élément sélectionné. (Vous sélectionnez un élément en cliquant dessus.)

  * ![Pencil button][pencil_button] pour **modifier** l'élément sélectionné.

  * ![Unchecked button][unchecked_button] pour **désélectionner** tout élément.

  * ![Move up button][moveup_button] pour faire **monter** l'élément sélectionné.

  * ![Move down button][movedown_button] pour faire **descendre** l'élément sélectionné.

La partie droite contient des outils pour explorer votre liste :

  * ![Top button][top_button] pour aller **tout en haut** de votre liste.

  * ![Move up button][moveup_button] pour aller à la **page précédente**.

  * ![Move down button][movedown_button] pour aller à la **page suivante**.

  * ![Bottom button][bottom_button] pour aller **tout en bas** de votre liste.

  * ![Previous Category button][prevcat_button] pour accéder à la **catégorie précédente** (ou à la **catégorie suivante** pour les personnes qui lisent de droite à gauche).

  * ![Next Category button][nextcat_button] pour accéder à la **catégorie suivante** (ou à la **catégorie précédente** pour les personnes qui lisent de droite à gauche).

![Sub-menu My Radio Stations][sshot_menu_myradiostations]{ width=350px }

<a name="RadiosTabMoving"></a>
#### Déplacement des stations/catégories sélectionnées

![Radios Settings Screenshot 2][sshot_radios_tab2]{ width=670px }

Pour changer la catégorie de certains éléments, sélectionnez-les en cochant leur case **♪/➟**, choisissez la catégorie dans la liste déroulante et cliquez sur le bouton "Déplacer les stations sélectionnées vers cette catégorie".

Pour voir le résultat et faire d'éventuels ajustements, cliquez ensuite sur "Se rendre à cette catégorie".

Conseil : Vous pouvez créer une catégorie temporaire et la déplacer au bon endroit, puis déplacer les éléments sélectionnés vers cette catégorie avant de la supprimer.

<a name="RadiosTabSaveRestore"></a>
#### Sauvegarde et restauration

![Radios Settings Screenshot 3][sshot_radios_tab3]{ width=670px }

**Sauvegarder** votre liste de stations avant de la modifier ou de la mettre à jour. Cela crée un fichier `.json` contenant tous les détails de vos stations et catégories. Le nom de ce fichier `.json` décrit la date et l'heure de la sauvegarde ; exemple : `Radios_2022-02-21_22-23-55.json` a été créé le 21 février 2022 à 22:23:55.

**Restaurer** une liste de stations précédemment enregistrée. Attention : Votre liste sera entièrement remplacée par la liste restaurée.

En ouvrant le dossier contenant ces listes, vous pouvez les gérer. Vous pouvez notamment les renommer à votre convenance.

<a name="RadiosTabUpdate"></a>
#### Mettez à jour votre liste à l'aide de la base de données des radios

![Radios Settings Screenshot 4][sshot_radios_tab4]{ width=670px }

Le bouton **Mettre à jour ma liste de stations à l'aide de la base de données** a pour but de compléter au maximum les champs vides de vos radios.

Si la base de données consultée contient l'URL de streaming que vous avez déclarée pour une station, alors un UUID (Universal Unique IDentifier - Identifiant unique universel) sera attribué à cette station.

Si l'une de vos stations n'est plus joignable, essayez de mettre à jour votre liste. L'URL de diffusion de cette station peut avoir changé et si elle a un UUID, sa nouvelle URL peut lui être attribuée.

Une mise à jour ne changera pas le nom que vous avez donné à une station.

Remarques:

   * Si une station provient de la base de données (onglet Recherche), elle possède déjà un UUID.

   * Si elle provient d'une autre source, elle peut être inconnue de la base de données ; elle ne se verra alors pas attribuer d'UUID.

[Tous les onglets](#Settings)

<a name="SearchTab"></a>
### Rechercher

Cet onglet est directement accessible par l'option _Rechercher de nouvelles stations_ du menu.

<a name="SearchTabForm"></a>
#### Formulaire de recherche

![Search Form Screenshot][sshot_search_tab1]{ width=670px }

En remplissant au moins quelques champs de ce formulaire puis en cliquant sur le bouton 'Rechercher...' vous pourrez rechercher d'autres stations dans une base de données radio gratuite accessible via Internet.

À chaque clic sur le bouton "Rechercher...", une nouvelle page de résultats s'affiche dans la deuxième partie de cet onglet, où vous pouvez tester certaines stations et les inclure dans le menu.

Une station déjà dans votre menu n'apparaîtra dans les résultats de recherche que si son URL de diffusion a changé.

Lorsqu'aucune nouvelle page n'apparaît, cela signifie que tous les résultats correspondant à vos critères de recherche ont été affichés.

Si vous modifiez au moins un de vos critères, pensez à mettre le champ 'N° de page suivante' à 1.

Comme d'habitude, le bouton "Réinitialiser" réinitialise chaque champ de ce formulaire à sa valeur par défaut.

<a name="SearchTabResults"></a>
#### Résultats de la recherche

Pour obtenir ces résultats, le formulaire de recherche a été réinitialisé puis rempli avec :

  - Tag: metal
  - Codec: AAC
  - Order: bitrate

![Search Results Screenshot][sshot_search_tab2]{ width=700px }

Pour tester 'TheBlast.fm', cochez sa case **♪** puis cliquez sur le bouton **♪ Jouer la prochaine station à tester**. Remarque : le test d'une station de radio l'ajoute aux « Stations récemment diffusées » dans ce menu d'applet, mais ne l'ajoute pas à votre liste de stations.

Pour importer en haut de votre propre liste une ou plusieurs de ces stations, cochez leur case **Sélectionner** et cliquez sur le bouton **Importer les stations sélectionnées dans ma propre liste**. Ensuite, gérez votre liste à l'aide de l'onglet Radios.

Vous pouvez supprimer des lignes de ces résultats de recherche en cochant leur case **Sélectionner** puis en cliquant sur le bouton **Supprimer...**. Cette action n'affecte pas le contenu de la base de données.

Les boutons **Sélectionner tous les éléments** et **Désélectionner tous les éléments** agissent sur les cases **Sélectionner**.

**<u>Avertissement</u>** : *L'auteur de cette applet n'est pas responsable des résultats affichés après une recherche et ne contrôle pas le contenu des bases de données. Si les stations de radio diffusent des messages ou des idéologies qui vous dérangent, veuillez porter plainte auprès de leurs propriétaires ou de l'État/pays à partir duquel elles diffusent.*

[Tous les onglets](#Settings)

<a name="ImportTab"></a>
### Importer
Cet onglet permet d'importer des radios à partir de fichiers au format M3U, PLS ou XSPF, notamment ceux du répertoire [Shoutcast][shoutcast].

#### Obtenir sur Shoutcast des fichiers à importer ici

![Import Settings Screenshot 1][sshot_import_tab1]

Ce bouton ouvre le répertoire Shoutcast dans votre navigateur.

![Shoutcast Baroque][shoutcast_baroque]

Dans l'exemple ci-dessus, nous voyons comment accéder au fichier XSPF d'une radio. Enregistrez ce fichier en lui donnant le nom de la radio, tout en gardant son extension .xspf.

![Shoutcast Save][shoutcast_save]

<a name="FileToImport"></a>
#### Fichier à importer

![Import Settings Screenshot 2][sshot_import_tab2]

Ce bouton vous permet d'importer un fichier contenant des données de stations de radio.

La description des différents formats de fichiers importables est donnée dans l'[Annexe 1](#Annex1).

[Tous les onglets](#Settings)

<a name="MenuTab"></a>
### Menu

![Menu Settings Screenshot][sshot_menu_tab]

This tab allows you to choose whether or not to display certain items in the this applet menu:

  + The name and version of this applet, like: Radio3.0 v1.0.0.
  + The number of *Recently Played Stations*. A value of 0 disables the display of this list.
  + System items, like *Configure...* and *Sound Settings* (which are already in the contextual menu).

Privacy: If you want to empty your Recently Played Stations list at startup or now, check the box or click on the button.

Useful only for developers: Whether or not to display the *Reload this applet* item in the contextual menu.

[Tous les onglets](#Settings)

<a name="BehaviorTab"></a>
### Behavior

![Behavior1 Settings Screenshot][sshot_behavior1_settings]{ width=700px }

Turn on the radio when Cinnamon starts up: When checked, the last station listened to will be played at Cinnamon start up.

Volume level starting a new radio: Choose this volume. Set it to '(Undefined)' to leave the volume at its last value.

Do not check about dependencies: Check this box when all dependencies are already installed, or when certain dependencies are useless (because you have alternatives).

![Behavior2 Settings Screenshot][sshot_behavior2_settings]{ width=700px }

Volume step scrolling on icon: Choose this step. 0% deactivate volume change scrolling on icon.

![Behavior3 Settings Screenshot][sshot_behavior3_settings]{ width=700px }

Choose the help you want to display.

![Behavior4 Settings Screenshot][sshot_behavior4_settings]{ width=700px }

Choose which notifications you want to display; also the duration of the second kind of notification.

![Behavior5 Settings Screenshot][sshot_behavior5_settings]{ width=700px }

Whether or not to show Codec and Bit Rate in menu and notifications.

![Behavior6 Settings Screenshot][sshot_behavior6_settings]{ width=700px }

Choose the color of the symbolic icon when the radio is on, when the radio is off and during recording.

[Tous les onglets](#Settings)

<a name="NetworkTab"></a>
### Network

![Network Settings Screenshot][sshot_network_settings]{ width=700px }

Network Quality:

  * High: The recordings will be made from a copy of the stream, which guarantees optimal quality.
  * Low: To save your bandwidth, recordings will be made from your audio output; but some sounds can pollute your recordings.

Monitor the network: When checked, the station played will continue after changing the network (VPN, Wifi...)

Proxy: Empty by default. Format: http://[user:pass@]URL[:port]. If empty, the environment variables *http_proxy* and *ALL_PROXY* will be used if present. If set, this proxy will not be used for https requests.

Database Info (read only): The URL of the radio database actually used.

[Tous les onglets](#Settings)

<a name="RecordingTab"></a>
### Recording

![Recording Settings Screenshot][sshot_recording_settings]{ width=700px }

Path to the folder that will contain your future recordings: Choose this folder.

Set this path to default one, which is `~/Music/Radio3.0`. (_Music_ is localized.)

Recording format: FLAC, MP3 (default), OGG, RAW or WAV.

Way to stop recording (please note that this choice will have no effect on any current recording, but on subsequent ones.):

  * automatically, when the current song ends: works correctly only if the stream contains the title of the current song.
  * manually; thus, several recordings can follow one another: you must stop yourself all recording.

[Tous les onglets](#Settings)

<a name="YTTab"></a>
### YT
This tab is directly accessible via the _Extract soundtrack from a YouTube video..._ option in the contextual menu.


![YT Settings Screenshot][sshot_yt_settings]{ width=700px }

Recording format: FLAC, MP3, OGG, RAW and WAV are available formats. MP3 (192 kbps) is selected by default.

Use cookies from: Select the browser you usually use to visit YouTube.

Extract soundtrack from YouTube video: Visiting YouTube, right-click on a video (or playlist) link and select _Copy link_. Then click on the _Paste above the YouTube link you copied_ button. The _YouTube video link_ appears. If it contains **v=** then you can extract the soundtrack of this single video. If it contains **list=** then you can extract the soundtrack from each video of the playlist. You can also decide to save these soundtracks in a sub-directory whose name you specify. The _Extract soundtrack_ button runs the process:

  * Download the video.
  * Extract soundtrack and picture. Use them to create the file in _Recording format_ selected above.
  * Remove video.
  * (Repeat for each video in the playlist.)
  * Send notification allowing you to open the directory containing these files.

[Tous les onglets](#Settings)

<a name="SchedulingTab"></a>
### Planification

Cet onglet est directement accessible via l'option _Planifier un enregistrement en arrière-plan..._ du menu contextuel.

![Scheduling Settings1 Screenshot][sshot_sched1_settings]{ width=700px }

Sélectionnez la radio, la date, l'heure et la durée de l'enregistrement que vous souhaitez programmer, puis cliquez sur le bouton .

Votre session Cinnamon n'a pas besoin d'être ouverte pour que l'enregistrement se produise ; mais votre ordinateur doit être allumé, bien sûr.

Vous serez notifié du début et de la fin de chaque enregistrement.

La liste des enregistrements programmés apparaît dans la liste ci-dessous. Vous pouvez annuler n'importe lequel d'entre eux en cochant la case _Supprimer ?_ et en cliquant sur le bouton _Supprimer les éléments sélectionnés_.

![Scheduling Settings2 Screenshot][sshot_sched2_settings]{ width=700px }

[Tous les onglets](#Settings)

<a name="PulseEffects"></a>
## Facultatif : installer PulseEffects
*PulseEffects* est un égaliseur avancé qui fonctionne avec *PulseAudio*. Il peut appliquer des effets à toutes les applications en cours d'exécution ou des applications sélectionnées.

`apt install libpulse-mainloop-glib0 libpulse0 libpulsedsp pulseaudio-equalizer pulseaudio-module-bluetooth pulseaudio-utils pulseaudio pavumeter pavucontrol paprefs gstreamer1.0-adapter-pulseeffects gstreamer1.0-autogain-pulseeffects gstreamer1.0-crystalizer-pulseeffects gstreamer1.0-convolver-pulseeffects pulseeffects`

Une fois installé, PulseEffects est accessible depuis le menu contextuel de l'applet Radio3.0.

[Retour à la table des matières](#TOC)

***

<a name="Annex"></a>
## Annex

<a name="Annex1"></a>
### Annexe 1: Description des formats de fichiers importables

#### Contenu d'un fichier `.csv` (exemple):

`INC;NAME;URL`  
`true;Radio BluesFlac;https://streams.radiomast.io/radioblues-flac`  
`true;Digital Impulse - Blues;http://5.39.71.159:8990/stream`  

Chaque ligne doit contenir exactement deux points-virgules, ce qui la divise en trois champs.

La première ligne décrit les champs qui se trouvent dans les suivantes.

Le champ INC contient un booléen. Sa valeur (*true* ou *false*) n'a pas d'importance pour l'importation, mais elle doit être présente.

Le champ NAME contient le nom de la station de radio. Il ne doit pas contenir de point-virgule.

Le champ URL contient l'URL du flux de cette station.

#### Contenu d'un fichier `.m3u` (exemple):

`#EXTM3U`  
`#EXTINF:-1,1.FM - Otto's Baroque Music (www.1.fm)`  
`http://185.33.21.111:80/baroque_64`  
`#EXTINF:-1,1.FM - Otto's Baroque Music (www.1.fm)`  
`http://185.33.21.111:80/baroque_mobile_aac`  
`#EXTINF:-1,1.FM - Otto's Baroque Music (www.1.fm)`  
`http://185.33.21.111:80/baroque_128`  
`...etc...`  

La première ligne doit être `#EXTM3U`.

Ensuite, chaque station est décrite par une paire de lignes. Une première ligne commençant par "#EXTINF:-1" et se terminant par le nom de la station ; une seconde ligne contenant l'URL du flux.

Remarque : Le `-1` après `#EXTINF:` signifie que la durée de la piste est inconnue, ce qui est normal pour un flux radio.

#### Contenu d'un fichier `.xpfs` (exemple):

    <?xml version="1.0" encoding="utf-8"?><playlist version="1" xmlns="http://xspf.org/ns/0/"><title>1.FM - Otto's Baroque Music (www.1.fm)</title><trackList><track><location>http://185.33.21.111:80/baroque_128</location><title>1.FM - Otto's Baroque Music (www.1.fm)</title></track><track><location>http://185.33.21.111:80/baroque_64</location><title>1.FM - Otto's Baroque Music (www.1.fm)</title></track>...other tracks...</trackList></playlist>

Toutes les données sont enregistrées sur une seule ligne. Les voici présentées de manière plus compréhensible :

    <?xml version="1.0" encoding="utf-8"?>
    <playlist version="1" xmlns="http://xspf.org/ns/0/">
        <title>1.FM - Otto's Baroque Music (www.1.fm)</title>
        <trackList>
            
            <track>
                <location>http://185.33.21.111:80/baroque_128</location>
                <title>1.FM - Otto's Baroque Music (www.1.fm)</title>
            </track>
            
            <track>
                <location>http://185.33.21.111:80/baroque_64</location>
                <title>1.FM - Otto's Baroque Music (www.1.fm)</title>
            </track>
            
            ...other tracks...
        </trackList>
    </playlist>

La première ligne décrit la version de XML et le codage de caractères utilisé. Tous les fichiers au format XPFS commencent par ceci.

La liste de lecture est décrite entre les balises `<playlist>` et `</playlist>`.

Le premier *titre* (entre `<title>` et `</title>`) est celui de la playlist. (Dans ce cas, il s'agit du nom de la radio.)

La liste des pistes est située entre les balises `<tracklist>` et `</tracklist>`.

Chaque *piste* contient, dans cet ordre, un *emplacement* - c'est-à-dire l'URL du flux - et un *titre*, qui aurait pu être plus explicite ici en indiquant le débit et le format du flux.

#### Contenu d'un fichier `.pls` (exemple) :
    [playlist]
    numberofentries=8
    File1=http://185.33.21.111:80/baroque_mobile_aac
    Title1=1.FM - Otto's Baroque Music (www.1.fm)
    Length1=-1
    File2=http://185.33.21.111:80/baroque_64
    Title2=1.FM - Otto's Baroque Music (www.1.fm)
    Length2=-1
    ...6 other entries...

Un fichier `.pls` commence par une ligne contenant uniquement `[playlist]`.
La deuxième ligne indique que ce fichier contient 8 entrées numérotées de 1 à 8.

Chaque entrée est décrite par un ensemble de 3 lignes successives. Le rôle de chacun d'eux est facilement compréhensible.

[Retour à la section "Fichier à importer"](#FileToImport)

[^](#)


[screenshot]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/screenshot.png
[sshot_settings_tabs]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_Settings_All_Tabs.png
[sshot_radios_tab1]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RadiosTab_1.png
[sshot_radios_tab2]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RadiosTab_2.png
[sshot_radios_tab3]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RadiosTab_3.png
[sshot_radios_tab4]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RadiosTab_4.png
[plus_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_list_add_button.png
[minus_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_list_remove_button.png
[pencil_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_list_edit_button.png
[unchecked_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_checkbox_symbolic_button.png
[moveup_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_up_button.png
[movedown_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_down_button.png
[top_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_top_button.png
[bottom_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_bottom_button.png
[prevcat_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_previous_button.png
[nextcat_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_next_button.png
[sshot_menu_myradiostations]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_Menu_MyRadioStations.png  "My Radio Stations"

[sshot_search_tab1]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_SearchTab_1.png
[sshot_search_tab2]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_SearchTab_2.png

[sshot_import_tab1]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_ImportTab_1.png
[sshot_import_tab2]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_ImportTab_2.png

[sshot_menu_tab]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_MenuTab.png

[sshot_behavior1_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior1-StartUp.png

[sshot_behavior2_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior2-VolumeStep.png

[sshot_behavior3_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior3-ShowHelp.png

[sshot_behavior4_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior4-Notifications.png

[sshot_behavior5_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior5-CodecAndBitrate.png

[sshot_behavior6_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior6-SymbolicIconColor.png

[sshot_recording_settings]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RecordingSettings.png
[sshot_network_settings]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_NetworkSettings.png

[sshot_yt_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_YT_Tab.png

[sshot_sched1_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_SchedulingTab_1.png

[sshot_sched2_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_SchedulingTab_2.png

[shoutcast]: https://directory.shoutcast.com/
[shoutcast_baroque]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Shcst1.png
[shoutcast_save]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Shcst2.png
