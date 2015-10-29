jQuery = $;

// from http://travismccauley.info/shalu/shalu.js

// Local Data Lists
var shaluData = {}
shaluData.events = { // stores arrays
   all: [],
   filtered: {},
   fids:[],
}; 
shaluData.exchanges = { // stores objects
   all: {},
   filtered: {},
   byEvent: {},
   rendered: {},
};
shaluData.monasteries = {
   byFid:{},
   markers:[],
   show: true,
}
shaluData.map = {}
shaluData.markers = []
shaluData.clusterer = {}
spiderfier = {}
shaluData.icon = {
   url: 'images/Marker-25.png'
   /* path: google.maps.SymbolPath.CIRCLE,
   scale: 10,
   fillColor: "F47269",
   fillOpacity: 1,
   strokeColor: "853430",
   strokeWeight: 2 */
}
shaluData.animation = {}


// Readiness
var isReadyEvents = false;

// Constants
var BIO_PRIMARY = "à½–à¾³à½¼à¼‹à½‚à½¦à½£à¼‹à½–à½¦à¾Ÿà½“à¼‹à½¦à¾à¾±à½¼à½„à¼‹à¼";

function openTmInfoWindow(item, exchangeDb) {
   var output =  "<h2>" + item.region + " " + item.placename + " " + item.placedetail + " " + item.year + "</h2>";
   output += item.arrival ? "<div>Arrival: " + item.arrival + "</div>" : '';
   output += item.departure ? "<div>Departure: " + item.departure + "</div>" : '';
   if (item.host) { 
      output += item.host ? "<div>Host: " + item.host + "</div>" : '';
      output += item.hostaffiliation ? "<div>Host Affiliation: " + item.hostaffiliation + "</div>" : '';
      output += item.tbrc ? "<div>Tbrc Person Id: " + item.tbrc + "</div>" : '';
   }
   output += item.folio ? "<div>Folio in Biography: " + item.folio + "</div>" : '';
   output += item.tibetanyear ? "<div>Tibetan Year: " + item.tibetanyear + "</div>" : '';
   output += item.eventid ? "<div>event id: " + item.eventid + "</div>" : ''; 

   /* output += item.fid ? "<div><a href='http://places.thlib.org/features/" + item.fid + "' target='_blank'>THL Place Dictionary</a></div>" : '';
   output += item.placename ? "<div>Place Name: " + item.placename + "</div>" : '';
   output += item.region ? "<div>Region: " + item.region + "</div>" : '';
   output += item.placedetail ? "<div>Place Detail: " + item.placedetail + "</div>" : '';
   output += item.fid ? "<div>THL Place Id: " + item.fid + "</div>" : '';
   output += item.lat ? "<div>Lat/Long: " + item.lat + " / " + item.lon + "</div>" : ''; */
   
   var exchanges = shaluData.exchanges.byEvent[item.eventid];
   var exchg_count = 0, exchange_output = '';
   var hasDummyExch = (exchanges.length == 1 && exchanges[0].type == 'None');
   if (exchanges && ! hasDummyExch) { 
      
      for ( i=0; i< exchanges.length; i++ ) {
         var exchg_item = exchanges[i]
         /* var eventId = exchg_item.eventid.pop()
         if ( eventId != item.eventid ) {
         continue;
         } */
         exchg_count += 1;
         renderedExchange = shaluData.exchanges.rendered[exchg_item.label]//renderShaluExchangeDbItem(exchg_item, false);
         exchange_output += "<li>" + renderedExchange.html() + "</li>";
      }
      // if ( exchg_count > 0 ) {
      output += "<h2 class='exchange-count'>Exchanges (" + exchg_count + ")</h2>";
      output += "<ol>" + exchange_output + "</ol>";
      // }
   } else {
      output += "<h2 class='exchange-count'>Exchanges (" + exchg_count + ")</h2>";
   }
   var wHeight = jQuery(window).height();
   var wWidth = jQuery(window).width();
   jQuery('<div id="shalu-event-dialog"/>').html(output).dialog({
         width: wWidth * .91,
         height: wHeight * .91,
         modal: true
   });
   
   // load place data from thl API
   // http://places.thlib.org/features/by_fid/200.json
   // http://localhost/places/features/637/descriptions.json?callback=f
   if ( item.fid ) {
      locationDetailElement = fetchLocationDetail( item.fid );
   }
}

