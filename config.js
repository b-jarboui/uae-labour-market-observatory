/* Deployment settings for the GitHub Pages site.
   The assistant calls Gemini through ONE of these:
   - GEMINI_PROXY: URL of a small proxy (e.g. a free Cloudflare Worker) that holds the API key server-side. Preferred.
   - GEMINI_KEY:   a Gemini API key restricted in Google Cloud to this site's address (HTTP referrer
                   https://<user>.github.io/*). The key is visible in the page, so only use a restricted key.
   Leave both empty to show the dashboard without the assistant. */
window.OBS_CONFIG = {
  DATA_BASE: "data/",
  GEMINI_MODEL: "gemini-2.5-flash",
  GEMINI_PROXY: "",
  GEMINI_KEY: "",
};
