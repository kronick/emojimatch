$(document).ready(function() { 

    preloadFaces()
    animatePreview()

    //clearMessages(500, 10000)

    var errorCallback = function(e) {
        console.log('Reeeejected!', e);
    };


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

            video_scale = 1.0 * canvas.height / video_h
            console.log(video_scale)
            console.log("Video w: "  + video_w)
            console.log("Video h: "  + video_h)

            //$("#alignFaceView").fadeIn(300);
            
            //$("#attractorView").fadeIn()

            //startNewCapture()
            restart()
        };
    }, errorCallback);


    // Assign functions to buttons
    $("#showInstructions, #touchanywhere").on("pointerup", function() {
        $("#attractorView").transition({opacity: 0}, 500, function() {
            $("#attractorView").hide()
            startInstructions()
        })
    });
    $("#showAlignFace").on("pointerup", function() {
        $("#instructionsView").fadeOut();
        $("#alignFaceView").show().css("opacity", 0).transition({opacity: 1})
    });

    $("#startCapture").on("pointerup", startCountdown)

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

    fadeTouchIn();

    // Force attractor video to loop
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

    // Make sure scrolling is disabled everywhere
    $('body').bind('touchmove', function(e){e.preventDefault()})
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
        $("#attractorView").show().transition({opacity: 1}, 500, function() {
            _isResetting = false
        })
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

function startInstructions() {
    clearMessages()
    // addMessage("incoming", "static/emoji-03.png", "Welcome to Emoji Match!", 2000)
    // addMessage("incoming", "static/emoji-02.png", "Mimic each Emoji Face you see.", 5000)
    // clearMessages(500,8000)
    addMessage("outgoing", "static/emoji-03.png", "Welcome to Emoji Match! To start, tilt the tablet so your face fits in the circle above.", 1000) //9000)
    

    window.setTimeout(function() {
        $("#alignFaceView").show().css("opacity", 0).transition({opacity: 1})
        startVideoPreview();
        setRestartTimeout(30000);
    }, 1200)// 12000)
}

function startCountdown() {
    clearRestartTimeout();
    $("#alignFaceView").transition({opacity: 0});
    clearMessages(500)
    addMessage("outgoing", "static/emoji-02.png", "Looking good!", 1000)
    addMessage("incoming", "static/emoji-01.png", "Now mimic each Emoji Face you see...", 3000)

    window.setTimeout(function() {
        // Start capture
        clearMessages(1000)
        window.setTimeout(function() {
            triggerFlash()
            startNewCapture()
        }, 1000)
    }, 7000)
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

    $("#gifReviewView").hide();
    $("#matchEmojiCaptureView").show().css("opacity", 0).transition({opacity: 1})


    $("#captureProgress").find(".face").attr("src", "static/emoji-blank.png")
    $("#captureProgress").show().css("opacity", 0).transition({opacity: 1})


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
        
        //updateEmojiToMatch(snapCount+1) 
        //updateEmojiToMatch(Math.ceil(Math.random() * N_EMOJI)) 
        updateEmojiToMatch(face_index[snapCount])

        // $("#emojiCaptureBackground").css({scale: [1.0, 0], transformOrigin: '0 100%'})
        // $("#emojiCaptureBackground").transition({scale: [1.0, 1.0]}, capture_interval, "linear")

        $("#emojiCaptureBackground").css({scale: [0, 1.0], transformOrigin: '0 0'})
        $("#emojiCaptureBackground").transition({scale: [1.0, 1.0]}, capture_interval, "linear")

        snapTimer =  window.setInterval(function() {
            triggerFlash()

            // Copy recent image to progress faces
            $($("#captureProgress").find(".face")[snapCount]).attr("src", $("#emojiToMatch").attr("src"))
            
            // $("#emojiCaptureBackground").css({scale: [1.0, 0], transformOrigin: '0 100%'})
            // $("#emojiCaptureBackground").transition({scale: [1.0, 1.0]}, capture_interval, "linear")

            $("#emojiCaptureBackground").css({scale: [0, 1.0], transformOrigin: '0 0'})
            $("#emojiCaptureBackground").transition({scale: [1.0, 1.0]}, capture_interval, "linear")

            // Take a snapshot
            if(video_w > video_h)
                context.drawImage(v,(canvas.width - video_scale*video_w) / 2,0,video_w * video_scale,canvas.height);
            else
                context.drawImage(v,0,(canvas.height - video_scale*video_h) / 2,canvas.width, video_h * video_scale);

            context.drawImage(document.getElementById("emojiToMatch"), 250, 250, 150, 150)
            snapCount++

            $("#face" + snapCount).attr("src", canvas.toDataURL("image/jpeg"));

            if(snapCount >= N_FACES) {
                // Stop the snapshot timer
                window.clearInterval(snapTimer)
                
                $("#matchEmojiCaptureView").transition({opacity: 0}, 400, function() {
                    $("#final_gif").css({opacity: 0}).hide()
                    $("#gifReviewView").show().transition({opacity: 1}, 400, function() {

                        $("#animationPreview").show().transition({opacity: 1}, 500)
                        //animatePreview()
                        $("#uploadingIndicator").show().transition({opacity: 1}, 500)

                    });
                    
                    // Upload images
                    submitImages()
                });
            }
            else {
                //updateEmojiToMatch(Math.ceil(Math.random() * N_EMOJI)) 
                updateEmojiToMatch(face_index[snapCount])
            }

            

        }, capture_interval)
    })
    
}

