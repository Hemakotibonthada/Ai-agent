// ============================================================
// Nexus AI OS - ESP32 Home Automation
// EEPROM / NVS State Persistence Manager - Implementation
// ============================================================

#include "eeprom_manager.h"
#include "config.h"
#include "utils.h"
#include <nvs.h>
#include <nvs_flash.h>
#include <esp_system.h>

// ---- Preferences instances per namespace ----
static Preferences g_prefs_state;
static Preferences g_prefs_calib;
static Preferences g_prefs_boot;
static Preferences g_prefs_timers;
static Preferences g_prefs_user;

// ---- Dirty flag + debounce for deferred saves ----
static bool          g_state_dirty      = false;
static unsigned long g_state_dirty_time = 0;
static uint32_t      g_write_count      = 0;

// ---- Cached state for deferred save ----
static ActuatorSnapshot g_cached_state;
static bool             g_cached_valid = false;

// ============================================================
// CRC32 (IEEE 802.3 polynomial)
// ============================================================
static const uint32_t crc32_table[256] = {
    0x00000000UL, 0x77073096UL, 0xEE0E612CUL, 0x990951BAUL,
    0x076DC419UL, 0x706AF48FUL, 0xE963A535UL, 0x9E6495A3UL,
    0x0EDB8832UL, 0x79DCB8A4UL, 0xE0D5E91BUL, 0x97D2D988UL,
    0x09B64C2BUL, 0x7EB17CBDUL, 0xE7B82D09UL, 0x90BF1D9FUL,
    0x1DB71064UL, 0x6AB020F2UL, 0xF3B97148UL, 0x84BE41DEUL,
    0x1ADAD47DUL, 0x6DDDE4EBUL, 0xF4D4B551UL, 0x83D385C7UL,
    0x136C9856UL, 0x646BA8C0UL, 0xFD62F97AUL, 0x8A65C9ECUL,
    0x14015C4FUL, 0x63066CD9UL, 0xFA0F3D63UL, 0x8D080DF5UL,
    0x3B6E20C8UL, 0x4C69105EUL, 0xD56041E4UL, 0xA2677172UL,
    0x3C03E4D1UL, 0x4B04D447UL, 0xD20D85FDUL, 0xA50AB56BUL,
    0x35B5A8FAUL, 0x42B2986CUL, 0xDBBBC9D6UL, 0xACBCF940UL,
    0x32D86CE3UL, 0x45DF5C75UL, 0xDCD60DCFUL, 0xABD13D59UL,
    0x26D930ACUL, 0x51DE003AUL, 0xC8D75180UL, 0xBFD06116UL,
    0x21B4F6B5UL, 0x56B3C423UL, 0xCFBA9599UL, 0xB8BDA50FUL,
    0x2802B89EUL, 0x5F058808UL, 0xC60CD9B2UL, 0xB10BE924UL,
    0x2F6F7C87UL, 0x58684C11UL, 0xC1611DABUL, 0xB6662D3DUL,
    0x76DC4190UL, 0x01DB7106UL, 0x98D220BCUL, 0xEFD5102AUL,
    0x71B18589UL, 0x06B6B51FUL, 0x9FBFE4A5UL, 0xE8B8D433UL,
    0x7807C9A2UL, 0x0F00F934UL, 0x9609A88EUL, 0xE10E9818UL,
    0x7F6A0DBFUL, 0x086D3D2DUL, 0x91646C97UL, 0xE6635C01UL,
    0x6B6B51F4UL, 0x1C6C6162UL, 0x856530D8UL, 0xF262004EUL,
    0x6C0695EDUL, 0x1B01A57BUL, 0x8208F4C1UL, 0xF50FC457UL,
    0x65B0D9C6UL, 0x12B7E950UL, 0x8BBEB8EAUL, 0xFCB9887CUL,
    0x62DD1DDFUL, 0x15DA2D49UL, 0x8CD37CF3UL, 0xFBD44C65UL,
    0x4DB26158UL, 0x3AB551CEUL, 0xA3BC0074UL, 0xD4BB30E2UL,
    0x4ADFA541UL, 0x3DD895D7UL, 0xA4D1C46DUL, 0xD3D6F4FBUL,
    0x4369E96AUL, 0x346ED9FCUL, 0xAD678846UL, 0xDA60B8D0UL,
    0x44042D73UL, 0x33031DE5UL, 0xAA0A4C5FUL, 0xDD0D7AC9UL,
    0x5005713CUL, 0x270241AAUL, 0xBE0B1010UL, 0xC90C2086UL,
    0x5768B525UL, 0x206F85B3UL, 0xB966D409UL, 0xCE61E43FUL,
    0x5EDEF90EUL, 0x29D9C998UL, 0xB0D09822UL, 0xC7D7A8B4UL,
    0x59B33D17UL, 0x2EB40D81UL, 0xB7BD5C3BUL, 0xC0BA6CADUL,
    0xEDB88320UL, 0x9ABFB3B6UL, 0x03B6E20CUL, 0x74B1D29AUL,
    0xEAD54739UL, 0x9DD277AFUL, 0x04DB2615UL, 0x73DC1683UL,
    0xE3630B12UL, 0x94643B84UL, 0x0D6D6A3EUL, 0x7A6A5AA8UL,
    0xE40ECF0BUL, 0x9309FF9DUL, 0x0A00AE27UL, 0x7D079EB1UL,
    0xF00F9344UL, 0x8708A3D2UL, 0x1E01F268UL, 0x6906C2FEUL,
    0xF762575DUL, 0x806567CBUL, 0x196C3671UL, 0x6E6B06E7UL,
    0xFED41B76UL, 0x89D32BE0UL, 0x10DA7A5AUL, 0x67DD4ACCUL,
    0xF9B9DF6FUL, 0x8EBEEFF9UL, 0x17B7BE43UL, 0x60B08ED5UL,
    0xD6D6A3E8UL, 0xA1D1937EUL, 0x38D8C2C4UL, 0x4FDFF252UL,
    0xD1BB67F1UL, 0xA6BC5767UL, 0x3FB506DDUL, 0x48B2364BUL,
    0xD80D2BDAUL, 0xAF0A1B4CUL, 0x36034AF6UL, 0x41047A60UL,
    0xDF60EFC3UL, 0xA8670955UL, 0x31685818UL, 0x4660688EUL,
    0xB04AE6B7UL, 0xC849D721UL, 0x5F40869BUL, 0x284A9F0DUL,
    0xB6CF4012UL, 0xC1C87084UL, 0x5EC1213EUL, 0x29C4B7A8UL,
    0xB9E02C39UL, 0xCED917AFUL, 0x57D04A15UL, 0x20D77683UL,
    0xBE132120UL, 0xC91451B6UL, 0x5013420CUL, 0x2714769AUL,
    0xB5AABC22UL, 0xC2AD8CB4UL, 0x5AA4D50EUL, 0x2DA3E498UL,
    0xB3476D3BUL, 0xC44072ADUL, 0x5D491A17UL, 0x2A4E2B81UL,
    0xC0CA8264UL, 0xB7CDC9F2UL, 0x2EC44848UL, 0x59C378DEUL,
    0xC79A2F7DUL, 0xB09D1FBBUL, 0x279A4901UL, 0x509D7997UL,
    0xC0250806UL, 0xB7221890UL, 0x2E2B492AUL, 0x5929CBACUL,
    0xC76C51A3UL, 0xB06B6135UL, 0x2962308FUL, 0x5E650019UL,
    0xD9AE4413UL, 0xAEA97485UL, 0x37A0253FUL, 0x40A715A9UL,
    0xD6C3800AUL, 0xA1C4B09CUL, 0x38CDE126UL, 0x4FCAD1B0UL,
    0xDF75CC21UL, 0xA872FCB7UL, 0x3179AD0DUL, 0x467E9D9BUL,
    0xD8FC0838UL, 0xAFFB38AEUL, 0x36F24F14UL, 0x41F57F82UL,
    0xC4C2565BUL, 0xB3C566CDUL, 0x2ACC3777UL, 0x5DCB07E1UL,
    0xC38DFC42UL, 0xB48AECD4UL, 0x2D83BD6EUL, 0x5A84ADF8UL,
    0xCA3B1069UL, 0xBD3C20FFUL, 0x24352145UL, 0x533611D3UL,
    0xCD528470UL, 0xBA55B4E6UL, 0x235C055CUL, 0x545B35CAUL
};

