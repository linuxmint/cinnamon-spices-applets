const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const ByteArray = imports.byteArray;
const Util = imports.misc.util;
const HOME = GLib.get_home_dir();
const HELPER = HOME + '/.local/share/cinnamon/applets/codex-meter@Icators/helper.py';
const STATUS = HOME + '/.cache/codex-meter/status.json';
function pct(x) { return x == null ? '—' : Math.round(x) + '%'; }
function color(x) { return x == null ? '#999999' : x <= 10 ? '#ef4444' : x <= 30 ? '#fb923c' : '#4ade80'; }
function when(t) { return t ? new Date(t * 1000).toLocaleString() : 'not reported'; }
function remaining(t) { if (!t) return 'unknown'; let n = Math.max(0, Math.floor(t - Date.now()/1000)); return Math.floor(n/86400)+'d '+Math.floor(n%86400/3600)+'h '+Math.floor(n%3600/60)+'m'; }
function credits(c) {
 if (c == null) return 'not reported';
 if (typeof c !== 'object') return String(c);
 if (c.hasCredits === false) return 'none';
 if (c.balance !== undefined) return String(c.balance);
 return 'details unavailable';
}
class CodexMeter extends Applet.Applet {
 constructor(metadata, orientation, panelHeight, instanceId) {
  super(orientation, panelHeight, instanceId);
  this.setAllowedLayout(Applet.AllowedLayout.BOTH);
  this.actor.reactive = true;
  this.actor.track_hover = true;
  this._root = new St.BoxLayout({vertical:false, y_align:Clutter.ActorAlign.CENTER, style:'spacing: 12px; padding-left: 7px; padding-right: 7px;'});
  this.actor.set_y_align(Clutter.ActorAlign.CENTER);
  this._five = this._makeMeter('5h');
  this._week = this._makeMeter('W');
  this.actor.add_child(this._root);
  this.menuManager = new PopupMenu.PopupMenuManager(this);
  this.menu = new Applet.AppletPopupMenu(this, orientation);
  this.menuManager.addMenu(this.menu);
  Main.uiGroup.add_actor(this.menu.actor);
  this.menu.actor.hide();
  this._buildMenu();
  this._read();
  this._fetch();
  this._timer = Mainloop.timeout_add_seconds(30, () => { this._read(); return true; });
  this._poll = Mainloop.timeout_add_seconds(60, () => { this._fetch(); return true; });
 }
 _makeMeter(title) {
  let group = new St.BoxLayout({vertical:true, y_align:Clutter.ActorAlign.CENTER, style:'spacing: 3px;'});
  let label = new St.Label({text:title+' —', style:'font-weight: bold; font-size: 11pt;'});
  let track = new St.BoxLayout({vertical:false, style:'background-color: #454545; border-radius: 3px; height: 7px; width: 72px;'});
  let fill = new St.Widget({style:'background-color: #999; border-radius: 3px; height: 7px; width: 0px;'});
  track.add_child(fill); group.add_child(label); group.add_child(track); this._root.add_child(group);
  return {title,label,fill};
 }
 _setMeter(m, value) {
  m.label.set_text(m.title+' '+pct(value));
  m.label.set_style('font-weight: bold; font-size: 11pt; color: '+color(value)+';');
  let w = value == null ? 0 : Math.round(72 * Math.max(0,Math.min(100,value))/100);
  m.fill.set_style('background-color: '+color(value)+'; border-radius: 3px; height: 7px; width: '+w+'px;');
  m.fill.set_width(w);
 }
 // Cinnamon dispatches primary clicks to this method on Applet subclasses.
 on_applet_clicked(event) { this.menu.toggle(); }
 _call(args, done) {
  try {
   let p = Gio.Subprocess.new(['python3', HELPER].concat(args), Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
   p.communicate_utf8_async(null,null,(proc,res)=>{
    try { let [ok,out,err] = proc.communicate_utf8_finish(res);
     if (ok && proc.get_successful()) { if (done) done(out); }
     else this.set_applet_tooltip('Codex Meter: '+(err||'command failed'));
    } catch(e) { this.set_applet_tooltip(String(e)); }
   });
  } catch(e) { this.set_applet_tooltip(String(e)); }
 }
 _terminal(action) {
  try { Gio.Subprocess.new(['x-terminal-emulator','-e','bash',HOME + '/.local/share/cinnamon/applets/codex-meter@Icators/login-terminal.sh',action], Gio.SubprocessFlags.NONE); }
  catch(e) { this.set_applet_tooltip(String(e)); }
 }
 _item(label, fn) { let item = new PopupMenu.PopupMenuItem(label); item.connect('activate',fn); this.menu.addMenuItem(item); }
 _buildMenu() {
  this.menu.removeAll();
  this._item('Add account… (browser login)',()=>this._terminal('add'));
  this._item('Switch account…',()=>this._chooseAccount());
  this._item('Sign out / Remove account…',()=>this._removeAccount());
  this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  this._item('Refresh usage now',()=>this._fetch());
  this._item('Open Codex usage website',()=>Util.spawnCommandLineAsync('xdg-open https://chatgpt.com/settings/usage'));
  this.menu.addMenuItem(new PopupMenu.PopupMenuItem('Codex Quota Meter v1.5.0', {reactive:false}));
 }
 _chooseAccount() {
  this._call(['accounts'],s=>{try {
   let d=JSON.parse(s), ModalDialog=imports.ui.modalDialog;
   let dialog=new ModalDialog.ModalDialog();
   dialog.contentLayout.add(new St.Label({text:'Switch monitored account'}));
   for(let email of d.accounts) {
    let button=new St.Button({label:(email===d.active?'✓  ':'    ')+email,reactive:true,can_focus:true,style:'padding: 9px;'});
    button.connect('clicked',()=>{dialog.close();this._call(['switch',email],()=>this._fetch());});
    dialog.contentLayout.add(button);
   }
   if(!d.accounts.length)dialog.contentLayout.add(new St.Label({text:'No accounts yet. Use Add account.'}));
   dialog.setButtons([{label:'Close',action:()=>dialog.close()}]);dialog.open();
  }catch(e){this.set_applet_tooltip(String(e));}});
 }
 _removeAccount() {
  this._call(['accounts'],s=>{try {
   let d=JSON.parse(s), ModalDialog=imports.ui.modalDialog;
   let dialog=new ModalDialog.ModalDialog();
   dialog.contentLayout.add(new St.Label({text:'Choose account to sign out and remove'}));
   for(let email of d.accounts) {
    let button=new St.Button({label:email,reactive:true,can_focus:true,style:'padding: 9px;'});
    button.connect('clicked',()=>{
     dialog.close();let confirm=new ModalDialog.ModalDialog();
     confirm.contentLayout.add(new St.Label({text:'Sign out and remove '+email+' from the meter?'}));
     confirm.setButtons([{label:'Cancel',action:()=>confirm.close()},
      {label:'Remove',action:()=>{confirm.close();this._call(['remove',email],()=>this._fetch());}}]);
     confirm.open();
    });dialog.contentLayout.add(button);
   }
   if(!d.accounts.length)dialog.contentLayout.add(new St.Label({text:'No accounts saved.'}));
   dialog.setButtons([{label:'Close',action:()=>dialog.close()}]);dialog.open();
  }catch(e){this.set_applet_tooltip(String(e));}});
 }
 _fetch() {this._call(['refresh'],()=>this._read());}
 _read() {
  try {let [ok,raw]=GLib.file_get_contents(STATUS);if(!ok)return;
   let d=JSON.parse(ByteArray.toString(raw)), a=d.five_hour||{},b=d.weekly||{};
   this._setMeter(this._five,a.remaining);this._setMeter(this._week,b.remaining);
   this.set_applet_tooltip('Account: '+(d.account||'not connected')+
    '\n5-hour: '+pct(a.remaining)+' remaining\nReset in: '+remaining(a.reset_at)+'\nReset at: '+when(a.reset_at)+
    '\nWeekly: '+pct(b.remaining)+' remaining\nReset in: '+remaining(b.reset_at)+'\nReset at: '+when(b.reset_at)+
    '\nExtra credits: '+credits(d.credits)+(d.error?'\nStatus: '+d.error:'')+'\nUpdated: '+when(d.updated_at));
  } catch(e) {this.set_applet_tooltip('Codex Meter: '+e);}
 }
 on_applet_removed_from_panel() {if(this._timer)Mainloop.source_remove(this._timer);if(this._poll)Mainloop.source_remove(this._poll);}
}
function main(metadata,orientation,panelHeight,instanceId){return new CodexMeter(metadata,orientation,panelHeight,instanceId);}
