/*
 *
 * FeatureInfoDisplay.js -- part of Quantum GIS Web Client
 *
 * Copyright (2010-2012), The QGIS Project All rights reserved.
 * Quantum GIS Web Client is released under a BSD license. Please see
 * https://github.com/qgis/qgis-web-client/blob/master/README
 * for the full text of the license and the list of contributors.
 *
*/

/* FeatureInfos are presented to the user in two ways using OpenLayers.Popup classes:
 * If the mouse stops and GetFeatureInfo has results for this mouse position
 * a small box presents the contents of the info field (GetProjectSettings) or the
 * field named "toolbox" (GetCapabilities), this is called hoverPopup throughout this script.
 * If the user clicks in the map the contents of all visible fields (and if activated the wkt geometry)
 * is presented in a popup called clickPopup throughout this script.
 * hoverPopups are disabled when a clickPopup is open, however clicking at another position in the map
 * closes the currently opened clickPopup and opens a new one (if there is GetFeatureInfo response).
 * If the cursor is at a position where there is GetFeatureInfo response it indicates the possibility
 * to click by changing to "hand".
*/

var featureInfoPopupContents;
var closePopupClick = false; // stores if the click results from closing a clickPopup

function showFeatureInfo(evt) {
    removeClickPopup();
    if (identifyToolActive) {
        if (!closePopupClick) {
            var map = geoExtMap.map; // gets OL map object
            if (window.DOMParser) {
                var parser = new DOMParser();
                xmlDoc = parser.parseFromString(evt.text, "text/xml");
            } else {
                xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
                xmlDoc.async = "false";
                xmlDoc.loadXML(evt.text);
            }

            //start locationservices
            var text = "";
            var locationText = "";
            var locationUnits = map.getLonLatFromPixel(evt.xy);
            var locationObj = new QGIS.LocationService({location: locationUnits});
            var popupItems = [];

            if (projectData.locationServices != null) {

                text = "</br>";
                locationText = "<h2>" + TR.fiLocation + "</h2>";
                //locationText += '<table><tbody>';

                popupItems.push(
                    {
                        xtype: 'box',
                            html: locationText
                        }, {
                        id: "fi_location",
                            //margins: '5 5 5 5',
                            xtype: 'box',
                            html: '<tr><td>' + locationObj.locationToString() + '</td></tr>'
                    });

                for (var l = 0; l < projectData.locationServices.length; l++) {
                    locationObj.getService({
                        name: projectData.locationServices[l].name,
                        key: projectData.locationServices[l].key,
                        provider: projectData.locationServices[l].provider
                    });

                    popupItems.push({
                            id: "fi_"+projectData.locationServices[l].name,
                            //margins: '5 5 5 5',
                            xtype: 'box',
                            html: '</br>'
                    });
                }
            }

            locationObj.on("elevation", updateElevation);
            locationObj.on("address", updateAddress);

            // open AttributeTree panel
            featureInfoResultLayers = [];
            highLightGeometry = [];
            parseFIResult(xmlDoc);
            featureInfoResultLayers.reverse();
            highLightGeometry.reverse();
            if (featureInfoResultLayers.length > 0 || text > '') {
                if (hoverPopup) {removeHoverPopup();}
                if (clickPopup) {removeClickPopup();}

                if (identificationMode == 'topMostHit') {
                    text += featureInfoResultLayers[0];
                    featureInfoHighlightLayer.addFeatures(highLightGeometry[0]);
                    //feature.geometry.getBounds().getCenterLonLat()
                } else {
                    for (var i = 0; i < featureInfoResultLayers.length; i++) {
                        text += featureInfoResultLayers[i];
                        featureInfoHighlightLayer.addFeatures(highLightGeometry[i]);
                    }
                }

                popupItems.push({
                    id: "fi_qgis",
                    xtype: 'box',
                    //margins: '3 0 3 3',
                    html: text
                });

				//new way GeoExt Popup
				clickPopup = new GeoExt.Popup({
                    title: clickPopupTitleString[lang],
					location: locationUnits,
					map: map,
					autoScroll: true,
                    bodyStyle:'padding:5px',
                    //layout: 'accordion',
                    items: popupItems,
					maximizable: true,
					collapsible: true,
                    listeners: {
                        beforeshow: function() {

                            var maxHeight = geoExtMap.getHeight() * 0.8;
                            var minWidth = 200;

                            if ((geoExtMap.getWidth() * 0.2) > minWidth) {
                                this.setWidth(geoExtMap.getWidth() * 0.2);
                            } else {
                                this.setWidth(minWidth);
                            }

                            if (this.getHeight()> maxHeight) {
                                this.setHeight(maxHeight);
                            }
                       }
                    }
				});
				clickPopup.show();

				//old way with OpenLayers.Popup
				// clickPopup = new OpenLayers.Popup.FramedCloud(
                    // null, // id
                    // map.getLonLatFromPixel(evt.xy), // lonlat
                    // null, //new OpenLayers.Size(1,1), // contentSize
                    // text, //contentHTML
                    // null, // anchor
                    // true,  // closeBox
                    // onClickPopupClosed // closeBoxCallBackFunction
                    // );
                // // For the displacement problem
                // clickPopup.panMapIfOutOfView = Ext.isGecko;
                // clickPopup.autoSize = true;
                // clickPopup.events.fallThrough = false;
                // map.addPopup(clickPopup); //*/
                changeCursorInMap("default");
            }
        } else {
            closePopupClick = false;
        }
        activateGetFeatureInfo(true);
    }
}

