var biojs = require('biojs-io-fasta');
var bionode = require('bionode-fasta')

var parseFasta = function(fasta, callback) {
    'use strict';
    var result = undefined;
    var error = undefined;
    
    if(fasta) {
        try {
            result = biojs.parse(fasta);
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