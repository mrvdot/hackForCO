var mapDebug;

require(["esri/map", "esri/geometry/Point", "esri/geometry/Multipoint", "esri/geometry/Polyline","esri/geometry/Polygon","esri/graphic", 
  "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/InfoTemplate", "./utils.js", "dojo/_base/Color", "dojo/on", "dojo/dom", "dojo/domReady!"], 
  function(Map, Point, Multipoint, Polyline, Polygon, Graphic, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, InfoTemplate, utils, Color, on, dom) {
    "use strict"

    // Create map
    var map
      , usng = org.mymanatee.common.usng
      , ndn = new NDN({host: 'localhost'})
      , pts
      , mapCoords = {}
      , mapDiv
      , excludedHashes = []
      , activeShouts
      , shoutTpl = '<div class="shout-box-wrapper">' + 
        '<div class="shout-box">' + 
          '<p class="shout" style="display:none;">$TEXT</p>' + 
        '</div>' + 
        '<i class="icon icon-shout-pin">,</i>' + 
      '</div>';

    jQuery(window).on('resize load', function () {
      if (!mapDiv) {
        mapDiv = jQuery('#myMap');
      };
      mapCoords = mapDiv.position();
    });

    var shoutCount = 0;

    function displayShout (shout, own) {
      var div = jQuery(shoutTpl.replace('$TEXT',shout.text));
      var coords = shout.location;
      var pt = map.toScreen(new Point(coords.longitude, coords.latitude));
      div.css({
        zIndex : 1000 + shoutCount++,
        left : pt.x,
        top : pt.y
      });
      jQuery('.wrap').prepend(div).find('p').slideDown();
      setTimeout(function() {
        if (!activeShouts) {
          activeShouts = jQuery('.shout-box-wrapper');
        } else {
          activeShouts = activeShouts.add(div);
        }
      });
      setTimeout(function() {
        activeShouts = activeShouts.not(div);
        div.fadeOut();
      }, shout.timeout * 1000);
    }

    function usngToPrefix (loc) {
      var locationArray = loc.split(' ');
      var specificNorth = locationArray[2].split('');
      var specificEast = locationArray[3].split('');
      return locationArray[0] + '/' + locationArray[1] + '/' + specificNorth[0] + specificEast[0] + '/' + specificNorth[1] + specificEast[1] + '/' + specificNorth[2] + specificEast[2] + '/' + specificNorth[3] + specificEast[3] + '/';
    }
    var exclusions = []
      , shoutCallback;

    function monitorShouts(zone) {
      var n = 'Nei.ghbor.Net' + zone + 'shoutout';
      var name = new Name(n)
      var interest = new Interest(name)
      var template = {};
      shoutCallback = function (ndn, name, content, moot) {
        if (!ndn) {
          setTimeout(function () {
            monitorShouts(zone);
          }, 250);
          return;
        };
        var shout = DataUtils.toString(content);
        shout = JSON.parse(shout);
        var hash = shout.text + shout.timestamp;
        if (jQuery.inArray(hash, excludedHashes) > -1) {
          return;
        } else {
          excludedHashes.push(hash);
        }
        displayShout(shout);
        exclusions.push(DataUtils.toNumbersFromString(moot));
        var newname = new Name(name);
        var interest = new Interest(newname);
        template.exclude = new Exclude(exclusions);
        interest.exclude = template.exclude
        ndn.expressInterest(newname, shoutClosure, template)
      }
      var shoutClosure = new ContentClosure(ndn, name, interest, shoutCallback)
      ndn.expressInterest(name, shoutClosure, template);
    }

    function shoutOut (shout) {
      var prefixComponents = centerZone.split('/');
      var prefix = 'Nei.ghbor.Net';
      excludedHashes.push(shout.text + shout.timestamp);
      displayShout(shout, true);
      for (var i=0; i<6 ; i++) { 
        prefix = prefix + '/' + prefixComponents[i];
        ndn[i] = new NDN({host: 'localhost'});
        
        var namePrefix = new Name(prefix + '/shoutout')
        var name = new Name(prefix + '/shoutout/' + shout.timestamp)
        var thisndn = ndn[i];
        var signedInfo = new SignedInfo();
        signedInfo.freshnessSeconds = shout.timeout;
        if (NDN.CSTable[i] == undefined) {
          thisndn.registerPrefix(namePrefix, new AsyncPutClosure(thisndn, name, JSON.stringify(shout), signedInfo));
        } else {
          NDN.CSTable[i].closure.content = JSON.stringify(shout);
          NDN.CSTable[i].closure.name = name;
        }
      };
    }

    var currentBounds = {
      top : 0,
      right : 0,
      bottom : 0,
      left : 0
    };

    var topZone = '/'
      , centerZone = '/'
      , centerUSNG
      , centerLoc;

    function calculateZones (extent) {
      currentBounds.left = extent.xmin;
      currentBounds.right = extent.xmax;
      currentBounds.top = extent.ymax;
      currentBounds.bottom = extent.ymin;
      var tl = usngToPrefix(usng.LLtoUSNG(currentBounds.top, currentBounds.left, 4)).split('/');
      var tr = usngToPrefix(usng.LLtoUSNG(currentBounds.top, currentBounds.right, 4)).split('/');
      var bl = usngToPrefix(usng.LLtoUSNG(currentBounds.bottom, currentBounds.left, 4)).split('/');
      var br = usngToPrefix(usng.LLtoUSNG(currentBounds.bottom, currentBounds.right, 4)).split('/');
      var extCenter = extent.getCenter();
      centerLoc = {
        latitude : extCenter.y,
        longitude : extCenter.x
      };
      centerUSNG = usng.LLtoUSNG(extCenter.y, extCenter.x, 4);
      centerZone = usngToPrefix(centerUSNG);
      topZone = '/';
      var idx = 0;
      while(tl[idx] == tr[idx] && tl[idx] == bl[idx] && tl[idx] == br[idx]) {
        topZone += tl[idx] + '/';
        idx++;
      }
      monitorShouts(topZone);
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var coords = centerLoc = position.coords;
        map = mapDebug = new Map("myMap",{ 
          basemap: "streets",
          center: [coords.longitude, coords.latitude],
          zoom: 12
        });
        utils.autoRecenter(map);
        bindEvents(map);
      });
    } else {
      map = new Map("myMap",{ 
        basemap: "streets",
        center: [-79.40, 43.55],
        zoom: 9,
      });
      utils.autoRecenter(map);
      //monitorShouts(coords);
    }

    // Add point graphic
    function addPoint(pt, finished) {
      var attributes = {"Lat":pt.getLatitude().toFixed(2),"Lon":pt.getLongitude().toFixed(2)};
      var infoTemplate = new InfoTemplate("My Point","Latitude: ${Lat} <br/>Longitude: ${Lon}");
      var graphic = new Graphic(pt,pointSymbol,attributes,infoTemplate);
      map.graphics.add(graphic);
    }

    var lastDelta = {x : 0, y : 0};
    function bindEvents (map) {
      on(map, 'extent-change', function (extent, delta, levelChange, detail) {
        calculateZones(map.geographicExtent);
      });
      on(map, 'pan', function (extent) {
        if (!activeShouts) {
          return;
        };
        var d = extent.delta;
        moveShouts(d.x - lastDelta.x, d.y - lastDelta.y);
        lastDelta = d;  
      });//*/
      on(map, 'pan-end', function () {
        lastDelta = {x : 0, y : 0};
        removeLostShouts();
      });
      var zoomStartExtent;
      on(map, 'zoom-start', function (data) {
        zoomStartExtent = data.extent;
        hideShouts();
      });
      on(map, 'zoom-end', function (data) {
        repositionAndShowShouts(zoomStartExtent, data.extent, data.zoomFactor, data.anchor);
      });
    }

    function moveShouts (x, y) {
      activeShouts.css({
        left : '+=' + x + 'px',
        top : '+=' + y + 'px'
      });
    }

    function hideShouts () {
      if (!activeShouts) {
        return;
      };
      activeShouts.css('visibility','hidden');
    }

    function repositionAndShowShouts (start, end, factor, anchor) {
      if (!activeShouts) {
        return;
      };
      var x = anchor.x;
      var y = anchor.y;
      var mw = mapDiv.width();
      var mh = mapDiv.height();
      var shoutsToRemove = jQuery('.shouts.remove');
      activeShouts.each(function (idx, s) {
        s = jQuery(s);
        var spos = s.position();
        var newPos = {
          visibility : 'visible',
          left : spos.left + ((spos.left - x) * (factor - 1)),
          top : spos.top + ((spos.top - y) * (factor - 1))
        }
        if (false && (newPos.left < 0 || newPos.left > mw || newPos.top < 0 || newPos.top > mh)) {
          shoutsToRemove = shoutsToRemove.add(s);
        } else {
          s.css(newPos);
        }
      });
      if (shoutsToRemove.length) {
        //Really should drop out of excludes so we refetch them if we zoom back in
        activeShouts = activeShouts.not(shoutsToRemove);
        shoutsToRemove.remove();
      };
    }

    function removeLostShouts () {
      return;//using overflow for now - reexamine if number of shouts starts to hurt performance
      var mw = mapDiv.width();
      var mh = mapDiv.height();
      var shoutsToRemove = jQuery('.shouts.remove');
      activeShouts.each(function (idx, s) {
        s = jQuery(s);
        var spos = s.position();
        if (spos.left < 0 || spos.left > mw || spos.top < 0 || spos.top > mh) {
          shoutsToRemove = shoutsToRemove.add(s);
        }
      });
      if (shoutsToRemove.length) {
        activeShouts = activeShouts.not(shoutsToRemove);
        shoutsToRemove.remove();
      };
    }

    var firstMess = "Just De-boarded for Comic-Con!!! What's the best way into town?";
    var demoRun = false;

    var sendShout = function (ev) {
      if (true) {
        if (activeShouts) {
          activeShouts.remove();
        };
        iterate(0);
        demoRun = true;
      } else {
        var text = $shoutInput.val();
        if (!text) {
          return;
        };
        setTimeout(function() {
          $shoutInput.val('');
        });
        var shout = {
          text : text,
          timeout : 60,
          location : centerLoc,
          timestamp : new Date().getTime()
        };
        shoutOut(shout);
      }
    };
    
    var $shoutInput = jQuery('#shout').blur(sendShout);
    var $shoutButton = jQuery('.shoutBox i').click(sendShout);
    var demodata = [
      {
        shout : {
          text : firstMess,
          timeout : 11,
          location : {
            latitude : 39.849139 ,
            longitude : -104.677734
          }
        },
        delay : 4,
        zoom : 12
      },
      {
        shout : {
          text : "You Can take a taxi for about $70...",
          timeout : 11,
          location : {
            latitude : 39.757880 ,
            longitude : -104.975739
          }
        },
        delay : 4
      },
      {
        shout : {
          text : "Dude for that price GO UBER!!! :)",
          timeout : 11,
          location : {
            latitude : 39.727257,
            longitude : -104.911880
          }
        },
        delay : 4
      },
      {
        shout : {
          text : "The Shuttle's only $30",
          timeout : 11,
          location : {
            latitude : 39.761047 ,
            longitude : -104.922180
          }
        },
        delay : 4
      },
      {
        shout : {
          text : "Buy me a drink and I'll pick you up in my Batmobile!",
          timeout : 11,
          location : {
            latitude : 39.749962 ,
            longitude : -104.942093
          }
        },
        delay : 7
      },
      { //[5]
        shout : {
          text : "Deal! I'm at gate B Delta as the Incredible Hulk",
          timeout : 11,
          location : {
            latitude : 39.849139 ,
            longitude : -104.677734
          }
        },
        delay : 12
      },
      {
        shout : {
          text : "Wil Wheaton Just Borrowed my HAT!!! :D",
          timeout : 10,
          location : {
            latitude : 39.746266 ,
            longitude : -104.995480
          }
        },
        delay : 4,
        zoom : 16
      },
      {
        shout : {
          text : "best costumes of comic-con! http://www.flickr.com/photos/70832171@N07/8920666196/",
          timeout : 10,
          location : {
            latitude : 39.742438 ,
            longitude : -104.995136
          }
        },
        delay : 4
      },
      {
        shout : {
          text : "I wonder what the ratio of heroes to villains here is",
          timeout : 10,
          location : {
            latitude : 39.743890 ,
            longitude : -104.998569
          }
        },
        delay : 4
      },
      {
        shout : {
          text : "Only one way to tell: FIGHT FOR WORLD DOMINATION",
          timeout : 10,
          location : {
            latitude : 39.741250 ,
            longitude : -104.998055
          }
        },
        delay : 4
      },
      {
        shout : {
          text : "Arcade tournament for WORLD DOMINATION! But where?!",
          timeout : 10,
          location : {
            latitude : 39.741847 ,
            longitude : -104.996467
          }
        },
        delay : 4
      },
      {
        shout : {
          text : "2UP!!",
          timeout : 10,
          location : {
            latitude : 39.742702 ,
            longitude : -104.996767
          }
        },
        delay : 7
      },
      {
        shout : {
          text : "The Incredible Hulk SMASHES at skeeball! @.@",
          timeout : 10,
          location : {
            latitude : 39.740062 ,
            longitude : -104.979558
          }
        },
        delay : 7
      },
      {
        shout : {
          text : "Last minute suite opening at the Warwick... Discount varies based on awesomeness of costume!",
          timeout : 7,
          location : {
            latitude : 39.744319 ,
            longitude : -104.981833
          }
        },
        delay : 7,
        zoom : 15
      },
      {
        shout : {
          text : "URGENT! lost leather wallet w/ avengers sticker :( staff keep an eye out?",
          timeout : 6,
          location : {
            latitude : 39.740062 ,
            longitude : -104.979558
          }
        },
        delay : 6
      },
      {
        shout : {
          text : "Don't worry, we got it. Come by tomorrow to pick it up :)",
          timeout : 19,
          location : {
            latitude : 39.740062 ,
            longitude : -104.979558
          }
        },
        delay : 20
      },
      {
        shout : {
          text : "Best. Vacation. Ever. See you next time Denver!",
          timeout : 15,
          location : {
            latitude : 39.849139 ,
            longitude : -104.677734
          }
        },
        delay : 15,
        zoom : 15
      },
      {
        shout : {
          text : "Peace out #Hack4Colorado",
          timeout : 120,
          location : {
            latitude: 39.7334572,
            longitude: -104.9925055
          }
        },
        zoom : 15
      }
    ]
      

    var iterate = function (index){
      var shout = demodata[index].shout;
      shout.timestamp = new Date().getTime();
      centerIfNeeded(shout, demodata[index].zoom, function() {
        shoutOut(shout);
        if (demodata[index].delay) {
          setTimeout(function(){
            iterate(index + 1);
          }, demodata[index].delay*1000);
        };
      });
    }

    var lastZoom = 12;
    var centerIfNeeded = function (shout, zoom, cb) {
      var coords = shout.location;
      if ((zoom && zoom != lastZoom) || (coords.longitude < currentBounds.left
             || coords.longitude > currentBounds.right
             || coords.latitude < currentBounds.top
             || coords.latitude > currentBounds.bottom)) {
        lastZoom = zoom;
        map.centerAndZoom(new Point(coords.longitude, coords.latitude), zoom).then(cb);
        //cb();
      } else {
        cb();
      }
    }
    /*setTimeout(function(){
      iterate(0);
    }, 20000 );//*/
  }
);
