const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const UUID = "gputemperature@silentage.com";

// l10n/translation support

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var has_nvidia_smi=false;
var has_nvidia_settings=false;
var has_sensors=false;

/*   The Popup Menu */
function GPUMenu(launcher, orientation)
{
	this._init(launcher, orientation);
}

GPUMenu.prototype = 
{
		__proto__: PopupMenu.PopupMenu.prototype,
		_init: function(launcher, orientation)
		{
			this._launcher=launcher;
			PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
			Main.uiGroup.add_actor(this.actor);
			this.actor.hide();
		}
}

/* The Applet */
function GPUTemp(orientation) 
{
	this._init(orientation);
}

GPUTemp.prototype = 
{
	__proto__: Applet.TextApplet.prototype,
	_init: function(orientation) 
	{
		Applet.TextApplet.prototype._init.call(this, orientation);
		try 
		{
			this.set_applet_label(_("GPU: ??\u1d3cC"));
			
			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new GPUMenu(this, orientation);
			this.menuManager.addMenu(this.menu);			
			
			//has_nvidia_smi=this._hasCommand("which nvidia-smi", ".*/nvidia-smi");
			has_nvidia_settings=this._hasCommand("which nvidia-settings", ".*/nvidia-settings");
			has_sensors=this._hasCommand("which sensors", ".*/sensors");

			if((has_nvidia_settings==true))
			{
				this.set_applet_tooltip(_("Current Temperature of your NVidia based GPU"));
				this._getNvidiaGpuTemperature();
			}
			else if(has_sensors==true)
			{
				this.set_applet_tooltip(_("Current Temperature of your ATI based GPU"));
				this._getAtiGpuTemperature();
			}
			else
			{
				this.set_applet_tooltip(_("No supported GPUs detected."));
				this._noGpuSource();
			}
		}
		catch (initerror) 
		{
			global.logError("init error:");
			global.logError(initerror);
		}
	},
	_getAtiGpuTemperature: function()
	{
		this.menu.removeAll();
		
		let items = new Array();
		let gpu_command = "sensors ";

		let gpuGPUTest = new RegExp("^radeon-pci");
		let gpuTemperatureTest = new RegExp("temp1:[ 	+]*[0-9]{1,3}\.[0-9]","g");
		let gpuTemperatureExtract = new RegExp("[0-9]{1,3}\.[0-9]");
		
		try
		{
			// synchronous call, but appears to run fast enough to not cause a (visible) problem... 
			let gpu_sensors_output = GLib.spawn_command_line_sync(gpu_command);//get the output of the (lm)sensors command
			let gpu_lines=gpu_sensors_output[1].toString().split("\n");
			
			let currentTemperature = "";
			let totalTemperature = 0.0;
			let totalGpus = 0.0;
			let formattedTemperature = "??";
			let dversion = "";
			let line = "";
			let gpuFound=false;

			for(let i = 0; i < gpu_lines.length; i++) 
			{
				let line = gpu_lines[i];
				if(gpuGPUTest.test(line))
				{
					totalGpus ++;
					this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
					this.menu.addMenuItem(new PopupMenu.PopupMenuItem("GPU " + totalGpus, {reactive:false}));
					gpuFound=true;
				}
				else if(gpuFound && gpuTemperatureTest.test(line))
				{
					try
					{
						currentTemperature = gpuTemperatureExtract.exec(line);
						if(currentTemperature!=null)
						{
							totalTemperature += parseFloat(currentTemperature);
							this.menu.addMenuItem( new PopupMenu.PopupMenuItem(_("Temperature") + ": " + this._formatTemperature(currentTemperature.toString()), {reactive:false}));
						}
						else
						{
							this.menu.addMenuItem(new PopupMenu.PopupMenuItem("E:" + line, {reactive:false}));
						}
					}
					catch (ae2)
					{
							this.menu.addMenuItem(new PopupMenu.PopupMenuItem("E2:" + line, {reactive:false}));

					}
					gpuFound=false;		
				}
			}

			totalTemperature = totalTemperature / totalGpus;
			
			formattedTemperature = this._formatTemperature(totalTemperature.toString());
			this.set_applet_label(" " + _("GPU:") + " " + formattedTemperature + " ");
		}
		catch (ae)
		{
			global.logError(gpu_sendors_output);
			global.logError(ae);
		}
		Mainloop.timeout_add(2000, Lang.bind(this, this._getAtiGpuTemperature));
	},
	_getNvidiaGpuTemperature: function() 
	{
		let d = new Date();
		//global.logError("start _getNvidiaGPUTemperature() " + d.toString());
		//this.menu.addMenuItem(new PopupMenu.PopupMenuItem("GPU Temperature", {reactive:false}));
		this._getNvidiaGpuProperties();
	},
	_someCallBackFunction: function()
	{
		let d=1;
		let e=d*d;
	},
	_readOutput: function(stdout, lines)
	{
		let reader = new Gio.DataInputStream({base_stream: new Gio.UnixInputStream({fd:stdout})});
		let linesRead=0;
		let [line, size] = reader.read_line(null);
		while((line !=null)&&(linesRead < 3000))
		{
			lines[linesRead++] = line.toString();
			//global.logError(plines[linesRead-1]);
			[line, size] = reader.read_line(null);
		}
	},
	_getNvidiaGpuPropertiesAsyncPipes: function()
	{
		if(has_nvidia_settings)
		{
			let plines = new Array();
			let nlines = new Array();
			try
			{
				{
					let [res, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(null, ['nvidia-settings','-n','-t','-d','-q','all'], null, GLib.SpawnFlags.SEARCH_PATH, null);
					this._readOutput(stdout, plines);
					//GLib.close_pid(pid);
					//global.logError("pLines Read:" + linesRead);
				}
				{
					let [res, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(null, ['nvidia-settings','-n','-t','-d','-q','gpus'], null, GLib.SpawnFlags.SEARCH_PATH, null);
					this._readOutput(stdout, nlines);
					//GLib.close_pid(pid);
					//global.logError("nLines Read:" + linesRead);
				}
			}
			catch (e)
			{
				global.logError("error in spawns:" + e.toString());
			}
			this._continueGetNvidiaGpuPropertiesAsyncPipes(plines, nlines);
		}
	},
	_getNvidiaGpuProperties: function()
	{
		if(has_nvidia_settings)
		{
			// sync version
			// the synchronized version causes *very* noticable complete freezes of the desktop every time these commands
			// are called. Now, while those calles are syncronous, I'm at a loss to explain who thought locking the WHOLE gui and not just this applet
			// was a reasonable result. Sheesh!
			//let gpu_settings_command = "bash -c \"nvidia-settings -n -t -d -q all\""; // | grep '[[:space:]]*Gpu[[:space:]]*: [0-9]* C'";
			//let gpu_settings_output = GLib.spawn_command_line_sync(gpu_settings_command);//get the output of the nvidia-settings command
			//let gpu_settings_lines=gpu_settings_output[1].toString().split("\n");
			//this._processNvidiaSettings(gpu_settings_lines, SettingsObject);

			//async version
			let plines = new Array();
			let nlines = new Array();
			try
			{
				// now, originally with the async version, I tried to spawn_async... and then read from stdout, but that 
				//		a) looped for ever, and 
				//		b) didn't seem to get any output from the command.
				//	So, in stead I arranged this clusterf*, er, jerry-rig that spawns a shell which then runs sh which runs the actual settings 
				//	command but then redirects that output to a file (the first sh runst the second sh and redirects stdout to file). Had to do
				//	it this way as the redirect is a feature fo the shell and not the spawn_async call. 
				GLib.spawn_async(null, ['sh', '-c', 'sh -c "nvidia-settings -n -t -d -q all" > /tmp/gputmp_prop.out'], null, GLib.SpawnFlags.SEARCH_PATH, null);
				GLib.spawn_async(null, ['sh', '-c', 'sh -c "nvidia-settings -n -t -d -q gpus" > /tmp/gputmp_name.out'], null, GLib.SpawnFlags.SEARCH_PATH, null);
				GLib.spawn_async(null, ['sh', '-c', 'sh -c "nvidia-settings -n -t -d -q dpys" > /tmp/gputmp_dpys.out'], null, GLib.SpawnFlags.SEARCH_PATH, null);
			}
			catch (e)
			{
				global.logError("error in spawns:" + e.toString());
			}
			// 2000 ms delay to allow spawn_async commands to complete. This is slop. I know it, however, so far my attempts to use spawn_async_with_pipes
			// and then read the output haven't eliminated the desktop freeze, so I'm reduced to this slop. le sigh.
			Mainloop.timeout_add(2000, Lang.bind(this, this._continueGetNvidiaGpuProperties));
		}
	},
	_continueGetNvidiaGpuPropertiesAsyncPipes: function(nproperties, nnames)
	{
		let SettingsObject = new Object();
		try
		{
			this._processNvidiaSettings(nproperties, SettingsObject);
		}
		catch (ep)
		{
			global.logError("Error in get_file_contents gputmp_prop:" + ep.toString());
		}
		try
		{
			this._processNvidiaGpuNames(nnames, SettingsObject);
		}
		catch (en)
		{
			global.logError("Error in get_file_contents gputmp_name:" + en.toString());
		}
		this._nvidiaGpuBuildMenu(SettingsObject);
		// done building the menu, now wait 2 seconds and to it again.
		Mainloop.timeout_add(2000, Lang.bind(this, this._getNvidiaGpuTemperature));
	},
	_continueGetNvidiaGpuProperties: function()
	{
		let SettingsObject = new Object();
		try
		{
			// Now, as I noted problems in _getNvidiaGpuProperties with synchronous calls, note that file_get_contents is also synchronous.
			// However, it appears to run quickly enough as to not cause a noticable problem, so I'll leave it in for now.
			let fp = GLib.file_get_contents("/tmp/gputmp_prop.out");
			if(fp!=null)
			{
				let gpu_settings_lines=fp.toString().split("\n");
				this._processNvidiaSettings(gpu_settings_lines, SettingsObject);
			}
		}
		catch (ep)
		{
			global.logError("Error in get_file_contents gputmp_prop:" + ep.toString());
		}
		try
		{
			// Now, as I noted problems in _getNvidiaGpuProperties with synchronous calls, note that file_get_contents is also synchronous.
			// However, it appears to run quickly enough as to not cause a noticable problem, so I'll leave it in for now.
			let fn = GLib.file_get_contents("/tmp/gputmp_name.out");
			if(fn!=null)
			{
				let gpu_settings_lines=fn.toString().split("\n");
				this._processNvidiaGpuNames(gpu_settings_lines, SettingsObject);
			}					
		}
		catch (en)
		{
			global.logError("Error in get_file_contents gputmp_name:" + en.toString());
		}
		try
		{
			// Now, as I noted problems in _getNvidiaGpuProperties with synchronous calls, note that file_get_contents is also synchronous.
			// However, it appears to run quickly enough as to not cause a noticable problem, so I'll leave it in for now.
			let fn = GLib.file_get_contents("/tmp/gputmp_dpys.out");
			if(fn!=null)
			{
				let gpu_settings_lines=fn.toString().split("\n");
				this._processNvidiaDpyNames(gpu_settings_lines, SettingsObject);
			}		
		}
		catch (en)
		{
			global.logError("Error in get_file_contents gputmp_name:" + en.toString());
		}
		this._nvidiaGpuBuildMenu(SettingsObject);
		//Mainloop.timeout_add(2000, Lang.bind(this, this._getNvidiaGpuTemperature));
		this._getNvidiaGpuTemperature();
	},
	_nvidiaGpuBuildMenu: function(SettingsObject)
	{
		this.menu.removeAll();

		if(SettingsObject!=null)
		{
			try
			{
				if((SettingsObject!=null)&&(SettingsObject.totalGpus!=null))
				{
					//this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
					//this.menu.addMenuItem(new PopupMenu.PopupMenuItem("GPU count: " + SettingsObject.totalGpus, {reactive:false}));
					//this.menu.addMenuItem(new PopupMenu.PopupMenuItem("GPUs:" + SettingsObject.gpus.length, {reactive:false}));					
					for(let n=0;n<SettingsObject.gpus.length;n++)
					{
						if(SettingsObject.gpus[n]!=null)
						{
							if(SettingsObject.gpus[n].gpuId != null)
							{
								this.menu.addMenuItem(new PopupMenu.PopupMenuItem("GPU " +n + ":  " + SettingsObject.gpus[n].gpuName, {reactive:false}));
							}
							if(SettingsObject.gpus[n].gpuCoreTemp != null)
							{
								this.menu.addMenuItem(new PopupMenu.PopupMenuItem("     " + _("Temperature") + ":  " + SettingsObject.gpus[n].gpuCoreTemp, {reactive:false}));
							}
							if(SettingsObject.gpus[n].driverVersion != null)
							{
								this.menu.addMenuItem(new PopupMenu.PopupMenuItem("     " + _("Driver") + "  :  " + SettingsObject.gpus[n].driverVersion, {reactive:false}));
							}
							//if(SettingsObject.gpus[n].displays != null)
							//{
							//	this.menu.addMenuItem(new PopupMenu.PopupMenuItem("     Displays:  " + SettingsObject.gpus[n].displays, {reactive:false}));
							//}
							if((SettingsObject.gpus[n].totalRam != null)||(SettingsObject.gpus[n].usedRam != null)||(SettingsObject.gpus[n].memoryInterface != null)||(SettingsObject.gpus[n].memoryClock != null))
							{
								this.menu.addMenuItem(new PopupMenu.PopupMenuItem("     " + _("Video Memory"), {reactive:false}));
								if(SettingsObject.gpus[n].totalRam != null)
								{
									this.menu.addMenuItem(new PopupMenu.PopupMenuItem("          " + _("Total") + ":  " + SettingsObject.gpus[n].totalRam, {reactive:false}));
								}
								if(SettingsObject.gpus[n].usedRam != null)
								{
									this.menu.addMenuItem(new PopupMenu.PopupMenuItem("          " + _("Used") + " :  " + SettingsObject.gpus[n].usedRam, {reactive:false}));
								}
								if(SettingsObject.gpus[n].memoryInterface != null)
								{
									this.menu.addMenuItem(new PopupMenu.PopupMenuItem("          " + _("Interface") + ":  " + SettingsObject.gpus[n].memoryInterface, {reactive:false}));
								}
								if(SettingsObject.gpus[n].memoryClock != null)
								{
									this.menu.addMenuItem(new PopupMenu.PopupMenuItem("          " + _("Memory Clock") + ":  " + SettingsObject.gpus[n].memoryClock, {reactive:false}));
								}
							}
							if(SettingsObject.gpus[n].cudaCores != null)
							{
								this.menu.addMenuItem(new PopupMenu.PopupMenuItem("     " + _("Cuda Cores") + ":  " + SettingsObject.gpus[n].cudaCores, {reactive:false}));
							}
							if(SettingsObject.gpus[n].gpuClock != null)
							{
								this.menu.addMenuItem(new PopupMenu.PopupMenuItem("     " + _("Gpu Clock") + ":  " + SettingsObject.gpus[n].gpuClock, {reactive:false}));
							}
							if((SettingsObject.gpus[n].pciLinkSpeed != null)&&(SettingsObject.gpus[n].pciLanes != null))
							{
								this.menu.addMenuItem(new PopupMenu.PopupMenuItem("     " + _("PCI Speed") + ":  " + SettingsObject.gpus[n].pciLanes + " @ " + SettingsObject.gpus[n].pciLinkSpeed, {reactive:false}));
							}
						}

					}
				}
				if((SettingsObject!=null)&&(SettingsObject.fans!=null))
				{
					//this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Speed of " + SettingsObject.fans.length + " fans ("+SettingsObject.totalFans +")", {reactive:false}));
					for(let n=0;n<SettingsObject.fans.length;n++)
					{
						if(SettingsObject.fans[n]!=null)
						{
							if(SettingsObject.fans[n].speed != null)
							{
								this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Fan ") +n + ":  " + SettingsObject.fans[n].speed + "%", {reactive:false}));
							}
						}
					}
				}
				if((SettingsObject!=null)&&(SettingsObject.dpys!=null))
				{
					//this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Specs " + SettingsObject.dpys.length + " Displays ("+SettingsObject.totalDisplays.toString() +")", {reactive:false}));
					this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Displays:"), {reactive:false}));
					for(let n=0;n<SettingsObject.dpys.length;n++)
					{
						try
						{
							if(SettingsObject.dpys[n]!=null)
							{
								//this.menu.addMenuItem(new PopupMenu.PopupMenuItem(SettingsObject.dpys[n].displayId, {reactive:false}));
								if((SettingsObject.dpys[n].resolution != null) && (SettingsObject.dpys[n].refreshRate != null))
								{
									this.menu.addMenuItem(new PopupMenu.PopupMenuItem("     " + SettingsObject.dpys[n].dpyName+ ":  " + SettingsObject.dpys[n].resolution + " @ " + SettingsObject.dpys[n].refreshRate, {reactive:false}));
								}
								//if((SettingsObject.dpys[n].refreshRate != null))
								//{
								//	this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Display " +n + ":  " + SettingsObject.dpys[n].refreshRate, {reactive:false}));
								//}

							}
						}
						catch (de)
						{
							global.logError("Display Error:"+de.toString());
						}
					}
				}				
				else
				{
					this.menu.addMenuItem(new PopupMenu.PopupMenuItem("SettingsObject.dpys is null", {reactive:false}));
				}

				this.set_applet_label(" " + _("GPU:") + " " + SettingsObject.formattedTemperature + " ");
			}
			catch (ne)
			{
				global.logError("Build Menu Outer Error:" + ne.toString());
			}
    	}
	   	let d = new Date();
	   	this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	   	this.menu.addMenuItem(new PopupMenu.PopupMenuItem(d.toString(), {reactive:false}));
	},
	_processNvidiaSettings: function(gpu_lines, SettingsSettings)
	{
		let mainTest = new RegExp("Attributes queryable via .*0\.0:");
		let gpuTest = new RegExp("Attributes queryable via .*gpu:[0-9]]:");
		let fanTest = new RegExp("Attributes queryable via .*fan:[0-9]]:");
		let displayTest = new RegExp("Attributes queryable via .*dpy:[0-9]]:");
		let otherSectionTest= new RegExp("Attributes queryable");
		let gpuExtract = new RegExp("gpu:[0-9]");
		let fanExtract = new RegExp("fan:[0-9]");
		let displayExtract = new RegExp("dpy:[0-9]");
		// GPU 0
		let driverVersionTest = new RegExp("NvidiaDriverVersion:");
		let enabledDisplaysTest = new RegExp("EnabledDisplays:");
		let pciLanesTest = new RegExp("PCIECurrentLinkWidth:");
		let pciLinkTest = new RegExp("PCIECurrentLinkSpeed:");
		let totalRamTest = new RegExp("TotalDedicatedGPUMemory:");
		let usedRamTest = new RegExp("UsedDedicatedGPUMemory:");
		let memoryInterfaceTest = new RegExp("GPUMemoryInterface:");
		let cudaCoresTest = new RegExp("CUDACores:");
		let gpuCoreTempTest = new RegExp("GPUCoreTemp:");
		let gpuClockTest = new RegExp("GPUCurrentClockFreqs:");
		// FAN 0
		let fanSpeedTest = new RegExp("GPUCurrentFanSpeed:");
		// DPY 0
		let resolutionTest = new RegExp("FlatpanelNativeResolution:");
		let refreshRateTest = new RegExp("RefreshRate:");
		
		try
		{
			let bMain=false;
			let bGpu=false;
			let bFan=false;
			let bDisplay=false;
			let gpu=null;

			SettingsSettings.totalTemperature = 0;
			SettingsSettings.totalGpus = 0;
			SettingsSettings.totalFans = 0;
			SettingsSettings.totalDisplays = 0;
			SettingsSettings.formattedTemperature = null;
			SettingsSettings.dversion = null;
			SettingsSettings.line = "";
			SettingsSettings.gpus = new Array();
			SettingsSettings.dpys = new Array();
			SettingsSettings.fans = new Array();
			//k loop is for testing multiple gpu configurations
			//for(let k=0;k<4;k++)
			//{
			//global.logError("_processNvidiaSettings gpu_lines count:" + gpu_lines.length);
			for(let i = 0; i < gpu_lines.length; i++) 
			{
				let line = gpu_lines[i];
				//global.logError(line);
				// test if we're starting the main section or a gpu section.
				if(mainTest.test(line))
				{
					bFan=false;
					bMain=true;
					bGpu=false;
					bDisplay=false;
				}
				else if (gpuTest.test(line))
				{
					//global.logError(line);
					bMain=false;
					bFan=false;
					bGpu=true;
					bDisplay=false;
					SettingsSettings.totalGpus = SettingsSettings.totalGpus +1;
					let gpu = gpuExtract.exec(line);
					SettingsSettings.gpus[SettingsSettings.totalGpus-1] = new Object();
					SettingsSettings.gpus[SettingsSettings.totalGpus-1].gpuId=gpu;
				}
				else if (fanTest.test(line))
				{
					//global.logError(line);
					bMain=false;
					bFan=true;
					bGpu=false;
					bDisplay=false;
					let fan = fanExtract.exec(line);
					SettingsSettings.totalFans = SettingsSettings.totalFans +1;
					SettingsSettings.fans[SettingsSettings.totalFans-1] = new Object();
					SettingsSettings.fans[SettingsSettings.totalFans-1].fanId=fan;
				}
				else if (displayTest.test(line))
				{
					//global.logError(line);
					bMain=false;
					bFan=false;
					bGpu=false;
					bDisplay=true;
					let display= displayExtract.exec(line);
					SettingsSettings.totalDisplays = SettingsSettings.totalDisplays +1;
					SettingsSettings.dpys[SettingsSettings.totalDisplays-1] = new Object();
					SettingsSettings.dpys[SettingsSettings.totalDisplays-1].displayId=display.toString();
					//global.logError("Display:" + SettingsSettings.dpys[SettingsSettings.totalDisplays-1].displayId);
				}
				else if (otherSectionTest.test(line))
				{
					bMain=false;
					bGpu=false;
					bFan=false;
					bDisplay=false;
				}

				if(bMain)
				{
					// we're in the main section, so test for global things.
					// which is , currently, nothing					
				}
				else if (bDisplay)
				{
					try
					{
						if(resolutionTest.test(line))
						{
							SettingsSettings.dpys[SettingsSettings.totalDisplays-1].resolution = this._genericExtract(line);
							//global.logError("Display:" + SettingsSettings.dpys[SettingsSettings.totalDisplays-1].resolution);
						}
						if(refreshRateTest.test(line))
						{
							SettingsSettings.dpys[SettingsSettings.totalDisplays-1].refreshRate = this._genericExtract(line);
							//global.logError("Display:" + SettingsSettings.dpys[SettingsSettings.totalDisplays-1].refreshRate);
						}
					}
					catch (fe)
					{
						global.logError("Display Error:" + fe.toString());
					}
				}
				else if (bFan)
				{
					try
					{
						if(fanSpeedTest.test(line))
						{
							SettingsSettings.fans[SettingsSettings.totalFans-1].speed = this._genericExtract(line);
						}
					}
					catch (fe)
					{
						global.logError("Fan Error:" + fe.toString());
					}
				}
				else if (bGpu)
				{
					// we're in a specific GPU section, so test for and extract the GPU specific settings
					try
					{
						if(driverVersionTest.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1].driverVersion = this._genericExtract(line);
						}
						else if(enabledDisplaysTest.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1].displays=this._genericExtract(line);
						}
						else if(pciLanesTest.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1].pciLanes=this._genericExtract(line) + " lanes" ;
						}
						else if(pciLinkTest.test(line))
						{
							let pci1 = this._genericExtract(line);
							if(pci1!=null)
							{
								let pciI = parseInt(pci1) / 1000;
								SettingsSettings.gpus[SettingsSettings.totalGpus-1].pciLinkSpeed=pciI + " GT/s" ;
							}
						}
						else if(totalRamTest.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1].totalRam = this._genericExtract(line) + " MB";
						}
						else if(usedRamTest.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1].usedRam = this._genericExtract(line) + " MB";
						}
						else if(memoryInterfaceTest.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1].memoryInterface = this._genericExtract(line) + " bit";
						}	
						else if(cudaCoresTest.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1].cudaCores = this._genericExtract(line) ;
						}	
						else if(gpuCoreTempTest.test(line))
						{
							let coreTemp1 = this._genericExtract(line);
							if(coreTemp1!=null)
							{
								SettingsSettings.totalTemperature = SettingsSettings.totalTemperature + parseInt(coreTemp1);
								SettingsSettings.gpus[SettingsSettings.totalGpus-1].gpuCoreTemp = coreTemp1 + "\u1d3cC";
							}
						}					
						else if(gpuClockTest.test(line))
						{
							let clock = this._genericExtract(line);
							if(clock!=null)
							{
								let clockParts = clock.toString().split(",");
								if(clockParts!=null)
								{
									SettingsSettings.gpus[SettingsSettings.totalGpus-1].gpuClock = clockParts[0] + "MHz";
									SettingsSettings.gpus[SettingsSettings.totalGpus-1].memoryClock = clockParts[1] + "MHz";
								}
							}
						}	
						/*else if(Test.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1]. = genericExtract(line) + " MB";
						}	
						else if(Test.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1]. = genericExtract(line) + " MB";
						}	
						else if(Test.test(line))
						{
							SettingsSettings.gpus[SettingsSettings.totalGpus-1]. = genericExtract(line) + " MB";
						}	
						*/
					}
					catch (ne2)
					{
						global.logError("Error on line:" +line);
						global.logError(ne2);
						//this.menu.addMenuItem(new PopupMenu.PopupMenuItem("E2:" + line, {reactive:false}));
					}
				}
					
			}
			//}

			SettingsSettings.totalTemperature = SettingsSettings.totalTemperature / SettingsSettings.totalGpus;
			
			SettingsSettings.formattedTemperature = this._formatTemperature(SettingsSettings.totalTemperature.toString());
		}
		catch (ne)
		{
			global.logError(ne);
		}
	},
	_processNvidiaGpuNames: function(gpu_lines, SettingsSettings)
	{
		let gpuTest = new RegExp("gpu:[0-9]] ");
		let gpuIdExtract =  new RegExp("gpu:[0-9]");
		let gpuNumberExtract = new RegExp("[0-9]");
		let gpuNameExtract = new RegExp("[\(].*[\)]");
		//global.logError("processNvidiaGpuNames with " + gpu_lines.length + " lines");
		try
		{
			for(let i = 0; i < gpu_lines.length; i++) 
			{
				let line = gpu_lines[i];
				//global.logError("\"" + line + "\"");
				// test if we're starting the main section or a gpu section.
				if(gpuTest.test(line))
				{
					try
					{
						let gpuId = gpuIdExtract.exec(line);
						if(gpuId!=null)
						{
							//global.logError("gpuID:" + gpuId);
							let gpuNumber = gpuNumberExtract.exec(gpuId);
							if(gpuNumber!=null)
							{
								//global.logError("gpuNumber:" + gpuNumber);
								let num = parseInt(gpuNumber);
								let gpuName = gpuNameExtract.exec(line);
								if(gpuName!=null)
								{
									//global.logError("gpuName:" + gpuName);
									let gpuName1 = gpuName.toString();
									let gpuName2 = gpuName1.substr(1, (gpuName1.length - 2));
									if(SettingsSettings.gpus == null)
									{
										SettingsSettings.gpus = new Array();
									}
									if(SettingsSettings.gpus[num] == null)
									{
										SettingsSettings.gpus[num] = new Object();
									}
									SettingsSettings.gpus[num].gpuName = gpuName2;
								}
								else
								{
									SettingsSettings.gpus[num].gpuName = _("No GPU Name");
								}
							}
						}
					}
					catch (ne2)
					{
						global.logError("Error on line:" +line);
						global.logError(ne2);
						//this.menu.addMenuItem(new PopupMenu.PopupMenuItem("E2:" + line, {reactive:false}));
					}
				}
					
			}
		}
		catch (ne)
		{
			global.logError(ne);
		}
	},
	_processNvidiaDpyNames: function(dpy_lines, SettingsSettings)
	{
		let dpyTest = new RegExp("dpy:[0-9]] ");
		let dpyIdExtract =  new RegExp("dpy:[0-9]");
		let dpyNumberExtract = new RegExp("[0-9]");
		let dpyNameExtract = new RegExp("[\(].*[\)]");
		//global.logError("processNvidiaGpuNames with " + gpu_lines.length + " lines");
		try
		{
			for(let i = 0; i < dpy_lines.length; i++) 
			{
				let line = dpy_lines[i];
				//global.logError("\"" + line + "\"");
				// test if we're starting the main section or a gpu section.
				if(dpyTest.test(line))
				{
					try
					{
						let dpyId = dpyIdExtract.exec(line);
						if(dpyId!=null)
						{
							//global.logError("dpyID:" + dpyId);
							let dpyNumber = dpyNumberExtract.exec(dpyId);
							if(dpyNumber!=null)
							{
								//global.logError("dpyNumber:" + dpyNumber);
								let num = parseInt(dpyNumber);
								let dpyName = dpyNameExtract.exec(line);
								if(dpyName!=null)
								{
									//global.logError("gpuName:" + gpuName);
									let dpyName1 = dpyName.toString();
									let dpyName2 = dpyName1.substr(1, (dpyName1.length - 2));
									if(SettingsSettings.dpys == null)
									{
										SettingsSettings.dpys = new Array();
									}
									if(SettingsSettings.dpys[num] == null)
									{
										SettingsSettings.dpys[num] = new Object();
									}
									SettingsSettings.dpys[num].dpyName = dpyName2;
								}
								else
								{
									SettingsSettings.dpys[num].dpyName = _("No Display Name");
								}
							}
						}
					}
					catch (ne2)
					{
						global.logError("Error on line:" +line);
						global.logError(ne2);
						//this.menu.addMenuItem(new PopupMenu.PopupMenuItem("E2:" + line, {reactive:false}));
					}
				}
					
			}
		}
		catch (ne)
		{
			global.logError(ne);
		}
	},
	_genericExtract: function(line)
	{
		let genericExtract = new RegExp(": .*");
		let e1 = genericExtract.exec(line);
		if(e1!=null)
		{
			let e2 = e1.toString();
			e1 = e2.substr(2);
		}
		return e1;
	},
	_nvGetTotalDedicatedGPUMemory: function(lines, gpuid)
	{
		let gpuMemTest = new RegExp("'TotalDedicatedGPUMemory'.*gpu:" +(gpuid-1) +"]");
		let gpuTemperatureExtract = new RegExp(" [0-9]{3,6}\.");

	},
	_noGpuSource: function()
	{
		this.set_applet_label(_(" GPU: ??\u1d3cC ERROR"));
		this.menu.removeAll();
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("We couldn't determine your GPU's temperature.")), {reactive:false});
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem(""), {reactive:false});
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("If you have a NVIDIA GPU, please try installing")), {reactive:false});
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("the binary drivers from http://geforce.com/drivers")), {reactive:false});
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("and the nvidia-settings package for your distribution.")), {reactive:false});
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem(""), {reactive:false});
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("If you have an ATI GPU, please install the LM-SENSORS")), {reactive:false});
		this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("packages for your distribution.")), {reactive:false});
	},
	_formatTemperature: function(t) 
	{
		return (Math.round(t)).toString()+"\u1d3cC";
		//return ((t*100)/100).toString()+"\u1d3cC";
	},
	_hasCommand: function(test, match)
	{
		// synchronous, but fast enough to not matter. Plus this is run a couple time ONLY at startup.
		let findOutput = GLib.spawn_command_line_sync(test);
		//global.logError("Looking for GPU temp command:");
		//global.logError(test);
		//global.logError(findOutput);
		//global.logError(match);
		let hasCommandTest = new RegExp(match);
		if(hasCommandTest.test(findOutput))
		{
			//global.logError("FOUND!");
			return true;
		}
		//global.logError("NOT FOUND!");
		return false;
	},
	on_applet_clicked: function(event) 
	{
		this.menu.toggle();
		//this._getNvidiaGpuTemperature();
	}
};

function main(metadata, orientation) 
{
	let gpuTemp = new GPUTemp(orientation);
	return gpuTemp;
}
