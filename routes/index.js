/*
 * GET home page.
 */

var logger = require('../common/log');
matching_structures = require('../aquaria/matching_structures');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var viewer = require ('../aquaria/viewer');
var config = require('../common/config');
var versionString = require('../aquaria/versionString');
var Promise = require('es6-promise').Promise;
var autocomplete = require('../aquaria/autocomplete');
var viewerFormat = require('../aquaria/generate_viewer_format');

var formats = {
    'json' : {
        mime : "plain/text"
    },
    'csv' : {
        mime : "text/comma-separated-values",
        separator : ','
    },
    'txt' : {
        mime : "text/plain",
        separator : '\t'
    },
    'tsv' : {
        mime : "text/tab-separated-values",
        separator : '\t'
    },
};

// expire after 1 week
var JAR_EXPIRY = 1000 * 60 * 60 * 24 * 7;
var JAR_PATH = './jar/';

exports.home_page = function(request, response, next){
    'use strict';
    if (typeof request.params.id == 'undefined' || request.params.id.match(/(?:\/leap)?([A-Z][0-9][A-Z,0-9][A-Z,0-9][A-Z,0-9][0-9])$/) ) {
        console.log('INSIDE : reqID:' + request.params.id);
        var args = { title: 'Success',
            googleAnalyticsID: config.analytics.google.trackingId,
            googleAnalyticsHostname: config.analytics.google.hostname,
            hasPsshEndpoint: config.pssh.endpoint !== undefined
        };
        if (request.params.id && request.params.id.indexOf('/leap') == 0) {
            args['interactive'] = 'leap';
        }
        response.render('home_page', args);
    }
    else if (request.params.id.match(/^([0-9]([A-Za-z,0-9][A-Za-z,0-9])[A-Za-z,0-9])$/) ) {
        var pdbId = request.params.id;
        var pdbChain = request.params.pdbid;
        console.log('INSIDE : load PDB:' + pdbId + ', ' + pdbChain);
        matching_structures.getAccessionForPDB(pdbId, pdbChain).then (function (pdbRow) {
            var initialParams = {primary_accession: pdbRow.Accession, pdb_id: request.params.id, pdb_chain: pdbChain};
            var args = { title: 'Success', initialParams: JSON.stringify(initialParams),
                googleAnalyticsID: config.analytics.google.trackingId,
                googleAnalyticsHostname: config.analytics.google.hostname,
                hasPsshEndpoint: config.pssh.endpoint !== undefined
            };
            response.render('home_page', args);
        });
    }
    else {
        next();
    }
};

exports.jar = function(request, response, next){
    'use strict';
    var jarname = '' + request.params.jarname;
    var version = request.param('version-id');
    var basename = path.basename(jarname, '.jar');
    if (basename) {

        var fullPath = [JAR_PATH , basename , '__V' , version , '.jar'].join('');
        var basenameWithVersion = path.basename(fullPath);
        console.log('basename with version: ' + basenameWithVersion);
        sendFile(response, fullPath, basenameWithVersion, true, {'Content-Type': 'application/java-archive', 'Cache-Control': 'public, max-age=' + JAR_EXPIRY, "Expires": "" + (new Date().getTime()+ JAR_EXPIRY) });
    }
    else {
        next();
    }
};

/**
 * APPLET JNLP
 */
exports.jnlp = function(request, response, next){
    'use strict';
    var jnlp = null;
    if (request.params.versionString !== versionString.viewer) {
        console.log('Requested version:' + request.params.versionString +', but have version: ' + versionString.viewer + ', trying to flush version in memory');
        versionString.reload();
    }

    if (request.params.filename === 'aquaria') {
        jnlp = viewer.createAppletJNLP(config.app.development);
    }
    else if (request.params.filename === 'aquariaapp') {
        jnlp = viewer.createAppJNLP(config.app.development, {});
    }
    writeResponseString(response, jnlp, 'application/x-java-jnlp-file');
}

var writeResponseString = function(response, body, type) {
    response.writeHead(200, {
        'Content-Length': body.length,
        'Content-Type': type });
    response.end(body);
};

var writeErrorResponse = function(response, body) {
    response.writeHead(500, {
        'Content-Length': body.length,
        'Content-Type': 'text/plain' });
    response.end(body);
};

