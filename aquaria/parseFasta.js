var connector = require('../common/connector');
var logger = require('../common/log');
var md5 = require('../aquaria/md5');
var biojs = require('biojs-io-fasta');

module.exports.getFasta = function(textFile){
    var seqs = biojs.parse(textFile);
    seqs.map(function(sequence){
        sequence.sequence  = sequence.seq.replace(new RegExp("[\\*|\\s]", 'g'), "");
        sequence.md5 = md5.md5(sequence.sequence);
        return sequence;
    });
    return seqs;
}

module.exports.matchingMD5 = function(sequence){
    var sqlquery = "SELECT Primary_Accession, Sequence, MD5_Hash, Description, Length \
FROM protein_sequence WHERE MD5_Hash = ?;";
    return connector.queryPromise(sqlquery, sequence.md5);
}