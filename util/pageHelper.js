const mysql = require('../util/mysql.js');
let pool = mysql.pool;

function totalNum(tableName, next) {
    let sql = 'select count(id) as total from ' + tableName + next;
    return new Promise((resolve, reject) => {
        pool.getConnection(function(err, connection) {
            if (err) {
                reject(err);
                return;
            }
            connection.query(sql, (err, total) => {
                resolve(JSON.parse(JSON.stringify(total)));
                connection.release();
            })
        })
    })
}

module.exports.totalNum = totalNum;