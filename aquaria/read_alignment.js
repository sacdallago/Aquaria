var logger = require('../common/log');

// reads in a seqres:pdb alignment and returns information in blocks
module.exports.PDB_alignment = (function (alignment) {
	// Uses Douglas Crockford's module pattern
	// See http://ajaxian.com/archives/a-javascript-module-pattern
	'use strict';
	var hash, j, line, pdb_residue_number;
	var i = 0;
	var i_block = -1;
	var n_blocks;
	var blocks = [];
	var string_length = alignment.length;
	while (i < string_length) {
		j = alignment.indexOf("\n", i);
	      if (j === -1) {
		 j = alignment.indexOf(" ", i);
		 if (j === -1) {j = string_length}; // when only one block, set j to length of alignment
	      }
		line = alignment.substr(i, j-i);
		if (line.match(/^(\d+)-(\d+):(-?\w+)-(-?\w+)$/)) {
			i_block += 1;
			blocks[i_block] = {};
			blocks[i_block].seqres_start = Number(RegExp.$1);
			blocks[i_block].seqres_end = Number(RegExp.$2);
			// leave PDB residue numbers as string to allow for insertion codes
			blocks[i_block].pdb_start = RegExp.$3;
			blocks[i_block].pdb_end = RegExp.$4;
		} else if (line.match(/^(\d+):(-?\w+)$/)) {
			i_block += 1;
			blocks[i_block] = {};
			blocks[i_block].seqres_start = Number(RegExp.$1);
			blocks[i_block].seqres_end = Number(RegExp.$1);
			// leave PDB residue number as string to allow for insertion code
			pdb_residue_number = RegExp.$2;
			blocks[i_block].pdb_start = pdb_residue_number;
			blocks[i_block].pdb_end = pdb_residue_number;
			if (pdb_residue_number.match(/[^\d]$/)) {
				if (typeof hash === 'undefined') {hash = {}};
				hash[pdb_residue_number] = parseInt(RegExp.$1, 10);
			};				
		}
		i = j+1;
	}
	n_blocks = i_block;
   //logger.info(JSON.stringify(blocks, null, "\t"));
	
	return {
      print: function () {
         logger.info("PDB atom to seqres");
//         logger.info(JSON.stringify(blocks, null, "\t"));
      },
		n_blocks: function () {
         // NOTE: n_blocks means the nth block. The number of blocks is n_blocks + 1
			return n_blocks;
		},
		find_seqres_residue: function (pdb_residue_number, i_block) {
			//
			// Given a pdb residue number as input, finds corresponding residue number in seqres
			//
			'use strict';
			var block_start_pdb, block_end_pdb;
			var response = {};		
			if (typeof pdb_residue_number === 'string') {
				if (pdb_residue_number.match(/[^\d]$/)) {
					// if pdb residue number contains an insertion code, look up seqres number in hash
					if (hash && pdb_residue_number in hash) {
						response.i_residue = hash[pdb_residue_number.toString()];
						response.i_block = i_block;
						response.block_start = response.i_residue;
						response.block_end = response.i_residue;
						response.gap = false;
						return response;
					} else {
						response.i_residue = ' ';
						response.i_block = i_block;
						response.gap = true;
						return response;
					}
				} else {
					pdb_residue_number = Number(pdb_residue_number);
				}
			}
			if (i_block === undefined || i_block === false) {i_block = 0};
			response.block_start = blocks[i_block].seqres_start;
			response.block_end = blocks[i_block].seqres_end;
			block_end_pdb = blocks[i_block].pdb_end;
			if (block_end_pdb.match(/[^\d]$/) || pdb_residue_number > Number(block_end_pdb)) {
				// if block_end_pdb contains insertion code, 
            // skip to next block (since residue_number must not contain insertion)
				i_block += 1;
				if (i_block <= n_blocks) {
					return this.find_seqres_residue(pdb_residue_number, i_block);
				} else {
					response.i_block = -1;
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
				return response;
			} else if (pdb_residue_number < block_start_pdb) {
				response.i_residue = ' '; //can probably work out a residue number, but shouldn't have to
				response.gap = true;
				return response;
			};
		},
      find_pdb_residue: function (seqres) {
         // given a seqres residue position and its block, 
         // find the position of the pdb residue and return as a string
         var i_block = seqres.i_block;
         var i_residue = seqres.i_residue;
         var answer;
         if (i_block === undefined || i_block < 0) {i_block = 0};
         if (i_residue == seqres.block_end) {
            // account for insertion codes
            return blocks[i_block].pdb_end;
         } else {
            answer = Number(blocks[i_block].pdb_start) + i_residue - seqres.block_start;
            // convert to string
            answer = answer + '';
            return answer;
         }

      },
      find_last_pdb_residue: function (seqres) {
         // find the last pdb residue in a block (could be an insertion pdb)
         var i_block = seqres.i_block;
         if (i_block === undefined || i_block < 0) {i_block = 0};
         return blocks[i_block].pdb_end;
      }, 
		find_seqres_block: function (seqres, i_block) {
			//
			// given a seqres residue position, find the seqres block where the end comes after residue_number
			//
			'use strict';
			
			//var i_block = seqres.i_block;
			var i_residue = seqres.i_residue;
			if (i_block === undefined || i_block < 0 ) {i_block = 0};
			if (i_block <= n_blocks) {
				seqres.i_block = i_block;

				if (typeof blocks[i_block] === 'undefined') {
				}
				seqres.block_start = blocks[i_block].seqres_start;
				seqres.block_end = blocks[i_block].seqres_end;
				seqres.i_residue = i_residue;
            /*console.log("Trying to find residue " + i_residue 
              + " in block " + seqres.i_block 
              + " where the start is " + seqres.block_start 
              + " and the end is " + seqres.block_end); */
				if (i_residue >=  seqres.block_start && i_residue <= seqres.block_end) {
               // New seqres block
               //console.log("This is the correct block");
					seqres.gap = false;
					return seqres;
				} else if (i_residue > seqres.block_end) {
               // Trying next block
               //console.log("Trying next block");
               i_block += 1;
					return this.find_seqres_block(seqres, i_block);
				} else if (i_residue < seqres.block_end) {
               //console.log("There is a gap");
               // seqres residue occurs in seqres gap
               // return the previous block
               // revert i_block back to block before gap, unless at first block
               if (seqres.i_block > 0) {
                  seqres.i_block -= 1;
               }
					seqres.gap = true;
					return seqres;
				} else {
					// TODO Not sure what goes here!!
					return seqres;
				}

			} else {
            // seqres residue occurs after last seqres block
				seqres.i_block = -1;
				return seqres;
			}
		},
		get_block: function (i_block) {
			//
			// returns details for block number = i_block
			//
			'use strict';
			if (i_block === undefined) {i_block = 0};
			if (i_block <= n_blocks) {
				return {
               "seqres_start": blocks[i_block].seqres_start, 
               "seqres_end": blocks[i_block].seqres_end, 
               "pdb_start": blocks[i_block].pdb_start, 
               "pdb_end": blocks[i_block].pdb_end};
			} else {
				return false;
			}
		},	
      get_last_block: function() {
         // returns details for the last block
         'use strict';
         return {
               "seqres_start": blocks[n_blocks].seqres_start, 
               "seqres_end": blocks[n_blocks].seqres_end, 
               "pdb_start": blocks[n_blocks].pdb_start, 
               "pdb_end": blocks[n_blocks].pdb_end};
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
				if (output !== '') {};
				output += pdb_id + ':' + pdb_chain + ':' + pdb_start + ':' 
               + pdb_start_insertion + ':' + pdb_end + ':' + pdb_end_insertion 
               + ',' + primary_accession + ':' + blocks[i_block].seqres_start 
               + ':' + blocks[i_block].seqres_end + ';';				
			}
			return output;
		}
	};
});

