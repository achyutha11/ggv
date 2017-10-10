comma = function(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


get_current_dataset = function() {
    return $("#dataset").find(":selected").val()
}

get_query_url = function(query) {
    dataset = get_current_dataset();
    return base_url + "/api/variant/" + dataset + "/" + query
}


build_path = (...args) => {
  return args.map((part, i) => {
    if (i === 0){
      return part.trim().replace(/[\/]*$/g, '')
    } else {
      return part.trim().replace(/(^[\/]*|[\/]*$)/g, '')
    }
  }).filter(x=>x.length).join('/')
}

FreqMap = function() {
    width = 1150; // 960
    height = 600; // 500
    currentNodes = [];
    currentLinks = [];
    variant_data = null;
    radius = 12;
    radiusScale = d3.scale.linear().domain([0, 1]).range([5, radius * 1.5]);
    opacityScale = d3.scale.sqrt().domain([1, 30]).range([.3, 1]);
    charge = function(node) {
        return -Math.pow(node.radius, 2.0) / 8;
    };
    force = d3.layout.force().size([width, height]).gravity(0).friction(0.01);
    
    pies = null;
    pie = d3.layout.pie().startAngle(5 * Math.PI / 2).endAngle(Math.PI / 2).sort(null);
    arc = d3.svg.arc().innerRadius(0).outerRadius(radius);
    
    colorScale = d3.scale.ordinal().domain([1, .1, .01, .001, 0.001]).range(['#1f78b4', '#33a02c', '#e31a1c', '#6a3d9a', '#663300']);
    minColor = null;
    majColor = '#fdbf6f';
    legend_data = [
        [.25, .75]
    ];

    trans_data = [
        [.25, .75],
        [.25, .75],
        [.25, .75],
        [.25, .75]
    ];


    freqMap = (function(_this) {
        return function(selection, data) {
            // Initial Query
            map_area = _datasets[get_current_dataset()].map_area
            draw_map(map_area)
            currentNodes = setupNodes(data['data']);
            currentLinks = setupLinks(currentNodes);
            variant_data = data['variant']
            return update();
        };
    })(this);


    draw_map = function(map_area) {
        projection = d3.geo.kavrayskiy7().rotate([-155, 0, 0]).clipExtent([
                    [3, 3],
                    [width - 3, height - 3]
                    ]).scale(180).translate([width / 2, height / 2]);

            path = d3.geo.path().projection(projection);
            graticule = d3.geo.graticule();

            setLayout('true');

            // Clear existing vis
            d3.select("#vis")
                .selectAll("*").remove();

            // Establish vis element
            vis = d3.select('#vis').append("svg")
                .attr("width", width)
                .attr("height", height)
                .attr("id", "svg_image");

            vis.append("defs")
               .append("path")
               .datum({
                    type: "Sphere"
                })
               .classed("map-path", true).attr({
                    "id": "sphere",
                    "d": path
                });


            base_layer = vis.append("g")
                            .attr('name', 'base-layer')

            // Map outline
            base_layer.append("use")
                      .attr({
                                "xlink:href": "#sphere",
                                'fill': 'none',
                                'stroke': '#000',
                                'stroke-width': '3px'
                            })
                      .classed("map-path", true)
                      .classed("world-border", true);
            
            // Map background
            base_layer.append("use").attr({
                "xlink:href": "#sphere",
                'fill': '#fff'
            }).classed("map-path", true);
            
            // Graticules
            base_layer.append("path")
               .datum(graticule).attr({
                                        "d": path,
                                        'fill': 'none',
                                        'stroke': '#777',
                                        'stroke-width': '.3px',
                                        'stroke-opacity': '.5'
                                        })
               .classed("map-path", true);

            // Countries
            if (map_area == 'world') {
                d3.json(base_url + '/static/data/world-110m.json', function(error, world) {
                        countries = topojson.feature(world, world.objects.countries);
                        base_layer.append('path').datum(topojson.feature(world,
                                                                  world.objects.land))
                                          .classed("map-path", true)
                                          .classed('countries', true).attr({
                                                                        'd': path,
                                                                        'fill': '#aaa'
                                                                    })
                                          .classed('countries', true);
                });
            } else if (map_area == 'europe') {

            // Clear border
            base_layer.select('.world-border')
                      .remove();

            // Map - rect
            base_layer.append("rect")
               .attr("x", 0)
               .attr("y", 0)
               .attr("width", width)
               .attr("height", height)
               .attr({
                    "xlink:href": "#sphere",
                    'fill': 'none',
                    'stroke': '#000',
                    'stroke-width': '5px',
                    'stroke-location': 'inside'
                })
                .classed("map-path", true);


                projection.scale(1000)
                      .rotate([-15, 0, 0])
                      .translate([width / 2 - 10, height / 2 + 850]);

                        base_layer.selectAll('.map-path')
                                  .attr('d', path);

                        d3.json(base_url + '/static/data/world-50m.json', function(error, world) {
                            countries = topojson.feature(world, world.objects.countries);
                            base_layer.selectAll('.countries').attr('d', '');
                            base_layer.append('path').datum(topojson.feature(world, world.objects.land)).classed("map-path-50", true).attr({
                                'd': path,
                                'fill': '#aaa'
                            });

                        })

            }
    }


    setupNodes = function(data) {
        nodes = [];
        var n = Math.ceil(Math.random() * 10); // generates up to 10 random location schemes
        data.forEach(function(d) {
            var coords;
            coords = projection(d.pos);
            node = {
                x: coords[0],
                y: coords[1],
                radius: radiusScale(d.freq[0]),
                id: d['pop'],
                lon: coords[0],
                lat: coords[1],
                af: d.freq,
                xobs: d.xobs,
                nobs: d.nobs,
                freqScale: d.freqscale,
                coord: d.chrom_pos,
                alleles: d.alleles
            };
            return nodes.push(node);
        });

        return nodes;
    };

    // updates the data shown on the page
    freqMap.update_data = function(url) {
        return d3.json(url, function(error, data) {
            if (error) {
                currentDataset = get_current_dataset();
                currentVariant = $("#search").val();
                msg = "Error - The '" + currentDataset + "' dataset does not have the variant '" + currentVariant + "'."
                $("#msg-alert-error").text(msg);
                $("#msg-alert").slideDown().delay(3500).slideUp();
            } else {
                currentNodes = setupNodes(data['data']);
                currentLinks = setupLinks(currentNodes);
                vis.selectAll('.node').remove();
                variant_data = data['variant']

                // Set IGV Coord
                search_variant = variant_data['chrom'] + ":" + variant_data['pos'];
                // Set search with variant
                $("#search").val(search_variant);
                console.log(search_variant);
                igv.browser.search(search_variant);

                return update();
            }
        });
    };


    // no idea if this is ever actually used
    projectionTween = function(projection0, projection1) {
        return (function(_this) {
            return function(d) {
                var old_path, old_projection, p0, p1, t;
                t = 0;
                old_projection = d3.geo.projection(project).scale(1).translate([width / 2, height / 2]);
                old_path = d3.geo.path().projection(old_projection);

                function project(λ, φ) {;
                    λ *= 180 / Math.PI;
                    φ *= 180 / Math.PI;
                    p0 = projection0([λ, φ]);
                    p1 = projection1([λ, φ]);
                    return [(1 - t) * p0[0] + t * p1[0], (1 - t) * -p0[1] + t * -p1[1]];
                };
                return function(_) {
                    t = _;
                    return old_path(d);
                };
            };
        })(this);
    };

    // Updates Page
    update = function() {
        force.nodes(currentNodes, function(d) {
            return d.id;
        }).links(currentLinks)
          .start();

        freqScale = currentNodes[0].freqScale;
        minColor = colorScale(freqScale);
        coords = currentNodes[0].coord;
        chr = coords.split(':')[0];
        pos = coords.split(':')[1];
        alleles = currentNodes[0].alleles;

        ds = _datasets[get_current_dataset()];

        // Set the dataset URL
        $("#dataset-url").attr('href', ds.url);


        // Update title
        ucsc_link = "<a id='ucscLink' href='https://genome.ucsc.edu/cgi-bin/hgTracks?db=" + 
                            ds.build + 
                            "&position=chr" + 
                            chr + 
                            "%3A" + 
                            pos + 
                            "-" + 
                            pos + 
                            "' target='_blank'>chr" + 
                            chr + ":" + comma(pos) + 
                            "</a>"
        rs_id = "";
        if (variant_data) {
            rs_id = " - " + variant_data['name'] + " ";
        }
        $('#variant h2').html(ucsc_link + 
                              (" <span style='color:" + 
                                minColor + 
                                "'>" + 
                                alleles[0] + 
                                "</span>/<span style='color: " + 
                                majColor + 
                                "'>" + 
                                alleles[1] + 
                                "</span>" +
                                rs_id
                              ));

        $(document).trigger("updateWindow", [coords]); // added by Alex Mueller 7/11/16 to update brush

        // JN added 1/11/16 to update url query
        if (history.pushState) {
            var new_url = build_path(base_url,
                                     get_current_dataset(),
                                     chr + ':' + pos);
            window.history.pushState({
                path: new_url
            }, '', new_url);
        }

        node = vis.selectAll(".node").data(currentNodes, function(d) {
            return d.id;
        });

        var forceDrag = force.drag();

        nodeG = node.enter().append("g").attr("class", "node").attr("id", function(d) {
            return "node_" + d.id;
        }).attr({
            "transform": function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            }
        }).call(forceDrag);

        // ALEX MUELLER 8/??/2016
        // node lines create the lollipop effects
        nodeLine = nodeG.selectAll('.link')
            .data((function(_this) {
                return function(d, i) {
                    return [currentLinks[i]];
                };
            })(this)).enter()
            .append('line')
            .attr('class', 'link')
            .attr('id', function(d) {
                return 'link_' + d.id;
            })
            .attr('x1', function(d) {
                return 0;
            })
            .attr('y1', function(d) {
                return 0;
            })
            .attr('x2', function(d) {
                return 0;
            })
            .attr('y2', function(d) {
                return 0;
            })
            .attr('stroke', 'black');

        piePath = nodeG.selectAll("path").data((function(_this) {
            return function(d, i) {
                return pie([0, 1]);
            };
        })(this)).enter().append("path").attr("d", arc).attr('class', 'nodePath').each((function(_this) {
            return function(d) {
                return _this._current = d;
            };
        })(this)).attr({
            "fill": (function(_this) {
                return function(d, i) {
                    if (i === 0) {
                        return minColor;
                    } else {
                        return '#fdbf6f';
                    }
                };
            })(this),
            "stroke": 'white',
            "stroke-width": '1.5px'
        });

        piePath.data((function(_this) {
            return function(d) {
                return pie(d.af);
            };
        })(this)).transition().duration(500).attrTween("d", arcTween).attr({
            "opacity": function(d, i, index) {
                var nobs;
                nobs = currentNodes[index].nobs;
                return opacityScale(nobs);
            }
        });

        $(".node").tipsy({
            gravity: 'sw',
            html: true,
            title: function() {
                var d, tooltip;
                d = this.__data__;
                tooltip = ("<strong>pop: " + d.id + "</strong><br>") + ("<strong>maf: " + (d.af[0] * freqScale) + "</strong><br>") + ("<strong>mac: " + d.xobs + "</strong><br>") + ("<strong>nobs: " + d.nobs + "</strong>");
                return tooltip;
            }
        });
        node.exit().remove();
        $('#freqLegend h3').html(
            `<p>
            <i style='font-size:14px'>
                Frequency Scale = Proportion out of ${freqScale}
            </i>
            <br>
            The pie below represents a minor allele frequency of <span style='color: ${minColor}'>${.25 * freqScale}</span>
            </p>`).css('font-size', 12);

        legend = d3.select("#freqLegend")
                   .selectAll("svg")
                   .data(legend_data)
                   .enter()
                   .append("svg")
                   .attr("width", radius + 50)
                   .attr("height", radius + 50)
                   .append("g")
                   .attr("transform", "translate(" + (radius + 10) + ", " + (radius + 6) + ")")
                   .attr('class', 'legendSvg');

        legend.selectAll("path")
              .data(pie)
              .enter()
              .append("path")
              .attr("d", d3.svg.arc().innerRadius(0).outerRadius(16))
              .attr({
                    "fill": (function(_this) {
                        return function(d, i) {
                            if (i === 0) {
                                return minColor;
                            } else {
                                return '#fdbf6f';
                            }
                        };
                    })(this),
                    "stroke": 'white',
                    "stroke-width": '1.5px',
                    "class": 'legslice'
                });

        d3.select('.legslice').transition().duration(800).attr({
            "fill": (function(_this) {
                return function(d, i) {
                    if (i === 0) {
                        return minColor;
                    } else {
                        return '#fdbf6f';
                    }
                };
            })(this)
        });
        $('#transLegend h3').html(`
            <p>
                Sample sizes below 30 become increasingly transparent to represent uncertain frequencies, i.e.
            </p>
            `).css('font-size', 12);
        trans_legend = d3.select("#transLegend")
                         .selectAll("svg")
                         .data(trans_data)
                         .enter()
                         .append("svg")
                         .attr("width", radius + 50)
                         .attr("height", radius + 50)
                         .append("g")
                         .attr("transform", "translate(" + (radius + 10) + ", " + (radius + 20) + ")")
                         .attr('class', 'transSvg');

        trans_legend.selectAll("path")
                    .data(pie)
                    .enter()
                    .append("path")
                    .attr("d", d3.svg.arc()
                        .innerRadius(0)
                    .outerRadius(16))
                    .attr({
                        "fill": (function(_this) {
                            return function(d, i) {
                                if (i === 0) {
                                    return '#1f78b4';
                                } else {
                                    return '#fdbf6f';
                                }
                            };
                        })(this),
                        "stroke": 'white',
                        "stroke-width": '1.5px',
                        "class": 'legslice',
                        "opacity": (function(_this) {
                            return function(d, i, index) {
                                return opacityScale(index * 9);
                            };
                    })(this)
        });
        trans_legend.append('text').text((function(_this) {
            return function(d, i, index) {
                return i * 9;
            };
        })(this)).attr({
            'font-size': '11px'
        });
    };

    arcTween = (function(_this) {
        return function(a) {
            var i;
            i = d3.interpolate(_this._current, a);
            _this._current = i(0);
            return function(t) {
                return arc(i(t));
            };
        };
    })(this);

    
    setupLinks = function(nodes) {
        var links = [];
        var link;
        nodes.forEach(function(d, i) {
            link = {
                x: d.x,
                y: d.y,
                id: d.id,
                source: i,
                target: i
            };
            return links.push(link);
        });
        return links;
    };
    freqMap.toggleLayout = function(newLayout) {
        force.stop();
        setLayout(newLayout);
        return update();
    };
    freqMap.getCurrentNodes = function() {
        return currentNodes;
    };
    setLayout = function(newLayout) {
        var layout;
        layout = newLayout;
        if (layout === "charged") {
            return force.on("tick", tickCharged).charge(charge);
        } else if (layout === "true") {
            return force.on("tick", tick).charge(0);
        }
    };
    tick = function(e) {
        var k;
        k = e.alpha * 0.08;
        node.each(moveToPoint(e.alpha));
        return node.attr("transform", (function(_this) {
            return function(d) {
                // this is what drags the stems along with the nodes
                var link = $('#link_' + d.id);
                link.attr('x2', d.lon - d.x);
                link.attr('y2', d.lat - d.y);
                return "translate(" + d.x + " , " + d.y + ")";

            };
        })(this));
    };

    tickCharged = function(e) {
        var k, q;
        k = e.alpha * 0.08;
        q = d3.geom.quadtree(currentNodes);
        currentNodes.forEach(function(n) {
            return q.visit(collide(n));
        });
        node.each(moveToPoint(e.alpha));
        return node.attr("transform", (function(_this) {
            return function(d) {
                // this is what drags the stems along with the nodes
                var link = $('#link_' + d.id);
                link.attr('x2', d.lon - d.x);
                link.attr('y2', d.lat - d.y);
                return "translate(" + d.x + " , " + d.y + ")";
            };
        })(this));
    };
    moveToPoint = function(alpha) {
        return (function(_this) {
            return function(d) {
                d.y += (d.lat - d.y) * alpha;
                return d.x += (d.lon - d.x) * alpha;
            };
        })(this);
    };
    collide = function(node) {
        var nx1, nx2, ny1, ny2, r;
        r = node.radius + 16;
        nx1 = node.x - r;
        nx2 = node.x + r;
        ny1 = node.y - r;
        ny2 = node.y + r;
        return function(quad, x1, y1, x2, y2) {
            var l, x, y;
            if (quad.point && (quad.point !== node)) {
                x = node.x - quad.point.x;
                y = node.y - quad.point.y;
                l = Math.sqrt(x * x + y * y);
                r = node.radius + quad.point.radius + 8;
                if (l < r) {
                    l = (l - r) / l * .5;
                    node.x -= x *= l;
                    node.y -= y *= l;
                    quad.point.x += x;
                    quad.point.y += y;
                }
            }
            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        };
    };
    return freqMap;
};



