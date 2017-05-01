# Setup EC2 instance

sudo apt-get update
sudo apt-get install apache2
sudo apt-get install libapache2-mod-wsgi
sudo apt-get install python-pip
sudo pip install flask

mkdir ~/popgen
sudo ln -sT ~/popgen /var/www/html/popgen

cd ~/popgen
echo "Hello World" > index.html