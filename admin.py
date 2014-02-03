#!/usr/bin/env python

from flask import Blueprint, render_template

import app_config
import models
from render_utils import make_context

admin = Blueprint('admin', __name__)

@admin.route('/admin/quiz/')
def quiz_list():
    """
    List view of quizzes in the DB, sorted by insertion order.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    context = make_context()

    context['quizzes'] = models.Quiz.select()

    return render_template('admin/quiz_list.html', **context)

@admin.route('/admin/quiz/<quiz_id>/')
def quiz_detail(quiz_id):
    """
    A detail view of a single quiz.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    context = make_context()

    context['quiz'] = models.Quiz.select().where(models.Quiz.id == int(quiz_id))

    return render_template('admin/quiz_detail.html', **context)
