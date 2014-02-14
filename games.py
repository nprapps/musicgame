#!/usr/bin/env python

from flask import Blueprint, render_template

from render_utils import make_context

games = Blueprint('games', __name__)

@games.route('/game.html')
def game():
    """
    Render the game itself.
    """
    # Set up standard page context.
    context = make_context()

    return render_template('game.html', **context)

