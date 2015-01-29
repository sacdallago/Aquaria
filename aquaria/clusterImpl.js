var Cluster = require('../shared/cluster');
var read_alignment = require('./read_alignment');
var logger = require('../common/log');
var conservationUtil = require('./conservation').singleton;

var ClusterImpl = function (psshEntry) {

};

//populate the cluster with secondary structure and conservation
ClusterImpl.prototype.getClusterInfo = function (pssh_full_alignment, uniprot_sequence, SEQRES,
		seqres_alignment, secondary_structure, l) {
	'use strict';
	var conservation, pssh_block;
	var start = 0;
	var type = false;
	var seqres_to_pdb_block = {};
	var uniprot = {};
	var seqres = {};

	seqres_alignment = read_alignment.PDB_alignment(seqres_alignment);

	uniprot.i_block = 0; // current block number in uniprot:pdb alignment
	seqres.i_residue = 0; // current residue number in seqres
	seqres.i_residue_previous = 0; // previous non-gap residue number in seqres
	seqres_to_pdb_block.i_residue = 0;

	// getting secondary structure alignment
	secondary_structure = read_alignment.secondary_structure_alignment(
			secondary_structure, seqres_alignment);
	var current_secondary_structure = null;

	pssh_block = pssh_full_alignment.get_block(uniprot.i_block);
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
			conservation = conservationUtil.score(uniprot.residue, seqres.residue);
			this.conservationArray[l][uniprot.i_residue] = conservation;
			if (conservation && conservation !== 'identical') {

				this.substitutions[conservation][l]
						.push(uniprot.i_residue);
			}
			;

			if (current_secondary_structure === null) {
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
					this.secondary_structure[l].push({
						'type' : type,
						'start' : start,
						'end' : uniprot.i_residue_previous
					});
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
		};
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
	
	return;
};

module.exports = ClusterImpl;
