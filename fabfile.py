#!/usr/bin/env python

import csv
from glob import glob
import json
import os
import time
import uuid

import boto
from bs4 import BeautifulSoup
from fabric.api import *
from jinja2 import Template
import random
import requests

import app
import app_config
import copy
from etc import github
from etc.gdocs import GoogleDoc
import games
import models

"""
Base configuration
"""
env.user = app_config.SERVER_USER
env.forward_agent = True

env.hosts = []
env.settings = None

"""
Environments

Changing environment requires a full-stack test.
An environment points to both a server and an S3
bucket.
"""
def production():
    """
    Run as though on production.
    """
    env.settings = 'production'
    app_config.configure_targets(env.settings)
    env.hosts = app_config.SERVERS

def staging():
    """
    Run as though on staging.
    """
    env.settings = 'staging'
    app_config.configure_targets(env.settings)
    env.hosts = app_config.SERVERS

"""
Fabcasting! Run commands on the remote server.
"""
def fabcast(command):
    """
    Actually run specified commands on the server specified
    by staging() or production().
    """
    require('settings', provided_by=[production, staging])

    if not app_config.DEPLOY_TO_SERVERS:
        print 'You must set DEPLOY_TO_SERVERS = True in your app_config.py and setup a server before fabcasting..'

        return

    run('cd %s && bash run_on_server.sh fab %s $DEPLOYMENT_TARGET %s' % (app_config.SERVER_REPOSITORY_PATH, env.branch, command))

"""
Branches

Changing branches requires deploying that branch to a host.
"""
def stable():
    """
    Work on stable branch.
    """
    env.branch = 'stable'

def master():
    """
    Work on development branch.
    """
    env.branch = 'master'

def branch(branch_name):
    """
    Work on any specified branch.
    """
    env.branch = branch_name

"""
Template-specific functions

Changing the template functions should produce output
with fab render without any exceptions. Any file used
by the site templates should be rendered by fab render.
"""
def less():
    """
    Render LESS files to CSS.
    """
    for path in glob('less/*.less'):
        filename = os.path.split(path)[-1]
        name = os.path.splitext(filename)[0]
        out_path = 'www/css/%s.less.css' % name

        local('node_modules/bin/lessc %s %s' % (path, out_path))

def jst():
    """
    Render Underscore templates to a JST package.
    """
    local('node_modules/bin/jst --template underscore jst www/js/templates.js')

def download_copy():
    """
    Downloads a Google Doc as an .xls file.
    """
    doc = {}
    doc['key'] = app_config.COPY_GOOGLE_DOC_KEY

    g = GoogleDoc(**doc)
    g.get_auth()
    g.get_document()

def update_copy():
    """
    Fetches the latest Google Doc and updates local JSON.
    """
    download_copy()

def update_data():
    """
    Stub function for updating app-specific data.
    """
    pass

def app_config_js():
    """
    Render app_config.js to file.
    """
    from static import _app_config_js

    response = _app_config_js()
    js = response[0]

    with open('www/js/app_config.js', 'w') as f:
        f.write(js)

def copy_js():
    """
    Render copy.js to file.
    """
    from static import _copy_js

    response = _copy_js()
    js = response[0]

    with open('www/js/copy.js', 'w') as f:
        f.write(js)

def render():
    """
    Render HTML templates and compile assets.
    """
    from flask import g

    update_copy()
    assets_down()
    update_data()
    less()
    jst()

    app_config_js()
    copy_js()

    compiled_includes = []

    for rule in app.app.url_map.iter_rules():
        rule_string = rule.rule
        name = rule.endpoint

        if name.startswith('_'):
            print 'Skipping %s' % name
            continue

        if rule_string.endswith('/'):
            filename = 'www' + rule_string + 'index.html'
        elif rule_string.endswith('.html'):
            filename = 'www' + rule_string
        else:
            print 'Skipping %s' % name
            continue

        dirname = os.path.dirname(filename)

        if not (os.path.exists(dirname)):
            os.makedirs(dirname)

        print 'Rendering %s to %s' % (name, filename)

        with app.app.test_request_context(path=rule_string):
            g.compile_includes = True
            g.compiled_includes = compiled_includes

            bits = name.split('.')

            # Determine which module the view resides in
            if len(bits) > 1:
                module, name = bits
            else:
                module = 'app'

            view = globals()[module].__dict__[name]
            content = view()

            compiled_includes = g.compiled_includes

        with open(filename, 'w') as f:
            f.write(content.encode('utf-8'))

