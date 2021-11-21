var gulp = require('gulp');
var clear = require('clear');
var exec = require('child_process').exec;

gulp.task('install', (cb) => {
  exec('cp -arf ./files/wattusage@joka42/* ~/.local/share/cinnamon/applets/wattusage@joka42', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('reload', ['install'], (cb) => {
  exec(`dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'wattusage@joka42' string:'APPLET'`, function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
})

gulp.task('watch', () => {
  gulp.watch('./files/wattusage@joka42/**/**/**/**/*.{js,json,py,css,md,po}', ['reload']);
});

gulp.task('clear-terminal', () => {
  clear();
});

gulp.task('spawn-watch', ['clear-terminal'], () => {
  var spawnWatch = () => {
    var proc = require('child_process').spawn('gulp', ['watch'], { stdio: 'inherit' });
    proc.on('close', function (code) {
      spawnWatch();
    });
  };
  spawnWatch();
});
gulp.task('default', ['spawn-watch'], () => { });