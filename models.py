
from peewee import *

import app_config

secrets = app_config.get_secrets()

db = PostgresqlDatabase(secrets['MUSIC_POSTGRES_DB'], user=secrets['MUSIC_POSTGRES_USER'], password=secrets['MUSIC_POSTGRES_PASS'])
db.connect()

class PSQLMODEL(Model):
    class Meta:
        database = db

class Album(PSQLMODEL):
    name = TextField()
    artist = TextField()
    url = TextField()
    year = IntegerField()
    decade = TextField()
    genre = TextField()
    tracks = TextField(blank=True, null=True) # JSON for tracks.

    def get_tracks(self):
        return json.loads(tracks)

    def __unicode__(self):
        return "%s - %s (%s)" % (self.name, self.artist, self.year)
