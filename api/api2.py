import os
import re
import time
import requests
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

    rs_info = r.json()['mappings'][0]
    if r.status_code != 200:
        raise Exception("rsID not found")
    else:
        region = rs_info['location']
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
    coords = {x[0]: map(autoconvert, [x[1], x[2]]) for x in coords}
    return coords

def _determine_freq_scale():
    pass

#def freq_out_to_json(self, freq_dict):
#        '''
#        writes json data
#        '''
#        json_data =[]
#        lon_lat_dict = self.get_lon_lat_dict()
#        for pop in freq_dict.keys():
#            map_pos = lon_lat_dict[pop]
#            nobs =  freq_dict[pop][6]
#            xobs = freq_dict[pop][7]
#            freq = freq_dict[pop][8]
#            chr_pos = str(freq_dict[pop][0])+':'+str(freq_dict[pop][1])
#            alleles = [freq_dict[pop][4], freq_dict[pop][5]]
#            if int(nobs) == 0:
#                nobs = 'M'
#                xobs = 'M'
#            json_data.append({'pop':pop,
#                    'pos':map_pos, 'nobs':nobs,
#                              'rawfreq':float(freq), 'chrom_pos':chr_pos, 'alleles':alleles,
#                              'xobs':xobs})
#
#            json_data = self.define_freqscale(json_data)
#
#        return json_data

def tabix_region(path, region):
    tabix_command = ['tabix', path, region]
    proc = Popen(tabix_command, stdout=PIPE)
    for line in proc.stdout:
        yield line


@app.route("/api/variant/<string:dataset>/<string:region>", methods=['GET'])
def fetch_variant(dataset, region):
    if region.startswith("rs"):
        rs_info = _resolve_rsid(region)
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
    full_path = _resolve_dataset_tabix(dataset)
    results = list(tabix_region(full_path, region))
    if not results:
        err_msg = "Variant at position '{}' not found".format(region)
        raise InvalidUsage(err_msg, status_code=400)

    response_json = []
    for line in results:
        response = {}
        line = line.strip().split()
        chrom, pos, rsID, pop, ref, alt, n_obs, x_obs, freq = map(autoconvert, line)[0:10]
        response['chrom_pos'] = '{}:{}'.format(chrom, pos)
        response['alleles'] = [ref, alt]
        response['xobs'] = x_obs
        response['nobs'] = n_obs
        response['rawfreq'] = freq
        response['pop'] = pop
        response['pos'] = coords[pop]
        response['rsID'] = rsID
        response_json.append(response)

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

