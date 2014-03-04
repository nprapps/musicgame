import base64
import datetime
import glob
import gzip
import json
import os
import re
from StringIO import StringIO
import time

import boto
from boto.s3.key import Key
import envoy
from flask import json
from peewee import Model, PostgresqlDatabase, BooleanField, DateField, DateTimeField, ForeignKeyField, IntegerField, TextField

import app_config

secrets = app_config.get_secrets()
db = PostgresqlDatabase(
    app_config.PROJECT_SLUG,
    user=secrets.get('MUSICGAME_POSTGRES_USER', app_config.PROJECT_SLUG),
    password=secrets.get('MUSICGAME_POSTGRES_PASSWORD', None),
    host=secrets.get('MUSICGAME_POSTGRES_HOST', 'localhost'),
    port=secrets.get('MUSICGAME_POSTGRES_PORT', 5432)
)

class PSQLMODEL(Model):
    """
    Base class for Peewee models. Ensures they all live in the same database.
    """
    def to_dict(self):
        return dict(self.__dict__['_data'])

    class Meta:
        database = db

class Photo(PSQLMODEL):
    """
    A photo referenced from a Quiz, Question or Choice.
    """
    credit = TextField()
    caption = TextField()
    file_name = TextField(null=True)
    rendered_600_path = TextField(null=True)
    rendered_300_path = TextField(null=True)

    def __unicode__(self):
        # return json.loads(self.rendered_file_paths)['624']
        return self.file_name

    def get_rendered_file_paths(self):
        return json.loads(self.rendered_file_paths)

    def write_photo(self, file_string):
        """
        Accepts base64-encoded string from the admin form.
        If s3 buckets are available, deploys to s3.
        If not, deploys to www/live-data/img/.
        """

        timestamp = int(time.mktime(datetime.datetime.now().timetuple()))

        file_type, data = file_string.split(';')
        prefix, data = data.split(',')

        decoded_file = base64.b64decode(data)

        file_name = '%s-%s' % (timestamp, self.file_name)

        rendered_path = 'live-data/img'

        if not os.path.exists('/tmp/%s' % app_config.PROJECT_SLUG):
            os.makedirs('/tmp/%s' % app_config.PROJECT_SLUG)

        # Write the initial file.
        with open('/tmp/%s/%s' % (app_config.PROJECT_SLUG, file_name), 'wb') as writefile:
            writefile.write(decoded_file)

        # Write the rendered files.
        for width in app_config.IMAGE_WIDTHS:
            os.system('convert -resize %s /tmp/%s/%s /tmp/%s/%spx-%s' % (
                width,
                app_config.PROJECT_SLUG,
                file_name,
                app_config.PROJECT_SLUG,
                width,
                file_name))

        # Glob for all of the files.
        for resized_image in glob.glob('/tmp/%s/*px-%s' % (app_config.PROJECT_SLUG, file_name)):
            file_path, file_name = os.path.split(resized_image)
            file_name, file_extension = os.path.splitext(file_name)

            with open(resized_image, 'rb') as readfile:
                decoded_file = readfile.read()

            r = '%s/%s%s' % (
                rendered_path, file_name, file_extension)

            width = resized_image.split('px')[0].split(file_path)[1].replace('/', '')

            # Deployed
            if app_config.S3_BUCKETS:

                # Connect to S3.
                s3 = boto.connect_s3()

                r = '%s/%s' % (app_config.PROJECT_SLUG, r)

                for bucket_name in app_config.S3_BUCKETS:
                    bucket = s3.get_bucket(bucket_name)

                    k = Key(bucket, r)
                    k.set_contents_from_string(decoded_file, headers={
                        'Cache-Control': 'max-age=5'
                    })

                    k.set_acl('public-read')

                setattr(self, 'rendered_%s_path' % width, 'http://%s.s3.amazonaws.com/%s' % (
                    app_config.S3_BUCKETS[0], r))

            # Local
            else:
                local_path = 'www/%s' % r

                dirname = os.path.dirname(local_path)

                if not os.path.exists(dirname):
                    os.makedirs(dirname)

                with open(local_path, 'wb') as writefile:
                    writefile.write(decoded_file)

                setattr(self, 'rendered_%s_path' % width, '/%s/%s' % (app_config.PROJECT_SLUG, r))

            os.system('rm -f %s' % resized_image)


