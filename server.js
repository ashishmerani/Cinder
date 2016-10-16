// Server-side code
/* jshint node: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, nonew: true, quotmark: double, undef: true, unused: true, strict: true, trailing: true */
"use strict";
var express = require("express"),
    bodyParser = require("body-parser"),
    bcrypt = require("bcryptjs"),
    mongo = require("mongoose"),
    sessions = require("client-sessions"),
    multer = require("multer"),
    app = express(),
    port = process.env.PORT || 8000, // Use Cloud Foundry port if it is available
    mongoURL = "mongodb://localhost/accounts",
    http = require("http").Server(app), // for socket.io
    io = require("socket.io")(http),
    userAndSocket = {}, // object that stores username to socketid value
    onlineUsers = []; // array that stores current logged in users

// If Cloud Foundry service is available
if (process.env.VCAP_SERVICES) {
    mongoURL = JSON.parse(process.env.VCAP_SERVICES).mlab[0].credentials.uri;
}

// connect to mongoDB
mongo.connect(mongoURL);

var userSchema = mongo.Schema({
    // 1 unique username per account
    username: {
        type: String,
        unique: true
    },
    first: String,
    last: String,
    // 1 unique email per account
    email: {
        type: String,
        unique: true
    },
    password: String,
    hackerBuddies: [String],
    language: String,
    scientist: String,
    variable: String,
    picURL: String
});

// access the collection table called Users
var Users = mongo.model("Users", userSchema);

// Storage for uploaded photos
var storage = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, "./Client/img/profile_pic");
    },
    filename: function(req, file, callback) {
        var indexAnExtensionBegins = file.originalname.indexOf(".");
        var fileExtension = file.originalname.substr(indexAnExtensionBegins, file.originalname.length - indexAnExtensionBegins);
        Users.update({
            username: req.session.user.username
        }, {
            $set: {
                picURL: "img/profile_pic/" + req.session.user._id + fileExtension
            }
        }, function(err) {
            if (err !== null) {
                console.log("Cannot update a profile picture");
            }
        });
        callback(null, req.session.user._id + fileExtension);
    }
});

// Upload function
var upload = multer({
    storage: storage
}).single("profile_pic");

// Start listening at port 3000
http.listen(port, function() {
    console.log("Server is listening at port " + port);
});

// Set static route to html files.
app.use(express.static(__dirname + "/Client"));

// used for parsing content type: application/json
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// setup the configurations for client-sessions
app.use(sessions({
    cookieName: "session", // cookie name dictates the key name added to the request object
    secret: "#lj39*(D823jf9*D793j3ldflj3,mn<Mnkjwe", // should be a large unguessable string
    duration: 30 * 60 * 1000, // how long the session will stay valid in ms

    // If expiresIn < activeDuration, the session will be extended by activeDuration milliseconds
    // to prevent the user from being logged out while they are using the site.
    activeDuration: 5 * 60 * 1000
}));

/* SocketIO, Chatroom code */
io.use(function(socket, next) {
    // get the current username of from localStorage
    var username = socket.handshake.query.user;

    console.log("Query: ", username);

    // if username is in onlineUsers array, update socket in userAndSocket object
    if (onlineUsers.indexOf(username) !== -1) {
        socket.name = username;
        userAndSocket[socket.name] = socket.id;

    }
    // authorization set, will go on the io.sockets.on('connection') portion of code
    next();

    console.log("After connection, userAndSocket object is: ");
    console.log(userAndSocket);
});

io.sockets.on("connection", function(socket) {

    console.log("Current list of active users: " + onlineUsers);
    console.log(socket.id);

    socket.on("new online user", function(data) {
        console.log("new online user");
        socket.username = data;
        onlineUsers.push(socket.username);
        console.log("After a new user logsin, updated array is ");
        console.log(onlineUsers);

    });

    socket.on("delete user", function(data) {

        var userToDelete = data;

        for (var i = 0; i < onlineUsers.length; i++) {
            if (onlineUsers[i] === userToDelete) {
                console.log("This user is no longer active " + onlineUsers[i]);
                // delete user from array
                onlineUsers.splice(i, 1);

                //remove from userAndSocket object
                delete userAndSocket[userToDelete];
                console.log(userAndSocket);
            }
        }

        console.log(onlineUsers);
    });

    socket.on("chat", function(data) {
        var fromUser = data.userWhoSent;
        var toUser = data.userToSend;
        var msg = data.msg;
        console.log("send chat to: " + toUser);
        console.log("msg from user: " + fromUser);
        if (toUser in userAndSocket) {

            // holding socketid of username that will receive message
            var userSocketId = userAndSocket[toUser];

            // send to private socket
            // note socket.broadcast only sends to other sockets
            // this prevents user from sending message to her/himself
            socket.broadcast.to(userSocketId).emit("get msg", {
                "msg": msg,
                "fromUser": fromUser
            });
        }

    });

});

// checks for session info everytime user visits a page
app.use(function(req, res, next) {
    if (req.session && req.session.user) {
        Users.findOne({
            email: req.session.user.email
        }, function(err, user) {
            if (user) {
                req.user = user;
                delete req.user.password;
                req.session.user = req.user; // refresh the session
            }
            next();
        });
    } else {
        next();
    }
});

function loginRequired(req, res, next) {
    if (!req.user) {
        console.log("User must be logged in to access this page");
        res.redirect("/index.html#login");
    } else {
        next();
    }
}

/* ROUTES are defined below */

// return requested user session
app.get("/userSession", function(req, res) {
    res.json(req.session.user);
});

