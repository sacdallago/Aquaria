var connector = require('../common/connector');
var logger = require('../common/log');
var Sequence = require('../shared/sequence');
var md5 = require('./md5');
var Promise = require('es6-promise').Promise;
var LRU = require("lru-cache");
var metainfo = require("./metainfo.js");
var versionString = require('./versionString');
var Errors = require('../shared/Errors');
var PSSHProcessor = require('./psshProcessor');
var matching_structures_querier = require('./matching_structures_querier');

var CLUSTER_BUFFER_SIZE = 3;
/**
 * a least recently used cache to handle 100,000 cluster member entries total.
 */
var matchingStructuresCache = LRU({
  max : 100000,
  length : function(matches) {

    var size = 0;
//    console.log('in length: ' + matches.clusters);
    matches.clusters.forEach(function(cluster) {
      size += cluster.cluster_size;
      // console.log('current size: ' + size);
    });
    // console.log(matches.uniprot_primary_accession[0] + ", size = " + size);
    return size;
  }
});

var sequenceCache = LRU(1000);


//These functions take a UniProt Primary_Accession as input, and return all
//related 3D structures.
//Structures are clustered by alignment region, then ranked using the alignment
//identity score.

//Authors: Sean O'Donoghue & Vivian Ho & Kenny Sabir

//THIS USES PSSH2

//Still to-do:
//* Clustering & calculation of secondary structure should be done in a
//separate thread by launching a child process
//See http://nodejs.org/api/child_process.html
//* The code could probably be simplified using a package such as 'async' (See
//https://github.com/caolan/async)
//PUBLIC METHOD



var get_sequence = function(sequence, callback) {
  'use strict';
  var primary_accession;
  primary_accession = sequenceCache.get(sequence);

  var sqlquery;
  if (!primary_accession) {
    sqlquery = "SELECT Primary_Accession, Sequence, MD5_Hash, Description, Length \
      FROM protein_sequence WHERE MD5_Hash = ?;";
    logger.info("md5: " + md5.md5(sequence) + " for sequence: " + sequence);
    connector.query(sqlquery, md5.md5(sequence), function(data) {

      if (data.length > 0) {
        callback(data[0].Primary_Accession);
      } else {
        callback(null);
      }
      sequenceCache.put(sequence, data[0].Primary_Accession);
    });
  } else {
    // logger.info(JSON.stringify(matches, null, "\t"));
    callback(primary_accession);// <- switch on to embed in page
  }
  ;
  return;
};

//test: A1QZE0 P51451 - case with insertions: Q792Y6
//PUBLIC METHOD
var get_matching_structures = function(loadRequest, sequenceCallback, initialClusterCallback, finalCallback) {
  'use strict';
  var matches = null;

  console.time('get_matching_structures');	
//getMatches(selector, sequenceCallback, null)
  getMatches(loadRequest, sequenceCallback, initialClusterCallback)
  .then(
      function(matchesInternal) {
        matches = matchesInternal;
        // only lookup the best if it isn't set, or if user has specified
        // one to lookup, and it doesn't == the current best one
//      console.log('found best: ' + JSON.stringify(matches.Best_PDB, null, '\t'));
        return findSelectedPDB(matches.clusters, loadRequest.selectPDB,
            loadRequest.selectChain, matches.Best_PDB);
      }).then(function(selectedPDB) {

        matches.Selected_PDB = selectedPDB;
        console.timeEnd('get_matching_structures');

//      var returnClusterUpdate = matches.cachedHit ? null : matches.clusters;
        var returnClusterUpdate = matches.clusters;
//      console.log('final :' + [loadRequest, selectedPDB, returnClusterUpdate,
//      matches.cachedHit, versionString.viewer].join(','));
        finalCallback(null, loadRequest, selectedPDB, returnClusterUpdate, matches.cachedHit, versionString.viewer);
      }).catch( function(err) {
        logger.info(err);
        console.log('err: ' + err);
        console.timeEnd('get_matching_structures');
        finalCallback(err, loadRequest, null, null, false, versionString.viewer);

      });
  return;
};

