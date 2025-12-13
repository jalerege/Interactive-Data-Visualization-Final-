d3.json("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson").then((geojson) => {
    d3.dsv(",", "Global_Music_Streaming_Listener_Preferences.csv", d => {
        return {
            country: d.Country,
            platform: d["Streaming Platform"],
            genre: d["Top Genre"]
        };
    }).then((data) => {
        console.log("loaded csv", data);
        console.log("loaded json", geojson);

        // join the data by country
        let datajoin = {};
        data.forEach(d => {
            if (!datajoin[d.country]) {
                datajoin[d.country] = {
                    platforms: {},
                    genres: {}
                };
            }
            datajoin[d.country].platforms[d.platform] = (datajoin[d.country].platforms[d.platform] || 0) + 1;
            datajoin[d.country].genres[d.genre] = (datajoin[d.country].genres[d.genre] || 0) + 1;
        });

        // calculate top platform
        Object.keys(datajoin).forEach(country => {
            const platforms = datajoin[country].platforms;
            datajoin[country].topPlatform = Object.keys(platforms).reduce((a, b) =>
                platforms[a] > platforms[b] ? a : b
            );
            //top 3 genres
            const genres = datajoin[country].genres;
            datajoin[country].top3Genres = Object.entries(genres)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([genre]) => genre);
        });

        geojson.features.forEach(feature => {
            const countryname = feature.properties.ADMIN;
            feature.properties.data = datajoin[countryname] || null;
        });

        const platforms = [...new Set(Object.values(datajoin).map(d => d.topPlatform))];
        const platformValues = platforms.map((p, i) => i);
        const minValue = Math.min(...platformValues);
        const maxValue = Math.max(...platformValues);
        const midValue = minValue + (maxValue - minValue) / 2;

        var colorScale = d3.scaleDiverging([minValue, midValue, maxValue], d3.interpolatePiYG);

        // Map platforms to numeric values
        const platformToValue = {};
        platforms.forEach((p, i) => platformToValue[p] = i);

        // Initialize Leaflet map
        let map = L.map('map').setView([20, 0], 2);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        // Style function for countries
        function style(feature) {
            const data = feature.properties.data;
            const value = data ? platformToValue[data.topPlatform] : null;
            return {
                fillColor: data ? colorScale(value) : '#ccc',
                weight: 1,
                opacity: 0.8,
                color: "white",
                fillOpacity: 0.8,
            };
        }

        // Create info control box
        var info = L.control();
        info.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info');
            this.update();
            return this._div;
        };
        info.update = function (props) {
            const data = props ? props.data : null;
            this._div.innerHTML = '<h4>Music Streaming by Country</h4>' + (props && data ?
                '<b>' + props.ADMIN + '</b><br />' +
                '<strong>Top Platform:</strong> ' + data.topPlatform + '<br />' +
                '<strong>Top 3 Genres:</strong><br />' +
                '<ol style="margin: 5px 0; padding-left: 20px;">' +
                data.top3Genres.map(g => '<li>' + g + '</li>').join('') +
                '</ol>'
                : 'Hover over a country');
        };
        info.addTo(map);


        function highlightFeature(e) {
            var layer = e.target;
            layer.setStyle({
                weight: 5,
                color: '#7496fa',
                fillOpacity: 0.7
            });
            layer.bringToFront();
            info.update(layer.feature.properties);
        }

        function resetHighlight(e) {
            geojsonLayer.resetStyle(e.target);
            info.update();
        }

        function zoomToFeature(e) {
            map.fitBounds(e.target.getBounds());
        }

        function onEachFeature(feature, layer) {
            layer.on({
                mouseover: highlightFeature,
                mouseout: resetHighlight,
                click: zoomToFeature
            });
        }

        let geojsonLayer = L.geoJSON(geojson, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);

        var legend = L.control({position: 'bottomright'});
        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend');

            div.innerHTML = '<h4>Top Platform</h4>';
            platforms.forEach(platform => {
                div.innerHTML +=
                    '<i style="background:' + colorScale(platformToValue[platform]) + '"></i> ' +
                    platform + '<br>';
            });

            return div;
        };
        legend.addTo(map);
    });
});