// Constants
const PLUGIN_PATH = LiteLoader.plugins["gpt_reply"].path.plugin;
const ICON_PATH = "res/openai_tooltip.svg";

// Variables
let gptThinking = false;
let messageEl;
let appended = true;

// Utility Functions
function log(...args) {
  console.log(`[GPT-Reply]`, ...args);
}

/**
 * 获取并设置图标
 * @param {string} iconPath - 图标路径
 * @param {HTMLElement} element - 要设置图标的元素
 * @param {string} [id=null] - 可选，设置到图标的ID
 */
function fetchIcon(iconPath, element, id = null) {
  fetch(`local:///${PLUGIN_PATH}/${iconPath}`)
    .then((response) => response.text())
    .then((data) => {
      element.innerHTML = data;
      if (id) {
        element.querySelector("svg").id = id;
      }
    });
}

/**
 * 观察指定元素并执行回调
 * @param {string} selector - 选择器
 * @param {Function} callback - 元素出现时的回调函数
 * @param {boolean} [continuous=false] - 是否持续观察
 */
function observeElement(selector, callback, continuous = false) {
  let elementExists = false;
  const timer = setInterval(() => {
    const element = document.querySelector(selector);
    if (element && !elementExists) {
      elementExists = true;
      callback();
      if (!continuous) clearInterval(timer);
    } else if (!element) {
      elementExists = false;
    }
  }, 100);
}

/**
 * 获取GPT回复
 * @param {string} prompt - 用户输入的提示
 * @param {Function} callback - 回复结果的回调函数
 */
async function getGPTResponse(prompt, callback) {
  try {
    const settings = await gpt_reply.getSettings();
    const response = await gpt_reply.getGPTReply({
      system_message: settings.system_message,
      prompt: prompt,
      model: settings.model,
    });
    callback({ code: 200, data: response });
  } catch (error) {
    log("[回复错误]", error);
    callback({ code: -1, message: error.message });
  }
}

/**
 * 流式获取GPT回复
 * @param {string} prompt - 用户输入的提示
 * @param {string} streamElementId - 显示流式数据的HTML元素ID
 */
async function streamGPTResponse(prompt, streamElementId, customSystemMessage = null) {
  const settings = await gpt_reply.getSettings();
  const params = {
      system_message: customSystemMessage || settings.system_message,
      prompt: prompt,
      model: settings.model,
      request_id: Date.now().toString(),
  };
  window.gpt_reply.streamGPTReply(params, streamElementId);
}

/**
 * 创建工具栏图标
 * @param {string} iconPath - 图标路径
 * @param {string} innerText - 图标内的文字
 * @param {Function} clickEvent - 点击事件
 * @param {Function} [mouseEnterEvent] - 鼠标进入事件
 * @param {Function} [mouseLeaveEvent] - 鼠标离开事件
 * @returns {HTMLElement} 创建的图标元素
 */
function createBarIcon(
  iconPath,
  innerText,
  clickEvent,
  mouseEnterEvent,
  mouseLeaveEvent
) {
  const qTooltips = document.createElement("div");
  const qTooltipsContent = document.createElement("div");
  const icon = document.createElement("i");
  const barIcon = document.createElement("div");

  barIcon.classList.add("gpt-reply-bar-icon");
  barIcon.appendChild(qTooltips);

  qTooltips.classList.add("gpt-reply-q-tooltips");
  qTooltips.addEventListener("click", clickEvent);
  if (mouseEnterEvent) barIcon.addEventListener("mouseenter", mouseEnterEvent);
  if (mouseLeaveEvent) barIcon.addEventListener("mouseleave", mouseLeaveEvent);

  qTooltips.appendChild(icon);
  qTooltips.appendChild(qTooltipsContent);

  qTooltipsContent.classList.add("gpt-reply-q-tooltips__content");
  qTooltipsContent.innerText = innerText;

  icon.classList.add("gpt-reply-q-icon");
  fetchIcon(iconPath, icon);

  return barIcon;
}

