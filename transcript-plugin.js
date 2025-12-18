(function(videojs) {
  'use strict';

  videojs.registerPlugin('interactiveTranscript', function(options) {
    var player = this;
    var transcriptContainer;
    var activeTrack = null;
    var isVisible = false;
    
    function createTranscriptButton() {
      var Button = videojs.getComponent('Button');
      var TranscriptButton = videojs.extend(Button, {
        constructor: function() {
          Button.apply(this, arguments);
          this.controlText('Transcript');
        },
        buildCSSClass: function() {
          return 'vjs-transcript-button vjs-control vjs-button';
        },
        handleClick: function() {
          toggleTranscript();
        }
      });
      
      videojs.registerComponent('TranscriptButton', TranscriptButton);
      player.getChild('controlBar').addChild('TranscriptButton', {}, 14);
      
      console.log('Transcript button added to control bar');
    }
    
    function toggleTranscript() {
      isVisible = !isVisible;
      
      if (isVisible) {
        transcriptContainer.style.display = 'block';
        player.el().querySelector('.vjs-transcript-button').classList.add('vjs-transcript-button-active');
        console.log('Transcript shown');
      } else {
        transcriptContainer.style.display = 'none';
        player.el().querySelector('.vjs-transcript-button').classList.remove('vjs-transcript-button-active');
        console.log('Transcript hidden');
      }
    }
    
    function createTranscriptUI() {
      transcriptContainer = document.createElement('div');
      transcriptContainer.className = 'vjs-transcript-container';
      transcriptContainer.style.display = 'none'; // Hidden by default
      transcriptContainer.innerHTML = '<div class="vjs-transcript-header">Transcript <span class="vjs-transcript-close">×</span><span class="vjs-transcript-status">Loading...</span></div><div class="vjs-transcript-content"></div>';
      
      // Append to player element so it overlays
      player.el().appendChild(transcriptContainer);
      
      // Add close button functionality
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
        var cues = transcriptContainer.querySelectorAll('.vjs-transcript-cue');
        
        for (var i = 0; i < cues.length; i++) {
          var cue = cues[i];
          var startTime = parseFloat(cue.getAttribute('data-start'));
          var endTime = parseFloat(cue.getAttribute('data-end'));
          
          if (currentTime >= startTime && currentTime < endTime) {
            cue.classList.add('vjs-transcript-active');
            if (transcriptContainer.scrollTop > cue.offsetTop - 100 || transcriptContainer.scrollTop < cue.offsetTop - transcriptContainer.clientHeight + 100) {
              cue.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else {
            cue.classList.remove('vjs-transcript-active');
          }
        }
      });
    }
    
    player.ready(function() {
      console.log('Player ready, initializing transcript plugin');
      createTranscriptButton();
      createTranscriptUI();
      
      player.on('loadedmetadata', function() {
        console.log('Player metadata loaded, loading transcript...');
        loadTranscript();
        highlightActiveCue();
      });
      
      if (player.readyState() >= 1) {
        console.log('Player already has metadata, loading transcript now...');
        loadTranscript();
        highlightActiveCue();
      }
    });
  });

})(window.videojs);
