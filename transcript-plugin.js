/**
 * Brightcove Transcript Plugin
 * Displays video transcript in a side panel
 */

(function(window, videojs) {
  'use strict';

  // Default plugin options
  const defaults = {
    transcriptUrl: null, // URL to fetch transcript from
    transcriptData: null, // Direct transcript data
    buttonText: 'Transcript',
    position: 'right', // 'right' or 'left'
    width: '400px',
    autoScroll: true, // Auto-scroll transcript with video
    timestamps: true // Show timestamps in transcript
  };

  /**
   * Function to format time in seconds to readable format
   */
  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Transcript Plugin
   */
  const TranscriptPlugin = function(options) {
    const player = this;
    const settings = videojs.mergeOptions(defaults, options);
    
    let transcriptPanel = null;
    let transcriptButton = null;
    let isOpen = false;
    let transcriptData = [];

    /**
     * Initialize the plugin
     */
    function init() {
      // Create the transcript button
      createButton();
      
      // Create the transcript panel
      createPanel();
      
      // Load transcript data
      loadTranscript();
      
      // Setup event listeners
      setupEventListeners();
    }

    /**
     * Create the transcript button in control bar
     */
    function createButton() {
      const Button = videojs.getComponent('Button');
      
      const TranscriptButton = videojs.extend(Button, {
        constructor: function() {
          Button.apply(this, arguments);
          this.addClass('vjs-transcript-button');
          this.controlText('Show Transcript');
        },
        
        handleClick: function() {
          toggleTranscript();
        },
        
        buildCSSClass: function() {
          return 'vjs-transcript-button ' + Button.prototype.buildCSSClass.call(this);
        }
      });

      videojs.registerComponent('TranscriptButton', TranscriptButton);
      
      transcriptButton = player.getChild('controlBar').addChild('TranscriptButton', {}, 12);
      
      // Add icon to button
      const buttonEl = transcriptButton.el();
      buttonEl.innerHTML = `
        <span class="vjs-icon-placeholder" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </span>
        <span class="vjs-control-text" aria-live="polite">${settings.buttonText}</span>
      `;
    }

    /**
     * Create the transcript panel
     */
    function createPanel() {
      const playerEl = player.el();
      const containerEl = playerEl.parentElement;
      
      // Create wrapper if not exists
      let wrapper = containerEl.querySelector('.vjs-transcript-wrapper');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'vjs-transcript-wrapper';
        containerEl.insertBefore(wrapper, playerEl);
        wrapper.appendChild(playerEl);
      }
      
      // Create panel
      transcriptPanel = document.createElement('div');
      transcriptPanel.className = `vjs-transcript-panel vjs-transcript-${settings.position}`;
      transcriptPanel.style.width = settings.width;
      transcriptPanel.innerHTML = `
        <div class="vjs-transcript-header">
          <h3>Transcript</h3>
          <button class="vjs-transcript-close" aria-label="Close transcript">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="vjs-transcript-content">
          <div class="vjs-transcript-loading">Loading transcript...</div>
        </div>
      `;
      
      wrapper.appendChild(transcriptPanel);
      
      // Close button handler
      const closeBtn = transcriptPanel.querySelector('.vjs-transcript-close');
      closeBtn.addEventListener('click', () => toggleTranscript());
      
      // Add CSS
      addStyles();
    }

    /**
     * Load transcript data
     */
    function loadTranscript() {
      if (settings.transcriptData) {
        // Use provided transcript data
        transcriptData = settings.transcriptData;
        renderTranscript();
      } else if (settings.transcriptUrl) {
        // Fetch transcript from URL
        fetch(settings.transcriptUrl)
          .then(response => response.json())
          .then(data => {
            transcriptData = data;
            renderTranscript();
          })
          .catch(error => {
            console.error('Error loading transcript:', error);
            showError('Failed to load transcript');
          });
      } else {
        // Try to get transcript from video metadata
        const metadata = player.mediainfo || {};
        if (metadata.transcript) {
          transcriptData = metadata.transcript;
          renderTranscript();
        } else {
          showError('No transcript available');
        }
      }
    }

    /**
     * Render transcript in panel
     */
    function renderTranscript() {
      const contentEl = transcriptPanel.querySelector('.vjs-transcript-content');
      
      if (!transcriptData || transcriptData.length === 0) {
        contentEl.innerHTML = '<div class="vjs-transcript-empty">No transcript available</div>';
        return;
      }
      
      let html = '<div class="vjs-transcript-items">';
      
      transcriptData.forEach((item, index) => {
        const time = item.start || item.time || 0;
        const text = item.text || item.content || '';
        
        html += `
          <div class="vjs-transcript-item" data-time="${time}" data-index="${index}">
            ${settings.timestamps ? `<span class="vjs-transcript-time">${formatTime(time)}</span>` : ''}
            <p class="vjs-transcript-text">${text}</p>
          </div>
        `;
      });
      
      html += '</div>';
      contentEl.innerHTML = html;
      
      // Add click handlers to transcript items
      const items = contentEl.querySelectorAll('.vjs-transcript-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          const time = parseFloat(item.dataset.time);
          player.currentTime(time);
          player.play();
        });
      });
    }

    /**
     * Show error message
     */
    function showError(message) {
      const contentEl = transcriptPanel.querySelector('.vjs-transcript-content');
      contentEl.innerHTML = `<div class="vjs-transcript-error">${message}</div>`;
    }

    /**
     * Toggle transcript panel
     */
    function toggleTranscript() {
      isOpen = !isOpen;
      
      if (isOpen) {
        transcriptPanel.classList.add('vjs-transcript-open');
        transcriptButton.addClass('vjs-transcript-active');
      } else {
        transcriptPanel.classList.remove('vjs-transcript-open');
        transcriptButton.removeClass('vjs-transcript-active');
      }
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
      // Auto-scroll transcript with video playback
      if (settings.autoScroll) {
        player.on('timeupdate', () => {
          if (!isOpen) return;
          
          const currentTime = player.currentTime();
          const items = transcriptPanel.querySelectorAll('.vjs-transcript-item');
          
          // Remove active class from all items
          items.forEach(item => item.classList.remove('vjs-transcript-active'));
          
          // Find and highlight current item
          let activeItem = null;
          items.forEach(item => {
            const itemTime = parseFloat(item.dataset.time);
            if (itemTime <= currentTime) {
              activeItem = item;
            }
          });
          
          if (activeItem) {
            activeItem.classList.add('vjs-transcript-active');
            // Scroll to active item
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    }

    /**
     * Add CSS styles
     */
    function addStyles() {
      if (document.getElementById('vjs-transcript-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'vjs-transcript-styles';
      style.textContent = `
        .vjs-transcript-wrapper {
          position: relative;
          display: flex;
          gap: 0;
          max-width: 100%;
        }
        
        .vjs-transcript-panel {
          position: absolute;
          top: 0;
          height: 100%;
          background: #1a1a1a;
          color: #fff;
          overflow: hidden;
          transform: translateX(100%);
          transition: transform 0.3s ease;
          z-index: 100;
          display: flex;
          flex-direction: column;
        }
        
        .vjs-transcript-panel.vjs-transcript-right {
          right: 0;
        }
        
        .vjs-transcript-panel.vjs-transcript-left {
          left: 0;
          transform: translateX(-100%);
        }
        
        .vjs-transcript-panel.vjs-transcript-open {
          transform: translateX(0);
        }
        
        .vjs-transcript-header {
          padding: 15px 20px;
          border-bottom: 1px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .vjs-transcript-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .vjs-transcript-close {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 5px;
          display: flex;
          align-items: center;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        
        .vjs-transcript-close:hover {
          opacity: 1;
        }
        
        .vjs-transcript-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        
        .vjs-transcript-loading,
        .vjs-transcript-error,
        .vjs-transcript-empty {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }
        
        .vjs-transcript-error {
          color: #ff6b6b;
        }
        
        .vjs-transcript-item {
          margin-bottom: 20px;
          cursor: pointer;
          padding: 10px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        
        .vjs-transcript-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        
        .vjs-transcript-item.vjs-transcript-active {
          background: rgba(59, 130, 246, 0.2);
          border-left: 3px solid #3b82f6;
        }
        
        .vjs-transcript-time {
          display: inline-block;
          color: #3b82f6;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 5px;
        }
        
        .vjs-transcript-text {
          margin: 5px 0 0 0;
          line-height: 1.6;
          font-size: 15px;
        }
        
        .vjs-transcript-button .vjs-icon-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .vjs-transcript-button.vjs-transcript-active {
          color: #3b82f6;
        }
        
        @media (max-width: 768px) {
          .vjs-transcript-panel {
            width: 100% !important;
          }
          
          .vjs-transcript-wrapper {
            flex-direction: column;
          }
        }
      `;
      
      document.head.appendChild(style);
    }

    // Initialize plugin
    init();
    
    // Dispose function
    player.on('dispose', () => {
      if (transcriptPanel) {
        transcriptPanel.remove();
      }
    });
  };

  // Register the plugin with Video.js
  videojs.registerPlugin('transcript', TranscriptPlugin);

})(window, window.videojs);

/*
=================================================================
BRIGHTCOVE INSTALLATION INSTRUCTIONS
=================================================================


STEP 2: ADD PLUGIN TO BRIGHTCOVE STUDIO
----------------------------------------
1. Log into Brightcove Studio (studio.brightcove.com)
2. Go to PLAYERS module
3. Click on the player you want to add the transcript to
4. Click "Plugins" in the left navigation
5. Click "Add a Plugin" > "Custom Plugin"
6. Fill in the plugin form:
   - Plugin Name: transcript
   - JavaScript URL: https://yoursite.com/plugins/brightcove-transcript.js
   - CSS URL: (leave blank - CSS is included in JS)
7. Click "Save"
8. Click "Publish & Embed" to publish your changes

STEP 3: CONFIGURE PLUGIN OPTIONS
---------------------------------
In the Plugin Options section, add your configuration as JSON:

Option A - Provide transcript data directly:
{
  "transcriptData": [
    { "start": 0, "text": "Welcome to this video tutorial." },
    { "start": 5, "text": "Today we'll be discussing video transcripts." },
    { "start": 12, "text": "Transcripts make videos more accessible." }
  ],
  "position": "right",
  "width": "400px",
  "autoScroll": true,
  "timestamps": true
}

Option B - Load from URL (recommended for multiple videos):
{
  "transcriptUrl": "https://yoursite.com/transcripts/{videoId}.json",
  "position": "right",
  "width": "400px"
}

STEP 4: PREPARE TRANSCRIPT DATA
--------------------------------
Create JSON files for your video transcripts in this format:

[
  { "start": 0, "text": "First line of transcript." },
  { "start": 3.5, "text": "Second line of transcript." },
  { "start": 8, "text": "Third line of transcript." }
]

Store these files on your server and reference them via transcriptUrl.

ALTERNATIVE: EMBED CODE METHOD
-------------------------------
If you prefer to add the plugin via embed code:

<video-js id="myPlayerID"
  data-account="YOUR_ACCOUNT_ID"
  data-player="YOUR_PLAYER_ID"
  data-embed="default"
  controls
  data-video-id="YOUR_VIDEO_ID"
  data-playlist-id=""
  data-application-id
  class="vjs-fluid">
</video-js>
<script src="https://players.brightcove.net/YOUR_ACCOUNT_ID/YOUR_PLAYER_ID_default/index.min.js"></script>

<script>
  videojs.getPlayer('myPlayerID').ready(function() {
    var player = this;
    player.transcript({
      transcriptData: [
        { start: 0, text: "Your transcript here" }
      ],
      position: 'right',
      width: '400px'
    });
  });
</script>
