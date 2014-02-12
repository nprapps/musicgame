#!/usr/bin/env python

import flask
from flask import Blueprint, render_template

import app_config
import models
from render_utils import make_context

admin = Blueprint('admin', __name__)

@admin.route('/admin/')
def admin_quiz_list():
    """
    List view of quizzes in the DB, sorted by insertion order.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    context = make_context()

    context['quizzes'] = models.Quiz.select()

    return render_template('admin/admin_index.html', **context)

@admin.route('/admin/quiz/<quiz_id>/')
def admin_quiz_detail(quiz_id):
    """
    A detail view of a single quiz.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    context = make_context()

    quiz = models.Quiz.get(models.Quiz.id == int(quiz_id))

    context['quiz'] = quiz
    context['quiz_json'] = flask.json.dumps(quiz.flatten())

    return render_template('admin/admin_detail.html', **context)