def tests():
    """
    Run Python unit tests.
    """
    local('nosetests')

"""
Setup

Changing setup commands requires a test deployment to a server.
Setup will create directories, install requirements, etc.
"""
def setup_server():
    """
    Setup servers for deployment.

    NB: This does not setup services or push to S3. Run deploy() next.
    """
    require('settings', provided_by=[production, staging])
    require('branch', provided_by=[stable, master, branch])

    if not app_config.DEPLOY_TO_SERVERS:
        print 'You must set DEPLOY_TO_SERVERS = True in your app_config.py before setting up the servers.'

        return

    setup_directories()
    setup_virtualenv()
    clone_repo()
    checkout_latest()
    install_requirements()

def setup_directories():
    """
    Create server directories.
    """
    require('settings', provided_by=[production, staging])

    run('mkdir -p %(SERVER_PROJECT_PATH)s' % app_config.__dict__)
    run('mkdir -p /var/www/uploads/%(PROJECT_FILENAME)s' % app_config.__dict__)

def setup_virtualenv():
    """
    Setup a server virtualenv.
    """
    require('settings', provided_by=[production, staging])

    run('virtualenv -p %(SERVER_PYTHON)s --no-site-packages %(SERVER_VIRTUALENV_PATH)s' % app_config.__dict__)
    run('source %(SERVER_VIRTUALENV_PATH)s/bin/activate' % app_config.__dict__)

def clone_repo():
    """
    Clone the source repository.
    """
    require('settings', provided_by=[production, staging])

    run('git clone %(REPOSITORY_URL)s %(SERVER_REPOSITORY_PATH)s' % app_config.__dict__)

    if app_config.REPOSITORY_ALT_URL:
        run('git remote add bitbucket %(REPOSITORY_ALT_URL)s' % app_config.__dict__)

def checkout_latest(remote='origin'):
    """
    Checkout the latest source.
    """
    require('settings', provided_by=[production, staging])
    require('branch', provided_by=[stable, master, branch])

    run('cd %s; git fetch %s' % (app_config.SERVER_REPOSITORY_PATH, remote))
    run('cd %s; git checkout %s; git pull %s %s' % (app_config.SERVER_REPOSITORY_PATH, env.branch, remote, env.branch))

def install_requirements():
    """
    Install the latest requirements.
    """
    require('settings', provided_by=[production, staging])

    run('%(SERVER_VIRTUALENV_PATH)s/bin/pip install -U -r %(SERVER_REPOSITORY_PATH)s/requirements.txt' % app_config.__dict__)
    run('cd %(SERVER_REPOSITORY_PATH)s; npm install less universal-jst -g --prefix node_modules' % app_config.__dict__)

def install_crontab():
    """
    Install cron jobs script into cron.d.
    """
    require('settings', provided_by=[production, staging])

    sudo('cp %(SERVER_REPOSITORY_PATH)s/crontab /etc/cron.d/%(PROJECT_FILENAME)s' % app_config.__dict__)

def uninstall_crontab():
    """
    Remove a previously install cron jobs script from cron.d
    """
    require('settings', provided_by=[production, staging])

    sudo('rm /etc/cron.d/%(PROJECT_FILENAME)s' % app_config.__dict__)

def import_issues(path):
    """
    Import a list of a issues from any CSV formatted like default_tickets.csv.
    """
    auth = github.get_auth()
    github.create_tickets(auth, path)

def bootstrap_issues():
    """
    Bootstraps Github issues with default configuration.
    """
    auth = github.get_auth()
    github.delete_existing_labels(auth)
    github.create_labels(auth)
    github.create_tickets(auth)
    github.create_milestones(auth)
    github.create_hipchat_hook(auth)

def bootstrap():
    """
    Bootstrap this project. Should only need to be run once.
    """
    # Reimport app_config in case this is part of the app_template bootstrap
    import app_config

    local('npm install less universal-jst -g --prefix node_modules')

    assets_down()
    update_copy()
    update_data()

