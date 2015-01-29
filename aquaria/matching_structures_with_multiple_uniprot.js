var connector = require('../common/connector');
var cache = require('../common/cache');
var read_alignment = require('./read_alignment');
var logger = require('../common/log');
cache = cache.cache();

//
// These functions take a UniProt Primary_Accession as input, and return all related 3D structures.
//  Structures are clustered by alignment region, then ranked using the alignment identity score.
//
// Authors: Sean O'Donoghue & Vivian Ho
//
// THIS USES PSSH2

// Still to-do:
// * Clustering & calculation of secondary structure should be done in a separate thread by launching a child process
// 			See http://nodejs.org/api/child_process.html
// * The code could probably be simplified using a package such as 'async' (See https://github.com/caolan/async)

var conservation_score = (function() {
   // DETERMINE THE CONSERVATION BETWEEN TWO RESIDUES
	'use strict';
	//************ MAXHOM AMINO ACID EXCHANGE MATRIX ***************************************
	// see: McLachlan Andrew D., Tests for comparing related amino acid sequences. J.Mol.Biol. 61,409-424, minimal.
	// 1971 value: -3.0 ; maximal value:  6.0
	// symbols: "-BZX!" added
	// See also: http://www.genome.jp/aaindex/AAindex/list_of_matrices
	// See also: Figure 1, Ladunga & Smith, 1997
	// http://peds.oxfordjournals.org/content/10/3/187.full.pdf
	// Very highly conserved: IV|KR|DE|IL|AS|ST|LV|FY
	// Highly conserved: FL|LM|AV|AG|AT|DN|NS
	var i, j, index_of, substitution_score;
	var substitution_matrix = [['V',5,2,2,1,0,-1,0,-1,0,-1,-1,0,-2,-1,-1,-1,-1,-1,-2,-2,-2,-1],['L',2,5,2,3,2,0,0,-2,-1,-2,-1,0,-3,-1,-1,-1,0,-2,-2,-2,-2,0],['I',2,2,5,2,0,0,0,-2,-1,-2,-1,0,-2,-1,-2,-2,-3,-2,-2,-3,-2,-3],['M',1,3,2,5,2,-2,-1,-2,0,-2,-1,0,0,0,-2,-2,0,-2,-1,-1,-1,0],['F',0,2,0,2,6,3,3,-3,-2,-2,-1,-2,-3,1,-2,-3,-3,-3,-3,-2,-3,-3],['W',-1,0,0,-2,3,6,3,-2,-2,-3,0,-1,-1,0,0,-2,-1,-2,-3,-3,-3,-1],['Y',0,0,0,-1,3,3,6,-3,-2,-3,0,-2,-2,1,-1,-2,-2,-1,-1,-2,-1,-2],['G',-1,-2,-2,-2,-3,-2,-3,5,0,0,0,-1,-2,-1,0,0,-1,0,0,0,0,-1],['A',0,-1,-1,0,-2,-2,-2,0,5,1,1,0,-2,0,-1,0,0,1,0,0,0,0],['P',-1,-2,-2,-2,-2,-3,-3,0,1,5,0,0,-3,0,0,0,0,1,-2,0,-2,0],['S',-1,-1,-1,-1,-1,0,0,0,1,0,5,2,-1,0,1,0,1,1,2,0,2,1],['T',0,0,0,0,-2,-1,-2,-1,0,0,2,5,-1,1,0,0,0,1,0,0,0,0],['C',-2,-3,-2,0,-3,-1,-2,-2,-2,-3,-1,-1,6,0,-2,-3,-3,-3,-2,-2,-2,-3],['H',-1,-1,-1,0,1,0,1,-1,0,0,0,1,0,5,2,1,1,-1,1,1,1,1],['R',-1,-1,-2,-2,-2,0,-1,0,-1,0,1,0,-2,2,5,2,2,0,0,-2,0,2],['K',-1,-1,-2,-2,-3,-2,-2,0,0,0,0,0,-3,1,2,5,1,1,1,0,1,1],['Q',-1,0,-3,0,-3,-1,-2,-1,0,0,1,0,-3,1,2,1,5,2,1,1,1,5],['E',-1,-2,-2,-2,-3,-2,-1,0,1,1,1,1,-3,-1,0,1,2,5,1,2,1,2],['N',-2,-2,-2,-1,-3,-3,-1,0,0,-2,2,0,-2,1,0,1,1,1,5,2,5,1],['D',-2,-2,-3,-1,-2,-3,-2,0,0,0,0,0,-2,1,-2,0,1,2,2,5,2,1]];
	index_of = {};
	for (i = substitution_matrix.length-1; i >= 0; i -= 1) {
		index_of[substitution_matrix[i][0]] = i;
		for (j = substitution_matrix[0].length; j>=0; j -= 1) {
			substitution_score = substitution_matrix[i][j];
			if (substitution_score >= 5) {
				substitution_matrix[i][j] = 'identical';
			} else if (substitution_score >= 0) {
				substitution_matrix[i][j] = 'conserved';
			} else {
				substitution_matrix[i][j] = 'nonconserved';
			}
		}
	};
	var is_amino_acid = function(input_string) {
		if (typeof input_string === 'string' && input_string.match(/[AC-IK-NP-TVWY]/)) {
			return true;
		} else {
			return false;
		};
	};
	return function(residue_a, residue_b) {
		'use strict';
		residue_a = residue_a.toUpperCase();
		residue_b = residue_b.toUpperCase();
		if (is_amino_acid(residue_a) && is_amino_acid(residue_b)) {
			residue_a = index_of[residue_a];
			residue_b = index_of[residue_b] + 1;
			return substitution_matrix[residue_a][residue_b];
		} else {
			return false;
		};
	};
}());