var getMatchingStructuresData = function(request, response, next) {
    return new Promise (function (resolve, reject) {
        var id = RegExp.$1;

        logger.info('the id for matching structures JSON is: ' + id);
        try {
            if (request.params.chainid) {
                request.params.chainid = request.params.chainid.trim();
            }
            var loadRequest = {
                selector: [id],
                selectPDB: request.params.pdbid,
                selectChain: request.params.chainid
            };
            var sequences = null;
            //(loadRequest, sequenceCallback, initialClusterCallback, finalCallback) {
            matching_structures.get_matching_structures(loadRequest, function (loadRequestSequence, sequenceRet) {
                sequences = sequenceRet;
            }, null, function (err, loadRequest, Selected_PDB, returnClusterUpdate, cachedHit, versionString) {
                var data = {
                    sequences: sequences,
                    Selected_PDB: Selected_PDB,
                    clusters: returnClusterUpdate
                };
                //        console.log('about to resolve:1');
                resolve(data);
            });
        }
        catch (err) {
            console.log("ERR caught writing JSON for: " + id + ", err: " + err);
            response.end("{}");
        }
    });
};
exports.matchingStructuresExt = function(request, response, next){
    if (typeof request.params.id == 'undefined' || request.params.id.match(/(?:\/leap)?([A-Z][0-9][A-Z,0-9][A-Z,0-9][A-Z,0-9][0-9])$/) ) {
        // id is valid
    }
    else {
        return next();
    }

    if (typeof request.params.format === 'undefined' || request.params.format.trim() === '' || request.params.format.trim() === 'undefined' || request.params.format.trim() === 'html') {
        //    exports.home_page(request, response, next);
        console.log('going to next it');
        return next();
    }
    var format = formats[request.params.format];
    if (format) {
        return matchingStructuresWithSeperator(request, response, next, format.separator, format.mime);
    }
    else {
        return writeErrorResponse(response, 'unknown extension: ' + request.params.format);
    }
};

var matchingStructuresWithSeperator = function(request, response, next, separator, mimetype){
    'use strict';
    logger.info('the id for matching structures JSON req param id : ' + request.params.id + ', clusterId: ' + request.params.clusterId + ', pdbid: ' + request.params.pdbid + ', format: ' + request.params.format);

    if (typeof request.params.id !== 'undefined' && request.params.id.match(/([A-Z][0-9][A-Z,0-9][A-Z,0-9][A-Z,0-9][0-9])$/) ) {
        getMatchingStructuresData(request, response).then (function (data) {
            try {

                var clusters = data.clusters;

                // show all members
                if (request.params.pdbid) {
                    logger.info('show PDB ' + request.params.pdbid);
                    // only supports JSON
                    var selectedMember = data.clusters[data.Selected_PDB.cluster_number].members[data.Selected_PDB.member_number];
                    viewerFormat.get_3D_alignment(selectedMember, data.sequences[0], function (viewer3DFormat) {
                        var json = JSON.stringify(viewer3DFormat, null, "\t");
                        if (request.params.format === 'json') {
                            writeResponseString(response, json, mimetype);
                        }
                        else {
                            writeErrorResponse(response, 'PDB member detailed view is only supported by JSON format, not ' + request.params.format + ', though here it is anyway: \n' + json);
                        }
                    });
                }
                else if (typeof request.params.clusterId != 'undefined') {
                    logger.info('show cluster information ' + request.params.clusterId);
                    if (request.params.clusterId > clusters.length ) {
                        return writeErrorResponse(response, 'Trying to view cluster '+ request.params.clusterId + ' is too high, the most we can give you for ' + request.params.id + ' is cluster ' + clusters.length  + '. Why don\'t you try that number?');
                    }
                    var cluster = clusters[request.params.clusterId - 1];

                    if (request.params.format === 'json') {
                        var json = JSON.stringify(cluster, null, "\t");
                        writeResponseString(response, json, mimetype);
                    }
                    else {
                        var output = cluster.members.map(function (member, i) {
                            return [i + 1,member.pdb_id, member.pdb_chain, '"' + member.pdb_title + '"', member.alignment_identity_score, '"' + member.viewer_format + '"', member.biounits, member.E_value, member.transform, member.Resolution].join(separator);
                        });
                        var header = ['member index','pdb id', 'pdb chain', 'name', 'alignment score', 'alignment', 'biounits', 'E_value', 'transform', 'Resolution'].join(separator) + "\n";

                        writeResponseString(response, header + output.join('\n'), mimetype);
                    }
                }
                else {
                    if (request.params.format === 'json') {
                        var json = JSON.stringify(clusters, null, "\t");
                        writeResponseString(response, json, mimetype);
                    }
                    else {
                        // show all clusters
                        var output = clusters.map(function (cluster, i) {
                            return [i,cluster.cluster_size, cluster.pdb_id, cluster.pdb_chain, cluster.alignment_identity_score].join(separator);
                        });
                        var header = ['cluster index','cluster size', 'top pdb', 'top pdb chain', 'alignment score'].join(separator) + "\n";

                        writeResponseString(response, header + output.join('\n'), mimetype);
                    }
                }
            }
            catch (e) {
                console.log('e: ' + e);
                throw e;
            }
        });
    }
    else {
        next();
    }
};

