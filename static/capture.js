var config = {
    "api_base": "https://www.diskcactus.com/emojimatch-dev/",
    "server_base": "https://www.diskcactus.com/",
    "local_base": "file:///storage/emulated/0/kioskbrowser/localcontent/",
    "emoji_base": "file:///storage/emulated/0/kioskbrowser/localcontent/",
}

var current_state;
var changing_states = false;

$(document).ready(function() { 
    current_state = states["launch"];
    current_state.enter();
});

function change_state(next) {
    next_state = states[next];
    // Check if this is a valid transition
    if(next_state != current_state && next_state.inlets.indexOf(current_state.name) != -1 && current_state.outlets.indexOf(next_state.name) != -1) {
        if(!changing_states) {
            console.log("Changing state from '" + current_state.name + "' to '" + next_state.name + "'")
            changing_states = true;
            $("#state").append(" -> " + next_state.name);
            current_state.exit(next_state.name, function() {
                next_state.enter(current_state.name);
                changing_states = false;
                current_state = next_state;
            });
        }
        else {
            console.log("Already busy changing states! BE PATIENT OR FIX TRANSITIONS");
        }    
    }
    else {
        console.log("INVALID STATE CHANGE");
        console.log("Current state: " + current_state.name);
        console.log("Outlets: " + current_state.outlets);
        console.log("Desired state: " + next_state.name);
        console.log("Inlets: " + next_state.inlets);
    }
    
}


