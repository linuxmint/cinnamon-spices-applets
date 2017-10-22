/*
 *
 *  Cinnamon applet - sports-update
 *  Displays a list of all live score udpates, final scores, upcoming 
 * 	schedules, cancelled and delayed games
 * 
 *  - Live score updates available for :
 *      - Cricket (International, IPL, Firstclass, County, Clubs)
 * 		- Football (International, UK, USA and European)
 * 		- Golf
 * 	  	- Basketball (NBA, WNBA, NCAA basketball)
 * 		- American football (NFL)
 * 		- Baseball (MLB)
 *      - Ice hockey (NHL)
 *      - Tennis	(Updates discontinued)
 * 		- Motorsports 	(Updates discontinued)
 *
 *  Author
 *	 Pavan Reddy <pavankumar.kh@gmail.com>
 *
 * This file is part of sports-update.
 *
 * sports-update is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * sports-update is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with sports-update.  If not, see <http://www.gnu.org/licenses/>.
 */

/*------------------------
 * Imports
 * ------------------------*/
imports.searchPath.push( imports.ui.appletManager.appletMeta["sports-update@pavanred"].path );

const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const _ = Gettext.gettext;
const Lang = imports.lang;
const AppletDir = imports.ui.appletManager.appletMeta['sports-update@pavanred'].path;
const AppletMeta = imports.ui.appletManager.applets['sports-update@pavanred'];
const AppSettings = AppletMeta.settings.Values;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;

const LiveScore = imports.liveScore;
const conf_script = GLib.build_filenamev([global.userdatadir, 'applets/sports-update@pavanred/settings.js']);

/*------------------------
 * Constants
 * ------------------------*/

const UUID = 'sports-update@pavanred';
const PANEL_TOOL_TIP = "Live score udpates";
const NO_UPDATES = "No live score updates";
const SETTINGS = "Settings";
const REFRESH = "Refresh";
const LIVE = "LIVE";
const REFRESH_ERROR = "Unable to refresh scores";
const CMD_SETTINGS = "cinnamon-settings applets " + UUID;

//settings keys
const CRIC_INTL_KEY = "cricket_international_updates";
const CRIC_IPL_KEY = "cricket_india_updates";
const CRIC_ALL_KEY = "cricket_all_updates";

const FB_INTL_KEY = "football_international_updates";
const FB_EUR_KEY = "football_europe_updates";
const FB_UK_KEY = "football_uk_updates";
const FB_USA_KEY = "football_usa_updates";

const BB_NBA_KEY = "basketball_updates";
const BB_WNBA_KEY = "women_basketball_updates";
const BB_NCAA_KEY = "ncaa_basketball_updates";

const AF_KEY = "americanfootball_updates";
const IH_KEY = "icehockey_updates";
const B_KEY = "baseball_updates";
const G_KEY = "golf_updates";

const CANCELLED_KEY = "display_cancelled";
const DELAYED_KEY = "display_delayed";
const FINAL_KEY = "display_finalscores";
const SCHEDULE_KEY = "display_upcoming_schedules";
const REFRESH_INTERVAL_KEY = "refresh_interval";

const KEYS = [
  CRIC_INTL_KEY,
  CRIC_IPL_KEY,
  CRIC_ALL_KEY,
  FB_INTL_KEY,
  FB_EUR_KEY,
  FB_UK_KEY,
  FB_USA_KEY,
  BB_NBA_KEY,
  BB_WNBA_KEY,
  BB_NCAA_KEY,
  AF_KEY,
  IH_KEY,
  B_KEY,
  G_KEY,
  CANCELLED_KEY,
  DELAYED_KEY,
  FINAL_KEY,
  SCHEDULE_KEY,
  REFRESH_INTERVAL_KEY
]

//icons
const FOOTBALL_ICON = "/images/icon-football.png";
const BASKETBALL_ICON = "/images/icon-basketball.png";
const AFOOTBALL_ICON = "/images/icon-americanfootball.png";
const BASEBALL_ICON = "/images/icon-baseball.png";
const ICEHOCKEY_ICON = "/images/icon-icehockey.png";
const GOLF_ICON = "/images/icon-golf.png";
const TENNIS_ICON = "/images/icon-tennis.png";
const MOTORSPORT_ICON = "/images/icon-racing.png";
const CRICKET_ICON = "/images/icon-cricket.png";


