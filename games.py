#!/usr/bin/env python

import os

import envoy
from flask import Blueprint, render_template

from render_utils import make_context

games = Blueprint('games', __name__)

@games.route('/game.html')
def game():
    """
    Render the game itself.
    """
    return render_template('game.html', **make_context())

@games.route('/preview.html')
def preview():
    """
    Render a game preview page.
    """
    return render_template('preview.html', **make_context())

def deploy_games(slugs):
    """
    Deploy games to S3.

    TODO: deploy JSON instead of game.html, push to S3
    """
    for slug in slugs:
        path = '.games/game/%s' % slug
        gzip_path = '.games.gzip/game/%s' % slug

        if not os.path.exists(path):
            print 'Path does not exist: %s' % path

        if not os.path.exists(gzip_path):
            os.makedirs(gzip_path)

        r = envoy.run('python gzip_assets.py %s %s' % (path, gzip_path))

        if r.status_code != 0:
            print 'Error gzipping game!'

        
