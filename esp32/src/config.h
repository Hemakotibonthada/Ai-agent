#pragma once
// ============================================================
// Nexus AI OS - ESP32 Home Automation Firmware
// Configuration Header — v2.0 Enhanced
// ============================================================

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ---------- Firmware Info ----------
#define FW_VERSION_MAJOR  2
#define FW_VERSION_MINOR  0
#define FW_VERSION_PATCH  0
#define DEVICE_ID         "nexus-home-001"
#define DEVICE_MODEL      "NexusHome-ESP32"

// ---------- WiFi Defaults ----------
#define WIFI_SSID_DEFAULT       "NexusHome"
#define WIFI_PASS_DEFAULT       "nexus12345"
#define WIFI_AP_SSID            "NexusHome-Setup"
#define WIFI_AP_PASS            "setup1234"
#define WIFI_CONNECT_TIMEOUT_MS 15000
#define WIFI_RECONNECT_INTERVAL 30000
#define WIFI_MAX_RETRIES        20
#define WIFI_MAX_SAVED_NETWORKS 3       // Multi-network support
#define WIFI_BACKOFF_BASE_MS    5000    // Exponential backoff base
#define WIFI_BACKOFF_MAX_MS     300000  // Max 5 minutes between retries
#define WIFI_RSSI_MIN           -85     // Minimum signal strength to connect
#define WIFI_HOSTNAME           "nexus-home"

// ---------- MQTT Settings ----------
#define MQTT_BROKER_DEFAULT     "192.168.1.100"
#define MQTT_PORT_DEFAULT       1883
#define MQTT_USER_DEFAULT       "nexus"
#define MQTT_PASS_DEFAULT       "nexus_mqtt"
#define MQTT_CLIENT_ID          DEVICE_ID
#define MQTT_KEEPALIVE          60
#define MQTT_RECONNECT_INTERVAL 5000
#define MQTT_BUFFER_SIZE        2048
#define MQTT_QOS_SENSOR         0       // QoS for sensor data
#define MQTT_QOS_ALERT          1       // QoS for alerts (at-least-once)
#define MQTT_QOS_CONTROL        1       // QoS for control commands
#define MQTT_OFFLINE_QUEUE_SIZE 20      // Queue messages when offline
#define MQTT_MAX_RECONNECT_BACKOFF 60000 // Max 60s between reconnects

// ---------- MQTT Topics ----------
#define TOPIC_PREFIX            "home"
#define TOPIC_SENSORS_TEMP      "home/sensors/temperature"
#define TOPIC_SENSORS_HUMIDITY  "home/sensors/humidity"
#define TOPIC_SENSORS_AIR       "home/sensors/air_quality"
#define TOPIC_SENSORS_GAS       "home/sensors/gas"
#define TOPIC_SENSORS_WATER     "home/sensors/water_level"
#define TOPIC_SENSORS_POWER     "home/sensors/power"
#define TOPIC_SENSORS_MOTION    "home/sensors/motion"
#define TOPIC_SENSORS_DOOR      "home/sensors/door"
#define TOPIC_DEVICE_LIGHT      "home/devices/light"    // +/control
#define TOPIC_DEVICE_FAN        "home/devices/fan/control"
#define TOPIC_DEVICE_AC         "home/devices/ac/control"
#define TOPIC_STATUS            "home/status"
#define TOPIC_ALERT             "home/alert"
#define TOPIC_SCENE             "home/scene/activate"
#define TOPIC_CONTROL_SUB       "home/+/control"
#define TOPIC_COMMAND           "home/command"           // Remote commands
#define TOPIC_DIAGNOSTIC        "home/diagnostic"        // Diagnostic data
#define TOPIC_TIMER             "home/timer/set"         // Timer scheduling

// ---------- Pin Definitions: Sensors ----------
#define PIN_DHT22           4     // DHT22 data pin
#define PIN_MQ135           34    // MQ-135 analog pin (ADC1_CH6)
#define PIN_MQ2             35    // MQ-2 analog pin (ADC1_CH7)
#define PIN_ULTRASONIC_TRIG 5     // HC-SR04 trigger
#define PIN_ULTRASONIC_ECHO 18    // HC-SR04 echo
#define PIN_PIR             19    // PIR motion sensor
#define PIN_SCT013           36   // SCT-013 current sensor (ADC1_CH0, VP)
#define PIN_DOOR_SENSOR_1   21    // Reed switch 1 (front door)
#define PIN_DOOR_SENSOR_2   22    // Reed switch 2 (window)

// ---------- Pin Definitions: Actuators ----------
#define PIN_RELAY_LIGHT1    13    // Relay channel 1
#define PIN_RELAY_LIGHT2    12    // Relay channel 2
#define PIN_RELAY_LIGHT3    14    // Relay channel 3
#define PIN_RELAY_LIGHT4    27    // Relay channel 4
#define PIN_FAN_RELAY       26    // Fan relay
#define PIN_FAN_PWM         25    // Fan speed PWM
#define PIN_IR_LED          15    // IR blaster LED
#define PIN_BUZZER          2     // Buzzer
#define PIN_NEOPIXEL        23    // WS2812B data pin

// ---------- PWM Configuration ----------
#define PWM_FAN_CHANNEL     0
#define PWM_FAN_FREQ        25000
#define PWM_FAN_RESOLUTION  8
#define PWM_LIGHT_CHANNELS  {1, 2, 3, 4}  // For MOSFET dimming
#define PWM_LIGHT_FREQ      5000
#define PWM_LIGHT_RESOLUTION 8

