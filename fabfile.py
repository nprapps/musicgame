#!/usr/bin/env python

import datetime
from glob import glob
import json
import os

import boto
from fabric.api import *
from jinja2 import Template

import app
import app_config
import copy
from etc import github
from etc.gdocs import GoogleDoc
import games    # Necessary for render()
import models

"""
Base configuration
"""
env.user = app_config.SERVER_USER
env.forward_agent = True

env.hosts = []
env.settings = None

model_names = ['Category', 'Photo', 'Audio', 'Quiz', 'Question', 'Choice']

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
    assets_sync()
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

    assets_sync()
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
        checkout_latest(remote)

        fabcast('update_copy')
        fabcast('assets_sync')
        fabcast('update_data')

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
    fabcast('assets_sync')
    init_db()
    fabcast('init_tables')
    fabcast('load_quizzes')

def local_bootstrap_data():
    """
    Sets up the app from scratch.
    """
    assets_sync()
    local_init_db()
    init_tables()
    load_quizzes()

def init_db():
    """
    Prepares a user and db for the project.
    """
    with settings(warn_only=True):
        sudo('dropdb %s' % app_config.PROJECT_SLUG, user='postgres')
        sudo('echo "CREATE USER %s WITH PASSWORD \'$MUSICGAME_POSTGRES_PASSWORD\';" | psql' % (app_config.PROJECT_SLUG), user='postgres')
        sudo('createdb %s' % app_config.PROJECT_SLUG, user='postgres')

def local_init_db():
    """
    Prepares a user and db for the project.
    """
    with settings(warn_only=True):
        local('dropdb %s' % app_config.PROJECT_SLUG)
        local('echo "CREATE USER %s WITH PASSWORD \'%S\';" | psql' % (app_config.PROJECT_SLUG, app_config.PROJECT_SLUG))
        local('createuser -s %s' % app_config.PROJECT_SLUG)
        local('createdb %s' % app_config.PROJECT_SLUG)

def init_tables():
    """
    Uses the ORM to create tables.
    """
    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    with settings(warn_only=True):
        for model_name in model_names:
            model = getattr(models, model_name)
            model.create_table()

def install_brew_requirements():
    with settings(warn_only=True):
        local('brew install mpg123 vorbis-tools lame')

def _create_audio(path):
    audio = {
        'file_path': path,
        'rendered_mp3_path': path,
        'caption': 'TKTK',
        'credit': 'TKTK'
    }

    audio = models.Audio(**audio)
    audio.render_audio = False
    audio.save()
    
    print "Saved audio: %s" % audio

    return audio

def _create_photo(path):
    image = {
        'file_path': path,
        'rendered_file_path': path,
        'caption': 'TKTK',
        'credit': 'TKTK'
    }

    image = models.Photo(**image)
    image.render_image = False 
    image.save()

    print "Saved image: %s" % image

    return image

def load_quizzes():
    """
    You know, some sample data.
    """

    models.db.init(app_config.PROJECT_SLUG, user=app_config.PROJECT_SLUG)

    install_brew_requirements()

    quiz_list = [
        'drum_fill_friday.json'
    ]

    qc = models.Category(name="Drum Fill Friday")
    qc.save()

    now = datetime.datetime.now()

    for quiz in quiz_list:
        with open('www/assets/data/%s' % quiz, 'rb') as readfile:
            quiz_json = dict(json.loads(readfile.read()))

        quiz = {
            'category': qc,
            'title': quiz_json['title'],
            'text': 'TKTK',
            'created': now,
            'updated': now,
            'photo': None
        }

        # Create photo
        if quiz_json['photo']:
            quiz['photo'] = _create_photo(quiz_json['photo'])

        # Create quiz
        qz = models.Quiz(**quiz)
        qz.save()

        print "Saved quiz: %s" % qz

        for question_index, question_json in enumerate(quiz_json['questions']):
            question = {
                'order': question_index + 1,
                'quiz': qz,
                'text': question_json['text'],
                'photo': None,
                'audio': None
            }

            # Create photo
            if question_json['photo']:
                question['photo'] = _create_photo(question_json['photo'])

            # Create audio
            if question_json['audio']:
                question['audio'] = _create_audio(question_json['audio'])

            # Create question
            qn = models.Question(**question)
            qn.save()

            print "Saved question: %s" % qn

            for choice_index, choice_json in enumerate(question_json['choices']):
                choice = {
                    'order': choice_index + 1,
                    'question': qn,
                    'text': choice_json['text'],
                    'correct_answer': False,
                    'photo': None,
                    'audio': None,
                }

                if choice['text'] == question_json['answer']:
                    choice['correct_answer'] = True

                # Create photo
                if choice_json['photo']:
                    choice['photo'] = _create_photo(choice_json['photo'])

                # Create audio
                if choice_json['audio']:
                    choice['audio'] = _create_audio(choice_json['audio'])

                # Create choice
                ch = models.Choice(**choice)
                ch.save()

                print "Saved choice: %s" % ch

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
