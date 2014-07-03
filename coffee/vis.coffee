root = exports ? this

FreqMap = () ->
  # setup global paramters
  
  # visulization parameters
  vis = null
  width = 960
  height = 500

  # node parameters
  currentNodes = []
  node = null
  nodeG = null
  radius = 12
  radiusScale = d3.scale.linear()
    .domain([0, 1])
    .range([5, radius*1.5])
  opacityScale = d3.scale.sqrt()
    .domain([1, 30])
    .range([.3, 1])
  charge = (node) -> -Math.pow(node.radius, 2.0) / 8
  force = d3.layout.force()
    .size([width, height])
    .gravity(0)
    .friction(0.01)

  pies = null
  pie = d3.layout.pie().startAngle(5*Math.PI/2).endAngle(Math.PI/2).sort(null)
  arc = d3.svg.arc().innerRadius(0).outerRadius(radius)
  colorScale = d3.scale.ordinal().domain([1, .1, .01, .001]).range(['#1f78b4', '#33a02c', '#e31a1c', '#6a3d9a'])
  minColor = null
  majColor = '#fdbf6f'
  legend_data = [[.25, .75]]
  trans_data = [[.25,.75], [.25,.75], [.25,.75], [.25,.75]]

  # map parameters
  projection = null
  countries = null
  path = null
  currentDataset = '1000genomes_phase3'
  

  freqMap = (selection, data) =>
    # intial projection settings
    projection = d3.geo.kavrayskiy7().rotate([-155,0, 0]).clipExtent([[3, 3], [width-3, height-3]]).scale(150).translate([width/2, height/2])
    path = d3.geo.path().projection(projection)
    graticule = d3.geo.graticule()

    # intial nodes
    currentNodes = setupNodes(data)
    setLayout('true')

    # setup svg
    vis = d3.select('#vis').append("svg")
      .attr("width", width)
      .attr("height", height)

    # setup map
    vis.append("defs").append("path")
        .datum({type: "Sphere"})
        .classed("map-path", true)
        .attr
          "id": "sphere"
          "d": path

    # map border 
    vis.append("use")
        .attr
          "xlink:href": "#sphere"
          'fill': 'none'
          'stroke': '#000'
          'stroke-width': '3px'
        .classed("map-path", true)

    # map ocean  
    vis.append("use")
        .attr
          "xlink:href": "#sphere"
          'fill': '#fff'
        .classed("map-path", true)

    # map minor axis 
    vis.append("path")
      .datum(graticule)
      .attr
        "d": path
        'fill': 'none'
        'stroke': '#777'
        'stroke-width': '.3px'
        'stroke-opacity': '.5'
      .classed("map-path", true)

    # draw map
    d3.json 'data/world-50m.json', (error, world) =>
      countries = topojson.feature(world, world.objects.countries)
      vis.append('path')
        .datum(topojson.feature(world, world.objects.land))
        .classed("map-path", true)
        .attr
          'd': path
          'fill': '#ddd'

      # draw nodes
      update()

  # new data
  freqMap.updateData = (url) ->
    d3.json url, (error, data) ->
      if error
      else      
        currentNodes = setupNodes(data)
        vis.selectAll('.node').remove()
        update()

  freqMap.updateMapSimple = (dataset) ->
    ###
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
    ###
    if dataset == '1000genomes_phase3'
      projection.scale(150).translate([width/2, height/2]).rotate([-155,0, 0])
      vis.selectAll('.map-path').attr('d', path)
      currentDataset = dataset
    else if dataset == 'hgdp'
      projection.scale(150).translate([width/2, height/2]).rotate([-155,0, 0])
      vis.selectAll('.map-path').attr('d', path)
      currentDataset = dataset
    else
      projection.scale(1000).rotate([-15,0,0]).translate([width/2 - 10, height/2 + 850 ])
      vis.selectAll('.map-path').attr('d', path)
      currentDataset = dataset

  # figure out projection tween for bounding box (not working)
  freqMap.updateMap = (view) ->
    country_raw = countries.features.filter (d) => 
      if d.id == 156
        d.id
    country = country_raw[0]

    b = path.bounds(country)
    s = .95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height)
    t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1]))]
    new_projection = d3.geo.kavrayskiy7().scale(s).translate(t)
    new_path = d3.geo.path().projection(new_projection)
    vis.selectAll('.map-path').attr('d', new_path)

  # helper for updatemap for projection transitions 
  projectionTween = (projection0, projection1) ->
    (d) =>
      t = 0 
      old_projection = d3.geo.projection(project).scale(1).translate([width / 2, height / 2])
      old_path = d3.geo.path().projection(old_projection)

      `function project(λ, φ) {`
      λ *= 180 / Math.PI
      φ *= 180 / Math.PI
      p0 = projection0([λ, φ]) 
      p1 = projection1([λ, φ])
      return [(1 - t) * p0[0] + t * p1[0], (1 - t) * -p0[1] + t * -p1[1]]
      `}`

      (_) =>
        t = _
        old_path(d)

  # update the nodes 
  update = () ->
    # define nodes for layout
    force
      .nodes(currentNodes, (d) -> d.id)
      .start()

    freqScale = currentNodes[0].freqScale
    minColor = colorScale(freqScale)
    
    #change variant title
    coords = currentNodes[0].coord
    chr = coords.split(':')[0]
    pos = coords.split(':')[1]
    alleles = currentNodes[0].alleles
    if currentDataset == '1000genomes_phase3'
      build = 'hg19'
    else
      build = 'hg18'
    $('#variant h2').html("<a id='ucscLink' href='https://genome.ucsc.edu/cgi-bin/hgTracks?db=#{ build }&position=chr#{ chr }%3A#{ pos }-#{ pos }' target='_blank'>chr#{ coords }</a>"+" <span style='color:#{ minColor }'>#{ alleles[0] }</span>/<span style='color: #{ majColor }'>#{ alleles[1] }</span>")

    # define nodes for circles
    node = vis.selectAll(".node")
      .data(currentNodes, (d) -> d.id)

    # write circles
    nodeG = node.enter().append("g")
      .attr("class", "node")
      .attr
        "transform": (d) ->
          "translate(#{d.x},#{d.y})"
      .call(force.drag)
      
    piePath = nodeG.selectAll("path")
        .data((d, i)  => pie([0,1]))
          .enter()
        .append("path")
          .attr("d", arc)
          .attr('class', 'nodePath')
          .each((d) => this._current = d)
          .attr
            "fill": (d, i) => 
              if i == 0 
                minColor
              else 
                '#fdbf6f'
            "stroke": 'white'
            "stroke-width": '1.5px'

    #transitions
    piePath.data((d) => pie(d.af)).transition().duration(500).attrTween("d", arcTween)
      .attr  
        "opacity": (d, i, index) -> 
            nobs = currentNodes[index].nobs
            opacityScale(nobs)
   
    # tool tip (tipsy)
    $(".node").tipsy
      gravity: 'sw'
      html: true
      title: () ->
        d = this.__data__
        tooltip = "<strong>pop: #{d.id}</strong><br>"+
                  "<strong>maf: #{d.af[0]*freqScale}</strong><br>"+
                  "<strong>mac: #{d.xobs}</strong><br>"+
                  "<strong>nobs: #{d.nobs}</strong>"
        return tooltip

    node.exit().remove()

    #freq scale legend 
    $('#freqLegend h3').html("<p><i>Frequency Scale = Proportion out of #{ freqScale }</i><br>Colors used in pie chart also indicate frequency scale. ex. the pie below represents MAF = <span style='color:#{ minColor }'>#{ .25*freqScale }</span></p>").css('font-size', 12)
    
    legend = d3.select("#freqLegend").selectAll("svg")
      .data(legend_data)
      .enter().append("svg")
          .attr("width", radius+50)
          .attr("height", radius+50)
          .append("g")
            .attr("transform", "translate(#{ radius + 10}, #{ radius + 20})")
            .attr('class', 'legendSvg')

    legend.selectAll("path")
       .data(pie)
      .enter().append("path")
          .attr("d", d3.svg.arc()
            .innerRadius(0)
            .outerRadius(16))
          .attr
            "fill": (d, i) => 
              if i == 0 
                minColor
              else 
                '#fdbf6f'
            "stroke": 'white'
            "stroke-width": '1.5px'
            "class": 'legslice'

     d3.select('.legslice').transition().duration(800).attr
            "fill": (d, i) => 
              if i == 0 
                minColor
              else 
                '#fdbf6f'

    #transparencey legend
    $('#transLegend h3').html('<p>Sample sizes below 30 chromosomes become increasingly transparent to represent uncertain allele frequencies i.e.</p>').css('font-size', 12)
    trans_legend = d3.select("#transLegend").selectAll("svg")
      .data(trans_data)
      .enter().append("svg")
          .attr("width", radius+50)
          .attr("height", radius+50)
          .append("g")
            .attr("transform", "translate(#{ radius + 10}, #{ radius + 20})")
            .attr('class', 'transSvg')

    trans_legend.selectAll("path")
       .data(pie)
      .enter().append("path")
          .attr("d", d3.svg.arc()
            .innerRadius(0)
            .outerRadius(16))
          .attr
            "fill": (d, i) => 
              if i == 0 
                '#1f78b4'
              else 
                '#fdbf6f'
            "stroke": 'white'
            "stroke-width": '1.5px'
            "class": 'legslice'
            "opacity": (d, i, index) =>
              opacityScale(index*9)

    trans_legend.append('text')
      .text (d, i, index) =>
        i*9
      .attr
        'font-size': '11px'

    #another legend
    $('#testLegend h3').html('<p>More features are on the way...scaled circles as alternates to pie charts, computing a bounding box for regional datasets, pdf export for publication quality figures, and search by rsID or tables of markers. Contact us with any ideas!</p>').css('font-size', 12)
         
  arcTween = (a) =>
    i = d3.interpolate(this._current, a)
    this._current = i(0)
    (t) =>
      arc(i(t))

  # setup node data
  setupNodes = (data) ->
    nodes = []
    data.forEach (d) ->
      coords = projection(d.pos)
      node = {
        x: coords[0]
        y: coords[1]
        radius: radiusScale(d.freq[0])
        id: d['pop']
        lon: coords[0]
        lat: coords[1]
        af: d.freq
        xobs: d.xobs
        nobs: d.nobs
        freqScale: d.freqscale
        coord: d.chrom_pos
        alleles: d.alleles
      }
      nodes.push(node)
    nodes

  # toggle between charged or uncharged points
  freqMap.toggleLayout = (newLayout) ->
    force.stop()
    setLayout(newLayout)
    update()

  # set the layout based on buttons
  setLayout = (newLayout) ->
    layout = newLayout
    if layout == "charged"
      force.on("tick", tickCharged)
        .charge(charge)
    else if layout == "true"
      force.on("tick", tick)
        .charge(0)

  # true position tick
  tick = (e) ->
    k = e.alpha*0.08
    node.each(moveToPoint(e.alpha))
    node.attr("transform", (d) => "translate(#{d.x} , #{d.y})")

  # charged position tick
  tickCharged = (e) ->
    k = e.alpha*0.08
    q = d3.geom.quadtree(currentNodes)
    currentNodes.forEach (n) ->
      q.visit(collide(n))
    node.each(moveToPoint(e.alpha))
    node.attr("transform", (d) => "translate(#{d.x} , #{d.y})")

  # helper for charged tick
  moveToPoint = (alpha) ->
    (d) =>
      d.y += (d.lat - d.y) * alpha
      d.x += (d.lon - d.x) * alpha

  # collision detection 
  collide = (node) ->
    r = node.radius + 16
    nx1 = node.x - r
    nx2 = node.x + r
    ny1 = node.y - r
    ny2 = node.y + r
    (quad, x1, y1, x2, y2) ->
      if quad.point && (quad.point != node)
        x = node.x - quad.point.x
        y = node.y - quad.point.y
        l = Math.sqrt(x * x + y * y)
        r = node.radius + quad.point.radius + 8
        if (l < r)
          l = (l - r) / l * .5
          node.x -= x *= l
          node.y -= y *= l
          quad.point.x += x
          quad.point.y += y
      return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1

  return freqMap

