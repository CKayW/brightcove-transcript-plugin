// Brightcove Interactive Transcript Plugin
videojs.registerPlugin('interactiveTranscript', function(options) {
  var player = this;
  var transcriptPanel = null;
  var transcriptButton = null;
  var cueData = [];
  
  // Wait for player to be ready and load transcript
  player.ready(function() {
    loadTranscript();
    createTranscriptButton();
  });
  
  // Load transcript from text tracks
  function loadTranscript() {
    var tracks = player.textTracks();
    
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].kind === 'captions' || tracks[i].kind === 'subtitles') {
        tracks[i].on('loaded', function() {
          var cues = this.cues;
          cueData = [];
          
          for (var j = 0; j < cues.length; j++) {
            cueData.push({
              start: cues[j].startTime,
              end: cues[j].endTime,
              text: cues[j].text
            });
          }
        });
        break;
      }
    }
  }
  
  // Create transcript button in control bar
  function createTranscriptButton() {
    var Button = videojs.getComponent('Button');
    var TranscriptButton = videojs.extend(Button, {
      constructor: function() {
        Button.apply(this, arguments);
        this.controlText('Transcript');
      },
      handleClick: function() {
        toggleTranscript();
      },
      buildCSSClass: function() {
        return 'vjs-transcript-button ' + Button.prototype.buildCSSClass.call(this);
      }
    });
    
    videojs.registerComponent('TranscriptButton', TranscriptButton);
    transcriptButton = player.controlBar.addChild('TranscriptButton', {});
    player.controlBar.el().insertBefore(transcriptButton.el(), player.controlBar.fullscreenToggle.el());
  }
  
  // Toggle transcript panel
  function toggleTranscript() {
    if (transcriptPanel) {
      transcriptPanel.parentNode.removeChild(transcriptPanel);
      transcriptPanel = null;
      transcriptButton.removeClass('transcript-active');
    } else {
      showTranscript();
      transcriptButton.addClass('transcript-active');
    }
  }
  
  // Show transcript panel
  function showTranscript() {
    transcriptPanel = document.createElement('div');
    transcriptPanel.className = 'transcript-panel';
    
    var header = document.createElement('div');
    header.className = 'transcript-header';
    header.innerHTML = '<h3>Transcript</h3><button class="transcript-close">×</button>';
    transcriptPanel.appendChild(header);
    
    var content = document.createElement('div');
    content.className = 'transcript-content';
    
    cueData.forEach(function(cue, index) {
      var line = document.createElement('div');
      line.className = 'transcript-line';
      line.setAttribute('data-start', cue.start);
      line.setAttribute('data-end', cue.end);
      line.textContent = cue.text;
      
      line.addEventListener('click', function() {
        player.currentTime(parseFloat(this.getAttribute('data-start')));
      });
      
      content.appendChild(line);
    });
    
    transcriptPanel.appendChild(content);
    player.el().parentNode.appendChild(transcriptPanel);
    
    // Close button handler
    header.querySelector('.transcript-close').addEventListener('click', function() {
      toggleTranscript();
    });
    
    // Update active line during playback
    player.on('timeupdate', updateActiveLine);
  }
  
  // Highlight current line
  function updateActiveLine() {
    if (!transcriptPanel) return;
    
    var currentTime = player.currentTime();
    var lines = transcriptPanel.querySelectorAll('.transcript-line');
    
    lines.forEach(function(line) {
      var start = parseFloat(line.getAttribute('data-start'));
      var end = parseFloat(line.getAttribute('data-end'));
      
      if (currentTime >= start && currentTime <= end) {
        line.classList.add('active');
        line.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        line.classList.remove('active');
      }
    });
  }
});
