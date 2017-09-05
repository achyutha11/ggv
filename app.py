#!/usr/env/bin python
import ggv
from api.api import FreqVcfTable
from flask import Flask, send_from_directory, request, render_template
from flask.ext.restful import Api
from flask.ext.restful.utils import cors
import logging
import yaml
from logging.handlers import RotatingFileHandler
import os



app = Flask(__name__)
app.debug = True
#handler = RotatingFileHandler('/var/www/dev-integrated/ggv.log', maxBytes=10000, backupCount=1)
#handler.setLevel(logging.INFO)
#app.logger.addHandler(handler)
app.config["APPLICATION_ROOT"] = "/dev-integrated"

app.config['STATIC_FOLDER'] = 'static'

# Load configuration
app.config['YAML_CONFIG'] = yaml.load(open("config.yaml", 'r').read())
app.config['HERE'] = os.path.dirname(os.path.realpath(__file__))

@app.route('/')
def root():
    return render_template('index.html')



@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT')
    return response

# Set up API resources
# Basic header info
api = Api(app)
api.add_resource(FreqVcfTable, '/api/freq_table')
api.decorators = [cors.crossdomain(origin='*')]

# Dev of new API
from ggv.api import *

if __name__ == '__main__':
    app.debug = True
    app.run()