/** 
* begin the init chain here
* Init sequence Map -> Events -> Exhibit -> Markers -> Monasteries
**/
function initShaluEvents( data ) {
   for ( var idx in data.feed.entry ) {
      var item = data.feed.entry[idx];
      var event = createUsefulObject(item);
      shaluData.events.all[event.eventid] = event;
      shaluData.events.filtered[event.eventid] = event; // at start, all and filtered are the same
      shaluData.events.fids.push(event.fid);
   }
   initShaluExhibit()
}

/**
*     initShaluExhibit() performs the config and init for this exhibit / google map implementation 
*     The "initShaluExhibit" function name is passed as a url query string param to the request for the exhibit API
*      in index.html like this: <script src="http://trunk.simile-widgets.org/exhibit/api/exhibit-api.js?callback=initShaluExhibit...
**/
function initShaluExhibit() {
   SimileAjax.jQuery(document).ready( function() { 
         
         // RECIPE FROM http://www.unifr.ch/dokpe/paperj/exhibit.html?fp_pub=Elsevier
         var exhibitDataSuccess = function() {
            window.exhibit = Exhibit.create();
            window.exhibit.configureFromDOM();
            addItemsChangedListener();
         }; 
    		window.database = Exhibit.Database.create();
    		window.database.loadDataLinks(exhibitDataSuccess);
    		
    		// recursively wait for exhibit to load then continue to init the map markers
    		var waitForExhibit = function(){
    		   setTimeout( function(){
    		         if ( ! window.exhibit ) { 
    		            return waitForExhibit() 
    		         }
    		         else {
    		            // prep search box
    		            var search = jQuery('#search input');
    		            search.val('à½ à½šà½¼à½£à¼').css('color','silver').bind( 'click.search', function(event){
    		                  jQuery(this).css('color','gray').val('').unbind('click.search');
    		            });
    		            // init exchange data
    		            var exchanges = getFilteredExchanges();
    		            
    		            for ( var id in exchanges ) {
    		               var exchange = database.getItem(id)
    		               shaluData.exchanges.all[id]= exchange;  
    		               shaluData.exchanges.byEvent[exchange.eventid] = shaluData.exchanges.byEvent[exchange.eventid] ? shaluData.exchanges.byEvent[exchange.eventid] : [];
    		               shaluData.exchanges.byEvent[exchange.eventid].push(exchange);  
    		            }
    		            shaluData.exchanges.filtered = shaluData.exchanges.all
    		            // init map
    		            initShaluMapMarkers()
    		         }
    		   }, 250 );
    		}
    		waitForExhibit();
	});
}

/**
*    initialize the map
**/
function initShaluMap() {
   //var map;
   function initialize() {
      var myOptions = {
         zoom: 7,
         scaleControl: true,
         center: new google.maps.LatLng(29.116667,	88.983333),
         mapTypeId: google.maps.MapTypeId.TERRAIN
      };
      shaluData.map = new google.maps.Map(document.getElementById('map_canvas'),  myOptions);
   }
   google.maps.event.addDomListener(window, 'load', initialize);
}

function initShaluMapMarkers() {
   spiderfy()    // overlapping marker spiderfier
   addMapMarkers();
   addMonasteryLayer();
   initAnimation();
}

function addItemsChangedListener() {
   collection=exhibit._uiContext.getCollection()
   expression=Exhibit.ExpressionParser.parse('add( .unchanged )');
   expression.evaluate({value:collection.getRestrictedItems()},{value:'item'},'value',exhibit._database).values.toArray()
   collection.addListener( { onItemsChanged:function() {
         var itemIds = collection.getRestrictedItems().toArray();
         shaluData.events.filtered={}; // clear last result set
         shaluData.exchanges.filtered={}; // clear last result set
         for (var i = 0; i < itemIds.length; i++) {
            item = database.getItem(itemIds[i]);
            var event = shaluData.events.all[item.eventid]
            shaluData.events.filtered[item.eventid] = event;
            shaluData.exchanges.filtered[itemIds[i]] = item;
         }
         clearMapMarkers();   
         addMapMarkers();
   }})
}