// reads in a uniprot:pdb alignment and returns information in blocks
module.exports.PSSH_old_alignment = (function (alignment) {
	// Uses Douglas Crockford's module pattern
	// See http://ajaxian.com/archives/a-javascript-module-pattern
	'use strict';
	var j, line, pdb_residue_number;
	var i = 0;
	var i_block = -1;
	var n_blocks;
	var blocks = [];
	var hash = {};
	var string_length = alignment.length;
	while (i < string_length) {
		j = alignment.indexOf("\n", i);
	   if (j === -1) {
         j = alignment.indexOf(" ", i);
         if (j === -1) {j = string_length}; // when only one block, set j to length of alignment
	   }
		line = alignment.substr(i, j-i);
		if (line.match(/^(\d+)-(\d+):(-?\w+)-(-?\w+)$/)) {
         // possibility of insertion code: 265-387:272-393A
         var sequence_start = Number(RegExp.$1);
         var sequence_end = Number(RegExp.$2);
         var pdb_start = RegExp.$3;
         var pdb_end = RegExp.$4; 
         if (pdb_end.match(/(\d+)([^\d])$/)) {
               // There is an insertion.
               var pdb_end_number = RegExp.$1;
               var pdb_end_insertion_code = RegExp.$2;
               var insertion_code = 'A';
               sequence_end -= (pdb_end_insertion_code.charCodeAt(0) - insertion_code.charAt(0) + 1);
               i_block += 1;
               blocks[i_block] = {};
               blocks[i_block].sequence_start = sequence_start;
               blocks[i_block].sequence_end = sequence_end;
               blocks[i_block].pdb_start = pdb_start;
               blocks[i_block].pdb_end = pdb_end_number;
               sequence_end += 1;
               while (insertion_code.charCodeAt(0) <= pdb_end_insertion_code.charCodeAt(0)) {
                  i_block += 1;
                  blocks[i_block]= {};
                  blocks[i_block].sequence_start = sequence_end;
                  blocks[i_block].sequence_end = sequence_end;
                  blocks[i_block].pdb_start = pdb_end_number + insertion_code;
                  blocks[i_block].pdb_end = pdb_end_number + insertion_code;
                  sequence_end += 1;
                  insertion_code = String.fromCharCode(
                        insertion_code.charCodeAt(0) + 1);
               }
         } else {
            i_block += 1;
            blocks[i_block] = {};
            blocks[i_block].sequence_start = Number(sequence_start);
            blocks[i_block].sequence_end = Number(sequence_end);
            blocks[i_block].pdb_start = pdb_start;
            blocks[i_block].pdb_end = pdb_end;
         }
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
				hash[pdb_residue_number] = parseInt(RegExp.$1, 10);
			};				
		}
		i = j+1;
	}
	n_blocks = i_block;
   //logger.info(JSON.stringify(blocks, null, "\t"));
	
	return {
      print: function() {
         logger.info("Uniprot to PDB atom");
         // prints to debug.log
//         logger.info(JSON.stringify(blocks, null, "\t"));
      },
		n_blocks: function () {
         // NOTE: n_blocks means the nth block. The number of blocks is n_blocks + 1
			return n_blocks;
		},
		get_block: function (i_block) {
			//
			// returns details for block number = i_block
			//
			'use strict';
			if (i_block === undefined) {i_block = 0};
			if (i_block <= n_blocks) {
				return {
               "sequence_start": blocks[i_block].sequence_start, 
               "sequence_end": blocks[i_block].sequence_end, 
               "pdb_start": blocks[i_block].pdb_start, 
               "pdb_end": blocks[i_block].pdb_end};
			} else {
				return false;
			}
		},	
		find_uniprot_residue: function (i_block, pdb_residue_number) {
			// Given a pdb residue number as input, finds corresponding residue number in protein_sequence
			'use strict';
			var block_start_pdb, block_end_pdb;
			if (typeof pdb_residue_number === 'string') {
				if (pdb_residue_number.match(/[^\d]$/)) {
					// if pdb residue number contains an insertion code, look up seqres number in hash
					if (pdb_residue_number in hash) {
                  return hash[pdb_residue_number.toString()];
					} else {
                  return ' ';
					}
				} else {
					pdb_residue_number = Number(pdb_residue_number);
				}
			}
			if (i_block === undefined || i_block === false) {i_block = 0};
			block_end_pdb = blocks[i_block].pdb_end;
			if (block_end_pdb.match(/[^\d]$/) || pdb_residue_number > Number(block_end_pdb)) {
				// if block_end_pdb contains insertion code, skip to next block (since residue_number must not contain insertion)
				i_block += 1;
				if (i_block <= n_blocks) {
					return this.find_uniprot_residue(pdb_residue_number, i_block);
				} else {
					return ' ';
				};
			};
			// next block (if it exists) cannot contain insertions
			block_end_pdb = Number(block_end_pdb);
			block_start_pdb = Number(blocks[i_block].pdb_start);
			if (pdb_residue_number >= block_start_pdb && pdb_residue_number <= block_end_pdb) {
				return pdb_residue_number - block_start_pdb + blocks[i_block].sequence_start;
			} else if (pdb_residue_number < block_start_pdb) {
				return ' ';
			};
		},
	};
});