uint32_t eeprom_crc32(const uint8_t* data, size_t length) {
    uint32_t crc = 0xFFFFFFFFUL;
    for (size_t i = 0; i < length; i++) {
        crc = crc32_table[(crc ^ data[i]) & 0xFF] ^ (crc >> 8);
    }
    return crc ^ 0xFFFFFFFFUL;
}

// ============================================================
// Init
// ============================================================
void eeprom_init() {
    g_prefs_state.begin(EEPROM_NS_STATE, false);
    g_prefs_calib.begin(EEPROM_NS_CALIB, false);
    g_prefs_boot.begin(EEPROM_NS_BOOT, false);
    g_prefs_timers.begin(EEPROM_NS_TIMERS, false);
    g_prefs_user.begin(EEPROM_NS_USER, false);

    // Load write count
    g_write_count = g_prefs_boot.getUInt("wr_count", 0);

    LOG_I("EEPROM", "NVS State Manager initialized (%u writes lifetime)", g_write_count);
    LOG_I("EEPROM", "Free NVS entries: %u", (unsigned)eeprom_get_free_entries());
}

// ============================================================
// Loop - handle debounced saves
// ============================================================
void eeprom_loop() {
    if (g_state_dirty && g_cached_valid) {
        unsigned long now = millis();
        if (now - g_state_dirty_time >= EEPROM_SAVE_DEBOUNCE_MS) {
            eeprom_save_actuator_state(g_cached_state);
            g_state_dirty = false;
            LOG_D("EEPROM", "Deferred actuator state saved");
        }
    }
}

