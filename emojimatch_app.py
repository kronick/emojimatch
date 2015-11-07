import os, subprocess, uuid
import json
from flask import Flask, request, redirect, url_for, render_template, send_from_directory, jsonify, send_file
from werkzeug import secure_filename
from functools import wraps

import config # contains API secrets

from twilio.rest import TwilioRestClient
from twilio import TwilioRestException

import logging

twilioClient = TwilioRestClient(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN) 

UPLOAD_FOLDER = config.FILESYSTEM_BASE + u'/uploads'
GIF_FOLDER = config.FILESYSTEM_BASE + u'/gifs'
TMP_FOLDER = config.FILESYSTEM_BASE + u'/tmp'
ALLOWED_EXTENSIONS = set(['jpg', 'jpeg', 'gif', 'png'])

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['GIF_FOLDER'] = GIF_FOLDER
app.config['TMP_FOLDER'] = TMP_FOLDER

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

# Debugging views
# ----------------------------------------------------------------------------
@app.route('/upload', methods=["GET"])
def show_upload_form():
    """Returns a template for uploading several files to create a gif for debugging purposes"""
    return render_template("upload.html")

# API Endpoints
# ----------------------------------------------------------------------------
@app.route('/gif', methods=['POST'])
def create_gif():
    """Creates a GIF (using imagemagick) using uploaded files and returns its URL"""

    # Create a list of unique filenames
    face_filenames = ["{}/{}.jpg".format(app.config["UPLOAD_FOLDER"], uuid.uuid4()) for u in range(0, 5)]

    emoji_filenames = ["emoji-01.png", "emoji-02.png", "emoji-03.png", "emoji-04.png", "emoji-05.png"]
    emoji_filenames = ["{}/{}".format(app.config["UPLOAD_FOLDER"], f) for f in emoji_filenames]

    gif_id = uuid.uuid4()
    gif_filename = os.path.join(app.config["GIF_FOLDER"], "{}.gif".format(gif_id))
    tmp_filename = os.path.join(app.config["TMP_FOLDER"], "{}.gif".format(gif_id))

    # Use this for HTML file uplaods... but we're actually going to use base64 encoded strings
    #face_uploads = [request.files["face1"], request.files["face2"], request.files["face3"], request.files["face4"], request.files["face5"]]

    # Save each of the uploaded files to disk
    #for i in range(len(face_uploads)):
    #    face_uploads[i].save(face_filenames[i])

    data = request.get_json()
    face_uploads = [data["face1"], data["face2"], data["face3"], data["face4"], data["face5"]]
    for i in range(len(face_uploads)):
        with open(face_filenames[i], "wb") as f:
            f.write(face_uploads[i].decode('base64'))

    # Run imagemagick's convert to create a gif
    #command = "convert -delay 20 -loop 0 {faces[0]} {emoji[0]} {faces[1]} {emoji[1]} {faces[2]} {emoji[2]} {faces[3]} {emoji[3]} {faces[4]} {emoji[4]} {gif_name}".format(
     #           faces=face_filenames, emoji=emoji_filenames, gif_name=gif_filename)
    command = "convert -delay 40 -loop 0 '{faces[0]}' '{faces[1]}' '{faces[2]}' '{faces[3]}' '{faces[4]}' '{tmp_name}'; mv '{tmp_name}' '{gif_name}'".format(faces=face_filenames, gif_name=gif_filename,  tmp_name=tmp_filename)
    logging.debug(command)
    #command = "convert -delay 40 -loop 0 '{faces[0]}' '{faces[1]}' '{faces[2]}' '{faces[3]}' '{faces[4]}' '{gif_name}'".format(faces=face_filenames, gif_name=gif_filename)
    subprocess.call(command, shell=True)

    #return "Your gif is ready: <a href='{}'>{}</a>".format(url_for("serve_gif", id=gif_id), gif_id)
    return jsonify(status="OK", gif_id=gif_id, gif_url=url_for("serve_gif", id=gif_id), command=command)

@app.route('/gif/<id>', methods=['GET'])
def serve_gif(id):
    """Send out the requested GIF given its unique ID"""
    return send_from_directory(app.config['GIF_FOLDER'], "{}.gif".format(id))

@app.route('/gif/delete/<id>', methods=['GET'])
@authenticate
def delete_gif(id):
    """Delete the chosen GIF given its unique ID"""
    try:
        os.unlink(os.path.join(app.config['GIF_FOLDER'], "{}.gif".format(id)))
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
    os.chdir(GIF_FOLDER)
    files = filter(os.path.isfile, os.listdir(GIF_FOLDER))
    files = [{"id":f.split(".")[0], "date":os.path.getmtime(os.path.join(GIF_FOLDER, f))} for f in files]
    files.sort(key=lambda x: x["date"], reverse=True)

    return jsonify(gifs=files)


@app.route('/sms', methods=["POST"])
def send_sms():
    """Send out the included gif as an SMS"""
    data = request.get_json()

    try:
        m = twilioClient.messages.create(
            to=data["phoneNumber"], 
            from_=config.TWILIO_FROM_NUMBER, 
            body="Thanks for using Samsung EmojiMatch!", 
            media_url= config.URL_BASE + data["gifURL"] 
        )    
        return jsonify(status="OK", message=m.sid)

    except TwilioRestException as e:
        return jsonify(status="ERROR", message=e)

@app.route('/visualize', methods=["GET"])
def render_visualizer():
    return render_template("visualizer.html", admin="false")

@app.route('/admin', methods=["GET"])
def render_admin():
    return render_template("visualizer.html", admin="true")

app.debug = True
if __name__ == '__main__':
    app.run()