class Audio(PSQLMODEL):
    """
    An audio fragment referenced from a Quiz, Question or Choice.
    """
    credit = TextField()
    caption = TextField()
    file_name = TextField(null=True)
    rendered_oga_path = TextField(null=True, default=None)
    rendered_mp3_path = TextField(null=True, default=None)

    def __unicode__(self):
        return self.file_name

    def process_audio(self, file_string):
        """
        Processes an uploaded file with `self.file_name`, which
        should exist in the temp directory.
        """

        timestamp = int(time.mktime(datetime.datetime.now().timetuple()))

        # Determine the extension.
        file_name, file_extension = os.path.splitext(self.file_name)

        # Append the timestamp so we don't clobber similarly named files from the past.
        file_name = '%s-%s' % (timestamp, file_name)

        file_type, data = file_string.split(';')
        prefix, data = data.split(',')

        decoded_file = base64.b64decode(data)

        if not os.path.exists('/tmp/%s' % app_config.PROJECT_SLUG):
            os.makedirs('/tmp/%s' % app_config.PROJECT_SLUG)

        with open('/tmp/%s/%s' % (app_config.PROJECT_SLUG, self.file_name), 'wb') as writefile:
            writefile.write(decoded_file)

        # If mp3, convert to wav for processing in ogg.
        if file_extension == ".mp3":
            os.system('mpg123 -w "/tmp/%s/%s-temp.wav" "/tmp/%s/%s"' % (
                app_config.PROJECT_SLUG, file_name, app_config.PROJECT_SLUG, self.file_name))
            wav_location = "/tmp/%s/%s-temp.wav" % (app_config.PROJECT_SLUG, file_name)

        # If wav, go directly to processing in ogg.
        if file_extension == ".wav":
            wav_location = '/tmp/%s/%s' % (app_config.PROJECT_SLUG, self.file_name)

        # Encode an OGA.
        os.system('oggenc -m 96 -M 96 -o "/tmp/%s/%s.oga" --downmix "%s"' % (
            app_config.PROJECT_SLUG, file_name, wav_location))

        # No matter what, process to 96kb mp3.
        os.system('lame -m m -b 96 "%s" "/tmp/%s/%s.mp3"' % (
            wav_location, app_config.PROJECT_SLUG, file_name))

        # Remove the WAV file now that we've processed it.
        os.system('rm -f %s' % wav_location)

        # Remove the original file.
        os.system('rm -f /tmp/%s/%s' % (app_config.PROJECT_SLUG, self.file_name))

        # If on production/staging, write the file to S3.
        if app_config.DEPLOYMENT_TARGET in ['staging', 'production']:

            for extension, content_type in [('oga', 'audio/ogg'), ('mp3', 'audio/mpeg')]:
                s3_path = '%s/live-data/audio/%s.%s' % (
                    app_config.PROJECT_SLUG, file_name, extension)

                s3 = boto.connect_s3()

                for bucket_name in app_config.S3_BUCKETS:
                    bucket = s3.get_bucket(bucket_name)

                    k = Key(bucket, s3_path)
                    k.set_contents_from_filename('/tmp/%s/%s.%s' % (
                        app_config.PROJECT_SLUG, file_name, extension),
                    headers={
                        'Content-Type': content_type,
                        'Cache-Control': 'max-age=5'
                    })
                    k.set_acl('public-read')

                setattr(self, 'rendered_%s_path' % extension, 'http://%s.s3.amazonaws.com/%s' % (
                    app_config.S3_BUCKETS[0],
                    s3_path))

                # Remove the temp files.
                os.system('rm -f /tmp/%s/%s.%s' % (
                    app_config.PROJECT_SLUG, file_name, extension))
                os.system('rm -f /tmp/%s/%s.%s' % (
                    app_config.PROJECT_SLUG, file_name, extension))

        # If local, write the file to www/live-data/audio.
        else:
            if not os.path.exists('www/live-data/audio'):
                os.makedirs('www/live-data/audio')

            envoy.run('mv /tmp/%s/%s.oga www/live-data/audio/' % (
                app_config.PROJECT_SLUG, file_name))
            envoy.run('mv /tmp/%s/%s.mp3 www/live-data/audio/' % (
                app_config.PROJECT_SLUG, file_name))

            self.rendered_mp3_path = '/%s/live-data/audio/%s.mp3' % (app_config.PROJECT_SLUG, file_name)
            self.rendered_oga_path = '/%s/live-data/audio/%s.oga' % (app_config.PROJECT_SLUG, file_name)

            # Remove the temp files.
            os.system('rm -f /tmp/%s/%s.oga' % (
                app_config.PROJECT_SLUG, file_name))
            os.system('rm -f /tmp/%s/%s.mp3' % (
                app_config.PROJECT_SLUG, file_name))

