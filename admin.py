#!/usr/bin/env python

import base64

import flask
from flask import Blueprint, jsonify, render_template, request
from flask_peewee.serializer import Serializer

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

@admin.route('/upload-photo/', methods=['POST'])
def upload_photo():
    """
    Upload a photo, bypassing the API for cleaner invocation.
    """
    data = request.form

    photo = {
        'credit': data.get('credit', ''),
        'caption': data.get('caption', ''),
        'file_name': data.get('file_name', ''),
    }

    photo = models.Photo(**photo)
    photo.write_photo(data['file_string'])

    photo.save()

    serializer = Serializer()
    data = serializer.serialize_object(photo)

    return jsonify(data)

@admin.route('/upload-audio/', methods=['POST'])
def upload_audio():
    """
    Upload some audio, bypassing the API for cleaner invocation.
    """
    data = request.form

    audio = {
        'credit': data.get('credit', ''),
        'caption': data.get('caption', ''),
        'file_name': data.get('file_name', ''),
    }

    # Create the model
    audio = models.Audio(**audio)
    audio.process_audio(data['file_string'])

    audio.save()

    serializer = Serializer()
    data = serializer.serialize_object(audio)

    return jsonify(data)

@admin.route('/update-seamus-url/<quiz_slug>/', methods=['POST'])
def _update_seamus_url(quiz_slug):
    """
    Shortcut route to save only the Seamus URL for a quiz.
    """
    quiz = models.Quiz.get(slug=quiz_slug)
    quiz.seamus_url = request.form.get('seamus_url')
    quiz.save()

    return ('', 200)

@admin.route('/deploy/<quiz_slug>/')
def _publish_quiz(quiz_slug):
    """
    Publish a quiz.
    """
    quiz = models.Quiz.get(slug=quiz_slug)
    quiz.deploy()

    return ('', 200)
