# F-List Exported
This repository contains the open source parts of F-list and F-Chat 3.0.
All necessary files to build F-Chat 3.0 as an Electron, mobile or web application are included.

## Setting up a Dev Environment
 - Clone the repo
 - Install [Yarn](https://yarnpkg.com/en/docs/install)
 - Change into the cloned directory and run `yarn install`. If you only want to make a custom theme, you do not need to do this!
 - IntelliJ IDEA is recommended for development.
 
## Building for Electron
 - To build native Node assets, you will need to install Python 2.7 and the Visual C++ 2015 Build tools. [More information can be found in the node-gyp docs.](https://github.com/nodejs/node-gyp#installation)
 - Change into the `electron` directory.
 - Run `yarn build`/`yarn watch` to build assets. They are placed into the `app` directory.
 - Run `yarn start` to start the app in debug mode. Use `Ctrl+Shift+I` to open the Chromium debugger.

### Packaging
See https://electron.atom.io/docs/tutorial/application-distribution/
 - Run `yarn build:dist` to create a minified production build.
 - Run `yarn run pack`. The generated installer is placed into the `dist` directory.
   - On Windows you can add the path to and password for a code signing certificate as arguments.
   - On Mac you can add your code signing identity as an argument. `zip` is required to be installed.
   - On Linux you can add a GPG key for signing and its password as arguments. `mksquashfs` and `zsyncmake` are required to be installed.

### Building under Windows

Because of the code's age, it's necessary to use some older versions of related tools. The specific steps that have gotten a successful build under Windows are:

1) Install and use PowerShell 7 as Administrator
2) Download and install Python 2.7.18: https://www.python.org/downloads/release/python-2718/
3) Install Visual Studio 2015 C++ tools (Download `mu_visual_cpp_build_tools_2015_update_3_x64_dvd_dfd9a39c.iso` from Microsoft Developer)
4) Install Scoop packager: https://scoop.sh/
5) Install FNM with Scoop: `scoop install fnm`
6) Install Git with Scoop: `scoop install git`
7) Check that FNM is installed: `fnm --version`
8) Add FNM environment variables to PowerShell 7:

Create powershell profile: `if (-not (Test-Path $profile)) { New-Item $profile -Force }`
Open profile in editor: `Invoke-Item $profile`
Add to file and save: fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression`

9) Install Node 10 with FNM: `fnm install 10.24.1`
10) Set up Node 10 to be used globally: `fnm use 10.24.1`
11) Check node version: `node -v`
12) Install Yarn Classic: `npm install --global yarn`
13) Clone this repo
14) Enter the exported directory and install the Node modules: `yarn install`
16) Enter 'electron' and build it: `yarn build` for dev, or `yarn build:dist` for prod
17) To launch a test version of the app: `yarn start`
18) To package it, enter electron: `yarn run pack`
19) There should now be a "dist" folder with a ZIP, an installer and RELEASE/ NUPKG files.

## Building for Mobile
 - Change into the `mobile` directory.
 - Run `yarn build`/`yarn watch` to build assets. They are placed into the `www` directory.
 - For Android, change into the `android` directory and run `./gradlew assembleDebug`. The generated APK is placed into `app/build/outputs/apk`.
 - For iOS, change into the `ios` directory and open `F-Chat.xcodeproj` using XCode. From there, simply run the app using the play button.

## Building for Web
 - Change into the `webchat` directory.
 - Run `yarn build`/`yarn watch` to build assets. They are placed into the `dist` directory.
 - The compiled main.js file can be included by an HTML file that is expected to provide a global `const chatSettings: {account: string, theme: string, characters: ReadonlyArray<string>, defaultCharacter: string | null};`. It should also normalize the page to 100% height.

## Building a custom theme
See [the wiki](https://wiki.f-list.net/F-Chat_3.0/Themes) for instructions on how to create a custom theme.
 - Change into the `scss` directory.
 - Run `yarn install`.
 - Run `yarn build themes/chat/{name}.scss`.
 - Your theme file will be placed into the `scss/css` directory.

## Dependencies
Note: Adding *and upgrading* dependencies should only be done with prior consideration and subsequent testing.

That's why `yarn.lock` exists and is version controlled.

To upgrade NPM dependencies, run `yarn upgrade` locally. Run `yarn outdated` to see pending upgrades.
