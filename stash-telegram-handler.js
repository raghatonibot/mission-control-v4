// Stash Telegram Handler - Simple command
// Adicionar ao server.js existente

// Command: /stash <url> or just send Instagram URL

function handleStashRequest(message, fromKey) {
  const text = message?.message?.text || '';
  const chatId = message?.message?.chat?.id;
  
  // Detect Instagram URL in message
  const instagramUrlMatch = text.match(/(https?:\/\/(www\.)?instagram\.com\/[^\s]+)/i);
  const isStashCommand = text.toLowerCase().startsWith('/stash');
  
  if (instagramUrlMatch || isStashCommand) {
    const url = instagramUrlMatch ? instagramUrlMatch[1] : text.replace('/stash', '').trim();
    
    if (!url) {
      return { response: '用法: /stash <link-do-instagram>\n\nOu basta enviar o link direto!' };
    }
    
    if (!url.includes('instagram.com')) {
      return { response: '❌ Apenas links do Instagram são suportados.' };
    }
    
    // Save to stash
    return { 
      stash: true, 
      url: url,
      response: `📥 Recebido! Analisando...\n\n${url}` 
    };
  }
  
  return null;
}