// aligns uniprot sequence to seqres and PDB atom.
// input alignments are NOT strings, they are objects (obtained from function above)
module.exports.pssh_old_full_alignment = (function (pssh_alignment, seqres_alignment) {
   var i, seqres_start, seqres_end, uniprot_start, uniprot_end, uniprot_end_tmp;
   var pdb_start, pdb_end;
   // Example containing insertion codes: trypsin - http://aquaria.ws:8009/P00763
   // 3btw:E:117: :221:A,P00763:122:221; <== 117-221A:122-221
   seqres_start = {};
   seqres_end = {};
   var n_blocks_pssh_alignment = pssh_alignment.n_blocks();

   var hash = {};
   var i_block = -1;
   var n_blocks;
   var blocks = [];

   for (i = 0; i <= n_blocks_pssh_alignment; i++) {
      uniprot_start = pssh_alignment.get_block(i).sequence_start;
      uniprot_end = pssh_alignment.get_block(i).sequence_end;
//      console.log('start residue: pssh_alignment.get_block(i).pdb_start:  ' + pssh_alignment.get_block(i).pdb_start);
//      console.log('block: ' +JSON.stringify(pssh_alignment.get_block(i)));
      seqres_start = seqres_alignment.find_seqres_residue(pssh_alignment.get_block(i).pdb_start);
      seqres_end = seqres_alignment.find_seqres_residue(pssh_alignment.get_block(i).pdb_end);
//      console.log('start: ' +JSON.stringify(seqres_start));
//      console.log('end: ' +JSON.stringify(seqres_end));
      if (seqres_start.i_block === false) {
        continue;
      }
      if (seqres_end.i_block === false) {
        continue;
      }
      while (uniprot_start <= uniprot_end) {
         seqres_start = seqres_alignment.find_seqres_block(seqres_start, seqres_start.i_block);
         seqres_end = seqres_alignment.find_seqres_block(seqres_end, seqres_end.i_block);
         if (seqres_start.i_block == -1) {
            // ERROR: seqres residue occurs after the last seqres block
         }
         else if (seqres_end.i_block == -1) {
            // ERROR: seqres end residue occurs after last seqres block, removing last residue
            seqres_end.i_residue = seqres_end.i_residue - 1;
            uniprot_end = uniprot_end - 1;
         } else if (seqres_start.gap == true) {
            // Seqres gap occurs at the start, skipping the residue
            seqres_start.i_residue += 1;
            uniprot_start += 1;
         } else if (seqres_end.gap == true) {
            // seqres gap occurs at the end, skipping the residue
            seqres_end.i_residue = seqres_end.i_residue - 1;
            uniprot_end = uniprot_end - 1;
         } else if (seqres_start.i_block === seqres_end.i_block) {
            // the whole pssh block is covered in one seqres block
            pdb_start = seqres_alignment.find_pdb_residue(seqres_start);
            pdb_end = seqres_alignment.find_pdb_residue(seqres_end);
            if (pdb_start.match(/^(\d+)([^\d])$/)) {
               // add to hash
               hash[pdb_start] = {};
               hash[pdb_start].uniprot = uniprot_start;
               hash[pdb_start].seqres = seqres_start.i_residue;
            } else {
               pdb_start = Number(pdb_start);
            }
            if (pdb_end.match(/^(\d+)([^\d])$/)) {
               // add to hash
               hash[pdb_end] = {};
               hash[pdb_end].uniprot = uniprot_end;
               hash[pdb_end].seqres = seqres_end.i_residue;
            } else {
               pdb_end = Number(pdb_end);
            }
            i_block += 1;
            blocks[i_block] = {};
            blocks[i_block].uniprot_start = uniprot_start;
            blocks[i_block].uniprot_end = uniprot_end;
            blocks[i_block].seqres_start = seqres_start.i_residue;
            blocks[i_block].seqres_end = seqres_end.i_residue;
            blocks[i_block].pdb_start = pdb_start;
            blocks[i_block].pdb_end = pdb_end;
            uniprot_start = uniprot_end + 1;
            seqres_start.i_residue = seqres_end.i_residue + 1;
            seqres_start = seqres_alignment.find_seqres_block(seqres_start, seqres_start.i_block);
         } else {
            // only a portion of the pssh block is covered. Choose a new start.
            pdb_start = seqres_alignment.find_pdb_residue(seqres_start);
            pdb_end = seqres_alignment.find_last_pdb_residue(seqres_start);
            uniprot_end_tmp = pssh_alignment.find_uniprot_residue(i, pdb_end);
            if (pdb_start.match(/^(\d+)([^\d])$/)) {
               // add to hash
               hash[pdb_start] = {};
               hash[pdb_start].uniprot = uniprot_start;
               hash[pdb_start].seqres = seqres_start.i_residue;
            } else {
               pdb_start = Number(pdb_start);
            }
            if (pdb_end.match(/^(\d+)([^\d])$/)) {
               // add to hash
               hash[pdb_end] = {};
               hash[pdb_end].uniprot = uniprot_end_tmp;
               hash[pdb_end].seqres = seqres_start.block_end;
            } else {
               pdb_end = Number(pdb_end);
            }
            i_block += 1;
            blocks[i_block] = {};
            blocks[i_block].uniprot_start = uniprot_start;
            blocks[i_block].uniprot_end = uniprot_end_tmp;
            blocks[i_block].seqres_start = seqres_start.i_residue;
            blocks[i_block].seqres_end = seqres_start.block_end;
            blocks[i_block].pdb_start = pdb_start;
            blocks[i_block].pdb_end = pdb_end;
            uniprot_start = uniprot_end_tmp + 1;
            seqres_start.i_residue = seqres_start.block_end + 1;
            seqres_start = seqres_alignment.find_seqres_block(seqres_start, seqres_start.i_block);
         }
      }
   }
   
   n_blocks = i_block;
   
   return {
      print: function () {
         logger.info("Full (old) alignment");
//         logger.info(JSON.stringify(blocks, null, "\t"));
      },
      n_blocks: function() {
         return n_blocks;
      },
      get_block: function(i_block) {
         if (i_block === undefined) {i_block = 0};
         if (i_block <= n_blocks) {
            return {sequence_start: blocks[i_block].uniprot_start, sequence_end: blocks[i_block].uniprot_end, seqres_start: blocks[i_block].seqres_start, seqres_end: blocks[i_block].seqres_end, pdb_start: blocks[i_block].pdb_start, pdb_end: blocks[i_block].pdb_end};
         } else {
            return false;
         }
      },
      generate_viewer_format: function(pdb_id, pdb_chain, primary_accession) {
			'use strict';
			var output, pdb_start, pdb_start_insertion, pdb_end, pdb_end_insertion;
			output = '';
			// Example containing insertion codes: trypsin - http://aquaria.ws:8009/P00763
			// 3btw:E:117: :221:A,P00763:122:221; <== 117-221A:122-221
			for (i_block = 0; i_block <= n_blocks; i_block += 1) {
				pdb_start = blocks[i_block].pdb_start;
				if (typeof pdb_start === 'string' && pdb_start.match(/^(\d+)([^\d])$/)) {
					pdb_start = RegExp.$1;
					pdb_start_insertion = RegExp.$2;
				} else {
					pdb_start_insertion = ' ';
				}
				pdb_end = blocks[i_block].pdb_end;
				if (typeof pdb_end === 'string' && pdb_end.match(/^(\d+)([^\d])$/)) {
					pdb_end = RegExp.$1;
					pdb_end_insertion = RegExp.$2;
				} else {
					pdb_end_insertion = ' ';
				}
				if (output !== '') {
				  
				};
				output += pdb_id + ':' + pdb_chain + ':' + pdb_start + ':' 
               + pdb_start_insertion + ':' + pdb_end + ':' + pdb_end_insertion 
               + ',' + primary_accession + ':' + blocks[i_block].uniprot_start 
               + ':' + blocks[i_block].uniprot_end + ';';				
			}
			return output;
		}
   }
});

