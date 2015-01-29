var connector = require('../common/connector');
// var cache = require('../common/cache')();
var read_alignment = require('./read_alignment');
var Sequence = require('../shared/sequence');
var Error = require('../shared/Errors');
var logger = require('../common/log');
var Conservation = require('./conservation');
var LRU = require("lru-cache");
var Promise = require('es6-promise').Promise;
var matching_structures = require('./matching_structures');
var PSSHProcessor = require('./psshProcessor');
var cache = LRU(1000);


module.exports.get_3D_alignment = function(member, sequence, callback) {
	console.time('get_3D_alignment');
	var output = null;
	new Promise(function(resolve, reject) {
		var cache_id = sequence.primary_accession + '-' + member.pdb_id
				+ '-' + member.pdb_chain[0] + '-' + member.Repeat_domains[0];
		output = cache.get(cache_id);
		if (output) {
			// found in cache
			logger.info("Object read from cache, success! " + cache_id);
			resolve(output);
		} else {
//			logger.info("Object NOT read from cache, create it ! " + cache_id);
			output = initialiseOutput(member, sequence);
			generateChainsAndSequenceQuery(member).then(
					function (data) {
						generateViewerSingleUniprot(data, output, member.viewer_format[0]).then (function (output) {
//						  console.log("OUTPUT: " + JSON.stringify(output));
							cache.set(cache_id, output);
							resolve(output);
						});
			}).catch(function (err) {
		    console.log('err occurred generate chains: ' + err);
			}) ;
		}
	}).then (callback).then(function () {
//		console.log('eneded!: ' + output);
		console.timeEnd('get_3D_alignment');
	}).catch (function (err) {
		console.log('err occurred: ' + err);
	});
};

var initialiseOutput = function (member, sequence) {
	var output = {};
	output.pdb_id = member.pdb_id;
	output.pdb_chain = member.pdb_chain.slice(0);
	console.log('initialising chain: ' + JSON.stringify(output.pdb_chain) );
	output.repeat_domain = member.Repeat_domains.slice(0);
	output.biounits = member.biounits;
	output.common_names = [];
	output.sequences = [sequence];
	output.transform = member.transform;
  output.transforms = [];
	output.i = 0;

	return output;
}

// populate the output object and also make a query to find the proteins of
// other chains
function generateChainsAndSequenceQuery(member) {
	var sqlquery = "SELECT PDB_chain.PDB_ID, Biounits, PDB_chain.Matches, PDB_chain.MD5_Hash As PDB_chain_hash, 2D_Structure as Structure2D, Transform, protein_sequence.MD5_Hash As uniprot_hash, PDB_chain.Chain, SEQRES, Align_to_SEQRES, protein_sequence.Primary_Accession, protein_sequence.Sequence from PDB_chain LEFT JOIN protein_sequence on (protein_sequence.Primary_Accession = PDB_chain.Accession) LEFT JOIN PDB on (PDB.PDB_ID = PDB_chain.PDB_ID) WHERE PDB_chain.PDB_ID = ? and PDB.PDB_ID = PDB_chain.PDB_ID";
	return connector.queryPromise(sqlquery, member.pdb_id);
}

function processConservation (row, fullAlignment,  sequence) {
//	console.log('row.Align_to_SEQRES, alignment: ' + [row.Align_to_SEQRES, fullAlignment]);
	var conservation = new Conservation (sequence);
	if (row.Structure2D === null) {
	  row.Structure2D = '';
	}
//	console.log('structure2d: = ' + JSON.stringify(row.Structure2D));
	conservation.calculateConservation (fullAlignment, row.SEQRES, row.Align_to_SEQRES, row.Structure2D, 0) ;
//	console.log('conservation args: ' + [fullAlignment, row.SEQRES, row.Align_to_SEQRES, row.Structure2D, 0, sequence]);
	return conservation;
}


