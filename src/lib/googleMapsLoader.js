const GMAPS_SCRIPT_ID = 'google-maps-script';
const MAPS_READY_POLL_MS = 100;
const MAPS_READY_TIMEOUT_MS = 15000;

function isMapsReady() {
  return typeof window.google?.maps?.Map === 'function';
}

function waitForMapsReady() {
  return new Promise((resolve, reject) => {
    if (isMapsReady()) {
      resolve();
      return;
    }

    const started = Date.now();
    const poll = () => {
      if (isMapsReady()) {
        resolve();
        return;
      }
      if (Date.now() - started >= MAPS_READY_TIMEOUT_MS) {
        reject(new Error('Google Maps failed to initialize'));
        return;
      }
      setTimeout(poll, MAPS_READY_POLL_MS);
    };
    poll();
  });
}

/**
 * Load Google Maps JS API once (shared by targeting map, lead details, homeowner form).
 */
export function loadGoogleMapsScript(apiKey, { libraries = 'places' } = {}) {
  return new Promise((resolve, reject) => {
    if (isMapsReady()) {
      resolve();
      return;
    }

    let script = document.getElementById(GMAPS_SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = GMAPS_SCRIPT_ID;
      const libs = libraries ? `&libraries=${libraries}` : '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}${libs}&v=weekly&loading=async`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const onReady = () => {
      waitForMapsReady().then(resolve).catch(reject);
    };
    const onError = () => reject(new Error('Google Maps failed to load'));

    if (isMapsReady()) {
      resolve();
      return;
    }

    if (script.getAttribute('data-loaded') === 'true') {
      onReady();
      return;
    }

    script.addEventListener('load', () => {
      script.setAttribute('data-loaded', 'true');
      onReady();
    }, { once: true });
    script.addEventListener('error', onError, { once: true });
  });
}
