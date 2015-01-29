var html = require('./menubar.html');
 
var MenuBar = function (root, callbacks) {
  this.root = root;
  $(this.root).append(html);
//  var mainMenu = [{name: 'type': 'Representation'},
//       {'colour': 'Color'},
//       ];
  
  $('.nav li').hover(
      function () { //appearing on hover
        $('ul', this).fadeIn();
      },
      function () { //disappearing on hover
        $('ul', this).fadeOut();
      }
    );
  
  $('#MenuLines').click(function (e) {
    callbacks['type']('lines');
  });
  $('#MenuCartoon').click(function (e) {
    callbacks['type']('cartoon');
  });
  $('#MenuBallAndStick').click(function (e) {
    callbacks['type']('ballsAndSticks');
  });
  $('#MenuLineTrace').click(function (e) {
	callbacks['type']('lineTrace');
  });
  
  
  $('#MenuHomology').click(function (e) {
    callbacks['colourScheme']('homology');
  });
  $('#MenuChains').click(function (e) {
    callbacks['colourScheme']('chains');
  });
  $('#MenuElement').click(function (e) {
    callbacks['colourScheme']('element');
  });
  
  $('#MenuLockedView').click(function(e) {
	 callbacks['view']('locked');
  });
  $('#MenuPCAView').click(function(e) {
	 callbacks['view']('pca');
  });
  $('#MenuEntropyView').click(function(e) {
	 callbacks['view']('entropy',{samples: $('#Samples').val()});
  });
  $('#MenuAutoView').click(function(e) {
		 callbacks['view']('auto');
  });
  
}


//MenuBar.prototype.addMenu = function (name) {
//  this.root.append('<li><a href="#">' + name + '</a></li>');
//}

module.exports = MenuBar;