var jTinder = function () {
    var audio; // Credit: Audio files from http://www.livetim.tim.com.br/emotisounds/
    var lastEffect = _.sample(dislikedEffects, 1)[0];
    var likedList = [];
    var dislikedList = [];
    var currentIndex = -1;
    
    var $tinderSlideDiv = $("#tinderslide");

    var likedEffects = [
        {
            emoji: "😘",
            soundFile: "face-throwing-a-kiss.mp3"
        },
        {
            emoji: "💋",
            soundFile: "kiss-mark.mp3"
        },
        {
            emoji: "🎹",
            soundFile: "musical-notes.mp3"
        },
        {
            emoji: "🎉",
            soundFile: "party-popper.mp3"
        },
        {
            emoji: "😉",
            soundFile: "winking-face.mp3"
        }
    ];

    var dislikedEffects = [
        {
            emoji: "😤",
            soundFile: "face-with-look-of-triumph.mp3"
        },
        {
            emoji: "😣",
            soundFile: "disappointed-face.mp3"
        },
        {
            emoji: "🐐",
            soundFile: "goat.mp3"
        },
        {
            emoji: "🔪",
            soundFile: "hocho.mp3"
        },
        {
            emoji: "😠",
            soundFile: "angry-face.mp3"
        }
    ];
    
    var showResult = function () {
        $tinderSlideDiv.delay(800).hide( function () {
            var $container = $(".wrap");
            
            if(likedList.length === 0) {
                noMatchPrompt(false, "We ran out of your matches. : (");
            } else {
                $container.append($("<h4>").text("You liked:"));
                
                likedList.forEach(function (name) {
                    $container.append($("<p>").text(name)).slideDown();
                });
            }
            
            setTimeout(function () {
                $("span h3").remove();
                $container.fadeOut().empty();
                $container.append($("<h4>").text("Redirecting to a profile page...")).fadeIn();
            }, 6000);
            
            setTimeout(function () {
                location.reload();
                window.location.replace("/profile.html");
            }, 10000);
        });
    }

    var flickResponse = function (effect) {
            $('#status').html(effect.emoji).show();
            audio = new Audio("../sounds/" + effect.soundFile);
            audio.play();
    };

    $tinderSlideDiv.jTinder({
        // dislike callback
        onDislike: function (item) {
            currentIndex = item.index();
            dislikedList.push($(".fade:nth-child(" + (currentIndex + 1) + ") h4").text());
            // set the status text
            var effect = _.sample(dislikedEffects, 1)[0];

            while (lastEffect === effect) {
                effect = _.sample(dislikedEffects, 1)[0];
            }

            flickResponse(effect);
            lastEffect = effect;
            if (currentIndex === 0) {
                showResult();
            }
        },
        // like callback
        onLike: function (item) {
            currentIndex = item.index();
            var username = $(".fade:nth-child(" + (currentIndex + 1) + ") h4").text();
            likedList.push(username);
            $.ajax({
                url: "/addBuddy",
                type: "POST", 
                dataType: "json",
                data: { username: username },
                success: function (res) {
                    console.log(res.responseText);
                },
                error: function (res) {
                    console.log(res.responseText);
                }
            });
                
            // set the status text
            var effect = _.sample(likedEffects, 1)[0];

            while (lastEffect === effect) {
                effect = _.sample(likedEffects, 1)[0];
            }

            flickResponse(effect);
            lastEffect = effect;
            
            if (currentIndex === 0) {
                showResult();
            }
        },
        animationRevertSpeed: 150,
        animationSpeed: 300,
        threshold: 1
    });
}

var noMatchPrompt = function (showHeart, msg) {
    var powerfulQuotes = [
        { 
            first: "“And suddenly you just know … ",
            second: "it’s time to start something new and trust the magic of beginnings.” - Meister Eckhart"
        },
        {
            first: "“It might take a year. It might take a day.",
            second: "But, what’s meant to be will always find a way.” - Unknown"
        },
        {
            first: "“We are sometimes taken into troubled waters",
            second: "not be drowned but to be cleansed.” - Unkown"
        },
        {
            first: "“Difficult roads",
            second: "often lead to beautiful destinations.” - Unkown"
        },
        {
            first: "“Faith and fear both demand you believe",
            second: "in something you cannot see. You choose.” – Bob Proctor"
        }
    ];
    
    var $icon;
    if(showHeart) {
        $icon = $("<i>").attr( { class: "fa fa-heart-o fa-5x fa-fw margin-bottom", "aria-hidden":"true" } );
    }
    
    $("span h3").remove();
    var $h3 = $("<h3>").text(msg);
    var quote = _.sample(powerfulQuotes);
    var $p2 = $("<p>").text(quote.first);
    var $p3 = $("<p>").text(quote.second);
    
    var $span = $("<span>").append($icon, $("<br>"), $("<br>"), $("<br>"), $h3, $p2, $p3).fadeIn();
    $(".wrap").append($span);
}

ko.bindingHandlers.fadeVisible = {
    init: function(element, valueAccessor) {
        var shouldDisplay = valueAccessor();
        $(element).toggle(shouldDisplay);
    },
    update: function(element, valueAccessor) {
        var shouldDisplay = valueAccessor();
        shouldDisplay ? $(element).fadeIn() : $(element).fadeOut();
    }
};

function appViewModel () {
    var $tinderSlideDiv = $("#tinderslide");
    
    // Populate a match page
    $tinderSlideDiv.hide();
    
    var self = this;
    self.users = ko.observableArray([]);
    
    var incrementCount = function () {
        
    }
        
    $.ajax({
        url: "/matchUsers",
        type: "GET", 
        dataType: "json",
        success: function (data) {
            if(data.length === 0) {
                setTimeout(function () {
                    $(".wrap span i, .wrap span p").fadeOut(function () {
                        $(".wrap span i, .wrap span p, .wrap span br").remove();
                            noMatchPrompt(true, "Cannnot find your match");
                    });
                }, 2000);
            }
            else {
                self.users(data);
                $tinderSlideDiv.removeClass("hidden");
                setTimeout(function () {
                    $(".wrap span i, .wrap span p").fadeOut(function () {
                        $(".wrap span i, .wrap span p, .wrap span br").remove();
                        $tinderSlideDiv.slideDown();
                        jTinder();
                    });
                }, 2000);
            }
        },
        error: function (error){
            $(".wrap span p").text(error.responseText).fadeIn();
        }
    });
    
}

ko.applyBindings( new appViewModel() );