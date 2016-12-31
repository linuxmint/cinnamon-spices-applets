/*
 * Enjoy it! Pray it works :)
 * 
 */

const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;
const Main = imports.ui.main;

var slidersid=[];
var sliders=[];
var sli=[];
var vals=[];
var labels=[];
var table;
/*
const PanelMenu = imports.ui.panelMenu;
*/


const VOLUME_STEP = 1;
const MIXER_ELEMENT = 'Master';
const ICON_SIZE = 28;

function TextImageMenuItem() {
    this._init.apply(this, arguments);
}

TextImageMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, position, value) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor = new St.BoxLayout();
        this.actor.add_style_pseudo_class('active');
	
	sliders[position]=new PopupMenu.PopupSliderMenuItem((value-50)/((100-50)/100)/100);
	labels[position] = new St.Label({text: text,  width: 50,y_align:St.Align.MIDDLE});
	this.actor.add_actor(labels[position],{y_align:St.Align.MIDDLE});
        this.actor.add_actor(sliders[position].actor, { span: -1,x_align:St.Align.END });
	vals[position]=new St.Label({text: (value-50).toString()});
        this.actor.add_actor(vals[position], { span: 2,x_align:St.Align.END });
       
    },

    setText: function(text) {
        this.text.text = text;
    },

   
}





function MyApplet(orientation) {
    this._init(orientation);
}
  
MyApplet.prototype = {
 __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation) {
        Applet.TextIconApplet.prototype._init.call(this, orientation);
	this.volumes=[];this.f=0;this.freq=[];lables=[];this.cvalues=[];this.eachslider=[];this.box=[];this.bin=[];vals=[];this.temp=[];
	this.volmixer=[];this.mixerlabels=[];this.amixersls=[];this.mixers=[];this.mixerl=[];this.mixerv=[];
        try {
	  this.menuManager = new PopupMenu.PopupMenuManager(this);
	  this.menu = new Applet.AppletPopupMenu(this, orientation);
	  this.menuManager.addMenu(this.menu);       
	  var mainBox = new St.BoxLayout({ vertical: true, x_align: St.Align.MIDDLE});
	  this.menu.addActor(mainBox,{y_fill: true, y_align: St.Align.MIDDLE});
	  //this.textare=new St.Label({text : "AlsaMixer Equalizer", x_align:St.Align.MIDDLE, y_align: St.Align.MIDDLE});
	  //mainBox.add_actor(this.textare, {y_align: St.Align.MIDDLE});
	  this.alsamixer=new PopupMenu.PopupSubMenuMenuItem(_("AlsaMixer"));
	  this.menu.addMenuItem(this.alsamixer);
	  this.check=this.checkforfilter();
	  if (this.check) {
	    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())
	    this.alsaequal=new PopupMenu.PopupSubMenuMenuItem(_("AlsaEqual"));
	    this.menu.addMenuItem(this.alsaequal);
	  }
//	  this.label = new St.Label({ text: "vasilica fara frica"});
//	  this.actor.add_actor(this.label);
	  this.statusIcon = new St.Icon({   icon_name: 'audio-volume-medium',
            style_class: 'status-icon', icon_size: '20'});
	  
	  this.actor.add_actor(this.statusIcon);
	  table=new St.Table({            homogeneous: false        });

	//  this.label.text="before volumes";


        this.volmixer=this.getVolumes('');
	this.mixerlabels=this.temp;
	f=0
	let menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false});
	 
	 this.mixerl[f] = new St.Label({text: "Volume"});
	 this.mixers[f]=new PopupMenu.PopupSliderMenuItem(this.volmixer[f]/100); 
	 this.mixers[f].connect('value-changed', Lang.bind(this, this._onSliderMixer));
	 this.mixerv[f]=new St.Label({text: (this.volmixer[f]).toString()});
	 menuItem.addActor(this.mixerl[f],{align: St.Align.END, expand: false});
	 menuItem.addActor(this.mixers[f].actor,{expand: true});
	 menuItem.addActor(this.mixerv[f]);
	 
	this.menu.addMenuItem(menuItem,0); 
	for(f=1;f<this.volmixer.length;f++) {
	  if (!isNaN(this.volmixer[f])){
	    let menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false});
	    this.mixerl[f] = new St.Label({text: this.mixerlabels[f]});
	    this.mixers[f]=new PopupMenu.PopupSliderMenuItem(this.volmixer[f]/100); 
	    this.mixers[f].connect('value-changed', Lang.bind(this, this._onSliderMixer));
	    this.mixerv[f]=new St.Label({text: (this.volmixer[f]).toString()});
	    menuItem.addActor(this.mixerl[f],{align: St.Align.END, expand: false});
	    menuItem.addActor(this.mixers[f].actor,{expand: true});
	    menuItem.addActor(this.mixerv[f]);
	    this.alsamixer.menu.addMenuItem(menuItem);
	    
	  }
	  
	}
	this.amixersls=this.findoutsliders(this.mixers);

	this.temp=[];
	if (this.check) {
	  this.volumes=this.getVolumes('-D equal');
	  this.freq=this.temp;
	  for(f=0;f<this.volumes.length;f++) {
	    let menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false});
	    labels[f] = new St.Label({text: this.freq[f].split(". ")[1]});
	    sliders[f]=new PopupMenu.PopupSliderMenuItem((this.volumes[f]-50)/((100-50)/100)/100); 
	    sliders[f].connect('value-changed', Lang.bind(this, this._onSlider));
	    vals[f]=new St.Label({text: (this.volumes[f]-50).toString()});
	    menuItem.addActor(labels[f],{align: St.Align.END, expand: false});
	    menuItem.addActor(sliders[f].actor,{expand: true});
	    menuItem.addActor(vals[f]);
	    // let test=new TextImageMenuItem(this.freq[f].split(". ")[1],f,this.volumes[f]);	    
	    //  sliders[f].connect('value-changed', Lang.bind(this, this._onSlider));
	    this.alsaequal.menu.addMenuItem(menuItem);
    
	  }
	  slidersid=this.findoutsliders(sliders);
	  
	}
	
	  
	}
	catch (e) {
	  global.logError(e);
	}
    },
    
