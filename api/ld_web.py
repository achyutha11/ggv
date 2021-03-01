import yaml 
import os
from io import StringIO
from flask import Flask, jsonify
from subprocess import Popen, PIPE
from scipy.stats import pearsonr
from cyvcf2 import VCF
import pandas as pd
import numpy as np 
import requests
# from api_ld import calc_ld_score, get_local_ld, pairwise_ld

import json
app = Flask(__name__)

# Setup the configuration
config_yaml = '../sandbox/config.yaml'
app.config['YAML_CONFIG'] = yaml.load(open(config_yaml, 'r').read())
YAML_CONFIG = app.config['YAML_CONFIG']
print(YAML_CONFIG)

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




@app.route("/")
def base_func():
    return ""

def ld_to_json(ld_matrix):
    """
    Convert a numpy LD matrix to desired format.

    Input:
        ld_matrix: numpy matrix - every row and column is a SNP

    Returns:
        Lower triangular LD matrix (json) 
    """
    n = len(ld_matrix[0])
    assert ld_matrix.shape == (n, n)
    lower_tri = np.tril(ld_matrix)
    
    response_json = {'ld_mat': json.dumps(lower_tri.tolist())}

    return response_json

def _get_local_ld(path, chrom, pos, window_size=100000):
  """
  Obtain the local LD-matrix containing snps around a position
  Arguments:
    path: path to the VCF file
    chrom: the chromosome (currently as a string)
    pos: position as an integer
    window_size: size of surrounding window centered on pos
      NOTE:  raise a warning box if window_size > 1 Mb?

  TODO: draft function by Arjun (need to jsonify later)  
  """
  emerald = YAML_CONFIG["emeraLD_path"]
  start = int(pos - window_size/2)
  end = int(pos + window_size/2)
  region = "%s:%d-%d" % (chrom, start, end)
  comm = [emerald, "-i", path, "--region", region, "--matrix", "--extra", "--stdout"]
  # Actually run the shell command
  ld_mat, err = Popen(comm, stdout=PIPE, stderr=PIPE).communicate()
  # Generate a dataframe from the string
  ld_df = pd.read_table(StringIO(ld_mat.decode('utf-8')), header=None).values
  # Return the snp information and lower-tri LD matrix
  snp_info = ld_df[:,:4]
  ld_mat = ld_df[:,4:].astype(np.float32)
  ld_mat = np.tril(ld_mat**2)
  return(snp_info, ld_mat)


def _calc_ld_score(path, chrom, pos, window_size=1e6):
  """
    Calculate the LD-score of a variant as the sum of empirical R^2
    Arguments:
      path: path to VCF file
      chrom: chromosome (currently string)
      pos: basepair position
      window_size: window to compute LD-score in
  TODO: draft function by Arjun (need to jsonify later)  
  """
  emerald = YAML_CONFIG["emeraLD_path"]
  start = int(pos - window_size)
  end = int(pos + window_size)
  region = "%s:%d-%d" % (chrom, start, end)
  snp = "%s:%d" % (chrom, pos)
  comm = [emerald, "-i", path, "--region", region, "--snp", snp, "--stdout"]
  # Actually run the shell command!
  out, err = Popen(comm, stdout=PIPE, stderr=PIPE).communicate()
  # NOTE: this doesn't actually calculate the full LD-score!
  ld_df = pd.read_table(StringIO(out.decode('utf-8')), header=None).values
  ld_score = np.sum(ld_df[1:,4].astype(np.float32))
  return(ld_df, ld_score)

def _pairwise_ld(path, chrom, pos1, pos2):
  """Compute the pairwise LD using cyvf2

     NOTE: This adds an extra dependency
     ALTERNATIVE: use vanilla tabix and post-process genotype vectors  
  """ 
  vcf = VCF(path, gts012=True, lazy=True)
  region1 = "%s:%d-%d" % (chrom, pos1, pos1+1)
  region2 = "%s:%d-%d" % (chrom, pos2, pos2+1)
  paired_geno = []
  for r in [region1, region2]:
    for v in vcf(r):
      paired_geno.append(v.gt_types)
  # Check that we have two variants here 
  assert(len(paired_geno) == 2)
  # Compute the pearson r^2
  r = pearsonr(paired_geno[0], paired_geno[1])[0]
  # Generate a dictionary for this
  cur_pairwise_ld = {}
  cur_pairwise_ld['r'] = r
  cur_pairwise_ld['r2'] = r**2
  return pairwise_ld

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

@app.route("/api/ld/<string:dataset>/<string:pop>/<string:query>/")
def fetch_ld(dataset, pop, query):
    """
        Perform an request for population-specific LD
        dataset

        Queries can be formatted as:
        * "chr22:<rsID>:w10000" - calculate LD within 10000 basepairs
        * "chr22:<rsID>:ld10000" - calculate the ldscore using variants within 10000
        * "chr22:<rsID>:<rsID>" - calculate pairwise r2 between the two variants
    """
    try:
        # 1. Check if the dataset makes sense
        real_dataset = YAML_CONFIG['ld_datasets'][dataset]
        data_base_path = real_dataset['base_path']
        # 2. Check that the chromosome makes sense
        
        # NOTE: chrom should be a 22
        chrom = int(query[3:].split(':')[0])
        id1 = query[3:].split(':')[1]
        id2 = query[3:].split(':')[2]

        # Obtain the path of the data 
        data_file_path = data_base_path + real_dataset['chromosomes'][chrom][pop]
        query_response = None
        if id2.startswith("w"):
            # print("here!")
            # Case 1: calculate the window of LD
            window_size = int(id2[1:])
            if id1.startswith("rs"):
                rsinfo = _resolve_rsid(id1)
                rs_chrom = rsinfo['region'].split(':')[0]
                rs_pos = rsinfo['region'].split(":")[1].split('-')[0]
                # Check if the chromosome matches after resolving rsID
                assert(rs_chrom == str(chrom))
                # NOTE : need some way to generate json for the snp-information too!
                snp_info, ld_mat = _get_local_ld(data_file_path, rs_chrom, int(rs_pos), window_size=window_size)  
                query_response = ld_to_json(ld_mat)
            else:
                # treat the id as the position now... 
                pos = int(id1)
                snp_info, ld_mat = _get_local_ld(data_file_path, chrom, pos, window_size=window_size)
                query_response = ld_to_json(ld_mat) 
        elif id2.startswith("ld"):
            # Case 2: calculate the LD-score
            window_size = int(id2[2:])
            if id1.startswith("rs"):
                chrom_pos = _resolve_rsid(id1)
                # Check if the chromosome matches after resolving rsID
                assert(chrom_pos['seq_region_name'] == str(chrom))
                pos = int(chrom_pos['end'])
                snp_info, ldscore = _calc_ld_score(data_file_path, chrom, pos, window_size=window_size)
            else:
                pos = int(id1)
                snp_info, ldscore = _calc_ld_score(data_file_path, chrom, pos, window_size=window_size)
                
        else:
            raise NotImplementedError('This query is not implemented yet!')
        response = {
            "dataset": dataset,
            "query": {
                "raw": query,
                "chr": chrom,
                "id1": id1,
                "id2": id2
                }
            }
        return jsonify(response)
    except Exception as e:
        response = jsonify({'message': "Improper orientation", 
                            'error': 400, 
                            'err_msg': str(e)})
        return(response)