states = {
    "launch": {
        name: "launch",
        inlets: [""],
        outlets: ["config", "attractor"],
        enter: function(prev) {
            // Initialize the page
            // -----------------------------------------------------------------------------
            
            // Handle url resources for remote and local filesystem deployments
            if(location.href.startsWith("http")) {
                config.local_base = config.api_base;
                config.emoji_base = config.api_base + "static/emoji-faces/";
            }
            
            preloadFaces();
            animatePreview();
        
            var hdConstraints = {
            video: {
                mandatory: {
                  maxWidth: 640,
                  maxHeight: 640    
                    }
                  }
            };
        
            navigator.webkitGetUserMedia(hdConstraints, function(localMediaStream) {
                var video = document.querySelector('video');
                video.src = window.URL.createObjectURL(localMediaStream);
        
        
                video.onloadedmetadata = function(e) {
                  // Ready to go. Do some stuff.
                    var v = document.getElementById('videoPreview');
                    var canvas = document.getElementById('c');
                    var context = canvas.getContext('2d');
        
                    canvas.width = 400;
                    canvas.height = 400;
        
                    video_w = $("#videoPreview").width();
                    video_h = $("#videoPreview").height();
        
                    video_scale = 1.0 * canvas.height / video_h;
                    console.log(video_scale);
                    console.log("Video w: "  + video_w);
                    console.log("Video h: "  + video_h);
        
                    //$("#alignFaceView").fadeIn(300);
                    
                    //$("#attractorView").fadeIn()
        
                    //startNewCapture()
                    change_state("attractor");
                    //restart();
                };
            }, function(e) { console.log('Unable to open camera!', e); });
        
        
            // Assign functions to buttons
            $("#touchanywhere").on("pointerup", function() {
                change_state("alignface");
            });
        
            $("#startCapture").on("pointerup", function() {
                change_state("instructions");
            })
        
            $("#sendText").on("pointerup", requestText)
            
            $(".restart").on("pointerup", restart)
        
            $("#phoneNumber").on("focus", function() {
                clearRestartTimeout();
                setRestartTimeout(60000);
            })
            $("#phoneNumber").on("blur", function() {
                clearRestartTimeout();
                setRestartTimeout(30000);
            })
        
            // Start the looping pulsing "touch to start" animation
            fadeTouchIn();
        
            // Force attractor video to loop
        /*
            var video = document.getElementById("attractor"); 
            //this did the trick
            video.loop = false; 
            video.addEventListener('ended', function() { 
                $(video).transition({opacity: 0}, 1000, function() {
                    video.load();
                    //window.setTimeout(function() { video.play() }, 200);
                    video.play()
                    window.setTimeout(function() { $(video).transition({opacity: 1}, 1000); }, 2000);
                })
            });
            video.play();
        */
        
            // Make sure scrolling is disabled everywhere
            $('body').bind('touchmove', function(e){e.preventDefault()})              
        },
        exit: function(next, complete) {
            complete();
        }
    },
    "config": {
        name: "config",
        inlets: ["attractor", "launch", "alignface"],
        outlets: ["attractor"],
        enter: function(prev) {
            
        },
        exit: function(next, complete) {
            complete();
        }
    },
    "attractor": {
        name: "attractor",
        inlets: ["config", "sendsms", "showgif", "alignface", "launch"],
        outlets: ["config", "alignface"],
        enter: function(prev) {
            clearMessages();
            $("#captureProgress").css({opacity: 0}).hide();
            $("#attractorView").css({opacity: 0}).show().transition({opacity: 1}, 500);
        },
        exit: function(next, complete) {
            $("#attractorView").transition({opacity: 0}, 500, function() {
                $("#attractorView").hide()
                complete();
            });
        }
    },
    "alignface": {
        name: "alignface",
        inlets: ["attractor"],
        outlets: ["instructions", "attractor", "config"],
        enter: function(prev) {
            // TODO: Set up inactivity timer to go back to "attractor" state
            //setRestartTimeout(30000);
            
            $("#alignFaceView").show().css("opacity", 0).transition({opacity: 1})
            startVideoPreview();
        },
        exit: function(next, complete) {
            //clearRestartTimeout();
            
            $("#alignFaceView").transition({opacity: 0}, 500, function() {
                $("#alignFaceView").hide();
                complete();    
            });
            
        }
    },
    "instructions": {
        // "instructions" state creates animations that autoplay without interaction and automatically moves on to next "capture" state
        name: "instructions",
        inlets: ["alignface"],
        outlets: ["capture"],
        enter: function(prev) {            
            $("#instructionsView").css({opacity: 1}).show();
            $("#instructionsView").find(".bubble").hide();
            $("#instructionsWelcome").css({opacity: 0}).show().transition({opacity: 1}, 500);
            window.setTimeout(function() {
                $("#instructionsMimic").css({opacity: 0}).show().transition({opacity: 1}, 500);

                window.setTimeout(function() {
                    $("#instructionsGetReady").css({opacity: 0}).show().transition({opacity: 1}, 500).delay(500).transition({opacity: 0}, 500).delay(500).transition({opacity: 1}, 500).delay(500).transition({opacity: 0}, 500).delay(500).transition({opacity: 1}, 500).delay(500).transition({opacity: 0}, 500);

                    window.setTimeout(function() {
                        $("#instructionsMimic").transition({opacity: 0}, 500);
                        $("#instructionsGetReady").transition({opacity: 0}, 500);
                        $("#instructionsWelcome").transition({opacity: 0}, 500, function() {
                            $("#instructionsView").children(".bubble").hide();
                            
                            $("#instructionsGo").css({opacity: 0}).show().transition({opacity: 1}, 500);
    
                            window.setTimeout(function() {
                                change_state("capture");
                            }, 1000);                                 
                        });
                    }, 5000);
                }, 1000);
            }, 1000);                               
        },
        exit: function(next, complete) {
            
            triggerFlash(false);
            $("#instructionsView").transition({opacity: 0}, 500, function() {
                $("#instructionsView").hide();
                complete();
            });
        }
    },
    "capture": {
        name: "capture",
        inlets: ["instructions"],
        outlets: ["showgif"],
        enter: function(prev) {
            //$("#gifReviewView").hide();
            $("#matchEmojiCaptureView").show().css("opacity", 0).transition({opacity: 1});     
        
            $("#captureProgress").find(".face").attr("src", config.emoji_base + "emoji-blank.png");
            $("#captureProgress").show().css("opacity", 0).transition({opacity: 1});
            
            startNewCapture();    
        },
        exit: function(next, complete) {
            $("#matchEmojiCaptureView").transition({opacity: 0}, 400, function() {
                // Upload images
                submitImages();
                complete();
            });
        }
    },
    "showgif": {
        name: "showgif",
        inlets: ["capture"],
        outlets: ["attractor", "sendsms"],
        enter: function(prev) {
            $("#final_gif").css({opacity: 0}).hide();
            $("#gifReviewView").show().transition({opacity: 1}, 400, function() {

                $("#animationPreview").show().transition({opacity: 1}, 500);
                //animatePreview()
                $("#uploadingIndicator").show().transition({opacity: 1}, 500);

            });
        },
        exit: function(next, complete) {
            if(next == "sendsms") {
                complete();
            }
            else {
                $("#gifReviewView").transition({opacity: 0}, 400, function() {
                    $("#gifReviewView").hide();
                    complete();
                })
            }    
        }
    },
    "sendsms": {
        name: "sendsms",
        inlets: ["showgif"],
        outlets: ["attractor"],
        enter: function(prev) {
            // Fade out the animation preview and show the real GIF
            $("#animationPreview").transition({opacity: 0}, 300, function() {
                $("#animationPreview").hide()
                $("#final_gif").show().transition({opacity: 1}, 500);
                $("#uploadingIndicator").transition({opacity: 0}, 300, function() {
                    $("#uploadingIndicator").hide()
                    $("#deliveryForm").show().transition({opacity: 1})

                    clearMessages()
                    addMessage("outgoing", config.emoji_base + "emoji-03.png", "You look great! Put your phone number in and we'll text you your GIF.", 500)

                    setRestartTimeout(30000)
                })
            })
        },
        exit: function(next, complete) {
            complete();
        }
    },
}


