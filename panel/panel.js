import {
  AsyncLocalStorage,
  DeviceManager,
  RemoteCDMManager,
  SettingsManager,
  Util,
} from "../lib/util.js";

const key_container = document.getElementById("key-container");

// ================ Main ================
const enabled = document.getElementById("enabled");
enabled.addEventListener("change", async function () {
  await SettingsManager.setEnabled(enabled.checked);
});

const toggle = document.getElementById("darkModeToggle");
toggle.addEventListener("change", async () => {
  SettingsManager.setDarkMode(toggle.checked);
  await SettingsManager.saveDarkMode(toggle.checked);
});

const wvd_select = document.getElementById("wvd_select");
wvd_select.addEventListener("change", async function () {
  if (wvd_select.checked) {
    await SettingsManager.saveSelectedDeviceType("WVD");
  }
});

const remote_select = document.getElementById("remote_select");
remote_select.addEventListener("change", async function () {
  if (remote_select.checked) {
    await SettingsManager.saveSelectedDeviceType("REMOTE");
  }
});

const export_button = document.getElementById("exportLogs");
export_button.addEventListener("click", async function () {
  const logs = await AsyncLocalStorage.getStorage(null);
  SettingsManager.downloadFile(
    new Blob([JSON.stringify(logs)], {
      type: "application/json;charset=utf-8",
    }),
    "logs.json",
  );
});

const clear_logs = document.getElementById("clearLogs");
clear_logs.addEventListener("click", function () {
  AsyncLocalStorage.clearStorage();
});
// ======================================

// ================ Widevine Device ================
const fileInput = document.getElementById("fileInput");
fileInput.addEventListener("click", () => {
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
    chrome.runtime.sendMessage({ type: "OPEN_PICKER_WVD_MOBILE" });
  } else {
    chrome.runtime.sendMessage({ type: "OPEN_PICKER_WVD" });
  }
  window.close();
});

const remove = document.getElementById("remove");
remove.addEventListener("click", async function () {
  await DeviceManager.removeSelectedWidevineDevice();
  wvd_combobox.innerHTML = "";
  await DeviceManager.loadSetAllWidevineDevices();
  const selected_option = wvd_combobox.options[wvd_combobox.selectedIndex];
  if (selected_option) {
    await DeviceManager.saveSelectedWidevineDevice(selected_option.text);
  } else {
    await DeviceManager.removeSelectedWidevineDeviceKey();
  }
});

const download = document.getElementById("download");
download.addEventListener("click", async function () {
  const widevine_device = await DeviceManager.getSelectedWidevineDevice();
  SettingsManager.downloadFile(
    Util.b64.decode(await DeviceManager.loadWidevineDevice(widevine_device)),
    widevine_device + ".wvd",
  );
});

const wvd_combobox = document.getElementById("wvd-combobox");
wvd_combobox.addEventListener("change", async function () {
  await DeviceManager.saveSelectedWidevineDevice(
    wvd_combobox.options[wvd_combobox.selectedIndex].text,
  );
});
// =================================================

// ================ Remote CDM ================
document.getElementById("remoteInput").addEventListener("click", () => {
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
    chrome.runtime.sendMessage({ type: "OPEN_PICKER_REMOTE_MOBILE" });
  } else {
    chrome.runtime.sendMessage({ type: "OPEN_PICKER_REMOTE" });
  }
  window.close();
});

const remote_remove = document.getElementById("remoteRemove");
remote_remove.addEventListener("click", async function () {
  await RemoteCDMManager.removeSelectedRemoteCDM();
  remote_combobox.innerHTML = "";
  await RemoteCDMManager.loadSetAllRemoteCDMs();
  const selected_option =
    remote_combobox.options[remote_combobox.selectedIndex];
  if (selected_option) {
    await RemoteCDMManager.saveSelectedRemoteCDM(selected_option.text);
  } else {
    await RemoteCDMManager.removeSelectedRemoteCDMKey();
  }
});

const remote_download = document.getElementById("remoteDownload");
remote_download.addEventListener("click", async function () {
  const remote_cdm = await RemoteCDMManager.getSelectedRemoteCDM();
  SettingsManager.downloadFile(
    await RemoteCDMManager.loadRemoteCDM(remote_cdm),
    remote_cdm + ".json",
  );
});

const remote_combobox = document.getElementById("remote-combobox");
remote_combobox.addEventListener("change", async function () {
  await RemoteCDMManager.saveSelectedRemoteCDM(
    remote_combobox.options[remote_combobox.selectedIndex].text,
  );
});
// ============================================

// ================ Command Options ================
const use_shaka = document.getElementById("use-shaka");
use_shaka.addEventListener("change", async function () {
  await SettingsManager.saveUseShakaPackager(use_shaka.checked);
});

const downloader_name = document.getElementById("downloader-name");
downloader_name.addEventListener("input", async function () {
  await SettingsManager.saveExecutableName(downloader_name.value);
});

const downloader_args = document.getElementById("downloader-args");
downloader_args.addEventListener("input", async function () {
  await SettingsManager.saveAdditionalArguments(downloader_args.value);
});
// =================================================

// ================ Keys ================
const clear = document.getElementById("clear");
clear.addEventListener("click", async function () {
  chrome.runtime.sendMessage({ type: "CLEAR" });
  key_container.innerHTML = "";
});

