const path = require('path');
const fs = require("fs");

exports.File = File;

function File(_path) {
    this.stat = fs.statSync(_path);
    this.size = this.stat.size;
    this.name = path.basename(_path);
    this.type = this.stat.type;
    this.data = fs.readFileSync(_path);
}