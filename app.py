#!/usr/env/bin python
#from api import FreqVcfTable
from flask import Flask, send_from_directory, request
from flask.ext.restful import Api
from flask.ext.restful.utils import cors
import logging
from logging.handlers import RotatingFileHandler
import os


app = Flask(__name__, static_folder = 'static')
app.debug = True
handler = RotatingFileHandler('/var/www/dev-integrated/ggv.log', maxBytes=10000, backupCount=1)
handler.setLevel(logging.INFO)
app.logger.addHandler(handler)
app.config["APPLICATION_ROOT"] = "/dev-integrated"


@app.route('/')
def root():
    return app.send_static_file('index.html')


@app.route('/data/<path:path>')
@app.route('/css/<path:path>')
@app.route('/js/<path:path>')
def send_static(path):
    app.logger.info("GREAT!")
    app.logger.info(os.path.join('static', request.path))
    return send_from_directory(os.path.join(app.static_folder, request.path), path)

@app.route("/test")
def test():
    return "great!"

# Set up API resources
#api.add_resource(FreqVcfTable, '/freq_table')
# Basic header info
#api = Api(app)
#api.decorators = [cors.crossdomain(origin='*')]


if __name__ == '__main__':
    app.run()
