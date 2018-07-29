

# Geography of Genetics Variants Browser

Production version:  http://popgen.uchicago.edu/ggv/

Development version: http://popgen.uchicago.edu/dev/ggv

## Example calls with queries (development version only):

#### Query default data (1000 Genomes phase 3) by chromosome and position:
http://popgen.uchicago.edu/dev/ggv/?chr=10&pos=114900524

#### Query default data by rsid:
http://popgen.uchicago.edu/dev/ggv/?rsid=rs1799983

#### Query default data for a random SNP
http://popgen.uchicago.edu/dev/ggv/?random_snp=True

#### Query an alternate dataset:
http://popgen.uchicago.edu/dev/ggv/?data="1000genomes_superpops"&chr=12&pos=11957847

Viable datasets are listed in the dropdown box. 


### API

* `alleles` - A list of length 2: [Ref, Alt] alleles
* `chrom_pos` - CHROM:POS
* `nobs` - Number of individuals total
* `xobs` - Number of individuals with the alternative allele
* `count_ref` - Number of reference alleles
* `count_alt` - Number of alternate alleles
* `freq_ref` - Frequency of reference allele
* `freq_alt` - Frequency of alternative allele
* `count_total` - Total number of alleles

* `pop` - Population name
* `pos` - Geographic location of the population
* `rawfreq` - The alternative allele frequency
* `rsID` - rs identifier
* `freq` - scaled frequencies for use in map display; __Do not use__