// Toggles charged layout
activate = function(group, link) {
    d3.selectAll("#" + group + " a").classed("active", false);
    return d3.select("#" + group + " #" + link).classed("active", true);
};

plot = FreqMap();
activate("layouts", 'true');



setup_igv = function(init_loc) {

    // options for browser
    var options = {

        locus: init_loc,

        reference: {
            id: "hg19",
        },

        trackDefaults: {
            palette: ["#00A0B0", "#6A4A3C", "#CC333F", "#EB6841"],
            bam: {
                coverageThreshold: 0.2,
                coverageQualityWeight: true
            }
        },

        tracks: construct_trackset()

        /*
        [{
            name: "Genes",
            url: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed",
            index: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed.idx",
            displayMode: "EXPANDED",
            color: "#aaaaaa",
            order: 0
        }]
        */
    };


    /*
     *
     *
     * IGV Functions
     * 
     *
     */

    // creates browser instance
    browser = igv.createBrowser(browserdiv, options);

    // Handle clicking on variants
    browser.on('trackclick', function (track, popoverData, pos) {
        // Get chromosome
        console.log(popoverData);
        chrom = $(".igvNavigationSearchInput").val().split(":")[0];
        // Fill Search bar
        $("#search").val(chrom + ":" + pos);
        search();
        return false;
    });

}

