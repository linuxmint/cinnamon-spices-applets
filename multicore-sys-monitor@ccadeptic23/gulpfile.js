var gulp = require('gulp');
var zip = require('gulp-zip');
var del = require('del');
var clear = require('clear');
var exec = require('child_process').exec;

gulp.task('install', (cb)=>{
  exec('cp -arf ./files/multicore-sys-monitor@ccadeptic23/3.4/* ~/.local/share/cinnamon/applets/multicore-sys-monitor@ccadeptic23 && cp -af ./files/multicore-sys-monitor@ccadeptic23/metadata.json ~/.local/share/cinnamon/applets/multicore-sys-monitor@ccadeptic23 && cp -af ./icon.png ~/.local/share/cinnamon/applets/multicore-sys-monitor@ccadeptic23', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('reload', ['install'], (cb)=>{
  setTimeout(()=>{
    exec(`dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'multicore-sys-monitor@ccadeptic23' string:'APPLET'`, function (err, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
      cb(err);
    });
  }, 1000);
})

gulp.task('watch', ()=> {
  gulp.watch('./files/multicore-sys-monitor@ccadeptic23/3.4/**/**/**/**/*.{js,json,py,css,md,po}', ['reload']);
});

gulp.task('clear-terminal', ()=> {
  clear();
});

gulp.task('spawn-watch', ['clear-terminal'], ()=> {
 var spawnWatch = ()=> {
    var proc = require('child_process').spawn('gulp', ['watch'], {stdio: 'inherit'});
    proc.on('close', function (code) {
      spawnWatch();
    });
  };
  spawnWatch();
});
gulp.task('default', ['spawn-watch'], ()=> {});