/*    findoutsliders: function(){
      let sls=sliders+"";let arr=[];
      for(f=0;f<this.volumes.length;f++)
      {
	arr[f]=sls.split("[object Object delegate for ")[f+1].split(" ")[0];
	
      }
      return arr;
    },
*/    
    checkforfilter: function() {
      //let what="
      let ret = GLib.spawn_command_line_sync('amixer scontrols -D equal');
      let temp=-1;
      for(f=0;f<ret.length;f++){
	let t=ret[f].toString();
	if (t.indexOf("amixer: Mixer attach equal error")!=-1) temp=0;
      }
      return (temp==-1) ? true:false;
      
    },
    
    findoutsliders: function(obj){
      let sls=obj+"";let arr=[];
      for(f=0;f<this.temp.length;f++)
      {
	arr[f]=sls.split("[object Object delegate for ")[f+1].split(" ")[0];
      }
      return arr;
      
    },

     on_applet_clicked: function(event) {
       //this._getVolume();
        this.menu.toggle(); 
	//this._onUpdate;
    },
/*    on_applet_removed_from_panel : function() {
      if(this._timeoutId)
      {Mainloop.source_remove(this._timeoutId);
      }
    },
*/    
    getVolumes: function(what)
    {
      let values=[];
      let val=-1;
      let t=0;
      let ret = GLib.spawn_command_line_sync('amixer scontrols '+what);
     
      let sense_lines=ret[1].toString().split("\n");
      for(f=0;f<sense_lines.length-1;f++)
      {

/*	this.temp[f]=sense_lines[f].split("'")[1];
	//values[f]=(this._getVolume(this.freq[f])-50)*2;
	values[f]=this._getVolume(this.temp[f],what);	
*/	
	 val=this._getVolume(sense_lines[f].split("'")[1],what);
         if (val!=-1)
	 {
	   this.temp[t]=sense_lines[f].split("'")[1];
	   values[t]=val;
	   t++;
	   
	}
      }
      return values;
    },
    
   _getVolume: function(value,what) {
     let comm='amixer get '+what+' "'+value+'"';
     let volume=-1;
     let ret = GLib.spawn_command_line_sync(comm);     
//     let senses_lines=ret[1].toString().split("\n");
//     let values = senses_lines[5].toString();
     if(ret[1].toString().indexOf("pvolume")!=-1||ret[1].toString().indexOf("cvolume")!=-1)
     {values1=ret[1].toString().split('[')[1].toString().split(']')[0].toString();
      volume = values1.substr(0,values1.length - 1);}
     return volume;
     
    },
 
