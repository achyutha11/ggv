# Combine PAGE-major tsvs into a single file.

cd /var/www/dev-integrated/data/Stanford-2017-07-26/PAGE-major
zcat `ls -1 *.tsv.gz | sort -V | grep -v 'PAGE-major.tsv.gz'` | bgzip -c  > PAGE-major.tsv.gz
tabix -s 1 -b 2 -e 2 index PAGE-major.tsv.gz
cp PAGE.MajorPopulations.Coordinates.2017Jul19.txt PAGE-Major.pop.tsv

cd /var/www/dev-integrated/data/Stanford-2017-07-26/PAGE-minor
zcat `ls -1 *.tsv.gz | sort -V | grep -v 'PAGE-minor.tsv.gz'` | bgzip -c  > PAGE-minor.tsv.gz
tabix -s 1 -b 2 -e 2 PAGE-minor.tsv.gz
cp PAGE.MinorPopulations.Coordinates.2017Jul19.txt PAGE-Minor.pop.tsv
