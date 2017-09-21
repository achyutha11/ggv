#!/usr/env/bin python

import yaml
import os
import re
import json
import logging
import mimetypes
from flask import (Flask,
                   send_from_directory,
                   Response,
                   request,
                   render_template,
                   redirect, url_for,
                   send_file)
from logging.handlers import RotatingFileHandler
from flask_compress import Compress
from flask_cors import CORS, cross_origin

app = Flask(__name__)

# Setup App
Compress(app)
CORS(app)

app.debug = True
#handler = RotatingFileHandler('/var/www/dev-integrated/ggv.log', maxBytes=10000, backupCount=1)
#handler.setLevel(logging.INFO)
#app.logger.addHandler(handler)
app.config["APPLICATION_ROOT"] = "/dev-integrated"

app.config['STATIC_FOLDER'] = 'static'

# Load configuration
app.config['HERE'] = os.path.dirname(os.path.realpath(__file__))
config_yaml = os.path.join(app.config['HERE'], "config.yaml")
app.config['YAML_CONFIG'] = yaml.load(open(config_yaml, 'r').read())

# Define vars
HERE = app.config['HERE']
YAML_CONFIG = app.config['YAML_CONFIG']
datasets = YAML_CONFIG['datasets']
base_path = HERE + YAML_CONFIG['base_path']

@app.route('/')
@app.route('/<string:dataset>/<string:loc>')
def root(dataset = "", loc = ""):
    datasets = YAML_CONFIG['datasets']
    if not loc:
        dataset = datasets.keys()[0]
        return redirect(url_for('root', dataset=dataset, loc = 'random'))
    return render_template('index.html', **locals())


#@app.after_request
#def after_request(response):
#    response.headers.add('Access-Control-Allow-Origin', '*')
#    response.headers.add('Access-Control-Allow-Headers', 'RANGE,Cache-control,If-None-Match,Content-Type,Authorization')
#    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
#    response.headers.add('Access-Control-Expose-Headers', 'Content-Length')
#    response.headers.add('Accept-Ranges', 'bytes')
#    return response


@app.route('/track/<path:path>')
def send_track(path):
    path = os.path.join(os.path.dirname(__file__), 'datasets', path)
    range_header = request.headers.get('Range', None)
    if path.endswith(".tbi"):
        return send_file(path)
    if not range_header:
        return None
    m = re.search('(\d+)-(\d*)', range_header)
    if not m:
        return "Error: unexpected range header syntax: {}".format(range_header)
    size = os.path.getsize(path)
    offset = int(m.group(1))
    length = int(m.group(2) or size) - offset

    data = None
    with open(path, 'rb') as f:
        f.seek(offset)
        data = f.read(length)
    rv = Response(data,
                  206,
                  mimetype="application/octet-stream",
                  direct_passthrough=True)
    rv.headers['Content-Range'] = 'bytes {0}-{1}/{2}'.format(offset, offset + length-1, size)
    return rv

# Dev of new API
from api import *

if __name__ == '__main__':
    app.debug = True
    formatter = logging.Formatter(
        "[%(asctime)s] {%(pathname)s:%(lineno)d} %(levelname)s - %(message)s")
    handler = RotatingFileHandler('ggv.log', maxBytes=10000000, backupCount=3)
    handler.setLevel(logging.DEBUG)
    handler.setFormatter(formatter)
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.DEBUG)
    log.addHandler(handler)
    app.logger.addHandler(handler)
    app.run()
