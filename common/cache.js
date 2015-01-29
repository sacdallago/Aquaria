//
// Simple cache with automatic removal of oldest values.
//
// Authors: Sean O'Donoghue. Kenny Sabir
//
// WARNING, this logger is now used by client & server. The client cannot use the logger.
//var logger = require('./log');

var Cache = function (maximum_cache_size) {
	
	var cache = {};
	var last_access = {};
	var enabled = true;
	if (typeof maximum_cache_size === 'undefined') {maximum_cache_size = 100};
	
	return {
		write: function(key, value) {
			if(typeof(Storage)!=="undefined"){
				console.log("*** save "+key+" to local storage");
				localStorage.setItem(key, JSON.stringify(value));
			} else {
//				console.log("*** write to cache");
				if (enabled) {
					
					last_access[key] = Date();
		
					// store in cache
					cache[key] = value;
					
					// if cache size is too large, remove oldest key
					var size = Object.keys(cache).length;
					//logger.info('Stored ' + key + ' in cache (size = ' + size + ')');
					if (size > maximum_cache_size) {
						var oldest_key = null;
						var oldest_date = null;
						// find and delete oldest key
						oldest_date = last_access[key];
						Object.keys(cache).forEach(function (temp_key) {
							// console.log('checking key = ' + temp_key);
							if (last_access[temp_key] <= oldest_date) {
								//console.log('key is older: ' + last_access[temp_key]);
								oldest_key = temp_key;
								oldest_date = last_access[temp_key];
							}
						});
						// console.log('final oldest key = ' + oldest_key);
						if (oldest_key !== null) {
							delete cache[oldest_key];
							delete last_access[oldest_key];
						}
						//logger.info('Deleted ' + oldest_key + ' from cache');
					}
				}
			}
			return(value);
		},
		read: function(key) {
			if(typeof(Storage)!=="undefined"){
				if (localStorage.getItem(key) !== null){
					console.log("*** "+key+" fetched from local storage");
					return(JSON.parse(localStorage.getItem(key)));
				} else {
					console.log("*** "+key+" not found in local storage");
					return(false);
				}
			} else if (enabled && key in cache && cache[key]) {
				// use cached value if available
				//logger.info('Read ' + key + ' from cache');
//				console.log("*** read from cache");
				return(cache[key]);
			} else {
				return(false);
			}
		},
		clear: function() {
			cache = {};
			last_access = {};
			
		}
	}
};

module.exports = Cache;