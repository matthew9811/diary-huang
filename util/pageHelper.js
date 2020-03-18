const mysql = require('../util/mysql.js');
let pool = mysql.pool;

/**
 * @description 获取数据总数
 * @param tableName 表名
 * @param limited 限制
 * @returns {Promise}
 */
async function totalNum(tableName, limited) {
    return new Promise((resolve, reject) => {
        let sql = 'select count(id) as total from ' + tableName + limited;
        pool.getConnection(function (err, connection) {
            connection.query(sql, (err, total) => {
                if (err) {
                    console.log(err);
                } else {
                    resolve(JSON.parse(JSON.stringify(total)));
                    connection.release();
                }
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
    let number = parseInt(count);
    if (totalNum > number) {
        return 1;
    }
    if (totalNum == 0) {
        return 0;
    }
    return number % totalNum;
}


/**
 * @description 实现分页查找
 * @param page 当前页码
 * @param count 分页大小
 * @param tableName 表名
 * @param suffix 限制条件
 */
async function page(page, count, param, tableName, suffix) {
    let promise = await totalNum(tableName, suffix);
    let number;
    let total = promise[0].total;
    let countNum = parseInt(count);
    if (total == 0) {
        number = 0;
    } else if (countNum > total) {
        number = 1
    } else if (countNum < total) {
        if (total % countNum == 0) {
            number = total / countNum;
        } else {
            number = total / countNum + 1;
        }
    }
    if (number > 0) {
        let sql = "select " + param + " from " + tableName + suffix
            + " limit " + count + " offset " + parseInt(page);
        let data = await mysql.query(sql);
        return data;
    }
    return new Promise((resolve => resolve({code: 203, msg: "暂无数据!"})));
}


module.exports.totalNum = totalNum;
module.exports.pageSize = pageSize;
module.exports.page = page;