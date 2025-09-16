# Rom Patcher JS
A ROM patcher made in Javascript.

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
   * BSDiff (.bdf, .bspatch) (patch only)
* can patch and create patches
* shows ROM CRC32, MD5 and SHA-1 before patching
* can remove headers before patching
* unzips files automatically
* made in Vanilla JS
* can be run in any modern web browser (including mobile) and Node.js
* can be customized and embeded into your website for a custom patcher


&nbsp;
## Embedding Rom Patcher JS in your site
Modders and hackers can embed Rom Patcher JS in their websites to provide an online ROM patcher for their patches, allowing users to patch ROMs without downloading any files.<br/>

- File [`index_template.html`](https://github.com/marcrobledo/RomPatcher.js/blob/master/index_template.html) includes a simple working example
- Read [the wiki](https://github.com/marcrobledo/RomPatcher.js/wiki/Embedding-Rom-Patcher-JS) for more detailed instructions


&nbsp;
## Using Rom Patcher JS in Node CLI
Install dependencies:
> npm install

Patch a ROM:
> node index.js patch "my_rom.bin" "my_patch.ips"

Create an IPS patch:
> node index.js create "original_rom.bin" modified_rom.bin"

Show all options:
> node index.js patch --help<br/>
> node index.js create --help


&nbsp;
## Known sites that use Rom Patcher JS
* [Romhacking.net](https://www.romhacking.net/)
* [Smash Remix](https://smash64.online/remix/)
* [Radical Red](https://patch.radicalred.net/)
* [Rocket Edition](https://rocket-edition.com/download/)
* [SnapCameraPreservation](https://snapchatreverse.jaku.tv/snap/)
* [Pokemon Clover](https://poclo.net/download)
* [ZeldaHacking Wiki for The Legend of Zelda: Oracle of Ages and Seasons](https://wiki.zeldahacking.net/oracle/)
* [Pokemon Elite Redux](https://elite-redux.com/)

&nbsp;
## Resources used
* [zip.js](https://gildas-lormeau.github.io/zip.js/) by Gildas Lormeau
* [Octicons](https://primer.style/octicons/) by GitHub Inc.
