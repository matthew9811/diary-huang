let express = require('express');
let router = express.Router();
//导入mysq配置文件
const mysql = require('../util/mysql');
const common = require('../util/common');
const pageHelper = require('../util/pageHelper');
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
        await pool.getConnection((err, connection) => {
            let openid = requestPromise.openid;
            //开启事务管理
            connection.beginTransaction((error) => {
                connection.query("select count(*) as num from customer where openid = '" + openid + "'", (err, data) => {
                    console.log(data || error);
                    let parse = JSON.parse(JSON.stringify(data));
                    // 没有数据
                    if (parse[0].num == 0) {
                        let portraitUrl = common.fileKey(chatHead);
                        let putFile = common.putFile(chatHead.buffer, portraitUrl);
                        let sql = "insert into customer (openid, nickname, portrait_url) value " +
                            "('" + openid + "','" + nickname + "','" + portraitUrl + "')";
                        connection.query(sql, (err, result) => {
                            console.log(err || result);
                            //插入成功
                            if (!err) {
                                //返回信息
                                resp.json({
                                    code: 200, msg: '登录成功!', data: {
                                        openid: openid
                                    }
                                });
                                return;
                            }

                        });
                    } else {
                        //第二次登录，直接返回
                        resp.json({
                            code: 200, msg: '登录成功!', data: {
                                openid: openid
                            }
                        });
                        return;
                    }
                });

            });
            connection.commit();
            connection.release()
        });
    } else {
        resp.json({code: 401, msg: "jsCode不可用!"})
    }

});


/**
 * @description 获取所有已审核的数据
 * @api {GET} /getDiaryList
 * @apiParam count 分页大小
 * @apiParam page 页码 默认为 0
 */
router.get("/getDiaryList", async (req, resp) => {
    let param = req.query;
    let count = param.count;
    let page = param.page;
    let totalNum = await pageHelper.page(page, count, 'food_diary.title, food_diary.id, food_diary.diary_url, ' +
        'count( collect.diary_id ) as collectNum, image.url as cover, customer.nickname ',
        " food_diary LEFT JOIN collect ON food_diary.id = collect.diary_id " +
        " LEFT JOIN image ON food_diary.id = image.diary_id AND image.sort = 0 " +
        " LEFT JOIN customer ON customer.openid = food_diary.openid ",
        " WHERE food_diary.`status` = 1 GROUP BY food_diary.id, image.url, customer.nickname");
    resp.json(totalNum);
});

/**
 * @description 搜索日记
 * @api #{GET} /searchDiary
 * @apiParam count 分页大小
 * @apiParam page 页数
 * @apiParam tempTitle 需要搜索的标题
 *
 */
router.get('/searchDiary', async (req, resp) => {
    let param = req.query;
    let tempTitle = param.tempTitle;
    let count = param.count;
    let page = param.page;
    let totalNum = await pageHelper.page(page, count, " food_diary.title, food_diary.id, food_diary.diary_url, " +
        " count( collect.diary_id ) as collectNum, image.url as cover ",
        " food_diary LEFT JOIN collect ON food_diary.id = collect.diary_id " +
        " LEFT JOIN image ON food_diary.id = image.diary_id AND image.sort = 0 " +
        " LEFT JOIN customer ON customer.openid = food_diary.openid ",
        " where food_diary.`status` = 1 AND title like '%" + tempTitle + "%' " +
        " GROUP BY food_diary.id, image.url, customer.nickname ");
    resp.json(totalNum);
});

/**
 * @description 上传笔记
 * @api #{POST} /uploadDiary
 * @apiParam openid
 * @apiParam title
 * @ApiParam content 内容
 */
router.post('/uploadDiary', async (req, resp) => {
    let body = req.body;
    let openid = body.openid;
    let title = body.title;
    let content = body.content;
    let fileKey = common.fileName('html');
    //上传文件
    let putFile = await common.putFile(new Buffer(content, 'utf-8'), fileKey);

    //获取连接
    await pool.getConnection((err, conn) => {
        // 开启事务`
        conn.beginTransaction(err => {
            //插入日记主表数据并获取对应的数据id
            let sql = "INSERT INTO food_diary(diary_url, openid, title, `status`, create_time) " +
                "VALUES( \'" + fileKey.concat("\',\'") + openid.concat("\',\'")
                + title.concat("\', \'2\',NOW()") + " )";
            conn.query(sql, function (err, data) {
                let insertId = data.insertId;
                if (insertId) {
                    resp.json({code: 200, msg: "保存成功", diaryId: insertId});
                } else {
                    resp.json({code: 500, msg: '保存失败'});
                }
            });
            //判断并返回结果
        });
        conn.commit();
        conn.release();
    });
});

/**
 * @api #{POST} /
 * @description 上传日记对应的图片
 * @param diaryId 对应日记的id
 * @param images 图片数组
 */
