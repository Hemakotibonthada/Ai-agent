// ============================================================
// Nexus AI OS - ESP32 Home Automation
// Local Web Server Implementation
// ============================================================

#include "web_server.h"
#include "config.h"
#include "utils.h"
#include "sensors.h"
#include "actuators.h"
#include "power_monitor.h"
#include "mqtt_handler.h"
#include "wifi_manager.h"
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <Update.h>

// ---- Server & WebSocket ----
static AsyncWebServer g_server(WEB_PORT);
static AsyncWebSocket g_ws("/ws");
static String g_auth_user = WEB_AUTH_USER;
static String g_auth_pass = WEB_AUTH_PASS;
static unsigned long g_ws_last_broadcast = 0;

// ---- Auth check ----
static bool check_auth(AsyncWebServerRequest* request) {
    if (!request->authenticate(g_auth_user.c_str(), g_auth_pass.c_str())) {
        request->requestAuthentication();
        return false;
    }
    return true;
}

// ---- CORS headers ----
static void add_cors(AsyncWebServerResponse* response) {
    response->addHeader("Access-Control-Allow-Origin", "*");
    response->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ---- WebSocket event handler ----
static void on_ws_event(AsyncWebSocket* server, AsyncWebSocketClient* client,
                        AwsEventType type, void* arg, uint8_t* data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT:
            LOG_I("WEB", "WS client #%u connected from %s", client->id(),
                  client->remoteIP().toString().c_str());
            // Send current sensor data on connect
            client->text(sensors_get_json_string());
            break;
        case WS_EVT_DISCONNECT:
            LOG_I("WEB", "WS client #%u disconnected", client->id());
            break;
        case WS_EVT_DATA: {
            AwsFrameInfo* info = (AwsFrameInfo*)arg;
            if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
                String msg;
                for (size_t i = 0; i < len; i++) msg += (char)data[i];
                LOG_D("WEB", "WS received: %s", msg.c_str());

                // Parse command
                JsonDocument doc;
                if (deserializeJson(doc, msg) == DeserializationError::Ok) {
                    const char* cmd = doc["command"];
                    if (cmd) {
                        if (String(cmd) == "get_sensors") {
                            client->text(sensors_get_json_string());
                        } else if (String(cmd) == "get_power") {
                            client->text(power_get_json_string());
                        }
                    }
                }
            }
            break;
        }
        case WS_EVT_PONG:
        case WS_EVT_ERROR:
            break;
    }
}

