#!/usr/bin/env python

import argparse
import datetime
import logging

from flask import Flask, jsonify, redirect, render_template, url_for
from flask_peewee.rest import RestAPI, Authentication

import admin
import app_config
import games
import models
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

class AuthorizeEveryone(Authentication):
    """
    Authorize any single person to POST/PUT/DELETE because this is running internally.
    """
    def __init__(self):
        """
        Gotta super.
        """
        super(AuthorizeEveryone, self).__init__()

    def authorize(self):
        """
        Like I said, authorize everyone.
        """
        return True

authorize_everyone = AuthorizeEveryone()

api = RestAPI(app, default_auth=authorize_everyone, prefix="/%s/api" % app_config.PROJECT_SLUG)

api.register(models.Quiz, allowed_methods=['GET', 'POST', 'PUT', 'DELETE'])
api.register(models.Question, allowed_methods=['GET', 'POST', 'PUT', 'DELETE'])
api.register(models.Choice, allowed_methods=['GET', 'POST', 'PUT', 'DELETE'])
api.register(models.Photo, allowed_methods=['GET', 'POST', 'PUT', 'DELETE'])
api.register(models.Audio, allowed_methods=['GET', 'POST', 'PUT', 'DELETE'])

api.setup()

@app.route('/%s/' % app_config.PROJECT_SLUG)
def index():
    """
    Render the admin index.
    """
    context = make_context()

    return render_template('index.html', **context)

@app.route('/%s/quiz/<quiz_slug>/' % app_config.PROJECT_SLUG)
def _test_quiz(quiz_slug):
    """
    Get a serialized version of a quiz for testing.
    """
    quiz = models.Quiz.get(slug=quiz_slug)

    return jsonify(quiz.flatten())

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
