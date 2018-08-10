const path = require('path');
const pkg = require(path.join(__dirname, 'package.json'));
const fs = require('fs');
const child_process = require('child_process');

function mkdir(dir) {
    try {
        fs.mkdirSync(dir);
    } catch(e) {
        if(!(e instanceof Error)) throw e;
        switch(e.code) {
            case 'ENOENT':
                const dirname = path.dirname(dir);
                if(dirname === dir) throw e;
                mkdir(dirname);
                mkdir(dir);
                break;
            default:
                try {
                    const stat = fs.statSync(dir);
                    if(stat.isDirectory()) return;
                } catch(e) {
                    console.log(e);
                }
                throw e;
        }
    }
}

const distDir = path.join(__dirname, 'dist');
const isBeta = pkg.version.indexOf('beta') !== -1;
const spellcheckerPath = 'node_modules/spellchecker/build/Release/spellchecker.node',
    keytarPath = 'node_modules/keytar/build/Release/keytar.node';
mkdir(path.dirname(path.join(__dirname, 'app', spellcheckerPath)));
mkdir(path.dirname(path.join(__dirname, 'app', keytarPath)));
fs.copyFileSync(spellcheckerPath, path.join(__dirname, 'app', spellcheckerPath));
fs.copyFileSync(keytarPath, path.join(__dirname, 'app', keytarPath));

require('electron-packager')({
    dir: path.join(__dirname, 'app'),
    out: distDir,
    overwrite: true,
    name: 'F-Chat',
    icon: path.join(__dirname, 'build', 'icon'),
    ignore: ['\.map$'],
    osxSign: process.argv.length > 2 ? {identity: process.argv[2]} : false,
    prune: false
}).then((appPaths) => {
    if(process.platform === 'win32') {
        console.log('Creating Windows installer');
        const icon = path.join(__dirname, 'build', 'icon.ico');
        const setupName = `F-Chat Setup.exe`;
        if(fs.existsSync(path.join(distDir, setupName))) fs.unlinkSync(path.join(distDir, setupName));
        const nupkgName = path.join(distDir, `fchat-${pkg.version}-full.nupkg`);
        const deltaName = path.join(distDir, `fchat-${pkg.version}-delta.nupkg`);
        if(fs.existsSync(nupkgName)) fs.unlinkSync(nupkgName);
        if(fs.existsSync(deltaName)) fs.unlinkSync(deltaName);
        if(process.argv.length <= 3) console.warn('Warning: Creating unsigned installer');
        require('electron-winstaller').createWindowsInstaller({
            appDirectory: appPaths[0],
            outputDirectory: distDir,
            iconUrl: icon,
            setupIcon: icon,
            noMsi: true,
            exe: 'F-Chat.exe',
            title: 'F-Chat',
            setupExe: setupName,
            remoteReleases: 'https://client.f-list.net/win32/' + (isBeta ? '?channel=beta' : ''),
            signWithParams: process.argv.length > 3 ? `/a /f ${process.argv[2]} /p ${process.argv[3]} /fd sha256 /tr http://timestamp.digicert.com /td sha256` : undefined
        }).catch((e) => console.log(`Error while creating installer: ${e.message}`));
    } else if(process.platform === 'darwin') {
        console.log('Creating Mac DMG');
        const target = path.join(distDir, `F-Chat.dmg`);
        if(fs.existsSync(target)) fs.unlinkSync(target);
        const appPath = path.join(appPaths[0], 'F-Chat.app');
        if(process.argv.length <= 2) console.warn('Warning: Creating unsigned DMG');
        require('appdmg')({
            basepath: appPaths[0],
            target,
            specification: {
                title: 'F-Chat',
                icon: path.join(__dirname, 'build', 'icon.png'),
                background: path.join(__dirname, 'build', 'dmg.png'),
                contents: [{x: 555, y: 345, type: 'link', path: '/Applications'}, {x: 555, y: 105, type: 'file', path: appPath}],
                'code-sign': process.argv.length > 2 ? {
                    'signing-identity': process.argv[2]
                } : undefined
            }
        }).on('error', console.error);
        const zipName = `F-Chat_${pkg.version}.zip`;
        const zipPath = path.join(distDir, zipName);
        if(fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        const child = child_process.spawn('zip', ['-r', '-y', '-9', zipPath, 'F-Chat.app'], {cwd: appPaths[0]});
        child.stdout.on('data', () => {});
        child.stderr.on('data', (data) => console.error(data.toString()));
        fs.writeFileSync(path.join(distDir, 'updates.json'), JSON.stringify({
            releases: [{version: pkg.version, updateTo: {url: 'https://client.f-list.net/darwin/' + zipName}}],
            currentRelease: pkg.version
        }));
    } else {
        console.log('Creating Linux AppImage');
        fs.renameSync(path.join(appPaths[0], 'F-Chat'), path.join(appPaths[0], 'AppRun'));
        fs.copyFileSync(path.join(__dirname, 'build', 'icon.png'), path.join(appPaths[0], 'icon.png'));
        fs.symlinkSync(path.join(appPaths[0], 'icon.png'), path.join(appPaths[0], '.DirIcon'));
        fs.writeFileSync(path.join(appPaths[0], 'fchat.desktop'), '[Desktop Entry]\nName=F-Chat\nExec=AppRun\nIcon=icon\nType=Application\nCategories=GTK;GNOME;Utility;');
        require('axios').get('https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage', {responseType: 'stream'}).then((res) => {
            const downloaded = path.join(distDir, 'appimagetool.AppImage');
            res.data.pipe(fs.createWriteStream(downloaded));
            res.data.on('end', () => {
                const args = [appPaths[0], 'fchat.AppImage', '-u', 'zsync|https://client.f-list.net/fchat.AppImage.zsync'];
                if(process.argv.length > 2) args.push('-s', '--sign-key', process.argv[2]);
                else console.warn('Warning: Creating unsigned AppImage');
                if(process.argv.length > 3) args.push('--sign-args', `--passphrase=${process.argv[3]}`);
                child_process.spawn(downloaded, ['--appimage-extract'], {cwd: distDir}).on('close', () => {
                    const child = child_process.spawn(path.join(distDir, 'squashfs-root', 'AppRun'), args, {cwd: distDir});
                    child.stdout.on('data', (data) => console.log(data.toString()));
                    child.stderr.on('data', (data) => console.error(data.toString()));
                });
            });
        }, (e) => console.error(`HTTP error: ${e.message}`));
    }
}, (e) => console.log(`Error while packaging: ${e.message}`));