//score update urls
const NBA_APIROOT = "http://sports.espn.go.com/nba/bottomline/scores";
const NFL_APIROOT = "http://sports.espn.go.com/nfl/bottomline/scores";
const MLB_APIROOT = "http://sports.espn.go.com/mlb/bottomline/scores";
const NHL_APIROOT = "http://sports.espn.go.com/nhl/bottomline/scores";
const WNBA_APIROOT = "http://sports.espn.go.com/wnba/bottomline/scores";
const NCAA_APIROOT = "http://sports.espn.go.com/ncb/bottomline/scores";
const FB_US_APIROOT = "http://soccernet.espn.go.com/bottomline/scores/scores?scoresSource=usa";
const FB_UK_APIROOT = "http://soccernet.espn.go.com/bottomline/scores/scores?scoresSource=uk";
const FB_INT_APIROOT = "http://soccernet.espn.go.com/bottomline/scores/scores?scoresSource=inter";
const FB_EUR_APIROOT = "http://soccernet.espn.go.com/bottomline/scores/scores?scoresSource=euro";
const GOLF_APIROOT = "http://sports.espn.go.com/sports/golf/bottomLineGolfLeaderboard";
const TENNIS_APIROOT = "http://sports.espn.go.com/sports/tennis/bottomline/scores";
const MOTOR_APIROOT = "http://sports.espn.go.com/rpm/bottomline/race";
const CRICKET_APIROOT = "http://cricscore-api.appspot.com/csa";

function sports_update(metadata, orientation, panelHeight, instanceId) {
	this.settings = new Settings.AppletSettings(this, UUID, instanceId)
	this._init(orientation, panelHeight, instanceId);
}

