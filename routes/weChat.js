let express = require('express');
let router = express.Router();
//导入mysq配置文件
const mysql = require('../util/mysql');
const common = require('../util/common');
const uuid = require('node-uuid');
let pool = mysql.pool;
/**
 * @api {POST} /login
 * @apiDescription 获取登录时所需的信息，并完成授权
 * @apiParam jsCode
 * @apiParam appid
 * @apiParam secret
 */
router.get("/login", async function (req, resp) {
    let body = req.body;
    let jsCode = body.jsCode;
    let appid = body.appid;
    let secret = body.secret;
    console.log("jsCode:  " + jsCode);
    //拼接url
    let url = "https://api.weixin.qq.com/sns/jscode2session?" +
        "appid=" + appid + "&secret=" + secret + "&js_code=" + jsCode + "&grant_type=authorization_code";
    let requestPromise = await common.requestPromise({
        url: url
    });
    await pool.getConnection(function (err, connection) {
        //如果不为空，进行数据库操作，为空返回错误信息
        if (requestPromise.errcode == 0) {
            let openid = requestPromise.openid;
            //进行判断
            connection.beginTransaction(function (err) {
                connection.query("select count(*) as num from customer", (err, data) => {
                    let parse = JSON.parse(JSON.stringify(data));
                    if (parse[0].num == 0) {
                        openid = '1';
                        let sql = "insert into customer (openid) value (" + openid + ")";
                        connection.query(sql, (err, result) => {
                            console.log(result);
                        });
                    }
                    console.log("data: ", parse);
                    resp.json(data)
                });
                connection.commit();
            });
            connection.release()

        } else {
            resp.send({code: 401, msg: "jsCode不可用!"})
        }
    });
});

/**
 * @api {GET} /test
 * @apiDescription 用于测试，返回信息没有特定格式
 *
 */
router.get("/test", async function (req, resp) {

});
module.exports = router;