/**
 * 获取消息元素
 * @param {HTMLElement} target - 目标元素
 * @returns {HTMLElement} 消息内容容器元素
 */
function getMessageElement(target) {
  if (target.matches(".msg-content-container")) {
    return target;
  }
  return target.closest(".msg-content-container");
}

/**
 * 处理右键GPT回复菜单
 */
async function handleContextMenu() {
  document
      .querySelector("#ml-root .ml-list")
      .addEventListener("mousedown", async (e) => {
          if (e.button !== 2) {
              appended = true;
              return;
          }
          messageEl = getMessageElement(e.target);
          appended = false;
      });

      new MutationObserver(async () => {
        if (appended) return;
        const qContextMenu = document.querySelector(".q-context-menu");
        if (qContextMenu && messageEl) {
            const messageText = messageEl.querySelector(".message-content").innerText;
            if (!messageText) return;

            const settings = await gpt_reply.getSettings();
            const firstMenuItem = document.querySelector(".q-context-menu .q-context-menu-item");
            const separator = document.querySelector(".q-context-menu .q-context-menu-separator");

            if (settings.preset_in_context === "on" && settings.system_message_presets?.length > 0) {
              // Add menu items for each preset
              settings.system_message_presets.forEach((preset) => {
                  const menuItem = firstMenuItem.cloneNode(true);
                  menuItem.querySelector("span").innerText = `GPT (${preset.name})`;
                  fetchIcon(ICON_PATH, menuItem.querySelector(".q-icon"), "gpt-context-menu-icon");
          
                  // Create a closure with the preset message
                  const presetMessage = preset.message;
                  
                  menuItem.addEventListener("click", () => {
                      qContextMenu.style.display = "none";
                      const responseText = document.getElementById("response-text");
                      responseText.innerText = "GPT思考中...";
                      
                      // Show GPT response with the specific preset message
                      showGPTResponse(messageText, presetMessage);
                  });
          
                  qContextMenu.insertBefore(menuItem, separator);
              });
          } else {
                // Original single GPT menu item
                const menuItem = firstMenuItem.cloneNode(true);
                menuItem.querySelector("span").innerText = "GPT";
                fetchIcon(ICON_PATH, menuItem.querySelector(".q-icon"), "gpt-context-menu-icon");
                const presetMessage = settings.system_message_presets[settings.selected_preset_index].message;
                menuItem.addEventListener("click", () => {
                    qContextMenu.style.display = "none";
                    document.getElementById("response-text").innerText = "GPT思考中...";
                    showGPTResponse(messageText, presetMessage);  
                });

                qContextMenu.insertBefore(menuItem, separator);
            }
            appended = true;
        }
    }).observe(document.body, { childList: true });
}
/**
 * 聊天框GPT回复
 */