var getMatches = function(loadRequest, sequenceCallback, clusterCallback) {
  return new Promise(function(resolve, reject) {
    console.time('getMatches');
    var matches = null;
    var sequence = null;
    // check cache first
    var uniprot_primary_accession = null;
    var cacheKey;
    if (typeof loadRequest.selector === 'string') {

      sequence = loadRequest.selector;
      cacheKey = sequence;

    } else {
      uniprot_primary_accession = loadRequest.selector;
      cacheKey = uniprot_primary_accession.join('+');
    }

    matches = matchingStructuresCache.get(cacheKey);
    if (typeof matches === 'undefined' || matches === null) {
      // not found in cache, create a matches object
      matches = {};
      matches.cachedHit = false;
      matches.start_date = new Date().getTime();
      // find all the protein sequences
      getProteinSequenceSQL(uniprot_primary_accession.slice(0), sequence).then(
          function(sqlQuery) {
            console.log('about to sequence');
            return connector.queryPromise(sqlQuery.sql, sqlQuery.args);
          }).then(function(results) {
            console.log('got sequence');
            // get the uniprot sequence data
            return getUniprotSequence(results, matches);
          }).then(function(sequences) {
            console.log('got sequences' + sequences);
            if (typeof sequenceCallback !== 'undefined' && sequenceCallback !== null) {
              sequenceCallback(loadRequest, sequences);
            }
            matches.sequences = sequences;
            console.log('about to run generate clusters ' + sequences);
            return generateClusters(loadRequest, matches.sequences[0], clusterCallback);
          }).then(function(clusters) {
            console.log('got clusters' + clusters);
            matches.clusters = clusters;
            matchingStructuresCache.set(cacheKey, matches);

            return determineBestPDB(clusters);
          }).then(function(bestPDB) {
            console.log('got bestPDB' + bestPDB);
            matches.Best_PDB = bestPDB;
//          console.log('best PDB: ' + JSON.stringify(bestPDB, null, "\t" ));
            resolve(matches);
            console.timeEnd('getMatches');
          }).catch( function(err) {
            console.timeEnd('getMatches');
            logger.info('error getting protein sequence sql (matching structures) : ' + err);
            reject(err);
            // throw err;
          });
      // .catch (err) {
      // console.timeEnd('getMatches', 'err');
      // console.log('in catch: ' + err);
      // reject(err);
      // };
    } else {
      matches.cachedHit = true;
      if (typeof sequenceCallback !== 'undefined' && sequenceCallback !== null) {
        sequenceCallback(loadRequest, matches.sequences);
      }
      if (typeof clusterCallback !== 'undefined' && clusterCallback !== null) {
//      clusterCallback(loadRequest, matches.clusters);
      }


//       console.log('the matches is : ' + JSON.stringify(matches));
      console.timeEnd('getMatches');
      resolve(matches);
    }
  });
};

var findSelectedPDB = function(clusters, autoSelectPDB, autoSelectChain, bestPDB) {
  var bestScore = 0;
  logger.info('in find PDB: ' + clusters.length
      + " autoSelectPDB, autoSelectChain: " + autoSelectPDB + ", "
      + autoSelectChain);
  return new Promise(function(resolve, reject) {
    var i;
    var memberSelected = 0;
    if (typeof autoSelectPDB === 'undefined' || autoSelectPDB == null) {
      // use the best
      return resolve(bestPDB);
    } 
    if (autoSelectPDB) {
      autoSelectPDB = autoSelectPDB.toLowerCase();
    }

    var selectedPDB = null;
    for (i = 0; i < clusters.length; i++) {
      var selectThisCluster = false;
      var chainId = clusters[i].pdb_chain;
      var pdbId = null;
      var transform = null;
      // console.log('typeof chainid: ' + (typeof chainId));

      logger.info('autoSelectPDB === clusters[i].pdb_id: ' + autoSelectPDB
          + ", " + clusters[i].pdb_id);
      if (autoSelectPDB === clusters[i].pdb_id) {
        selectThisCluster = isChainMatch(autoSelectChain, chainId);
        if (selectThisCluster) {
          pdbId = clusters[i].pdb_id;
          memberSelected = 0;
          transform = clusters[i].transform;
        }
        // console.log ('selected ! autoSelectChain, chainId: ' +
        // autoSelectChain + ", " + chainId);
        logger.info('autoSelected');
      } else {
        selectThisCluster = false;
        var j;
        logger.info('autoSelected member search');
        for (j = 0; j < clusters[i].members.length; j++) {
          var member = clusters[i].members[j];
//          console.log('compare: ' + autoSelectPDB + ", " + member.pdb_id);
          if (member.pdb_id === autoSelectPDB) {
            chainId = member.pdb_chain;
            selectThisCluster = isChainMatch(autoSelectChain, chainId, member.duplicates);
            if (selectThisCluster) {
              logger.info('autoSelected member search found: ' + j);
              memberSelected = j;
              pdbId = member.pdb_id;
              transform = member.transform;
              break;
            }
          }
        }
      }

      logger.info('BestPDB: cluster: '+ i +', selectThisCluster: ' + selectThisCluster +', bestscore: '+ bestScore);
      if (selectThisCluster) {
        selectedPDB = {
            "pdb_id" : pdbId,
            "pdb_chain" : chainId,
            "cluster_number" : i,
            "member_number" : memberSelected,
            "transform" : transform,
        };
        if (autoSelectPDB) {
          // we have found the PDB, get out!
          break;
        }

      }
    }
    if (selectedPDB) {
      resolve(selectedPDB);
    } else {
      reject(Errors.MatchingStructures("Can't find " + autoSelectPDB + " in matching structures."));
    }

  });
};

