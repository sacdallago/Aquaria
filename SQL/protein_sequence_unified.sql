/*
**  Author: Christian Dallago
**  Date: 2016.03.08
**  
*/

/*
**  This view will contain the union between protein_sequence and protein_sequence_upload
**  which are respectively the table containing sequences imported from other dbs and
**  the table containing the sequences uploaded by users and calculated via PSSH2 
*/
DROP VIEW IF EXISTS `protein_sequence_unified`;
CREATE VIEW protein_sequence_unified AS
    SELECT Primary_Accession, Sequence, MD5_Hash, Description, Length, true as pssh_finished FROM `protein_sequence`
    UNION ALL 
    SELECT Null as Primary_Accession, Sequence, MD5_Hash, Description, Length, pssh_finished FROM `protein_sequence_uploaded`;