function getFilteredExchanges() {
   var collection=exhibit._uiContext.getCollection()
   var filteredItems = collection.getRestrictedItems();
   return filteredItems._hash;
}

function clearMapMarkers() {
   for (i=0; i<shaluData.markers.length; i++) {
      var marker = shaluData.markers[i].setMap(null);  
   }
   shaluData.cluster.clearMarkers();
   // @TODO Clear the spiderizer
   
}
function addMapMarkers() {
   // Add markers
   shaluData.markers = [];
   for (var id in shaluData.events.filtered) {
      var event = shaluData.events.filtered[id];
      if ( event && event.lat) {
         var latLng = new google.maps.LatLng(event.lat,event.lon);
         var marker = new google.maps.Marker({
               position: latLng,
               map: shaluData.map,
               title: event.region + ' - ' + event.year ,
               eventId: id,
               icon:shaluData.icon,
         });
         shaluData.markers.push(marker);
         marker.shaluClickHandler = function(){
            //   openTmInfoWindow( event );
         };
         
         shaluData.spiderfier.addMarker(marker);
      }
   }
   clusterize();
}

function clusterize() {
         var styles = [{
        url: 'images/Marker-35.png',
        height: 35,
        width: 35,
        opt_anchor: [16, 0],
        opt_textColor: '#FF00FF'
      },
      {
        url: 'images/Marker-50.png',
        height: 50,
        width: 50,
        opt_anchor: [24, 0],
        opt_textColor: '#FF0000'
            },]
   shaluData.cluster = new MarkerClusterer(shaluData.map, shaluData.markers, {
         averageCenter: true,
         maxZoom: 9,
         gridSize: 20,
         styles:styles,
   });
}

function spiderfy() {
   var gm = google.maps;
   var iw = new gm.InfoWindow();
   shaluData.spiderfier = new OverlappingMarkerSpiderfier(shaluData.map,
      {markersWontMove: true, markersWontHide: true});
   
   shaluData.spiderfier.addListener('click', function(marker) {
         var event = shaluData.events.filtered[marker.eventId]
         openTmInfoWindow(event)
   });
   
   shaluData.spiderfier.addListener('spiderfy', function(markers) {
         var icon = jQuery.extend(true, {}, shaluData.icon);
         // for the vector version icon.scale = 7
         icon.url = 'images/Marker-25.png';
         for(var i = 0; i < markers.length; i ++) {
            markers[i].setIcon(icon);
         } 
         iw.close();
   });
   
   shaluData.spiderfier.addListener('unspiderfy', function(markers) {
         for(var i = 0; i < markers.length; i ++) {
            markers[i].setIcon(shaluData.icon);
         }
   });
}

function addMonasteryLayer() {
   jQuery.ajax({
         url:'tar-monasteries.js',
         dataType: 'json',
         success: function(data) {
            for ( i=0; i<data.length; i++ ) {
               var monastery = data[i];
               if (monastery.lat && shaluData.events.fids.indexOf(monastery.fid) == -1) {
                  var latLng = new google.maps.LatLng(monastery.lat,monastery.lon);
                  var marker = new google.maps.Marker({
                        position: latLng,
                        map: shaluData.map,
                        title: monastery.tibscript ,
                        fid:monastery.fid,
                        icon: {
                           url: 'images/green-circle.png',
                           /* path: google.maps.SymbolPath.CIRCLE,
                           scale: 4,
                           fillColor: "C9F76F",
                           fillOpacity: 0.8,
                           strokeColor: "679B00",
                           strokeWeight: 2 */
                        },
                  });
                 marker.setZIndex(-9999);
                  shaluData.monasteries.byFid[monastery.fid] = monastery;
                  shaluData.monasteries.markers.push(marker);
                  // Info Window for monasteries
                  var infoString = '<div class="thl-place">'+
                  '<h2 id="firstHeading" class="firstHeading">' + monastery.tibscript + '</h2>'+
                  '<div id="bodyContent">'+
                  '<a href="http://www.thlib.org/places/monasteries/list/tar/#iframe=http://places.thlib.org/features/'+monastery.fid+'">thlib.org/places/monasteries</a>'+
                  '</div>'+
                  '</div>';
                  marker.infowindow = new google.maps.InfoWindow({
                        content: infoString
                  });
                  google.maps.event.addListener(marker, 'click', function() {
                        if ( shaluData.monasteries.activeWindow ) {
                           shaluData.monasteries.activeWindow.close();
                        }
                        this.infowindow.open(this.map, this);
                        shaluData.monasteries.activeWindow = this.infowindow
                  });
               }
            }
            addLayerPicker()
         }
   });
}

