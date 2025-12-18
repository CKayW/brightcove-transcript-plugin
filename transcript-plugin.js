(function(videojs) {
  'use strict';

  videojs.registerPlugin('interactiveTranscript', function(options) {
    var player = this;
    var transcriptContainer;
    
    function createTranscriptUI() {
      transcriptContainer = document.createElement('div');
      transcriptContainer.className = 'vjs-transcript-container';
      transcriptContainer.innerHTML = '<div class="vjs-transcript-header">Transcript</div><div class="vjs-transcript-content"></div>';
      player.el().appendChild(transcriptContainer);
    }
    
    function loadTranscript() {
      var tracks = player.textTracks();
      var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
      
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].kind === 'captions' || tracks[i].kind === 'subtitles') {
          var track = tracks[i];
          
          track.addEventListener('load', function() {
            transcriptContent.innerHTML = '';
            var cues = track.cues || [];
            
            for (var j = 0; j < cues.length; j++) {
              var cue = cues[j];
              var cueElement = document.createElement('p');
              cueElement.className = 'vjs-transcript-cue';
              cueElement.setAttribute('data-start', cue.startTime);
              cueElement.textContent = cue.text.replace(/<[^>]*>/g, '');
              
              cueElement.addEventListener('click', function() {
                var startTime = parseFloat(this.getAttribute('data-start'));
                player.currentTime(startTime);
                player.play();
              });
              
              transcriptContent.appendChild(cueElement);
            }
          });
          
          track.mode = 'hidden';
          break;
        }
      }
    }
    
    function highlightActiveCue() {
      player.on('timeupdate', function() {
        var currentTime = player.currentTime();
        var cues = transcriptContainer.querySelectorAll('.vjs-transcript-cue');
        
        for (var i = 0; i < cues.length; i++) {
          var cue = cues[i];
          var startTime = parseFloat(cue.getAttribute('data-start'));
          var nextCue = cues[i + 1];
          var endTime = nextCue ? parseFloat(nextCue.getAttribute('data-start')) : Infinity;
          
          if (currentTime >= startTime && currentTime < endTime) {
            cue.classList.add('vjs-transcript-active');
            cue.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            cue.classList.remove('vjs-transcript-active');
          }
        }
      });
    }
    
    player.ready(function() {
      createTranscriptUI();
      setTimeout(function() {
        loadTranscript();
        highlightActiveCue();
      }, 500);
    });
  });

})(window.videojs);