"""
Deployment

Changes to deployment requires a full-stack test. Deployment
has two primary functions: Pushing flat files to S3 and deploying
code to a remote server if required.
"""
def _deploy_to_s3(path='.gzip'):
    """
    Deploy the gzipped stuff to S3.
    """
    # Clear files that should never be deployed
    local('rm -rf %s/live-data' % path)
    local('rm -rf %s/sitemap.xml' % path)

    exclude_flags = ''
    include_flags = ''

    with open('gzip_types.txt') as f:
        for line in f:
            exclude_flags += '--exclude "%s" ' % line.strip()
            include_flags += '--include "%s" ' % line.strip()

    exclude_flags += '--exclude "www/assets" '

    sync = 'aws s3 sync %s/ %s --acl "public-read" ' + exclude_flags + ' --cache-control "max-age=5" --region "us-east-1"'
    sync_gzip = 'aws s3 sync %s/ %s --acl "public-read" --content-encoding "gzip" --exclude "*" ' + include_flags + ' --cache-control "max-age=5" --region "us-east-1"'
    sync_assets = 'aws s3 sync %s/ %s --acl "public-read" --cache-control "max-age=86400" --region "us-east-1"'

    for bucket in app_config.S3_BUCKETS:
        local(sync % (path, 's3://%s/%s/' % (bucket, app_config.PROJECT_SLUG)))
        local(sync_gzip % (path, 's3://%s/%s/' % (bucket, app_config.PROJECT_SLUG)))
        local(sync_assets % ('www/assets/', 's3://%s/%s/assets/' % (bucket, app_config.PROJECT_SLUG)))

def assets_sync():
    """
    Intelligently synchronize assets between S3 and local folder.
    """
    local_paths = []

    for local_path, subdirs, filenames in os.walk('www/assets'):
        for name in filenames:
            local_paths.append(os.path.join(local_path, name))

    bucket = _assets_get_bucket()
    keys = bucket.list(app_config.PROJECT_SLUG)

    which = None
    always = False

    for key in keys:
        download = False
        upload = False

        local_path = key.name.replace(app_config.PROJECT_SLUG, 'www/assets', 1)

        print local_path

        if local_path in local_paths:
            # A file can only exist once, this speeds up future checks
            # and provides a list of non-existing files when complete
            local_paths.remove(local_path)

            # We need an actual key, not a "list key"
            # http://stackoverflow.com/a/18981298/24608
            key = bucket.get_key(key.name)

            with open(local_path, 'rb') as f:
                local_md5 = key.compute_md5(f)[0]

            # Hashes are different
            if key.get_metadata('md5') != local_md5:
                if not always:
                    # Ask user which file to take
                    which, always = _assets_confirm(local_path)

                if not which:
                    print 'Cancelling!'

                    return

                if which == 'remote':
                    download = True
                elif which == 'local':
                    upload = True
        else:
            download = True
            
        if download:
            _assets_download(key, local_path)

        if upload:
            _assets_upload(local_path, key)

    action = None
    always = False

    # Iterate over files that didn't exist on S3
    for local_path in local_paths:
        key_name = local_path.replace('www/assets', app_config.PROJECT_SLUG, 1)
        key = bucket.get_key(key_name, validate=False)

        print local_path

        if not always:
            action, always = _assets_upload_confirm()

        if not action:
            print 'Cancelling!'

            return

        if action == 'upload':
            _assets_upload(local_path, key)
        elif action == 'delete':
            _assets_delete(local_path, key)

def _assets_get_bucket():
    """
    Get a reference to the assets bucket.
    """
    s3 = boto.connect_s3()
    
    return s3.get_bucket(app_config.ASSETS_S3_BUCKET)

def _assets_confirm(local_path):
    """
    Check with user about whether to keep local or remote file.
    """
    print '--> This file has been changed locally and on S3.'
    answer = prompt('Take remote [r] Take local [l] Take all remote [ra] Take all local [la] cancel', default='c')

    if answer == 'r':
        return ('remote', False)
    elif answer == 'l':
        return ('local', False)
    elif answer == 'ra':
        return ('remote', True)
    elif answer == 'la':
        return ('local', True)
        
    return (None, False)

def _assets_upload_confirm():
    print '--> This file does not exist on S3.'
    answer = prompt('Upload local copy [u] Delete local copy [d] Upload all [ua] Delete all [da] cancel', default='c')

    if answer == 'u':
        return ('upload', False)
    elif answer == 'd':
        return ('delete', False)
    elif answer == 'ua':
        return ('upload', True)
    elif answer == 'da':
        return ('download', True)

    return (None, False) 