// ---- Embedded HTML Dashboard ----
static const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nexus Home - ESP32 Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
               background: #0a0a1a; color: #e0e0e0; min-height: 100vh; }
        .header { background: linear-gradient(135deg, #1a1a3e, #2d1b69);
                  padding: 20px; text-align: center; border-bottom: 2px solid #6c63ff; }
        .header h1 { font-size: 1.5em; color: #6c63ff; }
        .header small { color: #888; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 16px; padding: 16px; max-width: 1200px; margin: 0 auto; }
        .card { background: #1a1a2e; border-radius: 12px; padding: 20px;
                border: 1px solid #333; transition: all 0.3s; }
        .card:hover { border-color: #6c63ff; transform: translateY(-2px); }
        .card h3 { color: #6c63ff; margin-bottom: 12px; font-size: 0.9em;
                   text-transform: uppercase; letter-spacing: 1px; }
        .value { font-size: 2em; font-weight: bold; }
        .unit { font-size: 0.5em; color: #888; }
        .row { display: flex; justify-content: space-between; padding: 6px 0;
               border-bottom: 1px solid #222; }
        .label { color: #888; }
        .ok { color: #4caf50; } .warn { color: #ff9800; } .err { color: #f44336; }
        .btn { background: #6c63ff; border: none; color: white; padding: 8px 16px;
               border-radius: 6px; cursor: pointer; margin: 4px; font-size: 0.9em; }
        .btn:hover { background: #5a52d5; }
        .btn.off { background: #333; }
        .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
                      margin-right: 6px; }
        .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        #log { background: #111; padding: 10px; border-radius: 8px; font-family: monospace;
               font-size: 0.8em; max-height: 150px; overflow-y: auto; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>&#x1F3E0; Nexus Home Dashboard</h1>
        <small id="status">Connecting...</small>
    </div>
    <div class="grid">
        <div class="card">
            <h3>&#x1F321; Temperature &amp; Humidity</h3>
            <div class="value"><span id="temp">--</span><span class="unit">&deg;C</span></div>
            <div class="row"><span class="label">Humidity</span><span id="hum">--</span>%</div>
        </div>
        <div class="card">
            <h3>&#x1F32C; Air Quality</h3>
            <div class="value"><span id="aqi">--</span><span class="unit">ppm</span></div>
            <div class="row"><span class="label">Status</span><span id="aq_status">--</span></div>
        </div>
        <div class="card">
            <h3>&#x1F6A8; Gas &amp; Safety</h3>
            <div class="row"><span class="label">Gas Level</span><span id="gas">--</span></div>
            <div class="row"><span class="label">Gas Leak</span><span id="gas_leak">--</span></div>
            <div class="row"><span class="label">Motion</span><span id="motion">--</span></div>
            <div class="row"><span class="label">Door 1</span><span id="door1">--</span></div>
            <div class="row"><span class="label">Door 2</span><span id="door2">--</span></div>
        </div>
        <div class="card">
            <h3>&#x1F4A7; Water Tank</h3>
            <div class="value"><span id="water">--</span><span class="unit">%</span></div>
            <div class="row"><span class="label">Level</span><span id="water_cm">--</span> cm</div>
        </div>
        <div class="card">
            <h3>&#x26A1; Power</h3>
            <div class="value"><span id="power">--</span><span class="unit">W</span></div>
            <div class="row"><span class="label">Current</span><span id="current">--</span> A</div>
            <div class="row"><span class="label">Today</span><span id="daily_kwh">--</span> kWh</div>
            <div class="row"><span class="label">Cost Today</span>$<span id="daily_cost">--</span></div>
        </div>
        <div class="card">
            <h3>&#x1F4A1; Lights &amp; Fan</h3>
            <div class="controls">
                <button class="btn" onclick="cmd('light',1,'ON')">Light 1</button>
                <button class="btn" onclick="cmd('light',2,'ON')">Light 2</button>
                <button class="btn" onclick="cmd('light',3,'ON')">Light 3</button>
                <button class="btn" onclick="cmd('light',4,'ON')">Light 4</button>
                <button class="btn" onclick="cmd('fan',0,'ON')">Fan ON</button>
                <button class="btn off" onclick="cmd('fan',0,'OFF')">Fan OFF</button>
            </div>
            <div class="controls" style="margin-top:8px;">
                <button class="btn" onclick="scene('morning')">Morning</button>
                <button class="btn" onclick="scene('movie_night')">Movie</button>
                <button class="btn" onclick="scene('sleep')">Sleep</button>
                <button class="btn" onclick="scene('party')">Party</button>
            </div>
        </div>
        <div class="card" style="grid-column: span 2;">
            <h3>&#x1F4CB; System</h3>
            <div class="row"><span class="label">Uptime</span><span id="uptime">--</span></div>
            <div class="row"><span class="label">Free Heap</span><span id="heap">--</span></div>
            <div class="row"><span class="label">WiFi RSSI</span><span id="rssi">--</span> dBm</div>
            <div class="row"><span class="label">MQTT</span><span id="mqtt">--</span></div>
            <div id="log"></div>
        </div>
    </div>
    <script>
        let ws;
        function connect() {
            ws = new WebSocket('ws://' + location.host + '/ws');
            ws.onopen = () => { document.getElementById('status').textContent = 'Connected'; addLog('WebSocket connected'); };
            ws.onclose = () => { document.getElementById('status').textContent = 'Disconnected'; setTimeout(connect, 3000); };
            ws.onmessage = (e) => { try { update(JSON.parse(e.data)); } catch(err) {} };
        }
        function update(d) {
            if(d.temperature) document.getElementById('temp').textContent = d.temperature;
            if(d.humidity) document.getElementById('hum').textContent = d.humidity;
            if(d.air_quality_ppm) { document.getElementById('aqi').textContent = d.air_quality_ppm;
                let s = d.air_quality_ppm<200?'Good':d.air_quality_ppm<400?'Moderate':'Poor';
                let c = d.air_quality_ppm<200?'ok':d.air_quality_ppm<400?'warn':'err';
                document.getElementById('aq_status').innerHTML = '<span class="'+c+'">'+s+'</span>'; }
            if(d.gas_raw !== undefined) document.getElementById('gas').textContent = d.gas_raw;
            if(d.gas_leak !== undefined) document.getElementById('gas_leak').innerHTML = d.gas_leak?'<span class="err">DETECTED</span>':'<span class="ok">Safe</span>';
            if(d.motion !== undefined) document.getElementById('motion').innerHTML = d.motion?'<span class="warn">Detected</span>':'None';
            if(d.door1) document.getElementById('door1').innerHTML = d.door1=='open'?'<span class="warn">Open</span>':'<span class="ok">Closed</span>';
            if(d.door2) document.getElementById('door2').innerHTML = d.door2=='open'?'<span class="warn">Open</span>':'<span class="ok">Closed</span>';
            if(d.water_level_pct) document.getElementById('water').textContent = d.water_level_pct;
            if(d.water_level_cm) document.getElementById('water_cm').textContent = d.water_level_cm;
            if(d.power_watts) document.getElementById('power').textContent = d.power_watts;
            if(d.current_amps) document.getElementById('current').textContent = d.current_amps;
            if(d.daily_kwh) document.getElementById('daily_kwh').textContent = d.daily_kwh;
            if(d.daily_cost) document.getElementById('daily_cost').textContent = d.daily_cost;
            if(d.uptime) document.getElementById('uptime').textContent = d.uptime;
            if(d.heap) document.getElementById('heap').textContent = d.heap;
            if(d.rssi) document.getElementById('rssi').textContent = d.rssi;
            if(d.mqtt) document.getElementById('mqtt').innerHTML = d.mqtt?'<span class="ok">Connected</span>':'<span class="err">Disconnected</span>';
        }
        function cmd(device, ch, action) {
            fetch('/api/devices', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({device:device, channel:ch, action:action}) })
                .then(r=>r.json()).then(d=>addLog(device+' '+ch+': '+action));
        }
        function scene(name) {
            fetch('/api/scene', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({scene:name}) })
                .then(r=>r.json()).then(d=>addLog('Scene: '+name));
        }
        function addLog(msg) {
            let log = document.getElementById('log');
            let t = new Date().toLocaleTimeString();
            log.innerHTML += '<div>['+t+'] '+msg+'</div>';
            log.scrollTop = log.scrollHeight;
        }
        connect();
        setInterval(()=>{ fetch('/api/sensors').then(r=>r.json()).then(update).catch(()=>{}); }, 5000);
        setInterval(()=>{ fetch('/api/status').then(r=>r.json()).then(update).catch(()=>{}); }, 10000);
    </script>
</body>
</html>
)rawliteral";

// ---- Config Page HTML ----
static const char CONFIG_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nexus Home - Configuration</title>
<style>
  body{font-family:sans-serif;background:#0a0a1a;color:#e0e0e0;padding:20px;max-width:600px;margin:0 auto}
  h2{color:#6c63ff}input,select{width:100%;padding:10px;margin:8px 0;background:#1a1a2e;
  border:1px solid #333;border-radius:6px;color:#fff}
  .btn{background:#6c63ff;border:none;color:white;padding:12px 24px;border-radius:6px;cursor:pointer;
  width:100%;font-size:1em;margin-top:10px}.btn:hover{background:#5a52d5}
  .section{background:#1a1a2e;padding:20px;border-radius:12px;margin:16px 0;border:1px solid #333}
</style></head><body>
<h2>&#x2699; Configuration</h2>
<div class="section"><h3>WiFi Settings</h3>
<input id="ssid" placeholder="WiFi SSID"><input id="wpass" type="password" placeholder="WiFi Password">
<button class="btn" onclick="saveWifi()">Save WiFi</button></div>
<div class="section"><h3>MQTT Settings</h3>
<input id="mhost" placeholder="MQTT Broker Host"><input id="mport" placeholder="Port (1883)">
<input id="muser" placeholder="Username"><input id="mpassw" type="password" placeholder="Password">
<button class="btn" onclick="saveMqtt()">Save MQTT</button></div>
<div class="section"><h3>OTA Firmware Update</h3>
<input type="file" id="fw" accept=".bin">
<button class="btn" onclick="uploadFW()">Upload Firmware</button>
<div id="prog"></div></div>
<script>
function saveWifi(){fetch('/api/config/wifi',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({ssid:document.getElementById('ssid').value,password:document.getElementById('wpass').value})})
.then(r=>r.json()).then(d=>alert(d.message||'Saved'));}
function saveMqtt(){fetch('/api/config/mqtt',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({host:document.getElementById('mhost').value,port:parseInt(document.getElementById('mport').value)||1883,
user:document.getElementById('muser').value,password:document.getElementById('mpassw').value})})
.then(r=>r.json()).then(d=>alert(d.message||'Saved'));}
function uploadFW(){let f=document.getElementById('fw').files[0];if(!f)return alert('Select file');
let fd=new FormData();fd.append('firmware',f);document.getElementById('prog').textContent='Uploading...';
fetch('/api/ota',{method:'POST',body:fd}).then(r=>r.json()).then(d=>{
document.getElementById('prog').textContent=d.message||'Done';}).catch(e=>{
document.getElementById('prog').textContent='Error: '+e;});}
</script></body></html>
)rawliteral";

// ============================================================
// Route Setup
// ============================================================
static void setup_routes() {
    // ---- Dashboard ----
    g_server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
        request->send_P(200, "text/html", INDEX_HTML);
    });

    // ---- Config page ----
    g_server.on("/config", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (!check_auth(request)) return;
        request->send_P(200, "text/html", CONFIG_HTML);
    });

    // ---- CORS preflight ----
    g_server.on("/*", HTTP_OPTIONS, [](AsyncWebServerRequest* request) {
        AsyncWebServerResponse* response = request->beginResponse(204);
        add_cors(response);
        request->send(response);
    });

    // ---- API: Get sensor data ----
    g_server.on("/api/sensors", HTTP_GET, [](AsyncWebServerRequest* request) {
        AsyncWebServerResponse* response = request->beginResponse(200, "application/json",
            sensors_get_json_string());
        add_cors(response);
        request->send(response);
    });

    // ---- API: Get power data ----
    g_server.on("/api/power", HTTP_GET, [](AsyncWebServerRequest* request) {
        AsyncWebServerResponse* response = request->beginResponse(200, "application/json",
            power_get_json_string());
        add_cors(response);
        request->send(response);
    });

    // ---- API: Get device states ----
    g_server.on("/api/devices", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;

        JsonArray lights = doc["lights"].to<JsonArray>();
        for (int i = 0; i < 4; i++) {
            JsonObject l = lights.add<JsonObject>();
            l["channel"] = i + 1;
            l["state"]   = light_get_state(i) ? "ON" : "OFF";
            l["brightness"] = light_get_brightness(i);
        }

        JsonObject fan = doc["fan"].to<JsonObject>();
        fan["state"] = fan_get_state() ? "ON" : "OFF";
        fan["speed"] = fan_get_speed();

        JsonObject ac = doc["ac"].to<JsonObject>();
        ac["state"] = ac_get_state() ? "ON" : "OFF";
        ac["temperature"] = ac_get_set_temp();
        ac["mode"] = ac_get_mode();

        doc["scene"] = scene_get_active();

        String output;
        serializeJson(doc, output);
        AsyncWebServerResponse* response = request->beginResponse(200, "application/json", output);
        add_cors(response);
        request->send(response);
    });

    // ---- API: Control devices (POST) ----
    g_server.on("/api/devices", HTTP_POST, [](AsyncWebServerRequest* request) {},
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
        String body;
        for (size_t i = 0; i < len; i++) body += (char)data[i];

        JsonDocument doc;
        if (deserializeJson(doc, body) != DeserializationError::Ok) {
            request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
            return;
        }

        String device = doc["device"].as<String>();
        int channel   = doc["channel"] | 0;
        String action = doc["action"].as<String>();

        if (device == "light" && channel >= 1 && channel <= 4) {
            int ch = channel - 1;
            if (action == "ON") light_set(ch, true);
            else if (action == "OFF") light_set(ch, false);
            if (doc.containsKey("brightness")) {
                light_set_brightness(ch, doc["brightness"].as<uint8_t>());
            }
        } else if (device == "fan") {
            if (action == "ON") fan_set(true);
            else if (action == "OFF") fan_set(false);
            if (doc.containsKey("speed")) fan_set_speed(doc["speed"].as<uint8_t>());
        } else if (device == "ac") {
            if (action == "ON" || action == "OFF") ac_power_toggle();
            if (doc.containsKey("temperature")) ac_set_temperature(doc["temperature"].as<int>());
            if (doc.containsKey("mode")) ac_set_mode(doc["mode"].as<const char*>());
        }

        AsyncWebServerResponse* response = request->beginResponse(200, "application/json",
            "{\"status\":\"ok\"}");
        add_cors(response);
        request->send(response);
    });

    // ---- API: Scene activation ----
    g_server.on("/api/scene", HTTP_POST, [](AsyncWebServerRequest* request) {},
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
        String body;
        for (size_t i = 0; i < len; i++) body += (char)data[i];

        JsonDocument doc;
        if (deserializeJson(doc, body) == DeserializationError::Ok && doc.containsKey("scene")) {
            scene_activate(doc["scene"].as<const char*>());
        }

        AsyncWebServerResponse* response = request->beginResponse(200, "application/json",
            "{\"status\":\"ok\"}");
        add_cors(response);
        request->send(response);
    });

    // ---- API: System status ----
    g_server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["device_id"]   = DEVICE_ID;
        doc["firmware"]    = String(FW_VERSION_MAJOR) + "." + String(FW_VERSION_MINOR) + "." + String(FW_VERSION_PATCH);
        doc["uptime"]      = get_uptime_string();
        doc["heap"]        = get_free_heap();
        doc["rssi"]        = wifi_get_rssi();
        doc["wifi_ssid"]   = wifi_get_ssid();
        doc["ip"]          = wifi_get_ip();
        doc["mac"]         = wifi_get_mac();
        doc["mqtt"]        = mqtt_is_connected();
        doc["mqtt_sent"]   = mqtt_get_messages_sent();
        doc["mqtt_recv"]   = mqtt_get_messages_received();
        doc["timestamp"]   = get_timestamp();

        String output;
        serializeJson(doc, output);
        AsyncWebServerResponse* response = request->beginResponse(200, "application/json", output);
        add_cors(response);
        request->send(response);
    });

    // ---- API: WiFi config ----
    g_server.on("/api/config/wifi", HTTP_POST, [](AsyncWebServerRequest* request) {},
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
        String body;
        for (size_t i = 0; i < len; i++) body += (char)data[i];

        JsonDocument doc;
        if (deserializeJson(doc, body) == DeserializationError::Ok) {
            String ssid = doc["ssid"].as<String>();
            String pass = doc["password"].as<String>();
            wifi_set_credentials(ssid, pass);
            wifi_save_credentials();

            AsyncWebServerResponse* response = request->beginResponse(200, "application/json",
                "{\"message\":\"WiFi config saved. Reconnecting...\"}");
            add_cors(response);
            request->send(response);

            // Reconnect after response sent
            delay(1000);
            wifi_connect(ssid, pass);
        } else {
            request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
        }
    });

    // ---- API: MQTT config ----
    g_server.on("/api/config/mqtt", HTTP_POST, [](AsyncWebServerRequest* request) {},
        NULL,
        [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
        String body;
        for (size_t i = 0; i < len; i++) body += (char)data[i];

        JsonDocument doc;
        if (deserializeJson(doc, body) == DeserializationError::Ok) {
            String host = doc["host"].as<String>();
            uint16_t port = doc["port"] | MQTT_PORT_DEFAULT;
            String user = doc["user"].as<String>();
            String pass = doc["password"].as<String>();

            mqtt_set_broker(host, port);
            mqtt_set_credentials(user, pass);
            mqtt_save_config();

            AsyncWebServerResponse* response = request->beginResponse(200, "application/json",
                "{\"message\":\"MQTT config saved. Reconnecting...\"}");
            add_cors(response);
            request->send(response);

            delay(500);
            mqtt_disconnect();
            mqtt_connect();
        } else {
            request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
        }
    });

    // ---- API: OTA firmware update ----
    g_server.on("/api/ota", HTTP_POST,
        [](AsyncWebServerRequest* request) {
            bool success = !Update.hasError();
            AsyncWebServerResponse* response = request->beginResponse(200, "application/json",
                success ? "{\"message\":\"Update success! Rebooting...\"}"
                        : "{\"error\":\"Update failed\"}");
            add_cors(response);
            request->send(response);
            if (success) {
                delay(1000);
                ESP.restart();
            }
        },
        [](AsyncWebServerRequest* request, const String& filename, size_t index,
           uint8_t* data, size_t len, bool final) {
            if (index == 0) {
                LOG_I("OTA", "Update start: %s", filename.c_str());
                if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
                    Update.printError(Serial);
                }
            }
            if (Update.write(data, len) != len) {
                Update.printError(Serial);
            }
            if (final) {
                if (Update.end(true)) {
                    LOG_I("OTA", "Update success! Size: %u bytes", index + len);
                } else {
                    Update.printError(Serial);
                }
            }
        }
    );

    // ---- 404 handler ----
    g_server.onNotFound([](AsyncWebServerRequest* request) {
        // Captive portal redirect
        if (wifi_get_state() == WIFI_STATE_AP_MODE) {
            request->redirect("http://" + wifi_get_ap_ip() + "/config");
            return;
        }
        request->send(404, "application/json", "{\"error\":\"Not found\"}");
    });
}

