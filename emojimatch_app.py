import os, subprocess, uuid
import threading
import requests
import cloudconvert
import json
import time
from flask import Flask, request, make_response, redirect, url_for, render_template, send_from_directory, jsonify, send_file
from werkzeug import secure_filename
from functools import wraps

import config # contains API secrets

from twilio.rest import TwilioRestClient
from twilio import TwilioRestException

import logging

twilioClient = TwilioRestClient(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN) 

cloudconvertAPI = cloudconvert.Api(config.CLOUD_CONVERT_API_KEY)

UPLOAD_FOLDER = 'uploads'
GIF_FOLDER = 'gifs'
VID_FOLDER = 'vids'
TMP_FOLDER = 'tmp'
ALLOWED_EXTENSIONS = set(['jpg', 'jpeg', 'gif', 'png'])

app = Flask(__name__)

# Set up logging to a file we can read
logging.basicConfig(filename=config.FILESYSTEM_BASE + u'/log', level=logging.DEBUG)
logger = logging.getLogger('werkzeug')
handler = logging.FileHandler(config.FILESYSTEM_BASE + u'/log')
logger.addHandler(handler)
app.logger.addHandler(handler)

# Get rid of the weird bins.fcgi at the end of the URL
# ----------------------------------------------------------------------------
def strip_suffix(app, suffix):
    def wrapped_app(environ, start_response):
        if environ['SCRIPT_NAME'].endswith(suffix):
            environ['SCRIPT_NAME'] = environ['SCRIPT_NAME'][:-len(suffix)]
        return app(environ, start_response)
    return wrapped_app

app.wsgi_app = strip_suffix(app.wsgi_app, '/emojimatch.fcgi')
# ----------------------------------------------------------------------------

# Authentication/admin stuff
# ----------------------------------------------------------------------------
def authenticate(f):
    ''' Function used to decorate routes that require user login '''
    @wraps(f)
    def new_f(*args, **kwargs):
        if not logged_in():
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return new_f

def logged_in():
    return True
    #return session.has_key("loggedin") and session["loggedin"] == "yes";

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")
    else:
        if request.form["password"] == "em0jimatch":
            session['loggedin'] = "yes"
            flash("Logged in!")
            return redirect(url_for("index"))
        else:
            flash("Wrong password!")
            return redirect(url_for("login"))

@app.route("/logout", methods=["GET"])
def logout():
    session['loggedin'] = "no"
    flash("Logged out!")
    return redirect(url_for("login"))    
# ----------------------------------------------------------------------------

def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1] in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return "EMOJI MATCH API v0.1"

# API Endpoints
# ----------------------------------------------------------------------------
@app.route('/capture', methods=["GET"])
def show_capture():
    """Get capture page HTML"""
    return render_template("capture.html")

@app.route('/gif', methods=['POST'])
def create_gif():
    """Creates a GIF (using imagemagick) using uploaded files and returns its URL"""

    # Get the event name from the client's cookie or use the default
    event = request.cookies.get('event') or config.COOKIES['event']
    
    # Create an upload folder if it doesn't already exist
    upload_folder = os.path.join(config.FILESYSTEM_BASE, "events", event, UPLOAD_FOLDER)
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)
    
    # Get image data from json
    data = request.get_json()
    face_uploads = []
    for i in range(len(data)):
        face_uploads.append(data["face" + str(i+1)])    
    #face_uploads = [data["face1"], data["face2"], data["face3"], data["face4"], data["face5"]]
    
    # Create a list of unique filenames
    face_filenames = ["{}/{}.jpg".format(upload_folder, uuid.uuid4()) for u in range(0, len(face_uploads))]

    #gif_id = uuid.uuid4()
    gif_id = create_remote_match(event) or uuid.uuid4()
     
    gif_folder = os.path.join(config.FILESYSTEM_BASE, "events", event, GIF_FOLDER)
    tmp_folder = os.path.join(config.FILESYSTEM_BASE, "events", event, TMP_FOLDER)
    gif_filename = os.path.join(gif_folder, "{}.gif".format(gif_id))
    tmp_filename = os.path.join(tmp_folder, "{}.gif".format(gif_id))

    # Create folders for the event if they don't exist
    if not os.path.exists(gif_folder):
        os.makedirs(gif_folder)
    if not os.path.exists(tmp_folder):
        os.makedirs(tmp_folder)
    
    # Decode the base64 strings and write them to binary files
    for i in range(len(face_uploads)):
        with open(face_filenames[i], "wb") as f:
            f.write(face_uploads[i].decode('base64'))

    # Run imagemagick's convert to create a gif
    command = "convert -delay 40 -loop 0 "
    for f in face_filenames:
        command += "'{}' ".format(f)
    
    command += "'{tmp_name}'; mv '{tmp_name}' '{gif_name}'".format(gif_name=gif_filename,  tmp_name=tmp_filename)

    #command = "convert -delay 40 -loop 0 '{faces[0]}' '{faces[1]}' '{faces[2]}' '{faces[3]}' '{faces[4]}' '{tmp_name}'; mv '{tmp_name}' '{gif_name}'".format(faces=face_filenames, gif_name=gif_filename,  tmp_name=tmp_filename)
    #logging.debug(command)
    tic = time.time()
    #subprocess.call(command, shell=True)
    subprocess.Popen(command, shell=True)
    toc = time.time()
    gif_time = str(toc-tic)
    
    # Convert the gif to an mp4 video for sharing on instagram too
    tic = time.time();
    videoThread = VideoConversionThread(event, gif_id, gif_filename)
    videoThread.start()
    #videoThread.join() # uncomment to wait for conversion to complete
    toc = time.time()
    vid_time = str(toc-tic)

    return jsonify(status="OK", gif_id=gif_id, gif_url=url_for("serve_gif", id=gif_id), vid_url=url_for("serve_vid", id=gif_id), vid_time = vid_time, gif_time = gif_time)