// ---------- Sensor Intervals (ms) ----------
#define INTERVAL_DHT        5000
#define INTERVAL_AIR        10000
#define INTERVAL_GAS        2000
#define INTERVAL_WATER      15000
#define INTERVAL_POWER      3000
#define INTERVAL_MOTION     500
#define INTERVAL_DOOR       1000
#define INTERVAL_MQTT_PUB   10000

// ---------- Sensor Calibration ----------
#define DHT_TEMP_OFFSET      0.0f
#define DHT_HUMIDITY_OFFSET   0.0f
#define MQ135_R0             76.63f    // Sensor resistance in clean air
#define MQ2_THRESHOLD        400       // Gas leak threshold (analog value)
#define WATER_TANK_HEIGHT_CM 150.0f    // Tank height in cm
#define WATER_TANK_EMPTY_CM  5.0f     // Sensor offset from top
#define SCT013_CALIBRATION   30.0f    // Current sensor calibration factor
#define VOLTAGE_SUPPLY       220.0f   // AC voltage (110 or 220)
#define POWER_COST_PER_KWH   0.12f    // Electricity cost per kWh

// ---------- Sensor Health Monitoring ----------
#define SENSOR_FAIL_COUNT_MAX    5     // Consecutive failures before marking bad
#define SENSOR_TEMP_MIN_VALID   -40.0f // Valid temperature range
#define SENSOR_TEMP_MAX_VALID   80.0f
#define SENSOR_HUM_MIN_VALID    0.0f
#define SENSOR_HUM_MAX_VALID    100.0f
#define SENSOR_OUTLIER_SIGMA    3.0f   // Reject readings > 3 sigma from mean

// ---------- Alert Thresholds ----------
#define TEMP_HIGH_THRESHOLD  40.0f
#define TEMP_LOW_THRESHOLD   5.0f
#define HUMIDITY_HIGH        85.0f
#define HUMIDITY_LOW         20.0f
#define AIR_QUALITY_BAD      300      // PPM threshold
#define GAS_LEAK_THRESHOLD   400
#define WATER_LEVEL_LOW      15.0f    // Percentage
#define WATER_LEVEL_CRITICAL 5.0f     // Critical percentage
#define POWER_SPIKE_WATTS    3000.0f
#define ALERT_COOLDOWN_MS    60000    // Min time between repeat alerts

// ---------- NeoPixel ----------
#define NEOPIXEL_COUNT       16
#define NEOPIXEL_BRIGHTNESS  50

// ---------- Web Server ----------
#define WEB_PORT             80
#define WEB_AUTH_USER        "admin"
#define WEB_AUTH_PASS        "nexus"
#define OTA_PASSWORD         "nexus_ota_pass"
#define WEB_RATE_LIMIT       30       // Max requests per minute per IP
#define WEB_SESSION_TIMEOUT  3600     // Session timeout in seconds

// ---------- NTP ----------
#define NTP_SERVER           "pool.ntp.org"
#define NTP_SERVER_BACKUP    "time.google.com"
#define NTP_OFFSET_SEC       0       // UTC offset in seconds
#define NTP_UPDATE_INTERVAL  60000   // ms

// ---------- Deep Sleep ----------
#define DEEP_SLEEP_ENABLED   false
#define DEEP_SLEEP_DURATION  300     // seconds
#define DEEP_SLEEP_NO_CONN_TIMEOUT 180 // Enter sleep after N sec without connectivity

// ---------- Moving Average / Signal Processing ----------
#define MOVING_AVG_SIZE      10
#define MEDIAN_FILTER_SIZE   5       // Median filter window for outlier rejection

// ---------- Relay Protection ----------
#define RELAY_MIN_SWITCH_INTERVAL_MS  500   // Prevent rapid relay switching
#define RELAY_MAX_DAILY_CYCLES        500   // Alert if relay cycles exceed this

// ---------- Watchdog ----------
#define WDT_TIMEOUT_SEC      30      // Watchdog timer timeout
#define WDT_EARLY_WARNING_MS 25000   // Log warning before WDT fires

// ---------- EEPROM / State Persistence ----------
#define EEPROM_AUTO_SAVE_INTERVAL_MS  300000  // Auto-save state every 5 min
#define EEPROM_SAVE_ON_CHANGE         true    // Save state on actuator changes
#define EEPROM_MAX_BOOT_CRASHES       3       // Max crashes before safe mode
#define EEPROM_SAFE_MODE_DURATION     300     // Safe mode duration in seconds

// ---------- Ring Buffer Logger ----------
#define LOG_RING_BUFFER_SIZE  50      // Store last N log messages in RAM
#define LOG_PERSIST_ON_CRASH  true    // Save ring buffer to NVS on crash

// ---------- Task Scheduling ----------
#define MAX_SCHEDULED_TIMERS  8       // Max persistent scheduled timers
#define TIMER_CHECK_INTERVAL  30000   // Check timers every 30 seconds

// ---------- Diagnostics ----------
#define HEAP_WARNING_THRESHOLD  20000  // Warn if free heap drops below
#define HEAP_CRITICAL_THRESHOLD 10000  // Critical heap level
#define DIAG_REPORT_INTERVAL    300000 // Full diagnostic report every 5 min

#endif // CONFIG_H
