#!/home2/slowerin/www/diskcactus/emojimatch/venv/bin/python

from flup.server.fcgi import WSGIServer
from emojimatch_app import app as application

WSGIServer(application).run()