$(document).ready(function() { 


});

function fadeTouchIn() {
    $("#touchtext").transition({opacity: 1}, 700, fadeTouchOut)
}
function fadeTouchOut() {
    $("#touchtext").transition({opacity: 0.333}, 700, fadeTouchIn)
}

var _restartTimer
var _isResetting = false
var _textAttempts = 0
function restart() {
    if(_isResetting) return

    _isResetting = true
    clearRestartTimeout()

    $("#captureProgress").css({opacity: 0})

    clearMessages()
    $(".view").transition({opacity: 0}, 1000, function() {
        $(".view").hide()
        $(".eventMessage").hide()
    })
    
    window.setTimeout(function() {
        change_state("attractor");
        _isResetting = false;
        //startNewCapture()
    }, 1000)

    _textAttempts = 0
    $("#phoneNumber").val("")
}


function setRestartTimeout(delay) {
    clearRestartTimeout()
    _restartTimer = window.setTimeout(restart, delay)
}

function clearRestartTimeout() {
    if(typeof _restartTimer !== 'undefined')
        window.clearTimeout(_restartTimer)
}

var _videoPreviewRunning = false
var _previewContext, _previewCanvas, _previewVideoScale, _previewVideo, _previewVideo_w, _previewVideo_h

function startVideoPreview() {
    _previewVideo = document.getElementById('videoPreview');
    _previewCanvas = document.getElementById('c');
    _previewContext = _previewCanvas.getContext('2d');

    _previewCanvas.width = 600;
    _previewCanvas.height = 600;

    _previewVideo_w = $("#videoPreview").width();
    _previewVideo_h = $("#videoPreview").height();

    _previewVideoScale = (_previewVideo_w > _previewVideo_h) ? (1.0 * _previewCanvas.height / _previewVideo_h) : (1.0 * _previewCanvas.width / _previewVideo_w)

    _videoPreviewRunning = true
    $("#videoPreview").hide()
    $("#c").show().css("opacity", 0).transition({opacity: 1})

    window.requestAnimationFrame(getVideoPreviewFrame)
}

function getVideoPreviewFrame() {
    _previewContext.save()
    _previewContext.scale(-1, 1);
    _previewContext.translate(-_previewCanvas.width, 0)
    if(_videoPreviewRunning) {
        if(_previewVideo_w > _previewVideo_h)
            _previewContext.drawImage(_previewVideo,(_previewCanvas.width - _previewVideoScale*_previewVideo_w) / 2,0,_previewVideo_w * _previewVideoScale,_previewCanvas.height);
        else
            _previewContext.drawImage(_previewVideo,0,(_previewCanvas.height - _previewVideoScale*_previewVideo_h) / 2,_previewCanvas.width, _previewVideo_h * _previewVideoScale);
    }
    _previewContext.restore()

    _previewContext.beginPath();
    _previewContext.lineWidth = 30;
    var alpha = (Math.cos((new Date().getTime()) / 200) + 1) / 2 * .3 + 0.3;
    // console.log(alpha)
    _previewContext.strokeStyle = "rgba(255,255,255," + alpha + ")";
    _previewContext.arc(_previewCanvas.width / 2, _previewCanvas.height * .4, _previewCanvas.width * 0.33, 0, 2 * Math.PI)
    _previewContext.stroke();
    window.requestAnimationFrame(getVideoPreviewFrame)
}
function stopVideoPreview() {
    _videoPreviewRunning = false
    $("#c").transition({opacity: 0})
}

