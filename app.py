#!/usr/bin/env python

import argparse
from glob import glob
import json

from flask import Flask, render_template

import app_config
from render_utils import make_context, urlencode_filter
import static

app = Flask(app_config.PROJECT_NAME)

app.jinja_env.filters['urlencode'] = urlencode_filter

# Example application views
@app.route('/')
def index():
    """
    Example view demonstrating rendering a simple HTML page.
    """

    context = make_context()
    context['top_singles_by_year'] = []

    with open('www/assets/data/tracks-by-year.json', 'rb') as readfile:

        tracks_by_year = json.loads(readfile.read())

        for year, track_list in tracks_by_year.items():
            year_dict = {}
            year_dict['year'] = year
            year_dict['choices'] = track_list
            context['top_singles_by_year'].append(year_dict)

    context['top_singles_by_year'] = sorted(context['top_singles_by_year'], key=lambda x: x['year'], reverse=True)

    return render_template('index.html', **context)

@app.route('/game/<string:slug>/preview.html')
def preview(slug):
    context = make_context()
    context['slug'] = slug

    return render_template('preview.html', **context)

@app.route('/game/<string:slug>/game.html')
def game(slug):
    context = make_context()
    context['slug'] = slug

    return render_template('game.html', **context)

@app.route('/test/test.html')
def test_dir():
    return render_template('index.html', **make_context())

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
