connector = require('../common/connector');

// this version searches UniProt
//module.exports.queryProtein = function(protein, organismid, callback){
//	'use strict';
//	connector.query('SELECT Primary_Accession, Synonym, Source_Field, Organism_ID FROM protein_synonyms WHERE Synonym LIKE ? AND Organism_ID = ? LIMIT 20', [protein + '%', organismid], callback, null);
//};

// this version is restricted to SwissProt
module.exports.queryProtein = function(protein, organismid, nameCallback, idCallback, pdbCallback){
	'use strict';
//	 connector.queryPromise('SELECT protein_synonyms.Primary_Accession, Synonym, Source_Field, protein_synonyms.Organism_ID FROM protein_synonyms WHERE AND Synonym LIKE ? AND protein_synonyms.Organism_ID = ? LIMIT 100', [protein + '%', organismid]).then (function (data) {
//	   var idData = [];
//	   var nameData = [];
//	   data.some(function (row, i) {
//	     var ret = false;
//	     var isID = (['ID', 'GeneID', 'STRING', 'AC', 'Ensembl'].indexOf(row.Source_Field) != -1); 
//	     if (isID) {
//	       if (idData.length < 10) {
//	         idData.push(row);
//	       }
//	     }
//	     else {
//         if (nameData.length < 10) {
//           nameData.push(row);
//         }
//	     }
//       if (nameData.length == 10 && idData.length == 10) {
//         ret = true;
//       }
//       return ret;
//	     
//	   })
//     nameCallback(nameData);
//     idCallback(idData);
//	 });
	if (protein.indexOf('_') !== -1) {
		protein = protein.replace(/_/g, '\\_');
	}
//  connector.queryPromise('SELECT protein_synonyms.Primary_Accession, Synonym, Source_Field, protein_synonyms.Organism_ID FROM protein_synonyms WHERE Synonym LIKE ? AND isID = 0 LIMIT 10', [protein + '%', organismid]).then (function (nameData) {
	connector.queryPromise('SELECT protein_synonyms.Primary_Accession, Synonym, Source_Field, protein_synonyms.Organism_ID FROM protein_synonyms WHERE Synonym LIKE ? AND protein_synonyms.Organism_ID = ? AND isID = 0 LIMIT 10', [protein + '%', organismid]).then (function (nameData) {
    nameCallback(nameData);

//    connector.queryPromise('SELECT protein_synonyms.Primary_Accession, Synonym, Source_Field, protein_synonyms.Organism_ID FROM protein_synonyms WHERE Synonym LIKE ? AND isID = 1 LIMIT 10', [protein + '%', organismid]).then (function (idData) {
//      idCallback(idData);

	});
  connector.queryPromise('SELECT protein_synonyms.Primary_Accession, Synonym, Source_Field, protein_synonyms.Organism_ID FROM protein_synonyms WHERE Synonym LIKE ? AND protein_synonyms.Organism_ID = ? AND isID = 1 LIMIT 10', [protein + '%', organismid]).then (function (idData) {
    idCallback(idData);

  });

  if (!isNaN(parseInt(protein.charAt(0))) && protein.length <= 4) {
    connector.queryPromise("SELECT PDB_ID as Synonym, 'Identifiers' as Category, 'PDB' as Source_Field FROM PDB WHERE PDB_ID LIKE ? ORDER BY PDB_ID ASC LIMIT 7", [protein + '%']).then(function (pdbData) {
      pdbCallback(pdbData);
    });
  }
};

//this version is restricted to SwissProt. It provides the organism if available, otherwise something else.
module.exports.queryProteinWildOrganism = function(protein, organismid, callback){
  'use strict';
  connector.query('SELECT protein_synonyms.Primary_Accession, Synonym, Source_Field, protein_synonyms.Organism_ID FROM protein_synonyms inner join protein_sequence ON protein_synonyms.Primary_Accession = protein_sequence.Primary_Accession WHERE source_database = "swissprot" AND Synonym LIKE ? ORDER BY CASE WHEN protein_synonyms.Organism_ID = ? THEN 1 ELSE 2 END ASC LIMIT 1', [protein + '%', organismid], callback, null);
};


module.exports.queryOrganism = function(organism, callback){
	'use strict';
	connector.queryPromise('SELECT Organism_ID, Synonym, Source_Field FROM organism_synonyms WHERE Synonym LIKE ? ORDER BY Synonym, Organism_ID ASC LIMIT 20', [organism + '%']).then (function (data) {
    callback(data);
	});
};


