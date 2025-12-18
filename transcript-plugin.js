(function(videojs) {
  'use strict';

  videojs.registerPlugin('interactiveTranscript', function(options) {
    var player = this;
    var transcriptContainer;
    
    function createTranscriptUI() {
      // Create container NEXT to the player, not over it
      var playerParent = player.el().parentNode;
      transcriptContainer = document.createElement('div');
      transcriptContainer.className = 'vjs-transcript-container';
      transcriptContainer.innerHTML = '<div class="vjs-transcript-header">Transcript <span class="vjs-transcript-status">Loading...</span></div><div class="vjs-transcript-content"></div>';
      
      // Insert after the player element
      playerParent.insertBefore(transcriptContainer, player.el().nextSibling);
      
      console.log('Transcript UI created');
    }
    
    function loadTranscript() {
      var tracks = player.textTracks();
      var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
      var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
      
      console.log('Total text tracks found:', tracks.length);
      
      // Try to find any text track
      var foundTrack = null;
      for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        console.log('Track ' + i + ':', track.kind, track.label, track.language);
        
        if (track.kind === 'captions' || track.kind === 'subtitles' || track.kind === 'metadata') {
          foundTrack = track;
          console.log('Using track:', track.label || track.kind);
          break;
        }
      }
      
      if (!foundTrack) {
        statusElement.textContent = 'No captions found';
        transcriptContent.innerHTML = '<p style="padding: 15px; color: #999;">This video does not have captions. Please add captions in Brightcove Studio.</p>';
        console.warn('No caption tracks found on this video');
        return;
      }
      
      // Function to render cues
      function renderCues() {
        var cues = foundTrack.cues;
        
        if (!cues || cues.length === 0) {
          console.log('Track has no cues yet, waiting...');
          return;
        }
        
        console.log('Rendering', cues.length, 'cues');
        statusElement.textContent = '(' + cues.length + ' lines)';
        transcriptContent.innerHTML = '';
        
        for (var j = 0; j < cues.length; j++) {
          var cue = cues[j];
          var cueElement = document.createElement('p');
          cueElement.className = 'vjs-transcript-cue';
          cueElement.setAttribute('data-start', cue.startTime);
          cueElement.setAttribute('data-end', cue.endTime);
          
          // Clean up the text (remove HTML tags, VTT formatting)
          var text = cue.text || '';
          text = text.replace(/<[^>]*>/g, '');
          text = text.replace(/\n/g, ' ');
          cueElement.textContent = text;
          
          // Click to seek
          cueElement.addEventListener('click', function() {
            var startTime = parseFloat(this.getAttribute('data-start'));
            player.currentTime(startTime);
            player.play();
          });
          
          transcriptContent.appendChild(cueElement);
        }
        
        console.log('Transcript loaded successfully');
      }
      
      // Set track mode to hidden (loads captions without displaying them)
      foundTrack.mode = 'hidden';
      
      // Listen for cues to load
      foundTrack.addEventListener('load', function() {
        console.log('Track loaded event fired');
        renderCues();
      });
      
      // Also try rendering immediately in case already loaded
      setTimeout(function() {
        renderCues();
      }, 100);
      
      // And try again after a longer delay
      setTimeout(function() {
        if (transcriptContent.children.length === 0) {
          renderCues();
        }
      }, 1000);
    }
    
    function highlightActiveCue() {
      player.on('timeupdate', function() {
        var currentTime = player.currentTime();
        var cues = transcriptContainer.querySelectorAll('.vjs-transcript-cue');
        
        for (var i = 0; i < cues.length; i++) {
          var cue = cues[i];
          var startTime = parseFloat(cue.getAttribute('data-start'));
          var endTime = parseFloat(cue.getAttribute('data-end'));
          
          if (currentTime >= startTime && currentTime < endTime) {
            cue.classList.add('vjs-transcript-active');
            // Auto-scroll
            if (transcriptContainer.scrollTop > cue.offsetTop - 100 || 
                transcriptContainer.scrollTop < cue.offsetTop - transcriptContainer.clientHeight + 100) {
              cue.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else {
            cue.classList.remove('vjs-transcript-active');
          }
        }
      });
    }
    
    // Initialize
    player.ready(function() {
      console.log('Player ready, initializing transcript plugin');
      createTranscriptUI();
      
      // Wait a bit for tracks to be available
      setTimeout(function() {
        loadTranscript();
        highlightActiveCue();
      }, 500);
    });
  });

})(window.videojs);
