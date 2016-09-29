document.addEventListener("DOMContentLoaded",init);

function init() {
    conn = new WebSocket("ws://0.0.0.0:9000");
    conn.onopen = function (event) {
        conn.send("Hello"); 
    };
    conn.onmessage = function (event) {
        console.log(event.data);
    }
}
