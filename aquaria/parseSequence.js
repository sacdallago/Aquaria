var Fasta = require('biojs-io-fasta');

var parseSequence = function(sequence, callback) {
    'use strict';
    var result = undefined;
    if(sequence && callback) {
        try {
        result = Fasta.parse(sequence);
        } catch (error) {
            console.log('error')
        }
        callback(result);
    }
    return;
}

module.exports.parseSequence = parseSequence;