// populate the output object with the proteins of the other chains in the same
// pdb file
function generateViewerSingleUniprot(data, output, viewer_format) {
	var conservations = {};
	return new Promise (function (outerResolve, outerReject) {
		
	

		var promiseList = data.map (function (row) {
			return new Promise (function (resolve, reject) {
//				console.log('starting chain row: ' + row);
						processChainRow(output, row, conservations, output.pdb_chain[0], output.sequences[0]).then (resolve, function (errMessage) {
              if (errMessage instanceof Error.AquariaError && errMessage.message.startsWith('No alignments found')) {
                resolve(null);
              }
              else {
                
  							resolve(null);
  							console.log('error found creating promise list: ' + errMessage);
              }
						}).catch (function (err) {
							console.log('Error: ' + err);
							reject(null);
						});
					});
		});  // data.map
//		console.log('promise list size: ' + promiseList.length + ", datasize: " + data.length);
		var alignment_tmp = [viewer_format];
		Promise.all(promiseList).then(function (rowOutputs) {
//			console.log('promise list DONE!' + rowOutputs.length);
		  var matches = {};
		  matches[output.pdb_chain[0]] = 1;
		  console.log('seq 0: ' + output.sequences[0])
		  if (output.sequences[0].matches) {
	      matches[output.sequences[0].matches] = 1;
		  }
//      console.log('about pushing: ' + JSON.stringify(rowOutputs));
			rowOutputs.forEach (function (rowOutput) {
				if (rowOutput) {
				  var matchesToTest = [rowOutput.pdb_chain];
//				  console.log('pushing: ' + rowOutput.transform);
          output.transforms.push(rowOutput.transform);
          console.log ('row output seq: ' + rowOutput.sequence)
				  if (rowOutput.sequence && rowOutput.sequence.matches) {
				    matchesToTest.push(rowOutput.sequence.matches);
				  }
				  var duplicate = matchesToTest.some(function (val) {
				    return matches[val];
				  });
				  if (duplicate) {
				    // this is really the main chain duplicated. Add the sequence homology to this chain as well.
	          output.sequences.push(output.sequences[0]);
	          alignment_tmp.push(updateAlignment(viewer_format, rowOutput.pdb_chain));
				  }
				  else {
	          output.sequences.push(rowOutput.sequence);
	          alignment_tmp.push(rowOutput.alignment);
				  }
          output.pdb_chain.push(rowOutput.pdb_chain);
          console.log('output chain is: ' + output.pdb_chain.length);
				}
			})
			output.conservations = conservations;
//			console.log('final output.conservations: ' + JSON.stringify(output.conservations));
			output.alignment = alignment_tmp.join('');

			getSynonyms(output.sequences).then(function (synonymData) {
				return generateCommonNames(synonymData, output.sequences)
			}).then (function (commonNames) {
				output.common_names = commonNames;
				outerResolve(output);
			}).catch(function (err) {
				console.log('err: ' + err);
				throw err;
			});
		}).catch(function (err) {
			console.log('err final: ' + err);
			throw err;

		});
		console.log('aa3');

	});
}

var updateAlignment = function(existingAlignment, newChain) {
  var sections = existingAlignment.split(';');
  sections = sections.map(function (line) {
    ret = '';
    if (line.trim().length > 0) {
      
      var alignmentParts = line.split(',');
      var pdbBits = alignmentParts[0].split(':');
      pdbBits[1] = newChain;
      alignmentParts[0] = pdbBits.join(':');
      ret = alignmentParts.join(','); 
    }
    return ret;
  })
  var ret = sections.join(';'); 
  return ret;
}

var processChainRow = function(output, row, conservations, pdbChainSelected, selectedSequence) {
	var rowOutput  = {
		sequence: null,
		pdb_chain: null,
		alignment: null
	};
	return new Promise (function (resolve, reject) {
		var isNewChain = row.Chain !== pdbChainSelected;
		var sequence = new Sequence(row) ;
//    var sequence = isNewChain ? new Sequence(row) : selectedSequence;
//		console.log('checking Chain ' + row.Chain );
		if (typeof row.Primary_Accession !== 'undefined'
				&& row.Primary_Accession !== null) {
			
			return getFullAlignment(row.uniprot_hash, row.PDB_chain_hash, row.Align_to_SEQRES).then (function (fullAlignment) {
        rowOutput.transform = row.Transform;
        
			  if (fullAlignment) {
			    
  				var conservation = processConservation(row, fullAlignment, sequence.sequence);
  //				console.log('conservation CHECK for Chain ' + row.Chain + ': ' + JSON.stringify(conservation));
  				conservations[row.Chain] = {conserved: conservation.substitutions.conserved[0], nonconserved: conservation.substitutions.nonconserved[0]};
  //				console.log('conservation for Chain ' + row.Chain + ': ' + JSON.stringify(conservations[row.Chain]));
//  				console.log('The transform is : ' + row.Transform);
  					if (isNewChain) {

  						rowOutput.sequence = sequence;
  						rowOutput.pdb_chain = row.Chain;
  						console.log('row.Chain = ' + row.Chain);
  						rowOutput.alignment = fullAlignment.generate_viewer_format(
  								row.PDB_ID, row.Chain, sequence.primary_accession);
  							resolve(rowOutput);
  //							console.log('rowOutput: ' + rowOutput);
  					}
  					else{
  					  output.transforms.push(row.Transform);
              output.biounits = row.Biounits;
              console.log('selected seq:' + selectedSequence);
  					  selectedSequence.matches = row.Matches;
  						// this chain is already processed
  //						console.log('already processed');
  						resolve(null);
  					}
			  }
			  else {
			    resolve(null);
			  }
			}, function (message) {
//				console.log('rejecting ' + message);
				reject(message);
			}).catch (function (err) {
			  console.log(err);
			});
		} else {
			// Fakes are for chains that do not have a primary accession, create one using the PDB ID + chain
//			console.log('FAKE conservation for Chain ' + row.Chain + ': ' + JSON.stringify(conservations[row.Chain]));
		  console.log('going to create a fake row: ' + JSON.stringify(row));
			var uniprot_fake = row.PDB_ID + '-' + row.Chain;
//			sequence.primary_accession = uniprot_fake;
			sequence.sequence = row.SEQRES;
//			sequence.features = ' ';
			rowOutput.sequence = sequence;
			console.log('fake chain: ' + row.Chain + ", pdbchain: " + JSON.stringify(output.pdb_chain));
			rowOutput.pdb_chain = row.Chain;
			rowOutput.transform = row.Transform;
      var seqres_alignment = read_alignment.PDB_alignment(row.Align_to_SEQRES);
			rowOutput.alignment = seqres_alignment.convert_to_SRS3D_format(
					row.PDB_ID, row.Chain, uniprot_fake);
			
			resolve(rowOutput);
		}
	});
};

