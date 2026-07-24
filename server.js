const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { SerialPort, ReadlineParser } = require("serialport");

const SERIAL_PATH = process.env.SERIAL_PORT || "/dev/ttyUSB0";
const BAUD_RATE = 115200;
const HTTP_PORT = 3000;
// ------------------------------------------------

const app = express();
app.use(express.static(__dirname + "/public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// ---- Open the serial port to the ESP32 ----
const port = new SerialPort(
  { path: SERIAL_PATH, baudRate: BAUD_RATE },
  (err) => {
    if (err) {
      console.error(`Could not open serial port ${SERIAL_PATH}:`, err.message);
      console.error(
        "Check SERIAL_PATH in server.js and make sure Arduino Serial Monitor is closed.",
      );
    }
  },
);

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

port.on("open", () => {
  console.log(`Serial port ${SERIAL_PATH} open at ${BAUD_RATE} baud.`);
});

port.on("error", (err) => {
  console.error("Serial port error:", err.message);
});

// ---- ESP32 -> browser ----
parser.on("data", (line) => {
  line = line.trim();
  if (!line) return;
  console.log("ESP32:", line);

  if (line.startsWith("[me]")) {
    broadcast({ sender: "me", text: line.replace("[me]", "").trim() });
  } else if (line.startsWith("[peer]")) {
    broadcast({ sender: "peer", text: line.replace("[peer]", "").trim() });
  } else {
    // boot messages, "ready" text, send-failed warnings, etc.
    broadcast({ sender: "system", text: line });
  }
});

// ---- browser -> ESP32 ----
wss.on("connection", (ws) => {
  console.log("Browser connected.");
  ws.on("message", (data) => {
    try {
      const { text } = JSON.parse(data);
      if (text && text.length) {
        port.write(text + "\n");
      }
    } catch (e) {
      console.error("Bad message from browser:", e.message);
    }
  });
});

server.listen(HTTP_PORT, () => {
  console.log(`Web UI ready at http://localhost:${HTTP_PORT}`);
});
