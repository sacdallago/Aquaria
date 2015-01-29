var read_alignment = require('./read_alignment');
var logger = require('../common/log');

var Conservation = function(uniprot_sequence) {
	this.secondary_structure = [];
	this.substitutions = {};
	this.conservationArray = [];
	this.conservationArray[0] = [];
	this.substitutions.conserved = [];
	this.substitutions.nonconserved = [];
	this.secondary_structure[0] = [];
	this.substitutions['conserved'][0] = [];
	this.substitutions['nonconserved'][0] = [];
	this.uniprot_sequence = uniprot_sequence;
	// lets do it!
	
};

Conservation.prototype.calculateConservationForPSSHEntry = function(psshEntry) {
	// populate the secondary_structure and substitutions

	var pssh_full_alignment = psshEntry.pssh_full_alignment;
	// console.log('starting 1' );

//	console.log('conservation args: ' + [pssh_full_alignment, this.uniprot_sequence,
//		psshEntry.SEQRES, psshEntry.Align_to_SEQRES,
//		psshEntry.Structure2D, 0]);
	this.calculateConservation(pssh_full_alignment, psshEntry.SEQRES,
			psshEntry.Align_to_SEQRES, psshEntry.Structure2D, 0);

};

// populate the cluster with secondary structure and conservation
Conservation.prototype.calculateConservation = function(pssh_full_alignment,
		SEQRES, Align_to_SEQRES, secondary_structure, l) {
	'use strict';
	var conservation, pssh_block;
	var start = 0;
	var type = false;
	var seqres_to_pdb_block = {};
	var uniprot = {};
	var seqres = {};
	var uniprot_sequence = this.uniprot_sequence;

	var n_blocks = pssh_full_alignment.n_blocks();
	if (n_blocks === -1) {
		logger.info('Warning: pssh_alignment is empty for ' + SEQRES);
		return;
	}
//	console.log('aa1');
	var seqres_alignment = read_alignment.PDB_alignment(Align_to_SEQRES);

	uniprot.i_block = 0; // current block number in uniprot:pdb alignment
	seqres.i_residue = 0; // current residue number in seqres
	seqres.i_residue_previous = 0; // previous non-gap residue number in seqres
	seqres_to_pdb_block.i_residue = 0;

//	console.log('aa2');
	// getting secondary structure alignment
	secondary_structure = read_alignment.secondary_structure_alignment(
			secondary_structure, seqres_alignment);
	var current_secondary_structure = null;
//	console.log('aa3');

	pssh_block = pssh_full_alignment.get_block(uniprot.i_block);
//	logger.info('pssh_block: ' + pssh_block + ', uniprot.i_block: ' + uniprot.i_block + " number of blocks: " + n_blocks);
	while (pssh_block) {
		// step through each uniprot:seqres block
		// uniprot.i_block < n_pssh_blocks;
		uniprot.i_residue = pssh_block.sequence_start; // current residue number in
		// uniprot sequence
		seqres.i_residue = pssh_block.seqres_start;
		while (uniprot.i_residue <= pssh_block.sequence_end) {

			// step through each residue in the current uniprot:seqres block
			uniprot.residue = uniprot_sequence.charAt(uniprot.i_residue - 1);
			seqres.residue = SEQRES.charAt(seqres.i_residue - 1);
			conservation = score(uniprot.residue, seqres.residue);
			this.conservationArray[l][uniprot.i_residue] = conservation;
			if (conservation && conservation !== 'identical') {

				this.substitutions[conservation][l].push(uniprot.i_residue);
//				console.log('pushing conservation ' + conservation +": " + uniprot.i_residue + ", size: " + this.substitutions[conservation][l].length + ", this: " + this);
			}
			;

      if (current_secondary_structure === null || typeof current_secondary_structure === 'undefined') {
				current_secondary_structure = secondary_structure
						.find_secondary_structure(seqres.i_residue);
				if (current_secondary_structure) {
					type = current_secondary_structure.type;
					start = uniprot.i_residue;
				} else {
					current_secondary_structure = null;
				}
			} else {
				if (current_secondary_structure.seqres_end
						&& seqres.i_residue > current_secondary_structure.seqres_end) {
					// move onto next secondary structure
					var newSecondary = {
							'type' : type,
							'start' : start,
							'end' : uniprot.i_residue_previous
						};
					this.secondary_structure[l].push(newSecondary);
//					console.log('pushing 2nd struture ' + newSecondary);
					current_secondary_structure = secondary_structure
							.find_secondary_structure(seqres.i_residue);
					if (current_secondary_structure) {
						type = current_secondary_structure.type;
						start = uniprot.i_residue;
					}
				}
			}

			uniprot.i_residue_previous = uniprot.i_residue;
			uniprot.i_residue += 1;
			seqres.i_residue += 1;
		}
//		console.log('aa5');
		;
		// save the last secondary structure element
		if (type) {
			this.secondary_structure[l].push({
				'type' : type,
				'start' : start,
				'end' : uniprot.i_residue_previous
			});
		}
		type = false;
		current_secondary_structure = null;
		uniprot.i_block += 1;
		pssh_block = pssh_full_alignment.get_block(uniprot.i_block);
	}
//	console.log('aa6');

	return;
};