async function createCommand(json, key_string) {
  const metadata = JSON.parse(json);
  const headerString = Object.entries(metadata.headers)
    .map(([key, value]) => `-H "${key}: ${value.replace(/"/g, "'")}"`)
    .join(" ");
  const executableName = await SettingsManager.getExecutableName();
  const useShaka = await SettingsManager.getUseShakaPackager();
  const additionalArgs = await SettingsManager.getAdditionalArguments();
  return `${executableName} "${metadata.url}" ${headerString} ${key_string} ${useShaka ? "--use-shaka-packager " : ""}${additionalArgs}`;
}

async function appendLog(result) {
  const key_string = result.keys
    .map((key) => `--key ${key.kid}:${key.k}`)
    .join(" ");
  const date = new Date(result.timestamp * 1000);
  const date_string = date.toLocaleString();

  const logContainer = document.createElement("div");
  logContainer.classList.add("log-card");
  logContainer.innerHTML = `
        <div class="log-header">
            <button class="toggleButton">+</button>
            <span style="font-size: 0.85rem; font-weight: 500; truncate; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${result.url}</span>
        </div>
        <div class="expandableDiv collapsed">
            <label class="right-bound">
                URL:<input type="text" class="text-box" value="${result.url}" readonly>
            </label>
            <label class="right-bound">
                PSSH:<input type="text" class="text-box" value="${result.pssh_data}" readonly>
            </label>
            <label class="right-bound copy-label">
                <a href="#" title="Click to copy" class="key-copy-btn">Keys (Click to copy)</a>
                <input type="text" class="text-box" value="${key_string}" readonly>
            </label>
            <label class="right-bound">
                Date:<input type="text" class="text-box" value="${date_string}" readonly>
            </label>
            ${
              result.manifests.length > 0
                ? `
            <label class="right-bound copy-label">
                <a href="#" title="Click to copy" class="manifest-copy-btn">Manifest (Click to copy)</a>
                <select id="manifest" class="text-box"></select>
            </label>
            <label class="right-bound copy-label">
                <a href="#" title="Click to copy" class="command-copy-btn">Cmd (Click to copy)</a>
                <input type="text" id="command" class="text-box" readonly>
            </label>`
                : ""
            }
        </div>`;

  const keysBtn = logContainer.querySelector(".key-copy-btn");
  keysBtn.addEventListener("click", (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(key_string);
    keysBtn.innerText = "Keys (Copied!)";
    setTimeout(() => (keysBtn.innerText = "Keys (Click to copy)"), 2000);
  });

  if (result.manifests.length > 0) {
    const commandInput = logContainer.querySelector("#command");
    const select = logContainer.querySelector("#manifest");

    select.addEventListener("change", async () => {
      commandInput.value = await createCommand(select.value, key_string);
    });

    result.manifests.forEach((manifest) => {
      const option = new Option(
        `[${manifest.type}] ${manifest.url}`,
        JSON.stringify(manifest),
      );
      select.add(option);
    });
    commandInput.value = await createCommand(select.value, key_string);

    const manifestBtn = logContainer.querySelector(".manifest-copy-btn");
    manifestBtn.addEventListener("click", (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(JSON.parse(select.value).url);
      manifestBtn.innerText = "Manifest (Copied!)";
      setTimeout(
        () => (manifestBtn.innerText = "Manifest (Click to copy)"),
        2000,
      );
    });

    const commandBtn = logContainer.querySelector(".command-copy-btn");
    commandBtn.addEventListener("click", (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(commandInput.value);
      commandBtn.innerText = "Cmd (Copied!)";
      setTimeout(() => (commandBtn.innerText = "Cmd (Click to copy)"), 2000);
    });
  }

  const logHeader = logContainer.querySelector(".log-header");
  const toggleBtn = logContainer.querySelector(".toggleButton");
  const expandableDiv = logContainer.querySelector(".expandableDiv");

  logHeader.addEventListener("click", () => {
    const isCollapsed = expandableDiv.classList.contains("collapsed");
    if (isCollapsed) {
      toggleBtn.innerHTML = "−";
      expandableDiv.classList.remove("collapsed");
      expandableDiv.style.display = "flex"; // Ensure flex in dark mode
    } else {
      toggleBtn.innerHTML = "+";
      expandableDiv.classList.add("collapsed");
      expandableDiv.style.display = "none";
    }
  });

  key_container.appendChild(logContainer);
}

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local") {
    for (const [key, values] of Object.entries(changes)) {
      await appendLog(values.newValue);
    }
  }
});

function checkLogs() {
  chrome.runtime.sendMessage({ type: "GET_LOGS" }, (response) => {
    if (response) {
      response.forEach(async (result) => {
        await appendLog(result);
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  enabled.checked = await SettingsManager.getEnabled();
  SettingsManager.setDarkMode(await SettingsManager.getDarkMode());
  use_shaka.checked = await SettingsManager.getUseShakaPackager();
  downloader_name.value = await SettingsManager.getExecutableName();
  downloader_args.value = await SettingsManager.getAdditionalArguments();
  SettingsManager.setSelectedDeviceType(
    await SettingsManager.getSelectedDeviceType(),
  );
  await DeviceManager.loadSetAllWidevineDevices();
  await DeviceManager.selectWidevineDevice(
    await DeviceManager.getSelectedWidevineDevice(),
  );
  await RemoteCDMManager.loadSetAllRemoteCDMs();
  await RemoteCDMManager.selectRemoteCDM(
    await RemoteCDMManager.getSelectedRemoteCDM(),
  );
  checkLogs();
});
// ======================================
