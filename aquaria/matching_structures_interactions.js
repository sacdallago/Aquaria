var connector = require('../common/connector');
//var cache = require('./cache');
//cache = cache.cache();

//
// These functions take a UniProt Primary_Accession as input, and return all related 3D structures.
//  Structures are clustered by alignment region, then ranked using the alignment identity score.
//
// Authors: Sean O'Donoghue & Vivian Ho
//

// Still to-do:
// * Clustering & calculation of secondary structure should be done in a separate thread by launching a child process
// 			See http://nodejs.org/api/child_process.html
// * The code could probably be simplified using a package such as 'async' (See https://github.com/caolan/async)


// Begin Vivian's functions
function residuecount(seq_start, seq_end) {
	var i;
	var seqLen = 0;
	for (i = 0; i < seq_start.length; i++) {
		seqLen += (seq_end[i] - seq_start[i] + 1);
	};
	return seqLen;
}


function common_match2(input_seq_start, input_seq_end, input_cluster_seq_start, input_cluster_seq_end) {
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

//http://www.fullposter.com/snippets.php?snippet=1
function multisort(pdb, n_pdb) {
   //var gather=[];
   var i; 
   //var feedIterator;
	for (i = 0; i < n_pdb; i++) {
      //gather=[];
		pdb[i].seq_start.sort(function(a,b){return a - b});
		pdb[i].seq_end.sort(function(a,b){return a - b});
		/*pdb[i].members_uniprot_ordered.sort(
         function(a,b) {
            var copyA = a; var copyB = b;
            return gather[++gather.length-1] = (copyA<copyB)?-1:(copyA>copyB)?1:0
         }
      );
      feedIterator=0;
      pdb[i].members.sort(
         function(a,b) {
            return gather[feedIterator++];
         }
      );
      feedIterator=0;
      pdb[i].members_uniprot.sort(
         function(a,b) {
            return gather[feedIterator++];
         }
      );
      feedIterator=0;
      pdb[i].alignment_score.sort(
         function(a,b) {
            return gather[feedIterator++];
         }
      );
      feedIterator=0;
      pdb[i].alignment_identity_score.sort(
         function(a,b) {
            return gather[feedIterator++];
         }
      );*/
      
	}
}

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
   //return b.pdb_alignment_identity_score - a.pdb_alignment_identity_score;
}
// end Vivian's functions

