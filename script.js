/* File: script.js
   Fresh Happy Travel frontend behavior:
   - Rotating hero backgrounds (Unsplash)
   - Floating search panel interactions
   - Booking links, favorites (localStorage)
   - Lazy Google Maps loader (optional)
   - Runs after DOMContentLoaded
*/

(() => {
  /* ========== CONFIG ========== */
  const GOOGLE_MAPS_API_KEY = "AIzaSyD8A_7lUl-1Ol0lrisznF5xGaCHdVUBsKU"; // <-- Only one declaration!
  const TRAVEL_IMAGES = [
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=1600&q=80"
  ];
  const BOOKING_LINKS_BY_COUNTRY = {
    Italy: [{name:"Trenitalia",url:"https://www.trenitalia.com/"} ,{name:"Italo",url:"https://www.italotreno.it/"}],
    France: [{name:"SNCF",url:"https://www.sncf.com/"}],
    Germany: [{name:"Deutsche Bahn",url:"https://www.bahn.com/en"}],
    Spain: [{name:"Renfe",url:"https://www.renfe.com/"}],
    "United Kingdom": [{name:"National Rail",url:"https://www.nationalrail.co.uk/"}]
  };
  const MAP_STYLE_SILVER = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    {
      featureType: "administrative.land_parcel",
      elementType: "labels.text.fill",
      stylers: [{ color: "#bdbdbd" }]
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#eeeeee" }]
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#757575" }]
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#e5e5e5" }]
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9e9e9e" }]
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }]
    },
    {
      featureType: "road.arterial",
      elementType: "labels.text.fill",
      stylers: [{ color: "#757575" }]
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#dadada" }]
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#616161" }]
    },
    {
      featureType: "road.local",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9e9e9e" }]
    },
    {
      featureType: "transit.line",
      elementType: "geometry",
      stylers: [{ color: "#e5e5e5" }]
    },
    {
      featureType: "transit.station",
      elementType: "geometry",
      stylers: [{ color: "#eeeeee" }]
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#c9c9c9" }]
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9e9e9e" }]
    }
  ];

  /* ========== STATE ========== */
  let heroInterval = null;
  let currentHeroIndex = -1;
  let map = null, directionsService = null, directionsRenderer = null, isMapLoaded = false, currentRoute = null;

  /* ========== HELPERS ========== */
  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
  function safeJSONParse(s, fallback){ try { return JSON.parse(s); } catch(e){ return fallback; } }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(msg, t=2500) {
    const el = $("#ht-toast");
    if(!el) return;
    el.textContent = msg;
    el.classList.add("visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(()=>el.classList.remove("visible"), t);
  }

  /* ========== HERO BACKGROUND ========== */
  function setHeroImage(url){
    const hero = $(".hero-visual");
    if(!hero) return;
    hero.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.18)), url('${url}')`;
    hero.style.backgroundSize = "cover";
    hero.style.backgroundPosition = "center";
  }
  function nextHeroImage(){
    currentHeroIndex = (currentHeroIndex + 1) % TRAVEL_IMAGES.length;
    setHeroImage(TRAVEL_IMAGES[currentHeroIndex]);
  }
  function initHeroRotation(){
    nextHeroImage();
    heroInterval = setInterval(nextHeroImage, 10000);
  }

  // --- Favorites (simple localStorage) ---
  const FAV_KEY = "ht_favorites";

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveFavorite(from, to) {
    if (!from || !to) return;
    const favs = getFavorites();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    favs.unshift({ id, from, to, created: Date.now() });
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    renderFavList();
  }

  function deleteFavorite(id) {
    const favs = getFavorites().filter(f => f.id !== id);
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    renderFavList();
  }

  function renderFavList() {
    const listEl = document.getElementById("fav-list");
    const emptyEl = document.getElementById("fav-empty");
    if (!listEl) return;
    const favs = getFavorites();
    listEl.innerHTML = "";
    if (!favs.length) {
      emptyEl && (emptyEl.style.display = "block");
      return;
    }
    emptyEl && (emptyEl.style.display = "none");
    favs.forEach(f => {
      const item = document.createElement("div");
      item.className = "fav-item";
      item.innerHTML = `
        <div class="fav-meta">
          <strong>${escapeHtml(f.from)} → ${escapeHtml(f.to)}</strong>
          <div class="muted" style="font-size:12px">saved</div>
        </div>
        <div class="fav-actions">
          <button class="btn ghost load-fav" data-id="${f.id}">Load</button>
          <button class="btn" title="Delete" data-id="${f.id}">Delete</button>
        </div>
      `;
      listEl.appendChild(item);
    });

    // attach handlers
    listEl.querySelectorAll(".load-fav").forEach(b => {
      b.addEventListener("click", (ev) => {
        const id = ev.currentTarget.dataset.id;
        const fav = getFavorites().find(x => x.id === id);
        if (!fav) return;
        const fromEl = document.getElementById("fromInput");
        const toEl = document.getElementById("toInput");
        if (fromEl) fromEl.value = fav.from;
        if (toEl) toEl.value = fav.to;
        // open map + show route
        calculateAndDisplayRoute(fav.from, fav.to);
        closeFavDrawer();
      });
    });
    listEl.querySelectorAll(".fav-actions button[title='Delete']").forEach(b => {
      b.addEventListener("click", (ev) => {
        const id = ev.currentTarget.dataset.id;
        deleteFavorite(id);
      });
    });
  }

  function openFavDrawer() {
    const d = document.getElementById("favoritesDrawer");
    if (!d) return;
    d.classList.add("open");
    d.setAttribute("aria-hidden", "false");
    renderFavList();
  }
  function closeFavDrawer() {
    const d = document.getElementById("favoritesDrawer");
    if (!d) return;
    d.classList.remove("open");
    d.setAttribute("aria-hidden", "true");
  }

  // small helper
  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  }

  // wire up UI once DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    const favBtn = document.getElementById("favoritesBtn");
    if (favBtn) favBtn.addEventListener("click", openFavDrawer);

    const closeFav = document.getElementById("closeFav");
    if (closeFav) closeFav.addEventListener("click", closeFavDrawer);

    // quick-save: SHIFT+click favoritesBtn to save current route
    if (favBtn) {
      favBtn.addEventListener("click", (ev) => {
        if (ev.shiftKey) {
          const from = document.getElementById("fromInput").value.trim();
          const to = document.getElementById("toInput").value.trim();
          if (!from || !to) {
            toast("Enter origin and destination first to save.");
            return;
          }
          saveFavorite(from, to);
          toast("Route saved to favorites");
        }
      });
    }

    renderFavList();
  });

  /* ========== BOOKING LINKS ========= */
  function renderBookingLinks(country){
    const out = $("#bookingLinks");
    if(!out) return;
    out.innerHTML = "";
    const list = BOOKING_LINKS_BY_COUNTRY[country];
    if(!list || !list.length) {
      out.innerHTML = `<div class="muted">No vendor list for "${country}". Choose another country or try a global search.</div>`;
      return;
    }
    list.forEach(item=>{
      const a=document.createElement("a");
      a.className="link-card";
      a.href=item.url; a.target="_blank"; a.rel="noopener noreferrer";
      a.innerHTML = `<div class="link-title">${escapeHtml(item.name)}</div><div class="small muted">${(new URL(item.url)).hostname}</div>`;
      out.appendChild(a);
    });
  }

  /* ========== GOOGLE MAPS (lazy load) ========= */
  function loadGoogleMapsIfNeeded(cb){
    if(isMapLoaded){ cb && cb(); return; }
    if(!GOOGLE_MAPS_API_KEY){ toast("Google Maps API key not set — static preview only."); renderStaticMapPreview(); return; }
    if(document.querySelector('script[src*="maps.googleapis.com"]')){
      cb && cb();
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places`;
    s.defer = true;
    s.onload = ()=> initMap(cb);
    s.onerror = ()=> { toast("Failed to load Google Maps."); renderStaticMapPreview(); };
    document.body.appendChild(s);
  }
  function initMap(cb){
    if(!$("#map")) return;
    isMapLoaded = true;
    map = new google.maps.Map(document.getElementById("map"), {
      center: { lat: 41.9028, lng: 12.4964 },
      zoom: 6,
      styles: MAP_STYLE_SILVER
    });
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers:false });
    directionsRenderer.setMap(map);
    initAutocomplete();
    cb && cb();
  }
  function renderStaticMapPreview(){
    const m = $("#map");
    if(!m) return;
    m.innerHTML = `<div class="map-placeholder">Map preview (enable Google Maps API key)</div>`;
  }
  function calculateAndDisplayRoute(from,to){
    loadGoogleMapsIfNeeded(()=>{
      if(!isMapLoaded || !directionsService){ toast("Map not available"); return; }
      toast("Getting route...");
      directionsService.route({ origin: from, destination: to, travelMode: google.maps.TravelMode.TRANSIT }, (resp,status)=>{
        if(status==="OK"){ directionsRenderer.setDirections(resp); currentRoute={from,to,timestamp:Date.now(),route:resp}; toast("Route displayed"); }
        else if(status==="ZERO_RESULTS"){
          directionsService.route({ origin: from, destination: to, travelMode: google.maps.TravelMode.DRIVING }, (r2,s2)=>{
            if(s2==="OK"){ directionsRenderer.setDirections(r2); currentRoute={from,to,timestamp:Date.now(),route:r2}; toast("Driving route shown"); }
            else toast("No route found.");
          });
        } else { toast(`Directions error: ${status}`); }
      });
    });
  }

  /* ========== Google Places Autocomplete ========== */
  function initAutocomplete() {
    if (!window.google || !google.maps || !google.maps.places) return;
    const fromInput = document.getElementById("fromInput");
    const toInput = document.getElementById("toInput");
    const options = { types: ["(cities)"] };
    new google.maps.places.Autocomplete(fromInput, options);
    new google.maps.places.Autocomplete(toInput, options);
  }

  /* ========== INIT ========== */
  function init(){
    initHeroRotation();
    // wireUI(); // Remove or comment out this line
    renderBookingLinks("");
    renderStaticMapPreview();
    renderFavList();
    loadGoogleMapsIfNeeded();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }

  document.addEventListener("DOMContentLoaded", initAutocomplete);

  document.addEventListener("DOMContentLoaded", () => {
    const showRouteBtn = document.getElementById("showRouteBtn");
    if (showRouteBtn) {
      showRouteBtn.addEventListener("click", () => {
        const from = document.getElementById("fromInput").value.trim();
        const to = document.getElementById("toInput").value.trim();
        if (!from || !to) {
          toast("Please enter both origin and destination.");
          return;
        }
        calculateAndDisplayRoute(from, to);
      });
    }

    const clearBtn = document.getElementById("clearBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        const fromEl = document.getElementById("fromInput");
        const toEl = document.getElementById("toInput");
        if (fromEl) fromEl.value = "";
        if (toEl) toEl.value = "";
        if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
        currentRoute = null;
        toast("Cleared");
      });
    }

    const showStopsBtn = document.getElementById("showStopsBtn");
    if (showStopsBtn) {
      showStopsBtn.addEventListener("click", showNearbyStops);
    }
  });

  function showNearbyStops() {
    if (!map) return;
    const service = new google.maps.places.PlacesService(map);
    const center = map.getCenter();
    service.nearbySearch({
      location: center,
      radius: 1000,
      type: ['bus_station', 'transit_station', 'train_station']
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        results.forEach(place => {
          new google.maps.Marker({
            map,
            position: place.geometry.location,
            title: place.name
          });
        });
        toast("Nearby stops shown on map.");
      } else {
        toast("No stops found nearby.");
      }
    });
  }

})();