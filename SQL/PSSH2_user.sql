/*
**  Author: Christian Dallago
**  Date: 2016.04.01
**  
*/

/*
**  This table will contain information on the pssh submitted via Aquaria
**  and the ones processed after a sequence upload via the PSSH2 script.
**
**  N.B.: Needs to be InnoDB to relate the hash between this and protein_sequence_uploaded
*/

DROP TABLE IF EXISTS `PSSH2_user`;


CREATE TABLE `PSSH2_user` (
  `protein_sequence_hash` char(32) NOT NULL DEFAULT '',
  `PDB_chain_hash` char(32) NOT NULL DEFAULT '',
  `Repeat_domains` int(5) NOT NULL,
  `E_value` float NOT NULL,
  `Identity_Score` int(3) NOT NULL,
  `Match_length` int(11) DEFAULT NULL,
  `Alignment` text NOT NULL,
  PRIMARY KEY (`protein_sequence_hash`,`PDB_chain_hash`,`Repeat_domains`),
  FOREIGN KEY (`protein_sequence_hash`) REFERENCES protein_sequence_uploaded(`MD5_Hash`) ON DELETE CASCADE,
  INDEX `identityScoreIndex` (`Identity_Score`),
  INDEX `eValueIndex` (`E_value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;