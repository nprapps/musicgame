from peewee import *
import app_config

db = PostgresqlDatabase(None)

class PSQLMODEL(Model):
    class Meta:
        database = db

class QuizCategory(PSQLMODEL):
    name = TextField()

    def __unicode__(self):
        return self.name

class Quiz(PSQLMODEL):
    quiz_category = ForeignKeyField(QuizCategory, null=True, blank=True)
    title = TextField()
    text = TextField()
    tags = TextField(null=True, blank=True)
    created = DateTimeField()
    updated = DateTimeField()
    byline = TextField(null=True, blank=True)

    def __unicode__(self):
        return self.title

    @classmethod
    def questions(self):
        payload = []
        for obj in Question.select().where(Question.quiz.id == self.id):
            payload.append(obj.__dict__['data'])

        return payload

    # TODO:
    # 1. Handle serializing/deserializing tags.
    # 2. Handle auto-stamping updated/created fields.
    # 3. Handle the image field save.

class Question(PSQLMODEL):
    quiz = ForeignKeyField(Quiz, null=True, blank=True)
    text = TextField()
    order = IntegerField()
    after_text = TextField(null=True, blank=True)

    def __unicode__(self):
        return "%s.) %s" % (self.order, self.text)

    @classmethod
    def choices(self):
        payload = []
        for obj in Choice.select().where(Choice.question.id == self.id):
            payload.append(obj.__dict__['data'])

        return payload

class Choice(PSQLMODEL):
    question = ForeignKeyField(Question, null=True, blank=True)
    text = TextField()
    order = IntegerField()
    correct_answer = BooleanField(default=False)

    def __unicode__(self):
        return self.text

class Image(PSQLMODEL):
    choice = ForeignKeyField(Choice, null=True, blank=True)
    question = ForeignKeyField(Question, null=True, blank=True)
    quiz = ForeignKeyField(Quiz, null=True, blank=True)
    credit = TextField()
    caption = TextField()
    file_path = TextField(null=True, blank=True)
    rendered_file_path = TextField(null=True, blank=True)

    def __unicode__(self):
        return self.credit, self.caption

class Audio(PSQLMODEL):
    choice = ForeignKeyField(Choice, null=True, blank=True)
    question = ForeignKeyField(Question, null=True, blank=True)
    credit = TextField()
    caption = TextField()
    file_path = TextField(null=True, blank=True)
    rendered_oga_path = TextField(null=True, blank=True)
    rendered_mp3_path = TextField(null=True, blank=True)

    def __unicode__(self):
        return self.credit, self.caption