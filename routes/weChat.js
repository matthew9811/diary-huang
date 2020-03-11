let express = require('express');
let router = express.Router();
//导入mysq配置文件
const mysql = require('../util/mysql');
const common = require('../util/common');
const pageHelper = require('../util/pageHelper');
const uuid = require('node-uuid');
const fs = require("fs");
const multer = require('multer');
let upload = multer();
let pool = mysql.pool;
/**
 * @api {POST} /login
 * @apiDescription 获取登录时所需的信息，并完成授权
 * 使用post请求完成对应的文件上传
 * @apiParam jsCode jscode
 * @apiParam appid appid
 * @apiParam secret 密钥
 * @apiParam nickname 昵称
 * @apiParam chatHead 头像文件
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
 * @description 获取所有已审核的数据
 * @api {GET} /getDiaryList
 * @apiParam count 分页大小
 * @apiParam page 页码 默认为 0
 */
router.get("/getDiaryList", (req, resp) => {
    let param = req.param;
    let count = param.count;
    let page = param.page;
    let totalNum = pageHelper.page(page, count, '*', " food_diary ",
        " where status = 1");
    resp.json(totalNum);
});

/**
 * @description 搜索日记
 * @api #{GET} /searchDiary
 * @apiParam count 分页大小
 * @apiParam tempTitle 需要搜索的标题
 *
 */
router.get('/searchDiary', (req, resp) => {
    let param = req.param;
    let tempTitle = param.tempTitle;
    let count = param.count;
    let totalNum = pageHelper.page(page, count, " id, title ", " food_diary ",
        " where title like %" + tempTitle + "% status = 1");
    resp.json(totalNum);
});

/**
 * @description 上传笔记
 */
router.post('/uploadDiary', upload.any(), (req, resp) => {

});

/**
 * @description 获取审核列表
 * @api #{GET}
 * @apiParam count 分页大小
 * @apiParam page 页码 默认为 0
 */
router.get('/auditList', function (req, resp) {
    let param = req.param;
    let page = param.page;
    let count = param.count;
    resp.json(pageHelper.page(page, count, ' id, title ',
        ' food_diary ', ' where status = -1 '))
});

/**
 * @description 提交审核
 * @api #{POST} /submitAudit
 * @apiParam diaryId 文章id
 * @apiParam status 审核结果 审核通过 1 ；不通过 0；未审核 -1；
 * @apiParam reviewerOpenId 审核人openId
 */
router.post('/submitAudit', async function (req, resp) {
    let body = req.body;
    let diaryId = body.diaryId;
    let status = body.status;
    let reviewerOpenid = body.reviewerOpenid;
    //开启事务
    pool.getConnection((err, connection) => {
        connection.beginTransaction((err) => {
            let sql = "UPDATE food_diary " +
                " SET `status` = " + status +
                ", reviewer_openid = '" + reviewerOpenid +
                "', review_time = NOW() " +
                " WHERE " +
                " id = " + diaryId;
            connection.query(sql, (err, result) => {
                if (result) {
                    let data = JSON.parse(JSON.stringify(result));
                    if (data > 0) {
                        resp.send({code: 200, msg: "审核成功!", data: "审核成功 " + data + "条数据"})
                    } else {
                        resp.send({code: 201, msg: "审核失败", data: "无对应数据！"});
                    }
                } else {
                    resp.send({code: 500, msg: "审核失败", data: err});
                }
            });
            connection.commit();
            connection.release();
        })
    });
});

/**
 * @description 管理员登录
 * @api #{GET}
 * @apiParam pwd 密码
 */
router.get('/managerLogin', async (req, resp) => {
    let query = mysql.query("select count(id) as count from manager where password = '" + req.query.pwd + "'");
    console.log(query);
    if (query == 1) {
        resp.send({code: 200, msg: 'password is true'});
    } else {
        resp.send({code: 201, msg: 'password is false'});
    }
});


/**
 * @api {POST} /test
 * @apiDescription 用于测试，返回信息没有特定格式
 *
 */
router.post("/test", upload.any(), async function (req, resp) {
    let tableName = "customer";
    let pageTotalNum = await pageHelper.totalNum(tableName, '');
    console.log(pageTotalNum[0].total);
    await resp.json(pageTotalNum);
});
module.exports = router;