var getFullAlignment = function (uniprot_hash, PDB_chain_hash, Align_to_SEQRES) {
	return new Promise (function (resolve, reject) {
		
		var tablename = 'PSSH2';
		var sqlquery = "SELECT Alignment FROM " + tablename
				+ " WHERE protein_sequence_hash = ? AND PDB_chain_hash = ?";
		var args = [uniprot_hash, PDB_chain_hash];
		return connector.queryPromise(sqlquery, args).then (function (data) {
      var alignment = '';
			if (data.length > 0) {
		     alignment = data[0].Alignment;
			}
      var pssh_full_alignment = PSSHProcessor.calculateFullPSSHAlignment(Align_to_SEQRES, alignment);
      resolve (pssh_full_alignment);
		}).catch(function (err) {
		  console.log('error getting full alignment.' + err);
		});
	});
		
};

// make the array of alignments into one large string.
function getSynonyms(sequences) {
	var sqlquery = "SELECT * from protein_synonyms WHERE ";
	var wheres = [];
	var args = [];
	var accessionMap = {};
	sequences.forEach(function(sequence) {
	  accessionMap[sequence.primary_accession] = 1;
	})
	Object.keys(accessionMap).forEach(function(accession) {
		wheres.push("Primary_Accession = ? ");
		args.push(accession);
	});
	sqlquery += wheres.join(' OR ');
	return connector.queryPromise(sqlquery, args).then(generateSynonyms);
}

function isValidSourceField(source_field) {
	return (source_field == "GN" || source_field == "GS" || source_field == "GS1"
			|| source_field == "OLN" || source_field == "ORF");
}

function generateSynonyms(data) {
	return new Promise(function(resolve, reject) {
		
		var synonyms = {};
		var source_field = {};
		source_field.GN = 1;
		source_field.GS = 2;
		source_field.OL = 3;
		source_field.OR = 4;
	
		// for each of the data rows, sort into synonyms so that synonyms[key] = best
		// name for protein.
		// then label_s_cluster for the each cluster.
		for ( var i = 0; i < data.length; i++) {
			var row = data[i];
			// if there is no synonym yet for that accession
			if (isValidSourceField(row.Source_Field)
					&& typeof synonyms[row.Primary_Accession] === 'undefined') {
				// not in store, create a new synonym obj
				synonyms[row.Primary_Accession] = {};
				synonyms[row.Primary_Accession].name = row.Synonym;
				var source_field_priority = 10;
				if (typeof source_field[row.Source_Field.substring(0, 2)] !== 'undefined') {
					synonyms[row.Primary_Accession].source_field = source_field[row.Source_Field
							.substring(0, 2)];
				} else {
					synonyms[row.Primary_Accession].source_field = 10;
				}
			} else {
				// if the synonym is better
				if (isValidSourceField(row.Source_Field)
						&& source_field[row.Source_Field.substring(0, 2)] < synonyms[row.Primary_Accession].source_field) {
					synonyms[row.Primary_Accession].name = row.Synonym;
					synonyms[row.Primary_Accession].source_field = source_field[row.Source_Field
							.substring(0, 2)];
				}
			}
		}

		resolve(synonyms);
	});
}

function generateCommonNames(synonyms, sequences) {
	var commonNames = [];
	return new Promise(function (resolve, reject) {
		commonNames = sequences.map(function(sequence) {
		
			var common_name;
			if (typeof synonyms[sequence.primary_accession] !== 'undefined') {
				common_name = synonyms[sequence.primary_accession].name;
			} else {
				common_name = sequence.primary_accession;
			}
			return common_name;
		});
		resolve(commonNames);
	});
}
