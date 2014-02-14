import datetime
import gzip
import os
import re
from StringIO import StringIO
import time

import boto
from boto.s3.key import Key
import envoy
from flask import json 
from peewee import Model, PostgresqlDatabase, BooleanField, DateTimeField, ForeignKeyField, IntegerField, TextField
import requests

import app_config

secrets = app_config.get_secrets()
db = PostgresqlDatabase(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG, password=secrets.get('MUSICGAME_POSTGRES_PASSWORD', None))

class PSQLMODEL(Model):
    """
    Base class for Peewee models. Ensures they all live in the same database.
    """
    def to_dict(self):
        return self.__dict__['_data']

    class Meta:
        database = db

class Category(PSQLMODEL):
    """
    A category of quizzes. An arcade cabinet within the arcade.
    """
    name = TextField()

    def __unicode__(self):
        return self.name

class Photo(PSQLMODEL):
    """
    A photo referenced from a Quiz, Question or Choice.
    """
    credit = TextField()
    caption = TextField()
    file_path = TextField(null=True)
    rendered_file_path = TextField(null=True)
    render_image = BooleanField(default=False)

    def __unicode__(self):
        return self.credit, self.caption

    def render_image_file(self):
        """
        Right now, this just uploads it to S3.
        """

        # Get the file path.
        unrendered_path, unrendered_file = os.path.split(self.file_path)

        # Get the name and extension from the filename.
        file_name, file_extension = os.path.splitext(unrendered_file)

        # Make a timestamp so we can have unique filenames.
        now = datetime.datetime.now()
        timestamp = int(time.mktime(now.timetuple()))

        # Timestamp for uniqueness.
        file_name = '%s-%s' % (timestamp, file_name)

        # Set an S3 path for uploading.
        s3_path = '%s/live-data/img/%s%s' % (app_config.PROJECT_SLUG, file_name, file_extension)

        # Connect to S3.
        s3 = boto.connect_s3()

        buckets = app_config.S3_BUCKETS

        if not app_config.DEPLOYMENT_TARGET:
            buckets = ['stage-apps.npr.org']

        # Loop over our buckets.
        for bucket_name in buckets:
            bucket = s3.get_bucket(bucket_name)

            # Set the key as a content_from_filename
            # CHRIST CONTENT TYPES SUCK
            k = Key(bucket, s3_path)
            k.set_contents_from_filename('%s' % (self.file_path), headers={
                'Cache-Control': 'max-age=5'
            })

            # Everyone can read it.
            k.set_acl('public-read')

        # Set the rendered file path as the S3 bucket path.
        setattr(self, 'rendered_file_path', 'http://%s.s3.amazonaws.com/%s' % (
            buckets[0],
            s3_path))

    def save(self, *args, **kwargs):
        """
        Do things on save.
        """

        if self.render_image:
            self.render_image_file()

        super(Photo, self).save(*args, **kwargs)

class Audio(PSQLMODEL):
    """
    An audio fragment referenced from a Quiz, Question or Choice.
    """
    credit = TextField()
    caption = TextField()
    file_path = TextField(null=True)
    rendered_oga_path = TextField(null=True, default=None)
    rendered_mp3_path = TextField(null=True, default=None)
    render_audio = BooleanField(default=False)

    def __unicode__(self):
        return self.credit, self.caption

    def render_audio_files(self):
        """
        Render the audio using envoy and the file path.
        Update the rendered_oga_path with the path to the ogg encoded file.
        Update the rendered_mp3_path with the path to the mp3 encoded file.
        If anything fails, just write null to those paths.
        """

        try:

            # Make a timestamp so we can have unique filenames.
            now = datetime.datetime.now()
            timestamp = int(time.mktime(now.timetuple()))

            # Set the unrendered file path to none in case this all fails.
            unrendered_file = None

            # If this is a legacy file path, e.g., from an old game, it's a Web URL.
            if "http://" in self.file_path:

                # Get the file.
                r = requests.get(self.file_path)

                # Hope it's still there.
                if r.status_code == 200:

                    # Get the file name.
                    file_name = self.file_path.split('/')[::-1][0].split('.mp3')[0]

                    # Yeah, they're all MP3s.
                    file_extension = 'mp3'

                    # Time stamp it.
                    file_name = '%s-%s' % (timestamp, file_name)

                    # Write the temp file.
                    with open('%s-temp.mp3' % file_name, 'wb') as writefile:
                        writefile.write(r.content)

                    # Write a wav file so that oggenc can convert mumblemumblehateyoumumble
                    envoy.run('mpg123 -w "%s-temp.wav" "%s-temp.mp3"' % (
                        file_name, file_name))

                    # Have oggenc encode against the temp wav file.
                    envoy.run('oggenc -m 96 -M 96 -o "%s.oga" --downmix "%s-temp.wav"' % (
                        file_name, file_name))

                    # Have lame encode against the original mp3 just in case it's huge.
                    envoy.run('lame -m m -b 96 "%s-temp.mp3" "%s.mp3"' % (
                        file_name, file_name))

                else:
                    pass

            else:

                # The other path is a local file, delivered to us via flash or something.
                # Get the path using os.
                unrendered_path, unrendered_file = os.path.split(self.file_path)

                # Get the name and extension from the filename.
                file_name, file_extension = os.path.splitext(unrendered_file)

                # Timestamp for uniqueness.
                file_name = '%s-%s' % (timestamp, file_name)

                # Write a wav file so that oggenc can convert mumblemumblehateyoumumble
                envoy.run('mpg123 -w "%s-temp.wav" "%s"' % (
                        file_name, self.file_path))

                # Write an ogg file.
                envoy.run('oggenc -m 96 -M 96 -o "%s.oga" --downmix "%s"' % (
                    file_name, self.file_path))

                # Write an mp3 file.
                envoy.run('lame -m m -b 96 "%s" "%s.mp3"' % (
                    self.file_path, file_name))

            # Loop over our ogg/mp3 files and do stuff.
            for extension, content_type in [('oga', 'audio/ogg'), ('mp3', 'audio/mpeg')]:

                # Like, for example, set an S3 path for uploading.
                s3_path = '%s/live-data/audio/%s%s' % (app_config.PROJECT_SLUG, file_name, extension)

                # Connect to S3.
                s3 = boto.connect_s3()

                # Loop over our buckets.
                for bucket_name in app_config.S3_BUCKETS:
                    bucket = s3.get_bucket(bucket_name)

                    # Set the key as a content_from_filename
                    k = Key(bucket, s3_path)
                    k.set_contents_from_filename('%s.%s' % (file_name, extension), headers={
                        'Content-Type': content_type,
                        'Cache-Control': 'max-age=5'
                    })

                    # Everyone can read it.
                    k.set_acl('public-read')

                # Set the rendered file path as the S3 bucket path.
                setattr(self, 'rendered_%s_path' % extension, 'http://%s.s3.amazonaws.com/%s' % (
                    app_config.S3_BUCKETS[0],
                    s3_path))

            # Flag this back to false.
            self.render_audio = False

        except:

            # NOTE: THIS MIGHT NEED TO BE RETHOUGHT.
            # Put some mind grapes on this.
            self.rendered_oga_path = None
            self.rendered_mp3_path = None

        # Clean up after ourselves. So messy.
        envoy.run('rm -f *.wav')
        envoy.run('rm -f *.mp3')
        envoy.run('rm -f *.oga')

    def save(self, *args, **kwargs):
        """
        Do things on save.
        """

        if self.render_audio:
            self.render_audio_files()

        super(Audio, self).save(*args, **kwargs)