var is_amino_acid = function(input_string) {
	if (typeof input_string === 'string' && input_string.match(/[AC-IK-NP-TVWY]/)) {
		return true;
	} else {
		return false;
	}
};

var score = function(residue_a, residue_b) {
	'use strict';
	residue_a = residue_a.toUpperCase();
	residue_b = residue_b.toUpperCase();
	if (is_amino_acid(residue_a) && is_amino_acid(residue_b)) {
	  return getConservation(residue_a, residue_b);
//		residue_a = index_of[residue_a];
//		residue_b = index_of[residue_b] + 1;
//		return SUBSTITUTION_MATRIX[residue_a][residue_b];
	} else {
		return false;
	}
};

//var index_of = null;
//var createSubstitutionMatrix = function() {
//	// DETERMINE THE CONSERVATION BETWEEN TWO RESIDUES
//	'use strict';
//	// ************ MAXHOM AMINO ACID EXCHANGE MATRIX
//	// ***************************************
//	// see: McLachlan Andrew D., Tests for comparing related amino acid sequences.
//	// J.Mol.Biol. 61,409-424, minimal.
//	// 1971 value: -3.0 ; maximal value: 6.0
//	// symbols: "-BZX!" added
//	// See also: http://www.genome.jp/aaindex/AAindex/list_of_matrices
//	// See also: Figure 1, Ladunga & Smith, 1997
//	// http://peds.oxfordjournals.org/content/10/3/187.full.pdf
//	// Very highly conserved: IV|KR|DE|IL|AS|ST|LV|FY
//	// Highly conserved: FL|LM|AV|AG|AT|DN|NS
//
//	var i, j, substitution_score;
//	var substitution_matrix = [
//			[ 'V', 5, 2, 2, 1, 0, -1, 0, -1, 0, -1, -1, 0, -2, -1, -1, -1, -1, -1,
//					-2, -2, -2, -1 ],
//			[ 'L', 2, 5, 2, 3, 2, 0, 0, -2, -1, -2, -1, 0, -3, -1, -1, -1, 0, -2, -2,
//					-2, -2, 0 ],
//			[ 'I', 2, 2, 5, 2, 0, 0, 0, -2, -1, -2, -1, 0, -2, -1, -2, -2, -3, -2,
//					-2, -3, -2, -3 ],
//			[ 'M', 1, 3, 2, 5, 2, -2, -1, -2, 0, -2, -1, 0, 0, 0, -2, -2, 0, -2, -1,
//					-1, -1, 0 ],
//			[ 'F', 0, 2, 0, 2, 6, 3, 3, -3, -2, -2, -1, -2, -3, 1, -2, -3, -3, -3,
//					-3, -2, -3, -3 ],
//			[ 'W', -1, 0, 0, -2, 3, 6, 3, -2, -2, -3, 0, -1, -1, 0, 0, -2, -1, -2,
//					-3, -3, -3, -1 ],
//			[ 'Y', 0, 0, 0, -1, 3, 3, 6, -3, -2, -3, 0, -2, -2, 1, -1, -2, -2, -1,
//					-1, -2, -1, -2 ],
//			[ 'G', -1, -2, -2, -2, -3, -2, -3, 5, 0, 0, 0, -1, -2, -1, 0, 0, -1, 0,
//					0, 0, 0, -1 ],
//			[ 'A', 0, -1, -1, 0, -2, -2, -2, 0, 5, 1, 1, 0, -2, 0, -1, 0, 0, 1, 0, 0,
//					0, 0 ],
//			[ 'P', -1, -2, -2, -2, -2, -3, -3, 0, 1, 5, 0, 0, -3, 0, 0, 0, 0, 1, -2,
//					0, -2, 0 ],
//			[ 'S', -1, -1, -1, -1, -1, 0, 0, 0, 1, 0, 5, 2, -1, 0, 1, 0, 1, 1, 2, 0,
//					2, 1 ],
//			[ 'T', 0, 0, 0, 0, -2, -1, -2, -1, 0, 0, 2, 5, -1, 1, 0, 0, 0, 1, 0, 0,
//					0, 0 ],
//			[ 'C', -2, -3, -2, 0, -3, -1, -2, -2, -2, -3, -1, -1, 6, 0, -2, -3, -3,
//					-3, -2, -2, -2, -3 ],
//			[ 'H', -1, -1, -1, 0, 1, 0, 1, -1, 0, 0, 0, 1, 0, 5, 2, 1, 1, -1, 1, 1,
//					1, 1 ],
//			[ 'R', -1, -1, -2, -2, -2, 0, -1, 0, -1, 0, 1, 0, -2, 2, 5, 2, 2, 0, 0,
//					-2, 0, 2 ],
//			[ 'K', -1, -1, -2, -2, -3, -2, -2, 0, 0, 0, 0, 0, -3, 1, 2, 5, 1, 1, 1,
//					0, 1, 1 ],
//			[ 'Q', -1, 0, -3, 0, -3, -1, -2, -1, 0, 0, 1, 0, -3, 1, 2, 1, 5, 2, 1, 1,
//					1, 5 ],
//			[ 'E', -1, -2, -2, -2, -3, -2, -1, 0, 1, 1, 1, 1, -3, -1, 0, 1, 2, 5, 1,
//					2, 1, 2 ],
//			[ 'N', -2, -2, -2, -1, -3, -3, -1, 0, 0, -2, 2, 0, -2, 1, 0, 1, 1, 1, 5,
//					2, 5, 1 ],
//			[ 'D', -2, -2, -3, -1, -2, -3, -2, 0, 0, 0, 0, 0, -2, 1, -2, 0, 1, 2, 2,
//					5, 2, 1 ] ];
//	index_of = {};
//	for (i = substitution_matrix.length - 1; i >= 0; i -= 1) {
//		index_of[substitution_matrix[i][0]] = i;
//		for (j = substitution_matrix[0].length; j >= 0; j -= 1) {
//			substitution_score = substitution_matrix[i][j];
//			if (substitution_score >= 5) {
//				substitution_matrix[i][j] = 'identical';
//			} else if (substitution_score >= 0) {
//				substitution_matrix[i][j] = 'conserved';
//			} else {
//				substitution_matrix[i][j] = 'nonconserved';
//			}
//		}
//	}
//	;
//	return substitution_matrix;
//}
//
//var SUBSTITUTION_MATRIX = createSubstitutionMatrix();