class Quiz(PSQLMODEL):
    """
    A single quiz game.

    Quizzes have Questions.
    """
    category = TextField(null=True)
    slug = TextField(null=True)
    title = TextField(null=True)
    text = TextField(null=True)
    tags = TextField(null=True)
    created = DateTimeField()
    updated = DateTimeField()
    author = TextField(null=True)
    photo = ForeignKeyField(Photo, null=True)
    seamus_url = TextField(null=True)
    seamus_pub_date = DateField(null=True)

    def __unicode__(self):
        return self.title

    def url(self):
        return '/%s/admin/quiz/%i' % (app_config.PROJECT_SLUG, self.id)

    def flatten(self):
        """
        Flattens a quiz and all it's related parts for serialization.
        """
        flat = self.to_dict()
        flat['questions'] = [q.to_dict() for q in self.questions]
        flat['category'] = self.category if self.category else None
        flat['photo'] = self.photo.to_dict() if self.photo else None

        flat['created'] = time.mktime(self.created.timetuple())
        flat['updated'] = time.mktime(self.updated.timetuple())
        flat['seamus_pub_date'] = time.mktime(self.seamus_pub_date.timetuple()) if self.seamus_pub_date else None

        for i, question in enumerate(self.questions):
            question_flat = flat['questions'][i]
            question_flat['choices'] = [c.to_dict() for c in question.choices]
            question_flat['audio'] = question.audio.to_dict() if question.audio else None
            question_flat['photo'] = question.photo.to_dict() if question.photo else None

            for j, choice in enumerate(question.choices):
                choice_flat = question_flat['choices'][j]
                choice_flat['audio'] = choice.audio.to_dict() if choice.audio else None
                choice_flat['photo'] = choice.photo.to_dict() if choice.photo else None

        next_quiz = self.get_next_quiz()

        if next_quiz:
            flat['next_quiz'] = {
                'title': next_quiz.title,
                'text': next_quiz.text,
                'photo': next_quiz.photo.to_dict() if next_quiz.photo else None
            }
        else:
            flat['next_quiz'] = None

        return flat

    def get_next_quiz(self):
        quiz = list(Quiz.select().where(Quiz.seamus_pub_date < self.seamus_pub_date).order_by(Quiz.seamus_pub_date.desc()).limit(1))

        if quiz:
            return quiz[0]
        else:
            return None

    def parse_seamus_pub_date(self):
        """
        Parse publish date from Seamus url. Example url:
        
        http://www.npr.org/blogs/allsongs/2014/03/04/285709660/foo-baz-bing
        """
        bits = self.seamus_url.strip('http://').split('/') 
        year, month, day = map(int, bits[3:6])

        return datetime.date(year, month, day)

    def save(self, *args, **kwargs):
        now = datetime.datetime.now()

        if not self.created:
            self.created = now
            self.updated = now
        else:
            self.updated = now

        if self.title and not self.slug:
            self.slugify()

        if self.seamus_url:
            self.seamus_pub_date = self.parse_seamus_pub_date()

        super(Quiz, self).save(*args, **kwargs)

    def deploy(self):
        """
        Deploy this quiz JSON to S3.
        """
        if not self.slug:
            return

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
        Generate a slug.
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

    class Meta:
        order_by = ('order',)

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

    class Meta:
        order_by = ('order',)

    def __unicode__(self):
        return self.text
