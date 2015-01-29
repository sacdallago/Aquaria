var connector = require('../common/connector');
var cache = require('../common/cache')(100000);
var naming_secondary_clusters = require('./naming_secondary_clusters');
var logger = require('../common/log');
var Promise = require('es6-promise').Promise;


// given the members of one cluster, it generates the secondary cluster.
// the callback function acts on the children (i.e. at the end there is callback
// (children))
var get_secondary_clusters = function(members, uniprot_accession,
    cluster_nbr, callback) {
  // logger.info('in get_secondary_clusters: ' + uniprot_accession);

  var cache_id = uniprot_accession + '-' + cluster_nbr;
  var output = cache.read(cache_id);
  logger.info("Looking for cache id: " + cache_id);
  if (!output) {
    logger.info("not found in cache! cache id: " + cache_id);
    // used to pass info to next function
    var secondaryCluster = new SecondaryCluster(members, uniprot_accession);
    secondaryCluster.queryPromise
      .then(function(rowsProcessed) {
//        console.log('rows processed: ' + JSON.stringify(rowsProcessed));
        return naming_secondary_clusters.label_secondary_clusters(rowsProcessed,uniprot_accession, secondaryCluster.pdbChainName);
      }).then (function(clusters) {
//        console.log('got label names: ' + clusters);
        callback(clusters);
//        console.log('Finished all queries: ' + clusters.length);
        cache.write(cache_id, clusters);
      }).catch(function (err) {
        console.log('err occurred in get_secondary_clusters: ' + err);
      });
  } else {
    logger.info("Object read from cache, success!");
    callback(output);
  }
};

var SecondaryCluster = function(members, uniprot_accession) {
  this.assemblyMap = {};
  this.pdbChainName = {};
  var that = this;
  this.allResults = [];
  this.childrenMap = {};
  this.memberMap = {};
  
//  var pdbList = members.map(function(entry) {
//    if (entry.pdb_id === '1gzh') {
//      console.log('The entry is: ' + JSON.stringify(entry));
//    }
//    return entry.pdb_id;
//  });
  members.forEach(function (member) {
    that.memberMap[member.pdb_id + member.pdb_chain + member.model] = member;
  });
  this.queryPromise = this.queryPDBs(members.slice(0)).then( function(results) {

    results.forEach(function(row) {
      that.processRow(row);
    });
    members.forEach(function (member) {
      that.populate_secondary_clusters(member);
    })
    console.time("SortingMembers");
    var children = Object.keys(that.childrenMap).map(function (key) {
      //TODO sort childrenMap based on Identity Score !!!! and put in children var
//      console.log('the child is: ' + key);
      var child = that.childrenMap[key];
//      var newChildren = [];
//      Object.keys(child.children).forEach(function (pdb_id) {
//        newChildren = newChildren.concat(child.children[pdb_id]);
//      } );
//      child.children = newChildren;
      sort(child.children); 
      return child;
    });
//    console.log('the children are: ' + children);
    children.sort(function (a,b) {
      return b.children[0].alignment_identity_score - a.children[0].alignment_identity_score; 
    });
    console.timeEnd("SortingMembers");
    return children;

  });
};


var sort = function(members) {
  
  members.sort(function (a, b) {
    var diff = b.alignment_identity_score - a.alignment_identity_score;
//    if (diff === 0) {
//      diff = b.match_length - a.match_length;
//    }
//    if (diff === 0) {
//      
//      // identical residues
//    }
//    if (diff === 0) {
//      // resolution
//      diff = a.Resolution - b.Resolution;
//    }
//    if (diff === 0) {
//      diff = getExperimentalMethodSort(a.Experimental_Method) - getExperimentalMethodSort(b.Experimental_Method);
//    }
//    if (diff === 0) {
//      
////      by date
//    }

  });
}

var getExperimentalMethodSort = function (type) {
  if (type) {
    
    var types  = {
      "X-ray diffraction" : 1,
      "Solution NMR" : 2,
      "Electron microscopy" : 3
    }
    return types[type.trim()]  || 4;
  }
  else {
    return 4;
  }
  
}


