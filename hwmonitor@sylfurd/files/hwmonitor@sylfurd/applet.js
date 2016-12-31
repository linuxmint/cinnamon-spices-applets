/*
Copyright 2012 Renaud Delcoigne (Aka Sylfurd)

This file is part of HWMonitor

HWMonitor is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

Foobar is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details.

You should have received a copy of the GNU General Public License along
with Foobar. If not, see http://www.gnu.org/licenses/.
*/

const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GTop = imports.gi.GTop;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Cairo = imports.cairo;

function MyApplet(orientation) {
	this._init(orientation);
}

MyApplet.prototype = {
	__proto__: Applet.Applet.prototype,

    _init: function(orientation) {
        Applet.Applet.prototype._init.call(this, orientation);

		try {
			this.itemOpenSysMon = new PopupMenu.PopupMenuItem("Open System Monitor");
			this.itemOpenSysMon.connect('activate', Lang.bind(this, this._runSysMonActivate));
			this._applet_context_menu.addMenuItem(this.itemOpenSysMon);

			this.graphArea = new St.DrawingArea();
			this.graphArea.width = 88;
			this.graphArea.connect('repaint', Lang.bind(this, this.onGraphRepaint));

			this.actor.add_actor(this.graphArea);

			let cpuProvider =  new CpuDataProvider();
			let memProvider =  new MemDataProvider();

			let cpuGraph = new Graph(this.graphArea, cpuProvider);
			let memGraph = new Graph(this.graphArea, memProvider);

			this.graphs = new Array();
			this.graphs[0] = cpuGraph;
			this.graphs[1] = memGraph;

			this._update();
		}
		catch (e) {
			global.logError(e);
		}
	},

	on_applet_clicked: function(event) {
		this._runSysMon();
	},

	_runSysMonActivate: function() {
		this._runSysMon();
	},

	_update: function() {

		for (i = 0; i < this.graphs.length; i++)
		{
			this.graphs[i].refreshData();
		}
			
		this.graphArea.queue_repaint();

		Mainloop.timeout_add(500, Lang.bind(this, this._update));
	},

	_runSysMon: function() {
		let _appSys = Cinnamon.AppSystem.get_default();
		let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
		_gsmApp.activate();
	},

	onGraphRepaint: function(area) {
		try {
			for (index = 0; index < 2; index++)
			{
				area.get_context().translate(index*45, 0);
				this.graphs[index].paint(area);
			}
		}catch(e)
		{
			global.logError(e);
		}
	}
};

function Graph(area, provider) {
	this._init(area, provider);
}

Graph.prototype = {
	
	_init: function(_area, _provider) {
		this.width = 41;
		let [w, h] = _area.get_surface_size();
		this.datas = new Array(this.width);

		for (i = 0; i <this.datas.length; i++)
        {
        	this.datas[i] = 0;
        }

		this.height = 20;
		this.provider = _provider;

	},

	paint: function(area)
	{
		let cr = area.get_context();

		// Border
        cr.setSourceRGBA(1, 1, 1, 0.9);
        cr.setLineWidth(1);
        cr.rectangle(0.5, 0.5, this.width+0.5, this.height+0.5);
        cr.stroke(); 

		// Background
        let gradientHeight = this.height-1;
        let gradientWidth = this.width-1;
        let gradientOffset = 1;
        let pattern = new Cairo.LinearGradient(0, 0, 0, this.height);
        pattern.addColorStopRGBA(0, 1, 1, 1, 0.3);
        pattern.addColorStopRGBA(1, 0, 0, 0, 0.3);
        cr.setSource(pattern);
        cr.rectangle(1, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();

        // Grid
        cr.setLineWidth(1);
        cr.setSourceRGBA(1, 1, 1, 0.4);
        cr.moveTo(0, Math.round(this.height/2)+0.5);
        cr.lineTo(this.width, Math.round(this.height/2)+0.5);
        cr.stroke();
        cr.moveTo(Math.round(this.width*0.5)+0.5, 0);
        cr.lineTo(Math.round(this.width*0.5)+0.5, this.height);
        cr.stroke();
        cr.setSourceRGBA(1, 1, 1, 0.2);
        cr.moveTo(0, Math.round(this.height*0.25)+0.5);
        cr.lineTo(this.width, Math.round(this.height*0.25)+0.5);
        cr.stroke();
        cr.moveTo(0, Math.round(this.height*0.75)+0.5);
        cr.lineTo(this.width, Math.round(this.height*0.75)+0.5);
        cr.stroke();
        cr.moveTo(Math.round(this.width*0.25)+0.5, 0);
        cr.lineTo(Math.round(this.width*0.25)+0.5, this.height);
        cr.stroke();
        cr.moveTo(Math.round(this.width*0.75)+0.5, 0);
        cr.lineTo(Math.round(this.width*0.75)+0.5, this.height);
        cr.stroke();

        // Datas
        cr.setLineWidth(0);
        cr.moveTo(1, this.height - this.datas[0]);

        for (i = 1; i <this.datas.length; i++)
        {
        	cr.lineTo(1+i, this.height - this.datas[i]);
        }

    	cr.lineTo(this.datas.length, this.height);
    	cr.lineTo(1, this.height);

    	cr.closePath();

        pattern = new Cairo.LinearGradient(0, 0, 0, this.height);
        cr.setSource(pattern);
        pattern.addColorStopRGBA(0, 1, 0, 0, 1);
        pattern.addColorStopRGBA(0.5, 1, 1, 0.2, 1);
        pattern.addColorStopRGBA(0.7, 0.4, 1, 0.3, 1);
        pattern.addColorStopRGBA(1, 0.2, 0.7, 1, 1);
        
        cr.fill();

        // Label
		cr.setFontSize(7);
        cr.setSourceRGBA(0, 0, 0, 0.5);
		cr.moveTo(2.5, 7.5);
		cr.showText(this.provider.getName());
        cr.setSourceRGBA(1, 1, 1, 1);
		cr.moveTo(2, 7);
		cr.showText(this.provider.getName());

},

	refreshData: function()
	{
		let data = this.provider.getData()*(this.height-1);

		if (this.datas.push(data)>this.width-2)
		{
			this.datas.shift();
		}
	}
	
};

function CpuDataProvider() {
	this._init();
}

CpuDataProvider.prototype = {
	
	_init: function(){
		this.gtop = new GTop.glibtop_cpu();
		this.current = 0;
		this.last = 0;
		this.usage = 0;
		this.last_total = 0;		
	},

	getData: function()
	{
		GTop.glibtop_get_cpu(this.gtop);

		this.current = this.gtop.idle;

		let delta = (this.gtop.total - this.last_total);
		if (delta > 0) {
			this.usage =(this.current - this.last) / delta;
			this.last = this.current;

			this.last_total = this.gtop.total;
		}

		return 1-this.usage;
	},

	getName: function()
	{
		return "CPU";
	}
};

function MemDataProvider() {
	this._init();
}

MemDataProvider.prototype = {
	
	_init: function(){
			this.gtopMem = new GTop.glibtop_mem();
	},

	getData: function()
	{
		GTop.glibtop_get_mem(this.gtopMem);

		return 1 - (this.gtopMem.buffer + this.gtopMem.cached + this.gtopMem.free) / this.gtopMem.total;
	},

	getName: function()
	{
		return "MEM";
	}
};


function main(metadata, orientation) {
	let myApplet = new MyApplet(orientation);
	return myApplet;
}