/*
 * 
 *  INITIAL QUERY 
 *
 */

d3.json(get_query_url(init_loc), function(data) {
    console.log(data);
    plot('#vis', data);
    setup_igv(data['variant']['chrom'] + ':' + data['variant']['pos'])
});

// Handle back/forth events
window.onpopstate = function(event) {
  path = event.state.path.split("/")
  dataset = path[path.length - 2];
  $("#dataset").val(dataset);
  loc = path[path.length - 1];
  plot.update_data(get_query_url(loc));
};


d3.selectAll("#layouts a").on("click", function(d) {
    var newLayout;
    newLayout = d3.select(this).attr("id");
    activate("layouts", newLayout);
    return plot.toggleLayout(newLayout);
});

// Change Dataset function
$('#dataset').change(function() {
    // Update Map projection
    map_area = _datasets[get_current_dataset()].map_area
    draw_map(map_area);
    plot.update_data(get_query_url("random"));
});

window.plot = plot;

search = function(query) {
        if (query === undefined) {
            query = $('#search').val()
        }
        plot.update_data(get_query_url(query));
}

// Bind search
$('#buttons').keyup(function(e) {
    if (e.which === 13) {
        search();
    }
});
$('#submit').click(function() { search(); });

// Bind random variant
d3.select('#random').on("click", function() {
    plot.update_data(get_query_url("random"));
});

