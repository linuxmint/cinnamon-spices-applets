const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const AppletDir = imports.ui.appletManager.applets['habitrpg@douze12'];

function MyApplet(metadata, orientation) {
	this._init(metadata, orientation);
}

MyApplet.prototype = {
	__proto__ : Applet.TextApplet.prototype,

	_init : function(metadata, orientation) {
		Applet.TextApplet.prototype._init.call(this, orientation);

		global.log("Intitalisation");

		try {
			this.set_applet_tooltip(_("HabitRPG"));
			this.set_applet_label("HabitRPG");
			
			this.orientation = orientation;
            
			/** SETTINGS */
			this.path = metadata.path;
        	this.settingsFile = this.path+"/settings-schema.json";
			this.loadSettings();
			
			this.loadUser();
			
			this.buildMenu(orientation);
			
			this.buildContent();
			
			this.launchTimer();

			global.log("FIN Intitalisation");

		} catch (e) {
			global.logError(e);
		}
	},

	/**
	 * Click on the settings menu item
	 */
	onClickSettings : function(event) {
		global.log("Open settings");
		try{
			[success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(this.path, ["/usr/bin/gjs","settings.js",this.settingsFile], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
			GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this.onSettingsWindowClosed));	
		} catch (e) {
			global.logError(e);
		}
		
		this.menu.close();
	},
	
	/**
	 * Click on the refresh button
	 */
	onClickRefresh : function(){
		this.loadUser();
		this.buildContent();
	},
	
	/**
	 * Method calls when the user close the settings window
	 * Then, we need to resfresh the data with the new settings 
	 */
	onSettingsWindowClosed : function(event){
		global.log("Settings close");
		this.loadSettings();
		this.onClickRefresh();
	},
	
	/**
	 * When the user click on the check next to the task, we send a request to HabitRPG to indicate the task is completed
	 */
	onClickTask: function(index){
		global.log("Complete task " + this.user.dailys[index].text);
		let taskId = this.user.dailys[index].id;
		
		//send request to HabitRPG
		try{
			let command = 'curl -X POST -H "x-api-key:'+this.settings.keyID+'" -H "x-api-user:'+this.settings.userID+'" '+this.settings.baseUrl+'user/tasks/'+taskId+'/up';
			GLib.spawn_command_line_sync(command);
		}
		catch(e){
			
		}
		this.onClickRefresh();
	},
	
	/**
	 * Load the settings from the file
	 */
	loadSettings : function() {
	 	global.log("Load settings applet.js");
	 	let file = Gio.file_new_for_path(this.settingsFile);
		[success, jsonString, tag] = file.load_contents(null);
		this.settings = JSON.parse(jsonString);
	},
	
	/**
	 * Load the HabitRPG datas for the player identify by the settings
	 */
	loadUser : function(){
		
		global.log("Load HabitRPG datas");
		
		//save the previous values of gold, xp and hp in order to compare with the new datas 
		let oldHp;
		let oldXp;
		let oldGold;
		if(this.settings.sendNotification && this.user && !this.user.err){
			oldHp = Math.ceil(this.user.stats.hp);
			oldXp = this.user.stats.exp;
			oldGold = parseInt(this.user.stats.gp);
		}
		
		//launch a HTTP request to get the HabitRPG data 
		try{
			let command = 'curl -X GET -H "x-api-key:'+this.settings.keyID+'" -H "x-api-user:'+this.settings.userID+'" '+this.settings.baseUrl+'user/';
			[status, stdout, stderr] = GLib.spawn_command_line_sync(command);
		}
		catch(e){
			global.logError(e);
		}
		
		//parse the JSON result and save it in the object this.user
		this.user = JSON.parse(stdout);
		
		//if the sendNotification setting is checked and we have previous datas, we send a notification to the user
		if(this.settings.sendNotification && oldHp){
			let deltaHp = Math.ceil(this.user.stats.hp) - oldHp;
			let deltaXp = this.user.stats.exp - oldXp;
			let deltaGold = parseInt(this.user.stats.gp) - oldGold;
			
			//if the datas have changed, we send a notification
			if(deltaHp != 0 || deltaXp != 0 || deltaGold != 0){
				this.sendNotification(deltaHp, deltaXp, deltaGold);
			}
		}
	},
	
	/**
	 * Remove all the HabitRPG datas displayed in the applet menu
	 */
	removeContent : function(){
		
		//remove stats
       	let children = this.statArea.get_children();
        for (let i = 0; i < children.length; i++){
            children[i].destroy();
       	}
       	
       	//remove tasks
		let children = this.tasksArea.get_children();
        for (let i = 0; i < children.length; i++){
            children[i].destroy();
       	}
	},
	
	/**
	 * Build the refresh icon
	 */
	buildRefresh : function(){
		let refreshArea = new St.BoxLayout({style_class:"refreshArea"});
		this.menu.addActor(refreshArea);
		this.refreshIcon = new St.Icon({icon_size: 16});
		this.refreshIcon.set_gicon(Gio.icon_new_for_string(this.path + "/refresh.png"));
				
		let iconButton = new St.Button({child : this.refreshIcon, style_class:'refreshIcon'});
		
		//connect events
		iconButton.connect('clicked', Lang.bind(this, function(){
			global.log("Click Refresh");
			this.onClickRefresh();
		}));
		
		refreshArea.add(iconButton, {expand: true, x_fill: false, x_align: St.Align.END});
	},
	
	/**
	 * Build the stat of the HabitRPG player
	 */
	buildStat : function(){
		
		//NAME
		let nameLabel = new St.Label({style_class:"userNameLabel"});
        nameLabel.set_text(this.user.profile.name);
        this.statArea.add(nameLabel);
		
		//HP
		let hpLabel = new St.Label();
        hpLabel.set_text("Health : "+Math.ceil(this.user.stats.hp)+"/"+this.user.stats.maxHealth);
        this.statArea.add(hpLabel);
        
        //XP
        let xpLabel = new St.Label();
        xpLabel.set_text("XP : "+this.user.stats.exp+"/"+this.user.stats.toNextLevel);
        this.statArea.add(xpLabel);
        
        //GOLD
        let goldLabel = new St.Label();
        goldLabel.set_text("Gold : "+parseInt(this.user.stats.gp));
        this.statArea.add(goldLabel);
	},
	
	/**
	 * Build error message when the HabitRPG datas are not available
	 */
	buildError : function(){
		global.log("Build error message");
		let test = new St.Label();
        test.set_text("Unable to get HabitRPG data. Check configuration.");
        this.statArea.add(test);
	},
	
	/**
	 * BUild the task list with the button used to check a task
	 */
	buildTasks : function(){
		
		global.log("Build tasks list");
		
		for(let i = 0; i < this.user.dailys.length; i++){
			let task = this.user.dailys[i];
			
			global.log(task.text);
			
			//task name label
			let taskLabel = new St.Label({style_class:"taskLabel"});
	        taskLabel.set_text(task.text);
			this.tasksArea.add(taskLabel, {row:i,col:0});
			
			
			let icon = new St.Icon({icon_size: 16});
			
			//if the task is allready completed, we just display an icon whithout a button
			if(task.completed){
				icon.set_gicon(Gio.icon_new_for_string(this.path + "/done.png"));
				
				this.tasksArea.add(icon, {row:i,col:1});
			}
			//if the task isn't completed, we display the icon inside a button 
			else{
				icon.set_gicon(Gio.icon_new_for_string(this.path + "/notDone.png"));
				
				let iconButton = new St.Button({child : icon, style_class:'taskIcon'});
				iconButton.index = i;
				
				//connect events
				iconButton.connect('clicked', Lang.bind(this, function(){
					global.log("Click on task number " + iconButton.index);
					this.onClickTask(iconButton.index);
				}));
				
				this.tasksArea.add(iconButton, {row:i,col:1});
			}
			
			
		}
	},
	
	/**
	 * Build the content with HabitRPG datas
	 */
	buildContent : function(){
		
		//first remove old datas
		this.removeContent();
		
		if(this.user && !this.user.err){
			this.buildStat();	
		}
		else{
			this.buildError();
		}
		
		if(this.user && !this.user.err){
        	this.buildTasks();	
        }
	},
	
	/**
	 * Build the menu of the applet 
	 */
	buildMenu : function(orientation){
		
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);
		
		this.buildRefresh();
		
		//area where the stats (or the error message) are displayed
        this.statArea = new St.BoxLayout({vertical: true, style_class:'statArea'});
		this.menu.addActor(this.statArea);
		
		let separator = new PopupMenu.PopupSeparatorMenuItem();
        separator.setColumnWidths(1);
        this.menu.addMenuItem(separator);
        
        //area where the tasks are displayed
		this.tasksArea = new St.Table({style_class:'taskArea'});
		this.menu.addActor(this.tasksArea);	
		
        let separator = new PopupMenu.PopupSeparatorMenuItem();
        separator.setColumnWidths(1);
        this.menu.addMenuItem(separator);
        
        //menu item use to modify the settings of the applet
        let itemSettings = new PopupMenu.PopupMenuItem("Settings");
		itemSettings.connect("activate", Lang.bind(this, this.onClickSettings));
		this.menu.addMenuItem(itemSettings);
		
	},

	/**
	 * Click on the applet text in the command bar in order to open the menu
	 */
	on_applet_clicked : function(event) {
		global.log("Toggle menu");
		this.menu.toggle();
	},
	
	/**
	 * Launch the timer which will refresh the data regulary
	 */
	launchTimer : function(){
		Mainloop.timeout_add(this.settings.refreshInterval, Lang.bind(this, this.onTimeUpdate));
	},
	
	/**
	 * Method calls by the timer to resfresh the data 
	 */
	onTimeUpdate : function(){
		global.log("Tick Refresh");
		this.onClickRefresh();
		this.launchTimer();
	},
	
	/**
	 * Method which send a notification to the user with the hp lose or earn, the hp and the gol earn
	 * The message will be send within the program notify-send  
	 * @param {Object} deltaHp The delta of the hp between two refresh 
	 * @param {Object} deltaXp The delta of the xp between two refresh
	 * @param {Object} deltaGold The delta of the gold between two refresh
	 */
	sendNotification : function(deltaHp, deltaXp, deltaGold){
		global.log("Send Notification");
		try{
			//build the message to send
			let notificationMsg = "";
			if(deltaXp > 0){
				notificationMsg += "You earn "+deltaXp+" XP\n";	
			}
			
			if(deltaHp < 0){
				notificationMsg += "You lose "+Math.abs(deltaHp)+" HP\n";	
			}
			else if (deltaHp > 0){
				notificationMsg += "You heal "+deltaHp+" HP\n";
			}
			
			if(deltaGold > 0){
				notificationMsg += "You earn "+deltaGold+" Gold\n";	
			}
			
			//delete the last \n
			notificationMsg = notificationMsg.substr(0, notificationMsg.length - 1);
			
			//invoke the notify-send program
			GLib.spawn_async_with_pipes(this.path, ["/usr/bin/notify-send","HabitRPG",notificationMsg], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
		}
		catch(e){
			//catch exception if the program notify-send doesn't exist 
			global.logError(e);
		}
	}
};

function main(metadata, orientation, panel_height, instance_id) { 
	let myApplet = new MyApplet(metadata, orientation);
	return myApplet;
}
