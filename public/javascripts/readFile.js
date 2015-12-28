var fileReadCompatibility = false;

// Check for the various File API support.
if (window.File && window.FileReader && window.FileList && window.Blob) {
    console.log('The File APIs are fully supported by your browser.');
    fileReadCompatibility = true;
} else {
    console.log('The File APIs are not fully supported by your browser.');
}

function readMultipleFiles(evt) {
    //Retrieve all the files from the FileList object
    var files = evt.target.files; 

    if (files) {
        for (var i=0, f; f=files[i]; i++) {
            var r = new FileReader();
            r.onload = (function(f) {
                return function(e) {
                    var contents = e.target.result;
                    alert( "Got the file.n" 
                          +"name: " + f.name + "n"
                          +"type: " + f.type + "n"
                          +"size: " + f.size + " bytesn"
                          + "starts with: " + contents.substr(1, contents.indexOf("n"))
                         ); 
                };
            })(f);

            r.readAsText(f);
        }   
    } else {
        alert("Failed to load files"); 
    }
}

document.getElementById('fileUpload').addEventListener('change', readMultipleFiles, false);