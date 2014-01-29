#!/usr/bin/env python

import argparse

from flask import Flask, render_template

import app_config
import games
from render_utils import make_context, urlencode_filter
import static

app = Flask(app_config.PROJECT_NAME)

app.jinja_env.filters['urlencode'] = urlencode_filter

@app.route('/test/test.html')
def test_dir():
    return render_template('index.html', **make_context())

app.register_blueprint(games.games, url_prefix='/game')
app.register_blueprint(static.static)

# Boilerplate
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-p', '--port')
    args = parser.parse_args()
    server_port = 8000

    if args.port:
        server_port = int(args.port)

    app.run(host='0.0.0.0', port=server_port, debug=app_config.DEBUG)
