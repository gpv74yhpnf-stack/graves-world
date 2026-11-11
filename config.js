/* Graves' World config.
   Offerings: ntfy.sh (free, no account). Graves' brain polls it; messages kept ~12 h, pictures ~3 h.
   Mind: the live state is the JSON inside the body of GitHub issue #1 in the public repo below
   (the brain edits it with the GitHub connector's update_issue). If that can't be read, the site
   falls back to the bundled state.json. */
window.GRAVES_CONFIG = {
  ntfyTopic: "graves-offerings-64422223ed",
  ntfyServer: "https://ntfy.sh",
  stateIssue: { owner: "gpv74yhpnf-stack", repo: "graves-world", number: 1 }
};
