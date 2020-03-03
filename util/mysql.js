let mysql = require('mysql'); //调用MySQL模块
//创建一个连接池
let pool = mysql.createPool({
    host: '106.52.247.35', //主机
    user: 'huangbaoyin',     //数据库用户名
    password: 'BAOyin123+',     //数据库密码
    port: '3306',
    database: 'huang', //数据库名称
    charset: 'UTF8_GENERAL_CI' //数据库编码
});

module.exports.queryParams = function (sql, params) {
    console.log("sql语句为>>>>>   ", sql);
    console.log("参数为>>>>   ", params);
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                resolve(err);
                return;
            }
            connection.query(sql, params, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
                connection.replace();
            })
        })
    })
};

module.exports.query = function (sql) {
    console.log("sql语句为>>>>>   ", sql);
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                resolve(err);
                return;
            }
            connection.query(sql, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    console.info('result: ', result);
                    resolve(JSON.parse(JSON.stringify(result)));
                }
                // connection.replace();
            })
        })
    })
};

module.exports.transaction = function (sqlArr) {
    return new Promise(((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                resolve(err);
                return;
            }
            connection.beginTransaction(err => {
                if (err) {
                    connection.rollback(() => {
                        reject(err);
                    });
                }
                for (let i = 0, len = sqlArr.length; i < len; i++) {
                    query(sqlArr[i].catch((err) => {
                        connection.rollback(() => {
                            reject(err);
                        });
                    }));
                }
                connection.commit(err => {
                    if (err) {
                        connection.rollback(() => {
                            reject(err);
                        });
                    }
                })
                console.log("Transaction complete!");
                resolve('Transaction complete!');
                connection.replace();
            });
        });
    }));
};

module.exports.pool = pool;
