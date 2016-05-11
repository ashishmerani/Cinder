/* jshint browser: true, jquery: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, nonew: true, quotmark: double, undef: true, unused: true, strict: true, trailing: true */
/* global console: true*/
 "use strict";
 var express =   require("express");
 var multer  =   require("multer");
 var app     =   express();
 var storage =   multer.diskStorage({
   destination: function (req, file, callback) {
     callback(null, "./userphotos");
   },
    //  Replace Date() by real userId we have new file name with format: userPhoto-userId
   filename: function (req, file, callback) {
     callback(null, file.fieldname + "-" + Date.now() + ".jpg");
   }
 });
 var upload = multer({ storage : storage}).single("userPhoto");

 app.use(express.static(__dirname + "/"));

   app.post("/",function(req,res){
     upload(req,res,function(err) {
         if(err) {
           console.log("Error uploading file.");
             return res.end();
         }
         console.log("File is uploaded");
         res.end(      );
     });
 });

 app.listen(3000,function(){
     console.log("Working on port 3000");
 });