function showFeatureInfoHover(evt) {
    var map = geoExtMap.map; // gets OL map object
    if (identifyToolActive) {
        if (hoverPopup) {removeHoverPopup();}
        if (window.DOMParser) {
            var parser = new DOMParser();
            xmlDoc = parser.parseFromString(evt.text, "text/xml");
        } else {
            xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            xmlDoc.loadXML(evt.text);
        }
        var layerNodes = xmlDoc.getElementsByTagName("Layer");
        var text = '';
        var result = false;
        //test if we need to show the feature info layer title
        //either from global setting or from project setting
        var showFILayerTitle = showFeatureInfoLayerTitle;
        if (mapThemeSwitcher) {
            if (mapThemeSwitcher.activeProjectData != undefined) {
                showFILayerTitle = mapThemeSwitcher.activeProjectData.showFeatureInfoLayerTitle;
            }
        }

        for (var i = layerNodes.length - 1; i > -1; --i) {
            //case vector layers
            var featureNodes = layerNodes[i].getElementsByTagName("Feature");
            // show layer display field or if missing, the attribute 'tooltip'
            var tooltipAttributeName = wmsLoader.layerProperties[layerNodes[i].getAttribute("name")].displayField || "tooltip";
            for (var j = 0; j < featureNodes.length; ++j) {
                if (j == 0) {
                    if (showFILayerTitle) {
                        text += '<h2 class="hoverLayerTitle">' + wmsLoader.layerProperties[layerNodes[i].getAttribute("name")].title + '</h2>';
                    }
                    result = true;
                }
                var attribNodes = featureNodes[j].getElementsByTagName("Attribute");
                var attributesDict = {};
                for (var k = 0; k < attribNodes.length; ++k) {
                    attributesDict[attribNodes[k].getAttribute("name")] = attribNodes[k].getAttribute("value");
                }

                var tooltipFieldAvailable = attributesDict.hasOwnProperty(tooltipAttributeName);
                var geometryFieldAvailable = attributesDict.hasOwnProperty('geometry');

                if (tooltipFieldAvailable) {
                    var aValue = attributesDict[tooltipAttributeName]
                    if (aValue.match(/</)) {
                        text += aValue;
                    }
                    else {
                        attribText = '<p>' + aValue.replace(/\n/, "<br/>");
                        attribText = attribText.replace("\n", "<br/>");
                        text += attribText + '</p>';
                    }
                    text += '<hr class="hrHoverLayer"/>';
                }
                else if (tooltipTemplates && tooltipTemplates.hasOwnProperty(layerNodes[i].getAttribute("name"))){
                    templateText = tooltipTemplates[layerNodes[i].getAttribute("name")].template;
                    tooltipText = templateText.replace(/<%(\w*)%>/g,function(m,key){
                        var value = attributesDict.hasOwnProperty(key) ? attributesDict[key] : "";
                        return value.replace(/&/g, "&amp;")
                                     .replace(/</g, "&lt;")
                                     .replace(/>/g, "&gt;")
                                     .replace(/"/g, "&quot;")
                                     .replace(/'/g, "&#039;");
                    });
                    text += tooltipText+"<br/>";
                } else if (tooltipAttributeName.indexOf('[%') !== -1){ // Look into displayField for template tags...
                    var tooltipText = tooltipAttributeName;
                    var re = new RegExp(/\[%[^"]*"(.*?)"[^"]*%\]/g);
                    var ttmatch;
                    while(ttmatch = re.exec(tooltipAttributeName)){
                        var key = ttmatch[1];
                        var val = attributesDict.hasOwnProperty(key) ? attributesDict[key] : "";
                        tooltipText = tooltipText.replace(ttmatch[0], val);
                    }
                    text += tooltipText+"<br/>";
                }
                if (geometryFieldAvailable) {
                    var feature = new OpenLayers.Feature.Vector(OpenLayers.Geometry.fromWKT(attributesDict["geometry"]));
                    featureInfoHighlightLayer.addFeatures([feature]);
                }
            }
            //case raster layers
            var rasterAttributeNodes = [];
            var rasterLayerChildNode = layerNodes[i].firstChild;
            while (rasterLayerChildNode) {
                if (rasterLayerChildNode.nodeName == "Attribute") {
                    rasterAttributeNodes.push(rasterLayerChildNode);
                }
                rasterLayerChildNode = rasterLayerChildNode.nextSibling;
            }
            for (var j = 0; j < rasterAttributeNodes.length; ++j) {
                if (j == 0) {
                    if (showFILayerTitle) {
                        text += '<h2 class="hoverLayerTitle">' + wmsLoader.layerProperties[layerNodes[i].getAttribute("name")].title + '</h2>';
                    }
                    result = true;
                }
                text += '<p>'+rasterAttributeNodes[j].getAttribute("name")+": "+rasterAttributeNodes[j].getAttribute("value")+'</p>';
                text += '<hr class="hrHoverLayer"/>';
            }
            if (identificationMode == 'topMostHit' && result) {
                break;
            }
        }

        if (result) {
            changeCursorInMap("pointer");
            if (!clickPopup) {
                // only show hoverPopup if no clickPopup is open
                //get rid of last <hr/>
                text = text.replace(/<hr class="hrHoverLayer"\/>$/,'');
                hoverPopup = new OpenLayers.Popup.FramedCloud(
                    null, // id
                    map.getLonLatFromPixel(evt.xy), // lonlat
                    null, // new OpenLayers.Size(1,1), // contentSize
                    text , //contentHTML
                    null, // anchor
                    false, // closeBox
                    null // closeBoxCallback
                    );
                hoverPopup.autoSize = true;
                hoverPopup.keepInMap = true;
                hoverPopup.panMapIfOutOfView = false;
                hoverPopup.events.on({"click": onHoverPopupClick});
                map.addPopup(hoverPopup);
            }
        } else {
            changeCursorInMap("default");
        }
    }
}

// disable all GetFeatureInfoRequest until we have a reponse
function onBeforeGetFeatureInfoClick(evt){

    //workaround to avoid qgis server 500 error on empty query layers request
    //we want empty result
    //better way is to just cancel request, how?
    if (selectedQueryableLayers.length==0) {
        WMSGetFInfo.vendorParams.QUERY_LAYERS = evt.object.layers[0].name;
        WMSGetFInfo.maxFeatures = 0;
    }

    activateGetFeatureInfo(false);
}

// reenable GetFeatureInfo
function noFeatureInfoClick(evt){
   activateGetFeatureInfo(true);
}

/* we need this function in order to pass through the click to the map events
 * */
function onHoverPopupClick(evt){
    if (hoverPopup) {removeHoverPopup();}
    var map = geoExtMap.map; // gets OL map object
    evt.xy = map.events.getMousePosition(evt); // non api function of OpenLayers.Events
    map.events.triggerEvent("click", evt);
}

function onClickPopupClosed(evt) {
    removeClickPopup();
    // enable the hover popup for the curent mosue position
    if (enableHoverPopup)
		WMSGetFInfoHover.activate();
    var map = geoExtMap.map; // gets OL map object
    evt.xy = map.events.getMousePosition(evt); // non api function of OpenLayers.Events
    map.events.triggerEvent("mousemove", evt);
    closePopupClick = true; // indicate to not open a new clickPopup
}

function removeClickPopup() {
	//var map = geoExtMap.map; // gets OL map object
    //map.removePopup(clickPopup);
    if(clickPopup) {
        clickPopup.destroy();
    }
    clickPopup = null;
    featureInfoHighlightLayer.removeAllFeatures();
}

function removeHoverPopup(){
    var map = geoExtMap.map; // gets OL map object
    map.removePopup(hoverPopup);
    hoverPopup.destroy();
    hoverPopup = null;
    featureInfoHighlightLayer.removeAllFeatures();
}

function showFeatureSelected(args) {

    //TODO UROS tule bi bilo fajn dodati da se vklopi layer če je izklopljen

    if(args["geometry"]==undefined) {
        // select feature in layer
        thematicLayer.mergeNewParams({
            "SELECTION": args["layer"] + ":" + args["id"]
        });
    }
    else
    {
        //lets higlight selected features geometry instead
        featureInfoHighlightLayer.removeAllFeatures();
        var feature = new OpenLayers.Feature.Vector(OpenLayers.Geometry.fromWKT(args["geometry"]));
        featureInfoHighlightLayer.addFeatures([feature]);
    }

    if (args["doZoomToExtent"]){
        geoExtMap.map.zoomToExtent(args["bbox"]);
    }
    else{
        geoExtMap.map.setCenter(new OpenLayers.LonLat(args["x"], args["y"]), args["zoom"]);
    }
}

function clearFeatureSelected() {
    // clear selection
    thematicLayer.mergeNewParams({
        "SELECTION": null
    });
}

function parseFIResult(node) {
    if (node.hasChildNodes()) {
		//test if we need to show the feature info layer title
		//either from global setting or from project setting
		var showFILayerTitle = showFeatureInfoLayerTitle;
		if (mapThemeSwitcher) {
			if (mapThemeSwitcher.activeProjectData != undefined) {
				showFILayerTitle = mapThemeSwitcher.activeProjectData.showFeatureInfoLayerTitle;
			}
		}
        if (node.hasChildNodes() && node.nodeName == "Layer") {
            var hasAttributes = false;
            var rasterData = false;
            var htmlText = "";
			//if (showFILayerTitle) {
			//	htmlText += "<h2>" + wmsLoader.layerProperties[node.getAttribute("name")].title + "</h2>";
			//}
            var geoms = [];
            var layerChildNode = node.firstChild;
            while (layerChildNode) {
                var layerTitle = wmsLoader.layerProperties[node.getAttribute("name")].title;
                if (layerChildNode.hasChildNodes() && layerChildNode.nodeName === "Feature") {
                    var attributeNode = layerChildNode.firstChild;

                    if (showFILayerTitle) {
                        htmlText += "<h2>" + layerTitle + "</h2>";
                    }

                    htmlText += '\n <p></p>\n <table>\n  <tbody>';
                    //case vector data

                    while (attributeNode) {
                        if (attributeNode.nodeName == "Attribute") {
                            var attName = attributeNode.getAttribute("name");
                            var attValue = attributeNode.getAttribute("value").replace("NULL",noDataValue);
                            if ((attName !== mapInfoFieldName) && ((suppressEmptyValues == true && attValue.replace(/^\s\s*/, '').replace(/\s\s*$/, '') !== "") || suppressEmptyValues == false)) {
                                if (attName === "geometry") {
                                    var feature = new OpenLayers.Feature.Vector(OpenLayers.Geometry.fromWKT(attValue));
                                    geoms.push(feature);
                                    if (! suppressInfoGeometry) {
                                        htmlText += "\n   <tr>";
                                        if (showFieldNamesInClickPopup) {
                                            htmlText += "<td>" + attName + ":</td>";
                                        }
                                        htmlText += "<td>" + attValue + "</td></tr>";
                                        hasAttributes = true;
                                    }
                                } else {
                                    if (attName !== "maptip") {
                                      htmlText += "\n   <tr>";
                                      if (showFieldNamesInClickPopup) {
                                          htmlText += "<td>" + attName + ":</td>";
                                      }
                                      // add hyperlinks for URLs in attribute values
                                      if (attValue != '' && /^((http|https|ftp):\/\/).+\..+/i.test(attValue)) {
                                          if (! /\<a./i.test(attValue)) {
                                              //do not reformat already formated tags
                                              attValue = "<a class=\"popupLink\" href=\"" + attValue + "\" target=\"_blank\">" + attValue + "</a>";
                                          }
                                      }
                                      // add hyperlinks for URLs containing mediaurl pattern
                                      if (mediaurl != ''){
                                          var mediapattern = new RegExp(mediaurl,'i');
                                          if (mediapattern.test(attValue)){
                                              attValue = "<a href=\"/" + attValue + "\" target=\"_blank\">" + attValue + "</a>";
                                          }
                                      }
                                      htmlText += "<td>" + attValue + "</td></tr>";
                                      hasAttributes = true;
                                  }
                                }
                            }
                        }
                        attributeNode = attributeNode.nextSibling;
                    }
                    htmlText += "\n  </tbody>\n </table></br>";
                }
                else if (layerChildNode.nodeName === "Attribute") {
                    //case raster data
                    if (rasterData == false) {
                        htmlText += "\n <p></p>\n <table>\n  <tbody>";
                    }
                    htmlText += '\n<tr><td>'+layerChildNode.getAttribute("name") + '</td><td>' + layerChildNode.getAttribute("value") + '</td></tr>';
                    hasAttributes = true;
                    rasterData = true;
                }
                layerChildNode = layerChildNode.nextSibling;
            }
            //htmlText += "\n</ul>";
            if (hasAttributes) {
                if (rasterData) {
                    htmlText += "\n  </tbody>\n </table></br>";
                }
                //alert(htmlText);
                featureInfoResultLayers.push(htmlText);
                highLightGeometry.push(geoms);
            }
        } else {
            var child = node.firstChild;
            while (child) {
                parseFIResult(child);
                child = child.nextSibling;
            }
        }
    }
}


function listLayersWithFeatures(node) {
    if (node.hasChildNodes()) {
        if (node.nodeName == "Layer") {
            featureInfoResultLayers.push(node.getAttribute("name"));
        } else {
            var child = node.firstChild;
            while (child) {
                listLayersWithFeatures(child);
                child = child.nextSibling;
            }
        }
    }
}

function getFeatures(layerName, node) {
    if (node.hasChildNodes()) {
        if (node.nodeName == "Layer" && node.getAttribute("name") == layerName) {
            return node.firstChild;
        } else {
            var child = node.firstChild;
            while (child) {
                getFeatures(layerName, child);
                child = child.nextSibling;
            }
        }
    }
}

function updateElevation(data, location, field, template){

    var pan = Ext.getCmp('fi_elevation');
    var tem = new Ext.Template(template);

    if(data!==undefined) {
        if (!(isNaN(data[field])) && data[field] !== null) {
            if(data[field] === parseInt(data[field])) {
                //
            }
            else {
                data[field] = data[field].toFixed(elevationPrecision);
            }

            var label = tem.apply(data);

            pan.update(label);
        }
    }


}

function updateAddress(data, location, field, template, templateMin, factor) {

    var pan = Ext.getCmp('fi_address');

    var distance = 0;
    var results;

    if((field=='') || (field==null))
        results = data;
    else
        results = data[field];

    if(results.distance != null) {
        distance = results.distance;
        results.distance = distance*factor;
    }
    if (distance*factor>minimumAddressRange) {
        tem = new Ext.Template(templateMin);
    }
    else {
        tem = new Ext.Template(template);
    }

    var label = tem.apply(results);

    pan.update(label);

}