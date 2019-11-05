# Spices Update

## Résumé

Les Spices de Cinnamon sont les Applets, Desklets, Extensions et Thèmes.

Habituellement, vous vérifiez si les Spices que vous avez installées disposent de mises à jour à l'aide des Paramètres système de Cinnamon.

Mais, comme moi, vous le faites trop rarement.

L'applet **Spices Update** :

  * vous avertit dès lors que des Spices que vous avez installées disposent d'une mise à jour ;
  * peut vous avertir, si vous le désirez, lorsque de nouvelles Spices sont disponibles ;
  * vous donne un accès direct aux Paramètres système des Applets, Desklets, Extensions et Thèmes ;
  * Et à partir de Cinnamon 3.8 :
    * vous permet de renouveler le téléchargement de la dernière version d'une Spice ;
    * vous garantit de télécharger réellement la toute dernière version d'une Spice ;
    * vous permet d'ignorer complètement les mises à jour disponibles pour les Spices que vous voulez préserver ;
    * vous permet, d'un clic-molette sur son icône, de forcer le rafraîchissement des données à propos des nouvelles Spices et des mises à jour disponibles, ou d'ouvrir toutes les fenêtres nécessaires pour effectuer ces mises à jour.

## État

Disponible de Cinnamon 2.8 à Cinnamon 4.4.

Cette applet est active, c'est-à-dire développée et utilisée par l'auteur sur plusieurs machines fonctionnant sous **Linux Mint**, **Fedora**, **Archlinux** ou **Debian 10**.

À partir de la version v3.0.0 ~ 20190808:

  * Spices Update est compatible avec Cinnamon 2.8 -> 4.2 (Mint 17.3 -> 19.2).
  * De Cinnamon 3.8 à 4.4 (Mint 19 à 19.3): **Parfaitement fonctionnel, comme d'habitude.**
  * De Cinnamon 2.8 à 3.6 (Mint 17.3 à 18.3): certaines fonctionnalités sont réduites:
    * La fenêtre de configuration des Spices ne s'ouvre pas sur le deuxième onglet, mais sur le premier. Vous devrez cliquer sur le deuxième onglet et sélectionner vous-même le tri par date.
    * La fenêtre Paramètres de cet applet ne contient aucun onglet.
    * Dans les paramètres de cette applet, vous ne pouvez pas accéder aux listes des Spices pour désactiver leur surveillance. Par conséquent, toutes les Spices installées sont surveillées.
    * Le script ```generate_mo.sh``` (dans le dossier ```scripts```) vous permet d'installer toutes les traductions disponibles. Redémarrez Cinnamon après l'exécution de ce script.
    * Si la police ```Symbola_Hinted``` ne peut pas s'installer automatiquement, placez-vous dans le dossier ```fonts/symbola``` et double-cliquez sur le fichier ```Symbola_Hinted.ttf```. Installez-la avec l'application ```gnome-font-viewer``` qui vient de s'ouvrir.

L'auteur est ouvert à toute suggestion d'amélioration.

## Dépendances

Spices Update nécessite l'installation de l'outil ```notify-send``` et de la police de caractères ```symbola``` (de type TrueType).

**Cette applet vous aide à installer ces dépendances, si besoin.** En effet, lors de son lancement, l'applet Spice Update vérifie que ces dépendances sont bien installées. Si ce n'est pas le cas, elle vous propose de les installer.

Pour les installer _manuellement_ :

  * Fedora: `sudo dnf install libnotify gdouros-symbola-fonts`
  * Arch:
    * ```sudo pacman -Syu libnotify```
    * `yay -S ttf-symbola` _ou bien_ `pamac build ttf-symbola`
  * Linux Mint: ```sudo apt install libnotify-bin fonts-symbola```
  * Debian (sans sudo):
    * `su`
    * ```apt install libnotify-bin fonts-symbola```

## Configuration

La fenêtre de configuration dispose de cinq onglets.

Le premier, _Général_, vous permet de :

  * Choisir l'_Intervalle de temps entre deux vérifications_ (en heures). Veuillez noter que la première vérification aura lieu une minute après le démarrage de cette applet.
  * Choisir la façon dont vous serez prévenu : par changement de la couleur de l'icône de cette applet et/ou par affichage de messages dans la zone de notification. Vous pouvez également choisir le type de notification: _Minimal_ ou _Avec un bouton_ permettant d'ouvrir l'onglet Télécharger dans les Paramètres système. Si vous le souhaitez également, la notification peut contenir la description de chaque mise à jour ou nouveauté.
  * Choisir le _Type d'affichage_ de l'icône: avec ou sans texte?
  * Cacher l'icône de cette applet tant que rien de nouveau n'est à signaler. _Veuillez noter que les Préférences de Spices Update ne sont accessibles, tant que l'icône n'est pas affichée, qu'en passant par Paramètres système -> Applets._

![system_settings_applet](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/System_Settings_Applets-fr.png)

Quant au contenu des autres onglets (_Applets_, _Desklets_, etc), veuillez consulter la capture d'écran ci-dessous et noter que **la liste des Spices installées est automatiquement remplie** au démarrage, mais qu'un bouton _Actualiser_ vous permet de la recharger (et de rechercher de nouvelles mises à jour).

Réglez sur _FALSE_ le premier commutateur (ou décochez-le à partir de Cinnamon 4.2) de toutes les Spices dont vous ne voulez pas vérifier les mises à jour. Il y a au moins deux raisons à cela:

  * Une Spice vous convient pleinement et vous ne voulez pas être averti d'un quelconque changement la concernant.
  * Vous êtes un développeur travaillant sur une Spice et vous souhaitez qu'elle soit protégée durant son développement.