// ============================================================
// Actuator State Persistence
// ============================================================
void eeprom_save_actuator_state(const ActuatorSnapshot& state) {
    // Serialize to bytes + CRC
    g_prefs_state.putUChar("version", EEPROM_VERSION);

    for (int i = 0; i < MAX_LIGHTS; i++) {
        String prefix = "l" + String(i);
        g_prefs_state.putBool((prefix + "_on").c_str(), state.lights[i].on);
        g_prefs_state.putUChar((prefix + "_br").c_str(), state.lights[i].brightness);
    }

    g_prefs_state.putBool("fan_on", state.fan.on);
    g_prefs_state.putUChar("fan_spd", state.fan.speed);

    g_prefs_state.putBool("ac_on", state.ac.on);
    g_prefs_state.putChar("ac_temp", state.ac.temperature);
    g_prefs_state.putString("ac_mode", state.ac.mode);
    g_prefs_state.putString("ac_fan", state.ac.fan_speed);

    g_prefs_state.putUChar("neo_bri", state.neo_brightness);
    g_prefs_state.putUChar("scene", state.active_scene);

    // CRC over the raw struct
    uint32_t crc = eeprom_crc32((const uint8_t*)&state, sizeof(ActuatorSnapshot));
    g_prefs_state.putUInt("crc", crc);

    g_write_count++;
    g_prefs_boot.putUInt("wr_count", g_write_count);

    LOG_D("EEPROM", "Actuator state saved (CRC: 0x%08X)", crc);
}

