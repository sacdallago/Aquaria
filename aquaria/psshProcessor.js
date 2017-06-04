var logger = require('../common/log');
var read_alignment = require('./read_alignment');
var Conservation = require('./conservation');
var Cluster = require('../shared/cluster');
var matching_structures_querier = require('./matching_structures_querier');



var PSSHProcessor = function(sequence, clusterCallback) {
  this.sequence = sequence;
  this.sendClusterCallback = clusterCallback;
  this.clusters = [];
  this.clustersToSend = [];
  this.psshStore = {};

};

PSSHProcessor.prototype.finaliseClusters = function () {
  var that = this;
//  console.log('in finalise clusters: ' );
  return matching_structures_querier.fillExtraPDBData(this.clusters).then(function (clusters) {
    clusters.forEach(function (cluster) {
//      console.log('in finalise clusters: 1: ' + cluster.psshEntry.SEQRES );
      updateMember(cluster.members[0], cluster.psshEntry);  
      
//      console.log('in finalise clusters: 1.1: ' + JSON.stringify(cluster) );
      // parse pssh alignment into structured object
      var conservation = new Conservation(that.sequence.sequence);
//      console.log('in finalise clusters: 1.2: ' + cluster.psshEntry.SEQRES );
      conservation.calculateConservationForPSSHEntry(cluster.psshEntry);
//      console.log('in finalise clusters: 1.3: ' + JSON.stringify(cluster) );
    
      cluster.conservationArray = conservation.conservationArray;
//      console.log('in finalise clusters: 1.4: ' + JSON.stringify(cluster) );
      cluster.secondary_structure = conservation.secondary_structure;
//            console.log('conservationArray: ' + cluster.conservationArray);
//            console.log('secondary_structure: ' + cluster.secondary_structure);
//      console.log('in finalise clusters: 2' );
      that.clustersToSend.push(cluster);
//      console.log('in finalise clusters: 3' );
      
    
    });
//    console.log('in finalise clusters: 4' );
    clusters.forEach(function(cluster) {
      cluster.update();
    });
//    console.log('in finalise clusters: 5' );

    that.sendClusters(true);
//    console.log('in finalise clusters: 6' );

    return clusters;
  });


};


PSSHProcessor.prototype.sendClusters = function (force) {
  var that = this;
//  console.log('in finalise clusters: 7' );
  var maxSize = force ? 0 : CLUSTER_BUFFER_SIZE;
//  console.log('about to send!! ' + maxSize);
  if (typeof that.sendClusterCallback !== 'undefined' &&
      that.sendClusterCallback !== null &&
      that.clustersToSend.length > maxSize) {
//    console.log('about to send!! ' + maxSize);
//    console.log('in finalise clusters: 8: ' + that.sendClusterCallback );
    that.sendClusterCallback(that.clustersToSend);
//    console.log('in finalise clusters: 9' );
    that.clustersToSend = [];
  }
};

PSSHProcessor.prototype.processPSSHRow = function (psshRow, chainRow) {
  var that = this;
//console.log('starting dataRow: ' + JSON.stringify([psshRow, chainRow]));
  try {

    processPSSHMember(psshRow, chainRow, that.sequence.primary_accession, function(
        member, psshEntry) {
//      console.log('starting psshEntry: ' + JSON.stringify(psshEntry));

      if (member.duplicateOf || psshEntry === null) {
//        console.log('foudn dup member : ' + JSON.stringify(member.duplicateOf));
        var source = that.psshStore[member.duplicateOf];
        if (typeof source === 'undefined') {
          source = {};
          that.psshStore[member.duplicateOf] = source;
        }
        source.duplicates = source.duplicates || [];
        source.duplicates.push(member.chain);
      }
      else {
        // handle the case that the dup was found before the real thing
        var sourceDummy = that.psshStore[member.pssh_id];
        that.psshStore[member.pssh_id] = member;
        if (typeof sourceDummy !== 'undefined') {
          member.duplicates = sourceDummy.duplicates;
        }
//      console.log('foudn member : ' + JSON.stringify(member));
        var notFound = that.clusters.every(function(cluster) {
          var same = isSameCluster(psshEntry.seq_start,
              psshEntry.seq_end, cluster.seq_start, cluster.seq_end);
          if (same) {
            cluster.addMember(member);
          } 
          return !same;
        });

        if (notFound || that.clusters.length === 0) {
          
          var cluster = new Cluster(psshEntry);
//          console.log('newcluster: ' + JSON.stringify(cluster));

          // initialise the cluster based on the first member
          cluster.initialise(member);
          that.clusters.push(cluster);



        }
      }

    });
  }
  catch(err) {
    console.log('Error in PSSH2 datarow: ' + err);
  }
};


