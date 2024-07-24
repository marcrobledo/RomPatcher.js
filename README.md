# Rom Patcher JS
A ROM patcher made in HTML5 and built with [Tauri](https://tauri.app/).

**Features:**
* Supported formats:
   * IPS
   * UPS
   * APS (N64/GBA)
   * BPS
   * RUP
   * PPF
   * Paper Mario Star Rod (.mod)
   * VCDiff (.xdelta, .vcdiff)
* can patch and create patches
* shows ROM CRC32, MD5 and SHA-1 before patching
* can remove headers before patching
* unzips files automatically
* made in Vanilla JS
* can be run in any modern web browser, including mobile



## Known sites that use Rom Patcher JS
* [Romhacking.net](https://www.romhacking.net/)
* [Smash Remix](https://smash64.online/remix/)
* [Radical Red](https://patch.radicalred.net/)
* [Rocket Edition](https://rocket-edition.com/download/)
* [SnapCameraPreservation](https://snapchatreverse.jaku.tv/snap/)
* [Pokemon Clover](https://poclo.net/download)


## For devs:

>*[Node.js](https://nodejs.org/) and [Rust](https://www.rust-lang.org/) required*

**Run `npm i` in order to install node modules**.

#### Run Vite dev server with `npm run dev` and build Tauri release with `npm run tauri build`.