// Multiple SNPs
$('#submitArea').click(function() {
    dataTable = $('#snp_col').val().split('\n');
    $("#slider").slider({
        min: 0,
        max: dataTable.length - 1,
        step: 1,
        slide: function(event, ui) {
            search(dataTable[ui.value])
        }
    });
});


construct_trackset = function() {
    ds = _datasets[get_current_dataset()]

    variant_bed = {
        name: ds.label,
        url: base_url + '/track' + ds.bed,
        indexURL: base_url + '/track' + ds.bed + '.tbi',
        color: "#aaaaaa",
        type: "annotation",
        format: 'bed'
    }

    return [variant_bed]
}


var currentChrom = 0;
// div that contains the browser

var browserdiv = document.getElementById("browserContainer");


get_init_loc_browser = function() {
    if (init_loc == 'random') {

    }
}





/*
igv.browser.on('trackclick', function (track, popoverData) {
    var symbol = null;
    console.log(popoverData);

    chrom = igv.browser.$searchInput.val().split(":")[0]
    pos = popoverData['pos'] + 1;
    if (popoverData['data'].length > 0) {
    console.log(urlrsID)
    initapiquery = get_query_url(chrom + ':' + pos);
    console.log(initapiquery);
    window.plot.update_data(initapiquery);
}

    // Prevent default pop-over behavior
    return false;
});


// when the user searches for a new variant, the updateWindow event is called
// the function below will set the IGV browser window to 10 kb around the
// chosen variant. this will not occur if the user clicks on a variant
// in the browser
$(document).on("updateWindow", function(event, coords) {


    var chromosome, x, xleft, xright;
    coords = coords.split(':');
    chromosome = parseInt(coords[0]);
    x = parseInt(coords[1]);

    if (x >= 5000) {
        xleft = x - 100;
        xright = x + 100;
    } else {
        xleft = 0;
        xright = 200;
    }

    // this inputs the window into the IGV search bar
    if (currentChrom != chromosome) {
        $('#igvControlDiv input').val(chromosome + ':' + xleft + '-' + xright);
    }

    // this triggers the search, which then displays the proper window
    $('#igvControlDiv .fa-search').click();


})


// here are the igv.js tracks for the datasets current included in the GGV
// when the user switches to a new dataset, a corresponding set of tracks
// will be loaded
// unfortunately I could not find the correct VCFs for hgdp and popres datasets
// once they are found they can be linked to in the track data
var oneThousandTracks = [{
    name: "Genes",
    url: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed",
    index: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed.idx",
    displayMode: "EXPANDED",
    color: "#aaaaaa",
    order: 0
}, {
    name: "Variants",
    format: "vcf",
    url: "https://s3.amazonaws.com/1000genomes/release/20130502/ALL.wgs.phase3_shapeit2_mvncall_integrated_v5b.20130502.sites.vcf.gz",
    indexURL: "https://s3.amazonaws.com/1000genomes/release/20130502/ALL.wgs.phase3_shapeit2_mvncall_integrated_v5b.20130502.sites.vcf.gz.tbi",
    type: "variant",
    color: "#aaaaaa",
    order: 1
}];

var exacTracks = [{
    name: "Genes",
    url: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed",
    index: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed.idx",
    displayMode: "EXPANDED",
    color: "#aaaaaa",
    order: 0
}, {
    name: "Variants",
    format: "vcf",
    url: "http://popgen.uchicago.edu/ggv_sites_data/sites/ExAC.r0.3.1.sites.vep.vcf.gz",
    indexURL: "http://popgen.uchicago.edu/ggv_sites_data/sites/ExAC.r0.3.1.sites.vep.vcf.gz.tbi",
    type: "variant",
    color: "#aaaaaa",
    order: 1
}];

var hgdpTracks = [{
    name: "Genes",
    url: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed",
    index: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed.idx",
    displayMode: "EXPANDED",
    color: "#aaaaaa",
    order: 0
}, {
    name: "Variants",
    format: "vcf",
    url: "http://popgen.uchicago.edu/ggv_sites_data/sites/H938_autoSNPs.sites.vcf.gz",
    indexURL: "http://popgen.uchicago.edu/ggv_sites_data/sites/H938_autoSNPs.sites.vcf.gz.tbi",
    type: "variant",
    color: "#aaaaaa",
    order: 1
}];

var popresTracks = [{
    name: "Genes",
    url: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed",
    index: "//igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed.idx",
    displayMode: "EXPANDED",
    color: "#aaaaaa",
    order: 0
}, {
    name: "Variants",
    format: "vcf",
    url: "http://popgen.uchicago.edu/ggv_sites_data/sites/POPRES_NovembreEtAl2008_autoSNPs.sites.vcf.gz",
    indexURL: "http://popgen.uchicago.edu/ggv_sites_data/sites/POPRES_NovembreEtAl2008_autoSNPs.sites.vcf.gz.tbi",
    type: "variant",
    color: "#aaaaaa",
    order: 1
}];


// Whenever the dataset is changed, the genes and variants sections are
// updated. This requires changing the tracks. the tracks are provided above.
// The info is currently not correct and all tracks contain the info for 1000genomes
// and should be updated soon
$(document).on("datasetChange", function(event, new_dataset, old_dataset) {
    if (old_dataset == new_dataset) {
        return;
    }

    // Run multiple times...unfortunately?
    igv.browser.removeAllTracks();
    igv.browser.removeAllTracks();
    igv.browser.removeAllTracks();
    
    // sets the tracks to the new track info
    if (new_dataset == 'HGDP') {
        var trackset = hgdpTracks;
    } else if (new_dataset == 'POPRES_Euro') {
        var trackset = popresTracks;
    } else if (new_dataset == 'ExAC') {
        var trackset = exacTracks;
    } else {
        var trackset = oneThousandTracks;
    }
    console.log(trackset);

    // loads the new tracks
    for (i = 0; i < trackset.length; i++) {
        igv.browser.loadTrack(trackset[i]);
    }

})



*/

