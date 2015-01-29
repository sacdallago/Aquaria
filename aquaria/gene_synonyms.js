// example of how to make an sql statement to query the database.
var connector = require('../common/connector');

module.exports.function_name = (function () {
   connector.query("INSERT_SQL_STATEMENT_HERE e.g. SELECT Description FROM protein_sequence WHERE Primary_Accesion = ?", "P04637", callback_function, pass_in_variable);
});

callback_function (data, pass_in_variable) {
	console.log (data[0].Description);
}
