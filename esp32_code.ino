/*
  ESP32 + NRF24L01 Duplex Serial Chat
  ------------------------------------
  Flash the SAME sketch to both ESP32 boards. Only change IS_NODE_A
  below: set it true on one board, false on the other.

  Each board can send AND receive at the same time (duplex) by
  switching briefly between listening and transmitting every loop
  iteration - this is the standard way to get bidirectional comms
  out of a single NRF24L01 radio (which is technically half-duplex
  at the radio level, but this makes it feel duplex from the
  serial monitor / chat perspective).

  Wiring (adjust pins if yours differ):
    NRF24L01      ESP32
    VCC     ->    3.3V   (NOT 5V - will damage the module)
    GND     ->    GND
    CE      ->    GPIO 4
    CSN     ->    GPIO 5
    SCK     ->    GPIO 18
    MOSI    ->    GPIO 23
    MISO    ->    GPIO 19
    IRQ     ->    not connected

  Library needed (Arduino IDE Library Manager):
    "RF24" by TMRh20
*/

#include <SPI.h>
#include <RF24.h>

// ---- SET THIS DIFFERENTLY ON EACH BOARD ----
#define IS_NODE_A false   // set to false on the second board
// ---------------------------------------------

#define CE_PIN   4
#define CSN_PIN  5

RF24 radio(CE_PIN, CSN_PIN);

// Two fixed pipe addresses - one for each direction of traffic
const uint64_t addrAtoB = 0xF0F0F0F0E1LL; // A writes here, B reads here
const uint64_t addrBtoA = 0xF0F0F0F0D2LL; // B writes here, A reads here

const uint64_t myWriteAddr = IS_NODE_A ? addrAtoB : addrBtoA;
const uint64_t myReadAddr  = IS_NODE_A ? addrBtoA : addrAtoB;

const char* myName = IS_NODE_A ? "A" : "B";

#define MAX_MSG_LEN 32
char serialBuf[MAX_MSG_LEN];
uint8_t serialPos = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); }

  if (!radio.begin()) {
    Serial.println(F("NRF24L01 not detected - check wiring."));
    while (1) { delay(1000); }
  }

  radio.setPALevel(RF24_PA_LOW);      // raise to HIGH once range is confirmed
  radio.setDataRate(RF24_250KBPS);    // more reliable over distance
  radio.setChannel(76);               // pick a clear channel; must match on both nodes
  radio.enableDynamicPayloads();
  radio.setAutoAck(true);
  radio.setRetries(5, 15);

  radio.openWritingPipe(myWriteAddr);
  radio.openReadingPipe(1, myReadAddr);
  radio.startListening();

  Serial.print(F("Node "));
  Serial.print(myName);
  Serial.println(F(" ready. Type a message and press Enter to send."));
}

void sendMessage(const char* msg) {
  radio.stopListening();             // switch to TX mode
  bool ok = radio.write(msg, strlen(msg) + 1);
  radio.startListening();            // switch back to RX mode immediately

  Serial.print(F("[me] "));
  Serial.println(msg);
  if (!ok) {
    Serial.println(F("  (send failed - no ack, other node may be out of range/off)"));
  }
}

void checkIncoming() {
  if (radio.available()) {
    char received[MAX_MSG_LEN] = {0};
    uint8_t len = radio.getDynamicPayloadSize();
    if (len > MAX_MSG_LEN) len = MAX_MSG_LEN;
    radio.read(&received, len);

    Serial.print(F("[peer] "));
    Serial.println(received);
  }
}

void checkSerialInput() {
  while (Serial.available()) {
    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      if (serialPos > 0) {
        serialBuf[serialPos] = '\0';
        sendMessage(serialBuf);
        serialPos = 0;
      }
    } else if (serialPos < MAX_MSG_LEN - 1) {
      serialBuf[serialPos++] = c;
    }
  }
}

void loop() {
  checkIncoming();      // listen for anything the other node sent
  checkSerialInput();   // send anything typed into the serial monitor
}
