imports.searchPath.push( imports.ui.appletManager.appletMeta["gmailnotifier@denisigo"].path );

const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;

const Applet = imports.ui.applet;
const Util = imports.misc.util;

const GmailFeeder=imports.gmailfeeder;
const Settings=imports.settings;

function MyApplet(orientation) {
  this._init(orientation);
}

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(orientation) {
    this._chkMailTimerId = 0;
    this.newMailsCount=0;
    
    this.checkTimeout=Settings.checktimeout*1000;

    Applet.IconApplet.prototype._init.call(this, orientation);
    
    var this_=this;

    try {
      this.set_applet_icon_symbolic_name('mail-unread-symbolic');
      this.set_applet_tooltip(_("Open Gmail"));
      
      this.gf=new GmailFeeder.GmailFeeder({
        'username':Settings.username,
        'password':Settings.password,
        'callbacks':{
          'onError':function(a_code,a_params){this_.onGfError(a_code,a_params)},
          'onNewMail':function(a_params){this_.onGfNewMail(a_params)},
          'onNoNewMail':function(a_params){this_.onGfNoNewMail()}
        }
      });

      this.updateChkMailTimer(5000);
    }
    catch (e) {
      global.logError(e);
    }
  },
  
  onGfError: function(a_code,a_params) {
    switch (a_code){
      case 'authFailed':
        this.showNotify("GmailNotifier",_("Gmail authentication failed!"));
        this.set_applet_tooltip(_("Gmail authentication failed!"));
      break;
      case 'feedReadFailed':
        this.showNotify("GmailNotifier",_("Gmail feed reading failed!"));
        this.set_applet_tooltip(_("Gmail feed reading failed!"));
      break;
      case 'feedParseFailed':
        this.showNotify("GmailNotifier",_("Gmail feed parsing failed!"));
        this.set_applet_tooltip(_("Gmail feed parsing failed!"));
      break;
    }
  },
  
  onGfNoNewMail: function() {
    this.set_applet_icon_symbolic_name('mail-unread-symbolic');
    this.set_applet_tooltip(_('You don\'t have a new mail.'));
    this.newMailsCount=0;
  },
  
  onGfNewMail: function(a_params) {
  
    var absNewMailsCount=a_params.count-this.newMailsCount;
    this.newMailsCount=a_params.count;
    
    if (a_params.count==1)
      this.set_applet_tooltip(_('You have one new mail. Click to open Gmail.'));
    else
      this.set_applet_tooltip(_('You have '+a_params.count+' new mails. Click to open Gmail.'));
    
    this.set_applet_icon_symbolic_name('mail-read-symbolic');
  
    if (absNewMailsCount>0){
      var notifyTitle=_('You have one new mail.');
      if (absNewMailsCount>1)
        notifyTitle=_('You have '+absNewMailsCount+' new mails.');
      var notifyText='';
      
      var mailsToDisplay=absNewMailsCount;
      if (mailsToDisplay>4)
        mailsToDisplay=4;
      
      for (var i=0; i<mailsToDisplay; i++){
      
        var authorName=a_params.messages[i].authorName;
        var title=a_params.messages[i].title;
      
        notifyText+='<b>'+authorName+'</b>: '+title+'\r\n';
      }
      this.showNotify(notifyTitle,notifyText);
    }
    
  },
  
  showNotify: function(a_title,a_message){
    a_title=a_title.replace(/"/g, "&quot;");
    a_message=a_message.replace(/"/g, "&quot;");
    
    Util.spawnCommandLine("notify-send --icon=mail-read \""+a_title+"\" \""+a_message+"\"");
  },

  on_applet_clicked: function(event) {
    Util.spawnCommandLine("xdg-open http://gmail.com");
  },
  
  updateChkMailTimer: function(timeout) {

    if (this._chkMailTimerId) {
        Mainloop.source_remove(this._chkMailTimerId);
        this._chkMailTimerId = 0;
    }
    if (timeout > 0)
        this._chkMailTimerId = Mainloop.timeout_add(timeout,Lang.bind(this, this.onChkMailTimer));
  },

  onChkMailTimer: function() {

	  this.gf.check();
    this.updateChkMailTimer(this.checkTimeout);

  }
};

function main(metadata, orientation) {
  let myApplet = new MyApplet(orientation);
  return myApplet;
}