# helper for activating link
activate = (group, link) ->
  d3.selectAll("##{group} a").classed("active", false)
  d3.select("##{group} ##{link}").classed("active", true)

$ -> 
 
  # test dropdown menu (will setup resource in api to return data like this)
  # example 9:691026
  
  test_dd = [{'dataset':'1000genomes_phase3', 'build':'hg19', 'view': 'global'},
             {'dataset':'hgdp', 'build':'hg18', 'view':'europe'}, 
             {'dataset':'popres_euro', 'build':'hg18', 'view': 'europe'}
            ]
  

  
  # create plot
  plot = FreqMap()
  
  # default layout
  activate("layouts", 'true')

  # setup chosen drop down menu
  dropDown = d3.select("#datasets").append("select").attr("id", "dataset").attr('class', 'chosen')
  options = dropDown.selectAll("option").data(test_dd).enter().append("option")
  options.text((d) => "#{d.dataset} (#{d.build})").attr("value", (d) => d.dataset)
  $(".chosen").chosen()

  d3.select('#datasets').append('a').attr('id', 'dataLink').html("<i id='linkIcon' class='fa fa-external-link'></i>")

  # make the defualt plot 
  d3.json 'http://marioni.uchicago.edu/ggv_api/freq_table?data="1000genomes_phase3_table"&random_snp=True', (error, data) =>
    plot('#vis', data)

  # default link 
  $('#dataLink').attr("href", "http://www.1000genomes.org/").attr('target', '_blank')

  # toggle layout 
  d3.selectAll("#layouts a").on "click", (d) ->
    newLayout = d3.select(this).attr("id")
    activate("layouts", newLayout)
    plot.toggleLayout(newLayout)

  # toggle dataset
  $('#dataset').chosen().change () ->
    dataset = $('#dataset').chosen().val()
    if dataset == '1000genomes_phase3'
      $('#dataLink').attr("href", "http://www.1000genomes.org/").attr('target', '_blank')
    else if dataset == 'hgdp'
      $('#dataLink').attr("href", "http://www.ncbi.nlm.nih.gov/pubmed/11954565").attr('target', '_blank')
    else
      $('#dataLink').attr("href", "http://www.ncbi.nlm.nih.gov/pubmed/18760391").attr('target', '_blank')


    url = 'http://marioni.uchicago.edu/ggv_api/freq_table?data="'+dataset+'_table"&random_snp=True'
    plot.updateMapSimple(dataset)
    plot.updateData(url)
    
  # random snp
  d3.select('#random').on "click", () ->
    dataset = $('#dataset').chosen().val()
    url = 'http://marioni.uchicago.edu/ggv_api/freq_table?data="'+dataset+'_table"&random_snp=True'
    plot.updateData(url)

  # search submit
  $('#submit').click () ->
    if $('#search').val() == ''
    else
      dataset = $('#dataset').chosen().val()
      variant = $('#search').val().split(':')
      chrom = variant[0]
      pos = variant[1]
      url = 'http://marioni.uchicago.edu/ggv_api/freq_table?data="'+dataset+'_table"&chr='+chrom+'&pos='+pos
      plot.updateData(url)  
  