// reads in a uniprot:seqres alignment and returns information in blocks
module.exports.PSSH_alignment = (function (alignment) {
	// Uses Douglas Crockford's module pattern
	// See http://ajaxian.com/archives/a-javascript-module-pattern
	'use strict';
	var j, line, pdb_residue_number;
	var i = 0;
	var i_block = -1;
	var n_blocks;
	var blocks = [];
	var string_length = alignment.length;
	while (i < string_length) {
		j = alignment.indexOf("\n", i);
	      if (j === -1) {
		 j = alignment.indexOf(" ", i);
		 if (j === -1) {j = string_length}; // when only one block, set j to length of alignment
	      }
		line = alignment.substr(i, j-i);
		if (line.match(/^(\d+)-(\d+):(-?\w+)-(-?\w+)$/)) {
			i_block += 1;
			blocks[i_block] = {};
			blocks[i_block].sequence_start = Number(RegExp.$1);
			blocks[i_block].sequence_end = Number(RegExp.$2);
			blocks[i_block].seqres_start = Number(RegExp.$3);
			blocks[i_block].seqres_end = Number(RegExp.$4);
		} else if (line.match(/^(\d+):(-?\w+)$/)) {
			i_block += 1;
			blocks[i_block] = {};
			blocks[i_block].sequence_start = Number(RegExp.$1);
			blocks[i_block].sequence_end = Number(RegExp.$1);
			blocks[i_block].seqres_start = Number(RegExp.$2);
			blocks[i_block].seqres_end = Number(RegExp.$2);
		}
		i = j+1;
	}
	n_blocks = i_block;
	
	return {
      print: function() {
         logger.info("Uniprot to seqres");
         // prints to debug.log
//         logger.info(JSON.stringify(blocks, null, "\t"));
      },
		n_blocks: function () {
			return n_blocks;
		},
		get_block: function (i_block) {
			//
			// returns details for block number = i_block
			//
			'use strict';
			if (i_block === undefined) {i_block = 0};
			if (i_block <= n_blocks) {
				return {
               "sequence_start": blocks[i_block].sequence_start, 
               "sequence_end": blocks[i_block].sequence_end, 
               "seqres_start": blocks[i_block].seqres_start, 
               "seqres_end": blocks[i_block].seqres_end};
			} else {
				return false;
			}
		},	
      find_uniprot_residue: function (i_block, seqres_residue) {
         return (blocks[i_block].sequence_start + seqres_residue - blocks[i_block].seqres_start);
      },
	};
});

