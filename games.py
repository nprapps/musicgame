#!/usr/bin/env python

from flask import render_template

from flask import Blueprint
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

