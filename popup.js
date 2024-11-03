document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('input-box');
  const chatArea = document.getElementById('chat-area');
  const questionDiv = document.querySelector('.question');
  const responseDiv = document.querySelector('.response');
  const geminiApiKey = GEMINI_API;
  const geminiVisionUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-002:generateContent';
  let uploadedImage = null;

  // Create image preview container
  const imagePreviewContainer = document.createElement('div');
  imagePreviewContainer.style.cssText = `
    display: none;
    position: absolute;
    top: 10px;
    right: 10px;
    width: 60px;
    height: 60px;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.1);
  `;
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(imagePreviewContainer);

  const systemPrompt = 'You are Suva Ai. You are student study assistant. You are made by NTF Sadnan. You reply short and precise and do not give extra info. You can see image.';

  let messageHistory = [
    { role: 'system', content: systemPrompt }
  ];

  async function typeText(text, element) {
    element.textContent = '';  
    let index = 0; 

    while (index < text.length) {
        element.textContent += text[index];  
        index++;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5)); 
        element.scrollIntoView({ behavior: 'smooth', block: 'end' });  
    }
  }
  
  

  function updateImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      imagePreviewContainer.innerHTML = '';
      imagePreviewContainer.appendChild(img);
      imagePreviewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  // Function to capture screenshot
  async function captureScreenshot() {
    try {
      // Send message to background script to capture screen
      const response = await chrome.runtime.sendMessage({action: "capture"});
      
 
      const res = await fetch(response.dataUrl);
      const blob = await res.blob();
      
 
      uploadedImage = new File([blob], 'screenshot.png', { type: 'image/png' });
      updateImagePreview(uploadedImage);
      input.placeholder = 'Screenshot captured! Type your question...';
      
    } catch (err) {
      console.error('Screenshot error:', err);
      alert('Failed to capture screenshot.');
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }

  async function analyzeImageWithGemini(base64Image, prompt) {
    try {
      const response = await fetch(`${geminiVisionUrl}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt + "Now answer this staying in character:" + prompt },
              {
                inline_data: {
                  mime_type: uploadedImage.type,
                  data: base64Image
                }
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to analyze image');
      }

      const data = await response.json();
      return data.candidates[0]?.content?.parts[0]?.text || 'No response from Gemini';
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  input.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const userInput = input.value.trim();
      if (!userInput) return;

      const question = userInput;
      input.value = '';
      chatArea.style.display = 'block';
      questionDiv.textContent = question;
      responseDiv.textContent = '';
      chatArea.classList.add('fade-in');
      
      responseDiv.classList.add('typing');
      messageHistory.push({ role: 'user', content: userInput });
      if (messageHistory.length > 11) {
        messageHistory.splice(1, 1);
      }

      try {
        let responseText;
        if (uploadedImage) {
          const base64Image = await fileToBase64(uploadedImage);
          responseText = await analyzeImageWithGemini(base64Image, userInput);
          
          uploadedImage = null;
          input.placeholder = 'Ask Suva...';
          await typeText(responseText, responseDiv);
        } else {
          const apiKey = GROQ_API;
          const model = MODEL;
          const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
          imagePreviewContainer.style.display = 'none';
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
          responseText = '';
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
        }

        responseDiv.classList.remove('typing');
        messageHistory.push({ role: 'assistant', content: responseText });
        if (messageHistory.length > 11) {
          messageHistory.splice(1, 1);
        }

      } catch (error) {
        console.error('Error:', error);
        responseDiv.textContent = `Error: ${error.message}`;
        responseDiv.classList.remove('typing');
      }
    }
  });

  // Create and style buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.position = 'absolute';
  buttonsContainer.style.right = '10px';
  buttonsContainer.style.bottom = '8px';
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.gap = '10px';
  document.getElementById('container').appendChild(buttonsContainer);

  // Add screenshot button
  const screenshotButton = document.createElement('button');
  screenshotButton.innerHTML = '~';
  screenshotButton.style.cssText = `
    background: transparent;
    border: none;
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
  `;
  
  // Add upload button
  const uploadButton = document.createElement('button');
  uploadButton.textContent = "+";
  uploadButton.style.cssText = `
    background: transparent;
    border: none;
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
  `;

  // Add buttons to container
  buttonsContainer.appendChild(screenshotButton);
  buttonsContainer.appendChild(uploadButton);

  // Create invisible file input
  const imageUpload = document.createElement('input');
  imageUpload.type = 'file';
  imageUpload.accept = 'image/*';
  imageUpload.style.display = 'none';
  document.body.appendChild(imageUpload);

  // Handle image file selection
  uploadButton.addEventListener('click', () => imageUpload.click());
  imageUpload.addEventListener('change', () => {
    uploadedImage = imageUpload.files[0];
    updateImagePreview(uploadedImage);
    input.placeholder = `Image uploaded: ${uploadedImage.name}`;
  });

  // Handle screenshot button click
  screenshotButton.addEventListener('click', captureScreenshot);

  // Handle pasted images
  document.addEventListener('paste', (event) => {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let item of items) {
      if (item.kind === 'file') {
        uploadedImage = item.getAsFile();
        updateImagePreview(uploadedImage);
        input.placeholder = `Image pasted: ${uploadedImage.name}`;
      }
    }
  });
});
