var fileReadCompatibility = false;
var resultsDisplay = document.getElementById("fastaParseResults");
var calculatePsshSpan = document.getElementById("calculatePssh");

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

    if (files !== undefined && files.length > 0) {
        var file = files[0];
        var fileReader = new FileReader();
        fileReader.onload = function(element) {
            var contents = element.target.result;
            AQUARIA.remote.checkFasta(contents, function(results){
                results.forEach(function(sequence){
                    if(sequence.Primary_Accession !== undefined){
                        var li = document.createElement('li');
                        var a = document.createElement('a');

                        a.href = "#";
                        a.textContent = sequence.Primary_Accession;
                        a.addEventListener("click", function(){
                            startLogoSpin();
                            AQUARIA.loadAccession([sequence.Primary_Accession], null, null, false, null);
                            return;
                        });

                        li.appendChild(a);
                        resultsDisplay.appendChild(li);
                    } else {
                        calculatePsshSpan.style.display = "block";
                    }
                });
            });
        };
        fileReader.readAsText(file);
    } else {
        alert("Failed to load file");
    }
}

function openSubmitToQueueModal(){
    $('.ui.modal.submitToQueue')
        .modal('show')
    ;
}

$('.ui.form')
    .form({
    fields: {
        file: {
            identifier: 'file',
            rules: [
                {
                    type   : 'empty',
                    prompt : 'The file input cannot be left empty.'
                }
            ]
        },
        email: {
            identifier: 'email',
            rules: [
                {
                    type: 'empty',
                    prompt: 'The email field cannot be left empty.'
                },
                {
                    type: 'email',
                    prompt: 'The email field must contain a valid email.'
                }
            ]
        }
    },
    onSuccess: function(event,fields){
        var fileReader = new FileReader();
        fileReader.onload = function(element) {

        };
        fileReader.readAsText(fields.file);
    }
});

document.getElementById('fileUpload').addEventListener('change', readMultipleFiles, false);