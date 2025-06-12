const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Main = imports.ui.main; // Required for Main.notify

// Keep a single Soup.SessionAsync for all applets
let _httpSession = null;
function getHttpSession() {
    if (_httpSession == null) {
        _httpSession = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
    }
    return _httpSession;
}


function AICompanionApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

AICompanionApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("dialog-information-symbolic");
        this.set_applet_label("AI");

        this.settings = new Applet.AppletSettings(this, "AICompanionApplet@cinnamonai", instance_id);

        this.settings.bindProperty(Applet.BindingDirection.IN, "chatgptApiKey", "chatgptApiKey", this._onSettingsChanged, null);
        this.settings.bindProperty(Applet.BindingDirection.IN, "geminiApiKey", "geminiApiKey", this._onSettingsChanged, null);
        this.settings.bindProperty(Applet.BindingDirection.IN, "deepseekApiKey", "deepseekApiKey", this._onSettingsChanged, null);

        this._loadApiKeys(); // Load and check keys initially
        this._errorSimulationCounter = 0; // Initialize error simulation counter

        this._promptDialog = null;

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new Applet.AppletPopupMenu(this, orientation);
        this._menuManager.addMenu(this._menu);

        this._addMenuItems();
    },

    _onSettingsChanged: function() {
        // This function is called when settings change.
        // We need to re-read the API keys and update menu items.
        this._loadApiKeys();
        this._addMenuItems(); // Rebuild menu to reflect key status
    },

    _loadApiKeys: function() {
        this._chatgptApiKey = this.settings.getValue('chatgptApiKey');
        this._geminiApiKey = this.settings.getValue('geminiApiKey');
        this._deepseekApiKey = this.settings.getValue('deepseekApiKey');

        if (!this._chatgptApiKey) {
            Main.notify("AI Companion: ChatGPT API key is missing. ChatGPT features will be disabled.");
        }
        if (!this._geminiApiKey) {
            Main.notify("AI Companion: Gemini API key is missing. Gemini features will be disabled.");
        }
        if (!this._deepseekApiKey) {
            Main.notify("AI Companion: DeepSeek API key is missing. DeepSeek features will be disabled.");
        }
    },

    on_applet_clicked: function() {
        this._menu.toggle();
    },

    _addMenuItems: function() {
        this._menu.removeAll();

        // ChatGPT
        let askChatItem = new PopupMenu.PopupIconMenuItem("Ask ChatGPT", "dialog-question-symbolic", St.IconType.SYMBOLIC);
        if (this._chatgptApiKey) {
            askChatItem.connect('activate', Lang.bind(this, function() {
                if (!this._promptDialog) {
                    this._promptDialog = new PromptDialog("Ask ChatGPT", this._askChatGPT.bind(this));
                } else {
                    this._promptDialog.titleLabel.set_text("Ask ChatGPT");
                    this._promptDialog._askFunction = this._askChatGPT.bind(this);
                }
                this._promptDialog.open();
            }));
        } else {
            askChatItem.setSensitive(false);
            askChatItem.actor.tooltip_text = "ChatGPT API Key is missing in settings.";
        }
        this._menu.addMenuItem(askChatItem);

        // Gemini
        let askGeminiItem = new PopupMenu.PopupIconMenuItem("Ask Gemini", "dialog-question-symbolic", St.IconType.SYMBOLIC);
        if (this._geminiApiKey) {
            askGeminiItem.connect('activate', Lang.bind(this, function() {
                if (!this._promptDialog) {
                    this._promptDialog = new PromptDialog("Ask Gemini", this._askGemini.bind(this));
                } else {
                    this._promptDialog.titleLabel.set_text("Ask Gemini");
                    this._promptDialog._askFunction = this._askGemini.bind(this);
                }
                this._promptDialog.open();
            }));
        } else {
            askGeminiItem.setSensitive(false);
            askGeminiItem.actor.tooltip_text = "Gemini API Key is missing in settings.";
        }
        this._menu.addMenuItem(askGeminiItem);

        // DeepSeek
        let askDeepSeekItem = new PopupMenu.PopupIconMenuItem("Ask DeepSeek", "dialog-question-symbolic", St.IconType.SYMBOLIC);
        if (this._deepseekApiKey) {
            askDeepSeekItem.connect('activate', Lang.bind(this, function() {
                if (!this._promptDialog) {
                    this._promptDialog = new PromptDialog("Ask DeepSeek", this._askDeepSeek.bind(this));
                } else {
                    this._promptDialog.titleLabel.set_text("Ask DeepSeek");
                    this._promptDialog._askFunction = this._askDeepSeek.bind(this);
                }
                this._promptDialog.open();
            }));
        } else {
            askDeepSeekItem.setSensitive(false);
            askDeepSeekItem.actor.tooltip_text = "DeepSeek API Key is missing in settings.";
        }
        this._menu.addMenuItem(askDeepSeekItem);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menu.addMenuItem(new PopupMenu.PopupMenuItem("Test Item 1"));
        this._menu.addMenuItem(new PopupMenu.PopupMenuItem("Test Item 2"));
    },

    _askChatGPT: function(prompt, dialog) { // Added dialog parameter
        if (!this._chatgptApiKey) {
            if (dialog) dialog.setError("ChatGPT API Key is not set in applet settings.");
            else Main.notify("Error", "ChatGPT API Key is not set in applet settings."); // Fallback
            return;
        }

        const url = "https://api.openai.com/v1/chat/completions";
        const params = { model: "gpt-3.5-turbo", messages: [{ "role": "user", "content": prompt }] };
        global.log(`Simulating ChatGPT API call to ${url} with key ${this._chatgptApiKey.substring(0,5)}...`);

        this._errorSimulationCounter++;
        switch (this._errorSimulationCounter % 5) {
            case 1: // Invalid API Key
                dialog.setError("Authentication Error: Invalid API Key provided for ChatGPT.");
                return;
            case 2: // Network Error
                dialog.setError("Network Error: Could not connect to ChatGPT server (simulated).");
                return;
            case 3: // Rate Limit
                dialog.setError("API Error: Rate limit exceeded for ChatGPT (simulated).");
                return;
            case 4: // Malformed response
                const malformedResponse = { "data": "incomplete" };
                try {
                    const text = malformedResponse.choices[0].message.content; // This will fail
                    dialog.setResponse(text);
                } catch (e) {
                    dialog.setError("Failed to parse malformed ChatGPT response: " + e.message);
                    global.logError("AICompanionApplet: Malformed ChatGPT response: " + JSON.stringify(malformedResponse));
                }
                return;
            default: // Successful response
                const simulatedResponse = {
                    choices: [{ message: { content: `Simulated ChatGPT response #${this._errorSimulationCounter}: Hello there!` } }]
                };
                try {
                    if (!simulatedResponse.choices || !simulatedResponse.choices[0] || !simulatedResponse.choices[0].message || !simulatedResponse.choices[0].message.content) {
                        dialog.setError("Received an empty or invalid response structure from ChatGPT (simulated).");
                        global.logError("AICompanionApplet: Invalid ChatGPT response structure: " + JSON.stringify(simulatedResponse));
                        return;
                    }
                    const responseText = simulatedResponse.choices[0].message.content;
                    if (!responseText.trim()) {
                        dialog.setError("Received an empty response from ChatGPT (simulated).");
                        return;
                    }
                    dialog.setResponse(responseText);
                } catch (e) {
                    dialog.setError("Failed to parse simulated ChatGPT response: " + e.message);
                    global.logError("AICompanionApplet: Error parsing ChatGPT response: " + e);
                }
                break;
        }
    },

    _askGemini: function(prompt, dialog) {
        if (!this._geminiApiKey) {
            if (dialog) dialog.setError("Gemini API Key is not set in applet settings.");
            else Main.notify("Error", "Gemini API Key is not set in applet settings."); // Fallback
            return;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this._geminiApiKey.substring(0,5)}...`;
        global.log(`Simulating Gemini API call to ${url}`);

        this._errorSimulationCounter++; // Use the same counter for simplicity
        switch (this._errorSimulationCounter % 4) { // Fewer cases for brevity
            case 1:
                dialog.setError("API Error: Invalid API Key for Gemini (simulated).");
                return;
            case 2:
                dialog.setError("API Error: Gemini service unavailable (simulated).");
                return;
            case 3: // Malformed Gemini response
                const malformedGeminiResp = { "candidates": [{ "content": { "parts": [{ "no_text_here": "oops" }] } }] };
                 try {
                    const text = malformedGeminiResp.candidates[0].content.parts[0].text; // This should be undefined or error
                    if (!text) throw new Error("Text field missing in Gemini response part.");
                    dialog.setResponse(text);
                } catch (e) {
                    dialog.setError("Failed to parse malformed Gemini response: " + e.message);
                    global.logError("AICompanionApplet: Malformed Gemini response: " + JSON.stringify(malformedGeminiResp));
                }
                return;
            default: // Successful Gemini response
                const simulatedGeminiResponse = {
                    candidates: [{ content: { parts: [{ text: `Simulated Gemini response #${this._errorSimulationCounter}: Hi from Gemini!` }] } }]
                };
                try {
                    if (!simulatedGeminiResponse.candidates || !simulatedGeminiResponse.candidates[0] ||
                        !simulatedGeminiResponse.candidates[0].content || !simulatedGeminiResponse.candidates[0].content.parts ||
                        !simulatedGeminiResponse.candidates[0].content.parts[0] || !simulatedGeminiResponse.candidates[0].content.parts[0].text) {
                        dialog.setError("Received an empty or invalid response structure from Gemini (simulated).");
                        global.logError("AICompanionApplet: Invalid Gemini response structure: " + JSON.stringify(simulatedGeminiResponse));
                        return;
                    }
                    const responseText = simulatedGeminiResponse.candidates[0].content.parts[0].text;
                     if (!responseText.trim()) {
                        dialog.setError("Received an empty response from Gemini (simulated).");
                        return;
                    }
                    dialog.setResponse(responseText);
                } catch (e) {
                    dialog.setError("Failed to parse simulated Gemini response: " + e.message);
                    global.logError("AICompanionApplet: Error parsing Gemini response: " + e);
                }
                break;
        }
    },

    _askDeepSeek: function(prompt, dialog) {
        if (!this._deepseekApiKey) {
            if (dialog) dialog.setError("DeepSeek API Key is not set in applet settings.");
            else Main.notify("Error", "DeepSeek API Key is not set in applet settings."); // Fallback
            return;
        }

        const url = "https://api.deepseek.com/v1/chat/completions";
        global.log(`Simulating DeepSeek API call to ${url} with key ${this._deepseekApiKey.substring(0,5)}...`);

        this._errorSimulationCounter++; // Use the same counter
        switch (this._errorSimulationCounter % 3) { // Fewer cases
            case 1:
                dialog.setError("API Error: Daily quota exceeded for DeepSeek (simulated).");
                return;
            case 2: // Malformed or empty content
                const malformedDSResponse = { choices: [{ message: { content: "" } }] }; // Empty content
                 try {
                    const text = malformedDSResponse.choices[0].message.content;
                    if (!text.trim()) { // Check if empty after trimming
                        dialog.setError("Received an empty message content from DeepSeek (simulated).");
                        return;
                    }
                    dialog.setResponse(text);
                } catch (e) {
                    dialog.setError("Failed to parse or handle response from DeepSeek: " + e.message);
                    global.logError("AICompanionApplet: Malformed/Empty DeepSeek response: " + JSON.stringify(malformedDSResponse));
                }
                return;
            default: // Successful DeepSeek response (structure assumed similar to OpenAI)
                const simulatedDSResponse = {
                    choices: [{ message: { content: `Simulated DeepSeek response #${this._errorSimulationCounter}: Greetings from DeepSeek!` } }]
                };
                try {
                     if (!simulatedDSResponse.choices || !simulatedDSResponse.choices[0] || !simulatedDSResponse.choices[0].message || !simulatedDSResponse.choices[0].message.content) {
                        dialog.setError("Received an empty or invalid response structure from DeepSeek (simulated).");
                        global.logError("AICompanionApplet: Invalid DeepSeek response structure: " + JSON.stringify(simulatedDSResponse));
                        return;
                    }
                    const responseText = simulatedDSResponse.choices[0].message.content;
                    if (!responseText.trim()) {
                        dialog.setError("Received an empty response from DeepSeek (simulated).");
                        return;
                    }
                    dialog.setResponse(responseText);
                } catch (e) {
                    dialog.setError("Failed to parse simulated DeepSeek response: " + e.message);
                    global.logError("AICompanionApplet: Error parsing DeepSeek response: " + e);
                }
                break;
        }
    }
};

