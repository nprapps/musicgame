#!/usr/bin/env python

import base64
import copy
from glob import glob
import os

from fabric.api import local, put, require, run, settings, sudo, task
from fabric.operations import get
from fabric.state import env
from flask import json
from jinja2 import Template

import app
import app_config
from etc import github
from etc.gdocs import GoogleDoc
import games    # Necessary for render()
import models

# Other fabfiles
import assets
import utils

"""
Base configuration
"""
env.user = app_config.SERVER_USER
env.forward_agent = True

env.hosts = []
env.settings = None

model_names = ['Photo', 'Audio', 'Quiz', 'Question', 'Choice']

"""
Environments

Changing environment requires a full-stack test.
An environment points to both a server and an S3
bucket.
"""
@task
def production():
    """
    Run as though on production.
    """
    env.settings = 'production'
    app_config.configure_targets(env.settings)
    env.hosts = app_config.SERVERS

@task
def staging():
    """
    Run as though on staging.
    """
    env.settings = 'staging'
    app_config.configure_targets(env.settings)
    env.hosts = app_config.SERVERS

@task
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
@task
def stable():
    """
    Work on stable branch.
    """
    env.branch = 'stable'

@task
def master():
    """
    Work on development branch.
    """
    env.branch = 'master'

@task
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
@task
def less():
    """
    Render LESS files to CSS.
    """
    for path in glob('less/*.less'):
        filename = os.path.split(path)[-1]
        name = os.path.splitext(filename)[0]
        out_path = 'www/css/%s.less.css' % name

        local('node_modules/bin/lessc %s %s' % (path, out_path))

@task
def jst():
    """
    Render Underscore templates to a JST package.
    """
    local('node_modules/bin/jst --template underscore jst www/js/templates.js')

@task
def download_copy():
    """
    Downloads a Google Doc as an .xls file.
    """
    doc = {}
    doc['key'] = app_config.COPY_GOOGLE_DOC_KEY

    g = GoogleDoc(**doc)
    g.get_auth()
    g.get_document()

@task
def update_copy():
    """
    Fetches the latest Google Doc and updates local JSON.
    """
    download_copy()

@task
def update_data():
    """
    Stub function for updating app-specific data.
    """
    pass

@task
def app_config_js():
    """
    Render app_config.js to file.
    """
    from static import _app_config_js

    response = _app_config_js()
    js = response[0]

    with open('www/js/app_config.js', 'w') as f:
        f.write(js)

@task
def copy_js():
    """
    Render copy.js to file.
    """
    from static import _copy_js

    response = _copy_js()
    js = response[0]

    with open('www/js/copy.js', 'w') as f:
        f.write(js)

@task
def render():
    """
    Render HTML templates and compile assets.
    """
    from flask import g

    update_copy()
    assets.sync()
    update_data()
    less()
    jst()

    app_config_js()
    copy_js()

    compiled_includes = []

    for rule in app.app.url_map.iter_rules():
        rule_string = rule.rule
        name = rule.endpoint

        if name == 'static' or name.startswith('_'):
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

        print 'Rendering %s' % (filename)

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

def _cleanup_minified_includes():
    """
    Delete minified versions of JS/CSS assets so they don't clutter www/.
    """
    with settings(warn_only=True):
        local('rm www/js/*.min.*.js')
        local('rm www/css/*.min.*.css')

@task
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
@task
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

@task
def setup_directories():
    """
    Create server directories.
    """
    require('settings', provided_by=[production, staging])

    run('mkdir -p %(SERVER_PROJECT_PATH)s' % app_config.__dict__)
    run('mkdir -p /var/www/uploads/%(PROJECT_FILENAME)s' % app_config.__dict__)

@task
def setup_virtualenv():
    """
    Setup a server virtualenv.
    """
    require('settings', provided_by=[production, staging])

    run('virtualenv -p %(SERVER_PYTHON)s --no-site-packages %(SERVER_VIRTUALENV_PATH)s' % app_config.__dict__)
    run('source %(SERVER_VIRTUALENV_PATH)s/bin/activate' % app_config.__dict__)

@task
def clone_repo():
    """
    Clone the source repository.
    """
    require('settings', provided_by=[production, staging])

    run('git clone %(REPOSITORY_URL)s %(SERVER_REPOSITORY_PATH)s' % app_config.__dict__)

    if app_config.REPOSITORY_ALT_URL:
        run('git remote add bitbucket %(REPOSITORY_ALT_URL)s' % app_config.__dict__)

