var connector = require('../common/connector');
var cache = require ('../common/cache')();

// given the members of one cluster, it generates the secondary cluster.
// the callback function acts on the children (i.e. at the end there is callback (children))
module.exports.getFastAAlignment = function(members, callback, progressCallback) {
   //var i;
   var sqlquery;
   var pdb_id;
   //console.log('in get secondary clusters: ' + members);
   if (typeof members !== 'undefined') {
      // used to pass info to next function
      var secondary_clusters = {};
      secondary_clusters.members = members;
      secondary_clusters.i = 0;
      secondary_clusters.n_secondary_clusters = -1;
      secondary_clusters.callback = callback;
      secondary_clusters.progressCallback = progressCallback;
      secondary_clusters.children = [];
      if (members.length > 0) {
         sqlquery = "SELECT PDB_ID, Chain, Matches, Name, Accession, Source_DB, Type, Synonym from PDB_chain LEFT JOIN protein_synonyms ON PDB_chain.Accession = protein_synonyms.Primary_Accession WHERE Source_Field = 'GS' AND PDB_ID = '" + members[0].pdb_id + "' GROUP BY Chain";
         connector.query(sqlquery, 1, get_molecular_assembly, secondary_clusters);
      }
   }
}

function get_molecular_assembly(data, secondary_clusters) {
   //console.log('in get_molecular_assembly: ' + data);
   var i = secondary_clusters.i;
   var j;
   var callback;
   secondary_clusters.members[i].molecular_assembly = {};
   pdb_chain_name = {};
   synonyms_name = {};
   callback = secondary_clusters.callback;
   for (j = 0; j < data.length; j++) {
	   if (secondary_clusters.progressCallback) {
		   secondary_clusters.progressCallback(j / data.length);
	   }
      if (data[j].Type === 'DNA') {
         if (typeof secondary_clusters.members[i].molecular_assembly.DNA === 'undefined') {
            secondary_clusters.members[i].molecular_assembly.DNA = 1;
         } else {
            secondary_clusters.members[i].molecular_assembly.DNA += 1;
         }
      } else if (data[j].Type === 'RNA') {
         if (typeof secondary_clusters.members[i].molecular_assembly.RNA === 'undefined') {
            secondary_clusters.members[i].molecular_assembly.RNA = 1;
         } else {
            secondary_clusters.members[i].molecular_assembly.RNA += 1;
         }
      } else {
         // protein
         if (data[j].Chain === secondary_clusters.members[i].pdb_chain[0]) {
            secondary_clusters.members[i].pdb_equivalent = data[j].Accession;
         }
         if (typeof secondary_clusters.members[i].molecular_assembly[data[j].Accession] === 'undefined') {
            secondary_clusters.members[i].molecular_assembly[data[j].Accession] = 1;
            pdb_chain_name[data[j].Accession] = data[j].Name;
            synonyms_name[data[j].Accession] = data[j].Synonym;
         } else {
            secondary_clusters.members[i].molecular_assembly[data[j].Accession] += 1;
         }
      }
   }
   //console.log(JSON.stringify(secondary_clusters.members[i].molecular_assembly, null, "\t"));
   populate_secondary_clusters(secondary_clusters, pdb_chain_name, synonyms_name);
   secondary_clusters.i += 1;
   if (secondary_clusters.i === secondary_clusters.members.length) {
      console.log(JSON.stringify(secondary_clusters.children, null, "\t"));
      //console.log(JSON.stringify(secondary_clusters.children, null, "\t"));
      //console.log("number of members: " + secondary_clusters.members.length + " number of secondary clusters: " + secondary_clusters.children.length);
      if (callback) {
    	  //console.log('calling callback: ' + callback);
         callback(secondary_clusters.children);
      }
   } else {
      //sqlquery = "SELECT PDB_ID, Chain, Matches, Name, Accession, Source_DB, Type from PDB_chain WHERE PDB_ID = '" + secondary_clusters.members[secondary_clusters.i].pdb_id + "'";
      sqlquery = "SELECT PDB_ID, Chain, Matches, Name, Accession, Source_DB, Type, Synonym from PDB_chain LEFT JOIN protein_synonyms ON PDB_chain.Accession = protein_synonyms.Primary_Accession WHERE Source_Field = 'GS' AND PDB_ID = '" + secondary_clusters.members[secondary_clusters.i].pdb_id + "'";
      connector.query(sqlquery, 1, get_molecular_assembly, secondary_clusters);
   }
}