var read_alignment = (function (alignment) {
	// Uses Douglas Crockford's module pattern
	// See http://ajaxian.com/archives/a-javascript-module-pattern
	'use strict';
	var code_message, hash, j, line, pdb_residue_number;
	var i = 0;
	var i_block = -1;
	var n_blocks;
	var blocks = [];
	var string_length = alignment.length;
	while (i < string_length) {
		j = alignment.indexOf("\n", i);
		if (j === -1) {j = string_length}; // when only one block, set j to length of alignment
		line = alignment.substr(i, j-i);
		if (line.match(/^(\d+)-(\d+):(-?\w+)-(-?\w+)$/)) {
			i_block += 1;
			blocks[i_block] = {};
			blocks[i_block].sequence_start = Number(RegExp.$1);
			blocks[i_block].sequence_end = Number(RegExp.$2);
			// leave PDB residue numbers as string to allow for insertion codes
			blocks[i_block].pdb_start = RegExp.$3;
			blocks[i_block].pdb_end = RegExp.$4;
			//console.log('\ti_block = ' + i_block);
		} else if (line.match(/^(\d+):(-?\w+)$/)) {
			i_block += 1;
			blocks[i_block] = {};
			blocks[i_block].sequence_start = Number(RegExp.$1);
			blocks[i_block].sequence_end = Number(RegExp.$1);
			// leave PDB residue number as string to allow for insertion code
			pdb_residue_number = RegExp.$2;
			blocks[i_block].pdb_start = pdb_residue_number;
			blocks[i_block].pdb_end = pdb_residue_number;
			if (pdb_residue_number.match(/[^\d]$/)) {
				code_message =': insertion code at residue ' + pdb_residue_number;
				if (typeof hash === 'undefined') {hash = {}};
				hash[pdb_residue_number] = parseInt(RegExp.$1, 10);
			};				
			console.log('\t\ti_block = ' + i_block + code_message);
		}
		i = j+1;
	}
	n_blocks = i_block;
	//console.log('\t\ttotal blocks found = ' + (n_blocks + 1));
	
	return {
		n_blocks: function () {
			return n_blocks;
		},
		find_pdb_residue: function (pdb_residue_number, i_block) {
			//
			// Given a pdb residue number as input, finds corresponding residue number in seqres
			//
			// console.log('\t\tCalling find_pdb_residue = (' + pdb_residue_number + ', ' + i_block, ')');
			'use strict';
			var block_start_pdb, block_end_pdb;
			var response = {};		
			if (typeof residue_number === 'string') {
				if (residue_number.match(/[^\d]$/)) {
					// if pdb residue number contains an insertion code, look up seqres number in hash
					if (residue_number in hash) {
						console.log('pdb residue number ' + residue_number + ' contains an insertion code');
						response.i_residue = hash[residue_number.toString()];
						response.i_block = i_block;
						response.block_start = response.i_residue;
						response.block_end = response.i_residue;
						response.gap = false;
						return response;
					} else {
						console.log("Warning: couldn't find seqres position for pdb residue number " + residue_number);
						response.i_residue = ' ';
						response.i_block = i_block;
						response.gap = true;
						return response;
					}
				} else {
					residue_number = Number(residue_number);
				}
			}
			// console.log('\t\tthe pdb residue number does not contain an insertion code; now find seqres block');
			if (i_block === undefined || i_block === false) {i_block = 0};
			response.block_start = blocks[i_block].sequence_start;
			response.block_end = blocks[i_block].sequence_end;
			block_end_pdb = blocks[i_block].pdb_end;
			//console.log('\t\tblock=' + i_block + ', start=' + blocks[i_block].sequence_start + ', end=' + blocks[i_block].sequence_end);
			if (block_end_pdb.match(/[^\d]$/) || pdb_residue_number > Number(block_end_pdb)) {
				// if block_end_pdb contains insertion code, skip to next block (since residue_number must not contain insertion)
				i_block += 1;
				if (i_block <= n_blocks) {
					//console.log("\t\tTrying next seqres block (" + i_block + '/' + n_blocks + ')');
					return this.find_pdb_residue(pdb_residue_number, i_block);
				} else {
					//console.log('\t\tPDB residue number ' + pdb_residue_number + ' occurs after last seqres block');
					response.i_block = false;
					response.gap = true;
					response.i_residue = ' ';
					return response;
				};
			};
			response.i_block = i_block;
			// next block (if it exists) cannot contain insertions
			block_end_pdb = Number(block_end_pdb);
			block_start_pdb = Number(blocks[i_block].pdb_start);
			if (pdb_residue_number >= block_start_pdb && pdb_residue_number <= block_end_pdb) {
				response.i_residue = pdb_residue_number - block_start_pdb + response.block_start;
				response.gap = false;
				//console.log('\t\tPDB residue ' + pdb_residue_number + ' mapped onto SEQRES residue ' + response.i_residue + '; SEQRES block=' + i_block + ', start=' + response.block_start + ', end=' + response.block_end);
				return response;
			} else if (pdb_residue_number < block_start_pdb) {
				//console.log('\t\tPDB residue number ' + pdb_residue_number + ' occurs in seqres gap');
				// response.i_residue = ' '; can probably work out a residue number, but shouldn't have to
				response.gap = true;
				return response;
			};
			//console.log('Warning: find_pdb_residue failed to find residue ' + pdb_residue_number);
		},
		find_next_block: function (seqres) {
			//
			// given a seqres residue position, find the next seqres block where the end comes after residue_number
			//
			'use strict';
			var i_block = seqres.i_block;
			var i_residue = seqres.i_residue;
			if (i_block === undefined) {i_block = 0};
			if (i_block < n_blocks) {
				i_block += 1;
				seqres.i_block = i_block;
				seqres.block_start = blocks[i_block].sequence_start;
				seqres.block_end = blocks[i_block].sequence_end;
				seqres.i_residue = i_residue;
				if (i_residue >=  seqres.block_start && i_residue <= seqres.block_end) {
					//console.log('\tNew seqres block; start=' + seqres.block_start + ', end=' + seqres.block_end);
					seqres.gap = false;
					return seqres;
				} else if (i_residue > seqres.block_end) {
					//console.log("\t\tTrying next block (" + i_block + '/' + n_blocks + ')');
					this.find_next_block(seqres);
				} else if (i_residue < seqres.block_end) {
					//console.log('\t\tSEQRES number ' + i_residue + ' occurs in seqres gap');
					seqres.gap = true;
					return seqres;
				};
			} else {
				//console.log('\t\tSEQRES number ' + i_residue + ' occurs after last seqres block');
				seqres.i_residue = ' ';
				seqres.i_block = false;
				return seqres;
			}
		},
		get_block: function (i_block) {
			// console.log('\t\tCalling get_block=' + i_block);
			//
			// returns details for block number = i_block
			//
			'use strict';
			if (i_block === undefined) {i_block = 0};
			// console.log('\t\tGet block=' + i_block + ', n_block=' + n_blocks);
			if (i_block <= n_blocks) {
				return {sequence_start: blocks[i_block].sequence_start, sequence_end: blocks[i_block].sequence_end, pdb_start: blocks[i_block].pdb_start, pdb_end: blocks[i_block].pdb_end};
			} else {
				return false;
			}
		},	
		sequence_start: function () {
			return seq_start;
		},

		sequence_end: function () {
			return seq_end;
		},
			
		convert_to_SRS3D_format: function (pdb_id, pdb_chain, primary_accession) {
			'use strict';
			var output, pdb_start, pdb_start_insertion, pdb_end, pdb_end_insertion;
			output = '';
			// Example containing insertion codes: trypsin - http://aquaria.ws:8009/P00763
			// 3btw:E:117: :221:A,P00763:122:221; <== 117-221A:122-221
			for (i_block = 0; i_block <= n_blocks; i_block += 1) {
				pdb_start = blocks[i_block].pdb_start;
				if (pdb_start.match(/^(\d+)([^\d])$/)) {
					pdb_start = RegExp.$1;
					pdb_start_insertion = RegExp.$2;
				} else {
					pdb_start_insertion = ' ';
				}
				pdb_end = blocks[i_block].pdb_end;
				if (pdb_end.match(/^(\d+)([^\d])$/)) {
					pdb_end = RegExp.$1;
					pdb_end_insertion = RegExp.$2;
				} else {
					pdb_end_insertion = ' ';
				}
				if (output !== '') {output += '\n'};
				output += pdb_id + ':' + pdb_chain + ':' + pdb_start + ':' + pdb_start_insertion + ':' + pdb_end + ':' + pdb_end_insertion + ',' + primary_accession + ':' + blocks[i_block].sequence_start + ':' + blocks[i_block].sequence_end + ';';				
			}
			return output;
		}
	};
});