@task
def checkout_latest(remote='origin'):
    """
    Checkout the latest source.
    """
    require('settings', provided_by=[production, staging])
    require('branch', provided_by=[stable, master, branch])

    run('cd %s; git fetch %s' % (app_config.SERVER_REPOSITORY_PATH, remote))
    run('cd %s; git checkout %s; git pull %s %s' % (app_config.SERVER_REPOSITORY_PATH, env.branch, remote, env.branch))

@task
def install_requirements():
    """
    Install the latest requirements.
    """
    require('settings', provided_by=[production, staging])

    run('%(SERVER_VIRTUALENV_PATH)s/bin/pip install -U -r %(SERVER_REPOSITORY_PATH)s/requirements.txt' % app_config.__dict__)
    run('cd %(SERVER_REPOSITORY_PATH)s; npm install less universal-jst -g --prefix node_modules' % app_config.__dict__)

@task
def install_crontab():
    """
    Install cron jobs script into cron.d.
    """
    require('settings', provided_by=[production, staging])

    sudo('cp %(SERVER_REPOSITORY_PATH)s/crontab /etc/cron.d/%(PROJECT_FILENAME)s' % app_config.__dict__)

@task
def uninstall_crontab():
    """
    Remove a previously install cron jobs script from cron.d
    """
    require('settings', provided_by=[production, staging])

    sudo('rm /etc/cron.d/%(PROJECT_FILENAME)s' % app_config.__dict__)

@task
def import_issues(path):
    """
    Import a list of a issues from any CSV formatted like default_tickets.csv.
    """
    auth = github.get_auth()
    github.create_tickets(auth, path)

@task
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

@task
def bootstrap():
    """
    Bootstrap this project. Should only need to be run once.
    """
    # Reimport app_config in case this is part of the app_template bootstrap
    import app_config

    local('npm install less universal-jst -g --prefix node_modules')

    assets.sync()
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

@task
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

@task
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

@task
def deploy(remote='origin'):
    """
    Deploy the latest app to S3 and, if configured, to our servers.
    """
    require('settings', provided_by=[production, staging])

    if app_config.DEPLOY_TO_SERVERS:
        require('branch', provided_by=[stable, master, branch])

    if (app_config.DEPLOYMENT_TARGET == 'production' and env.branch != 'stable'):
        utils.confirm("You are trying to deploy the '%s' branch to production.\nYou should really only deploy a stable branch.\nDo you know what you're doing?" % env.branch)

    if app_config.DEPLOY_TO_SERVERS:
        checkout_latest(remote)

        #fabcast('update_copy')
        #fabcast('assets.sync')
        #fabcast('update_data')

        if app_config.DEPLOY_CRONTAB:
            install_crontab()

        if app_config.DEPLOY_SERVICES:
            deploy_confs()

    render()
    _gzip('www', '.gzip')
    _deploy_to_s3()
    _cleanup_minified_includes()

@task
def deploy_quizzes():
    """
    Deploy/redeploy all quizzes.
    """
    for quiz in models.Quiz.select():
        quiz.deploy()
        print 'Deployed quiz: %s' % quiz

"""
App-specific jobs
"""
@task
def bootstrap_data():
    """
    Sets up the app from scratch.
    """
    fabcast('assets.sync')
    init_db()
    fabcast('init_tables')
    fabcast('load_quizzes')

@task
def local_bootstrap_data():
    """
    Sets up the app from scratch.
    """
    assets.sync()
    local_init_db()
    init_tables()
    os.system('rm -f www/live-data/audio/*.oga www/live-data/audio/*.mp3')
    load_quizzes()

@task
def init_db():
    """
    Prepares a user and db for the project.
    """
    with settings(warn_only=True):
        service_name = _get_installed_service_name('uwsgi')
        sudo('service %s stop' % service_name)

        run('export PGPASSWORD=$MUSICGAME_POSTGRES_PASSWORD && dropdb %s --username=$MUSICGAME_POSTGRES_USER --host=$MUSICGAME_POSTGRES_HOST --port=$MUSICGAME_POSTGRES_PORT' % (
            app_config.PROJECT_SLUG
        ))

    run('export PGPASSWORD=$MUSICGAME_POSTGRES_PASSWORD && createdb %s --username=$MUSICGAME_POSTGRES_USER --host=$MUSICGAME_POSTGRES_HOST --port=$MUSICGAME_POSTGRES_PORT' % (
        app_config.PROJECT_SLUG
    ))

    sudo('service %s start' % service_name)