function addLayerPicker() {
   jQuery("#map_canvas").append(jQuery('<div id="layer-picker"/>'));
   jQuery("#layer-picker").append(jQuery('<input type="checkbox" checked="checked"/>').click( function() { 
         var mapValue = shaluData.monasteries.show ? null : shaluData.map;
         for (i=0; i<shaluData.monasteries.markers.length; i++) {
            shaluData.monasteries.markers[i].setMap( mapValue );
         }
         shaluData.monasteries.show = ! shaluData.monasteries.show;
   }));
   jQuery("#layer-picker").append(jQuery('<span/>').text('Monasteries')); 
}

// filter function for exhibit results
function isInExhibitResults(item) { 
   return empty(shaluData.events.filtered) || empty(shaluData.events.filtered[item.opts.EventId]);
};


function renderShaluExchange(element){
   var itemId = element.getAttribute("ex:itemid");
   element.id = itemId;
   var totalSet = exhibit.getDefaultCollection();
   var item = totalSet['_database']['_spo'][itemId];
   var label, givenBy, givenTo, transmission, affiliation, type, eventId, lug, property, prop, tbrcPersonId;
   label = item['label'][0];
   type = item['type'][0];
   eventId = item['eventid'][0];
   givenBy = item['givenby'] ? item['givenby'][0] : null;
   givenTo = item['givento'] ? item['givento'][0] : null;
   transmission = item['transmission'] ? item['transmission'][0] : null;
   affiliation = item['affiliation'] ? item['affiliation'][0] : null;
   tbrcPersonId = item['tbrcPersonId'] ? item['tbrcPersonId'][0] : null;
   
   exchange = jQuery('<div class="exchange ' + type + ' "/>'); //the container
   property = jQuery('<div/>').append('<span/><label> (<span/>) </label>'); // a template for properties
   // label
   prop=property.clone();
   prop.children('span').addClass('label').html(label);
   prop.find('label span').html(type.toLowerCase())
   prop.css('color', type=='Teaching' ? 'orange' : 'green');
   exchange.append(prop)
   // affiliation
   if (affiliation) {
      prop=property.clone();
      prop.children('span').addClass('dummy').html(affiliation);
      prop.find('label span').html('affiliation');
      exchange.append(prop)
   }
   // transmission
   if (transmission) {
      prop=property.clone();
      prop.children('span').addClass('dummy').html(transmission);
      prop.find('label span').html('transmission');
      exchange.append(prop)
   }
   // givenby
   if (givenBy && !isBioPrimary(givenBy)) {
      var gbLabel = type == 'Teaching' ? 'teacher' : 'donor';
      gbLabel += givenBy == 'Unknown' ? ' unknown' : '';
      givenBy = givenBy == 'Unknown' ? '' : givenBy;
      
      prop=property.clone();
      prop.children('span').addClass('dummy').html(givenBy);
      prop.find('label span').html( gbLabel );
      exchange.append(prop)
   }
   // givento
   if (givenTo  &&  !isBioPrimary(givenTo)) {
      var gtLabel = givenTo == 'Unknown' ? 'recipient unknown' : 'recipient';
      givenTo = givenTo == 'Unknown' ? '' : givenTo;
      
      prop=property.clone();
      prop.children('span').addClass('dummy').html(givenTo);
      prop.find('label span').html( gtLabel );
      exchange.append(prop)
   }
   // tbrcPersonInfo
   if (tbrcPersonId) {
      var pattern = /^P\d+/i;
      var tbrcId = tbrcPersonId.match(pattern);
      tbrcId = tbrcId ? tbrcId.pop() : '';
      var tbrcPersonInfo = tbrcPersonId.substr(tbrcId.length, tbrcPersonId.length)
      
      prop=property.clone();
      prop.children('span').addClass('dummy').html(tbrcPersonInfo);
      prop.find('label span').html( 'tbrc.org' );
      exchange.append(prop)
      var wHeight = jQuery(window).height();
      var wWidth = jQuery(window).width();
      if (tbrcId) {
         prop.find('label span').html( jQuery('<a/>').html('tbrc.org').attr('href','http://tbrc.org/#library_person_Object-' + tbrcId).attr('target', '_blank'))
         exchange.append(prop)
      }
   }
   shaluData.exchanges.rendered[label] = exchange
   jQuery(element).append(exchange);
}


