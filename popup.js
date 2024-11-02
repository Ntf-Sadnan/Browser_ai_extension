document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('input-box');
  const chatArea = document.getElementById('chat-area');
  const questionDiv = document.querySelector('.question');
  const responseDiv = document.querySelector('.response');
  
  const systemPrompt = 'You are Suva Ai. You are student study assistant. You are made by Mubtasim Hasan & NTF Sadnan. You reply short and precise and do not give extra info';
  
  let messageHistory = [
    { role: 'system', content: systemPrompt }
  ];

  async function typeResponse(text) {
    let index = 0;
    responseDiv.textContent = '';
    
    while (index < text.length) {
      responseDiv.textContent += text[index];
      index++;
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
      responseDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  input.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const userInput = input.value.trim();
      if (!userInput) return;

      // Save and clear input
      const question = userInput;
      input.value = '';

      // Show chat area with question
      chatArea.style.display = 'block';
      questionDiv.textContent = question;
      responseDiv.textContent = '';
      chatArea.classList.add('fade-in');
      
      responseDiv.classList.add('typing');

      // Update message history
      messageHistory.push({ role: 'user', content: userInput });
      if (messageHistory.length > 11) {
        messageHistory.splice(1, 1);
      }

      try {
        const apiKey = API_KEY;
        const model = MODEL;
        const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: messageHistory,
            model: model,
            stream: true
          })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let responseText = '';
        let partialLine = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = (partialLine + chunk).split('\n');
          partialLine = lines.pop();

          for (const line of lines) {
            if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;

            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.substring(6));
                const delta = json.choices[0].delta.content;
                if (delta) {
                  responseText += delta;
                  responseDiv.textContent = responseText;
                  chatArea.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
              } catch (e) {
                console.error('Error parsing JSON:', e);
              }
            }
          }
        }

        responseDiv.classList.remove('typing');
        messageHistory.push({ role: 'assistant', content: responseText });
        if (messageHistory.length > 11) {
          messageHistory.splice(1, 1);
        }

      } catch (error) {
        responseDiv.textContent = `Error: ${error.message}`;
        responseDiv.classList.remove('typing');
      }
    }
  });

  // Auto-focus input when popup opens
  input.focus();
});