// test: A1QZE0 P51451  - case with insertions: Q792Y6
//
module.exports.get_matching_structures = function(uniprot_primary_accession, callback){
	'use strict';
	var matches;
  if (typeof uniprot_primary_accession === 'string') {
  	
  	matches = cache.read(uniprot_primary_accession);
  }
  else {
  	matches = cache.read(uniprot_primary_accession.join('+'));
  }
	var i, sqlquery;
	if (! matches) {
		matches = {};
		matches.callback = callback;
      matches.start_date = new Date().getTime();
      if (typeof uniprot_primary_accession === 'string') {
         sqlquery = "SELECT Primary_Accession, Sequence, Features, MD5_Hash, Description, Length FROM protein_sequence WHERE MD5_Hash ='" + uniprot_primary_accession + "'";
      } else {
         matches.uniprot_primary_accession = uniprot_primary_accession.slice(0);
         if (matches.uniprot_primary_accession[0].match(/^A0BAT./)) {
            sqlquery = "SELECT Primary_Accession, Sequence, Features, MD5_Hash, Description, Length FROM protein_sequence_bat WHERE Primary_Accession ='" + matches.uniprot_primary_accession[0] + "'";
         } else {
            sqlquery = "SELECT Primary_Accession, MD5_Hash, Sequence, Features, Description, Length FROM protein_sequence WHERE (";
            for (i = 0; i < matches.uniprot_primary_accession.length; i++) {
               sqlquery += "Primary_Accession = '" + matches.uniprot_primary_accession[i] + "' ";
               if (i == matches.uniprot_primary_accession.length - 1) {
                  sqlquery += ")";
               } else {
                  sqlquery += "OR ";
               }
            }
         }
      }
      connector.query(sqlquery, null,get_uniprot_sequence, matches);
	} else {
		//logger.info(JSON.stringify(matches, null, "\t"));
		callback(matches);// <- switch on to embed in page
	};
	return;
}

module.exports.clear_cache = function() {
	cache.clear();
}


// 1st callback function for input of 2 Uniprot accession numbers
function get_uniprot_sequence(data, matches) {
   matches.elapsed = new Date().getTime() - matches.start_date;
   logger.info("Time taken for query: " + matches.elapsed);
	'use strict';
	var output;
	var i, j;
	var sqlquery = "";
	matches.uniprot_primary_accession = [];
	matches.uniprot_sequence = [];
	matches.uniprot_sequence_length = [];
	matches.uniprot_sequence_features = [];
	matches.uniprot_sequence_description = [];
   matches.uniprot_sequence_MD5_Hash = [];
	if (data.length > 0) {
		for (i = 0; i < data.length; i++) {
         // populate info about the protein
			matches.uniprot_primary_accession[i] = data[i].Primary_Accession;
			matches.uniprot_sequence[i] = data[i].Sequence;
			matches.uniprot_sequence_length[i] = data[i].Length;
			matches.uniprot_sequence_features[i] = data[i].Features;
			matches.uniprot_sequence_description[i] = data[i].Description;
         matches.uniprot_sequence_MD5_Hash[i] = data[i].MD5_Hash;
		}
		for (i = 0; i < data.length; i++) {
			logger.info("Uniprot_sequence = " + matches.uniprot_sequence[i] + "\n");
		}
      matches.start_date = new Date().getTime();
      // one uniprot input
      if (data.length == 1) {
         // account for the bat case
	      if (matches.uniprot_primary_accession[0].match(/^A0BAT./)) {
             connector.query("select PDB_chain.PDB_ID, PDB_chain.Chain, 2D_Structure, SEQRES, Align_to_SEQRES, Alignment, Identity_Score, Resolution, Repeat_domains, Title from PDB_chain,PSSH2_bat, PDB where protein_sequence_hash = ? AND PDB_chain.matches = '' AND E_value < 1e-10 AND PSSH2_bat.PDB_chain_hash = PDB_chain.MD5_Hash AND PDB_chain.PDB_ID = PDB.PDB_ID ORDER BY Identity_Score DESC, case when Resolution is null then 1 else 0 end, Resolution", [matches.uniprot_sequence_MD5_Hash[0]], generate_clusters, matches);
         } else {
        	 		connector.query("select PDB_chain.PDB_ID, PDB_chain.Chain, 2D_Structure, SEQRES, Align_to_SEQRES, Alignment, Identity_Score, Resolution, Repeat_domains, Title, PDB_chain.MD5_Hash from PDB_chain,PSSH2, PDB where protein_sequence_hash = ? AND PDB_chain.matches = '' AND E_value < 1e-10 AND PSSH2.PDB_chain_hash = PDB_chain.MD5_Hash AND PDB_chain.PDB_ID = PDB.PDB_ID ORDER BY Identity_Score DESC, case when Resolution is null then 1 else 0 end, Resolution", [matches.uniprot_sequence_MD5_Hash[0]], 
        	 				function(data) {
			            	if (data.length > 0) {
			            		generate_clusters(data,matches);
			            	}
			            	else {
			            		matches['pssh1'] = 1;
                           connector.query("select PDB_chain.PDB_ID, PDB_chain.Chain, 2D_Structure, SEQRES, Align_to_SEQRES, Alignment, Identity_Score, Resolution, Repeat_domains, Title, PDB_chain.MD5_Hash from PDB_chain,PSSH1, PDB where protein_sequence_hash = ? AND PDB_chain.matches = '' AND E_value < 1e-10 AND PSSH1.PDB_chain_hash = PDB_chain.MD5_Hash AND PDB_chain.PDB_ID = PDB.PDB_ID ORDER BY Identity_Score DESC, case when Resolution is null then 1 else 0 end, Resolution", [matches.uniprot_sequence_MD5_Hash[0]], generate_clusters, matches);
			            	}
        	 				});
         }
      } else {
         // multiple uniprot input
         for (i = 0; i < data.length; i++) {
            sqlquery += "select PDB_chain.PDB_ID, PDB_chain.Chain, 2D_Structure, SEQRES, Align_to_SEQRES, Alignment, Identity_Score, Resolution, Repeat_domains, Title from PDB_chain, PSSH2, PDB where protein_sequence_hash = '" + matches.uniprot_sequence_MD5_Hash[i] + "' AND E_value < 1e-10 AND PSSH2.PDB_chain_hash = PDB_chain.MD5_Hash AND PDB_chain.PDB_ID = PDB.PDB_ID ";
            for (j = 0; j < data.length; j++) {
               sqlquery += "AND PDB_chain.PDB_ID IN (select PDB_ID from PSSH2, PDB_chain where PSSH2.PDB_chain_hash = PDB_chain.MD5_Hash AND protein_sequence_hash = '" + matches.uniprot_sequence_MD5_Hash[j] + "') ";
            }
            if (i == data.length - 1) {
               // sqlquery += "ORDER BY Identity_Score DESC"; ??
            } else {
               sqlquery += "UNION ";
            }
         }
         connector.query(sqlquery, null, generate_clusters_multiple_uniprot, matches);
      }
	}
}

