#!/usr/bin/env python

from flask import Blueprint, render_template

import app_config
import models
from render_utils import make_context

admin = Blueprint('admin', __name__)

@admin.route('/admin/<model_name>/')
def admin_quiz_list(model_name):
    """
    List view of quizzes in the DB, sorted by insertion order.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    context = make_context()

    model = getattr(models, model_name.title())

    context['obj_list'] = model.select()

    return render_template('admin/%s_list.html' % model_name, **context)

@admin.route('/admin/<model_name>/<obj_id>/')
def admin_quiz_detail(model_name, obj_id):
    """
    A detail view of a single quiz.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    context = make_context()

    model = getattr(models, model_name.title())

    context['obj'] = model.get(model.id == int(obj_id))

    return render_template('admin/%s_detail.html' % model_name, **context)