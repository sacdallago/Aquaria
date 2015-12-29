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
        evt.target.parentElement.parentElement.submit();
    } else {
        alert("Failed to load files"); 
    }
}

document.getElementById('fileUpload').addEventListener('change', readMultipleFiles, false);