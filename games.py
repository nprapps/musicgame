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
