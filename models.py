from peewee import *
import app_config

db = PostgresqlDatabase(None)

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
