var connector = require('../common/connector');
var md5 = require('../aquaria/md5');
var biojs = require('biojs-io-fasta');

var getFasta = function(textFile){
    var seqs = biojs.parse(textFile);
    return seqs.map(function(sequence){
        sequence.sequence  = sequence.seq.replace(new RegExp("[\\*|\\s]", 'g'), "");
        sequence.md5 = md5.md5(sequence.sequence);
        return sequence;
    });
};

var matchingMD5 = function(sequence){
    // IMPORTANT!!!!!!!
    // This query will SELECT on protein_sequence_unified --> this table was introduced with the update from @sacdallago
    var sqlquery = "SELECT Primary_Accession, Sequence, MD5_Hash, Description, Length \
                    FROM protein_sequence_unified WHERE MD5_Hash = ?;";
    return connector.queryPromise(sqlquery, sequence.md5);
};

module.exports = {
    getFasta: getFasta,
    matchingMD5: matchingMD5,
    checkFasta: function(text, callback) {
        var callback = callback || function(){};
        var sequences = getFasta(text);
        var promises = [];
        sequences.forEach(function(sequence){
            var promise = new Promise(function (resolve, reject) {
                matchingMD5(sequence).then(function(data) {
                    if (data.length > 0) {
                        // Merge sequence attributes into data[0] object
                        for(var i in sequence) {
                            data[0][i] = sequence[i];
                        }
                        // Return data[0], which was merged with sequence
                        resolve(data[0]);
                    } else {
                        resolve(sequence);
                    }
                });
            });
            promises.push(promise);
        });
        Promise.all(promises).then(function(hits){
            callback(hits);
        });
    }
};
