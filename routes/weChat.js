let express = require('express');
let router = express.Router();
//导入mysq配置文件
const mysql = require('../util/mysql');
const common = require('../util/common');
const uuid = require('node-uuid');
const fs = require("fs");
const multer = require('multer');
let upload = multer();
let pool = mysql.pool;
/**
 * @api {POST} /login
 * @apiDescription 获取登录时所需的信息，并完成授权
 * @apiParam jsCode
 * @apiParam appid
 * @apiParam secret
 */
router.post("/login", upload.single('chatHead'), async function (req, resp) {
    let body = req.body;
    let jsCode = body.jsCode;
    let appid = body.appid;
    let secret = body.secret;
    let nickname = body.nickname;
    let chatHead = req.file;
    console.log("jsCode:  " + jsCode);
    //拼接url
    let url = "https://api.weixin.qq.com/sns/jscode2session?" +
        "appid=" + appid + "&secret=" + secret + "&js_code=" + jsCode + "&grant_type=authorization_code";
    let requestPromise = await common.requestPromise({url: url});
    //如果不为空，进行数据库操作，为空返回错误信息
    if (requestPromise.openid != null && requestPromise.openid != undefined) {
        await pool.getConnection(function (err, connection) {
            let openid = requestPromise.openid;
            //开启事务管理
            connection.beginTransaction(function (err) {

                connection.query("select count(*) as num from customer where openid = '" + openid + "'", (err, data) => {
                    console.log(data || err);
                    let parse = JSON.parse(JSON.stringify(data));
                    // 没有数据
                    if (parse[0].num == 0) {
                        let portraitUrl = uuid() + '.' + chatHead.originalname.split('.')[1];
                        let putFile = common.putFile(chatHead.buffer, portraitUrl);
                        let sql = "insert into customer (openid, nickname, portrait_url) value " +
                            "('" + openid + "','" + nickname + "','" + portraitUrl + "')";
                        connection.query(sql, (err, result) => {
                            console.log(err || result);
                            //插入成功
                            if (!err) {
                                //返回信息
                                resp.send({
                                    code: 200, msg: '登录成功!', data: {
                                        openid: openid
                                    }
                                });
                                return;
                            }

                        });
                    } else {
                        //第二次登录，直接返回
                        resp.send({
                            code: 200, msg: '登录成功!', data: {
                                openid: openid
                            }
                        });
                        return;
                    }
                });
                connection.commit();
            });
            connection.release()
        });
    } else {
        resp.send({code: 401, msg: "jsCode不可用!"})
    }

});


/**
 * @api {POST} /test
 * @apiDescription 用于测试，返回信息没有特定格式
 *
 */
router.post("/test", upload.any(), async function (req, resp) {
    let files = req.files;
    let names = [];
    for (let f = 0, len = files.length; f < len; f++) {
        let originalname = uuid() + '.' + files[f].originalname.split('.')[1];
        names.push(originalname);
        console.log(common.putFile(files[f].buffer, (originalname)));
        console.log(files[f].buffer);
    }
    // console.log(data.originalname);
    resp.send(names);
});
module.exports = router;