bool eeprom_load_actuator_state(ActuatorSnapshot& state) {
    uint8_t version = g_prefs_state.getUChar("version", 0);
    if (version == 0) {
        LOG_W("EEPROM", "No saved actuator state found");
        return false;
    }
    if (version != EEPROM_VERSION) {
        LOG_W("EEPROM", "State version mismatch (stored=%d, current=%d), skipping", version, EEPROM_VERSION);
        return false;
    }

    for (int i = 0; i < MAX_LIGHTS; i++) {
        String prefix = "l" + String(i);
        state.lights[i].on         = g_prefs_state.getBool((prefix + "_on").c_str(), false);
        state.lights[i].brightness = g_prefs_state.getUChar((prefix + "_br").c_str(), 255);
    }

    state.fan.on    = g_prefs_state.getBool("fan_on", false);
    state.fan.speed = g_prefs_state.getUChar("fan_spd", 0);

    state.ac.on          = g_prefs_state.getBool("ac_on", false);
    state.ac.temperature = g_prefs_state.getChar("ac_temp", 24);
    String mode = g_prefs_state.getString("ac_mode", "cool");
    strncpy(state.ac.mode, mode.c_str(), sizeof(state.ac.mode) - 1);
    String fan = g_prefs_state.getString("ac_fan", "auto");
    strncpy(state.ac.fan_speed, fan.c_str(), sizeof(state.ac.fan_speed) - 1);

    state.neo_brightness = g_prefs_state.getUChar("neo_bri", NEOPIXEL_BRIGHTNESS);
    state.active_scene   = g_prefs_state.getUChar("scene", 0);

    // Verify CRC
    uint32_t stored_crc = g_prefs_state.getUInt("crc", 0);
    uint32_t calc_crc   = eeprom_crc32((const uint8_t*)&state, sizeof(ActuatorSnapshot));

    if (stored_crc != 0 && stored_crc != calc_crc) {
        LOG_W("EEPROM", "CRC mismatch! Stored=0x%08X Calc=0x%08X — data may be corrupted", stored_crc, calc_crc);
        // Still return data but warn; user can decide to factory reset
    }

    LOG_I("EEPROM", "Actuator state loaded: %d lights, fan=%s, AC=%s scene=%d",
          MAX_LIGHTS, state.fan.on ? "ON" : "OFF", state.ac.on ? "ON" : "OFF", state.active_scene);
    return true;
}

void eeprom_mark_state_dirty() {
    g_state_dirty = true;
    g_state_dirty_time = millis();
}

// ============================================================
// Sensor Calibration
// ============================================================
void eeprom_save_calibration(const SensorCalibration& cal) {
    g_prefs_calib.putFloat("mq135_r0",  cal.mq135_r0);
    g_prefs_calib.putFloat("mq2_thr",   cal.mq2_threshold);
    g_prefs_calib.putFloat("sct_cal",   cal.sct013_factor);
    g_prefs_calib.putFloat("dht_t_off", cal.dht_temp_offset);
    g_prefs_calib.putFloat("dht_h_off", cal.dht_humidity_offset);
    g_prefs_calib.putFloat("tank_h",    cal.water_tank_height);
    g_prefs_calib.putBool("valid", true);

    g_write_count++;
    LOG_I("EEPROM", "Sensor calibration saved");
}

bool eeprom_load_calibration(SensorCalibration& cal) {
    if (!g_prefs_calib.getBool("valid", false)) {
        LOG_I("EEPROM", "No saved calibration, using defaults");
        cal.mq135_r0          = MQ135_R0;
        cal.mq2_threshold     = MQ2_THRESHOLD;
        cal.sct013_factor     = SCT013_CALIBRATION;
        cal.dht_temp_offset   = DHT_TEMP_OFFSET;
        cal.dht_humidity_offset = DHT_HUMIDITY_OFFSET;
        cal.water_tank_height = WATER_TANK_HEIGHT_CM;
        return false;
    }

    cal.mq135_r0          = g_prefs_calib.getFloat("mq135_r0",  MQ135_R0);
    cal.mq2_threshold     = g_prefs_calib.getFloat("mq2_thr",   MQ2_THRESHOLD);
    cal.sct013_factor     = g_prefs_calib.getFloat("sct_cal",   SCT013_CALIBRATION);
    cal.dht_temp_offset   = g_prefs_calib.getFloat("dht_t_off", DHT_TEMP_OFFSET);
    cal.dht_humidity_offset = g_prefs_calib.getFloat("dht_h_off", DHT_HUMIDITY_OFFSET);
    cal.water_tank_height = g_prefs_calib.getFloat("tank_h",    WATER_TANK_HEIGHT_CM);

    LOG_I("EEPROM", "Calibration loaded: MQ135_R0=%.2f, MQ2_thr=%.0f, SCT=%.2f",
          cal.mq135_r0, cal.mq2_threshold, cal.sct013_factor);
    return true;
}