def _assets_download(s3_key, local_path):
    """
    Utility method to download a single asset from S3.
    """
    print '--> Downloading!' 

    dirname = os.path.dirname(local_path)

    if not (os.path.exists(dirname)):
        os.makedirs(dirname)
    
    s3_key.get_contents_to_filename(local_path)

def _assets_upload(local_path, s3_key):
    """
    Utility method to upload a single asset to S3.
    """
    print '--> Uploading!'
    
    with open(local_path, 'rb') as f:
        local_md5 = s3_key.compute_md5(f)[0]

    s3_key.set_metadata('md5', local_md5)
    s3_key.set_contents_from_filename(local_path)

def _assets_delete(local_path, s3_key):
    """
    Utility method to delete assets both locally and remotely.
    """
    print '--> Deleting!'

    s3_key.delete()
    os.remove(local_path)

def assets_rm(path):
    """
    Remove an asset from s3 and locally
    """
    bucket = _assets_get_bucket()

    file_list = glob(path)

    if len(file_list) > 0:
        _confirm("You are about to destroy %i files. Are you sure?" % len(file_list))

        for local_path in file_list:
            key_name = local_path.replace('www/assets', app_config.PROJECT_SLUG, 1)
            key = bucket.get_key(key_name)
            
            _assets_delete(local_path, key)

def _gzip(in_path='www', out_path='.gzip'):
    """
    Gzips everything in www and puts it all in gzip
    """
    local('python gzip_assets.py %s %s' % (in_path, out_path))

def _get_template_conf_path(service, extension):
    """
    Derive the path for a conf template file.
    """
    return 'confs/%s.%s' % (service, extension)

def _get_rendered_conf_path(service, extension):
    """
    Derive the rendered path for a conf file.
    """
    return 'confs/rendered/%s.%s.%s' % (app_config.PROJECT_FILENAME, service, extension)

def _get_installed_conf_path(service, remote_path, extension):
    """
    Derive the installed path for a conf file.
    """
    return '%s/%s.%s.%s' % (remote_path, app_config.PROJECT_FILENAME, service, extension)

def _get_installed_service_name(service):
    """
    Derive the init service name for an installed service.
    """
    return '%s.%s' % (app_config.PROJECT_FILENAME, service)

def render_confs():
    """
    Renders server configurations.
    """
    require('settings', provided_by=[production, staging])

    with settings(warn_only=True):
        local('mkdir confs/rendered')

    # Copy the app_config so that when we load the secrets they don't
    # get exposed to other management commands
    context = copy.copy(app_config.__dict__)
    context.update(app_config.get_secrets())

    for service, remote_path, extension in app_config.SERVER_SERVICES:
        template_path = _get_template_conf_path(service, extension)
        rendered_path = _get_rendered_conf_path(service, extension)

        with open(template_path,  'r') as read_template:

            with open(rendered_path, 'wb') as write_template:
                payload = Template(read_template.read())
                write_template.write(payload.render(**context))

def deploy_confs():
    """
    Deploys rendered server configurations to the specified server.
    This will reload nginx and the appropriate uwsgi config.
    """
    require('settings', provided_by=[production, staging])

    render_confs()

    with settings(warn_only=True):
        for service, remote_path, extension in app_config.SERVER_SERVICES:
            rendered_path = _get_rendered_conf_path(service, extension)
            installed_path = _get_installed_conf_path(service, remote_path, extension)

            a = local('md5 -q %s' % rendered_path, capture=True)
            b = run('md5sum %s' % installed_path).split()[0]

            if a != b:
                print 'Updating %s' % installed_path
                put(rendered_path, installed_path, use_sudo=True)

                if service == 'nginx':
                    sudo('service nginx reload')
                elif service == 'uwsgi':
                    service_name = _get_installed_service_name(service)
                    sudo('initctl reload-configuration')
                    sudo('service %s restart' % service_name)
                elif service == 'app':
                    run('touch %s' % app_config.UWSGI_SOCKET_PATH)
                    sudo('chmod 644 %s' % app_config.UWSGI_SOCKET_PATH)
                    sudo('chown www-data:www-data %s' % app_config.UWSGI_SOCKET_PATH)

                    sudo('touch %s' % app_config.UWSGI_LOG_PATH)
                    sudo('chmod 644 %s' % app_config.UWSGI_LOG_PATH)
                    sudo('chown ubuntu:ubuntu %s' % app_config.UWSGI_LOG_PATH)

                    sudo('touch %s' % app_config.APP_LOG_PATH)
                    sudo('chmod 644 %s' % app_config.APP_LOG_PATH)
                    sudo('chown ubuntu:ubuntu %s' % app_config.APP_LOG_PATH)
            else:
                print '%s has not changed' % rendered_path