@task
def local_init_db():
    """
    Prepares a user and db for the project.
    """
    with settings(warn_only=True):
        local('dropdb %s' % app_config.PROJECT_SLUG)
        local('dropuser %s' % app_config.PROJECT_SLUG)
        local('echo "CREATE USER %s WITH PASSWORD \'%s\';" | psql' % (app_config.PROJECT_SLUG, app_config.PROJECT_SLUG))
        local('createuser -s %s' % app_config.PROJECT_SLUG)
        local('createdb %s' % app_config.PROJECT_SLUG)

@task
def init_tables():
    """
    Uses the ORM to create tables.
    """
    with settings(warn_only=True):
        for model_name in model_names:
            model = getattr(models, model_name)
            model.create_table()

@task
def install_brew_requirements():
    with settings(warn_only=True):
        local('brew install mpg123 vorbis-tools lame')

def _create_audio(path):
    file_path, file_name = os.path.split(path)
    file_name, file_extension = os.path.splitext(file_name)

    audio = {
        'file_string': '',
        'file_name': '%s%s' % (file_name, file_extension),
        'rendered_mp3_path': '/%s/assets/audio/%s' % (app_config.PROJECT_SLUG, path),
        'rendered_oga_path': '/%s/assets/audio/%s' % (app_config.PROJECT_SLUG, path.replace('.mp3', '.oga')),
        'caption': 'TKTK',
        'credit': 'TKTK'
    }

    audio = models.Audio(**audio)
    audio.save()

    print "Saved audio: %s" % audio

    return audio

def _create_photo(path):
    file_path, file_name = os.path.split(path)
    file_name, file_extension = os.path.splitext(file_name)

    image = {
        'file_name': '%s%s' % (file_name, file_extension),
        'caption': 'TKTK',
        'credit': 'TKTK'
    }

    image = models.Photo(**image)

    with open(path.replace('/musicgame', 'www'), 'rb') as readfile:
        file_string = ';,%s' % base64.b64encode(readfile.read())
        image.write_photo(file_string)

    image.save()

    print "Saved image: %s" % image

    return image

@task
def get_snapshot():
    """
    Grabs a DB snapshot from prod/staging and loads it locally.
    """
    require('settings', provided_by=[production, staging])
    with settings(warn_only=True):
        run('export PGPASSWORD=$MUSICGAME_POSTGRES_PASSWORD && pg_dump -f /tmp/%s.sql -Fp -E UTF8 --inserts %s --username=$MUSICGAME_POSTGRES_USER --host=$MUSICGAME_POSTGRES_HOST --port=$MUSICGAME_POSTGRES_PORT' % (
            app_config.PROJECT_SLUG,
            app_config.PROJECT_SLUG,
        ))

    get('/tmp/%s.sql' % app_config.PROJECT_SLUG, '/tmp/%s.sql' % app_config.PROJECT_SLUG)

    local_init_db()
    local('psql %s < /tmp/%s.sql' % (app_config.PROJECT_SLUG, app_config.PROJECT_SLUG))

@task
def load_quizzes():
    """
    Load sample quiz data.
    """
    quiz_list = [
        'drum_fill_friday.json'
    ]

    for quiz in quiz_list:
        with open('www/assets/data/%s' % quiz, 'rb') as readfile:
            quiz_json = dict(json.loads(readfile.read()))

        quiz = {
            'category': "Drum Fill Friday",
            'title': quiz_json['title'],
            'text': 'TKTK',
            'photo': None,
            'seamus_url': '',
            'author': 'Bob Boilen'
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
                'order': question_index,
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
                    'order': choice_index,
                    'question': qn,
                    'text': choice_json['text'],
                    'correct_answer': False,
                    'photo': None,
                    'audio': None,
                }

                if choice_index == question_json['answer']:
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

                print 'Saved choice: %s' % ch

        qz.deploy()
        print 'Deployed quiz: %s' % qz

"""
Cron jobs
"""
@task
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
@task
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

@task
def shiva_the_destroyer():
    """
    Deletes the app from s3
    """
    require('settings', provided_by=[production, staging])

    utils.confirm("You are about to destroy everything deployed to %s for this project.\nDo you know what you're doing?" % app_config.DEPLOYMENT_TARGET)

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
@task
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

    utils.confirm("Have you created a Github repository named \"%s\"?" % config['$NEW_REPOSITORY_NAME'])

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
