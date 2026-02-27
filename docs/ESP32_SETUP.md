# NEXUS AI OS — ESP32 Setup Guide

> Complete hardware setup, wiring, firmware upload, and calibration guide for the ESP32 home automation module.

---

## Table of Contents

- [Overview](#overview)
- [Hardware Requirements](#hardware-requirements)
- [Pin Connection Diagram](#pin-connection-diagram)
- [Wiring Details](#wiring-details)
- [Software Prerequisites](#software-prerequisites)
- [PlatformIO Setup](#platformio-setup)
- [WiFi & MQTT Configuration](#wifi--mqtt-configuration)
- [Firmware Upload](#firmware-upload)
- [Sensor Calibration](#sensor-calibration)
- [Troubleshooting](#troubleshooting)

---

## Overview

The ESP32 module serves as the physical layer of NEXUS AI OS, providing:
- Environmental monitoring (temperature, humidity, air quality, gas)
- Water tank level measurement
- Power consumption tracking
- Motion and door/window detection
- Light, fan, and AC control via relays
- RGB LED (NeoPixel) status indicators
- IR blaster for air conditioner control
- Embedded web server for direct configuration

Communication with the backend happens over **MQTT** (Mosquitto broker).

---

## Hardware Requirements

### Core Components

| Component | Model | Quantity | Purpose |
|-----------|-------|----------|---------|
| **Microcontroller** | ESP32-DevKitC V4 | 1 | Main controller |
| **Temperature/Humidity** | DHT22 (AM2302) | 1 | Environment monitoring |
| **Air Quality** | MQ-135 | 1 | Air quality (PPM) |
| **Gas Sensor** | MQ-2 | 1 | Combustible gas detection |
| **Ultrasonic** | HC-SR04 | 1 | Water tank level |
| **Motion** | HC-SR501 PIR | 1 | Motion detection |
| **Current Sensor** | SCT-013-030 | 1 | Power monitoring (30A) |
| **Reed Switch** | Magnetic contact | 2 | Door/window sensors |
| **Relay Module** | 4-channel 5V relay | 1 | Light control |
| **Relay Module** | 1-channel 5V relay | 1 | Fan control |
| **IR LED** | 940nm IR emitter | 1 | AC remote control |
| **NeoPixel** | WS2812B strip (16 LEDs) | 1 | Status/ambient lighting |
| **Buzzer** | Active piezo buzzer | 1 | Audio alerts |

### Power & Accessories

| Component | Specification | Quantity |
|-----------|--------------|----------|
| **Power Supply** | 5V 3A USB or barrel jack | 1 |
| **Breadboard** | Full-size 830 points | 1-2 |
| **Jumper Wires** | Male-Male, Male-Female | ~40 |
| **Resistors** | 10kΩ (pull-up/down) | 5 |
| **Resistor** | 4.7kΩ (DHT22 pull-up) | 1 |
| **Capacitor** | 100µF electrolytic | 2 |
| **Burden Resistor** | 33Ω (SCT-013) | 1 |
| **USB Cable** | Micro-USB (for ESP32) | 1 |

---

## Pin Connection Diagram

### Sensor Connections (Input)

| Sensor | ESP32 Pin | GPIO | Type | Notes |
|--------|-----------|------|------|-------|
| DHT22 Data | D4 | GPIO 4 | Digital | 4.7kΩ pull-up to 3.3V |
| MQ-135 AO | D34 | GPIO 34 | ADC1_CH6 | Analog only pin |
| MQ-2 AO | D35 | GPIO 35 | ADC1_CH7 | Analog only pin |
| HC-SR04 Trigger | D5 | GPIO 5 | Digital Out | |
| HC-SR04 Echo | D18 | GPIO 18 | Digital In | 5V→3.3V divider recommended |
| PIR Signal | D19 | GPIO 19 | Digital In | HIGH when motion |
| SCT-013 | VP | GPIO 36 | ADC1_CH0 | Via burden resistor + bias |
| Reed Switch 1 | D21 | GPIO 21 | Digital In | 10kΩ pull-up, front door |
| Reed Switch 2 | D22 | GPIO 22 | Digital In | 10kΩ pull-up, window |

### Actuator Connections (Output)

| Actuator | ESP32 Pin | GPIO | Type | Notes |
|----------|-----------|------|------|-------|
| Relay 1 (Light 1) | D13 | GPIO 13 | Digital Out | Active LOW |
| Relay 2 (Light 2) | D12 | GPIO 12 | Digital Out | Active LOW |
| Relay 3 (Light 3) | D14 | GPIO 14 | Digital Out | Active LOW |
| Relay 4 (Light 4) | D27 | GPIO 27 | Digital Out | Active LOW |
| Fan Relay | D26 | GPIO 26 | Digital Out | On/Off control |
| Fan PWM | D25 | GPIO 25 | PWM | Speed control (25kHz) |
| IR LED | D15 | GPIO 15 | Digital Out | Via NPN transistor |
| Buzzer | D2 | GPIO 2 | Digital Out | Also onboard LED |
| NeoPixel Data | D23 | GPIO 23 | Digital Out | 330Ω series resistor |

### Power Connections

| Pin | Connection |
|-----|-----------|
| 3.3V | DHT22 VCC, reed switches pull-up, PIR VCC |
| 5V (VIN) | Relay module VCC, HC-SR04 VCC, NeoPixel VCC |
| GND | Common ground for all components |

---

## Wiring Details

### DHT22 Temperature/Humidity Sensor

```
DHT22          ESP32
┌───────┐
│ 1 VCC │──── 3.3V
│ 2 DATA│──┬─ GPIO 4
│ 3 NC  │  │
│ 4 GND │──── GND
└───────┘  │
           ├── 4.7kΩ ── 3.3V  (pull-up)
```

### MQ-135 / MQ-2 Gas Sensors

```
MQ-135         ESP32
┌───────┐
│ VCC   │──── 5V
│ GND   │──── GND
│ AO    │──── GPIO 34 (analog)
│ DO    │     (not used)
└───────┘

MQ-2 → Same wiring but AO → GPIO 35
```

> **Warning:** MQ sensors require a 24-48 hour burn-in period for accurate readings.

### HC-SR04 Ultrasonic (Water Tank)

```
HC-SR04        ESP32
┌───────┐
│ VCC   │──── 5V
│ TRIG  │──── GPIO 5
│ ECHO  │──┬─ GPIO 18
│ GND   │──── GND
└───────┘  │
     (Optional: voltage divider for 5V→3.3V on ECHO)
     ECHO ── 1kΩ ── GPIO 18
                  │
                  2kΩ
                  │
                 GND
```

### SCT-013 Current Sensor

```
SCT-013        ESP32
┌───────┐
│ Wire 1│──┬── GPIO 36 (VP)
│       │  │
│ Wire 2│──┤
└───────┘  │
           ├── 33Ω burden resistor ──┤
           │                         │
           ├── 10kΩ ── 3.3V         │
           │                         │
           └── 10kΩ ── GND          │
                                     │
           (Bias circuit: 1.65V DC offset)
```

### Relay Module

```
4-Ch Relay     ESP32
┌───────┐
│ VCC   │──── 5V
│ GND   │──── GND
│ IN1   │──── GPIO 13
│ IN2   │──── GPIO 12
│ IN3   │──── GPIO 14
│ IN4   │──── GPIO 27
└───────┘

Each relay output:
  COM ── Mains Live (AC)
  NO  ── Light/Device (Normally Open)
  NC  ── (Not used)
```

> **⚠️ SAFETY WARNING:** Working with mains voltage (110V/220V AC) is dangerous. Use proper isolation, enclosures, and consider hiring a licensed electrician.

---

## Software Prerequisites

1. **PlatformIO** — Install via VS Code extension or CLI:
   ```bash
   pip install platformio
   ```

2. **VS Code** (recommended) with PlatformIO IDE extension

3. **USB Driver** — CP2102 or CH340 driver for your ESP32 board

---

## PlatformIO Setup

1. Open the `esp32/` directory in VS Code with PlatformIO extension
2. PlatformIO will automatically detect `platformio.ini` and install dependencies
3. Verify the configuration in `platformio.ini`:

```ini
[env:esp32dev]
platform = espressif32@6.5.0
board = esp32dev
framework = arduino
upload_speed = 921600
monitor_speed = 115200
```

4. Libraries are auto-installed from `lib_deps` in `platformio.ini`

---

## WiFi & MQTT Configuration

Edit `src/config.h` before uploading:

```cpp
// WiFi Settings
#define WIFI_SSID_DEFAULT       "YourWiFiNetwork"
#define WIFI_PASS_DEFAULT       "YourWiFiPassword"

// MQTT Settings - Point to your NEXUS backend server
#define MQTT_BROKER_DEFAULT     "192.168.1.100"  // Backend server IP
#define MQTT_PORT_DEFAULT       1883
#define MQTT_USER_DEFAULT       "nexus"
#define MQTT_PASS_DEFAULT       "nexus_mqtt"
```

Alternatively, use the **embedded web server** for configuration:
1. On first boot (or if WiFi fails), ESP32 creates AP: `NexusHome-Setup`
2. Connect to AP, password: `setup1234`
3. Open `http://192.168.4.1` in browser
4. Enter WiFi and MQTT credentials
5. ESP32 restarts and connects

---

## Firmware Upload

### Via USB

```bash
cd esp32

# Build
pio run

# Upload
pio run --target upload

# Monitor serial output
pio device monitor --baud 115200
```

### Via OTA (Over-The-Air)

After initial USB upload, enable OTA in `platformio.ini`:

```ini
upload_protocol = espota
upload_port = nexus-home.local
upload_flags =
    --auth=nexus_ota_pass
```

```bash
pio run --target upload
```

---

## Sensor Calibration

### DHT22 Calibration

Adjust offsets in `config.h` if readings are consistently off:
```cpp
#define DHT_TEMP_OFFSET      0.0f    // Add/subtract to temperature
#define DHT_HUMIDITY_OFFSET   0.0f    // Add/subtract to humidity
```

Compare with a reference thermometer and adjust.

### MQ-135 Air Quality Calibration

1. Place sensor in **clean outdoor air** for 24 hours
2. Read the analog value (serial monitor)
3. Update R0 value:
```cpp
#define MQ135_R0             76.63f   // Replace with your measured R0
```

### MQ-2 Gas Threshold

```cpp
#define MQ2_THRESHOLD        400      // Analog value threshold for gas alert
```
Test with a lighter (briefly) near the sensor to verify detection.

### Water Tank Level

```cpp
#define WATER_TANK_HEIGHT_CM 150.0f   // Your tank height in cm
#define WATER_TANK_EMPTY_CM  5.0f     // Distance from sensor to max water level
```

### Power Monitoring (SCT-013)

```cpp
#define SCT013_CALIBRATION   30.0f    // Matches SCT-013-030 (30A sensor)
#define VOLTAGE_SUPPLY       220.0f   // Your mains voltage (110 or 220)
#define POWER_COST_PER_KWH   0.12f    // Your electricity rate
```

To calibrate: Connect a known load (e.g., 100W bulb), read the measurement, and adjust `SCT013_CALIBRATION` until it matches.

---

## Troubleshooting

### ESP32 Won't Connect to WiFi

| Issue | Solution |
|-------|---------|
| Wrong credentials | Re-flash or use AP mode to reconfigure |
| Too far from router | Move closer or add WiFi repeater |
| 5GHz network | ESP32 only supports 2.4GHz WiFi |
| Timeout | Increase `WIFI_CONNECT_TIMEOUT_MS` |
| Keeps reconnecting | Check `WIFI_MAX_RETRIES`, verify router DHCP |

### MQTT Connection Fails

| Issue | Solution |
|-------|---------|
| Broker unreachable | Verify Mosquitto is running on server |
| Wrong IP | Update `MQTT_BROKER_DEFAULT` in config.h |
| Auth failure | Check MQTT username/password |
| Port blocked | Ensure port 1883 is open on firewall |
| Buffer overflow | Increase `MQTT_BUFFER_SIZE` (default 2048) |

### Sensor Not Reading

| Sensor | Common Issue | Fix |
|--------|-------------|-----|
| DHT22 | No pull-up resistor | Add 4.7kΩ between DATA and 3.3V |
| DHT22 | NaN readings | Check wiring, try different GPIO |
| MQ-135/MQ-2 | Always zero | Needs 24-48h burn-in, check power (5V) |
| HC-SR04 | Fixed distance | Check TRIG/ECHO wiring, verify 5V power |
| PIR | Always HIGH | Wait 60s for initialization, adjust sensitivity pot |
| SCT-013 | Zero amps | Clamp around single wire, not both |
| Reed switch | Random triggers | Add 100nF debounce capacitor |

### Upload Failures

| Issue | Solution |
|-------|---------|
| Port not found | Install CP2102/CH340 USB driver |
| Upload timeout | Hold BOOT button during upload |
| Wrong board | Verify `board = esp32dev` in platformio.ini |
| Port busy | Close serial monitor before uploading |

### Serial Monitor Shows Garbage

- Verify `monitor_speed = 115200` matches firmware baud rate
- Check USB cable supports data (not charge-only)

### High Memory Usage

If running low on memory:
- Reduce `MQTT_BUFFER_SIZE`
- Reduce `NEOPIXEL_COUNT`
- Use `huge_app.csv` partition scheme (already configured)
- Disable unused sensors in code

---

## LED Status Indicators

If using the onboard LED (GPIO 2) or NeoPixel:

| Pattern | Meaning |
|---------|---------|
| Solid Blue | Connected to WiFi + MQTT |
| Blinking Blue | Connecting to WiFi |
| Solid Red | Error state |
| Blinking Red | MQTT disconnected |
| Rainbow cycle | AP mode (setup) |
| Green pulse | Sensor reading ok |
| Orange flash | Alert triggered |
