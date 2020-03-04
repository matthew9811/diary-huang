let createError = require('http-errors');
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');
let weChatRouter = require("./routes/weChat");
let indexRouter = require('./routes/index');
let app = express();


app.use(logger('debug'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public',express.static('public'));
app.set('view engine','ejs');
app.use('/', indexRouter);
app.use("/weChat/huang", weChatRouter);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.json({
        message: err.message,
        error: err
    });
});
app.listen(1000);
module.exports = app;
