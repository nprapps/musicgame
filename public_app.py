#!/usr/bin/env python

import argparse
import datetime
import json
#import logging

from flask import Flask, redirect, render_template, url_for

import app_config
from render_utils import make_context, urlencode_filter
import static

app = Flask(app_config.PROJECT_NAME)

app.jinja_env.filters['urlencode'] = urlencode_filter

app.register_blueprint(static.static, url_prefix='/%s' % app_config.PROJECT_SLUG)

app.config['PROPAGATE_EXCEPTIONS'] = True

#file_handler = logging.FileHandler(app_config.APP_LOG_PATH)
#file_handler.setLevel(logging.INFO)
#app.logger.addHandler(file_handler)
#app.logger.setLevel(logging.INFO)

# Admin index
@app.route('/%s/' % app_config.PROJECT_SLUG)
def index():
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

# Scout uptime test route
@app.route('/%s/test/' % app_config.PROJECT_SLUG, methods=['GET'])
def _test_app():
    """
    Test route for verifying the application is running.
    """
    app.logger.info('Test URL requested.')

    return datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

# Local testing bare domain redirect
if app_config.DEPLOYMENT_TARGET is None:
    @app.route('/')
    def _index():
        return redirect(url_for('index'))

# Boilerplate
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-p', '--port')
    args = parser.parse_args()
    server_port = 8000

    if args.port:
        server_port = int(args.port)

    app.run(host='0.0.0.0', port=server_port, debug=app_config.DEBUG)