class VideoConversionThread(threading.Thread):
    """ Provides an asynchronous way to convert gifs to mp4s using external API """
    def __init__(self, event, gif_id, gif_filename):
        self.event = event
        self.gif_id = gif_id
        self.gif_filename = gif_filename
        threading.Thread.__init__(self)
    
    def run(self):
        logging.debug("Converting file: " + self.gif_filename)
        wait_for_file(self.gif_filename, 30)
        try:
            process = cloudconvertAPI.convert({
                'inputformat'   : 'gif',
                'outputformat'  : 'mp4',
                'input'         : 'upload',
                'file'          : open(self.gif_filename, 'rb'),
                'save'          : 'true'
            })
        
            logging.debug("Waiting for response from cloudconvert server")
            process.wait()
            
            # Create an upload folder if it doesn't already exist
            vid_folder = os.path.join(config.FILESYSTEM_BASE, "events", self.event, VID_FOLDER)
            if not os.path.exists(vid_folder):
                os.makedirs(vid_folder)
                
            vid_filename = os.path.join(vid_folder, "{}.mp4".format(self.gif_id))
            
            logging.debug("Downloading completed file")
            process.download(vid_filename)
            logging.debug("Successfully wrote file to " + vid_filename)
            
            # Now upload the gif and mp4 to The Guild's remote CMS server
            upload_remote_files(self.event, self.gif_id)
            
        except Exception as e:
            logging.debug(e)
        
class MatchUploadThread(threading.Thread):
    """ Submits gif and vid to The Guild's backend API """
    def __init__(self, event, gif_id, gif_filename):
        self.event = event
        self.gif_id = gif_id
        self.gif_filename = gif_filename
        threading.Thread.__init__(self)
    
    def run(self):
        pass

def create_remote_match(event):
    """ Create a new match with The Guild's API and return its ID """
    # TODO: Sync list of events with remote server
    event_id = 4
    match_api_url = config.GUILD_API_BASE_URL + "matches/"
    headers = {'Authorization': "Token {}".format(config.   GUILD_API_KEY), 'content-type': "application/json"}
    r = requests.post(match_api_url, json={'event': event_id}, headers=headers)
    if r.status_code == 201:    # Created
        response = json.loads(r.text)
        logging.debug("Created new remote match id {}".format(response["id"]))
        return response["id"]
    else:
        logging.error("Could not create match ({}): {}".format(r.status_code, r.text))
        return None

