var config = {
    "max_frames": 24,
    "flipTime": 400,
    "flipStagger": 100,
    "logoRatio": 1.4513,
}
var state = {
    "hashtag": "#SamsungEmojiMatch",
    "lastTimestamp": 0,
    "lastCheckTime": 0,
    "downloadingImages": false,
    "gifs": [],
    "simulatedGifIndex": 6
}

$(document).ready(function() { 
    $(window).resize(updateDimensions);

    updateDimensions(); 
    // TODO: Check to see if event/hashtag cookie is set. Show selector screen if not.
    state.refreshInterval = window.setInterval(function () {
        if(!state.downloadingImages && ((Date.now() - state.lastCheckTime) / 1000) > 3) {
            state.downloadingImages = true;
            getNewGifs(updateFrames);
        }
    }, 500);
    
    // Link buttons to actions
    $(".toggleAdmin").click(function() {
        if($("#admin").is(":visible")) {
            $("#admin").transition({"opacity": 0}, function() { $("#admin").hide(); });
        }
        else {
            $("#admin").css("opacity", 0).show().transition({"opacity": 1});
        }
    })
    
    $("body,html").css("background-color", bgcolor);
    $("body,html").css("color", fgcolor);
});



function updateDimensions() {
    // Keep container zoomed to 100% width
    //n_cols = $(window).width() > $(window).height() ? 6 : 4
    //n_rows = $(window).width() > $(window).height() ? 3 : 6
    n_cols = $(window).width() > $(window).height() ? 6 : 3
    n_rows = $(window).width() > $(window).height() ? 3 : 5
    n_frames = $(window).width() > $(window).height() ? (n_cols * n_rows - 3) : (n_cols * n_rows - 8);
    
    var min_top_height = 60;
    if($(window).width() > $(window).height()) {
        $("#container").removeClass("portrait");
    }
    else {
        $("#container").addClass("portrait");
        min_top_height = 120;
    }
    
    $("#container").css("width", 420*n_cols+20)
    $("#container").css("zoom", $(window).width() / $("#container").width())

    // Move container down to only show n rows. Leave the top for
    topHeight = Math.max(min_top_height / $("#container").css("zoom"), (($(window).height() - ((420*n_rows+20) * $("#container").css("zoom") )) / $("#container").css("zoom")));
    
    topHeightPixels = topHeight * $("#container").css("zoom");
    $("#container").css("top", topHeight + "px")

    $("#overlay").height(topHeightPixels)
    // Force logo size
    $("#logo").height(topHeightPixels * 0.9);
    $("#logo").width(topHeightPixels * 0.9 * config.logoRatio);
    
    if(!$("#container").hasClass("portrait"))
        $("#topText").css("left", (420 * 2 + 20) * $("#container").css("zoom")) // Align to grid
    else
        $("#topText").css("left", "");
    
    // $("#topText").css("fontSize", Math.min(60, (topHeightPixels / 3)) + "px")

    var desiredTextWidth = ($(window).width() - $("#logo").width()) * 0.8;
    var desiredTextHeight = topHeightPixels * 0.8;
    var fontSize = 30;
    $("#topText").css("font-size", fontSize + "px");
    while($("#topText").width() > desiredTextWidth && fontSize > 10) {
        $("#topText").css("font-size", --fontSize + "px");
    }
    while($("#topText").height() > desiredTextHeight && fontSize > 10) {
        $("#topText").css("font-size", --fontSize + "px");
    }
    
    // Hide frames that are beyond the grid
    $(".frame").each(function (idx, el) {
        if(idx >= n_frames)
            $(el).hide()
        else
            $(el).show()
    })
}

