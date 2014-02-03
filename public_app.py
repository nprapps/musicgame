#!/usr/bin/env python

import argparse
import datetime
import gzip
import json
import logging
from StringIO import StringIO

import boto
from boto.s3.key import Key
from flask import Flask, redirect, request, render_template, url_for

import admin
import app_config
import games
from render_utils import make_context, urlencode_filter
import static

app = Flask(app_config.PROJECT_NAME)

app.jinja_env.filters['urlencode'] = urlencode_filter

app.register_blueprint(admin.admin, url_prefix='/%s' % app_config.PROJECT_SLUG)
app.register_blueprint(games.games, url_prefix='/%s' % app_config.PROJECT_SLUG)
app.register_blueprint(static.static, url_prefix='/%s' % app_config.PROJECT_SLUG)

app.config['PROPAGATE_EXCEPTIONS'] = True

file_handler = logging.FileHandler(app_config.APP_LOG_PATH)
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)

@app.route('/%s/' % app_config.PROJECT_SLUG)
def index():
    """
    Render the admin index.
    """
    context = make_context()

    return render_template('index.html', **context)

@app.route('/%s/publish/' % app_config.PROJECT_SLUG)
def _publish_game():
    """
    Publish game JSON to S3.
    """
    slug = request.args.get('quiz', '')

    # TODO: get real quiz data from filesystem/database
    data = '{ "placeholder": "TKTK" }'

    gzip_buffer = StringIO()

    with gzip.GzipFile(fileobj=gzip_buffer, mode='w') as f:
        f.write(data)

    data = gzip_buffer.getvalue()

    s3 = boto.connect_s3()

    for bucket_name in app_config.S3_BUCKETS:
        bucket = s3.get_bucket(bucket_name)

        k = Key(bucket, '%s/live-data/games/%s' % (app_config.PROJECT_SLUG, slug))
        k.set_contents_from_string(data, headers={
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'Cache-Control': 'max-age=5'
        })
        k.set_acl('public-read')

    return redirect(url_for('games.preview'))

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