// aligns uniprot sequence to seqres and PDB atom.
// input alignments are NOT strings, they are objects (obtained from function above)
module.exports.pssh_full_alignment = (function (pssh_alignment, seqres_alignment) {
   var i, seqres_start, seqres_end, uniprot_start, uniprot_end, uniprot_end_tmp;
   var pdb_start, pdb_end;
   // Example containing insertion codes: trypsin - http://aquaria.ws:8009/P00763
   // 3btw:E:117: :221:A,P00763:122:221; <== 117-221A:122-221
   seqres_start = {};
   seqres_end = {};
   var n_blocks_pssh_alignment = pssh_alignment.n_blocks();

   var hash = {};
   var i_block = -1;
   var n_blocks;
   var blocks = [];

   for (i = 0; i <= n_blocks_pssh_alignment; i++) {
      uniprot_start = pssh_alignment.get_block(i).sequence_start;
      uniprot_end = pssh_alignment.get_block(i).sequence_end;
      seqres_start.i_residue = pssh_alignment.get_block(i).seqres_start;
      seqres_end.i_residue = pssh_alignment.get_block(i).seqres_end;
      while (uniprot_start <= uniprot_end) {
         seqres_start = seqres_alignment.find_seqres_block(seqres_start, seqres_start.i_block);
         seqres_end = seqres_alignment.find_seqres_block(seqres_end, seqres_end.i_block);
         if (seqres_start.i_block == -1) {
            // ERROR: seqres residue occurs after the last seqres block
         }
         if (seqres_end.i_block == -1) {
            // ERROR: seqres end residue occurs after last seqres block, removing last residue
            seqres_end.i_residue = seqres_end.i_residue - 1;
            uniprot_end = uniprot_end - 1;
         } else if (seqres_start.gap == true) {
            // Seqres gap occurs at the start, skipping the residue
            seqres_start.i_residue += 1;
            uniprot_start += 1;
         } else if (seqres_end.gap == true) {
            // seqres gap occurs at the end, skipping the residue
            seqres_end.i_residue = seqres_end.i_residue - 1;
            uniprot_end = uniprot_end - 1;
         } else if (seqres_start.i_block === seqres_end.i_block) {
            // the whole pssh block is covered in one seqres block
            pdb_start = seqres_alignment.find_pdb_residue(seqres_start);
            pdb_end = seqres_alignment.find_pdb_residue(seqres_end);
            if (pdb_start.match(/^(\d+)([^\d])$/)) {
               // add to hash
               hash[pdb_start] = {};
               hash[pdb_start].uniprot = uniprot_start;
               hash[pdb_start].seqres = seqres_start.i_residue;
            } else {
               pdb_start = Number(pdb_start);
            }
            if (pdb_end.match(/^(\d+)([^\d])$/)) {
               // add to hash
               hash[pdb_end] = {};
               hash[pdb_end].uniprot = uniprot_end;
               hash[pdb_end].seqres = seqres_end.i_residue;
            } else {
               pdb_end = Number(pdb_end);
            }
            i_block += 1;
            blocks[i_block] = {};
            blocks[i_block].uniprot_start = uniprot_start;
            blocks[i_block].uniprot_end = uniprot_end;
            blocks[i_block].seqres_start = seqres_start.i_residue;
            blocks[i_block].seqres_end = seqres_end.i_residue;
            blocks[i_block].pdb_start = pdb_start;
            blocks[i_block].pdb_end = pdb_end;
            uniprot_start = uniprot_end + 1;
            seqres_start.i_residue = seqres_end.i_residue + 1;
            seqres_start = seqres_alignment.find_seqres_block(seqres_start, seqres_start.i_block);
         } else {
            // only a portion of the pssh block is covered. Choose a new start.
            pdb_start = seqres_alignment.find_pdb_residue(seqres_start);
            pdb_end = seqres_alignment.find_last_pdb_residue(seqres_start);
            uniprot_end_tmp = pssh_alignment.find_uniprot_residue(i, seqres_start.block_end);
            if (pdb_start.match(/^(\d+)([^\d])$/)) {
               // add to hash
               hash[pdb_start] = {};
               hash[pdb_start].uniprot = uniprot_start;
               hash[pdb_start].seqres = seqres_start.i_residue;
            } else {
               pdb_start = Number(pdb_start);
            }
            if (pdb_end.match(/^(\d+)([^\d])$/)) {
               // add to hash
               hash[pdb_end] = {};
               hash[pdb_end].uniprot = uniprot_end_tmp;
               hash[pdb_end].seqres = seqres_start.block_end;
            } else {
               pdb_end = Number(pdb_end);
            }
            i_block += 1;
            blocks[i_block] = {};
            blocks[i_block].uniprot_start = uniprot_start;
            blocks[i_block].uniprot_end = uniprot_end_tmp;
            blocks[i_block].seqres_start = seqres_start.i_residue;
            blocks[i_block].seqres_end = seqres_start.block_end;
            blocks[i_block].pdb_start = pdb_start;
            blocks[i_block].pdb_end = pdb_end;
            uniprot_start = uniprot_end_tmp + 1;
            seqres_start.i_residue = seqres_start.block_end + 1;
            seqres_start = seqres_alignment.find_seqres_block(seqres_start, seqres_start.i_block);
         }
      }
   }
   
   n_blocks = i_block;
   
   return {
      print: function () {
         logger.info("Full alignment");
         logger.info(JSON.stringify(blocks, null, "\t"));
      },
      n_blocks: function() {
         return n_blocks;
      },
      get_block: function(i_block) {
         if (i_block === undefined) {i_block = 0};
         if (i_block <= n_blocks) {
            return {
               "sequence_start": blocks[i_block].uniprot_start, 
               "sequence_end": blocks[i_block].uniprot_end, 
               "seqres_start": blocks[i_block].seqres_start, 
               "seqres_end": blocks[i_block].seqres_end, 
               "pdb_start": blocks[i_block].pdb_start, 
               "pdb_end": blocks[i_block].pdb_end};
         } else {
            return false;
         }
      },
      generate_viewer_format: function(pdb_id, pdb_chain, primary_accession) {
			'use strict';
			var output, pdb_start, pdb_start_insertion, pdb_end, pdb_end_insertion;
			output = '';
//			console.log("n_blocks: " + n_blocks);
			// Example containing insertion codes: trypsin - http://aquaria.ws:8009/P00763
			// 3btw:E:117: :221:A,P00763:122:221; <== 117-221A:122-221
			for (i_block = 0; i_block <= n_blocks; i_block += 1) {
				pdb_start = blocks[i_block].pdb_start;
				if (typeof pdb_start === 'string' && pdb_start.match(/^(\d+)([^\d])$/)) {
					pdb_start = RegExp.$1;
					pdb_start_insertion = RegExp.$2;
				} else {
					pdb_start_insertion = ' ';
				}
				pdb_end = blocks[i_block].pdb_end;
				if (typeof pdb_end === 'string' && pdb_end.match(/^(\d+)([^\d])$/)) {
					pdb_end = RegExp.$1;
					pdb_end_insertion = RegExp.$2;
				} else {
					pdb_end_insertion = ' ';
				}
				if (output !== '') {};
				output += pdb_id + ':' + pdb_chain + ':' + pdb_start + ':' 
               + pdb_start_insertion + ':' + pdb_end + ':' + pdb_end_insertion 
               + ',' + primary_accession + ':' + blocks[i_block].uniprot_start 
               + ':' + blocks[i_block].uniprot_end + ';';				
			}
//			console.log("generate_viewer_format returns: " + output);
			return output;
		}
   }
});

