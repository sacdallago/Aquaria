var connector = require('../common/connector');
var logger = require('../common/log');

var db_callback_function  = function (data, callback) {
	logger.info (data[0]);
	callback(data[0]);
};

module.exports.getPubMedForPDB = (function (pdb_id, pdb_chain, callback) {
	var PDBdata = {};
	PDBdata.pdb_id = pdb_id;
	PDBdata.pdb_chain = pdb_chain;
	PDBdata.callback = callback;
	logger.info('in getPubMedForPDB: ' + pdb_id);
	connector.query("Select PubMed.PubMed_ID, citation, PubMed.title, authors, affiliation, abstract, Experimental_Method, Resolution from PubMed, PDB WHERE PDB.PubMed_ID = PubMed.PubMed_ID and PDB.PDB_ID = ?", pdb_id, getMoleculeName, PDBdata);
});

function getMoleculeName(data, PDBdata) {
	data = data[0];
	if (data) {

		PDBdata.PubMed_ID = data.PubMed_ID;
		PDBdata.citation = data.citation;
		PDBdata.title = data.title;
		PDBdata.authors = data.authors;
		PDBdata.affiliation = data.affiliation;
		PDBdata.abstract = data.abstract;
		PDBdata.Experimental_Method = data.Experimental_Method;
		PDBdata.Resolution = data.Resolution;
	}
	else {
		PDBdata.PubMed_ID = null;
		PDBdata.citation = null;
		PDBdata.title = null;
		PDBdata.authors = null;
		PDBdata.affiliation = null;
		PDBdata.abstract = null;
		PDBdata.Experimental_Method = null;
		PDBdata.Resolution = null;

	}

	var sql = "Select Name, Accession from PDB_chain WHERE PDB_ID = '" + PDBdata.pdb_id + "' AND Chain = '" + PDBdata.pdb_chain + "'";
	logger.info(sql);
	connector.query(sql, null, getOrganismName, PDBdata);
}

function getOrganismName(data, PDBdata) {
	data = data[0];
	PDBdata.Molecule = data.Name;
	PDBdata.Accession = data.Accession;
	module.exports.getOrganismName(PDBdata.pdb_id, sortOrganismData, PDBdata);
}

module.exports.getOrganismName = function(pdbid, callback, params) {
	connector.query("Select protein_sequence.Organism_ID, organism_names.Name, PDB_chain.Accession FROM PDB_chain, protein_sequence, organism_names WHERE PDB_chain.Source_DB = 'Uniprot' AND PDB_chain.Accession = protein_sequence.Primary_Accession AND protein_sequence.Organism_ID = organism_names.Organism_ID AND PDB_chain.PDB_ID = ?", pdbid, callback, params);
};

function sortOrganismData(data, PDBdata) {
	var organisms = {};
	
	data.forEach(function(row) {
		organisms[row.Accession] = row.Name;
	});
	
	PDBdata.Organism = organisms;
	
	logger.info('sorting organismData for PDB: ' + PDBdata.Organism);
	var callback = PDBdata.callback;
	callback(PDBdata);

}

module.exports.getOrganismId = function(primary_accession, callback, meta_data) {
	connector.query("select organism_id from protein_sequence where primary_accession = ?", primary_accession, callback, meta_data);
};

module.exports.getOrganismInfo = (function (organism_id, callback) {
	logger.info('in getOrganismInfo: ' + organism_id);
	connector.query("Select organism_names.organism_id, organism_names.Name from organism_names where organism_id = ?", organism_id, module.exports.getOrganismSynonyms, callback);
});


module.exports.getOrganismSynonyms = function (data, callback) {
	if (typeof data === 'undefined' || data.length == 0) {
		return;
	}
	var organism = data[0];
	logger.info('in getSynonyms: ' + organism.Name + ', id:' + organism.organism_id);
	var populateSynonyms =  function (synonymData) {
		logger.info('in populateSynonyms: ' + JSON.stringify(synonymData));
		var syns = [];
		synonymData.forEach(function (entry) {
			syns.push(entry.Synonym);
		});
		organism['synonyms'] = syns;
		if (callback != null) {
			callback(organism);
		}

	};
	connector.query("Select Synonym from organism_synonyms where organism_synonyms.organism_id = ? ", organism.organism_id, populateSynonyms, callback);
};


