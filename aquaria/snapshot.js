var exec = require('child_process').exec;
var fs = require('fs');
var common_utils = require('../common/common_utils');
var ejs = require('ejs');
var logger = require('../common/log');

var WEBSITE_PUBLIC_PATH = "/Users/Webm/SparkleShare/Aquaria/Website/public";
var CACHE_PATH = "/cache/";

var JNLP_TEMPLATE;
fs.readFile('views/aquaria.ejs', 'utf8', function (err, template) {
    logger.info("The template is ; " + template + ", err is : " + err);
	JNLP_TEMPLATE = template;
});

module.exports.loadSnapshot = function(args, callback) {
	'use strict';
	
	var pdb_id = args.pdb_id.toLowerCase();
	var md5 = common_utils.createMD5(pdb_id + args.sequenceAlignments);
	var filename = md5 + ".jpg";
	var jnlpFilename = md5 + ".jnlp";
    var webLocation = CACHE_PATH + filename;
    var jnlpWebLocation = CACHE_PATH + jnlpFilename;
    var filePath = WEBSITE_PUBLIC_PATH + webLocation;
    var jnlpFilePath = WEBSITE_PUBLIC_PATH + jnlpWebLocation;
    var jnlpSnapshotFilePath = WEBSITE_PUBLIC_PATH + CACHE_PATH + md5 + "_snapshot.jnlp";
      if (fs.existsSync(filePath)) {
    	  
    	  console.log("Sending cached file: " + filePath);
    	  callback(webLocation, jnlpWebLocation);
    	  
      }
      else {
    	  console.log("Creating file: " + pdb_id + ", at location: " + filePath + ", alignment: " + args.sequenceAlignments);
    	  args['fullMode'] = 'off';
    	  args['saveImage'] = filePath;
    	  args['hex_id'] = md5;

    	  var newSnapshotJnlpContent = ejs.render(JNLP_TEMPLATE, args);
    	  fs.writeFile(jnlpSnapshotFilePath, newSnapshotJnlpContent, function (err) {
    		  if (err) throw err;
    		  

	    	  exec("javaws -wait " + jnlpSnapshotFilePath, function(err, stdout, stderr) {
//	    	  execFile("/Users/Webm/SparkleShare/Aquaria/Website/bin/snapshot.sh", [pdb_id,'"' + args.sequenceAlignments+'"', filePath], function(err, stdout, stderr) {
		    	  console.log("Spawn returned: " + err + ", stdout: " + stdout + ", stderr: " + stderr);
		    	  
		    	  args['fullMode'] = 'on';
		    	  args['saveImage'] = null;
		    	  var newJnlpContent = ejs.render(JNLP_TEMPLATE, args);
		    	  fs.writeFile(jnlpFilePath, newJnlpContent, function (err) {
		    		  if (err) throw err;
		    		  
		    		  
		    		  
			    	  callback(webLocation, jnlpWebLocation);
		    		});
	    	  });
    	  });
      }


};
