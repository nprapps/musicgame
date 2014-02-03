#!/usr/bin/env python

from flask import Blueprint, render_template

from render_utils import make_context
from models import Quiz

admin = Blueprint('admin', __name__)

@admin.route('/admin/quiz/')
def quiz_list():
    """
    List view of quizzes in the DB, sorted by insertion order.
    """
    context = make_context()

    context['quizzes'] = Quiz.select()

    return render_template('admin/quiz_list.html', **context)

@admin.route('/admin/quiz/<quiz_id>/')
def quiz_detail(quiz_id):
    """
    A detail view of a single quiz.
    """
    context = make_context()

    context['quiz'] = Quiz.select().where(Quiz.id == int(quiz_id))

    return render_template('admin/quiz_detail.html', **context)