async function initializeResponseArea() {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = `local:///${PLUGIN_PATH}/src/style.css`;
  document.head.appendChild(style);

  const gptResponse = document.createElement("div");
  gptResponse.id = "gpt-response";
  gptResponse.zIndex = 999;
  gptResponse.innerHTML = `
        <div class="response-bar">
            <div class="response-title">GPT回复</div>
            <div class="response-buttons">
                <button id="gpt-reply-action-button" class="q-button q-button--small q-button--primary">复制</button>
                <button id="gpt-reply-cancel-button" class="q-button q-button--small q-button--secondary">取消</button>
            </div>
        </div>
        <div id="response-text"></div>
    `;

  const ckEditor = document.querySelector(".ck-editor");
  ckEditor.appendChild(gptResponse);

  const gptResponseText = document.querySelector("#response-text");
  const actionButton = document.querySelector("#gpt-reply-action-button");
  // actionButton.addEventListener("click", () => {
  //     if (actionButton.innerText === "复制") {
  //         console.log("复制")
  //         navigator.clipboard.writeText(gptResponseText.innerText);
  //     } else if (actionButton.innerText === "替换") {
  //         console.log("替换")
  //         const editor = document.querySelector(".ck-content");
  //         console.log(editor.innerText);
  //         console.log(gptResponseText.innerText);
  //         editor.innerHTML = gptResponseText.innerText.split('\n').map(line => `<p>${line}</p>`).join('');
  //         console.log(editor.innerHTML);
  //     } else if (actionButton.innerText === "发送") {
  //         console.log("发送");
  //         const editor = document.querySelector(".ck-content");
  //         editor.innerHTML = gptResponseText.innerText.split('\n').map(line => `<p>${line}</p>`).join('');

  //         document.querySelector(".send-msg").click();
  //     }

  //     hideGPTResponse();
  // });

  actionButton.addEventListener("click", () => {
    navigator.clipboard.writeText(gptResponseText.innerText);

    hideGPTResponse();
  });

  document
    .querySelector("#gpt-reply-cancel-button")
    .addEventListener("click", () => {
      hideGPTResponse();
    });

  observeElement(
    ".chat-func-bar",
    () => {
      const iconBarLeft =
        document.querySelector(".chat-func-bar").firstElementChild;
      if (iconBarLeft.querySelector(".gpt-reply-bar-icon")) return;

      const baricon = createBarIcon(ICON_PATH, "GPT回复", () => {
        if (gptThinking) return;
        const text = document.querySelector(".ck-content").innerText.trim();
        gptResponseText.innerText = text
          ? "GPT思考中..."
          : "请在聊天框中输入内容";
        showGPTResponse(text);
      });

      iconBarLeft.appendChild(baricon);
    },
    true
  );
}

/**
 * 显示GPT回复
 * @param {string} text - 用户输入的文本
 */
async function showGPTResponse(text, customSystemMessage = null) {
  const settings = await gpt_reply.getSettings();
  const actionButton = document.querySelector("#gpt-reply-action-button");
  actionButton.innerText = "复制";

  const gptResponse = document.getElementById("gpt-response");
  gptResponse.style.display = "block";
  gptResponse.animate(
      [
          { opacity: 0, transform: "translateY(20px)" },
          { opacity: 1, transform: "translateY(0px)" },
      ],
      {
          duration: 128,
          easing: "ease-out",
      }
  );

  if (!text) {
      document.getElementById("response-text").innerText = "请在聊天框中输入内容";
      return;
  }

  const openaiIsAvaliable = await gpt_reply.checkOpenAI();
  if (!openaiIsAvaliable) {
      document.getElementById("response-text").innerText = "未设置 OpenAI API Key";
      return;
  }

  // Use the custom system message if provided
  streamGPTResponse(text, "response-text", customSystemMessage);
}

/**
 * 隐藏GPT回复
 */
function hideGPTResponse() {
  const gptResponse = document.getElementById("gpt-response");
  gptResponse.animate(
    [
      { opacity: 1, transform: "translateY(0px)" },
      { opacity: 0, transform: "translateY(20px)" },
    ],
    {
      duration: 128,
      easing: "ease-in",
    }
  ).onfinish = () => {
    gptResponse.style.display = "none";
    gptThinking = false;
  };
}

observeElement("#ml-root .ml-list", handleContextMenu);
observeElement(".chat-input-area .ck-editor", initializeResponseArea);

/**
 * 设置窗口创建时的初始化
 * @param {HTMLElement} view - 设置窗口的HTML元素
 */