// ============================================================
// Power Accumulators
// ============================================================
void eeprom_save_power(const PowerAccumulators& pwr) {
    g_prefs_state.putFloat("pwr_kwh",     pwr.total_kwh);
    g_prefs_state.putFloat("pwr_d_kwh",   pwr.daily_kwh);
    g_prefs_state.putFloat("pwr_m_kwh",   pwr.monthly_kwh);
    g_prefs_state.putFloat("pwr_peak",    pwr.peak_watts);
    g_prefs_state.putFloat("pwr_cal",     pwr.calibration);
    g_prefs_state.putFloat("pwr_volt",    pwr.voltage);
    g_prefs_state.putFloat("pwr_tariff",  pwr.tariff);
    g_prefs_state.putInt("pwr_day",       pwr.last_day);
    g_prefs_state.putInt("pwr_month",     pwr.last_month);

    g_write_count++;
    LOG_D("EEPROM", "Power data saved: %.3f kWh total", pwr.total_kwh);
}

bool eeprom_load_power(PowerAccumulators& pwr) {
    pwr.total_kwh   = g_prefs_state.getFloat("pwr_kwh", 0.0f);
    pwr.daily_kwh   = g_prefs_state.getFloat("pwr_d_kwh", 0.0f);
    pwr.monthly_kwh = g_prefs_state.getFloat("pwr_m_kwh", 0.0f);
    pwr.peak_watts  = g_prefs_state.getFloat("pwr_peak", 0.0f);
    pwr.calibration = g_prefs_state.getFloat("pwr_cal", SCT013_CALIBRATION);
    pwr.voltage     = g_prefs_state.getFloat("pwr_volt", VOLTAGE_SUPPLY);
    pwr.tariff      = g_prefs_state.getFloat("pwr_tariff", POWER_COST_PER_KWH);
    pwr.last_day    = g_prefs_state.getInt("pwr_day", -1);
    pwr.last_month  = g_prefs_state.getInt("pwr_month", -1);

    LOG_I("EEPROM", "Power data loaded: %.3f kWh total, %.3f daily", pwr.total_kwh, pwr.daily_kwh);
    return pwr.total_kwh > 0 || pwr.daily_kwh > 0;
}

// ============================================================
// Boot Info
// ============================================================
void eeprom_save_boot_info(const BootInfo& info) {
    g_prefs_boot.putUInt("boot_cnt",    info.boot_count);
    g_prefs_boot.putUInt("crash_cnt",   info.crash_count);
    g_prefs_boot.putUInt("wdt_cnt",     info.watchdog_resets);
    g_prefs_boot.putUInt("last_up",     info.last_uptime_sec);
    g_prefs_boot.putUChar("last_rst",   info.last_reset_reason);
    g_prefs_boot.putUInt("total_hrs",   info.total_uptime_hours);
    g_prefs_boot.putBool("safe_mode",   info.safe_mode);

    LOG_D("EEPROM", "Boot info saved: count=%u crashes=%u", info.boot_count, info.crash_count);
}

bool eeprom_load_boot_info(BootInfo& info) {
    info.boot_count       = g_prefs_boot.getUInt("boot_cnt", 0);
    info.crash_count      = g_prefs_boot.getUInt("crash_cnt", 0);
    info.watchdog_resets   = g_prefs_boot.getUInt("wdt_cnt", 0);
    info.last_uptime_sec  = g_prefs_boot.getUInt("last_up", 0);
    info.last_reset_reason = g_prefs_boot.getUChar("last_rst", 0);
    info.total_uptime_hours = g_prefs_boot.getUInt("total_hrs", 0);
    info.safe_mode        = g_prefs_boot.getBool("safe_mode", false);

    return info.boot_count > 0;
}

void eeprom_increment_boot_count() {
    BootInfo info;
    eeprom_load_boot_info(info);

    info.boot_count++;
    info.last_reset_reason = (uint8_t)esp_reset_reason();

    // Detect watchdog resets
    esp_reset_reason_t reason = esp_reset_reason();
    if (reason == ESP_RST_WDT || reason == ESP_RST_TASK_WDT || reason == ESP_RST_INT_WDT) {
        info.watchdog_resets++;
        LOG_W("EEPROM", "Watchdog reset detected! Count: %u", info.watchdog_resets);
    }

    // Detect crashes (panic / exception)
    if (reason == ESP_RST_PANIC) {
        info.crash_count++;
        LOG_E("EEPROM", "Crash/panic detected! Count: %u", info.crash_count);

        // Enter safe mode if too many consecutive crashes
        if (info.crash_count >= 3 && info.last_uptime_sec < 60) {
            info.safe_mode = true;
            LOG_E("EEPROM", "*** SAFE MODE ACTIVATED - 3+ crashes within 60s uptime ***");
        }
    } else {
        // Clean boot resets crash counter
        if (info.last_uptime_sec > 60) {
            info.crash_count = 0;
        }
    }

    eeprom_save_boot_info(info);
    LOG_I("EEPROM", "Boot #%u | Reset reason: %d | Crashes: %u | WDT resets: %u",
          info.boot_count, (int)reason, info.crash_count, info.watchdog_resets);
}