exports.matchingStructuresJSON = function(request, response, next){
    'use strict';
    logger.info('the id for matching structures JSON req param id : ' + request.params.id);
    if (typeof request.params.id !== 'undefined' && request.params.id.match(/([A-Z][0-9][A-Z,0-9][A-Z,0-9][A-Z,0-9][0-9])$/) ) {
        getMatchingStructuresData(request, response).then (function (data) {
            var jsonString = JSON.stringify(data, null, "\t");
            writeResponseString(response, jsonString, 'application/json');
        });
    }
    else {
        next();
    }
};

//exports.david = function(request, callback){
//	'use strict';
//	callback.render('david_interactions', { title: 'Success' });
//};


//exports.interactions = function(request, callback){
//	'use strict';
//   var uniprot_accession = [];
//   var url;
//   //console.log(request.params.id + ' Hello');
//   if (request.params.id.match(/(([A-Z][0-9][A-Z,0-9][A-Z,0-9][A-Z,0-9][0-9])(\+([A-Z][0-9][A-Z,0-9][A-Z,0-9][A-Z,0-9][0-9]))*)$/)) {
//      url = RegExp.$1;
//      uniprot_accession = url.split("+");
//      console.log('Okay up to here url = ' + url);
//      matching_structures_interactions.get_interaction_number(
//         uniprot_accession, callback);
//      //console.log('matches: ' + matches);
//      //var returnString = matches.result += '';
//	   //callback.writeHead(200, { 'Content-Type': 'plain/text', 'Content-Length': returnString.length });
//	   //callback.write(returnString);
//   }
//};

var sendFile = function(response, fullPath, filename, unzipped, headers) {
    fs.stat(fullPath, function(error, stat) {
        if (error) {
            throw error;
        }
        var rs;
        // We specify the content-type and the content-length headers
        // important!
        headers = headers || {'Content-Type': 'application/octet-stream'};
        headers['Content-Disposition'] =  'attachment; filename="' + filename + '"';

        if (!unzipped) {
            headers['Content-Length'] = stat.size;
        }

        response.writeHead(200, headers);
        rs = fs.createReadStream(fullPath);

        rs.on('end', function () {
            response.end();
        });
        // pump the file to the response
        console.log("sending file called: " + fullPath);
        if (unzipped) {
            console.log('unzipping the file');
            rs.pipe(zlib.createGunzip()).pipe(response);
        }
        else {
            rs.pipe(response);
        }
    });
};

exports.googleHostedService = function (request, callback) {
    var args = { };
    args['googleHostedService'] = config.analytics.google.hostedService;
    callback.render('googlehostedservice', args);
};


exports.pdb = function(request, callback){
    'use strict';
    var subfolder, pdb_id;
    var id_from_url = request.params.id;
    var unzip = request.params.ext !== '.gz';
    id_from_url = id_from_url.toLowerCase();
    logger.info('id_from_url: ' + id_from_url + ',unzip :' + unzip + ', ext: ' + request.params.ext);

    if (id_from_url.match(/^([0-9]([a-z,0-9][a-z,0-9])[a-z,0-9])$/)) {
        subfolder = RegExp.$2;
        pdb_id = RegExp.$1;
        var fullPath = '/Data/PDB/biounit/' + subfolder + '/' + pdb_id + '.pdb1.gz';
        logger.info('fullpath: ' + fullPath);
        var output = '';
        var property;
        for (property in request.headers) {
            output += property + ': ' + request.headers[property]+'; ';
        }
        console.log("Req headers properties = " + output);
        var suffix = unzip ? ".pdb" : ".pdb.gz";
        logger.info('exists aboutto');
        fs.exists(fullPath, function(exists) {
            logger.info('exists return');
            if (exists) {
                logger.info('suffix is: ' + suffix + ", unzip = " + unzip);
                sendFile(callback, fullPath, pdb_id + suffix, unzip);

            } else {
                // try structures
                fullPath = '/Data/PDB/structures/' + subfolder + '/pdb' + pdb_id + '.ent.gz';
                logger.info('suffix is: ' + suffix + ", unzip = " + unzip + ", fullPath = " + fullPath);

                sendFile(callback, fullPath, pdb_id + suffix, unzip);

            }
        });
        logger.info('end of pdb method');
        return;
    }
};

exports.launchPage = function (request, callback) {
    callback.redirect("http://vizbi.org:8009/launchPage.html");
};

exports.sequenceInUrl = function(request, response, next) {
    var query = request.query;

    if(query.keys.contains("sequence") && query.keys.contains("pssh")){

    }
    response.status(200).send({
        query: request.query
    });
    // next();
}