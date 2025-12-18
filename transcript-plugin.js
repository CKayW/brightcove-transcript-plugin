(function(videojs) {
  'use strict';

  videojs.registerPlugin('interactiveTranscript', function(options) {
    var player = this;
    
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
    var loadingComplete = false;
    
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
        console.log('Transcript button added');
      } else {
        var controlBarEl = player.el().querySelector('.vjs-control-bar');
        if (controlBarEl) {
          controlBarEl.appendChild(transcriptButton);
        }
      }
    }
    
    function toggleTranscript() {
      isVisible = !isVisible;
      
      if (isVisible) {
        transcriptContainer.style.display = 'block';
        if (transcriptButton) transcriptButton.classList.add('vjs-transcript-button-active');
      } else {
        transcriptContainer.style.display = 'none';
        if (transcriptButton) transcriptButton.classList.remove('vjs-transcript-button-active');
      }
    }
    
    function createTranscriptUI() {
      transcriptContainer = document.createElement('div');
      transcriptContainer.className = 'vjs-transcript-container';
      transcriptContainer.style.display = 'none';
      transcriptContainer.innerHTML = '<div class="vjs-transcript-header">Transcript <span class="vjs-transcript-close">×</span><span class="vjs-transcript-status">Loading full transcript...</span></div><div class="vjs-transcript-content"></div>';
      
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
        return false;
      }
      
      if (cues.length === lastCueCount && loadingComplete) {
        return true;
      }
      
      console.log('Rendering', cues.length, 'cues (previously', lastCueCount, ')');
      lastCueCount = cues.length;
      
      if (loadingComplete) {
        statusElement.textContent = '(' + cues.length + ' lines)';
      } else {
        statusElement.textContent = 'Loading... (' + cues.length + ' lines so far)';
      }
      
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
    
    function forceLoadAllCues(track) {
      console.log('Force loading all cues by seeking through entire video...');
      
      var duration = player.duration();
      var currentTime = player.currentTime();
      var wasPlaying = !player.paused();
      
      console.log('Video duration:', duration.toFixed(1), 'seconds');
      
      if (wasPlaying) {
        player.pause();
      }
      
      // Set track to showing to force load
      track.mode = 'showing';
      
      // Seek through video every 15 seconds
      var seekInterval = 15; // seconds
      var seekPoints = [];
      
      for (var t = 0; t <= duration; t += seekInterval) {
        seekPoints.push(t);
      }
      
      // Make sure we hit the very end
      if (seekPoints[seekPoints.length - 1] < duration - 1) {
        seekPoints.push(duration - 0.5);
      }
      
      console.log('Will seek to', seekPoints.length, 'points in video');
      
      var seekIndex = 0;
      
      function seekNext() {
        if (seekIndex < seekPoints.length) {
          var seekTo = seekPoints[seekIndex];
          console.log('Seeking to', seekTo.toFixed(1), 's... (', (seekIndex + 1), 'of', seekPoints.length, ')');
          player.currentTime(seekTo);
          
          // Update UI with current progress
          var cueCount = track.cues ? track.cues.length : 0;
          console.log('  -> Cues loaded so far:', cueCount);
          renderCues(track);
          
          seekIndex++;
          setTimeout(seekNext, 400); // Wait 400ms between seeks
        } else {
          // Done seeking, restore state
          console.log('Finished seeking through video');
          
          track.mode = 'hidden';
          player.currentTime(currentTime);
          
          if (wasPlaying) {
            player.play();
          }
          
          // Final render
          setTimeout(function() {
            loadingComplete = true;
            var finalCount = track.cues ? track.cues.length : 0;
            renderCues(track);
            console.log('✓ Final transcript loaded with', finalCount, 'cues');
            
            if (finalCount < 200) {
              console.warn('⚠ Expected ~265 cues but only got', finalCount, '- some captions may be missing');
            }
          }, 1000);
        }
      }
      
      // Start seeking
      seekNext();
    }
    
    function loadTranscript() {
      var tracks = player.textTracks();
      var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
      var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
      
      console.log('Total text tracks found:', tracks.length);
      
      var foundTrack = null;
      for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        console.log('Track', i + ':', track.kind, track.label, track.language);
        
        if (track.kind === 'captions' || track.kind === 'subtitles') {
          foundTrack = track;
          console.log('Using track:', track.label || track.kind);
          break;
        }
      }
      
      if (!foundTrack) {
        statusElement.textContent = 'No captions found';
        transcriptContent.innerHTML = '<p style="padding: 15px; color: #999;">This video does not have captions.</p>';
        console.warn('No caption tracks found');
        return;
      }
      
      activeTrack = foundTrack;
      foundTrack.mode = 'hidden';
      
      // Wait for initial cues, then force load all
      setTimeout(function() {
        if (foundTrack.cues && foundTrack.cues.length > 0) {
          console.log('Initial cues loaded:', foundTrack.cues.length);
          renderCues(foundTrack);
          
          // Now force load the rest by seeking through video
          setTimeout(function() {
            forceLoadAllCues(foundTrack);
          }, 1000);
        } else {
          console.log('No initial cues yet, waiting longer...');
          setTimeout(function() {
            if (foundTrack.cues && foundTrack.cues.length > 0) {
              renderCues(foundTrack);
              forceLoadAllCues(foundTrack);
            } else {
              console.error('Still no cues loaded - captions may not be available');
              statusElement.textContent = 'Failed to load';
              transcriptContent.innerHTML = '<p style="padding: 15px; color: #ff6b6b;">Failed to load captions. Please check if captions are enabled for this video.</p>';
            }
          }, 2000);
        }
      }, 1000);
    }
    
    function highlightActiveCue() {
      player.on('timeupdate', function() {
        if (!transcriptContainer || !isVisible || !loadingComplete) {
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
