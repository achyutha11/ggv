from fabric.api import local, env
from fabric.api import local, settings, abort, run, cd
from fabric.contrib.console import confirm
from fabric.operations import sudo

env.hosts = ['ggv']
env.use_ssh_config = True

def prepare_deploy():
    local("git push")


def deploy():
    code_dir = '/var/www/dev-integrated/ggv'
    with cd(code_dir):
        sudo("git pull")
        sudo("apachectl restart")