const GMAPS_SCRIPT_ID = 'google-maps-script';

/**
 * Load Google Maps JS API once (shared by targeting map, lead details, homeowner form).
 */
export function loadGoogleMapsScript(apiKey, { libraries = 'places' } = {}) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.Map) {
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

    const onLoad = () => {
      if (window.google?.maps?.Map) resolve();
      else reject(new Error('Google Maps failed to initialize'));
    };
    const onError = () => reject(new Error('Google Maps failed to load'));

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (window.google?.maps?.Map) resolve();
  });
}