/*    _setVolume: function(index,value) {
      vals[index].text=Math.round((100-50)/100*(value)).toString();
     // this.
      
      let comm='amixer -q -D equal set "'+this.freq[index]+'" '+(((100-50)/100*(value))+50) + '%';
 	return GLib.spawn_command_line_async(comm);
        this._cVolume = value;
	//this.textare.text=this._cVolume+"%";
        this._updateIcon(value);
    },
*/   

    _setVolume: function(index,value,whichone,what) {
      let comm='amixer -q '+whichone+' set "'+what+'" '+value + '%';
      if(whichone==" " && what=='Master') this._updateIcon(value);
 	return GLib.spawn_command_line_async(comm);
       
    },
   
    _updateIcon: function(value) {
      if (this.statusIcon.get_icon_name() != this._getIcon(value)) {
            let icon = this._getIcon(value);
            this.statusIcon.set_icon_name(icon);
        }
    },
  
    _getIcon: function(volume) {
        let rvalue = 'audio-volume-muted';
        if (volume < 1) {
            rvalue = 'audio-volume-muted';
        } else {
            let num = Math.floor(3 * volume / 100) + 1;

            if (num >= 3)
                rvalue = 'audio-volume-high';
            else if(num < 2)
                rvalue = 'audio-volume-low';
            else
                rvalue = 'audio-volume-medium';
        }
        return rvalue;
    },
 

    _onSlider: function(slider, value) {
        let volume = (value) * 100;
	let index=slidersid.indexOf(slider.toString().split("[object Object delegate for ")[1].split(" ")[0]);
	let value=volume;
        this._setVolume(index,(((100-50)/100*(value))+50),'-D equal',this.freq[index]);
	vals[index].text=Math.round((100-50)/100*(value)).toString();
	//this.label.text=Math.round(volume)+"";
    },
    
    _onSliderMixer:function(slider, value) {
        let volume = (value) * 100;
	let index=this.amixersls.indexOf(slider.toString().split("[object Object delegate for ")[1].split(" ")[0]);
        this._setVolume(index,volume,' ', this.mixerlabels[index]);
	this.mixerv[index].text=Math.round(volume)+"";
    },
    
/*    _dragend: function(slider, value) {
         let volume = value * 100;
	 global.log("\ninsider _dragend\n")
	 let index=slidersid.indexOf(slider.toString().split("[object Object delegate for ")[1].split(" ")[0]);
	global.log("slider="+index+"   "+slider.toString());
        this._setVolume(index,volume);
    },
    _onUpdate: function() {
        this.volumes=this.getVolumes();
	for(f=0;f<this.volumes.length;f++) {
	   lables[f]=new St.Label({ text: this.freq[f]});
	   sliders[f]=new PopupMenu.PopupSliderMenuItem(this.volumes[f]/100);
	}
        return true;
    },
*/    
    destroy: function() {
        this.parent();
        Mainloop.source_remove(this._timeoutId);
        this.actor.disconnect(this._onScrollId);
        this.pup.disconnect(this._onSliderId);
    }
};


function main(metadata, orientation) {
	//log("v" + metadata.version);
	let myApplet = new MyApplet(orientation);
	return myApplet;
}