// Route for uploading a profile picture
app.post("/postProfilePic", function(req, res) {
    upload(req, res, function(err) {
        if (err) {
            console.log("Error uploading file.");
            res.redirect("settings.html");
        } else {
            console.log("File is uploaded");
            res.redirect("settings.html");
        }
    });
});

// return an array of hacker buddies from user's profile to populate their homepage
app.get("/buddies", loginRequired, function(req, res) {
    Users.findOne({
            username: req.session.user.username
        },
        function(err, user) {
            if (err) {
                res.send("Error. " + err);
            } else {
                Users.find({
                    username: {
                        $in: user.hackerBuddies
                    }
                }, function(err, data) {
                    res.send(data);
                });
            }
        });
});

app.delete("/buddies", loginRequired, function(req, res) {
    Users.update({
            username: req.session.user.username
        }, {
            $pull: {
                hackerBuddies: req.body.buddy
            }
        },
        function(err) {
            if (err) {
                res.send("error: cannot remove " + req.body.buddy);
            } else {
                console.log("User removed " + req.body.buddy);
                res.json({
                    status: "Successfully removed " + req.body.buddy
                });
            }
        }
    );
});

app.get("/checklogin", function(req, res) {
    if (req.session && req.session.user) {
        res.status("200").send(req.session.user.username);
    } else {
        res.status("401").send({
            error: "Unauthorized. Please login first"
        });
    }
});

app.get("/profile", loginRequired, function(req, res) {
    res.redirect("/profile.html");
});

app.get("/match", loginRequired, function(req, res) {
    res.redirect("/match.html");
});

app.get("/settings", loginRequired, function(req, res) {
    res.redirect("/settings.html");
});

// login via mongoDB accounts database
app.post("/login", function(req, res) {
    console.log("User login for user: " + req.body.username);

    // search mongoDB for user's email
    Users.findOne({
        username: req.body.username
    }, function(err, user) {
        if (!user) {
            res.send(" this username is not registered.");
        } else {
            bcrypt.compare(req.body.password, user.password, function(err, result) {
                if (result === true) {
                    console.log(req.body.username + " logged in successfully");
                    req.session.user = user;
                    res.json({
                        success: "logged in"
                    });
                } else {
                    console.log(req.body.username + " could not log in");
                    res.send("your password was wrong.");
                }

            });
        }
    });
});

app.post("/register", function(req, res) {
    // check to make sure both password fields match
    if (req.body.pass1 === req.body.pass2) {
        bcrypt.genSalt(10, function(err, salt) {
            if (err) {
                console.log(err);
                return err;
            }

            bcrypt.hash(req.body.pass1, salt, function(err, hash) {
                if (err) {
                    console.log(err);
                    return err;
                }
                var newUser = new Users({
                    username: req.body.username,
                    first: req.body.first,
                    last: req.body.last,
                    email: req.body.email,
                    password: hash,
                    language: req.body.language,
                    scientist: req.body.scientist,
                    variable: req.body.variable,
                    picURL: req.body.picURL
                });

                // attempt to insert the new user account to mongo
                newUser.save(function(err) {
                    if (err) {
                        console.log(err);
                        var error = "Error... Try again!";
                        if (err.code === 11000) {
                            error = "Email or username has already registered. ";
                        }
                        res.send(error);
                    } else {
                        //req.session.user = user; ??
                        console.log("A new user was registered on the system.");
                        //res.status("200").send("User was registered.");
                        res.send("200");
                    }
                });
            });
        });
    } else {
        res.send("Make sure your passwords match. ");
    }
});

// allows users to update user profile from settings page
app.post("/updateProfile", loginRequired, function(req, res) {
    console.log("User is updating profile");

    Users.update({
            email: req.session.user.email
        }, {
            $set: {
                username: req.body.username,
                first: req.body.first,
                last: req.body.last,
                email: req.body.email,
                password: req.body.pass,
                language: req.body.language,
                scientist: req.body.scientist,
                variable: req.body.variable
            }
        },
        function(err) {
            if (err === null) {
                // Return json to trigger success function in $.ajax
                res.json({
                    status: "Profile updated."
                });
            } else {
                res.send("Updating database failed.");
            }
        });
});

// a right swipe on the match page adds a buddy to their favorites
app.post("/addBuddy", loginRequired, function(req, res) {
    var newBuddy = req.body.username;
    console.log("User is adding a new hacker buddy! " + newBuddy);

    Users.update({
            email: req.session.user.email
        }, {
            $addToSet: {
                hackerBuddies: newBuddy
            }
        },
        function(err) {

            if (err === null) {
                res.send("Hacker buddy was added!");
            } else {
                res.send("Error, could not add buddy." + err);
            }
        });
});

app.get("/logout", function(req, res) {
    console.log("User logging out");
    req.session.reset(); // erase session cookies
    res.redirect("/");
});

// Routing for a match page
app.get("/matchUsers", function(req, res) {
    if (req.session && req.session.user) {
        // Find users who has at least one same atrribute
        Users.find({
            $and: [{
                _id: {
                    $ne: req.session.user._id
                }
            }, {
                $or: [{
                    language: req.session.user.language
                }, {
                    scientist: req.session.user.scientist
                }, {
                    variable: req.session.user.variable
                }]
            }]
        }, function(err, user) {
            if (err) {
                res.send("error");
            } else {
                res.json(user);
            }
        });
    } else {
        res.status("401").send("Unauthorized. Please login first");
    }
});