//determines whether two alignments belong in the same cluster based on number
//of residues that overlap
//returns 1 for if in the same cluster and 0 if not.
function isSameCluster(input_seq_start, input_seq_end, input_cluster_seq_start,
    input_cluster_seq_end) {
//console.log('is same cluster args: ' + [input_seq_start, input_seq_end,
//input_cluster_seq_start,
//input_cluster_seq_end].join('||') );

//copy arrays so they can be modified
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
//  console.log( 'seq start:' + cluster_seq_start + 'seq end: ' + cluster_seq_end);
  var cluster_total_length = cluster_seq_end[cluster_seq_end.length - 1]
  - cluster_seq_start[0];
  var boundary = 5 / 100 * cluster_total_length;
  if (cluster_seq_start[0] - boundary > seq_start[0])
    return 0;
  if (cluster_seq_end[cluster_seq_end.length - 1] + boundary < seq_end[seq_end.length - 1])
    return 0;

  for (j = 0; j < seq_start.length; j++) {
    seqLen += (seq_end[j] - seq_start[j] + 1);
  }
  ;
  for (j = 0; j < cluster_seq_start.length; j++) {
    cluster_seqLen += (cluster_seq_end[j] - cluster_seq_start[j] + 1);
  }
  ;

  while (seq_start.length != 0) {
    while (seq_start[0] > cluster_seq_end[i] && seq_end[0] > cluster_seq_end[i]
    && i < n) {
      i++;
    }

    if (i != n) { // if there exists the possibility of overlap
      // the following if statement assures that there definitely is an overlap
      if (!(seq_start[0] < cluster_seq_start[i] && seq_end[0] < cluster_seq_start[i])) {
        if (seq_start[0] < cluster_seq_start[i]) {
          overlap_start = cluster_seq_start[i];
        } else {
          overlap_start = seq_start[0];
        }

        if (seq_end[0] > cluster_seq_end[i]) {
          overlap_end = cluster_seq_end[i];
          seq_start[0] = overlap_end + 1;
        } else {
          overlap_end = seq_end[0];
          seq_start.shift();
          seq_end.shift();
        }

        // add up number of residues that overlap
        overlap_count += (overlap_end - overlap_start + 1);
      } else {
        // move onto next block
        seq_start.shift();
        seq_end.shift();
      }

    } else {
      // absolutely no (further) overlap
      seq_start.splice(0, seq_start.length);
      seq_end.splice(0, seq_end.length);
    }

  }


  if (seqLen > cluster_seqLen) {
    large_seqLen = seqLen;
  } else {
    large_seqLen = cluster_seqLen;
  }
//threshold: 0.8
  if (overlap_count / large_seqLen > 0.8) {
    answer = 1;
  }

  return answer;

}


