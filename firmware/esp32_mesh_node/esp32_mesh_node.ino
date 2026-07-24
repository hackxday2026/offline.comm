#include <ArduinoJson.h>
#include <ArduinoJson.hpp>

#include <RF24.h>
#include <RF24_config.h>
#include <nRF24L01.h>
#include <printf.h>


#include <SPI.h>
#include <RF24.h>
#include <ArduinoJson.h>
#include "mesh_config.h"

RF24 radio(RF_CE_PIN, RF_CSN_PIN);
 
struct MeshPacket {
  char from[9];
  char to[9];
  char text[14];
};

static_assert(sizeof(MeshPacket) <= 32, "MeshPacket must fit the NRF24L01 32-byte payload limit");
 
void deriveAddress(const char* id, uint8_t addr[5]) {
  uint32_t hash = 2166136261UL; // FNV-1a offset basis
  for (const char* p = id; *p; p++) {
    hash ^= (uint8_t)*p;
    hash *= 16777619UL; // FNV-1a prime
  }
  addr[0] = 0xE7;  
                   
  addr[1] = (hash >> 24) & 0xFF;
  addr[2] = (hash >> 16) & 0xFF;
  addr[3] = (hash >> 8) & 0xFF;
  addr[4] = hash & 0xFF;
}

uint8_t myAddress[5];

void setup() {
  Serial.begin(115200);
  delay(300);

  if (!radio.begin()) {
    Serial.println("{\"from\":\"GATEWAY\",\"to\":\"broadcast\",\"org\":\"" ORG_ID "\",\"msg\":\"RADIO INIT FAILED - check wiring\"}");
    while (1) delay(1000);
  }

  radio.setPALevel(RF24_PA_LOW);   // raise to HIGH once you've confirmed range is good
  radio.setDataRate(RF24_1MBPS);
  radio.setChannel(RF_CHANNEL);
  radio.setRetries(5, 15);
  radio.enableDynamicPayloads();

  deriveAddress(NODE_ID, myAddress);
  radio.openReadingPipe(1, myAddress);
  radio.startListening();

  if (IS_GATEWAY) { 
  } else {
    Serial.println("=== " NODE_ID " online ===");
    Serial.println("Type TARGET_ID:your message and press Enter to send.");
  }
}

void sendPacket(const char* toId, const char* text) {
  MeshPacket pkt;
  memset(&pkt, 0, sizeof(pkt));
  strncpy(pkt.from, NODE_ID, sizeof(pkt.from) - 1);
  strncpy(pkt.to, toId, sizeof(pkt.to) - 1);
  strncpy(pkt.text, text, sizeof(pkt.text) - 1);

  uint8_t destAddress[5];
  deriveAddress(toId, destAddress);

  radio.stopListening();
  radio.openWritingPipe(destAddress);
  bool ok = radio.write(&pkt, sizeof(pkt));
  radio.startListening();

  if (!IS_GATEWAY) {
    Serial.println(ok ? "[sent]" : "[send failed - is the target powered on and in range?]");
  }
}

void emitIncomingAsJson(const MeshPacket& pkt) {
  StaticJsonDocument<160> doc;
  doc["from"] = pkt.from;
  doc["to"] = pkt.to;
  doc["org"] = ORG_ID;
  doc["msg"] = pkt.text;
  serializeJson(doc, Serial);
  Serial.println();
}

void emitIncomingAsText(const MeshPacket& pkt) {
  Serial.print("[");
  Serial.print(pkt.from);
  Serial.print(" -> ");
  Serial.print(pkt.to);
  Serial.print("] ");
  Serial.println(pkt.text);
}
 
void handleSerialJsonLine(const String& line) {
  StaticJsonDocument<160> doc;
  DeserializationError err = deserializeJson(doc, line);
  if (err) return;

  const char* to = doc["to"];
  const char* msg = doc["msg"];
  if (!to || !msg) return;

  sendPacket(to, msg);
} 

void handlePlainSerialLine(const String& line) {
  int sep = line.indexOf(':');
  if (sep <= 0) {
    Serial.println("Format: TARGET_ID:message");
    return;
  }
  String to = line.substring(0, sep);
  String text = line.substring(sep + 1);
  sendPacket(to.c_str(), text.c_str());
}

void loop() {
  if (radio.available()) {
    MeshPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    radio.read(&pkt, sizeof(pkt));

    if (IS_GATEWAY) {
      emitIncomingAsJson(pkt);
    } else {
      emitIncomingAsText(pkt);
    }
  }
 
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) return;

    if (IS_GATEWAY) {
      handleSerialJsonLine(line);
    } else {
      handlePlainSerialLine(line);
    }
  }
}
