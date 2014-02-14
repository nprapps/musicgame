#!/usr/bin/env python

import flask
from flask import Blueprint, render_template

import models
from render_utils import make_context

admin = Blueprint('admin', __name__)

@admin.route('/')
def admin_quiz_list():
    """
    List view of quizzes in the DB, sorted by insertion order.
    """
    context = make_context()

    context['quizzes'] = models.Quiz.select()

    return render_template('admin/index.html', **context)

@admin.route('/quiz/<quiz_id>/')
def admin_quiz_detail(quiz_id):
    """
    A detail view of a single quiz.
    """
    context = make_context()

    quiz = models.Quiz.get(models.Quiz.id == int(quiz_id))

    context['quiz'] = quiz
    context['quiz_json'] = flask.json.dumps(quiz.flatten())

    return render_template('admin/detail.html', **context)

@admin.route('/preview.html')
def preview():
    """
    Render a game preview page.
    """
    return render_template('admin/preview.html', **make_context())


