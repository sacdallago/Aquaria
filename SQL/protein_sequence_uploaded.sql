/*
**  Author: Christian Dallago
**  Date: 2016.03.08
**  
*/

/*
**  This table will contain information on the sequences submitted via Aquaria
**  and to be processed via the PSSH2 script.
**
**  N.B.: Needs to be InnoDB to relate the hash between this and PSSH2_user
*/
DROP TABLE IF EXISTS `protein_sequence_uploaded`;

CREATE TABLE `protein_sequence_uploaded` (
    `Sequence` text NOT NULL,
    `MD5_Hash` varchar(50) NOT NULL,
    `Length` int(10) unsigned DEFAULT NULL,
    `Description` mediumtext,
    `email` varchar(254) NOT NULL,
    `pssh_finished` tinyint(1) NOT NULL DEFAULT '0',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY `MD5_Hash` (`MD5_Hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


/*
**  This trigger will check that the email inserted with an INSERT on the above table is valid.
*/
DROP TRIGGER IF EXISTS protein_sequence_uploaded.emailRegex;

delimiter //
CREATE TRIGGER emailRegex BEFORE INSERT ON protein_sequence_uploaded
FOR EACH ROW 
	BEGIN 
		IF (NEW.email REGEXP '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' ) = 0 THEN 
  			SIGNAL SQLSTATE '12345'
     		SET MESSAGE_TEXT = 'Email not valid';
		END IF;
	END;//


/*
**  This trigger will put the length of the sequence in the length column of the above table
*/
DROP TRIGGER IF EXISTS protein_sequence_uploaded.countSequence;

delimiter //
CREATE TRIGGER countSequence BEFORE INSERT ON protein_sequence_uploaded
FOR EACH ROW 
    BEGIN 
        set NEW.Length = LENGTH(NEW.Sequence);
        IF (NEW.Length) = 0 THEN 
  			SIGNAL SQLSTATE '12346'
     		SET MESSAGE_TEXT = 'No sequence';
		END IF;
    END;//