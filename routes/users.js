var express = require("express");
var router = express.Router();

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send(`respond with a resource ${process.env.TESTCONFIG}`);
});

module.exports = router;
