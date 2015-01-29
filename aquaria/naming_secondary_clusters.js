var connector = require('../common/connector');
var logger = require('../common/log');

module.exports.label_secondary_clusters = function(clusters, uniprot_accession, 
      pdb_chain_name) {
   // given the children of a primary cluster, label all the children.

   var primary_accessions = {};

   for (var i = 0; i < clusters.length; i++) {
//     console.log('cluster: ' + JSON.stringify(clusters[i]) + ', parts: ');
     Object.keys(clusters[i].parts).forEach (function (part) {
//       console.log('part: ' + part);
         if (part !== 'RNA' && part !== 'DNA' ) {
            primary_accessions[part] = 1;
         }
      });
   }

   primaryAccessionList = Object.keys(primary_accessions);
//   console.log('primaryAccessionList: ' + primaryAccessionList);   
   return connector.queryPromise(getSQL(primaryAccessionList)).then (function (results) {
     sort_synonyms(results, clusters, uniprot_accession, pdb_chain_name);
     return clusters;
   });

}

function getSQL(primaryAccessionList) {
  // does first sql query to sort_synonyms
  var sqlquery = "SELECT * from (SELECT Primary_Accession, Synonym FROM protein_synonyms WHERE Source_Field in ('GN', 'GS', 'GS1', 'OLN', 'ORF') AND Primary_Accession in ('";
  var wheres = [];
    
  sqlquery +=  primaryAccessionList.join("','");
  
  // don't use mysql order by FIELD as it doesn't index
  // http://stackoverflow.com/questions/958627/mysql-order-by-values-within-in
  sqlquery = sqlquery + "') ORDER BY FIELD(Source_Field, 'GN', 'GS',  'GS1',  'OLN')) AS TMP_SYNONYMS GROUP BY Primary_Accession;"; // ignore last ORF
  return sqlquery;
}


function sort_synonyms(data, clusters, uniprot_accession, pdb_chain_name) {
   // for each of the data rows, sort into info.synonyms so that synonyms[key] = best name for protein.
   // then label_s_cluster for the each cluster.
   var i;
   var synonyms = {};
   data.forEach(function (row) {
     synonyms[row.Primary_Accession] = row.Synonym;
   });
   var j;
   for (j = 0; j < clusters.length; j++) {
      // label each cluster
      label_s_cluster(clusters[j], uniprot_accession, pdb_chain_name, synonyms);
   }
}

function get_oligomer_label(count) {
   var answer;
   switch (count) {
      case 1:
         answer = '';
         break;
      case 2:
         answer = ' (dimer)';
         break;
      case 3:
         answer = ' (trimer)';
         break;
      case 4:
         answer = ' (tetramer)';
         break;
      case 5:
         answer = ' (pentamer)';
         break;
      case 6:
         answer = ' (hexamer)';
         break;
      default:
         answer = ' (' + count + '-mer)';
   }
   return answer;
}

function label_s_cluster(s_cluster, uniprot_accession, pdb_chain_name, synonyms) {
   var key;
   var label_long_tmp;
   var label_tmp;
   // CHANGE FOR MULTIPLE UNIPROT INPUT LATER
   var accession = uniprot_accession[0];

   Object.keys(s_cluster.parts).forEach(function (key) {
     var val = s_cluster.parts[key];
      if (key !== 'label_long' && key !== 'children' && key !== 'label') {
         if (typeof pdb_chain_name[key] !== 'undefined') {
            label_long_tmp = pdb_chain_name[key] + get_oligomer_label(val);
         } else {
            label_long_tmp = key + get_oligomer_label(val);
         }
         if (typeof synonyms[key] !== 'undefined') {
            label_tmp = synonyms[key] + get_oligomer_label(val);
         } else {
            label_tmp = label_long_tmp;
         }
         if (typeof s_cluster.label_long === 'undefined') {
            s_cluster.label_long = label_long_tmp;
            s_cluster.label = label_tmp;
         } else {
            // if the uniprot accession = the search uniprot accession, put it in first
            if (key == accession) {
               s_cluster.label_long = label_long_tmp + " + " + s_cluster.label_long;
               s_cluster.label = label_tmp + " + " + s_cluster.label;
            } else {
               s_cluster.label_long += " + " + label_long_tmp;
               s_cluster.label += " + " + label_tmp;
            }
         }
      }
   });
//   s_cluster.label = s_cluster.partKey;
//   s_cluster.label_lon
}

function capitaliseFirstLetter(string) {
   return string.charAt(0).toUpperCase() + string.slice(1);
}
