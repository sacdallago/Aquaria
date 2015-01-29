var connector = require('../common/connector');

//var residues = ["A" , "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "Y"];
var residues = ["I","F","L","V","M","W","C","Y","A","H","G","T","P","S","R","N","Q","E","D","K"];
var keys = residues.slice();
keys.unshift('Color');
var addRow = function(prefix, row) {
	var output = [];
	var sum = row[prefix + "_SUM"];
	
	output[0] = prefix;
	for (var i = 0; i < residues.length; i++) {
		
		output[i + 1] = row[prefix + "_" + residues[i]] / sum; 
	}
	return output;
};

var db_callback_function  = function (data, callback) {
	console.log (data[0]);
	
	var output = []; 
	output.push(keys);
	for (var i = 0; i < data.length; i++) {
		var row = data[i];
		if (row['color'] == 'Dark' || row['color'] == 'Grey') {
			output.push(addRow('b', row));
		}
		if (row['color'] == 'White' || row['color'] == 'Grey') {
			output.push(addRow('w', row));
		}
	}
	
	callback(output);
};

module.exports.getDarkDomains = (function (limit, callback) {
	limit = 100;
   connector.query("SELECT  md5_hash, primary_accession, color,	 w_A,	w_C,	  w_D,	  w_E,	  w_F,	  w_G,	  w_H,	  w_I,	  w_K,	  w_L,	  w_M,	  w_N,	  w_P,	  w_Q,	  w_R,	  w_S,	  w_T,	  w_V,	  w_W,	  w_Y,	  w_SUM, " +
		   				   										"b_A,	b_C,	  b_D,	  b_E,	  b_F,	  b_G,	  b_H,	  b_I,	  b_K,	  b_L,	  b_M,	  b_N,	  b_P,	  b_Q,	  b_R,	  b_S,	  b_T,	  b_V,	  b_W,	  b_Y,	  b_SUM,\
FROM    (\
        SELECT  @cnt := COUNT(*) + 1,\
                @lim := ?\
        FROM    swiss_domains\
        ) vars\
STRAIGHT_JOIN\
        (\
        SELECT  r.*,\
                @lim := @lim - 1\
        FROM    swiss_domains r\
        WHERE   (@cnt := @cnt - 1)\
                AND RAND() < @lim / @cnt\
        ) i;", limit, callback);
});
