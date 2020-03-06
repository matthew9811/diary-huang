const request = require("request");
const COS = require('cos-nodejs-sdk-v5');


let cos = new COS({
    SecretId: 'AKIDiJgneGs24sQlrg4xKSM1tWt1zjEjR43m',
    // 控制文件上传并发数
    FileParallelLimit: 3,
    SecretKey: 'ctvjHgy1pMdfV6S8ankWVGl1C8pzua2G'
});

function requestPromise(options) {
    console.log(options);
    return new Promise((resolve, reject) => {
        request(options, (error, response, body) => {
            if (error) {
                resolve(error);
            }
            resolve(JSON.parse(body));
        });
    });
}


function putFile(file, fileName) {
    return new Promise(((resolve, reject) => {
        cos.putObject({
            Bucket: '47-1256569009', /* 桶名必须 */
            Region: 'ap-chengdu',    /* 桶域必须 */
            Key: fileName,              /* id必须 */
            // StorageClass: 'STANDARD',
            Body: file, // 上传文件对象
            onProgress: function (progressData) {
                console.log(JSON.stringify(progressData));
            }
        }, function (err, data) {
            console.log(err || data);
            if (!err) {
                resolve(data);
            }
        });
    }));
}

module.exports.requestPromise = requestPromise;
module.exports.putFile = putFile;