// alignment is from secondary structure to pdb atom.
// seqres alignment is the alignment of seqres to pdb.
module.exports.secondary_structure_alignment = (function (alignment, seqres_alignment) {
   var j, line;
	var i = 0;
	var i_block = -1;
	var n_blocks;
	var blocks = [];
	var string_length = alignment.length;


   var secondary_structures = [];
   while (i < string_length) {
      j = alignment.indexOf("\n", i);
      if (j === -1) {
         j = string_length;
      }
      line = alignment.substr(i, j - i);
      if (line.match(/^(\w+):(-?\w+)-(-?\w+)$/)) {
         var secondary_structure_block = {};
         secondary_structure_block["type"] = RegExp.$1;
         secondary_structure_block["pdb_start_block"] = RegExp.$2;
         secondary_structure_block["pdb_end_block"] = RegExp.$3;
         secondary_structures.push(secondary_structure_block);
      }
      i = j + 1;
   }
   // sort
   secondary_structures.sort(function (a, b) {
      var aNum, aInsertion, bNum, bInsertion;
      if (a["pdb_start_block"].match(/^(\d+)([^\d])$/)) {
         aNum = Number(RegExp.$1);
         aInsertion = RegExp.$2;
      } else {
         aNum = Number(a["pdb_start_block"]);
         aInsertion = '';
      }
      if (b["pdb_start_block"].match(/^(\d+)([^\d])$/)) {
         bNum = Number(RegExp.$1);
         bInsertion = RegExp.$2;
      } else {
         bNum = Number(b["pdb_start_block"]);
         bInsertion = '';
      }
      if (aNum === bNum) {
         return aInsertion.localeCompare(bInsertion);
      } else {
         return aNum - bNum;
      }
   });

   var first_seqres_block = seqres_alignment.get_block(0);
   var first_seqres_start = first_seqres_block.seqres_start;
   for (i = 0; i < secondary_structures.length; i++) {
      var secondary_structure_block = secondary_structures[i];
      var type = secondary_structure_block["type"];
      var pdb_start_block = secondary_structure_block["pdb_start_block"];
      var pdb_end_block = secondary_structure_block["pdb_end_block"];
      var seqres_start_block = seqres_alignment.find_seqres_residue(pdb_start_block, 0);
      var seqres_end_block = seqres_alignment.find_seqres_residue(pdb_end_block, 0);
      if (seqres_start_block.gap || seqres_end_block.gap) {
         //logger.info("WARNING!!! GAP!!!!");
      }
      if (seqres_start_block.gap) {
         for (var start = Number(pdb_start_block) + 1, end = Number(pdb_end_block); start <= end; start++) {
            seqres_start_block = seqres_alignment.find_seqres_residue(start);
            if (!seqres_start_block.gap) { break; }
         }
      }
      if (seqres_end_block.gap) {
         for (var end = Number(pdb_end_block) -1, start = Number(pdb_start_block); start <= end; end--) {
            seqres_end_block = seqres_alignment.find_seqres_residue(start);
            if (!seqres_end_block.gap) { break; }
         }
      }
      var seqres_start = seqres_start_block.i_residue;
      var seqres_end = seqres_end_block.i_residue;
      if (i_block === -1 && seqres_start > first_seqres_start) {
         // add coil structure
         i_block += 1;
         blocks[i_block] = {};
         blocks[i_block].type = 'COIL';
         blocks[i_block].seqres_start = first_seqres_start;
         blocks[i_block].seqres_end = seqres_start - 1;
      } else if (i_block >= 0 && blocks[i_block].seqres_end != seqres_start - 1) {
         // add coil structure
         i_block += 1;
         blocks[i_block] = {};
         blocks[i_block].type = 'COIL';
         blocks[i_block].seqres_start = blocks[i_block-1].seqres_end + 1;
         blocks[i_block].seqres_end = seqres_start - 1;
      }
      i_block += 1;
      blocks[i_block] = {};
      blocks[i_block].type = type;
      blocks[i_block].seqres_start = seqres_start;
      blocks[i_block].seqres_end = seqres_end;
   }
   var last_seqres_block = seqres_alignment.get_last_block();
   var last_seqres_start = 1;
   if (i_block > -1) {
      last_seqres_start = blocks[i_block].seqres_end + 1;
   }
   if (last_seqres_start <= last_seqres_block.seqres_end) {
      var last_seqres_end = last_seqres_block.seqres_end;
      i_block += 1;
      blocks[i_block] = {};
      blocks[i_block].type = 'COIL';
      blocks[i_block].seqres_start = last_seqres_start;
      blocks[i_block].seqres_end = last_seqres_end;
   }
   n_blocks = i_block;

   return {
      print: function () {
         logger.info("Secondary structure alignment.");
         logger.info(JSON.stringify(blocks, null, "\t"));
      },
      n_blocks: function () {
         return n_blocks;
      },
      get_block: function (i_block) {
         // returns details for block number = i_block
         if (i_block === undefined) {i_block = 0};
         if (i_block <= n_blocks) {
            return {
               type: blocks[i_block].type,
               seqres_start: blocks[i_block].seqres_start,
               seqres_end: blocks[i_block].end,
            }
         } else {
            return false;
         }
      },
      find_secondary_structure: function (seqres_number, i_block) {
         // given a seqres residue position as input, finds the corresponding secondary structure

         var response = {};
         if (i_block === undefined || i_block === false) {i_block = 0;};
         response.type = blocks[i_block].type;
         response.seqres_start = blocks[i_block].seqres_start;
         response.seqres_end = blocks[i_block].seqres_end;
         if (seqres_number > blocks[i_block].seqres_end) {
            i_block += 1;
            if (i_block <= n_blocks) {
               return this.find_secondary_structure(seqres_number, i_block);
            } else {
               logger.info("ERROR: Secondary structure not found. Went past the number of blocks");
               return null;
            }
         }
         response.i_block = i_block;
         if (seqres_number >= response.seqres_start && seqres_number <= response.seqres_end) {
            return response;
         } else if (seqres_number < response.seqres_start) {
            logger.info("ERROR: Secondary structure not found, in between blocks, not sure why??");
            return null;
         };
      },
   };
});
