
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
            console.log("Images uploaded: " + msg["status"] + " " + msg["gif_id"])
            $("#final_gif").attr("src", msg["gif_url"])
            $("#final_gif_id").attr("value", msg["gif_id"])

            $("#animationPreview").fadeOut(300, function() {
                $("#final_gif").fadeIn(500);
                $("#uploadingIndicator").fadeOut(300, function() {
                    $("#deliveryForm").fadeIn()
                })
            })
        },
    });
}

$(document).ready(function() { 

    preloadFaces()

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
            $("#attractorView").fadeIn()
        };
    }, errorCallback);


    // Assign functions to buttons
    $("#showInstructions").on("pointerup", function() {
        $("#attractorView").fadeOut(500, function() {
            startInstructions()
        })
    });
    $("#showAlignFace").on("pointerup", function() {
        $("#instructionsView").fadeOut();
        $("#alignFaceView").show().css("opacity", 0).transition({opacity: 1})
    });

    $("#sendText").on("pointerup", requestText);
});

function startInstructions() {
    addMessage("incoming", "static/emoji-03.png", "Welcome to Emoji Match!", 2000)
    addMessage("incoming", "static/emoji-02.png", "Mimic each Emoji Face you see.", 5000)
    clearMessages(500,8000)
    addMessage("outgoing", "static/emoji-01.png", "To start, tilt the tablet so it can see your face.<br><br><center><div class='button' id='startCapture'>OK 🙌</div></center>", 8001)
    

    window.setTimeout(function() {
        $("#startCapture").on("pointerup", startCountdown)
        $("#alignFaceView").show().css("opacity", 0).transition({opacity: 1})
        startVideoPreview();
    }, 12000)
}

function startCountdown() {
    $("#alignFaceView").fadeOut();
    clearMessages()
    addMessage("outgoing", "static/emoji-02.png", "Looking good!", 1000)
    addMessage("incoming", "static/emoji-01.png", "Now get ready...", 3000)
    addMessage("incoming", "static/emoji-03.png", "3...", 5000)
    addMessage("incoming", "static/emoji-02.png", "2...", 7000)
    addMessage("incoming", "static/emoji-04.png", "1...", 9000)

    window.setTimeout(function() {
        // Start capture
        clearMessages()
        window.setTimeout(function() {
            triggerFlash()
            startNewCapture()
        }, 500)
    }, 11000)
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
    window.requestAnimationFrame(getVideoPreviewFrame)
}
function stopVideoPreview() {
    _videoPreviewRunning = false
    $("#c").transition({opacity: 0})
}

function startNewCapture() {
    $("#gifReviewView").hide();
    $("#matchEmojiCaptureView").show().css("opacity", 0).transition({opacity: 1})


    console.log("starting capture")
    var v = document.getElementById('videoPreview');
    var canvas = document.getElementById('c');
    var context = canvas.getContext('2d');

    canvas.width = 400;
    canvas.height = 400;

    video_w = $("#videoPreview").width();
    video_h = $("#videoPreview").height();

    video_scale = (video_w > video_h) ? (1.0 * canvas.height / video_h) : (1.0 * canvas.width / video_w)


    snapCount = 0
    $("#alignFaceView").fadeOut(300, function() {
        stopVideoPreview();
        updateEmojiToMatch(snapCount+1) 
        snapTimer =  window.setInterval(function() {
            triggerFlash()
            // Take a snapshot
            if(video_w > video_h)
                context.drawImage(v,(canvas.width - video_scale*video_w) / 2,0,video_w * video_scale,canvas.height);
            else
                context.drawImage(v,0,(canvas.height - video_scale*video_h) / 2,canvas.width, video_h * video_scale);

            context.drawImage(document.getElementById("emojiToMatch"), 250, 250, 150, 150)
            snapCount++

            $("#face" + snapCount).attr("src", canvas.toDataURL("image/jpeg"));

            if(snapCount >= 5) {
                // Stop the snapshot timer
                window.clearInterval(snapTimer)
                
                $("#matchEmojiCaptureView").fadeOut(400, function() {
                    $("#gifReviewView").fadeIn(400, function() {

                        $("#animationPreview").show()
                        animatePreview()
                        $("#uploadingIndicator").fadeIn()

                    });
                    
                    // Upload images
                    submitImages()
                });
            }
            else {
                updateEmojiToMatch(snapCount+1)
            }

        }, 4000)
    })
    
}

function updateEmojiToMatch(n) {
    $("#emojiToMatch").attr("src", "static/emoji-0" + n + ".png")
}

function requestText() {
    if($("#phoneNumber").val().match(/\d/g).length>=10) {
        // Likely a valid number
        $("#deliveryForm").fadeOut(400, function() {
            $("#sendingSMSIndicator").fadeIn()
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
                $("#sendingSMSIndicator").fadeOut(400, function() {
                    $("#SMSSuccess").fadeIn()
                });

                // TODO: Show link to reset
            },
        });
    }
    else {
        // Show an error
        $("#invalidNumber").fadeIn()
    }
}

function preloadFaces() {
    for(var i=1; i<=5; i++)
        $("#preload").append("<img src='static/emoji-0" + i + ".png'>")
}

var _messageIDcount = 0
function addMessage(direction, avatar, text, delay) {
    delay = typeof delay !== 'undefined' ? delay : 0
    if(direction != "incoming" && direction != "outgoing")
        direction = "incoming"

    newMessage = $("<div class='message " + direction + "'></div>");
    newMessage.append("<div class='avatar'><img src='" + avatar + "'></div>")

    newMessageText = $("<div class='text'>...</div>")
    newMessageText.attr("data-text", text)
    newMessage.append(newMessageText)
    this_id = _messageIDcount++
    newMessage.attr("data-id", this_id)

    newMessage.hide()
    newMessage.appendTo("#conversationView")
    newMessage.delay(delay).slideDown(500, function() {

    //newMessage.delay(delay).transition({y: "-=256"}, function() {    // transition y is fast on tablet
        textEl = $(this).find(".text").first()
        thisthis = this
        setTimeout(function() {
            textEl.html(textEl.attr("data-text"))
            $(thisthis).find(".avatar").first().transition({ scale: .8 }, 200).transition({ scale: 1}, 200)
        }, 1000 + 10 * textEl.attr("data-text").length)
    })

    return newMessage
}
function triggerFlash() {
    $("#flash").show().css("opacity", 1).delay(300).transition({opacity: 0}, 1000)
}

function clearMessages(duration, delay) {
    delay = typeof delay !== 'undefined' ? delay : 0
    console.log(delay)
    setTimeout(function() { 
        $(".message").each(function() {
            if($(this).is(":visible")) {    // Only get rid of messages that are visible, not those that are queued up
                //$(this).stop().fadeOut(duration, function() {
                $(this).stop().transition({opacity: 0}, duration, function() {
                    $(this).remove()
                })
            }
        })
    }, delay)
}