// cluster the results, populate with information and create a format to send into the 3d viewer
function generate_clusters(data, matches) {
	'use strict';
	try {
		
	   matches.elapsed = new Date().getTime() - matches.start_date;
	   logger.info("Time taken for query: " + matches.elapsed);
		var callback, pssh_id;
		var i;	// total number of structures found
		var n = data.length;
		var seqres_alignment, n_blocks, pssh_alignment, pssh_full_alignment, categorised, k, l;
		var n_cluster = -1;
		var pssh = {};
		var start_date = new Date().getTime();
		var elapsed;
		matches.clusters = [];
		if (n > 0) {
         logger.info(JSON.stringify(data, null, "\t"));
			for (i = 0; i < n; i += 1) { 
	         // storing the pssh entries for later use
	         pssh_id = data[i].PDB_ID + '-' + data[i].Chain + '-' + data[i].Repeat_domains;
	         pssh[pssh_id] = {};
	         pssh[pssh_id].pdb_id = data[i].PDB_ID;
	         pssh[pssh_id].pdb_chain = data[i].Chain;
	         pssh[pssh_id].Repeat_domains = data[i].Repeat_domains;
	         pssh[pssh_id].Alignment = data[i].Alignment;
	         pssh[pssh_id].alignment_identity_score = data[i].Identity_Score;
	         pssh[pssh_id].SEQRES = data[i].SEQRES;
	         pssh[pssh_id].Align_to_SEQRES = data[i].Align_to_SEQRES;
	         pssh[pssh_id]['2D_Structure'] = data[i]['2D_Structure'];
            pssh[pssh_id].Resolution = data[i].Resolution;
	
	         if (data[i]['2D_Structure'] == null || typeof data[i]['2D_Structure'] === 'undefined') {
	           logger.info("No structure  Pdb id = " + data[i].PDB_ID + "-"+data[i].Chain +" Skipping structure...");
	           continue;
	        }
	
	         if (pssh[pssh_id].Align_to_SEQRES == null) {
	            logger.info("SEQRES:PDB = null, pssh_id = " + pssh_id + " Skipping structure...");
	            continue;
	         }
	         if (pssh[pssh_id].Alignment == null) {
	            logger.info("Uniprot:SEQRES = null, pssh_id = " + pssh_id + " Skipping structure...");
	            continue;
	         }
	
	         // parse pssh alignment into structured object
	         seqres_alignment = read_alignment.PDB_alignment(pssh[pssh_id].Align_to_SEQRES);
	         if (matches.pssh1) {
	            pssh_alignment = read_alignment.PSSH_old_alignment(pssh[pssh_id].Alignment);
	            pssh_full_alignment = read_alignment.pssh_old_full_alignment(pssh_alignment, seqres_alignment);
	         } else {
	            pssh_alignment = read_alignment.PSSH_alignment(pssh[pssh_id].Alignment);
	            pssh_full_alignment = read_alignment.pssh_full_alignment(pssh_alignment, seqres_alignment);
	         }
            //seqres_alignment.print();
            //pssh_alignment.print();
	         pssh[pssh_id].pssh_full_alignment = pssh_full_alignment;
            //pssh[pssh_id].pssh_full_alignment.print();
	
	         n_blocks = pssh_full_alignment.n_blocks();
	         if (n_blocks === -1) {
	            logger.info("no blocks in alignment. Skipping structure");
	            continue;
	         }
	         pssh[pssh_id].seq_start = [];
	         pssh[pssh_id].seq_end = [];
	         for (k = 0; k <= n_blocks; k++) {
	            pssh[pssh_id].seq_start.push(pssh_full_alignment.get_block(k).sequence_start);
	            pssh[pssh_id].seq_end.push(pssh_full_alignment.get_block(k).sequence_end);
	         };
	
	         if (n_cluster === -1) {
	            // if there are currently no clusters, make a new one
	            n_cluster += 1;
	            matches.clusters[n_cluster] = {};
	            matches.clusters[n_cluster].members = [];
	            matches.clusters[n_cluster].members.push({"pdb_title": data[i].Title, "pdb_id": data[i].PDB_ID, "pdb_chain": [data[i].Chain], "Repeat_domains": [data[i].Repeat_domains], "alignment_identity_score": data[i].Identity_Score, "viewer_format": [pssh[pssh_id].pssh_full_alignment.generate_viewer_format(data[i].PDB_ID, data[i].Chain, matches.uniprot_primary_accession[0])], "Resolution": [pssh[pssh_id].Resolution] });
	            matches.clusters[n_cluster].seq_start = pssh[pssh_id].seq_start;
	            matches.clusters[n_cluster].seq_end = pssh[pssh_id].seq_end;
	            matches.clusters[n_cluster].alignment_identity_score = [pssh[pssh_id].alignment_identity_score];
	         } else {
	    				categorised = 0;
	            k = 0;
	            while (categorised === 0 && k <= n_cluster) {
	               // determine if the pssh entry fits in a cluster already made
	               if (isSameCluster(pssh[pssh_id].seq_start, pssh[pssh_id].seq_end, matches.clusters[k].seq_start, matches.clusters[k].seq_end) && categorised === 0) {
	                  // add to cluster if it matches
	                  matches.clusters[k].members.push({"pdb_title": data[i].Title, "pdb_id": data[i].PDB_ID, "pdb_chain": [data[i].Chain], "Repeat_domains": [data[i].Repeat_domains], "alignment_identity_score": data[i].Identity_Score, "viewer_format": [pssh[pssh_id].pssh_full_alignment.generate_viewer_format(data[i].PDB_ID, data[i].Chain, matches.uniprot_primary_accession[0])], "Resolution": [pssh[pssh_id].Resolution] });
	                  categorised = 1;
	               }
	               k += 1;
	            }
	            if (categorised === 0) {
	               // otherwise make a new cluster
	               n_cluster += 1;
	               matches.clusters[n_cluster] = {};
	               matches.clusters[n_cluster].members = [];
	               matches.clusters[n_cluster].members.push({"pdb_title": data[i].Title, "pdb_id": data[i].PDB_ID, "pdb_chain": [data[i].Chain], "Repeat_domains": [data[i].Repeat_domains], "alignment_identity_score": data[i].Identity_Score, "viewer_format": [pssh[pssh_id].pssh_full_alignment.generate_viewer_format(data[i].PDB_ID, data[i].Chain, matches.uniprot_primary_accession[0])], "Resolution": [pssh[pssh_id].Resolution] });
	               matches.clusters[n_cluster].seq_start = pssh[pssh_id].seq_start;
	               matches.clusters[n_cluster].seq_end = pssh[pssh_id].seq_end;
	               matches.clusters[n_cluster].alignment_identity_score = [pssh[pssh_id].alignment_identity_score];
	            }
	         }
			};
	      for (i = 0; i <= n_cluster; i += 1) {
	         // populate the clusters with information
	         matches.clusters[i].cluster_size = matches.clusters[i].members.length;
	         matches.clusters[i].pdb_id = matches.clusters[i].members[0].pdb_id;
	         matches.clusters[i].pdb_chain = matches.clusters[i].members[0].pdb_chain.slice(0);
	         matches.clusters[i].Repeat_domains = matches.clusters[i].members[0].Repeat_domains.slice(0);
	         pssh_id = matches.clusters[i].pdb_id + '-' + matches.clusters[i].pdb_chain[0] + '-' + matches.clusters[i].Repeat_domains[0];
	         // parse pssh alignment into structured object
	         pssh_full_alignment = pssh[pssh_id].pssh_full_alignment;
	         n_blocks = pssh_full_alignment.n_blocks();
	         if (n_blocks === -1) {
	            logger.info('Warning: pssh_alignment is empty for ' + pssh_id);
	         };
	         matches.clusters[i].secondary_structure = [];
	         matches.clusters[i].substitutions = {};
	         matches.clusters[i].conservationArray = [];
	         matches.clusters[i].conservationArray[0] = [];
	         matches.clusters[i].substitutions.conserved = [];
	         matches.clusters[i].substitutions.nonconserved = [];
	         matches.clusters[i].secondary_structure[0] = [];
	         matches.clusters[i].substitutions['conserved'][0] = [];
	         matches.clusters[i].substitutions['nonconserved'][0] = [];
	         // populate the secondary_structure and substitutions
	         get_cluster_info(pssh_full_alignment, matches.uniprot_sequence[0], pssh[pssh_id].SEQRES, pssh[pssh_id].Align_to_SEQRES, pssh[pssh_id]['2D_Structure'], i, matches, 0);
	
	         // determine the best PDB match to display first up
	         var residue_count = residuecount(matches.clusters[i].seq_start, matches.clusters[i].seq_end);
	         var identity = matches.clusters[i].alignment_identity_score[0];
	         var  score = residue_count * identity / 100;
	         if (i === 0) {
	            matches.Selected_PDB = {"pdb_id": matches.clusters[i].pdb_id, "pdb_chain": matches.clusters[i].pdb_chain.slice(0), "cluster_number": i, "match_score": score};
	         } else {
	            if (score > matches.Selected_PDB.match_score) {
	               matches.Selected_PDB = {"pdb_id": matches.clusters[i].pdb_id, "pdb_chain": matches.clusters[i].pdb_chain.slice(0), "cluster_number": i, "match_score": score};
	            }
	         }
	      }
	
	      callback = matches.callback;
	      matches.callback = '';
	      matches.date = new Date();
	      //logger.info(JSON.stringify(matches, null, "\t"));
	      callback(matches);
	      cache.write(matches.uniprot_primary_accession, matches);
		}
		else {
	    callback = matches.callback;
	    matches.callback = '';
	    //logger.info(JSON.stringify(matches, null, "\t"));
	    callback({});
		}
	}
	catch (err) {
		logger.error("matching_structures caught err: " + err);
    callback = matches.callback;
    matches.callback = '';
		callback({});
	}
}

