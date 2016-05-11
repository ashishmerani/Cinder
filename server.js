"use strict";
var express = require("express"),
    //http = require("http"),
    bodyParser = require("body-parser"),
    mongo = require("mongoose"),
    sessions = require("client-sessions"),
    app = express(),
    port = process.env.PORT || 3000,
    mongoURL = process.env.MONGODB_URI || "mongodb://localhost/accounts";

// Start listening at port 3000
app.listen(port, function() {
    console.log("Server is listening at port " + port);
});

// connect to mongoDB
mongo.connect(mongoURL);

var userSchema = mongo.Schema({
    username: { type: String, unique: true }, // 1 unique username per account
    first: String,
    last: String,
    email: { type: String, unique: true },    // 1 unique email per account
    password: String,
    hackerBuddies: [String],
    language: String,
    scientist: String,
    variable: String
});

// access the collection table called Users
var Users = mongo.model("Users", userSchema);

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

    // add the below options for a more secure configuration
    //     httpOnly: true,  // prevents browser JavaScript from accessing cookies
    //     secure: true,    // ensures cookies are only used over https
    //     emphemeral: true // deletes the cookie when browser is closed
}));

// restrict user from trying to access static html pages?
// app.use(function(req, res, next) {
//     if ((req.path.indexOf("html") >= 0)){
//         console.log("User trying to visit static html page");
//         res.redirect("/login");
//     }
//     next();
// });

// checks for session info everytime user visits a page
app.use(function(req, res, next) {
    if (req.session && req.session.user) {
        Users.findOne({ email: req.session.user.email}, function(err, user) {
            if(user){
                req.user = user;
                delete req.user.password;
                req.session.user = req.user;    // refresh the session
            }
        next();
        });
    } else {
        next();
    }
});

function loginRequired(req, res, next) {
    if(!req.user){
        console.log("User must be logged in to access this page");
        res.redirect("/index.html#login");
    } else {
        next();
    }
}

/* ROUTES are defined below */

// return an array of hacker buddies from user's profile to populate their homepage
// ************************ Still working on this ****************
app.get("/buddies", loginRequired, function(req, res) {
    Users.findOne({ username: req.session.user.username },
        function(err, user) {
            if (err) {
                res.send("Error. " + err);
            } else {
                Users.find({ username: { $in: user.hackerBuddies } }, function (err, data) {
                    res.send(data);
                });
            }
    });
});

app.delete("/buddies", loginRequired, function(req, res) {
    Users.update({ username: req.session.user.username },
        { $pull: { hackerBuddies: req.body.buddy } },
        function(err, user) {
            if (err) {
                res.send("error: cannot remove " + req.body.buddy);
            } else {
                console.log("User removed " + req.body.buddy);
                res.json( { status: "Successfully reomoved " + req.body.buddy } );
            }
        }
    );
});

app.get("/checklogin", function(req, res) {
    if (req.session && req.session.user) {
        res.status("200").send(req.session.user.username);
    } else {
        res.status("401").send({ error: "Unauthorized. Please login first" });
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
            res.send("you are not registered.");
        } else {
            if (user.password === req.body.password) {
                console.log("Password matches");
                console.log(user);
                req.session.user = user;
                res.json({ success: "logged in" });
                //res.status("200").json({ success: "logged in." });
                //res.redirect("/profile");
            } else {
                console.log("Wrong password");
                res.send("your email or password was wrong.");
            }
        }
    });
});

app.post("/register", function(req, res) {
    // check to make sure both password fields match
    if (req.body.pass1 === req.body.pass2) {
        var newUser = new Users({
            username: req.body.username,
            first: req.body.first,
            last: req.body.last,
            email: req.body.email,
            password: req.body.pass1,
            language: req.body.language,
            scientist: req.body.scientist,
            variable: req.body.variable
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
    } else {
        res.send("Make sure your passwords match. ");
    }
});

// allows users to update user profile from settings page
app.post("/updateProfile", loginRequired, function(req, res) {
    console.log("User is updating profile");

    Users.update({ email: req.session.user.email },
        {
            $set: {
                language: req.body.language,
                scientist: req.body.scientist,
                variable: req.body.variable
            }
        },
        function(err) {
            if (err === null) {
                // Return json to trigger success function in $.ajax
                res.json({ status:"Profile updated." });
            } else {
                res.send("Updating database failed.");
            }
        });
});

// a right swipe on the match page adds a buddy to their favorites
app.post("/addBuddy", loginRequired, function(req, res) {
    var newBuddy = req.body.username;
    console.log("User is adding a new hacker buddy! " + newBuddy);

    Users.update({ email: req.session.user.email },
        {
            $addToSet: { hackerBuddies : newBuddy }
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

// returns user attributes
app.get("/customData", loginRequired, function(req, res) {
    Users.findOne({ email: req.session.user.email }, function(err, user) {
        if (err) {
            res.json({ error: err });
        } else {
            // returns the following
            // var data = {
            //     username: String,
            //     first: String,
            //     last: String,
            //     email : String,
            //     language : String,
            //     scientist : String,
            //     variable : String
            // }

            var data = user;
            delete data.password; // remove the user password from object
            delete data.hackerBuddies;
            console.log(data);
            res.json(data);
        }
    });
});

// Routing for a match page
app.get("/matchUsers", function(req, res) {
    if (req.session && req.session.user) {
        // Find users who has at least one same atrribute
        Users.find( {
            $and : [
                { _id: { $ne: req.session.user._id } },
                { $or:
                    [
                        { language: req.session.user.language },
                        { scientist: req.session.user.scientist },
                        { variable: req.session.user.variable }
                    ]
                }
            ]
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
