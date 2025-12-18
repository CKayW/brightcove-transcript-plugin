(function(videojs) {
  'use strict';

  videojs.registerPlugin('interactiveTranscript', function(options) {
    var player = this;
    var transcriptContainer;
    var activeTrack = null;
    var isVisible = false;
    var transcriptButton;
    var lastCueCount = 0;
    
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
    
    function renderCues(track, forceRender) {
      var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
      var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
      var cues = track.cues;
      
      if (!cues || cues.length === 0) {
        console.log('No cues available yet');
        return false;
      }
      
      // Check if cue count has changed (more cues loaded)
      if (cues.length === lastCueCount && !forceRender) {
        console.log('Cue count unchanged:', cues.length);
        return true; // Already rendered these
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
    
    function waitForAllCues(track, attempt) {
      attempt = attempt || 0;
      var maxAttempts = 40; // Increase to 20 seconds
      
      console.log('Attempt', attempt + 1, '- Checking for cues...');
      
      var cues = track.cues;
      if (!cues || cues.length === 0) {
        console.log('No cues yet, waiting...');
        
        if (attempt >= maxAttempts) {
          var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
          var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
          statusElement.textContent = 'Failed to load';
          transcriptContent.innerHTML = '<p style="padding: 15px; color: #ff6b6b;">Captions failed to load. Try playing the video.</p>';
          console.error('Failed to load captions after', maxAttempts, 'attempts');
          return;
        }
        
        setTimeout(function() {
          waitForAllCues(track, attempt + 1);
        }, 500);
        return;
      }
      
      // We have some cues, but let's wait to see if more load
      var currentCueCount = cues.length;
      console.log('Found', currentCueCount, 'cues, waiting to see if more load...');
      
      // Wait a bit longer to see if more cues come in
      setTimeout(function() {
        var newCueCount = track.cues ? track.cues.length : 0;
        
        if (newCueCount > currentCueCount) {
          console.log('More cues loaded (', newCueCount, '), checking again...');
          waitForAllCues(track, 0); // Reset attempt counter
        } else if (attempt < 5) {
          // Still in first few attempts, give it more time
          console.log('Same cue count, but still early - waiting more...');
          waitForAllCues(track, attempt + 1);
        } else {
          // Cue count stable, render what we have
          console.log('Cue count stable at', newCueCount, '- rendering now');
          renderCues(track, true);
          
          // Keep monitoring for late-loading cues
          monitorForMoreCues(track);
        }
      }, 500);
    }
    
    function monitorForMoreCues(track) {
      // Check periodically if more cues load after initial render
      var checkInterval = setInterval(function() {
        if (track.cues && track.cues.length > lastCueCount) {
          console.log('Additional cues detected! Re-rendering...');
          renderCues(track, true);
        }
      }, 2000);
      
      // Stop checking after 30 seconds
      setTimeout(function() {
        clearInterval(checkInterval);
        console.log('Stopped monitoring for additional cues');
      }, 30000);
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
      
      // Listen for track load event
      foundTrack.addEventListener('load', function() {
        console.log('Track load event fired');
        waitForAllCues(foundTrack);
      });
      
      // Start checking for cues
      waitForAllCues(foundTrack);
      
      // Also try when video starts playing (sometimes cues load then)
      player.one('play', function() {
        console.log('Video started playing, re-checking cues...');
        setTimeout(function() {
          if (foundTrack.cues) {
            renderCues(foundTrack, true);
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
        
        // Wait longer before loading transcript
        player.on('loadedmetadata', function() {
          console.log('Player metadata loaded');
          setTimeout(function() {
            console.log('Loading transcript...');
            loadTranscript();
            highlightActiveCue();
          }, 1000);
        });
        
        if (player.readyState() >= 1) {
          console.log('Player already has metadata');
          setTimeout(function() {
            console.log('Loading transcript...');
            loadTranscript();
            highlightActiveCue();
          }, 1000);
        }
      }, 1000);
    });
  });

})(window.videojs);