class Quiz(PSQLMODEL):
    """
    A single quiz game.

    Quizzes have Questions.
    """
    category = ForeignKeyField(Category, null=True, related_name='quizzes')
    slug = TextField()
    title = TextField()
    text = TextField()
    tags = TextField(null=True)
    created = DateTimeField()
    updated = DateTimeField()
    byline = TextField(null=True)
    photo = ForeignKeyField(Photo, null=True)

    def __unicode__(self):
        return self.title

    def flatten(self):
        """
        Flattens a quiz and all it's related parts for serialization.
        """
        flat = self.to_dict()
        flat['questions'] = [q.to_dict() for q in self.questions]
        flat['category'] = self.category.to_dict() if self.category else None
        flat['photo'] = self.photo.to_dict() if self.photo else None

        for i, question in enumerate(self.questions):
            question_flat = flat['questions'][i]
            question_flat['choices'] = [c.to_dict() for c in question.choices]
            question_flat['audio'] = question.audio.to_dict() if question.audio else None
            question_flat['photo'] = question.photo.to_dict() if question.photo else None

            for j, choice in enumerate(question.choices):
                choice_flat = question_flat['choices'][j]
                choice_flat['audio'] = choice.audio.to_dict() if choice.audio else None
                choice_flat['photo'] = choice.photo.to_dict() if choice.photo else None

        return flat

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slugify()

        super(Quiz, self).save(*args, **kwargs)

        self.deploy()

    def deploy(self):
        """
        Deploy this quiz JSON to S3.
        """
        data = json.dumps(self.flatten())

        s3 = boto.connect_s3()

        gzip_buffer = StringIO()

        with gzip.GzipFile(fileobj=gzip_buffer, mode='w') as f:
            f.write(data)

        data = gzip_buffer.getvalue()

        s3 = boto.connect_s3()

        for bucket_name in app_config.S3_BUCKETS:
            bucket = s3.get_bucket(bucket_name)

            k = Key(bucket, '%s/live-data/games/%s.json' % (app_config.PROJECT_SLUG, self.slug))
            k.set_contents_from_string(data, headers={
                'Content-Type': 'application/json',
                'Content-Encoding': 'gzip',
                'Cache-Control': 'max-age=5'
            })
            k.set_acl('public-read')

    def slugify(self):
        """
        Generate a slug for this playground.
        """
        bits = []

        for field in ['title']:
            attr = getattr(self, field)

            if attr:
                attr = attr.lower()
                attr = re.sub(r"[^\w\s]", '', attr)
                attr = re.sub(r"\s+", '-', attr)

                bits.append(attr)

        base_slug = '-'.join(bits)

        slug = base_slug
        i = 1

        while Quiz.select().where(Quiz.slug == slug).count():
            i += 1
            slug = '%s-%i' % (base_slug, i)

        self.slug = slug


    # TODO:
    # 1. Handle serializing/deserializing tags.
    # 2. Handle auto-stamping updated/created fields.
    # 3. Handle the image field save.

class Question(PSQLMODEL):
    """
    A single quiz question.

    Questions have Choices.
    """
    quiz = ForeignKeyField(Quiz, null=True, related_name='questions')
    text = TextField()
    order = IntegerField()
    after_text = TextField(null=True)
    photo = ForeignKeyField(Photo, null=True)
    audio = ForeignKeyField(Audio, null=True)

    def __unicode__(self):
        return "%s.) %s" % (self.order, self.text)

class Choice(PSQLMODEL):
    """
    A single question choice.
    """
    question = ForeignKeyField(Question, null=True, related_name='choices')
    text = TextField()
    order = IntegerField()
    correct_answer = BooleanField(default=False)
    photo = ForeignKeyField(Photo, null=True)
    audio = ForeignKeyField(Audio, null=True)

    def __unicode__(self):
        return self.text

