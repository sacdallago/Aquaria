var connector = require('../common/connector');

module.exports.getPubMedForPDB = (function (pdb_id, callback) {
   connector.query("Select citation, PubMed.title, authors, affiliation, abstract, Experimental_Method from PubMed, PDB WHERE PDB.PubMed_ID = PubMed.PubMed_ID and PDB.PDB_ID = ?", pdb_id, db_callback_function, callback);
});

module.exports.getOrganismInfo = (function (organism_id, callback) {
	console.log('in getOrganismInfo');
	connector.query("Select organism_names.organism_id, organism_names.Name  from organism_names where organism_id = ?", organism_id, getOrganismSynonyms, callback);
});
  

var getOrganismSynonyms = function (data, callback) {
	var organism = data[0];
	console.log('in getSynonyms: ' + organism.Name + ', id:' + organism.organism_id);
	var populateSynonyms =  function (synonymData) {
		console.log('in populateSynonyms: ' + synonymData);
		var syns = [];
		synonymData.forEach(function (entry) {
			syns.push(entry.Synonym);
		});
	   organism['synonyms'] = syns;
	   callback(organism);
	   
   };
   connector.query("Select Synonym from organism_synonyms where organism_synonyms.organism_id = ? ", organism.organism_id, populateSynonyms, callback);
};


module.exports.getProteinSynonyms = (function (organism_id, primary_accession, callback) {
	console.log('in getProteinSynonyms');
	var params = [organism_id, primary_accession];
	connector.query("Select Synonym from protein_synonyms where organism_id = ? and Primary_Accession = ?", params, callback);
});

var db_callback_function  = function (data, callback) {
	console.log (data[0]);
	callback(data[0]);
};