À partir de Cinnamon 3.8, pour re-télécharger la dernière version d'une Spice, cochez ses deux cases (ou positionnez à TRUE ses deux commutateurs) puis cliquez sur le bouton _Actualiser_.

![settings_spices_update_applets](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/Settings_Spices_Update_Applets-fr.png)

## Menu

Dans le menu de Spices Update (accessible par un clic sur son icône) :

  * un bouton Actualiser vous permet de forcer la vérification de la disponibilité des mises à jour pour vos Spices;
  * un point apparaît devant chaque type de Spices lorsqu'au moins une mise à jour est disponible;
  * un clic sur un type de Spices (applets, desklets, etc.) ouvre l'onglet de téléchargement de la page correspondante dans les paramètres de Cinnamon, avec les Spices triées par date décroissante (les plus récentes en premier);
  * lorsque de nouvelles Spices sont disponibles :
    * une option _Oublier les nouveautés_ apparaît; en cliquant dessus, ces notifications de nouvelles Spices seront effacées jusqu'à l'arrivée d'autres;
  * lorsque de nouvelles Spices ou des mises à jour sont disponibles :
    * une option_Ouvrir les Paramètres système utiles_ (pour effectuer les mises à jour) apparaît;
  * Un bouton _Configurer..._ ouvre la fenêtre de configuration de Spices Update.

## Icône

La couleur de l'icône change lorsqu'au moins une de vos Spices nécessite une mise à jour, ou lorsqu'une nouveauté est signalée.

Depuis Cinnamon 3.8, l'icône de cette applet tourne et sa couleur s'assombrit tandis que le rafraîchissement des données s'effectue.

Un **_Clic-Molette_** (ou clic central) sur l'cône de cette applet :

  * Effectue une actualisation des données tant qu'aucune mise à jour n'est signalée (comme un clic sur Actualiser).
  * Ouvre tous les paramètres système utiles aux mises à jour, lorsque certaines sont signalées.

![hovering_icon](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/hovering_icon-fr.png)

## Notifications
Il existe deux types de notifications: _Minimale_ or _Avec boutons_. Chacune d’elles peut contenir ou non des détails: le motif d’une mise à jour ou la description d’une nouvelle épice.

### Notifications minimales
Ici avec la raison de la mise à jour :

![notif_simple_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_simple_with_details-fr.png)

### Notifications avec boutons
Deux boutons sont présents : l'un pour ouvrir la page Paramètres système afin de télécharger les mises à jour ; l'autre pour actualiser les notifications.

![notif_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_with_details2-fr.png)

## Traductions

Toute traduction est la bienvenue. Merci de contribuer en traduisant les messages de l'applet dans de nouvelles langues ou en améliorant/complétant les traductions existantes.

### Traductions disponibles et leurs auteurs

  * Croate (hr): muzena
  * Néerlandais (nl): Jurien (French77)
  * Finnois (fi): MahtiAnkka
  * Français (fr): claudiux
  * Allemand (de): Mintulix
  * Italien (it): Dragone2
  * Espagnol (es): claudiux
  * Suédois (sv): Åke Engelbrektson (eson57)

Un grand merci à eux !

### Comment proposer une traduction

  1. Créer un compte sur [Github](https://github.com/).
  2. Faire un Fork du dépôt [cinnamon-spices-applets](https://github.com/linuxmint/cinnamon-spices-applets).
  3. Dans votre fork, créer une branche (la nommer comme `SpicesUpdate-CODE_LANGUE`) à partir de la branche master.
  4. Sur votre ordinateur, installer `git` et `poedit`.
  5. Cloner votre branche sur votre ordinateur : `git clone -b SpicesUpdate-CODE_LANGUE --single-branch https://github.com/VOTRE_COMPTE_GITHUB/cinnamon-spices-applets.git SpicesUpdate-CODE_LANGUE`
  6. Ouvrir le fichier `SpicesUpdate@claudiux.pot` (qui est dans le dossier `po`) avec poedit et créer votre traduction. Vous obtenez une fichier CODE_LANGUE.po.
  7. Sur Github, envoyer le fichier `CODE_LANGUE.po` au bon endroit dans votre branche puis aller à la racine de votre branche et faire un Pull Request.

## Installation

### Installation automatique :

Utilisez le menu _Applets_ dans les Paramètres système de Cinnamon ou _Ajouter des Applets au tableau de bord_ dans le menu contextuel (clic droit) du panneau de votre bureau. Ensuite, cliquez sur l'onglet Télécharger pour installer cette applet Spices Update.

### Installation manuelle :

  * Installer les programmes supplémentaires requis.
  * Télécharger la [dernière version de Spices Update](https://cinnamon-spices.linuxmint.com/files/applets/SpicesUpdate@claudiux.zip?04831377-cbe4-482d-b035-b8ce9349632e).
  * Décompresser et extraire le dossier ```SpicesUpdate@claudiux``` dans ``` ~/.local/share/cinnamon/applets/```
  * Activer cette applet dans Paramètres système -> Applets.
  * Vous pouvez également accéder à la fenêtre de configuration à partir de Paramètres système -> Applets ou du menu de cet applet (en cliquant sur son icône).

## Une Étoile pour remercier l'auteur

Si vous appréciez les services rendus par Spices Update, n'offrez ni argent ni café à l'auteur, mais connectez-vous et cliquez sur l'étoile en haut de **[cette page](https://cinnamon-spices.linuxmint.com/applets/view/309)**.

Merci à vous.
