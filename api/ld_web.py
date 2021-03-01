from flask import Flask, jsonify
import json
app = Flask(__name__)

@app.route("/")
def base_func():
    return ""


@app.route("/api/ld/<string:dataset>/<string:query>/")
def find_ld(dataset, query):

    chrom = None
    pos1 = None
    pos2 = None

    check_rs = False
    verify_rs = False

    if query.startswith("chr"):
        chrom = query[3:].split(':')[0]
        pos1 = query[3:].split(':')[1]
        pos2 = query[3:].split(':')[2]
    
    elif query.startswith("rs"):
        rs_1 = query[2:].split(':')[0]
        rs_2 = query[2:].split(':')[1]

    else:
        err_msg = "Query not formatted correctly: '{}'".format(query)
        return err_msg

    rv = {
        "dataset": dataset,
        "query": {
            "raw": query,
            "chr": chrom,
            "pos1": pos1,
            "pos2": pos2
            }
        }

    return jsonify(rv)

# filter based on validity of query and dataset
# Implement LD functions