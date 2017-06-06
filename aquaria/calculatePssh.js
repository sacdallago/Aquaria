const validator = require('validator');
const request = require('request');
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

        console.log("Requesting " + config.pssh.endpoint + " with token: " + config.pssh.secret);
        // Perform request to PSSH API
        request({
            method: 'POST',
            url: config.pssh.endpoint,
            headers: {
                'token': config.pssh.secret
            },
            formData: {
                email: email,
                raw: fasta
            },
            timeout: 2000
        }, function(error, response, body) {
            if (!error && response.statusCode < 300) {
                var result = JSON.parse(body);
                callback(result);
            } else {
                console.error(error);
            }
        });

    }
};