sports_update.prototype = {
		__proto__: Applet.TextIconApplet.prototype,

		_init: function(orientation, panelHeight, instanceId) {
			Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

			for (let k in KEYS) {
				let key = KEYS[k]
				let keyProp = "_" + key
				this.settings.bindProperty(Settings.BindingDirection.IN, key, keyProp, null, null)
			}
			
			this._refresh_interval = parseInt(this._refresh_interval) * 60; //convert to seconds

			var sports = [];
			this.responseCount = 0;
			
			try {
					
				if(this._basketball_updates){
					var sportItem = {Apiroot: NBA_APIROOT, Icon: BASKETBALL_ICON, Sport: "basketball"};
					sports[sports.length] = sportItem;
				}
				if(this._americanfootball_updates){
					var sportItem = {Apiroot: NFL_APIROOT, Icon: AFOOTBALL_ICON, Sport: "a_football"};
					sports[sports.length] = sportItem;
				}	
				if(this._baseball_updates){
					var sportItem = {Apiroot: MLB_APIROOT, Icon: BASEBALL_ICON, Sport: "baseball"};
					sports[sports.length] = sportItem;
				}
				if(this._icehockey_updates){		
					var sportItem = {Apiroot: NHL_APIROOT, Icon: ICEHOCKEY_ICON, Sport: "icehockey"};
					sports[sports.length] = sportItem;
				}
				if(this._women_basketball_updates){
					var sportItem = {Apiroot: WNBA_APIROOT, Icon: BASKETBALL_ICON, Sport: "basketball"};
					sports[sports.length] = sportItem;
				}	
				if(this._ncaa_basketball){
					var sportItem = {Apiroot: NCAA_APIROOT, Icon: BASKETBALL_ICON, Sport: "basketball"};
					sports[sports.length] = sportItem;			
				}
				if(this._football_europe_updates){		
					var sportItem = {Apiroot: FB_EUR_APIROOT, Icon: FOOTBALL_ICON, Sport: "football"};
					sports[sports.length] = sportItem;		
				}
				if(this._football_international_updates){		
					var sportItem = {Apiroot: FB_INT_APIROOT, Icon: FOOTBALL_ICON, Sport: "football"};
					sports[sports.length] = sportItem;
				}
				if(this._football_uk_updates){
					var sportItem = {Apiroot: FB_UK_APIROOT, Icon: FOOTBALL_ICON, Sport: "football"};
					sports[sports.length] = sportItem;	
				}
				if(this._football_usa_updates){
					var sportItem = {Apiroot: FB_US_APIROOT, Icon: FOOTBALL_ICON, Sport: "football"};
					sports[sports.length] = sportItem;		
				}
				if(this._golf_updates){
					var sportItem = {Apiroot: GOLF_APIROOT, Icon: GOLF_ICON, Sport: "golf"};
					sports[sports.length] = sportItem;	
				}
				/*if(this._motorsports_updates){
					var sportItem = {Apiroot: MOTOR_APIROOT, Icon: MOTORSPORT_ICON, Sport: "motorsports"};
					sports[sports.length] = sportItem;	
				}
				if(this._tennis_updates){
					var sportItem = {Apiroot: TENNIS_APIROOT, Icon: TENNIS_ICON, Sport: "tennis"};
					sports[sports.length] = sportItem;	
				}*/
				if(this._cricket_international_updates){
					var sportItem = {Apiroot: CRICKET_APIROOT, Icon: CRICKET_ICON, Sport: "cricket_international"};
					sports[sports.length] = sportItem;	
				}
				if(this._cricket_india_updates){
					var sportItem = {Apiroot: CRICKET_APIROOT, Icon: CRICKET_ICON, Sport: "cricket_ipl"};
					sports[sports.length] = sportItem;	
				}
				if(this._cricket_all_updates){
					var sportItem = {Apiroot: CRICKET_APIROOT, Icon: CRICKET_ICON, Sport: "cricket"};
					sports[sports.length] = sportItem;	
				}
					
				this.refreshInterval = parseInt(this._refresh_interval);
	
				//set panel icon and tool tip
				this.set_applet_tooltip(PANEL_TOOL_TIP);	
				this.set_applet_label("");
				this.set_applet_icon_path(AppletDir + FOOTBALL_ICON);
				
				//main menu
				this.menuManager = new PopupMenu.PopupMenuManager(this);
				this.menu = new MyMenu(this, orientation);
				this.menuManager.addMenu(this.menu);

				//settings menu 
                this.settingsMenu = new Applet.MenuItem(_(SETTINGS), 'system-run-symbolic',Lang.bind(this,this._settings));
                this._applet_context_menu.addMenuItem(this.settingsMenu);
                
                //refresh menu
                //this.refreshMenu = new Applet.MenuItem(_(REFRESH), Gtk.STOCK_REFRESH ,Lang.bind(this,this._refresh));
                //this._applet_context_menu.addMenuItem(this.refreshMenu);
				
				this.sports = sports;
				this.orientation = orientation;
				this.liveScores = [];
				
				//get and display scores
				this._getScores();

			}
			catch (e) {
				log("exception:"  + e);
			};
		},
		
		on_applet_clicked: function(event) {
			this.menu.toggle();
		},

		//add a score item to the menu
		_addScoreItem: function(updateText, icon, arrDetailText, url) {
			
			try{
				
				let iconPath = AppletDir + icon;

				this.scoreItem = new MyPopupMenuItem(iconPath, _(updateText), arrDetailText);

				this.menu.addMenuItem(this.scoreItem);
				
				this.scoreItem.connect('activate', Lang.bind(this, function () {
					 Main.Util.spawnCommandLine("xdg-open " + url);
					 return true;
				}));
				
			} catch (e){
				log("exception: "  + e);}
		},
		
		_addHeaderItem: function(text) {
			
			try{
				
				this.headerItem = new PopupHeaderMenuItem(_(text));
				this.menu.addMenuItem(this.headerItem);
				
			} catch (e){
				log("exception: "  + e);}
			
		},
		
		//get score updates for all sports
		_getScores: function(){
			
			try{
				let _this = this;
				
				let sports = this.sports;
				let orientation = this.orientation;
				
				this.refreshInterval = parseInt(this._refresh_interval);
				
				//flag sports list beginning and end to clear/remove items on menu refresh
				if(sports.length > 0){
					this.initCycle = sports[0].Apiroot;
				}
				else{
					this.initCycle = null;
				}
				
				this.endCycle = sports[sports.length - 1].Apiroot;
				
				
				for (var i = 0; i < sports.length; i++) {
					
						this.ls = new LiveScore.LiveScore({
						'apiRoot': sports[i].Apiroot,
						'icon': sports[i].Icon,
						'sport': sports[i].Sport,
						'displayCancelled': this._display_cancelled,
						'displayDelayed': this._display_delayed,
						'displayFinal': this._display_finalscores,
						'displaySchedule': this._display_upcoming_schedules,
						'callbacks':{
							'onError':function(status_code){_this._onLiveScoreError(status_code)},
							'onScoreUpdate':function(response){_this._onScoreUpdate(response);}
						}
					});
					
					if(!this.ls.initialised()){
						this._onSetupError(); 
						return;
					}

					this.ls.loadScores();	
				}
				
				Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, function() {
					
					this._getScores();
				}));
				
			} catch (e){
				log("exception: "  + e);}		
		},	
		
		_settings: function(){
			//Open settings file
			//Main.Util.spawnCommandLine("xdg-open " + conf_script);
			Util.spawnCommandLine(CMD_SETTINGS);
            this.close();
		}, 
		
		_refresh: function(){
			if(this.sports.length > 0){
				this._getScores();
			}
		},
		
		_onSetupError: function() {
			try{
				this.set_applet_tooltip(_("Unable to refresh scores"));

				this._addScoreItem(REFRESH_ERROR, null, [], "");	

			} catch (e){
				log("exception: "  + e);}
		},	
			
		_onLiveScoreError: function() {

			this.onSetupError();
		},	
			
		_onScoreUpdate: function(response) {
				
			try{

				if(this.menu.length <= 0){
					this.liveScores = [];
					this._addScoreItem(NO_UPDATES, null, [], "");	
				}
				
				this.responseCount = this.responseCount + 1;
				
				if(this.responseCount == this.sports.length){
					
					this.responseCount = 0;
					this.menu.removeAll();
					
					if(this.liveScores.length <= 0){
							this.set_applet_label("");
							this._addScoreItem(NO_UPDATES, null, [], "");	
					}
					else{
						
						var orderedScores = this.liveScores.sort(function(a,b) { 
							  if (a.Type < b.Type)
								 return -1;
							  if (a.Type > b.Type)
								return 1;
							  return 0;
						} );	
						
						for (var i = 0; i < orderedScores.length; i++) {		
							
							if(orderedScores[i].Type == 1){
								this.set_applet_label(LIVE);
							}

							this._addScoreItem(orderedScores[i].Summary, orderedScores[i].Icon, 
									orderedScores[i].Details, orderedScores[i].Url);
						}
					}
					
					this.liveScores = [];
				}
				else{							
					this.liveScores = this.liveScores.concat(response);			
				}
			
			} catch (e){
				log("Error updating scores "  + e);}
		}
};

