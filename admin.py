#!/usr/bin/env python

import flask
from flask import Blueprint, json, jsonify, render_template, request
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

@admin.route('/preview.html')
def preview():
    """
    Render a game preview page.
    """
    return render_template('admin/preview.html', **make_context())

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

    audio = models.Audio(**audio)
    audio.write_audio(data['file_string'])

    audio.save()

    serializer = Serializer()
    data = serializer.serialize_object(audio)

    return jsonify(data)