void eeprom_record_crash() {
    BootInfo info;
    eeprom_load_boot_info(info);
    info.crash_count++;
    eeprom_save_boot_info(info);
}

uint32_t eeprom_get_boot_count() {
    return g_prefs_boot.getUInt("boot_cnt", 0);
}

// ============================================================
// Scheduled Timers
// ============================================================
void eeprom_save_timers(const ScheduledTimer timers[], int count) {
    g_prefs_timers.putInt("count", count);
    for (int i = 0; i < count && i < MAX_TIMERS; i++) {
        String prefix = "t" + String(i) + "_";
        g_prefs_timers.putBool((prefix + "act").c_str(),   timers[i].active);
        g_prefs_timers.putUChar((prefix + "dev").c_str(),  timers[i].device_type);
        g_prefs_timers.putUChar((prefix + "ch").c_str(),   timers[i].channel);
        g_prefs_timers.putBool((prefix + "st").c_str(),    timers[i].target_state);
        g_prefs_timers.putUChar((prefix + "hr").c_str(),   timers[i].hour);
        g_prefs_timers.putUChar((prefix + "mn").c_str(),   timers[i].minute);
        g_prefs_timers.putUChar((prefix + "day").c_str(),  timers[i].days_mask);
        g_prefs_timers.putBool((prefix + "once").c_str(),  timers[i].one_shot);
    }
    g_write_count++;
    LOG_I("EEPROM", "Saved %d timers", count);
}

int eeprom_load_timers(ScheduledTimer timers[], int max_count) {
    int count = g_prefs_timers.getInt("count", 0);
    if (count > max_count) count = max_count;

    for (int i = 0; i < count; i++) {
        String prefix = "t" + String(i) + "_";
        timers[i].active       = g_prefs_timers.getBool((prefix + "act").c_str(), false);
        timers[i].device_type  = g_prefs_timers.getUChar((prefix + "dev").c_str(), 0);
        timers[i].channel      = g_prefs_timers.getUChar((prefix + "ch").c_str(), 0);
        timers[i].target_state = g_prefs_timers.getBool((prefix + "st").c_str(), false);
        timers[i].hour         = g_prefs_timers.getUChar((prefix + "hr").c_str(), 0);
        timers[i].minute       = g_prefs_timers.getUChar((prefix + "mn").c_str(), 0);
        timers[i].days_mask    = g_prefs_timers.getUChar((prefix + "day").c_str(), 0x7F);
        timers[i].one_shot     = g_prefs_timers.getBool((prefix + "once").c_str(), false);
    }

    LOG_I("EEPROM", "Loaded %d timers", count);
    return count;
}

void eeprom_add_timer(const ScheduledTimer& timer) {
    ScheduledTimer timers[MAX_TIMERS];
    int count = eeprom_load_timers(timers, MAX_TIMERS);

    if (count >= MAX_TIMERS) {
        LOG_W("EEPROM", "Max timers reached (%d), cannot add", MAX_TIMERS);
        return;
    }

    timers[count] = timer;
    eeprom_save_timers(timers, count + 1);
}

void eeprom_remove_timer(int index) {
    ScheduledTimer timers[MAX_TIMERS];
    int count = eeprom_load_timers(timers, MAX_TIMERS);

    if (index < 0 || index >= count) return;

    // Shift remaining timers down
    for (int i = index; i < count - 1; i++) {
        timers[i] = timers[i + 1];
    }
    eeprom_save_timers(timers, count - 1);
    LOG_I("EEPROM", "Timer %d removed", index);
}

