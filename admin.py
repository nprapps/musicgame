#!/usr/bin/env python

import flask
from flask import Blueprint, render_template

import app_config
import models
from render_utils import make_context

admin = Blueprint('admin', __name__)

@admin.route('/admin/quiz/')
def admin_quiz_list():
    """
    List view of quizzes in the DB, sorted by insertion order.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    context = make_context()

    context['quizzes'] = models.Quiz.select()

    return render_template('admin/admin.html', **context)

@admin.route('/admin/quiz/<quiz_id>/')
def admin_quiz_detail(quiz_id):
    """
    A detail view of a single quiz.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    context = make_context()

    quiz = models.Quiz.get(models.Quiz.id == int(quiz_id))

    context['quiz'] = quiz

    quiz_flat = quiz.to_dict()
    quiz_flat['questions'] = [q.to_dict() for q in quiz.questions]

    for i, question in enumerate(quiz.questions):
        question_flat = quiz_flat['questions'][i]
        question_flat['choices'] = [c.to_dict() for c in question.choices]
        question_flat['audio'] = question.audio[0].to_dict() if question.audio.count() else None
        question_flat['photo'] = question.photo[0].to_dict() if question.photo.count() else None

        for j, choice in enumerate(question.choices):
            choice_flat = question_flat['choices'][j]
            choice_flat['audio'] = choice.audio[0].to_dict() if choice.audio.count() else None
            choice_flat['photo'] = choice.photo[0].to_dict() if choice.photo.count() else None


    context['quiz_json'] = flask.json.dumps(quiz_flat)

    return render_template('admin/admin.html', **context)