def deploy(remote='origin'):
    """
    Deploy the latest app to S3 and, if configured, to our servers.
    """
    require('settings', provided_by=[production, staging])

    if app_config.DEPLOY_TO_SERVERS:
        require('branch', provided_by=[stable, master, branch])

    if (app_config.DEPLOYMENT_TARGET == 'production' and env.branch != 'stable'):
        _confirm("You are trying to deploy the '%s' branch to production.\nYou should really only deploy a stable branch.\nDo you know what you're doing?" % env.branch)

    if app_config.DEPLOY_TO_SERVERS:
        fabcast('update_copy')
        fabcast('assets_down')
        fabcast('update_data')

        checkout_latest(remote)

        if app_config.DEPLOY_CRONTAB:
            install_crontab()

        if app_config.DEPLOY_SERVICES:
            deploy_confs()

    render()
    _gzip('www', '.gzip')
    _deploy_to_s3()


"""
App-specific jobs
"""
def bootstrap_data():
    """
    Sets up the app from scratch.
    """
    local('pip install -r requirements.txt')
    assets_down()
    init_db()
    init_tables()
    local('psql -U %s %s < www/assets/data/initial_db.sql' % (app_config.PROJECT_SLUG, app_config.PROJECT_SLUG))

def init_db():
    """
    Prepares a user and db for the project.
    """
    with settings(warn_only=True):
        local('dropdb %s' % app_config.PROJECT_SLUG)
        local('createuser -s %s' % app_config.PROJECT_SLUG)
        local('createdb %s' % app_config.PROJECT_SLUG)

def init_tables():
    """
    Uses the ORM to create tables.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    with settings(warn_only=True):
        models.Album.create_table()

def drop_tables():
    """
    Uses the ORM to drop tables.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    with settings(warn_only=True):
        models.Album.drop_table()


def load_albums():
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    genres = [('rock', 1950), ('pop', 1950), ('jazz', 1940), ('country', 1940), ('hip-hop', 1980)]
    decades = [1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010]

    for genre, starting_year in genres:
        for decade in decades:
            if starting_year <= decade:

                print "Opening www/assets/data/albums-%s-%s.json" % (genre, '%ss' % decade)

                with open('www/assets/data/albums-%s-%s.json' % (genre, '%ss' % decade), 'rb') as readfile:
                    albums = list(json.loads(readfile.read()))

                for album in albums:

                    a = models.Album(**album)
                    a.save()
                    print a


def get_track_list():

    headers = {}
    headers['user-agent'] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.77 Safari/537.36"

    base_url = "https://www.googleapis.com/freebase/v1/mqlread?query="
    query = [{"type": "/music/album", "mid": None, "name": None, "releases": {"track": [],"limit": 1},"artist": {"name": None,"type": "/music/artist"}}]

    albums = models.Album.select().where(models.Album.tracks >> None)

    print "Loading tracks for %s albums." % albums.count()

    for album in albums:

        rand_time = random.randrange(4,9)

        print "Waiting for %ss because of evil." % rand_time

        time.sleep(rand_time)

        r = requests.get('http://rateyourmusic.com' + album.url, headers=headers)

        if r.status_code == 200:

            tracks = []

            soup = BeautifulSoup(r.content)

            try:
                for track in soup.select('ul#tracks li.track span.tracklist_title span')[0]:
                    tracks.append(track.strip().encode('utf-8'))

                if len(tracks) > 0:
                    album.tracks = json.dumps(tracks)

                    album.save()
                    print album

            except IndexError:
                # No track list!
                pass

            except TypeError:
                # Blank?
                pass