ScheduledTimer eeprom_get_timer(int index) {
    ScheduledTimer timers[MAX_TIMERS];
    int count = eeprom_load_timers(timers, MAX_TIMERS);
    if (index >= 0 && index < count) {
        return timers[index];
    }
    ScheduledTimer empty = {};
    return empty;
}

void eeprom_save_timer(int index, const ScheduledTimer& timer) {
    ScheduledTimer timers[MAX_TIMERS];
    int count = eeprom_load_timers(timers, MAX_TIMERS);

    // Expand array if needed
    if (index >= count && index < MAX_TIMERS) {
        // Fill gap with inactive timers
        for (int i = count; i <= index; i++) {
            memset(&timers[i], 0, sizeof(ScheduledTimer));
        }
        count = index + 1;
    }

    if (index >= 0 && index < MAX_TIMERS) {
        timers[index] = timer;
        eeprom_save_timers(timers, count);
        LOG_I("EEPROM", "Timer %d saved", index);
    }
}

// ============================================================
// User Preferences
// ============================================================
UserPreferences eeprom_get_defaults() {
    UserPreferences p;
    p.log_level              = 0;  // LOG_DEBUG
    p.neo_brightness         = NEOPIXEL_BRIGHTNESS;
    p.buzzer_enabled         = true;
    p.auto_night_mode        = false;
    p.mqtt_publish_interval  = INTERVAL_MQTT_PUB;
    p.ws_broadcast_interval  = 3000;
    p.deep_sleep_enabled     = DEEP_SLEEP_ENABLED;
    p.deep_sleep_duration    = DEEP_SLEEP_DURATION;
    p.auto_restore_state     = true;
    p.motion_alerts_enabled  = true;
    p.gas_alerts_enabled     = true;
    p.water_alerts_enabled   = true;
    p.power_alerts_enabled   = true;
    return p;
}

void eeprom_save_preferences(const UserPreferences& prefs) {
    g_prefs_user.putUChar("log_lvl",     prefs.log_level);
    g_prefs_user.putUChar("neo_bri",     prefs.neo_brightness);
    g_prefs_user.putBool("buz_en",       prefs.buzzer_enabled);
    g_prefs_user.putBool("auto_night",   prefs.auto_night_mode);
    g_prefs_user.putUShort("mqtt_int",   prefs.mqtt_publish_interval);
    g_prefs_user.putUShort("ws_int",     prefs.ws_broadcast_interval);
    g_prefs_user.putBool("ds_en",        prefs.deep_sleep_enabled);
    g_prefs_user.putUShort("ds_dur",     prefs.deep_sleep_duration);
    g_prefs_user.putBool("auto_rest",    prefs.auto_restore_state);
    g_prefs_user.putBool("al_motion",    prefs.motion_alerts_enabled);
    g_prefs_user.putBool("al_gas",       prefs.gas_alerts_enabled);
    g_prefs_user.putBool("al_water",     prefs.water_alerts_enabled);
    g_prefs_user.putBool("al_power",     prefs.power_alerts_enabled);
    g_prefs_user.putBool("valid", true);

    g_write_count++;
    LOG_I("EEPROM", "User preferences saved");
}

bool eeprom_load_preferences(UserPreferences& prefs) {
    if (!g_prefs_user.getBool("valid", false)) {
        prefs = eeprom_get_defaults();
        return false;
    }

    prefs.log_level              = g_prefs_user.getUChar("log_lvl", 0);
    prefs.neo_brightness         = g_prefs_user.getUChar("neo_bri", NEOPIXEL_BRIGHTNESS);
    prefs.buzzer_enabled         = g_prefs_user.getBool("buz_en", true);
    prefs.auto_night_mode        = g_prefs_user.getBool("auto_night", false);
    prefs.mqtt_publish_interval  = g_prefs_user.getUShort("mqtt_int", INTERVAL_MQTT_PUB);
    prefs.ws_broadcast_interval  = g_prefs_user.getUShort("ws_int", 3000);
    prefs.deep_sleep_enabled     = g_prefs_user.getBool("ds_en", DEEP_SLEEP_ENABLED);
    prefs.deep_sleep_duration    = g_prefs_user.getUShort("ds_dur", DEEP_SLEEP_DURATION);
    prefs.auto_restore_state     = g_prefs_user.getBool("auto_rest", true);
    prefs.motion_alerts_enabled  = g_prefs_user.getBool("al_motion", true);
    prefs.gas_alerts_enabled     = g_prefs_user.getBool("al_gas", true);
    prefs.water_alerts_enabled   = g_prefs_user.getBool("al_water", true);
    prefs.power_alerts_enabled   = g_prefs_user.getBool("al_power", true);

    LOG_I("EEPROM", "User preferences loaded");
    return true;
}

