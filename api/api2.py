import os
import re
import random
import gzip
import requests
import math
from ggv.app import app
from ggv.util.fn import autoconvert
from subprocess import Popen, PIPE
from flask import jsonify, Response, request

YAML_CONFIG = app.config['YAML_CONFIG']
HERE = app.config['HERE']
datasets = YAML_CONFIG['datasets']
base_path = HERE + YAML_CONFIG['base_path']

#
# Error handling
#
class InvalidUsage(Exception):
    status_code = 400

    def __init__(self, message, status_code=None, payload=None):
        Exception.__init__(self)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['message'] = self.message
        return rv

@app.errorhandler(InvalidUsage)
def handle_invalid_usage(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response


def _resolve_dataset_tabix(dataset):
    return base_path + datasets[dataset]['tabix']


def _resolve_rsid(rsID):
    url = "http://grch37.rest.ensembl.org/variation/human/" + rsID
    r = requests.get(url,
                     headers={"Content-type": "application/json"})
    rs_info = r.json()
    mapping = r.json()['mappings'][0]
    if r.status_code != 200:
        raise Exception("rsID not found")
    else:
        region = mapping['location']
        chrom = region.split(":")[0]
        start = region.split(":")[1].split("-")[0]
        end = region.split(":")[1].split("-")[1]
        if int(end) - 1 == int(start):
            rs_info['region'] = "{chrom}:{start}-{start}".format(**locals())
        else:
            rs_info['region'] = "{chrom}:{start}-{end}".format(**locals())
        return rs_info


def _load_population_coords(dataset):
    coord_filename = base_path + datasets[dataset]['coordinates']
    coords = open(coord_filename, 'r').read().splitlines()
    coords = [re.split(" |\t", x) for x in coords if not x.startswith("#") and x]
    coords = {x[0]: map(autoconvert, [x[2], x[1]]) for x in coords}
    return coords


def _random_line(file_name):
    """
        Reads a random line from a gzip file.
    """
    total_bytes = os.stat(file_name).st_size 
    random_point = random.randint(0, total_bytes)
    file = gzip.open(file_name)
    file.seek(random_point)
    file.readline() # skip this line to clear the partial line
    return file.readline()

def _define_freqscale(freq):
    '''
    helper function to determine frequency scale
    '''
    
    # Determine max frequency
    if freq > 0:
        pw = math.ceil(math.log(freq, 10))
        if pw < -4.0:
            pw = -4.0
    else:
        pw = 0

    freq_scale = {-4: [0.0001, 10000],
                  -3: [0.001, 1000],
                  -2: [0.01, 1000],
                  -1: [0.1, 10],
                  0: [1,1]}

    return freq_scale[pw]

    #for i in range(0,len(json_data)):
    #    json_data[i]['freq']=[json_data[i]['rawfreq']*freq_mult,1-json_data[i]['rawfreq']*freq_mult]
    #    json_data[i]['freqscale']=freqscale


def tabix_region(path, region):
    tabix_command = ['tabix', path, region]
    app.logger.info(' '.join(tabix_command))
    proc = Popen(tabix_command, stdout=PIPE)
    for line in proc.stdout:
        yield line



@app.route("/api/variant/<string:dataset>/<string:region>", methods=['GET'])
def fetch_variant(dataset, region):

    full_path = _resolve_dataset_tabix(dataset)
    check_rs = False # Used to verify rs identifiers.

    if region == 'random':
        line = _random_line(full_path)
        chrom, pos = line.split("\t")[0:2]
        region = "{}:{}-{}".format(chrom, pos, pos)
    elif region.startswith("rs"):
        rs_search = region
        rs_info = _resolve_rsid(region)
        check_rs = rs_info['synonyms'] + [rs_info['name']]
        region = rs_info['region']
    else:
        # Check that region is properly formatted
        region_match = re.match('^[0-9]{1,2}:[0-9]+$', region)
        if region_match is None:
            err_msg = "Malformed region: '{}'".format(region)
            raise InvalidUsage(err_msg, status_code=400)
        chrom = region.split(":")[0]
        start = region.split(":")[1]
        region = "{chrom}:{start}-{start}".format(**locals())

    # Put together the region
    coords = _load_population_coords(dataset)
    results = list(tabix_region(full_path, region))
    if not results:
        err_msg = "Variant at position '{}' not found".format(region)
        raise InvalidUsage(err_msg, status_code=400)

    response_json = []
    for line in results:
        response = {}
        line = line.strip().split()
        chrom, pos, rsID, pop, ref, alt, n_obs, x_obs, freq = map(autoconvert, line)[0:10]

        # Verify rsID
        if check_rs:
            if rsID not in check_rs:
                err_msg = "rsID '{}' not found".format(rs_search)
                raise InvalidUsage(err_msg, status_code=400)

        response['chrom_pos'] = '{}:{}'.format(chrom, pos)
        response['alleles'] = [ref, alt]
        response['xobs'] = x_obs
        response['nobs'] = n_obs
        response['rawfreq'] = freq
        response['pop'] = pop
        response['pos'] = coords[pop]
        response['rsID'] = rsID
        response_json.append(response)

    max_freq = max([x['rawfreq'] for x in response_json])
    freq_scale, freq_multi = _define_freqscale(max_freq)
    for row in response_json:
        row['freqscale'] = freq_scale
        row['freq'] = [row['rawfreq'] * freq_multi,
                       1.0 - (row['rawfreq'] * freq_multi)]

    return jsonify(response_json)



@app.route("/api/tabix/<string:dataset>/<string:region>", methods=['GET'])
@app.route("/api/tabix/<string:dataset>/<string:region>/dl", methods=['GET'])
def api_tabix_request(dataset, region):
    """
        Outputs raw tabix data; 
        Optionally use 'dl' at end 
        to download tsv.
    """
    if region.startswith("rs"):
        rs_info = _resolve_rsid(region)
        region = rs_info['location']
        chrom = region.split(":")[0]
        start = region.split(":")[1].split("-")[0]
    if request.path.endswith('dl'):
        mimetype = 'text/tab-separated-values'
    else:
        mimetype = 'tsv'
    if dataset in datasets.keys():
        full_path = _resolve_dataset_tabix(dataset)
        return Response(tabix_region(full_path, region), mimetype=mimetype)
    else:
        raise InvalidUsage("Dataset '{}' not found".format(dataset), status_code=400)