function startNewCapture() {
    var capture_interval = 2000;
    var N_EMOJI = 42;
    var N_FACES = 5;

    console.log("starting capture")
    var v = document.getElementById('videoPreview');
    var canvas = document.getElementById('c');
    var context = canvas.getContext('2d');

    canvas.width = 400;
    canvas.height = 400;

    video_w = $("#videoPreview").width();
    video_h = $("#videoPreview").height();

    video_scale = (video_w > video_h) ? (1.0 * canvas.height / video_h) : (1.0 * canvas.width / video_w);

    snapCount = 0
    // Select 5 unique random faces
    var face_index = []
    for(var i=0; i<N_EMOJI; i++)
        face_index.push(i+1)

    face_index = shuffle(face_index);

    $("#alignFaceView").fadeOut(300, function() {
        stopVideoPreview();
        
        updateEmojiToMatch(face_index[snapCount])

        $("#emojiCaptureBackground").css({scale: [0, 1.0], transformOrigin: '0 0'});
        $("#emojiCaptureBackground").transition({scale: [1.0, 1.0]}, capture_interval, "linear");

        snapTimer =  window.setInterval(function() {
            triggerFlash(true);

            // Copy recent image to progress faces
            $($("#captureProgress").find(".face")[snapCount]).attr("src", $("#emojiToMatch").attr("src"));

            $("#emojiCaptureBackground").css({scale: [0, 1.0], transformOrigin: '0 0'});
            $("#emojiCaptureBackground").transition({scale: [1.0, 1.0]}, capture_interval, "linear");

            // Take a snapshot
            if(video_w > video_h)
                context.drawImage(v,(canvas.width - video_scale*video_w) / 2,0,video_w * video_scale,canvas.height);
            else
                context.drawImage(v,0,(canvas.height - video_scale*video_h) / 2,canvas.width, video_h * video_scale);

            context.drawImage(document.getElementById("emojiToMatch"), 250, 250, 150, 150);
            snapCount++;

            $("#face" + snapCount).attr("src", canvas.toDataURL("image/jpeg"));

            if(snapCount >= N_FACES) {
                // Stop the snapshot timer
                window.clearInterval(snapTimer);
                
                change_state("showgif");
            }
            else {
                updateEmojiToMatch(face_index[snapCount]);
            }

        }, capture_interval)
    })
    
}

function updateEmojiToMatch(n) {
    n = n < 10 ? ("0" + n) : n
    //$("#emojiToMatch").attr("src", "static/emoji-faces/emoji-large-" + n + ".png")
    $("#emojiToMatch").attr("src", config.emoji_base + "emoji-large-" + n + ".png")
}

var currentAnimationFrame = 1;
var n_frames = 5;
function animatePreview() {

    old_frame = currentAnimationFrame;
    new_frame = old_frame + 1;
    if(new_frame > n_frames) new_frame = 1;
    currentAnimationFrame = new_frame;

    $("#face" + new_frame).show()
    $("#face" + old_frame).hide()

    window.setTimeout(animatePreview, 400);
}

// Get raw file data ready for upload
function submitImages() {
    facedata = []
    for(var i = 1; i<=n_frames; i++) {
        facedata.push($("#face" + i).attr("src").replace(/^data:image\/(png|jpg|jpeg);base64,/, ""))    
    }

    // Sending the image data to Server
    $.ajax({
        type: 'POST',
        url: config.api_base + 'gif',
        data: '{ "face1" : "' + facedata[0] + '", "face2" : "' + facedata[1] + '", "face3" : "' + facedata[2] + '", "face4" : "' + facedata[3] + '", "face5" : "' + facedata[4] + '"}',
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: function (msg) {
            // Upload is complete and GIF is ready!
            $("#captureProgress").transition({opacity: 0}, 500, function() {
                $("#captureProgress").hide();
            });

            console.log("Images uploaded: " + msg["status"] + " " + msg["gif_id"])

            var gif = new Image()
            gif.src = config.server_base + msg["gif_url"]
            // Wait until gif is loaded to show it
            gif.onload = function() {
                $("#final_gif").attr("src", config.server_base + msg["gif_url"])
                $("#final_gif_id").attr("value", msg["gif_id"])

                change_state("sendsms");
            }
        },

        error: function(xhr, status) {
            addMessage("outgoing", config.emoji_base + "emoji-02.png", "Sorry, there was an error processing your GIF. Please try again!", 500)   
            $("#captureProgress").transition({opacity: 0}, 500).hide()
            setRestartTimeout(5000)
        },
    });
}

