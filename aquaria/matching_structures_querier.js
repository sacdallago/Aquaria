var logger = require('../common/log');
var Errors = require('../shared/Errors');
module.exports.getPSSHAndPDBRowsPromise = function(sequence, rowCallback) {

  var psshRows = null;
  return connector
  // .queryPromise(
  // getTempSQL(),
  // [ sequence.uniprot_hash ], {multipleStatements: true}).then(function
  // (results) {
  // psshRows = results;
  // psshRows.forEach(function (psshRow) {
  // var chainRow = psshRow;
  .queryPromise(getPSSHSQL(), [ sequence.uniprot_hash ]).then(
      function(results) {
        psshRows = results;
        if (results.length == 0) {
          throw Errors.MatchingStructures('No alignments found.'); 
        }
        var chainHashes = results.map(function(psshRow) {
          return psshRow.PDB_chain_hash;
        });
        return connector.queryBatchList(chainHashes, getPDBSQL);

      }).then(function(pdbChainRows) {
    var pdbChainRowMap = {};
//     console.log('pdbChainRows: ' + pdbChainRows);
    pdbChainRows.forEach(function(pdbChainRow) {
      // if (pdbChainRow.MD5_Hash === 'a6d4bf90cedeaf2b692cefe06281b230') {
      // console.log('FOUND IT!!!');
      // }
      // else {
      // console.log(JSON.stringify(pdbChainRow));
      // }
      var existingList = pdbChainRowMap[pdbChainRow.MD5_Hash];
      if (existingList) {
        existingList.push(pdbChainRow);
      } else {
        pdbChainRowMap[pdbChainRow.MD5_Hash] = [ pdbChainRow ];
      }
    });
    return pdbChainRowMap;
  }).then(function(pdbChainRowMap) {
//     console.log('psshRows: '+ psshRows.length);
    psshRows.forEach(function(psshRow) {
      var chainRows = pdbChainRowMap[psshRow.PDB_chain_hash];
      if (typeof chainRows === 'undefined') {
        console.log("couldn't find chainRows for : " + psshRow.PDB_chain_hash);
      } else {
//        console.log('chainRows: '+ chainRows);
        chainRows.forEach(function(chainRow) {
          rowCallback(psshRow, chainRow);
        });
      }

      // console.log('finishing dataRow: ' + dataRow);
    });
  });
}


// order NULLS last:
// http://stackoverflow.com/questions/2051602/mysql-orderby-a-number-nulls-last
// var getPSSHSQL = function(isBat) {
// var tablename = isBat ? "PSSH2_bat" : "PSSH2";
// return Promise
// .resolve("select PDB_chain.PDB_ID, PDB_chain.Matches, PDB.Biounits, E_value,
// PDB_chain.Chain, Transform, 2D_Structure, SEQRES, \
// Align_to_SEQRES, Alignment, Identity_Score, Resolution, Repeat_domains,
// Title, \
// PDB_chain.MD5_Hash, psshResolved.Match_length from PDB_chain,"
// + tablename
// + " as psshResolved, PDB where protein_sequence_hash = ? AND \
// psshResolved.PDB_chain_hash = PDB_chain.MD5_Hash AND PDB_chain.PDB_ID =
// PDB.PDB_ID \
// ORDER BY Identity_Score DESC, psshResolved.Match_length DESC, -Resolution
// DESC, Published DESC, PDB_chain.Matches");
// //ORDER BY Identity_Score DESC, -Resolution DESC, PDB_chain.Matches");
// };

var getPSSHSQL = function() {
  return "select psshResolved.PDB_chain_hash, Match_length, E_value, Identity_Score, Repeat_domains, Alignment from PSSH2 as psshResolved where protein_sequence_hash = ? \
ORDER BY Identity_Score DESC, Match_length DESC";
};

var getTempSQL = function() {
  return "create temporary table if not exists temp_table \
(select psshResolved.PDB_chain_hash, Match_length, E_value, Identity_Score from PSSH2 as psshResolved where protein_sequence_hash = ?   ORDER BY Identity_Score DESC, Match_length DESC); \
select temp_table.*, PDB_chain.PDB_ID, PDB_chain.Matches, PDB.Biounits, PDB_chain.Chain, Transform, 2D_Structure, SEQRES,       Align_to_SEQRES, Resolution, Title,       PDB_chain.MD5_Hash \
from PDB_chain, PDB, temp_table where PDB_chain.MD5_Hash  = temp_table.PDB_chain_hash AND PDB_chain.PDB_ID = PDB.PDB_ID;";
}

