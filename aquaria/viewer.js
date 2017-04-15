var fs = require('fs');
var common_utils = require('../common/common_utils');
var config = require('../common/config');
var ejs = require('ejs');
var md5 = require('./md5');

var versionString = require('./versionString');
var WEBSITE_PUBLIC_PATH = "public";
var CACHE_DIR = "/cache";
var CACHE_PATH = CACHE_DIR + "/app";

var JNLP_TEMPLATE = fs.readFileSync(__dirname + '/../views/applicationViewerJNLP.ejs', 'utf8');
var JNLP_APPLET_TEMPLATE = fs.readFileSync(__dirname + '/../views/aquaria.ejs', 'utf8');

var versionFilename = WEBSITE_PUBLIC_PATH + CACHE_PATH + "_version";

module.exports.cleanCache = function () {
    common_utils.deleteFiles(__dirname + '/../' + WEBSITE_PUBLIC_PATH + CACHE_DIR);
    fs.writeFileSync(__dirname + '/../' + versionFilename, versionString.viewer);
};


if (fs.existsSync(versionFilename)) {
    var versionFileContents = fs.readFileSync(__dirname + '/../' + versionFilename, 'utf8');
    if (versionFileContents !== versionString.viewer) {
        module.exports.cleanCache();
    }
}
else {
    module.exports.cleanCache();
}


var setVariable = function (args, key, value) {
    var keyString = key + "String";

    if (typeof args[key] !== 'undefined') {
        if (typeof value === 'undefined') {
            value = args[key];
        }
        args[keyString] = key + '=' + value;
    }
    else {
        args[keyString] = '*';
    }
};

var createArguments = function (args) {
    setVariable(args, 'pdb_id');
    var biounitLookup = args.biounit;
    if (args.biounit === 0) {
        biounitLookup = '';
    }
    var structures = 'structures{' + args.pdb_id + ',http://rcsb.org:80/pdb/files/' + args.pdb_id + '.pdb' + biounitLookup + '.gz,,' + args.transform + ';}'
    setVariable(args, 'structures', structures);
    setVariable(args, 'instanceId');
    setVariable(args, 'sequenceAlignments');
    setVariable(args, 'interactive');
};

module.exports.createAppletJNLP = function(development, attributes) {
    'use strict';
    attributes = attributes || {};
    attributes.fileLocation = '/jnlp/' + versionString.viewer + '/aquaria.jnlp';
    attributes = setupAttributes(development, attributes);
    var newAppletJnlpContent = ejs.render(JNLP_APPLET_TEMPLATE, attributes);
    return newAppletJnlpContent;
};

var setupAttributes = function (development, attributes) {
    attributes = attributes || {};
    createArguments(attributes);
    attributes.version_number = versionString.viewer;
    if (development) {
        attributes.host = config.app.host;
        if (typeof attributes.host === 'undefined') {
            attributes.host =    development ? 'localhost' : 'aquaria.ws';
        }
    } else {
        attributes.host = 'aquaria.ws';
    }
    attributes.port = config.app.port;
    var portString = (development) ? ':' + attributes.port : '';
    var serverString = "http://" + attributes.host + portString;
    attributes.prefix = development ? 'dev_' : '';
    if ((development && attributes.template) || typeof attributes.fileLocation === 'undefined') {
        attributes.href = '*';
    } else {
        attributes.href = serverString + attributes.fileLocation;
    }
    if (development && attributes.template) {
        attributes.codebase = '*';
    } else  {
        attributes.codebase = serverString +"/jar";
    }
    return attributes;
}

module.exports.createAppJNLP = function(development, attributes) {
    'use strict';
    attributes = setupAttributes(development, attributes);
    var newAppletJnlpContent = ejs.render(JNLP_TEMPLATE, attributes);
    return newAppletJnlpContent;
};

module.exports.createJNLP = function(args, callback) {
    'use strict';

    var instanceId = args.instanceId.toLowerCase();
    console.log(' reading biounit: ' + args.biounit);
    var jnlpWebLocation = CACHE_PATH + instanceId + "_bio" + args.biounit + ".jnlp";
    var jnlpApplcationFilePath = WEBSITE_PUBLIC_PATH + jnlpWebLocation;
    args['fileLocation'] = jnlpWebLocation;
    if (fs.existsSync(jnlpApplcationFilePath)) {
        console.log("Sending cached app file: " + jnlpApplcationFilePath);
        callback(jnlpWebLocation);
    } else {
        var development = config.app.development;
        args.portString = (development) ? ':' + args.port : '';
        var newApplcationJnlpContent = module.exports.createAppJNLP(development, args);
        fs.writeFile(jnlpApplcationFilePath, newApplcationJnlpContent, function (err) {
            if (err) throw err;
            callback(jnlpWebLocation);
        });
    }
};


module.exports.createToolkitJNLP = function(args, callback) {
    'use strict';

    var instanceId = args.instanceId.toLowerCase();
    var jnlpWebLocation = CACHE_PATH + instanceId + "_toolkit.jnlp";
    var jnlpApplcationFilePath = WEBSITE_PUBLIC_PATH + jnlpWebLocation;
    args['fileLocation'] = jnlpWebLocation;
    if (fs.existsSync(jnlpApplcationFilePath)) {

        console.log("Sending cached toolkit file: " + jnlpApplcationFilePath);
        callback(jnlpWebLocation);

    }
    else {
        callback(jnlpWebLocation);
    }
};
