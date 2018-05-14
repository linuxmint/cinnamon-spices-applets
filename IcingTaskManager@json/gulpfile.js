const gulp = require('gulp');
const clear = require('clear');
const exec = require('child_process').exec;

gulp.task('install', (cb)=>{
  exec('cp -arf ./files/IcingTaskManager@json/ ~/.local/share/cinnamon/applets/ && cp -af ./files/IcingTaskManager@json/metadata.json ~/.local/share/cinnamon/applets/IcingTaskManager@json && cp -af ./files/IcingTaskManager@json/icon.png ~/.local/share/cinnamon/applets/IcingTaskManager@json', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('reload', ['install'], (cb)=>{
  exec(`dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'IcingTaskManager@json' string:'APPLET'`, function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
})

gulp.task('watch', ()=> {
  gulp.watch('./files/IcingTaskManager@json/**/**/**/**/*.{js,json,py,css,md,po}', ['reload']);
});

gulp.task('clear-terminal', ()=> {
  clear();
});

gulp.task('spawn-watch', ['clear-terminal'], ()=> {
 let spawnWatch = ()=> {
    let proc = require('child_process').spawn('gulp', ['watch'], {stdio: 'inherit'});
    proc.on('close', function (code) {
      spawnWatch();
    });
  };
  spawnWatch();
});
gulp.task('default', ['spawn-watch'], ()=> {});