var getPDBSQL = function(chainHashes) {
  var q = chainHashes.map(function() {
    return '?'
  });
  // q.length = chainHashes.length;
  return "select \
PDB_ID, Chain, Model, PDB_chain.MD5_Hash, Matches, Align_to_SEQRES from PDB_chain where PDB_chain.MD5_Hash  in ("
      + q.join(",") + ") and Model = 1;";
};

module.exports.fillExtraPDBData = function(clusters) {
  var clusterMap = {};
//  console.log('fill clusters: ' + JSON.stringify(clusters));
  clusters.forEach(function(cluster) {
    var key = [cluster.pdb_id, cluster.pdb_chain, cluster.model].join('');
    if (clusterMap[key]) {
//      console.log('overwriting key: ' + JSON.stringify(clusterMap[key].psshEntry) + ", vs " + JSON.stringify(cluster.psshEntry));
      clusterMap[key].push(cluster);
    }
    else {
      clusterMap[key] = [cluster];
    }
  });
  var sql = "select PDB_ID, Biounits, Resolution, Experimental_Method from PDB where PDB_ID in ('";
  sql += clusters.map(function(row) { return row.pdb_id}).join("','") + "')";
  var pdbMap = {};
  return connector.queryPromise(sql).then (function (data) {
    data.forEach(function (row) {
      pdbMap[row.PDB_ID] = row;
    });
    return pdbMap;
  }).then(function (pdbMap) {
    sql = "select c.PDB_ID, Chain, Model, SEQRES, 2D_Structure, Transform  from PDB_chain c where (c.PDB_ID, c.Chain, c.Model) in (";
    var params = clusters.map(function (cluster) {
      return "(" + ["'" + cluster.pdb_id + "'", "'" + cluster.pdb_chain + "'", cluster.model].join(",") + ")";
    });
    sql += params.join(",") + ");"
    return connector.queryPromise(sql);
  }).then (function (data) {
//    console.log('got some data: ' + data);
        data.forEach(function(row) {
          var pdbRow = pdbMap[row.PDB_ID];
          var key = [row.PDB_ID, row.Chain, row.Model].join('');
          var clusterArray = clusterMap[key];
          clusterArray.forEach(function (cluster) {
//            console.log('adding data to cluster: ' + cluster.pdb_id + ', ' + row.SEQRES + ", " + cluster.psshEntry);
            cluster.psshEntry.biounits = pdbRow.Biounits;
            cluster.psshEntry.SEQRES = row.SEQRES;
            cluster.psshEntry.transform = row.Transform;
            cluster.psshEntry.Structure2D = row['2D_Structure'] || '';
            cluster.psshEntry.Resolution = pdbRow.Resolution;
            cluster.psshEntry.Experimental_Method = pdbRow.Experimental_Method;
//            if (key === '3hhmB1') {
//              console.log('FOUND The cluster: ' + JSON.stringify(cluster) + ", SEQRES: " + row.SEQRES);
//            }
          });
//          console.log('Finished adding data to cluster');

        });
        return clusters;
      });
};



// var getPDBSQL = function(chainHashes) {
// var q = chainHashes.map(function () { return '?'});
// //q.length = chainHashes.length;
// return "select PDB_chain.PDB_ID, PDB_chain.Matches, PDB_chain.Chain,
// Transform, 2D_Structure, SEQRES, \
// Align_to_SEQRES, \
// PDB_chain.MD5_Hash from PDB_chain where PDB_chain.MD5_Hash in (" +
// q.join(",") + ");";
// };

// var getPDBSQL = function(chainHashes) {
// return "select PDB_chain.PDB_ID, PDB_chain.Matches, PDB.Biounits,
// PDB_chain.Chain, Transform, 2D_Structure, SEQRES, \
// Align_to_SEQRES, Resolution, Title, \
// PDB_chain.MD5_Hash from PDB_chain, PDB where PDB_chain.MD5_Hash in ('" +
// chainHashes.join("','") + "') AND PDB_chain.PDB_ID = PDB.PDB_ID and
// PDB_chain.Matches = '';";
// //ORDER BY Identity_Score DESC, -Resolution DESC, PDB_chain.Matches");
// };
