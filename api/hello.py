from flask import Flask, jsonify
app = Flask(__name__)

@app.route("/api/ld/<string:dataset>/<string:query>", methods=['GET'])
def find_ld():
    return "Hello world!"