(function(videojs) {
  'use strict';

  videojs.registerPlugin('interactiveTranscript', function(options) {
    var player = this;
    var transcriptContainer;
    var activeTrack = null;
    
    function createTranscriptUI() {
      var playerParent = player.el().parentNode;
      transcriptContainer = document.createElement('div');
      transcriptContainer.className = 'vjs-transcript-container';
      transcriptContainer.innerHTML = '<div class="vjs-transcript-header">Transcript <span class="vjs-transcript-status">Loading...</span></div><div class="vjs-transcript-content"></div>';
      playerParent.insertBefore(transcriptContainer, player.el().nextSibling);
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
      var maxAttempts = 20; // Try for 10 seconds
      
      console.log('Attempt', attempt + 1, '- Checking for cues...');
      
      if (renderCues(track)) {
        console.log('Transcript loaded successfully!');
        return;
      }
      
      if (attempt >= maxAttempts) {
        var statusElement = transcriptContainer.querySelector('.vjs-transcript-status');
        var transcriptContent = transcriptContainer.querySelector('.vjs-transcript-content');
        statusElement.textContent = 'Failed to load';
        transcriptContent.innerHTML = '<p style="padding: 15px; color: #ff6b6b;">Captions failed to load. Try refreshing the page or playing the video first.</p>';
        console.error('Failed to load captions after', maxAttempts, 'attempts');
        return;
      }
      
      // Try again in 500ms
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
        transcriptContent.innerHTML = '<p style="padding: 15px; color: #999;">This video does not have captions. Please add captions in Brightcove Studio.</p>';
        console.warn('No caption tracks found on this video');
        return;
      }
      
      activeTrack = foundTrack;
      
      // Make sure track is enabled
      foundTrack.mode = 'hidden';
      
      // Listen for load event
      foundTrack.addEventListener('load', function() {
        console.log('Track "load" event fired');
        waitForCues(foundTrack);
      });
      
      // Listen for cuechange
      foundTrack.addEventListener('cuechange', function() {
        console.log('Track "cuechange" event fired');
        if (transcriptContent.children.length === 0) {
          waitForCues(foundTrack);
        }
      });
      
      // Start polling for cues immediately
      waitForCues(foundTrack);
    }
    
    function highlightActiveCue() {
      player.on('timeupdate', function() {
        if (!transcriptContainer) return;
        
        var currentTime = player.currentTime();
        var cues = transcriptContainer.querySelectorAll('.vjs-transcript-cue');
        
        for (var i = 0; i < cues.length; i++) {
          var cue = cues[i];
          var startTime = parseFloat(cue.getAttribute('data-start'));
          var endTime = parseFloat(cue.getAttribute('data-end'));
          
          if (currentTime >= startTime && currentTime < endTime) {
            cue.classList.add('vjs-transcript-active');
            if (transcriptContainer.scrollTop > cue.offsetTop - 100 || 
                transcriptContainer.scrollTop < cue.offsetTop - tra