SecondaryCluster.prototype.processRow = function(row) {
  var that = this;
  // logger.info('in get_molecular_assembly: ' + data);
//  if (row.Matches) {
//    return;
//  }
  // model 0 means that it doesn't occur in the biounit
  if (row.Model === 0) {
    return;
  }
  var member = that.memberMap[row.PDB_ID + row.Chain + row.Model];
//  console.log('found member: ' + JSON.stringify(member));
  if (member) {
    member.transform = row.Transform;
  }
  var molecular_assembly = this.assemblyMap[row.PDB_ID ] || {};
  this.assemblyMap[row.PDB_ID ] = molecular_assembly; 
  if (row.Type === 'DNA') {
    if (typeof molecular_assembly.DNA === 'undefined') {
      molecular_assembly.DNA = 1;
    } else {
      molecular_assembly.DNA++;
    }
  } else if (row.Type === 'RNA') {
    if (typeof molecular_assembly.RNA === 'undefined') {
      molecular_assembly.RNA = 1;
    } else {
      molecular_assembly.RNA++;
    }
  } else {
    // protein
    if (typeof molecular_assembly[row.Accession] === 'undefined') {
      molecular_assembly[row.Accession] = row.Monomer;
      that.pdbChainName[row.Accession] = row.Name;
    } else {
      molecular_assembly[row.Accession] = Math.max(
          molecular_assembly[row.Accession], row.Monomer);
    }
  }
};

SecondaryCluster.prototype.createAssemblyKey = function(molecularAssembly) {
  var parts = Object.keys(molecularAssembly).map(function (key) {
    return key + "_" + molecularAssembly[key]; 
  }).sort();
  var key =  parts.join(',');
  return key.toLowerCase();
}

SecondaryCluster.prototype.getSQL = function(pdbList) {
  var idLines = pdbList.map(function (member) {
    return "'" + member.pdb_id + "'";
//    return ["(", member.pdb_id + member.pdb_chain, ")"].join("'");
    
  });
  return "SELECT PDB_ID, Chain, Transform, Matches, Model, Monomer, Name, Accession, Source_DB, Type \
             from PDB_chain WHERE PDB_ID in ("
      + idLines.join(",") + ");";
};


SecondaryCluster.prototype.queryPDBs = function(pdbList) {
  var rowData = [];
  var that = this;
  return connector.queryBatchList(pdbList, that.getSQL,
    function (batch) {
    rowData = rowData.concat(batch);
  }).then(function (totalCount) {
    return rowData;
  });
};

SecondaryCluster.prototype.populate_secondary_clusters = function(member) {
  var that = this;
//  console.log('ass map: ' + JSON.stringify(that.assemblyMap));
  var molecularAssembly = that.assemblyMap[member.pdb_id];
  if (molecularAssembly) {
    
    var key = that.createAssemblyKey(molecularAssembly);
    categorised = 0;
    j = 0;
  
    var newEntry = {
      "pdb_id" : member.pdb_id,
//      "resolution" : member.Resolution,
      "pdb_chain" : member.pdb_chain[0],
      "Repeat_domains" : member.Repeat_domains.slice(0),
      "alignment_identity_score" : member.alignment_identity_score,
      "viewer_format" : member.viewer_format.slice(0),
      "transform" : member.transform
    };
  
    var existingChild = this.childrenMap[key];
    if (typeof existingChild === 'undefined') {
      existingChild = {
          parts: {},
          children: []
      };
      
      this.childrenMap[key] = existingChild;
      existingChild.parts  = that.assemblyMap[member.pdb_id];
      existingChild.partKey  = key;
    }
    existingChild.children.push(newEntry);
//    var children = existingChild.children[member.pdb_id + member.pdb_chain] ;
//    if (typeof children === 'undefined') {
//      children = [newEntry];
//      existingChild.children[member.pdb_id + member.pdb_chain] = children;
//    } else {
//      console.log('found dup PDBs: ' + JSON.stringify(children) + ", OTHER: " + JSON.stringify(newEntry));
//      if (that.isUnique(newEntry, children)) {
//        console.log('IS unique');
//        children.push(newEntry);
//      }
//    }
  }
  else {
    console.log('molecular assembly for: ' + JSON.stringify(member) +', was not found, ' + JSON.stringify(that.assemblyMap) );
  }

}


var getTitlePDBSQL = function() {
  return "SELECT Name, Title, Experimental_Method \
             from PDB_chain, PDB WHERE PDB_chain.PDB_ID = PDB.PDB_ID and PDB_chain.PDB_ID = ? and PDB_chain.Chain = ? limit 1;";
};

var queryPDBTitle = function(pdb, chain, callback) {
  return connector.queryPromise(getTitlePDBSQL(), [pdb, chain]).then (function (results) {
    var row = results[0];
    
    callback(row.Name, row.Title, row.Experimental_Method);
  });
};

module.exports.get_secondary_clusters = get_secondary_clusters;
module.exports.queryPDBTitle = queryPDBTitle;