function updateEmojiToMatch(n) {
    n = n < 10 ? ("0" + n) : n
    $("#emojiToMatch").attr("src", "static/emoji-large-" + n + ".png")
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
        url: 'gif',
        data: '{ "face1" : "' + facedata[0] + '", "face2" : "' + facedata[1] + '", "face3" : "' + facedata[2] + '", "face4" : "' + facedata[3] + '", "face5" : "' + facedata[4] + '"}',
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: function (msg) {
            // Upload is complete and GIF is ready!
            $("#captureProgress").transition({opacity: 0}).hide()

            console.log("Images uploaded: " + msg["status"] + " " + msg["gif_id"])

            var gif = new Image()
            gif.src = msg["gif_url"]
            // Wait until gif is loaded to show it
            gif.onload = function() {
                $("#final_gif").attr("src", msg["gif_url"])
                $("#final_gif_id").attr("value", msg["gif_id"])

                // Fade out the animation preview and show the real GIF
                $("#animationPreview").transition({opacity: 0}, 300, function() {
                    $("#animationPreview").hide()
                    $("#final_gif").show().transition({opacity: 1}, 500);
                    $("#uploadingIndicator").transition({opacity: 0}, 300, function() {
                        $("#uploadingIndicator").hide()
                        $("#deliveryForm").show().transition({opacity: 1})

                        clearMessages()
                        addMessage("outgoing", "static/emoji-03.png", "You look great! Put your phone number in and we'll text you your GIF.", 500)

                        setRestartTimeout(30000)
                    })
                })
            }
        },

        error: function(xhr, status) {
            addMessage("outgoing", "static/emoji-02.png", "Sorry, there was an error processing your GIF. Please try again!", 500)   
            $("#captureProgress").transition({opacity: 0}).hide()
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
            url: 'sms',
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
                    addMessage("outgoing", "static/emoji-04.png", "Your message is on its way! Thanks for using Emoji Match. 👌", 500)

                    setRestartTimeout(10000)
                });

                // TODO: Show link to reset
            },
            error: function (xhr, status) {
                console.log("Error sending SMS: " + status)
                // Show an error
                clearMessages()
                if(_textAttempts++ < 5) {
                    addMessage("outgoing", "static/emoji-02.png", "Sorry, there was an error sending your text. Check your number and please try again.", 500)
                }
                else {
                    addMessage("outgoing", "static/emoji-02.png", "Sorry, there was an error sending your text.", 500)   
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
        addMessage("outgoing", "static/emoji-02.png", "Please enter a valid phone number. 👿", 500)
        // $("#invalidNumber").fadeIn()
    }
}

function preloadFaces() {
    for(var i=1; i<=42; i++) {
        var n = i < 10 ? ("0" + i) : i
        $("#preload").append("<img src='static/emoji-large-" + n + ".png'>")
        $("#preload").append("<img src='static/emoji-small-" + n + ".png'>")
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
function triggerFlash() {
    $("#clickSound")[0].play()
    $("#flash").show().css("opacity", 1).delay(300).transition({opacity: 0}, 1000)
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
        }, duration*1.1)
    }, delay)
}


// --------------------------------------------
// UTILITIES


function shuffle(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}