// ALEX MUELLER PDF ADDITIONS 6/28/16
// ALEX MUELLER ADDITIONS 6/28/16
$(function() {

    var initPDF, createPDF, pdfNumber, pdfArray, saveData, streamArray, currentDataset, printingArray, clearOldPDFs; // doc, stream,

    // initializes PDF creation by prerendering the map for the next pdf to be
    // printed. this is called whenever the page is opened, a PDF has just been
    // created, or the database has been changed

    newPDF = function() {
        var doc, sphere, paths, lines, landmass, stream, xml, xml2, arrayBuffer;

        //doc = new PDFDocument({size:[612,450],margins:{top:0,bottom:0,left:0,right:0}});
        doc = new PDFDocument({
            size: [480, 400],
            margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            }
        });
        stream = doc.pipe(blobStream());

        // load fonts
        xml = new XMLHttpRequest;
        xml2 = new XMLHttpRequest;
        xml.open('GET', '/static/css/fonts/Arvo-Regular.ttf', true);
        xml2.open('GET', '/static/css/fonts/Arvo-Italic.ttf', true);
        xml.responseType = "arraybuffer";
        xml2.responseType = "arraybuffer";
        xml.onload = function(event) {
            arrayBuffer = xml.response;
            if (arrayBuffer) {
                doc.registerFont('Arvo-Regular', arrayBuffer);
            }
        };
        xml.send(null);

        xml2.onload = function(event) {
            arraybuffer = xml2.response;
            if (arraybuffer) {
                doc.registerFont('Arvo-Italic', arraybuffer);
            }
        };
        xml2.send(null);

        sphere = d3.select('svg defs path')[0];
        paths = d3.selectAll('path');
        lines = paths[0][1];
        landmass = paths[0][2];

        if (_datasets[get_current_dataset()].map_area === 'europe') {
            landmass = paths[0][3];
        }

        // position of map in pdf in translate(250,130)
        doc.scale(.5).translate(160, 130).path($(sphere).attr('d')).stroke('black');
        doc.path($(lines).attr('d')).strokeColor("#d2d2d2", 0.5).lineWidth(0.3).stroke();
        doc.path($(landmass).attr('d')).fillColor('#AAAAAA').fill();

        setTimeout(function() {
            var variant, chromosome, allele1, allele1Color, allele2;

            variant = $('#variant h2')[0];
            chromosome = $(variant).children()[0];
            allele1 = $(variant).children()[1];
            allele2 = $(variant).children()[2];
            allele1Color = ($(allele1).css('color')).split(',');

            for (i = 0; i < 3; i++) {
                allele1Color[i] = allele1Color[i].replace(/\D/g, '');
            }
            // position of header
            doc.scale(2).fillColor('black').font('Arvo-Regular').text($(chromosome).text() + ' ', 100, -15, {
                continued: true
            }).fillColor(allele1Color).text($(allele1).text(), {
                continued: true
            }).fillColor('black').text('/', {
                continued: true
            }).fillColor('#fdbf6f').text($(allele2).text()).scale(.5);

            var nodes = d3.selectAll('#svg_image g');
            nodes = nodes[0];
            var nodeTotal = nodes.length; // - 5; // removes the bottom 5 nodes in the legend

            // ADD NODES TO MAP
            for (i = 0; i < nodeTotal; i++) {
                nodeLine = $(nodes[i]).children()[0];
                nodePath1 = $(nodes[i]).children()[1];
                nodePath2 = $(nodes[i]).children()[2];

                translate = $(nodes[i]).attr('transform');
                if (translate.indexOf(',') == -1) {
                    translate = translate.replace(' ', ',');
                }

                transform = translate.split(',');
                xtranslate = parseFloat(transform[0].replace('translate(', '').replace(' ', ''));
                ytranslate = parseFloat(transform[1].replace(')', '').replace(' ', ''));
                opacity = $(nodePath1).attr('opacity');

                doc.translate(xtranslate, ytranslate);
                doc.lineWidth(1).strokeColor('black').lineTo($(nodeLine).attr('x2') + xtranslate, $(nodeLine).attr('y2') + ytranslate);
                doc.lineWidth(1.5).path($(nodePath1).attr('d')).fillColor($(nodePath1).attr('fill'), opacity).strokeColor('white', opacity).fillAndStroke();
                doc.path($(nodePath2).attr('d')).fillColor($(nodePath2).attr('fill'), opacity).strokeColor('white', opacity).fillAndStroke().translate(-xtranslate, -ytranslate);
            }

            // FREQUENCY LEGEND
            console.log('adding frequency legend');
            var freqLegend, freqLegendi, freqLegendSpan, fLSColor, freqLegendCircle, i;
            freqLegendi = $('#freqLegend h3 p i').text();
            freqLegend = $('#freqLegend h3 p').clone();
            freqLegendSpan = $('#freqLegend h3 p span').clone();
            fLSColor = freqLegendSpan.css('color');
            fLSColor = fLSColor.split(',');
            freqLegendCircle = d3.select('#freqLegend svg')[0]; //$("#freqLegend svg");

            for (i = 0; i < 3; i++) {
                fLSColor[i] = fLSColor[i].replace(/\D/g, '');
            }
            $('i', freqLegend).remove();
            $('br', freqLegend).remove();
            $('span', freqLegend).remove();

            // position of legend
            var legendheight = 210
            doc.scale(2).fontSize(8).fillColor('black').font('Arvo-Italic').text(freqLegendi, -32, legendheight);
            doc.fontSize(7).font('Arvo-Regular').text($.trim(freqLegend.text() + ' ' + freqLegendSpan.text()), -70, legendheight + 10, {
                width: 215,
                align: 'center'
            });

            doc.translate(30, legendheight + 40).scale(0.5).path("M0,-16A16,16 0 0,1 16,0L0,0Z").fillColor(fLSColor).strokeColor('white').fillAndStroke();
            doc.path("M16,0A16,16 0 1,1 -2.9391523179536475e-15,-16L0,0Z").fillColor('#fdbf6f').strokeColor('white').fillAndStroke().scale(2).translate(-103, -legendheight - 40);

            // TRANS LEGEND
            var transLegend, transOpacity;
            transLegend = $('#transLegend h3 p').text();
            doc.fillColor('black').text(transLegend, 250, legendheight, {
                width: 220,
                align: 'center'
            });
            transOpacity = [0.1436531757746151, 0.6126936484507698, 0.8069765735351202, 0.9560551052558368];

            doc.translate(310, legendheight + 40).scale(0.5);
            for (i = 0; i < 4; i++) {
                doc.path("M0,-16A16,16 0 0,1 16,0L0,0Z").fillColor('#1f78b4', transOpacity[i]).strokeColor('white', transOpacity[i]).fillAndStroke();
                doc.path("M16,0A16,16 0 1,1 -2.9391523179536475e-15,-16L0,0Z").fillColor('#fdbf6f', transOpacity[i]).strokeColor('white', transOpacity[i]).fillAndStroke().translate(65, 0); //.translate(-210,-620);
            }

            doc.translate(-65 * 4, 0).scale(2).translate(-300, -310).fillColor('black').text('0', 295, 305);
            doc.text('n=9', 327, 305);
            doc.text('n=18', 358, 305);
            doc.text('n=27', 390, 305);

            doc.end();

        }, 1000);

        stream.on('finish', function() {
            blob = stream.toBlob('application/pdf');
            saveAs(blob, 'ggv.pdf');
        });
    }

    // when 'Convert to PDF' is triggered, use the current PDF and fill in the
    // rest of the details (nodes, text, etc.)
    $('#pdf').on('click', function() {
        alert("A PDF is being generated but may take a few seconds. Please close this box to procede");
        newPDF();
    });

}); // End Alex Mueller's P1B Functions (PDF writing)