function generate_clusters_multiple_uniprot(data, matches) {
	'use strict';
	var callback, pssh_id;
	var i;	// total number of structures found
	var j = 0; // number of structures without problems (e.g., failed seqres alignment)
	var n = data.length;
	var seqres_alignment, n_blocks, pssh_alignment, categorised, k;
	var n_pdb = -1;
	var n_cluster = -1;
	var n_uniprot = 0;
	var seq_start_location = 0;
	var l,m,doubleup,doubleup_uniprot;
	var pssh = {};
   var total_alignment_score;
	var start_date = new Date().getTime();
	var elapsed;
	matches.pdb = [];
	matches.clusters = [];
	if (n > 0) {
		for (i = 0; i < n; i += 1) {
         pssh_id = data[i].PDB_ID + '-' + data[i].Chain + '-' + data[i].Primary_Accession + '-' + data[i].Repeat_domains;
         pssh[pssh_id] = {};
         pssh[pssh_id].Primary_Accession = data[i].Primary_Accession;
         pssh[pssh_id].pdb_id = data[i].PDB_ID;
         pssh[pssh_id].pdb_chain = data[i].Chain;
         pssh[pssh_id].Repeat_domains = data[i].Repeat_domains;
         pssh[pssh_id].Alignment = data[i].Alignment;
         pssh[pssh_id].alignment_identity_score = data[i].Identity_Score;
         pssh[pssh_id].SEQRES = data[i].SEQRES;
         pssh[pssh_id].Align_to_SEQRES = data[i].Align_to_SEQRES;
         pssh[pssh_id]['2D_Structure'] = data[i]['2D_Structure'];

         // parse pssh alignment into structured object
         pssh_alignment = read_alignment.PSSH_alignment(pssh[pssh_id].Alignment);
         seqres_alignment = read_alignment.PDB_alignment(pssh[pssh_id].Align_to_SEQRES);
         pssh_full_alignment = read_alignment.pssh_full_alignment(pssh_alignment, seqres_alignment);
         pssh[pssh_id].pssh_full_alignment = pssh_full_alignment;

         n_blocks = pssh_alignment.n_blocks();
         if (n_blocks === -1) {
            logger.info('Warning: pssh_alignment is empty for ' + pssh_id);
         } else {
				pssh[pssh_id].seq_start = [];
				pssh[pssh_id].seq_end = [];
				for (k = 0; k <= n_blocks; k++) {
					pssh[pssh_id].seq_start.push(pssh_alignment.get_block(k).sequence_start);
					pssh[pssh_id].seq_end.push(pssh_alignment.get_block(k).sequence_end);
				};

            // group pdb chains with the same pdb id but are from different proteins (uniprot accession)
				if (n_pdb === -1) {
               // if no pdb object has been made yet, create a new one
					n_pdb += 1;
					matches.pdb[n_pdb] = {};
               matches.pdb[n_pdb].pdb_title = data[i].Title;
					matches.pdb[n_pdb].pdb_id = data[i].PDB_ID;
					matches.pdb[n_pdb].members = [];
					matches.pdb[n_pdb].members.push(data[i].Chain);
               matches.pdb[n_pdb].members_Repeat_domains = [];
               matches.pdb[n_pdb].members_Repeat_domains.push(data[i].Repeat_domains);
               matches.pdb[n_pdb].members_pssh_alignment = [];
               matches.pdb[n_pdb].members_pssh_alignment.push(data[i].Alignment);
               matches.pdb[n_pdb].members_pdb_alignment = [];
               matches.pdb[n_pdb].members_pdb_alignment.push(data[i].Align_to_SEQRES);
               matches.pdb[n_pdb].members_pssh_full_alignment = [];
               // *** NEED TO FIX THISSSS
               matches.pdb[n_pdb].members_pssh_full_alignment.push(pssh[pssh_id].pssh_full_alignment);
					matches.pdb[n_pdb].members_uniprot = [];
					matches.pdb[n_pdb].members_uniprot.push(data[i].Primary_Accession);
               matches.pdb[n_pdb].resolution = data[i].Resolution;
               matches.pdb[n_pdb].alignment_score = [];
               matches.pdb[n_pdb].alignment_score.push(residuecount(pssh[pssh_id].seq_start, pssh[pssh_id].seq_end) * data[i].Identity_Score / 100);
					matches.pdb[n_pdb].alignment_identity_score = [];
					matches.pdb[n_pdb].alignment_identity_score.push(data[i].Identity_Score);
					seq_start_location = 0;
					for (n_uniprot = 0; n_uniprot < matches.uniprot_primary_accession.length && pssh[pssh_id].Primary_Accession != matches.uniprot_primary_accession[n_uniprot]; n_uniprot++) {
						seq_start_location += matches.uniprot_sequence_length[n_uniprot - 1];
					}
					matches.pdb[n_pdb].seq_start = pssh[pssh_id].seq_start;
					matches.pdb[n_pdb].seq_end = pssh[pssh_id].seq_end;
					for (k = 0; k < matches.pdb[n_pdb].seq_start.length; k++) {
						matches.pdb[n_pdb].seq_start[k] += seq_start_location;
						matches.pdb[n_pdb].seq_end[k] += seq_start_location;
					}
				} else {
					categorised = 0;
					k = 0;
					while (k <= n_pdb) {
                  // check if the new pdb chain fits with previous
						if (pssh[pssh_id].pdb_id === matches.pdb[k].pdb_id) {
                     doubleup = 0;
                     for (l = 0; l < matches.pdb[k].members.length; l++) {
                        if (data[i].Chain === matches.pdb[k].members[l]) doubleup = 1;
                     }
                     doubleup_uniprot = 0;
                     for (l = 0; l < matches.pdb[k].members_uniprot.length; l++) {
                        if (data[i].Primary_Accession === matches.pdb[k].members_uniprot[l]) doubleup_uniprot = 1;
                     }
                     if (!doubleup && !doubleup_uniprot) {
						   	matches.pdb[k].members.push(data[i].Chain);
					   		matches.pdb[k].members_uniprot.push(data[i].Primary_Accession);
                        matches.pdb[k].members_Repeat_domains.push(data[i].Repeat_domains);
                        matches.pdb[n_pdb].members_pssh_alignment.push(data[i].Alignment);
                        matches.pdb[n_pdb].members_pdb_alignment.push(data[i].Align_to_SEQRES);
                        matches.pdb[n_pdb].members_pssh_full_alignment.push(pssh[pssh_id].pssh_full_alignment);
                        matches.pdb[k].alignment_score.push(residuecount(pssh[pssh_id].seq_start, pssh[pssh_id].seq_end) * data[i].Identity_Score / 100);
			   				matches.pdb[k].alignment_identity_score.push(data[i].Identity_Score);
		   					seq_start_location = 0;
	   						l = matches.pdb[k].seq_start.length;
   							matches.pdb[k].seq_start = matches.pdb[k].seq_start.concat(pssh[pssh_id].seq_start);
						   	matches.pdb[k].seq_end = matches.pdb[k].seq_end.concat(pssh[pssh_id].seq_end);
					   		for (n_uniprot = 0; n_uniprot < matches.uniprot_primary_accession.length && pssh[pssh_id].Primary_Accession != matches.uniprot_primary_accession[n_uniprot]; n_uniprot++) {
					   			seq_start_location += matches.uniprot_sequence_length[n_uniprot];
				   			}
			   				while (l < matches.pdb[k].seq_start.length) {
		   						matches.pdb[k].seq_start[l] += seq_start_location;
	   							matches.pdb[k].seq_end[l] += seq_start_location;
							   	l++;
						   	}
                        categorised = 1;
                     } else if (doubleup && !doubleup_uniprot) {
                        categorised = 0;
                     } else if (!doubleup && doubleup_uniprot) {
                        categorised = 0;
                     } else {
							   categorised = 1;
                     }

						}
						k += 1;
					}
					if (categorised === 0) {
						n_pdb += 1;
						matches.pdb[n_pdb] = {};
						matches.pdb[n_pdb].pdb_id = data[i].PDB_ID;
                  matches.pdb[n_pdb].pdb_title = data[i].Title;
						matches.pdb[n_pdb].members = [];
						matches.pdb[n_pdb].members.push(data[i].Chain);
                  matches.pdb[n_pdb].members_Repeat_domains = [];
                  matches.pdb[n_pdb].members_Repeat_domains.push(data[i].Repeat_domains);
                  matches.pdb[n_pdb].members_pssh_alignment = [];
                  matches.pdb[n_pdb].members_pssh_alignment.push(data[i].Alignment);
                  matches.pdb[n_pdb].members_pdb_alignment = [];
                  matches.pdb[n_pdb].members_pdb_alignment.push(data[i].Align_to_SEQRES);
                  matches.pdb[n_pdb].members_pssh_full_alignment = [];
                  matches.pdb[n_pdb].members_pssh_full_alignment.push(pssh[pssh_id].pssh_full_alignment);
						matches.pdb[n_pdb].members_uniprot = [];
						matches.pdb[n_pdb].members_uniprot.push(data[i].Primary_Accession);
                  matches.pdb[n_pdb].resolution = data[i].Resolution;
                  matches.pdb[n_pdb].alignment_score = [];
                  matches.pdb[n_pdb].alignment_score.push(residuecount(pssh[pssh_id].seq_start, pssh[pssh_id].seq_end) * data[i].Identity_Score / 100);
						matches.pdb[n_pdb].alignment_identity_score = [];
						matches.pdb[n_pdb].alignment_identity_score.push(data[i].Identity_Score);
						seq_start_location = 0;
                  n_uniprot = 0;

					   while (n_uniprot < matches.uniprot_primary_accession.length && pssh[pssh_id].Primary_Accession != matches.uniprot_primary_accession[n_uniprot]) {
               		seq_start_location += matches.uniprot_sequence_length[n_uniprot];
                     n_uniprot++;
						}
						matches.pdb[n_pdb].seq_start = pssh[pssh_id].seq_start;
						matches.pdb[n_pdb].seq_end = pssh[pssh_id].seq_end;
						for (k = 0; k < matches.pdb[n_pdb].seq_start.length; k++) {
							matches.pdb[n_pdb].seq_start[k] += seq_start_location;
							matches.pdb[n_pdb].seq_end[k] += seq_start_location;
						}
					}
				}
				j += 1;
			};
		};
	
      // determine the total alignment score for sorting
      for (i = 0; i < matches.pdb.length; i += 1) {
         matches.pdb[i].total_alignment_score = 0;
         for (k = 0; k < matches.pdb[i].alignment_score.length; k += 1) {
            matches.pdb[i].total_alignment_score += matches.pdb[i].alignment_score[k];
         }
         matches.pdb[i].pdb_alignment_identity_score = matches.pdb[i].total_alignment_score / residuecount(matches.pdb[i].seq_start, matches.pdb[i].seq_end);
      }
      i = 0;
      // remove any pdb object where there's fewer chains then there are proteins searched
      while (i < matches.pdb.length) {
         if (matches.pdb[i].members.length < matches.uniprot_primary_accession.length) {
            matches.pdb.splice(i, 1);
         } else {
            i++;
         }
      }
      n_pdb = matches.pdb.length;	
		multisort(matches.pdb, n_pdb);
      matches.pdb.sort(sortpdb);
		for (i = 0; i < n_pdb; i++) {
			if (n_cluster === -1) {
				n_cluster += 1;
            // clustering
				matches.clusters[n_cluster] = {};
				matches.clusters[n_cluster].members = [];
				matches.clusters[n_cluster].members.push({"pdb_title": matches.pdb[i].pdb_title, "pdb_id": matches.pdb[i].pdb_id, "pdb_chain": matches.pdb[i].members.slice(0), "uniprot": matches.pdb[i].members_uniprot.slice(0), "Repeat_domains": matches.pdb[i].members_Repeat_domains.slice(0), "pssh_alignment": matches.pdb[i].members_pssh_alignment.slice(0), "pdb_alignment": matches.pdb[i].members_pdb_alignment.slice(0), "viewer_format": matches.pdb[i].members_pssh_full_alignment.slice(0) });
				matches.clusters[n_cluster].seq_start = matches.pdb[i].seq_start;
				matches.clusters[n_cluster].seq_end = matches.pdb[i].seq_end;
				matches.clusters[n_cluster].alignment_identity_score = matches.pdb[i].alignment_identity_score.slice(0);
			   matches.clusters[n_cluster].total_alignment_score = matches.pdb[i].total_alignment_score;
			} else {
				categorised = 0;
				k = 0;
				while (categorised === 0 && k <= n_cluster) {
					if (isSameCluster(matches.pdb[i].seq_start, matches.pdb[i].seq_end, matches.clusters[k].seq_start, matches.clusters[k].seq_end) && categorised === 0) {
						matches.clusters[n_cluster].members.push({"pdb_title": matches.pdb[i].pdb_title, "pdb_id": matches.pdb[i].pdb_id, "pdb_chain": matches.pdb[i].members.slice(0), "uniprot": matches.pdb[i].members_uniprot.slice(0), "Repeat_domains": matches.pdb[i].members_Repeat_domains.slice(0), "pssh_alignment": matches.pdb[i].members_pssh_alignment.slice(0), "pdb_alignment": matches.pdb[i].members_pdb_alignment.slice(0), "viewer_format": matches.pdb[i].members_pssh_full_alignment.slice(0) });
						categorised = 1;
					}
					k += 1;
				}
				if (categorised === 0) {
               n_cluster += 1;
               matches.clusters[n_cluster] = {};
               matches.clusters[n_cluster].members = [];
               matches.clusters[n_cluster].members.push({"pdb_title": matches.pdb[i].pdb_title, "pdb_id": matches.pdb[i].pdb_id, "pdb_chain": matches.pdb[i].members.slice(0), "uniprot": matches.pdb[i].members_uniprot.slice(0), "Repeat_domains": matches.pdb[i].members_Repeat_domains.slice(0), "pssh_alignment": matches.pdb[i].members_pssh_alignment.slice(0), "pdb_alignment": matches.pdb[i].members_pdb_alignment.slice(0), "viewer_format": matches.pdb[i].members_pssh_full_alignment.slice(0) });
               matches.clusters[n_cluster].seq_start = matches.pdb[i].seq_start;
               matches.clusters[n_cluster].seq_end = matches.pdb[i].seq_end;
               matches.clusters[n_cluster].alignment_identity_score = matches.pdb[i].alignment_identity_score.slice(0);
               matches.clusters[n_cluster].total_alignment_score = matches.pdb[i].total_alignment_score;
            }
			}
		}
		for (k = 0; k <= n_cluster; k += 1) {
         // populating the clusters
			matches.clusters[k].cluster_size = matches.clusters[k].members.length;
			matches.clusters[k].pdb_id = matches.clusters[k].members[0].pdb_id;
			matches.clusters[k].pdb_chain = matches.clusters[k].members[0].pdb_chain.slice(0);
         matches.clusters[k].Repeat_domains = matches.clusters[k].members[0].Repeat_domains.slice(0);
			matches.clusters[k].uniprot = matches.clusters[k].members[0].uniprot.slice(0);
			matches.clusters[k].secondary_structure = [];
			matches.clusters[k].substitutions = {};
      matches.clusters[i].conservationArray = [];
			matches.clusters[k].substitutions['conserved'] = [];
			matches.clusters[k].substitutions['nonconserved'] = [];
			for (l = 0; l < matches.clusters[k].pdb_chain.length; l += 1) {
				matches.clusters[k].secondary_structure[l] = [];
	      matches.clusters[i].conservationArray[l] = [];
				matches.clusters[k].substitutions['conserved'][l] = [];
				matches.clusters[k].substitutions['nonconserved'][l] = [];
				pssh_id = matches.clusters[k].pdb_id + '-' + matches.clusters[k].pdb_chain[l] + '-' + matches.clusters[k].uniprot[l] + '-' + matches.clusters[k].Repeat_domains[l];
				// parse pssh alignment into structured object
				pssh_full_alignment = pssh[pssh_id].pssh_full_alignment; 
				n_blocks = pssh_full_alignment.n_blocks();
				if (n_blocks === -1) {
					logger.info('Warning: pssh_alignment is empty for ' + pssh_id);
				};
            for (n_uniprot = 0; n_uniprot < matches.uniprot_primary_accession.length && matches.clusters[k].uniprot[l] != matches.uniprot_primary_accession[n_uniprot]; n_uniprot++) {} 
            // populating secondary_structure, substitutions and alignment arrays
				get_cluster_info(pssh_full_alignment, matches.uniprot_sequence[n_uniprot], pssh[pssh_id].SEQRES, pssh[pssh_id].Align_to_SEQRES, pssh[pssh_id]['2D_Structure'], k, matches, l);
			};
         // make pointers to uniprot accession, sequence and features
         matches.clusters[k].uniprot_accession = matches.uniprot_primary_accession;
         matches.clusters[k].uniprot_sequence = matches.uniprot_sequence;
         matches.clusters[k].uniprot_features = matches.uniprot_sequence_features;
         // determine the best matches
			if (k === 0) {
				matches.Selected_PDB = {"pdb_id": matches.clusters[k].pdb_id, "pdb_chain": matches.clusters[k].pdb_chain.slice(0), "cluster_number": k, "match_score": matches.clusters[k].total_alignment_score };
			} else {
				if (matches.clusters[k].total_alignment_score > matches.Selected_PDB.match_score) {
					matches.Selected_PDB = {"pdb_id": matches.clusters[k].pdb_id, "pdb_chain": matches.clusters[k].pdb_chain.slice(0), "cluster_number": k, "match_score": matches.clusters[k].total_alignment_score};
				}
			}
		};
		callback = matches.callback;
		matches.callback = '';
		matches.date = new Date();
		elapsed = new Date().getTime() - start_date;

		logger.info('Elapsed time: ' + elapsed + '\n');
		
		//logger.info(JSON.stringify(matches.clusters, null, "\t"));
		callback(matches);// <- switch on to embed in page
		// store in cache
		cache.write(matches.uniprot_primary_accession.join('+'), matches);
	}
}
// counts the number of residues in an alignment
function residuecount(seq_start, seq_end) {
	var i;
	var seqLen = 0;
	for (i = 0; i < seq_start.length; i++) {
		seqLen += (seq_end[i] - seq_start[i] + 1);
	};
	return seqLen;
}