/*------------------------
 * Menu
 * ------------------------*/
function MyMenu(launcher, orientation) {
	this._init(launcher, orientation);
}

MyMenu.prototype = {
		__proto__: PopupMenu.PopupMenu.prototype,

		_init: function(launcher, orientation) {
			this._launcher = launcher;

			PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
			Main.uiGroup.add_actor(this.actor);
			this.actor.hide();
		}
};

/*------------------------
 * Header Menu Item - Text
 * ------------------------*/
 
 function PopupHeaderMenuItem(){
	this._init.apply(this, arguments);
}

PopupHeaderMenuItem.prototype = {
		__proto__: PopupMenu.PopupBaseMenuItem.prototype,
		_init: function(text, params)
		{
			PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
			
			let header = new St.Label({ text: text});
			header.add_style_class_name('window-sticky');
			
			this.addActor(header);
		}
};


/*------------------------
 * Menu Item - Icon + Text
 * ------------------------*/
function MyPopupMenuItem(){
	this._init.apply(this, arguments);
}

MyPopupMenuItem.prototype = {
		__proto__: PopupMenu.PopupBaseMenuItem.prototype,
		_init: function(iconPath, text, arrdetails, params)
		{
			PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
			
			let scorebox = new St.BoxLayout();
			
			let image = new St.Bin({x_align: St.Align.MIDDLE});			
			let _layout = new Clutter.BinLayout();
            let _box = new Clutter.Box();
            let _clutter = new Clutter.Texture({keep_aspect_ratio: true, filter_quality: 2, filename: iconPath});
            _box.set_layout_manager(_layout);            
            _box.add_actor(_clutter);
            image.set_child(_box);			
			
			let textbox = new St.BoxLayout({vertical:true});
			
			let scoretext = new St.Label({ text: text});
			scoretext.add_style_class_name('window-sticky');
			textbox.add(scoretext);		
			
			for (var i = 0; i < arrdetails.length; i++) {
				let scoredetails = new St.Label({text: arrdetails[i]});
				scoretext.add_style_class_name('popup-subtitle-menu-item');
				textbox.add(scoredetails);
			}
		
			scorebox.add(image);
					
			this.addActor(scorebox);
			this.addActor(textbox);
		}
};

/*------------------------
 * Main
 * ------------------------*/
function main(metadata, orientation, panelHeight, instanceId) {
	let myApplet = new sports_update(metadata, orientation, panelHeight, instanceId);
	return myApplet;
};

/*------------------------
 * Logging
 * ------------------------*/
function log(message) {
	global.log(UUID + "::" + log.caller.name + ": " + message);
}