// ============================================================
// Scene persistence
// ============================================================
void eeprom_save_scene(uint8_t scene) {
    g_prefs_state.putUChar("scene", scene);
}

uint8_t eeprom_load_scene() {
    return g_prefs_state.getUChar("scene", 0);
}

// ============================================================
// Error logging
// ============================================================
void eeprom_save_last_error(const String& error) {
    g_prefs_boot.putString("last_err", error);
    g_prefs_boot.putUInt("err_time", (uint32_t)(millis() / 1000));
}

String eeprom_load_last_error() {
    return g_prefs_boot.getString("last_err", "");
}

// ============================================================
// Factory Reset
// ============================================================
void eeprom_factory_reset() {
    LOG_W("EEPROM", "*** FACTORY RESET - Erasing all NVS data ***");

    g_prefs_state.clear();
    g_prefs_calib.clear();
    g_prefs_boot.clear();
    g_prefs_timers.clear();
    g_prefs_user.clear();

    // Also clear the main 'nexus' namespace used by utils.cpp
    Preferences mainPrefs;
    mainPrefs.begin(EEPROM_NAMESPACE, false);
    mainPrefs.clear();
    mainPrefs.end();

    g_write_count = 0;
    LOG_I("EEPROM", "Factory reset complete. Rebooting recommended.");
}

void eeprom_clear_namespace(const char* ns) {
    Preferences p;
    p.begin(ns, false);
    p.clear();
    p.end();
    LOG_I("EEPROM", "Cleared namespace: %s", ns);
}

// ============================================================
// Diagnostics
// ============================================================
size_t eeprom_get_free_entries() {
    nvs_stats_t stats;
    if (nvs_get_stats(NULL, &stats) == ESP_OK) {
        return stats.free_entries;
    }
    return 0;
}

size_t eeprom_get_used_entries() {
    nvs_stats_t stats;
    if (nvs_get_stats(NULL, &stats) == ESP_OK) {
        return stats.used_entries;
    }
    return 0;
}

uint32_t eeprom_get_write_count() {
    return g_write_count;
}

String eeprom_get_stats_json() {
    JsonDocument doc;

    nvs_stats_t stats;
    if (nvs_get_stats(NULL, &stats) == ESP_OK) {
        doc["total_entries"] = stats.total_entries;
        doc["used_entries"]  = stats.used_entries;
        doc["free_entries"]  = stats.free_entries;
        doc["namespace_count"] = stats.namespace_count;
    }

    doc["write_count"]   = g_write_count;
    doc["eeprom_version"] = EEPROM_VERSION;

    // Boot info
    BootInfo bi;
    if (eeprom_load_boot_info(bi)) {
        JsonObject boot = doc["boot"].to<JsonObject>();
        boot["count"]          = bi.boot_count;
        boot["crashes"]        = bi.crash_count;
        boot["wdt_resets"]     = bi.watchdog_resets;
        boot["last_uptime"]    = bi.last_uptime_sec;
        boot["total_hours"]    = bi.total_uptime_hours;
        boot["safe_mode"]      = bi.safe_mode;

        const char* reasons[] = {"Unknown", "PowerOn", "ExtPin", "Software",
                                 "Panic", "IntWDT", "TaskWDT", "WDT",
                                 "DeepSleep", "Brownout", "SDIO"};
        int ri = bi.last_reset_reason;
        boot["last_reset"] = (ri >= 0 && ri <= 10) ? reasons[ri] : "Unknown";
    }

    // Timer count
    doc["timer_count"] = g_prefs_timers.getInt("count", 0);

    // Last error
    String lastErr = eeprom_load_last_error();
    if (lastErr.length() > 0) {
        doc["last_error"] = lastErr;
    }

    String output;
    serializeJson(doc, output);
    return output;
}
