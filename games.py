#!/usr/bin/env python

import os

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

def render_games(which_games=None):
    """
    Render each game.

    From playgrounds2:
    https://github.com/nprapps/playgrounds2/blob/master/data.py#L163
    """
    from flask import g

    import app

    if not which_games:
        # TODO
        which_games = get_games()

    slugs = [game['slug'] for game in which_games]

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

