import os, subprocess, uuid
import json
from flask import Flask, request, make_response, redirect, url_for, render_template, send_from_directory, jsonify, send_file
from werkzeug import secure_filename
from functools import wraps

import config # contains API secrets

from twilio.rest import TwilioRestClient
from twilio import TwilioRestException

import logging

twilioClient = TwilioRestClient(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN) 

UPLOAD_FOLDER = 'uploads'
GIF_FOLDER = 'gifs'
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
    
    # Create a list of unique filenames
    face_filenames = ["{}/{}.jpg".format(upload_folder, uuid.uuid4()) for u in range(0, 5)]

    gif_id = uuid.uuid4()
    gif_folder = os.path.join(config.FILESYSTEM_BASE, "events", event, GIF_FOLDER)
    tmp_folder = os.path.join(config.FILESYSTEM_BASE, "events", event, TMP_FOLDER)
    gif_filename = os.path.join(gif_folder, "{}.gif".format(gif_id))
    tmp_filename = os.path.join(tmp_folder, "{}.gif".format(gif_id))

    # Create folders for the event if they don't exist
    if not os.path.exists(gif_folder):
        os.makedirs(gif_folder)
    if not os.path.exists(tmp_folder):
        os.makedirs(tmp_folder)
    
    # Get image data from json, decode the base64 strings to binary files
    data = request.get_json()
    face_uploads = [data["face1"], data["face2"], data["face3"], data["face4"], data["face5"]]
    for i in range(len(face_uploads)):
        with open(face_filenames[i], "wb") as f:
            f.write(face_uploads[i].decode('base64'))

    # Run imagemagick's convert to create a gif
    command = "convert -delay 40 -loop 0 '{faces[0]}' '{faces[1]}' '{faces[2]}' '{faces[3]}' '{faces[4]}' '{tmp_name}'; mv '{tmp_name}' '{gif_name}'".format(faces=face_filenames, gif_name=gif_filename,  tmp_name=tmp_filename)
    logging.debug(command)
    subprocess.call(command, shell=True)

    return jsonify(status="OK", gif_id=gif_id, gif_url=url_for("serve_gif", id=gif_id), command=command)

@app.route('/gif/<id>', methods=['GET'])
def serve_gif(id):
    """Send out the requested GIF given its unique ID"""

    # Get the event name from the client's cookie or use the default
    event = request.cookies.get('event') or config.COOKIES['event']

    return send_from_directory(os.path.join(config.FILESYSTEM_BASE, "events", event, GIF_FOLDER), "{}.gif".format(id))

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

@app.route('/giflist', methods=['GET'])
def list_gifs():
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
    
    data = request.get_json()

    try:
        m = twilioClient.messages.create(
            to=data["phoneNumber"], 
            from_=config.TWILIO_FROM_NUMBER, 
            body="Thanks for using Samsung EmojiMatch!", 
            media_url= data["gifURL"] 
        )    
        return jsonify(status="OK", message=m.sid)

    except TwilioRestException as e:
        return jsonify(status="ERROR", message=e)

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