function requestText() {
    clearRestartTimeout()

    if($("#phoneNumber").val() != "" && $("#phoneNumber").val().match(/\d/g).length>=10) {
        // Likely a valid number
        $("#deliveryForm").transition({opacity: 0}, 400, function() {
            $("#deliveryForm").hide()
            $("#sendingSMSIndicator").show().transition({opacity: 1})
        })
        // Sending the image data to Server
        $.ajax({
            type: 'POST',
            url: config.api_base + 'sms',
            data: '{ "phoneNumber" : "' + $("#phoneNumber").val() + '", "gifURL" : "' + $("#final_gif").attr("src") + '"}',
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            success: function (msg) {
                console.log("SMS request sent: " + msg["status"] + " " + msg["message"])
                $("#sendingSMSIndicator").transition({opacity: 0}, 400, function() {
                    $("#phoneNumber").val("")
                    $("#sendingSMSIndicator").hide()
                    $("#restartMessage").show().transition({opacity: 1}, 400)

                    clearMessages()
                    addMessage("outgoing", config.emoji_base + "emoji-04.png", "Your message is on its way! Thanks for using Emoji Match. 👌", 500)

                    setRestartTimeout(10000)
                });

                // TODO: Show link to reset
            },
            error: function (xhr, status) {
                console.log("Error sending SMS: " + status)
                // Show an error
                clearMessages()
                if(_textAttempts++ < 5) {
                    addMessage("outgoing", config.emoji_base + "emoji-02.png", "Sorry, there was an error sending your text. Check your number and please try again.", 500)
                }
                else {
                    addMessage("outgoing", config.emoji_base + "emoji-02.png", "Sorry, there was an error sending your text.", 500)   
                    setRestartTimeout(5000)
                }

                $("#sendingSMSIndicator").transition({opacity: 0}, 400, function() {
                    $("#sendingSMSIndicator").hide()
                    $("#deliveryForm").show().transition({opacity: 1})
                })

            }
        });
    }
    else {
        // Show an error
        clearMessages()
        addMessage("outgoing", config.emoji_base + "emoji-02.png", "Please enter a valid phone number. 👿", 500)
        // $("#invalidNumber").fadeIn()
    }
}

function preloadFaces() {
    for(var i=1; i<=42; i++) {
        var n = i < 10 ? ("0" + i) : i
        $("#preload").append("<img src='" + config.emoji_base + "emoji-large-" + n + ".png'>")
        $("#preload").append("<img src='" + config.emoji_base + "emoji-small-" + n + ".png'>")
    }
}

var _messageIDcount = 0
function addMessage(direction, avatar, text, delay) {
    delay = typeof delay !== 'undefined' ? delay : 0
    if(direction != "incoming" && direction != "outgoing")
        direction = "incoming"

    var newMessage = $("<div class='message " + direction + "'></div>");
    newMessage.append("<div class='avatar'><img src='" + avatar + "'></div>")

    newMessageText = $("<div class='text'>...</div>")
    newMessageText.attr("data-text", text)
    newMessage.append(newMessageText)
    this_id = _messageIDcount++
    newMessage.attr("data-id", this_id)

    newMessage.hide()
    newMessage.appendTo("#conversationView")

    window.setTimeout(function() {
        $("#popSound")[0].play()
        newMessage.css("opacity", 0).show().transition({opacity: 1}, 300)
        $("#conversationView").transition({y: "-=" + $(newMessage).height()}, 500, function() {
        //newMessage.delay(delay).slideDown(500, function() {
        //newMessage.delay(delay).transition({y: "-=256"}, function() {    // transition y is fast on tablet
            // textEl = $(this).find(".text").first()
            // thisthis = this
            textEl = newMessage.find(".text").first()
            thisthis = newMessage
            setTimeout(function() {
                textEl.html(textEl.attr("data-text"))
                $(thisthis).find(".avatar").first().transition({ scale: .8 }, 200).transition({ scale: 1}, 200)
            }, 200 + 10 * textEl.attr("data-text").length)
        })
    }, delay)

    return newMessage
}
function triggerFlash(sound) {
    if(sound) $("#clickSound")[0].play();
    $("#flash").show().css("opacity", 1).delay(300).transition({opacity: 0}, 1000);
}

function clearMessages(duration, delay) {
    delay = typeof delay !== 'undefined' ? delay : 0
    duration = typeof duration !== 'undefined' ? duration : 300
    setTimeout(function() { 
        $(".message").each(function() {
            if($(this).is(":visible")) {    // Only get rid of messages that are visible, not those that are queued up
                //$(this).stop().fadeOut(duration, function() {
                $(this).stop().transition({opacity: 0}, duration, function() {
                    $(this).remove()
                })
            }
        })

        window.setTimeout(function() {
            $("#conversationView").transition({y: $("#conversationMask").height()}, 0)
        }, duration*1.01)
    }, delay)
}


// --------------------------------------------
// UTILITIES


function shuffle(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}