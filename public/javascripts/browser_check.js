var browser = navigator.userAgent; console.log("browser is: "+browser);
if(browser.indexOf("Safari") != -1 && browser.indexOf("Chrome") == -1){ $("body").addClass("safari"); }

//check for "test" in URL to disable browser blocking
//if(location.href.indexOf("test") == -1) {
	
	if(ltIE9) { //set in header via conditional comment
//		showMsg("Please upgrade to Internet Explorer 9 or use Firefox.");
	}
	if (window.threedViewer === 'applet' && browser.indexOf("Chrome") != -1) {
		if (browser.indexOf("Macintosh") != -1) {
		  window.threedViewer = 'webgl';
		//		  window.hide3DViewer = true;
//		  $("#structureviewer h3")
//      .after(
//          '<div id="FFMenubug_note"><p>The 3D Molecular Viewer Applet works in Firefox on Windows, alternatively you can open the standalone application however you will not be able to view features on the 3D structure. <strong>Please use Firefox.</strong></p><p><button id="myButton" type="button" onclick="$(\'#FFMenubug_note\').remove();">Okay, I\'ve been warned.</button></div>');
		  $("#structureviewer h3")
      .after("<div class='ui-state-error ui-corner-all' style='margin: 0.5em; padding: 0 .7em;'><span class='ui-icon ui-icon-alert' style='float: left; margin-right: .3em;'></span><strong>Alert:</strong> On this browser Aquaria has only very limited functionality; please use Firefox or Safari on Mac.</div>");
		}
		if (browser.indexOf("Windows") != -1) {
			$("body").addClass("windows");
//			showMsg("On Windows we recommend using Firefox");
			}
	}
  // alert Firefox users on Mac
//  if (window.threedViewer === 'Applet' && navigator.userAgent.indexOf("Macintosh") != -1
//      && navigator.userAgent.indexOf("Firefox") != -1) {
//    // pop up notice about menus
//    $("#structureviewer h3")
//        .after(
//            '<div id="FFMenubug_note"><p>Due to an Oracle Java bug (<a href="http://bugs.sun.com/view_bug.do?bug_id=8016489" target="_blank">8016489</a>), the menus are not displaying properly in Firefox. <strong>Please use Safari.</strong></p><p><button id="myButton" type="button" onclick="$(\'#FFMenubug_note\').remove();">Okay, I\'ve been warned.</button></div>');
//  }

  // alert non Firefox users on Windows
if (window.threedViewer === 'applet' && navigator.userAgent.indexOf("Windows") != -1
    && (navigator.userAgent.indexOf("Firefox") === -1 )) {
  // pop up notice about menus
  $("#structureviewer h3")
      .after(
          '<div id="FFMenubug_note" class="aquariaWarning"><p>The 3D Molecular Viewer Applet works in Firefox on Windows, alternatively you can open the standalone application however you will not be able to view features on the 3D structure. <strong>Please use Firefox or Chrome.</strong></p><p><button id="myButton" type="button" onclick="$(\'#FFMenubug_note\').remove();">Okay, I\'ve been warned.</button></div>');
//  window.hide3DViewer = true;
  window.threedViewer = 'webgl';
}

  if (window.threedViewer === 'Applet' && !deployJava.versionCheck("1.6.0+")) {
    $("#structureviewer h3")
        .after(
            '<div id="FFMenubug_note" class="aquariaWarning"><p>Aquaria requires Java to be installed on the system. <strong>Please download Java from <a href="http://java.com/en/download/index.jsp" target="_blank">Sun</a></strong>.</p><p><button id="myButton" type="button" onclick="$(\'#FFMenubug_note\').remove();">Okay, It\'s installed now.</button></div>');
  }

//}

window.showAquariaSetup = function () {
  $("#threeD").css("visibility", "hidden");
//  $("#structureviewer").hide();
  $("#updateJava3D").show();
};

function showMsg(txt) {
	$("#content").hide();
	$("#bad_browser").show();
	$("#bad_browser").append("<p style='font-size: 1.5em;'>"+txt+"</p><p style='color: #999;'>Your browser: "+browser+"</p>");
}