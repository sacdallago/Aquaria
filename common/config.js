var fs = require('fs');
var path = require('path');

var configFile = __dirname + '/../site.json';
var configJSON = fs.readFileSync(configFile);
var config = JSON.parse(configJSON);

config['ApplicationName'] = path.basename(path.normalize(__dirname + "/.."));

module.exports.get = function(key) {
	return config[key];
}