// Define the PromptDialog class
const PromptDialog = class extends ModalDialog.ModalDialog {
    constructor(title, askFunction) {
        super({ style_class: 'ai-companion-dialog' });
        this._askFunction = askFunction;
        this.titleLabel = new St.Label({ text: title, style_class: 'dialog-title' });

        this._sendButton = {
            label: "Send",
            action: Lang.bind(this, this._onSendClicked)
        };
        this._closeButton = {
            label: "Close",
            action: Lang.bind(this, this.close),
            key: Clutter.KEY_Escape
        };

        this.setButtons([this._sendButton, this._closeButton]);

        let content = new St.BoxLayout({ vertical: true, spacing: 10, style_class: 'ai-companion-dialog-content' });
                label: "Close",
                action: Lang.bind(this, this.close),
                key: Clutter.KEY_Escape // Allow closing with Escape key
            }
        ]);

        let content = new St.BoxLayout({ vertical: true, spacing: 10, style_class: 'ai-companion-dialog-content' });
        this.contentLayout.add_actor(content); // this.contentLayout is the main content area of ModalDialog

        content.add_actor(this.titleLabel); // Add the title label

        this.promptEntry = new St.Entry({
            hint_text: "Enter your prompt here...",
            can_focus: true,
            style_class: 'ai-companion-prompt-entry', // For potential styling
            x_expand: true,
        });
        this.promptEntry.connect('activate', Lang.bind(this, this._onSendClicked)); // Send on Enter key
        content.add_actor(this.promptEntry);

        this.responseScrollView = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            style_class: 'ai-companion-response-scrollview', // For potential styling
            overlay_scrollbars: true,
            x_expand: true,
            y_expand: true,
            height: 200 // Set a default height for the scroll view
        });
        content.add_actor(this.responseScrollView);

        this.responseLabel = new St.Label({ text: "Awaiting prompt...", style_class: 'ai-companion-response-label' });
        this.responseLabel.clutter_text.set_selectable(true);
        this.responseLabel.clutter_text.set_line_wrap(true);
        this.responseLabel.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.responseScrollView.add_actor(this.responseLabel);
    }

    open() {
        this.responseLabel.set_text("Awaiting prompt...");
        this.promptEntry.set_text("");
        this._setSendButtonSensitive(true); // Ensure send button is enabled when opening
        super.open(global.get_current_time(), true);
        this.promptEntry.grab_key_focus();
    }

    _onSendClicked() {
        const prompt = this.promptEntry.get_text();
        if (!prompt.trim()) {
            this.setError("Please enter a prompt."); // Use setError for consistency
            return;
        }
        this.responseLabel.set_text("Waiting for response...");
        this._setSendButtonSensitive(false); // Disable send button

        // Simulate a short delay for the feeling of a request
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._askFunction(prompt, this);
            // The _askFunction is now responsible for calling _setSendButtonSensitive(true)
            // or dialog.setResponse/setError which should also re-enable the button.
            return GLib.SOURCE_REMOVE; // Run only once
        });
    }

    _setSendButtonSensitive(sensitive) {
        // The actual button object is stored in this._buttonLayout.get_children()
        // Need to find it by label if not directly accessible.
        // For ModalDialog, buttons are added to this._buttonLayout
        if (this._buttonLayout) {
            let buttons = this._buttonLayout.get_children();
            for (let button of buttons) {
                if (button.label === "Send") {
                    button.set_sensitive(sensitive);
                    break;
                }
            }
        }
    }

    setResponse(text) {
        this.responseLabel.set_text(text);
        this.responseLabel.remove_style_class_name('error-label'); // Ensure not styled as error
        this._setSendButtonSensitive(true);
    }

    setError(text) {
        this.responseLabel.set_text("Error: " + text);
        this.responseLabel.add_style_class_name('error-label'); // Add a style for errors (e.g., red text)
                                                              // This would require defining 'error-label' in stylesheet.css if we had one.
                                                              // For now, it just prefixes with "Error: "
        this._setSendButtonSensitive(true);
    }
};


function main(metadata, orientation, panel_height, instance_id) {
    return new AICompanionApplet(orientation, panel_height, instance_id);
}