var determineBestPDB = function(clusters) {
  var bestScore = 0;
  return new Promise(function(resolve, reject) {
    var i;
    var bestPDB = null;
    var memberSelected = 0;
    for (i = 0; i < clusters.length; i++) {
      var selectThisCluster = false;
      var chainId = clusters[i].pdb_chain;
      var pdbId = null;
      var transform = null;
      // console.log('typeof chainid: ' + (typeof chainId));
      // find the highest score
      var residue_count = residuecount(clusters[i].seq_start,
          clusters[i].seq_end);
      var identity = clusters[i].alignment_identity_score[0];
      var score = residue_count * identity / 100;
      if (score > bestScore) {
        selectThisCluster = true;
        pdbId = clusters[i].pdb_id;
        memberSelected = 0;
        transform = clusters[i].transform;
        bestScore = score;
      }
      logger.info('BestPDB: cluster: '+ i +', selectThisCluster: ' + selectThisCluster +', bestscore: '+ bestScore);
      if (selectThisCluster) {
        bestPDB = {
            "pdb_id" : pdbId,
            "pdb_chain" : chainId,
            "cluster_number" : i,
            "member_number" : memberSelected,
            "transform" : transform,
        };
      }
    }
    if (bestPDB) {
      logger.info('BestPDB: resolving best:  '+ JSON.stringify(bestPDB));
      resolve(bestPDB);
    } else {
      reject(new Errors.MatchingStructuresError("No clusters found to determine the best PDB."));
    }

  });
};



function isChainMatch(autoSelectChain, chainId, duplicates) {
  var selectThisCluster = false;
  if (autoSelectChain) {

    // chain specified
    if (autoSelectChain == chainId) {
      // this is the chain
      selectThisCluster = true;

    } else if (duplicates){
//    console.log('looking up dups for: ' + duplicates + ', ' + chainId + ', ' +
//    autoSelectChain);
      // this is not the chain
      selectThisCluster = duplicates.indexOf(autoSelectChain) != -1;
    } else {
      // this is not the chain
      selectThisCluster = false;
    }
  } else {

    // chain NOT specified
    selectThisCluster = true;
  }
  return selectThisCluster;
}

module.exports.clear_cache = function() {
  sequenceCache.clear();
  matchingStructuresCache.reset();
};

var getProteinSequenceSQL = function(primaryAccessions, sequence) {
  // console.log('primaryAccessioms: ' + primaryAccessions);
  return new Promise(
      function(resolve) {
        var sqlquery, i;
        var args;
        if (sequence) {
          sqlquery = "SELECT Primary_Accession, Sequence,  MD5_Hash as uniprot_hash, Description, Length \
            FROM protein_sequence WHERE MD5_Hash = ?";
          args = md5.md5(sequence);
        } else {
          sqlquery = "SELECT Primary_Accession, MD5_Hash as uniprot_hash, Sequence, Description, Length \
            FROM protein_sequence WHERE Primary_Accession ";
          if (primaryAccessions.length > 1) {
            var questions = primaryAccessions.map(function () {return '?';});
            sqlquery += 'in (' + questions.join(',') + ')';
            args = primaryAccessions;
          }
          else if (primaryAccessions.length === 1) {
            sqlquery += '= ?';
            args = primaryAccessions[0];
          }
          else {
            args = null;
            console.log('no primaryAccession given! in matching_structures.getProteinSequenceSQL')
          }
        }
         console.log('sql query: ' + sqlquery + ', args: ' + args);
        resolve({sql: sqlquery, args: args});
      });

};

