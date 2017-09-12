draw_map = function(map_area = 'world') {

    width = 635;
    height = 425;

    projection = d3.geo.kavrayskiy7().rotate([-155, 0, 0]).clipExtent([
                [3, 3],
                [width - 3, height - 3]
                ]).scale(120).translate([width / 2, height / 2]);

    path = d3.geo.path().projection(projection);
    graticule = d3.geo.graticule();

    // Clear existing map
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

    // Map outline
    vis.append("use").attr({
        "xlink:href": "#sphere",
        'fill': 'none',
        'stroke': '#000',
        'stroke-width': '3px'
    })
    .classed("map-path", true);
    
    // Map background
    vis.append("use").attr({
        "xlink:href": "#sphere",
        'fill': '#fff'
    }).classed("map-path", true);
    
    // Graticules
    vis.append("path").datum(graticule).attr({
        "d": path,
        'fill': 'none',
        'stroke': '#777',
        'stroke-width': '.3px',
        'stroke-opacity': '.5'
    }).classed("map-path", true);

    // Countries
    if (map_area == 'world') {
        d3.json('/static/data/world-110m.json', function(error, world) {
                countries = topojson.feature(world, world.objects.countries);
                vis.append('path').datum(topojson.feature(world,
                                                          world.objects.land))
                                  .classed("map-path", true)
                                  .classed('countries', true).attr({
                                                                'd': path,
                                                                'fill': '#aaa'
                                                            })
                                  .classed('countries', true);
        });
    } else if (map_area == 'europe') {
        projection.scale(1000)
              .rotate([-15, 0, 0])
              .translate([width / 2 - 10, height / 2 + 850]);

                vis.selectAll('.map-path').attr('d', path);
                console.log(vis.selectAll('.countries')[0]);

                d3.json('/static/data/world-50m.json', function(error, world) {
                    countries = topojson.feature(world, world.objects.countries);
                    vis.selectAll('.countries').attr('d', '');
                    vis.append('path').datum(topojson.feature(world, world.objects.land)).classed("map-path-50", true).attr({
                        'd': path,
                        'fill': '#aaa'
                    });

                })

    } 
   


}


