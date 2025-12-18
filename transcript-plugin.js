(function(videojs) {
  'use strict';

  videojs.registerPlugin('interactiveTranscript', function(options) {
    var player = this;
    
    // Prevent double initialization
    if (player.transcriptPluginInitialized) {
      console.log('Transcript plugin already initialized, skipping');
      return;
    }
    player.transcriptPluginInitialized = true;
    
    var transcriptContainer;
    var activeTrack = null;
    var isVisible = false;
    var transcriptButton;
    var lastCueCount = 0;
    var monitoringInterval = null;
    
    function createTranscriptButton() {
      var controlBar = player.controlBar;
      
      if (!controlBar) {
        console.error('Control bar not found');
        return;
      }
      
      transcriptButton = document.createElement('button');
      transcriptButton.className = 'vjs-control vjs-button vjs-transcript-button';
      transcriptButton.type = 'button';
      transcriptButton.title = 'Transcript';
      transcriptButton.innerHTML = '<span class="vjs-icon-placeholder" aria-hidden="true">T</span>';
      
      transcriptButton.addEventListener('click', function() {
        toggleTranscript();
      });
      
      var fullscreenToggle = player.el().querySelector('.vjs-fullscreen-control');
      if (fullscreenToggle && fullscreenToggle.parentNode) {
        fullscreenToggle.parentNode.insertBefore(transcriptButton, fullscreenToggle);
        console.log('Transcript button added to control bar');
      } else {
        var controlBarEl = player.el().querySelector('.vjs-control-bar');
        if (controlBarEl) {
          controlBarEl.appendChild(transcriptButton);
          console.log('Transcript button appended to control bar');
        }
      }
    }
    
    function toggleTranscript() {
      isVisible = !isVisible;
      
      if (isVisible) {
        transcriptContainer.style.display = 'block';
        if (transcriptButton) transcriptButton.classList.add('vjs-transcript-button-active');
        console.log('Transcript shown');
      } else {
        transcriptContainer.style.display = 'none';
        if (transcriptButton) transcriptButton.classList.remove('vjs-transcript-button-active');
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
        console.log('No cues available yet');
        return false;
      }
      
      // Check if cue count has changed
      if (cues.length === lastCueCount) {
        return true; // No change, no need to re-render
      }
      
      console.log('Rendering', cues.length, 'cues (previously had', lastCueCount, ')');
      lastCueCount = cues.length;
      
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
      
      console.log('Transcript rendered successfully with', cues.length, 'cues');
      return true;
    }
    
    function startContinuousMonitoring(track) {
      // Stop any existing monitoring
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
      
      console.log('Starting continuous cue monitoring...');
      
      // Check every 2 seconds for new cues
      monitoringInterval = setInterval(function() {
        if (track.cues && track.cues.length > lastCueCount) {
          console.log('New cues detected during playback! Updating transcript...');
          renderCues(track);
        }
      }, 2000);
      
      // Also check when video ends
      player.one('ended', function() {
        console.log('Video ended, doing final cue check...');
        setTimeout(function() {
          renderCues(track);
          if (monitoringInterval) {
            clearInterval(monitoringInterval);
            console.log('Stopped monitoring - video ended');
          }
        }, 1000);
      });
    }
    
    function waitForInitialCues(track, attempt) {
      attempt = attempt || 0;
      var maxAttempts = 20;
      
      console.log('Attempt', attempt + 1, '- Checking for initial cues...');
      
      var cues = track.cues;
      if (!cues || cues.length === 0) {
        if (attempt >= maxAttempts) {
          var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
          var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
          statusElement.textContent = 'Failed to load';
          transcriptContent.innerHTML = '<p style="padding: 15px; color: #ff6b6b;">Captions failed to load. Try playing the video.</p>';
          console.error('Failed to load captions after', maxAttempts, 'attempts');
          return;
        }
        
        setTimeout(function() {
          waitForInitialCues(track, attempt + 1);
        }, 500);
        return;
      }
      
      // We have some cues - render them and start monitoring
      console.log('Found initial', cues.length, 'cues - rendering and starting monitoring');
      renderCues(track);
      startContinuousMonitoring(track);
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
      
      // Set track to hidden mode to load cues
      foundTrack.mode = 'hidden';
      
      // Wait a moment then start checking
      setTimeout(function() {
        waitForInitialCues(foundTrack);
      }, 500);
      
      // Also update when video plays
      player.on('play', function() {
        setTimeout(function() {
          if (foundTrack.cues) {
            renderCues(foundTrack);
          }
        }, 1000);
      });
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
      
      setTimeout(function() {
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
      }, 1000);
    });
  });

})(window.videojs);