// determines whether two alignments belong in the same cluster based on number of residues that overlap
// returns 1 for if in the same cluster and 0 if not.
function isSameCluster(input_seq_start, input_seq_end, input_cluster_seq_start, input_cluster_seq_end) {
	// copy arrays so they can be modified
	var seq_start = input_seq_start.slice(0);
	var seq_end = input_seq_end.slice(0);
	var cluster_seq_start = input_cluster_seq_start.slice(0);
	var cluster_seq_end = input_cluster_seq_end.slice(0);

	var n = cluster_seq_start.length;
	var seqLen = 0;
	var cluster_seqLen = 0;
	var large_seqLen;
	var overlap_count = 0;
	var overlap_start = 0;
	var overlap_end = 0;
	var i = 0;
	var j = 0;
	var answer = 0;

   var cluster_total_length = cluster_seq_end[cluster_seq_end.length - 1] - cluster_seq_start[0];
   var boundary = 5 / 100 * cluster_total_length;
   if (cluster_seq_start[0] - boundary > seq_start[0]) return 0;
   if (cluster_seq_end[cluster_seq_end.length - 1] + boundary < seq_end[seq_end.length - 1]) return 0;
	
	for (j = 0; j < seq_start.length; j++) {
		seqLen += (seq_end[j] - seq_start[j] + 1);
	};
	for (j = 0; j < cluster_seq_start.length; j++) {
		cluster_seqLen += (cluster_seq_end[j] - cluster_seq_start[j] + 1);
	};


	while (seq_start.length != 0) {
		while (seq_start[0] > cluster_seq_end[i] && seq_end[0] > cluster_seq_end[i] && i < n) {
			i++;
		}

		if (i != n) { // if there exists the possibility of overlap
			// the following if statement assures that there definitely is an overlap
			if (!(seq_start[0] < cluster_seq_start[i] && seq_end[0] < cluster_seq_start[i])) {
				if (seq_start[0] < cluster_seq_start[i]) {
					overlap_start = cluster_seq_start[i];
				} else {
					overlap_start = seq_start[0];
				};
				if (seq_end[0] > cluster_seq_end[i]) {
					overlap_end = cluster_seq_end[i];
					seq_start[0] = overlap_end + 1;
				} else {
					overlap_end = seq_end[0];
					seq_start.shift();
					seq_end.shift();
				};
				// add up number of residues that overlap
				overlap_count += (overlap_end - overlap_start + 1);
			} else {
				// move onto next block
				seq_start.shift();
				seq_end.shift();
			};
		} else {
			// absolutely no (further) overlap
			seq_start.splice(0, seq_start.length);
			seq_end.splice(0, seq_end.length);
		};
	};

	if (seqLen > cluster_seqLen) {
		large_seqLen = seqLen;
	} else {
		large_seqLen = cluster_seqLen;
	}
	// threshold: 0.8
	if (overlap_count / large_seqLen > 0.8) {
		answer = 1;
	}
   
	return answer;

}

