
/**
 * Module dependencies.
 */
var express = require('express')
var routes = require('./routes')
var http = require('http')
var path = require('path')
var fs = require('fs')
var shoe = require('shoe');
var dnode = require('dnode');

var autoComplete = require('./aquaria/autocomplete');
var get_matching_structures = require('./aquaria/matching_structures');
var secondary_clustering = require('./aquaria/secondary_clustering');
var metainfo = require('./aquaria/metainfo');
var viewer_format = require('./aquaria/generate_viewer_format');
var viewer = require('./aquaria/viewer');
var snapshot = require('./aquaria/snapshot');
var config = require('./common/config');
//var expiry = require('static-expiry');


var JAR_EXPIRY = 1000 * 60 * 60 * 24 * 7;

//var dark_domains = require ('./aquaria/dark_domains');
//var queryConstraints = require('./aquaria/queryDistanceConstraints');
//var new_sql = require('./aquaria/sql_example');
var app = express();


// http://www.hacksparrow.com/express-js-logging-access-and-errors.html
var access_logfile = fs.createWriteStream('log/access.log', {flags: 'a'});

app.configure(function(){
    app.set('port', process.env.PORT || config.get('port'));
    // app.set('views', __dirname + '/views');
    // Switched to EJS engine - see http://stackoverflow.com/questions/4600952/
    // Info on EJS ('Embedded JavaScript templates') - https://github.com/visionmedia/ejs
    app.set('view engine', 'ejs');
    app.use(express.favicon(__dirname + '/public/images/favicon.ico'));
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser('your secret here'));
    app.use(express.session());
    //	app.use(expiry(app, { dir: path.join(__dirname, 'public') }));
    //	app.use(expiry(app, { dir: path.join(__dirname, 'public') }));
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public'), { maxAge: 3600000 }));
    app.use('/jar', express.static(path.join(__dirname, 'jar'), { maxAge: JAR_EXPIRY}));
    app.use(express.logger({stream: access_logfile }));
    app.set('views', __dirname + '/views');
});

//app.configure('development', function(){
app.configure('production', function(){
    app.use(express.errorHandler());
});

var server = http.createServer(app);
server.listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});



var sock = shoe(function (stream) {
    var d = dnode({
        transform : function (s, cb) {
            var res = s.replace(/[aeiou]{2,}/, 'oo').toUpperCase();
            cb(res);
        },
        queryOrganism           : autoComplete.queryOrganism,
        queryProtein            : autoComplete.queryProtein,
        queryProteinWildOrganism: autoComplete.queryProteinWildOrganism,
        queryPDB                : autoComplete.queryPDB,
        loadSnapshot            : snapshot.loadSnapshot,
        getJNLP                 : snapshot.getJNLP,
        get_matching_structures : matching_structures.get_matching_structures,
        getAccessionForPDB      : matching_structures.getAccessionForPDBCallback,
        get_secondary_clusters  : secondary_clustering.get_secondary_clusters,
        queryPDBTitle           : secondary_clustering.queryPDBTitle,
        get_3D_alignment        : viewer_format.get_3D_alignment,
        getPubMedForPDB         : metainfo.getPubMedForPDB,
        getOrganismInfo         : metainfo.getOrganismInfo,
        getProteinSynonyms      : metainfo.getProteinSynonyms,
        getOrganismSynonyms     : metainfo.getOrganismSynonyms,
        getOrganismName         : metainfo.getOrganismName,
        getChainInfo            : metainfo.getChainInfo,
        getOrganismId           : metainfo.getOrganismId,
        createAppJNLP           : viewer.createJNLP,
        createToolkitAppJNLP    : viewer.createToolkitJNLP,
        get_sequence            : matching_structures.get_sequence,
    });
    d.pipe(stream).pipe(d);
});
sock.install(server, '/dnode');

//var everyone = require("now").initialize(server);

//everyone.now.getDarkDomains = dark_domains.getDarkDomains;


//everyone.now.queryConstraints = queryConstraints.queryConstraints;
//everyone.now.sql_query = new_sql.function_name;

// Disable layout - http://stackoverflow.com/questions/4600952/
app.set('view options', {
    layout: false
});

app.get('/launch', routes.launchPage);
app.get('/googlehostedservice.html', routes.googleHostedService);

//app.get('/jar/:jarname', routes.jar);
//app.get('/jar/:{jarname}?version-id=:{version}', routes.jar);
//app.post('/jnlp/app/:filename.jnlp', routes.jnlpApp);
app.get('/jnlp/:versionString/:filename.jnlp', routes.jnlp);

app.get('/:id/cluster:clusterId.:format', routes.matchingStructuresExt);
//app.get('/:id/cluster:clusterId.json', routes.matchingStructuresJSON);
//app.get('/:id/cluster:clusterId.txt', routes.matchingStructuresTXT);
//app.get('/:id/cluster:clusterId.csv', routes.matchingStructuresCSV);

app.get('/:id/:pdbid?/:chainid?.:format', routes.matchingStructuresExt);
//app.get('/:id/:pdbid.:ext', routes.matchingStructuresExt);
//app.get('/:id/:pdbid/:chainid.tsv', routes.matchingStructuresTSV);
//app.get('/:id/:pdbid/:chainid.csv', routes.matchingStructuresCSV);
//app.get('/:id/:pdbid/:chainid.txt', routes.matchingStructuresTXT);

//app.get('/:id.:format', routes.matchingStructuresExt);
//app.get('/:id.csv', routes.matchingStructuresCSV);
//app.get('/:id.txt', routes.matchingStructuresTXT);
//app.get('/:id/:pdbid', routes.home_page);
app.get('/:id/:pdbid?/:chainid?', routes.home_page);
//app.get('/leap/:id/:pdbid', routes.home_page);
//app.get('/leap/:id/:pdbid/:chainid', routes.home_page);
app.get('/', routes.home_page);
//app.get('/:id.json', routes.matchingStructuresJSON);
//app.get('/json/:id', routes.matchingStructuresJSON);
//app.get('/pdb/:id', routes.pdb);
//app.get('/:id.pdb:ext?', routes.pdb);
//app.get('/:id', routes.home_page);
//app.get('/leap/:id', routes.home_page);
//app.get('/interactions/:id', routes.interactions);
//app.get('/sean/:id', routes.sean);


// Upload a FASTA sequence:
app.post('/fasta', routes.parseFasta);
