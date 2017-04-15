

var config = require('../common/config');
var Promise = require('es6-promise').Promise;
var fs = require('fs');
var viewer = require('./viewer');
//var path = require('path'), appDir = path.dirname(require.main.filename);
//var process= require('process');

function pad(num, size) {
  var s = "0000000" + num;
  return s.substr(s.length-size);
}

var majorVersion =  parseInt(config.app.majorVersion);
var minorVersion =  parseInt(config.app.minorVersion);

var loadVersions = function (filename) {
  
  var buildNumber = getBuildNumber(filename);
  return [majorVersion, minorVersion, buildNumber].join('.');
  
};


var getBuildNumber = function (filename) {
  filename = filename || 'AQUARIA_3D_BUILD_NUMBER';
  var buildNumber = pad(parseInt(fs.readFileSync(__dirname + '/../' +filename, 'utf8')), 5);
  return buildNumber;
}

var updateBuildNumber = function (filename) {
  filename = filename || 'AQUARIA_3D_BUILD_NUMBER';
  var buildNumber = parseInt(getBuildNumber(filename));
  buildNumber = buildNumber + 1;
  fs.writeFileSync(__dirname + '/../' +filename, buildNumber, 'utf8');
  return buildNumber;
};

var reload = function () {
  var newVersion = loadVersions('AQUARIA_3D_BUILD_NUMBER');
  if (newVersion !== viewerVersionString) {
    viewer.cleanCache();
  }
};

var viewerVersionString = loadVersions('AQUARIA_3D_BUILD_NUMBER');
//var librariesVersionString = loadVersions('AQUARIA_LIBRARIES_BUILD_NUMBER');
//console.log(versionString);

module.exports.viewer = viewerVersionString;
module.exports.buildNumber = getBuildNumber;
module.exports.updateBuildNumber = updateBuildNumber;
module.exports.reload = reload;
//module.exports.libraries = librariesVersionString;