module.exports.get_interaction_number = function(uniprot_primary_accession, callback){
	'use strict';
	var matches /*= cache.read(uniprot_primary_accession)*/;
	var i, sqlquery;

	
	if (! matches) {
		matches = {};
		matches.callback = callback;
		matches.uniprot_primary_accession = uniprot_primary_accession.slice(0);
      //matches.uniprot_primary_accession_ordered = uniprot_primary_accession.slice(0);
		sqlquery = "SELECT Primary_Accession, Sequence, Features, Description, Length FROM protein_sequence WHERE (";
		for (i = 0; i < matches.uniprot_primary_accession.length; i++) {
			sqlquery += "Primary_Accession = '" + matches.uniprot_primary_accession[i] + "' ";
			if (i == matches.uniprot_primary_accession.length - 1) {
				sqlquery += ")";
			} else {
				sqlquery += "OR ";
			}
		}
		console.log(sqlquery);
		connector.query(sqlquery, 1,get_uniprot_sequence3, matches);
	
	} else {
      console.log('HELLOHELLOHELLO');
		//console.log(JSON.stringify(matches, null, "\t"));
		callback(matches);// <- switch on to embed in page
	};
	return;
}

// 2nd callback function for input of 2 Uniprot accession numbers
function get_interaction (data, matches) {
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
	// sort matching structures from highest to lowest identity score
	//data.sort(function(a,b) {return b.Identity_Score - a.Identity_Score});
	var pssh = {};
   var total_alignment_score;
	var start_date = new Date().getTime();
	var elapsed;
	matches.pdb = [];
	matches.clusters = [];
	if (n > 0) {
		for (i = 0; i < n; i += 1) {
			//console.log('PDB ' + data[i].PDB_ID + '-' + data[i].Chain + ' (' + data[i].Identity_Score + '% identity to ' + matches.uniprot_primary_accession + ')');
			seqres_alignment = data[i].Align_to_SEQRES;
			// console.log('seqres_alignment = ' + seqres_alignment);
			if (seqres_alignment === null || seqres_alignment.match(/^\s*$/)) {
				//console.log('Warning: null SEQRES alignment for PDB ' + data[i].Align_to_SEQRES);
			} else {
				// console.log("PDB " + data[i].PDB_ID + '-' + data[i].Chain + ' (' + data[i].Identity_Score + '% identity to ' + matches.uniprot_primary_accession + ')\n');
            //console.log(data[i].Primary_Accession);
				pssh_id = data[i].PDB_ID + '-' + data[i].Chain + '-' + data[i].Primary_Accession;
				pssh[pssh_id] = {};
				pssh[pssh_id].Primary_Accession = data[i].Primary_Accession;
				pssh[pssh_id].pdb_id = data[i].PDB_ID;
				pssh[pssh_id].pdb_chain = data[i].Chain;
				pssh[pssh_id].alignment_identity_score = data[i].Identity_Score;
            pssh[pssh_id].Alignment = data[i].Alignment;
				pssh[pssh_id]['2D_Structure'] = data[i]['2D_Structure'];

				// parse pssh alignment into structured object
				pssh_alignment = read_alignment(pssh[pssh_id].Alignment);
				n_blocks = pssh_alignment.n_blocks();
				//console.log('Structure ' + pssh_id + ' contains ' + n_blocks + ' pssh blocks');
				if (n_blocks === -1) {
					console.log('Warning: pssh_alignment is empty for ' + pssh_id);
				};
				pssh[pssh_id].seq_start = [];
				pssh[pssh_id].seq_end = [];
				for (k = 0; k <= n_blocks; k++) {
					pssh[pssh_id].seq_start.push(pssh_alignment.get_block(k).sequence_start);
					pssh[pssh_id].seq_end.push(pssh_alignment.get_block(k).sequence_end);
				};
				//console.log(pssh[pssh_id]);

				if (n_pdb === -1) {
					n_pdb += 1;
					//console.log('Starting cluster number ' + n_cluster + ' based on pdb ' + pssh_id);
					matches.pdb[n_pdb] = {};
					matches.pdb[n_pdb].pdb_id = data[i].PDB_ID;
					matches.pdb[n_pdb].members = [];
					matches.pdb[n_pdb].members.push(data[i].Chain);
					matches.pdb[n_pdb].members_uniprot = [];
					matches.pdb[n_pdb].members_uniprot.push(data[i].Primary_Accession);
               //matches.pdb[n_pdb].members_uniprot_ordered = [];
					//for (n_uniprot = 0; n_uniprot < matches.uniprot_primary_accession_ordered.length && pssh[pssh_id].Primary_Accession != matches.uniprot_primary_accession_ordered[n_uniprot]; n_uniprot++) {}
               //matches.pdb[n_pdb].members_uniprot_ordered.push(n_uniprot);
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
					   		//for (n_uniprot = 0; n_uniprot < matches.uniprot_primary_accession_ordered.length && pssh[pssh_id].Primary_Accession != matches.uniprot_primary_accession_ordered[n_uniprot]; n_uniprot++) {}
                        //matches.pdb[k].members_uniprot_ordered.push(n_uniprot);
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
						//console.log('Starting cluster number ' + n_cluster + ' based on pdb ' + pssh_id);
						matches.pdb[n_pdb] = {};
						matches.pdb[n_pdb].pdb_id = data[i].PDB_ID;
						matches.pdb[n_pdb].members = [];
						matches.pdb[n_pdb].members.push(data[i].Chain);
						matches.pdb[n_pdb].members_uniprot = [];
						matches.pdb[n_pdb].members_uniprot.push(data[i].Primary_Accession);
                  //matches.pdb[n_pdb].members_uniprot_ordered = [];
					   //for (n_uniprot = 0; n_uniprot < matches.uniprot_primary_accession_ordered.length && pssh[pssh_id].Primary_Accession != matches.uniprot_primary_accession_ordered[n_uniprot]; n_uniprot++) {}
                  //matches.pdb[n_pdb].members_uniprot_ordered.push(n_uniprot);
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
	
      for (i = 0; i < matches.pdb.length; i += 1) {
         matches.pdb[i].total_alignment_score = 0;
         for (k = 0; k < matches.pdb[i].alignment_score.length; k += 1) {
            matches.pdb[i].total_alignment_score += matches.pdb[i].alignment_score[k];
         }
         matches.pdb[i].pdb_alignment_identity_score = matches.pdb[i].total_alignment_score / residuecount(matches.pdb[i].seq_start, matches.pdb[i].seq_end);
      }
      i = 0;
      while (i < matches.pdb.length) {
         if (matches.pdb[i].members.length < matches.uniprot_primary_accession.length) {
            matches.pdb.splice(i, 1);
         } else {
            i++;
         }
      }
      n_pdb = matches.pdb.length;	
      matches.pdb.sort(sortpdb);
      if (matches.pdb.length === 0) {
         matches.result = 0;
      } else {
         matches.result = matches.pdb[0].alignment_identity_score[0] / 100;
         for (i = 1; i < matches.pdb[0].alignment_identity_score.length; i++) {
            matches.result *= matches.pdb[0].alignment_identity_score[i] / 100;
         }
      }
		//console.log(matches.pdb);
	} else {
      matches.result = 0;
   }
   //callback = matches.callback;
	//matches.callback = '';
	matches.date = new Date();
	elapsed = new Date().getTime() - start_date;

	console.log('Elapsed time: ' + elapsed + '\n');
	console.log('Result: ' + matches.result + '\n');	
   var returnString = matches.result + '';
   matches.callback.writeHead(200, { 'Content-Type': 'plain/text', 'Content-Length': returnString.length });
   matches.callback.write(returnString);
	//console.log(JSON.stringify(matches, null, "\t"));
	//callback(matches);// <- switch on to embed in page
   //return matches;
	// store in cache
	//cache.write(matches.uniprot_primary_accession, matches);
}

// 1st callback function for input of 2 Uniprot accession numbers
function get_uniprot_sequence3(data, matches) {
	'use strict';
	var output;
	var i, j;
	var sqlquery = "";
	matches.uniprot_primary_accession = [];
	matches.uniprot_sequence = [];
	matches.uniprot_sequence_length = [];
	matches.uniprot_sequence_features = [];
	matches.uniprot_sequence_description = [];
	if (data.length > 0) {
		for (i = 0; i < data.length; i++) {
			matches.uniprot_primary_accession[i] = data[i].Primary_Accession;
			matches.uniprot_sequence[i] = data[i].Sequence;
			matches.uniprot_sequence_length[i] = data[i].Length;
			matches.uniprot_sequence_features[i] = data[i].Features;
			matches.uniprot_sequence_description[i] = data[i].Description;
		}
		for (i = 0; i < data.length; i++) {
			console.log("Uniprot_sequence = " + matches.uniprot_sequence[i] + "\n");
		}
		// generate SQL query
		for (i = 0; i < data.length; i++) {
			sqlquery += "select PDB_chain.PDB_ID, PDB_chain.Chain, 2D_Structure, SEQRES, Align_to_SEQRES, Alignment, Identity_Score, Primary_Accession from PDB_chain, PSSH where Primary_Accession = '" + matches.uniprot_primary_accession[i] + "' AND PSSH.PDB_ID = PDB_chain.PDB_ID AND PSSH.PDB_chain = PDB_chain.Chain ";
			for (j = 0; j < data.length; j++) {
				sqlquery += "AND PSSH.PDB_ID IN (select PDB_ID from PSSH where Primary_Accession = '" + matches.uniprot_primary_accession[j] + "') ";
			}
			if (i == data.length - 1) {
				// sqlquery += "ORDER BY Identity_Score DESC"; ??
			} else {
				sqlquery += "UNION ";
			}
		}
		
		console.log(sqlquery);
		connector.query(sqlquery, 1, get_interaction, matches);
		
	}
}
