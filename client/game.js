document.addEventListener("DOMContentLoaded",init);

function init() {
    conn = new WebSocket("ws://0.0.0.0:9000");
}
