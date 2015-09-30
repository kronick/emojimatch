
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

            $("#attractorView").fadeIn()
            //$("#alignFaceView").fadeIn(300);
        };
    }, errorCallback);

    // Assign functions to buttons
    $("#showInstructions").on("pointerup", function() {
        $("#attractorView").fadeOut();
        $("#instructionsView").fadeIn();
    });
    $("#showAlignFace").on("pointerup", function() {
        $("#instructionsView").fadeOut();
        $("#alignFaceView").fadeIn();
    });

    $("#startCapture").on("pointerup", startNewCapture)

    $("#sendText").on("pointerup", requestText);
});

function startNewCapture() {
    $("#gifReviewView").hide();
    $("#matchEmojiCaptureView").fadeIn("300")


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
        updateEmojiToMatch(snapCount+1) 
        snapTimer =  window.setInterval(function() {
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

        }, 1000)
    })
    
}

function updateEmojiToMatch(n) {
    $("#emojiToMatch").attr("src", "static/emoji-0" + n + ".png")
}

function requestText() {
    if($("#phoneNumber").match(/\d/g).length===10) {
        // Likely a valid number
    }
    else {
        // Show an error
        $("#invalidNumber").fadeIn()
    }
}