function populate_secondary_clusters(secondary_clusters, pdb_chain_name, synonyms_name) {
   //console.log('in populate secondary clusters: ' + secondary_clusters);
   var categorised = 0;
   var j;
   var i = secondary_clusters.i;
   var key;
   if (secondary_clusters.n_secondary_clusters === -1) {
      secondary_clusters.n_secondary_clusters += 1;
      secondary_clusters.children[secondary_clusters.n_secondary_clusters] = {};
      for (key in secondary_clusters.members[i].molecular_assembly) {
         if (secondary_clusters.members[i].molecular_assembly.hasOwnProperty(key)) {
            secondary_clusters.children[secondary_clusters.n_secondary_clusters][key] = secondary_clusters.members[i].molecular_assembly[key];
         }
      }
      secondary_clusters.children[secondary_clusters.n_secondary_clusters].children = [];
      secondary_clusters.children[secondary_clusters.n_secondary_clusters].children.push(
            { "pdb_id": secondary_clusters.members[i].pdb_id,
              "pdb_chain": secondary_clusters.members[i].pdb_chain.slice(0),
              "alignment_identity_score": secondary_clusters.members[i].alignment_identity_score,
              "pssh_alignment": secondary_clusters.members[i].pssh_alignment.slice(0),
              "pdb_alignment": secondary_clusters.members[i].pdb_alignment.slice(0) 
            });
      label_s_cluster(secondary_clusters.children[secondary_clusters.n_secondary_clusters], pdb_chain_name, synonyms_name, secondary_clusters.members[i].pdb_equivalent);
   } else {
      categorised = 0;
      j = 0;
      while (j < secondary_clusters.children.length && categorised === 0) {
         categorised = 1;
         for (key in secondary_clusters.members[i].molecular_assembly) {
            if (secondary_clusters.members[i].molecular_assembly.hasOwnProperty(key)) {
               if (typeof secondary_clusters.children[j][key] === 'undefined') {
                  categorised = 0;
               } else {
                  if (secondary_clusters.children[j][key] !== secondary_clusters.members[i].molecular_assembly[key]) {
                     categorised = 0;
                  }
               }
            }
         }
         if (categorised === 0) {
            j++;
         }
      }
      if (categorised === 1) {
         secondary_clusters.children[j].children.push(
            { "pdb_id": secondary_clusters.members[i].pdb_id,
              "pdb_chain": secondary_clusters.members[i].pdb_chain.slice(0),
              "alignment_identity_score": secondary_clusters.members[i].alignment_identity_score,
              "pssh_alignment": secondary_clusters.members[i].pssh_alignment.slice(0),
              "pdb_alignment": secondary_clusters.members[i].pdb_alignment.slice(0) 
            });
      } else {
         secondary_clusters.n_secondary_clusters += 1;
         secondary_clusters.children[secondary_clusters.n_secondary_clusters] = {};
         for (key in secondary_clusters.members[i].molecular_assembly) {
            if (secondary_clusters.members[i].molecular_assembly.hasOwnProperty(key)) {
               secondary_clusters.children[secondary_clusters.n_secondary_clusters][key] = secondary_clusters.members[i].molecular_assembly[key];
            }
         }
         secondary_clusters.children[secondary_clusters.n_secondary_clusters].children = [];
         secondary_clusters.children[secondary_clusters.n_secondary_clusters].children.push(
               { "pdb_id": secondary_clusters.members[i].pdb_id,
                 "pdb_chain": secondary_clusters.members[i].pdb_chain.slice(0),
                 "alignment_identity_score": secondary_clusters.members[i].alignment_identity_score,
                 "pssh_alignment": secondary_clusters.members[i].pssh_alignment.slice(0),
                 "pdb_alignment": secondary_clusters.members[i].pdb_alignment.slice(0) 
               });
         label_s_cluster(secondary_clusters.children[secondary_clusters.n_secondary_clusters], pdb_chain_name, synonyms_name, secondary_clusters.members[i].pdb_equivalent);
      }
   }
}

function get_oligomer_label(count) {
   var answer;
   if (count === 1) {
      answer = '';
   } else if (count === 2) {
      answer = ' (dimer)';
   } else if (count === 3) {
      answer = ' (trimer)';
   } else if (count === 4) {
      answer = ' (tetramer)';
   } else if (count === 5) {
      answer = ' (pentamer)';
   } else if (count === 6) {
      answer = ' (hexamer)';
   } else {
      answer = ' (' + count + '-mer)';
   }
   return answer;
}

function label_s_cluster(s_cluster, pdb_chain_name, protein_equivalent) {
   var key;
   var label_long_tmp;
   var label_tmp;
   for (key in s_cluster) {
      if (key !== 'label_long' && key !== 'children' && key !== 'label') {
         if (typeof pdb_chain_name[key] !== 'undefined') {
            label_long_tmp = pdb_chain_name[key] + get_oligomer_label(s_cluster[key]);
         } else {
            label_long_tmp = key + get_oligomer_label(s_cluster[key]);
         }
         if (typeof synonyms_name[key] !== 'undefined') {
            label_tmp = synonyms_name[key] + get_oligomer_label(s_cluster[key]);
         } else {
            label_tmp = label_long_tmp;
         }
         if (typeof s_cluster.label_long === 'undefined') {
            s_cluster.label_long = label_long_tmp;
            s_cluster.label = label_tmp;
         } else {
            s_cluster.label_long += " + " + label_long_tmp;
            s_cluster.label += " + " + label_tmp;
         }
      }
   }
}

function capitaliseFirstLetter(string) {
   return string.charAt(0).toUpperCase() + string.slice(1);
}