def upload_remote_files(event, gif_id):
    """ Upload the gif and mp4 file to The Guild's remote server. """
    gif_api_url = config.GUILD_API_BASE_URL + "match_images/"
    vid_api_url = config.GUILD_API_BASE_URL + "match_videos/"
    headers = {'Authorization': "Token {}".format(config.GUILD_API_KEY)}

    vid_filename = os.path.join(config.FILESYSTEM_BASE, "events", event, VID_FOLDER, "{}.mp4".format(gif_id))
    gif_filename = os.path.join(config.FILESYSTEM_BASE, "events", event, GIF_FOLDER, "{}.gif".format(gif_id))
    
    tic = time.time()
    
    r = requests.post(gif_api_url,
                      data  = {"match": gif_id, "path": "/dev/null"},
                      files = {"image": open(gif_filename, 'rb')},
                      headers = headers)
                      
    logging.debug("({}) {}".format(r.status_code, r.text))
                      
    r = requests.post(vid_api_url,
                      data  = {"match": gif_id, "path": "/dev/null"},
                      files = {"video": open(vid_filename, 'rb')},
                      headers = headers)                      
                      
    logging.debug("({}) {}".format(r.status_code, r.text))
    
    toc = time.time()
    
    logging.debug("GIF + Video uploaded in {} seconds".format(toc-tic))

@app.route('/gif/<id>', methods=['GET'])
def serve_gif(id):
    """Send out the requested GIF given its unique ID"""

    # Get the event name from the client's cookie or use the default
    event = request.cookies.get('event') or config.COOKIES['event']

    # Wait for up to 20 sec to see if this file is currently generating before timing out
    gif_filename = os.path.join(config.FILESYSTEM_BASE, "events", event, GIF_FOLDER, "{}.gif".format(id))
    wait_for_file(gif_filename, 20) 

    return send_from_directory(os.path.join(config.FILESYSTEM_BASE, "events", event, GIF_FOLDER), "{}.gif".format(id))

def wait_for_file(filename, t):
    """Look to see if this file exists. It could be generating now, so wait up to t seconds before timing out"""
    attempts = 0
    while not os.path.exists(filename) and attempts < t:
        attempts += 1
        time.sleep(1)


@app.route('/vid/<id>', methods=['GET'])
def serve_vid(id):
    """Send out the requested MP4 video given its unique ID"""

    # Get the event name from the client's cookie or use the default
    event = request.cookies.get('event') or config.COOKIES['event']

    # Wait for up to 20 sec to see if this file is currently generating before timing out
    vid_filename = os.path.join(config.FILESYSTEM_BASE, "events", event, VID_FOLDER, "{}.mp4".format(id))
    wait_for_file(vid_filename, 20)

    return send_from_directory(os.path.join(config.FILESYSTEM_BASE, "events", event, VID_FOLDER), "{}.mp4".format(id))    

@app.route('/gif/delete/<id>', methods=['GET'])
@authenticate
def delete_gif(id):
    """Delete the chosen GIF given its unique ID"""
    
    # Get the event name from the client's cookie or use the default
    event = request.cookies.get('event') or config.COOKIES['event']
    
    try:
        os.unlink(os.path.join(config.FILESYSTEM_BASE, "events", event, GIF_FOLDER, "{}.gif".format(id)))
        success = True
    except:
        success = False

    if success:
        return "OK"
    else:
        return "Could not delete file."

# @app.route('/giflist', methods=['GET'])
def list_gifs():
    """ List gifs on The Guild's server """
    # Get the event name from the client's cookie or use the default
    event = request.cookies.get('event') or config.COOKIES['event']
    # TODO: Sync list of events with remote server
    event_id = 4
    
    matches_api_url     = config.GUILD_API_BASE_URL + "matches/received/?event={}".format(event_id)
    headers = {'Authorization': "Token {}".format(config.   GUILD_API_KEY)}
    
    # Make an initial request to get the number of matches
    r = requests.get("{}&limit=1".format(matches_api_url), headers=headers)
    if r.status_code == 200:
        response = json.loads(r.text)
        count = response["count"]
    else:
        return r.text, r.status_code
        
    # Now get only the n most recent matches
    n_matches = 64
    r = requests.get("{}&offset={}&limit={}".format(matches_api_url, max(0, count - n_matches), n_matches), headers=headers)
    if r.status_code == 200:
        response = json.loads(r.text)
        results = response["results"]
        files = [{}]
    else:
        return r.text, r.status_code
        
        

    
@app.route('/giflist', methods=['GET'])
def list_local_gifs():
    """List the gif directory, ordered by creation date, return as json"""
    
    # Get the event name from the client's cookie or use the default
    event = request.cookies.get('event') or config.COOKIES['event']
    
    gif_folder = os.path.join(config.FILESYSTEM_BASE, "events", event, GIF_FOLDER)
    os.chdir(gif_folder)
    files = filter(os.path.isfile, os.listdir(gif_folder))
    files = [{"id":f.split(".")[0], "date":os.path.getmtime(os.path.join(gif_folder, f))} for f in files]
    files.sort(key=lambda x: x["date"], reverse=True)

    return jsonify(gifs=files)