//1st callback function for input of 2 Uniprot accession numbers
function getUniprotSequence(data, matches) {
  return new Promise(function(resolve, reject) {
    'use strict';
    // TODO remove
    matches.uniprot_primary_accession = [];
    matches.uniprot_sequence = [];
    matches.uniprot_sequence_length = [];
//  matches.uniprot_sequence_features = [];
    matches.uniprot_sequence_description = [];
    matches.uniprot_sequence_MD5_Hash = [];
    // console.log('data length: ' + data.length);
    var sequences = data.map(function(sequenceData) {
      return new Sequence(sequenceData);
    });

    sequences.forEach(function(sequence) {
      matches.uniprot_primary_accession.push(sequence.primary_accession);
      matches.uniprot_sequence.push(sequence.sequence);
      matches.uniprot_sequence_length.push(sequence.sequence.length);
//    matches.uniprot_sequence_features.push(sequence.features);
      matches.uniprot_sequence_description.push(sequence.description);
      matches.uniprot_sequence_MD5_Hash.push(sequence.uniprot_hash);
    });
    if (sequences.length > 0) {
      resolve(sequences);
    } else {
      reject(new Errors.MatchingStructuresError("No sequences found."));
    }
  });
}

//cluster the results, populate with information and create a format to send
//into the 3d viewer
function generateClusters(loadRequest, sequence, clusterCallback) {
  'use strict';
  console.time('generateClusters');

  var psshProcessor = new PSSHProcessor(sequence, function (clustersToSend) {
//    console.log('calling cluster callback: ' + clusterCallback);
    if (typeof clusterCallback !== 'undefined' && clusterCallback !== null) {
      clusterCallback(loadRequest, clustersToSend);
    }
  });

  return matching_structures_querier.getPSSHAndPDBRowsPromise(sequence, function (psshRow, chainRow) {
    psshProcessor.processPSSHRow(psshRow, chainRow);
  }).then(
      // end of query
      function() {
//        psshProcessor.sendClusters(true);
//        var clusters = psshProcessor.clusters; 
//        console.log('clusters are: ' + psshProcessor.clusters);

        if (psshProcessor.clusters.length > 0) {
          // console.log('resolving now: ' + clusters);
          return psshProcessor.finaliseClusters().then(function (clusters) {
            console.timeEnd('generateClusters');
//            console.log('finished clusters: ' + clusters);
            return (clusters);
          });
//          
//          resolve(clusters);

        } else {
          console.timeEnd('generateClusters');
          throw (new Errors.MatchingStructuresError("Could not find any suitable matches for: "
              + sequence.primary_accession));
        }
      }).catch(function (err) {
        console.log('error occurred: generate clusters: ' + JSON.stringify(err));
        throw err;
      });

}


//counts the number of residues in an alignment
function residuecount(seq_start, seq_end) {
  var i;
  var seqLen = 0;
  for (i = 0; i < seq_start.length; i++) {
    seqLen += (seq_end[i] - seq_start[i] + 1);
  }
  ;
  return seqLen;
}

var getAccessionForPDB = function(pdb, chain) {
  return new Promise(function (resolve, reject) {
    var sql;

    if (chain) {
      sql = "select PDB_ID, Chain, Accession from PDB_chain where PDB_ID = ? and Chain = ?;" ;
      connector.query(sql, [pdb, chain], function(data) {
        resolve(data[0]);
      });

    } else {
      sql = "select PDB_ID, Chain, Accession from PDB_chain where PDB_ID = ? order by Chain";
      connector.query(sql, [pdb], function(data) {
        data.some(function (row) {
          if (row.Accession.length === 6) {
            resolve(row);
            return true;
          }
          return false;
        });
      });
    }
  });
};


var getPSSH2Data = function(loadRequest, sequence, clusterCallback) {
  return getPSSHSQL().then(function(sql) {
//  console.log('pssh2Data 1');
    return generateClusters(loadRequest, sequence, clusterCallback);

  });
};

module.exports.get_matching_structures = get_matching_structures;
module.exports.get_sequence = get_sequence;
module.exports.getAccessionForPDB = getAccessionForPDB;

module.exports.getAccessionForPDBCallback = function (pdb, chain, callback) {
  getAccessionForPDB(pdb, chain).then(callback);
}
