var biojs = require('biojs-io-fasta');

var parseFasta = function(fasta) {
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
    
    return error || result;
}

module.exposts.parseFasta = parseFasta;