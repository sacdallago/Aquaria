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

// See leftBar.ejs

$('.fasta_file_id_selected').click(function(){
    var element = $(this).data();

    if(element.accession){
        startLogoSpin();
        AQUARIA.loadAccession([element.accession], null, null, false, element.name);
    } else {
        alert("This element has no accession number");
    }
});

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
                },
            ]
        },
    },
    onSuccess: function(event,fields){
        console.log(fields);
    }
})
;

document.getElementById('fileUpload').addEventListener('change', readMultipleFiles, false);