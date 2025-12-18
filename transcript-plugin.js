(function(videojs) {
  'use strict';

  videojs.registerPlugin('interactiveTranscript', function(options) {
    var player = this;
    var transcriptContainer;
    var activeTrack = null;
    var isVisible = false;
    
    function createTranscriptButton() {
      // Modern Video.js button creation
      var Button = videojs.getComponent('Button');
      
      var TranscriptButton = function() {
        Button.call(this, player);
      };
      
      TranscriptButton.prototype = Object.create(Button.prototype);
      TranscriptButton.prototype.constructor = TranscriptButton;
      
      TranscriptButton.prototype.buildCSSClass = function() {
        return 'vjs-transcript-button vjs-control vjs-button';
      };
      
      TranscriptButton.prototype.handleClick = function() {
        toggleTranscript();
      };
      
      TranscriptButton.prototype.createEl = function() {
        var el = Button.prototype.createEl.call(this, 'button');
        el.innerHTML = '<span class="vjs-icon-placeholder" aria-hidden="true">T</span><span class="vjs-control-text" aria-live="polite">Transcript</span>';
        return el;
      };
      
      videojs.registerComponent('TranscriptButton', TranscriptButton);
      player.getChild('controlBar').addChild('TranscriptButton', {});
      
      console.log('Transcript button added to control bar');
    }
    
    function toggleTranscript() {
      isVisible = !isVisible;
      
      if (isVisible) {
        transcriptContainer.style.display = 'block';
        var btn = player.el().querySelector('.vjs-transcript-button');
        if (btn) btn.classList.add('vjs-transcript-button-active');
        console.log('Transcript shown');
      } else {
        transcriptContainer.style.display = 'none';
        var btn = player.el().querySelector('.vjs-transcript-button');
        if (btn) btn.classList.remove('vjs-transcript-button-active');
        console.log('Transcript hidden');
      }
    }
    
    function createTranscriptUI() {
      transcriptContainer = document.createElement('div');
      transcriptContainer.className = 'vjs-transcript-container';
      transcriptContainer.style.display = 'none';
      transcriptContainer.innerHTML = '<div class="vjs-transcript-header">Transcript <span class="vjs-transcript-close">×</span><span class="vjs-transcript-status">Loading...</span></div><div class="vjs-transcript-content"></div>';
      
      player.el().appendChild(transcriptContainer);
      
      var closeBtn = transcriptContainer.querySelector('.vjs-transcript-close');
      closeBtn.addEventListener('click', function() {
        toggleTranscript();
      });
      
      console.log('Transcript UI created');
    }
    
    function renderCues(track) {
      var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
      var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
      var cues = track.cues;
      
      if (!cues || cues.length === 0) {
        console.log('Still no cues available');
        return false;
      }
      
      console.log('SUCCESS! Rendering', cues.length, 'cues');
      statusElement.textContent = '(' + cues.length + ' lines)';
      transcriptContent.innerHTML = '';
      
      for (var j = 0; j < cues.length; j++) {
        var cue = cues[j];
        var cueElement = document.createElement('p');
        cueElement.className = 'vjs-transcript-cue';
        cueElement.setAttribute('data-start', cue.startTime);
        cueElement.setAttribute('data-end', cue.endTime);
        
        var text = cue.text || '';
        text = text.replace(/<[^>]*>/g, '');
        text = text.replace(/\n/g, ' ');
        cueElement.textContent = text;
        
        cueElement.addEventListener('click', function() {
          var startTime = parseFloat(this.getAttribute('data-start'));
          player.currentTime(startTime);
          player.play();
        });
        
        transcriptContent.appendChild(cueElement);
      }
      
      return true;
    }
    
    function waitForCues(track, attempt) {
      attempt = attempt || 0;
      var maxAttempts = 20;
      
      console.log('Attempt', attempt + 1, '- Checking for cues...');
      
      if (renderCues(track)) {
        console.log('Transcript loaded successfully!');
        return;
      }
      
      if (attempt >= maxAttempts) {
        var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
        var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
        statusElement.textContent = 'Failed to load';
        transcriptContent.innerHTML = '<p style="padding: 15px; color: #ff6b6b;">Captions failed to load. Try playing the video.</p>';
        console.error('Failed to load captions after', maxAttempts, 'attempts');
        return;
      }
      
      setTimeout(function() {
        waitForCues(track, attempt + 1);
      }, 500);
    }
    
    function loadTranscript() {
      var tracks = player.textTracks();
      var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
      var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
      
      console.log('Total text tracks found:', tracks.length);
      
      var foundTrack = null;
      for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        console.log('Track', i + ':', track.kind, track.label, track.language, 'mode:', track.mode);
        
        if (track.kind === 'captions' || track.kind === 'subtitles') {
          foundTrack = track;
          console.log('Using track:', track.label || track.kind);
          break;
        }
      }
      
      if (!foundTrack) {
        statusElement.textContent = 'No captions found';
        transcriptContent.innerHTML = '<p style="padding: 15px; color: #999;">This video does not have captions.</p>';
        console.warn('No caption tracks found on this video');
        return;
      }
      
      activeTrack = foundTrack;
      foundTrack.mode = 'hidden';
      
      foundTrack.addEventListener('load', function() {
        console.log('Track load event fired');
        waitForCues(foundTrack);
      });
      
      foundTrack.addEventListener('cuechange', function() {
        console.log('Track cuechange event fired');
        if (transcriptContent.children.length === 0) {
          waitForCues(foundTrack);
        }
      });
      
      waitForCues(foundTrack);
    }
    
    function highlightActiveCue() {
      player.on('timeupdate', function() {
        if (!transcriptContainer || !isVisible) {
          return;
        }
        
        var currentTime = player.currentTime();
        var cues = transcript