function isBioPrimary(name) {
   return name == 'à½–à¾³à½¼à¼‹à½‚à½¦à½£à¼‹à½–à½¦à¾Ÿà½“à¼‹à½¦à¾à¾±à½¼à½„à¼‹à¼';
}

function fetchLocationDetail(placeId) {
   var placeService = 'http://places.thlib.org/features/by_fid/%placeId.json';
   var descriptionService = 'http://places.thlib.org/features/%placeId/descriptions.json';
   var placeRemoteLink = 'http://places.thlib.org/features/%placeId';
   jQuery.ajax({
         url: placeService.replace('%placeId', placeId),
         dataType: 'jsonp',
         success: function(data) {
            place=data.features.feature
            // wrappers
            var divWrapper = jQuery('<div id="thl-location-detail"/>');
            var h2Wrapper = jQuery("<h2/>");
            var labelWrapper = jQuery("<p class='label'></p>: ");
            
            // Add the main thl place container
            jQuery("#shalu-event-dialog").append(divWrapper);
            divWrapper.append( jQuery('<h2/>').text('THL Place Dictionary Info'));
            
            // place names
            nameLabel = jQuery(labelWrapper).clone().text('Place Name(s)');
            divWrapper.append(nameLabel);
            var names = [];
            for ( var key in place.name ) {
               var name = place.name[key];
               if ( names.indexOf(name) != -1 ) { continue; } // avoid dupes
               names.push(name);
            }           
            divWrapper.append( jQuery('<p/>').text( names.join(', ') ) )
            
            // place feature types
            if ( place.feature_type )  {
               ftypes = [];
               featureTypes = is_array(place.feature_type) ? place.feature_type : [place.feature_type];
               for ( var key in featureTypes ) {
                  var title = featureTypes[key].title;
                  ftypes.push(title);
               }
               ftypeLabel = jQuery(labelWrapper).clone().text('Feature Type(s)');
               divWrapper.append(ftypeLabel).after(jQuery('<br/>') );
               divWrapper.append( jQuery('<p/>').text( ftypes.join(', ') ) )
            }
            
            // place subject headings
            if ( place.category_feature ) {
               var pageCats = [];
               var placeCats = is_array(place.category_feature) ? place.category_feature : [place.category_feature];
               for (var key in placeCats) {
                  var cat = placeCats[key];
                  var kmapPath = 'characteristic/%kmap_id/detail';
                  pageCats.push([cat.root.title, cat.parent.title, cat.category.title].join(' > '));
               }
               subjectLabel = jQuery(labelWrapper).clone().text('Subject(s)');
               divWrapper.append(subjectLabel);
               for (var key in pageCats) {
                  divWrapper.append( jQuery('<p/>').text( pageCats[key] ) )
               }
            }
            
            // external resources header
            divWrapper.append( jQuery('<h2/>').text('THL Dictionary Resources'));
            
            // map link
            var mapLink = jQuery('<a/>').attr({
                  href: place.interactive_map_url ,
            target: '_blank'});
            mapLink.text( 'See interactive map of ' + place.header);
            divWrapper.append( jQuery('<p/>').html(mapLink) );
            
            // remote link
            var dictLink = jQuery('<a/>').attr({
                  href: placeRemoteLink.replace('%placeId',placeId) ,
            target: '_blank'});
            dictLink.text( 'See @place in the THL Place Dictionary'.replace('@place',place.header));
            divWrapper.append( jQuery('<p/>').html(dictLink) );
            
            // place essays
            if ( place.desc ) {
               fetchLocationEssays(placeId);
            }
            
            
         }// END ajax call to place dict by_fid success function
         
   }); // END ajax call to place dict by_fid service
}

