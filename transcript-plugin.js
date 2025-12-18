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
    var allCues = [];
    
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
      transcriptContainer.innerHTML = '<div class="vjs-transcript-header">Transcript <span class="vjs-transcript-close">×</span><span class="vjs-transcript-status">Loading...</span></div><div class="vjs-transcript-content"></div>';
      
      player.el().appendChild(transcriptContainer);
      
      var closeBtn = transcriptContainer.querySelector('.vjs-transcript-close');
      closeBtn.addEventListener('click', function() {
        toggleTranscript();
      });
      
      console.log('Transcript UI created');
    }
    
    function parseVTT(vttText) {
      console.log('Parsing VTT file...');
      var lines = vttText.split('\n');
      var cues = [];
      var currentCue = null;
      
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        
        // Skip empty lines and WEBVTT header
        if (!line || line === 'WEBVTT' || line.startsWith('NOTE')) {
          continue;
        }
        
        // Check if this is a timestamp line
        if (line.indexOf('-->') !== -1) {
          var parts = line.split('-->');
          var startTime = parseTimestamp(parts[0].trim());
          var endTime = parseTimestamp(parts[1].trim().split(' ')[0]);
          
          currentCue = {
            startTime: startTime,
            endTime: endTime,
            text: ''
          };
        } else if (currentCue && line) {
          // This is text for the current cue
          if (currentCue.text) {
            currentCue.text += ' ';
          }
          currentCue.text += line;
        } else if (currentCue && !line) {
          // Empty line means end of cue
          cues.push(currentCue);
          currentCue = null;
        }
      }
      
      // Add last cue if exists
      if (currentCue) {
        cues.push(currentCue);
      }
      
      console.log('Parsed', cues.length, 'cues from VTT file');
      return cues;
    }
    
    function parseTimestamp(timestamp) {
      // Parse VTT timestamp like "00:00:12.500" or "00:12.500"
      var parts = timestamp.split(':');
      var seconds = 0;
      
      if (parts.length === 3) {
        // HH:MM:SS.mmm
        seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
      } else if (parts.length === 2) {
        // MM:SS.mmm
        seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
      } else {
        // SS.mmm
        seconds = parseFloat(parts[0]);
      }
      
      return seconds;
    }
    
    function renderTranscript(cues) {
      var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
      var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
      
      console.log('Rendering', cues.length, 'cues to transcript');
      
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
      
      allCues = cues;
      console.log('Transcript rendered successfully');
    }
    
    function fetchVTTFile(track) {
      console.log('Fetching VTT file directly...');
      
      // Get the VTT URL from the track
      var vttUrl = null;
      
      // Try to get URL from track src
      if (track.src) {
        vttUrl = track.src;
      }
      
      if (!vttUrl) {
        console.error('Could not find VTT URL');
        fallbackToPlayerCues(track);
        return;
      }
      
      console.log('VTT URL:', vttUrl);
      
      fetch(vttUrl)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Failed to fetch VTT file');
          }
          return response.text();
        })
        .then(function(vttText) {
          var cues = parseVTT(vttText);
          renderTranscript(cues);
        })
        .catch(function(error) {
          console.error('Error fetching VTT:', error);
          fallbackToPlayerCues(track);
        });
    }
    
    function fallbackToPlayerCues(track) {
      console.log('Falling back to player cues...');
      
      var checkCues = function() {
        if (track.cues && track.cues.length > 0) {
          console.log('Using', track.cues.length, 'cues from player');
          var cues = [];
          for (var i = 0; i < track.cues.length; i++) {
            var cue = track.cues[i];
            cues.push({
              startTime: cue.startTime,
              endTime: cue.endTime,
              text: cue.text
            });
          }
          renderTranscript(cues);
        } else {
          setTimeout(checkCues, 500);
        }
      };
      
      checkCues();
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
      
      // Wait a moment for track to be ready, then fetch VTT
      setTimeout(function() {
        fetchVTTFile(foundTrack);
      }, 1000);
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
