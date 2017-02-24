var gulp = require('gulp');
var zip = require('gulp-zip');
var del = require('del');
var babel = require('gulp-babel');
var clear = require('clear');
var exec = require('child_process').exec;

gulp.task('package', ()=> {
  return gulp.src('./Cinnamenu@json/**/**/*')
    .pipe(zip('ITM-dist-' + Date.now() + '.zip'))
    .pipe(gulp.dest('./builds'));
});

gulp.task('clean', (cb)=>{
  exec('rm -rf ./Cinnamenu@json/', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});


gulp.task('copy', ['clean'], ()=> {
  return gulp.src('./**/**/*')
    .pipe(gulp.dest('./Cinnamenu@json/'));
});

gulp.task('transpile', () =>
  gulp.src('./*.js')
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
    .pipe(gulp.dest('Cinnamenu@json'))
);

gulp.task('install', (cb)=>{
  exec('cp -arf ./ ~/.local/share/cinnamon/applets/Cinnamenu@json', function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
});

gulp.task('reload', ['install'], (cb)=>{
  exec(`dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'Cinnamenu@json' string:'APPLET'`, function (err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
    cb(err);
  });
})

gulp.task('watch', ()=> {
  gulp.watch('./*.{js,json,py,css,md,po}', ['reload']);
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