import os
import re
import random
import gzip
import requests
import math
from ggv.main import app, datasets, base_path, HERE, YAML_CONFIG, session
from ggv.util.fn import autoconvert
from subprocess import Popen, PIPE
from flask import jsonify, Response, request
from Bio import bgzf
from ggv.authentication import login_required

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


def _resolve_dataset_bed(dataset):
    return base_path + datasets[dataset]['bed']


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
    coords = {x[0].strip("*"): map(autoconvert, [x[1], x[2]]) for x in coords}
    return coords


def _random_line(file_name):
    """
        Reads a random line from a gzip file.
    """
    # Get filesize
    try:
        grabix = YAML_CONFIG['grabix_path']
    except KeyError:
        grabix = 'grabix'
    grabix_command = [grabix, 'random', file_name, '1']
    app.logger.info(' '.join(map(str,grabix_command)))
    line, err = Popen(grabix_command, stdout=PIPE, stderr=PIPE).communicate()
    app.logger.info(err)
    return line


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
                  0: [1, 1]}
    return freq_scale[pw]

    #for i in range(0,len(json_data)):
    #    json_data[i]['freq']=[json_data[i]['rawfreq']*freq_mult,1-json_data[i]['rawfreq']*freq_mult]
    #    json_data[i]['freqscale']=freqscale


def tabix_region(path, region):
    chrom, start_end = region.split(":")
    start, end = map(int, start_end.split("-"))
    end = end + 1
    region = "{chrom}:{start}-{end}".format(**locals())
    tabix = YAML_CONFIG['tabix_path']
    tabix_command = [tabix, path, region]
    app.logger.info(' '.join(tabix_command))
    proc = Popen(tabix_command, stdout=PIPE)
    for line in proc.stdout:
        yield line


@app.route("/api/variant/<string:dataset>/<string:query>", methods=['GET'])
@login_required
def fetch_variant(dataset, query):

    query = query.replace("chr", "")
    full_path = _resolve_dataset_tabix(dataset)
    full_path_bed = _resolve_dataset_bed(dataset)
    check_rs = False # Used to verify rs identifiers.
    verify_rs = False
    rs_looked_up = False
    rs_info = {}

    if query == 'random':
        # Use bedfile when fetching random
        line = _random_line(full_path_bed)
        chrom, pos = line.split("\t")[0:2]
        region = "{}:{}-{}".format(chrom, pos, int(pos) + 1)
    elif query.startswith("rs"):
        rs_info = _resolve_rsid(query)
        rs_looked_up = True
        check_rs = rs_info['synonyms'] + [rs_info['name']]
        region = rs_info['region']

        # Expand the rs region but verify rs number from results.
        chrom, start, end = re.split("[:-]",region)
        start = int(start) - 100
        end = int(end) + 100
        region = "{chrom}:{start}-{end}".format(**locals())
        verify_rs = True
    else:
        # Check that region is properly formatted
        region_match = re.match('^[0-9]{1,2}:[0-9]+$', query)
        if region_match is None:
            err_msg = "Malformed region: '{}'".format(query)
            raise InvalidUsage(err_msg, status_code=400)
        region = query
        chrom = region.split(":")[0]
        start = region.split(":")[1]
        region = "{chrom}:{start}-{start}".format(**locals())

    # Put together the region
    coords = _load_population_coords(dataset)
    results = list(tabix_region(full_path, region))
    if not results:
        err_msg = "Variant at position '{}' not found".format(region)
        raise InvalidUsage(err_msg, status_code=400)

    variant_response = []
    for line in results:
        response = {}
        line = line.strip().split()
        chrom, pos, rsID, pop, ref, alt, n_obs, x_obs, freq = map(autoconvert, line)[0:11]

        if verify_rs:
            if query != rsID:
                continue

        # If the rsID is in the dataset, provide it back.
        if rs_looked_up is False:
            if rsID.startswith("rs"):
                rs_info = {'name': rsID}
            rs_looked_up = True

        # Strip '*' from pop names.
        pop = pop.strip("*")

        # Verify rsID
        if check_rs:
            if rsID not in check_rs:
                err_msg = "rsID '{}' not found".format(query)
                raise InvalidUsage(err_msg, status_code=400)

        response['chrom_pos'] = '{}:{}'.format(chrom, pos)
        response['alleles'] = [ref, alt]
        response['xobs'] = x_obs
        response['nobs'] = n_obs
        response['rawfreq'] = freq
        response['pop'] = pop
        response['pos'] = coords[pop]
        response['rsID'] = rsID
        variant_response.append(response)

    max_freq = max([x['rawfreq'] for x in variant_response])
    freq_scale, freq_multi = _define_freqscale(max_freq)
    for row in variant_response:
        row['freqscale'] = freq_scale
        row['freq'] = [row['rawfreq'] * freq_multi,
                       1.0 - (row['rawfreq'] * freq_multi)]

    # General info regarding variant
    rs_info['chrom'], rs_info['pos'] = variant_response[0]['chrom_pos'].split(":")
    rs_info['pos'] = int(rs_info['pos'])
    rs_info['alleles'] = variant_response[0]['alleles']
    response_json = {
        'variant': rs_info,
        'data': variant_response
    }

    return jsonify(response_json)



@app.route("/api/tabix/<string:dataset>/<string:region>", methods=['GET'])
@app.route("/api/tabix/<string:dataset>/<string:region>/dl", methods=['GET'])
@login_required
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

