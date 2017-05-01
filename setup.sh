# Setup EC2 instance

# Install Software
sudo apt-get update
sudo apt-get install -y apache2 libapache2-mod-wsgi python-pip bcftools tabix
sudo pip install --upgrade pip
sudo pip install flask ipython

# Fetch Code
git clone -b ggv-integrated https://github.com/NovembreLab/ggv 
sudo ln -sT ~/ggv /var/www/html/ggv

# Create site - This will overwrite your configuration!
sudo cat ~/ggv/config/000-default.conf > /etc/apache2/sites-enabled/000-default.conf