from peewee import *
import app_config

db = PostgresqlDatabase(None)

class PSQLMODEL(Model):
    class Meta:
        database = db

class Quiz(PSQLMODEL):
    title = TextField()
    text = TextField()
    tags = TextField(null=True, blank=True)
    created = DateTimeField()
    updated = DateTimeField()
    byline = TextField(null=True, blank=True)
    image = TextField(null=True, blank=True)

    def __unicode__(self):
        return self.title

    # TODO:
    # 1. Handle serializing/deserializing tags.
    # 2. Handle auto-stamping updated/created fields.
    # 3. Handle the image field save.

class Question(PSQLMODEL):
    quiz = ForeignKeyField(Quiz)
    text = TextField()
    order = IntegerField()
    after_text = TextField(null=True, blank=True)
    audio = TextField(null=True, blank=True)
    image = TextField(null=True, blank=True)

    def __unicode__(self):
        return "%s.) %s" % (self.order, self.text)

class Choice(PSQLMODEL):
    question = ForeignKeyField(Question)
    text = TextField()
    order = IntegerField()
    correct_answer = BooleanField(default=False)
    audio = TextField(null=True, blank=True)
    image = TextField(null=True, blank=True)

    def __unicode__(self):
        return self.text