@app.route('/sms', methods=["POST"])
def send_sms():
    """Send out the included gif as an SMS"""
    
    # Get the event name from the client's cookie or use the default
    event = request.cookies.get('event') or config.COOKIES['event']
    # TODO: Sync list of events with remote server
    event_id = 4
    
    data = request.get_json()

    match_api_url     = config.GUILD_API_BASE_URL + "matches/" + data["gif_id"] + "/"
    publicize_api_url = match_api_url + "publicize/"
    headers = {'Authorization': "Token {}".format(config.   GUILD_API_KEY)}
    
    # First wait up to 10 seconds for the video and gif to be uploaded. 
    files_ready = False
    attempts = 0
    while not files_ready and attempts < 10:
        r = requests.get(match_api_url, headers=headers)
        if r.status_code == 200:
            response = json.loads(r.text)
            if response["animated_image"] is None or response["animated_image"]["image"] is None or response["video"] is None or response["video"]["video"] is None:
                files_ready = False
                time.sleep(1)
            else:
                files_ready = True

        attempts += 1

    if not files_ready:
        return "Video or image not yet generated! Please try again later.", 503

    # Next, PATCH in the phone number field in the match entry
    r = requests.patch(match_api_url, data={'phone': data["phoneNumber"]}, headers=headers)
    if r.status_code == 200:    # Updated
        # Now hit the publicize endpoint to actually send the message
        r = requests.post(publicize_api_url, data={'event': event_id}, headers = headers)
        if r.status_code == 400:
            return r.text, r.status_code
        else:
            return jsonify(status="OK", message=r.text)
            
        
    else:
        logging.error("Could not Update match phone number ({}): {}".format(r.status_code, r.text))
        return r.text, r.status_code

#     try:
#         m = twilioClient.messages.create(
#             to=data["phoneNumber"], 
#             from_=config.TWILIO_FROM_NUMBER, 
#             body="Thanks for using Samsung EmojiMatch!", 
#             media_url= data["gifURL"] 
#         )    
#         return jsonify(status="OK", message=m.sid)
# 
#     except TwilioRestException as e:
#         return jsonify(status="ERROR", message=e)

@app.route('/visualize', methods=["GET"])
def render_visualizer():
    
    return render_template("visualizer.html", admin="false", hashtag = (request.cookies.get('hashtag') or config.COOKIES["hashtag"]), title = (request.cookies.get('title') or config.COOKIES["title"]), logo = (request.cookies.get('logo') or config.COOKIES["logo"]), bgcolor = (request.cookies.get('bgcolor') or config.COOKIES["bgcolor"]), fgcolor = (request.cookies.get('fgcolor') or config.COOKIES["fgcolor"]), event = (request.cookies.get('event') or config.COOKIES["event"]))

@app.route('/admin', methods=["GET"])
def render_admin():

    return render_template("visualizer.html", admin="true", hashtag = (request.cookies.get('hashtag') or config.COOKIES["hashtag"]), title = (request.cookies.get('title') or config.COOKIES["title"]), logo = (request.cookies.get('logo') or config.COOKIES["logo"]), bgcolor = (request.cookies.get('bgcolor') or config.COOKIES["bgcolor"]), fgcolor = (request.cookies.get('fgcolor') or config.COOKIES["fgcolor"]), event = (request.cookies.get('event') or config.COOKIES["event"]))
    
@app.route('/settings', methods=["POST"])
def set_settings():
    """ Takes display settings in as form variables and sets them as cookies """
    next = url_for("render_visualizer")
    try:
        next = request.form['next']
    except KeyError:
        pass

    # Set cookies
    resp = make_response(redirect(next))
    for c in config.COOKIES:
        try:
            resp.set_cookie(c, request.form[c])
        except KeyError:
            pass        
    
    return resp
    
@app.route('/reset', methods=["POST", "GET"])
def reset_settings():
    """ Clears all cookies so they return to defaults """
    next = url_for("render_visualizer")
    if request.method == "POST":
        try:
            next = request.form['next']
        except KeyError:
            pass
        
    # Clear cookies
    resp = make_response(redirect(next))
    for c in config.COOKIES:
        resp.set_cookie(c, '', expires=0)

    return resp

app.secret_key = config.SESSION_SECRET_KEY
app.debug = True
if __name__ == '__main__':
    app.run()