def get_album_list():
    """
    Writes a series of album lists (max 100) to files by
    decade and genre.
    """
    url = "http://rateyourmusic.com/customchart?page=1&chart_type=top&type=album&year=%s&genre_include=1&include_child_genres=1&genres=%s&include_child_genres_chk=1&include=both&origin_countries=&limit=none&countries="
    genres = [('rock', 1950), ('pop', 1950), ('jazz', 1940), ('country', 1940), ('hip-hop', 1980)]
    decades = [1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010]

    for genre, starting_year in genres:
        for decade in decades:

            payload = []
            if starting_year <= decade:
                r = requests.get(url % ('%ss' % decade, genre.replace('-', ' ')))
                if r.status_code == 200:
                    soup = BeautifulSoup(r.content)
                    for album in soup.select('table.mbgen tr'):
                        try:
                            album_dict = {}
                            album_dict['decade'] = '%ss' % decade
                            album_dict['genre'] = genre

                            base_markup = album.select('td')[2].select('div')[0]

                            if len(album.select('.credited_list')) > 0:
                                album_dict['name'] = base_markup.select('span')[0].select('a.album')[0].text.strip().encode('utf-8')
                                album_dict['url'] = base_markup.select('span')[0].select('a.album')[0]['href'].strip()
                                album_dict['artist'] = base_markup.select('span')[0].select('span.credited_name')[0].contents[0]
                                album_dict['year'] = int(base_markup.select('span')[2].text.strip().replace('(', '').replace(')', ''))
                            else:
                                album_dict['name'] = base_markup.select('span')[0].select('a.album')[0].text.strip().encode('utf-8')
                                album_dict['url'] = base_markup.select('span')[0].select('a.album')[0]['href'].strip()
                                album_dict['artist'] = base_markup.select('span')[0].select('a.artist')[0].text.strip().encode('utf-8')
                                album_dict['year'] = int(base_markup.select('span')[1].text.strip().replace('(', '').replace(')', ''))

                            payload.append(album_dict)

                        except IndexError:
                            # This is an ad.
                            pass

                        except ValueError, e:
                            # This is an album with a translated title. Punt.
                            pass

                with open('www/assets/data/albums-%s-%s.json' % (genre, '%ss' % decade), 'wb') as writefile:
                    writefile.write(json.dumps(payload))
                    print "Wrote www/assets/data/albums-%s-%s.json" % (genre, '%ss' % decade)



def generate_quiz():
    """
    ['', '10', '10th Week', '11th Week', '12th Week', '13th Week', '14th Week', '15th Week', '16th Week', '17th Week', '18th Week', '19th Week', '1st Week', '20th Week', '21st Week', '22nd Week', '23rd Week', '24th Week', '25th Week', '26th Week', '27th Week', '28th Week', '29th Week', '2nd Week', '30th Week', '31st Week', '32nd Week', '33rd Week', '34th Week', '35th Week', '36th Week', '37th Week', '38th Week', '39th Week', '3rd Week', '40', '40th Week', '41st Week', '42nd Week', '43rd Week', '44th Week', '45th Week', '46th Week', '47th Week', '48th Week', '49th Week', '4th Week', '50th Week', '51st Week', '52nd Week', '53rd Week', '54th Week', '55th Week', '56th Week', '57th Week', '58th Week', '59th Week', '5th Week', '60th Week', '61st Week', '62nd Week', '63rd Week', '64th Week', '65th Week', '66th Week', '67th Week', '68th Week', '69th Week', '6th Week', '70th Week', '71st Week', '72nd Week', '73rd Week', '74th Week', '75th Week', '76th Week', '7th Week', '8th Week', '9th Week', 'Album', 'Artist', 'Artist ID', 'Artist Inverted', 'B-Side', 'CH', 'Comments', 'Date Entered', 'Date Peaked', 'Featured', 'Genre', 'High', 'Label/Number', 'Media', 'PK', 'Pic Sleeve', 'Prefix', 'ReIssue', 'SYMBL', 'Source', 'Stereo (55-68)', 'Temp 1', 'Time', 'Time (Album)', 'Time Source', 'Track', 'UnFeatured', 'Verified', 'Written By', 'Year', 'Yearly Rank', 'explicit']
    """
    with open('www/assets/data/tracks-by-year.json', 'rb') as readfile:
        tracks_by_year = dict(json.loads(readfile.read()))

    years = list(sorted(tracks_by_year.keys()))

    for year in years:
        quiz_dict = {}
        quiz_dict['guid'] = str(uuid.uuid4())
        quiz_dict['year'] = year
        quiz_dict['choices'] = []

        for track in list(tracks_by_year[year]):
            track_dict = {}
            track_dict['rank'] = int(track['Yearly Rank'])
            track_dict['track'] = track['Track']
            track_dict['artist'] = track['Artist']
            quiz_dict['choices'].append(track_dict)

        with open('www/assets/data/quiz_top_singles_%s.json' % year, 'wb') as writefile:
            writefile.write(json.dumps(quiz_dict))

