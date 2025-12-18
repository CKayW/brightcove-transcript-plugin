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
    var allCuesLoaded = false;
    
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
        console.log('No cues available yet');
        return false;
      }
      
      if (cues.length === lastCueCount && allCuesLoaded) {
        return true;
      }
      
      console.log('Rendering', cues.length, 'cues (previously had', lastCueCount, ')');
      lastCueCount = cues.length;
      
      statusElement.textContent = '(' + cues.length + ' of ~265 lines)';
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
      
      console.log('Transcript rendered with', cues.length, 'cues');
      return true;
    }
    
    function forceLoadAllCues(track) {
      console.log('Forcing all cues to load...');
      
      var originalMode = track.mode;
      var videoDuration = player.duration();
      
      console.log('Video duration:', videoDuration, 'seconds');
      
      // Strategy 1: Set track to "showing" to force load
      track.mode = 'showing';
      
      // Strategy 2: Quickly seek through video to trigger cue loading
      var currentTime = player.currentTime();
      var wasPlaying = !player.paused();
      
      if (wasPlaying) {
        player.pause();
      }
      
      // Seek to multiple points to trigger cue loading
      var seekPoints = [0, videoDuration * 0.25, videoDuration * 0.5, videoDuration * 0.75, videoDuration - 1];
      var seekIndex = 0;
      
      function seekNext() {
        if (seekIndex < seekPoints.length) {
          var seekTo = seekPoints[seekIndex];
          console.log('Seeking to', seekTo.toFixed(1), 'seconds to load cues...');
          player.currentTime(seekTo);
          seekIndex++;
          setTimeout(seekNext, 300);
        } else {
          // Done seeking, restore state
          console.log('Finished seeking, restoring player state...');
          player.currentTime(currentTime);
          
          // Hide captions after load
          track.mode = 'hidden';
          
          if (wasPlaying) {
            player.play();
          }
          
          // Wait a bit then render
          setTimeout(function() {
            var cueCount = track.cues ? track.cues.length : 0;
            console.log('Final cue count after force load:', cueCount);
            
            if (cueCount > 0) {
              allCuesLoaded = true;
              renderCues(track);
              var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
              statusElement.textContent = '(' + cueCount + ' lines)';
            }
          }, 1000);
        }
      }
      
      // Start seeking process after a short delay
      setTimeout(seekNext, 500);
    }
    
    function waitAndLoadCues(track, attempt) {
      attempt = attempt || 0;
      var maxAttempts = 10;
      
      console.log('Attempt', attempt + 1, '- Checking for cues...');
      
      var cues = track.cues;
      if (!cues || cues.length === 0) {
        if (attempt >= maxAttempts) {
          var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
          var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
          statusElement.textContent = 'Failed to load';
          transcriptContent.innerHTML = '<p style="padding: 15px; color: #ff6b6b;">Captions failed to load. Try playing the video.</p>';
          console.error('Failed to load captions');
          return;
        }
        
        setTimeout(function() {
          waitAndLoadCues(track, attempt + 1);
        }, 500);
        return;
      }
      
      // We have some cues, now force load all of them
      console.log('Initial cues found:', cues.length, '- now forcing full load...');
      renderCues(track);
      
      // Force load all cues
      setTimeout(function() {
        forceLoadAllCues(track);
      }, 1000);
      
      // Also keep monitoring during playback
      player.on('timeupdate', function() {
        if (!allCuesLoaded && track.cues && track.cues.length > lastCueCount) {
          console.log('More cues loaded during playback:', track.cues.length);
          renderCues(track);
        }
      });
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
        console.warn('No caption tracks found');
        return;
      }
      
      activeTrack = foundTrack;
      foundTrack.mode = 'hidden';
      
      setTimeout(function() {
        waitAndLoadCues(foundTrack);
      }, 500);
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