FreqMap = function() {
    var arc, arcTween, charge, collide, colorScale, countries, currentDataset, currentNodes, currentLinks, force, freqMap, height, legend_data, majColor, minColor, moveToPoint, node, nodeG, opacityScale, path, pie, pies, projection, projectionTween, radius, radiusScale, setLayout, setupNodes, tick, tickCharged, trans_data, update, vis, width;
    vis = null;
    width = 635; // 960
    height = 425; // 500
    currentNodes = [];
    currentLinks = [];
    node = null;
    nodeG = null;
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
    projection = null;
    countries = null;
    path = null;
    currentDataset = $('#dataset').chosen().val();


    freqMap = (function(_this) {
        return function(selection, data) {
            var graticule;
            projection = d3.geo.kavrayskiy7().rotate([-155, 0, 0]).clipExtent([
                [3, 3],
                [width - 3, height - 3]
            ]).scale(120).translate([width / 2, height / 2]);
            path = d3.geo.path().projection(projection);
            graticule = d3.geo.graticule();
            currentNodes = setupNodes(data);
            currentLinks = setupLinks(currentNodes);
            console.log('currentNodes');
            console.log(currentNodes);
            console.log('currentLinks');
            console.log(currentLinks);
            setLayout('true');
            vis = d3.select('#vis').append("svg").attr("width", width).attr("height", height).attr("id", "svg_image");
            vis.append("defs").append("path").datum({
                type: "Sphere"
            }).classed("map-path", true).attr({
                "id": "sphere",
                "d": path
            });
            vis.append("use").attr({
                "xlink:href": "#sphere",
                'fill': 'none',
                'stroke': '#000',
                'stroke-width': '3px'
            }).classed("map-path", true);
            vis.append("use").attr({
                "xlink:href": "#sphere",
                'fill': '#fff'
            }).classed("map-path", true);
            vis.append("path").datum(graticule).attr({
                "d": path,
                'fill': 'none',
                'stroke': '#777',
                'stroke-width': '.3px',
                'stroke-opacity': '.5'
            }).classed("map-path", true);
            return d3.json('/static/data/world-110m.json', function(error, world) {
                console.log(error);
                console.log(world)
                countries = topojson.feature(world, world.objects.countries);
                vis.append('path').datum(topojson.feature(world, world.objects.land)).classed("map-path", true).classed('countries', true).attr({
                    'd': path,
                    'fill': '#aaa'
                }).classed('countries', true);
                return update();
            });
        };
    })(this);

    // updates the data shown on the page
    freqMap.updateData = function(url) {
        return d3.json(url, function(error, data) {
            if (error) {
                console.log(error);
                currentDataset = $('#dataset').chosen().val();
                currentVariant = $("#search").val();
                msg = "Error - The '" + currentDataset + "' dataset does not have the variant '" + currentVariant + "'."
                $("#msg-alert-error").text(msg);
                $("#msg-alert").slideDown().delay(3500).slideUp();
            } else {
                currentNodes = setupNodes(data);
                currentLinks = setupLinks(currentNodes);
                vis.selectAll('.node').remove();
                //adjustBrush(data);
                console.log('currentNodes');
                console.log(currentNodes);
                return update();
            }
        });
    };

    // updates the map projection
    // particularly important when going to european projection
    freqMap.updateMapSimple = function(dataset) {
        console.log('updateMapSimple')
            /*
            country_raw = countries.features.filter (d) =>
              if d.id == 840
                d.id
            country = country_raw[0]
            bounds = path.bounds(country)
            dx = bounds[1][0] - bounds[0][0]
            dy = bounds[1][1] - bounds[0][1]
            x = (bounds[0][0] + bounds[1][0]) / 2
            y = (bounds[0][1] + bounds[1][1]) / 2
            s = .9 / Math.max(dx / width, dy / height)
            t = [width / 2 - s * x, height / 2 - s * y]
             */
        $(document).trigger("datasetChange", [dataset, currentDataset]);
        if (dataset === '1000genomes') {
            vis.selectAll('.map-path-50').remove();
            projection.scale(120).translate([width / 2, height / 2]).rotate([-155, 0, 0]);
            vis.selectAll('.map-path').attr('d', path);
            return currentDataset = dataset;
        } else if (dataset === '1000genomes_superpops') {
            vis.selectAll('.map-path-50').remove();
            projection.scale(120).translate([width / 2, height / 2]).rotate([-155, 0, 0]);
            vis.selectAll('.map-path').attr('d', path);
            return currentDataset = dataset;
        } else if (dataset === 'HGDP') {
            vis.selectAll('.map-path-50').remove();
            projection.scale(120).translate([width / 2, height / 2]).rotate([-155, 0, 0]);
            vis.selectAll('.map-path').attr('d', path);
            return currentDataset = dataset;
        } else if (dataset == 'POPRES_Euro') {
            projection.scale(1000).rotate([-15, 0, 0]).translate([width / 2 - 10, height / 2 + 850]);
            console.log(path);

            vis.selectAll('.map-path').attr('d', path);
            console.log(vis.selectAll('.countries')[0]);

            d3.json('/static/data/world-50m.json', function(error, world) {
                countries = topojson.feature(world, world.objects.countries);
                vis.selectAll('.countries').attr('d', '');
                vis.append('path').datum(topojson.feature(world, world.objects.land)).classed("map-path-50", true).attr({
                    'd': path,
                    'fill': '#aaa'
                });

            })
            return currentDataset = dataset;
        } else {
            vis.selectAll('.map-path-50').remove();
            projection.scale(120).translate([width / 2, height / 2]).rotate([-155, 0, 0]);
            vis.selectAll('.map-path').attr('d', path);
            return currentDataset = dataset;
        }
    };

    // updates map path
    freqMap.updateMap = function(view) {
        var b, country, country_raw, new_path, new_projection, s, t;
        country_raw = countries.features.filter((function(_this) {
            return function(d) {
                if (d.id === 156) {
                    return d.id;
                }
            };
        })(this));
        country = country_raw[0];
        b = path.bounds(country);
        s = .95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height);
        t = [(width - s * (b[1][0] + b[0][0])) / 2, height - s * (b[1][1] + b[0][1])];
        new_projection = d3.geo.kavrayskiy7().scale(s).translate(t);
        new_path = d3.geo.path().projection(new_projection);
        return vis.selectAll('.map-path').attr('d', new_path);
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

    // general update function
    update = function() {
        var alleles, build, chr, coords, freqScale, legend, piePath, pos, trans_legend;
        force.nodes(currentNodes, function(d) {
            return d.id;
        }).links(currentLinks).start();
        freqScale = currentNodes[0].freqScale;
        minColor = colorScale(freqScale);
        coords = currentNodes[0].coord;
        chr = coords.split(':')[0];
        pos = coords.split(':')[1];
        alleles = currentNodes[0].alleles;
        if (currentDataset === '1000genomes') {
            build = 'hg19';
        } else {
            build = 'hg18';
        }
        $('#variant h2').html(("<a id='ucscLink' href='https://genome.ucsc.edu/cgi-bin/hgTracks?db=" + build + "&position=chr" + chr + "%3A" + pos + "-" + pos + "' target='_blank'>chr" + chr + ":" + comma(pos) + "</a>") + (" <span style='color:" + minColor + "'>" + alleles[0] + "</span>/<span style='color: " + majColor + "'>" + alleles[1] + "</span>"));
        console.log(coords);

        $(document).trigger("updateWindow", [coords]); // added by Alex Mueller 7/11/16 to update brush

        // JN added 1/11/16 to update url query
        if (history.pushState) {

            var newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?data="' + $('#dataset').chosen().val() + '"&chr=' + chr + '&pos=' + pos;
            window.history.pushState({
                path: newurl
            }, '', newurl);
        }

        node = vis.selectAll(".node").data(currentNodes, function(d) {
            return d.id;
        });

        var forceDrag = force.drag();

        console.log('update');

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
        $('#freqLegend h3').html("<p><i style='font-size:14px'>Frequency Scale = Proportion out of " + freqScale + "</i><br>The pie below represents a minor allele frequency of <span style='color:" + minColor + "'>" + (.25 * freqScale) + "</span></p>").css('font-size', 12);
        legend = d3.select("#freqLegend").selectAll("svg").data(legend_data).enter().append("svg").attr("width", radius + 50).attr("height", radius + 50).append("g").attr("transform", "translate(" + (radius + 10) + ", " + (radius + 6) + ")").attr('class', 'legendSvg');
        legend.selectAll("path").data(pie).enter().append("path").attr("d", d3.svg.arc().innerRadius(0).outerRadius(16)).attr({
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
        $('#transLegend h3').html('<p>Sample sizes below 30 become increasingly transparent to represent uncertain frequencies, i.e.</p>').css('font-size', 12);
        trans_legend = d3.select("#transLegend").selectAll("svg").data(trans_data).enter().append("svg").attr("width", radius + 50).attr("height", radius + 50).append("g").attr("transform", "translate(" + (radius + 10) + ", " + (radius + 20) + ")").attr('class', 'transSvg');
        trans_legend.selectAll("path").data(pie).enter().append("path").attr("d", d3.svg.arc().innerRadius(0).outerRadius(16)).attr({
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
        return $('#testLegend h3').html('<p>Please reference:</p><p>Marcus & Novembre (2016) Visualizing the Geography of Genetic Variants.  <it>Bioinformatics</it><a href="http://bioinformatics.oxfordjournals.org/content/early/2016/10/14/bioinformatics.btw643.abstract"> <i id="linkIcon" class="fa fa-external-link"></i></a></p><p>Version: 0.4 (beta)</p><p>Funding provided by <a href="https://datascience.nih.gov/bd2k">NIH BD2K Program.</a></p>').css('font-size', 12);
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

    // ALEX MUELLER 8/30/16
    // creates random schema to simulate the effect of having
    // alternate location schemes
    randomSchemes = function(n, px, py) {
        schemes = {};
        var coords, x, y;
        //      schemes['sample'] = [px,py]; // saves the original x,y  --changed 10-14-16 by JRT
        schemes['Population Positions (default)'] = [px, py]; // saves the original x,y
        for (i = 0; i < n; i++) {
            x = Math.floor(Math.random() * 200 - 100);
            y = Math.floor(Math.random() * 150 - 75);
            coords = projection([x, y]);
            schemes['Ancestral Scheme ' + i] = [];
            schemes['Ancestral Scheme ' + i][0] = coords[0];
            schemes['Ancestral Scheme ' + i][1] = coords[1];
        }
        return schemes;
    }

    setupNodes = function(data) {
        var nodes;
        nodes = [];
        var n = Math.ceil(Math.random() * 10); // generates up to 10 random location schemes
        // randomSchemes(n);
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
                alleles: d.alleles,
                alt: randomSchemes(n, coords[0], coords[1]) // this is where the alternate schema are placed
                    // ideally this will be replaced with some form of API that retrieves
                    // each variant's location schemes
            };
            return nodes.push(node);
        });

        // ALEX MUELLER 8/29/16
        // the code below sets up the new location scheme dropdown box
        // this allows the API to provide unique number of location schemes for
        // each variant
        var locations = Object.keys(nodes[0]['alt']);

        // removes preexisting scheme dropdown box
        if ($('#scheme').length) {
            $('#scheme').remove();
            $('#scheme_chosen').remove();
        }

        // creates the new scheme dropdown box
        var schemes = d3.select("#schemes").append("select").attr("id", "scheme").attr('class', 'chosen');
        schemeOpts = schemes.selectAll("option").data(locations).enter().append("option");
        schemeOpts.text((function(_this) {
            return function(d) {
                return d;
            };
        })(this)).attr("value", (function(_this) {
            return function(d) {
                return d;
            };
        })(this));

        $(".chosen").chosen();

        // ALEX MUElLER 8/29/16
        // whenever the scheme changes, the x, y, lon, and lat attributes of the
        // nodes are changed. they are then translated via svg transformations
        // to their new location
        $('#scheme').chosen().change(function() {
            var scheme = $('#scheme').chosen().val();
            var nodes = d3.selectAll('.node')[0];
            nodes.forEach(function(d, i) {
                var alt = d3.select(d).datum()['alt'][scheme];
                var newX = alt[0];
                var newY = alt[1];
                var id = $(d).attr("id");
                var data = d3.select(d).datum();
                data['x'] = newX;
                data['y'] = newY;
                data['lon'] = newX;
                data['lat'] = newY;
                d3.select(d).datum();
                $('#' + d['id']).attr("transform", "translate(" + newX + " , " + newY + ")");
            })


        });

        return nodes;
    };
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
        var scheme = $('#scheme').chosen().val();
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