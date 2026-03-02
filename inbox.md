Integration plan:
- POST /api/inbox/telegram (x-inbox-token)
- Task status awaiting_approval
- toolsInvoke('message', {action:'send', target: chatId, message})
- Approve endpoint
