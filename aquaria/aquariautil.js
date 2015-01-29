#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

var program = require('commander');
var versionString = require('./versionString');
var viewer = require('./viewer');
var matchingStructures = require('./matching_structures');
var viewerFormat = require('./generate_viewer_format');


var type = 'applet';
var mode = 'production';
var sequence = null;
function versionReport () {
    console.log(versionString.viewer);
}

function generateJNLP () {
  if (program.application) {
    console.log(viewer.createAppJNLP(program.development, {template: true}));
  }
  else {
    console.log(viewer.createAppletJNLP(program.development, {template: true}));
  }
}


//   .command('show <primaryAccession> <pdbId> <pdbChain> [<clusterIndex> [members [memberIndex] | conservation | secondaryStructure]]')
function showClusters (primaryAccession, pdbId, pdbChain, clusterIndex, cmd) {
  console.time('Total time for show');
  var loadRequest = {
      selector: [primaryAccession],
      selectPDB: pdbId,
      selectChain: pdbChain
  };        

  function outputMember(member) {
    if (cmd.viewerFormat) {
      viewerFormat.get_3D_alignment(member, sequence, function (output) {
        console.log(JSON.stringify(output, null, "\t"));
      });
    } else {
      console.log(JSON.stringify(member, null, "\t"));
    }
  }

  matchingStructures.get_matching_structures(loadRequest, function (loadReq, sequences) {
    sequence = sequences[0];
  }, null, function (err, loadRequest, selectedPDB, clusters, cachedHit, versionString) {
    if (err) {
      console.log('err: ' + err);
      throw err;
    }
    console.log('-------------------------------------------');

    if (typeof clusterIndex === 'undefined' && (cmd.memberIndex || cmd.conservation || cmd.secondaryStructure)) {
      console.log('No cluster index provided, showing information for cluster 0');
      clusterIndex = 0;
    }
    if (typeof clusterIndex !== 'undefined') {
      var shownNothing = true;
      var cluster = clusters[clusterIndex];
      if (cmd.memberIndex) {
        shownNothing = false;
        outputMember(cluster.members[cmd.memberIndex]);
      }
      else if (cmd.memberPDB) {
        shownNothing = false;
        cluster.members.forEach(function (member) {
          if (member.pdb_id === cmd.memberPDB) {
            outputMember(member);
          }
        });
      }
      if (cmd.conservation) {
        shownNothing = false;
        var output = '';
        var i;
        for (i = 0; i < cluster.conservationArray[0].length; i++) {
          var line = i + ": " + cluster.conservationArray[0][i] + ', ';
          output += line;
        }
        console.log(output);
      }
      if (cmd.secondaryStructure) {
        shownNothing = false;
        var output = '';
        var i;
        for (i = 0; i < cluster.secondary_structure[0].length; i++) {
          
          var item =  cluster.secondary_structure[0][i];
          output += item.type + " " + item.start + ":" + item.end +",";
        }
        console.log(output);
      }
      if (shownNothing) {
        console.log(JSON.stringify(cluster, null, "\t"));
      }
    }
    else if (cmd.memberPDB){
      clusters.forEach(function (cluster) {
        cluster.members.forEach(function (member) {
          if (member.pdb_id === cmd.memberPDB) {
            outputMember(member);
          }
        });
      })
    }
    else {
      console.log(JSON.stringify(clusters, null, "\t"));
    }
    console.log('-------------------------------------------');
    console.timeEnd('Total time for show');
  });
}

function setMode() {
  mode = 'development';
}

program
  .version(versionString.viewer)
//  .usage('[options]')
//  .option('-v, --version', 'Report the version of the viewer and the third parties libraries', versionReport)
  .option('-a, --application ', 'target the application instead of the applet')
  .option('-d, --development ', 'allow for development mode');
//  .parse(process.argv);


program
  .command('jar_version')
  .description('Report the version of the viewer and the third parties libraries')
  .action(versionReport);

program
  .command('build')
  .description('Report the current build number')
  .action(function () {
    console.log(versionString.buildNumber());
  });

program
  .command('increment_build')
  .description('Report the current build number and increment it (WARNING, only used for build scripts)')
  .action(function () {
    console.log(versionString.updateBuildNumber());
    viewer.cleanCache();
  });

  program
  .command('show <primaryAccession> [pdbId[ [pdbChain] [clusterIndex]')
  .option('-m, --memberIndex <n>', 'the index of which member to display starting at 0', parseInt)
  .option('-p, --memberPDB <pdb>', 'the PDB id of the member to display')
  .option('-c, --conservation', 'the list of conservation values for the cluster')
  .option('-s, --secondaryStructure', 'the list of secondary structures for the cluster')
  .option('-v, --viewerFormat', 'the information to be sent to the 3D viewer for the selected member')
  .description('show information about a particular alignment for protein sequence and PDB structure')
  .action(showClusters);

program
  .command('jnlp')
  .description('generate the JNLP for an applet or application')
  .action(generateJNLP);

program
  .command('clean')
  .description('Clear the file caches for the server')
  .action(viewer.cleanCache);


program.parse(process.argv);
