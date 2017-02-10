var gulp = require('gulp');
var zip = require('gulp-zip');
var del = require('del');
var babel = require('gulp-babel');
var clear = require('clear');
var exec = require('child_process').exec;

gulp.task('package', ()=> {
  return gulp.src('./files/**/**/*')
    .pipe(zip('ITM-dist-' + Date.now() + '.zip'))
    .pipe(gulp.dest('./builds'));
});

gulp.task('copy', ()=> {
  del.sync(['./files/**/**/*']);
  return gulp.src('./src/**/**/*')
    .pipe(gulp.dest('./files/'));
});

gulp.task('transpile', ['copy'], () =>
  gulp.src('./src/*.js')
    .pipe(babel({
      presets: [
        'es2015',
        'mozjs24'
      ],
      plugins: [
        [
          'transform-es2015-classes',
          {
            loose: true
          }
        ],
        [
          'babel-plugin-transform-builtin-extend',
          {
            globals: ['Error', 'Array', 'Set', 'Object'],
            approximate: false
          }
        ],
        'transform-es2015-parameters',
        'transform-es2015-destructuring'
      ],
      ignore: [
        './src/lodash.js'
      ]
    }))
    .pipe(gulp.dest('files'))
);

gulp.task('install', ['transpile'], (cb)=>{
  exec('cp -avrf ./files/ ~/.local/share/cinnamon/applets/IcingTaskManager@json && ./locale.sh', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
})

gulp.task('reload', ['install'], (cb)=>{
  exec(`dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'IcingTaskManager@json' string:'APPLET'`, function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
})

gulp.task('watch', ()=> {
  gulp.watch('./src/*.{js,json,py,css,md,po}', ['reload']);
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