from flask import Flask, render_template, send_from_directory
app = Flask(__name__, static_url_path='/static')


@app.route('/')
def root():
    return app.send_static_file('index.html')

@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('static/js', path)

@app.route('/css/<path:path>')
def send_css(path):
    return send_from_directory('static/css', path)

@app.route('/data/<path:path>')
def send_data(path):
    return send_from_directory('static/data', path)



if __name__ == '__main__':
  app.run(debug=True)