# F-List Exported
This repository contains the open source parts of F-list and F-Chat 3.0.
All necessary files to build F-Chat 3.0 as an Electron, Cordova or web application are included.

## Setting up a Dev Environment
 - Clone the repo.
 - Install [Yarn](https://yarnpkg.com/en/docs/install).
 - Change into the cloned directory and run `yarn install`.
 - To build native Node assets, you will need to install Python 2.7 and the Visual C++ 2015 Build tools. [More information can be found in the node-gyp docs](https://github.com/nodejs/node-gyp#installation).
 - IntelliJ IDEA is recommended for development.
 
## Building for Electron
 - Change into the `electron` directory.
 - Run `yarn install` and then `yarn build`/`yarn watch` to build assets. They are placed into the `app` directory.
 - You will probably need to rebuild the native dependencies (`spellchecker` and `keytar`) for Electron. To do so, run `npm rebuild {NAME} --target={ELECTRON_VERSION} --arch=x64 --dist-url=https://atom.io/download/electron`. [See Electron documentation for more info](https://github.com/electron/electron/blob/master/docs/tutorial/using-native-node-modules.md).
 - Run `yarn start` to start the app in debug mode. Use `Ctrl+Shift+I` to open the Chromium debugger.

### Packaging
[See Electron application distribution documentation](https://electron.atom.io/docs/tutorial/application-distribution/).
 - Run `yarn build:dist` to create a minified production build.
 - Run `./node_modules/.bin/electron-builder` with [options specifying the platform you want to build for](https://www.electron.build/cli).

## Building for Cordova
 - Change into the `cordova` directory.
 - Install Cordova using `yarn global add cordova`.
 - Run `yarn install`.
 - Create a `www` directory inside the `cordova` directory and then run `cordova prepare` to install dependencies.
 - Run `cordova requirements` to see whether all requirements for building are installed.
 - Run `yarn build`/`yarn watch` to build assets. They are placed into the `www` directory.
 - Run `cordova build`. For Android, the generated APK is now in `platforms/android/build/outputs/apk`.

## Dependencies
Note: Adding *and upgrading* dependencies should only be done with prior consideration and subsequent testing.

That's why `yarn.lock` exists and is version controlled.

To upgrade NPM dependencies, run `yarn upgrade` locally. Run `yarn outdated` to see pending upgrades.
