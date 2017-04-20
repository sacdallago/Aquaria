const validator = require('validator');
const http = require('http');
const config = require('../common/config');
const parseFasta = require('./parseFasta');

module.exports = {
    pssh: function(fasta, email, callback) {
        callback = callback || function(){};

        if(email === undefined || email === null || !validator.isEmail(email)){
            return callback(false);
        }

        if(config.pssh === undefined || config.pssh.endpoint === undefined || !validator.isURL(config.pssh.endpoint)){
            return callback(false);
        }

        let sequences = getFasta(text);
        let promises = [];

        sequences.forEach(function(sequence){
            let promise = new Promise(function(resolve, reject){
                parseFasta.matchingMD5(sequence).then(function(data) {
                    if (data.length > 0) {
                        resolve(data[0].md5);
                    } else {
                        // Perform request to PSSH API
                        request({
                            method: 'POST',
                            url: config.pssh.endpoint,
                            headers: {
                                'token': config.pssh.secret
                            },
                            body: {
                                email: email,
                                sequence: sequence.sequence
                            }
                        }, function(error, response, body) {
                            // TODO: WIP
                            if (!error && response.statusCode !== 500) {
                                let info = JSON.parse(body);
                                resolve(sequence.md5);
                            } else {
                                reject();
                            }
                        });
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