module.exports.getProteinSynonyms = (function (primary_accession, organism_id, protein_callback, organism_callback) {
	var callbacks = [protein_callback, organism_callback];
	var setOrgId = function (o_id, callbacksInternal) {
		logger.info("in setOrgId: " + JSON.stringify(o_id));
		var orgId = (o_id instanceof Array) && (o_id.length) ? o_id[0].organism_id : null;
		//logger.info()
		var squl = "SELECT Synonym, Source_Field from protein_synonyms where Primary_Accession = '"+ primary_accession +"'"; // AND Organism_ID = '"+orgId+"'";
		squl+= " AND Source_Field in ('GN', 'RN', 'GS1', 'GS', 'OLN', 'ORF', 'DE') order by FIELD(Source_Field, 'GN', 'RN', 'DE', 'GS1', 'GS', 'OLN', 'ORF')";
		callbacksInternal.orgId = orgId;
		connector.query(squl, null, collectSynonyms, callbacksInternal);
	};


	if (organism_id === null) {
		module.exports.getOrganismId(primary_accession, setOrgId, callbacks);
	}
	else {
		setOrgId([{'organism_id' : organism_id}], callbacks);
	}


});

module.exports.getChainInfo = function(pdbId, chainId, callback) {
	
	connector.query("SELECT Type, Source_DB, Accession, Name FROM PDB_chain WHERE PDB_ID = '" + pdbId + "' and Chain = '" + chainId + "'", null, callback);
	
};

/**
 * Compiles a list of genes and synonyms from all available synonyms.
 * The 'genes' contains only gene names (GN) unless there is no GN, in which case the first GS and GS1 
 * will be used. 'synonyms' is a list of all other synonyms.
 * 
 * One of the synonyms will further be used (in textpanels.displayProtSynonyms) 
 * as preferred protein name if none had been specified by the user. It is determined as:
 * 1. the gene name (GN) if only one exists
 * 2. the recommended name (RN) if multiple gene names or synonyms exist, or the DE if no RN exists.
 * The preferred protein name will be added as another field 'Synonym'.
 * 
 * It is assumed that entries are ordered by source field in the following order: 
 * 'GN', 'RN', 'GS1', 'GS', 'OLN', 'ORF', 'DE'
 */
var collectSynonyms = function (pdata, callbacks) {
	if (pdata.length > 0) {

		var synonyms = pdata[0];
		// call organism callback
		module.exports.getOrganismInfo(callbacks.orgId, callbacks[1]);
		
		var tmp = {};
		var syns = [];
		pdata.forEach(function(entry) {
			if (typeof tmp[entry.Source_Field] === 'undefined') {
				tmp[entry.Source_Field] = [];
			}
			tmp[entry.Source_Field].push(entry.Synonym);
			if (entry.Source_Field !== 'GN') {
				syns.push(entry.Synonym);
			}
		});
		var gnames = tmp['GN'] instanceof Array ? tmp['GN'] : [];
		
		// determine preferred synonym
		if (gnames.length === 1 || syns.length === 0) {
			synonyms['Synonym'] = gnames[0];
		} else {
			synonyms['Synonym'] = syns[0];
		}
		
		// use first GS if there are no GNs and remove from syns
		
		if (!gnames.length) {
			if (tmp['GS'] instanceof Array && tmp['GS'].length > 0) {
				gnames.push(tmp['GS'][0]);
				syns.splice(syns.indexOf(tmp['GS'][0]), 1);
			} else if (tmp['GS1'] instanceof Array && tmp['GS1'].length > 0) {
				gnames.push(tmp['GS1'][0]);
				syns.splice(syns.indexOf(tmp['GS1'][0]), 1);
			} else {
				// gnames.push("No genes found");
			}
		}
		
		synonyms['synonyms'] = syns;
		synonyms['genes'] = gnames;
		callbacks[0](synonyms);
	}
	else {
		callbacks[0]({'Synonym' : 'none', 'synonyms' : 'none', 'genes' : 'none' });
	}


};