export const onSettingWindowCreated = async (view) => {
  try {
    const html_file_path = `local:///${PLUGIN_PATH}/src/settings.html`;

    view.innerHTML = await (await fetch(html_file_path)).text();
    const settings = await gpt_reply.getSettings();

    const openai_api_key = view.querySelector("#openai-api-key");
    const openai_base_url = view.querySelector("#openai-base-url");
    const chat_model = view.querySelectorAll('input[name="chat-model"]');
    const custom_chat_model = view.querySelector("#custom-chat-model");
    const system_message = view.querySelector("#system-message");
    const replyModeRadios = view.querySelectorAll('input[name="reply-mode"]');

    // const keep_memory = view.querySelector("#keep-memory");
    // const keep_memory_setting = view.querySelector("#keep-memory-settings");
    // if (settings.keep_memory) {
    //     keep_memory.setAttribute("is-active", "");
    //     keep_memory_setting.style.display = "block";
    // } else {
    //     keep_memory.removeAttribute("is-active");
    //     keep_memory_setting.style.display = "none";
    // }
    // keep_memory.addEventListener("click", (event) => {
    //     const isActive = event.currentTarget.hasAttribute("is-active");
    //     if (isActive) {
    //         event.currentTarget.removeAttribute("is-active");
    //         settings.keep_memory = false;
    //         keep_memory_setting.style.display = "none";
    //     } else {
    //         event.currentTarget.setAttribute("is-active", "");
    //         settings.enableRkeep_memoryemote = true;
    //         keep_memory_setting.style.display = "block";
    //     }
    //     gpt_reply.setSettings(settings);
    // });

    openai_api_key.value = settings.openai_api_key;
    openai_base_url.value = settings.openai_base_url;
    system_message.value = settings.system_message;

    // Initialize preset selector
    const presetSelector = view.querySelector("#preset-selector");
    const savePresetButton = view.querySelector("#save-preset");
    const deletePresetButton = view.querySelector("#delete-preset");

    // Populate presets
    function updatePresetSelector() {
      presetSelector.innerHTML = '<option value="">选择预设...</option>';
      settings.system_message_presets.forEach((preset, index) => {
          const option = document.createElement('option');
          option.value = index.toString();
          option.textContent = preset.name;
          presetSelector.appendChild(option);
      });
      
      if (settings.selected_preset_index !== undefined && settings.selected_preset_index !== null) {
          presetSelector.value = settings.selected_preset_index.toString();
          const selectedPreset = settings.system_message_presets[settings.selected_preset_index];
          if (selectedPreset) {
              system_message.value = selectedPreset.message;
          }
      }
    }
    updatePresetSelector();

    // Handle preset selection
    presetSelector.addEventListener("change", async () => {
      if (presetSelector.value !== "") {
        const selectedIndex = parseInt(presetSelector.value);
        const selectedPreset = settings.system_message_presets[selectedIndex];
        system_message.value = selectedPreset.message;
        settings.system_message = selectedPreset.message;
        settings.selected_preset_index = selectedIndex;  // Save the selected index
        await gpt_reply.setSettings(settings);
      } else {
        settings.selected_preset_index = null;  // Clear selection if "选择预设..." is chosen
        await gpt_reply.setSettings(settings);
      }
    });

    // Save new preset
    savePresetButton.addEventListener("click", async () => {
      try {
        // Create a temporary input dialog
        const dialog = document.createElement("div");
        dialog.style.cssText = `
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: var(--bg_bottom_light);
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              z-index: 10000;
          `;

        dialog.innerHTML = `
              <h3 style="margin: 0 0 15px 0;">输入预设名称</h3>
              <input type="text" id="preset-name-input" value="新预设" style="
                  width: 200px;
                  padding: 5px;
                  margin-bottom: 15px;
                  border: 1px solid var(--border_secondary);
                  border-radius: 4px;
                  background: var(--bg_bottom_light);
                  color: var(--text_primary);
              ">
              <div style="display: flex; gap: 10px; justify-content: flex-end;">
                  <button class="q-button q-button--small q-button--secondary" id="cancel-preset">取消</button>
                  <button class="q-button q-button--small q-button--primary" id="confirm-preset">确定</button>
              </div>
          `;

        document.body.appendChild(dialog);
        const input = dialog.querySelector("#preset-name-input");
        input.select();

        // Handle dialog actions
        return new Promise((resolve) => {
          dialog.querySelector("#cancel-preset").onclick = () => {
            document.body.removeChild(dialog);
            resolve(null);
          };

          dialog.querySelector("#confirm-preset").onclick = () => {
            const presetName = input.value.trim();
            document.body.removeChild(dialog);
            resolve(presetName);
          };

          input.onkeyup = (e) => {
            if (e.key === "Enter") {
              const presetName = input.value.trim();
              document.body.removeChild(dialog);
              resolve(presetName);
            } else if (e.key === "Escape") {
              document.body.removeChild(dialog);
              resolve(null);
            }
          };
        }).then((presetName) => {
          if (presetName) {
            if (!Array.isArray(settings.system_message_presets)) {
              settings.system_message_presets = [];
            }
            settings.system_message_presets.push({
              name: presetName,
              message: system_message.value,
            });
            gpt_reply.setSettings(settings);
            updatePresetSelector();
            presetSelector.value = (
              settings.system_message_presets.length - 1
            ).toString();
          }
        });
      } catch (error) {
        console.error("Error saving preset:", error);
      }
    });

    deletePresetButton.addEventListener("click", async () => {
      if (presetSelector.value !== "") {
        const selectedIndex = parseInt(presetSelector.value);
        const selectedPreset = settings.system_message_presets[selectedIndex];
        if (confirm(`确定要删除预设"${selectedPreset.name}"吗？`)) {
          settings.system_message_presets.splice(selectedIndex, 1);
          
          if (settings.system_message_presets.length > 0) {
            settings.selected_preset_index = 0;
            const firstPreset = settings.system_message_presets[0];
            system_message.value = firstPreset.message;
            settings.system_message = firstPreset.message;
          } else {
            settings.selected_preset_index = null;
          }
          
          await gpt_reply.setSettings(settings);
          updatePresetSelector();

          presetSelector.value = settings.system_message_presets.length > 0 ? "0" : "";
        }
      }
    });

    if (settings.model !== "gpt-4o-mini" && settings.model !== "gpt-4o") {
      custom_chat_model.value = settings.model;
    }

    chat_model.forEach((radio) => {
      if (
        radio.value === settings.model ||
        (radio.value === "custom" &&
          settings.model !== "gpt-4o-mini" &&
          settings.model !== "gpt-4o" &&
          settings.model !== "o1-preview" &&
          settings.model !== "o1-mini" &&
          settings.model !== "gpt-4o-mini-ddg" &&
          settings.model !== "llama-ddg" &&
          settings.model !== "mixtral-ddg" &&
          settings.model !== "claude-3-haiku-ddg")
      ) {
        radio.checked = true;
      } else {
        radio.checked = false;
      }
    });

    chat_model.forEach((radio) => {
      radio.addEventListener("change", async () => {
        if (radio.checked) {
          if (radio.value === "custom") {
            settings.model = custom_chat_model.value;
          } else {
            settings.model = radio.value;
          }
          await gpt_reply.setSettings(settings);
        }
      });
    });

    custom_chat_model.addEventListener("input", async () => {
      const customRadio = view.querySelector(
        'input[name="chat-model"][value="custom"]'
      );
      if (customRadio.checked) {
        settings.model = custom_chat_model.value;
        await gpt_reply.setSettings(settings);
      }
    });
    openai_api_key.addEventListener("input", async () => {
      settings.openai_api_key = openai_api_key.value;
      await gpt_reply.setSettings(settings);
    });

    openai_base_url.addEventListener("input", async () => {
      settings.openai_base_url = openai_base_url.value;
      await gpt_reply.setSettings(settings);
    });

    system_message.addEventListener("input", async () => {
      settings.system_message = system_message.value;
      await gpt_reply.setSettings(settings);
    });

    const githubLink = view.querySelector("#settings-github-link");
    githubLink.addEventListener("click", () => {
      gpt_reply.openWeb(
        "https://github.com/wangyz1999/LiteLoaderQQNT-GPT-Reply"
      );
    });

    const presetInContextRadios = view.querySelectorAll('input[name="preset-in-context"]');
    presetInContextRadios.forEach((radio) => {
        if (radio.value === settings.preset_in_context) {
            radio.checked = true;
        }
        radio.addEventListener("change", async () => {
            if (radio.checked) {
                settings.preset_in_context = radio.value;
                await gpt_reply.setSettings(settings);
            }
        });
    });
  } catch (error) {
    console.error("[设置页面错误]", error);
  }
};
