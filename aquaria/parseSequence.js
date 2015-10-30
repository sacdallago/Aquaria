var Fasta = require('biojs-io-fasta');

var parseFasta = function(fasta, callback) {
    'use strict';
    var result = undefined;
    var error = undefined;
    
    if(fasta) {
        try {
            result = Fasta.parse(fasta);
        } catch (e) {
            error = e;
        }
    }
    
    try {
        callback(result,error)
    } catch (e) {
    }
    
    return result
}

module.exports.parseFasta = parseFasta;