// used for multi uniprot input
// sorts the seq_start and seq_end arrays into ascending order
function multisort(pdb, n_pdb) {
   //var gather=[];
   var i; 
   //var feedIterator;
	for (i = 0; i < n_pdb; i++) {
      //gather=[];
		pdb[i].seq_start.sort(function(a,b){return a - b});
		pdb[i].seq_end.sort(function(a,b){return a - b});
      
	}
}

// sorts the pdb alignments first by identity score and then by resolution
function sortpdb(a,b) {
   var i1 = a.pdb_alignment_identity_score;
   var i2 = b.pdb_alignment_identity_score;
   var r1 = a.resolution;
   var r2 = b.resolution;
   if (i1 != i2) {
      return i2 - i1;
   } else {
      return r1 - r2;
   }
}



// populate the cluster with secondary structure and conservation
function get_cluster_info(pssh_full_alignment, uniprot_sequence, SEQRES, seqres_alignment, secondary_structure, i, matches, l) {
	'use strict';
	var alignment, conservation, n_blocks, previous_type, pssh_block;
   var start = 0;
   var type = false;
   var seqres_to_pdb_block = {};
	var uniprot = {};
	var seqres = {};

   seqres_alignment = read_alignment.PDB_alignment(seqres_alignment);

	uniprot.i_block = 0;																// current block number in uniprot:pdb alignment
	seqres.i_residue = 0;																// current residue number in seqres
	seqres.i_residue_previous = 0;														// previous non-gap residue number in seqres
   seqres_to_pdb_block.i_residue = 0;

   // getting secondary structure alignment
   secondary_structure = read_alignment.secondary_structure_alignment(secondary_structure, seqres_alignment);
   var current_secondary_structure = null;

	pssh_block = pssh_full_alignment.get_block(uniprot.i_block);
	while (pssh_block) {
		// step through each uniprot:seqres block
		//uniprot.i_block < n_pssh_blocks;
		uniprot.i_residue = pssh_block.sequence_start;				// current residue number in uniprot sequence
      seqres.i_residue = pssh_block.seqres_start;
		while (uniprot.i_residue < pssh_block.sequence_end) {
         // step through each residue in the current uniprot:seqres block 
         uniprot.residue = uniprot_sequence.charAt(uniprot.i_residue - 1);
         seqres.residue = SEQRES.charAt(seqres.i_residue - 1);
         conservation = conservation_score(uniprot.residue, seqres.residue);
         matches.clusters[i].conservationArray[l][uniprot.i_residue] = conservation;
         if (conservation && conservation !== 'identical') {
        	 
            matches.clusters[i].substitutions[conservation][l].push(uniprot.i_residue);
         };
         if (current_secondary_structure === null) {
            current_secondary_structure = secondary_structure.find_secondary_structure(seqres.i_residue);
            if (current_secondary_structure) {
              type = current_secondary_structure.type;
              start = uniprot.i_residue;
            }
            else {
            	current_secondary_structure = null;
            }
         } else {
            if (current_secondary_structure.seqres_end && seqres.i_residue > current_secondary_structure.seqres_end) {
               // move onto next secondary structure
               matches.clusters[i].secondary_structure[l].push({'type':type, 'start':start, 'end':uniprot.i_residue_previous});
               current_secondary_structure = secondary_structure.find_secondary_structure(seqres.i_residue);
               if (current_secondary_structure) {
                 type = current_secondary_structure.type;
                 start = uniprot.i_residue;
               }
            }
         }
         uniprot.i_residue_previous = uniprot.i_residue;
			uniprot.i_residue += 1;
			seqres.i_residue += 1;
		};

      // save the last secondary structure element
      if (type) {matches.clusters[i].secondary_structure[l].push({'type':type, 'start':start, 'end':uniprot.i_residue_previous})};
      type = false;
      current_secondary_structure = null;
		uniprot.i_block += 1;
		pssh_block = pssh_full_alignment.get_block(uniprot.i_block);
	};

	return;
}