router.post('/uploadDiaryImages', upload.any(), async (req, res) => {
    let diaryId = req.body.diaryId;
    let files = req.files;
    let arrObj = new Array(files.length);

    await pool.getConnection((err, conn) => {
        conn.beginTransaction(err => {
            for (let i = 0, len = files.length; i < len; i++) {
                let fileKey = common.fileKey(files[i]);
                arrObj[i] = {num: i, name: fileKey};
                common.putFile(files[i].buffer, fileKey);
            }
            console.log(arrObj);
            let sql = "INSERT INTO image(url, sort, diary_id) VALUES ";
            for (let i = 0, len = arrObj.length; i < len; i++) {
                sql = sql.concat('(  \"' + arrObj[i].name + '\", ' + arrObj[i].num + ', ' + diaryId + ')');
                if (i != len - 1) {
                    sql = sql.concat(',');
                }
            }
            conn.query(sql, (err, data) => {
                if (!err) {
                    conn.commit();
                    conn.release();
                    res.json({code: 200, msg: '保存成功!'});
                } else {
                    res.json({code: 500, msg: '服务器异常!'});
                }
            });
        });
    });
});

/**
 * @description 获取审核列表
 * @api #{GET} /auditList
 * @apiParam count 分页大小
 * @apiParam page 页码 默认为 0
 */
router.get('/auditList', function (req, resp) {
    let param = req.param;
    let page = param.page;
    let count = param.count;
    resp.json(pageHelper.page(page, count, ' id, title ',
        ' food_diary ', ' where status = 2 '))
});

/**
 * @description 提交审核
 * @api #{POST} /submitAudit
 * @apiParam diaryId 文章id
 * @apiParam status 审核结果 审核通过 1 ；不通过 0；未审核 2；
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
                        resp.json({code: 200, msg: "审核成功!", data: "审核成功 " + data + "条数据"})
                    } else {
                        resp.json({code: 201, msg: "审核失败", data: "无对应数据！"});
                    }
                } else {
                    resp.json({code: 500, msg: "审核失败", data: err});
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
    let query = await mysql.query("select count(id) as count from manager where password = '" + req.query.pwd + "'");
    console.log(query);
    if (query[0].count == 1) {
        resp.json({code: 200, msg: 'password is true'});
    } else {
        resp.json({code: 201, msg: 'password is false'});
    }
});

/**
 * @description 收藏对应的日记
 * @api #{GET} /collect
 * @apiParam openid  收藏人openid
 * @apiParam diaryId 日记id
 */
router.get('/collect', async (req, resp) => {
    let query = req.query;
    let openid = query.openid;
    let diaryId = query.diaryId;
    let sql = "INSERT collect(openid, diary_id) VALUE( '" + openid + "', " + diaryId + ")";
    //获取连接
    pool.getConnection((err, connection) => {
        //开启事务
        connection.beginTransaction(err => {
            //进行判断，确定是否已经收藏
            connection.query("SELECT count( id ) as count " +
                " FROM  collect  WHERE openid = '" + openid + "' AND diary_id = " + diaryId,
                (err, data) => {
                    if (data) {
                        let countData = JSON.parse(JSON.stringify(data))[0].count;
                        if (countData > 0) {
                            resp.json({code: 202, msg: '收藏失败', data: '不能重复收藏!'});
                        } else {
                            //调用sql
                            connection.query(sql, function (err, result) {
                                if (err) {
                                    resp.json(err);
                                }
                                let parse = JSON.parse(JSON.stringify(result));
                                //插入成功
                                if (parse.affectedRows == 1) {
                                    resp.json({code: 200, msg: '收藏成功！'})
                                } else {
                                    resp.json({code: 500, msg: '数据库操作失败!'})
                                }

                            });
                        }
                    }
                })
        });
        connection.commit();
        connection.release();
    });
});

/**
 * @description 取消对应的收藏记录
 * @api #{GET} /cancelCollect
 * @apiParam openid  收藏人openid
 * @apiParam diaryId 日记id
 */
router.get('/cancelCollect', async (req, resp) => {
    let query = req.query;
    let openid = query.openid;
    let diaryId = query.diaryId;
    //从连接池获取数据
    pool.getConnection((err, conn) => {
        //开启事务
        conn.beginTransaction(err => {
            //进行数据库数据校验，查看是否已收藏
            conn.query("SELECT COUNT(id) as count FROM collect WHERE openid = '" + openid
                + "' AND diary_id = " + diaryId, function (err, result) {
                if (err) {
                    resp.json({code: 500, msg: '数据库服务器故障!'});
                } else {
                    let count = JSON.parse(JSON.stringify(result))[0].count;
                    //存在数据，进行取消
                    if (count > 0) {
                        let sql = "delete from collect where openid = '" + openid
                            + "' and diary_id = " + diaryId;
                        conn.query(sql, (err, result) => {
                            if (result) {
                                let affectedRows = JSON.parse(JSON.stringify(result)).affectedRows;
                                if (affectedRows > 0) {
                                    resp.json({code: 200, msg: '取消成功!'});
                                } else {
                                    resp.json({code: 203, msg: '取消失败!', data: '尚未收藏'});
                                }
                            }
                        });
                    } else {
                        resp.json({code: 203, msg: '取消失败', data: '尚未收藏!'});
                    }
                }
            });
        });
        conn.commit();
        conn.release();
    });
});

/**
 * @description 获取用户个人信息
 * @ApiParam openid
 */
router.get('/userMsg', async (req, res)=>{
    let query = req.query;
    let openid = query.openid;
    let promise = mysql.query('SELECT ' +
        ' id, ' +
        ' openid, ' +
        ' nickname, ' +
        ' portrait_url ' +
        'FROM ' +
        ' customer  ' +
        'WHERE ' +
        ' openid = "' + openid + '"');
    //后期看需求更改
    res.json(promise);
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