//￼420
//A. D. MCLACHLAN 1972
//Here's the Japanese version - search for "McLachlan, 1972" 
//ftp://ftp.genome.jp/pub/db/community/aaindex/aaindex2
//TABLE 1
//Chemical similarity scores for the amino acids
//￼￼score
//6 - ￼FF MM YY HH CC WW RR GG  
//5 - LL II VV SS PP TT AA QQ NN KK DD EE 
//3 - FY FW LI LM IM ST AG QE ND KR
//2 - ￼FL FM FH IV YH YW SC HQ QN DE
//1 - FI FV LV LP LY LW IT IY ￼IW MV MY MW VP SA SN SQ PT PA TA TN HN HW QK QD NE
//0 - All others, including unknowns and deletions

//one letter code: FLIMVSPTAYHQNKDECWRGBZ
var conservationSet = {};

var codeLines = ["￼FF MM YY HH CC WW RR GG",  
          "LL II VV SS PP TT AA QQ NN KK DD EE", 
          "FY FW LI LM IM ST AG QE ND KR",
          "￼FL FM FH IV YH YW SC HQ QN DE",
          "FI FV LV LP LY LW IT IY ￼IW MV MY MW VP SA SN SQ PT PA TA TN HN HW QK QD NE"];
codeLines.forEach(function (codeLine) {
  var codes = codeLine.split(" ");
  codes.forEach(function (code) {
    conservationSet[code] = 1;
    // add reverse lookup too
    var reverseCode = code.charAt(1) + code.charAt(0);
    conservationSet[reverseCode] = 1;
  });
});

var getConservation = function (a, b) {
  var ret = 'nonconserved';
  if (a === b) {
    ret = 'identical';
  }
  else {
      var code =  a + b;
    if (conservationSet[code]) {
      ret = 'conserved';
    }
  }
  return ret;
}


module.exports = Conservation;