function fetchLocationEssays(placeId) {
   var descriptionService = 'http://places.thlib.org/features/%placeId/descriptions.json';
   
   jQuery.ajax({
         url: descriptionService.replace('%placeId', placeId),
         dataType: 'jsonp',
         success: function(data) {
            var essays = jQuery('#essays');
            essays.append( jQuery('<h2/>').text('THL Place Essays'));
            var descWrapper = jQuery("<div class='pd-description'><div>");
            descriptions =  is_array(data.descriptions.description) ? data.descriptions.description : [data.descriptions.description];
            for ( var key in descriptions  ) {
               var description = descriptions[key];
               descTitle = description.title ? description.title : 'Description of @place'.replace('@place', place.header);
               essays.append( jQuery('<h2/>').text(descTitle) )
               essays.append( jQuery('<p/>').text(description.content) )
            }
         }                                                                                                                                              
   });
}

/**
* UTILITIES
**/
function is_array(input){
   return typeof(input)=='object'&&(input instanceof Array);
}
function isNumber(n) {
   return !isNaN(parseFloat(n)) && isFinite(n);
}

function empty(mixed_var) {
   var key;
   if (mixed_var === "" ||
      mixed_var === 0 ||
   mixed_var === "0" ||
   mixed_var === null ||
   mixed_var === false ||
   typeof mixed_var === 'undefined') {
   return true;
   }
   if (typeof mixed_var == 'object') {
      for (key in mixed_var) {
         return false;
      }        
      return true;
   }
   return false;
}


/**
* Craft a simple object from the weird google spreadsheets one.
**/
function createUsefulObject(obj) {
   newObj = {}
   for ( var key in obj ) {
      keyArr = key.split('$')
      if ( keyArr.length == 2 && keyArr[1].charAt(0) != "_") {
         newObj[keyArr[1]] = $.trim(obj[key]['$t'])
      }
   }
   return newObj
}

function initAnimation() {
   shaluData.animation.yearLinks = jQuery("#year a");
   jQuery("#start-animation").css('display','inline');
   jQuery("#start-animation").click( function(event) {
         jQuery(this).css('display','none');
         jQuery("#stop-animation").css('display','inline');
         shaluData.animation.isActive = true;
         console.log('shaluData.animation.yearLinks.length', shaluData.animation.yearLinks.length)
         
         // recursively iterate over years to animate the map
    		var animate = function(){
    		   setTimeout( function(){
    		         if ( shaluData.animation.isActive ) { 
    		            if ( ! shaluData.animation.activeYearIndex || shaluData.animation.yearLinks.length == shaluData.animation.activeYearIndex ) {
    		               shaluData.animation.activeYearIndex = 0;
    		            }
    		            var idx = shaluData.animation.activeYearIndex
    		            var activeYearLink = shaluData.animation.yearLinks[idx];
    		            console.log('idx', idx)
    		            
    		            //click the year
    		            console.log('jQuery(activeYearLink).parents(\'div.exhibit-facet-value\')', jQuery(activeYearLink).parents('div.exhibit-facet-value'))
    		            jQuery(activeYearLink).parents('div.exhibit-facet-value').trigger('click');
    		            // click the checkbox
    		           /*  console.log('jQuery(activeYearLink).siblings(\'div.exhibit-facet-value-checkbox\')', jQuery(activeYearLink).siblings('div.exhibit-facet-value-checkbox'))
    		            jQuery(activeYearLink).siblings('div.exhibit-facet-value-checkbox').trigger('click'); */
    		            // display the year
    		            jQuery('#year-display').html(jQuery(activeYearLink).html());
    		            shaluData.animation.activeYearIndex += 1;
    		            return animate() 
    		         }
    		         else {
    		            return;
    		         }
    		   }, 2000 );
    		}
    		animate();
         event.preventDefault();
   });
   jQuery("#stop-animation").click( function(event) {
         shaluData.animation.isActive = false;
         jQuery(this).css('display','none');
         jQuery("#start-animation").css('display','inline');
         event.preventDefault();
   });
}