var processPSSHMember = function(psshRow, pdbChainRow, primary_accession, rowCallback) {
  var pssh_id;
  var psshEntry = null;
  var  n_blocks, k;
  var member;

  if (pdbChainRow.Matches.length > 0) {
    member = {
        duplicateOf:     pdbChainRow.PDB_ID + '-' + pdbChainRow.Matches + '-' + psshRow.Repeat_domains,
        chain: pdbChainRow.Chain
    };
//    console.log('find matches: ' + JSON.stringify(member));
    rowCallback(member, null);
  }
  else {
    // storing the pssh entries for later use
    pssh_id = pdbChainRow.PDB_ID + '-' + pdbChainRow.Chain + '-' + psshRow.Repeat_domains;
    psshEntry = createPSSHEntryFromRow(psshRow, pdbChainRow);
//    console.log('psshEntry: ' + JSON.stringify(psshEntry));
//    if (psshEntry.Structure2D == null
//        || typeof psshEntry.Structure2D === 'undefined') {
//      logger.info("No structure  Pdb id = " + psshEntry.pdb_id + "-"
//          + psshEntry.pdb_chain + " Skipping structure...");
//    } else 
    if (psshEntry.Align_to_SEQRES == null) {
      logger.info("SEQRES:PDB = null, pssh_id = " + pssh_id
          + " Skipping structure...");
    } else if (psshEntry.Alignment == null) {
      logger.info("Uniprot:SEQRES = null, pssh_id = " + pssh_id
          + " Skipping structure...");
    } else {
      // console.log('valid dataRow:' + dataRow);
      // parse pssh alignment into structured object
//      console.log('psshEntry1.Align_to_SEQRES, psshEntry.Alignment: ' + [psshEntry.Align_to_SEQRES, '!!!!',psshEntry.Alignment]);
      psshEntry.pssh_full_alignment = calculateFullPSSHAlignment(psshEntry.Align_to_SEQRES, psshEntry.Alignment);
//      console.log('psshEntry2.Align_to_SEQRES, psshEntry.Alignment: ' + [psshEntry.Align_to_SEQRES, '!!!!',psshEntry.Alignment]);

      n_blocks = psshEntry.pssh_full_alignment.n_blocks();
      if (n_blocks === -1) {
        logger.info("no blocks in alignment. Skipping structure");
      }
      else {
        
//        console.log('psshEntry.Align_to_SEQRES, psshEntry.Alignment: ' + [psshEntry.Align_to_SEQRES, '!!!!',psshEntry.Alignment]);
        psshEntry.seq_start = [];
        psshEntry.seq_end = [];
        for (k = 0; k <= n_blocks; k++) {
          psshEntry.seq_start.push(psshEntry.pssh_full_alignment.get_block(k).sequence_start);
          psshEntry.seq_end.push(psshEntry.pssh_full_alignment.get_block(k).sequence_end);
        }
        ;
  
        member = createMemberFromEntry(psshRow, pdbChainRow, psshEntry, primary_accession);
        member.pssh_id = pssh_id;
  //      console.log('Unique!: ' + JSON.stringify(psshEntry));
        rowCallback(member, psshEntry);
      }
    }
  }

};

//PUBLIC METHOD

var calculateFullPSSHAlignment = function (alignToSeqRes, alignment) {
  var seqres_alignment = read_alignment.PDB_alignment(alignToSeqRes);
  var pssh_alignment = read_alignment.PSSH_alignment(alignment);
  pssh_full_alignment = read_alignment.pssh_full_alignment(pssh_alignment,
      seqres_alignment);
  return pssh_full_alignment;
};

var createMemberFromEntry = function(psshRow, pdbChainRow, psshEntry, primaryAccession) {
//console.log('prim acc: ' + primaryAccession);
  return {
    "pdb_title" : pdbChainRow.Title,
    "pdb_id" : pdbChainRow.PDB_ID,
    "pdb_chain" : [ pdbChainRow.Chain ],
    "model" : pdbChainRow.Model,
    "Repeat_domains" : [ psshRow.Repeat_domains ],
    "biounits" : pdbChainRow.Biounits,
    "E_value" : psshRow.E_value,
    "match_length" : psshRow.Match_length,
    "alignment_identity_score" : psshRow.Identity_Score,
    "viewer_format" : [ psshEntry.pssh_full_alignment.generate_viewer_format(
        pdbChainRow.PDB_ID, pdbChainRow.Chain, primaryAccession) ],
        "Resolution" : [ psshEntry.Resolution ]
  };

};

var updateMember = function(member, psshEntry) {
  member.Resolution = [ psshEntry.Resolution ];
  member.biounits = psshEntry.biounits;
  member.transform = psshEntry.transform;
  member.Experimental_Method = psshEntry.Experimental_Method;
};

var createPSSHEntryFromRow = function(psshRow, pdbChainRow) {
  return {
    pdb_id : pdbChainRow.PDB_ID,
    pdb_chain : pdbChainRow.Chain,
    model : pdbChainRow.Model,
    Repeat_domains : psshRow.Repeat_domains,
    biounits : pdbChainRow.Biounits,
//    transform : pdbChainRow.Transform,
    Alignment : psshRow.Alignment,
    alignment_identity_score : psshRow.Identity_Score,
    SEQRES : pdbChainRow.SEQRES,
    E_value : psshRow.E_value,
    Align_to_SEQRES : pdbChainRow.Align_to_SEQRES,
    Structure2D : pdbChainRow['2D_Structure'] || '',
    Resolution : pdbChainRow.Resolution
  };
};




module.exports = PSSHProcessor;
module.exports.calculateFullPSSHAlignment = calculateFullPSSHAlignment;
