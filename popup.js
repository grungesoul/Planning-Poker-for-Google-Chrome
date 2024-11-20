document.addEventListener('DOMContentLoaded', function() {
  const settingsSection = document.getElementById('settings-section');
  const estimationSection = document.getElementById('estimation-section');
  const resultSection = document.getElementById('result-section');
  const playersList = document.getElementById('players-list');
  const votingContainer = document.getElementById('voting-container');
  const taskNameInput = document.getElementById('task-name');
  const historySection = document.getElementById('history-section');

  // Fibonacci sequence for estimation values
  const estimationValues = [1, 2, 3, 5, 8, 13, 21];

  // Initial setup - load saved players and history
  loadPlayers();
  loadHistory();

  // Event Listeners
  document.getElementById('settings-toggle').addEventListener('click', function() {
    settingsSection.classList.toggle('hidden');
    historySection.classList.add('hidden');
  });

  document.getElementById('history-toggle').addEventListener('click', function() {
    historySection.classList.toggle('hidden');
    settingsSection.classList.add('hidden');
  });

  document.getElementById('add-player').addEventListener('click', addNewPlayer);
  document.getElementById('save-settings').addEventListener('click', saveTeam);
  document.getElementById('calculate-result').addEventListener('click', calculateResult);
  document.getElementById('clear-history').addEventListener('click', clearHistory);

  // Add player when pressing Enter
  document.getElementById('new-player-name').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addNewPlayer();
    }
  });

  function addNewPlayer() {
    const playerName = document.getElementById('new-player-name').value.trim();
    if (playerName) {
      addPlayerCard(playerName);
      document.getElementById('new-player-name').value = '';
    }
  }

  function addPlayerCard(name) {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-button';
    removeButton.textContent = '-';
    
    removeButton.addEventListener('click', function() {
      playerCard.remove();
    });
    
    playerCard.appendChild(nameSpan);
    playerCard.appendChild(removeButton);
    playersList.appendChild(playerCard);
  }

  function saveTeam() {
    const players = Array.from(playersList.children).map(card => card.firstElementChild.textContent);
    chrome.storage.local.set({ players }, function() {
      settingsSection.classList.add('hidden');
      updateVotingSection(players);
    });
  }

  function loadPlayers() {
    chrome.storage.local.get(['players'], function(result) {
      if (result.players && result.players.length > 0) {
        playersList.innerHTML = '';
        result.players.forEach(addPlayerCard);
        updateVotingSection(result.players);
      }
    });
  }

  function updateVotingSection(players) {
    votingContainer.innerHTML = '';
    players.forEach(player => {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'player-input';
      
      const playerLabel = document.createElement('div');
      playerLabel.className = 'player-name';
      playerLabel.style.width = '40%';
      playerLabel.textContent = player;
      
      const estimateSelect = document.createElement('select');
      estimateSelect.className = 'player-estimate';
      estimateSelect.style.width = '60%';
      
      // Add empty default option
      const defaultOption = document.createElement('option');
      defaultOption.value = "";
      defaultOption.textContent = "Select points...";
      estimateSelect.appendChild(defaultOption);
      
      estimationValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        estimateSelect.appendChild(option);
      });
      
      playerDiv.appendChild(playerLabel);
      playerDiv.appendChild(estimateSelect);
      votingContainer.appendChild(playerDiv);
    });
  }

  function calculateResult() {
    const taskName = taskNameInput.value;
    if (!taskName) {
      showError('Please enter a task name');
      return;
    }

    const playerInputs = document.querySelectorAll('.player-input');
    if (playerInputs.length === 0) {
      showError('Please add team members in Settings first');
      return;
    }

    // Get all selects and check if any has no value selected
    const selects = Array.from(document.querySelectorAll('.player-estimate'));
    const emptyVotes = selects.some(select => !select.value);

    if (emptyVotes) {
      showError('All team members must vote before calculating');
      return;
    }

    // If we get here, everyone has voted
    const votes = selects.map(select => parseInt(select.value));
    
    // Find most common vote
    const counts = {};
    let maxCount = 0;
    let mostCommon = votes[0];

    votes.forEach(vote => {
      counts[vote] = (counts[vote] || 0) + 1;
      if (counts[vote] > maxCount) {
        maxCount = counts[vote];
        mostCommon = vote;
      }
    });

    // Hide error message if it exists
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.classList.remove('visible');
    }

    const result = {
      taskName,
      estimate: mostCommon,
      votes: maxCount,
      totalVotes: votes.length,
      timestamp: new Date().toISOString()
    };

    saveToHistory(result);
    showResult(result);
  }

  function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.classList.add('visible');
    }
  }

  function showResult(result) {
    resultSection.classList.remove('hidden');
    resultSection.innerHTML = `
      <strong>${result.taskName}</strong><br>
      Most common estimate: ${result.estimate} points<br>
      (${result.votes} out of ${result.totalVotes} votes)<br><br>
      <button id="new-vote" class="secondary">Start New Vote</button>
    `;

    // Add event listener to the new button
    document.getElementById('new-vote').addEventListener('click', startNewVote);
  }

  function startNewVote() {
    // Clear task name
    taskNameInput.value = '';
    
    // Reset all select elements to default
    const selects = document.querySelectorAll('.player-estimate');
    selects.forEach(select => {
      select.value = "";
    });

    // Hide result section
    resultSection.classList.add('hidden');
    
    // Clear any error messages
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.classList.remove('visible');
      errorDiv.textContent = '';
    }

    // Focus on task name input
    taskNameInput.focus();
  }

  function saveToHistory(result) {
    chrome.storage.local.get(['history'], function(data) {
      const history = data.history || [];
      history.unshift(result); // Add new result at the beginning
      // Keep only last 10 estimates
      const limitedHistory = history.slice(0, 10);
      chrome.storage.local.set({ history: limitedHistory }, function() {
        updateHistoryView(limitedHistory);
      });
    });
  }

  function loadHistory() {
    chrome.storage.local.get(['history'], function(data) {
      if (data.history) {
        updateHistoryView(data.history);
      }
    });
  }

  function updateHistoryView(history) {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';  // Clear existing history

    history.forEach(result => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      const titleStrong = document.createElement('strong');
      titleStrong.textContent = result.taskName;
      
      const estimateDiv = document.createElement('div');
      estimateDiv.textContent = `Estimate: ${result.estimate} points (${result.votes}/${result.totalVotes} votes)`;
      
      const dateDiv = document.createElement('div');
      dateDiv.className = 'history-date';
      dateDiv.textContent = new Date(result.timestamp).toLocaleDateString();
      
      historyItem.appendChild(titleStrong);
      historyItem.appendChild(estimateDiv);
      historyItem.appendChild(dateDiv);
      
      historyList.appendChild(historyItem);
    });
  }

  function clearHistory() {
    chrome.storage.local.set({ history: [] }, function() {
      updateHistoryView([]);
    });
  }
}); 