// ============================================================
// Init
// ============================================================
void webserver_init() {
    g_ws.onEvent(on_ws_event);
    g_server.addHandler(&g_ws);
    setup_routes();
    g_server.begin();
    LOG_I("WEB", "Web server started on port %d", WEB_PORT);
}

// ============================================================
// Loop
// ============================================================
void webserver_loop() {
    // Cleanup disconnected WS clients
    g_ws.cleanupClients();

    // Broadcast sensor updates to all WS clients periodically
    unsigned long now = millis();
    if (now - g_ws_last_broadcast >= 3000 && g_ws.count() > 0) {
        g_ws_last_broadcast = now;
        webserver_ws_send_sensor_update();
    }
}

void webserver_stop() {
    g_server.end();
    LOG_I("WEB", "Web server stopped");
}

void webserver_start() {
    g_server.begin();
    LOG_I("WEB", "Web server started");
}

// ============================================================
// WebSocket Broadcasting
// ============================================================
void webserver_ws_broadcast(const String& message) {
    g_ws.textAll(message);
}

void webserver_ws_send_sensor_update() {
    JsonDocument doc;

    // Sensor data
    SensorData sd = sensors_get_data();
    doc["temperature"]   = serialized(float_to_string(sd.temperature, 1));
    doc["humidity"]       = serialized(float_to_string(sd.humidity, 1));
    doc["air_quality_ppm"] = serialized(float_to_string(sd.air_quality_ppm, 0));
    doc["gas_raw"]        = sd.gas_raw;
    doc["gas_leak"]       = sd.gas_leak_detected;
    doc["water_level_pct"] = serialized(float_to_string(sd.water_level_pct, 1));
    doc["water_level_cm"] = serialized(float_to_string(sd.water_level_cm, 1));
    doc["motion"]         = sd.motion_detected;
    doc["door1"]          = sd.door1_open ? "open" : "closed";
    doc["door2"]          = sd.door2_open ? "open" : "closed";

    // Power data
    PowerData pd = power_get_data();
    doc["power_watts"]   = serialized(float_to_string(pd.power_watts, 1));
    doc["current_amps"]  = serialized(float_to_string(pd.current_rms, 3));
    doc["daily_kwh"]     = serialized(float_to_string(pd.daily_kwh, 3));
    doc["daily_cost"]    = serialized(float_to_string(pd.daily_cost, 2));

    // System
    doc["uptime"]  = get_uptime_string();
    doc["heap"]    = get_free_heap();
    doc["rssi"]    = wifi_get_rssi();
    doc["mqtt"]    = mqtt_is_connected();

    String output;
    serializeJson(doc, output);
    g_ws.textAll(output);
}

void webserver_set_auth(const String& user, const String& pass) {
    g_auth_user = user;
    g_auth_pass = pass;
}
