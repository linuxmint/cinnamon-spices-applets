const fs = require('fs');
const os = require('os');
const gulp = require('gulp');
const clear = require('clear');
const {exec, execSync} = require('child_process');

const getArgs = function() {
    const argv = require('yargs')
    .option('uuid', {
        alias: 'u'
    })
    .argv;

    const UUID = argv.u;

    if (!UUID) {
        throw new Error('Unable to get the UUID.');
    }

    return UUID;
}

gulp.task('install', (done) => {
    const UUID = getArgs();
    const homeDir = os.homedir();
    const systemXletDir = `${homeDir}/.local/share/cinnamon/applets/${UUID}/`;
    const localXletDir = `./${UUID}/files/${UUID}/`;
    const systemDirExists = fs.existsSync(systemXletDir);
    const localDirExists = fs.existsSync(localXletDir);
    const userInfo = os.userInfo();

    if (!systemDirExists) {
        console.log(
            'Xlet does not exist in the system directory. Attempting to create the directory:\n' +
            systemXletDir
        );
        execSync(`mkdir ${systemXletDir}`);
    }

    if (!localDirExists) {
        throw new Error('Xlet does not exist in the local directory.');
    }

    const {uid, gid} = fs.statSync(systemXletDir);

    if (uid !== userInfo.uid || gid !== userInfo.gid) {
        throw new Error(`Incorrect permission are set for the applets directory. Please run 'gulp help'.`);
    }

    exec(`rm -rf ${systemXletDir} && ` +
        `cp -arf ${localXletDir} ${systemXletDir}`,
        function(err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            done();
        }
    );
});

const reload = function(done) {
    const UUID = getArgs();
    exec(
        'dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call '
        + '/org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension '
        + `string:'${UUID}' string:'APPLET'`,
        function(err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            done();
        }
    );
};

gulp.task('reload', gulp.series('install', reload));

gulp.task('_watch', (done) => {
    const UUID = getArgs();
    const localXletDir = `./${UUID}/files/${UUID}`;
    const glob = `${localXletDir}/**/**/**/*.{js,json,py,css,po}`;
    const localDirExists = fs.existsSync(localXletDir);

    if (!localDirExists) {
       throw new Error('Xlet does not exist in the local directory.');
    }

    console.log(`Watching glob pattern: ${glob}`)
    gulp.watch(glob)
    .on('change', gulp.parallel('reload'));
    done();
});

gulp.task('clear-terminal', (done) => {
    clear();
    done();
});

gulp.task('watch', gulp.series('clear-terminal', (done) => {
    let [, , , uuid] = process.argv;
    let spawnWatch = () => {
        let proc = require('child_process').spawn('gulp', ['_watch', uuid], {stdio: 'inherit'});
        proc.on('close', function(code) {
            spawnWatch();
        });
    };
    spawnWatch();
    done();
}));

gulp.task('help', gulp.series('clear-terminal', (done) => {
    console.log(
        `Usage: gulp watch [flags]

        This file uses gulp to provide a watch task for xlet development.
        It will copy the xlet files from the UUID directory specified and
        auto-reload the applet on code change.

        Install gulp globally.

        npm: 'npm install -g gulp@^4.0.0'
        yarn: 'yarn global add gulp@^4.0.0'

        To use this script, run 'gulp watch --uuid="<xlet uuid>"'.
        Example: 'gulp watch --uuid="grouped-window-list@cinnamon.org"'

        Options:
            --uuid                 UUID of the xlet to watch.
        `
    );
    done();
}));

gulp.task('default', gulp.series('watch', (done) => done()));