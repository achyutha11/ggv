#!/usr/env/bin python
from api.api import FreqVcfTable
from flask import Flask, send_from_directory, request, render_template
from flask.ext.restful import Api
from flask.ext.restful.utils import cors
import logging
from logging.handlers import RotatingFileHandler
import os


app = Flask(__name__, static_url_path = '/static', static_folder = 'static')
app.debug = True
#handler = RotatingFileHandler('/var/www/dev-integrated/ggv.log', maxBytes=10000, backupCount=1)
#handler.setLevel(logging.INFO)
#app.logger.addHandler(handler)
app.config["APPLICATION_ROOT"] = "/dev-integrated"


@app.route('/')
def root():
    return render_template('index.html')


@app.route('/data/<path:path>')
@app.route('/css/<path:path>')
@app.route('/js/<path:path>')
def send_static(path):
    print(app.static_folder)
    app.logger.info("static folder:" + app.static_folder)
    app.logger.info(app.static_folder + request.path)
    app.logger.info("JOIN: " + os.path.join(app.static_folder, request.path))
    path = app.static_folder + request.path
    dirname = os.path.dirname(path)
    basename = os.path.basename(path)
    return send_from_directory(dirname, basename)

@app.route("/test")
def test():
    return "great!"

# Set up API resources
# Basic header info
api = Api(app)
api.add_resource(FreqVcfTable, '/api/freq_table')
api.decorators = [cors.crossdomain(origin='*')]


if __name__ == '__main__':
    app.run()
