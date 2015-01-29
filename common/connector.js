var mysql = require('../node_modules/mysql');
var logger = require('./log');
var config = require('./config');
var Promise = require('es6-promise').Promise;
var stream = require('stream');

var MAX_QUERY_SIZE = 500;

var skipStreaming = config.get('skipDBStreaming') || false;

// var cache = require('./cache');
// cache = cache.cache(1000);

// Using '?' and [params] means any special characters are automatically
// escaped, protecting against sql injection.
// In addition, multiple mysql statements per query are disabled by default;
// together, this sanitises the DB input.
// See https://github.com/felixge/node-mysql/blob/master/Readme.md

function connect(options) {
  options = options || {};
  options.host     = config.get('dbhost');
  options.user     = config.get('dbuser');
  options.port     = config.get('dbport') || 3306;
  options.password = config.get('dbpassword');
  options.database = config.get('database');
//  console.log('options: ' + JSON.stringify(options));
	var connection = mysql.createConnection(options);
	return connection;
}

function connectPromise(options) {
	return new Promise (function (resolve) {
		resolve(connect(options));
	});
}

function disconnectPromise(connection) {
	return new Promise (function (resolve, reject) {
		connection.end(function(err) {
			if (typeof err === undefined || err === null) {
				resolve();
			}
			else {
				reject(err);
			}

		});
	});
}


var actualQueryPromise = function (connection, sql, params) {
	return new Promise (function (resolve, reject ) {
		connection.query(sql, params, function (err, results) {
			if (typeof err === undefined || err === null) {
				resolve(results);
			}
			else {
				reject(err);
			}
		});
	});
};

module.exports.queryPromise = function (sql, params, options) {
	var connection = null;
	var sqlmsg = sql;
	if (sqlmsg.length > 62) {
		sqlmsg = sqlmsg.substring(0, 60) + "...";
	}
	sqlmsg = 'query: ' + sqlmsg;
	console.time(sqlmsg);
//	logger.info('sql: ' + sql + ': ' + params);
	return connectPromise(options).then (function (connectionInner) {
		connection = connectionInner;
		return actualQueryPromise(connection, sql, params);
	}).then(function (results) {
		disconnect(connection);
		console.timeEnd(sqlmsg);
		return results;
	}).catch(function (err) {
		console.log('err occured query promise: ' + err);
		console.timeEnd(sqlmsg);
		throw err;
	});
};

var actualQueryStreamPromise = function (connection, sql, params) {

	return new Promise (function (resolve, reject ) {
		var query = connection.query(sql, params);
		resolve(query.stream({highWaterMark: 50}));
	});
};

module.exports.queryStreamPromiseFake = function (sql, params, rowCallback, finishedCallback) {
  logger.info('Running fake stream query: ' + sql+ ': ' + params);
  var sqlmsg = sql;
  if (sqlmsg.length > 63) {
    sqlmsg = sqlmsg.substring(0, 60) + "...";
  }
  sqlmsg = 'querystream: ' + sqlmsg;
  logger.info('sql: ' + sql + ': ' + params);
  console.time(sqlmsg);

  return this.queryPromise(sql,params).then (function (data) {
    data.forEach(function(row) {
      rowCallback(row);
    });
    console.timeEnd(sqlmsg);
    return finishedCallback();
  });
  
}

module.exports.queryStreamPromise = function (sql, params, rowCallback, finishedCallback) {


  if (skipStreaming) {
    return this.queryStreamPromiseFake(sql, params, rowCallback, finishedCallback);
  } else {
    var connection = null;

    var sqlmsg = sql;
    if (sqlmsg.length > 63) {
      sqlmsg = sqlmsg.substring(0, 60) + "...";
    }
    sqlmsg = 'querystream: ' + sqlmsg;
    logger.info('sql: ' + sql + ': ' + params);
    console.time(sqlmsg);
	
  	return connectPromise().then (function (connectionInner) {
  		connection = connectionInner;
  		return actualQueryStreamPromise(connection, sql, params);
  	}).then(function (readStream) {
    		logger.info('stream read : ' + readStream);
    		return new Promise(function(resolve, reject) {
    			
    			readStream
    				.on('data', function (row) {
    //					console.log('data fired: ' + row);
    				rowCallback(row);})
    				.on('end', function () {
    //					console.log('end fired: ' );
    					resolve();
    				});
    //			console.log('fire stream up');
    			readStream.resume();
    		});
  	}).then(function () {
  		disconnect(connection);
  		console.timeEnd(sqlmsg);
  		return finishedCallback();
  	}).catch(function (err) {
  		console.log('err occured queryStream promise: ' + err);
  		console.timeEnd(sqlmsg);
  		return finishedCallback(err);
  //		throw err;
  	});
	}
};


module.exports.query = function (sql, params, callback, meta_data) {
	logger.info("query : " + sql + ", params: " + params);
	var result;
	// if (params !== null) {result = cache.read(params)};
	if (! result) {
		var connection = connect();
		connection.connect(function(err) {
			if (err !== null) {
				logger.error("Err is occurred on connection:" + err);
			} else {
			  // connected! (unless `err` is set)
					
				var queryVal = connection.query(sql, params, function(err, results) {
					if (typeof err === undefined || err === null) {
						logger.info("Number of results found: " + results.length);
						if (callback != null ) {
							callback(results, meta_data);
							// cache.write(params, results);
						}
					} else {
						logger.error("error = " + err);
						if (callback != null) {
							callback(err);
						}
					}
				});
				// console.log("The final query =" + queryVal.sql)
				
				disconnect(connection);
			}
		})
	} else {
		callback(result, meta_data);
	}
}

/**
 * batchCallback is optional. If it is missing, then the returned promise result will be the 
 * list of all results. If batchCallback is provided, then the results will be sent when received and
 * the total count will be returned.
 */
var queryBatchList = function(itemList, sqlFunction, batchCallback) {
  var queryPromises = [];
  var count = 0;
  var rowData = [];
  do {
    var toQuery = itemList.splice(0, MAX_QUERY_SIZE);
    queryPromises.push(connector.queryPromise(sqlFunction(toQuery), toQuery));
  } while (itemList.length > 0);
//  console.log('promises are: ' + queryPromises);
  return queryPromises.reduce(function(cur, next) {
    return cur.then(function(results) {
      if (results.length > 0) {
        if (batchCallback) {
          batchCallback(results);
        }
        else {
          rowData = rowData.concat(results);
        }
        count += results.length;
      }
      return next;
    });
  }, Promise.resolve([])).then(function(results) {
    if (results.length > 0) {
      if (batchCallback) {
        batchCallback(results);
      }
      else {
        rowData = rowData.concat(results);
      }
      count += results.length;
    }
    return rowData;
  });
};


function disconnect(connection) {
	connection.end(function(err) {
	});	
}


module.exports.queryBatchList = queryBatchList;