def write_tracks_by_year():
    with open('www/assets/data/pop-1890-2014.csv', 'rb') as readfile:
        tracks = list(csv.DictReader(readfile))

    tracks_by_year = {}

    for track in tracks:
        try:
            if int(track['Yearly Rank']) < 6:
                if not tracks_by_year.get(track['Year'], None):
                    tracks_by_year[track['Year']] = []
                tracks_by_year[track['Year']].append(track)
        except ValueError:
            print track['Yearly Rank'], track['Track']

    with open('www/assets/data/tracks-by-year.json', 'wb') as writefile:
        writefile.write(json.dumps(tracks_by_year))


"""
Cron jobs
"""
def cron_test():
    """
    Example cron task. Note we use "local" instead of "run"
    because this will run on the server.
    """
    require('settings', provided_by=[production, staging])

    local('echo $DEPLOYMENT_TARGET > /tmp/cron_test.txt')

"""
Destruction

Changes to destruction require setup/deploy to a test host in order to test.
Destruction should remove all files related to the project from both a remote
host and S3.
"""
def _confirm(message):
    answer = prompt(message, default="Not at all")

    if answer.lower() not in ('y', 'yes', 'buzz off', 'screw you'):
        exit()

def nuke_confs():
    """
    DESTROYS rendered server configurations from the specified server.
    This will reload nginx and stop the uwsgi config.
    """
    require('settings', provided_by=[production, staging])

    for service, remote_path, extension in app_config.SERVER_SERVICES:
        with settings(warn_only=True):
            installed_path = _get_installed_conf_path(service, remote_path, extension)

            sudo('rm -f %s' % installed_path)

            if service == 'nginx':
                sudo('service nginx reload')
            elif service == 'uwsgi':
                service_name = _get_installed_service_name(service)
                sudo('service %s stop' % service_name)
                sudo('initctl reload-configuration')
            elif service == 'app':
                sudo('rm %s' % app_config.UWSGI_SOCKET_PATH)
                sudo('rm %s' % app_config.UWSGI_LOG_PATH)
                sudo('rm %s' % app_config.APP_LOG_PATH)

def shiva_the_destroyer():
    """
    Deletes the app from s3
    """
    require('settings', provided_by=[production, staging])

    _confirm("You are about to destroy everything deployed to %s for this project.\nDo you know what you're doing?" % app_config.DEPLOYMENT_TARGET)

    with settings(warn_only=True):
        sync = 'aws s3 rm %s --recursive --region "us-east-1"'

        for bucket in app_config.S3_BUCKETS:
            local(sync % ('s3://%s/%s/' % (bucket, app_config.PROJECT_SLUG)))

        if app_config.DEPLOY_TO_SERVERS:
            run('rm -rf %(SERVER_PROJECT_PATH)s' % app_config.__dict__)

            if app_config.DEPLOY_CRONTAB:
                uninstall_crontab()

            if app_config.DEPLOY_SERVICES:
                nuke_confs()

"""
App-template specific setup. Not relevant after the project is running.
"""
def app_template_bootstrap(project_name=None, repository_name=None):
    """
    Execute the bootstrap tasks for a new project.
    """
    config_files = ' '.join(['PROJECT_README.md', 'app_config.py'])

    config = {}
    config['$NEW_PROJECT_SLUG'] = os.getcwd().split('/')[-1]
    config['$NEW_PROJECT_NAME'] = project_name or config['$NEW_PROJECT_SLUG']
    config['$NEW_REPOSITORY_NAME'] = repository_name or config['$NEW_PROJECT_SLUG']
    config['$NEW_PROJECT_FILENAME'] = config['$NEW_PROJECT_SLUG'].replace('-', '_')

    _confirm("Have you created a Github repository named \"%s\"?" % config['$NEW_REPOSITORY_NAME'])

    for k, v in config.items():
        local('sed -i "" \'s|%s|%s|g\' %s' % (k, v, config_files))

    local('rm -rf .git')
    local('git init')
    local('mv PROJECT_README.md README.md')
    local('rm *.pyc')
    local('rm LICENSE')
    local('git add .')
    local('git commit -am "Initial import from app-template."')
    local('git remote add origin git@github.com:nprapps/%s.git' % config['$NEW_REPOSITORY_NAME'])
    local('git push -u origin master')

    local('mkdir ~/Dropbox/nprapps/assets/%s' % config['$NEW_PROJECT_NAME'])

    bootstrap()
