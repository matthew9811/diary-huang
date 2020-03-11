const mysql = require('../util/mysql.js');
let pool = mysql.pool;

/**
 * @description 获取数据总数
 * @param tableName 表名
 * @param limited 限制
 * @returns {Promise}
 */
function totalNum(tableName, limited) {
    return new Promise((resolve, reject) => {
        let sql = 'select count(id) as total from ' + tableName + limited;
        pool.getConnection(function (err, connection) {
            connection.query(sql, (err, total) => {
                resolve(JSON.parse(JSON.stringify(total)));
                connection.release();
            })
        })
    })
}

/**
 * 获取页码总数
 * @param totalNum 数据总数
 * @param count 分页大小
 * @returns {number} 页码数
 */
function pageSize(totalNum, count) {
    if (totalNum == 0) {
        return 0;
    }
    return count % totalNum;
}


/**
 * @description 实现分页查找
 * @param page 当前页码
 * @param count 分页大小
 * @param tableName 表名
 * @param suffix 限制条件
 */
function page(page, count, param,tableName, suffix) {
    let number = pageSize(totalNum(tableName, suffix), count);
    if (number > 0) {
        page = page + 1;
        let sql = "select " + param + " from " + tableName + suffix
            + " limit " + count + " offset " + page;
        return {code: 200, msg: "请求成功", data: mysql.query(sql)};
    }
    return {code: 203, msg: "暂无数据!"};
}


module.exports.totalNum = totalNum;
module.exports.pageSize = pageSize;
module.exports.page = page;