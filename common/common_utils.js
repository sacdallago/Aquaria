var fs = require('fs');
var util = require('util');
var crypto = require('crypto');

exports.sendFile = function(response, fullPath, filename) {
	fs.stat(fullPath, function(error, stat) {
		if (error) {
			throw error;
		}
		var rs;
		// We specify the content-type and the content-length headers
		// important!
		response.writeHead(200, {
			'Content-Type' : 'application/octet-stream',
			'Content-Disposition' : 'attachment; filename="' + filename + '"',
			'Content-Length' : stat.size
		});
		rs = fs.createReadStream(fullPath);
		// pump the file to the response
		console.log("sending file called: " + fullPath);
		util.pump(rs, response, function(err) {
			if (err) {
				throw err;
			}
		});
	});
};



module.exports.deleteFiles = function(dirPath) {
  try { var files = fs.readdirSync(dirPath); }
  catch(e) { return; }
  if (files.length > 0)
    for (var i = 0; i < files.length; i++) {
      var filePath = dirPath + '/' + files[i];
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
      else {
        module.exports.deleteFiles(filePath);
        fs.rmdirSync(filePath);
      }
    }
};

exports.createMD5 = function (string) {
	
	var md5sum = crypto.createHash('md5');
	md5sum.update(string);
	

    return md5sum.digest('hex');
}
