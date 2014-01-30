#!/usr/bin/env python

import os

import envoy
from flask import Blueprint, render_template, url_for

from render_utils import make_context

games = Blueprint('games', __name__)

@games.route('/<string:slug>/preview.html')
def _preview(slug):
    """
    Render a game preview page.
    """
    context = make_context()
    context['slug'] = slug

    return render_template('preview.html', **context)

@games.route('/<string:slug>/game.html')
def _game(slug):
    """
    Render the game itself.
    """
    context = make_context()
    context['slug'] = slug

    return render_template('game.html', **context)

def render_games(slugs=None):
    """
    Render each game.

    From playgrounds2:
    https://github.com/nprapps/playgrounds2/blob/master/data.py#L163
    """
    from flask import g

    import app

    if not slugs:
        # TODO
        slugs = get_games()

    compiled_includes = []

    for slug in slugs:
        # Silly fix because url_for require a context
        with app.app.test_request_context():
            path = url_for('games._game', slug=slug)
            file_path = '.games%s' % path

        with app.app.test_request_context(path=path):
            print 'Rendering %s' % file_path

            g.compile_includes = True
            g.compiled_includes = compiled_includes

            view = _game
            content = view(slug)

            compiled_includes = g.compiled_includes

        # Ensure path exists
        head = os.path.split(file_path)[0]

        try:
            os.makedirs(head)
        except OSError:
            pass

        with open(file_path, 'w') as f:
            f.write(content.encode('utf-8'))

def deploy_games(slugs):
    """
    Deploy games to S3.
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

        