function getNewGifs(updateFunction, force) {
    // TODO: Add an API endpoint for most recent gif timestamp to avoid downloading list every time
    if(force) {
        state.lastTimestamp = 0
        state.gifs.length = 0
        state.gifs = []
    }
    console.log("Checking for new gifs...")
    $.get("giflist", function(data) {
        //data.gifs = data.gifs.slice(state.simulatedGifIndex--, data.gifs.length)
       // Iterate through returned gifs until a not-new one is found
        var new_index = -1
        for(var i=0; i<data.gifs.length; i++) {
            // Loop through returned list of gifs. Should be in date order with most recent first, so stop iterating once an old gif is found.
            //timestamp = parseInt(data.gifs[i].date)
            timestamp = parseInt(data.gifs[i].id)
            if(timestamp <= state.lastTimestamp)
                break
            new_index = i
        }
        if(new_index == -1) {
            console.log("No new gifs.")
            state.downloadingImages = false;
            state.lastCheckTime = Date.now();
            return
        } 
        
        // Splice new gifs to start of gif list and update lastTimestamp
        state.gifs = data.gifs.slice(0, new_index + 1).concat(state.gifs)
        //state.lastTimestamp = parseInt(data.gifs[0].date)
        state.lastTimestamp = parseInt(data.gifs[0].id)

        console.log((new_index+1) + " new gifs waiting!")

        // Preload all new gifs, then call the update function
        newGifs = data.gifs.slice(0, new_index + 1)
        gifURLs = []
        for(var i=0; i<newGifs.length && i<=config.max_frames; i++) {
            //gifURLs.push("gif/" + newGifs[i].id)
            gifURLs.push(newGifs[i].gif_url)
        }

        preloadImages(gifURLs).done(function() {
            state.downloadingImages = false;
            state.lastCheckTime = Date.now();
            updateFunction();
        })
    })
    .fail(function() {

    })
}

function updateFrames() {
    var n_frames = $("#container").children(".frame").length

    if(n_frames < config.max_frames && state.gifs.length > n_frames) {
        // More frames are needed! add them in
        for(var i=0; i<state.gifs.length-1 && $("#container").children(".frame").length < config.max_frames; i++) {
            newFrame  = $("<div/>", {
                class: 'frame',
                html: "<img data-id='" + state.gifs[i+1].id + "' src='" + state.gifs[i+1].gif_url + "'>",
            })
            newFrame.appendTo("#container")
            if(admin) {
                var deleteDiv = $("<div class='delete'>DELETE</div>")
                newFrame.append(deleteDiv)
                deleteDiv.on("pointerup", function() {
                    id = $($(this).siblings("img")[0]).attr("data-id")
                    console.log(this)
                    console.log("Deleting " + id)
                    $.ajax({
                        url: "gif/delete/" + id,
                        success: function() {
                            console.log("DELETED " + id)
                            getNewGifs(updateFrames, true)
                        },
                        cache: false
                    })
                })
                //deleteDiv.text($(deleteDiv.siblings("img")[0]).attr("data-id"))
            }

        }
    }

    // Now flip each frame into the new image
    $("#container").children(".frame").each(function(index, el) {
        var imgEl = $($(el).children("img")[0])
        //delayTime = index * config.flipTime / 10
        delayTime = index * config.flipStagger
        //delayTime = randomInt(0, config.flipTime * 4)
        imgEl.stop().delay(delayTime).transition({
            'perspective': '1000px',
            'rotateY': '90deg'
        }, config.flipTime / 2, "in", function() {
            // Update image
            imgEl.attr("src", state.gifs[index].gif_url)
            imgEl.attr("data-id", state.gifs[index].id)
            // Flip 90 more degrees
            imgEl.css("rotateY", "-90deg")
            imgEl.transition({rotateY: '0deg'}, config.flipTime / 2, "out");
        })

    });

    updateDimensions()
}


// -----------------------------
// UTILITIES

function preloadImages(arr){
    var newimages=[], loadedimages=0
    var postaction=function(){}
    var arr=(typeof arr!="object")? [arr] : arr
    function imageloadpost(){
        loadedimages++
        if (loadedimages==arr.length){
            postaction(newimages) //call postaction and pass in newimages array as parameter
        }
    }
    for (var i=0; i<arr.length; i++){
        newimages[i]=new Image()
        newimages[i].src=arr[i]
        newimages[i].onload=function(){
            imageloadpost()
        }
        newimages[i].onerror=function(){
            imageloadpost()
        }
    }
    return { //return blank object with done() method
        done:function(f){
            postaction=f || postaction //remember user defined callback functions to be called when images load
        }
    }
}

function randomInt(low, high) {
    return Math.floor(Math.random() * (high-low) + low)
}