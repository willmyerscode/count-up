/* ==========
 * Count Up Animation
 * This Code is licensed by Will-Myers.com 
========== */
(function () {
  // Configuration
  const CONFIG = {
    cssId: "wm-countup-animation",
    uniqueId: 1,
    selectors: {
      fromCode: '[data-wm-plugin="countup"]',
      fromAnchors: 'a[href*="#wm-countup"], a[href*="#wmcountup"]',
    },
  };

  // Utility Functions
  const Utils = {
    endsWithNumber(str) {
      str = str.trim();
      return isNaN(str.slice(-1)) ? str.slice(-1) : "";
    },

    isScaledText(el) {
      return el.closest(".sqsrte-scaled-text")
        ? el.closest(".sqs-block")
        : false;
    },

    emitEvent(type, detail = {}, elem = document) {
      if (!type) return;
      const event = new CustomEvent(type, {
        bubbles: true,
        cancelable: true,
        detail: detail,
      });
      return elem.dispatchEvent(event);
    },

    parseValue(el) {
      let value = el.textContent.trim();
      const suffix = this.endsWithNumber(value);
      if (suffix) value = value.slice(0, -1);
      return {
        value: value.replace(/[^0-9.-]/g, ""),
        suffix: suffix,
      };
    },

    getElementStyles(el) {
      const scaledBlock = this.isScaledText(el);
      if (!scaledBlock) return null;

      const styles = window.getComputedStyle(scaledBlock);
      return {
        fontSize: styles.fontSize,
        lineHeight: styles.lineHeight,
      };
    },
  };

  // Number Formatting Handler
  const NumberFormatter = {
    getDecimalSeparator(localeString) {
      return (1.1).toLocaleString(localeString).charAt(1);
    },

    getThousandsSeparator(localeString) {
      return (1000).toLocaleString(localeString).charAt(1);
    },

    convertToNumber(str, localeString) {
      const decimalSeparator = this.getDecimalSeparator(localeString);
      const thousandsSeparator = this.getThousandsSeparator(localeString);

      if (decimalSeparator === ",") {
        str = str.replace(/\./g, "").replace(",", ".");
      } else {
        str = str.replace(/,/g, "");
      }

      return parseFloat(str);
    },

    formatNumber(number, decimals, localeString, hasSeperator) {
      if (localeString && hasSeperator) {
        return Number(parseFloat(number).toFixed(decimals)).toLocaleString(
          localeString,
          {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }
        );
      }
      return parseFloat(number).toFixed(decimals);
      // return number;
    },
  };

  // Animation Controller
  class AnimationController {
    constructor(element, options = {}) {
      this.element = element;
      this.parsedValue = Utils.parseValue(element);

      // Only set original values if they haven't been set before
      if (!this.element.dataset.originalContent) {
        this.element.dataset.originalContent = this.element.textContent;
        this.element.dataset.originalValue = this.parsedValue.value;
        this.element.dataset.originalSuffix = this.parsedValue.suffix;
      }

      this.options = this.getOptions(options);
      this.isAnimating = false;
      this.counter = null;
      this.observer = null;
      this.setupAnimation();
      this.setupStyles();
    }

    setupStyles() {
      // Apply font-variant-numeric for browsers that support it
      this.element.style.fontVariantNumeric = "tabular-nums";
      const isScaledText = this.element.closest(".sqs-block:has(.sqsrte-scaled-text)");

      // Calculate the maximum width needed
      const formattedEnd = NumberFormatter.formatNumber(
        this.options.endNumber,
        this.options.decimals,
        this.options.localeString,
        this.options.hasSeperator
      );

      // Create a temporary span to measure the maximum width
      const temp = document.createElement("span");
      temp.style.visibility = "hidden";
      temp.style.position = "absolute";
      temp.textContent = formattedEnd + this.options.suffix;
      this.element.appendChild(temp);

      // Set fixed width and alignment
      const width = temp.offsetWidth;
      this.element.style.display = "inline-block";
      this.element.style.minWidth = `${width}px`;
      // if (isScaledText) {
      //   this.element.style.minWidth = `${isScaledText.offsetWidth}px`;
      // }
      this.element.style.textAlign = "right";

      this.element.removeChild(temp);
    }

    getOptions(options) {
      const dataset = this.element.dataset;
      const originalValue = dataset.originalValue || this.parsedValue.value;

      return {
        duration: parseInt(dataset.speed || dataset.duration) || 3000,
        fps: parseInt(dataset.fps) || 60,
        startingNumber: parseFloat(dataset.start) || 0,
        endNumber: NumberFormatter.convertToNumber(
          originalValue,
          dataset.locale
        ),
        decimals: (originalValue.split(".")[1] || "").length,
        localeString: dataset.locale || "en-US",
        hasSeperator: dataset.hasSeperator !== "false",
        suffix: dataset.originalSuffix || this.parsedValue.suffix || "",
        ...options,
      };
    }

    setupAnimation() {
      this.observer = new IntersectionObserver(
        entries => this.handleIntersection(entries),
        {rootMargin: "0px"}
      );
      this.observer.observe(this.element);
    }

    handleIntersection(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isAnimating) {
          this.start();
          // Disconnect the observer after first animation
          if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
          }
        }
      });
    }

    start() {
      if (this.isAnimating) return;

      this.isAnimating = true;
      const startTime = performance.now();
      const startValue = this.options.startingNumber;
      const endValue = this.options.endNumber;
      const duration = this.options.duration;
      const isScaledText = this.element.closest(".sqs-block:has(.sqsrte-scaled-text)");

      const updateFrame = currentTime => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const currentValue = startValue + (endValue - startValue) * progress;
        const formattedValue = NumberFormatter.formatNumber(
          currentValue,
          this.options.decimals,
          this.options.localeString,
          this.options.hasSeperator
        );

        this.element.textContent = `${formattedValue}${this.options.suffix}`;
        if (isScaledText) {
          Squarespace?.initializeScaledText(isScaledText);
        }

        if (progress < 1) {
          this.counter = requestAnimationFrame(updateFrame);
        } else {
          this.isAnimating = false;
          Utils.emitEvent(
            "wmCountUpComplete",
            {element: this.element},
            this.element
          );
          this.element.style.minWidth = '';
        }
      };

      this.counter = requestAnimationFrame(updateFrame);
    }

    stop() {
      if (this.counter) {
        cancelAnimationFrame(this.counter);
        this.counter = null;
        this.isAnimating = false;
      }
    }

    reset() {
      this.stop();
      // Use the original content from dataset
      this.element.textContent = this.element.dataset.originalContent;
      // Recalculate options to ensure we're using original values
      this.options = this.getOptions({});
      this.start();
    }

    destroy() {
      this.stop();
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.element.textContent = this.originalContent;
    }
  }

  // Plugin Manager
  class CountUpPlugin {
    constructor() {
      this.instances = new Map();
      this.init();
      this.setupMutationObserver();
    }

    /*This should handle Weglot language changes */
    setupMutationObserver() {
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          // Clean up removed nodes
          mutation.removedNodes.forEach(node => {
            if (node.nodeType === 1) {
              // Element node
              const countupElements = node.querySelectorAll(
                CONFIG.selectors.fromCode
              );
              countupElements.forEach(el => {
                const instance = this.instances.get(el);
                if (instance) {
                  instance.destroy();
                  this.instances.delete(el);
                  delete el.wmCountUp; // Explicitly remove wmCountUp
                }
              });
            }
          });

          // Initialize new nodes
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              // Element node
              // Check the node itself
              if (node.matches && node.matches(CONFIG.selectors.fromCode)) {
                this.createInstance(node);
              }
              // Check child nodes
              const countupElements = node.querySelectorAll(
                CONFIG.selectors.fromCode
              );
              countupElements.forEach(el => {
                // Always create new instance for added elements
                if (!el.wmCountUp) {
                  this.createInstance(el);
                }
              });
            }
          });
        });
      });

      // Observe the entire document for changes
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    init() {
      this.initializeElements(CONFIG.selectors.fromCode);
      this.initializeAnchors(CONFIG.selectors.fromAnchors);
      this.exposeGlobalAPI();
    }

    initializeElements(selector) {
      document.querySelectorAll(selector).forEach(el => {
        if (!el.classList.contains("loaded")) {
          this.createInstance(el);
        }
      });
    }

    initializeAnchors(selector) {
      document.querySelectorAll(selector).forEach(el => {
        if (!el.classList.contains("loaded")) {
          const converted = this.convertAnchorToCountup(el);
          this.createInstance(converted);
        }
      });
    }

    createInstance(element) {
      // Clean up any existing instance
      if (this.instances.has(element)) {
        const oldInstance = this.instances.get(element);
        oldInstance.destroy();
        this.instances.delete(element);
      }

      const instance = new AnimationController(element);
      this.instances.set(element, instance);

      // Always reattach wmCountUp methods
      element.wmCountUp = {
        stop: () => instance.stop(),
        reset: () => instance.reset(),
        destroy: () => {
          instance.destroy();
          this.instances.delete(element);
          element.classList.remove("loaded");
          delete element.wmCountUp;
        },
      };

      element.classList.add("loaded");
      return instance;
    }

    convertAnchorToCountup(anchorElement) {
      const href = anchorElement.getAttribute("href");
      const span = document.createElement("span");
      span.setAttribute("data-wm-plugin", "countup");

      // Extract URL parameters if they exist
      const urlParams = new URLSearchParams(href.slice(href.indexOf("?") + 1));
      
      const dataAttributes = [
          "speed",
          "fps",
          "start",
          "locale",
          "hasSeperator",
      ];
      
      // Check both dataset and URL parameters
      dataAttributes.forEach(attr => {
          const urlValue = urlParams.get(attr);
          if (urlValue) {
              span.dataset[attr] = urlValue;
          } else if (anchorElement.dataset[attr]) {
              span.dataset[attr] = anchorElement.dataset[attr];
          }
      });

      span.textContent = anchorElement.textContent;
      anchorElement.parentNode.replaceChild(span, anchorElement);
      return span;
    }

    exposeGlobalAPI() {
      window.wmCountUp = {
        resetAll: () => this.resetAll(),
        reset: selector => this.reset(selector),
        getInstance: element => this.instances.get(element),
        destroy: selector => this.destroy(selector),
        destroyAll: () => this.destroyAll(),
      };
    }

    resetAll() {
      this.instances.forEach(instance => instance.reset());
    }

    reset(selector) {
      const element = document.querySelector(selector);
      if (element && this.instances.has(element)) {
        this.instances.get(element).reset();
      }
    }

    destroy(selector) {
      const element = document.querySelector(selector);
      if (element && this.instances.has(element)) {
        this.instances.get(element).destroy();
        this.instances.delete(element);
        element.classList.remove("loaded");
      }
    }

    destroyAll() {
      this.instances.forEach((instance, element) => {
        instance.destroy();
        element.classList.remove("loaded");
      });
      this.instances.clear();
    }
  }

  // Initialize the plugin
  new CountUpPlugin();
})();
